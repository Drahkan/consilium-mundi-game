import type {
  AllyIncident,
  EspionageKind,
  Fleet,
  GameState,
  MessageTopic,
  Pact,
  PromiseReport,
  Resources,
  ScheduledEspionage,
  ScheduledTrade,
} from "./types";
import { ZERO, cloneRes, resEqual, resSum } from "./types";
import { civTheName, uid } from "./civs";

function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

function civName(state: GameState, id: string): string {
  const p = state.players.find((x) => x.id === id);
  return p ? civTheName(p.civ) : "an unknown power";
}

function sysName(state: GameState, id?: string): string {
  if (!id) return "the designated system";
  return state.systems.find((s) => s.id === id)?.name ?? "the designated system";
}

export function formatGoods(r?: Resources): string {
  if (!r) return "nothing";
  const bits: string[] = [];
  if (r.tech) bits.push(`${r.tech} Tech`);
  if (r.metals) bits.push(`${r.metals} Metals`);
  if (r.chon) bits.push(`${r.chon} CHON`);
  return bits.length ? bits.join(", ") : "nothing";
}

export function goodsNonzero(r?: Resources): boolean {
  return !!r && resSum(r) > 0;
}

export function areAllied(state: GameState, a: string, b: string): boolean {
  if (a === b) return false;
  const [x, y] = pair(a, b);
  return (state.alliances ?? []).some((al) => al.a === x && al.b === y);
}

export function alliesOf(state: GameState, playerId: string): string[] {
  return (state.alliances ?? [])
    .filter((al) => al.a === playerId || al.b === playerId)
    .map((al) => (al.a === playerId ? al.b : al.a));
}

export function formAlliance(state: GameState, aId: string, bId: string): boolean {
  if (aId === bId || areAllied(state, aId, bId)) return false;
  const [a, b] = pair(aId, bId);
  if (!state.alliances) state.alliances = [];
  state.alliances.push({ a, b, formedTurn: state.turn });
  return true;
}

export function breakAlliance(state: GameState, aId: string, bId: string): boolean {
  if (!areAllied(state, aId, bId)) return false;
  const [a, b] = pair(aId, bId);
  state.alliances = (state.alliances ?? []).filter((al) => !(al.a === a && al.b === b));
  return true;
}

/** A player "reaches" a system if they own it or own a neighbor. */
export function playerReaches(state: GameState, playerId: string, systemId: string): boolean {
  const s = state.systems.find((x) => x.id === systemId);
  if (!s) return false;
  if (s.ownerId === playerId) return true;
  return s.neighbors.some((n) => state.systems.find((x) => x.id === n)?.ownerId === playerId);
}

export function legalAttackSystems(
  state: GameState,
  meId: string,
  themId: string,
): string[] {
  return state.systems
    .filter((s) => playerReaches(state, meId, s.id) || playerReaches(state, themId, s.id))
    .map((s) => s.id);
}

export function legalEspionageSystems(
  state: GameState,
  meId: string,
  themId: string,
  kind: EspionageKind,
): string[] {
  const actors = [meId, themId];
  return state.systems
    .filter((s) => {
      if (kind === "counter") {
        return actors.some((pid) => {
          if (s.ownerId !== pid) return false;
          return s.neighbors.some((n) => {
            const o = state.systems.find((x) => x.id === n)?.ownerId;
            return !!o && o !== pid;
          });
        });
      }
      if (kind === "fake" || kind === "intercept") return false;
      return actors.some((pid) => {
        if (!s.ownerId || s.ownerId === pid) return false;
        return s.neighbors.some(
          (n) => state.systems.find((x) => x.id === n)?.ownerId === pid,
        );
      });
    })
    .map((s) => s.id);
}

export function legalMessageSystems(
  state: GameState,
  topic: MessageTopic,
  meId: string,
  themId: string,
  espionageKind?: EspionageKind,
): string[] {
  if (topic === "intelligence" || topic === "alliance") return [];
  if (topic === "trade") {
    // Trade landings are picked from dropdowns of legal dests, not the map.
    return [];
  }
  if (topic === "espionage") {
    return legalEspionageSystems(state, meId, themId, espionageKind ?? "sabotage");
  }
  return legalAttackSystems(state, meId, themId);
}

