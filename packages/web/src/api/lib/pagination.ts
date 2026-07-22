export function clampLimit(value: string | undefined, defaultLimit: number, maxLimit: number) {
  const parsed = Number(value ?? defaultLimit);
  if (!Number.isInteger(parsed) || parsed < 1) return defaultLimit;
  return Math.min(parsed, maxLimit);
}

export function parseOffsetCursor(value: string | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}
