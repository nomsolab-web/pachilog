import { describe, expect, test } from "bun:test";
import { classifyVideoContent, isRankableVideoContentType } from "./content-type";

describe("video content type classification", () => {
  test("excludes promotion and unknown from the normal ranking pool", () => {
    expect(isRankableVideoContentType("standard")).toBe(true);
    expect(isRankableVideoContentType("short")).toBe(true);
    expect(isRankableVideoContentType("live")).toBe(true);
    expect(isRankableVideoContentType("promotion")).toBe(false);
    expect(isRankableVideoContentType("unknown")).toBe(false);
  });
  test("prioritizes official WebCM over shorts signals", () => {
    expect(classifyVideoContent({ title: "\u3010WebCM\u3011L\u8056\u95d8\u58eb\u9ec4\u91d1\u5341\u4e8c\u5bae #shorts", durationSeconds: 15, channelCategory: "manufacturer" }).contentType).toBe("promotion");
  });

  test("classifies short official commercials as promotion", () => {
    expect(classifyVideoContent({ title: "\u30de\u30eb\u30cf\u30f3\u6771\u65e5\u672c\u30ab\u30f3\u30d1\u30cb\u30fcCM\u300c\u9031\u672b\u30b9\u30a4\u30c3\u30c1\u300d\u7bc7", durationSeconds: 30, channelCategory: "hall" }).contentType).toBe("promotion");
  });

  test("does not over-classify casual CM/PV fragments on non-official channels", () => {
    expect(classifyVideoContent({ title: "PV\u3092\u5f15\u3044\u305f\u5b9f\u6226", channelCategory: "individual" }).contentType).toBe("standard");
    expect(classifyVideoContent({ title: "CM\u4e2d\u306b\u8d77\u304d\u305f\u8a71", channelCategory: "individual", durationSeconds: 600 }).contentType).toBe("standard");
  });

  test("classifies actual live streams from YouTube metadata", () => {
    expect(classifyVideoContent({ title: "\u5b9f\u6cc1\u914d\u4fe1", liveBroadcastContent: "live" }).contentType).toBe("live");
    expect(classifyVideoContent({ title: "\u914d\u4fe1\u4e88\u5b9a", liveBroadcastContent: "upcoming" }).contentType).toBe("live");
  });

  test("classifies archived live metadata when any broadcast timestamp exists", () => {
    for (const liveStreamingDetails of [
      { actualStartTime: "2026-07-01T12:00:00Z" },
      { actualEndTime: "2026-07-01T13:00:00Z" },
      { scheduledStartTime: "2026-07-01T12:00:00Z" },
    ]) {
      expect(classifyVideoContent({ title: "実況配信アーカイブ", durationSeconds: 120, liveBroadcastContent: "none", liveStreamingDetails }).contentType).toBe("live");
    }
  });

  test("keeps promotion ahead of live metadata", () => {
    expect(classifyVideoContent({ title: "公式 WebCM", channelCategory: "manufacturer", liveStreamingDetails: { actualStartTime: "2026-07-01T12:00:00Z" } }).contentType).toBe("promotion");
  });

  test("prioritizes a long completed live archive over a shorts hashtag", () => {
    expect(
      classifyVideoContent({
        title: "\u9577\u6642\u9593\u914d\u4fe1\u30a2\u30fc\u30ab\u30a4\u30d6 #shorts",
        durationSeconds: 27589,
        liveBroadcastContent: "none",
        liveStreamingDetails: {
          actualStartTime: "2026-07-17T01:21:53Z",
          actualEndTime: "2026-07-17T09:01:45Z",
        },
      }).contentType,
    ).toBe("live");
  });

  test("does not downgrade an existing live row when archive metadata is inconclusive", () => {
    expect(classifyVideoContent({ title: "こあげホール実践実機配信", durationSeconds: 3600, liveBroadcastContent: "none", existingContentType: "live" }).contentType).toBe("live");
  });

  test("does not classify live-related clips as live", () => {
    expect(classifyVideoContent({ title: "\u751f\u914d\u4fe1\u306e\u898b\u3069\u3053\u308d\u307e\u3068\u3081\u30b7\u30e7\u30fc\u30c8", durationSeconds: 45 }).contentType).toBe("short");
    expect(classifyVideoContent({ title: "\u751f\u914d\u4fe1\u306e\u898b\u3069\u3053\u308d #shorts", durationSeconds: 42 }).contentType).toBe("short");
    expect(classifyVideoContent({ title: "\u901a\u5e38\u5c3a\u306e\u751f\u914d\u4fe1\u307e\u3068\u3081", durationSeconds: 600 }).contentType).toBe("standard");
    expect(classifyVideoContent({ title: "\u751f\u914d\u4fe1\u306e\u898b\u3069\u3053\u308d\u7de8\u96c6\u307e\u3068\u3081", durationSeconds: 600 }).contentType).toBe("standard");
    expect(classifyVideoContent({ title: "\u3010\u6b4c\u3063\u3066\u307f\u305f\u3011\u4e59\u5973\u30d5\u30a7\u30b9\u30c6\u30a3\u30d0\u30eb", durationSeconds: 240 }).contentType).toBe("standard");
  });

  test("keeps normal project titles containing live-like words as standard", () => {
    expect(classifyVideoContent({ title: "\u30cf\u30e9\u30ad\u30ea\u30c9\u30e9\u30a4\u30d6 \u7b2c10\u8a71", durationSeconds: 900 }).contentType).toBe("standard");
    expect(classifyVideoContent({ title: "\u30cf\u30e9\u30ad\u30eaDRIVE \u901a\u5e38\u4f01\u753b", durationSeconds: 900 }).contentType).toBe("standard");
    expect(classifyVideoContent({ title: "\u30e9\u30a4\u30d6\u5b9f\u6226 \u65b0\u53f0\u52dd\u8ca0", durationSeconds: 1800 }).contentType).toBe("standard");
  });

  test("does not treat pachinko Short ST as shorts", () => {
    expect(classifyVideoContent({ title: "\u30b7\u30e7\u30fc\u30c8ST\u7a81\u5165\u304b\u3089\u306e\u5b9f\u6226", durationSeconds: 900 }).contentType).toBe("standard");
  });

  test("classifies shorts only after promotion and live checks", () => {
    expect(classifyVideoContent({ title: "\u30b9\u30de\u30b9\u30ed\u5b9f\u8df5 #shorts", durationSeconds: 120 }).contentType).toBe("short");
    expect(classifyVideoContent({ title: "\u30b9\u30de\u30b9\u30ed\u5b9f\u8df5", durationSeconds: 59 }).contentType).toBe("short");
  });

  test("falls back to unknown only when classification material is missing", () => {
    expect(classifyVideoContent({ title: "" }).contentType).toBe("unknown");
    expect(classifyVideoContent({ title: "\u30b9\u30de\u30b9\u30ed\u5b9f\u8df5", durationSeconds: 120 }).contentType).toBe("standard");
  });
});
