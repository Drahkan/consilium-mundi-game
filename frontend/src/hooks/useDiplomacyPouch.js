import { useCallback, useState } from 'react';

// useDiplomacyPouch — extracted from App.js for the kernel v5 hook split.
// Trivial state hook that owns the pouch visibility toggle + a compound
// reload callback the pouch invokes after a diplomacy op.
export default function useDiplomacyPouch({ reloadGameState, reloadPlayers }) {
  const [showDiplomacy, setShowDiplomacy] = useState(false);

  const reload = useCallback(async () => {
    if (reloadGameState) await reloadGameState();
    if (reloadPlayers) await reloadPlayers();
  }, [reloadGameState, reloadPlayers]);

  return {
    showDiplomacy,
    openDiplomacy: () => setShowDiplomacy(true),
    closeDiplomacy: () => setShowDiplomacy(false),
    reload,
  };
}
