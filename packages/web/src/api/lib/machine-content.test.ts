import { describe, expect, test } from "bun:test";
import { countMachineContentTypes, excludeManualExcludedLinks } from "./machine-content";

describe("machine content filtering", () => {
  const rows = [
    { videoId: "standard-1", matchMethod: "exact_name", contentType: "standard" as const },
    { videoId: "short-1", matchMethod: "alias", contentType: "short" as const },
    { videoId: "live-1", matchMethod: "manual", contentType: "live" as const },
    { videoId: "excluded-1", matchMethod: "manual_excluded", contentType: "promotion" as const },
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
});
