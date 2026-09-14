# Consilium Mundi — PRD

## Original problem statement
Turn-based space strategy game (React + FastAPI + MongoDB) transferred from Claude. Continue evolving gameplay (multi-party combat, warnings, map polish) without breaking auth-lightweight local flow. Environment: Kubernetes with supervisor, `/api` prefix required.

## Architecture (as of June 2026 — KERNEL WRAP)
**MAJOR CHANGE:** Game *rules* are now owned by a sealed TypeScript kernel (`packages/consilium-kernel/`, run via `node cli.mjs`), NOT Python. Emergent owns *hosting* only (lobby, timers, ready-up, Mongo, deploy, App.js chrome). Standing law: `GROK_EMERGENT.md`, `KERNEL.md`, `HOSTING.md`, `docs/ConsiliumMundi-DD-v1.0.5.pdf`.
- `/app/packages/consilium-kernel/` — sealed rules kernel (mapgen, combat, diplomacy, alliances, pacts, victory, AI). **Do NOT edit, port, or "fix" these files.** `cli.mjs` is the single Node entrypoint (`echo '{"op":"ping"}' | node cli.mjs` → `pong`).
- `/app/backend/kernel_bridge.py` — `kernel(op, **payload)` subprocess bridge to Node.
- `/app/backend/kernel_api.py` — `mount_kernel(app)` registers ALL `/api` routes; wraps kernel ops and speaks the legacy JSON App.js expects (systems dict, player_resources, kernel.threads, ready_players, turn_deadline, game_over). Diplomacy routes: `POST /api/game/{id}/diplomacy/{send|accept|decline|counter|denounce}`. Matches are in-memory (`matches` dict); persistence.GameDAO not yet wired.
- `/app/backend/server.py` — FastAPI app + CORS + `class GameEngine` (LEGACY, no HTTP routes, kept only for old in-process unit tests). New matches use `openMatchLegacy` (kernel), never construct GameEngine.
- `/app/frontend/src/App.js` — hosting chrome (lobby, map, orders, ready-up, timer, replay). Keep URLs.
- `/app/frontend/src/DiplomacyPouch.jsx` — templated diplomacy pouch (ported from `ui-reference/diplomacy-modal.tsx`). No free-text chat; offers show goods GIVEN and RECEIVED with Accept/Decline/Counter.
- `/app/ui-reference/` — Grok's reference TSX (diplomacy-modal, galaxy-map, play-screen, replay-viewer, flag) to port into App.js. Do not invent a chat box.
- Kernel clamps `num_players` to a minimum of 3 (host + AI seats; humans claim AI seats on join).

## Architecture (LEGACY — pre-kernel, historical)
Turn-based space strategy game (React + FastAPI + MongoDB). Environment: Kubernetes with supervisor, `/api` prefix required.

## Changelog

### 2026-06 (session 4) — Grok kernel wrap + templated diplomacy pouch
- **Kernel wrap adopted**: unpacked Grok's full-tree zip over `/app` (preserving protected `.env`s + `.git`). Node v20 confirmed on host; kernel ping returns `pong`. Verified full loop against existing App.js: create-game → 2 joins auto-start (3-player) → fleet order → all ready → turn advances → replay snapshot captured. `mount_kernel(app)` active; GameEngine has **0** HTTP routes; new matches never construct GameEngine.
- **Diplomacy routes** added to `kernel_api.py` (send/accept/decline/counter/denounce) wrapping kernel ops `sendDispatch/acceptDispatch/declineDispatch/counterDispatch/denounce`.
- **DiplomacyPouch.jsx** ported: peer list (with allied badge + unread counts), threads, per-message TermsView showing **You receive** / **You give** (goods + landing systems), Accept/Decline/Counter, and a templated ComposeForm (topics: trade/alliance/attack/support/espionage/intelligence; attitudes; trade give/request with landing-system selects; intents; unless-conditions). Header `Diplomacy` button (unread badge). Compose landing dropdowns only offer provably-visible landings (no all-systems fallback) so senders can't compose offers the recipient can't fulfil; Send disabled when trade landings are missing.
- **DD PDF** stored at `docs/ConsiliumMundi-DD-v1.0.5.pdf`.
- **Tested**: backend 12/12 pytest (`backend/tests/test_kernel_diplomacy.py`) + testing agent frontend E2E (iteration_3.json) — pouch renders goods given/received with Accept/Decline/Counter; both at 100%.
- **Known limits (real blockers only)**: (a) matches are in-memory — a backend restart drops all games (persistence.GameDAO not wired); (b) under fog-of-war a sender may not see a peer's borders, so trade *requests* are limited to visible landings (kernel remains authority and rejects illegal landings); (c) alliance-incident responses (`answerIncident`) and pact-delivery scheduling (`deliverPact`) are not yet surfaced in the pouch UI.



