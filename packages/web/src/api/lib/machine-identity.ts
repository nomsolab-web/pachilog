import { normalizeMachineType } from "../../shared/machine-type";

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

export function machineIdentityKey(machine: {
  name: string;
  maker?: string | null;
  type?: unknown;
  releaseDate?: string | null;
}) {
  return [
    normalizeMachineName(machine.name),
    normalizeMachineMaker(machine.maker),
    normalizeMachineType(machine.type) ?? "",
    machine.releaseDate ?? "",
  ].join("|");
}
