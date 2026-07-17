/**
 * Apply approved alias suggestions.
 * Run: bun packages/web/src/api/data/apply-machine-aliases.ts [machine-aliases-pending.json]
 */
import { eq } from "drizzle-orm";
import { db } from "../database";
import { machines } from "../database/schema";

type AliasFile = {
  suggestions: Array<{
    machineId: number;
    shortName: string | null;
    aliases: string[];
    excludeTerms: string[];
    approved?: boolean;
  }>;
};

async function main() {
  const path = process.argv[2] ?? "machine-aliases-pending.json";
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`Alias file not found: ${path}`);

  const data = (await file.json()) as AliasFile;
  let applied = 0;
  let skipped = 0;

  for (const suggestion of data.suggestions ?? []) {
    if (!suggestion.approved) {
      skipped += 1;
      continue;
    }
    await db
      .update(machines)
      .set({
        shortName: suggestion.shortName,
        aliases: suggestion.aliases,
        excludeTerms: suggestion.excludeTerms,
      })
      .where(eq(machines.id, suggestion.machineId));
    applied += 1;
  }

  console.log(`Applied ${applied} approved alias suggestions. Skipped ${skipped}.`);
}

main().then(() => process.exit(0));
