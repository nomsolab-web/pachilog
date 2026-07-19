type MachineMatchInput = {
  id: number;
  name: string;
  shortName?: string | null;
  aliases?: string[] | null;
  uniqueAliases?: string[] | null;
  ambiguousAliases?: string[] | null;
  resolvingKeywords?: string[] | null;
  excludeTerms?: string[] | null; // Negative keywords (competingMachines)
};

export type MachineMatchResult = {
  machineId: number;
  matchConfidence: number;
  matchMethod: "exact_name" | "alias" | "manual" | "manual_excluded";
  matchedTerm: string;
  ranges: { start: number; end: number }[];
};

export type AmbiguousMatchResult = {
  machineId: number;
  matchedTerms: string[];
  confidence: number;
  reason: string;
};

// Find all start/end indices of a substring in a string
function getSubstringRanges(str: string, sub: string): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  if (!sub) return ranges;
  let index = str.indexOf(sub);
  while (index !== -1) {
    ranges.push({ start: index, end: index + sub.length });
    index = str.indexOf(sub, index + 1);
  }
  return ranges;
}

// Check if c1 ranges are completely covered by c2 ranges
function isFullyCovered(c1: MachineMatchResult, c2: MachineMatchResult): boolean {
  // If c1 matched term is longer or equal, it cannot be covered by a shorter term in a substring overlap context
  const c1Norm = normalizeText(c1.matchedTerm);
  const c2Norm = normalizeText(c2.matchedTerm);
  if (c1Norm.length >= c2Norm.length) return false;

  // Check if every range of c1 is enclosed within some range of c2
  return c1.ranges.every((r1) =>
    c2.ranges.some((r2) => r2.start <= r1.start && r2.end >= r1.end)
  );
}

// Performs matching and resolves Cross-machine Substring Overlap
export function findDetailedMachineMatches(title: string, machines: readonly MachineMatchInput[]): MachineMatchResult[] {
  const normalizedTitle = normalizeText(title);
  const candidates: MachineMatchResult[] = [];

  for (const machine of machines) {
    // 1. Check exact name match first
    const normName = normalizeText(machine.name);
    if (normName && normalizedTitle.includes(normName)) {
      candidates.push({
        machineId: machine.id,
        matchConfidence: 100,
        matchMethod: "exact_name",
        matchedTerm: machine.name,
        ranges: getSubstringRanges(normalizedTitle, normName)
      });
      continue; // Found exact name, skip checking aliases for this machine
    }

    // 2. Check unique aliases (100% precise, negative keywords are bypassed for these)
    let matchedUnique = false;
    const uniqueTerms = [machine.shortName, ...(machine.uniqueAliases ?? [])].filter(
      (term): term is string => !!term
    );

    for (const term of uniqueTerms) {
      if (!isSafeMachineTerm(term)) continue;
      const normTerm = normalizeText(term);
      if (normTerm && normalizedTitle.includes(normTerm)) {
        candidates.push({
          machineId: machine.id,
          matchConfidence: 85,
          matchMethod: "alias",
          matchedTerm: term,
          ranges: getSubstringRanges(normalizedTitle, normTerm)
        });
        matchedUnique = true;
        break; // Match one unique alias is enough
      }
    }

    if (matchedUnique) {
      continue;
    }

    // 3. Check ambiguous aliases with negative keywords (excludeTerms) and resolvingKeywords
    const ambiguousTerms = (machine.ambiguousAliases ?? []).filter(
      (term): term is string => !!term
    );

    for (const term of ambiguousTerms) {
      if (!isSafeMachineTerm(term)) continue;
      const normTerm = normalizeText(term);
      if (normTerm && normalizedTitle.includes(normTerm)) {
        // Evaluate negative keywords (excludeTerms / competingMachines)
        const hasNegativeKeyword = (machine.excludeTerms ?? []).some((neg) =>
          normalizedTitle.includes(normalizeText(neg))
        );

        if (hasNegativeKeyword) {
          continue; // Skipped due to negative keyword
        }

        // Must match resolvingKeywords (co-occurrence keywords) to be confirmed
        const hasResolvingKeyword = (machine.resolvingKeywords ?? []).some((resWord) =>
          normalizedTitle.includes(normalizeText(resWord))
        );

        if (hasResolvingKeyword) {
          candidates.push({
            machineId: machine.id,
            matchConfidence: 85,
            matchMethod: "alias",
            matchedTerm: term,
            ranges: getSubstringRanges(normalizedTitle, normTerm)
          });
          break; // Match one is enough
        }
      }
    }
  }

  // 4. Overlap resolution (Filter out sub-matches / substring matches)
  // If c1 is fully covered by any other longer match c2, discard c1.
  const filtered = candidates.filter((c1) => {
    const isSubMatch = candidates.some((c2) => {
      if (c1.machineId === c2.machineId) return false;
      return isFullyCovered(c1, c2);
    });
    return !isSubMatch;
  });

  return filtered;
}

