/**
 * Admin CLI for machine matching management.
 * Run:
 *   bun packages/web/src/api/data/admin-cli.ts <command> [args]
 */
import { and, eq, inArray, notInArray, not } from "drizzle-orm";
import { db } from "../database/index.js";
import {
  machineMentions,
  machines,
  videoMachineLinks,
  videos as videosTable,
  ambiguousVideoLinks,
} from "../database/schema.js";
import { findDetailedMachineMatches, findAmbiguousDetailedMatches } from "../lib/machine-match.js";
import * as readline from "node:readline";

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command) {
    printHelp();
    process.exit(1);
  }

  try {
    switch (command) {
      case "list-unmatched":
        await listUnmatched();
        break;
      case "link":
        await linkVideo(args[1], args[2]);
        break;
      case "exclude":
        await excludeVideo(args[1], args[2]);
        break;
      case "rematch-all":
        await rematchAll(args.slice(1));
        break;
      default:
        console.error(`Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error("Error:", (err as Error).message);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
PachiPulse Admin CLI
Usage:
  bun packages/web/src/api/data/admin-cli.ts <command> [arguments]

Commands:
  list-unmatched                        List all videos currently marked as unmatched.
  link <videoId> <machineId>            Manually link a video to a machine.
  exclude <videoId> <machineId>         Manually exclude a video from matching a machine.
  rematch-all [--confirm] [--dry-run]   Clear auto-matches and rerun auto-matching on all videos.
`);
}

async function listUnmatched() {
  console.log("Fetching unmatched videos...");
  const unmatched = await db
    .select()
    .from(videosTable)
    .where(eq(videosTable.matchStatus, "unmatched"));

  if (unmatched.length === 0) {
    console.log("No unmatched videos found!");
    return;
  }

  console.log(`\nUnmatched Videos (${unmatched.length} items):`);
  console.log("----------------------------------------");
  for (const video of unmatched) {
    console.log(`ID: ${video.videoId} | Published: ${video.publishedAt}`);
    console.log(`Title: ${video.title}`);
    console.log("----------------------------------------");
  }
}

async function linkVideo(videoId: string | undefined, machineIdStr: string | undefined) {
  if (!videoId || !machineIdStr) {
    throw new Error("Usage: link <videoId> <machineId>");
  }
  const machineId = Number(machineIdStr);
  if (!Number.isFinite(machineId)) {
    throw new Error("Invalid machine ID");
  }

  // Check if video and machine exist
  const [video] = await db.select().from(videosTable).where(eq(videosTable.videoId, videoId));
  if (!video) throw new Error(`Video not found: ${videoId}`);

  const [machine] = await db.select().from(machines).where(eq(machines.id, machineId));
  if (!machine) throw new Error(`Machine not found: ${machineId}`);

  console.log(`Linking video "${video.title}" to machine "${machine.name}"...`);

  // Delete existing link (auto or manual) for this specific machine to avoid conflict
  await db
    .delete(videoMachineLinks)
    .where(
      and(
        eq(videoMachineLinks.videoId, videoId),
        eq(videoMachineLinks.machineId, machineId)
      )
    );

  // Insert manual link
  await db.insert(videoMachineLinks).values({
    videoId,
    machineId,
    matchConfidence: 100,
    matchMethod: "manual",
  });

  // Set video matchStatus to manual
  await db
    .update(videosTable)
    .set({ matchStatus: "manual", updatedAt: new Date() })
    .where(eq(videosTable.videoId, videoId));

  // Sync mentions cache
  await syncMentionsForVideo(videoId, video.channelId, video.title, video.publishedAt);

  console.log("Successfully linked video!");
}

async function excludeVideo(videoId: string | undefined, machineIdStr: string | undefined) {
  if (!videoId || !machineIdStr) {
    throw new Error("Usage: exclude <videoId> <machineId>");
  }
  const machineId = Number(machineIdStr);
  if (!Number.isFinite(machineId)) {
    throw new Error("Invalid machine ID");
  }

  // Check if video and machine exist
  const [video] = await db.select().from(videosTable).where(eq(videosTable.videoId, videoId));
  if (!video) throw new Error(`Video not found: ${videoId}`);

  const [machine] = await db.select().from(machines).where(eq(machines.id, machineId));
  if (!machine) throw new Error(`Machine not found: ${machineId}`);

  console.log(`Excluding video "${video.title}" from machine "${machine.name}"...`);

  // Delete existing link for this specific machine
  await db
    .delete(videoMachineLinks)
    .where(
      and(
        eq(videoMachineLinks.videoId, videoId),
        eq(videoMachineLinks.machineId, machineId)
      )
    );

  // Insert manual exclusion
  await db.insert(videoMachineLinks).values({
    videoId,
    machineId,
    matchConfidence: 0,
    matchMethod: "manual_excluded",
  });

  // Get active links (excluding manual_excluded) to determine video status
  const activeLinks = await db
    .select()
    .from(videoMachineLinks)
    .where(eq(videoMachineLinks.videoId, videoId));

  const hasMatchedMachines = activeLinks.some(l => l.matchMethod !== "manual_excluded");
  const finalStatus = hasMatchedMachines ? "manual" : "manual_excluded";

  await db
    .update(videosTable)
    .set({ matchStatus: finalStatus, updatedAt: new Date() })
    .where(eq(videosTable.videoId, videoId));

  // Sync mentions cache
  await syncMentionsForVideo(videoId, video.channelId, video.title, video.publishedAt);

  console.log("Successfully excluded video!");
}

async function syncMentionsForVideoTx(
  tx: any,
  videoId: string,
  channelId: number,
  videoTitle: string,
  publishedAt: string | null
) {
  // Delete all old mentions for this video
  await tx.delete(machineMentions).where(eq(machineMentions.videoId, videoId));

  // Find all active links
  const activeLinks = await tx
    .select()
    .from(videoMachineLinks)
    .where(
      and(
        eq(videoMachineLinks.videoId, videoId),
        not(eq(videoMachineLinks.matchMethod, "manual_excluded"))
      )
    );

  // Fetch video stats
  const video = await tx.select().from(videosTable).where(eq(videosTable.videoId, videoId));
  const viewCount = video[0]?.viewCount ?? 0;
  const likeCount = video[0]?.likeCount ?? 0;
  const commentCount = video[0]?.commentCount ?? 0;

  for (const link of activeLinks) {
    await tx.insert(machineMentions).values({
      machineId: link.machineId,
      channelId,
      videoId,
      videoTitle,
      viewCount,
      likeCount,
      commentCount,
      publishedAt,
    });
  }
}

function getSanitizedDbName(): string {
  const url = process.env.DATABASE_URL || "";
  try {
    if (url.startsWith("file:")) {
      return url.replace(/^file:/, "").split(/[/\\]/).pop() || "local.db";
    }
    const parsed = new URL(url);
    return parsed.hostname.split(".")[0];
  } catch {
    return "unknown-db";
  }
}

function validateDatabaseGuard(options: string[]) {
  const dbName = getSanitizedDbName();
  console.log(`[DB Guard] Target Database Name: ${dbName}`);

  const expectedIdx = options.indexOf("--expected-db-name");
  if (expectedIdx !== -1 && options[expectedIdx + 1]) {
    const expectedName = options[expectedIdx + 1];
    if (!dbName.includes(expectedName)) {
      throw new Error(
        `[SAFETY ABORT] Expected database name "${expectedName}" but connected to "${dbName}". Halting execution!`
      );
    }
  }

  if (options.includes("--rehearsal-only")) {
    if (!dbName.includes("rehearsal") && !dbName.includes("test")) {
      throw new Error(
        `[SAFETY ABORT] --rehearsal-only flag is set, but database "${dbName}" is not a rehearsal DB! Halting execution!`
      );
    }
  }
}

async function rematchAll(options: string[]) {
  validateDatabaseGuard(options);
  const isDryRun = options.includes("--dry-run");
  const isConfirmed = options.includes("--confirm");

  // Fetch all machines
  const machineList = await db.select().from(machines);

  // Fetch all videos NOT marked as manual/manual_excluded
  const videosToProcess = await db
    .select()
    .from(videosTable)
    .where(
      notInArray(videosTable.matchStatus, ["manual", "manual_excluded"])
    );

  if (videosToProcess.length === 0) {
    console.log("No videos found to rematch.");
    return;
  }

  // Count matches
  let proposedMatchesCount = 0;
  let proposedAmbMatchesCount = 0;
  const matchDecisions: { video: typeof videosTable.$inferSelect; matches: any[]; ambMatches: any[] }[] = [];

  for (const video of videosToProcess) {
    const matches = findDetailedMachineMatches(video.title, machineList);
    const ambMatches = findAmbiguousDetailedMatches(video.title, machineList);
    matchDecisions.push({ video, matches, ambMatches });
    proposedMatchesCount += matches.length;
    proposedAmbMatchesCount += ambMatches.length;
  }

  if (isDryRun) {
    console.log("\n[DRY RUN] Rematch all simulation details:");
    console.log(`- Videos that would be processed: ${videosToProcess.length}`);
    console.log(`- Auto-matched links that would be created: ${proposedMatchesCount}`);
    console.log(`- Ambiguous matches that would be recorded: ${proposedAmbMatchesCount}`);
    console.log("\nSample matches:");
    const samples = matchDecisions.filter(d => d.matches.length > 0 || d.ambMatches.length > 0).slice(0, 10);
    for (const sample of samples) {
      console.log(`  Video: "${sample.video.title}"`);
      if (sample.matches.length > 0) {
        console.log(`    Matches: ${sample.matches.map(m => `Machine #${m.machineId} (${m.matchMethod})`).join(", ")}`);
      }
      if (sample.ambMatches.length > 0) {
        console.log(`    Ambiguous: ${sample.ambMatches.map(m => `Machine #${m.machineId} (${m.matchedTerms.join("/")})`).join(", ")}`);
      }
    }
    console.log("\n[DRY RUN] No database changes were made.");
    return;
  }

  if (!isConfirmed) {
    const confirmed = await askConfirmation(
      `Are you sure you want to clear all auto-matches and rematch ${videosToProcess.length} videos? (y/N): `
    );
    if (!confirmed) {
      console.log("Operation cancelled.");
      return;
    }
  }

  console.log("Executing rematch-all in a transaction...");

  await db.transaction(async (tx) => {
    // 1. Delete all auto-matched links
    await tx
      .delete(videoMachineLinks)
      .where(
        inArray(videoMachineLinks.matchMethod, ["exact_name", "alias"])
      );

    // 2. Delete all pending ambiguous links
    await tx
      .delete(ambiguousVideoLinks)
      .where(
        eq(ambiguousVideoLinks.reviewStatus, "pending")
      );

    let insertCount = 0;
    let ambInsertCount = 0;

    for (const { video, matches, ambMatches } of matchDecisions) {
      // Keep manual links (exclusions)
      const existingLinks = await tx
        .select()
        .from(videoMachineLinks)
        .where(eq(videoMachineLinks.videoId, video.videoId));

      const manualLinks = existingLinks.filter(l => l.matchMethod === "manual" || l.matchMethod === "manual_excluded");
      const manualMachineIds = new Set(manualLinks.map(l => l.machineId));

      // Filter matches
      const newLinks = matches.filter(m => !manualMachineIds.has(m.machineId));

      for (const link of newLinks) {
        await tx.insert(videoMachineLinks).values({
          videoId: video.videoId,
          machineId: link.machineId,
          matchConfidence: link.matchConfidence,
          matchMethod: link.matchMethod,
        });
        insertCount++;
      }

      // Process ambiguous matches
      const existingAmbLinks = await tx
        .select()
        .from(ambiguousVideoLinks)
        .where(eq(ambiguousVideoLinks.videoId, video.videoId));

      const videoAmbMap = new Map(existingAmbLinks.map(l => [l.candidateMachineId, l]));

      for (const match of ambMatches) {
        const existingAmb = videoAmbMap.get(match.machineId);
        if (existingAmb) {
          // Keep existing approved/rejected/reviewed links (do nothing)
        } else {
          await tx.insert(ambiguousVideoLinks).values({
            videoId: video.videoId,
            candidateMachineId: match.machineId,
            matchedTerms: match.matchedTerms,
            confidence: match.confidence,
            reason: match.reason,
            reviewStatus: "pending",
          });
          ambInsertCount++;
        }
      }

      const finalLinks = await tx
        .select()
        .from(videoMachineLinks)
        .where(eq(videoMachineLinks.videoId, video.videoId));

      const hasActiveMatches = finalLinks.some(l => l.matchMethod !== "manual_excluded");
      const status = hasActiveMatches ? "matched" : "unmatched";

      await tx
        .update(videosTable)
        .set({ matchStatus: status, updatedAt: new Date() })
        .where(eq(videosTable.videoId, video.videoId));

      // Sync mentions
      await syncMentionsForVideoTx(tx, video.videoId, video.channelId, video.title, video.publishedAt);
    }

    console.log(`Rematch complete! Created ${insertCount} auto-matched links and ${ambInsertCount} pending ambiguous links.`);
  });
}

async function syncMentionsForVideo(
  videoId: string,
  channelId: number,
  title: string,
  publishedAt: string | null
) {
  // Clear existing mentions cache for this video
  await db.delete(machineMentions).where(eq(machineMentions.videoId, videoId));

  // Get active links
  const activeLinks = await db
    .select()
    .from(videoMachineLinks)
    .where(eq(videoMachineLinks.videoId, videoId));

  for (const link of activeLinks) {
    if (link.matchMethod === "manual_excluded") continue;

    await db.insert(machineMentions).values({
      machineId: link.machineId,
      channelId,
      videoId,
      videoTitle: title,
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      publishedAt,
    });
  }
}

function askConfirmation(query: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      const norm = answer.trim().toLowerCase();
      resolve(norm === "y" || norm === "yes");
    });
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
