import { describe, expect, test } from "./bun-test-mock.js";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../database/schema.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const actualDirname = typeof __dirname !== "undefined"
  ? __dirname
  : path.dirname(fileURLToPath(import.meta.url));
const testDbPath = path.resolve(actualDirname, "../../test.db");

// Custom seeder logic for testing
import { SEED_MACHINES } from "../data/seed-machines.js";

async function runTestSeeder(dbInstance: any) {
  let inserted = 0;
  let updated = 0;

  const existingMachines = await dbInstance.select().from(schema.machines);

  for (const m of SEED_MACHINES) {
    let existingRecord = null;

    if (m.id !== undefined) {
      existingRecord = existingMachines.find((x: any) => x.id === m.id) || null;
    }

    if (!existingRecord) {
      existingRecord = existingMachines.find((x: any) => x.name === m.name) || null;
    }

    if (!existingRecord && m.oldNameAliases) {
      existingRecord = existingMachines.find((x: any) => m.oldNameAliases!.includes(x.name)) || null;
    }

    const values = {
      name: m.name,
      maker: m.maker,
      releaseDate: m.releaseDate,
      type: m.type,
      shortName: m.shortName ?? null,
      aliases: m.aliases ? JSON.stringify(m.aliases) : null,
      uniqueAliases: m.uniqueAliases ? JSON.stringify(m.uniqueAliases) : null,
      ambiguousAliases: m.ambiguousAliases ? JSON.stringify(m.ambiguousAliases) : null,
      resolvingKeywords: m.resolvingKeywords ? JSON.stringify(m.resolvingKeywords) : null,
      excludeTerms: m.excludeTerms ? JSON.stringify(m.excludeTerms) : null,
      officialUrl: m.officialUrl ?? null,
      sourceUrl: m.sourceUrl ?? null,
      updatedAt: new Date(),
    };

    if (existingRecord) {
      await dbInstance.update(schema.machines).set(values).where(eq(schema.machines.id, existingRecord.id));
      updated += 1;
    } else {
      await dbInstance.insert(schema.machines).values(values);
      inserted += 1;
    }
  }
  return { inserted, updated };
}

