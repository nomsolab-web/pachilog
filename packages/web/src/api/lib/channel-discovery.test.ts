import { describe, expect, test } from "bun:test";
import {
  type ChannelDiscoveryClient,
  discoverChannelCandidates,
  scoreChannelCandidate,
} from "./channel-discovery";

const baseNow = new Date("2026-07-22T00:00:00.000Z");

describe("channel discovery", () => {
  test("excludes registered channels and deduplicates channels and videos", async () => {
    const client = mockClient({
      "パチンコ 実践": [
        video("registered-video", "registered-channel", "Registered", "already seeded", "2026-07-21T00:00:00.000Z"),
        video("video-a", "channel-a", "Channel A", "first", "2026-07-21T00:00:00.000Z"),
        video("video-a", "channel-a", "Channel A", "duplicate", "2026-07-21T00:00:00.000Z"),
      ],
      "パチスロ 実践": [video("video-b", "channel-a", "Channel A", "second", "2026-07-20T00:00:00.000Z")],
    });

    const result = await discoverChannelCandidates(
      { days: 60, limit: 10, minVideos: 1, queries: ["パチンコ 実践", "パチスロ 実践"], now: baseNow },
      client,
      new Set(["registered-channel"]),
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.channelId).toBe("channel-a");
    expect(result.candidates[0]?.matchedVideoCount).toBe(2);
    expect(result.candidates[0]?.matchedQueries).toEqual(["パチスロ 実践", "パチンコ 実践"]);
    expect(result.candidates[0]?.sampleVideos.map((sample) => sample.videoId)).toEqual(["video-a", "video-b"]);
  });

  test("applies min-videos before returning candidates", async () => {
    const result = await discoverChannelCandidates(
      { days: 60, limit: 10, minVideos: 2, queries: ["q"], now: baseNow },
      mockClient({
        q: [
          video("a-1", "channel-a", "Channel A", "only one", "2026-07-21T00:00:00.000Z"),
          video("b-1", "channel-b", "Channel B", "one", "2026-07-21T00:00:00.000Z"),
          video("b-2", "channel-b", "Channel B", "two", "2026-07-20T00:00:00.000Z"),
        ],
      }),
      new Set(),
    );

    expect(result.candidates.map((candidate) => candidate.channelId)).toEqual(["channel-b"]);
  });

  test("ranks candidates using videos, query breadth, subscribers and recency", async () => {
    const result = await discoverChannelCandidates(
      { days: 60, limit: 10, minVideos: 1, queries: ["q1", "q2"], now: baseNow },
      mockClient(
        {
          q1: [
            video("small-1", "small", "Small", "small one", "2026-07-21T00:00:00.000Z"),
            video("small-2", "small", "Small", "small two", "2026-07-20T00:00:00.000Z"),
            video("large-1", "large", "Large", "large one", "2026-06-01T00:00:00.000Z"),
          ],
          q2: [video("small-3", "small", "Small", "small three", "2026-07-19T00:00:00.000Z")],
        },
        {
          large: { subscriberCount: 1_000_000 },
          small: { subscriberCount: 100 },
        },
      ),
      new Set(),
    );

    expect(result.candidates.map((candidate) => candidate.channelId)).toEqual(["small", "large"]);
    expect(result.candidates[0]?.score).toBeGreaterThan(result.candidates[1]?.score ?? 0);
  });

  test("handles hidden subscriber counts and missing API details", async () => {
    const result = await discoverChannelCandidates(
      { days: 60, limit: 10, minVideos: 1, queries: ["q"], now: baseNow },
      mockClient(
        {
          q: [
            video("hidden-1", "hidden", "Hidden Channel", "hidden subs", "2026-07-21T00:00:00.000Z"),
            video("missing-1", "missing", "Missing Channel", "missing details", "2026-07-21T00:00:00.000Z"),
          ],
        },
        {
          hidden: { subscriberCount: null },
        },
      ),
      new Set(),
    );

    const hidden = result.candidates.find((candidate) => candidate.channelId === "hidden");
    const missing = result.candidates.find((candidate) => candidate.channelId === "missing");
    expect(hidden?.subscriberCount).toBeNull();
    expect(missing?.title).toBe("Missing Channel");
    expect(missing?.subscriberCount).toBeNull();
  });

  test("keeps score calculation stable when subscriber count is private", () => {
    expect(
      scoreChannelCandidate({
        matchedVideoCount: 2,
        matchedQueryCount: 1,
        subscriberCount: null,
        latestVideoPublishedAt: "2026-07-21T00:00:00.000Z",
        now: baseNow,
      }),
    ).toBeGreaterThan(0);
  });
});

function mockClient(
  searches: Record<string, ReturnType<typeof video>[]>,
  overrides: Record<string, Partial<Awaited<ReturnType<ChannelDiscoveryClient["fetchChannelDetails"]>>[number]>> = {},
): ChannelDiscoveryClient {
  return {
    async searchVideos(query) {
      return searches[query] ?? [];
    },
    async fetchChannelDetails(channelIds) {
      return channelIds
        .filter((channelId) => channelId !== "missing")
        .map((channelId) => ({
          channelId,
          title: `${channelId} title`,
          channelUrl: `https://www.youtube.com/channel/${channelId}`,
          thumbnailUrl: `https://example.com/${channelId}.jpg`,
          subscriberCount: 1_000,
          viewCount: 10_000,
          videoCount: 100,
          publishedAt: "2024-01-01T00:00:00.000Z",
          description: "",
          ...overrides[channelId],
        }));
    },
  };
}

function video(videoId: string, channelId: string, channelTitle: string, title: string, publishedAt: string) {
  return {
    videoId,
    channelId,
    channelTitle,
    title,
    publishedAt,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}
