/**
 * Admin CLI for machine matching management.
 * Run:
 *   bun packages/web/src/api/data/admin-cli.ts <command> [args]
 */
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "../database";
import {
  machineMentions,
  machines,
  videoMachineLinks,
  videos as videosTable,
} from "../database/schema";
import { findDetailedMachineMatches } from "../lib/machine-match";
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

async function rematchAll(options: string[]) {
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
  const matchDecisions: { video: typeof videosTable.$inferSelect; matches: any[] }[] = [];

  for (const video of videosToProcess) {
    const matches = findDetailedMachineMatches(video.title, machineList);
    matchDecisions.push({ video, matches });
    proposedMatchesCount += matches.length;
  }

  if (isDryRun) {
    console.log("\n[DRY RUN] Rematch all simulation details:");
    console.log(`- Videos that would be processed: ${videosToProcess.length}`);
    console.log(`- Auto-matched links that would be created: ${proposedMatchesCount}`);
    console.log("\nSample matches:");
    const samples = matchDecisions.filter(d => d.matches.length > 0).slice(0, 5);
    for (const sample of samples) {
      console.log(`  Video: "${sample.video.title}"`);
      console.log(`  Matches: ${sample.matches.map(m => `Machine #${m.machineId} (${m.matchMethod})`).join(", ")}`);
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

  console.log("Executing rematch-all...");

  // 1. Delete all auto-matched links
  await db
    .delete(videoMachineLinks)
    .where(
      inArray(videoMachineLinks.matchMethod, ["exact_name", "alias"])
    );

  // 2. Perform insertions and update statuses
  let insertCount = 0;
  for (const { video, matches } of matchDecisions) {
    // Keep manual links (exclusions)
    const existingLinks = await db
      .select()
      .from(videoMachineLinks)
      .where(eq(videoMachineLinks.videoId, video.videoId));

    const manualLinks = existingLinks.filter(l => l.matchMethod === "manual" || l.matchMethod === "manual_excluded");
    const manualMachineIds = new Set(manualLinks.map(l => l.machineId));

    // Filter matches
    const newLinks = matches.filter(m => !manualMachineIds.has(m.machineId));

    for (const link of newLinks) {
      await db.insert(videoMachineLinks).values({
        videoId: video.videoId,
        machineId: link.machineId,
        matchConfidence: link.matchConfidence,
        matchMethod: link.matchMethod,
      });
      insertCount++;
    }

    const finalLinks = await db
      .select()
      .from(videoMachineLinks)
      .where(eq(videoMachineLinks.videoId, video.videoId));

    const hasActiveMatches = finalLinks.some(l => l.matchMethod !== "manual_excluded");
    const status = hasActiveMatches ? "matched" : "unmatched";

    await db
      .update(videosTable)
      .set({ matchStatus: status, updatedAt: new Date() })
      .where(eq(videosTable.videoId, video.videoId));

    // Sync mentions
    await syncMentionsForVideo(video.videoId, video.channelId, video.title, video.publishedAt);
  }

  console.log(`Rematch complete! Created ${insertCount} auto-matched links.`);
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
