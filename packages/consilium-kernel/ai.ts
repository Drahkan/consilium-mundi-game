import type {
  DiplomacyTerms,
  Fleet,
  GameState,
  MessageTopic,
  Player,
  StarSystem,
  Upgrade,
} from "./types";
import { ZERO, canAfford, cloneRes, subRes } from "./types";
import { BUILD_COST } from "./constants";
import { uid } from "./civs";
import { hopsAway } from "./graph";
import { makeRng, pick, shuffle } from "./rng";
import { acceptOffer, denounceAlliance, schedulePactDelivery, sendThreadMessage, tradeFrontier } from "./diplomacy";
import { areAllied, openIncidentsFor, unsentPactsFor } from "./alliance";
import { canUseWormhole } from "./resolve";
import { fleetCount, productionOf } from "./mapgen";

function owned(state: GameState, p: Player): StarSystem[] {
  return state.systems.filter((s) => s.ownerId === p.id);
}

function fleetsOf(s: StarSystem, pid: string): Fleet[] {
  return s.fleets.filter((f) => f.ownerId === pid);
}

function emptyNeighbors(state: GameState, s: StarSystem): StarSystem[] {
  return s.neighbors
    .map((id) => state.systems.find((x) => x.id === id)!)
    .filter((n) => n.ownerId === null && n.fleets.length === 0);
}

function enemyNeighbors(state: GameState, s: StarSystem, pid: string): StarSystem[] {
  return s.neighbors
    .map((id) => state.systems.find((x) => x.id === id)!)
    .filter((n) => n.ownerId && n.ownerId !== pid && !areAllied(state, pid, n.ownerId));
}

function defenseOf(s: StarSystem): number {
  let n = s.fleets.length;
  if (s.upgrades.includes("starport")) n += 1;
  return n;
}

function incomeMin(state: GameState, p: Player): number {
  let t = 0,
    m = 0,
    c = 0;
  for (const s of owned(state, p)) {
    const r = productionOf(s);
    t += r.tech;
    m += r.metals;
    c += r.chon;
  }
  return Math.min(t, m, c);
}

