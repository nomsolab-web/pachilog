/**
 * Run with: bun run packages/web/src/api/data/seed-machines-run.ts
 */
import { eq } from "drizzle-orm";
import { db } from "../database";
import { machines } from "../database/schema";
import { SEED_MACHINES } from "./seed-machines";
import { buildMachineSeedValues } from "./machine-seed-values";
import { findExistingMachineForSeed } from "../lib/machine-seed-matching";

async function main() {
  let inserted = 0;
  let updated = 0;
  const existingMachines = await db.select().from(machines);
  for (const m of SEED_MACHINES) {
    const existing = findExistingMachineForSeed(existingMachines, m);
    const values = buildMachineSeedValues(m);
    if (existing) {
      await db.update(machines).set(values).where(eq(machines.id, existing.id));
      updated += 1;
      continue;
    }
    await db.insert(machines).values(values);
    existingMachines.push({ ...values, id: -inserted - 1 } as typeof existingMachines[number]);
    inserted += 1;
  }
  console.log(`Seeded ${inserted} new machines and updated ${updated} existing machines (out of ${SEED_MACHINES.length} total in list).`);
}

main().then(() => process.exit(0));
