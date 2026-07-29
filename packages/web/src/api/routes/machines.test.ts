import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { Hono } from "hono";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as schema from "../database/schema";

let app: Hono;
let client: Client;
let tempDir: string;

describe("machines API route", () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pachilog-machines-"));
    client = createClient({ url: `file:${join(tempDir, "test.db")}` });
    await client.batch([
      `CREATE TABLE machines (
        id integer PRIMARY KEY,
        name text NOT NULL,
        short_name text,
        aliases text,
        unique_aliases text,
        ambiguous_aliases text,
        resolving_keywords text,
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
      `CREATE TABLE channels (
        id integer PRIMARY KEY,
        youtube_channel_id text,
        handle text,
        name text NOT NULL,
        thumbnail_url text,
        category text NOT NULL DEFAULT 'other',
        active integer NOT NULL DEFAULT 1,
        created_at integer NOT NULL
      )`,
      `CREATE TABLE videos (
        id integer PRIMARY KEY,
        video_id text NOT NULL UNIQUE,
        channel_id integer NOT NULL,
        title text NOT NULL,
        thumbnail_url text,
        published_at text,
        view_count integer NOT NULL DEFAULT 0,
        like_count integer NOT NULL DEFAULT 0,
        comment_count integer NOT NULL DEFAULT 0,
        content_type text NOT NULL DEFAULT 'unknown',
        content_type_reason text,
        content_type_confidence integer NOT NULL DEFAULT 0,
        duration_seconds integer,
        live_broadcast_content text,
        match_status text NOT NULL DEFAULT 'pending',
        created_at integer NOT NULL,
        updated_at integer NOT NULL
      )`,
      `CREATE TABLE video_snapshots (
        id integer PRIMARY KEY,
        video_id text NOT NULL,
        date text NOT NULL,
        view_count integer NOT NULL,
        like_count integer NOT NULL,
        comment_count integer NOT NULL,
        collected_at integer NOT NULL
      )`,
      `CREATE TABLE video_machine_links (
        id integer PRIMARY KEY AUTOINCREMENT,
        video_id text NOT NULL,
        machine_id integer NOT NULL,
        match_confidence integer NOT NULL DEFAULT 0,
        match_method text NOT NULL,
        created_at integer NOT NULL,
        updated_at integer NOT NULL
      )`,
      `CREATE TABLE machine_votes (
        id integer PRIMARY KEY AUTOINCREMENT,
        machine_id integer NOT NULL,
        vote_type text NOT NULL,
        voter_fingerprint text NOT NULL,
        created_at integer NOT NULL
      )`,
      `INSERT INTO machines (id, name, type, release_date, created_at) VALUES
        (1, 'Machine A', 'pachinko', '2026-07-01', 0),
        (2, 'Machine Zero', 'pachinko', '2026-07-01', 0),
        (3, 'Machine B', 'slot', '2026-07-01', 0)`,
      `INSERT INTO channels (id, name, created_at) VALUES (10, 'Channel One', 0), (11, 'Channel Two', 0)`,
      `INSERT INTO videos (id, video_id, channel_id, title, view_count, content_type, match_status, created_at, updated_at) VALUES
        (1, 'v1', 10, 'A first', 150, 'standard', 'matched', 0, 0),
        (2, 'v2', 10, 'A second', 220, 'standard', 'matched', 0, 0),
        (3, 'v3', 11, 'B first', 80, 'short', 'matched', 0, 0)`,
      `INSERT INTO video_machine_links (video_id, machine_id, match_confidence, match_method, created_at, updated_at) VALUES
        ('v1', 1, 100, 'manual', 0, 0),
        ('v2', 1, 100, 'manual', 0, 0),
        ('v3', 3, 100, 'manual', 0, 0)`,
      `INSERT INTO video_snapshots (video_id, date, view_count, like_count, comment_count, collected_at) VALUES
        ('v1', '2026-07-01', 100, 0, 0, 0),
        ('v1', '2026-07-08', 150, 0, 0, 0),
        ('v2', '2026-07-01', 200, 0, 0, 0),
        ('v2', '2026-07-08', 220, 0, 0, 0),
        ('v3', '2026-07-01', 80, 0, 0, 0),
        ('v3', '2026-07-08', 80, 0, 0, 0)`,
    ]);
    const db = drizzle(client, { schema });
    const { createMachinesRoute } = await import("./machines");
    app = new Hono().route("/machines", createMachinesRoute(db));
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

  test("returns distinct channel coverage and keeps zero-video machines at zero", async () => {
    const response = await app.request("/machines");
    expect(response.status).toBe(200);
    const json: any = await response.json();
    const machineA = json.machines.find((machine: any) => machine.id === 1);
    const zero = json.machines.find((machine: any) => machine.id === 2);

    expect(machineA).toMatchObject({
      videoCount: 2,
      channelCount: 1,
      totalViews: 370,
      recentViews: 70,
    });
    expect(zero).toMatchObject({
      videoCount: 0,
      channelCount: 0,
      totalViews: 0,
      recentViews: 0,
    });
  });
});
