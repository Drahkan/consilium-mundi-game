import type {
  GameOptions,
  Player,
  Resources,
  StarSystem,
  Upgrade,
} from "./types";
import { ZERO } from "./types";
import {
  HOMES_PER_PLAYER,
  HOME_DEV,
  RESOURCE_TABLE,
  RESOURCE_WEIGHTS,
  SYSTEMS_PER_PLAYER,
} from "./constants";
import { makeRng, pick, randInt, shuffle, type Rng } from "./rng";
import { generateSystemNames } from "./names";
import { uid } from "./civs";

export interface GeneratedMap {
  systems: StarSystem[];
}

/** Faithful port of the original PHP generator (class_map.php / class_system.php). */
const MAP = 1000;
const CORE_R = MAP / 4;
const HOME_R = 150;
const NEAR_R = 250;
const MIN_DIST = 52;
const RING_R = MAP / 3;

function dist2(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function addEdge(a: StarSystem, b: StarSystem) {
  if (a.id === b.id) return;
  if (!a.neighbors.includes(b.id)) a.neighbors.push(b.id);
  if (!b.neighbors.includes(a.id)) b.neighbors.push(a.id);
}

function connectedCount(systems: StarSystem[]): number {
  if (systems.length === 0) return 0;
  const seen = new Set<string>();
  const q = [systems[0]!.id];
  seen.add(q[0]!);
  const byId = new Map(systems.map((s) => [s.id, s]));
  while (q.length) {
    const id = q.shift()!;
    for (const n of byId.get(id)?.neighbors ?? []) {
      if (seen.has(n)) continue;
      seen.add(n);
      q.push(n);
    }
  }
  return seen.size;
}

function weightedResource(rng: Rng, profile: GameOptions["systemResources"]): Resources {
  const weights = RESOURCE_WEIGHTS[profile];
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return { ...RESOURCE_TABLE[i]! };
  }
  return { ...RESOURCE_TABLE[0]! };
}

function minWormholes(s: StarSystem): number {
  if (s.kind === "home") return 4;
  if (s.kind === "core") return 4;
  return 3;
}

function maxWormholes(s: StarSystem): number {
  if (s.kind === "home") return 4;
  return 5;
}

function enemyHomes(a: StarSystem, b: StarSystem): boolean {
  return (
    a.kind === "home" &&
    b.kind === "home" &&
    !!a.originalHomePlayerId &&
    a.originalHomePlayerId !== b.originalHomePlayerId
  );
}

function canLink(a: StarSystem, b: StarSystem): boolean {
  if (a.id === b.id) return false;
  if (a.neighbors.includes(b.id)) return false;
  if (enemyHomes(a, b)) return false;
  if (a.neighbors.length >= maxWormholes(a)) return false;
  if (b.neighbors.length >= maxWormholes(b)) return false;
  // Owned home may not link to another group's unowned belt (PHP filler rule)
  if (a.kind === "home" && b.kind === "near" && a.homeGroupId !== b.homeGroupId) return false;
  if (b.kind === "home" && a.kind === "near" && a.homeGroupId !== b.homeGroupId) return false;
  return true;
}

function tryPlace(
  rng: Rng,
  existing: { x: number; y: number }[],
  origin: { x: number; y: number },
  minR: number,
  maxR: number,
  attempts: number,
): { x: number; y: number } | null {
  for (let t = 0; t < attempts; t++) {
    const ang = rng() * Math.PI * 2;
    const r = minR + Math.sqrt(rng()) * (maxR - minR);
    const p = { x: origin.x + Math.cos(ang) * r, y: origin.y + Math.sin(ang) * r };
    if (p.x < 40 || p.x > MAP - 40 || p.y < 40 || p.y > MAP - 40) continue;
    if (existing.every((o) => dist2(p, o) >= MIN_DIST * MIN_DIST)) return p;
  }
  return null;
}

function makeSystem(args: {
  name: string;
  x: number;
  y: number;
  kind: StarSystem["kind"];
  ownerId: string | null;
  homeGroupId?: string;
  base: Resources;
  upgrades: Upgrade[];
}): StarSystem {
  return {
    id: uid("sys"),
    name: args.name,
    x: args.x,
    y: args.y,
    neighbors: [],
    ownerId: args.ownerId,
    isHome: args.kind === "home",
    originalHomePlayerId: args.kind === "home" ? args.ownerId ?? undefined : undefined,
    homeGroupId: args.homeGroupId,
    kind: args.kind,
    base: args.base,
    alienArtifact: false,
    upgrades: args.upgrades,
    fleets: [],
  };
}

