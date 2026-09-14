# How this kernel plugs into the current Emergent branch

That branch (`backend/server.py` `class GameEngine`, ~1800 lines, plus `App.js` ~3400 lines) is a **working hosted demo**. Do not delete the lobby, timer, ready-up, replay, or map UI.

The kernel replaces **rules** (mapgen, combat, diplomacy). `backend/kernel_api.py` speaks the **same URLs and JSON** App.js already uses (`systems` as a dict, `owner`, `connections`, `starfleet_details`, `player_resources`, `combat_reports`, `ready_players`, `turn_deadline`, `game_over`).

## One-time wiring

1. Node on PATH for the API process (`node -v`). Do not port the kernel to Python.
2. Unpack this zip at the repo root.
3. In `backend/server.py`:
   - Keep FastAPI app + CORS + `load_dotenv`.
   - **Stop serving** the old GameEngine routes (create-game, join, orders, ready, resolve, timer, replay, state). Leave the class in the file if tests still import it, or move it to `backend/game_engine_legacy.py`.
   - Add:

```python
from kernel_api import mount_kernel
mount_kernel(app)
```

4. `cd packages/consilium-kernel && echo '{"op":"ping"}' | node cli.mjs` must print `"pong": true`.

## What stays (hosting)

| Piece | Why |
|---|---|
| Lobby / join-by-code / share `?game=` | Demo multiplayer |
| Ready-up + per-turn countdown + pause/extend | Already in App.js |
| Replay viewer + game-over score card | `kernel_api` fills `snapshots` |
| Mongo `persistence.py` | Optional; wire later to save `match["engine"]` |
| App.js map, orders, combat panel | Consumes `viewLegacy` JSON |

## What the kernel now owns

Galaxy generation (PHP-faithful), combat, supply/upkeep, builds, FoW math, **diplomacy / alliances / pacts** (new — this branch never built them), all DD victory modes.

`GET /state` includes a `kernel` object (threads, alliances, pacts, civs) that App.js can ignore until you port `ui-reference/diplomacy-modal.tsx`.

## Do not

- Restore or expand `GameEngine`.
- Apply `*.grok_broken.bak`.
- Invent `resolve.py`.
- Restyle the in-game chrome into a dashboard.

## After wiring

Old pytest files target `GameEngine` methods. They will fail against the kernel until rewritten. That is expected. Do not “fix” them by putting combat back into Python.
