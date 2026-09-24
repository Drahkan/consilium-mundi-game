// src/lib/game/constants.ts
var SAVE_VERSION = 2;
var BUILD_COST = {
  starfleet: { tech: 1, metals: 1, chon: 1 },
  starport: { tech: 2, metals: 2, chon: 2 },
  shipyard: { tech: 3, metals: 3, chon: 1 },
  colony: { tech: 0, metals: 2, chon: 2 },
  mining: { tech: 2, metals: 2, chon: 1 },
  wormhole: { tech: 6, metals: 2, chon: 0 }
};
var ESPIONAGE_COST = { tech: 1, metals: 0, chon: 0 };
var FLAG_SHAPES = [
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
  "slash"
];
var SYSTEMS_PER_PLAYER = {
  sparse: 4,
  light: 6,
  standard: 8,
  heavy: 10
};
var HOMES_PER_PLAYER = {
  sparse: 1,
  light: 2,
  standard: 3,
  heavy: 4
};
var PLAYER_RANGE_BOUNDS = {
  "3-5": [3, 5],
  "4-6": [4, 6],
  "5-8": [5, 8],
  "6-10": [6, 10]
};
var RESOURCE_WEIGHTS = {
  barren: [50, 15, 15, 10, 5, 5, 0],
  sparse: [30, 20, 20, 20, 5, 5, 0],
  standard: [15, 25, 25, 20, 5, 5, 5],
  dense: [0, 20, 20, 20, 15, 15, 10]
};
var RESOURCE_TABLE = [
  { tech: 0, metals: 0, chon: 0 },
  { tech: 0, metals: 0, chon: 1 },
  { tech: 0, metals: 1, chon: 0 },
  { tech: 0, metals: 1, chon: 1 },
  { tech: 0, metals: 1, chon: 2 },
  { tech: 0, metals: 2, chon: 1 },
  { tech: 0, metals: 2, chon: 2 }
];
var HOME_DEV = {
  colonyWorlds: {
    prod: { tech: 0, metals: 1, chon: 1 },
    fleets: 1,
    upgrades: ["colony", "starport"]
  },
  standard: {
    prod: { tech: 1, metals: 1, chon: 1 },
    fleets: 1,
    upgrades: ["shipyard", "starport"]
  },
  advanced: {
    prod: { tech: 2, metals: 1, chon: 1 },
    fleets: 1,
    upgrades: ["colony", "shipyard", "starport", "mining"]
  },
  expanding: {
    prod: { tech: 2, metals: 1, chon: 1 },
    fleets: 2,
    upgrades: ["colony", "shipyard", "starport", "mining"]
  },
  fading: {
    prod: { tech: 3, metals: 0, chon: 0 },
    fleets: 1,
    upgrades: ["colony", "shipyard", "starport", "mining", "wormhole"]
  }
};
var VICTORY_LABEL = {
  standard: "Standard (50% of systems)",
  galacticDomination: "Galactic Domination",
  lastStanding: "Last Civilization Standing",
  corporate: "Corporate Takeover",
  gunship: "Gunship Diplomacy"
};
var GAME_TYPE_META = {
  standard: {
    name: "Standard",
    blurb: "The first Great Interstellar Survey is complete. Wormholes have been mapped, new systems revealed\u2026 and you are not alone.",
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
      alienArtifacts: false
    }
  },
  ragnarok: {
    name: "Plan Ragnarok",
    blurb: "First contact was a flash of thermonuclear fire. Diplomacy has failed. Wipe the galaxy clean \u2014 or be driven to extinction.",
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
      alienArtifacts: false
    }
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
      alienArtifacts: false
    }
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
      alienArtifacts: false
    }
  },
  tradeWars: {
    name: "Trade Wars",
    blurb: "A rich new sector. Virgin lands. The race is on \u2014 for glory, and for the size of your galactic ledger.",
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
      alienArtifacts: false
    }
  },
  postApocalypse: {
    name: "Post-Apocalypse",
    blurb: "The war is over. The galaxy is ash. Subjugate what remains through overwhelming force.",
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
      alienArtifacts: true
    }
  }
};
function listGameTypes() {
  return Object.keys(GAME_TYPE_META).map((id) => {
    const meta = GAME_TYPE_META[id];
    return {
      id,
      name: meta.name,
      blurb: meta.blurb,
      victory: meta.options.victory,
      victoryLabel: VICTORY_LABEL[meta.options.victory],
      playerRange: meta.options.playerRange,
      fogOfWar: meta.options.fogOfWar,
      uncharted: meta.options.uncharted,
      turnLimit: meta.options.turnLimit,
      disableCommunications: meta.options.disableCommunications,
      scorchedEarth: meta.options.scorchedEarth
    };
  });
}
function optionsForType(type, playerCount) {
  const meta = type === "custom" ? GAME_TYPE_META.standard : GAME_TYPE_META[type];
  const [lo] = PLAYER_RANGE_BOUNDS[meta.options.playerRange];
  return {
    gameType: type,
    playerCount: playerCount ?? lo,
    ...meta.options
  };
}

