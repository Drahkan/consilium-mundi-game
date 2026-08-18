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
| Victory: Standard (>50% systems) | Implemented | `check_victory_condition()` | Only mode wired to a game option |
| Victory: Galactic Domination | **NOT implemented** | — | |
| Victory: Last Civilization Standing | **NOT implemented** | — | |
| Victory: Corporate Takeover | **NOT implemented** | — | |
| Victory: Gunship Diplomacy | **NOT implemented** | — | |
| Turn Limit end-condition | **NOT implemented** | — | No "no duration" vs. capped-turns option exists |
| Game actually ends/locks on victory | **NOT implemented** | `victory_status` is a banner only | `resolve_turn()` keeps advancing turns after a win |
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
  end-to-end test, and any test around Turn Limit / other victory modes --
  both blocked on those rules not existing yet, not on test-harness gaps.
