# Design-Doc Traceability Matrix

Source: `/app/docs/ConsiliumMundi-DD-v1.0.5.pdf`. Purpose: a 30-second
reference so "is X actually built, and did we mean to skip it?" doesn't
require a fresh audit every time. Update this table whenever a new
design-doc system is implemented or a new demo-only feature is added.

Last updated: 2026-08 (post-demo-prep audit).

| Design-doc feature (Section) | Status | Reference | Notes |
|---|---|---|---|
| Resource Phase | Implemented | `server.py: resource_phase()` | |
| Upkeep Phase | Implemented | `server.py: upkeep_phase()` | Fleets destroyed if unaffordable, per doc |
| Activity Phase | Implemented | orders/build/espionage/ready endpoints | |
| Resolution Phase (combat) | Implemented | `resolve_system_combat()` | Multi-party, tie-break, support-only attackers |
| Trade Phase | **NOT implemented** (collapsed into Resolution/Build) | — | User decision 2026-08: keep collapsed for the demo |
| Build Phase | Implemented | `build_phase()` / `execute_build_order()` | |
| Victory: Standard (>50% systems) | Implemented (locks game on win) | `check_victory_condition()`, `resolve_turn()` victory freeze, `game_over`/`final_victory` in state | Only mode wired to a game option so far |
| Victory: Galactic Domination | **NOT implemented** | — | |
| Victory: Last Civilization Standing | **NOT implemented** | — | |
| Victory: Corporate Takeover | **NOT implemented** | — | |
| Victory: Gunship Diplomacy | **NOT implemented** | — | |
| Turn Limit end-condition | **NOT implemented (design decision pending)** | — | Design doc mentions "Turn Duration" per-turn timer but not a max-turns rule. Auto-resolve on timer already handles AFK stalls, so this is a game-design call. |
| Game actually ends/locks on victory | Implemented (Aug 2026) | `resolve_turn()` sets `game_over`/`final_victory`; `_require_active_game()` 409s all mutation endpoints; frontend renders a full-screen game-over modal with Return-to-Home | |
| Player abandonment ("government collapsed") | **NOT implemented** | — | |
| Fog of War (1-jump basic mode) | Implemented | `compute_visibility()` | |
| Uncharted Territory / extended sight / scanner upgrade | Reserved, not wired | `extended_sight` dict exists but unused | Explicitly deferred by user, do not build yet |
| Diplomacy interface / messaging (Section 2) | **NOT implemented** | — | Planned P1, stub UI |
| Shared sight with allies | **NOT implemented** | — | Deferred until Diplomacy phase work begins |
| Espionage (sabotage/destabilize/counter-espionage) | Partial | `execute_espionage_order()` | Costs + flags exist; effects are minimally wired (e.g. sabotage of upgrades isn't consumed anywhere else yet) |
| System upgrades (starport/shipyard/colony/mining/wormhole) | Implemented | `execute_build_order()` | |
| Retreat & Rally Points | Implemented | `retreat_starfleet()`, `/rally` endpoint | Added this session, matches doc's "retreat if possible" rule |
| **Ready-Up buttons** | Implemented — **not in original design doc** | `/api/game/{id}/ready` | Added because the demo needed a way to move faster than the timer, not a doc requirement |
| **Turn Timer + Pause/Extend** | Implemented — **not in original design doc** | `/api/game/{id}/timer` | Doc specifies "Turn Duration" as a game option but no live countdown/host pause UX; this was built because a live multi-browser demo needed it |
| **Multi-browser lobby / join-by-code** | Implemented — **not in original design doc** | `/join-game`, `/start` | Doc's "Game Interface" section assumes a persistent account-based lobby; this is a lightweight session-less version built for the demo |
| **Rally-point map markers** | Implemented — **not in original design doc** | `renderGalaxyMap` → `rallyLinks` | Player-scoped, dashed line + "R" flag on the rally system. Rally logic itself is doc-spec; the on-map indicator is a UX add. |
| **AI + Human mixed play** | **NOT implemented — parked for very late stage** | — | User note: investigate feasibility after core game is playable, possibly post-launch. Current legal-random-mover bot (`tests/backend/bot.py`) could seed this. |

## Test-harness coverage vs. this matrix (2026-08)

- `tests/backend/test_api.py`, `test_multi_party_combat.py`, `test_visibility.py`,
  `test_rally_and_ready.py`: single-action / narrow-scenario unit tests.
- `tests/backend/test_soak_multi_turn.py` (new): multi-turn (25-turn, 3-player)
  soak test using `bot.py`'s legal-random-mover. Asserts engine-level
  invariants (no swallowed exceptions, no orphaned/duplicated fleets, no
  resource-shape corruption, no FoW leakage) that stay true regardless of
  which victory condition or new system gets added later. Does **not**
  assert a specific game-ending outcome, because end-game rules above are
  still incomplete by design.
- `tests/backend/test_concurrency.py` (new): fires genuinely parallel
  requests (ThreadPoolExecutor) to catch races the rest of the suite can't,
  e.g. concurrent ready-up double-resolving a turn, or concurrent order
  submission from two players clobbering each other.
- Still missing (deferred per user 2026-08): a "play until Standard victory"
  end-to-end test — unblocked now that the engine actually locks on
  victory, but writing it now would need a rewrite once other victory
  conditions land, so still parked. Turn Limit / other victory modes
  also still deferred, blocked on those rules not existing yet.