export function hostileOrderWarning(
  state: GameState,
  playerId: string,
  kind: "move" | "support" | "espionage",
  destId: string,
  extra?: { supportedOwnerId?: string },
): string | null {
  const dest = state.systems.find((s) => s.id === destId);
  if (!dest?.ownerId || dest.ownerId === playerId) return null;
  if (!areAllied(state, playerId, dest.ownerId)) return null;
  const ally = civName(state, dest.ownerId);
  if (kind === "support" && extra?.supportedOwnerId === dest.ownerId) return null;
  if (kind === "move") {
    return `You are allied with ${ally}. Moving into ${dest.name} is a hostile act. It will not break the alliance by itself, but they will be told. Continue anyway?`;
  }
  if (kind === "support") {
    return `You are allied with ${ally}. Supporting an action into ${dest.name} is hostile. Continue anyway?`;
  }
  return `You are allied with ${ally}. Espionage at ${dest.name} is a hostile act. Continue anyway?`;
}

export function currentAllyConflicts(state: GameState, playerId: string): string[] {
  const out: string[] = [];
  for (const allyId of alliesOf(state, playerId)) {
    const ally = civName(state, allyId);
    for (const s of state.systems) {
      for (const f of s.fleets) {
        if (f.ownerId !== playerId) continue;
        const order = f.order;
        if (order.kind === "move") {
          const dest = state.systems.find((x) => x.id === order.destId);
          if (dest?.ownerId === allyId) {
            out.push(`A starfleet is ordered into ${dest.name} (${ally}).`);
          }
        }
        if (order.kind === "support") {
          const dest = state.systems.find((x) => x.id === order.destId);
          if (dest?.ownerId === allyId) {
            const supported = state.systems
              .flatMap((x) => x.fleets)
              .find((x) => x.id === order.supportedFleetId);
            if (supported?.ownerId !== allyId) {
              out.push(`Supporting fire is ordered into ${dest.name} (${ally}).`);
            }
          }
        }
      }
    }
    for (const e of state.espionage) {
      if (e.playerId !== playerId) continue;
      if (e.kind !== "sabotage" && e.kind !== "destabilize") continue;
      const sys = state.systems.find((x) => x.id === e.systemId);
      if (sys?.ownerId === allyId) {
        out.push(`${e.kind === "sabotage" ? "Sabotage" : "Destabilization"} is ordered at ${sys.name} (${ally}).`);
      }
    }
  }
  return out;
}

export function sealPact(
  state: GameState,
  args: {
    messageId: string;
    threadId: string;
    aId: string;
    bId: string;
    give?: Resources;
    giveSystemId?: string;
    request?: Resources;
    requestSystemId?: string;
    allianceClause?: Pact["allianceClause"];
  },
): Pact {
  if (!state.pacts) state.pacts = [];
  const pact: Pact = {
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
    allianceClause: args.allianceClause,
  };
  state.pacts.push(pact);
  return pact;
}

export function pactHalf(
  pact: Pact,
  playerId: string,
): { resources: Resources; systemId?: string; otherId: string } | null {
  if (playerId === pact.aId) {
    return { resources: pact.give, systemId: pact.giveSystemId, otherId: pact.bId };
  }
  if (playerId === pact.bId) {
    return { resources: pact.request, systemId: pact.requestSystemId, otherId: pact.aId };
  }
  return null;
}

export function deliveryScheduled(
  state: GameState,
  playerId: string,
  systemId: string | undefined,
  resources: Resources,
): boolean {
  if (!systemId || !goodsNonzero(resources)) return true;
  return state.trades.some(
    (t) =>
      t.playerId === playerId &&
      t.systemId === systemId &&
      resEqual(t.resources, resources),
  );
}

export function unsentPactsFor(state: GameState, playerId: string): Pact[] {
  return (state.pacts ?? []).filter((p) => {
    if (p.evaluated) return false;
    if (p.sealedTurn !== state.turn) return false;
    const half = pactHalf(p, playerId);
    if (!half || !goodsNonzero(half.resources) || !half.systemId) return false;
    return !deliveryScheduled(state, playerId, half.systemId, half.resources);
  });
}

