import { describe, expect, test } from "bun:test";
import { countMachineContentTypes, excludeManualExcludedLinks, selectConfirmedMachineVideos } from "./machine-content";

describe("machine content filtering", () => {
  const rows = [
    { videoId: "standard-1", matchMethod: "exact_name", matchStatus: "matched", contentType: "standard" as const },
    { videoId: "short-1", matchMethod: "alias", matchStatus: "matched", contentType: "short" as const },
    { videoId: "live-1", matchMethod: "manual", matchStatus: "matched", contentType: "live" as const },
    { videoId: "excluded-1", matchMethod: "manual_excluded", matchStatus: "matched", contentType: "promotion" as const },
  ];

  test("removes manual_excluded links from mentions and counts", () => {
    const active = excludeManualExcludedLinks(rows);
    expect(active.map((row) => row.videoId)).toEqual(["standard-1", "short-1", "live-1"]);
    expect(countMachineContentTypes(active)).toEqual({
      standard: 1,
      short: 1,
      live: 1,
      promotion: 0,
      unknown: 0,
    });
  });

  test("keeps content counts independent from selected mention content type", () => {
    const active = excludeManualExcludedLinks(rows);
    const mentions = active.filter((row) => row.contentType === "standard");
    expect(mentions.map((row) => row.videoId)).toEqual(["standard-1"]);
    expect(countMachineContentTypes(active).short).toBe(1);
    expect(countMachineContentTypes(active).live).toBe(1);
  });

  test("excludes ambiguous and unmatched videos from confirmed machine content", () => {
    const active = excludeManualExcludedLinks([
      { videoId: "ambiguous", matchMethod: "alias", matchStatus: "ambiguous", contentType: "standard" as const },
      { videoId: "unmatched", matchMethod: "alias", matchStatus: "unmatched", contentType: "standard" as const },
      { videoId: "confirmed", matchMethod: "alias", matchStatus: "matched", contentType: "standard" as const },
    ]);
    expect(active.map((row) => row.videoId)).toEqual(["confirmed"]);
  });

  test("counts a multiply linked video once per content type", () => {
    expect(countMachineContentTypes([
      { videoId: "shared", matchMethod: "alias", matchStatus: "matched", contentType: "standard" as const },
      { videoId: "shared", matchMethod: "manual", matchStatus: "matched", contentType: "standard" as const },
    ]).standard).toBe(1);
  });

  test("models an API response with an excluded and a valid link for the same video", () => {
    const responseRows = selectConfirmedMachineVideos([
      { videoId: "shared", matchMethod: "manual_excluded", matchStatus: "matched", contentType: "standard" as const },
      { videoId: "shared", matchMethod: "alias", matchStatus: "matched", contentType: "standard" as const },
      { videoId: "excluded-only", matchMethod: "manual_excluded", matchStatus: "matched", contentType: "short" as const },
    ]);
    expect(responseRows.map((row) => row.videoId)).toEqual(["shared"]);
    expect(countMachineContentTypes(responseRows)).toEqual({ standard: 1, short: 0, live: 0, promotion: 0, unknown: 0 });
  });
});
