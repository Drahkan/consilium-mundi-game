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

### 2026-02 — Kernel v6 scenarios (Grok handoff #6)

- Unpacked kernel v6 (`consilium-kernel-v6.zip`) byte-for-byte
  (ping returns `version: 6`; `SAVE_VERSION` unchanged at 2). Added
  `CHANGELOG.md`, `ui-reference/GAME_TYPES.md`, `ui-reference/GameTypeSelect.jsx`.
- **Backend (`kernel_api.py`):**
  - New route `GET /api/game-types` → CLI `listGameTypes` (process-cached).
  - `_legacy_view` now decorates `view.kernel.options` with
    `state.options` plus a derived `victoryLabel` (looked up from the
    game-types catalog). Rules stay in the kernel.
- **Frontend (`App.js`):**
  - New `gameTypeConfig` + `gameTypes` state. `useEffect` fetches
    `/api/game-types` on mount.
  - Lobby renders a `Scenario` dropdown (`landing-game-type`) with all
    6 scenarios and the blurb (`landing-game-type-blurb`).
  - `fow_mode` is now an override: new option
    `Scenario default (recommended)` (value `default`) tells the client
    to omit `fow_mode` from `create-game` so the kernel's type default
    applies (Ragnarok fog on, Post-Apocalypse fog+uncharted, etc.).
  - HUD victory chip (`hud-victory-chip`) reads
    `gameState.kernel.options.victoryLabel` and sits next to the turn
    timer during `activity`.
  - Player-seat range kept at 3–4 and `turn_time_seconds` untouched per
    Grok's spec.
- Verified via testing agent: **backend 9/9** + all target frontend
  flows green (`/app/test_reports/iteration_10.json`). Kernel ping v6
  confirmed. `game_type=ragnarok` → `options.victory=lastStanding`. All
  six scenarios round-trip through `create-game`.

### 2026-02 — Kernel v5 hosting slim-down (no new zip)
- **App.js split (task 1)**: extracted `SystemDetailsPanel.jsx` (194 lines)
  and `hooks/useOrderSubmit.js` (owns `submitOrders`,
  `submitBuildOrders`, `resolveTurn`, `autoSubmitAllPendingOrders`).
  App.js is now **2538 lines** (was 2834). MapCanvas / OrdersTray /
  DiplomacyPouch / ObligationsHUD / EspionagePanel / TurnRecap / ResourceHUD
  unchanged. TDZ landmine on `loadGameState`/`loadGamePlayers` caught during
  the pass and fixed with lazy prop wrappers.
- **kernelPost everywhere (task 2)**: every kernel-mutating POST in the
  frontend now routes through `frontend/src/lib/kernelPost.js` so 400s
  toast the kernel `detail` verbatim. Zero raw fetch remains on kernel
  routes; only hosting-only `/start` and `/timer` stay on raw fetch (no
  kernel op). Covers create-game, join-game, ready, rally, orders,
  build-orders, resolve-turn, add-ai, DiplomacyPouch, ObligationsHUD,
  espionage.
- **WDS noise silenced (task 3)**: `frontend/src/lib/silenceWdsNoise.js`
  imported by `index.js` before `App` — narrowly filters
  `webpack-dev-server` / `WebSocketClient` / `ws://localhost` strings on
  `console.error|warn|log|info`. Real kernel and application errors are
  still logged.
- Verified via testing agent: **41/41 backend pytest** + all frontend
  flows green (`/app/test_reports/iteration_9.json`).

### 2026-02 — Kernel v5 wrap (Grok handoff #5)

- Unpacked kernel v5 (`consilium-kernel-v5.zip`) byte-for-byte
  (ping returns `version: 5`; `SAVE_VERSION` unchanged at 2).
- **Grok v5 gap closed:** `recap.snapshot.players` and top-level
  `recap.players` are now non-empty arrays of
  `{ id, name, civName, colors }`. Also verified to survive backend restart
  (Mongo rehydrate → CLI `load` → overlay from live state).
- **Hook split (task 1):**
  - `frontend/src/hooks/useTurnTimer.js` — owns the 1s tick, `autoResolveFiredRef`,
    and `secondsRemaining`. Only the host fires `resolveTurn()` on 0.
  - `frontend/src/hooks/useTurnRecap.js` — fetches `/recap` when
    `gameState.turn` advances past 1.
  - `frontend/src/hooks/useDiplomacyPouch.js` — pouch open/close +
    compound reload.
  - MapCanvas + OrdersTray continue to render (no blank map).
- **ESLint (task 2):** `frontend/eslint.config.mjs` flat config enforces
  `no-undef` and `react/jsx-no-undef`. `npx eslint` on `src/*` is clean.
- **Toast kernel 400s (task 3):** `frontend/src/lib/kernelPost.js`
  surfaces kernel `detail` strings verbatim via `sonner`. Espionage
  schedule/cancel, `DiplomacyPouch.post`, and `ObligationsHUD.post` all
  route errors through it — no more silent rollback.
- **Info-panel (task 4):** duplicate `Owner:` line removed from the
  starfleet-item block (system-level Owner in system-info kept).
- Verified via testing agent: **41/41 backend pytest** + all frontend
  flows green (`/app/test_reports/iteration_8.json`).


- Unpacked kernel v4 (`consilium-kernel-v4.zip`) byte-for-byte
  (ping returns `version: 4`; `SAVE_VERSION` unchanged at 2).
- Added `CHANGELOG.md`, `ui-reference/ESPIONAGE.md`, `ui-reference/TURN_RECAP.md`,
  and copied `ui-reference/EspionagePanel.jsx` + `ui-reference/TurnRecap.jsx`
  into `frontend/src/`.
- **App.js real split:**
  - `MapCanvas.jsx` — extracted `renderGalaxyMap` (357 lines, 16 named props
    including `isDragging`). Kernel field names preserved verbatim.
  - `OrdersTray.jsx` — extracted `renderOrdersPanel` + `renderOrderSummary` +
    `renderBuildingPanel`. Also mounts the new `EspionagePanel` next to the
    orders slot.
  - `EspionagePanel.jsx` — dropped in from `ui-reference/`, wired via
    `scheduleEspionage`/`cancelEspionage`/`confirmHostileEspionage`
    callbacks. `POST /espionage-orders` now also calls `_persist` so
    espionage queues survive backend restart.
  - `TurnRecap.jsx` — dropped in from `ui-reference/`; App.js fetches
    `/api/game/{id}/recap` when `gameState.turn` advances and renders
    `<TurnRecap>` as a full-screen modal until dismissed.
- **New backend route:** `GET /api/game/{id}/recap?player_id=` → CLI `recap`.
  Returns `{ turn, previousTurn, phase, result, winnerIds, log,
  promiseReports, snapshot, snapshotCount }`. Validates `player_id` against
  `engine.players` (unknown → 404). No second event log.
- **Confirm-before-hostile-espionage:** implemented client-side using
  `sharedSightAllyIds` from the kernel inbox — if the target system's owner
  is an ally, the panel shows `window.confirm(...)` with the
  `hostileOrderWarning`-style text.
- Verified via testing agent: **39/40 backend pytest** (only failure is a
  kernel-side gap flagged back to Grok — see Notes) + frontend playwright
  showing MapCanvas, OrdersTray, EspionagePanel, ResourceHUD, TurnRecap all
  render and integrate (`/app/test_reports/iteration_7.json`).

### Notes flagged back to Grok
- **`recap.snapshot.players` is missing.** Kernel `host.ts::recapFor` currently
  exposes `snapshot.{turn, phase, systems, resources, combat}` but not
  `players`. Spec parity requires `players`.


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
