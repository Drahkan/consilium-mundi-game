"""Regression tests for the victory lock.

A game must actually stop when someone hits a win condition — the
engine freezes state, mutation endpoints reject further changes, and
the final_victory snapshot is stable across state reads. Without this
the "victory" is only a banner and the turn counter keeps ticking.
"""

import os
import sys
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

from server import (  # noqa: E402
    app, games, GameEngine, GameConfig, SolarSystem, Starfleet,
)

client = TestClient(app)


def _make_near_win_engine(winner="A", other="B", owned=6, unowned=3):
    """Return a game engine where `winner` owns `owned` systems and
    `other` owns 1, with `unowned` uncontrolled systems. Victory =
    > 50%, so tune owned/unowned so the winner is *just under* the
    threshold — one more system flips them over.
    """
    engine = GameEngine(GameConfig(num_players=2))
    engine.players = [winner, other]
    engine.player_resources = {
        winner: {"tech": 10, "metals": 10, "chon": 10},
        other:  {"tech": 10, "metals": 10, "chon": 10},
    }
    # Build systems
    for i in range(owned):
        s = SolarSystem(f"w{i}", f"W{i}", i, 0)
        s.owner = winner
        engine.systems[s.id] = s
    other_sys = SolarSystem("o0", "O0", 100, 0)
    other_sys.owner = other
    engine.systems[other_sys.id] = other_sys
    for i in range(unowned):
        s = SolarSystem(f"u{i}", f"U{i}", 200 + i, 0)
        engine.systems[s.id] = s
    engine.phase = "activity"
    engine.current_turn = 5
    engine._reset_turn_deadline()
    return engine


def test_victory_check_finds_winner_but_engine_only_locks_after_resolve():
    engine = _make_near_win_engine(owned=6, unowned=3)  # 8 systems, need > 4 → 5
    v = engine.check_victory_condition()
    assert v is not None
    assert v["winner"] == "A"
    # Not yet locked — check_victory_condition alone doesn't set the flag
    assert engine.game_over is False


def test_resolve_turn_locks_game_and_freezes_snapshot():
    engine = _make_near_win_engine(owned=6, unowned=3)
    starting_turn = engine.current_turn
    engine.resolve_turn()
    assert engine.game_over is True
    assert engine.final_victory is not None
    assert engine.final_victory["winner"] == "A"
    # final_turn snapshots the turn on which the win happened —
    # crucially, the engine must NOT have advanced past it.
    assert engine.current_turn == starting_turn
    # Timer must be cleared so the frontend doesn't keep counting down.
    assert engine.turn_deadline is None


def test_resolve_turn_is_noop_after_game_over():
    engine = _make_near_win_engine(owned=6, unowned=3)
    engine.resolve_turn()
    frozen_turn = engine.current_turn
    frozen_victory = engine.final_victory
    engine.resolve_turn()  # second call — must do nothing
    engine.resolve_turn()  # ...and a third
    assert engine.current_turn == frozen_turn
    assert engine.final_victory is frozen_victory


def test_get_state_exposes_game_over_and_final_victory():
    # Drive through the HTTP layer so we cover serialization too.
    engine = _make_near_win_engine(owned=6, unowned=3)
    game_id = "test_victory_lock_1"
    games[game_id] = engine
    try:
        engine.resolve_turn()
        r = client.get(f"/api/game/{game_id}/state")
        assert r.status_code == 200
        body = r.json()
        assert body["game_over"] is True
        assert body["final_victory"] is not None
        assert body["final_victory"]["winner"] == "A"
        assert "final_turn" in body["final_victory"]
    finally:
        games.pop(game_id, None)


def test_mutation_endpoints_reject_after_win():
    engine = _make_near_win_engine(owned=6, unowned=3)
    game_id = "test_victory_lock_2"
    games[game_id] = engine
    try:
        engine.resolve_turn()  # lock the game
        # /orders → 409
        r = client.post(
            f"/api/game/{game_id}/orders",
            json={"player_id": "A", "orders": []},
        )
        assert r.status_code == 409
        # /build-orders → 409
        r = client.post(
            f"/api/game/{game_id}/build-orders",
            json={"player_id": "A", "orders": []},
        )
        assert r.status_code == 409
        # /ready → 409
        r = client.post(
            f"/api/game/{game_id}/ready",
            json={"player_id": "A", "ready": True},
        )
        assert r.status_code == 409
        # /resolve-turn → 409
        r = client.post(f"/api/game/{game_id}/resolve-turn")
        assert r.status_code == 409
        # /timer → 409
        r = client.post(
            f"/api/game/{game_id}/timer",
            json={"action": "extend", "seconds": 60},
        )
        assert r.status_code == 409
        # /state remains readable
        r = client.get(f"/api/game/{game_id}/state")
        assert r.status_code == 200
    finally:
        games.pop(game_id, None)


def test_no_lock_when_no_winner():
    """Guard the negative case: unresolved game, no victory, no lock."""
    engine = _make_near_win_engine(owned=3, unowned=5)
    # 9 systems total; winner has 3, other has 1 → no majority
    v = engine.check_victory_condition()
    assert v is None
    engine.resolve_turn()
    assert engine.game_over is False
    assert engine.final_victory is None
