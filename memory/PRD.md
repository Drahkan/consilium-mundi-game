# Consilium Mundi — PRD

## Original problem statement
Multiplayer space-strategy game (Consilium Mundi). Grok Build owns the sealed
TypeScript rules kernel at `packages/consilium-kernel/`. Emergent owns FastAPI
plumbing, Mongo persistence, React chrome/UI wiring. Kernel is invoked as a
Node child process via `backend/kernel_bridge.py`. Rules must not be ported
into Python.

Design Document of record: `/app/docs/ConsiliumMundi-DD-v1.0.5.pdf`.
Kernel contract: `/app/KERNEL.md`. Collab contract: `/app/GROK_EMERGENT.md`.

## What's been implemented

### 2026-02 — Kernel v3 wrap (Grok handoff #3)
- Unpacked kernel v3 (`consilium-kernel-v3.zip`) byte-for-byte
  (`SAVE_VERSION = 3`, ping now returns `version: 3`).
- Added `CHANGELOG.md` and `ui-reference/SHARED_SIGHT.md`.
- **Owed-pact regression fix (Grok's #1 must-fix):**
  - `ObligationsHUD.jsx` now consumes `inbox.owedDeliveries`
    (`[{ pactId, resources, systemId, otherId }]`), which the kernel already
    resolved for the viewer. The old bogus `pactHalf(pact.a.playerId)` path is
    deleted.
  - Backend inbox route passes through the new kernel v3 fields
    `owedDeliveries` and `allyIds`.
  - Verified end-to-end: real accepted trade → sender's inbox shows owed
    `{tech:1,…}` → `POST /diplomacy/deliver-pact` returns 200. Test:
    `backend/tests/test_kernel_owed_pact.py`.
- **Lobby (Grok's #2 must-fix):** "2 players" option removed. Only "3–4
  admiralties (open seats fill with AI)" and "4 admiralties" remain.
  Default `numPlayersConfig = 3`.
- **Shared-sight chip (Grok's #3 must-fix):** `App.js` renders
  `Shared sight: {names}` when `inbox.allyIds` is non-empty. No panel, no
  toggle. Kernel v3 fogs allied systems automatically via `visionOf`.
- **App.js split (Grok's #4, partial):**
  - `ResourceHUD.jsx` extracted (top-bar T/M/CHON chip).
  - `MapCanvas.jsx` and `OrdersTray.jsx` are documented scaffolds pointing at
    the App.js line ranges that need to move. Full extraction deferred to
    avoid regressing the game loop in the same pass as the kernel v3 wrap.
- Verified via testing agent: **33/33 backend pytest** + clean frontend smoke
  (`/app/test_reports/iteration_5.json`).


- Unpacked kernel v2 (`consilium-kernel-v2.zip`) byte-for-byte into
  `packages/consilium-kernel/` (now uses `cli.mjs`, `SAVE_VERSION = 2`).
- Added `CHANGELOG.md`, `KERNEL.md`, `GROK_EMERGENT.md`,
  `ui-reference/OBLIGATIONS.md` at repo root.
- **Persistence wired to the kernel `GameState`:**
  - `backend/persistence.py::GameDAO.engine` = CLI `serialize` blob (full
    GameState incl. `turnSnapshots`).
  - Load path in `kernel_api._hydrate_from_dao` calls CLI `load`.
  - `list_games_info` reads `engine.turn` and `engine.options.playerCount`.
  - Motor client wired in `backend/server.py::@app.on_event("startup")` via
    `MONGO_URL` and `DB_NAME`.
  - `matches[]` cache is now lazy-loaded from Mongo on 404. Backend restarts
    no longer drop games.
- **Diplomacy inbox endpoint:** `GET /api/game/{gid}/diplomacy/inbox/{pid}` →
  CLI `inboxForPlayer` → `{ pending, incidents, unsentPacts }`.
- **FoW-safe trade frontier:** `GET /api/game/{gid}/diplomacy/frontier?player_id&to_id`
  → CLI `tradeFrontier`. `DiplomacyPouch.ComposeForm` now fetches this for the
  "you give (lands at)" column — sender no longer picks recipient landings off
  their own fogged map.
- **Obligations HUD (new `frontend/src/ObligationsHUD.jsx`):** ported from
  `ui-reference/play-screen.tsx` per `OBLIGATIONS.md`.
  - Unsent-pact banner → CLI `deliverPact` via `POST /diplomacy/deliver-pact`.
  - Incident modal → CLI `answerIncident` via `POST /diplomacy/answer-incident`
    with actions `ignored | broke | threatened` (+ `unless`).
- Verified via testing agent: **22/22 backend pytest** + frontend smoke
  (`/app/test_reports/iteration_4.json`).

### 2026-02 — Kernel v1 wrap (Grok handoff #1, previous session)
- FastAPI wrapper `kernel_api.py` mounts kernel-backed routes; legacy Python
  `GameEngine` bypassed for new matches.
- `DiplomacyPouch.jsx` initial port with Send / Accept / Decline / Counter /
  Denounce and goods-given / goods-received.
- Fog-of-war landing validation fix in the compose flow.

## Architecture

```
/app/
├── backend/
│   ├── server.py          # FastAPI app; Motor + GameDAO on startup
│   ├── kernel_api.py      # HTTP wrapper around the TS kernel
│   ├── kernel_bridge.py   # Child-process bridge to cli.mjs
│   ├── persistence.py     # GameDAO (Mongo) — engine = CLI serialize blob
│   ├── tests/             # test_kernel_diplomacy.py, test_kernel_persistence.py
│   └── .env               # MONGO_URL, DB_NAME
├── frontend/src/
│   ├── App.js             # Monolithic React chrome (~3450 lines)
│   ├── DiplomacyPouch.jsx # Templated diplomacy UI
│   └── ObligationsHUD.jsx # Incident modal + unsent-pact banner
├── packages/consilium-kernel/  # Sealed TS rules kernel (SAVE_VERSION=2)
├── ui-reference/          # Grok's reference UI + OBLIGATIONS.md
└── docs/ConsiliumMundi-DD-v1.0.5.pdf
```

## Key API endpoints (kernel-backed)
- `POST /api/create-game` / `POST /api/join-game`
- `GET  /api/game/{id}/state` (viewLegacy)
- `POST /api/game/{id}/orders | build-orders | espionage-orders | ready | resolve-turn`
- `POST /api/game/{id}/diplomacy/{send|accept|decline|counter|denounce}`
- `GET  /api/game/{id}/diplomacy/inbox/{player_id}`
- `GET  /api/game/{id}/diplomacy/frontier?player_id=&to_id=`
- `POST /api/game/{id}/diplomacy/answer-incident`
- `POST /api/game/{id}/diplomacy/deliver-pact`
- `GET  /api/games` (Mongo-backed)

## Priority backlog

### P0
- _(none — persistence + inbox + FoW frontier + obligations UI are done)_

### P1
- **Shared Sight With Allies** — kernel & UI reference needed (asked Grok).
- **Refactor `App.js`** into components (Pouch, MapCanvas, OrdersTray,
  ResourceHUD, ObligationsHUD is already extracted). Awaiting Grok's optional
  component-boundary map before mass splits.

### P2
- Espionage panel — kernel exposes ops, UI reference pending.
- Replay snapshots into Mongo (`state.turnSnapshots` is already persisted with
  the engine blob; still need a dedicated `GET /replay/{id}/frames` and player
  UI beyond what's in `App.js::renderReplayViewer`).

### P3
- Resource widget deltas (animate rows on change).
- Missing victory conditions UI (Galactic Domination, Last Civ Standing,
  Corporate Takeover, Gunship Diplomacy).
- Separate Trade Phase — currently collapsed into Resolution.

## Notes for future agents
- `packages/consilium-kernel/` is **law**. Grok owns it. Do not touch, port,
  or "fix" rules in Python.
- Emergent wraps, hosts, and persists. If a request conflicts with `KERNEL.md`,
  stop and say so.
- Kernel `SAVE_VERSION` currently `2`. `GameState.version` on the serialized
  blob is checked on `load` — refuse to resolve stale blobs.
- The kernel silently enforces a minimum `playerCount=3` regardless of the
  legacy `config.num_players=2` — worth surfacing in the lobby copy.