function nearestLegal(
  from: StarSystem,
  systems: StarSystem[],
  pred: (s: StarSystem) => boolean,
): StarSystem | null {
  let best: StarSystem | null = null;
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

function assignBalancedResources(
  rng: Rng,
  systems: StarSystem[],
  players: Player[],
  profile: GameOptions["systemResources"],
) {
  const near = systems.filter((s) => s.kind === "near");
  const core = systems.filter((s) => s.kind === "core");
  const unowned = [...near, ...core];
  const bag: Resources[] = unowned.map(() => weightedResource(rng, profile));

  const perPlayer = players.map((p) => near.filter((s) => s.homeGroupId === p.id));
  const nEach = perPlayer[0]?.length ?? 0;

  // Target totals = average bag value * systems in each belt
  const sum = bag.reduce(
    (a, r) => ({ tech: a.tech + r.tech, metals: a.metals + r.metals, chon: a.chon + r.chon }),
    { tech: 0, metals: 0, chon: 0 },
  );
  const avg = {
    tech: nEach === 0 ? 0 : Math.round((sum.tech / Math.max(1, unowned.length)) * nEach),
    metals: nEach === 0 ? 0 : Math.round((sum.metals / Math.max(1, unowned.length)) * nEach),
    chon: nEach === 0 ? 0 : Math.round((sum.chon / Math.max(1, unowned.length)) * nEach),
  };

  let assigned: Map<string, Resources> | null = null;
  for (let attempt = 0; attempt < 80 && nEach > 0; attempt++) {
    const pool = shuffle(rng, bag.slice());
    const map = new Map<string, Resources>();
    let ok = true;
    for (const group of perPlayer) {
      let t = 0,
        m = 0,
        c = 0;
      for (let i = 0; i < group.length; i++) {
        const last = i === group.length - 1;
        let pickI = -1;
        for (let k = 0; k < pool.length; k++) {
          const r = pool[k]!;
          const nt = t + r.tech,
            nm = m + r.metals,
            nc = c + r.chon;
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
          ok = false;
          break;
        }
        const r = pool.splice(pickI, 1)[0]!;
        t += r.tech;
        m += r.metals;
        c += r.chon;
        map.set(group[i]!.id, r);
      }
      if (!ok) break;
    }
    if (ok) {
      assigned = map;
      // leftover bag -> core
      for (const s of core) {
        assigned.set(s.id, pool.shift() ?? { tech: 0, metals: 0, chon: 0 });
      }
      break;
    }
  }

  if (!assigned) {
    const pool = shuffle(rng, bag.slice());
    assigned = new Map();
    for (const s of unowned) assigned.set(s.id, pool.shift() ?? { tech: 0, metals: 0, chon: 0 });
  }

  for (const s of unowned) s.base = assigned.get(s.id) ?? { tech: 0, metals: 0, chon: 0 };
}

function wireWormholes(systems: StarSystem[], players: Player[]) {
  const byId = new Map(systems.map((s) => [s.id, s]));

  // 1. Complete graph of each player's owned homes
  for (const p of players) {
    const homes = systems.filter((s) => s.kind === "home" && s.originalHomePlayerId === p.id);
    for (let i = 0; i < homes.length; i++) {
      for (let j = i + 1; j < homes.length; j++) addEdge(homes[i]!, homes[j]!);
    }
  }

  // 2. Each group: nearest unused near-system to an unused core, then that near to nearest owned home
  const usedNear = new Set<string>();
  const usedCore = new Set<string>();
  for (const p of players) {
    const nears = systems.filter((s) => s.kind === "near" && s.homeGroupId === p.id);
    const cores = systems.filter((s) => s.kind === "core");
    let bestN: StarSystem | null = null;
    let bestC: StarSystem | null = null;
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
        (s) => s.kind === "home" && s.originalHomePlayerId === p.id,
      );
      if (home) addEdge(bestN, home);
    }
  }

  // 3. Adjacent groups on the ring: nearest unused near-to-near, then each to own home
  for (let i = 0; i < players.length; i++) {
    const a = players[i]!;
    const b = players[(i + 1) % players.length]!;
    const nearsA = systems.filter((s) => s.kind === "near" && s.homeGroupId === a.id);
    const nearsB = systems.filter((s) => s.kind === "near" && s.homeGroupId === b.id);
    let bestA: StarSystem | null = null;
    let bestB: StarSystem | null = null;
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
        (s) => s.kind === "home" && s.originalHomePlayerId === a.id,
      );
      const hb = nearestLegal(
        bestB,
        systems,
        (s) => s.kind === "home" && s.originalHomePlayerId === b.id,
      );
      if (ha) addEdge(bestA, ha);
      if (hb) addEdge(bestB, hb);
    }
  }

  // 4. Core-to-core until min degree
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

  // 5. Filler — nearest legal until min degree (PHP GenerateWormhole)
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

  // 6. Connectivity bridges (never enemy homes)
  guard = 0;
  while (connectedCount(systems) < systems.length && guard++ < 80) {
    const seen = new Set<string>();
    const q = [systems[0]!.id];
    seen.add(q[0]!);
    while (q.length) {
      const id = q.shift()!;
      for (const n of byId.get(id)?.neighbors ?? []) {
        if (seen.has(n)) continue;
        seen.add(n);
        q.push(n);
      }
    }
    const inside = systems.filter((s) => seen.has(s.id));
    const outside = systems.filter((s) => !seen.has(s.id));
    let bestA: StarSystem | null = null;
    let bestB: StarSystem | null = null;
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

  // Degree floor for unowned
  for (const s of systems) {
    if (s.kind === "home") continue;
    while (s.neighbors.length < 3) {
      const n = nearestLegal(s, systems, (o) => !s.neighbors.includes(o.id));
      if (!n) break;
      addEdge(s, n);
    }
  }
}

