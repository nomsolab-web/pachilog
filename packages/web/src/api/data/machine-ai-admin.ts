/**
 * Manage pending AI video judgments.
 * Run:
 *   bun packages/web/src/api/data/machine-ai-admin.ts list
 *   bun packages/web/src/api/data/machine-ai-admin.ts approve <judgmentId>
 *   bun packages/web/src/api/data/machine-ai-admin.ts reject <judgmentId>
 */
import { and, eq } from "drizzle-orm";
import { db } from "../database";
import { machineMentions, machineVideoJudgments, videoMachineLinks, videos as videosTable } from "../database/schema";
import { fetchVideoStats } from "../lib/youtube";

async function main() {
  const command = process.argv[2] ?? "list";
  if (command === "list") return listPending();
  const id = Number(process.argv[3]);
  if (!Number.isFinite(id)) throw new Error("judgmentId is required");
  if (command === "approve") return approve(id);
  if (command === "reject") return reject(id);
  throw new Error(`Unknown command: ${command}`);
}

async function listPending() {
  const pending = await db.select().from(machineVideoJudgments).where(eq(machineVideoJudgments.status, "pending"));
  console.log(JSON.stringify({ count: pending.length, pending }, null, 2));
}

async function approve(id: number) {
  const [judgment] = await db.select().from(machineVideoJudgments).where(eq(machineVideoJudgments.id, id));
  if (!judgment) throw new Error(`Judgment not found: ${id}`);
  if (!judgment.machineId || !judgment.channelId) throw new Error("Judgment is missing machineId or channelId");

  const stat = process.env.YOUTUBE_API_KEY ? (await fetchVideoStats([judgment.videoId]))[0] : null;
  const existing = await db
    .select()
    .from(machineMentions)
    .where(eq(machineMentions.videoId, judgment.videoId));
  const current = existing.find((mention) => mention.machineId === judgment.machineId);

  if (current) {
    await db
      .update(machineMentions)
      .set({
        viewCount: stat?.viewCount ?? current.viewCount,
        likeCount: stat?.likeCount ?? current.likeCount,
        commentCount: stat?.commentCount ?? current.commentCount,
        updatedAt: new Date(),
      })
      .where(eq(machineMentions.id, current.id));
  } else {
    await db.insert(machineMentions).values({
      machineId: judgment.machineId,
      channelId: judgment.channelId,
      videoId: judgment.videoId,
      videoTitle: judgment.videoTitle,
      viewCount: stat?.viewCount ?? 0,
      likeCount: stat?.likeCount ?? 0,
      commentCount: stat?.commentCount ?? 0,
      publishedAt: judgment.publishedAt,
    });
  }

  // Also update videoMachineLinks
  const linkExisting = await db
    .select()
    .from(videoMachineLinks)
    .where(and(eq(videoMachineLinks.videoId, judgment.videoId), eq(videoMachineLinks.machineId, judgment.machineId)));
  if (linkExisting.length === 0) {
    await db.insert(videoMachineLinks).values({
      videoId: judgment.videoId,
      machineId: judgment.machineId,
      matchConfidence: judgment.confidence,
      matchMethod: "alias",
    });
  }

  await db.update(videosTable).set({ matchStatus: "matched", updatedAt: new Date() }).where(eq(videosTable.videoId, judgment.videoId));

  await db.update(machineVideoJudgments).set({ status: "auto_linked", updatedAt: new Date() }).where(eq(machineVideoJudgments.id, id));
  console.log(`Approved judgment ${id}.`);
}

async function reject(id: number) {
  await db.update(machineVideoJudgments).set({ status: "rejected", updatedAt: new Date() }).where(eq(machineVideoJudgments.id, id));
  console.log(`Rejected judgment ${id}.`);
}

main().then(() => process.exit(0));