// Performs ambiguous candidate matching (returns reviewable candidates)
export function findAmbiguousDetailedMatches(title: string, machines: readonly MachineMatchInput[]): AmbiguousMatchResult[] {
  const normalizedTitle = normalizeText(title);
  const confirmedMatches = findDetailedMachineMatches(title, machines);
  const confirmedMachineIds = new Set(confirmedMatches.map((m) => m.machineId));
  const results: AmbiguousMatchResult[] = [];

  for (const machine of machines) {
    if (confirmedMachineIds.has(machine.id)) continue;

    // Check excludeTerms (negative keywords)
    const hasNegativeKeyword = (machine.excludeTerms ?? []).some((neg) =>
      normalizedTitle.includes(normalizeText(neg))
    );
    if (hasNegativeKeyword) continue;

    const matchedTerms: string[] = [];

    // Check ambiguous aliases (that didn't match resolving keywords)
    const ambiguousTerms = (machine.ambiguousAliases ?? []).filter(
      (term): term is string => !!term
    );

    for (const term of ambiguousTerms) {
      if (!isSafeMachineTerm(term)) continue;
      const normTerm = normalizeText(term);
      if (normTerm && normalizedTitle.includes(normTerm)) {
        matchedTerms.push(term);
      }
    }

    if (matchedTerms.length > 0) {
      results.push({
        machineId: machine.id,
        matchedTerms: matchedTerms,
        confidence: 50,
        reason: `Matched ambiguous terms [${matchedTerms.join(", ")}] without resolving keywords.`
      });
    }
  }

  // Overlap resolution for ambiguous matches
  // If an ambiguous match c1's terms are fully covered by any confirmed matches or longer ambiguous matches, filter them out.
  const confirmedResults = confirmedMatches.map((m) => ({
    machineId: m.machineId,
    matchedTerm: m.matchedTerm,
    ranges: m.ranges
  }));

  const filtered = results.filter((amb) => {
    // Check if any matched term of the ambiguous candidate is independent (not fully covered by any confirmed match)
    const isCoveredByConfirmed = amb.matchedTerms.every((term) => {
      const normTerm = normalizeText(term);
      const ranges = getSubstringRanges(normalizedTitle, normTerm);
      return ranges.every((r1) =>
        confirmedResults.some((c) =>
          c.machineId !== amb.machineId &&
          c.ranges.some((r2) => r2.start <= r1.start && r2.end >= r1.end && (r2.end - r2.start > r1.end - r1.start))
        )
      );
    });

    return !isCoveredByConfirmed;
  });

  return filtered;
}

export function findMachineMatches(title: string, machines: readonly MachineMatchInput[]) {
  const matches = findDetailedMachineMatches(title, machines);
  const matchedIds = new Set(matches.map((m) => m.machineId));
  return machines.filter((machine) => matchedIds.has(machine.id));
}

export function isSafeMachineTerm(term: string) {
  const compact = normalizeText(term);
  if (compact === "ヴヴヴ" || compact === "vヴヴ") return true;
  if (compact.length >= 3 && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(compact)) return true;

  if (compact.length < 4) return false;
  if (/^[a-z0-9]+$/i.test(compact) && compact.length < 6) return false;
  return true;
}

export function normalizeText(value: string) {
  if (!value) return "";
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[・･\-_()[\]【】「」『』]/g, "");
}