// src/lib/game/rng.ts
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  h = Math.imul(h ^ h >>> 16, 2246822507);
  h = Math.imul(h ^ h >>> 13, 3266489909);
  return (h ^= h >>> 16) >>> 0;
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function makeRng(seed, salt = 0) {
  const n = typeof seed === "number" ? seed : xmur3(seed);
  return mulberry32((n ^ salt) >>> 0);
}
function randInt(rng, min, maxExclusive) {
  return Math.floor(rng() * (maxExclusive - min)) + min;
}
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
function shuffle(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// src/lib/game/civs.ts
var PLAYER_PALETTES = [
  ["#8f2d2a", "#e8e6df", "#3a1210"],
  ["#2a6b78", "#d5efe8", "#0d2a30"],
  ["#3d5a2c", "#dfe8c8", "#1a2612"],
  ["#6b4a1f", "#f0e2c4", "#2c1c0a"],
  ["#3c3f6b", "#cfd3ee", "#151628"],
  ["#6b2f4a", "#f0d4e0", "#2a121c"],
  ["#2f4a4a", "#d4ece8", "#102020"],
  ["#5a3d2c", "#ead7c4", "#24180f"],
  ["#4a4a52", "#e8e6df", "#1a1a1e"],
  ["#1f4a6b", "#cfe4f0", "#0a1c2c"]
];
var PRESETS = [
  {
    name: "Terran Directorate",
    useThe: true,
    racialName: "humans",
    rulerTitle: "Director",
    attitude: "neutral",
    diplomat: "envoy",
    flag: flagOf(["#8f2d2a", "#e8e6df", "#3a1210"], "bar", "star")
  },
  {
    name: "Helion Concord",
    useThe: true,
    racialName: "helions",
    rulerTitle: "First Speaker",
    attitude: "polite",
    diplomat: "choir",
    flag: flagOf(["#2a6b78", "#d5efe8", "#0d2a30"], "ring", "disc")
  },
  {
    name: "Kryth Collective",
    useThe: true,
    racialName: "kryth",
    rulerTitle: "Prime Node",
    attitude: "aggressive",
    diplomat: "console",
    flag: flagOf(["#3d5a2c", "#dfe8c8", "#1a2612"], "hex", "slash")
  },
  {
    name: "Vesper Hegemony",
    useThe: true,
    racialName: "vesperi",
    rulerTitle: "Hegemon",
    attitude: "belligerent",
    diplomat: "mask",
    flag: flagOf(["#6b4a1f", "#f0e2c4", "#2c1c0a"], "chevron", "diamond")
  },
  {
    name: "Ashen Choir",
    useThe: true,
    racialName: "ashborn",
    rulerTitle: "Cantor",
    attitude: "apologetic",
    diplomat: "oracle",
    flag: flagOf(["#4a4a52", "#e8e6df", "#1a1a1e"], "crescent", "ring")
  },
  {
    name: "Orion Compact",
    useThe: true,
    racialName: "orioni",
    rulerTitle: "Marshal",
    attitude: "aggressive",
    diplomat: "captain",
    flag: flagOf(["#1f4a6b", "#cfe4f0", "#0a1c2c"], "cross", "star")
  },
  {
    name: "Nadir Syndicate",
    useThe: true,
    racialName: "nadiri",
    rulerTitle: "Chair",
    attitude: "neutral",
    diplomat: "console",
    flag: flagOf(["#6b2f4a", "#f0d4e0", "#2a121c"], "slash", "bar")
  },
  {
    name: "Palladium Seat",
    useThe: true,
    racialName: "palladians",
    rulerTitle: "Regent",
    attitude: "polite",
    diplomat: "envoy",
    flag: flagOf(["#5a3d2c", "#ead7c4", "#24180f"], "diamond", "cross")
  }
];
function flagOf(colors, shapeA, shapeB) {
  return {
    colors,
    shapeA,
    shapeB,
    scaleA: 1,
    scaleB: 0.72,
    offsetA: { x: 0, y: 0 },
    offsetB: { x: 0, y: 0 }
  };
}
function presetCivs() {
  return PRESETS.map((c, i) => ({ ...c, id: `preset-${i}` }));
}
function civTheName(civ) {
  return civ.useThe ? `the ${civ.name}` : civ.name;
}
var seq = 0;
function uid(prefix = "id") {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
function randomCiv(seed, index) {
  const rng = makeRng(seed, 2654435769 + index * 17);
  const base = PRESETS[index % PRESETS.length];
  const palette = PLAYER_PALETTES[index % PLAYER_PALETTES.length];
  return {
    ...base,
    id: uid("civ"),
    flag: {
      ...base.flag,
      colors: palette,
      shapeA: pick(rng, FLAG_SHAPES),
      shapeB: pick(rng, FLAG_SHAPES)
    }
  };
}

// src/lib/game/types.ts
var ZERO = { tech: 0, metals: 0, chon: 0 };
function addRes(a, b) {
  return {
    tech: a.tech + b.tech,
    metals: a.metals + b.metals,
    chon: a.chon + b.chon
  };
}
function subRes(a, b) {
  return {
    tech: a.tech - b.tech,
    metals: a.metals - b.metals,
    chon: a.chon - b.chon
  };
}
function canAfford(have, cost) {
  return have.tech >= cost.tech && have.metals >= cost.metals && have.chon >= cost.chon;
}
function resSum(r) {
  return r.tech + r.metals + r.chon;
}
function cloneRes(r) {
  return { tech: r.tech, metals: r.metals, chon: r.chon };
}
function resEqual(a, b) {
  return a.tech === b.tech && a.metals === b.metals && a.chon === b.chon;
}

// src/lib/game/names.ts
var PREFIX = [
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
  "Zephyr"
];
var SUFFIX = [
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
  "Weald"
];
var GREEK = [
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
  "Omega"
];
function generateSystemNames(rng, count) {
  const used = /* @__PURE__ */ new Set();
  const names = [];
  let guard = 0;
  while (names.length < count && guard < count * 20) {
    guard++;
    const style = rng();
    let name;
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

// src/lib/game/mapgen.ts
var MAP = 1e3;
var CORE_R = MAP / 4;
var HOME_R = 150;
var NEAR_R = 250;
var MIN_DIST = 52;
var RING_R = MAP / 3;
function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
function addEdge(a, b) {
  if (a.id === b.id) return;
  if (!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
  if (!b.neighbors.includes(a.id)) b.neighbors.push(a.id);
}
function connectedCount(systems) {
  if (systems.length === 0) return 0;
  const seen = /* @__PURE__ */ new Set();
  const q = [systems[0].id];
  seen.add(q[0]);
  const byId = new Map(systems.map((s) => [s.id, s]));
  while (q.length) {
    const id = q.shift();
    for (const n of byId.get(id)?.neighbors ?? []) {
      if (seen.has(n)) continue;
      seen.add(n);
      q.push(n);
    }
  }
  return seen.size;
}
function weightedResource(rng, profile) {
  const weights = RESOURCE_WEIGHTS[profile];
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return { ...RESOURCE_TABLE[i] };
  }
  return { ...RESOURCE_TABLE[0] };
}
function minWormholes(s) {
  if (s.kind === "home") return 4;
  if (s.kind === "core") return 4;
  return 3;
}
function maxWormholes(s) {
  if (s.kind === "home") return 4;
  return 5;
}
function enemyHomes(a, b) {
  return a.kind === "home" && b.kind === "home" && !!a.originalHomePlayerId && a.originalHomePlayerId !== b.originalHomePlayerId;
}
function canLink(a, b) {
  if (a.id === b.id) return false;
  if (a.neighbors.includes(b.id)) return false;
  if (enemyHomes(a, b)) return false;
  if (a.neighbors.length >= maxWormholes(a)) return false;
  if (b.neighbors.length >= maxWormholes(b)) return false;
  if (a.kind === "home" && b.kind === "near" && a.homeGroupId !== b.homeGroupId) return false;
  if (b.kind === "home" && a.kind === "near" && a.homeGroupId !== b.homeGroupId) return false;
  return true;
}
function tryPlace(rng, existing, origin, minR, maxR, attempts) {
  for (let t = 0; t < attempts; t++) {
    const ang = rng() * Math.PI * 2;
    const r = minR + Math.sqrt(rng()) * (maxR - minR);
    const p = { x: origin.x + Math.cos(ang) * r, y: origin.y + Math.sin(ang) * r };
    if (p.x < 40 || p.x > MAP - 40 || p.y < 40 || p.y > MAP - 40) continue;
    if (existing.every((o) => dist2(p, o) >= MIN_DIST * MIN_DIST)) return p;
  }
  return null;
}
function makeSystem(args) {
  return {
    id: uid("sys"),
    name: args.name,
    x: args.x,
    y: args.y,
    neighbors: [],
    ownerId: args.ownerId,
    isHome: args.kind === "home",
    originalHomePlayerId: args.kind === "home" ? args.ownerId ?? void 0 : void 0,
    homeGroupId: args.homeGroupId,
    kind: args.kind,
    base: args.base,
    alienArtifact: false,
    upgrades: args.upgrades,
    fleets: []
  };
}
function nearestLegal(from, systems, pred) {
  let best = null;
  let bestD = Infinity;
  for (const s of systems) {
    if (!pred(s) || !canLink(from, s)) continue;
    const d = dist2(from, s);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}
function assignBalancedResources(rng, systems, players, profile) {
  const near = systems.filter((s) => s.kind === "near");
  const core = systems.filter((s) => s.kind === "core");
  const unowned = [...near, ...core];
  const bag = unowned.map(() => weightedResource(rng, profile));
  const perPlayer = players.map((p) => near.filter((s) => s.homeGroupId === p.id));
  const nEach = perPlayer[0]?.length ?? 0;
  const sum = bag.reduce(
    (a, r) => ({ tech: a.tech + r.tech, metals: a.metals + r.metals, chon: a.chon + r.chon }),
    { tech: 0, metals: 0, chon: 0 }
  );
  const avg = {
    tech: nEach === 0 ? 0 : Math.round(sum.tech / Math.max(1, unowned.length) * nEach),
    metals: nEach === 0 ? 0 : Math.round(sum.metals / Math.max(1, unowned.length) * nEach),
    chon: nEach === 0 ? 0 : Math.round(sum.chon / Math.max(1, unowned.length) * nEach)
  };
  let assigned = null;
  for (let attempt = 0; attempt < 80 && nEach > 0; attempt++) {
    const pool = shuffle(rng, bag.slice());
    const map = /* @__PURE__ */ new Map();
    let ok2 = true;
    for (const group of perPlayer) {
      let t = 0, m = 0, c = 0;
      for (let i = 0; i < group.length; i++) {
        const last = i === group.length - 1;
        let pickI = -1;
        for (let k = 0; k < pool.length; k++) {
          const r2 = pool[k];
          const nt = t + r2.tech, nm = m + r2.metals, nc = c + r2.chon;
          if (last) {
            if (nt === avg.tech && nm === avg.metals && nc === avg.chon) {
              pickI = k;
              break;
            }
          } else if (nt <= avg.tech && nm <= avg.metals && nc <= avg.chon) {
            pickI = k;
            break;
          }
        }
        if (pickI < 0) {
          ok2 = false;
          break;
        }
        const r = pool.splice(pickI, 1)[0];
        t += r.tech;
        m += r.metals;
        c += r.chon;
        map.set(group[i].id, r);
      }
      if (!ok2) break;
    }
    if (ok2) {
      assigned = map;
      for (const s of core) {
        assigned.set(s.id, pool.shift() ?? { tech: 0, metals: 0, chon: 0 });
      }
      break;
    }
  }
  if (!assigned) {
    const pool = shuffle(rng, bag.slice());
    assigned = /* @__PURE__ */ new Map();
    for (const s of unowned) assigned.set(s.id, pool.shift() ?? { tech: 0, metals: 0, chon: 0 });
  }
  for (const s of unowned) s.base = assigned.get(s.id) ?? { tech: 0, metals: 0, chon: 0 };
}
function wireWormholes(systems, players) {
  const byId = new Map(systems.map((s) => [s.id, s]));
  for (const p of players) {
    const homes = systems.filter((s) => s.kind === "home" && s.originalHomePlayerId === p.id);
    for (let i = 0; i < homes.length; i++) {
      for (let j = i + 1; j < homes.length; j++) addEdge(homes[i], homes[j]);
    }
  }
  const usedNear = /* @__PURE__ */ new Set();
  const usedCore = /* @__PURE__ */ new Set();
  for (const p of players) {
    const nears = systems.filter((s) => s.kind === "near" && s.homeGroupId === p.id);
    const cores = systems.filter((s) => s.kind === "core");
    let bestN = null;
    let bestC = null;
    let bestD = Infinity;
    for (const n of nears) {
      if (usedNear.has(n.id) || n.neighbors.length) continue;
      for (const c of cores) {
        if (usedCore.has(c.id) || c.neighbors.length) continue;
        const d = dist2(n, c);
        if (d < bestD) {
          bestD = d;
          bestN = n;
          bestC = c;
        }
      }
    }
    if (bestN && bestC) {
      addEdge(bestN, bestC);
      usedNear.add(bestN.id);
      usedCore.add(bestC.id);
      const home = nearestLegal(
        bestN,
        systems,
        (s) => s.kind === "home" && s.originalHomePlayerId === p.id
      );
      if (home) addEdge(bestN, home);
    }
  }
  for (let i = 0; i < players.length; i++) {
    const a = players[i];
    const b = players[(i + 1) % players.length];
    const nearsA = systems.filter((s) => s.kind === "near" && s.homeGroupId === a.id);
    const nearsB = systems.filter((s) => s.kind === "near" && s.homeGroupId === b.id);
    let bestA = null;
    let bestB = null;
    let bestD = Infinity;
    for (const na of nearsA) {
      for (const nb of nearsB) {
        if (!canLink(na, nb)) continue;
        const d = dist2(na, nb);
        if (d < bestD) {
          bestD = d;
          bestA = na;
          bestB = nb;
        }
      }
    }
    if (bestA && bestB) {
      addEdge(bestA, bestB);
      const ha = nearestLegal(
        bestA,
        systems,
        (s) => s.kind === "home" && s.originalHomePlayerId === a.id
      );
      const hb = nearestLegal(
        bestB,
        systems,
        (s) => s.kind === "home" && s.originalHomePlayerId === b.id
      );
      if (ha) addEdge(bestA, ha);
      if (hb) addEdge(bestB, hb);
    }
  }
  let progressed = true;
  let guard = 0;
  while (progressed && guard++ < 40) {
    progressed = false;
    for (const c of systems.filter((s) => s.kind === "core")) {
      if (c.neighbors.length >= minWormholes(c)) continue;
      const n = nearestLegal(c, systems, (s) => s.kind === "core");
      if (n) {
        addEdge(c, n);
        progressed = true;
      }
    }
  }
  progressed = true;
  guard = 0;
  while (progressed && guard++ < 80) {
    progressed = false;
    for (const s of systems) {
      if (s.neighbors.length >= minWormholes(s)) continue;
      const n = nearestLegal(s, systems, () => true);
      if (n) {
        addEdge(s, n);
        progressed = true;
      }
    }
  }
  guard = 0;
  while (connectedCount(systems) < systems.length && guard++ < 80) {
    const seen = /* @__PURE__ */ new Set();
    const q = [systems[0].id];
    seen.add(q[0]);
    while (q.length) {
      const id = q.shift();
      for (const n of byId.get(id)?.neighbors ?? []) {
        if (seen.has(n)) continue;
        seen.add(n);
        q.push(n);
      }
    }
    const inside = systems.filter((s) => seen.has(s.id));
    const outside = systems.filter((s) => !seen.has(s.id));
    let bestA = null;
    let bestB = null;
    let best = Infinity;
    for (const a of inside) {
      for (const b of outside) {
        if (enemyHomes(a, b)) continue;
        const d = dist2(a, b);
        if (d < best) {
          best = d;
          bestA = a;
          bestB = b;
        }
      }
    }
    if (bestA && bestB) addEdge(bestA, bestB);
    else break;
  }
  for (const s of systems) {
    if (s.kind === "home") continue;
    while (s.neighbors.length < 3) {
      const n = nearestLegal(s, systems, (o) => !s.neighbors.includes(o.id));
      if (!n) break;
      addEdge(s, n);
    }
  }
}
function initLayout(rng, options, players, names) {
  const nPlayers = players.length;
  const total = SYSTEMS_PER_PLAYER[options.systemDensity] * nPlayers + 1;
  const homesEach = HOMES_PER_PLAYER[options.homeDensity];
  const homeSpec = HOME_DEV[options.homeDev];
  const systems = [];
  const existing = [];
  const cx = MAP / 2;
  const cy = MAP / 2;
  const spin = rng() * Math.PI * 0.5;
  const centers = players.map((_, i) => {
    const a = Math.PI * 2 * i / nPlayers - Math.PI / 2 + spin;
    return { x: cx + Math.cos(a) * RING_R, y: cy + Math.sin(a) * RING_R };
  });
  for (let p = 0; p < nPlayers; p++) {
    const origin = centers[p];
    for (let h = 0; h < homesEach; h++) {
      const pt = tryPlace(rng, existing, origin, 0, HOME_R, 90);
      if (!pt) return null;
      existing.push(pt);
      systems.push(
        makeSystem({
          name: names[systems.length],
          x: pt.x,
          y: pt.y,
          kind: "home",
          ownerId: players[p].id,
          homeGroupId: players[p].id,
          base: { ...homeSpec.prod },
          upgrades: [...homeSpec.upgrades]
        })
      );
    }
  }
  const remaining = total - systems.length;
  let nearEach = Math.max(0, Math.floor((remaining - Math.round(remaining * 0.25)) / nPlayers));
  let coreCount = remaining - nearEach * nPlayers;
  if (coreCount < 1 && remaining > 0) {
    coreCount = 1;
    nearEach = Math.floor((remaining - 1) / nPlayers);
    coreCount = remaining - nearEach * nPlayers;
  }
  for (let i = 0; i < coreCount; i++) {
    const pt = tryPlace(rng, existing, { x: cx, y: cy }, 0, CORE_R, 90);
    if (!pt) return null;
    existing.push(pt);
    systems.push(
      makeSystem({
        name: names[systems.length] ?? `Core ${i}`,
        x: pt.x,
        y: pt.y,
        kind: "core",
        ownerId: null,
        base: ZERO,
        upgrades: []
      })
    );
  }
  for (let p = 0; p < nPlayers; p++) {
    const origin = centers[p];
    for (let i = 0; i < nearEach; i++) {
      const pt = tryPlace(rng, existing, origin, HOME_R, NEAR_R, 90);
      if (!pt) return null;
      existing.push(pt);
      systems.push(
        makeSystem({
          name: names[systems.length] ?? `Belt ${p}-${i}`,
          x: pt.x,
          y: pt.y,
          kind: "near",
          ownerId: null,
          homeGroupId: players[p].id,
          base: ZERO,
          upgrades: []
        })
      );
    }
  }
  if (systems.length !== total) return null;
  return systems;
}
function generateMap(options, players, seed) {
  const rng = makeRng(seed, 20973);
  const nPlayers = players.length;
  const total = SYSTEMS_PER_PLAYER[options.systemDensity] * nPlayers + 1;
  const names = generateSystemNames(rng, total + 8);
  let systems = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const child = makeRng(`${seed}:${attempt}`, 20973);
    systems = initLayout(child, options, players, names);
    if (systems) break;
  }
  if (!systems) {
    systems = initLayout(rng, options, players, names) ?? [];
  }
  assignBalancedResources(rng, systems, players, options.systemResources);
  if (options.alienArtifacts) {
    const unowned = systems.filter((s) => !s.isHome);
    const n = Math.max(1, Math.round(unowned.length * 0.1));
    for (const s of shuffle(rng, unowned).slice(0, n)) s.alienArtifact = true;
  }
  wireWormholes(systems, players);
  return { systems };
}
function spawnStartingFleets(systems, players, options) {
  const n = HOME_DEV[options.homeDev].fleets;
  for (const p of players) {
    for (const s of systems.filter((x) => x.originalHomePlayerId === p.id)) {
      for (let i = 0; i < n; i++) {
        s.fleets.push({
          id: uid("flt"),
          ownerId: p.id,
          systemId: s.id,
          order: { kind: "hold" },
          rallySystemId: null
        });
      }
    }
  }
}
function productionOf(s, sabotage) {
  const r = { ...s.base };
  if (s.alienArtifact) r.tech += 1;
  const colonyDown = sabotage === "colony";
  const mineDown = sabotage === "mining";
  if (s.upgrades.includes("colony") && !colonyDown) r.tech += 1;
  if (s.upgrades.includes("mining") && !mineDown) {
    r.metals += 1;
    r.chon += 1;
  }
  return r;
}
function fleetCount(systems, playerId) {
  let n = 0;
  for (const s of systems) n += s.fleets.filter((f) => f.ownerId === playerId).length;
  return n;
}
function randomSeed() {
  const adj = [
    "silent",
    "hollow",
    "iron",
    "pale",
    "veiled",
    "crimson",
    "ashen",
    "distant",
    "broken",
    "gilded"
  ];
  const noun = [
    "meridian",
    "canticle",
    "lattice",
    "oratorio",
    "threshold",
    "reliquary",
    "wake",
    "verdict",
    "compact",
    "survey"
  ];
  const rng = makeRng(String(Date.now()), randInt(() => Math.random(), 1, 1e9));
  return `${pick(rng, adj)}-${pick(rng, noun)}-${randInt(rng, 10, 99)}`;
}

// src/lib/game/graph.ts
function sysById(state, id) {
  const s = state.systems.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown system ${id}`);
  return s;
}
function adjMap(systems) {
  const m = /* @__PURE__ */ new Map();
  for (const s of systems) m.set(s.id, s.neighbors.slice());
  return m;
}
function distances(systems, start, passable) {
  const dist = /* @__PURE__ */ new Map();
  if (!passable(start)) return dist;
  dist.set(start, 0);
  const q = [start];
  const adj = adjMap(systems);
  while (q.length) {
    const id = q.shift();
    const d = dist.get(id);
    for (const n of adj.get(id) ?? []) {
      if (dist.has(n) || !passable(n)) continue;
      dist.set(n, d + 1);
      q.push(n);
    }
  }
  return dist;
}
function shortestPath(systems, start, goal, passable) {
  if (start === goal) return [start];
  const prev = /* @__PURE__ */ new Map();
  const q = [start];
  const seen = /* @__PURE__ */ new Set([start]);
  const adj = adjMap(systems);
  while (q.length) {
    const id = q.shift();
    for (const n of adj.get(id) ?? []) {
      if (seen.has(n) || !passable(n)) continue;
      seen.add(n);
      prev.set(n, id);
      if (n === goal) {
        const path = [n];
        let cur = n;
        while (cur !== start) {
          cur = prev.get(cur);
          path.push(cur);
        }
        path.reverse();
        return path;
      }
      q.push(n);
    }
  }
  return null;
}
function hopsAway(systems, start, maxHops) {
  const out = /* @__PURE__ */ new Set();
  const dist = distances(systems, start, () => true);
  for (const [id, d] of dist) {
    if (d > 0 && d <= maxHops) out.add(id);
  }
  return out;
}
function isAdjacent(a, bId) {
  return a.neighbors.includes(bId);
}
function supplyDistance(systems, systemId, ownerId, sabotagedStarports) {
  const owned2 = (id) => systems.find((s) => s.id === id)?.ownerId === ownerId;
  const ports = systems.filter(
    (s) => s.ownerId === ownerId && s.upgrades.includes("starport") && !sabotagedStarports.has(s.id)
  );
  if (ports.length === 0) {
    return { distToPort: Infinity, portId: null, portToHome: Infinity };
  }
  const fromSys = distances(systems, systemId, owned2);
  let bestPort = null;
  let bestD = Infinity;
  for (const p of ports) {
    const d = fromSys.get(p.id);
    if (d !== void 0 && d < bestD) {
      bestD = d;
      bestPort = p;
    }
  }
  if (!bestPort) {
    return { distToPort: Infinity, portId: null, portToHome: Infinity };
  }
  const homes = systems.filter(
    (s) => s.isHome && s.originalHomePlayerId === ownerId
  );
  let homeD = Infinity;
  const fromPort = distances(systems, bestPort.id, owned2);
  for (const h of homes) {
    const d = fromPort.get(h.id);
    if (d !== void 0 && d < homeD) homeD = d;
  }
  if (!Number.isFinite(homeD)) {
    const ownedHomes = systems.filter((s) => s.isHome && s.ownerId === ownerId);
    for (const h of ownedHomes) {
      const d = fromPort.get(h.id);
      if (d !== void 0 && d < homeD) homeD = d;
    }
  }
  return { distToPort: bestD, portId: bestPort.id, portToHome: homeD };
}
function isSupplied(systems, systemId, ownerId, sabotagedStarports) {
  return Number.isFinite(
    supplyDistance(systems, systemId, ownerId, sabotagedStarports).distToPort
  );
}

// src/lib/game/victory.ts
function playerSystemCount(state, playerId) {
  return state.systems.filter((s) => s.ownerId === playerId).length;
}
function playerHomeCount(state, playerId) {
  return state.systems.filter(
    (s) => s.isHome && s.ownerId === playerId
  ).length;
}
function playerStarportCount(state, playerId) {
  return state.systems.filter(
    (s) => s.ownerId === playerId && s.upgrades.includes("starport")
  ).length;
}
function playerCorporateCount(state, playerId) {
  return state.systems.filter(
    (s) => s.ownerId === playerId && s.upgrades.includes("starport") && s.upgrades.includes("mining")
  ).length;
}
function playerFleetCount(state, playerId) {
  let n = 0;
  for (const s of state.systems) {
    n += s.fleets.filter((f) => f.ownerId === playerId).length;
  }
  return n;
}
function leaders(state, score) {
  const active = state.players.filter((p) => !p.collapsed);
  let best = -Infinity;
  const ids = [];
  for (const p of active) {
    const v = score(p.id);
    if (v > best) {
      best = v;
      ids.length = 0;
      ids.push(p.id);
    } else if (v === best) {
      ids.push(p.id);
    }
  }
  return { ids, value: best };
}
function evaluateVictory(state, atEndOfGame) {
  const kind = state.options.victory;
  const total = state.systems.length;
  const totalHomes = state.systems.filter((s) => s.isHome).length;
  const active = state.players.filter((p) => !p.collapsed);
  if (kind === "standard") {
    for (const p of active) {
      if (playerSystemCount(state, p.id) > total / 2) {
        return {
          winnerIds: [p.id],
          kind: "win",
          reason: `${p.civ.name} controls more than half the galaxy.`
        };
      }
    }
    if (atEndOfGame) {
      const L = leaders(state, (id) => playerSystemCount(state, id));
      return {
        winnerIds: L.ids,
        kind: L.ids.length > 1 ? "tie" : "win",
        reason: L.ids.length > 1 ? "Turn limit reached. Several powers share the largest dominion." : "Turn limit reached. Largest dominion stands."
      };
    }
  }
  if (kind === "galacticDomination") {
    const withSystems = active.filter((p) => playerSystemCount(state, p.id) > 0);
    if (withSystems.length === 2) {
      const a = playerSystemCount(state, withSystems[0].id);
      const b = playerSystemCount(state, withSystems[1].id);
      const maxShare = Math.max(a, b) / total;
      if (maxShare <= 0.6) {
        return {
          winnerIds: withSystems.map((p) => p.id),
          kind: "tie",
          reason: "Only two civilizations remain, and neither holds a decisive majority."
        };
      }
    }
    for (const p of active) {
      const homes = playerHomeCount(state, p.id);
      const homeShare = totalHomes === 0 ? 0 : homes / totalHomes;
      const rivalTooBig = active.some(
        (o) => o.id !== p.id && totalHomes > 0 && playerHomeCount(state, o.id) / totalHomes > 0.3
      );
      if (homeShare > 0.5 && !rivalTooBig) {
        return {
          winnerIds: [p.id],
          kind: "win",
          reason: `${p.civ.name} dominates the home systems of the galaxy.`
        };
      }
    }
    if (atEndOfGame) {
      const over50 = active.filter(
        (p) => totalHomes > 0 && playerHomeCount(state, p.id) / totalHomes > 0.5
      );
      if (over50.length === 1) {
        return {
          winnerIds: [over50[0].id],
          kind: "win",
          reason: "End of game: majority of home systems."
        };
      }
      const over30 = active.filter(
        (p) => total > 0 && playerSystemCount(state, p.id) / total > 0.3
      );
      if (over30.length > 1) {
        return {
          winnerIds: over30.map((p) => p.id),
          kind: "tie",
          reason: "End of game: several powers exceed 30% of systems."
        };
      }
      const L = leaders(state, (id) => playerHomeCount(state, id));
      return {
        winnerIds: L.ids,
        kind: L.ids.length > 1 ? "tie" : "win",
        reason: "End of game: most home systems."
      };
    }
  }
  if (kind === "lastStanding") {
    const withPorts = active.filter((p) => playerStarportCount(state, p.id) > 0);
    if (withPorts.length === 1) {
      return {
        winnerIds: [withPorts[0].id],
        kind: "win",
        reason: `${withPorts[0].civ.name} is the last civilization with a starport.`
      };
    }
    if (atEndOfGame) {
      const L = leaders(state, (id) => playerStarportCount(state, id));
      return {
        winnerIds: L.ids,
        kind: L.ids.length > 1 ? "tie" : "win",
        reason: "End of game: most starports."
      };
    }
  }
  if (kind === "corporate") {
    for (const p of active) {
      if (playerCorporateCount(state, p.id) > total * 0.3) {
        return {
          winnerIds: [p.id],
          kind: "win",
          reason: `${p.civ.name} has locked the sector's industrial spine.`
        };
      }
    }
    if (atEndOfGame) {
      const L = leaders(state, (id) => playerCorporateCount(state, id));
      return {
        winnerIds: L.ids,
        kind: L.ids.length > 1 ? "tie" : "win",
        reason: "End of game: most starport-and-mining systems."
      };
    }
  }
  if (kind === "gunship") {
    for (const p of active) {
      if (playerFleetCount(state, p.id) >= total) {
        return {
          winnerIds: [p.id],
          kind: "win",
          reason: `${p.civ.name} fields a starfleet for every system in the sector.`
        };
      }
    }
    if (atEndOfGame) {
      const L = leaders(state, (id) => playerFleetCount(state, id));
      return {
        winnerIds: L.ids,
        kind: L.ids.length > 1 ? "tie" : "win",
        reason: "End of game: largest navy."
      };
    }
  }
  return { winnerIds: [], kind: null, reason: "" };
}

