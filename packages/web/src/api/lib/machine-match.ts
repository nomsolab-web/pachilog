type MachineMatchInput = {
  id: number;
  name: string;
  shortName?: string | null;
  aliases?: string[] | null;
  excludeTerms?: string[] | null;
};

export function findMachineMatches(title: string, machines: readonly MachineMatchInput[]) {
  const normalizedTitle = normalizeText(title);
  return machines.filter((machine) => {
    if ((machine.excludeTerms ?? []).some((term) => normalizedTitle.includes(normalizeText(term)))) return false;
    return machineTerms(machine).some((term) => normalizedTitle.includes(normalizeText(term)));
  });
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
