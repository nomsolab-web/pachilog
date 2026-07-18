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

async function run() {
  // 1. Check if the database has tables but no __drizzle_migrations table
  const tablesResult = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
  const tableNames = tablesResult.rows.map(r => r.name as string);

  const hasMigrationsTable = tableNames.includes("__drizzle_migrations");
  const hasExistingTables = tableNames.includes("channels") || tableNames.includes("videos");

  if (!hasMigrationsTable && hasExistingTables) {
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
