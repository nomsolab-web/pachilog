import { describe, expect, test } from "bun:test";
import { parseGeminiJudgment } from "./machine-ai-parse";

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
});
