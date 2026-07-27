import { normalizeMachineType } from "../../shared/machine-type";

type CanonicalMachineAlias = {
  canonicalName: string;
  canonicalMaker: string;
  aliases: string[];
};

// These are explicit, reviewed aliases for the three duplicate rows being merged.
// Numeric suffixes are never stripped globally, so different specifications remain distinct.
export const CANONICAL_MACHINE_ALIASES: CanonicalMachineAlias[] = [
  {
    canonicalName: "デカスタeベルセルク無双 第2章 10連撃Ver.",
    canonicalMaker: "ニューギン",
    aliases: ["デカスタeベルセルク無双第2章10連撃Ver."],
  },
  {
    canonicalName: "eフィーバー デッドマウント・デスプレイ 魂神9000",
    canonicalMaker: "SANKYO",
    aliases: ["eフィーバー デッドマウント・デスプレイ 魂神"],
  },
  {
    canonicalName: "ぱちんこ 必殺仕事人VI",
    canonicalMaker: "オッケー.",
    aliases: ["ぱちんこ 必殺仕事人VI オッケー"],
  },
];

export function normalizeMachineName(name: string) {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/(^|[^a-z])vi([^a-z]|$)/g, "$16$2")
    .replace(/(^|[^a-z])iv([^a-z]|$)/g, "$14$2")
    .replace(/(^|[^a-z])iii([^a-z]|$)/g, "$13$2")
    .replace(/(^|[^a-z])ii([^a-z]|$)/g, "$12$2")
    .replace(/(^|[^a-z])i([^a-z]|$)/g, "$11$2")
    .replace(/[\s・･,，.．:：/／\-_()（）「」『』]/g, "")
    .replace(/ⅰ|Ⅰ/g, "1")
    .replace(/ⅱ|Ⅱ/g, "2")
    .replace(/ⅲ|Ⅲ/g, "3")
    .replace(/ⅳ|Ⅳ/g, "4")
    .replace(/ⅴ|Ⅴ/g, "5")
    .replace(/ⅵ|Ⅵ/g, "6");
}

export function normalizeMachineMaker(maker: string | null | undefined) {
  if (!maker) return "";
  const normalized = maker.normalize("NFKC").toLowerCase().replace(/[\s・･.．]/g, "");
  if (normalized === "おっけー" || normalized === "オッケー") return "おっけー";
  if (normalized === "京楽") return "京楽産業";
  return normalized;
}

function canonicalAliasFor(name: string) {
  const normalized = normalizeMachineName(name);
  return CANONICAL_MACHINE_ALIASES.find((entry) =>
    [entry.canonicalName, ...entry.aliases].some((candidate) => normalizeMachineName(candidate) === normalized),
  );
}

export function machineIdentityKey(machine: {
  name: string;
  maker?: string | null;
  type?: unknown;
  releaseDate?: string | null;
}) {
  const alias = canonicalAliasFor(machine.name);
  return [
    normalizeMachineName(alias?.canonicalName ?? machine.name),
    normalizeMachineMaker(alias?.canonicalMaker ?? machine.maker),
    normalizeMachineType(machine.type) ?? "",
    machine.releaseDate ?? "",
  ].join("|");
}
