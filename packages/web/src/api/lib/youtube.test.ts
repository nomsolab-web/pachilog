import { afterEach, describe, expect, test } from "bun:test";
import { SEED_CHANNELS } from "../data/seed-channels";
import { findDuplicateValues, isValidChannelCategory, shouldInsertSnapshot } from "./collection";
import {
  chunkArray,
  fetchChannelsByIdsSafe,
  isSuccessfulCollectionRate,
  parseYoutubeDuration,
  selectChannelThumbnailUrl,
  withYoutubeRetry,
  YoutubeApiError,
} from "./youtube";

const originalFetch = globalThis.fetch;
const originalApiKey = process.env.YOUTUBE_API_KEY;

afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env.YOUTUBE_API_KEY = originalApiKey;
});

describe("YouTube collection helpers", () => {
  test("splits 100 channels into 50 item batches", () => {
    const chunks = chunkArray(Array.from({ length: 100 }, (_, i) => `id-${i}`), 50);
    expect(chunks.map((chunk) => chunk.length)).toEqual([50, 50]);
  });

  test("detects duplicate channel IDs", () => {
    expect(findDuplicateValues(["a", "b", "a", "c", "b"])).toEqual(["a", "b"]);
    expect(findDuplicateValues(SEED_CHANNELS.map((channel) => channel.youtubeChannelId))).toEqual([]);
  });

  test("continues when one channel batch fails", async () => {
    process.env.YOUTUBE_API_KEY = "test-key";
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("id-50")) return new Response("server error", { status: 500 });
      return Response.json({
        items: Array.from({ length: 50 }, (_, i) => ({
          id: `channel-${i}`,
          snippet: { title: `Channel ${i}`, thumbnails: {} },
          statistics: { subscriberCount: "1", viewCount: "2", videoCount: "3" },
        })),
      });
    };

    const result = await fetchChannelsByIdsSafe(Array.from({ length: 100 }, (_, i) => `id-${i}`));
    expect(result.items).toHaveLength(50);
    expect(result.errors).toHaveLength(1);
  });

  test("retries retryable YouTube API errors", async () => {
    let attempts = 0;
    const result = await withYoutubeRetry(async () => {
      attempts += 1;
      if (attempts < 3) throw new YoutubeApiError("rate limited", 429);
      return "ok";
    });

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  test("uses 95 percent success threshold", () => {
    expect(isSuccessfulCollectionRate(95, 100)).toBe(true);
    expect(isSuccessfulCollectionRate(94, 100)).toBe(false);
  });

  test("selects channel thumbnails in high medium default order", () => {
    expect(
      selectChannelThumbnailUrl({
        default: { url: "default.jpg" },
        medium: { url: "medium.jpg" },
        high: { url: "high.jpg" },
      }),
    ).toBe("high.jpg");
    expect(selectChannelThumbnailUrl({ default: { url: "default.jpg" }, medium: { url: "medium.jpg" } })).toBe(
      "medium.jpg",
    );
    expect(selectChannelThumbnailUrl({ default: { url: "default.jpg" } })).toBe("default.jpg");
    expect(selectChannelThumbnailUrl(undefined)).toBeNull();
  });

  test("parses YouTube ISO 8601 durations", () => {
    expect(parseYoutubeDuration("PT1H2M3S")).toBe(3723);
    expect(parseYoutubeDuration("PT59S")).toBe(59);
    expect(parseYoutubeDuration("PT12M")).toBe(720);
    expect(parseYoutubeDuration(undefined)).toBeNull();
  });

  test("prevents duplicate snapshots for the same day", () => {
    expect(shouldInsertSnapshot(["2026-07-17"], "2026-07-17")).toBe(false);
    expect(shouldInsertSnapshot(["2026-07-16"], "2026-07-17")).toBe(true);
  });

  test("validates seed categories", () => {
    expect(SEED_CHANNELS).toHaveLength(114);
    expect(SEED_CHANNELS.every((channel) => isValidChannelCategory(channel.category))).toBe(true);
  });
});