// src/lib/game/alliance.ts
function pair(a, b) {
  return a < b ? [a, b] : [b, a];
}
function civName(state, id) {
  const p = state.players.find((x) => x.id === id);
  return p ? civTheName(p.civ) : "an unknown power";
}
function sysName(state, id) {
  if (!id) return "the designated system";
  return state.systems.find((s) => s.id === id)?.name ?? "the designated system";
}
function formatGoods(r) {
  if (!r) return "nothing";
  const bits = [];
  if (r.tech) bits.push(`${r.tech} Tech`);
  if (r.metals) bits.push(`${r.metals} Metals`);
  if (r.chon) bits.push(`${r.chon} CHON`);
  return bits.length ? bits.join(", ") : "nothing";
}
function goodsNonzero(r) {
  return !!r && resSum(r) > 0;
}
function areAllied(state, a, b) {
  if (a === b) return false;
  const [x, y] = pair(a, b);
  return (state.alliances ?? []).some((al) => al.a === x && al.b === y);
}
function alliesOf(state, playerId) {
  return (state.alliances ?? []).filter((al) => al.a === playerId || al.b === playerId).map((al) => al.a === playerId ? al.b : al.a);
}
function formAlliance(state, aId, bId) {
  if (aId === bId || areAllied(state, aId, bId)) return false;
  const [a, b] = pair(aId, bId);
  if (!state.alliances) state.alliances = [];
  state.alliances.push({ a, b, formedTurn: state.turn });
  return true;
}
function breakAlliance(state, aId, bId) {
  if (!areAllied(state, aId, bId)) return false;
  const [a, b] = pair(aId, bId);
  state.alliances = (state.alliances ?? []).filter((al) => !(al.a === a && al.b === b));
  return true;
}
function sealPact(state, args) {
  if (!state.pacts) state.pacts = [];
  const pact = {
    id: uid("pct"),
    sealedTurn: state.turn,
    messageId: args.messageId,
    threadId: args.threadId,
    aId: args.aId,
    bId: args.bId,
    give: cloneRes(args.give ?? ZERO),
    giveSystemId: args.giveSystemId,
    request: cloneRes(args.request ?? ZERO),
    requestSystemId: args.requestSystemId,
    allianceClause: args.allianceClause
  };
  state.pacts.push(pact);
  return pact;
}
function pactHalf(pact, playerId) {
  if (playerId === pact.aId) {
    return { resources: pact.give, systemId: pact.giveSystemId, otherId: pact.bId };
  }
  if (playerId === pact.bId) {
    return { resources: pact.request, systemId: pact.requestSystemId, otherId: pact.aId };
  }
  return null;
}
function deliveryScheduled(state, playerId, systemId, resources) {
  if (!systemId || !goodsNonzero(resources)) return true;
  return state.trades.some(
    (t) => t.playerId === playerId && t.systemId === systemId && resEqual(t.resources, resources)
  );
}
function unsentPactsFor(state, playerId) {
  return (state.pacts ?? []).filter((p) => {
    if (p.evaluated) return false;
    if (p.sealedTurn !== state.turn) return false;
    const half = pactHalf(p, playerId);
    if (!half || !goodsNonzero(half.resources) || !half.systemId) return false;
    return !deliveryScheduled(state, playerId, half.systemId, half.resources);
  });
}
function openIncidentsFor(state, playerId) {
  return (state.allyIncidents ?? []).filter(
    (i) => i.victimId === playerId && i.status === "open"
  );
}
function scoreDelivery(trades, playerId, promised, destId) {
  if (!goodsNonzero(promised) || !destId) {
    return { result: "kept", detail: "No delivery was promised." };
  }
  const mine = trades.filter((t) => t.playerId === playerId);
  const exact = mine.find((t) => t.systemId === destId && resEqual(t.resources, promised));
  if (exact) {
    return {
      result: "kept",
      detail: `Sent ${formatGoods(promised)} to the named system.`
    };
  }
  const sameDest = mine.find((t) => t.systemId === destId && goodsNonzero(t.resources));
  if (sameDest) {
    return {
      result: "partial",
      detail: `Sent ${formatGoods(sameDest.resources)} instead of ${formatGoods(promised)} to the named system.`
    };
  }
  const sameGoods = mine.find((t) => resEqual(t.resources, promised));
  if (sameGoods) {
    return {
      result: "partial",
      detail: `Sent ${formatGoods(promised)}, but to a different system.`
    };
  }
  if (mine.length) {
    return {
      result: "partial",
      detail: `Sent ${formatGoods(mine[0].resources)} to a different system than promised.`
    };
  }
  return {
    result: "broken",
    detail: `Did not send the promised ${formatGoods(promised)}.`
  };
}
function evaluateDiplomacy(state, snapshot) {
  if (!state.pacts) state.pacts = [];
  if (!state.promiseReports) state.promiseReports = [];
  if (!state.allyIncidents) state.allyIncidents = [];
  if (!state.alliances) state.alliances = [];
  const reports = [];
  const turn = state.turn;
  for (const pact of state.pacts) {
    if (pact.evaluated || pact.sealedTurn !== turn) continue;
    pact.evaluated = true;
    for (const actorId of [pact.aId, pact.bId]) {
      const half = pactHalf(pact, actorId);
      if (!half) continue;
      if (!goodsNonzero(half.resources)) continue;
      const scored = scoreDelivery(snapshot.trades, actorId, half.resources, half.systemId);
      reports.push({
        id: uid("prm"),
        pactId: pact.id,
        actorId,
        otherId: half.otherId,
        result: scored.result,
        detail: scored.detail,
        extras: [],
        kind: "delivery"
      });
    }
    if (pact.allianceClause === "form") {
      const holds = areAllied(state, pact.aId, pact.bId);
      reports.push({
        id: uid("prm"),
        pactId: pact.id,
        actorId: pact.aId,
        otherId: pact.bId,
        result: holds ? "kept" : "broken",
        detail: holds ? "Mutual alliance remains in force." : "The promised alliance is not in force \u2014 it was denounced after being sealed, or never formed.",
        extras: [],
        kind: "alliance"
      });
    } else if (pact.allianceClause === "break") {
      const holds = areAllied(state, pact.aId, pact.bId);
      reports.push({
        id: uid("prm"),
        pactId: pact.id,
        actorId: pact.aId,
        otherId: pact.bId,
        result: holds ? "broken" : "kept",
        detail: holds ? "The alliance was not dissolved as agreed." : "The alliance was dissolved as agreed.",
        extras: [],
        kind: "alliance"
      });
    }
  }
  const seenIncident = /* @__PURE__ */ new Set();
  const pushIncident = (actorId, victimId, kind, systemId, text) => {
    if (!areAllied(state, actorId, victimId)) return;
    const key = `${actorId}|${victimId}|${kind}|${systemId ?? ""}`;
    if (seenIncident.has(key)) return;
    seenIncident.add(key);
    state.allyIncidents.push({
      id: uid("inc"),
      turn,
      actorId,
      victimId,
      kind,
      systemId,
      text,
      status: "open"
    });
    const related = reports.filter(
      (r) => r.actorId === actorId && r.otherId === victimId || r.actorId === victimId && r.otherId === actorId
    );
    if (related.length) {
      for (const r of related) {
        if (r.actorId !== actorId) continue;
        r.extras = r.extras ?? [];
        if (!r.extras.includes(text)) r.extras.push(text);
      }
      const actorReports = related.filter((r) => r.actorId === actorId);
      if (actorReports.length === 0) {
        reports.push({
          id: uid("prm"),
          pactId: related[0].pactId,
          actorId,
          otherId: victimId,
          result: "broken",
          detail: text,
          extras: [],
          kind: "hostility"
        });
      }
    } else {
      reports.push({
        id: uid("prm"),
        pactId: "",
        actorId,
        otherId: victimId,
        result: "broken",
        detail: text,
        extras: [],
        kind: "hostility"
      });
    }
  };
  for (const mv of snapshot.moves) {
    const owner = snapshot.owners.get(mv.destId) ?? null;
    if (owner && owner !== mv.ownerId) {
      const dest = sysName(state, mv.destId);
      pushIncident(
        mv.ownerId,
        owner,
        "attack",
        mv.destId,
        `${civName(state, mv.ownerId)} ordered starfleets into ${dest}.`
      );
    }
  }
  for (const e of snapshot.espionage) {
    if (e.kind !== "sabotage" && e.kind !== "destabilize") continue;
    if (!e.systemId) continue;
    const owner = snapshot.owners.get(e.systemId) ?? null;
    if (owner && owner !== e.playerId) {
      pushIncident(
        e.playerId,
        owner,
        "espionage",
        e.systemId,
        `${civName(state, e.playerId)} ordered ${e.kind} at ${sysName(state, e.systemId)}.`
      );
    }
  }
  for (const s of state.systems) {
    const prev = snapshot.owners.get(s.id) ?? null;
    if (prev && s.ownerId && s.ownerId !== prev) {
      pushIncident(
        s.ownerId,
        prev,
        "occupy",
        s.id,
        `${civName(state, s.ownerId)} took ${s.name} from ${civName(state, prev)}.`
      );
    }
  }
  state.promiseReports = reports;
  for (const r of reports) {
    if (r.kind !== "hostility") continue;
    if (!state.log) state.log = [];
    state.log.push({
      id: uid("log"),
      severity: "alert",
      text: `${civName(state, r.actorId)} \u2014 ${r.detail}`,
      playerId: r.otherId
    });
  }
}

// src/lib/game/snapshot.ts
function slimPlayers(state) {
  return state.players.map((p) => ({
    id: p.id,
    name: p.name,
    civName: p.civ.name,
    colors: [...p.civ.flag.colors]
  }));
}
function captureSnapshot(state) {
  return {
    turn: state.turn,
    phase: state.phase,
    systems: state.systems.map((s) => {
      const counts = /* @__PURE__ */ new Map();
      for (const f of s.fleets) counts.set(f.ownerId, (counts.get(f.ownerId) ?? 0) + 1);
      return {
        id: s.id,
        name: s.name,
        x: s.x,
        y: s.y,
        ownerId: s.ownerId,
        isHome: s.isHome,
        upgrades: [...s.upgrades],
        neighbors: [...s.neighbors],
        fleets: [...counts.entries()].map(([ownerId, n]) => ({ ownerId, n }))
      };
    }),
    resources: Object.fromEntries(state.players.map((p) => [p.id, { ...p.resources }])),
    combat: state.log.filter((l) => l.severity === "combat").map((l) => ({ text: l.text, systemId: l.systemId })),
    players: slimPlayers(state)
  };
}
function pushSnapshot(state) {
  const frames = state.turnSnapshots ?? [];
  const next = [...frames, captureSnapshot(state)];
  state.turnSnapshots = next.length > 80 ? [next[0], ...next.slice(-79)] : next;
}

