import type { SeedMachine } from "./seed-machines";

export function buildMachineSeedValues(machine: SeedMachine) {
  return Object.fromEntries(
    Object.entries({
      name: machine.name,
      maker: machine.maker,
      releaseDate: machine.releaseDate,
      type: machine.type,
      shortName: machine.shortName,
      aliases: machine.aliases,
      excludeTerms: machine.excludeTerms,
      series: machine.series,
      sourceUrl: machine.sourceUrl,
      officialUrl: machine.officialUrl,
      uniqueAliases: machine.uniqueAliases,
      ambiguousAliases: machine.ambiguousAliases,
      resolvingKeywords: machine.resolvingKeywords,
    }).filter(([, value]) => value !== undefined),
  );
}
