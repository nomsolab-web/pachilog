import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { describe, expect, mock, test } from "bun:test";

const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost/videos/trending?contentType=short",
});
global.window = dom.window as any;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.location = dom.window.location as any;
global.history = dom.window.history as any;
global.localStorage = dom.window.localStorage as any;

const queryContentTypes: string[] = [];
const apiRequests: Array<Record<string, string>> = [];
const queryFunctions: Array<(context: { pageParam: string | undefined }) => Promise<unknown>> = [];

mock.module("@tanstack/react-query", () => ({
  useInfiniteQuery: (options: any) => {
    const contentType = options.queryKey[2];
    queryContentTypes.push(contentType);
    queryFunctions.push(options.queryFn);
    return {
      data: {
        pages: [{
          videos: [{
            videoId: `video-${contentType}`,
            title: `${contentType} video card`,
            thumbnailUrl: null,
            publishedAt: "2026-07-01T00:00:00.000Z",
            currentViewCount: 100,
            channelName: "Channel",
            channelThumbnailUrl: null,
            contentType,
            machineTags: [],
            hasTrend: true,
            viewDelta: 10,
            viewDeltaPct: 10,
          }],
          counts: { standard: 1, short: 1, live: 1 },
          nextCursor: null,
        }],
      },
      isLoading: false,
      isError: false,
      hasNextPage: false,
      isFetchingNextPage: false,
      fetchNextPage: () => Promise.resolve(),
      refetch: () => Promise.resolve(),
      queryFn: options.queryFn,
    };
  },
}));

mock.module("../lib/api", () => ({
  api: {
    videos: {
      trending: {
        $get: async ({ query }: { query: Record<string, string> }) => {
          apiRequests.push(query);
          return { json: async () => ({ videos: [], counts: {}, nextCursor: null }) };
        },
      },
    },
  },
}));

import VideosTrendingPage from "./videos-trending";

function renderPage() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(createElement(VideosTrendingPage));
  });
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("videos trending content type data integration", () => {
  test("changes displayed cards and API contentType when switching short, standard, and live", async () => {
    queryContentTypes.length = 0;
    apiRequests.length = 0;
    queryFunctions.length = 0;
    dom.reconfigure({ url: "http://localhost/videos/trending?contentType=short" });
    window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
    const { container, unmount } = renderPage();

    expect(container.textContent).toContain("short video card");
    expect(queryContentTypes.at(-1)).toBe("short");

    await act(async () => {
      await queryFunctions.at(-1)!({ pageParam: undefined });
    });
    expect(apiRequests.at(-1)?.contentType).toBe("short");

    const standardTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("通常動画"),
    );
    expect(standardTab).toBeDefined();
    act(() => standardTab!.click());
    expect(container.textContent).toContain("standard video card");
    expect(container.textContent).not.toContain("short video card");
    expect(queryContentTypes.at(-1)).toBe("standard");

    await act(async () => {
      await queryFunctions[0]({ pageParam: undefined });
    });
    expect(container.textContent).toContain("standard video card");
    expect(container.textContent).not.toContain("short video card");

    const liveTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("ライブ"),
    );
    expect(liveTab).toBeDefined();
    act(() => liveTab!.click());
    expect(container.textContent).toContain("live video card");
    expect(container.textContent).not.toContain("standard video card");
    expect(queryContentTypes.at(-1)).toBe("live");
    unmount();
  });
});