// src/lib/game/resolve.ts
function log(state, severity, text, extra) {
  state.log.push({
    id: uid("log"),
    severity,
    text,
    systemId: extra?.systemId,
    playerId: extra?.playerId
  });
}
function playerName(state, id) {
  return state.players.find((p) => p.id === id)?.civ.name ?? "Unknown";
}
function sysName2(state, id) {
  return state.systems.find((s) => s.id === id)?.name ?? id;
}
function allFleets(state) {
  return state.systems.flatMap((s) => s.fleets);
}
function moveFleet(state, fleet, destId) {
  const from = sysById(state, fleet.systemId);
  from.fleets = from.fleets.filter((f) => f.id !== fleet.id);
  fleet.systemId = destId;
  fleet.order = { kind: "hold" };
  sysById(state, destId).fleets.push(fleet);
}
function destroyFleet(state, fleet, reason) {
  const from = sysById(state, fleet.systemId);
  from.fleets = from.fleets.filter((f) => f.id !== fleet.id);
  log(state, "combat", reason, { systemId: fleet.systemId, playerId: fleet.ownerId });
}
function starportDefends(state, s) {
  if (!s.upgrades.includes("starport")) return false;
  if (state.activeSabotage[s.id] === "starport") return false;
  return true;
}
function isStarportSabotaged(state, id) {
  return state.activeSabotage[id] === "starport";
}
function sabotagedPorts(state) {
  const set = /* @__PURE__ */ new Set();
  for (const [id, t] of Object.entries(state.activeSabotage)) {
    if (t === "starport") set.add(id);
  }
  return set;
}
function defaultRally(state, fleet) {
  const sys2 = sysById(state, fleet.systemId);
  const owned2 = (id) => state.systems.find((s) => s.id === id)?.ownerId === fleet.ownerId;
  const ports = state.systems.filter(
    (s) => s.ownerId === fleet.ownerId && s.upgrades.includes("starport") && !isStarportSabotaged(state, s.id)
  );
  if (ports.length === 0) {
    const adjOwned = sys2.neighbors.filter((n) => owned2(n));
    return adjOwned[0] ?? null;
  }
  const candidates = [];
  for (const n of sys2.neighbors) {
    if (!owned2(n)) continue;
    let bestPort2 = Infinity;
    let bestHome = Infinity;
    for (const p of ports) {
      const path = shortestPath(state.systems, n, p.id, owned2);
      if (!path) continue;
      const d = path.length - 1;
      if (d < bestPort2) {
        bestPort2 = d;
        const sd = supplyDistance(
          state.systems,
          p.id,
          fleet.ownerId,
          sabotagedPorts(state)
        );
        bestHome = sd.portToHome;
      }
    }
    if (Number.isFinite(bestPort2)) {
      candidates.push({
        id: n,
        via: n,
        portDist: bestPort2,
        homeDist: bestHome
      });
    }
  }
  if (candidates.length === 0) return sys2.neighbors.find((n) => owned2(n)) ?? null;
  candidates.sort((a, b) => a.portDist - b.portDist || a.homeDist - b.homeDist);
  const bestPort = candidates[0].portDist;
  const tied = candidates.filter((c) => c.portDist === bestPort);
  tied.sort((a, b) => a.homeDist - b.homeDist);
  return tied[0].id;
}
function applyEspionage(state) {
  const rng = makeRng(state.seed, state.turn * 997);
  state.activeSabotage = {};
  state.destabilized = [];
  state.counterEspionage = [];
  const counters = state.espionage.filter((e) => e.kind === "counter");
  for (const c of counters) {
    if (c.systemId) state.counterEspionage.push(c.systemId);
  }
  const blocked = new Set(state.counterEspionage);
  for (const e of state.espionage) {
    if (e.kind === "sabotage" && e.systemId && e.targetUpgrade) {
      if (blocked.has(e.systemId)) {
        log(
          state,
          "intel",
          `Counter-espionage at ${sysName2(state, e.systemId)} foiled a sabotage attempt.`,
          { systemId: e.systemId }
        );
        continue;
      }
      state.activeSabotage[e.systemId] = e.targetUpgrade;
      state.sabotageUntilTurn[e.systemId] = state.turn + 1;
      const who = playerName(state, e.playerId);
      if (e.targetUpgrade === "fleets") {
        log(
          state,
          "intel",
          `${who} sabotaged starfleets at ${sysName2(state, e.systemId)}. Movement orders there are ignored.`,
          { systemId: e.systemId, playerId: e.playerId }
        );
        for (const f of sysById(state, e.systemId).fleets) {
          f.order = { kind: "hold" };
        }
      } else {
        log(
          state,
          "intel",
          `${who} sabotaged the ${e.targetUpgrade} at ${sysName2(state, e.systemId)}.`,
          { systemId: e.systemId, playerId: e.playerId }
        );
        if (e.targetUpgrade === "wormhole") {
          for (const f of sysById(state, e.systemId).fleets) {
            if (f.order.kind === "move" && f.order.wormholeJump) {
              f.order = { kind: "hold" };
            }
          }
        }
      }
    }
    if (e.kind === "destabilize" && e.systemId) {
      if (blocked.has(e.systemId)) {
        log(
          state,
          "intel",
          `Counter-espionage at ${sysName2(state, e.systemId)} foiled a destabilization.`,
          { systemId: e.systemId }
        );
        continue;
      }
      state.destabilized.push(e.systemId);
      log(
        state,
        "intel",
        `${playerName(state, e.playerId)} destabilized the government of ${sysName2(state, e.systemId)}.`,
        { systemId: e.systemId, playerId: e.playerId }
      );
    }
  }
  void rng;
}
function applyScheduledDestroy(state) {
  for (const s of state.systems) {
    for (const f of [...s.fleets]) {
      if (f.scheduledDestroy) {
        destroyFleet(
          state,
          f,
          `${playerName(state, f.ownerId)} scuttled a starfleet at ${s.name}.`
        );
      }
    }
    if (s.ownerId) {
      const p = s.ownerId;
    }
  }
}
function getDestroyUpgrades(state) {
  return state.destroyUpgrades ?? [];
}
function setDestroyUpgrades(state, list) {
  state.destroyUpgrades = list;
}
function applyDestroyUpgrades(state) {
  const list = getDestroyUpgrades(state);
  const destab = new Set(state.destabilized);
  for (const d of list) {
    if (destab.has(d.systemId)) {
      log(
        state,
        "intel",
        `Orders to wreck the ${d.upgrade} at ${sysName2(state, d.systemId)} were ignored \u2014 the government is destabilized.`,
        { systemId: d.systemId }
      );
      continue;
    }
    const s = sysById(state, d.systemId);
    if (s.ownerId !== d.playerId) continue;
    if (s.upgrades.includes(d.upgrade)) {
      s.upgrades = s.upgrades.filter((u) => u !== d.upgrade);
      log(
        state,
        "econ",
        `${playerName(state, d.playerId)} demolished the ${d.upgrade} at ${s.name}.`,
        { systemId: s.id, playerId: d.playerId }
      );
      if (d.upgrade === "wormhole") {
        for (const f of s.fleets) {
          if (f.order.kind === "move" && f.order.wormholeJump) {
            f.order = { kind: "hold" };
          }
        }
      }
    }
  }
  setDestroyUpgrades(state, []);
}
function supportStillValid(state, supporter, orders) {
  if (supporter.order.kind !== "support") return false;
  const { supportedFleetId, destId } = supporter.order;
  const target = allFleets(state).find((f) => f.id === supportedFleetId);
  if (!target) return false;
  const tOrder = orders.get(target.id) ?? target.order;
  if (tOrder.kind === "move") {
    return tOrder.destId === destId;
  }
  if (tOrder.kind === "hold") {
    return destId === target.systemId;
  }
  return false;
}
function resolveFleetOrders(state) {
  const fleets = () => allFleets(state);
  const orders = /* @__PURE__ */ new Map();
  for (const f of fleets()) orders.set(f.id, { ...f.order });
  const setHold = (id) => {
    orders.set(id, { kind: "hold" });
    const f = fleets().find((x) => x.id === id);
    if (f) f.order = { kind: "hold" };
  };
  for (const f of fleets()) {
    if (f.order.kind !== "support") continue;
    const attacked = fleets().some((e) => {
      if (e.ownerId === f.ownerId) return false;
      const o = orders.get(e.id) ?? e.order;
      return o.kind === "move" && o.destId === f.systemId;
    });
    if (attacked) {
      log(
        state,
        "combat",
        `Support from ${playerName(state, f.ownerId)} at ${sysName2(state, f.systemId)} was cut \u2014 the system came under attack.`,
        { systemId: f.systemId, playerId: f.ownerId }
      );
      setHold(f.id);
    }
  }
  const pending = /* @__PURE__ */ new Set();
  const resolvedSys = /* @__PURE__ */ new Set();
  const strengthThrough = (fromId, toId, ownerId) => {
    let n = 0;
    for (const f of fleets()) {
      if (f.ownerId !== ownerId) continue;
      const o = orders.get(f.id) ?? f.order;
      if (o.kind === "move" && f.systemId === fromId && o.destId === toId) n += 1;
      if (o.kind === "support" && f.systemId === fromId && o.destId === toId && supportStillValid(state, { ...f, order: o }, orders)) {
        n += 1;
      }
    }
    return n;
  };
  const edges = /* @__PURE__ */ new Set();
  for (const s of state.systems) {
    for (const n of s.neighbors) {
      const key = s.id < n ? `${s.id}|${n}` : `${n}|${s.id}`;
      edges.add(key);
    }
  }
  for (const f of fleets()) {
    const o = orders.get(f.id) ?? f.order;
    if (o.kind === "move" && o.wormholeJump) {
      const key = f.systemId < o.destId ? `${f.systemId}|${o.destId}` : `${o.destId}|${f.systemId}`;
      edges.add(key);
    }
  }
  for (const key of edges) {
    const [a, b] = key.split("|");
    const moversAB = /* @__PURE__ */ new Map();
    const moversBA = /* @__PURE__ */ new Map();
    for (const p of state.players) {
      const ab = strengthThrough(a, b, p.id);
      const ba = strengthThrough(b, a, p.id);
      if (ab) moversAB.set(p.id, ab);
      if (ba) moversBA.set(p.id, ba);
    }
    if (moversAB.size && moversBA.size) {
      for (const [pa, sa] of moversAB) {
        for (const [pb, sb] of moversBA) {
          if (pa === pb) continue;
          if (sa <= sb) {
            for (const f of fleets()) {
              if (f.ownerId !== pa) continue;
              const o = orders.get(f.id) ?? f.order;
              if (o.kind === "move" && f.systemId === a && o.destId === b) {
                setHold(f.id);
              }
              if (o.kind === "support" && f.systemId === a && o.destId === b) {
                setHold(f.id);
              }
            }
          }
          if (sb <= sa) {
            for (const f of fleets()) {
              if (f.ownerId !== pb) continue;
              const o = orders.get(f.id) ?? f.order;
              if (o.kind === "move" && f.systemId === b && o.destId === a) {
                setHold(f.id);
              }
              if (o.kind === "support" && f.systemId === b && o.destId === a) {
                setHold(f.id);
              }
            }
          }
        }
      }
    }
  }
  for (const f of fleets()) {
    const o = orders.get(f.id) ?? f.order;
    if (o.kind !== "support") continue;
    const destId = o.destId;
    const cut = fleets().some((e) => {
      if (e.ownerId === f.ownerId) return false;
      const eo = orders.get(e.id) ?? e.order;
      return eo.kind === "move" && e.systemId === destId && eo.destId === f.systemId;
    });
    if (cut) setHold(f.id);
  }
  for (const f of fleets()) {
    const o = orders.get(f.id) ?? f.order;
    if (o.kind !== "support") continue;
    if (!supportStillValid(state, { ...f, order: o }, orders)) {
      setHold(f.id);
      continue;
    }
    const target = fleets().find((x) => x.id === o.supportedFleetId);
    if (!target) {
      setHold(f.id);
      continue;
    }
    if (target.ownerId !== f.ownerId) {
      const dest = o.destId;
      const selfAttack = fleets().some((x) => {
        if (x.ownerId !== f.ownerId) return false;
        const xo = orders.get(x.id) ?? x.order;
        return xo.kind === "move" && xo.destId === dest;
      });
      const destSys = state.systems.find((s) => s.id === dest);
      const ownThere = destSys?.fleets.some((fl) => fl.ownerId === f.ownerId);
      const targetMovingThere = (orders.get(target.id) ?? target.order).kind === "move" && (orders.get(target.id) ?? target.order).destId === dest;
      if (selfAttack && targetMovingThere) setHold(f.id);
      else if (ownThere && targetMovingThere) {
        const ownHolding = destSys.fleets.some((fl) => {
          if (fl.ownerId !== f.ownerId) return false;
          const lo = orders.get(fl.id) ?? fl.order;
          return lo.kind === "hold" || lo.kind === "support";
        });
        if (ownHolding) setHold(f.id);
      }
    }
  }
  for (const f of fleets()) {
    f.order = orders.get(f.id) ?? f.order;
  }
  function combatAt(systemId, countLeavingAsHold) {
    const s = sysById(state, systemId);
    const strengths = /* @__PURE__ */ new Map();
    const attackers = /* @__PURE__ */ new Map();
    const holders = [];
    const add = (pid, n) => strengths.set(pid, (strengths.get(pid) ?? 0) + n);
    for (const f of s.fleets) {
      const o = f.order;
      if (o.kind === "move") {
        if (countLeavingAsHold) {
          add(f.ownerId, 1);
          holders.push(f);
        }
      } else {
        add(f.ownerId, 1);
        holders.push(f);
      }
    }
    if (starportDefends(state, s) && s.ownerId) {
      add(s.ownerId, 1);
    }
    for (const f of fleets()) {
      if (f.order.kind === "move" && f.order.destId === systemId) {
        add(f.ownerId, 1);
        const arr = attackers.get(f.ownerId) ?? [];
        arr.push(f);
        attackers.set(f.ownerId, arr);
      }
      if (f.order.kind === "support" && f.order.destId === systemId) {
        if (supportStillValid(state, f, orders)) add(f.ownerId, 1);
      }
    }
    return { systemId, strengths, attackers, holders };
  }
  function uniqueWinner(strengths) {
    let best = -1;
    let winner = null;
    for (const [pid, n] of strengths) {
      if (n > best) {
        best = n;
        winner = pid;
      } else if (n === best) {
        winner = null;
      }
    }
    if (!winner) return null;
    for (const [pid, n] of strengths) {
      if (pid !== winner && n >= best) return null;
    }
    for (const [pid, n] of strengths) {
      if (pid !== winner && best < n + 1) return null;
    }
    return winner;
  }
  const retreating = [];
  function bounce(fleetsToBounce) {
    for (const f of fleetsToBounce) {
      f.order = { kind: "hold" };
    }
  }
  function applyCombat(c, specialLeaving) {
    const s = sysById(state, c.systemId);
    const winner = uniqueWinner(c.strengths);
    const names = [...c.strengths.entries()].map(([id, n]) => `${playerName(state, id)} ${n}`).join(" vs ");
    if (!winner) {
      for (const [, arr] of c.attackers) bounce(arr);
      if (c.strengths.size > 0) {
        log(
          state,
          "combat",
          `Standoff at ${s.name} (${names}). Attackers are thrown back.`,
          { systemId: s.id }
        );
      }
      return "resolved";
    }
    const currentOwner = s.ownerId;
    if (winner === currentOwner || currentOwner === null && !c.attackers.has(winner)) {
      for (const [pid, arr] of c.attackers) {
        if (pid !== winner) bounce(arr);
      }
      if (c.attackers.size) {
        const opposed = [...c.attackers.keys()].some((id) => id !== winner);
        if (opposed) {
          log(
            state,
            "combat",
            `${playerName(state, winner)} holds ${s.name} (${names}).`,
            { systemId: s.id, playerId: winner }
          );
        }
      }
      return "resolved";
    }
    const incoming = c.attackers.get(winner) ?? [];
    if (incoming.length === 0 && !specialLeaving) {
      return "resolved";
    }
    for (const [pid, arr] of c.attackers) {
      if (pid !== winner) bounce(arr);
    }
    for (const f of [...s.fleets]) {
      if (f.ownerId !== winner) {
        if (f.order.kind === "move" && specialLeaving) {
          continue;
        }
        retreating.push(f);
        s.fleets = s.fleets.filter((x) => x.id !== f.id);
      }
    }
    for (const f of incoming) {
      moveFleet(state, f, s.id);
    }
    const prev = currentOwner;
    s.ownerId = winner;
    if (s.upgrades.includes("starport") && !state.destabilized.includes(s.id)) {
      s.upgrades = s.upgrades.filter((u) => u !== "starport");
      log(
        state,
        "combat",
        `The starport at ${s.name} was destroyed as ${playerName(state, winner)} seized the system.`,
        { systemId: s.id }
      );
    }
    if (state.options.scorchedEarth && prev) {
      s.upgrades = [];
      log(
        state,
        "alert",
        `Scorched earth: all upgrades at ${s.name} were destroyed.`,
        { systemId: s.id }
      );
    }
    log(
      state,
      "combat",
      `${playerName(state, winner)} takes ${s.name}${prev ? ` from ${playerName(state, prev)}` : ""}.`,
      { systemId: s.id, playerId: winner }
    );
    return "resolved";
  }
  const targeted = /* @__PURE__ */ new Set();
  for (const f of fleets()) {
    if (f.order.kind === "move") targeted.add(f.order.destId);
  }
  const isPending = (sid) => {
    const s = sysById(state, sid);
    const leaving = s.fleets.some((f) => f.order.kind === "move");
    const incoming = fleets().some(
      (f) => f.ownerId !== s.ownerId && f.order.kind === "move" && f.order.destId === sid
    );
    return leaving && incoming;
  };
  for (const s of state.systems) {
    const incoming = fleets().filter(
      (f) => f.order.kind === "move" && f.order.destId === s.id
    );
    if (incoming.length === 0) continue;
    const owners = new Set(incoming.map((f) => f.ownerId));
    if (owners.size !== 1) continue;
    const pid = incoming[0].ownerId;
    if (s.fleets.some((f) => f.ownerId !== pid)) continue;
    for (const f of incoming) moveFleet(state, f, s.id);
    if (s.ownerId !== pid) {
      const prev = s.ownerId;
      s.ownerId = pid;
      if (prev && s.upgrades.includes("starport") && !state.destabilized.includes(s.id)) {
        s.upgrades = s.upgrades.filter((u) => u !== "starport");
        log(
          state,
          "combat",
          `The starport at ${s.name} was destroyed as ${playerName(state, pid)} seized the system.`,
          { systemId: s.id }
        );
      }
      if (state.options.scorchedEarth && prev) {
        s.upgrades = [];
        log(
          state,
          "alert",
          `Scorched earth: all upgrades at ${s.name} were destroyed.`,
          { systemId: s.id }
        );
      }
      log(
        state,
        "combat",
        `${playerName(state, pid)} occupies ${s.name}${prev ? `, taking it from ${playerName(state, prev)}` : ""}.`,
        { systemId: s.id, playerId: pid }
      );
    }
    resolvedSys.add(s.id);
    targeted.delete(s.id);
  }
  let guard = 0;
  while (guard++ < 12) {
    let progressed = false;
    for (const s of state.systems) {
      if (resolvedSys.has(s.id)) continue;
      if (!targeted.has(s.id) && !s.fleets.some((f) => f.order.kind === "move")) {
        resolvedSys.add(s.id);
        continue;
      }
      if (isPending(s.id)) {
        pending.add(s.id);
        continue;
      }
      if (targeted.has(s.id)) {
        const c = combatAt(s.id, false);
        applyCombat(c, false);
      }
      resolvedSys.add(s.id);
      pending.delete(s.id);
      progressed = true;
    }
    if (!progressed) break;
  }
  let unflagged = true;
  guard = 0;
  while (unflagged && guard++ < 8) {
    unflagged = false;
    for (const sid of [...pending]) {
      const c = combatAt(sid, true);
      const winner = uniqueWinner(c.strengths);
      const s = sysById(state, sid);
      if (winner && winner !== s.ownerId) {
        applyCombat(combatAt(sid, false), true);
        pending.delete(sid);
        resolvedSys.add(sid);
        unflagged = true;
      }
    }
    if (!unflagged) break;
  }
  for (const sid of [...pending]) {
    const c = combatAt(sid, true);
    applyCombat(c, false);
    pending.delete(sid);
  }
  for (const f of [...fleets()]) {
    if (f.order.kind !== "move") continue;
    const dest = sysById(state, f.order.destId);
    const enemy = dest.fleets.some((x) => x.ownerId !== f.ownerId);
    const otherAttackers = fleets().filter(
      (x) => x.id !== f.id && x.order.kind === "move" && x.order.destId === dest.id && x.ownerId !== f.ownerId
    );
    if (enemy || otherAttackers.length) {
      f.order = { kind: "hold" };
      continue;
    }
    const destOwner = dest.ownerId;
    moveFleet(state, f, dest.id);
    if (destOwner !== f.ownerId) {
      dest.ownerId = f.ownerId;
      if (dest.upgrades.includes("starport") && destOwner && !state.destabilized.includes(dest.id)) {
        dest.upgrades = dest.upgrades.filter((u) => u !== "starport");
      }
      if (state.options.scorchedEarth && destOwner) dest.upgrades = [];
    }
  }
  for (const f of retreating) {
    let rally = f.rallySystemId;
    if (!rally || !isAdjacent(sysById(state, f.systemId), rally)) {
      rally = defaultRally(state, f);
    }
    if (!rally) {
      log(
        state,
        "combat",
        `A ${playerName(state, f.ownerId)} starfleet was destroyed in the retreat from ${sysName2(state, f.systemId)} \u2014 nowhere to run.`,
        { systemId: f.systemId, playerId: f.ownerId }
      );
      continue;
    }
    const dest = sysById(state, rally);
    if (dest.ownerId !== f.ownerId) {
      log(
        state,
        "combat",
        `A ${playerName(state, f.ownerId)} starfleet was destroyed retreating from ${sysName2(state, f.systemId)} \u2014 rally at ${dest.name} is no longer friendly.`,
        { systemId: f.systemId, playerId: f.ownerId }
      );
      continue;
    }
    f.order = { kind: "hold" };
    dest.fleets.push(f);
    f.systemId = dest.id;
    log(
      state,
      "combat",
      `A ${playerName(state, f.ownerId)} starfleet retreated to ${dest.name}.`,
      { systemId: dest.id, playerId: f.ownerId }
    );
  }
  for (const s of state.systems) {
    const owners = new Set(s.fleets.map((f) => f.ownerId));
    if (owners.size > 1) {
      const keep = s.ownerId && owners.has(s.ownerId) ? s.ownerId : [...owners][0];
      for (const f of [...s.fleets]) {
        if (f.ownerId !== keep) {
          destroyFleet(
            state,
            f,
            `A ${playerName(state, f.ownerId)} starfleet was lost in the chaos at ${s.name}.`
          );
        }
      }
    }
    if (s.fleets.length && s.ownerId !== s.fleets[0].ownerId) {
      s.ownerId = s.fleets[0].ownerId;
    }
  }
}
function applySupply(state) {
  const ports = sabotagedPorts(state);
  for (const s of state.systems) {
    if (s.fleets.length === 0) continue;
    const owner = s.fleets[0].ownerId;
    if (isSupplied(state.systems, s.id, owner, ports)) continue;
    for (const f of [...s.fleets]) {
      destroyFleet(
        state,
        f,
        `A ${playerName(state, owner)} starfleet at ${s.name} was cut off from supply and disbanded.`
      );
    }
  }
}
function applyTrade(state) {
  for (const t of state.trades) {
    const s = state.systems.find((x) => x.id === t.systemId);
    const sender = state.players.find((x) => x.id === t.playerId);
    const ownerId = s?.ownerId ?? null;
    let creditId = null;
    if (ownerId && ownerId !== t.playerId) {
      creditId = ownerId;
    } else if (t.toPlayerId) {
      creditId = t.toPlayerId;
    } else if (ownerId === t.playerId) {
      if (sender) sender.resources = addRes(sender.resources, t.resources);
      log(
        state,
        "econ",
        `${playerName(state, t.playerId)} aborted a delivery to ${s ? s.name : "an unnamed system"} \u2014 it is still in their hands.`,
        { systemId: t.systemId, playerId: t.playerId }
      );
      continue;
    } else {
      if (sender) sender.resources = addRes(sender.resources, t.resources);
      continue;
    }
    const p = state.players.find((x) => x.id === creditId);
    if (!p) {
      if (sender) sender.resources = addRes(sender.resources, t.resources);
      continue;
    }
    p.resources = addRes(p.resources, t.resources);
    const bits = [];
    if (t.resources.tech) bits.push(`${t.resources.tech} Tech`);
    if (t.resources.metals) bits.push(`${t.resources.metals} Metals`);
    if (t.resources.chon) bits.push(`${t.resources.chon} CHON`);
    const destName = s?.name ?? "an unnamed system";
    log(
      state,
      "econ",
      `${playerName(state, t.playerId)} delivered ${bits.join(", ") || "nothing"} to ${destName} (${p.civ.name}).`,
      { systemId: s?.id, playerId: p.id }
    );
  }
  state.trades = [];
}
function applyBuilds(state) {
  for (const b of state.builds) {
    const s = state.systems.find((x) => x.id === b.systemId);
    const p = state.players.find((x) => x.id === b.playerId);
    if (!s || !p) continue;
    if (s.ownerId !== b.playerId) {
      log(
        state,
        "econ",
        `${p.civ.name} lost a ${b.kind} under construction at ${s.name} \u2014 the system changed hands.`,
        { systemId: s.id, playerId: p.id }
      );
      continue;
    }
    if (b.kind === "starfleet") {
      const sabotagedYard = state.activeSabotage[s.id] === "shipyard";
      if (!s.upgrades.includes("shipyard") || sabotagedYard) {
        log(
          state,
          "econ",
          `Starfleet construction at ${s.name} failed \u2014 no working shipyard.`,
          { systemId: s.id, playerId: p.id }
        );
        continue;
      }
      s.fleets.push({
        id: uid("flt"),
        ownerId: p.id,
        systemId: s.id,
        order: { kind: "hold" },
        rallySystemId: null
      });
      log(
        state,
        "econ",
        `${p.civ.name} launched a starfleet at ${s.name}.`,
        { systemId: s.id, playerId: p.id }
      );
    } else {
      if (!s.upgrades.includes(b.kind)) {
        s.upgrades.push(b.kind);
        log(
          state,
          "econ",
          `${p.civ.name} completed a ${b.kind} at ${s.name}.`,
          { systemId: s.id, playerId: p.id }
        );
      }
    }
  }
  state.builds = [];
}
function collectResources(state) {
  for (const p of state.players) {
    if (p.collapsed) continue;
    const gain = { tech: 0, metals: 0, chon: 0 };
    for (const s of state.systems) {
      if (s.ownerId !== p.id) continue;
      const prod = productionOf(s, state.activeSabotage[s.id]);
      gain.tech += prod.tech;
      gain.metals += prod.metals;
      gain.chon += prod.chon;
    }
    p.resources = addRes(p.resources, gain);
  }
}
function applyUpkeep(state) {
  const rng = makeRng(state.seed, (2654435769 ^ state.turn) >>> 0);
  for (const p of state.players) {
    if (p.collapsed) continue;
    let fleets = allFleets(state).filter((f) => f.ownerId === p.id);
    const need = fleets.length;
    const canPay = Math.min(
      p.resources.tech,
      p.resources.metals,
      p.resources.chon
    );
    const paid = Math.min(need, canPay);
    p.resources = subRes(p.resources, {
      tech: paid,
      metals: paid,
      chon: paid
    });
    let scrap = need - paid;
    const ports = sabotagedPorts(state);
    while (scrap > 0 && fleets.length) {
      const ranked = fleets.map((f) => {
        const sd = supplyDistance(state.systems, f.systemId, p.id, ports);
        const sys2 = sysById(state, f.systemId);
        return {
          f,
          d1: sd.distToPort,
          d2: sd.portToHome,
          stack: sys2.fleets.filter((x) => x.ownerId === p.id).length
        };
      });
      ranked.sort((a, b) => b.d1 - a.d1 || b.d2 - a.d2 || b.stack - a.stack);
      const top = ranked.filter((x) => x.d1 === ranked[0].d1);
      const top2 = top.filter((x) => x.d2 === top[0].d2);
      const top3 = top2.filter((x) => x.stack === top2[0].stack);
      const pick2 = top3[Math.floor(rng() * top3.length)];
      destroyFleet(
        state,
        pick2.f,
        `${p.civ.name} could not maintain a starfleet at ${sysName2(state, pick2.f.systemId)} \u2014 it was scrapped.`
      );
      fleets = allFleets(state).filter((f) => f.ownerId === p.id);
      scrap -= 1;
    }
  }
}
function revealMap(state) {
  for (const p of state.players) {
    if (!state.options.uncharted) {
      p.discoveredSystemIds = state.systems.map((s) => s.id);
      p.discoveredPlayerIds = state.players.map((x) => x.id);
      continue;
    }
    const owned2 = state.systems.filter((s) => s.ownerId === p.id);
    for (const s of owned2) {
      if (!p.discoveredSystemIds.includes(s.id)) p.discoveredSystemIds.push(s.id);
      for (const n of s.neighbors) {
        if (!p.discoveredSystemIds.includes(n)) p.discoveredSystemIds.push(n);
      }
    }
    for (const s of state.systems) {
      if (!p.discoveredSystemIds.includes(s.id)) continue;
      if (s.ownerId && !p.discoveredPlayerIds.includes(s.ownerId)) {
        p.discoveredPlayerIds.push(s.ownerId);
      }
    }
  }
}
function resolveTurn(state) {
  const next = structuredClone(state);
  next.log = [];
  next.phase = "resolving";
  const tradeSnap = next.trades.slice();
  const espSnap = next.espionage.slice();
  const ownerSnap = new Map(next.systems.map((s) => [s.id, s.ownerId]));
  const moveSnap = allFleets(next).filter((f) => f.order.kind === "move").map((f) => ({
    ownerId: f.ownerId,
    destId: f.order.kind === "move" ? f.order.destId : ""
  })).filter((m) => m.destId);
  applyEspionage(next);
  applyScheduledDestroy(next);
  applyDestroyUpgrades(next);
  resolveFleetOrders(next);
  applySupply(next);
  applyTrade(next);
  applyBuilds(next);
  evaluateDiplomacy(next, {
    trades: tradeSnap,
    espionage: espSnap,
    moves: moveSnap,
    owners: ownerSnap
  });
  next.espionage = [];
  for (const f of allFleets(next)) {
    f.order = { kind: "hold" };
    f.scheduledDestroy = false;
  }
  for (const p of next.players) p.ready = false;
  revealMap(next);
  const limit = next.options.turnLimit === "none" ? Infinity : next.options.turnLimit;
  const atEnd = next.turn >= limit;
  const v = evaluateVictory(next, atEnd);
  if (v.kind) {
    next.phase = "ended";
    next.winnerIds = v.winnerIds;
    next.result = v.kind;
    log(next, "alert", v.reason);
  } else {
    next.turn += 1;
    collectResources(next);
    applyUpkeep(next);
    next.activeSabotage = {};
    next.destabilized = [];
    next.counterEspionage = [];
    next.phase = "report";
  }
  next.archiveLog = [...next.archiveLog, ...next.log];
  next.updatedAt = Date.now();
  pushSnapshot(next);
  return next;
}
function canUseWormhole(state, fleet) {
  const s = sysById(state, fleet.systemId);
  if (!s.upgrades.includes("wormhole")) return false;
  if (state.activeSabotage[s.id] === "wormhole") return false;
  const used = s.fleets.some(
    (f) => f.id !== fleet.id && f.order.kind === "move" && f.order.wormholeJump
  );
  return !used;
}

