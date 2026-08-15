"""Regression tests for rally points and the ready-up flow."""

import os
import sys
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

from server import (  # noqa: E402
    app, games, GameEngine, GameConfig, SolarSystem, Starfleet,
)

client = TestClient(app)


# ---------------------------------------------------------------------------
# Rally point unit tests (retreat teleports fleet to friendly rally)
# ---------------------------------------------------------------------------

def _make_engine_with_two_owned():
    engine = GameEngine(GameConfig(num_players=2))
    engine.players = ["A", "B"]
    front = SolarSystem("front", "Front", 0, 0)
    front.owner = "A"
    rally = SolarSystem("rally", "Rally", 0, 0)
    rally.owner = "A"
    engine.systems["front"] = front
    engine.systems["rally"] = rally
    return engine, front, rally


def test_retreat_moves_to_friendly_rally_point():
    engine, front, rally = _make_engine_with_two_owned()
    fleet = Starfleet("f1", "A", "front")
    fleet.rally_point = "rally"
    engine.starfleets["f1"] = fleet
    front.starfleets["f1"] = fleet

    engine.retreat_starfleet(fleet)

    assert fleet.system_id == "rally"
    assert "f1" in rally.starfleets
    assert "f1" not in front.starfleets


def test_retreat_stays_put_when_no_rally():
    engine, front, _rally = _make_engine_with_two_owned()
    fleet = Starfleet("f1", "A", "front")
    engine.starfleets["f1"] = fleet
    front.starfleets["f1"] = fleet

    engine.retreat_starfleet(fleet)

    assert fleet.system_id == "front"
    assert "f1" in front.starfleets


def test_retreat_ignores_rally_owned_by_enemy():
    """A rally point that was captured by another player is silently
    ignored — the fleet stays at its source rather than teleporting into
    hostile territory."""
    engine, front, rally = _make_engine_with_two_owned()
    rally.owner = "B"                        # captured!
    fleet = Starfleet("f1", "A", "front")
    fleet.rally_point = "rally"
    engine.starfleets["f1"] = fleet
    front.starfleets["f1"] = fleet

    engine.retreat_starfleet(fleet)

    assert fleet.system_id == "front"
    assert "f1" not in rally.starfleets


def test_rally_endpoint_rejects_enemy_system():
    """API endpoint enforces friend-owned-only at set time."""
    engine = GameEngine(GameConfig(num_players=2))
    engine.players = ["A", "B"]
    a = SolarSystem("s_a", "sa", 0, 0); a.owner = "A"
    b = SolarSystem("s_b", "sb", 0, 0); b.owner = "B"
    engine.systems.update({"s_a": a, "s_b": b})
    fleet = Starfleet("f1", "A", "s_a")
    engine.starfleets["f1"] = fleet
    a.starfleets["f1"] = fleet
    engine.phase = "activity"
    engine._reset_turn_deadline()
    games["game_r"] = engine

    resp = client.post(
        "/api/game/game_r/starfleets/f1/rally",
        json={"player_id": "A", "rally_system_id": "s_b"},
    )
    assert resp.status_code == 400
    assert "own" in resp.json()["detail"].lower()

    resp2 = client.post(
        "/api/game/game_r/starfleets/f1/rally",
        json={"player_id": "A", "rally_system_id": "s_a"},
    )
    assert resp2.status_code == 200
    assert resp2.json()["rally_point"] == "s_a"

    # Clear rally
    resp3 = client.post(
        "/api/game/game_r/starfleets/f1/rally",
        json={"player_id": "A", "rally_system_id": None},
    )
    assert resp3.status_code == 200
    assert resp3.json()["rally_point"] is None


# ---------------------------------------------------------------------------
# Ready-up flow
# ---------------------------------------------------------------------------

def _make_two_player_active_engine():
    engine = GameEngine(GameConfig(num_players=2))
    engine.players = ["A", "B"]
    engine.phase = "activity"
    engine._reset_turn_deadline()
    return engine


def test_partial_ready_does_not_resolve_turn():
    engine = _make_two_player_active_engine()
    games["game_ready_1"] = engine
    initial_turn = engine.current_turn

    resp = client.post("/api/game/game_ready_1/ready", json={"player_id": "A", "ready": True})
    body = resp.json()
    assert resp.status_code == 200
    assert body["resolved"] is False
    assert body["current_turn"] == initial_turn
    assert body["ready_players"] == ["A"]


def test_all_ready_auto_resolves_turn():
    engine = _make_two_player_active_engine()
    games["game_ready_2"] = engine
    starting_turn = engine.current_turn

    client.post("/api/game/game_ready_2/ready", json={"player_id": "A", "ready": True})
    resp = client.post("/api/game/game_ready_2/ready", json={"player_id": "B", "ready": True})

    body = resp.json()
    assert body["resolved"] is True
    assert body["current_turn"] == starting_turn + 1
    # After resolve, ready set is cleared for the new turn
    state = client.get("/api/game/game_ready_2/state").json()
    assert state["ready_players"] == []


def test_unready_removes_player_from_set():
    engine = _make_two_player_active_engine()
    games["game_ready_3"] = engine
    client.post("/api/game/game_ready_3/ready", json={"player_id": "A", "ready": True})
    r = client.post("/api/game/game_ready_3/ready", json={"player_id": "A", "ready": False})
    body = r.json()
    assert body["ready"] is False
    assert body["ready_players"] == []
    assert body["resolved"] is False
