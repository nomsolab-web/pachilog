/**
 * Run with: bun run packages/web/src/api/data/seed-machines-run.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../database";
import { machines } from "../database/schema";
import { SEED_MACHINES } from "./seed-machines";

async function main() {
  let inserted = 0;
  for (const m of SEED_MACHINES) {
    const existing = await db.select().from(machines).where(eq(machines.name, m.name));
    if (existing.length > 0) continue;
    await db.insert(machines).values({ name: m.name, maker: m.maker, releaseDate: m.releaseDate });
    inserted += 1;
  }
  console.log(`Seeded ${inserted} new machines (out of ${SEED_MACHINES.length} total in list).`);
}

main().then(() => process.exit(0));