// src/lib/game/diplomacy.ts
function the(civ) {
  return civTheName(civ);
}
function ruler(p) {
  return `${p.civ.rulerTitle} ${p.name}`;
}
function sys(state, id) {
  if (!id) return "the designated system";
  const s = state.systems.find((x) => x.id === id);
  return s?.name ?? "the designated system";
}
function formatRes(r) {
  if (!r) return "nothing";
  const bits = [];
  if (r.tech) bits.push(`${r.tech} Tech`);
  if (r.metals) bits.push(`${r.metals} Metals`);
  if (r.chon) bits.push(`${r.chon} CHON`);
  return bits.length ? bits.join(", ") : "nothing";
}
function resNonzero(r) {
  return !!r && resSum(r) > 0;
}
function composeMessage(opts) {
  const { state, from, to, topic, attitude, systemId, neighborId, aboutPlayerId, terms } = opts;
  const S = sys(state, terms?.giveSystemId ?? systemId);
  const N = neighborId ? sys(state, neighborId) : "an adjacent system";
  const about = state.players.find((p) => p.id === (terms?.aboutPlayerId ?? aboutPlayerId))?.civ ?? to.civ;
  const us = the(from.civ);
  const them = the(to.civ);
  const race = from.civ.racialName;
  const give = formatRes(terms?.give);
  const ask = formatRes(terms?.request);
  const giveSys = sys(state, terms?.giveSystemId);
  const askSys = sys(state, terms?.requestSystemId);
  const unless = terms?.unless ? ` Unless you ${terms.unless}, this stands.` : "";
  if (topic === "trade") {
    const gift = resNonzero(terms?.give);
    const plea = resNonzero(terms?.request);
    const lines2 = {
      neutral: gift && plea ? `${ruler(from)} of ${us} proposes an exchange: ${give} landed at ${giveSys}, against ${ask} delivered to ${askSys}.` : gift ? `${ruler(from)} proposes a delivery of ${give} to ${giveSys}.` : `${ruler(from)} suggests that ${them} send ${ask} to ${askSys}.`,
      belligerent: gift ? `Refuse us and the next convoy \u2014 ${give} bound for ${giveSys} \u2014 will feed someone else.${unless}` : `Send ${ask} to ${askSys} or ${us} will remember the slight.${unless}`,
      aggressive: plea ? `${them} will deliver ${ask} to ${askSys}. ${ruler(from)} has already accounted for them.` : `${them} will accept ${give} at ${giveSys}. This is not a discussion.`,
      polite: gift && plea ? `${us} offers ${give} at ${giveSys} in a fair exchange for ${ask} at ${askSys}. Let the ledgers, not the guns, speak.` : gift ? `${us} offers ${give} delivered to ${giveSys}, freely and in good faith.` : `${us} requests ${ask} at ${askSys}, and will consider a matching courtesy.`,
      apologetic: plea ? `We ask \u2014 we must ask \u2014 that ${ask} be landed at ${askSys}. Our people are thin this season.` : `We can spare ${give} for ${giveSys}. Take it; we have little else to give.`
    };
    return lines2[attitude];
  }
  if (topic === "attack") {
    const intent = terms?.intent ?? "i-attack";
    const vacate = intent === "vacate";
    const youAttack = intent === "you-attack";
    const youTake = intent === "you-take";
    const lines2 = {
      neutral: youTake ? `${ruler(from)} of ${us} will leave ${S} unoccupied. ${them} may occupy it from ${N} if they wish.` : youAttack ? `${us} suggests that ${them} move on ${S} from ${N}. A quiet realignment now may spare both our peoples a regrettable incident.` : vacate ? `${ruler(from)} requests that ${them} withdraw from ${S}. We have no wish to force the issue.` : `${ruler(from)} of ${us} will move on ${S} from ${N}. Consider your dispositions.`,
      belligerent: vacate ? `Vacate ${S} or we shall take it from ${N}.${unless}` : `The ${race} of ${us} will not be denied ${S}. Stand aside or burn.${unless}`,
      aggressive: youAttack ? `${ruler(from)} states without ornament: ${them} will strike ${S} from ${N}. Do so.` : `${us} will move on ${S} from ${N}. If ${them} intend to contest it, say so.`,
      polite: youTake ? `${us} proposes to leave ${S}. With your blessing we would see ${them} occupy it from ${N}.` : vacate ? `${us} asks, with respect, that ${them} withdraw from ${S} so hostilities can be avoided.` : `${ruler(from)} of ${us} proposes a coordinated movement concerning ${S} from ${N}.`,
      apologetic: youAttack ? `${ruler(from)} begs that ${them} strike ${S} from ${N}. We cannot do this ourselves.` : `${ruler(from)} begs the patience of ${them}. Permit us ${S}, or strike where we cannot.`
    };
    return lines2[attitude];
  }
  if (topic === "support") {
    const mine = (terms?.intent ?? "support-me") === "support-me";
    const lines2 = {
      neutral: mine ? `${us} notes that supporting fire into ${S} from ${N} would settle the local balance with a minimum of blood.` : `${us} is prepared to support a movement into ${S} from ${N}, if ${them} wish it.`,
      belligerent: `Unless ${them} comply, ${us} will commit supporting fire against ${S} from ${N}.${unless}`,
      aggressive: mine ? `${ruler(from)} requires that ${them} support the movement into ${S} from ${N}. This is not a discussion.` : `${them} will accept our supporting fire into ${S} from ${N}.`,
      polite: mine ? `${us} requests support into ${S} from ${N}. Two navies, one purpose.` : `${us} offers supporting fire into ${S} from ${N}, if that serves ${them}.`,
      apologetic: `We plead for supporting fire into ${S} from ${N}. The ${race} cannot hold the line alone.`
    };
    return lines2[attitude];
  }
  if (topic === "espionage") {
    const op = terms?.espionageKind ?? "sabotage";
    const target = terms?.targetUpgrade ?? "starport";
    const lines2 = {
      neutral: `${us} suggests quiet work at ${S} \u2014 ${op} against ${target}. Agents are cheaper than starfleets.`,
      belligerent: `Unless ${them} yield, ${us} will set ${op} upon ${S} (${target}). You will learn of it when the lights go out.${unless}`,
      aggressive: `${ruler(from)} requires ${op} at ${S} (${target}). See it done.`,
      polite: `${us} offers to handle ${op} at ${S} (${target}), or to recommend the same of your own operatives.`,
      apologetic: `We beg a quiet knife at ${S} \u2014 ${op} against ${target}. We have not the fleets to do this in the open.`
    };
    return lines2[attitude];
  }
  if (topic === "intelligence") {
    const lines2 = {
      neutral: `${ruler(from)} is prepared to share a correspondence concerning ${the(about)}. Archives, unlike starfleets, cost little to move.`,
      belligerent: `Hold your tongue or ${us} will circulate the relevant archive regarding ${the(about)}. Shame is a weapon.${unless}`,
      aggressive: `${them} will furnish the correspondence concerning ${the(about)}. ${ruler(from)} does not ask twice.`,
      polite: `${us} offers, or requests, a copy of certain messages touching ${the(about)}. Discretion for discretion.`,
      apologetic: `We ask to see what ${the(about)} has written. We are, as ever, the last to know.`
    };
    return lines2[attitude];
  }
  const third = terms?.intent === "with-third";
  const dissolving = terms?.allianceClause === "break";
  const lines = {
    neutral: dissolving ? `${ruler(from)} of ${us} proposes that our alliance be dissolved.` : third ? `${ruler(from)} of ${us} notes that a compact with ${the(about)} may soon be sealed.` : `${ruler(from)} of ${us} offers a mutual alliance with ${them}, in force the moment both admiralties accept.`,
    belligerent: dissolving ? `The alliance is a fiction. Accept its end, or we will denounce it ourselves.${unless}` : third ? `Ally with us or watch ${us} bind ourselves to ${the(about)}. Isolation is a choice you will not survive.${unless}` : `Ally with us or we will find someone who will.${unless}`,
    aggressive: dissolving ? `${ruler(from)} ends the alliance. ${them} will acknowledge it.` : `${ruler(from)} sets the terms. ${them} will accept an alliance on the lines already indicated.`,
    polite: dissolving ? `${ruler(from)} of ${us} asks that we part as allies with clear eyes, and dissolve the compact.` : `${ruler(from)} of ${us} offers a mutual alliance to ${them}. Two civilizations, one frontier \u2014 in force the moment both accept.`,
    apologetic: dissolving ? `We must ask that the alliance end. We know we come as the lesser party.` : `The ${race} of ${us} ask for alliance terms. We know we come as the lesser party.`
  };
  return lines[attitude];
}
function withClauses(body, opts) {
  const { state, topic, terms } = opts;
  if (!terms) return body;
  const extra = [];
  if (topic !== "alliance") {
    if (terms.allianceClause === "form") {
      extra.push(
        resNonzero(terms.request) && !resNonzero(terms.give) ? "This is offered as a mutual alliance if they accept. The alliance takes force the moment both admiralties accept; the named goods still have to be scheduled as an ordinary delivery." : "This stands together with a mutual alliance, in force the moment both admiralties accept."
      );
    } else if (terms.allianceClause === "break") {
      extra.push("Upon acceptance, our alliance is dissolved.");
    }
  }
  if (topic !== "trade" && (resNonzero(terms.give) || resNonzero(terms.request))) {
    extra.push(
      `Attached exchange: ${formatRes(terms.give)} landed at ${sys(state, terms.giveSystemId)}, against ${formatRes(terms.request)} delivered to ${sys(state, terms.requestSystemId)}. Goods move only if each admiralty separately orders the delivery.`
    );
  }
  if (topic === "trade") {
    extra.push(
      "Agreeing records your word; each side must still schedule its own delivery."
    );
  }
  return extra.length ? `${body} ${extra.join(" ")}` : body;
}
function composeReply(opts) {
  const { state, from, to, attitude, accept, terms, topic } = opts;
  const us = the(from.civ);
  const them = the(to.civ);
  const detail = topic === "trade" && (resNonzero(terms?.give) || resNonzero(terms?.request)) ? accept ? ` The exchange stands: ${formatRes(terms?.give)} to ${sys(state, terms?.giveSystemId)}, against ${formatRes(terms?.request)} to ${sys(state, terms?.requestSystemId)}.` : ` We will not send ${formatRes(terms?.request)} to ${sys(state, terms?.requestSystemId)}.` : "";
  if (attitude === "neutral") {
    return `${us} has taken the matter under advisement. ${them} will have an answer in due course \u2014 or not.`;
  }
  if (attitude === "belligerent") {
    return accept ? `${us} notes your insolence and will remember it. Do not mistake our present restraint for weakness.` : `Your message is an insult. Repeat it and ${us} will answer with starfleets, not scribes.`;
  }
  if (attitude === "aggressive") {
    return accept ? `${us} agrees \u2014 for our own best interest, not yours. See that you perform your half.${detail}` : `${us} rejects this out of hand. Waste our time again and compensation will be extracted.`;
  }
  if (attitude === "polite") {
    return accept ? `${us} accepts, with thanks for the consideration shown by ${them}.${detail}` : `${us} must decline, with all due consideration. Perhaps another arrangement.`;
  }
  return accept ? `We comply \u2014 and apologize that ${us} did not already anticipate your desire.${detail}` : `We proclaim our loyalty even as we admit the thing cannot be done. Forgive the ${from.civ.racialName}.`;
}
function sendThreadMessage(state, args) {
  const from = state.players.find((p) => p.id === args.fromId);
  const to = state.players.find((p) => p.id === args.toId);
  const apparent = args.apparentFromId ? state.players.find((p) => p.id === args.apparentFromId) : from;
  const raw = args.threadId && args.accept !== void 0 ? composeReply({
    state,
    from: apparent,
    to,
    topic: args.topic,
    attitude: args.attitude,
    originalAttitude: args.originalAttitude ?? "neutral",
    accept: args.accept,
    terms: args.terms
  }) : composeMessage({
    state,
    from: apparent,
    to,
    topic: args.topic,
    attitude: args.attitude,
    systemId: args.systemId,
    neighborId: args.neighborId,
    aboutPlayerId: args.aboutPlayerId,
    terms: args.terms
  });
  const text = args.accept !== void 0 ? raw : withClauses(raw, { state, topic: args.topic, terms: args.terms });
  const msg = {
    id: uid("msg"),
    turn: state.turn,
    fromPlayerId: from.id,
    apparentFromId: apparent.id,
    toPlayerId: to.id,
    topic: args.topic,
    attitude: args.attitude,
    systemId: args.systemId,
    neighborId: args.neighborId,
    aboutPlayerId: args.aboutPlayerId,
    text,
    read: false,
    terms: args.terms,
    status: args.status ?? (args.terms ? "open" : void 0)
  };
  let thread = args.threadId ? state.threads.find((t) => t.id === args.threadId) : void 0;
  if (!thread) {
    thread = {
      id: uid("thr"),
      topic: args.topic,
      participants: [apparent.id, to.id],
      systemId: args.systemId,
      messages: []
    };
    state.threads.push(thread);
  }
  thread.messages.push(msg);
  return thread;
}
function canFulfillDelivery(state, playerId, systemId) {
  if (!systemId) return false;
  const s = state.systems.find((x) => x.id === systemId);
  if (!s) return false;
  if (s.ownerId === playerId) return true;
  return s.neighbors.some((n) => state.systems.find((x) => x.id === n)?.ownerId === playerId);
}
function viewTerms(state, msg, viewerId) {
  const t = msg.terms;
  if (!t) {
    return {
      incoming: null,
      outgoing: null,
      intent: "A statement of intent \u2014 no goods change hands if you reply.",
      canAccept: msg.status === "open" || msg.status === void 0,
      acceptHint: "Agreeing records your word. It does not move fleets; issue matching orders on the map.",
      blockedReason: null
    };
  }
  const iAmRecipient = msg.toPlayerId === viewerId;
  const giveStr = resNonzero(t.give) ? `${formatRes(t.give)} \u2192 ${sys(state, t.giveSystemId)}` : null;
  const reqStr = resNonzero(t.request) ? `${formatRes(t.request)} \u2192 ${sys(state, t.requestSystemId)}` : null;
  const incoming = iAmRecipient ? giveStr : reqStr;
  const outgoing = iAmRecipient ? reqStr : giveStr;
  if (resNonzero(t.give) || resNonzero(t.request)) {
    const iPay = iAmRecipient ? t.request : t.give;
    const iDest = iAmRecipient ? t.requestSystemId : t.giveSystemId;
    const theyPay = iAmRecipient ? t.give : t.request;
    const theyId = iAmRecipient ? msg.fromPlayerId : msg.toPlayerId;
    const theyDest = iAmRecipient ? t.giveSystemId : t.requestSystemId;
    const me = state.players.find((p) => p.id === viewerId);
    let blocked = null;
    if (resNonzero(iPay)) {
      if (!canAfford(me.resources, iPay)) blocked = `You cannot afford ${formatRes(iPay)} this turn.`;
      else if (!canFulfillDelivery(state, viewerId, iDest))
        blocked = `You do not border ${sys(state, iDest)}, so you cannot land a delivery there.`;
    }
    if (!blocked && resNonzero(theyPay) && theyDest) {
      if (!canFulfillDelivery(state, theyId, theyDest))
        blocked = `They no longer border ${sys(state, theyDest)} \u2014 the delivery cannot land.`;
    }
    const parts = [];
    if (outgoing) parts.push(`You send ${outgoing}.`);
    if (incoming) parts.push(`They send ${incoming}.`);
    if (!parts.length) parts.push("No goods are specified.");
    return {
      incoming,
      outgoing,
      intent: t.allianceClause === "form" ? iAmRecipient ? "Mutual alliance is sealed the moment you accept." : "Mutual alliance is sealed the moment they accept." : t.allianceClause === "break" ? iAmRecipient ? "Accepting dissolves the alliance immediately." : "They are asked to dissolve the alliance." : null,
      canAccept: !blocked && (msg.status === "open" || !msg.status),
      acceptHint: `If you accept, your word is recorded: ${parts.join(" ")} You must still schedule your own delivery on the map \u2014 accepting does not move goods.`,
      blockedReason: blocked
    };
  }
  const intentBits = [];
  if (msg.topic === "attack") {
    const S = sys(state, msg.systemId);
    const N = msg.neighborId ? ` from ${sys(state, msg.neighborId)}` : "";
    if (t.intent === "vacate") intentBits.push(`They ask you to withdraw from ${S}.`);
    else if (t.intent === "you-attack") intentBits.push(`They ask you to strike ${S}${N}.`);
    else if (t.intent === "you-take") intentBits.push(`They will leave ${S}; they invite you to take it${N}.`);
    else intentBits.push(`They will move on ${S}${N}.`);
  } else if (msg.topic === "support") {
    const S = sys(state, msg.systemId);
    const N = msg.neighborId ? sys(state, msg.neighborId) : "an adjacent system";
    intentBits.push(
      t.intent === "i-support-you" ? `They offer supporting fire into ${S} from ${N}.` : `They ask you to support a movement into ${S} from ${N}.`
    );
  } else if (msg.topic === "espionage") {
    intentBits.push(
      `Espionage: ${t.espionageKind ?? "sabotage"} at ${sys(state, msg.systemId)}` + (t.targetUpgrade ? ` (${t.targetUpgrade})` : "") + "."
    );
  } else if (msg.topic === "alliance") {
    const other = state.players.find((p) => p.id === t.aboutPlayerId);
    intentBits.push(
      t.allianceClause === "break" || t.intent === "break" ? "They propose dissolving the alliance." : t.intent === "with-third" ? `They may ally with ${other ? the(other.civ) : "another power"}.` : "They offer a mutual alliance with you, in force the moment both accept."
    );
  }
  if (t.allianceClause === "form" && msg.topic !== "alliance") {
    intentBits.push("Bundled: mutual alliance, sealed on accept.");
  }
  if (t.allianceClause === "break" && msg.topic !== "alliance") {
    intentBits.push("Bundled: the alliance is dissolved on accept.");
  }
  if (t.unless) intentBits.push(`Condition: unless you ${t.unless}.`);
  return {
    incoming,
    outgoing,
    intent: intentBits.join(" ") || null,
    canAccept: msg.status === "open" || !msg.status,
    acceptHint: "Agreeing records your word. It does not move fleets or spend Tech \u2014 issue matching orders yourself if you mean to act.",
    blockedReason: null
  };
}
function pushTrade(state, playerId, systemId, resources, toPlayerId) {
  const p = state.players.find((x) => x.id === playerId);
  if (!p) return "Unknown power.";
  if (!resNonzero(resources)) return null;
  if (!canFulfillDelivery(state, playerId, systemId))
    return `${p.civ.name} cannot deliver to ${sys(state, systemId)}.`;
  if (!canAfford(p.resources, resources))
    return `${p.civ.name} cannot afford ${formatRes(resources)}.`;
  p.resources = subRes(p.resources, resources);
  state.trades.push({
    id: uid("trd"),
    playerId,
    systemId,
    resources: cloneRes(resources),
    toPlayerId
  });
  return null;
}
function schedulePactDelivery(state, playerId, pactId) {
  const pact = (state.pacts ?? []).find((p) => p.id === pactId);
  if (!pact) return "No such bargain.";
  const half = playerId === pact.aId ? { resources: pact.give, systemId: pact.giveSystemId, otherId: pact.bId } : playerId === pact.bId ? { resources: pact.request, systemId: pact.requestSystemId, otherId: pact.aId } : null;
  if (!half) return "You are not a party to this bargain.";
  if (!resNonzero(half.resources) || !half.systemId) return "Nothing to send.";
  const already = state.trades.some(
    (t) => t.playerId === playerId && t.systemId === half.systemId && t.resources.tech === half.resources.tech && t.resources.metals === half.resources.metals && t.resources.chon === half.resources.chon
  );
  if (already) return "That delivery is already scheduled.";
  return pushTrade(state, playerId, half.systemId, half.resources, half.otherId);
}
function acceptOffer(state, viewerId, messageId) {
  const thread = state.threads.find((t2) => t2.messages.some((m) => m.id === messageId));
  const msg = thread?.messages.find((m) => m.id === messageId);
  if (!msg || !thread) return "No such dispatch.";
  if (msg.toPlayerId !== viewerId) return "This dispatch is not addressed to you.";
  if (msg.status && msg.status !== "open") return "That offer is already closed.";
  const view = viewTerms(state, msg, viewerId);
  if (!view.canAccept) return view.blockedReason ?? "Cannot accept.";
  const t = msg.terms ?? {};
  const clause = t.allianceClause ?? (msg.topic === "alliance" && t.intent !== "with-third" ? "form" : void 0);
  if (clause === "form") {
    formAlliance(state, msg.fromPlayerId, viewerId);
  } else if (clause === "break") {
    breakAlliance(state, msg.fromPlayerId, viewerId);
  }
  const hasTrade = resNonzero(t.give) || resNonzero(t.request);
  if (hasTrade || clause) {
    sealPact(state, {
      messageId: msg.id,
      threadId: thread.id,
      aId: msg.fromPlayerId,
      bId: viewerId,
      give: t.give,
      giveSystemId: t.giveSystemId,
      request: t.request,
      requestSystemId: t.requestSystemId,
      allianceClause: clause
    });
  }
  msg.status = "accepted";
  sendThreadMessage(state, {
    fromId: viewerId,
    toId: msg.fromPlayerId,
    topic: msg.topic,
    attitude: "polite",
    threadId: thread.id,
    accept: true,
    originalAttitude: msg.attitude,
    terms: flipTerms(t),
    systemId: msg.systemId,
    status: "accepted"
  });
  return null;
}
function declineOffer(state, viewerId, messageId, attitude = "polite") {
  const thread = state.threads.find((t) => t.messages.some((m) => m.id === messageId));
  const msg = thread?.messages.find((m) => m.id === messageId);
  if (!msg || !thread) return "No such dispatch.";
  if (msg.toPlayerId !== viewerId) return "This dispatch is not addressed to you.";
  msg.status = "declined";
  sendThreadMessage(state, {
    fromId: viewerId,
    toId: msg.fromPlayerId,
    topic: msg.topic,
    attitude,
    threadId: thread.id,
    accept: false,
    originalAttitude: msg.attitude,
    terms: msg.terms,
    systemId: msg.systemId,
    status: "declined"
  });
  return null;
}
function denounceAlliance(state, fromId, toId, reason) {
  if (!areAllied(state, fromId, toId)) return "You are not allied with that power.";
  breakAlliance(state, fromId, toId);
  sendThreadMessage(state, {
    fromId,
    toId,
    topic: "alliance",
    attitude: "belligerent",
    terms: {
      allianceClause: "break",
      intent: "with-you",
      unless: reason
    },
    status: "accepted"
  });
  return null;
}
function respondToIncident(state, viewerId, incidentId, action, unless) {
  const inc = (state.allyIncidents ?? []).find((i) => i.id === incidentId);
  if (!inc) return "No such incident.";
  if (inc.victimId !== viewerId) return "That grievance is not yours.";
  if (inc.status !== "open") return "Already answered.";
  inc.status = action;
  if (action === "broke") {
    return denounceAlliance(state, viewerId, inc.actorId, inc.text);
  }
  if (action === "threatened") {
    sendThreadMessage(state, {
      fromId: viewerId,
      toId: inc.actorId,
      topic: "alliance",
      attitude: "belligerent",
      systemId: inc.systemId,
      terms: {
        allianceClause: areAllied(state, viewerId, inc.actorId) ? void 0 : "break",
        intent: "with-you",
        unless: unless || "make amends for the slight"
      },
      status: "open"
    });
  }
  return null;
}
function counterOffer(state, viewerId, messageId, terms) {
  const thread = state.threads.find((t) => t.messages.some((m) => m.id === messageId));
  const msg = thread?.messages.find((m) => m.id === messageId);
  if (!msg || !thread) return "No such dispatch.";
  if (msg.toPlayerId !== viewerId) return "This dispatch is not addressed to you.";
  msg.status = "countered";
  sendThreadMessage(state, {
    fromId: viewerId,
    toId: msg.fromPlayerId,
    topic: msg.topic,
    attitude: "polite",
    threadId: thread.id,
    terms,
    systemId: terms.giveSystemId ?? terms.requestSystemId ?? msg.systemId,
    neighborId: msg.neighborId,
    aboutPlayerId: terms.aboutPlayerId ?? msg.aboutPlayerId,
    status: "open"
  });
  return null;
}
function visibleThreads(state, viewerId) {
  const intercepts = state.espionage.filter(
    (e) => e.kind === "intercept" && e.playerId === viewerId
  );
  return state.threads.filter((t) => {
    if (t.participants.includes(viewerId)) return true;
    if (t.messages.some((m) => m.fromPlayerId === viewerId)) return true;
    return intercepts.some(
      (e) => e.otherPlayerId && e.thirdPlayerId && t.participants.includes(e.otherPlayerId) && t.participants.includes(e.thirdPlayerId)
    );
  });
}
function unreadCount(state, viewerId) {
  return visibleThreads(state, viewerId).reduce(
    (n, t) => n + t.messages.filter((m) => m.toPlayerId === viewerId && !m.read).length,
    0
  );
}
function legalTradeDestinations(state, playerId) {
  return state.systems.filter(
    (s) => s.ownerId !== playerId && s.neighbors.some((n) => state.systems.find((x) => x.id === n)?.ownerId === playerId)
  ).map((s) => s.id);
}
function tradeFrontier(state, senderId, recipientId) {
  const targeted = /* @__PURE__ */ new Set();
  for (const s of state.systems) {
    for (const f of s.fleets) {
      if (f.order.kind === "move" && f.order.destId) targeted.add(f.order.destId);
    }
  }
  const dests = legalTradeDestinations(state, senderId).filter((id) => !targeted.has(id));
  const ownedByThem = dests.filter(
    (id) => state.systems.find((s) => s.id === id)?.ownerId === recipientId
  );
  if (ownedByThem.length) return ownedByThem;
  const shared = dests.filter((id) => {
    const s = state.systems.find((x) => x.id === id);
    if (!s) return false;
    return s.neighbors.some(
      (n) => state.systems.find((x) => x.id === n)?.ownerId === recipientId
    );
  });
  return shared.length ? shared : dests;
}
function flipTerms(t) {
  return {
    ...t,
    give: t.request ? cloneRes(t.request) : cloneRes(ZERO),
    giveSystemId: t.requestSystemId,
    request: t.give ? cloneRes(t.give) : cloneRes(ZERO),
    requestSystemId: t.giveSystemId
  };
}

