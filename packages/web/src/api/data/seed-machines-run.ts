/**
 * Run with: bun run packages/web/src/api/data/seed-machines-run.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../database";
import { machines } from "../database/schema";
import { SEED_MACHINES } from "./seed-machines";

async function main() {
  let inserted = 0;
  let updated = 0;
  for (const m of SEED_MACHINES) {
    const existing = await db.select().from(machines).where(eq(machines.name, m.name));
    const values = {
      name: m.name,
      maker: m.maker,
      releaseDate: m.releaseDate,
      type: m.type,
      shortName: m.shortName,
      aliases: m.aliases,
    };
    if (existing.length > 0) {
      await db.update(machines).set(values).where(eq(machines.id, existing[0].id));
      updated += 1;
      continue;
    }
    await db.insert(machines).values(values);
    inserted += 1;
  }
  console.log(`Seeded ${inserted} new machines and updated ${updated} existing machines (out of ${SEED_MACHINES.length} total in list).`);
}

main().then(() => process.exit(0));
