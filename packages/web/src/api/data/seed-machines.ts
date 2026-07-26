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

// Keep legacy rows for compatibility. The runner never deletes old machines.
const LEGACY_SEED_MACHINES: SeedMachine[] = [];

export const SEED_MACHINES: SeedMachine[] = [...LEGACY_SEED_MACHINES, ...SEED_MACHINES_2026];