// src/lib/game/ai.ts
function owned(state, p) {
  return state.systems.filter((s) => s.ownerId === p.id);
}
function fleetsOf(s, pid) {
  return s.fleets.filter((f) => f.ownerId === pid);
}
function emptyNeighbors(state, s) {
  return s.neighbors.map((id) => state.systems.find((x) => x.id === id)).filter((n) => n.ownerId === null && n.fleets.length === 0);
}
function enemyNeighbors(state, s, pid) {
  return s.neighbors.map((id) => state.systems.find((x) => x.id === id)).filter((n) => n.ownerId && n.ownerId !== pid && !areAllied(state, pid, n.ownerId));
}
function defenseOf(s) {
  let n = s.fleets.length;
  if (s.upgrades.includes("starport")) n += 1;
  return n;
}
function incomeMin(state, p) {
  let t = 0, m = 0, c = 0;
  for (const s of owned(state, p)) {
    const r = productionOf(s);
    t += r.tech;
    m += r.metals;
    c += r.chon;
  }
  return Math.min(t, m, c);
}
function runAi(state, player) {
  if (player.kind !== "ai" || player.collapsed) return;
  const rng = makeRng(state.seed, 12648430 ^ state.turn ^ player.id.length * 13);
  for (const s of state.systems) {
    for (const f of fleetsOf(s, player.id)) {
      f.order = { kind: "hold" };
    }
  }
  const my = owned(state, player);
  const myFleets = state.systems.flatMap((s) => fleetsOf(s, player.id));
  const claimed = /* @__PURE__ */ new Set();
  for (const s of shuffle(rng, my)) {
    const empties = emptyNeighbors(state, s);
    const idle = fleetsOf(s, player.id).filter((f) => f.order.kind === "hold");
    for (const f of idle) {
      const dest = empties.find((e) => !claimed.has(e.id));
      if (!dest) break;
      const threat = enemyNeighbors(state, s, player.id).length > 0;
      const remaining = idle.filter((x) => x.order.kind === "hold").length;
      if (s.isHome && threat && remaining <= 1) break;
      f.order = { kind: "move", destId: dest.id };
      claimed.add(dest.id);
    }
  }
  for (const s of shuffle(rng, my)) {
    const targets = enemyNeighbors(state, s, player.id).sort(
      (a, b) => defenseOf(a) - defenseOf(b)
    );
    for (const t of targets) {
      const idle = fleetsOf(s, player.id).filter((f) => f.order.kind === "hold");
      if (idle.length < 1) continue;
      const def = defenseOf(t);
      const available = idle.length;
      if (available >= 2 && def <= available) {
        const mover = idle[0];
        const supporter = idle[1];
        mover.order = { kind: "move", destId: t.id };
        supporter.order = {
          kind: "support",
          supportedFleetId: mover.id,
          destId: t.id
        };
        break;
      }
      if (available >= def + 1) {
        for (const f of idle.slice(0, def + 1)) {
          f.order = { kind: "move", destId: t.id };
        }
        break;
      }
    }
  }
  for (const s of my) {
    if (!s.upgrades.includes("wormhole")) continue;
    const idle = fleetsOf(s, player.id).filter((f2) => f2.order.kind === "hold");
    const f = idle[0];
    if (!f || !canUseWormhole(state, f)) continue;
    const reach = [...hopsAway(state.systems, s.id, 2)].map((id) => state.systems.find((x) => x.id === id)).filter(
      (n) => !s.neighbors.includes(n.id) && (n.ownerId === null || n.ownerId !== player.id && !areAllied(state, player.id, n.ownerId) && defenseOf(n) === 0)
    );
    if (reach.length && rng() < 0.55) {
      const dest = pick(rng, reach);
      f.order = { kind: "move", destId: dest.id, wormholeJump: true };
    }
  }
  const upkeepCap = incomeMin(state, player);
  const currentFleets = fleetCount(state.systems, player.id);
  const scheduledFleets = state.builds.filter(
    (b) => b.playerId === player.id && b.kind === "starfleet"
  ).length;
  const tryBuild = (system, kind) => {
    const cost = BUILD_COST[kind];
    if (!canAfford(player.resources, cost)) return false;
    if (kind !== "starfleet" && system.upgrades.includes(kind)) return false;
    if (kind !== "starfleet" && state.builds.some((b) => b.systemId === system.id && b.kind === kind))
      return false;
    player.resources = subRes(player.resources, cost);
    state.builds.push({
      id: uid("bld"),
      playerId: player.id,
      systemId: system.id,
      kind
    });
    return true;
  };
  const frontier = my.filter((s) => enemyNeighbors(state, s, player.id).length > 0);
  const interior = my.filter((s) => !frontier.includes(s));
  for (const s of [...interior, ...frontier]) {
    if (!s.upgrades.includes("mining")) tryBuild(s, "mining");
    if (!s.upgrades.includes("colony")) tryBuild(s, "colony");
  }
  for (const s of [...frontier, ...interior]) {
    if (!s.upgrades.includes("starport")) tryBuild(s, "starport");
    if (!s.upgrades.includes("shipyard")) tryBuild(s, "shipyard");
  }
  if (currentFleets + scheduledFleets < upkeepCap) {
    const yards = my.filter(
      (s) => s.upgrades.includes("shipyard") && !state.builds.some(
        (b) => b.systemId === s.id && b.kind === "shipyard"
      )
    );
    for (const s of yards) {
      if (currentFleets + state.builds.filter((b) => b.playerId === player.id && b.kind === "starfleet").length >= upkeepCap)
        break;
      tryBuild(s, "starfleet");
    }
  }
  if (rng() < 0.2) {
    const cand = interior.find((s) => !s.upgrades.includes("wormhole") && s.neighbors.length >= 4);
    if (cand) tryBuild(cand, "wormhole");
  }
  if (player.resources.tech >= 1 && rng() < 0.4) {
    const adjEnemy = frontier.flatMap((s) => enemyNeighbors(state, s, player.id));
    const t = adjEnemy[0];
    if (t && !state.options.disableCommunications) {
      player.resources.tech -= 1;
      const target = t.upgrades.includes("starport") && rng() < 0.5 ? "starport" : t.fleets.length ? "fleets" : t.upgrades[0] ?? "fleets";
      state.espionage.push({
        id: uid("esp"),
        playerId: player.id,
        kind: "sabotage",
        systemId: t.id,
        targetUpgrade: target
      });
    }
  }
  if (!state.options.disableCommunications) {
    for (const inc of openIncidentsFor(state, player.id)) {
      if (rng() < 0.75) {
        denounceAlliance(state, player.id, inc.actorId, inc.text);
        inc.status = "broke";
      } else {
        inc.status = "threatened";
        sendThreadMessage(state, {
          fromId: player.id,
          toId: inc.actorId,
          topic: "alliance",
          attitude: "belligerent",
          systemId: inc.systemId,
          terms: {
            intent: "with-you",
            unless: "withdraw from the slight and make amends"
          },
          status: "open"
        });
      }
    }
    for (const t of state.threads) {
      const last = t.messages[t.messages.length - 1];
      if (!last || last.toPlayerId !== player.id) continue;
      if (last.status && last.status !== "open") continue;
      const ask = last.terms?.request;
      const cheap = !ask || ask.tech + ask.metals + ask.chon <= 2;
      const wantsAlly = last.terms?.allianceClause === "form" || last.topic === "alliance" && last.terms?.intent !== "with-third";
      const wantsBreak = last.terms?.allianceClause === "break";
      if (wantsBreak && rng() < 0.4) {
        acceptOffer(state, player.id, last.id);
      } else if (wantsAlly && cheap && rng() < 0.65) {
        acceptOffer(state, player.id, last.id);
      } else if (last.topic === "trade" && last.terms && cheap && rng() < 0.55) {
        acceptOffer(state, player.id, last.id);
      }
    }
    for (const pact of unsentPactsFor(state, player.id)) {
      schedulePactDelivery(state, player.id, pact.id);
    }
    if (rng() < 0.85 || state.turn <= 2) {
      const others = state.players.filter((o) => o.id !== player.id && !o.collapsed);
      if (others.length) {
        const human = others.find((o) => o.kind === "human");
        const target = human && (state.turn <= 2 || rng() < 0.75) ? human : pick(rng, others);
        const giveDests = tradeFrontier(state, player.id, target.id);
        const askDests = tradeFrontier(state, target.id, player.id);
        const giveSystemId = giveDests[0];
        const requestSystemId = askDests[0];
        const canTrade = !!giveSystemId && !!requestSystemId;
        const alliedNow = areAllied(state, player.id, target.id);
        let topic = canTrade ? target.kind === "human" && state.turn <= 2 ? "trade" : rng() < 0.55 ? "trade" : rng() < 0.45 ? "attack" : alliedNow ? "trade" : "alliance" : alliedNow ? "intelligence" : "alliance";
        const terms = {};
        if ((topic === "trade" || topic === "alliance") && canTrade) {
          const give = cloneRes(ZERO);
          const request = cloneRes(ZERO);
          if (player.resources.metals >= 1 && rng() < 0.6) give.metals = 1;
          else if (player.resources.chon >= 1) give.chon = 1;
          else if (player.resources.tech >= 1) give.tech = 1;
          request.tech = rng() < 0.5 ? 1 : 0;
          if (!request.tech) request.chon = 1;
          terms.give = give;
          terms.request = request;
          terms.giveSystemId = giveSystemId;
          terms.requestSystemId = requestSystemId;
        }
        if (!alliedNow && (topic === "alliance" || topic === "trade" && rng() < 0.7)) {
          terms.allianceClause = "form";
          terms.intent = "with-you";
        } else if (topic === "attack") {
          const contested = state.systems.find(
            (s) => (s.ownerId === target.id || s.ownerId === player.id) && s.neighbors.some(
              (n) => state.systems.find((x) => x.id === n)?.ownerId === (s.ownerId === target.id ? player.id : target.id)
            ) && !areAllied(state, player.id, s.ownerId ?? "")
          );
          terms.intent = contested?.ownerId === target.id ? "vacate" : "i-attack";
          sendThreadMessage(state, {
            fromId: player.id,
            toId: target.id,
            topic,
            attitude: player.civ.attitude,
            systemId: contested?.id ?? my[0]?.id,
            neighborId: contested?.neighbors.find(
              (n) => my.some((s) => s.id === n)
            ),
            terms
          });
        }
        if (topic !== "attack") {
          sendThreadMessage(state, {
            fromId: player.id,
            toId: target.id,
            topic,
            attitude: player.civ.attitude,
            systemId: topic === "trade" ? giveSystemId ?? requestSystemId : giveDests[0] ?? my[0]?.id,
            aboutPlayerId: topic === "alliance" ? target.id : void 0,
            terms: Object.keys(terms).length ? terms : alliedNow ? { intent: "with-you" } : { intent: "with-you", allianceClause: "form" }
          });
        }
      }
    }
  }
  const homes = my.filter((s) => s.isHome);
  for (const f of myFleets) {
    const here = state.systems.find((s) => s.id === f.systemId);
    const homeAdj = here.neighbors.find(
      (n) => homes.some((h) => h.id === n)
    );
    const ownedAdj = here.neighbors.find(
      (n) => state.systems.find((x) => x.id === n)?.ownerId === player.id
    );
    f.rallySystemId = homeAdj ?? ownedAdj ?? null;
  }
  player.ready = true;
  void rng;
}

