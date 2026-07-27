import { SEED_MACHINES_2026 } from "./seed-machines-2026";

export type SeedMachine = {
  name: string;
  maker: string;
  releaseDate: string | null;
  type?: string;
  shortName?: string;
  aliases?: string[];
  excludeTerms?: string[];
  series?: string;
  sourceUrl?: string;
  officialUrl?: string;
  uniqueAliases?: string[];
  ambiguousAliases?: string[];
  resolvingKeywords?: string[];
};

// Keep the original five rows in fresh databases. Duplicate names are merged
// with the newer catalog, while distinct legacy rows remain registered.
export const LEGACY_SEED_MACHINES: SeedMachine[] = [
  { name: "Lパチスロ からくりサーカス2", maker: "SANKYO", type: "slot", releaseDate: "2026-07-06", sourceUrl: "https://www.sankyo-fever.jp/products/" },
  { name: "P/eフィーバーブルーロック Light ver.", maker: "SANKYO", type: "pachinko", releaseDate: "2026-07-06", sourceUrl: "https://www.sankyo-fever.jp/products/machine_list/pwr/" },
  { name: "eフィーバー デッドマウント・デスプレイ 魂神9000", maker: "SANKYO", type: "pachinko", releaseDate: "2026-06-08", sourceUrl: "https://www.sankyo-fever.jp/products/" },
  { name: "ぱちんこ 必殺仕事人VI", maker: "オッケー.", type: "pachinko", releaseDate: "2026-07-06", sourceUrl: "https://www.p-world.co.jp/machine/database/10472" },
  { name: "デカスタeベルセルク無双 第2章 10連撃Ver.", maker: "ニューギン", type: "pachinko", releaseDate: "2026-07-21", sourceUrl: "https://www.pachibee.jp/machines/about/126060012" },
];

const mergedMachines = new Map<string, SeedMachine>();
for (const machine of [...LEGACY_SEED_MACHINES, ...SEED_MACHINES_2026]) {
  mergedMachines.set(machine.name, machine);
}

export const SEED_MACHINES: SeedMachine[] = [...mergedMachines.values()];
