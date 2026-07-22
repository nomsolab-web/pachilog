import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentTypeTabs, EmptyState, ErrorState, LoadingGrid, useVideoTrendingUrlState } from "./videos-trending";

describe("videos trending content type UI", () => {
  test("restores the selected tab and falls back safely", () => {
    expect(useVideoTrendingUrlState("/videos/trending").contentType).toBe("standard");
    expect(useVideoTrendingUrlState("/videos/trending?contentType=short&mode=7d")).toEqual({
      mode: "7d",
      contentType: "short",
    });
    expect(useVideoTrendingUrlState("/videos/trending?contentType=bad&mode=bad").contentType).toBe("standard");
  });

  test("renders contentTypeCounts without inventing missing counts", () => {
    const html = renderToStaticMarkup(
      <ContentTypeTabs active="standard" counts={{ standard: 12, short: 3 }} onChange={() => undefined} />,
    );

    expect(html).toContain("通常動画");
    expect(html).toContain("12");
    expect(html).toContain("ショート");
    expect(html).toContain("3");
    expect(html).toContain("ライブ");
  });

  test("renders loading, empty and error states separately", () => {
    expect(renderToStaticMarkup(<LoadingGrid />)).toContain("animate-pulse");
    expect(renderToStaticMarkup(<EmptyState />)).toContain("対象の動画がありません");
    expect(renderToStaticMarkup(<ErrorState onRetry={() => undefined} />)).toContain("動画データを取得できませんでした");
  });
});
