import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import type { Hono } from "hono";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let app: Hono;
let client: Client;
let appDbClient: Client;
let tempDir: string;
let ipCounter = 0;

describe("machine votes API", () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pachilog-machine-votes-"));
    const databaseUrl = `file:${join(tempDir, "test.db")}`;
    process.env.DATABASE_URL = databaseUrl;
    process.env.DATABASE_AUTH_TOKEN = "";
    client = createClient({ url: databaseUrl });
    await client.batch([
      `CREATE TABLE machines (
        id integer PRIMARY KEY AUTOINCREMENT,
        name text NOT NULL,
        short_name text,
        aliases text,
        exclude_terms text,
        type text,
        maker text,
        series text,
        release_date text,
        thumbnail_url text,
        source_url text,
        official_url text,
        created_at integer NOT NULL,
        updated_at integer
      )`,
      `CREATE TABLE machine_votes (
        id integer PRIMARY KEY AUTOINCREMENT,
        machine_id integer NOT NULL,
        vote_type text NOT NULL,
        voter_fingerprint text NOT NULL,
        created_at integer NOT NULL,
        FOREIGN KEY(machine_id) REFERENCES machines(id) ON DELETE cascade
      )`,
      `CREATE UNIQUE INDEX machine_vote_fingerprint_idx ON machine_votes (machine_id, voter_fingerprint)`,
      `INSERT INTO machines (id, name, created_at) VALUES (1, 'machine one', 0)`,
      `INSERT INTO machines (id, name, created_at) VALUES (2, 'machine two', 0)`,
      `INSERT INTO machines (id, name, created_at) VALUES (3, 'machine three', 0)`,
      `INSERT INTO machines (id, name, created_at) VALUES (4, 'machine four', 0)`,
      `INSERT INTO machines (id, name, created_at) VALUES (5, 'machine five', 0)`,
    ]);
    app = (await import("../index")).default;
    appDbClient = (await import("../database")).client;
  });

  afterAll(async () => {
    appDbClient.close();
    client.close();
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  });

  test("records a new vote", async () => {
    const response = await postVote(1, { voteType: "want_to_play", voterFingerprint: "fingerprint-new-1" });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ ok: true, status: "recorded" });
  });

  test("returns already_recorded for the same vote", async () => {
    await postVote(2, { voteType: "wait_and_see", voterFingerprint: "fingerprint-same-1" });
    const response = await postVote(2, { voteType: "wait_and_see", voterFingerprint: "fingerprint-same-1" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, status: "already_recorded" });
  });

  test("updates an existing vote when voteType changes", async () => {
    await postVote(3, { voteType: "not_interested", voterFingerprint: "fingerprint-update-1" });
    const response = await postVote(3, { voteType: "want_to_play", voterFingerprint: "fingerprint-update-1" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, status: "updated" });
    const stored = await client.execute({
      sql: "SELECT vote_type FROM machine_votes WHERE machine_id = ? AND voter_fingerprint = ?",
      args: [3, "fingerprint-update-1"],
    });
    expect(stored.rows[0]?.vote_type).toBe("want_to_play");
  });

  test("rejects non-object JSON bodies and invalid JSON without throwing", async () => {
    for (const body of [null, [], "text", 123]) {
      const response = await rawPost(4, JSON.stringify(body), "application/json");
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: "invalid body" });
    }

    const invalidJson = await rawPost(4, "{", "application/json");
    expect(invalidJson.status).toBe(400);
    await expect(invalidJson.json()).resolves.toMatchObject({ error: "invalid json" });
  });

  test("rejects unknown machines", async () => {
    const response = await postVote(9999, { voteType: "want_to_play", voterFingerprint: "fingerprint-missing-1" });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: "machine not found" });
  });

  test("keeps one row for concurrent duplicate submissions", async () => {
    const [first, second] = await Promise.all([
      postVote(5, { voteType: "want_to_play", voterFingerprint: "fingerprint-concurrent-1" }),
      postVote(5, { voteType: "want_to_play", voterFingerprint: "fingerprint-concurrent-1" }),
    ]);

    expect([first.status, second.status].sort()).toEqual([200, 201]);
    const rows = await client.execute({
      sql: "SELECT COUNT(*) AS count FROM machine_votes WHERE machine_id = ? AND voter_fingerprint = ?",
      args: [5, "fingerprint-concurrent-1"],
    });
    expect(Number(rows.rows[0]?.count)).toBe(1);
  });

  test("allows one final state for concurrent updates with different vote types", async () => {
    await postVote(5, { voteType: "wait_and_see", voterFingerprint: "fingerprint-race-1" });
    const [first, second] = await Promise.all([
      postVote(5, { voteType: "want_to_play", voterFingerprint: "fingerprint-race-1" }),
      postVote(5, { voteType: "not_interested", voterFingerprint: "fingerprint-race-1" }),
    ]);

    expect([200, 201]).toContain(first.status);
    expect([200, 201]).toContain(second.status);
    const rows = await client.execute({
      sql: "SELECT COUNT(*) AS count, vote_type FROM machine_votes WHERE machine_id = ? AND voter_fingerprint = ?",
      args: [5, "fingerprint-race-1"],
    });
    expect(Number(rows.rows[0]?.count)).toBe(1);
    // Last writer wins for different concurrent voteTypes; the API only guarantees one stored row.
    expect(["want_to_play", "not_interested"]).toContain(rows.rows[0]?.vote_type);
  });
});

function postVote(machineId: number, body: Record<string, unknown>) {
  return rawPost(machineId, JSON.stringify(body), "application/json");
}

function rawPost(machineId: number, body: string, contentType: string) {
  ipCounter += 1;
  return app.request(`/api/machines/${machineId}/votes`, {
    method: "POST",
    headers: {
      "content-type": contentType,
      "x-forwarded-for": `192.0.2.${ipCounter}`,
    },
    body,
  });
}
