/**
 * Adapter: kernel GameState ↔ the JSON shape Emergent's App.js already
 * consumes (systems dict, owner, connections, starfleet_details, …).
 * Hosting should call these instead of rewriting the React UI in one shot.
 */
import type {
  BuildKind,
  Civilization,
  Fleet,
  GameOptions,
  GameState,
  GameTypeId,
  Resources,
  Upgrade,
} from "./types";
import { ZERO } from "./types";
import { GAME_TYPE_META, optionsForType } from "./constants";
import { presetCivs } from "./civs";
import { randomSeed } from "./mapgen";
import {
  applyBuild,
  applyDismissReport,
  applyFleetOrder,
  openMatch,
  viewForPlayer,
} from "./host";
import { visionOf } from "./vision";
import {
  evaluateVictory,
  playerFleetCount,
  playerSystemCount,
} from "./victory";

const UPGRADE_TO_LEGACY: Record<Upgrade, string> = {
  starport: "starport",
  shipyard: "shipyard",
  colony: "colony",
  mining: "mining_facilities",
  wormhole: "wormhole_generator",
};

const UPGRADE_FROM_LEGACY: Record<string, BuildKind> = {
  starfleet: "starfleet",
  starport: "starport",
  shipyard: "shipyard",
  colony: "colony",
  mining: "mining",
  mining_facilities: "mining",
  wormhole: "wormhole",
  wormhole_generator: "wormhole",
};

export interface LegacyConfig {
  num_players?: number;
  galaxy_size?: string;
  turn_time_limit?: number;
  turn_time_seconds?: number;
  fow_mode?: string;
  game_type?: string;
}

export function optionsFromLegacy(cfg: LegacyConfig = {}): GameOptions {
  const n = Math.max(3, Math.min(10, cfg.num_players ?? 4));
  const raw = cfg.game_type ?? "standard";
  const type: GameTypeId =
    raw === "custom" || raw in GAME_TYPE_META ? (raw as GameTypeId) : "standard";
  const size = cfg.galaxy_size ?? "standard";
  const density =
    size === "small" ? "light" : size === "large" ? "heavy" : "standard";
  const playerRange: GameOptions["playerRange"] =
    n <= 5 ? "3-5" : n <= 6 ? "4-6" : n <= 8 ? "5-8" : "6-10";
  const base = optionsForType(type === "custom" ? "standard" : type, n);
  const fog =
    cfg.fow_mode === undefined ? base.fogOfWar : cfg.fow_mode !== "off";
  return {
    ...base,
    playerRange,
    playerCount: n,
    systemDensity: density,
    homeDensity: density === "heavy" ? "standard" : density,
    fogOfWar: fog,
    turnDuration: "none",
  };
}

export function openMatchLegacy(args: {
  hostName: string;
  config?: LegacyConfig;
  seed?: string;
  hostCiv?: Civilization;
}): GameState {
  const options = optionsFromLegacy(args.config);
  const civ = args.hostCiv ?? presetCivs()[0]!;
  return openMatch({
    options,
    hostCiv: { ...civ, id: civ.id },
    hostName: args.hostName,
    seed: args.seed ?? randomSeed(),
  });
}

function upgradeToLegacy(u: Upgrade): string {
  return UPGRADE_TO_LEGACY[u] ?? u;
}

function ordersLegacy(f: Fleet, reveal: boolean): Record<string, unknown> | null {
  if (!reveal) return null;
  if (f.order.kind === "move") {
    return { type: "move", target: f.order.destId, support_target: null };
  }
  if (f.order.kind === "support") {
    return {
      type: "support",
      target: f.order.destId,
      support_target: f.order.destId,
    };
  }
  return null;
}

function visLegacy(
  v: ReturnType<typeof visionOf>,
): "full" | "partial" | "hidden" {
  if (v === "visible") return "full";
  if (v === "fog") return "hidden";
  return "hidden";
}