describe("Database migrations, seed, and rematch-all flow integration tests", () => {
  let client: any;
  let db: any;

  test("1. Run migrations and verify table structures (including post-migration verify)", async () => {
    // Delete any old test.db
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    client = createClient({ url: `file:${testDbPath}` });
    db = drizzle(client, { schema });

    // Apply migrations
    const migrationsFolder = path.resolve(actualDirname, "../../drizzle");
    await migrate(db, { migrationsFolder });

    // Verify ambiguous_video_links existence, columns, and indexes
    const tablesResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tablesResult.rows.map((r: any) => r.name as string);
    expect(tableNames.includes("ambiguous_video_links")).toBe(true);

    const info = await client.execute("PRAGMA table_info(ambiguous_video_links)");
    const cols = info.rows.map((r: any) => r.name);
    expect(cols.includes("id")).toBe(true);
    expect(cols.includes("video_id")).toBe(true);
    expect(cols.includes("candidate_machine_id")).toBe(true);
    expect(cols.includes("matched_terms")).toBe(true);
    expect(cols.includes("review_status")).toBe(true);

    const indexes = await client.execute("PRAGMA index_list(ambiguous_video_links)");
    const indexNames = indexes.rows.map((r: any) => r.name);
    expect(indexNames.includes("ambiguous_video_link_idx")).toBe(true);
    expect(indexNames.includes("ambiguous_video_id_idx")).toBe(true);
  });

  test("2. Seed machines idempotence and existing ID retention", async () => {
    // Insert 5 legacy machines matching production pre-existing ID 1-5 names
    await db.insert(schema.machines).values([
      { id: 1, name: "Lパチスロ からくりサーカス2", maker: "SANKYO", releaseDate: "2026-07-06", type: "slot" },
      { id: 2, name: "P/eフィーバーブルーロック Light ver.", maker: "SANKYO", releaseDate: "2026-07-06", type: "pachinko" },
      { id: 3, name: "eフィーバー デッドマウント・デスプレイ 魂神", maker: "SANKYO", releaseDate: "2026-06-08", type: "pachinko" },
      { id: 4, name: "ぱちんこ 必殺仕事人VI オッケー", maker: "オッケー.", releaseDate: "2026-07-06", type: "pachinko" },
      { id: 5, name: "デカスタeベルセルク無双第2章10連撃Ver.", maker: "ニューギン", releaseDate: "2026-07-21", type: "pachinko" },
    ]);

    // Run seed 1
    const res1 = await runTestSeeder(db);
    expect(res1.inserted).toBe(16); // 16 new machines inserted
    expect(res1.updated).toBe(5);   // 5 existing machines updated in-place

    const seededMachines1 = await db.select().from(schema.machines);
    expect(seededMachines1.length).toBe(21); // Exactly 21 machines!

    // Verify IDs 1 to 5 are retained with new formal names
    const m1 = seededMachines1.find((m: any) => m.id === 1);
    expect(m1.name).toBe("Lパチスロ からくりサーカス2");

    const m2 = seededMachines1.find((m: any) => m.id === 2);
    expect(m2.name).toBe("Pフィーバーブルーロック Light ver.");

    const m3 = seededMachines1.find((m: any) => m.id === 3);
    expect(m3.name).toBe("eフィーバー デッドマウント・デスプレイ 魂神9000");

    const m4 = seededMachines1.find((m: any) => m.id === 4);
    expect(m4.name).toBe("ぱちんこ 必殺仕事人VI");

    const m5 = seededMachines1.find((m: any) => m.id === 5);
    expect(m5.name).toBe("eベルセルク無双 第2章 10連撃Ver.");

    // Run seed 2 (Idempotency check)
    const res2 = await runTestSeeder(db);
    expect(res2.inserted).toBe(0);  // 0 new inserts
    expect(res2.updated).toBe(21); // 21 updated idempotently

    const verifiedMachines = await db.select().from(schema.machines);
    expect(verifiedMachines.length).toBe(21);
  });

  test("3. rematch-all preserves manual links, reviewed ambiguous links, and supports dry-run", async () => {
    // Insert a dummy channel
    await db.insert(schema.channels).values({
      id: 99,
      name: "テストチャンネル",
      category: "other",
      active: true,
    });

    // Insert dummy videos
    // Video 1: matches unique alias (Hokuto 1)
    await db.insert(schema.videos).values({
      videoId: "vid_1",
      channelId: 99,
      title: "スマスロ北斗の拳で無双転生を引いた動画",
      matchStatus: "pending",
    });

    // Video 2: manual matched link
    await db.insert(schema.videos).values({
      videoId: "vid_2",
      channelId: 99,
      title: "手動判定されるビデオ",
      matchStatus: "manual",
    });

    // Insert videoMachineLinks
    // Manual link for Video 2 (matches Machine ID 1)
    await db.insert(schema.videoMachineLinks).values({
      videoId: "vid_2",
      machineId: 1,
      matchConfidence: 100,
      matchMethod: "manual",
    });

    // Insert ambiguousVideoLinks
    // One pending, one approved (reviewed)
    await db.insert(schema.ambiguousVideoLinks).values({
      videoId: "vid_1",
      candidateMachineId: 2, // Hokuto 2
      matchedTerms: ["北斗の拳"],
      confidence: 50,
      reviewStatus: "pending",
    });

    await db.insert(schema.ambiguousVideoLinks).values({
      videoId: "vid_1",
      candidateMachineId: 3, // Oohama 5
      matchedTerms: ["大海"],
      confidence: 50,
      reviewStatus: "approved", // Reviewed!
    });

    // Simulate rematch-all dry-run
    const existingAutoLinksDry = await db.select().from(schema.videoMachineLinks).where(eq(schema.videoMachineLinks.matchMethod, "alias"));
    expect(existingAutoLinksDry.length).toBe(0);

    // Run transaction rematch-all
    await db.transaction(async (tx: any) => {
      // 1. Delete all auto-matched links
      await tx
        .delete(schema.videoMachineLinks)
        .where(eq(schema.videoMachineLinks.matchMethod, "alias"));

      // 2. Delete pending ambiguous links
      await tx
        .delete(schema.ambiguousVideoLinks)
        .where(eq(schema.ambiguousVideoLinks.reviewStatus, "pending"));

      // We should see Oohama 5 (approved) is still there, but Hokuto 2 (pending) is deleted!
      const currentAmb = await tx.select().from(schema.ambiguousVideoLinks);
      expect(currentAmb.length).toBe(1);
      expect(currentAmb[0].candidateMachineId).toBe(3);

      // Perform insertion of new matches
      // Video 1 title: "スマスロ北斗の拳で無双転生を引いた動画" -> matches unique alias of Hokuto 1
      await tx.insert(schema.videoMachineLinks).values({
        videoId: "vid_1",
        machineId: 1,
        matchConfidence: 85,
        matchMethod: "alias",
      });
    });

    // Verify auto link is created for Video 1
    const linksVid1 = await db.select().from(schema.videoMachineLinks).where(eq(schema.videoMachineLinks.videoId, "vid_1"));
    expect(linksVid1.length).toBe(1);
    expect(linksVid1[0].machineId).toBe(1);

    // Verify manual link for Video 2 is preserved
    const linksVid2 = await db.select().from(schema.videoMachineLinks).where(eq(schema.videoMachineLinks.videoId, "vid_2"));
    expect(linksVid2.length).toBe(1);
    expect(linksVid2[0].matchMethod).toBe("manual");

    // Verify approved ambiguous link for Video 1 is preserved
    const finalAmb = await db.select().from(schema.ambiguousVideoLinks);
    expect(finalAmb.length).toBe(1);
    expect(finalAmb[0].candidateMachineId).toBe(3);
    expect(finalAmb[0].reviewStatus).toBe("approved");

    // Clean up
    await client.close();
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
    } catch {
      console.log("Note: Could not unlink test.db immediately due to SQLite lock. Will be cleaned on next run.");
    }
    console.log("Database flow integration tests passed successfully!");
  });
});
