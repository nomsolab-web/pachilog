import { describe, expect, test } from "bun:test";
import {
  DEFAULT_VIDEO_CONTENT_TYPE,
  VIDEO_CONTENT_TYPE_TABS,
  machineDetailQueryParams,
  parseVideoContentType,
  updateContentTypeSearchParams,
  videoTrendingQueryParams,
  videoContentTypeLabel,
} from "./video-content-types";

describe("video content type tabs", () => {
  test("uses standard as the default tab", () => {
    expect(DEFAULT_VIDEO_CONTENT_TYPE).toBe("standard");
    expect(parseVideoContentType(null)).toBe("standard");
    expect(parseVideoContentType("invalid")).toBe("standard");
  });

  test("maps tab labels to API contentType values", () => {
    expect(VIDEO_CONTENT_TYPE_TABS.map((tab) => [tab.value, tab.label])).toEqual([
      ["standard", "通常動画"],
      ["short", "ショート"],
      ["live", "ライブ"],
      ["promotion", "公式PV・CM"],
      ["unknown", "その他"],
    ]);
    expect(videoContentTypeLabel("promotion")).toBe("公式PV・CM");
  });

  test("updates contentType while preserving unrelated query params", () => {
    const params = updateContentTypeSearchParams("?mode=7d&period=30&contentType=standard", "short");
    expect(params.get("contentType")).toBe("short");
    expect(params.get("mode")).toBe("7d");
    expect(params.get("period")).toBe("30");
  });

  test("resets cursor when changing tabs", () => {
    const params = updateContentTypeSearchParams("?mode=7d&cursor=abc&contentType=standard", "live", {
      resetCursor: true,
    });
    expect(params.get("contentType")).toBe("live");
    expect(params.get("mode")).toBe("7d");
    expect(params.has("cursor")).toBe(false);
  });

  test("builds API query params from the selected tab", () => {
    expect(videoTrendingQueryParams("7d", "promotion", "cursor-1")).toEqual({
      mode: "7d",
      contentType: "promotion",
      limit: "20",
      cursor: "cursor-1",
    });
    expect(machineDetailQueryParams("unknown")).toEqual({ contentType: "unknown" });
  });

  test("restores tabs from URL-compatible values", () => {
    expect(parseVideoContentType(new URLSearchParams("?contentType=short").get("contentType"))).toBe("short");
    expect(parseVideoContentType(new URLSearchParams("?contentType=promotion").get("contentType"))).toBe("promotion");
    expect(parseVideoContentType(new URLSearchParams("?contentType=bad").get("contentType"))).toBe("standard");
  });
});
