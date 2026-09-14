import type {
  Attitude,
  BuildKind,
  Density,
  DiplomatId,
  FlagShape,
  GameOptions,
  GameTypeId,
  HomeDev,
  ResourceProfile,
  Resources,
  Upgrade,
  VictoryKind,
} from "./types";

export const SAVE_VERSION = 2;
export const PROFILE_VERSION = 1;

export const BUILD_COST: Record<BuildKind, Resources> = {
  starfleet: { tech: 1, metals: 1, chon: 1 },
  starport: { tech: 2, metals: 2, chon: 2 },
  shipyard: { tech: 3, metals: 3, chon: 1 },
  colony: { tech: 0, metals: 2, chon: 2 },
  mining: { tech: 2, metals: 2, chon: 1 },
  wormhole: { tech: 6, metals: 2, chon: 0 },
};

export const UPKEEP: Resources = { tech: 1, metals: 1, chon: 1 };
export const ESPIONAGE_COST: Resources = { tech: 1, metals: 0, chon: 0 };

export const UPGRADE_LABEL: Record<Upgrade, string> = {
  starport: "Starport",
  shipyard: "Shipyard",
  colony: "Colony",
  mining: "Mining Facilities",
  wormhole: "Wormhole Generator",
};

export const UPGRADE_BLURB: Record<Upgrade, string> = {
  starport: "Defends as a starfleet and supplies your fleets through owned systems.",
  shipyard: "Required to construct starfleets. Cannot launch fleets the turn it is built.",
  colony: "Produces +1 Tech each Resource Phase.",
  mining: "Produces +1 Metals and +1 CHON each Resource Phase.",
  wormhole: "Once per turn, one fleet here may jump up to two systems away.",
};

export const RESOURCE_LABEL: Record<keyof Resources, string> = {
  tech: "Tech",
  metals: "Metals",
  chon: "CHON",
};

export const RESOURCE_FULL: Record<keyof Resources, string> = {
  tech: "Technology & Manufacturing",
  metals: "Heavy Metals & Radioactives",
  chon: "Organics (Carbon-Hydrogen-Oxygen-Nitrogen)",
};

export const ATTITUDE_LABEL: Record<Attitude, string> = {
  neutral: "Neutral",
  belligerent: "Belligerent",
  aggressive: "Aggressive",
  polite: "Polite",
  apologetic: "Apologetic",
};

export const DIPLOMAT_LABEL: Record<DiplomatId, string> = {
  envoy: "Masked Envoy",
  mask: "Gilded Mask",
  console: "Signal Console",
  choir: "Chorus Array",
  captain: "Fleet Captain",
  oracle: "Orbital Oracle",
};

export const FLAG_SHAPES: FlagShape[] = [
  "disc",
  "ring",
  "diamond",
  "chevron",
  "bar",
  "cross",
  "saltire",
  "triangle",
  "star",
  "hex",
  "crescent",
  "slash",
];

export const SYSTEMS_PER_PLAYER: Record<Density, number> = {
  sparse: 4,
  light: 6,
  standard: 8,
  heavy: 10,
};

export const HOMES_PER_PLAYER: Record<Density, number> = {
  sparse: 1,
  light: 2,
  standard: 3,
  heavy: 4,
};

export const PLAYER_RANGE_BOUNDS: Record<GameOptions["playerRange"], [number, number]> = {
  "3-5": [3, 5],
  "4-6": [4, 6],
  "5-8": [5, 8],
  "6-10": [6, 10],
};

/** Distribution of non-home systems: [none, 0/0/1, 0/1/0, 0/1/1, 0/1/2, 0/2/1, 0/2/2] */
export const RESOURCE_WEIGHTS: Record<ResourceProfile, number[]> = {
  barren: [50, 15, 15, 10, 5, 5, 0],
  sparse: [30, 20, 20, 20, 5, 5, 0],
  standard: [15, 25, 25, 20, 5, 5, 5],
  dense: [0, 20, 20, 20, 15, 15, 10],
};

export const RESOURCE_TABLE: Resources[] = [
  { tech: 0, metals: 0, chon: 0 },
  { tech: 0, metals: 0, chon: 1 },
  { tech: 0, metals: 1, chon: 0 },
  { tech: 0, metals: 1, chon: 1 },
  { tech: 0, metals: 1, chon: 2 },
  { tech: 0, metals: 2, chon: 1 },
  { tech: 0, metals: 2, chon: 2 },
];

export interface HomeDevSpec {
  prod: Resources;
  fleets: number;
  upgrades: Upgrade[];
}

export const HOME_DEV: Record<HomeDev, HomeDevSpec> = {
  colonyWorlds: {
    prod: { tech: 0, metals: 1, chon: 1 },
    fleets: 1,
    upgrades: ["colony", "starport"],
  },
  standard: {
    prod: { tech: 1, metals: 1, chon: 1 },
    fleets: 1,
    upgrades: ["shipyard", "starport"],
  },
  advanced: {
    prod: { tech: 2, metals: 1, chon: 1 },
    fleets: 1,
    upgrades: ["colony", "shipyard", "starport", "mining"],
  },
  expanding: {
    prod: { tech: 2, metals: 1, chon: 1 },
    fleets: 2,
    upgrades: ["colony", "shipyard", "starport", "mining"],
  },
  fading: {
    prod: { tech: 3, metals: 0, chon: 0 },
    fleets: 1,
    upgrades: ["colony", "shipyard", "starport", "mining", "wormhole"],
  },
};

