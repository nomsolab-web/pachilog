import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

/**
 * You can write your custom database schema here.
 * Use this file for also re-exporting any generated schema for drizzle to generate proper migrations.
 */

export const channels = sqliteTable("channels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  youtubeChannelId: text("youtube_channel_id").unique(),
  handle: text("handle"),
  name: text("name").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  category: text("category").notNull().default("pachislo"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const channelSnapshots = sqliteTable(
  "channel_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    subscriberCount: integer("subscriber_count").notNull(),
    viewCount: integer("view_count").notNull(),
    videoCount: integer("video_count").notNull(),
    collectedAt: integer("collected_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("channel_date_idx").on(table.channelId, table.date)],
);

export const votes = sqliteTable("votes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: integer("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  voteType: text("vote_type", { enum: ["good", "bad", "unknown"] }).notNull(),
  voterFingerprint: text("voter_fingerprint").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const machines = sqliteTable("machines", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  maker: text("maker"),
  releaseDate: text("release_date"),
  thumbnailUrl: text("thumbnail_url"),
  sourceUrl: text("source_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const machineMentions = sqliteTable(
  "machine_mentions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    machineId: integer("machine_id")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
    channelId: integer("channel_id")
      .notNull()
      .references(() => channels.id, { onDelete: "cascade" }),
    videoId: text("video_id").notNull(),
    videoTitle: text("video_title").notNull(),
    viewCount: integer("view_count").notNull().default(0),
    likeCount: integer("like_count").notNull().default(0),
    commentCount: integer("comment_count").notNull().default(0),
    publishedAt: text("published_at"),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [uniqueIndex("machine_video_idx").on(table.machineId, table.videoId)],
);

export const machineVotes = sqliteTable("machine_votes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  machineId: integer("machine_id")
    .notNull()
    .references(() => machines.id, { onDelete: "cascade" }),
  voteType: text("vote_type", { enum: ["want_to_play", "wait_and_see", "not_interested"] }).notNull(),
  voterFingerprint: text("voter_fingerprint").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

// --- Weekly summary articles (SEO long-tail content, auto-generated from collected data) ---
export const weeklySummaries = sqliteTable("weekly_summaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  weekOf: text("week_of").notNull().unique(), // YYYY-MM-DD (Monday of that week)
  title: text("title").notNull(),
  bodyMarkdown: text("body_markdown").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
