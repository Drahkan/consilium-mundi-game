import type {
  BuildKind,
  Civilization,
  Fleet,
  GameOptions,
  GameState,
  Player,
  Profile,
  Resources,
  Upgrade,
} from "./types";
import { ZERO, addRes, canAfford, cloneRes, subRes } from "./types";
import {
  BUILD_COST,
  ESPIONAGE_COST,
  HOME_DEV,
  PLAYER_RANGE_BOUNDS,
  SAVE_VERSION,
} from "./constants";
import { presetCivs, randomCiv, uid } from "./civs";
import { generateMap, spawnStartingFleets } from "./mapgen";
import { applyUpkeep, collectResources, resolveTurn, setDestroyUpgrades } from "./resolve";
import { pushSnapshot } from "./snapshot";
import { runAi } from "./ai";
import { isAdjacent, sysById } from "./graph";
import { fleetCount } from "./mapgen";
import { unreadCount } from "./diplomacy";

export function defaultProfile(): Profile {
  const civs = presetCivs().slice(0, 1).map((c) => ({
    ...c,
    id: uid("civ"),
    name: "Terran Directorate",
  }));
  return {
    version: 1,
    displayName: "Commander",
    civilizations: civs,
    friends: [],
    stats: {
      gamesPlayed: 0,
      wins: 0,
      ties: 0,
      losses: 0,
      systemsTaken: 0,
      fleetsDestroyed: 0,
    },
  };
}

