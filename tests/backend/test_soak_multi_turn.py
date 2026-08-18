"""Multi-turn soak test.

Plays a full multi-player game for many turns using the random-legal-mover
bot (bot.py) and asserts invariants that must hold no matter which
victory condition / new systems (diplomacy, espionage, scanner upgrade,
etc.) get layered in later. See /app/memory/design_doc_traceability.md
for what IS and ISN'T implemented yet -- this test intentionally does
NOT assert a specific winner or a specific "the game finished" outcome,
because those end-game rules aren't built. What it locks in is: "the
engine never silently corrupts state or swallows an exception while N
players hammer it with legal orders for many consecutive turns."
"""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
sys.path.append("/app/backend")

import server as srv  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from bot import play_random_legal_turn  # noqa: E402

srv._dao = None
client = TestClient(srv.app)

NUM_TURNS = 25
NUM_PLAYERS = 3


def _setup_game():
    resp = client.post("/api/create-game", json={
        "player_name": "Soak-Host",
        "config": {"num_players": NUM_PLAYERS, "galaxy_size": "standard", "fow_mode": "basic"},
    })
    game_id = resp.json()["game_id"]
    client.post(f"/api/game/{game_id}/add-ai-players")
    start = client.post(f"/api/game/{game_id}/start", json={"fill_with_ai": True})
    assert start.json()["phase"] == "activity"
    engine = srv.games[game_id]
    return game_id, list(engine.players)


def _fleet_ids_from_registry(engine):
    return set(engine.starfleets.keys())


def _fleet_ids_from_systems(engine):
    ids = set()
    for system in engine.systems.values():
        ids.update(system.starfleets.keys())
    return ids


def test_multi_turn_soak_no_crashes_and_invariants_hold(capsys):
    rng = random.Random(1234)
    game_id, player_ids = _setup_game()
    engine = srv.games[game_id]

    prev_turn = engine.current_turn
    for turn_num in range(NUM_TURNS):
        state = client.get(f"/api/game/{game_id}/state").json()
        if state["phase"] != "activity":
            break

        for pid in player_ids:
            play_random_legal_turn(client, game_id, pid, rng)

        last_ready = None
        for pid in player_ids:
            last_ready = client.post(
                f"/api/game/{game_id}/ready", json={"player_id": pid, "ready": True}
            ).json()

        assert last_ready["resolved"] is True, f"turn {turn_num}: last ready-up did not auto-resolve"

        captured = capsys.readouterr()
        assert "Turn resolution error" not in captured.out, (
            f"turn {turn_num}: engine swallowed an internal exception -> {captured.out}"
        )

        # --- Invariants that must hold regardless of future feature additions ---
        assert engine.current_turn == prev_turn + 1, (
            f"turn {turn_num}: expected exactly one turn advance"
        )
        prev_turn = engine.current_turn

        assert engine.ready_players == set(), "ready set must clear after auto-resolve"

        # Every starfleet lives in exactly one system, and vice versa.
        assert _fleet_ids_from_registry(engine) == _fleet_ids_from_systems(engine), (
            "starfleet registry and per-system rosters disagree -- a fleet was "
            "duplicated or orphaned during resolution"
        )
        for sf_id, sf in engine.starfleets.items():
            system = engine.systems.get(sf.system_id)
            assert system is not None, f"starfleet {sf_id} points at a system that no longer exists"
            assert sf_id in system.starfleets, f"starfleet {sf_id} missing from its own system's roster"

        # Resource dicts always stay well-shaped (no missing/non-numeric keys).
        for pid, res in engine.player_resources.items():
            for key in ("tech", "metals", "chon"):
                assert isinstance(res.get(key), (int, float)), (
                    f"turn {turn_num}: player {pid} resource {key} is not numeric: {res}"
                )

        # check_victory_condition() must never raise and must return None or a well-shaped dict.
        victory = engine.check_victory_condition()
        if victory is not None:
            assert victory["winner"] in player_ids
            assert 0 <= victory["systems_controlled"] <= victory["total_systems"]

        # Fog of War must never leak a hidden system's identity to a player.
        for pid in player_ids:
            per_player_state = client.get(
                f"/api/game/{game_id}/state", params={"player_id": pid}
            ).json()
            for sys_data in per_player_state["systems"].values():
                if sys_data["visibility"] == "hidden":
                    assert sys_data["name"] == "???"
                    assert sys_data["owner"] is None
                    assert sys_data["starfleet_details"] == []
