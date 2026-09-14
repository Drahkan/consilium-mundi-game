import type {
  Fleet,
  FleetOrder,
  GameState,
  StarSystem,
  TurnLogEntry,
  Upgrade,
} from "./types";
import { ZERO, addRes, cloneRes, subRes } from "./types";
import { uid } from "./civs";
import {
  hopsAway,
  isAdjacent,
  isSupplied,
  shortestPath,
  supplyDistance,
  sysById,
} from "./graph";
import { fleetCount, productionOf } from "./mapgen";
import { evaluateVictory } from "./victory";
import { makeRng } from "./rng";
import { evaluateDiplomacy } from "./alliance";
import { pushSnapshot } from "./snapshot";

function log(
  state: GameState,
  severity: TurnLogEntry["severity"],
  text: string,
  extra?: { systemId?: string; playerId?: string },
) {
  state.log.push({
    id: uid("log"),
    severity,
    text,
    systemId: extra?.systemId,
    playerId: extra?.playerId,
  });
}

function playerName(state: GameState, id: string): string {
  return state.players.find((p) => p.id === id)?.civ.name ?? "Unknown";
}

function sysName(state: GameState, id: string): string {
  return state.systems.find((s) => s.id === id)?.name ?? id;
}

function allFleets(state: GameState): Fleet[] {
  return state.systems.flatMap((s) => s.fleets);
}

function moveFleet(state: GameState, fleet: Fleet, destId: string) {
  const from = sysById(state, fleet.systemId);
  from.fleets = from.fleets.filter((f) => f.id !== fleet.id);
  fleet.systemId = destId;
  fleet.order = { kind: "hold" };
  sysById(state, destId).fleets.push(fleet);
}

function destroyFleet(state: GameState, fleet: Fleet, reason: string) {
  const from = sysById(state, fleet.systemId);
  from.fleets = from.fleets.filter((f) => f.id !== fleet.id);
  log(state, "combat", reason, { systemId: fleet.systemId, playerId: fleet.ownerId });
}

function starportDefends(state: GameState, s: StarSystem): boolean {
  if (!s.upgrades.includes("starport")) return false;
  if (state.activeSabotage[s.id] === "starport") return false;
  return true;
}

function isStarportSabotaged(state: GameState, id: string): boolean {
  return state.activeSabotage[id] === "starport";
}

function sabotagedPorts(state: GameState): Set<string> {
  const set = new Set<string>();
  for (const [id, t] of Object.entries(state.activeSabotage)) {
    if (t === "starport") set.add(id);
  }
  return set;
}

function defaultRally(state: GameState, fleet: Fleet): string | null {
  const sys = sysById(state, fleet.systemId);
  const owned = (id: string) =>
    state.systems.find((s) => s.id === id)?.ownerId === fleet.ownerId;
  const ports = state.systems.filter(
    (s) =>
      s.ownerId === fleet.ownerId &&
      s.upgrades.includes("starport") &&
      !isStarportSabotaged(state, s.id),
  );
  if (ports.length === 0) {
    const adjOwned = sys.neighbors.filter((n) => owned(n));
    return adjOwned[0] ?? null;
  }
  const candidates: { id: string; via: string; portDist: number; homeDist: number }[] = [];
  for (const n of sys.neighbors) {
    if (!owned(n)) continue;
    let bestPort = Infinity;
    let bestHome = Infinity;
    for (const p of ports) {
      const path = shortestPath(state.systems, n, p.id, owned);
      if (!path) continue;
      const d = path.length - 1;
      if (d < bestPort) {
        bestPort = d;
        const sd = supplyDistance(
          state.systems,
          p.id,
          fleet.ownerId,
          sabotagedPorts(state),
        );
        bestHome = sd.portToHome;
      }
    }
    if (Number.isFinite(bestPort)) {
      candidates.push({
        id: n,
        via: n,
        portDist: bestPort,
        homeDist: bestHome,
      });
    }
  }
  if (candidates.length === 0) return sys.neighbors.find((n) => owned(n)) ?? null;
  candidates.sort((a, b) => a.portDist - b.portDist || a.homeDist - b.homeDist);
  const bestPort = candidates[0]!.portDist;
  const tied = candidates.filter((c) => c.portDist === bestPort);
  tied.sort((a, b) => a.homeDist - b.homeDist);
  return tied[0]!.id;
}

