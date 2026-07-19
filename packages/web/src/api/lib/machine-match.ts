type MachineMatchInput = {
  id: number;
  name: string;
  shortName?: string | null;
  aliases?: string[] | null;
  excludeTerms?: string[] | null;
};

export type MachineMatchResult = {
  machineId: number;
  matchConfidence: number;
  matchMethod: "exact_name" | "alias" | "manual" | "manual_excluded";
  matchedTerm: string;
};

export function findDetailedMachineMatches(title: string, machines: readonly MachineMatchInput[]): MachineMatchResult[] {
  const normalizedTitle = normalizeText(title);
  const candidates: MachineMatchResult[] = [];

  for (const machine of machines) {
    // 1. Check exclude terms
    if (
      (machine.excludeTerms ?? []).some((term) =>
        normalizedTitle.includes(normalizeText(term))
      )
    ) {
      continue;
    }

    // 2. Check official name (exact_name match)
    const normName = normalizeText(machine.name);
    if (normName && normalizedTitle.includes(normName)) {
      candidates.push({
        machineId: machine.id,
        matchConfidence: 100,
        matchMethod: "exact_name",
        matchedTerm: machine.name,
      });
      continue; // Found exact name, skip checking aliases for this machine
    }

    // 3. Check shortName and aliases (alias match)
    const aliasTerms = [machine.shortName, ...(machine.aliases ?? [])].filter(
      (term): term is string => !!term
    );

    for (const term of aliasTerms) {
      if (!isSafeMachineTerm(term)) continue;
      const normTerm = normalizeText(term);
      if (normTerm && normalizedTitle.includes(normTerm)) {
        candidates.push({
          machineId: machine.id,
          matchConfidence: 85,
          matchMethod: "alias",
          matchedTerm: term,
        });
        break; // Match one alias per machine is enough
      }
    }
  }

  // 4. Overlap resolution (Filter out sub-matches / substring matches)
  const filtered = candidates.filter((c1) => {
    const c1Norm = normalizeText(c1.matchedTerm);
    const isSubMatch = candidates.some((c2) => {
      if (c1.machineId === c2.machineId) return false;
      const c2Norm = normalizeText(c2.matchedTerm);
      // If c2's matched term contains c1's matched term and is longer, discard c1.
      return c2Norm.length > c1Norm.length && c2Norm.includes(c1Norm);
    });
    return !isSubMatch;
  });

  return filtered;
}

export function findMachineMatches(title: string, machines: readonly MachineMatchInput[]) {
  const matches = findDetailedMachineMatches(title, machines);
  const matchedIds = new Set(matches.map((m) => m.machineId));
  return machines.filter((machine) => matchedIds.has(machine.id));
}

export function findAmbiguousMachineCandidates(title: string, machines: readonly MachineMatchInput[]) {
  const normalizedTitle = normalizeText(title);
  return machines.filter((machine) => {
    if ((machine.excludeTerms ?? []).some((term) => normalizedTitle.includes(normalizeText(term)))) return false;
    if (machineTerms(machine).some((term) => normalizedTitle.includes(normalizeText(term)))) return false;
    return weakMachineTokens(machine).some((token) => normalizedTitle.includes(normalizeText(token)));
  });
}

export function machineTerms(machine: MachineMatchInput) {
  const terms = [machine.name, machine.shortName, ...(machine.aliases ?? [])].filter((term): term is string => !!term);
  return [...new Set(terms.map((term) => term.trim()).filter(isSafeMachineTerm))];
}

export function weakMachineTokens(machine: MachineMatchInput) {
  const source = [machine.name, machine.shortName, ...(machine.aliases ?? [])].filter((term): term is string => !!term);
  const tokens = source.flatMap((term) => term.normalize("NFKC").split(/[\s・･\-_()[\]【】「」『』]+/));
  return [...new Set(tokens.map((token) => token.trim()).filter(isSafeWeakToken))];
}

export function isSafeMachineTerm(term: string) {
  const compact = normalizeText(term);
  if (compact.length < 4) return false;
  if (/^[a-z0-9]+$/i.test(compact) && compact.length < 6) return false;
  return true;
}

function isSafeWeakToken(term: string) {
  const compact = normalizeText(term);
  if (compact.length < 3) return false;
  if (/^[a-z0-9]+$/i.test(compact) && compact.length < 5) return false;
  return true;
}

export function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[・･\-_()[\]【】「」『』]/g, "");
}