export function viewLegacy(
  state: GameState,
  viewerId: string | null,
  extras?: {
    turnDueAt?: number | null;
    turnSeconds?: number;
    turnPaused?: boolean;
    turnPausedRemaining?: number;
    started?: boolean;
  },
): Record<string, unknown> {
  const started = extras?.started !== false;
  const fogOff = !state.options.fogOfWar && !state.options.uncharted;
  const viewer = viewerId ?? state.humanPlayerId;
  const me = state.players.find((p) => p.id === viewer);

  const systems: Record<string, unknown> = {};
  for (const s of state.systems) {
    const v = !started
      ? "hidden"
      : fogOff || !viewerId
        ? "visible"
        : visionOf(state, viewer, s);
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
        has_upgrades: null,
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
        orders:
          f.ownerId === viewer
            ? ordersLegacy(f, revealOrders)
            : null,
        rally_point: f.ownerId === viewer ? f.rallySystemId : null,
      })),
      upgrades: s.upgrades.map(upgradeToLegacy),
      is_home_system: s.isHome,
      visibility: "full",
      has_owner: s.ownerId != null,
      has_upgrades: s.upgrades.length > 0,
    };
  }

  const combat_reports = [...state.archiveLog, ...state.log]
    .filter((l) => l.severity === "combat" || l.severity === "alert")
    .map((l) => ({
      system: l.systemId
        ? state.systems.find((s) => s.id === l.systemId)?.name ?? l.systemId
        : "unknown",
      system_id: l.systemId,
      turn: state.turn,
      text: l.text,
      attackers: l.playerId ? { [l.playerId]: 1 } : {},
      defenders: 0,
      outcome: l.severity,
      casualties: { attackers: [], defenders: [] },
    }));

  const ended = state.phase === "ended";
  const victory = evaluateVictory(state, ended);
  const total = state.systems.length;
  const required = Math.floor(total / 2) + 1;
  let victory_status: Record<string, unknown> | null = null;
  if (victory.kind && victory.winnerIds[0]) {
    const w = victory.winnerIds[0];
    victory_status = {
      winner: w,
      condition: state.options.victory,
      condition_label: victory.reason,
      systems_controlled: playerSystemCount(state, w),
      total_systems: total,
      required_systems: required,
    };
  }

  const score_card = state.players.map((p) => ({
    player_id: p.id,
    systems: playerSystemCount(state, p.id),
    starfleets: playerFleetCount(state, p.id),
    upgrades: state.systems
      .filter((s) => s.ownerId === p.id)
      .reduce((n, s) => n + s.upgrades.length, 0),
    resources: { ...p.resources },
  }));

  const phase =
    !started
      ? "setup"
      : state.phase === "report" || state.phase === "resolving"
        ? "activity"
        : state.phase === "ended"
          ? "activity"
          : state.phase;

  const deadline =
    extras?.turnDueAt && !extras.turnPaused
      ? new Date(extras.turnDueAt).toISOString()
      : null;

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
    final_victory: ended
      ? {
          ...(victory_status ?? {}),
          final_turn: state.turn,
          score_card,
        }
      : null,
    config: {
      num_players: state.options.playerCount,
      galaxy_size: state.options.systemDensity,
      turn_time_seconds: extras?.turnSeconds ?? 300,
      fow_mode: state.options.fogOfWar ? "basic" : "off",
    },
    // Extra: App.js can ignore until the pouch is wired.
    kernel: viewerId ? stripKernelExtras(viewForPlayer(state, viewerId)) : null,
  };
}

function stripKernelExtras(view: GameState) {
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
      collapsed: p.collapsed,
    })),
  };
}

export function replayFrame(state: GameState): Record<string, unknown> {
  const systems: Record<string, unknown> = {};
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
      starfleet_ids: s.fleets.map((f) => f.id),
    };
  }
  const starfleets: Record<string, unknown> = {};
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
      state.players.map((p) => [p.id, { ...p.resources }]),
    ),
    combat_reports: state.log
      .filter((l) => l.severity === "combat")
      .map((l) => ({
        system: l.systemId,
        turn: state.turn,
        text: l.text,
      })),
  };
}

export function applyLegacyFleetOrders(
  state: GameState,
  playerId: string,
  orders: Array<{
    starfleet_id?: string;
    order_type?: string;
    target_system?: string | null;
    support_target?: string | null;
  }>,
): string | null {
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
      const supported =
        state.systems
          .flatMap((s) => s.fleets)
          .find((f) => f.ownerId === playerId && f.order.kind === "move" && f.order.destId === dest)
          ?.id ?? id;
      const err = applyFleetOrder(state, playerId, id, {
        kind: "support",
        destId: dest,
        supportedFleetId: supported,
      });
      if (err) return err;
    }
  }
  return null;
}

export function applyLegacyBuildOrders(
  state: GameState,
  playerId: string,
  orders: Array<{ type?: string; build_type?: string; system_id?: string }>,
): string | null {
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

export function applyLegacyRally(
  state: GameState,
  playerId: string,
  fleetId: string,
  rallySystemId: string | null,
): string | null {
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

/** Auto-clear the vs-AI 'report' interstitial so App.js stays on activity. */
export function skipReport(state: GameState): GameState {
  if (state.phase === "report") return applyDismissReport(state);
  return state;
}

export type { Resources };
