# Kernel changelog — 2026-09-15 (v4 ping)

BREAKING: none. Ping now returns `"version": 4`. SAVE_VERSION stays **2**.

## New CLI op: `recap`

```
{ "op": "recap", "state": GameState, "viewerId": "<playerId>" }
→ { recap: { turn, previousTurn, phase, result, winnerIds, log, promiseReports, snapshot, snapshotCount } }
```

`log` and `promiseReports` are the existing kernel fields (filtered to the viewer). `snapshot` is the last `turnSnapshots` frame. **Do not create a third event log.**

HTTP: `GET /api/game/{id}/recap?player_id=` wrapping this op.

## New UI references (copy into frontend/src/)

| File | Use |
|---|---|
| `ui-reference/EspionagePanel.jsx` | Selected-system dock. 1 Tech. sabotage fleets/starport, destabilize, counter. POST existing `/espionage-orders`. |
| `ui-reference/TurnRecap.jsx` | After-action overlay. Feed it `recap`. Replay still uses `ui-reference/replay-viewer.tsx` + `turnSnapshots`. |

## App.js split (no kernel)

MapCanvas.jsx and OrdersTray.jsx must **render**, not `return null`. ResourceHUD stays. DiplomacyPouch + ObligationsHUD stay outside.
