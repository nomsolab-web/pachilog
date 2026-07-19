/**
 * Run with: bun run packages/web/src/api/data/seed-machines-run.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../database/index.js";
import { machines } from "../database/schema.js";
import { SEED_MACHINES } from "./seed-machines.js";

async function main() {
  let inserted = 0;
  let updated = 0;

  for (const m of SEED_MACHINES) {
    // Determine possible old names for mapping/idempotency
    const alternativeNames: string[] = [m.name];
    if (m.name === "eベルセルク無双 第2章 10連撃Ver.") {
      alternativeNames.push("デカスタeベルセルク無双第2章10連撃Ver.");
    }
    if (m.name === "ぱちんこ 必殺仕事人VI") {
      alternativeNames.push("ぱちんこ 必殺仕事人VI オッケー");
    }
    if (m.name === "eフィーバー デッドマウント・デスプレイ 魂神9000") {
      alternativeNames.push("eフィーバー デッドマウント・デスプレイ 魂神");
    }
    if (m.name === "L戦国乙女5 業火を穿つ宿焔の双刃") {
      alternativeNames.push("L戦国乙女5 業火を穿つ宿焔 of 敢戦の双刃");
    }

    // Find any existing record matching current name or old alternative names
    let existingRecord = null;
    for (const altName of alternativeNames) {
      const records = await db.select().from(machines).where(eq(machines.name, altName));
      if (records.length > 0) {
        existingRecord = records[0];
        break;
      }
    }

    const values = {
      name: m.name,
      maker: m.maker,
      releaseDate: m.releaseDate,
      type: m.type,
      shortName: m.shortName ?? null,
      aliases: m.aliases ?? null,
      uniqueAliases: m.uniqueAliases ?? null,
      ambiguousAliases: m.ambiguousAliases ?? null,
      resolvingKeywords: m.resolvingKeywords ?? null,
      excludeTerms: m.excludeTerms ?? null,
      officialUrl: m.officialUrl ?? null,
      sourceUrl: m.sourceUrl ?? null,
      updatedAt: new Date(),
    };

    if (existingRecord) {
      await db.update(machines).set(values).where(eq(machines.id, existingRecord.id));
      console.log(`Updated existing machine: "${existingRecord.name}" -> "${m.name}" (ID: ${existingRecord.id}, Maker: ${m.maker})`);
      updated += 1;
    } else {
      await db.insert(machines).values(values);
      console.log(`Inserted new machine: "${m.name}" (Maker: ${m.maker})`);
      inserted += 1;
    }
  }

  console.log(`Idempotent Seeding Completed:`);
  console.log(`- Inserted new machines: ${inserted}`);
  console.log(`- Updated existing machines: ${updated}`);
  console.log(`- Total machines in list: ${SEED_MACHINES.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  });
