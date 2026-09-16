# Turn recap / after-action

Do **not** invent an event stream.

1. After resolve, call `GET /api/game/{id}/recap?player_id=` (CLI `recap`).
2. Render `TurnRecap.jsx` with that payload.
3. Full replay: existing `turnSnapshots` + `ui-reference/replay-viewer.tsx` / GET `/replay`.

Fields: `log` (this resolution), `promiseReports` (word kept/broken), last `snapshot`.
