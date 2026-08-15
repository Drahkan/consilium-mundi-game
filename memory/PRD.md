# Consilium Mundi — PRD

## Original problem statement
Turn-based space strategy game (React + FastAPI + MongoDB) transferred from Claude. Continue evolving gameplay (multi-party combat, warnings, map polish) without breaking auth-lightweight local flow. Environment: Kubernetes with supervisor, `/api` prefix required.

## Architecture (as of Feb 2026)
- `/app/backend/server.py` — FastAPI + monolithic `GameEngine` (galaxy gen, orders, combat, resolve).
- `/app/backend/persistence.py` — Optional MongoDB DAO layer (lazy). No-op if `MONGO_URL` unset.
- `/app/frontend/src/App.js` — Monolithic React UI (~2200 lines): lobby, map, orders, combat reports.
- `/app/tests/backend/` — Pytest suite (targeted combat unit tests).
- `/app/consilium-mundi-game/` — Read-only git checkout of upstream repo (used as source-of-truth backup).

## Changelog

### 2026-02-15 — Ready-Up + Retreat Rally Points
- **Ready-up flow**: `POST /api/game/{id}/ready` `{player_id, ready}`. When every player in the roster flags ready, the backend auto-runs `resolve_turn()`. `_reset_turn_deadline()` clears the ready set on each new activity phase so it never carries over. State surfaces `ready_players: [id…]`.
- **Header button**: shows `Ready (N/M)`, turns green with `✓ Ready` once the current player flags in. Ties into existing 5s polling so all browsers see the count climb in near-real-time; when the last player readies up, everyone auto-lands on the next turn.
- **Retreat rally points**: `Starfleet.rally_point` (already an attribute — previously unused) now drives `retreat_starfleet()`. On retreat the fleet teleports to its rally point if that system is still friend-owned; captured/destabilised rally points are silently ignored so a fleet can never rally into hostile territory.
- **API**: `POST /api/game/{id}/starfleets/{sf_id}/rally` `{player_id, rally_system_id | null}`. Validated at set-time: rally must be `null` or a system currently owned by the requesting player. `rally_point` is now surfaced in every FULL `starfleet_details` entry.
- **UI**: In the system detail panel, every fleet the current player owns gets a "Rally point (on retreat)" dropdown listing all their owned systems (or `— None (stay put) —`).
- **Tests** (`tests/backend/test_rally_and_ready.py`, 7 new): rally teleport to friendly system, rally no-op with no target, rally silently ignored when captured by enemy, endpoint rejects enemy-owned rally, endpoint clear-with-null, partial ready does not resolve, all ready auto-resolves and clears set, unready removes from set. **Full suite: 21 passed / 1 skipped.**
- **Design-Doc TODO parked**: Shared Sight With Allies deferred to Diplomacy work — will need to decide how sharing is opted-in and whether it uses `extended_sight` (PARTIAL) or a full-sight variant when we get there.

### 2026-02-15 — Fog of War + Pause/Extend Timer
- **Backend visibility architecture** (`GameEngine.compute_visibility` + `_serialize_system`):
  - Three visibility levels per (player, system): `full`, `partial`, `hidden`.
  - `basic` mode (default): a system is FULL if the player owns it, is a direct neighbour of an owned system, or currently holds one of the player's fleets. Everything else is HIDDEN.
  - `off` mode: everything is FULL (spectator / dev).
  - Reserved for a future scanner-style upgrade: `GameEngine.extended_sight[player_id] = {system_id, …}`. Any system in that set that isn't already FULL is served as PARTIAL — name and coords only, plus presence-only flags (`has_owner`, `has_upgrades`) with owner identity / specific upgrades / fleet counts fully redacted. The upgrade itself hasn't been wired yet; the serializer and frontend both already speak this shape, so adding the actual game rule is a small, localized change.
  - `HIDDEN` payloads leak nothing sensitive: name is `"???"`, `owner`/`resources`/`upgrades`/`starfleets`/`starfleet_details` are blanked, but `connections` (topology) is preserved so the player can still see and plan around the graph.
  - New game-config field `fow_mode` (`'basic' | 'off'`, default `'basic'`).
- **Frontend map**: renders visibility-aware nodes — fogged systems are muted grey dashed circles labeled `???`, PARTIAL systems use a neutral fill with `★` (owned by someone) and `+` (has upgrades) sigils, FULL systems keep the current look. System detail panel shows a dedicated "Unknown Space" view for HIDDEN and a "long-range scan" view for PARTIAL. Own income calculations already iterate only over FULL systems, so no consumer changes were needed.
- **FoW selector in the Create form**: "Basic (recommended)" vs "Off — full galaxy visible (demo/dev)".
- **Pause & Extend timer** (host-only): new endpoint `POST /api/game/{id}/timer` with actions `pause` / `resume` / `extend` (`seconds` default 120). Pausing freezes `turn_deadline` and stores `turn_paused_remaining`; extending while paused adds to `turn_paused_remaining`, extending while running pushes out `turn_deadline`. State exposes both fields. Header shows `⏸ PAUSED mm:ss` when paused and disables auto-resolve while paused. Host sees ⏸ Pause / ▶ Resume / +2 min buttons.
- **Tests**: 6 new visibility tests (`tests/backend/test_visibility.py`) locking in the 1-jump rule, HIDDEN redaction, fleet-presence reveal, `off` mode, extended-sight PARTIAL flow, and the "extended sight never downgrades FULL" guarantee. Full backend suite: **14 passed / 1 skipped**.

