export const MACHINE_TYPE_VALUES = ["pachinko", "slot"] as const;
export type MachineType = (typeof MACHINE_TYPE_VALUES)[number];

const PACHINKO_ALIASES = new Set(["pachinko", "パチンコ", "ぱちんこ"]);
const SLOT_ALIASES = new Set(["slot", "pachislot", "pachislo", "パチスロ", "ぱちすろ", "スロット", "パチスロット"]);

export function normalizeMachineType(value: unknown): MachineType | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  if (PACHINKO_ALIASES.has(normalized)) return "pachinko";
  if (SLOT_ALIASES.has(normalized)) return "slot";
  return null;
}

export function machineTypeLabel(value: unknown) {
  const normalized = normalizeMachineType(value);
  if (normalized === "pachinko") return "パチンコ";
  if (normalized === "slot") return "パチスロ";
  return "種別未設定";
}