export function runAi(state: GameState, player: Player) {
  if (player.kind !== "ai" || player.collapsed) return;
  const rng = makeRng(state.seed, 0xc0ffee ^ state.turn ^ player.id.length * 13);

  // Reset leftover human-style drafts
  for (const s of state.systems) {
    for (const f of fleetsOf(s, player.id)) {
      f.order = { kind: "hold" };
    }
  }

  const my = owned(state, player);
  const myFleets = state.systems.flatMap((s) => fleetsOf(s, player.id));

  // 1. Expansion: move into empty adjacent systems (one fleet per target)
  const claimed = new Set<string>();
  for (const s of shuffle(rng, my)) {
    const empties = emptyNeighbors(state, s);
    const idle = fleetsOf(s, player.id).filter((f) => f.order.kind === "hold");
    for (const f of idle) {
      const dest = empties.find((e) => !claimed.has(e.id));
      if (!dest) break;
      // Keep at least one fleet on homes if enemy is adjacent
      const threat = enemyNeighbors(state, s, player.id).length > 0;
      const remaining = idle.filter((x) => x.order.kind === "hold").length;
      if (s.isHome && threat && remaining <= 1) break;
      f.order = { kind: "move", destId: dest.id };
      claimed.add(dest.id);
    }
  }

  // 2. Concentrate attacks 2v1 on weak enemy neighbors
  for (const s of shuffle(rng, my)) {
    const targets = enemyNeighbors(state, s, player.id).sort(
      (a, b) => defenseOf(a) - defenseOf(b),
    );
    for (const t of targets) {
      const idle = fleetsOf(s, player.id).filter((f) => f.order.kind === "hold");
      if (idle.length < 1) continue;
      const def = defenseOf(t);
      const available = idle.length;
      // If we have 2+, move one and support with one
      if (available >= 2 && def <= available) {
        const mover = idle[0]!;
        const supporter = idle[1]!;
        mover.order = { kind: "move", destId: t.id };
        supporter.order = {
          kind: "support",
          supportedFleetId: mover.id,
          destId: t.id,
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

  // 3. Wormhole raids — opportunistic
  for (const s of my) {
    if (!s.upgrades.includes("wormhole")) continue;
    const idle = fleetsOf(s, player.id).filter((f) => f.order.kind === "hold");
    const f = idle[0];
    if (!f || !canUseWormhole(state, f)) continue;
    const reach = [...hopsAway(state.systems, s.id, 2)]
      .map((id) => state.systems.find((x) => x.id === id)!)
      .filter(
        (n) =>
          !s.neighbors.includes(n.id) &&
          (n.ownerId === null ||
            (n.ownerId !== player.id &&
              !areAllied(state, player.id, n.ownerId) &&
              defenseOf(n) === 0)),
      );
    if (reach.length && rng() < 0.55) {
      const dest = pick(rng, reach);
      f.order = { kind: "move", destId: dest.id, wormholeJump: true };
    }
  }

  // 4. Builds
  const upkeepCap = incomeMin(state, player);
  const currentFleets = fleetCount(state.systems, player.id);
  const scheduledFleets = state.builds.filter(
    (b) => b.playerId === player.id && b.kind === "starfleet",
  ).length;

  const tryBuild = (system: StarSystem, kind: "starfleet" | Upgrade) => {
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
      kind,
    });
    return true;
  };

  // Economy first on safe interiors, military on frontier
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
  // Fleets if we can support them
  if (currentFleets + scheduledFleets < upkeepCap) {
    const yards = my.filter(
      (s) =>
        s.upgrades.includes("shipyard") &&
        !state.builds.some(
          (b) => b.systemId === s.id && b.kind === "shipyard",
        ),
    );
    for (const s of yards) {
      if (currentFleets + state.builds.filter((b) => b.playerId === player.id && b.kind === "starfleet").length >= upkeepCap)
        break;
      tryBuild(s, "starfleet");
    }
  }
  // Occasional wormhole generator on a well-connected interior
  if (rng() < 0.2) {
    const cand = interior.find((s) => !s.upgrades.includes("wormhole") && s.neighbors.length >= 4);
    if (cand) tryBuild(cand, "wormhole");
  }

  // 5. Espionage
  if (player.resources.tech >= 1 && rng() < 0.4) {
    const adjEnemy = frontier.flatMap((s) => enemyNeighbors(state, s, player.id));
    const t = adjEnemy[0];
    if (t && !state.options.disableCommunications) {
      player.resources.tech -= 1;
      const target: Upgrade | "fleets" =
        t.upgrades.includes("starport") && rng() < 0.5
          ? "starport"
          : t.fleets.length
            ? "fleets"
            : t.upgrades[0] ?? "fleets";
      state.espionage.push({
        id: uid("esp"),
        playerId: player.id,
        kind: "sabotage",
        systemId: t.id,
        targetUpgrade: target,
      });
    }
  }

  // 6. Diplomacy — grievances, keep word, reply, then send
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
            unless: "withdraw from the slight and make amends",
          },
          status: "open",
        });
      }
    }

    for (const t of state.threads) {
      const last = t.messages[t.messages.length - 1];
      if (!last || last.toPlayerId !== player.id) continue;
      if (last.status && last.status !== "open") continue;
      const ask = last.terms?.request;
      const cheap = !ask || ask.tech + ask.metals + ask.chon <= 2;
      const wantsAlly =
        last.terms?.allianceClause === "form" ||
        (last.topic === "alliance" && last.terms?.intent !== "with-third");
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
        let topic: MessageTopic = canTrade
          ? target.kind === "human" && state.turn <= 2
            ? "trade"
            : rng() < 0.55
              ? "trade"
              : rng() < 0.45
                ? "attack"
                : alliedNow
                  ? "trade"
                  : "alliance"
          : alliedNow
            ? "intelligence"
            : "alliance";

        const terms: DiplomacyTerms = {};
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
        if (
          !alliedNow &&
          (topic === "alliance" || (topic === "trade" && rng() < 0.7))
        ) {
          terms.allianceClause = "form";
          terms.intent = "with-you";
        } else if (topic === "attack") {
          const contested = state.systems.find(
            (s) =>
              (s.ownerId === target.id || s.ownerId === player.id) &&
              s.neighbors.some(
                (n) =>
                  state.systems.find((x) => x.id === n)?.ownerId ===
                  (s.ownerId === target.id ? player.id : target.id),
              ) &&
              !areAllied(state, player.id, s.ownerId ?? ""),
          );
          terms.intent = contested?.ownerId === target.id ? "vacate" : "i-attack";
          sendThreadMessage(state, {
            fromId: player.id,
            toId: target.id,
            topic,
            attitude: player.civ.attitude,
            systemId: contested?.id ?? my[0]?.id,
            neighborId: contested?.neighbors.find((n) =>
              my.some((s) => s.id === n),
            ),
            terms,
          });
        }
        if (topic !== "attack") {
          sendThreadMessage(state, {
            fromId: player.id,
            toId: target.id,
            topic,
            attitude: player.civ.attitude,
            systemId:
              topic === "trade"
                ? (giveSystemId ?? requestSystemId)
                : (giveDests[0] ?? my[0]?.id),
            aboutPlayerId: topic === "alliance" ? target.id : undefined,
            terms: Object.keys(terms).length
              ? terms
              : alliedNow
                ? { intent: "with-you" }
                : { intent: "with-you", allianceClause: "form" },
          });
        }
      }
    }
  }

  // Rally points toward nearest home
  const homes = my.filter((s) => s.isHome);
  for (const f of myFleets) {
    const here = state.systems.find((s) => s.id === f.systemId)!;
    const homeAdj = here.neighbors.find((n) =>
      homes.some((h) => h.id === n),
    );
    const ownedAdj = here.neighbors.find(
      (n) => state.systems.find((x) => x.id === n)?.ownerId === player.id,
    );
    f.rallySystemId = homeAdj ?? ownedAdj ?? null;
  }

  player.ready = true;
  void rng;
}