export function openIncidentsFor(state: GameState, playerId: string): AllyIncident[] {
  return (state.allyIncidents ?? []).filter(
    (i) => i.victimId === playerId && i.status === "open",
  );
}

function scoreDelivery(
  trades: ScheduledTrade[],
  playerId: string,
  promised: Resources,
  destId?: string,
): { result: PromiseReport["result"]; detail: string } {
  if (!goodsNonzero(promised) || !destId) {
    return { result: "kept", detail: "No delivery was promised." };
  }
  const mine = trades.filter((t) => t.playerId === playerId);
  const exact = mine.find((t) => t.systemId === destId && resEqual(t.resources, promised));
  if (exact) {
    return {
      result: "kept",
      detail: `Sent ${formatGoods(promised)} to the named system.`,
    };
  }
  const sameDest = mine.find((t) => t.systemId === destId && goodsNonzero(t.resources));
  if (sameDest) {
    return {
      result: "partial",
      detail: `Sent ${formatGoods(sameDest.resources)} instead of ${formatGoods(promised)} to the named system.`,
    };
  }
  const sameGoods = mine.find((t) => resEqual(t.resources, promised));
  if (sameGoods) {
    return {
      result: "partial",
      detail: `Sent ${formatGoods(promised)}, but to a different system.`,
    };
  }
  if (mine.length) {
    return {
      result: "partial",
      detail: `Sent ${formatGoods(mine[0]!.resources)} to a different system than promised.`,
    };
  }
  return {
    result: "broken",
    detail: `Did not send the promised ${formatGoods(promised)}.`,
  };
}

export function evaluateDiplomacy(
  state: GameState,
  snapshot: {
    trades: ScheduledTrade[];
    espionage: ScheduledEspionage[];
    moves: { ownerId: string; destId: string }[];
    owners: Map<string, string | null>;
  },
): void {
  if (!state.pacts) state.pacts = [];
  if (!state.promiseReports) state.promiseReports = [];
  if (!state.allyIncidents) state.allyIncidents = [];
  if (!state.alliances) state.alliances = [];

  const reports: PromiseReport[] = [];
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
        kind: "delivery",
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
        detail: holds
          ? "Mutual alliance remains in force."
          : "The promised alliance is not in force — it was denounced after being sealed, or never formed.",
        extras: [],
        kind: "alliance",
      });
    } else if (pact.allianceClause === "break") {
      const holds = areAllied(state, pact.aId, pact.bId);
      reports.push({
        id: uid("prm"),
        pactId: pact.id,
        actorId: pact.aId,
        otherId: pact.bId,
        result: holds ? "broken" : "kept",
        detail: holds
          ? "The alliance was not dissolved as agreed."
          : "The alliance was dissolved as agreed.",
        extras: [],
        kind: "alliance",
      });
    }
  }

  const seenIncident = new Set<string>();
  const pushIncident = (
    actorId: string,
    victimId: string,
    kind: AllyIncident["kind"],
    systemId: string | undefined,
    text: string,
  ) => {
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
      status: "open",
    });
    const related = reports.filter(
      (r) =>
        (r.actorId === actorId && r.otherId === victimId) ||
        (r.actorId === victimId && r.otherId === actorId),
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
          pactId: related[0]!.pactId,
          actorId,
          otherId: victimId,
          result: "broken",
          detail: text,
          extras: [],
          kind: "hostility",
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
        kind: "hostility",
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
        `${civName(state, mv.ownerId)} ordered starfleets into ${dest}.`,
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
        `${civName(state, e.playerId)} ordered ${e.kind} at ${sysName(state, e.systemId)}.`,
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
        `${civName(state, s.ownerId)} took ${s.name} from ${civName(state, prev)}.`,
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
      text: `${civName(state, r.actorId)} — ${r.detail}`,
      playerId: r.otherId,
    });
  }
}

export function fleetOf(state: GameState, fleetId: string): Fleet | undefined {
  for (const s of state.systems) {
    const f = s.fleets.find((x) => x.id === fleetId);
    if (f) return f;
  }
  return undefined;
}
