import { useEffect, useState, useRef } from 'react';

// useTurnTimer — extracted from App.js for the kernel v5 hook split.
// Owns the 1-second tick, the auto-resolve fire-once ref, and
// `secondsRemaining` derived from `gameState.turn_deadline`.
//
// The host (first entry in `availablePlayers`) is the only browser that
// fires `resolveTurn()` when the countdown hits zero — this preserves the
// single-writer invariant when N browsers view the same match.
export default function useTurnTimer({ gameState, availablePlayers, currentPlayer, resolveTurn }) {
  const [secondsRemaining, setSecondsRemaining] = useState(null);
  const timerTickRef = useRef(null);
  const autoResolveFiredRef = useRef({});

  useEffect(() => {
    if (timerTickRef.current) clearInterval(timerTickRef.current);
    if (!gameState || gameState.phase !== 'activity' || gameState.game_over) {
      setSecondsRemaining(null);
      return undefined;
    }
    if (gameState.turn_paused) {
      setSecondsRemaining(gameState.turn_paused_remaining || 0);
      return undefined;
    }
    if (!gameState.turn_deadline) {
      setSecondsRemaining(null);
      return undefined;
    }
    const deadlineMs = new Date(gameState.turn_deadline).getTime();
    const tick = () => {
      const remaining = Math.max(0, Math.round((deadlineMs - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining <= 0) {
        const isHost = availablePlayers.length > 0 && availablePlayers[0].id === currentPlayer;
        const turnKey = String(gameState.turn);
        if (isHost && !autoResolveFiredRef.current[turnKey]) {
          autoResolveFiredRef.current[turnKey] = true;
          resolveTurn();
        }
      }
    };
    tick();
    timerTickRef.current = setInterval(tick, 1000);
    return () => {
      if (timerTickRef.current) {
        clearInterval(timerTickRef.current);
        timerTickRef.current = null;
      }
    };
  }, [
    gameState?.turn_deadline,
    gameState?.phase,
    gameState?.turn,
    gameState?.turn_paused,
    gameState?.turn_paused_remaining,
    availablePlayers,
    currentPlayer,
    resolveTurn,
    gameState,
  ]);

  return { secondsRemaining };
}
