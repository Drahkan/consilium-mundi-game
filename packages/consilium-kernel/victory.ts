import type { GameState, Player, VictoryKind } from "./types";

export function playerSystemCount(state: GameState, playerId: string): number {
  return state.systems.filter((s) => s.ownerId === playerId).length;
}

export function playerHomeCount(state: GameState, playerId: string): number {
  return state.systems.filter(
    (s) => s.isHome && s.ownerId === playerId,
  ).length;
}

export function playerStarportCount(state: GameState, playerId: string): number {
  return state.systems.filter(
    (s) => s.ownerId === playerId && s.upgrades.includes("starport"),
  ).length;
}

export function playerCorporateCount(state: GameState, playerId: string): number {
  return state.systems.filter(
    (s) =>
      s.ownerId === playerId &&
      s.upgrades.includes("starport") &&
      s.upgrades.includes("mining"),
  ).length;
}

export function playerFleetCount(state: GameState, playerId: string): number {
  let n = 0;
  for (const s of state.systems) {
    n += s.fleets.filter((f) => f.ownerId === playerId).length;
  }
  return n;
}

export function alivePlayers(state: GameState): Player[] {
  return state.players.filter((p) => !p.collapsed && playerSystemCount(state, p.id) > 0);
}

export interface VictoryResult {
  winnerIds: string[];
  kind: "win" | "tie" | null;
  reason: string;
}

function leaders(
  state: GameState,
  score: (id: string) => number,
): { ids: string[]; value: number } {
  const active = state.players.filter((p) => !p.collapsed);
  let best = -Infinity;
  const ids: string[] = [];
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

export function evaluateVictory(
  state: GameState,
  atEndOfGame: boolean,
): VictoryResult {
  const kind: VictoryKind = state.options.victory;
  const total = state.systems.length;
  const totalHomes = state.systems.filter((s) => s.isHome).length;
  const active = state.players.filter((p) => !p.collapsed);

  if (kind === "standard") {
    for (const p of active) {
      if (playerSystemCount(state, p.id) > total / 2) {
        return {
          winnerIds: [p.id],
          kind: "win",
          reason: `${p.civ.name} controls more than half the galaxy.`,
        };
      }
    }
    if (atEndOfGame) {
      const L = leaders(state, (id) => playerSystemCount(state, id));
      return {
        winnerIds: L.ids,
        kind: L.ids.length > 1 ? "tie" : "win",
        reason:
          L.ids.length > 1
            ? "Turn limit reached. Several powers share the largest dominion."
            : "Turn limit reached. Largest dominion stands.",
      };
    }
  }

  if (kind === "galacticDomination") {
    const withSystems = active.filter((p) => playerSystemCount(state, p.id) > 0);
    if (withSystems.length === 2) {
      const a = playerSystemCount(state, withSystems[0]!.id);
      const b = playerSystemCount(state, withSystems[1]!.id);
      const maxShare = Math.max(a, b) / total;
      if (maxShare <= 0.6) {
        return {
          winnerIds: withSystems.map((p) => p.id),
          kind: "tie",
          reason:
            "Only two civilizations remain, and neither holds a decisive majority.",
        };
      }
    }
    for (const p of active) {
      const homes = playerHomeCount(state, p.id);
      const homeShare = totalHomes === 0 ? 0 : homes / totalHomes;
      const rivalTooBig = active.some(
        (o) =>
          o.id !== p.id &&
          totalHomes > 0 &&
          playerHomeCount(state, o.id) / totalHomes > 0.3,
      );
      if (homeShare > 0.5 && !rivalTooBig) {
        return {
          winnerIds: [p.id],
          kind: "win",
          reason: `${p.civ.name} dominates the home systems of the galaxy.`,
        };
      }
    }
    if (atEndOfGame) {
      const over50 = active.filter(
        (p) => totalHomes > 0 && playerHomeCount(state, p.id) / totalHomes > 0.5,
      );
      if (over50.length === 1) {
        return {
          winnerIds: [over50[0]!.id],
          kind: "win",
          reason: "End of game: majority of home systems.",
        };
      }
      const over30 = active.filter(
        (p) => total > 0 && playerSystemCount(state, p.id) / total > 0.3,
      );
      if (over30.length > 1) {
        return {
          winnerIds: over30.map((p) => p.id),
          kind: "tie",
          reason: "End of game: several powers exceed 30% of systems.",
        };
      }
      const L = leaders(state, (id) => playerHomeCount(state, id));
      return {
        winnerIds: L.ids,
        kind: L.ids.length > 1 ? "tie" : "win",
        reason: "End of game: most home systems.",
      };
    }
  }

  if (kind === "lastStanding") {
    const withPorts = active.filter((p) => playerStarportCount(state, p.id) > 0);
    if (withPorts.length === 1) {
      return {
        winnerIds: [withPorts[0]!.id],
        kind: "win",
        reason: `${withPorts[0]!.civ.name} is the last civilization with a starport.`,
      };
    }
    if (atEndOfGame) {
      const L = leaders(state, (id) => playerStarportCount(state, id));
      return {
        winnerIds: L.ids,
        kind: L.ids.length > 1 ? "tie" : "win",
        reason: "End of game: most starports.",
      };
    }
  }

  if (kind === "corporate") {
    for (const p of active) {
      if (playerCorporateCount(state, p.id) > total * 0.3) {
        return {
          winnerIds: [p.id],
          kind: "win",
          reason: `${p.civ.name} has locked the sector's industrial spine.`,
        };
      }
    }
    if (atEndOfGame) {
      const L = leaders(state, (id) => playerCorporateCount(state, id));
      return {
        winnerIds: L.ids,
        kind: L.ids.length > 1 ? "tie" : "win",
        reason: "End of game: most starport-and-mining systems.",
      };
    }
  }

  if (kind === "gunship") {
    for (const p of active) {
      if (playerFleetCount(state, p.id) >= total) {
        return {
          winnerIds: [p.id],
          kind: "win",
          reason: `${p.civ.name} fields a starfleet for every system in the sector.`,
        };
      }
    }
    if (atEndOfGame) {
      const L = leaders(state, (id) => playerFleetCount(state, id));
      return {
        winnerIds: L.ids,
        kind: L.ids.length > 1 ? "tie" : "win",
        reason: "End of game: largest navy.",
      };
    }
  }

  return { winnerIds: [], kind: null, reason: "" };
}

export function scoreCard(state: GameState) {
  return state.players.map((p) => ({
    playerId: p.id,
    name: p.civ.name,
    color: p.civ.flag.colors[0],
    systems: playerSystemCount(state, p.id),
    fleets: playerFleetCount(state, p.id),
    upgrades: state.systems
      .filter((s) => s.ownerId === p.id)
      .reduce((n, s) => n + s.upgrades.length, 0),
    resources: { ...p.resources },
    winner: (state.winnerIds ?? []).includes(p.id),
  }));
}
