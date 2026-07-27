import { machineIdentityKey } from "./machine-identity";

type MachineIdentityInput = {
  name: string;
  maker?: string | null;
  type?: unknown;
  releaseDate?: string | null;
};

export function findExistingMachineForSeed<T extends MachineIdentityInput>(existing: readonly T[], seed: MachineIdentityInput) {
  return existing.find((machine) => machine.name === seed.name || machineIdentityKey(machine) === machineIdentityKey(seed));
}

export function planSeedMachineUpserts<T extends MachineIdentityInput>(existing: readonly T[], seeds: readonly MachineIdentityInput[]) {
  const working = [...existing];
  let inserts = 0;
  let updates = 0;
  for (const seed of seeds) {
    if (findExistingMachineForSeed(working, seed)) {
      updates += 1;
    } else {
      inserts += 1;
      working.push(seed as T);
    }
  }
  return { inserts, updates };
}
