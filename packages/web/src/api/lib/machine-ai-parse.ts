export type GeminiJudgment = {
  machineId: number | null;
  confidence: number;
  reason: string;
  matchedTerms: string[];
};

export type GeminiBatchJudgment = GeminiJudgment & {
  candidateIndex: number;
};

export function parseGeminiJudgment(text: string): GeminiJudgment {
  const json = extractJsonObject(text);
  const parsed = JSON.parse(json) as Partial<GeminiJudgment>;
  return normalizeJudgment(parsed);
}

export function parseGeminiBatchJudgments(text: string): GeminiBatchJudgment[] {
  const json = extractJsonArray(text);
  const parsed = JSON.parse(json) as Array<Partial<GeminiBatchJudgment>>;
  if (!Array.isArray(parsed)) throw new Error("invalid batch judgment");

  const judgments: GeminiBatchJudgment[] = [];
  for (const item of parsed) {
    try {
      if (typeof item.candidateIndex !== "number" || !Number.isInteger(item.candidateIndex)) continue;
      judgments.push({ ...normalizeJudgment(item), candidateIndex: item.candidateIndex });
    } catch {
      // Keep valid items from a partially malformed batch response.
    }
  }
  return judgments;
}

function normalizeJudgment(parsed: Partial<GeminiJudgment>) {
  if (typeof parsed.confidence !== "number" || parsed.confidence < 0 || parsed.confidence > 1) {
    throw new Error("invalid confidence");
  }
  return {
    machineId: typeof parsed.machineId === "number" ? parsed.machineId : null,
    confidence: parsed.confidence,
    reason: typeof parsed.reason === "string" ? parsed.reason.slice(0, 500) : "",
    matchedTerms: Array.isArray(parsed.matchedTerms) ? parsed.matchedTerms.filter((term) => typeof term === "string") : [],
  };
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("missing JSON object");
  return text.slice(start, end + 1);
}

function extractJsonArray(text: string) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) throw new Error("missing JSON array");
  return text.slice(start, end + 1);
}
