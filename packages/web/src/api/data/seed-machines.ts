/**
 * Seed list of recently-released machines (factual: name / maker / release date only —
 * no strategy/expected-value data). Sourced from manufacturer/official release calendars.
 * Add new machines weekly by editing this list or inserting directly into the `machines` table.
 */
export type SeedMachine = {
  name: string;
  maker: string;
  releaseDate: string;
  type?: string;
  shortName?: string;
  aliases?: string[];
  excludeTerms?: string[];
};

export const SEED_MACHINES: SeedMachine[] = [
  { name: "Lパチスロ からくりサーカス2", maker: "SANKYO", releaseDate: "2026-07-06" },
  { name: "P/eフィーバーブルーロック Light ver.", maker: "SANKYO", releaseDate: "2026-07-06" },
  { name: "eフィーバー デッドマウント・デスプレイ 魂神", maker: "SANKYO", releaseDate: "2026-06-08" },
  { name: "ぱちんこ 必殺仕事人VI オッケー", maker: "SANYO", releaseDate: "2026-07-06" },
  { name: "デカスタeベルセルク無双第2章10連撃Ver.", maker: "SANYO", releaseDate: "2026-07-21" },
];