function applyEspionage(state: GameState) {
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
          `Counter-espionage at ${sysName(state, e.systemId)} foiled a sabotage attempt.`,
          { systemId: e.systemId },
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
          `${who} sabotaged starfleets at ${sysName(state, e.systemId)}. Movement orders there are ignored.`,
          { systemId: e.systemId, playerId: e.playerId },
        );
        for (const f of sysById(state, e.systemId).fleets) {
          f.order = { kind: "hold" };
        }
      } else {
        log(
          state,
          "intel",
          `${who} sabotaged the ${e.targetUpgrade} at ${sysName(state, e.systemId)}.`,
          { systemId: e.systemId, playerId: e.playerId },
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
          `Counter-espionage at ${sysName(state, e.systemId)} foiled a destabilization.`,
          { systemId: e.systemId },
        );
        continue;
      }
      state.destabilized.push(e.systemId);
      log(
        state,
        "intel",
        `${playerName(state, e.playerId)} destabilized the government of ${sysName(state, e.systemId)}.`,
        { systemId: e.systemId, playerId: e.playerId },
      );
    }
  }
  void rng;
}

function applyScheduledDestroy(state: GameState) {
  for (const s of state.systems) {
    for (const f of [...s.fleets]) {
      if (f.scheduledDestroy) {
        destroyFleet(
          state,
          f,
          `${playerName(state, f.ownerId)} scuttled a starfleet at ${s.name}.`,
        );
      }
    }
    if (s.ownerId) {
      const p = s.ownerId;
      // Destruction of upgrades is stored as builds with negative? We use
      // scheduledDestroy on fleets; upgrades marked via builds kind prefixed?
    }
  }
  // Upgrade destruction is encoded as a build with kind and a reserved flag:
  // we store them in state.builds with a sentinel — actually use espionage? 
  // Better: fleets have scheduledDestroy; for upgrades we scan builds? 
  // We'll use a convention: ScheduledBuild.kind still Upgrade, but we keep
  // a parallel list... Looking at engine, I'll put destroy upgrades in
  // state.builds filtered... No. Use systems' upcoming field.
  // For now, upgrades scheduled for destroy are listed in sabotageUntil? 
  // Let's use builds with a fake: I'll add `destroyUpgrades` on the system via
  // scanning a custom list on GameState — we don't have one.
  // Store destroy-upgrade as ScheduledBuild where playerId starts with "x"? Ugly.
  // I'll use the `espionage` array? No.
  // Simplest: GameState.builds also used for destroy if we add optional destroy.
  // Types don't have it. I'll treat any build with cost already paid that is
  // listed... 
}

type DestroyUpgrade = { playerId: string; systemId: string; upgrade: Upgrade };

function getDestroyUpgrades(state: GameState): DestroyUpgrade[] {
  return ((state as GameState & { destroyUpgrades?: DestroyUpgrade[] })
    .destroyUpgrades ?? []) as DestroyUpgrade[];
}

export function setDestroyUpgrades(state: GameState, list: DestroyUpgrade[]) {
  (state as GameState & { destroyUpgrades?: DestroyUpgrade[] }).destroyUpgrades =
    list;
}