// src/lib/game/engine.ts
function createGame(args) {
  const [lo, hi] = PLAYER_RANGE_BOUNDS[args.options.playerRange];
  const count = Math.min(hi, Math.max(lo, args.options.playerCount));
  const options = { ...args.options, playerCount: count };
  const human = {
    id: uid("p"),
    kind: "human",
    name: args.displayName,
    civ: args.humanCiv,
    resources: cloneRes(ZERO),
    ready: false,
    collapsed: false,
    discoveredPlayerIds: [],
    discoveredSystemIds: []
  };
  const extras = (args.extraHumans ?? []).map((h) => ({
    id: uid("p"),
    kind: "human",
    name: h.name,
    civ: h.civ,
    resources: cloneRes(ZERO),
    ready: false,
    collapsed: false,
    discoveredPlayerIds: [],
    discoveredSystemIds: []
  }));
  const usedNames = /* @__PURE__ */ new Set([human.civ.name, ...extras.map((e) => e.civ.name)]);
  const players = [human, ...extras];
  const presets = presetCivs();
  let i = 0;
  while (players.length < count) {
    let civ = presets[i % presets.length];
    i++;
    if (usedNames.has(civ.name)) civ = randomCiv(args.seed, i);
    usedNames.add(civ.name);
    players.push({
      id: uid("p"),
      kind: "ai",
      name: civ.rulerTitle,
      civ: { ...civ, id: uid("civ") },
      resources: cloneRes(ZERO),
      ready: false,
      collapsed: false,
      discoveredPlayerIds: [],
      discoveredSystemIds: []
    });
  }
  let systems = generateMap(options, players, args.seed).systems;
  for (let attempt = 1; attempt < 6; attempt++) {
    const stranded = systems.some(
      (s) => s.neighbors.length < (s.isHome ? 3 : 3)
    );
    const reachable = (() => {
      if (!systems[0]) return true;
      const seen = /* @__PURE__ */ new Set([systems[0].id]);
      const q = [systems[0].id];
      const map = new Map(systems.map((s) => [s.id, s]));
      while (q.length) {
        const id = q.shift();
        for (const n of map.get(id)?.neighbors ?? []) {
          if (seen.has(n)) continue;
          seen.add(n);
          q.push(n);
        }
      }
      return seen.size === systems.length;
    })();
    if (!stranded && reachable) break;
    systems = generateMap(options, players, `${args.seed}:${attempt}`).systems;
  }
  spawnStartingFleets(systems, players, options);
  const homeFleets = HOME_DEV[options.homeDev].fleets;
  const homes = HOME_DEV;
  void homes;
  const homesEach = systems.filter((s) => s.originalHomePlayerId === human.id).length;
  for (const p of players) {
    const n = systems.filter((s) => s.originalHomePlayerId === p.id).length * homeFleets;
    p.resources = { tech: n, metals: n, chon: n };
  }
  const state = {
    version: SAVE_VERSION,
    id: uid("game"),
    seed: args.seed,
    name: `${human.civ.name} \u2014 ${options.gameType}`,
    options,
    turn: 1,
    phase: "activity",
    systems,
    players,
    builds: [],
    trades: [],
    espionage: [],
    threads: [],
    alliances: [],
    pacts: [],
    promiseReports: [],
    allyIncidents: [],
    log: [],
    archiveLog: [],
    winnerIds: null,
    result: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    humanPlayerId: human.id,
    actingPlayerId: human.id,
    sabotageUntilTurn: {},
    activeSabotage: {},
    destabilized: [],
    counterEspionage: [],
    destroyUpgrades: [],
    turnSnapshots: []
  };
  collectResources(state);
  applyUpkeep(state);
  for (const p of players) {
    if (options.uncharted) {
      const owned2 = systems.filter((s) => s.ownerId === p.id);
      p.discoveredSystemIds = [
        ...new Set(owned2.flatMap((s) => [s.id, ...s.neighbors]))
      ];
      p.discoveredPlayerIds = [p.id];
    } else {
      p.discoveredSystemIds = systems.map((s) => s.id);
      p.discoveredPlayerIds = players.map((x) => x.id);
    }
  }
  void homesEach;
  pushSnapshot(state);
  return state;
}
function scheduleBuild(state, playerId, systemId, kind) {
  const p = state.players.find((x) => x.id === playerId);
  const s = sysById(state, systemId);
  if (s.ownerId !== playerId) return "You do not control that system.";
  if (kind !== "starfleet" && s.upgrades.includes(kind)) {
    return "That upgrade is already present.";
  }
  if (kind !== "starfleet" && state.builds.some((b) => b.systemId === systemId && b.kind === kind)) {
    return "Already scheduled.";
  }
  const cost = BUILD_COST[kind];
  if (!canAfford(p.resources, cost)) return "Insufficient resources.";
  if (kind === "starfleet") {
    const buildingYard = state.builds.some(
      (b) => b.systemId === systemId && b.kind === "shipyard"
    );
    if (!s.upgrades.includes("shipyard") || buildingYard) {
      return "Starfleets require an existing shipyard (not one built this turn).";
    }
  }
  p.resources = subRes(p.resources, cost);
  state.builds.push({ id: uid("bld"), playerId, systemId, kind });
  return null;
}
function scheduleTrade(state, playerId, systemId, resources, toPlayerId) {
  const p = state.players.find((x) => x.id === playerId);
  const s = sysById(state, systemId);
  const ownedAdj = s.neighbors.some(
    (n) => sysById(state, n).ownerId === playerId
  );
  if (s.ownerId === playerId) return "Deliveries go to systems you do not currently own.";
  if (!ownedAdj) return "The destination must border a system you own.";
  if (!canAfford(p.resources, resources)) return "Insufficient resources.";
  if (resources.tech < 0 || resources.metals < 0 || resources.chon < 0) {
    return "Invalid delivery.";
  }
  p.resources = subRes(p.resources, resources);
  state.trades.push({
    id: uid("trd"),
    playerId,
    systemId,
    resources,
    toPlayerId: toPlayerId ?? s.ownerId ?? void 0
  });
  return null;
}
function scheduleEspionage(state, args) {
  const p = state.players.find((x) => x.id === args.playerId);
  if (state.options.disableCommunications && (args.kind === "fake" || args.kind === "intercept")) {
    return "Communications are disabled in this game.";
  }
  if (!canAfford(p.resources, ESPIONAGE_COST)) return "Requires 1 Tech.";
  if (args.kind === "sabotage" || args.kind === "destabilize") {
    if (!args.systemId) return "Select a system.";
    const s = sysById(state, args.systemId);
    if (s.ownerId === args.playerId || !s.ownerId) return "Target an enemy system.";
    const adj = s.neighbors.some((n) => sysById(state, n).ownerId === args.playerId);
    if (!adj) return "Target must be adjacent to a system you own.";
  }
  if (args.kind === "counter") {
    if (!args.systemId) return "Select a system.";
    const s = sysById(state, args.systemId);
    if (s.ownerId !== args.playerId) return "Counter-espionage is placed on a system you own.";
    const adjEnemy = s.neighbors.some((n) => {
      const o = sysById(state, n).ownerId;
      return o && o !== args.playerId;
    });
    if (!adjEnemy) return "The system must border an enemy system.";
  }
  p.resources = subRes(p.resources, ESPIONAGE_COST);
  state.espionage.push({ ...args, id: args.id || uid("esp") });
  return null;
}
function setFleetOrder(state, fleet, order) {
  if (fleet.scheduledDestroy) fleet.scheduledDestroy = false;
  if (order.kind === "move") {
    const s = sysById(state, fleet.systemId);
    const legal = s.neighbors.includes(order.destId) || order.wormholeJump === true && s.upgrades.includes("wormhole") && !s.fleets.some(
      (f) => f.id !== fleet.id && f.order.kind === "move" && f.order.wormholeJump
    );
    if (!legal && !s.neighbors.includes(order.destId)) {
      const fromWh = s.upgrades.includes("wormhole") && order.wormholeJump;
      if (!fromWh) return;
    }
  }
  fleet.order = order;
}
function dismissReport(state) {
  if (state.phase !== "report") return state;
  const next = { ...state, phase: "activity", log: [] };
  return next;
}
function resign(state, playerId) {
  const next = structuredClone(state);
  const p = next.players.find((x) => x.id === playerId);
  if (p) {
    p.collapsed = true;
    p.ready = true;
  }
  next.log = [
    ...next.log,
    {
      id: uid("log"),
      severity: "alert",
      text: `${p?.civ.name ?? "A civilization"}'s government has collapsed.`,
      playerId
    }
  ];
  return next;
}

// src/lib/game/vision.ts
function ownsOrAllyOwns(state, viewerId, ownerId) {
  if (!ownerId) return false;
  if (ownerId === viewerId) return true;
  return alliesOf(state, viewerId).includes(ownerId);
}
function visionOf(state, viewerId, system) {
  const p = state.players.find((x) => x.id === viewerId);
  if (!p) return "hidden";
  if (state.options.uncharted && !p.discoveredSystemIds.includes(system.id)) {
    return "hidden";
  }
  if (ownsOrAllyOwns(state, viewerId, system.ownerId)) return "visible";
  const adjOwned = system.neighbors.some((n) => {
    const s = state.systems.find((x) => x.id === n);
    return ownsOrAllyOwns(state, viewerId, s?.ownerId ?? null);
  });
  if (state.options.fogOfWar && !adjOwned) return "fog";
  return "visible";
}
function playerKnown(state, viewerId, otherId) {
  if (viewerId === otherId) return true;
  if (areAllied(state, viewerId, otherId)) return true;
  if (!state.options.uncharted) return true;
  const p = state.players.find((x) => x.id === viewerId);
  return !!p?.discoveredPlayerIds.includes(otherId);
}

// src/lib/game/host.ts
function viewForPlayer(state, viewerId) {
  const next = structuredClone(state);
  next.humanPlayerId = viewerId;
  next.actingPlayerId = viewerId;
  next.players = next.players.map((p) => {
    if (p.id === viewerId) return p;
    const known = playerKnown(state, viewerId, p.id);
    const blank = {
      ...p,
      resources: { ...ZERO },
      ready: false,
      discoveredPlayerIds: [],
      discoveredSystemIds: []
    };
    if (!known) {
      blank.name = "Unknown admiralty";
      blank.civ = {
        ...p.civ,
        name: "Unknown",
        racialName: "unknown",
        rulerTitle: "Ruler"
      };
    }
    return blank;
  });
  next.systems = next.systems.flatMap((sys2) => {
    const v = visionOf(state, viewerId, sys2);
    if (v === "hidden") return [];
    if (v === "fog") {
      return [
        {
          ...sys2,
          ownerId: null,
          upgrades: [],
          fleets: [],
          base: { ...ZERO },
          alienArtifact: false
        }
      ];
    }
    return [
      {
        ...sys2,
        fleets: sys2.fleets.map(
          (f) => f.ownerId === viewerId ? f : {
            ...f,
            order: { kind: "hold" },
            rallySystemId: null,
            scheduledDestroy: void 0
          }
        )
      }
    ];
  });
  next.builds = next.builds.filter((b) => b.playerId === viewerId);
  next.trades = next.trades.filter((t) => t.playerId === viewerId);
  next.espionage = next.espionage.filter((e) => e.playerId === viewerId);
  next.threads = structuredClone(visibleThreads(state, viewerId));
  next.pacts = next.pacts.filter((p) => p.aId === viewerId || p.bId === viewerId);
  next.promiseReports = next.promiseReports.filter(
    (r) => r.actorId === viewerId || r.otherId === viewerId
  );
  next.allyIncidents = next.allyIncidents.filter(
    (i) => i.actorId === viewerId || i.victimId === viewerId
  );
  next.log = next.log.filter((l) => !l.playerId || l.playerId === viewerId);
  next.destroyUpgrades = next.destroyUpgrades.filter((d) => d.playerId === viewerId);
  next.turnSnapshots = [];
  return next;
}
function markReady(state, playerId) {
  const next = structuredClone(state);
  const p = next.players.find((x) => x.id === playerId);
  if (p && !p.collapsed) p.ready = true;
  next.updatedAt = Date.now();
  return next;
}
function markUnready(state, playerId) {
  const next = structuredClone(state);
  if (next.phase !== "activity") return next;
  const p = next.players.find((x) => x.id === playerId);
  if (p && !p.collapsed) p.ready = false;
  next.updatedAt = Date.now();
  return next;
}
function allHumansReady(state) {
  const humans = state.players.filter((p) => p.kind === "human" && !p.collapsed);
  return humans.length > 0 && humans.every((p) => p.ready);
}
function shouldResolve(state, opts) {
  if (allHumansReady(state)) return true;
  const now = opts?.now ?? Date.now();
  return opts?.turnDueAt != null && now >= opts.turnDueAt;
}
function resolveIfDue(state, opts) {
  if (!shouldResolve(state, opts)) return state;
  const next = structuredClone(state);
  for (const p of next.players) {
    if (p.collapsed) continue;
    if (p.kind === "ai") runAi(next, p);
    else p.ready = true;
  }
  return resolveTurn(next);
}
function applyFleetOrder(state, playerId, fleetId, order) {
  for (const s of state.systems) {
    const f = s.fleets.find((x) => x.id === fleetId);
    if (!f) continue;
    if (f.ownerId !== playerId) return "That is not your starfleet.";
    setFleetOrder(state, f, order);
    return null;
  }
  return "Starfleet not found.";
}
function applyBuild(state, playerId, systemId, kind) {
  return scheduleBuild(state, playerId, systemId, kind);
}
function applyTrade2(state, playerId, systemId, resources, toPlayerId) {
  return scheduleTrade(state, playerId, systemId, resources, toPlayerId);
}
function applyEspionage2(state, args) {
  return scheduleEspionage(state, args);
}
function applyDismissReport(state) {
  return dismissReport(state);
}
function applyResign(state, playerId) {
  return resign(state, playerId);
}
function sendDispatch(state, args) {
  return sendThreadMessage(state, args);
}
function acceptDispatch(state, viewerId, messageId) {
  return acceptOffer(state, viewerId, messageId);
}
function declineDispatch(state, viewerId, messageId) {
  return declineOffer(state, viewerId, messageId);
}
function counterDispatch(state, viewerId, messageId, terms) {
  return counterOffer(state, viewerId, messageId, terms);
}
function denounce(state, fromId, toId, reason) {
  return denounceAlliance(state, fromId, toId, reason);
}
function answerIncident(state, viewerId, incidentId, action, unless) {
  return respondToIncident(state, viewerId, incidentId, action, unless);
}
function deliverPact(state, playerId, pactId) {
  return schedulePactDelivery(state, playerId, pactId);
}
function inboxForPlayer(state, playerId) {
  const threads = visibleThreads(state, playerId);
  const pending = threads.flatMap(
    (t) => t.messages.filter((m) => m.toPlayerId === playerId && (m.status === "open" || !m.status)).map((m) => ({
      threadId: t.id,
      message: m,
      peerId: t.participants.find((id) => id !== playerId) ?? m.fromPlayerId
    }))
  );
  const owed = unsentPactsFor(state, playerId);
  return {
    unread: unreadCount(state, playerId),
    pending,
    incidents: openIncidentsFor(state, playerId),
    unsentPacts: owed,
    owedDeliveries: owed.map((p) => {
      const half = pactHalf(p, playerId);
      return {
        pactId: p.id,
        resources: half.resources,
        systemId: half.systemId,
        otherId: half.otherId
      };
    }),
    promiseReports: (state.promiseReports ?? []).filter(
      (r) => r.actorId === playerId || r.otherId === playerId
    ),
    alliances: (state.alliances ?? []).filter((a) => a.a === playerId || a.b === playerId),
    allyIds: alliesOf(state, playerId),
    legalTradeIds: legalTradeDestinations(state, playerId)
  };
}
function tradeFrontierFor(state, senderId, recipientId) {
  return tradeFrontier(state, senderId, recipientId);
}
function recapFor(state, viewerId) {
  const snaps = state.turnSnapshots ?? [];
  const raw = snaps.length ? snaps[snaps.length - 1] : null;
  const players = slimPlayers(state);
  const snapshot = raw ? { ...raw, players: raw.players?.length ? raw.players : players } : null;
  return {
    turn: state.turn,
    previousTurn: Math.max(1, state.turn - 1),
    phase: state.phase,
    result: state.result ?? null,
    winnerIds: state.winnerIds ?? [],
    log: state.log ?? [],
    promiseReports: (state.promiseReports ?? []).filter(
      (r) => r.actorId === viewerId || r.otherId === viewerId
    ),
    snapshot,
    snapshotCount: snaps.length,
    players
  };
}
function openMatch(args) {
  return createGame({
    options: args.options,
    humanCiv: args.hostCiv,
    displayName: args.hostName,
    seed: args.seed
  });
}
function claimSeat(state, civ, name) {
  const slot = state.players.find((p) => p.kind === "ai" && !p.collapsed);
  if (!slot) return null;
  slot.kind = "human";
  slot.name = name;
  slot.civ = civ;
  slot.ready = false;
  state.updatedAt = Date.now();
  return slot;
}

