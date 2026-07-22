import { sql } from "drizzle-orm";
import { db } from "../database";

async function main() {
  const duplicates = await db.all<{
    machineId: number;
    voterFingerprint: string;
    duplicateCount: number;
    keepVoteId: number;
    duplicateVoteIds: string;
  }>(sql`
    SELECT
      machine_id AS machineId,
      voter_fingerprint AS voterFingerprint,
      COUNT(*) AS duplicateCount,
      MAX(id) AS keepVoteId,
      GROUP_CONCAT(id) AS duplicateVoteIds
    FROM machine_votes
    GROUP BY machine_id, voter_fingerprint
    HAVING COUNT(*) > 1
    ORDER BY duplicateCount DESC, machine_id ASC
  `);

  if (duplicates.length === 0) {
    console.log("No duplicate machine_votes rows found. It is safe to apply the unique index migration.");
    return;
  }

  console.log(JSON.stringify({ duplicateGroups: duplicates.length, duplicates }, null, 2));
  process.exitCode = 1;
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
