import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../database/schema";
import { Hono } from "hono";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let app: Hono;
let client: Client;
let tempDir: string;

describe("rankings API route", () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "pachilog-rankings-"));
    const databaseUrl = `file:${join(tempDir, "test.db")}`;
    client = createClient({ url: databaseUrl });
    await client.batch([
      `CREATE TABLE IF NOT EXISTS channels (
        id integer PRIMARY KEY AUTOINCREMENT,
        name text NOT NULL,
        youtube_channel_id text NOT NULL,
        handle text NOT NULL,
        category text NOT NULL,
        thumbnail_url text,
        active integer NOT NULL DEFAULT 1,
        created_at integer,
        updated_at integer
      )`,
      `CREATE TABLE IF NOT EXISTS channel_snapshots (
        id integer PRIMARY KEY AUTOINCREMENT,
        channel_id integer NOT NULL,
        subscriber_count integer,
        video_count integer,
        view_count integer,
        date text NOT NULL,
        collected_at integer NOT NULL,
        FOREIGN KEY(channel_id) REFERENCES channels(id) ON DELETE cascade
      )`
    ]);
    const db = drizzle(client, { schema });
    const { createRankingsRoute } = await import("./rankings");
    app = new Hono().route("/rankings", createRankingsRoute(db));
  });

  afterAll(async () => {
    client.close();
    let retries = 5;
    while (retries > 0) {
      try {
        await rm(tempDir, { recursive: true, force: true });
        break;
      } catch (err) {
        retries--;
        if (retries === 0) throw err;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
  });

  test("returns latestDate as null when there are no snapshots", async () => {
    const response = await app.request("/rankings?period=7");
    expect(response.status).toBe(200);
    const json: any = await response.json();
    expect(json.latestDate).toBeNull();
    expect(json.rising).toEqual([]);
    expect(json.falling).toEqual([]);
  });

  test("returns latestDate correctly even if all channels are insufficient (ranking list is empty)", async () => {
    await client.batch([
      `INSERT OR IGNORE INTO channels (id, name, youtube_channel_id, handle, category, active) 
       VALUES (1, 'Test Channel', 'UC123', '@test', 'media', 1)`,
      `INSERT OR IGNORE INTO channel_snapshots (id, channel_id, subscriber_count, date, collected_at) 
       VALUES (1, 1, 1000, '2026-07-27', 1716768000000)`
    ]);

    const response = await app.request("/rankings?period=7");
    expect(response.status).toBe(200);
    const json: any = await response.json();
    
    expect(json.rising).toEqual([]);
    expect(json.falling).toEqual([]);
    expect(json.insufficient).toHaveLength(1);
    expect(json.latestDate).toBe("2026-07-27");
  });
});
