# Kernel changelog — 2026-09-14 (v2 ping)

BREAKING: none. `echo '{"op":"ping"}' | node packages/consilium-kernel/cli.mjs` now returns `"version": 2`.

## API additions (hosting should call these)

| op | purpose |
|---|---|
| `serialize` | `{ op, state }` → `{ version, blob }` — blob **is** the GameState JSON. Round-trip safe. |
| `load` | `{ op, blob }` → hydrated `{ state }`. Fills missing arrays. Rejects blob.version > kernel SAVE_VERSION (currently 2). |
| `inboxForPlayer` | `{ op, state, viewerId }` → `{ inbox: { unread, pending, incidents, unsentPacts, promiseReports, alliances, legalTradeIds } }` |
| `tradeFrontier` | `{ op, state, playerId, toId }` → `{ systemIds }` — legal landing systems for a trade/pact **from playerId toward toId**. Use this for compose dropdowns under FoW. |
| `legalTradeDestinations` | `{ op, state, playerId }` → `{ systemIds }` — every system this admiralty can currently land goods on. |

Existing ops already used: `answerIncident`, `deliverPact`. They were never missing from the kernel — only from the pouch UI.

## Persistence contract (Issue A)

1. Canonical blob = the kernel `GameState` object (`JSON.stringify` / `JSON.parse`). There is no second schema. Do **not** store `viewLegacy` as the engine.
2. `state.version` is the schema version (SAVE_VERSION, currently **2**). On load, call CLI `load`.
3. Mongo document (overwrite last state; snapshots live **inside** the blob):

```
{ _id, engine: GameState,          // full kernel state, including turnSnapshots[]
  players_index, join_code, host_user_id,
  player_user_ids, turn_due_at, turn_seconds, turn_paused,
  started, updated_at }
```

`engine.turnSnapshots` is **per-turn append-only inside the document**. One Mongo replace per save. Do not invent a second collection unless cost becomes a problem (then archive finished games).

`GameDAO.list_games_info` must read `engine.turn` / `engine.options.playerCount`, not `current_turn` / `engine.config`.

## Diplomacy FoW (iteration_3 compose bug)

The sender must **not** pick the recipient's landing system from the sender's visible map. Call `tradeFrontier` for **each half**:

- Goods the sender gives → `tradeFrontier(state, senderId, recipientId)` (lands on recipient-adjacent unclaimed/recipient systems the **sender** can reach).
- Goods the sender requests → do not let the sender pick a system the recipient cannot land on. Either omit requestSystemId until the recipient counters, or only list systems from `tradeFrontier(state, recipientId, senderId)` that the sender can still **see**. If the kernel rejects accept, that is correct — show the error.

## Do not

- Port kernel to Python
- Expand GameEngine
- Add `getVisibleActionsFor` this cycle (phase + inbox is enough)
- Split Trade into its own phase
- Invent Shared Sight UI before kernel vision shares allied systems (not in this zip)
