export function sanitizeGeminiError(status: number, body: string) {
  let reason = "";
  let quotaMetric = "";
  try {
    const parsed = JSON.parse(body) as {
      error?: {
        status?: string;
        details?: Array<{
          reason?: string;
          metadata?: Record<string, string>;
          violations?: Array<{ quotaMetric?: string; quotaId?: string }>;
        }>;
      };
    };
    reason =
      parsed.error?.details?.find((detail) => detail.reason)?.reason ??
      parsed.error?.status ??
      (status === 429 ? "RESOURCE_EXHAUSTED" : "");
    quotaMetric =
      parsed.error?.details?.find((detail) => detail.metadata?.quota_metric)?.metadata?.quota_metric ??
      parsed.error?.details?.flatMap((detail) => detail.violations ?? []).find((violation) => violation.quotaMetric)
        ?.quotaMetric ??
      "";
  } catch {
    reason = status === 429 ? "RESOURCE_EXHAUSTED" : "";
  }

  return `Gemini request failed (${status})${reason ? ` reason=${reason}` : ""}${quotaMetric ? ` quotaMetric=${quotaMetric}` : ""}`;
}
