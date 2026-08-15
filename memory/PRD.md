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