export const VICTORY_LABEL: Record<VictoryKind, string> = {
  standard: "Standard (50% of systems)",
  galacticDomination: "Galactic Domination",
  lastStanding: "Last Civilization Standing",
  corporate: "Corporate Takeover",
  gunship: "Gunship Diplomacy",
};

export const GAME_TYPE_META: Record<
  Exclude<GameTypeId, "custom">,
  { name: string; blurb: string; options: Omit<GameOptions, "gameType" | "playerCount"> }
> = {
  standard: {
    name: "Standard",
    blurb:
      "The first Great Interstellar Survey is complete. Wormholes have been mapped, new systems revealed… and you are not alone.",
    options: {
      playerRange: "5-8",
      systemDensity: "standard",
      homeDensity: "standard",
      systemResources: "standard",
      homeDev: "standard",
      victory: "standard",
      turnDuration: "24h",
      turnLimit: "none",
      noWeekendTimer: true,
      disableCommunications: false,
      fogOfWar: false,
      uncharted: false,
      scorchedEarth: false,
      alienArtifacts: false,
    },
  },
  ragnarok: {
    name: "Plan Ragnarok",
    blurb:
      "First contact was a flash of thermonuclear fire. Diplomacy has failed. Wipe the galaxy clean — or be driven to extinction.",
    options: {
      playerRange: "4-6",
      systemDensity: "light",
      homeDensity: "standard",
      systemResources: "standard",
      homeDev: "advanced",
      victory: "lastStanding",
      turnDuration: "24h",
      turnLimit: 40,
      noWeekendTimer: true,
      disableCommunications: true,
      fogOfWar: true,
      uncharted: false,
      scorchedEarth: true,
      alienArtifacts: false,
    },
  },
  reckoning: {
    name: "Day of Reckoning",
    blurb: "Twenty-four hours of quick thinking, backstabbing, and destruction.",
    options: {
      playerRange: "3-5",
      systemDensity: "light",
      homeDensity: "standard",
      systemResources: "standard",
      homeDev: "expanding",
      victory: "galacticDomination",
      turnDuration: "1h",
      turnLimit: 24,
      noWeekendTimer: false,
      disableCommunications: false,
      fogOfWar: false,
      uncharted: false,
      scorchedEarth: false,
      alienArtifacts: false,
    },
  },
  weekend: {
    name: "Weekend Warrior",
    blurb: "Stock snacks and coffee. You will not sleep for the next two days.",
    options: {
      playerRange: "4-6",
      systemDensity: "standard",
      homeDensity: "standard",
      systemResources: "standard",
      homeDev: "expanding",
      victory: "standard",
      turnDuration: "2h",
      turnLimit: 40,
      noWeekendTimer: false,
      disableCommunications: false,
      fogOfWar: false,
      uncharted: false,
      scorchedEarth: false,
      alienArtifacts: false,
    },
  },
  tradeWars: {
    name: "Trade Wars",
    blurb:
      "A rich new sector. Virgin lands. The race is on — for glory, and for the size of your galactic ledger.",
    options: {
      playerRange: "5-8",
      systemDensity: "heavy",
      homeDensity: "light",
      systemResources: "dense",
      homeDev: "colonyWorlds",
      victory: "corporate",
      turnDuration: "24h",
      turnLimit: 60,
      noWeekendTimer: true,
      disableCommunications: false,
      fogOfWar: false,
      uncharted: false,
      scorchedEarth: false,
      alienArtifacts: false,
    },
  },
  postApocalypse: {
    name: "Post-Apocalypse",
    blurb:
      "The war is over. The galaxy is ash. Subjugate what remains through overwhelming force.",
    options: {
      playerRange: "4-6",
      systemDensity: "light",
      homeDensity: "sparse",
      systemResources: "sparse",
      homeDev: "fading",
      victory: "gunship",
      turnDuration: "24h",
      turnLimit: 100,
      noWeekendTimer: true,
      disableCommunications: false,
      fogOfWar: true,
      uncharted: true,
      scorchedEarth: false,
      alienArtifacts: true,
    },
  },
};

export function optionsForType(type: GameTypeId, playerCount?: number): GameOptions {
  const meta =
    type === "custom" ? GAME_TYPE_META.standard : GAME_TYPE_META[type];
  const [lo] = PLAYER_RANGE_BOUNDS[meta.options.playerRange];
  return {
    gameType: type,
    playerCount: playerCount ?? lo,
    ...meta.options,
  };
}

export const QUICK_PLAY_OPTIONS: GameOptions = {
  gameType: "custom",
  playerRange: "3-5",
  playerCount: 3,
  systemDensity: "light",
  homeDensity: "light",
  systemResources: "standard",
  homeDev: "standard",
  victory: "standard",
  turnDuration: "none",
  turnLimit: 40,
  noWeekendTimer: true,
  disableCommunications: false,
  fogOfWar: false,
  uncharted: false,
  scorchedEarth: false,
  alienArtifacts: false,
};