// src/lib/game/persist.ts
function hydrateGame(g) {
  return {
    ...g,
    version: typeof g.version === "number" ? g.version : SAVE_VERSION,
    destroyUpgrades: g.destroyUpgrades ?? [],
    activeSabotage: g.activeSabotage ?? {},
    sabotageUntilTurn: g.sabotageUntilTurn ?? {},
    destabilized: g.destabilized ?? [],
    counterEspionage: g.counterEspionage ?? [],
    builds: g.builds ?? [],
    trades: g.trades ?? [],
    espionage: g.espionage ?? [],
    threads: g.threads ?? [],
    alliances: g.alliances ?? [],
    pacts: g.pacts ?? [],
    promiseReports: g.promiseReports ?? [],
    allyIncidents: g.allyIncidents ?? [],
    log: g.log ?? [],
    archiveLog: g.archiveLog ?? [],
    turnSnapshots: g.turnSnapshots ?? []
  };
}

// src/lib/game/legacy.ts
var UPGRADE_TO_LEGACY = {
  starport: "starport",
  shipyard: "shipyard",
  colony: "colony",
  mining: "mining_facilities",
  wormhole: "wormhole_generator"
};
var UPGRADE_FROM_LEGACY = {
  starfleet: "starfleet",
  starport: "starport",
  shipyard: "shipyard",
  colony: "colony",
  mining: "mining",
  mining_facilities: "mining",
  wormhole: "wormhole",
  wormhole_generator: "wormhole"
};
function optionsFromLegacy(cfg = {}) {
  const n = Math.max(3, Math.min(10, cfg.num_players ?? 4));
  const raw = cfg.game_type ?? "standard";
  const type = raw === "custom" || raw in GAME_TYPE_META ? raw : "standard";
  const size = cfg.galaxy_size ?? "standard";
  const density = size === "small" ? "light" : size === "large" ? "heavy" : "standard";
  const playerRange = n <= 5 ? "3-5" : n <= 6 ? "4-6" : n <= 8 ? "5-8" : "6-10";
  const base = optionsForType(type === "custom" ? "standard" : type, n);
  const fog = cfg.fow_mode === void 0 ? base.fogOfWar : cfg.fow_mode !== "off";
  return {
    ...base,
    playerRange,
    playerCount: n,
    systemDensity: density,
    homeDensity: density === "heavy" ? "standard" : density,
    fogOfWar: fog,
    turnDuration: "none"
  };
}
function openMatchLegacy(args) {
  const options = optionsFromLegacy(args.config);
  const civ = args.hostCiv ?? presetCivs()[0];
  return openMatch({
    options,
    hostCiv: { ...civ, id: civ.id },
    hostName: args.hostName,
    seed: args.seed ?? randomSeed()
  });
}
function upgradeToLegacy(u) {
  return UPGRADE_TO_LEGACY[u] ?? u;
}
function ordersLegacy(f, reveal) {
  if (!reveal) return null;
  if (f.order.kind === "move") {
    return { type: "move", target: f.order.destId, support_target: null };
  }
  if (f.order.kind === "support") {
    return {
      type: "support",
      target: f.order.destId,
      support_target: f.order.destId
    };
  }
  return null;
}
function visLegacy(v) {
  if (v === "visible") return "full";
  if (v === "fog") return "hidden";
  return "hidden";
}
function viewLegacy(state, viewerId, extras) {
  const started = extras?.started !== false;
  const fogOff = !state.options.fogOfWar && !state.options.uncharted;
  const viewer = viewerId ?? state.humanPlayerId;
  const me = state.players.find((p) => p.id === viewer);
  const systems = {};
  for (const s of state.systems) {
    const v = !started ? "hidden" : fogOff || !viewerId ? "visible" : visionOf(state, viewer, s);
    const vis = visLegacy(v);
    if (vis === "hidden") {
      systems[s.id] = {
        id: s.id,
        name: "???",
        x: s.x,
        y: s.y,
        owner: null,
        resources: null,
        connections: s.neighbors,
        starfleets: 0,
        starfleet_details: [],
        upgrades: [],
        is_home_system: false,
        visibility: "hidden",
        has_owner: null,
        has_upgrades: null
      };
      continue;
    }
    const revealOrders = true;
    systems[s.id] = {
      id: s.id,
      name: s.name,
      x: s.x,
      y: s.y,
      owner: s.ownerId,
      resources: { ...s.base },
      connections: s.neighbors,
      starfleets: s.fleets.length,
      starfleet_details: s.fleets.map((f) => ({
        id: f.id,
        owner: f.ownerId,
        orders: f.ownerId === viewer ? ordersLegacy(f, revealOrders) : null,
        rally_point: f.ownerId === viewer ? f.rallySystemId : null
      })),
      upgrades: s.upgrades.map(upgradeToLegacy),
      is_home_system: s.isHome,
      visibility: "full",
      has_owner: s.ownerId != null,
      has_upgrades: s.upgrades.length > 0
    };
  }
  const combat_reports = [...state.archiveLog, ...state.log].filter((l) => l.severity === "combat" || l.severity === "alert").map((l) => ({
    system: l.systemId ? state.systems.find((s) => s.id === l.systemId)?.name ?? l.systemId : "unknown",
    system_id: l.systemId,
    turn: state.turn,
    text: l.text,
    attackers: l.playerId ? { [l.playerId]: 1 } : {},
    defenders: 0,
    outcome: l.severity,
    casualties: { attackers: [], defenders: [] }
  }));
  const ended = state.phase === "ended";
  const victory = evaluateVictory(state, ended);
  const total = state.systems.length;
  const required = Math.floor(total / 2) + 1;
  let victory_status = null;
  if (victory.kind && victory.winnerIds[0]) {
    const w = victory.winnerIds[0];
    victory_status = {
      winner: w,
      condition: state.options.victory,
      condition_label: victory.reason,
      systems_controlled: playerSystemCount(state, w),
      total_systems: total,
      required_systems: required
    };
  }
  const score_card = state.players.map((p) => ({
    player_id: p.id,
    systems: playerSystemCount(state, p.id),
    starfleets: playerFleetCount(state, p.id),
    upgrades: state.systems.filter((s) => s.ownerId === p.id).reduce((n, s) => n + s.upgrades.length, 0),
    resources: { ...p.resources }
  }));
  const phase = !started ? "setup" : state.phase === "report" || state.phase === "resolving" ? "activity" : state.phase === "ended" ? "activity" : state.phase;
  const deadline = extras?.turnDueAt && !extras.turnPaused ? new Date(extras.turnDueAt).toISOString() : null;
  return {
    turn: state.turn,
    phase,
    turn_deadline: deadline,
    turn_time_seconds: extras?.turnSeconds ?? 300,
    turn_paused: !!extras?.turnPaused,
    turn_paused_remaining: extras?.turnPausedRemaining ?? 0,
    ready_players: state.players.filter((p) => p.ready && !p.collapsed).map((p) => p.id),
    systems,
    players: state.players.map((p) => p.id),
    player_resources: me ? { ...me.resources } : { ...ZERO },
    combat_reports,
    victory_status: ended ? victory_status : null,
    game_over: ended,
    final_victory: ended ? {
      ...victory_status ?? {},
      final_turn: state.turn,
      score_card
    } : null,
    config: {
      num_players: state.options.playerCount,
      galaxy_size: state.options.systemDensity,
      turn_time_seconds: extras?.turnSeconds ?? 300,
      fow_mode: state.options.fogOfWar ? "basic" : "off"
    },
    // Extra: App.js can ignore until the pouch is wired.
    kernel: viewerId ? stripKernelExtras(viewForPlayer(state, viewerId)) : null
  };
}
function stripKernelExtras(view) {
  return {
    threads: view.threads,
    alliances: view.alliances,
    pacts: view.pacts,
    promiseReports: view.promiseReports,
    allyIncidents: view.allyIncidents,
    players: view.players.map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      civ: p.civ,
      collapsed: p.collapsed
    }))
  };
}
function replayFrame(state) {
  const systems = {};
  for (const s of state.systems) {
    systems[s.id] = {
      id: s.id,
      name: s.name,
      x: s.x,
      y: s.y,
      owner: s.ownerId,
      upgrades: s.upgrades.map(upgradeToLegacy),
      resources: { ...s.base },
      connections: s.neighbors,
      is_home_system: s.isHome,
      starfleet_ids: s.fleets.map((f) => f.id)
    };
  }
  const starfleets = {};
  for (const s of state.systems) {
    for (const f of s.fleets) {
      starfleets[f.id] = { id: f.id, owner: f.ownerId, system_id: s.id };
    }
  }
  return {
    turn: state.turn,
    phase: state.phase,
    systems,
    starfleets,
    player_resources: Object.fromEntries(
      state.players.map((p) => [p.id, { ...p.resources }])
    ),
    combat_reports: state.log.filter((l) => l.severity === "combat").map((l) => ({
      system: l.systemId,
      turn: state.turn,
      text: l.text
    }))
  };
}
function applyLegacyFleetOrders(state, playerId, orders) {
  for (const o of orders) {
    const id = o.starfleet_id;
    if (!id) continue;
    const kind = o.order_type ?? "hold";
    if (kind === "defend" || kind === "hold" || kind === "retreat") {
      const err = applyFleetOrder(state, playerId, id, { kind: "hold" });
      if (err) return err;
      continue;
    }
    if (kind === "move") {
      const dest = o.target_system;
      if (!dest) return "Move needs a target system.";
      const err = applyFleetOrder(state, playerId, id, { kind: "move", destId: dest });
      if (err) return err;
      continue;
    }
    if (kind === "support") {
      const dest = o.support_target || o.target_system;
      if (!dest) return "Support needs a target system.";
      const supported = state.systems.flatMap((s) => s.fleets).find((f) => f.ownerId === playerId && f.order.kind === "move" && f.order.destId === dest)?.id ?? id;
      const err = applyFleetOrder(state, playerId, id, {
        kind: "support",
        destId: dest,
        supportedFleetId: supported
      });
      if (err) return err;
    }
  }
  return null;
}
function applyLegacyBuildOrders(state, playerId, orders) {
  for (const o of orders) {
    const raw = o.build_type ?? o.type;
    const systemId = o.system_id;
    if (!raw || !systemId) continue;
    const kind = UPGRADE_FROM_LEGACY[raw];
    if (!kind) return `Unknown build: ${raw}`;
    const err = applyBuild(state, playerId, systemId, kind);
    if (err) return err;
  }
  return null;
}
function applyLegacyRally(state, playerId, fleetId, rallySystemId) {
  for (const s of state.systems) {
    const f = s.fleets.find((x) => x.id === fleetId);
    if (!f) continue;
    if (f.ownerId !== playerId) return "That is not your starfleet.";
    if (rallySystemId) {
      const dest = state.systems.find((x) => x.id === rallySystemId);
      if (!dest || dest.ownerId !== playerId) {
        return "Rally must be a system you own.";
      }
    }
    f.rallySystemId = rallySystemId;
    return null;
  }
  return "Starfleet not found.";
}
function skipReport(state) {
  if (state.phase === "report") return applyDismissReport(state);
  return state;
}

// src/lib/game/cli.ts
function fail(msg) {
  return { ok: false, error: msg };
}
function ok(state, extra = {}) {
  return { ok: true, error: null, state, ...extra };
}
function requireState(req) {
  if (!req.state) throw new Error("state is required");
  return structuredClone(req.state);
}
function dispatch(req) {
  const op = req.op;
  switch (op) {
    case "ping":
      return { ok: true, error: null, pong: true, version: 6 };
    case "listGameTypes":
      return { ok: true, error: null, gameTypes: listGameTypes() };
    case "optionsForType":
      return {
        ok: true,
        error: null,
        options: optionsForType(
          req.gameType,
          req.playerCount
        )
      };
    case "presetCivs":
      return { ok: true, error: null, civs: presetCivs() };
    case "randomCiv":
      return {
        ok: true,
        error: null,
        civ: randomCiv(String(req.seed ?? "seed"), Number(req.index ?? 0))
      };
    case "openMatch": {
      const state = openMatch({
        options: req.options,
        hostCiv: req.hostCiv,
        hostName: String(req.hostName ?? "Commander"),
        seed: String(req.seed ?? randomSeed())
      });
      return ok(state);
    }
    case "claimSeat": {
      const state = requireState(req);
      const seat = claimSeat(
        state,
        req.civ,
        String(req.name ?? "Commander")
      );
      if (!seat) return fail("No open seat.");
      return ok(state, { player: seat });
    }
    case "viewForPlayer": {
      const state = requireState(req);
      const viewerId = String(req.viewerId ?? req.playerId ?? "");
      if (!viewerId) return fail("viewerId is required");
      return {
        ok: true,
        error: null,
        state,
        view: viewForPlayer(state, viewerId)
      };
    }
    case "applyFleetOrder": {
      const state = requireState(req);
      const err = applyFleetOrder(
        state,
        String(req.playerId),
        String(req.fleetId),
        req.order
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "applyBuild": {
      const state = requireState(req);
      const err = applyBuild(
        state,
        String(req.playerId),
        String(req.systemId),
        req.kind
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "applyTrade": {
      const state = requireState(req);
      const err = applyTrade2(
        state,
        String(req.playerId),
        String(req.systemId),
        req.resources,
        req.toPlayerId
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "applyEspionage": {
      const state = requireState(req);
      const err = applyEspionage2(
        state,
        req.espionage
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "markReady": {
      const state = markReady(requireState(req), String(req.playerId));
      return ok(state, { allReady: allHumansReady(state) });
    }
    case "markUnready":
      return ok(markUnready(requireState(req), String(req.playerId)));
    case "shouldResolve": {
      const state = requireState(req);
      return {
        ok: true,
        error: null,
        state,
        due: shouldResolve(state, {
          turnDueAt: req.turnDueAt
        })
      };
    }
    case "resolveIfDue": {
      const before = requireState(req);
      const state = resolveIfDue(before, {
        turnDueAt: req.turnDueAt
      });
      return ok(state, { resolved: state.turn !== before.turn || state.phase !== before.phase });
    }
    case "dismissReport":
      return ok(applyDismissReport(requireState(req)));
    case "resign":
      return ok(applyResign(requireState(req), String(req.playerId)));
    case "sendDispatch": {
      const state = requireState(req);
      const thread = sendDispatch(
        state,
        req.args
      );
      return ok(state, { thread });
    }
    case "acceptDispatch": {
      const state = requireState(req);
      const err = acceptDispatch(state, String(req.viewerId ?? req.playerId), String(req.messageId));
      if (err) return fail(err);
      return ok(state);
    }
    case "declineDispatch": {
      const state = requireState(req);
      const err = declineDispatch(state, String(req.viewerId ?? req.playerId), String(req.messageId));
      if (err) return fail(err);
      return ok(state);
    }
    case "counterDispatch": {
      const state = requireState(req);
      const err = counterDispatch(
        state,
        String(req.viewerId ?? req.playerId),
        String(req.messageId),
        req.terms
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "denounce": {
      const state = requireState(req);
      const err = denounce(state, String(req.playerId), String(req.toId), req.reason);
      if (err) return fail(err);
      return ok(state);
    }
    case "answerIncident": {
      const state = requireState(req);
      const err = answerIncident(
        state,
        String(req.viewerId ?? req.playerId),
        String(req.incidentId),
        req.action,
        req.unless
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "deliverPact": {
      const state = requireState(req);
      const err = deliverPact(state, String(req.playerId), String(req.pactId));
      if (err) return fail(err);
      return ok(state);
    }
    case "openMatchLegacy": {
      const state = openMatchLegacy({
        hostName: String(req.hostName ?? "Commander"),
        config: req.config ?? {},
        seed: req.seed
      });
      return ok(state);
    }
    case "viewLegacy": {
      const state = requireState(req);
      const viewerId = req.viewerId ?? req.playerId;
      return {
        ok: true,
        error: null,
        state,
        view: viewLegacy(state, viewerId ? String(viewerId) : null, {
          turnDueAt: req.turnDueAt,
          turnSeconds: req.turnSeconds,
          turnPaused: req.turnPaused,
          turnPausedRemaining: req.turnPausedRemaining,
          started: req.started
        })
      };
    }
    case "applyLegacyFleetOrders": {
      const state = requireState(req);
      const err = applyLegacyFleetOrders(
        state,
        String(req.playerId),
        req.orders ?? []
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "applyLegacyBuildOrders": {
      const state = requireState(req);
      const err = applyLegacyBuildOrders(
        state,
        String(req.playerId),
        req.orders ?? []
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "applyLegacyRally": {
      const state = requireState(req);
      const err = applyLegacyRally(
        state,
        String(req.playerId),
        String(req.fleetId),
        req.rallySystemId ?? null
      );
      if (err) return fail(err);
      return ok(state);
    }
    case "replayFrame": {
      const state = requireState(req);
      return { ok: true, error: null, state, frame: replayFrame(state) };
    }
    case "skipReport":
      return ok(skipReport(requireState(req)));
    case "claimSeatNamed": {
      const state = requireState(req);
      const civs = presetCivs();
      const civ = req.civ ?? randomCiv(String(req.seed ?? "join"), state.players.length);
      const seat = claimSeat(state, civ ?? civs[0], String(req.name ?? "Commander"));
      if (!seat) return fail("No open seat.");
      return ok(state, { player: seat });
    }
    case "serialize": {
      const state = requireState(req);
      return { ok: true, error: null, version: state.version, blob: state };
    }
    case "load": {
      const blob = req.blob ?? req.state;
      if (!blob || !blob.systems || !blob.players) return fail("blob is not a GameState");
      if (typeof blob.version === "number" && blob.version > SAVE_VERSION) {
        return fail(`blob version ${blob.version} is newer than kernel ${SAVE_VERSION}`);
      }
      return ok(hydrateGame(blob));
    }
    case "inboxForPlayer": {
      const state = requireState(req);
      const playerId = String(req.viewerId ?? req.playerId ?? "");
      if (!playerId) return fail("viewerId is required");
      return {
        ok: true,
        error: null,
        state,
        inbox: inboxForPlayer(state, playerId)
      };
    }
    case "legalTradeDestinations": {
      const state = requireState(req);
      return {
        ok: true,
        error: null,
        state,
        systemIds: legalTradeDestinations(state, String(req.playerId))
      };
    }
    case "tradeFrontier": {
      const state = requireState(req);
      return {
        ok: true,
        error: null,
        state,
        systemIds: tradeFrontierFor(
          state,
          String(req.playerId ?? req.senderId),
          String(req.toId ?? req.recipientId)
        )
      };
    }
    case "recap": {
      const state = requireState(req);
      const playerId = String(req.viewerId ?? req.playerId ?? "");
      if (!playerId) return fail("viewerId is required");
      return {
        ok: true,
        error: null,
        state,
        recap: recapFor(state, playerId)
      };
    }
    default:
      return fail(`unknown op: ${op}`);
  }
}
async function main() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    process.stdout.write(JSON.stringify(fail("empty stdin")) + "\n");
    process.exit(1);
  }
  let req;
  try {
    req = JSON.parse(raw);
  } catch {
    process.stdout.write(JSON.stringify(fail("invalid JSON")) + "\n");
    process.exit(1);
  }
  try {
    const result = dispatch(req);
    process.stdout.write(JSON.stringify(result) + "\n");
    if (result && typeof result === "object" && result.ok === false) {
      process.exit(2);
    }
  } catch (e) {
    process.stdout.write(
      JSON.stringify(fail(e instanceof Error ? e.message : String(e))) + "\n"
    );
    process.exit(1);
  }
}
void main();
