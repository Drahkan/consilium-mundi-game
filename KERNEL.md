# Consilium Mundi — sealed rules kernel

This folder is **law**. Emergent (and any other agent) is the **hosting layer**.
It may wrap these files. It may not rewrite them.

## What this is

TypeScript rules for Consilium Mundi: map generation, simultaneous-order combat,
trades, espionage, templated diplomacy, alliances, pacts, word-keeping, AI admiralties, victory.

`packages/consilium-kernel/cli.mjs` is a **single Node file**. FastAPI must call it.
Do **not** port this to Python. Do **not** invent `GameEngine`, `resolve.py`, or a second schema.

## What Emergent owns

Accounts, lobby, join codes, Mongo persistence, 24-hour (or other) turn clocks,
ready-up, deploy. Keep `backend/persistence.py` (`GameDAO`) — store the kernel
`GameState` JSON in `engine` (the whole document). Add hosting metadata next to it:

```
{ _id, engine: GameState, players_index, join_code, host_user_id,
  player_user_ids: { [playerId]: userId }, turn_due_at, updated_at }
```

## What Emergent must not touch

Do not rewrite, simplify, translate, or regenerate:

- combat / `resolveTurn`
- map generation
- diplomacy topics, terms, accept/counter, alliances, pacts, word-keeping
- the `GameState` shape in `types.ts`

If a request conflicts with this file, stop and say so.

## How to run the kernel

```
node packages/consilium-kernel/cli.mjs
```

stdin: one JSON object `{ "op": "...", ... }`
stdout: one JSON object `{ "ok": true|false, "error": null|string, "state": GameState, ... }`

Use `backend/kernel_bridge.py` (`from kernel_bridge import kernel`).

### Ops

| op | when |
|---|---|
| `openMatch` | host creates a lobby (`options`, `hostCiv`, `hostName`, `seed`) |
| `claimSeat` | a human joins; consumes one AI slot |
| `viewForPlayer` | **only** this goes to a client (`viewerId`) |
| `applyFleetOrder` / `applyBuild` / `applyTrade` / `applyEspionage` | orders this turn; not resolved yet |
| `sendDispatch` / `acceptDispatch` / `declineDispatch` / `counterDispatch` / `denounce` / `answerIncident` | same-turn diplomacy. Alliance form/break takes force on mutual accept. **Goods do not move on accept.** |
| `deliverPact` | schedule the viewer's promised delivery (ordinary trade order) |
| `markReady` / `markUnready` | lock or unlock this admiralty |
| `resolveIfDue` | if all living humans ready **or** `turnDueAt` passed: run AI, then **one** `resolveTurn` |
| `dismissReport` | after the turn report, back to activity |
| `resign` | collapse that government |

Clients send **intents**. The server applies the kernel and writes Mongo.
Never let a client resolve a turn. Never send the full `engine` to a client when fog/uncharted is on — always `viewForPlayer`.

## Simultaneous orders

Humans do not see each other's orders before resolve. Enemy fleets in a view have `order: hold`.
When the clock expires, anyone who has not submitted is treated as all-hold and readied.

`endTurn` in `engine.ts` is the vs-AI sequential helper. Hosted play uses `resolveIfDue` in `host.ts`.

## Diplomacy (do not invent a chat box)

- Attack / support / espionage name only systems the sender or recipient can reach.
- Trade landings are systems you do **not** own that border one you do (prefer their owned, else unclaimed both border).
- Alliance is a verbal compact: mutual accept forms it immediately; `denounce` breaks it immediately.
- Stringed messages may bundle `allianceClause: "form"|"break"` with a trade.
- After resolve, `promiseReports` score kept / partial / broken. `allyIncidents` ask the wronged ally how to respond.

Lift the pouch UI from `ui-reference/` rather than a generic messenger.

## This repo's current Python files

`backend/server.py` in the zip you had is a **stub**. It comments "keep GameEngine" but the class is not in the tree. `frontend/src/App.js` calls `renderGalaxyMap` and other functions that are not defined.

**Do not restore a Python GameEngine.** Delete the stub classes if you find fragments. Wire FastAPI to `kernel_bridge.py`. Keep lobby/auth/Mongo. Replace in-game chrome with the kernel views + `ui-reference/` (map, pouch, orders).

Node must be available on the API host (`node` on PATH). If the FastAPI image has no Node, add it or a tiny Node sidecar. Still do not port the kernel to Python.

## UI ownership

- Emergent: sign-in, lobby, friends, join code, "turn locks in 22:14:08".
- Kernel / ui-reference: galaxy map, system dock, diplomatic pouch, turn report (word-keeping).

Do not restyle the in-game chrome into a dashboard.

## Version

Kernel `GameState.version` / `SAVE_VERSION` in `constants.ts`. Bump only when the kernel author changes the document shape. If `engine.version` is older than the kernel, refuse to resolve and say the match is stale.
