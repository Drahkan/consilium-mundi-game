import type { GameState, StarSystem } from "./types";

export function sysById(state: GameState, id: string): StarSystem {
  const s = state.systems.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown system ${id}`);
  return s;
}

export function adjMap(systems: StarSystem[]): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const s of systems) m.set(s.id, s.neighbors.slice());
  return m;
}

export function connected(
  systems: StarSystem[],
  start: string,
  passable: (id: string) => boolean,
): Set<string> {
  const seen = new Set<string>();
  if (!passable(start)) return seen;
  const q = [start];
  seen.add(start);
  const adj = adjMap(systems);
  while (q.length) {
    const id = q.shift()!;
    for (const n of adj.get(id) ?? []) {
      if (seen.has(n) || !passable(n)) continue;
      seen.add(n);
      q.push(n);
    }
  }
  return seen;
}

export function distances(
  systems: StarSystem[],
  start: string,
  passable: (id: string) => boolean,
): Map<string, number> {
  const dist = new Map<string, number>();
  if (!passable(start)) return dist;
  dist.set(start, 0);
  const q = [start];
  const adj = adjMap(systems);
  while (q.length) {
    const id = q.shift()!;
    const d = dist.get(id)!;
    for (const n of adj.get(id) ?? []) {
      if (dist.has(n) || !passable(n)) continue;
      dist.set(n, d + 1);
      q.push(n);
    }
  }
  return dist;
}

export function shortestPath(
  systems: StarSystem[],
  start: string,
  goal: string,
  passable: (id: string) => boolean,
): string[] | null {
  if (start === goal) return [start];
  const prev = new Map<string, string>();
  const q = [start];
  const seen = new Set([start]);
  const adj = adjMap(systems);
  while (q.length) {
    const id = q.shift()!;
    for (const n of adj.get(id) ?? []) {
      if (seen.has(n) || !passable(n)) continue;
      seen.add(n);
      prev.set(n, id);
      if (n === goal) {
        const path = [n];
        let cur = n;
        while (cur !== start) {
          cur = prev.get(cur)!;
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

export function hopsAway(
  systems: StarSystem[],
  start: string,
  maxHops: number,
): Set<string> {
  const out = new Set<string>();
  const dist = distances(systems, start, () => true);
  for (const [id, d] of dist) {
    if (d > 0 && d <= maxHops) out.add(id);
  }
  return out;
}

export function neighborsOf(systems: StarSystem[], id: string): StarSystem[] {
  const s = systems.find((x) => x.id === id);
  if (!s) return [];
  return s.neighbors
    .map((nid) => systems.find((x) => x.id === nid))
    .filter((x): x is StarSystem => !!x);
}

export function isAdjacent(a: StarSystem, bId: string): boolean {
  return a.neighbors.includes(bId);
}

/** Friendly-owned path from a system to any starport of the same owner. */
export function supplyDistance(
  systems: StarSystem[],
  systemId: string,
  ownerId: string,
  sabotagedStarports: Set<string>,
): { distToPort: number; portId: string | null; portToHome: number } {
  const owned = (id: string) =>
    systems.find((s) => s.id === id)?.ownerId === ownerId;

  const ports = systems.filter(
    (s) =>
      s.ownerId === ownerId &&
      s.upgrades.includes("starport") &&
      !sabotagedStarports.has(s.id),
  );
  if (ports.length === 0) {
    return { distToPort: Infinity, portId: null, portToHome: Infinity };
  }

  const fromSys = distances(systems, systemId, owned);
  let bestPort: StarSystem | null = null;
  let bestD = Infinity;
  for (const p of ports) {
    const d = fromSys.get(p.id);
    if (d !== undefined && d < bestD) {
      bestD = d;
      bestPort = p;
    }
  }
  if (!bestPort) {
    return { distToPort: Infinity, portId: null, portToHome: Infinity };
  }

  const homes = systems.filter(
    (s) => s.isHome && s.originalHomePlayerId === ownerId,
  );
  let homeD = Infinity;
  const fromPort = distances(systems, bestPort.id, owned);
  for (const h of homes) {
    const d = fromPort.get(h.id);
    if (d !== undefined && d < homeD) homeD = d;
  }
  if (!Number.isFinite(homeD)) {
    // Fall back to any currently owned home-flagged system
    const ownedHomes = systems.filter((s) => s.isHome && s.ownerId === ownerId);
    for (const h of ownedHomes) {
      const d = fromPort.get(h.id);
      if (d !== undefined && d < homeD) homeD = d;
    }
  }
  return { distToPort: bestD, portId: bestPort.id, portToHome: homeD };
}

export function isSupplied(
  systems: StarSystem[],
  systemId: string,
  ownerId: string,
  sabotagedStarports: Set<string>,
): boolean {
  return Number.isFinite(
    supplyDistance(systems, systemId, ownerId, sabotagedStarports).distToPort,
  );
}