function initLayout(
  rng: Rng,
  options: GameOptions,
  players: Player[],
  names: string[],
): StarSystem[] | null {
  const nPlayers = players.length;
  const total = SYSTEMS_PER_PLAYER[options.systemDensity] * nPlayers + 1;
  const homesEach = HOMES_PER_PLAYER[options.homeDensity];
  const homeSpec = HOME_DEV[options.homeDev];

  const systems: StarSystem[] = [];
  const existing: { x: number; y: number }[] = [];

  const cx = MAP / 2;
  const cy = MAP / 2;
  const spin = rng() * Math.PI * 0.5;

  const centers = players.map((_, i) => {
    const a = (Math.PI * 2 * i) / nPlayers - Math.PI / 2 + spin;
    return { x: cx + Math.cos(a) * RING_R, y: cy + Math.sin(a) * RING_R };
  });

  // Owned homes in a disk around each player center
  for (let p = 0; p < nPlayers; p++) {
    const origin = centers[p]!;
    for (let h = 0; h < homesEach; h++) {
      const pt = tryPlace(rng, existing, origin, 0, HOME_R, 90);
      if (!pt) return null;
      existing.push(pt);
      systems.push(
        makeSystem({
          name: names[systems.length]!,
          x: pt.x,
          y: pt.y,
          kind: "home",
          ownerId: players[p]!.id,
          homeGroupId: players[p]!.id,
          base: { ...homeSpec.prod },
          upgrades: [...homeSpec.upgrades],
        }),
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

  // Core disk
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
        upgrades: [],
      }),
    );
  }

  // Near belt around each home center (outside home disk, inside player radius)
  for (let p = 0; p < nPlayers; p++) {
    const origin = centers[p]!;
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
          homeGroupId: players[p]!.id,
          base: ZERO,
          upgrades: [],
        }),
      );
    }
  }

  if (systems.length !== total) return null;
  return systems;
}

export function generateMap(
  options: GameOptions,
  players: Player[],
  seed: string,
): GeneratedMap {
  const rng = makeRng(seed, 0x51ed);
  const nPlayers = players.length;
  const total = SYSTEMS_PER_PLAYER[options.systemDensity] * nPlayers + 1;
  const names = generateSystemNames(rng, total + 8);

  let systems: StarSystem[] | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    const child = makeRng(`${seed}:${attempt}`, 0x51ed);
    systems = initLayout(child, options, players, names);
    if (systems) break;
  }
  if (!systems) {
    // Last-ditch: reuse the last attempt even if short
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

export function spawnStartingFleets(
  systems: StarSystem[],
  players: Player[],
  options: GameOptions,
): void {
  const n = HOME_DEV[options.homeDev].fleets;
  for (const p of players) {
    for (const s of systems.filter((x) => x.originalHomePlayerId === p.id)) {
      for (let i = 0; i < n; i++) {
        s.fleets.push({
          id: uid("flt"),
          ownerId: p.id,
          systemId: s.id,
          order: { kind: "hold" },
          rallySystemId: null,
        });
      }
    }
  }
}

export function productionOf(
  s: StarSystem,
  sabotage?: "colony" | "mining" | Upgrade | "fleets",
): Resources {
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

export function totalProduction(
  systems: StarSystem[],
  playerId: string,
  activeSabotage: Record<string, Upgrade | "fleets">,
): Resources {
  let acc: Resources = { tech: 0, metals: 0, chon: 0 };
  for (const s of systems) {
    if (s.ownerId !== playerId) continue;
    const p = productionOf(s, activeSabotage[s.id]);
    acc.tech += p.tech;
    acc.metals += p.metals;
    acc.chon += p.chon;
  }
  return acc;
}

export function fleetCount(systems: StarSystem[], playerId: string): number {
  let n = 0;
  for (const s of systems) n += s.fleets.filter((f) => f.ownerId === playerId).length;
  return n;
}

export function randomSeed(): string {
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
    "gilded",
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
    "survey",
  ];
  const rng = makeRng(String(Date.now()), randInt(() => Math.random(), 1, 1e9));
  return `${pick(rng, adj)}-${pick(rng, noun)}-${randInt(rng, 10, 99)}`;
}
