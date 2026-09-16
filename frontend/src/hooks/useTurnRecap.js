import { useEffect, useState } from 'react';

// useTurnRecap — extracted from App.js for the kernel v5 hook split.
// Fetches GET /api/game/{id}/recap?player_id= when the turn number advances
// past 1 and stores the payload. The consumer renders <TurnRecap /> from it.
//
// Do NOT invent a second event log. This is a thin wrapper around the
// kernel's own CLI `recap` op.
export default function useTurnRecap({ apiBase, gameId, playerId, turn }) {
  const [turnRecap, setTurnRecap] = useState(null);
  const [lastRecapTurn, setLastRecapTurn] = useState(0);

  useEffect(() => {
    if (!apiBase || !gameId || !playerId || !turn) return undefined;
    if (turn <= 1) return undefined;
    if (turn === lastRecapTurn) return undefined;
    let alive = true;
    (async () => {
      try {
        const r = await fetch(
          `${apiBase}/api/game/${gameId}/recap?player_id=${encodeURIComponent(playerId)}`
        );
        if (!r.ok) return;
        const d = await r.json();
        if (!alive) return;
        setTurnRecap(d);
        setLastRecapTurn(turn);
      } catch (err) {
        console.warn('recap fetch failed', err);
      }
    })();
    return () => { alive = false; };
  }, [apiBase, gameId, playerId, turn, lastRecapTurn]);

  return { turnRecap, setTurnRecap };
}
