import { Hono } from "hono";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "../database";
import { channels, channelSnapshots, machineMentions, machines, weeklySummaries } from "../database/schema";

function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift back to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export const weekly = new Hono()
  .get("/", async (c) => {
    const list = await db
      .select({ id: weeklySummaries.id, weekOf: weeklySummaries.weekOf, title: weeklySummaries.title })
      .from(weeklySummaries)
      .orderBy(desc(weeklySummaries.weekOf));
    return c.json({ summaries: list }, 200);
  })
  .get("/:weekOf", async (c) => {
    const weekOf = c.req.param("weekOf");
    const [row] = await db.select().from(weeklySummaries).where(eq(weeklySummaries.weekOf, weekOf));
    if (!row) return c.json({ error: "not found" }, 404);
    return c.json({ summary: row }, 200);
  })
  .post("/generate", async (c) => {
    const secret = c.req.header("x-collect-secret");
    if (!secret || secret !== process.env.COLLECT_SECRET_TOKEN) {
      return c.json({ error: "unauthorized" }, 401);
    }

    const weekOf = mondayOf(new Date());

    // --- rising/falling channels over the last 7 days ---
    const activeChannels = await db.select().from(channels).where(eq(channels.active, true));
    const entries = await Promise.all(
      activeChannels.map(async (ch) => {
        const snapshots = await db
          .select()
          .from(channelSnapshots)
          .where(eq(channelSnapshots.channelId, ch.id))
          .orderBy(asc(channelSnapshots.date));
        if (snapshots.length === 0) return null;
        const latest = snapshots[snapshots.length - 1];
        const base = snapshots[0];
        const delta = latest.subscriberCount - base.subscriberCount;
        return { name: ch.name, latest: latest.subscriberCount, delta };
      }),
    );
    const valid = entries.filter((e): e is NonNullable<typeof e> => e !== null);
    const rising = [...valid].sort((a, b) => b.delta - a.delta).slice(0, 5);
    const falling = [...valid].sort((a, b) => a.delta - b.delta).slice(0, 5);

    // --- machine buzz ranking ---
    const machineList = await db.select().from(machines);
    const machineBuzz = await Promise.all(
      machineList.map(async (m) => {
        const mentions = await db.select().from(machineMentions).where(eq(machineMentions.machineId, m.id));
        const totalViews = mentions.reduce((sum, x) => sum + x.viewCount, 0);
        return { name: m.name, maker: m.maker, totalViews, videoCount: mentions.length };
      }),
    );
    machineBuzz.sort((a, b) => b.totalViews - a.totalViews);
    const topMachines = machineBuzz.slice(0, 5);

    const title = `${weekOf}週 パチスロ系YouTuber推移＆新台バズまとめ`;

    const lines: string[] = [];
    lines.push(`# ${title}`, "");
    lines.push(
      "この記事はチャンネル登録者数・再生数の推移データから自動生成しています。攻略・期待値・立ち回りの情報は含みません。",
      "",
    );

    lines.push("## 登録者数 急上昇チャンネル TOP5", "");
    if (rising.length === 0) {
      lines.push("まだ推移データが十分に溜まっていません。");
    } else {
      rising.forEach((r, i) => {
        lines.push(`${i + 1}. **${r.name}** — 現在${r.latest.toLocaleString()}人 (${r.delta >= 0 ? "+" : ""}${r.delta.toLocaleString()})`);
      });
    }
    lines.push("");

    lines.push("## 登録者数 急降下チャンネル TOP5", "");
    if (falling.length === 0) {
      lines.push("まだ推移データが十分に溜まっていません。");
    } else {
      falling.forEach((r, i) => {
        lines.push(`${i + 1}. **${r.name}** — 現在${r.latest.toLocaleString()}人 (${r.delta.toLocaleString()})`);
      });
    }
    lines.push("");

    lines.push("## 新台バズランキング TOP5", "");
    if (topMachines.length === 0 || topMachines.every((m) => m.totalViews === 0)) {
      lines.push("まだバズデータが十分に溜まっていません。");
    } else {
      topMachines.forEach((m, i) => {
        lines.push(`${i + 1}. **${m.name}**(${m.maker ?? "メーカー不明"}) — 合計再生数${m.totalViews.toLocaleString()}・関連動画${m.videoCount}本`);
      });
    }

    const bodyMarkdown = lines.join("\n");

    const existing = await db.select().from(weeklySummaries).where(eq(weeklySummaries.weekOf, weekOf));
    if (existing.length > 0) {
      await db.update(weeklySummaries).set({ title, bodyMarkdown }).where(eq(weeklySummaries.weekOf, weekOf));
    } else {
      await db.insert(weeklySummaries).values({ weekOf, title, bodyMarkdown });
    }

    return c.json({ weekOf, title }, 200);
  });
