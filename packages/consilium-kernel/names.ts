import type { Rng } from "./rng";
import { pick } from "./rng";

const PREFIX = [
  "Astra",
  "Vesper",
  "Helion",
  "Nadir",
  "Orion",
  "Lyra",
  "Kepler",
  "Gliese",
  "Rigel",
  "Vela",
  "Cygnus",
  "Harrow",
  "Palladium",
  "Cinder",
  "Aurel",
  "Solace",
  "Kryth",
  "Icarus",
  "Prax",
  "Mire",
  "Sable",
  "Ivory",
  "Thorn",
  "Meridian",
  "Caelum",
  "Nox",
  "Ardent",
  "Vellum",
  "Quillon",
  "Sable",
  "Ashen",
  "Gossamer",
  "Ferrum",
  "Lumen",
  "Onyx",
  "Seraph",
  "Talon",
  "Umbra",
  "Wraith",
  "Zephyr",
];

const SUFFIX = [
  "Reach",
  "Gate",
  "March",
  "Well",
  "Deep",
  "Spire",
  "Expanse",
  "Hold",
  "Verge",
  "Cross",
  "Haven",
  "Fall",
  "Crown",
  "Wake",
  "Rift",
  "Bastion",
  "Anchor",
  "Choir",
  "Reliquary",
  "Threshold",
  "Atrium",
  "Cinder",
  "Harbor",
  "Nexus",
  "Pinnacle",
  "Shroud",
  "Vault",
  "Weald",
];

const GREEK = [
  "Alpha",
  "Beta",
  "Gamma",
  "Delta",
  "Epsilon",
  "Zeta",
  "Eta",
  "Theta",
  "Iota",
  "Kappa",
  "Lambda",
  "Mu",
  "Nu",
  "Xi",
  "Omicron",
  "Pi",
  "Rho",
  "Sigma",
  "Tau",
  "Upsilon",
  "Phi",
  "Chi",
  "Psi",
  "Omega",
];

export function generateSystemNames(rng: Rng, count: number): string[] {
  const used = new Set<string>();
  const names: string[] = [];
  let guard = 0;
  while (names.length < count && guard < count * 20) {
    guard++;
    const style = rng();
    let name: string;
    if (style < 0.35) {
      name = `${pick(rng, PREFIX)} ${pick(rng, SUFFIX)}`;
    } else if (style < 0.6) {
      name = `${pick(rng, PREFIX)} ${pick(rng, GREEK)}`;
    } else if (style < 0.8) {
      const n = 100 + Math.floor(rng() * 800);
      name = `${pick(rng, PREFIX)}-${n}`;
    } else {
      name = `${pick(rng, GREEK)} ${pick(rng, PREFIX)}`;
    }
    if (!used.has(name)) {
      used.add(name);
      names.push(name);
    }
  }
  let i = 1;
  while (names.length < count) {
    const fallback = `System ${i++}`;
    if (!used.has(fallback)) {
      used.add(fallback);
      names.push(fallback);
    }
  }
  return names;
}
