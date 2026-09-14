import type { Attitude, Civilization, DiplomatId, FlagShape, FlagSpec } from "./types";
import { makeRng, pick } from "./rng";
import { FLAG_SHAPES } from "./constants";

export const PLAYER_PALETTES: [string, string, string][] = [
  ["#8f2d2a", "#e8e6df", "#3a1210"],
  ["#2a6b78", "#d5efe8", "#0d2a30"],
  ["#3d5a2c", "#dfe8c8", "#1a2612"],
  ["#6b4a1f", "#f0e2c4", "#2c1c0a"],
  ["#3c3f6b", "#cfd3ee", "#151628"],
  ["#6b2f4a", "#f0d4e0", "#2a121c"],
  ["#2f4a4a", "#d4ece8", "#102020"],
  ["#5a3d2c", "#ead7c4", "#24180f"],
  ["#4a4a52", "#e8e6df", "#1a1a1e"],
  ["#1f4a6b", "#cfe4f0", "#0a1c2c"],
];

const PRESETS: Array<Omit<Civilization, "id">> = [
  {
    name: "Terran Directorate",
    useThe: true,
    racialName: "humans",
    rulerTitle: "Director",
    attitude: "neutral",
    diplomat: "envoy",
    flag: flagOf(["#8f2d2a", "#e8e6df", "#3a1210"], "bar", "star"),
  },
  {
    name: "Helion Concord",
    useThe: true,
    racialName: "helions",
    rulerTitle: "First Speaker",
    attitude: "polite",
    diplomat: "choir",
    flag: flagOf(["#2a6b78", "#d5efe8", "#0d2a30"], "ring", "disc"),
  },
  {
    name: "Kryth Collective",
    useThe: true,
    racialName: "kryth",
    rulerTitle: "Prime Node",
    attitude: "aggressive",
    diplomat: "console",
    flag: flagOf(["#3d5a2c", "#dfe8c8", "#1a2612"], "hex", "slash"),
  },
  {
    name: "Vesper Hegemony",
    useThe: true,
    racialName: "vesperi",
    rulerTitle: "Hegemon",
    attitude: "belligerent",
    diplomat: "mask",
    flag: flagOf(["#6b4a1f", "#f0e2c4", "#2c1c0a"], "chevron", "diamond"),
  },
  {
    name: "Ashen Choir",
    useThe: true,
    racialName: "ashborn",
    rulerTitle: "Cantor",
    attitude: "apologetic",
    diplomat: "oracle",
    flag: flagOf(["#4a4a52", "#e8e6df", "#1a1a1e"], "crescent", "ring"),
  },
  {
    name: "Orion Compact",
    useThe: true,
    racialName: "orioni",
    rulerTitle: "Marshal",
    attitude: "aggressive",
    diplomat: "captain",
    flag: flagOf(["#1f4a6b", "#cfe4f0", "#0a1c2c"], "cross", "star"),
  },
  {
    name: "Nadir Syndicate",
    useThe: true,
    racialName: "nadiri",
    rulerTitle: "Chair",
    attitude: "neutral",
    diplomat: "console",
    flag: flagOf(["#6b2f4a", "#f0d4e0", "#2a121c"], "slash", "bar"),
  },
  {
    name: "Palladium Seat",
    useThe: true,
    racialName: "palladians",
    rulerTitle: "Regent",
    attitude: "polite",
    diplomat: "envoy",
    flag: flagOf(["#5a3d2c", "#ead7c4", "#24180f"], "diamond", "cross"),
  },
];

function flagOf(
  colors: [string, string, string],
  shapeA: FlagShape,
  shapeB: FlagShape,
): FlagSpec {
  return {
    colors,
    shapeA,
    shapeB,
    scaleA: 1,
    scaleB: 0.72,
    offsetA: { x: 0, y: 0 },
    offsetB: { x: 0, y: 0 },
  };
}

export function presetCivs(): Civilization[] {
  return PRESETS.map((c, i) => ({ ...c, id: `preset-${i}` }));
}

export function civColor(civ: Civilization): string {
  return civ.flag.colors[0];
}

export function civTheName(civ: Civilization): string {
  return civ.useThe ? `the ${civ.name}` : civ.name;
}

let seq = 0;
export function uid(prefix = "id"): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function randomCiv(seed: string, index: number): Civilization {
  const rng = makeRng(seed, 0x9e3779b9 + index * 17);
  const base = PRESETS[index % PRESETS.length]!;
  const palette = PLAYER_PALETTES[index % PLAYER_PALETTES.length]!;
  return {
    ...base,
    id: uid("civ"),
    flag: {
      ...base.flag,
      colors: palette,
      shapeA: pick(rng, FLAG_SHAPES),
      shapeB: pick(rng, FLAG_SHAPES),
    },
  };
}

export const ATTITUDES: Attitude[] = [
  "neutral",
  "belligerent",
  "aggressive",
  "polite",
  "apologetic",
];

export const DIPLOMATS: DiplomatId[] = [
  "envoy",
  "mask",
  "console",
  "choir",
  "captain",
  "oracle",
];
