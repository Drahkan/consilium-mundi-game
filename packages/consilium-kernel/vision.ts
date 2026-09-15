import type { GameState, StarSystem } from "./types";
import { alliesOf, areAllied } from "./alliance";

export type Vision = "visible" | "fog" | "hidden";

/** Neutral ink for systems nobody is collecting from. Never an empire colour. */
export const UNOWNED_INK = "#5c616a";

function ownsOrAllyOwns(state: GameState, viewerId: string, ownerId: string | null): boolean {
  if (!ownerId) return false;
  if (ownerId === viewerId) return true;
  return alliesOf(state, viewerId).includes(ownerId);
}

export function visionOf(
  state: GameState,
  viewerId: string,
  system: StarSystem,
): Vision {
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

export function playerKnown(
  state: GameState,
  viewerId: string,
  otherId: string,
): boolean {
  if (viewerId === otherId) return true;
  if (areAllied(state, viewerId, otherId)) return true;
  if (!state.options.uncharted) return true;
  const p = state.players.find((x) => x.id === viewerId);
  return !!p?.discoveredPlayerIds.includes(otherId);
}

export function empireColor(state: GameState, ownerId: string | null): string {
  if (!ownerId) return UNOWNED_INK;
  return (
    state.players.find((p) => p.id === ownerId)?.civ.flag.colors[0] ?? UNOWNED_INK
  );
}

/**
 * Map colour of a star. Empire colour if and only if that empire currently
 * collects resources from it (`ownerId`). Starting-neighborhood / home-group
 * membership is not ownership and must not tint the star.
 */
export function systemInk(state: GameState, system: StarSystem): string {
  if (!system.ownerId) return UNOWNED_INK;
  return empireColor(state, system.ownerId);
}