function applyDestroyUpgrades(state: GameState) {
  const list = getDestroyUpgrades(state);
  const destab = new Set(state.destabilized);
  for (const d of list) {
    if (destab.has(d.systemId)) {
      log(
        state,
        "intel",
        `Orders to wreck the ${d.upgrade} at ${sysName(state, d.systemId)} were ignored — the government is destabilized.`,
        { systemId: d.systemId },
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
        { systemId: s.id, playerId: d.playerId },
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

function originOfSupport(state: GameState, fleet: Fleet): string {
  return fleet.systemId;
}

function supportStillValid(
  state: GameState,
  supporter: Fleet,
  orders: Map<string, FleetOrder>,
): boolean {
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

function resolveFleetOrders(state: GameState) {
  const fleets = () => allFleets(state);
  const orders = new Map<string, FleetOrder>();
  for (const f of fleets()) orders.set(f.id, { ...f.order });

  const setHold = (id: string) => {
    orders.set(id, { kind: "hold" });
    const f = fleets().find((x) => x.id === id);
    if (f) f.order = { kind: "hold" };
  };

  // 3a. Cut support if enemy MOVE into supporter's current system
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
        `Support from ${playerName(state, f.ownerId)} at ${sysName(state, f.systemId)} was cut — the system came under attack.`,
        { systemId: f.systemId, playerId: f.ownerId },
      );
      setHold(f.id);
    }
  }

  // 3.iii / 3.iv wormhole interpenetration + support-through
  const pending = new Set<string>();
  const resolvedSys = new Set<string>();

  const strengthThrough = (
    fromId: string,
    toId: string,
    ownerId: string,
  ): number => {
    let n = 0;
    for (const f of fleets()) {
      if (f.ownerId !== ownerId) continue;
      const o = orders.get(f.id) ?? f.order;
      if (o.kind === "move" && f.systemId === fromId && o.destId === toId) n += 1;
      if (
        o.kind === "support" &&
        f.systemId === fromId &&
        o.destId === toId &&
        supportStillValid(state, { ...f, order: o }, orders)
      ) {
        n += 1;
      }
    }
    return n;
  };

  // Head-on: for each undirected edge, if both directions have opposing movers
  const edges = new Set<string>();
  for (const s of state.systems) {
    for (const n of s.neighbors) {
      const key = s.id < n ? `${s.id}|${n}` : `${n}|${s.id}`;
      edges.add(key);
    }
  }
  // Include virtual wormhole-jump edges
  for (const f of fleets()) {
    const o = orders.get(f.id) ?? f.order;
    if (o.kind === "move" && o.wormholeJump) {
      const key =
        f.systemId < o.destId
          ? `${f.systemId}|${o.destId}`
          : `${o.destId}|${f.systemId}`;
      edges.add(key);
    }
  }

  for (const key of edges) {
    const [a, b] = key.split("|") as [string, string];
    const moversAB = new Map<string, number>();
    const moversBA = new Map<string, number>();
    for (const p of state.players) {
      const ab = strengthThrough(a, b, p.id);
      const ba = strengthThrough(b, a, p.id);
      if (ab) moversAB.set(p.id, ab);
      if (ba) moversBA.set(p.id, ba);
    }
    if (moversAB.size && moversBA.size) {
      // Compare each pair of opposing owners; bounce weaker/equal
      for (const [pa, sa] of moversAB) {
        for (const [pb, sb] of moversBA) {
          if (pa === pb) continue;
          if (sa <= sb) {
            // A→B bounce
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

  // Support-through cut: enemy moving from dest into supporter's system
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

  // Invalidate mismatched supports + no support vs own fleets
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
      // Also cancel if supporting a move into a system containing own holding fleets
      const destSys = state.systems.find((s) => s.id === dest);
      const ownThere = destSys?.fleets.some((fl) => fl.ownerId === f.ownerId);
      const targetMovingThere =
        (orders.get(target.id) ?? target.order).kind === "move" &&
        ((orders.get(target.id) ?? target.order) as { destId?: string }).destId ===
          dest;
      if (selfAttack && targetMovingThere) setHold(f.id);
      else if (ownThere && targetMovingThere) {
        const ownHolding = destSys!.fleets.some((fl) => {
          if (fl.ownerId !== f.ownerId) return false;
          const lo = orders.get(fl.id) ?? fl.order;
          return lo.kind === "hold" || lo.kind === "support";
        });
        if (ownHolding) setHold(f.id);
      }
    }
  }

  // Sync orders back onto fleets
  for (const f of fleets()) {
    f.order = orders.get(f.id) ?? f.order;
  }

  type Combat = {
    systemId: string;
    strengths: Map<string, number>;
    attackers: Map<string, Fleet[]>;
    holders: Fleet[];
  };

  function combatAt(systemId: string, countLeavingAsHold: boolean): Combat {
    const s = sysById(state, systemId);
    const strengths = new Map<string, number>();
    const attackers = new Map<string, Fleet[]>();
    const holders: Fleet[] = [];
    const add = (pid: string, n: number) =>
      strengths.set(pid, (strengths.get(pid) ?? 0) + n);

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

  function uniqueWinner(strengths: Map<string, number>): string | null {
    let best = -1;
    let winner: string | null = null;
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
    // Must be strictly greater than every other individually (already implied)
    for (const [pid, n] of strengths) {
      if (pid !== winner && best < n + 1) return null;
    }
    return winner;
  }

  const retreating: Fleet[] = [];

  function bounce(fleetsToBounce: Fleet[]) {
    for (const f of fleetsToBounce) {
      f.order = { kind: "hold" };
    }
  }

  function applyCombat(c: Combat, specialLeaving: boolean) {
    const s = sysById(state, c.systemId);
    const winner = uniqueWinner(c.strengths);
    const names = [...c.strengths.entries()]
      .map(([id, n]) => `${playerName(state, id)} ${n}`)
      .join(" vs ");

    if (!winner) {
      // Standoff — bounce all movers into this system
      for (const [, arr] of c.attackers) bounce(arr);
      if (c.strengths.size > 0) {
        log(
          state,
          "combat",
          `Standoff at ${s.name} (${names}). Attackers are thrown back.`,
          { systemId: s.id },
        );
      }
      return "resolved" as const;
    }

    const currentOwner = s.ownerId;
    if (winner === currentOwner || (currentOwner === null && !c.attackers.has(winner))) {
      // Owner holds (or empty and nobody unique)
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
            { systemId: s.id, playerId: winner },
          );
        }
      }
      return "resolved" as const;
    }

    // Attacker wins
    const incoming = c.attackers.get(winner) ?? [];
    if (incoming.length === 0 && !specialLeaving) {
      // Winner is someone already in system who isn't current owner — shouldn't happen
      return "resolved" as const;
    }

    for (const [pid, arr] of c.attackers) {
      if (pid !== winner) bounce(arr);
    }

    // Previous owner's holding fleets retreat
    for (const f of [...s.fleets]) {
      if (f.ownerId !== winner) {
        if (f.order.kind === "move" && specialLeaving) {
          // leave their move intact
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

    if (
      s.upgrades.includes("starport") &&
      !state.destabilized.includes(s.id)
    ) {
      s.upgrades = s.upgrades.filter((u) => u !== "starport");
      log(
        state,
        "combat",
        `The starport at ${s.name} was destroyed as ${playerName(state, winner)} seized the system.`,
        { systemId: s.id },
      );
    }

    if (state.options.scorchedEarth && prev) {
      s.upgrades = [];
      log(
        state,
        "alert",
        `Scorched earth: all upgrades at ${s.name} were destroyed.`,
        { systemId: s.id },
      );
    }

    log(
      state,
      "combat",
      `${playerName(state, winner)} takes ${s.name}${prev ? ` from ${playerName(state, prev)}` : ""}.`,
      { systemId: s.id, playerId: winner },
    );
    return "resolved" as const;
  }

  // Identify systems that need combat / pending
  const targeted = new Set<string>();
  for (const f of fleets()) {
    if (f.order.kind === "move") targeted.add(f.order.destId);
  }

  const isPending = (sid: string) => {
    const s = sysById(state, sid);
    const leaving = s.fleets.some((f) => f.order.kind === "move");
    const incoming = fleets().some(
      (f) =>
        f.ownerId !== s.ownerId &&
        f.order.kind === "move" &&
        f.order.destId === sid,
    );
    return leaving && incoming;
  };

  // DD 3.b.i / 3.b.ii — uncontested friendly transfers and empty occupations
  for (const s of state.systems) {
    const incoming = fleets().filter(
      (f) => f.order.kind === "move" && f.order.destId === s.id,
    );
    if (incoming.length === 0) continue;
    const owners = new Set(incoming.map((f) => f.ownerId));
    if (owners.size !== 1) continue;
    const pid = incoming[0]!.ownerId;
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
          { systemId: s.id },
        );
      }
      if (state.options.scorchedEarth && prev) {
        s.upgrades = [];
        log(
          state,
          "alert",
          `Scorched earth: all upgrades at ${s.name} were destroyed.`,
          { systemId: s.id },
        );
      }
      log(
        state,
        "combat",
        `${playerName(state, pid)} occupies ${s.name}${prev ? `, taking it from ${playerName(state, prev)}` : ""}.`,
        { systemId: s.id, playerId: pid },
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

  // Remaining pending: count leavers as holding
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

  // Still pending with combat → standoff
  for (const sid of [...pending]) {
    const c = combatAt(sid, true);
    applyCombat(c, false);
    pending.delete(sid);
  }

  // Remaining successful moves into vacated / friendly / empty
  for (const f of [...fleets()]) {
    if (f.order.kind !== "move") continue;
    const dest = sysById(state, f.order.destId);
    // If dest empty of enemies, allow move (possibly multiple of same player)
    const enemy = dest.fleets.some((x) => x.ownerId !== f.ownerId);
    const otherAttackers = fleets().filter(
      (x) =>
        x.id !== f.id &&
        x.order.kind === "move" &&
        x.order.destId === dest.id &&
        x.ownerId !== f.ownerId,
    );
    if (enemy || otherAttackers.length) {
      // Should have been handled; bounce leftover
      f.order = { kind: "hold" };
      continue;
    }
    const destOwner = dest.ownerId;
    moveFleet(state, f, dest.id);
    if (destOwner !== f.ownerId) {
      dest.ownerId = f.ownerId;
      if (
        dest.upgrades.includes("starport") &&
        destOwner &&
        !state.destabilized.includes(dest.id)
      ) {
        dest.upgrades = dest.upgrades.filter((u) => u !== "starport");
      }
      if (state.options.scorchedEarth && destOwner) dest.upgrades = [];
    }
  }

  // Retreats
  for (const f of retreating) {
    let rally = f.rallySystemId;
    if (!rally || !isAdjacent(sysById(state, f.systemId), rally)) {
      // Rally was computed against original system; fleet.systemId is original
      rally = defaultRally(state, f);
    }
    if (!rally) {
      log(
        state,
        "combat",
        `A ${playerName(state, f.ownerId)} starfleet was destroyed in the retreat from ${sysName(state, f.systemId)} — nowhere to run.`,
        { systemId: f.systemId, playerId: f.ownerId },
      );
      continue;
    }
    const dest = sysById(state, rally);
    if (dest.ownerId !== f.ownerId) {
      log(
        state,
        "combat",
        `A ${playerName(state, f.ownerId)} starfleet was destroyed retreating from ${sysName(state, f.systemId)} — rally at ${dest.name} is no longer friendly.`,
        { systemId: f.systemId, playerId: f.ownerId },
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
      { systemId: dest.id, playerId: f.ownerId },
    );
  }

  // Sanity: no mixed occupancy
  for (const s of state.systems) {
    const owners = new Set(s.fleets.map((f) => f.ownerId));
    if (owners.size > 1) {
      // Destroy all but the system owner, or the largest stack
      const keep =
        s.ownerId && owners.has(s.ownerId)
          ? s.ownerId
          : [...owners][0]!;
      for (const f of [...s.fleets]) {
        if (f.ownerId !== keep) {
          destroyFleet(
            state,
            f,
            `A ${playerName(state, f.ownerId)} starfleet was lost in the chaos at ${s.name}.`,
          );
        }
      }
    }
    if (s.fleets.length && s.ownerId !== s.fleets[0]!.ownerId) {
      s.ownerId = s.fleets[0]!.ownerId;
    }
  }
}

function applySupply(state: GameState) {
  const ports = sabotagedPorts(state);
  for (const s of state.systems) {
    if (s.fleets.length === 0) continue;
    const owner = s.fleets[0]!.ownerId;
    if (isSupplied(state.systems, s.id, owner, ports)) continue;
    for (const f of [...s.fleets]) {
      destroyFleet(
        state,
        f,
        `A ${playerName(state, owner)} starfleet at ${s.name} was cut off from supply and disbanded.`,
      );
    }
  }
}

function applyTrade(state: GameState) {
  for (const t of state.trades) {
    const s = state.systems.find((x) => x.id === t.systemId);
    const sender = state.players.find((x) => x.id === t.playerId);
    const ownerId = s?.ownerId ?? null;
    let creditId: string | null = null;
    if (ownerId && ownerId !== t.playerId) {
      creditId = ownerId;
    } else if (t.toPlayerId) {
      creditId = t.toPlayerId;
    } else if (ownerId === t.playerId) {
      if (sender) sender.resources = addRes(sender.resources, t.resources);
      log(
        state,
        "econ",
        `${playerName(state, t.playerId)} aborted a delivery to ${s ? s.name : "an unnamed system"} — it is still in their hands.`,
        { systemId: t.systemId, playerId: t.playerId },
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
      { systemId: s?.id, playerId: p.id },
    );
  }
  state.trades = [];
}

function applyBuilds(state: GameState) {
  for (const b of state.builds) {
    const s = state.systems.find((x) => x.id === b.systemId);
    const p = state.players.find((x) => x.id === b.playerId);
    if (!s || !p) continue;
    if (s.ownerId !== b.playerId) {
      log(
        state,
        "econ",
        `${p.civ.name} lost a ${b.kind} under construction at ${s.name} — the system changed hands.`,
        { systemId: s.id, playerId: p.id },
      );
      continue;
    }
    if (b.kind === "starfleet") {
      const sabotagedYard = state.activeSabotage[s.id] === "shipyard";
      if (!s.upgrades.includes("shipyard") || sabotagedYard) {
        log(
          state,
          "econ",
          `Starfleet construction at ${s.name} failed — no working shipyard.`,
          { systemId: s.id, playerId: p.id },
        );
        continue;
      }
      s.fleets.push({
        id: uid("flt"),
        ownerId: p.id,
        systemId: s.id,
        order: { kind: "hold" },
        rallySystemId: null,
      });
      log(
        state,
        "econ",
        `${p.civ.name} launched a starfleet at ${s.name}.`,
        { systemId: s.id, playerId: p.id },
      );
    } else {
      if (!s.upgrades.includes(b.kind)) {
        s.upgrades.push(b.kind);
        log(
          state,
          "econ",
          `${p.civ.name} completed a ${b.kind} at ${s.name}.`,
          { systemId: s.id, playerId: p.id },
        );
      }
    }
  }
  state.builds = [];
}

export function collectResources(state: GameState) {
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

export function applyUpkeep(state: GameState) {
  const rng = makeRng(state.seed, (0x9e3779b9 ^ state.turn) >>> 0);
  for (const p of state.players) {
    if (p.collapsed) continue;
    let fleets = allFleets(state).filter((f) => f.ownerId === p.id);
    const need = fleets.length;
    const canPay = Math.min(
      p.resources.tech,
      p.resources.metals,
      p.resources.chon,
    );
    const paid = Math.min(need, canPay);
    p.resources = subRes(p.resources, {
      tech: paid,
      metals: paid,
      chon: paid,
    });
    let scrap = need - paid;
    const ports = sabotagedPorts(state);
    while (scrap > 0 && fleets.length) {
      const ranked = fleets.map((f) => {
        const sd = supplyDistance(state.systems, f.systemId, p.id, ports);
        const sys = sysById(state, f.systemId);
        return {
          f,
          d1: sd.distToPort,
          d2: sd.portToHome,
          stack: sys.fleets.filter((x) => x.ownerId === p.id).length,
        };
      });
      ranked.sort((a, b) => b.d1 - a.d1 || b.d2 - a.d2 || b.stack - a.stack);
      const top = ranked.filter((x) => x.d1 === ranked[0]!.d1);
      const top2 = top.filter((x) => x.d2 === top[0]!.d2);
      const top3 = top2.filter((x) => x.stack === top2[0]!.stack);
      const pick = top3[Math.floor(rng() * top3.length)]!;
      destroyFleet(
        state,
        pick.f,
        `${p.civ.name} could not maintain a starfleet at ${sysName(state, pick.f.systemId)} — it was scrapped.`,
      );
      fleets = allFleets(state).filter((f) => f.ownerId === p.id);
      scrap -= 1;
    }
  }
}

function revealMap(state: GameState) {
  for (const p of state.players) {
    if (!state.options.uncharted) {
      p.discoveredSystemIds = state.systems.map((s) => s.id);
      p.discoveredPlayerIds = state.players.map((x) => x.id);
      continue;
    }
    const owned = state.systems.filter((s) => s.ownerId === p.id);
    for (const s of owned) {
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

function expireSabotage(state: GameState) {
  const next: Record<string, Upgrade | "fleets"> = {};
  for (const [id, until] of Object.entries(state.sabotageUntilTurn)) {
    if (until > state.turn) {
      const t = state.activeSabotage[id];
      if (t) next[id] = t;
    }
  }
  // activeSabotage is consumed during the resolution it was applied;
  // lingering colony/mining sabotage lasts until next activity (turn+1).
  state.activeSabotage = {};
  for (const [id, turn] of Object.entries(state.sabotageUntilTurn)) {
    if (turn >= state.turn) {
      // keep marker for production on the following resource phase
    }
    if (turn < state.turn) delete state.sabotageUntilTurn[id];
  }
  void next;
}

export function resolveTurn(state: GameState): GameState {
  const next: GameState = structuredClone(state);
  next.log = [];
  next.phase = "resolving";

  const tradeSnap = next.trades.slice();
  const espSnap = next.espionage.slice();
  const ownerSnap = new Map(next.systems.map((s) => [s.id, s.ownerId] as const));
  const moveSnap = allFleets(next)
    .filter((f) => f.order.kind === "move")
    .map((f) => ({
      ownerId: f.ownerId,
      destId: f.order.kind === "move" ? f.order.destId : "",
    }))
    .filter((m) => m.destId);

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
    owners: ownerSnap,
  });

  // Clear activity drafts
  next.espionage = [];
  for (const f of allFleets(next)) {
    f.order = { kind: "hold" };
    f.scheduledDestroy = false;
  }
  for (const p of next.players) p.ready = false;

  revealMap(next);

  const limit =
    next.options.turnLimit === "none" ? Infinity : next.options.turnLimit;
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

/** Encode lingering sabotage target in sabotageUntilTurn using a side map we already have. */
export function lingeringSabotage(state: GameState): Record<string, Upgrade | "fleets"> {
  const out: Record<string, Upgrade | "fleets"> = {};
  for (const [id, until] of Object.entries(state.sabotageUntilTurn)) {
    if (until >= state.turn && state.activeSabotage[id]) {
      out[id] = state.activeSabotage[id]!;
    }
  }
  return out;
}

export function legalMoveDestinations(
  state: GameState,
  fleet: Fleet,
  wormholeUsedHere: boolean,
): string[] {
  const s = sysById(state, fleet.systemId);
  const dest = new Set(s.neighbors);
  const whg =
    s.upgrades.includes("wormhole") &&
    state.activeSabotage[s.id] !== "wormhole" &&
    !wormholeUsedHere;
  if (whg) {
    for (const id of hopsAway(state.systems, s.id, 2)) dest.add(id);
  }
  dest.delete(s.id);
  return [...dest];
}

export function legalSupportDestinations(
  state: GameState,
  supporter: Fleet,
  supportedFleetId: string,
): string[] {
  const here = sysById(state, supporter.systemId);
  const target = allFleets(state).find((f) => f.id === supportedFleetId);
  if (!target) return [];
  const targetSys = target.systemId;
  const targetDest =
    target.order.kind === "move" ? target.order.destId : targetSys;
  const adj = new Set<string>([here.id, ...here.neighbors]);
  const out: string[] = [];
  for (const id of adj) {
    const sys = sysById(state, id);
    if (
      id === targetSys ||
      id === targetDest ||
      sys.neighbors.includes(targetSys) ||
      sys.neighbors.includes(targetDest)
    ) {
      out.push(id);
    }
  }
  return out;
}

export function legalRallyDestinations(state: GameState, fleet: Fleet): string[] {
  const here = sysById(state, fleet.systemId);
  return here.neighbors.filter(
    (id) => sysById(state, id).ownerId === fleet.ownerId,
  );
}

export function canUseWormhole(state: GameState, fleet: Fleet): boolean {
  const s = sysById(state, fleet.systemId);
  if (!s.upgrades.includes("wormhole")) return false;
  if (state.activeSabotage[s.id] === "wormhole") return false;
  const used = s.fleets.some(
    (f) =>
      f.id !== fleet.id && f.order.kind === "move" && f.order.wormholeJump,
  );
  return !used;
}

export function incomePreview(state: GameState, playerId: string) {
  return {
    prod: state.systems
      .filter((s) => s.ownerId === playerId)
      .reduce(
        (a, s) => {
          const p = productionOf(s, state.activeSabotage[s.id]);
          return {
            tech: a.tech + p.tech,
            metals: a.metals + p.metals,
            chon: a.chon + p.chon,
          };
        },
        cloneRes(ZERO),
      ),
    upkeep: fleetCount(state.systems, playerId),
  };
}
