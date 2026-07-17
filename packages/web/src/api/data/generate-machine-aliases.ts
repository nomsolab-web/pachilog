/**
 * Dry-run alias generation.
 * Run: bun packages/web/src/api/data/generate-machine-aliases.ts
 * Output: machine-aliases-pending.json
 */
import { db } from "../database";
import { machines } from "../database/schema";

type AliasSuggestion = {
  machineId: number;
  name: string;
  maker: string | null;
  type: string | null;
  shortName: string | null;
  aliases: string[];
  excludeTerms: string[];
  approved: boolean;
  source: "gemini" | "heuristic";
  reason: string;
};

async function main() {
  const list = await db.select().from(machines);
  const suggestions: AliasSuggestion[] = [];
  for (const machine of list) {
    suggestions.push(await generateSuggestion(machine));
  }

  await Bun.write("machine-aliases-pending.json", `${JSON.stringify({ generatedAt: new Date().toISOString(), suggestions }, null, 2)}\n`);
  console.log(`Wrote ${suggestions.length} alias suggestions to machine-aliases-pending.json`);
}

async function generateSuggestion(machine: typeof machines.$inferSelect): Promise<AliasSuggestion> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return heuristicSuggestion(machine);

  try {
    const result = await geminiAliasSuggestion(machine, apiKey);
    return {
      machineId: machine.id,
      name: machine.name,
      maker: machine.maker,
      type: machine.type,
      shortName: result.shortName,
      aliases: result.aliases,
      excludeTerms: result.excludeTerms,
      approved: false,
      source: "gemini",
      reason: "AI generated; review before applying.",
    };
  } catch (err) {
    return { ...heuristicSuggestion(machine), reason: `Gemini failed; heuristic fallback. ${(err as Error).message}` };
  }
}

function heuristicSuggestion(machine: typeof machines.$inferSelect): AliasSuggestion {
  const aliases = [...new Set([machine.name, machine.shortName, ...(machine.aliases ?? [])].filter((term): term is string => !!term))];
  return {
    machineId: machine.id,
    name: machine.name,
    maker: machine.maker,
    type: machine.type,
    shortName: machine.shortName ?? null,
    aliases,
    excludeTerms: machine.excludeTerms ?? [],
    approved: false,
    source: "heuristic",
    reason: process.env.GEMINI_API_KEY ? "Heuristic fallback." : "GEMINI_API_KEY is not set.",
  };
}

async function geminiAliasSuggestion(machine: typeof machines.$inferSelect, apiKey: string) {
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${apiKey}`;
  const prompt = [
    "Return only JSON: {\"shortName\": string | null, \"aliases\": string[], \"excludeTerms\": string[]}",
    "Generate safe pachinko/pachislot machine aliases for matching YouTube video titles.",
    "Consider type prefixes and notation variants such as L/P/e/PA, full-width/half-width, and spacing.",
    "Do not use collision-prone short standalone aliases such as 北斗 or 番長 unless they are part of a longer distinctive term.",
    `Machine: ${JSON.stringify({ name: machine.name, maker: machine.maker, type: machine.type })}`,
  ].join("\n");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
  });
  if (!res.ok) throw new Error(`Gemini request failed (${res.status})`);
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? "").join("") ?? "";
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json) as { shortName?: unknown; aliases?: unknown; excludeTerms?: unknown };
  return {
    shortName: typeof parsed.shortName === "string" ? parsed.shortName : null,
    aliases: Array.isArray(parsed.aliases) ? parsed.aliases.filter((term) => typeof term === "string") : [],
    excludeTerms: Array.isArray(parsed.excludeTerms) ? parsed.excludeTerms.filter((term) => typeof term === "string") : [],
  };
}

main().then(() => process.exit(0));
