import { describe, expect, test } from "bun:test";
import { classifyVideoContent } from "./content-type";

describe("video content type classification", () => {
  test("prefers YouTube live metadata over title and duration", () => {
    expect(classifyVideoContent({ title: "通常実践", durationSeconds: 30, liveBroadcastContent: "live" }).contentType).toBe(
      "live",
    );
    expect(classifyVideoContent({ title: "実践ライブ アーカイブ", liveBroadcastContent: "completed" }).contentType).toBe(
      "live",
    );
  });

  test("classifies short candidates by duration or hashtag", () => {
    expect(classifyVideoContent({ title: "スマスロ実践", durationSeconds: 59 }).contentType).toBe("short");
    expect(classifyVideoContent({ title: "スマスロ実践 #shorts", durationSeconds: 120 }).contentType).toBe("short");
  });

  test("requires manufacturer context for promotion terms", () => {
    expect(classifyVideoContent({ title: "新台PV公開", channelCategory: "manufacturer" }).contentType).toBe("promotion");
    expect(classifyVideoContent({ title: "PVを引いた実践", channelCategory: "individual" }).contentType).toBe("standard");
  });

  test("falls back to unknown only when classification material is missing", () => {
    expect(classifyVideoContent({ title: "" }).contentType).toBe("unknown");
    expect(classifyVideoContent({ title: "スマスロ実践", durationSeconds: 120 }).contentType).toBe("standard");
  });
});