export function createGame(args: {
  options: GameOptions;
  humanCiv: Civilization;
  displayName: string;
  seed: string;
  extraHumans?: { civ: Civilization; name: string }[];
}): GameState {
  const [lo, hi] = PLAYER_RANGE_BOUNDS[args.options.playerRange];
  const count = Math.min(hi, Math.max(lo, args.options.playerCount));
  const options = { ...args.options, playerCount: count };

  const human: Player = {
    id: uid("p"),
    kind: "human",
    name: args.displayName,
    civ: args.humanCiv,
    resources: cloneRes(ZERO),
    ready: false,
    collapsed: false,
    discoveredPlayerIds: [],
    discoveredSystemIds: [],
  };

  const extras: Player[] = (args.extraHumans ?? []).map((h) => ({
    id: uid("p"),
    kind: "human" as const,
    name: h.name,
    civ: h.civ,
    resources: cloneRes(ZERO),
    ready: false,
    collapsed: false,
    discoveredPlayerIds: [],
    discoveredSystemIds: [],
  }));

  const usedNames = new Set([human.civ.name, ...extras.map((e) => e.civ.name)]);
  const players: Player[] = [human, ...extras];
  const presets = presetCivs();
  let i = 0;
  while (players.length < count) {
    let civ = presets[i % presets.length]!;
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
      discoveredSystemIds: [],
    });
  }

  let systems = generateMap(options, players, args.seed).systems;
  for (let attempt = 1; attempt < 6; attempt++) {
    const stranded = systems.some(
      (s) => s.neighbors.length < (s.isHome ? 3 : 3),
    );
    const reachable = (() => {
      if (!systems[0]) return true;
      const seen = new Set<string>([systems[0].id]);
      const q = [systems[0].id];
      const map = new Map(systems.map((s) => [s.id, s]));
      while (q.length) {
        const id = q.shift()!;
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
  const homes = HOME_DEV; // per player starting fleets = homes * fleets
  void homes;
  const homesEach = systems.filter((s) => s.originalHomePlayerId === human.id).length;
  for (const p of players) {
    const n =
      systems.filter((s) => s.originalHomePlayerId === p.id).length * homeFleets;
    p.resources = { tech: n, metals: n, chon: n };
  }

  const state: GameState = {
    version: SAVE_VERSION,
    id: uid("game"),
    seed: args.seed,
    name: `${human.civ.name} — ${options.gameType}`,
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
    turnSnapshots: [],
  };

  collectResources(state);
  applyUpkeep(state);

  for (const p of players) {
    if (options.uncharted) {
      const owned = systems.filter((s) => s.ownerId === p.id);
      p.discoveredSystemIds = [
        ...new Set(owned.flatMap((s) => [s.id, ...s.neighbors])),
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

export function acting(state: GameState): Player {
  return state.players.find((p) => p.id === state.actingPlayerId) ?? state.players[0]!;
}

export function spentThisTurn(state: GameState, playerId: string): Resources {
  let r = cloneRes(ZERO);
  for (const b of state.builds.filter((x) => x.playerId === playerId)) {
    r = addRes(r, BUILD_COST[b.kind]);
  }
  for (const t of state.trades.filter((x) => x.playerId === playerId)) {
    r = addRes(r, t.resources);
  }
  const esp = state.espionage.filter((x) => x.playerId === playerId).length;
  r = addRes(r, {
    tech: ESPIONAGE_COST.tech * esp,
    metals: 0,
    chon: 0,
  });
  return r;
}

export function availableResources(state: GameState, playerId: string): Resources {
  const p = state.players.find((x) => x.id === playerId)!;
  return p.resources;
}

export function scheduleBuild(
  state: GameState,
  playerId: string,
  systemId: string,
  kind: BuildKind,
): string | null {
  const p = state.players.find((x) => x.id === playerId)!;
  const s = sysById(state, systemId);
  if (s.ownerId !== playerId) return "You do not control that system.";
  if (kind !== "starfleet" && s.upgrades.includes(kind as Upgrade)) {
    return "That upgrade is already present.";
  }
  if (
    kind !== "starfleet" &&
    state.builds.some((b) => b.systemId === systemId && b.kind === kind)
  ) {
    return "Already scheduled.";
  }
  const cost = BUILD_COST[kind];
  if (!canAfford(p.resources, cost)) return "Insufficient resources.";
  if (kind === "starfleet") {
    const buildingYard = state.builds.some(
      (b) => b.systemId === systemId && b.kind === "shipyard",
    );
    if (!s.upgrades.includes("shipyard") || buildingYard) {
      return "Starfleets require an existing shipyard (not one built this turn).";
    }
  }
  p.resources = subRes(p.resources, cost);
  state.builds.push({ id: uid("bld"), playerId, systemId, kind });
  return null;
}

export function cancelBuild(state: GameState, buildId: string) {
  const b = state.builds.find((x) => x.id === buildId);
  if (!b) return;
  const p = state.players.find((x) => x.id === b.playerId);
  if (p) p.resources = addRes(p.resources, BUILD_COST[b.kind]);
  state.builds = state.builds.filter((x) => x.id !== buildId);
}

export function scheduleTrade(
  state: GameState,
  playerId: string,
  systemId: string,
  resources: Resources,
  toPlayerId?: string,
): string | null {
  const p = state.players.find((x) => x.id === playerId)!;
  const s = sysById(state, systemId);
  const ownedAdj = s.neighbors.some(
    (n) => sysById(state, n).ownerId === playerId,
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
    toPlayerId: toPlayerId ?? s.ownerId ?? undefined,
  });
  return null;
}

export function cancelTrade(state: GameState, id: string) {
  const t = state.trades.find((x) => x.id === id);
  if (!t) return;
  const p = state.players.find((x) => x.id === t.playerId);
  if (p) p.resources = addRes(p.resources, t.resources);
  state.trades = state.trades.filter((x) => x.id !== id);
}

export function scheduleEspionage(
  state: GameState,
  args: GameState["espionage"][number],
): string | null {
  const p = state.players.find((x) => x.id === args.playerId)!;
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

export function cancelEspionage(state: GameState, id: string) {
  const e = state.espionage.find((x) => x.id === id);
  if (!e) return;
  const p = state.players.find((x) => x.id === e.playerId);
  if (p) p.resources = addRes(p.resources, ESPIONAGE_COST);
  state.espionage = state.espionage.filter((x) => x.id !== id);
}

export function setFleetOrder(state: GameState, fleet: Fleet, order: Fleet["order"]) {
  if (fleet.scheduledDestroy) fleet.scheduledDestroy = false;
  if (order.kind === "move") {
    const s = sysById(state, fleet.systemId);
    const legal =
      s.neighbors.includes(order.destId) ||
      (order.wormholeJump === true &&
        s.upgrades.includes("wormhole") &&
        !s.fleets.some(
          (f) =>
            f.id !== fleet.id &&
            f.order.kind === "move" &&
            f.order.wormholeJump,
        ));
    if (!legal && !s.neighbors.includes(order.destId)) {
      // still allow if within 2 hops and WHG
      const fromWh =
        s.upgrades.includes("wormhole") && order.wormholeJump;
      if (!fromWh) return;
    }
  }
  fleet.order = order;
}

export function toggleDestroyFleet(state: GameState, fleet: Fleet): string | null {
  if (fleet.scheduledDestroy) {
    fleet.scheduledDestroy = false;
    return null;
  }
  fleet.scheduledDestroy = true;
  fleet.order = { kind: "hold" };
  return null;
}

export function toggleDestroyUpgrade(
  state: GameState,
  playerId: string,
  systemId: string,
  upgrade: Upgrade,
): string | null {
  const s = sysById(state, systemId);
  if (s.ownerId !== playerId) return "Not your system.";
  if (!s.upgrades.includes(upgrade)) return "No such upgrade.";
  const list = state.destroyUpgrades;
  const existing = list.find(
    (d) => d.systemId === systemId && d.upgrade === upgrade,
  );
  if (existing) {
    state.destroyUpgrades = list.filter((d) => d !== existing);
    return null;
  }
  if (upgrade === "shipyard") {
    if (state.builds.some((b) => b.systemId === systemId && b.kind === "starfleet")) {
      return "Un-schedule starfleet builds first.";
    }
  }
  if (upgrade === "starport") {
    const otherPorts = state.systems.filter(
      (x) =>
        x.ownerId === playerId &&
        x.id !== systemId &&
        x.upgrades.includes("starport") &&
        !list.some((d) => d.systemId === x.id && d.upgrade === "starport"),
    );
    const fleets = fleetCount(state.systems, playerId);
    if (otherPorts.length === 0 && fleets > 0) {
      return "Scuttle fleets that rely on this starport first, or keep another starport.";
    }
  }
  if (upgrade === "wormhole") {
    for (const f of s.fleets) {
      if (f.order.kind === "move" && f.order.wormholeJump) {
        f.order = { kind: "hold" };
      }
    }
  }
  list.push({ playerId, systemId, upgrade });
  setDestroyUpgrades(state, list);
  return null;
}

export function endTurn(state: GameState): GameState {
  const actor = acting(state);
  actor.ready = true;

  const humans = state.players.filter((p) => p.kind === "human" && !p.collapsed);
  const nextHuman = humans.find((p) => !p.ready);
  if (nextHuman) {
    state.actingPlayerId = nextHuman.id;
    state.updatedAt = Date.now();
    return state;
  }

  for (const p of state.players) {
    if (p.kind === "ai" && !p.collapsed) runAi(state, p);
  }

  const resolved = resolveTurn(state);
  if (resolved.phase !== "ended") {
    for (const p of resolved.players.filter((x) => x.kind === "human" && !x.collapsed)) {
      const n = unreadCount(resolved, p.id);
      if (n > 0) {
        const last = resolved.threads
          .flatMap((t) => t.messages)
          .filter((m) => m.toPlayerId === p.id && !m.read)
          .at(-1);
        const from = last
          ? resolved.players.find((x) => x.id === last.apparentFromId)?.civ.name
          : null;
        resolved.log.push({
          id: uid("log"),
          severity: "intel",
          text:
            n === 1
              ? `A dispatch from ${from ?? "another admiralty"} is waiting in the diplomatic pouch.`
              : `${n} diplomatic dispatches await the admiralty.`,
          playerId: p.id,
        });
      }
    }
  }
  if (resolved.phase === "ended") {
    resolved.actingPlayerId = resolved.humanPlayerId;
    return resolved;
  }
  resolved.actingPlayerId = resolved.humanPlayerId;
  // After report, first human acts
  const first = resolved.players.find((p) => p.kind === "human" && !p.collapsed);
  if (first) resolved.actingPlayerId = first.id;
  return resolved;
}

export function dismissReport(state: GameState): GameState {
  if (state.phase !== "report") return state;
  const next = { ...state, phase: "activity" as const, log: [] };
  return next;
}

export function resign(state: GameState, playerId: string): GameState {
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
      playerId,
    },
  ];
  return next;
}

export function isUpgradePendingDestroy(
  state: GameState,
  systemId: string,
  upgrade: Upgrade,
): boolean {
  return state.destroyUpgrades.some(
    (d) => d.systemId === systemId && d.upgrade === upgrade,
  );
}

export function adjacentOwned(
  state: GameState,
  playerId: string,
  systemId: string,
): boolean {
  const s = sysById(state, systemId);
  return s.neighbors.some((n) => sysById(state, n).ownerId === playerId);
}

export { isAdjacent };
