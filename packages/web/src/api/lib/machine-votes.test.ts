import { describe, expect, test } from "bun:test";
import { isMachineVoteType, machineVoteStatus, validateVoterFingerprint } from "./machine-votes";

describe("machine vote helpers", () => {
  test("validates vote type and fingerprint format", () => {
    expect(isMachineVoteType("want_to_play")).toBe(true);
    expect(isMachineVoteType("bad")).toBe(false);
    expect(validateVoterFingerprint("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(validateVoterFingerprint("short")).toBe(false);
    expect(validateVoterFingerprint("contains space")).toBe(false);
  });

  test("distinguishes inserted, already-recorded, and updated votes", () => {
    expect(machineVoteStatus(null, "want_to_play")).toBe("recorded");
    expect(machineVoteStatus("want_to_play", "want_to_play")).toBe("already_recorded");
    expect(machineVoteStatus("wait_and_see", "want_to_play")).toBe("updated");
  });
});
