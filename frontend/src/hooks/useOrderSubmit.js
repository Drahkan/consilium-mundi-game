import { useCallback } from 'react';
import { kernelPost } from '../lib/kernelPost';

// useOrderSubmit — extracted from App.js for the kernel v5 hosting
// slim-down (Grok's task 1). Owns the four raw order-submission calls:
//
//   submitOrders(state)           → POST /api/game/{id}/orders
//   submitBuildOrders(state)      → POST /api/game/{id}/build-orders
//   resolveTurn(state)            → POST /api/game/{id}/resolve-turn (with auto-flush)
//   autoSubmitAllPendingOrders    → per-player flush before resolve
//
// The larger `submitAllOrders` UX wrapper (with the resource-warning modal)
// stays in App.js because it is state-heavy on the confirmation flow.
// Every kernel POST here goes through kernelPost, so 400s toast the kernel
// detail. Kernel field names are preserved verbatim.
export default function useOrderSubmit({
  apiBase,
  currentGame,
  currentPlayer,
  starfleetOrders,
  setStarfleetOrders,
  buildOrders,
  setBuildOrders,
  playerBuildOrders,
  setPlayerBuildOrders,
  availablePlayers,
  loadGameState,
  loadGamePlayers,
  setLoading,
  setError,
}) {
  const submitOrders = useCallback(async () => {
    if (!currentGame || !currentPlayer) return;
    const orders = Object.values(starfleetOrders);
    const res = await kernelPost(`${apiBase}/api/game/${currentGame}/orders`, {
      player_id: currentPlayer,
      orders,
    });
    if (!res.ok) return;
    setStarfleetOrders({});
    alert('Orders submitted successfully!');
  }, [apiBase, currentGame, currentPlayer, starfleetOrders, setStarfleetOrders]);

  const submitBuildOrders = useCallback(async () => {
    if (!currentGame || !currentPlayer) return;
    const orders = Object.values(buildOrders);
    const res = await kernelPost(
      `${apiBase}/api/game/${currentGame}/build-orders`,
      { player_id: currentPlayer, orders },
    );
    if (!res.ok) return;
    setBuildOrders({});
  }, [apiBase, currentGame, currentPlayer, buildOrders, setBuildOrders]);

  const autoSubmitAllPendingOrders = useCallback(async () => {
    for (const player of availablePlayers) {
      const playerId = player.id;
      const playerStarfleetOrders =
        Object.keys(starfleetOrders).length > 0 && currentPlayer === playerId
          ? starfleetOrders
          : {};
      const currentPlayerBuildOrders = playerBuildOrders[playerId] || {};

      if (Object.keys(playerStarfleetOrders).length > 0) {
        const orders = Object.values(playerStarfleetOrders);
        await kernelPost(`${apiBase}/api/game/${currentGame}/orders`, {
          player_id: playerId,
          orders,
        });
      }
      if (Object.keys(currentPlayerBuildOrders).length > 0) {
        const orders = Object.values(currentPlayerBuildOrders);
        await kernelPost(`${apiBase}/api/game/${currentGame}/build-orders`, {
          player_id: playerId,
          orders,
        });
      }
    }
    setStarfleetOrders({});
    setPlayerBuildOrders({});
    setBuildOrders({});
  }, [
    apiBase,
    currentGame,
    currentPlayer,
    availablePlayers,
    starfleetOrders,
    playerBuildOrders,
    setStarfleetOrders,
    setPlayerBuildOrders,
    setBuildOrders,
  ]);

  const resolveTurn = useCallback(async () => {
    if (!currentGame) return;
    try {
      if (setLoading) setLoading(true);
      await autoSubmitAllPendingOrders();
      const res = await kernelPost(
        `${apiBase}/api/game/${currentGame}/resolve-turn`,
        {},
      );
      if (!res.ok) throw new Error(res.error || 'Failed to resolve turn');
      alert('Turn resolved! All pending orders have been automatically submitted.');
      if (loadGameState) await loadGameState(currentGame, currentPlayer);
      if (loadGamePlayers) await loadGamePlayers(currentGame);
    } catch (err) {
      if (setError) setError(err.message);
    } finally {
      if (setLoading) setLoading(false);
    }
  }, [
    apiBase,
    currentGame,
    currentPlayer,
    autoSubmitAllPendingOrders,
    loadGameState,
    loadGamePlayers,
    setLoading,
    setError,
  ]);

  return { submitOrders, submitBuildOrders, autoSubmitAllPendingOrders, resolveTurn };
}
