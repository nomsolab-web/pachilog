import { describe, expect, test } from "bun:test";
import {
  firstNonEmptyMachineReleaseTabId,
  groupMachineVideosByRelease,
  nextMachineReleaseTabAfterContentTypeChange,
  type MachineReleaseTab,
} from "./machine-video-tabs";

describe("machine release video tabs", () => {
  test("selects the first non-empty tab after contentType changes", () => {
    const standardTabs: MachineReleaseTab<{ videoId: string }>[] = [
      { id: "postRelease7", label: "7日以内", count: 0, data: [] },
      { id: "postReleaseAfter", label: "8日以降", count: 0, data: [] },
      { id: "preRelease", label: "導入前", count: 1, data: [{ videoId: "standard-pre" }] },
      { id: "unclassified", label: "分類不能", count: 0, data: [] },
    ];
    const shortTabs: MachineReleaseTab<{ videoId: string }>[] = [
      { id: "postRelease7", label: "7日以内", count: 1, data: [{ videoId: "short-post" }] },
      { id: "postReleaseAfter", label: "8日以降", count: 0, data: [] },
      { id: "preRelease", label: "導入前", count: 0, data: [] },
      { id: "unclassified", label: "分類不能", count: 0, data: [] },
    ];

    expect(firstNonEmptyMachineReleaseTabId(standardTabs)).toBe("preRelease");
    expect(nextMachineReleaseTabAfterContentTypeChange(shortTabs, "preRelease", true)).toBe("postRelease7");
  });

  test("does not reset a user-selected tab within the same contentType", () => {
    const tabs: MachineReleaseTab<{ videoId: string }>[] = [
      { id: "postRelease7", label: "7日以内", count: 1, data: [{ videoId: "post" }] },
      { id: "postReleaseAfter", label: "8日以降", count: 0, data: [] },
      { id: "preRelease", label: "導入前", count: 0, data: [] },
      { id: "unclassified", label: "分類不能", count: 0, data: [] },
    ];

    expect(nextMachineReleaseTabAfterContentTypeChange(tabs, "preRelease", false)).toBe("preRelease");
  });

  test("uses the default tab only when every release group is empty", () => {
    const tabs: MachineReleaseTab<{ videoId: string }>[] = [
      { id: "postRelease7", label: "7日以内", count: 0, data: [] },
      { id: "postReleaseAfter", label: "8日以降", count: 0, data: [] },
      { id: "preRelease", label: "導入前", count: 0, data: [] },
      { id: "unclassified", label: "分類不能", count: 0, data: [] },
    ];

    expect(firstNonEmptyMachineReleaseTabId(tabs)).toBe("postRelease7");
  });

  test("groups videos around release date", () => {
    const groups = groupMachineVideosByRelease(
      [
        { videoId: "pre", publishedAt: "2026-07-09" },
        { videoId: "post7", publishedAt: "2026-07-12" },
        { videoId: "after", publishedAt: "2026-07-20" },
        { videoId: "unknown", publishedAt: null },
      ],
      "2026-07-10",
    );

    expect(groups.preRelease.map((video) => video.videoId)).toEqual(["pre"]);
    expect(groups.postRelease7.map((video) => video.videoId)).toEqual(["post7"]);
    expect(groups.postReleaseAfter.map((video) => video.videoId)).toEqual(["after"]);
    expect(groups.unclassified.map((video) => video.videoId)).toEqual(["unknown"]);
  });
});
