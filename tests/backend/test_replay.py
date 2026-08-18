"""Tests for the Full Replay endpoint and end-of-game score card.

Locks in:
  - Snapshots are captured after every resolve_turn (and once at game
    start), so a Full Replay always has at least one frame per turn.
  - The victory-lock final_victory now includes a per-player score
    card (systems / starfleets / upgrades / resources).
  - /api/game/{id}/replay returns FoW-off frames with combat reports
    attached per turn, and joins in player display names for the
    client.
"""

import os
import sys
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

from server import (  # noqa: E402
    app, games, players, GameEngine, GameConfig, SolarSystem, Starfleet,
)

client = TestClient(app)


def _make_near_win_engine(winner="A", other="B", owned=6, unowned=3):
    engine = GameEngine(GameConfig(num_players=2))
    engine.players = [winner, other]
    engine.player_resources = {
        winner: {"tech": 3, "metals": 2, "chon": 5},
        other:  {"tech": 4, "metals": 4, "chon": 4},
    }
    for i in range(owned):
        s = SolarSystem(f"w{i}", f"W{i}", i, 0)
        s.owner = winner
        if i == 0:
            s.upgrades = ["starport", "shipyard"]
        engine.systems[s.id] = s
    other_sys = SolarSystem("o0", "O0", 100, 0)
    other_sys.owner = other
    engine.systems[other_sys.id] = other_sys
    for i in range(unowned):
        s = SolarSystem(f"u{i}", f"U{i}", 200 + i, 0)
        engine.systems[s.id] = s
    # Give the winner a fleet so score card sees starfleets>0
    fl = Starfleet("wf1", winner, "w0")
    engine.starfleets["wf1"] = fl
    engine.systems["w0"].starfleets["wf1"] = fl
    engine.phase = "activity"
    engine.current_turn = 3
    engine._reset_turn_deadline()
    return engine


def test_score_card_included_in_final_victory():
    engine = _make_near_win_engine(owned=6, unowned=3)
    engine.resolve_turn()  # locks the game
    fv = engine.final_victory
    assert fv is not None
    assert "score_card" in fv, "final_victory must include a per-player score card"
    sc = fv["score_card"]
    # One row per player
    by_pid = {row["player_id"]: row for row in sc}
    assert set(by_pid.keys()) == {"A", "B"}
    winner_row = by_pid["A"]
    loser_row = by_pid["B"]
    assert winner_row["systems"] == 6
    assert loser_row["systems"] == 1
    # Winner had one fleet at w0 (still alive), and starport + shipyard on w0
    assert winner_row["starfleets"] >= 1
    assert winner_row["upgrades"] >= 2
    # Condition label surfaces so the frontend can render it
    assert fv["condition"] == "standard"
    assert "Standard" in fv["condition_label"]


def test_snapshots_captured_at_game_start_and_after_resolve():
    engine = _make_near_win_engine(owned=3, unowned=5)  # no winner
    # _reset_turn_deadline in the fixture will have already captured
    # the initial frame.
    assert len(engine.turn_snapshots) == 1
    assert engine.turn_snapshots[0]["turn"] == 3
    engine.resolve_turn()  # advances (no victory yet)
    assert len(engine.turn_snapshots) == 2
    assert engine.turn_snapshots[1]["turn"] == engine.current_turn


def test_snapshot_captured_on_victory_turn_at_final_turn_number():
    engine = _make_near_win_engine(owned=6, unowned=3)  # will win this resolve
    initial_snapshots = len(engine.turn_snapshots)
    engine.resolve_turn()
    assert engine.game_over is True
    assert len(engine.turn_snapshots) == initial_snapshots + 1
    last = engine.turn_snapshots[-1]
    # Snapshot on the winning turn keeps the SAME turn number as
    # final_victory.final_turn (no post-win advance).
    assert last["turn"] == engine.final_victory["final_turn"]
    # Systems in the snapshot reflect the winning state.
    assert sum(1 for s in last["systems"].values() if s["owner"] == "A") == 6


def test_replay_endpoint_returns_snapshots_and_joined_player_names():
    engine = _make_near_win_engine(owned=6, unowned=3)
    game_id = "test_replay_1"
    games[game_id] = engine
    # Populate the players dict so the endpoint can join names.
    players["A"] = {"id": "A", "name": "Ariadne", "game_id": game_id}
    players["B"] = {"id": "B", "name": "Barron", "game_id": game_id}
    try:
        engine.resolve_turn()
        r = client.get(f"/api/game/{game_id}/replay")
        assert r.status_code == 200
        body = r.json()
        assert body["game_over"] is True
        assert body["final_victory"]["score_card"], "score card must be exposed via replay endpoint too"
        # Names joined in for the client
        assert {p["name"] for p in body["players"]} == {"Ariadne", "Barron"}
        assert len(body["snapshots"]) >= 1
        last = body["snapshots"][-1]
        # FoW off — names must NOT be redacted to '???'
        assert all(s["name"] != "???" for s in last["systems"].values())
        # Combat reports on the frame are per-turn (may be empty if no
        # combat happened) — must be a list, not missing.
        assert isinstance(last.get("combat_reports"), list)
    finally:
        games.pop(game_id, None)
        players.pop("A", None)
        players.pop("B", None)


def test_replay_endpoint_404_for_missing_game():
    r = client.get("/api/game/does_not_exist/replay")
    assert r.status_code == 404
