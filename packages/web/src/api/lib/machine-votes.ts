export const MACHINE_VOTE_TYPES = ["want_to_play", "wait_and_see", "not_interested"] as const;

export type MachineVoteType = (typeof MACHINE_VOTE_TYPES)[number];
export type MachineVoteStatus = "recorded" | "already_recorded" | "updated";

export function isMachineVoteType(value: unknown): value is MachineVoteType {
  return typeof value === "string" && (MACHINE_VOTE_TYPES as readonly string[]).includes(value);
}

export function validateVoterFingerprint(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8 && value.length <= 256 && /^[A-Za-z0-9._:-]+$/.test(value);
}

export function machineVoteStatus(existingVoteType: MachineVoteType | null, requestedVoteType: MachineVoteType): MachineVoteStatus {
  if (!existingVoteType) return "recorded";
  return existingVoteType === requestedVoteType ? "already_recorded" : "updated";
}
