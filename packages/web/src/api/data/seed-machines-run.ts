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

  const existingMachines = await db.select().from(machines);

  for (const m of SEED_MACHINES) {
    // Determine target existing record to update
    let existingRecord = null;

    if (m.id !== undefined) {
      existingRecord = existingMachines.find(x => x.id === m.id) || null;
    }

    if (!existingRecord) {
      existingRecord = existingMachines.find(x => x.name === m.name) || null;
    }

    if (!existingRecord && m.oldNameAliases) {
      existingRecord = existingMachines.find(x => m.oldNameAliases!.includes(x.name)) || null;
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
      await db.update(machines).set(values).where(eq(machines.id, existingRecord.id));
      console.log(`Updated existing machine ID ${existingRecord.id}: "${existingRecord.name}" -> "${m.name}"`);
      updated += 1;
    } else {
      await db.insert(machines).values(values);
      console.log(`Inserted new machine: "${m.name}"`);
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
