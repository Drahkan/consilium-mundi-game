"""
Tests for iteration 4 deliverables:
  1. Mongo persistence of CLI-serialize blob (engine.turn, engine.options.playerCount, engine.turnSnapshots)
  2. Load path via CLI (survives backend restart, in-memory match cache clear)
  3. GET /api/games reflects Mongo-backed docs
  4. Diplomacy inbox: pending / incidents / unsentPacts
  5. Diplomacy frontier: { systemIds: [...] }
  6. answer-incident and deliver-pact wired (bogus id => HTTP 400 with kernel detail)
"""
import os
import time
import subprocess
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"

CTX = {}


def _mongo_doc(game_id):
    """Read the persisted doc directly from Mongo using pymongo."""
    from pymongo import MongoClient
    url = os.environ.get("MONGO_URL") or "mongodb://localhost:27017"
    db_name = os.environ.get("DB_NAME") or "test_database"
    # Load /app/backend/.env if os.environ doesn't already have it
    if "MONGO_URL" not in os.environ:
        try:
            with open("/app/backend/.env") as f:
                for line in f:
                    if line.startswith("MONGO_URL="):
                        url = line.split("=", 1)[1].strip().strip('"')
                    if line.startswith("DB_NAME="):
                        db_name = line.split("=", 1)[1].strip().strip('"')
        except Exception:
            pass
    client = MongoClient(url)
    doc = client[db_name].games.find_one({"_id": game_id})
    client.close()
    return doc


class TestPersistence:
    def test_01_create_game_persists_to_mongo(self):
        r = requests.post(f"{API}/create-game", json={
            "player_name": "Persist_Alice",
            "config": {"num_players": 2, "turn_time_seconds": 600, "fow_mode": "basic"},
        })
        assert r.status_code == 200, r.text
        data = r.json()
        CTX["game_id"] = data["game_id"]
        CTX["alice"] = data["player_id"]
        # Give Mongo persistence task a moment (fire-and-forget task)
        time.sleep(1.0)
        doc = _mongo_doc(CTX["game_id"])
        assert doc is not None, f"Mongo doc not found for {CTX['game_id']}"
        eng = doc.get("engine") or {}
        assert "turn" in eng, f"engine.turn missing. keys={list(eng.keys())}"
        assert "options" in eng and "playerCount" in eng["options"], "engine.options.playerCount missing"
        assert "turnSnapshots" in eng, "engine.turnSnapshots key missing (CLI serialize blob contract)"

    def test_02_list_games_reflects_mongo(self):
        r = requests.get(f"{API}/games")
        assert r.status_code == 200, r.text
        games = r.json().get("games") or []
        row = next((g for g in games if g["id"] == CTX["game_id"]), None)
        assert row, f"game not listed. got: {[g['id'] for g in games]}"
        for k in ["players", "max_players", "phase", "turn"]:
            assert k in row, f"missing key {k} in games row: {row}"
        assert row["max_players"], f"max_players falsy: {row['max_players']}"
        # max_players must equal engine.options.playerCount from persisted doc
        doc = _mongo_doc(CTX["game_id"])
        expected_pc = (doc.get("engine") or {}).get("options", {}).get("playerCount")
        assert row["max_players"] == expected_pc, f"max_players != options.playerCount: row={row} pc={expected_pc}"

    def test_03_join_second_player(self):
        r = requests.post(f"{API}/join-game", json={
            "player_name": "Persist_Bob", "game_id": CTX["game_id"],
        })
        assert r.status_code == 200, r.text
        CTX["bob"] = r.json()["player_id"]

    def test_04_restart_backend_and_reload_from_mongo(self):
        # Restart clears the in-memory matches dict; state must come back via CLI load.
        subprocess.run(["sudo", "supervisorctl", "restart", "backend"], check=True, capture_output=True)
        # wait for backend to come back
        for _ in range(30):
            try:
                p = requests.get(f"{API}/games", timeout=2)
                if p.status_code == 200:
                    break
            except Exception:
                pass
            time.sleep(1)
        # Now fetch the same game state
        r = requests.get(f"{API}/game/{CTX['game_id']}/state", params={"player_id": CTX["alice"]}, timeout=15)
        assert r.status_code == 200, f"post-restart state failed: {r.status_code} {r.text[:400]}"
        state = r.json()
        assert state.get("systems") and len(state["systems"]) > 0, "systems empty after reload — CLI load failed"


class TestDiplomacyExtras:
    def test_01_inbox_shape(self):
        r = requests.get(f"{API}/game/{CTX['game_id']}/diplomacy/inbox/{CTX['alice']}")
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ["pending", "incidents", "unsentPacts"]:
            assert k in data, f"missing {k}. keys={list(data.keys())}"
            assert isinstance(data[k], list), f"{k} is not a list: {type(data[k])}"

    def test_02_frontier_shape(self):
        r = requests.get(f"{API}/game/{CTX['game_id']}/diplomacy/frontier",
                         params={"player_id": CTX["alice"], "to_id": CTX["bob"]})
        assert r.status_code == 200, r.text
        data = r.json()
        assert "systemIds" in data, f"missing systemIds. keys={list(data.keys())}"
        assert isinstance(data["systemIds"], list)

    def test_03_answer_incident_bogus_returns_400(self):
        r = requests.post(f"{API}/game/{CTX['game_id']}/diplomacy/answer-incident", json={
            "player_id": CTX["alice"],
            "incident_id": "BOGUS_INCIDENT_ID",
            "action": "ignored",
        })
        assert r.status_code == 400, f"expected 400 for bogus incident id, got {r.status_code}: {r.text}"
        detail = r.json().get("detail") or ""
        assert isinstance(detail, str) and len(detail) > 0, "empty detail — route may be a stub"

    def test_04_deliver_pact_bogus_returns_400(self):
        r = requests.post(f"{API}/game/{CTX['game_id']}/diplomacy/deliver-pact", json={
            "player_id": CTX["alice"],
            "pact_id": "BOGUS_PACT_ID",
        })
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text}"
        detail = r.json().get("detail") or ""
        assert isinstance(detail, str) and len(detail) > 0, "empty detail — route may be a stub"


class TestGameLoopEndToEnd:
    """Full loop after restart proves the reloaded game is fully functional."""
    def test_01_state_before(self):
        r = requests.get(f"{API}/game/{CTX['game_id']}/state", params={"player_id": CTX["alice"]})
        assert r.status_code == 200
        state = r.json()
        CTX["turn_before"] = state.get("turn") or state.get("kernel", {}).get("turn") or 0

    def test_02_ready_both_players_advances_turn(self):
        for pid in [CTX["alice"], CTX["bob"]]:
            r = requests.post(f"{API}/game/{CTX['game_id']}/ready",
                              json={"player_id": pid, "ready": True})
            assert r.status_code == 200, r.text
        time.sleep(2.0)
        r = requests.get(f"{API}/game/{CTX['game_id']}/state", params={"player_id": CTX["alice"]})
        turn_after = r.json().get("turn") or r.json().get("kernel", {}).get("turn") or 0
        assert turn_after > CTX["turn_before"], f"turn did not advance: {CTX['turn_before']} -> {turn_after}"
