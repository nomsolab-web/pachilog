import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as schema from "../database/schema";
import { machineMentions, machineVotes, machines, machineVideoJudgments, videoMachineLinks } from "../database/schema";
import { DUPLICATE_MACHINE_GROUPS, mergeDuplicateMachineGroup } from "./merge-duplicate-machines";

let client: Client;
let tempDir: string;
const now = new Date(0);

describe("duplicate machine merge integration", () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pachilog-machine-merge-"));
    client = createClient({ url: `file:${join(tempDir, "test.db")}` });
    await client.batch([
      "PRAGMA foreign_keys = ON",
      "CREATE TABLE machines (id integer PRIMARY KEY, name text NOT NULL, short_name text, aliases text, unique_aliases text, ambiguous_aliases text, resolving_keywords text, exclude_terms text, type text, maker text, series text, release_date text, thumbnail_url text, source_url text, official_url text, created_at integer NOT NULL, updated_at integer)",
      "CREATE TABLE channels (id integer PRIMARY KEY, name text NOT NULL, created_at integer NOT NULL)",
      "CREATE TABLE videos (video_id text PRIMARY KEY)",
      "CREATE TABLE video_machine_links (id integer PRIMARY KEY AUTOINCREMENT, video_id text NOT NULL REFERENCES videos(video_id) ON DELETE CASCADE, machine_id integer NOT NULL REFERENCES machines(id) ON DELETE CASCADE, match_confidence integer NOT NULL, match_method text NOT NULL, created_at integer NOT NULL, updated_at integer NOT NULL, UNIQUE(video_id, machine_id))",
      "CREATE TABLE machine_mentions (id integer PRIMARY KEY AUTOINCREMENT, machine_id integer NOT NULL REFERENCES machines(id) ON DELETE CASCADE, channel_id integer NOT NULL REFERENCES channels(id) ON DELETE CASCADE, video_id text NOT NULL, video_title text NOT NULL, view_count integer NOT NULL, like_count integer NOT NULL, comment_count integer NOT NULL, published_at text, updated_at integer NOT NULL, UNIQUE(machine_id, video_id))",
      "CREATE TABLE machine_votes (id integer PRIMARY KEY AUTOINCREMENT, machine_id integer NOT NULL REFERENCES machines(id) ON DELETE CASCADE, vote_type text NOT NULL, voter_fingerprint text NOT NULL, created_at integer NOT NULL, UNIQUE(machine_id, voter_fingerprint))",
      "CREATE TABLE machine_video_judgments (id integer PRIMARY KEY AUTOINCREMENT, judgment_key text NOT NULL UNIQUE, machine_id integer REFERENCES machines(id) ON DELETE CASCADE, channel_id integer REFERENCES channels(id) ON DELETE SET NULL, video_id text NOT NULL, video_title text NOT NULL, channel_name text, published_at text, source text NOT NULL, status text NOT NULL, confidence integer NOT NULL, reason text, matched_terms text, raw_response text, created_at integer NOT NULL, updated_at integer NOT NULL)",
    ]);
  });

  afterAll(async () => {
    client.close();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await rm(tempDir, { recursive: true, force: true });
        break;
      } catch (error) {
        if (attempt === 4) throw error;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
  });

  test("moves all related rows, merges metadata, deduplicates links, and is idempotent", async () => {
    const localDb = drizzle(client, { schema });
    await localDb.insert(machines).values([
      { id: 8, name: "canonical", maker: "ニューギン", type: "pachinko", releaseDate: "2026-07-21", aliases: ["a"], createdAt: now },
      { id: 5, name: "duplicate", maker: "SANYO", type: "pachinko", releaseDate: "2026-07-21", aliases: ["b"], shortName: "short", createdAt: now },
    ]);
    await client.batch(["INSERT INTO videos (video_id) VALUES ('v1'), ('v2')", "INSERT INTO channels (id, name, created_at) VALUES (1, 'channel', 0)"]);
    await localDb.insert(videoMachineLinks).values([
      { videoId: "v1", machineId: 8, matchConfidence: 80, matchMethod: "manual", createdAt: now, updatedAt: now },
      { videoId: "v1", machineId: 5, matchConfidence: 99, matchMethod: "manual_excluded", createdAt: now, updatedAt: now },
      { videoId: "v2", machineId: 5, matchConfidence: 80, matchMethod: "alias", createdAt: now, updatedAt: now },
    ]);
    await localDb.insert(machineMentions).values([
      { machineId: 5, channelId: 1, videoId: "v1", videoTitle: "v1", viewCount: 1, likeCount: 1, commentCount: 1, updatedAt: now },
    ]);
    await localDb.insert(machineVotes).values([{ machineId: 5, voteType: "want_to_play", voterFingerprint: "fp", createdAt: now }]);
    await localDb.insert(machineVideoJudgments).values([{ judgmentKey: "j1", machineId: 5, videoId: "v1", videoTitle: "v1", source: "gemini", status: "auto_linked", confidence: 80, createdAt: now, updatedAt: now }]);

    await localDb.transaction((tx) => mergeDuplicateMachineGroup(tx, DUPLICATE_MACHINE_GROUPS[0]));
    expect((await localDb.select().from(machines)).map((row) => row.id)).toEqual([8]);
    expect((await localDb.select().from(videoMachineLinks)).map((row) => [row.machineId, row.videoId, row.matchMethod])).toEqual([[8, "v1", "manual_excluded"], [8, "v2", "alias"]]);
    expect((await localDb.select().from(machineMentions)).every((row) => row.machineId === 8)).toBe(true);
    expect((await localDb.select().from(machineVotes)).every((row) => row.machineId === 8)).toBe(true);
    expect((await localDb.select().from(machineVideoJudgments)).every((row) => row.machineId === 8)).toBe(true);
    expect((await localDb.select().from(machines))[0].shortName).toBe("short");
    expect((await client.execute("PRAGMA foreign_key_check")).rows).toHaveLength(0);

    await localDb.transaction((tx) => mergeDuplicateMachineGroup(tx, DUPLICATE_MACHINE_GROUPS[0]));
    expect((await localDb.select().from(videoMachineLinks)).length).toBe(2);
  });

  test("rolls back every table when a transaction fails", async () => {
    const localDb = drizzle(client, { schema });
    await localDb.insert(machines).values([{ id: 7, name: "canonical", maker: "オッケー.", type: "pachinko", releaseDate: "2026-07-06", createdAt: now }, { id: 4, name: "duplicate", maker: "SANYO", type: "pachinko", releaseDate: "2026-07-06", createdAt: now }]);
    await client.batch(["INSERT INTO videos (video_id) VALUES ('v3')", "INSERT INTO channels (id, name, created_at) VALUES (2, 'channel 2', 0)"]);
    await localDb.insert(videoMachineLinks).values([{ videoId: "v3", machineId: 4, matchConfidence: 80, matchMethod: "alias", createdAt: now, updatedAt: now }]);
    await localDb.insert(machineMentions).values([{ machineId: 4, channelId: 2, videoId: "v3", videoTitle: "v3", viewCount: 1, likeCount: 1, commentCount: 1, updatedAt: now }]);
    await localDb.insert(machineVotes).values([{ machineId: 4, voteType: "want_to_play", voterFingerprint: "fp-rollback", createdAt: now }]);
    await localDb.insert(machineVideoJudgments).values([{ judgmentKey: "j-rollback", machineId: 4, videoId: "v3", videoTitle: "v3", source: "gemini", status: "auto_linked", confidence: 80, createdAt: now, updatedAt: now }]);
    await expect(localDb.transaction(async (tx) => { await mergeDuplicateMachineGroup(tx, DUPLICATE_MACHINE_GROUPS[2]); throw new Error("rollback"); })).rejects.toThrow("rollback");
    expect((await localDb.select().from(machines)).map((row) => row.id).sort()).toEqual([4, 7, 8]);
    expect((await localDb.select().from(videoMachineLinks)).filter((row) => row.machineId === 4)).toHaveLength(1);
    expect((await localDb.select().from(machineMentions)).filter((row) => row.machineId === 4)).toHaveLength(1);
    expect((await localDb.select().from(machineVotes)).filter((row) => row.machineId === 4)).toHaveLength(1);
    expect((await localDb.select().from(machineVideoJudgments)).filter((row) => row.machineId === 4)).toHaveLength(1);
    expect((await client.execute("PRAGMA foreign_key_check")).rows).toHaveLength(0);
  });
});
