import { describe, expect, test, mock } from "bun:test";
import { JSDOM } from "jsdom";

// Setup global JSDOM environment
const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", {
  url: "http://localhost/machines/33",
});
global.window = dom.window as any;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.location = dom.window.location as any;
global.history = dom.window.history as any;
global.localStorage = dom.window.localStorage as any;

// Mock react-query hook methods fully to avoid provider dependence
mock.module("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: () => Promise.resolve(),
  }),
  useMutation: () => ({
    mutate: () => {},
    isPending: false,
  }),
  useQuery: (options: any) => {
    if (options.queryKey[0] === "machine") {
      return {
        isLoading: false,
        isError: false,
        data: {
          machine: { id: 33, name: "Test Machine", maker: "Test Maker", type: "pachinko" },
          summary: { videoCount: 10, recentVideoCount: 2, recentViews: 500, rankingVideoCount: 8, lastUpdatedAt: Date.now(), periodStart: "2026-07-01", periodEnd: "2026-07-07" },
          mentions: [
            { videoId: "vid1", videoTitle: "Test Video 1", publishedAt: Date.now(), viewCount: 1000, channelName: "Channel A", contentType: "short", hasTrend: true, viewDelta: 100 },
          ],
          contentTypeCounts: { standard: 5, short: 3, live: 2 },
        },
      };
    }
    return {
      isLoading: false,
      isError: false,
      data: { want_to_play: 5, wait_and_see: 2, not_interested: 1 },
    };
  },
}));

import React, { act } from "react";
import { createRoot } from "react-dom/client";
import MachinePage from "./machine";

function render(ui: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  
  act(() => {
    root.render(ui);
  });

  return {
    container,
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  };
}

describe("MachinePage tab & URL query parameter synchronization", () => {
  test("contentType=short for short tab", async () => {
    dom.reconfigure({ url: "http://localhost/machines/33?contentType=short" });
    window.dispatchEvent(new dom.window.PopStateEvent("popstate"));

    const { container, unmount } = render(<MachinePage />);
    
    const shortTab = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("ショート")
    );
    expect(shortTab).toBeDefined();
    expect(shortTab!.className).toContain("text-gold");
    unmount();
  });

  test("contentType=live for live tab", async () => {
    dom.reconfigure({ url: "http://localhost/machines/33?contentType=live" });
    window.dispatchEvent(new dom.window.PopStateEvent("popstate"));

    const { container, unmount } = render(<MachinePage />);
    const liveTab = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("ライブ")
    );
    expect(liveTab).toBeDefined();
    expect(liveTab!.className).toContain("text-gold");
    unmount();
  });

  test("invalid contentType defaults to standard", async () => {
    dom.reconfigure({ url: "http://localhost/machines/33?contentType=invalid" });
    window.dispatchEvent(new dom.window.PopStateEvent("popstate"));

    const { container, unmount } = render(<MachinePage />);
    const standardTab = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("通常動画")
    );
    expect(standardTab).toBeDefined();
    expect(standardTab!.className).toContain("text-gold");
    unmount();
  });

  test("clicking tab updates query parameter", async () => {
    dom.reconfigure({ url: "http://localhost/machines/33?contentType=standard" });
    window.dispatchEvent(new dom.window.PopStateEvent("popstate"));

    const { container, unmount } = render(<MachinePage />);
    const shortTab = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("ショート")
    );
    expect(shortTab).toBeDefined();
    
    act(() => {
      shortTab!.click();
    });

    expect(window.location.search).toContain("contentType=short");
    unmount();
  });

  test("changing sort preserves contentType", async () => {
    dom.reconfigure({ url: "http://localhost/machines/33?contentType=live&sort=rising" });
    window.dispatchEvent(new dom.window.PopStateEvent("popstate"));

    const { container, unmount } = render(<MachinePage />);
    const viewsSortBtn = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("再生数")
    );
    expect(viewsSortBtn).toBeDefined();

    act(() => {
      viewsSortBtn!.click();
    });

    expect(window.location.search).toContain("contentType=live");
    expect(window.location.search).toContain("sort=views");
    unmount();
  });

  test("browser back navigation updates tab state", async () => {
    dom.reconfigure({ url: "http://localhost/machines/33?contentType=standard" });
    window.dispatchEvent(new dom.window.PopStateEvent("popstate"));

    const { container, unmount } = render(<MachinePage />);
    
    act(() => {
      dom.reconfigure({ url: "http://localhost/machines/33?contentType=promotion" });
      window.dispatchEvent(new dom.window.PopStateEvent("popstate"));
    });

    const promotionTab = Array.from(container.querySelectorAll("button")).find(
      (btn) => btn.textContent?.includes("公式PV・CM")
    );
    expect(promotionTab).toBeDefined();
    expect(promotionTab!.className).toContain("text-gold");
    unmount();
  });
});