### 2026-02-15 — Turn timer (server-authoritative, auto-resolve on expiry)
- **Backend**: new `turn_time_seconds` field on `GameConfig` (default 300 = 5 min, clamped to a minimum of 30s). `GameEngine._reset_turn_deadline()` sets `turn_deadline` when a game enters `activity` (join-full, add-ai-fill, or explicit `/start`) and after every `resolve_turn()`. State now returns `turn_deadline` (ISO-8601) and `turn_time_seconds`.
- **Frontend**: 
  - Create form has a "Turn timer" selector (2 / 5 (recommended) / 10 / 15 / 30 minutes).
  - Header shows a live monospace countdown chip (`⏱ mm:ss`) beside turn info; turns amber-red and pulses when ≤ 30s remain.
  - Client ticks once per second off the server deadline, so refreshes/clock drift don't desync.
  - Auto-resolve is driven only by the host browser (first player in the roster) with a per-turn ref guard, so the other browsers won't fire duplicate resolves.

### 2026-02-15 — Demo prep: two-browser multiplayer + lobby
- **Landing page**: replaced single-form UI with a Create / Join tab layout. Create supports 2/3/4-player games; Join takes a game code and player name. URL params `?game=<id>` and `?name=<n>` auto-populate the join form for shareable links.
- **Lobby (waiting room)**: after create/join, if the game isn't in `activity` phase yet, the player sees a lobby showing the game code, a copyable share link (`<origin>?game=<id>`), a player list with empty-slot placeholders, and a "Start Now (fill with AI)" button for the host (first joiner). State polls every 2s so joins show up live.
- **In-game code chip**: the header now shows a small game-code chip with a "Copy link" button, so the host can invite spectators or replacements mid-game.
- **Backend**: added `POST /api/game/{id}/start` which force-starts a game and fills empty slots with AI (or requires 2+ humans when `fill_with_ai=false`). `create-game` no longer auto-adds AI; users decide in the lobby.
- **Active polling**: state is refreshed every 5s during `activity` phase too, so both browsers see turn resolutions and opponent moves without manual refresh.
- **Header controls**: Resolve Turn, Combat Reports and Center Home are now always visible (not gated on Solo Mode). Added a "Solo Mode" toggle so demos can flip between players when useful.
- **Combat panel placeholder rows**: the timeline now renders every turn from 1..current_turn and shows a "No combat this turn" row for empty turns, so the panel feels alive from turn 1 on.

### 2026-02-15 — Restore + multi-party combat + map order indicators
- **Restored** working `server.py` (1173 lines) and `App.js` (2147 lines) from the git checkout after Grok's canonical patch had truncated both.
- **Fixed** an App.css orphan `16px;` line that broke the frontend build.
- **Combat engine (server.py, `resolve_system_combat`)**:
  - Fixed operator-precedence bug that granted a phantom starport defense bonus even to systems without a starport.
  - Support-only attackers (players issuing support orders but no incoming fleet) are now enumerated, counted, and listed in the combat report.
  - Tie-breaker: if two or more attackers tie for the strongest physically-present force AND combined attackers beat the defender, the outcome is `contested` — defenders are destroyed, starport falls, system becomes uncontrolled, all attackers bounce.
  - Support-only players contribute strength but cannot claim the system (only owners with fleets present are candidates).
  - Added `attacker_breakdown` (fleets/support per player) and `defender_breakdown` (fleets/support/starport) plus explicit `winner` and `contested_between` fields to the combat report.
- **Frontend combat reports (App.js)**: renders new breakdown (`Nf+Ns` per attacker; `Nf+Ns+P` for defenders), colors the `contested` outcome amber, uses `report.winner` for outcome color, and shows the tied-between roster on contested battles.
- **Map order indicators (App.js `renderGalaxyMap`)**: overlays a dashed cyan `S` arrow for support orders and a solid amber `M` arrow for movement orders, drawn under the system nodes so nodes remain clickable.
- **Tests**: `/app/tests/backend/test_multi_party_combat.py` — 5 unit tests, all passing:
  - starport bonus only when present
  - starport sabotage disables bonus
  - support-only attacker is counted and listed
  - tied attackers → contested outcome
  - strongest attacker wins when no tie

## Roadmap

### P0 — done
- Restore compiled/runnable app.
- Multi-party combat accuracy (Issue 3).
- Map UI indicators for pending orders (Issue 4).

### P1 — next
- **"No combat this turn" placeholder** rows in combat panel for turns where the player had no engagements (needs list of resolved turns tracked in engine).
- **Retreat & rally point** logic (`retreat_starfleet` is a no-op TODO).
- **Post-turn resource warnings**: revisit hard-block vs. soft warning UX.

### P2 — later
- Detailed Espionage mechanic and resource costs.
- Replay / enhanced combat timeline (per-turn diff view).
- Highlight/animate resource widget rows when they change.
- Refactor `App.js` into smaller components; split `server.py` (routes vs. engine).

### Future
- Turn timer & auto-resolution (background scheduler).
- Real-time updates (WebSocket/SSE).

## Notes for the next agent
- The GitHub repo lives at `/app/consilium-mundi-game/` (remote `Drahkan/consilium-mundi-game`). Emergent's runtime uses the top-level `/app/backend` and `/app/frontend` folders — keep them in sync when hand-writing patches.
- Backups of the broken Grok patch are preserved as `/app/backend/server.py.grok_broken.bak` and `/app/frontend/src/App.js.grok_broken.bak` — safe to delete once the user confirms the restored version.
- Combat report shape changed: added `attacker_breakdown`, `defender_breakdown`, `defender_owner`, `winner`, `contested_between`. Legacy `attackers` (owner→total) and `defenders` (int) are still present for backward compatibility.
