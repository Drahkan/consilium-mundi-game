/**
 * Server-shaped API for a hosted match. The vs-AI client does not need this;
 * FastAPI/Node should call these instead of reimplementing combat or diplomacy.
 *
 * Persist the returned (or mutated) GameState document. Send clients
 * `viewForPlayer`, never the full state.
 */
import type {
  Attitude,
  BuildKind,
  Civilization,
  DiplomacyTerms,
  Fleet,
  GameOptions,
  GameState,
  MessageTopic,
  Player,
  Resources,
} from "./types";
import { ZERO } from "./types";
import {
  createGame,
  dismissReport,
  resign,
  scheduleBuild,
  scheduleEspionage,
  scheduleTrade,
  setFleetOrder,
} from "./engine";
import { runAi } from "./ai";
import { resolveTurn } from "./resolve";
import { visionOf, playerKnown } from "./vision";
import { unreadCount, sendThreadMessage, visibleThreads, legalTradeDestinations, tradeFrontier, acceptOffer, counterOffer, declineOffer, denounceAlliance, respondToIncident, schedulePactDelivery } from "./diplomacy";
import { openIncidentsFor, unsentPactsFor, pactHalf, alliesOf } from "./alliance";

export function viewForPlayer(state: GameState, viewerId: string): GameState {
  const next = structuredClone(state);
  next.humanPlayerId = viewerId;
  next.actingPlayerId = viewerId;

  next.players = next.players.map((p) => {
    if (p.id === viewerId) return p;
    const known = playerKnown(state, viewerId, p.id);
    const blank: Player = {
      ...p,
      resources: { ...ZERO },
      ready: false,
      discoveredPlayerIds: [],
      discoveredSystemIds: [],
    };
    if (!known) {
      blank.name = "Unknown admiralty";
      blank.civ = {
        ...p.civ,
        name: "Unknown",
        racialName: "unknown",
        rulerTitle: "Ruler",
      };
    }
    return blank;
  });

  next.systems = next.systems.flatMap((sys) => {
    const v = visionOf(state, viewerId, sys);
    if (v === "hidden") return [];
    if (v === "fog") {
      return [
        {
          ...sys,
          ownerId: null,
          upgrades: [],
          fleets: [],
          base: { ...ZERO },
          alienArtifact: false,
        },
      ];
    }
    return [
      {
        ...sys,
        fleets: sys.fleets.map((f) =>
          f.ownerId === viewerId
            ? f
            : {
                ...f,
                order: { kind: "hold" as const },
                rallySystemId: null,
                scheduledDestroy: undefined,
              },
        ),
      },
    ];
  });

  next.builds = next.builds.filter((b) => b.playerId === viewerId);
  next.trades = next.trades.filter((t) => t.playerId === viewerId);
  next.espionage = next.espionage.filter((e) => e.playerId === viewerId);
  next.threads = structuredClone(visibleThreads(state, viewerId));
  next.pacts = next.pacts.filter((p) => p.aId === viewerId || p.bId === viewerId);
  next.promiseReports = next.promiseReports.filter(
    (r) => r.actorId === viewerId || r.otherId === viewerId,
  );
  next.allyIncidents = next.allyIncidents.filter(
    (i) => i.actorId === viewerId || i.victimId === viewerId,
  );
  next.log = next.log.filter((l) => !l.playerId || l.playerId === viewerId);
  next.destroyUpgrades = next.destroyUpgrades.filter((d) => d.playerId === viewerId);
  next.turnSnapshots = [];
  return next;
}

export function markReady(state: GameState, playerId: string): GameState {
  const next = structuredClone(state);
  const p = next.players.find((x) => x.id === playerId);
  if (p && !p.collapsed) p.ready = true;
  next.updatedAt = Date.now();
  return next;
}

export function markUnready(state: GameState, playerId: string): GameState {
  const next = structuredClone(state);
  if (next.phase !== "activity") return next;
  const p = next.players.find((x) => x.id === playerId);
  if (p && !p.collapsed) p.ready = false;
  next.updatedAt = Date.now();
  return next;
}

export function allHumansReady(state: GameState): boolean {
  const humans = state.players.filter((p) => p.kind === "human" && !p.collapsed);
  return humans.length > 0 && humans.every((p) => p.ready);
}

/** True when every living human is ready, or the turn clock has expired. */
export function shouldResolve(
  state: GameState,
  opts?: { turnDueAt?: number; now?: number },
): boolean {
  if (allHumansReady(state)) return true;
  const now = opts?.now ?? Date.now();
  return opts?.turnDueAt != null && now >= opts.turnDueAt;
}

/**
 * If due, fill AI orders, auto-ready any human who missed the clock (empty
 * orders = hold), then resolve once. Otherwise return the state unchanged.
 */