### 2026-08 (session 3) — Full Replay + Score Card + Combat Timeline + Rally Ghost Preview
- **End-Screen Score Card**: game-over modal redesigned per user spec — winner name in the winner's color, condition label ("Standard Victory — controls more than half the galaxy"), per-player score card (systems / starfleets / upgrades / T·M·C resources) with the winner starred and highlighted, primary "View Full Replay" action, and a small, muted "Return to Home Screen" button at the very bottom (separated by a border, tiny type, transparent bg) so it's not accidentally clicked while reaching for game-info actions. All fields exposed via `game.final_victory.score_card` and `game.final_victory.condition_label`.
- **Full Replay Modal**: new full-screen viewer over the game-over screen. FoW off (game is over — nothing to hide). Renders the full galaxy at any historical turn: connections, owner-colored systems, home-system rings, fleet-count dots, upgrade abbreviations, red combat sparks on systems that saw combat this turn. Transport controls: ⏮ / ⏯ / ⏭ / turn scrubber (`data-testid` on each), plus a combats-this-turn list. Auto-play advances 1 turn per 1.6s and stops at the last frame. Backed by a new `/api/game/{id}/replay` endpoint that returns all snapshots joined with player display names.
- **Snapshots on the engine**: `GameEngine.turn_snapshots[]` captured (a) once when the game first enters `activity` (Turn 1 start frame), (b) after every successful `resolve_turn()` advance, (c) on the victory-lock turn, matching `final_victory.final_turn`. Each frame keeps systems (id/name/x/y/owner/upgrades/resources/connections/starfleet_ids), starfleets (id/owner/system_id), player_resources, and this-turn combat_reports. Kept on the engine object itself so when the Mongo DAO in `persistence.py` is wired to save/load whole engines, snapshots ride along automatically. **Storage note**: current games live in an in-memory `games` dict (demo-scale). A production/multi-game deploy needs the DAO wired up so both live state AND per-turn snapshots persist to Mongo — noted in Roadmap. Compaction (diffs vs. full frames, or archive DB for finished games) is a later optimization.
- **Rally Ghost Preview**: rally-point UX now matches the movement "stage → preview → commit" tone. Picking a target in the rally dropdown updates `pendingRally[fleet_id]` — a translucent flag with a dashed banner (opacity 0.45) appears on the target system alongside a dashed line from the fleet's current system, and **Set Rally** / **Cancel** buttons appear beside the dropdown. Set Rally commits via `/api/game/{id}/starfleets/{sf_id}/rally`; Cancel discards the pending change with no API call. Ghost overlay is layered under the committed flag so the two can coexist and be distinguished visually.
- **Combat Timeline Playback**: `renderCombatReports` panel now has a `combat-playback` navigator strip (⏮ label ⏭ [All]) at the top. Clicking prev/next focuses a single turn (filters the list to that turn's reports, auto-expands them, marks them seen); "All" clears the focus and reverts to the full history. Turn navigator works even on quiet turns (turns with no combat still show as "Turn N — no reports" in the underlying data).
- **Subdued Proceed-Anyway button**: the post-turn resource-warning dialog now uses the same "primary vs. subdued" pattern as the End Screen — Cancel is the prominent blue action, "Proceed anyway" is the small muted outlined button, so a player can't muscle-memory-click through a warning that would destroy their own fleets on the next upkeep.
- **Tests**: `tests/backend/test_replay.py` (5 new tests): score_card is present in final_victory with correct systems/starfleets/upgrades counts; snapshots captured at game start; snapshot captured on the winning turn matches `final_turn`; replay endpoint joins in player names and keeps combat_reports as a list; unknown-game replay returns 404. `/_test/force-victory` scaffold enhanced by testing agent to populate score_card + condition_label + a snapshot so the E2E flow renders realistically. Full suite: **42 passed / 1 skipped** (up from 37).
- **Testing agent verified end-to-end** via Playwright: game-over-overlay renders with all elements; Full Replay modal opens with functional controls; Return to Home strips ?game= and returns to landing; Rally Ghost Preview flow (dropdown → ghost → Set commits / Cancel discards); subdued Proceed-Anyway styling.
- **User notes captured in Roadmap**: (a) Turn Limit end-condition still a design-decision-pending P2 (turn timer already handles AFK stalls per user); (b) AI+Human mixed play deferred to very late stage / post-launch; (c) Diplomacy stub explicitly deferred — must be built as a proper system, not kludged in; (d) Persistence via Mongo DAO for multi-game production is a required next step (noted in Roadmap P1).

### 2026-08 — Victory Lock + Map Rally Markers
- **Victory Lock (real game-over, not a banner)**: `GameEngine` now has `game_over: bool` and `final_victory: dict`. At the end of every `resolve_turn()` we run `check_victory_condition()`; if a winner is found we freeze the state (`game_over = True`, `final_victory` snapshots winner/systems_controlled/total/required plus the `final_turn` the win happened on, `turn_deadline = None`, `ready_players` cleared) and RETURN without advancing the turn — the state players see is the state that produced the win. All subsequent `resolve_turn()` calls short-circuit on `game_over`. A new `_require_active_game(game)` helper 409s every mutating endpoint after a win: `/orders`, `/build-orders`, `/espionage-orders`, `/resolve-turn`, `/timer`, `/ready`, `/starfleets/{id}/rally`, `/action`. `/state` remains readable so the frontend can render the game-over screen. `game_over` and `final_victory` are surfaced in the serialized state alongside the transient `victory_status`.
- **Frontend Game-Over screen**: `renderVictoryStatus` upgraded — when `game_over: true` a full-screen backdrop-blurred modal takes over showing the winner's name in their player color, systems controlled / threshold / final turn, and a **Return to Home** button (`data-testid="game-over-return-home-btn"`). The button calls a new `returnToHome()` helper that resets ALL local state (gameState, orders, dialogs, join form, seen-combat set, autoResolveFired refs) and strips `?game=<id>` from the URL via `history.replaceState`, so the old lobby link doesn't re-hydrate on the next render. Auto-resolve tick also bails when `game_over` is true so the timer chip never flashes "0:00" against a locked game.
- **Map Rally Markers**: `renderGalaxyMap` now computes a `rallyLinks` list from the current player's own fleets with `rally_point` set (scoped by owner defensively — even though the API already redacts rally_point on non-FULL visibility, this keeps things safe for a future shared-sight/spectator view). For each link it draws a thin dashed line in the player's color from the fleet's current system to its rally system, and stamps a small colored "R" flag on the rally system itself (deduped, so multiple fleets rallying to the same spot only paint one flag). Rendered under the move/support arrows and under system nodes with `pointerEvents="none"`, so clicks still land on the underlying node.
- **Fleet-KeyError soak-test crash fixed**: while running the soak test after the victory-lock landed, it turned up an intermittent `KeyError: <fleet_id>` in resolution: a fleet with a pending move order was destroyed as a defender of its OWN home system (attacked in a different combat that resolved first), then the target-system's combat tried to `del old_system.starfleets[<same fleet id>]` and blew up. Fixed at two layers: (a) `resolve_system_combat` now filters `incoming_starfleets` down to fleets still present in `self.starfleets` at the moment of combat, so a fleet destroyed earlier this phase is silently dropped; (b) both `del old_system.starfleets[sf.id]` movement lines are guarded with `if sf.id in old_system.starfleets` in case the fleet's roster was already touched. This is a real latent bug — dict iteration order (post-uuid fleet ids) made it show up on ~30–40% of soak runs.
- **Duplicate-key React warning fixed**: connection lines in the galaxy map now key on the sorted-pair `conn-{a}-{b}` so A↔B mutual links don't collide in React's key check.
- **Test-only scaffold endpoints (gated)**: `/api/game/{id}/_test/force-victory` and `/api/game/{id}/_test/give-system` were added to make the E2E victory / rally-non-self-target flows testable without playing an entire game. Both 404 unless `EXPOSE_TEST_ENDPOINTS=1` is set in `/app/backend/.env`. `server.py` now `load_dotenv()`s the backend env file at import so this (and `MONGO_URL` / `DB_NAME` if persistence is ever wired) actually reach the process.
- **Tests**: `tests/backend/test_victory_lock.py` (6 new engine-level tests); `tests/backend/test_victory_lock_http.py` (7 new HTTP-level tests against the live URL); `tests/backend/test_soak_multi_turn.py` updated to break cleanly on `engine.game_over` instead of asserting an ever-advancing turn counter. Full suite: **37 passed / 1 skipped** (up from 24).
- **Design-doc traceability updated**: `Game actually ends/locks on victory` and the Standard victory row are now Implemented. Added new backlog rows for **Turn Limit end-condition** (design doc mentions "Turn Duration" as a per-turn timer, does NOT specify a max-turns end-condition — design-decision-pending P2, not a code gap; the existing turn timer + auto-resolve already prevents AFK stalls per user's own analysis) and **AI + Human mixed play** (very-late-stage, possibly post-launch — the legal-random-mover bot could seed a future strategic AI seat).
- **Explicitly deferred by user this session**: Diplomacy Stub — user considers diplomacy one of the most important/unique systems in Consilium Mundi and does not want it kludged in; will build it as a proper system, not a placeholder.

### 2026-08 — Test-harness audit + soak/concurrency tests + real bug fix
- **Audit finding**: no existing test played a game to completion, and the underlying "finish" rules aren't fully built — `check_victory_condition()` only implements 1 of the design doc's 5 victory conditions (Standard, >50% systems), there's no Turn Limit, and the game doesn't actually lock/end on victory (`victory_status` is a banner only, `resolve_turn()` keeps advancing). Full breakdown in `/app/memory/design_doc_traceability.md`. **User decision**: leave end-game rules as-is for now; focus the harness on invariants that survive future feature churn instead.
- **`tests/backend/bot.py`** (new): a "legal random-mover" bot that drives a player through the real HTTP API (build/move/support/rally/ready) — not a strategic AI, just guarantees every action is legal, so multi-turn tests exercise real code paths instead of an idle no-op "AI".
- **`tests/backend/test_soak_multi_turn.py`** (new): 25-turn, 3-player soak test using the bot. Asserts invariants that must hold regardless of which victory/diplomacy features get added later (no swallowed exceptions, no orphaned/duplicated starfleets, well-shaped resources, no FoW leakage, ready-set always clears).
- **Real bug caught and fixed**: this soak test immediately found a starfleet-registry desync. `execute_build_order()` generated new fleet ids as `f"fleet_{player_id}_{len(self.starfleets)}"` — a counter that can repeat after fleets are destroyed, so a new fleet could collide with the id of a still-alive fleet elsewhere, silently orphaning it in its system's roster once the colliding id was later destroyed. Fixed by using a `uuid4` suffix instead (`server.py` line ~839). This is a real latent bug that would eventually corrupt state in a long real-world game — not a demo-only issue.
- **`tests/backend/test_concurrency.py`** (new): fires genuinely parallel requests (ThreadPoolExecutor) since real players act simultaneously, not sequentially like the rest of the suite — covers concurrent ready-up (must resolve exactly once, not zero/twice) and concurrent order submission from two different players (neither should clobber the other). Both pass.
- **`/app/memory/design_doc_traceability.md`** (new): design-doc-section → implemented/not-yet table, explicitly flagging which demo features (Ready-Up, Timer, Lobby) were added because the demo needed them, not because the doc specified them. Update this whenever a new system lands.
- Full backend suite: **24 passed / 1 skipped** (persistence test skips without Mongo in test env).
- **Explicitly deferred by user this session**: full-game "play to Standard victory" e2e test, Turn Limit + game-lock-on-win, other 4 victory condition modes, separating Trade Phase out of Resolution — all stay as documented gaps, not built.

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
- Multi-party combat accuracy.
- Map UI indicators for pending orders.
- **Victory Lock** — game actually stops and shows a final screen on win (Aug 2026).

### P1 — next
- **Persistence layer wired up (multi-game production readiness)**: `persistence.py` DAO exists but games currently live in an in-memory dict on the server. For the "many concurrent games" world the user described, wire the DAO to save/load whole `GameEngine` instances (including `turn_snapshots` for the Full Replay). Consider a separate archive collection for finished games where mid-game-only fields (orders, ready_players, timer) are stripped to shrink storage.
- **Diplomacy phase** (proper implementation, not a stub — the messaging/alliance/shared-sight system is one of the game's core differentiators per the user; do not kludge it).
- **Shared sight with allies** (build alongside Diplomacy, opt-in per pair).
- **"No combat this turn" placeholder** rows in combat panel for turns where the player had no engagements (the new combat-playback navigator already exposes this gap — a quiet turn is skipped in `reportsByTurn`).

### P2 — later
- **Additional victory conditions** (Galactic Domination, Last Civ Standing, Corporate Takeover, Gunship Diplomacy).
- **Turn Limit end-condition (design decision pending)** — design doc mentions "Turn Duration" as a per-turn timer but does NOT specify a max-turns rule. Needs a design pass: is it "no cap" vs. "N turns → highest-score wins"? The existing turn timer + auto-resolve already prevents AFK stalls, so this is a game-design call, not a stability blocker.
- Detailed Espionage mechanic and resource costs.
- Replay / enhanced combat timeline (per-turn diff view).
- Highlight/animate resource widget rows when they change.
- Refactor `App.js` into smaller components; split `server.py` (routes vs. engine).

### Future
- **AI players mixed with human players** — very late stage, possibly post-launch. Investigate whether the current legal-random-mover bot could be evolved into a strategic AI seat that plays alongside humans in a live game.
- Full-game "play to Standard victory" e2e automated test (unblocked now that victory locks — write once other victory conditions land so we don't have to rewrite it).
- Separate Trade Phase (currently collapsed into Resolution).
- Real-time updates (WebSocket/SSE).

## Notes for the next agent
- The GitHub repo lives at `/app/consilium-mundi-game/` (remote `Drahkan/consilium-mundi-game`). Emergent's runtime uses the top-level `/app/backend` and `/app/frontend` folders — keep them in sync when hand-writing patches.
- Backups of the broken Grok patch are preserved as `/app/backend/server.py.grok_broken.bak` and `/app/frontend/src/App.js.grok_broken.bak` — safe to delete once the user confirms the restored version.
- Combat report shape changed: added `attacker_breakdown`, `defender_breakdown`, `defender_owner`, `winner`, `contested_between`. Legacy `attackers` (owner→total) and `defenders` (int) are still present for backward compatibility.
