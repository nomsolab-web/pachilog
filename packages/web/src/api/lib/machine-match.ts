type MachineMatchInput = {
  id: number;
  name: string;
  shortName?: string | null;
  aliases?: string[] | null;
};

export function findMachineMatches(title: string, machines: readonly MachineMatchInput[]) {
  const normalizedTitle = normalizeText(title);
  return machines.filter((machine) => {
    const terms = machineTerms(machine);
    return terms.some((term) => normalizedTitle.includes(normalizeText(term)));
  });
}

export function machineTerms(machine: MachineMatchInput) {
  const terms = [machine.name, machine.shortName, ...(machine.aliases ?? [])].filter((term): term is string => !!term);
  return [...new Set(terms.map((term) => term.trim()).filter(isSafeMachineTerm))];
}

function isSafeMachineTerm(term: string) {
  const compact = normalizeText(term);
  if (compact.length < 4) return false;
  if (/^[a-z0-9]+$/i.test(compact) && compact.length < 6) return false;
  return true;
}

function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[・･\-_()[\]【】「」『』]/g, "");
}
