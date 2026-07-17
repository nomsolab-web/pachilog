import { describe, expect, test } from "bun:test";
import { sanitizeGeminiError } from "./gemini-error";
import { parseGeminiBatchJudgments, parseGeminiJudgment } from "./machine-ai-parse";

describe("machine AI judgment parsing", () => {
  test("parses a valid JSON judgment", () => {
    expect(
      parseGeminiJudgment('{"machineId":1,"confidence":0.91,"reason":"title match","matchedTerms":["北斗"]}'),
    ).toEqual({
      machineId: 1,
      confidence: 0.91,
      reason: "title match",
      matchedTerms: ["北斗"],
    });
  });

  test("throws on broken JSON or invalid confidence", () => {
    expect(() => parseGeminiJudgment("not json")).toThrow();
    expect(() => parseGeminiJudgment('{"machineId":1,"confidence":2,"reason":"","matchedTerms":[]}')).toThrow();
  });

  test("keeps valid judgments from a partially malformed batch", () => {
    expect(
      parseGeminiBatchJudgments(
        '[{"candidateIndex":0,"machineId":1,"confidence":0.91,"reason":"ok","matchedTerms":["北斗"]},{"candidateIndex":1,"machineId":2,"confidence":2,"reason":"bad","matchedTerms":[]}]',
      ),
    ).toEqual([{ candidateIndex: 0, machineId: 1, confidence: 0.91, reason: "ok", matchedTerms: ["北斗"] }]);
  });

  test("sanitizes Gemini quota errors without leaking request data", () => {
    const body = JSON.stringify({
      error: {
        status: "RESOURCE_EXHAUSTED",
        details: [
          {
            reason: "RESOURCE_EXHAUSTED",
            metadata: { quota_metric: "generativelanguage.googleapis.com/generate_content_free_tier_requests" },
          },
        ],
      },
    });

    expect(sanitizeGeminiError(429, body)).toBe(
      "Gemini request failed (429) reason=RESOURCE_EXHAUSTED quotaMetric=generativelanguage.googleapis.com/generate_content_free_tier_requests",
    );
  });
});
