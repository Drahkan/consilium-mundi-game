import type { GameState, TurnSnapshot } from "./types";

export type { TurnSnapshot };

export function captureSnapshot(state: GameState): TurnSnapshot {
  return {
    turn: state.turn,
    phase: state.phase,
    systems: state.systems.map((s) => {
      const counts = new Map<string, number>();
      for (const f of s.fleets) counts.set(f.ownerId, (counts.get(f.ownerId) ?? 0) + 1);
      return {
        id: s.id,
        name: s.name,
        x: s.x,
        y: s.y,
        ownerId: s.ownerId,
        isHome: s.isHome,
        upgrades: [...s.upgrades],
        neighbors: [...s.neighbors],
        fleets: [...counts.entries()].map(([ownerId, n]) => ({ ownerId, n })),
      };
    }),
    resources: Object.fromEntries(state.players.map((p) => [p.id, { ...p.resources }])),
    combat: state.log
      .filter((l) => l.severity === "combat")
      .map((l) => ({ text: l.text, systemId: l.systemId })),
  };
}

export function pushSnapshot(state: GameState) {
  const frames = state.turnSnapshots ?? [];
  const next = [...frames, captureSnapshot(state)];
  state.turnSnapshots = next.length > 80 ? [next[0]!, ...next.slice(-79)] : next;
}
