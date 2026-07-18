import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Error: DATABASE_URL environment variable is required.");
  process.exit(1);
}

const databaseAuthToken = process.env.DATABASE_AUTH_TOKEN;

console.log("Running migrations on database:", databaseUrl);

const client = createClient({
  url: databaseUrl,
  authToken: databaseAuthToken,
});

const db = drizzle(client);

async function verifyBaselineStructure(client: any, tableNames: string[]): Promise<boolean> {
  const expectedTables = [
    "channel_snapshots",
    "channels",
    "machine_mentions",
    "machine_video_judgments",
    "machine_votes",
    "machines",
    "video_snapshots",
    "videos",
    "votes",
    "weekly_summaries",
  ];

  // 1. Check if it's a completely empty database (ignoring sqlite internal tables)
  const userTables = tableNames.filter((name) => name !== "sqlite_sequence");
  if (userTables.length === 0) {
    console.log("Database is completely empty. Will run all migrations normally.");
    return false; // Not baselining, normal migration will run
  }

  // 2. Check if all expected tables exist
  const missingTables = expectedTables.filter((table) => !tableNames.includes(table));
  if (missingTables.length > 0) {
    throw new Error(
      `Mismatched database structure for baselining migration 0000. Missing tables: ${missingTables.join(
        ", "
      )}.`
    );
  }

  // 3. Verify columns for critical tables to be 100% sure
  const channelsInfo = await client.execute("PRAGMA table_info(channels)");
  const channelsCols = channelsInfo.rows.map((r: any) => r.name);
  if (!channelsCols.includes("youtube_channel_id") || !channelsCols.includes("handle")) {
    throw new Error("Mismatched columns in 'channels' table for baselining migration 0000.");
  }

  const videosInfo = await client.execute("PRAGMA table_info(videos)");
  const videosCols = videosInfo.rows.map((r: any) => r.name);
  if (!videosCols.includes("video_id") || !videosCols.includes("title")) {
    throw new Error("Mismatched columns in 'videos' table for baselining migration 0000.");
  }

  const machinesInfo = await client.execute("PRAGMA table_info(machines)");
  const machinesCols = machinesInfo.rows.map((r: any) => r.name);
  if (!machinesCols.includes("name") || !machinesCols.includes("maker")) {
    throw new Error("Mismatched columns in 'machines' table for baselining migration 0000.");
  }

  console.log("Database structure matches 0000 migration schema. Safe to baseline.");
  return true;
}

async function run() {
  // 1. Check if the database has tables but no __drizzle_migrations table
  const tablesResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = tablesResult.rows.map(r => r.name as string);

  const hasMigrationsTable = tableNames.includes("__drizzle_migrations");

  if (!hasMigrationsTable) {
    const shouldBaseline = await verifyBaselineStructure(client, tableNames);

    if (shouldBaseline) {
      console.log("Existing database detected without migration metadata. Baselining migration 0000...");

      // Create __drizzle_migrations table manually
      await client.execute(`
        CREATE TABLE \`__drizzle_migrations\` (
          \`id\` integer PRIMARY KEY AUTOINCREMENT,
          \`hash\` text NOT NULL,
          \`created_at\` integer
        );
      `);

      // Find the 0000 migration file and compute its hash
      const migrationsDir = path.join(__dirname, "../../../drizzle");
      const journalPath = path.join(migrationsDir, "meta/_journal.json");
      const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));
      const baseEntry = journal.entries.find((e: any) => e.idx === 0);

      if (baseEntry) {
        const sqlFileName = `${baseEntry.tag}.sql`;
        const sqlPath = path.join(migrationsDir, sqlFileName);
        const sqlContent = fs.readFileSync(sqlPath, "utf-8");
        
        // Drizzle ORM calculates hash on the exact content of the file
        const hash = crypto.createHash("sha256").update(sqlContent).digest("hex");

        await client.execute({
          sql: "INSERT INTO `__drizzle_migrations` (hash, created_at) VALUES (?, ?)",
          args: [hash, baseEntry.when]
        });
        console.log(`Baselined ${baseEntry.tag} successfully with hash ${hash}.`);
      } else {
        throw new Error("Initial migration entry not found in journal.");
      }
    }
  }

  // 2. Run Drizzle migrations
  await migrate(db, { migrationsFolder: path.join(__dirname, "../../../drizzle") });
  console.log("Migrations applied successfully!");
}

run()
  .then(() => {
    client.close();
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err);
    client.close();
    process.exit(1);
  });