export function resolveIfDue(
  state: GameState,
  opts?: { turnDueAt?: number; now?: number },
): GameState {
  if (!shouldResolve(state, opts)) return state;
  const next = structuredClone(state);
  for (const p of next.players) {
    if (p.collapsed) continue;
    if (p.kind === "ai") runAi(next, p);
    else p.ready = true;
  }
  return resolveTurn(next);
}

export function applyFleetOrder(
  state: GameState,
  playerId: string,
  fleetId: string,
  order: Fleet["order"],
): string | null {
  for (const s of state.systems) {
    const f = s.fleets.find((x) => x.id === fleetId);
    if (!f) continue;
    if (f.ownerId !== playerId) return "That is not your starfleet.";
    setFleetOrder(state, f, order);
    return null;
  }
  return "Starfleet not found.";
}

export function applyBuild(
  state: GameState,
  playerId: string,
  systemId: string,
  kind: BuildKind,
): string | null {
  return scheduleBuild(state, playerId, systemId, kind);
}

export function applyTrade(
  state: GameState,
  playerId: string,
  systemId: string,
  resources: Resources,
  toPlayerId?: string,
): string | null {
  return scheduleTrade(state, playerId, systemId, resources, toPlayerId);
}

export function applyEspionage(
  state: GameState,
  args: GameState["espionage"][number],
): string | null {
  return scheduleEspionage(state, args);
}

export function applyDismissReport(state: GameState): GameState {
  return dismissReport(state);
}

export function applyResign(state: GameState, playerId: string): GameState {
  return resign(state, playerId);
}

export function sendDispatch(
  state: GameState,
  args: Parameters<typeof sendThreadMessage>[1],
) {
  return sendThreadMessage(state, args);
}

export function acceptDispatch(state: GameState, viewerId: string, messageId: string) {
  return acceptOffer(state, viewerId, messageId);
}

export function declineDispatch(state: GameState, viewerId: string, messageId: string) {
  return declineOffer(state, viewerId, messageId);
}

export function counterDispatch(
  state: GameState,
  viewerId: string,
  messageId: string,
  terms: DiplomacyTerms,
) {
  return counterOffer(state, viewerId, messageId, terms);
}

export function denounce(state: GameState, fromId: string, toId: string, reason?: string) {
  return denounceAlliance(state, fromId, toId, reason);
}

export function answerIncident(
  state: GameState,
  viewerId: string,
  incidentId: string,
  action: "ignored" | "broke" | "threatened",
  unless?: string,
) {
  return respondToIncident(state, viewerId, incidentId, action, unless);
}

export function deliverPact(state: GameState, playerId: string, pactId: string) {
  return schedulePactDelivery(state, playerId, pactId);
}

/** Pending pouch items for one admiralty. Hosting should surface these; do not re-filter. */
export function inboxForPlayer(state: GameState, playerId: string) {
  const threads = visibleThreads(state, playerId);
  const pending = threads.flatMap((t) =>
    t.messages
      .filter((m) => m.toPlayerId === playerId && (m.status === "open" || !m.status))
      .map((m) => ({
        threadId: t.id,
        message: m,
        peerId: t.participants.find((id) => id !== playerId) ?? m.fromPlayerId,
      })),
  );
  const owed = unsentPactsFor(state, playerId);
  return {
    unread: unreadCount(state, playerId),
    pending,
    incidents: openIncidentsFor(state, playerId),
    unsentPacts: owed,
    owedDeliveries: owed.map((p) => {
      const half = pactHalf(p, playerId)!;
      return {
        pactId: p.id,
        resources: half.resources,
        systemId: half.systemId,
        otherId: half.otherId,
      };
    }),
    promiseReports: (state.promiseReports ?? []).filter(
      (r) => r.actorId === playerId || r.otherId === playerId,
    ),
    alliances: (state.alliances ?? []).filter((a) => a.a === playerId || a.b === playerId),
    allyIds: alliesOf(state, playerId),
    legalTradeIds: legalTradeDestinations(state, playerId),
  };
}

export function tradeFrontierFor(
  state: GameState,
  senderId: string,
  recipientId: string,
) {
  return tradeFrontier(state, senderId, recipientId);
}

export function openMatch(args: {
  options: GameOptions;
  hostCiv: Civilization;
  hostName: string;
  seed: string;
}): GameState {
  return createGame({
    options: args.options,
    humanCiv: args.hostCiv,
    displayName: args.hostName,
    seed: args.seed,
  });
}

/** Seat a human into an AI slot (lobby join). Returns false if no AI seat left. */
export function claimSeat(
  state: GameState,
  civ: Civilization,
  name: string,
): Player | null {
  const slot = state.players.find((p) => p.kind === "ai" && !p.collapsed);
  if (!slot) return null;
  slot.kind = "human";
  slot.name = name;
  slot.civ = civ;
  slot.ready = false;
  state.updatedAt = Date.now();
  return slot;
}

export type {
  Attitude,
  Civilization,
  DiplomacyTerms,
  GameOptions,
  GameState,
  MessageTopic,
};
