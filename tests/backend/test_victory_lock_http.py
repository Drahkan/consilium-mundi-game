"""HTTP-level verification of the victory lock (409 on mutating endpoints).

Runs against the live backend via REACT_APP_BACKEND_URL. Uses the
`_test/force-victory` scaffold endpoint to lock a real game, then
asserts every mutating endpoint returns 409 while GET /state still
works and reports game_over=true with final_victory populated.
"""
import os
import requests
import pytest

def _load_frontend_env():
    p = "/app/frontend/.env"
    if os.path.exists(p):
        for line in open(p):
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().strip('"').rstrip("/")
    return None

BASE = os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env()
assert BASE, "REACT_APP_BACKEND_URL missing"
BASE = BASE.rstrip("/")


@pytest.fixture(scope="module")
def locked_game():
    # Create a 2p game
    r = requests.post(f"{BASE}/api/create-game", json={
        "player_name": "TEST_p1",
        "config": {"num_players": 2},
    }, timeout=15)
    assert r.status_code == 200, r.text
    gid = r.json()["game_id"]
    pid = r.json()["player_id"]

    # Fill with AI + start
    r2 = requests.post(f"{BASE}/api/game/{gid}/add-ai-players", timeout=15)
    assert r2.status_code == 200, r2.text

    # State should be in activity
    st = requests.get(f"{BASE}/api/game/{gid}/state").json()
    assert st["phase"] == "activity"

    # Grab a starfleet id (owned by pid) for rally test — starfleets are nested inside systems
    st = requests.get(f"{BASE}/api/game/{gid}/state?player_id={pid}").json()
    my_sf_id = None
    for _sid, _sys in (st.get("systems") or {}).items():
        for _sf in _sys.get("starfleet_details", []) or []:
            if _sf.get("owner") == pid:
                my_sf_id = _sf["id"]; break
        if my_sf_id: break

    # Force lock
    r3 = requests.post(f"{BASE}/api/game/{gid}/_test/force-victory", timeout=15)
    assert r3.status_code == 200, r3.text
    return {"gid": gid, "pid": pid, "sf_id": my_sf_id}


def test_state_still_readable_and_shows_game_over(locked_game):
    gid = locked_game["gid"]
    r = requests.get(f"{BASE}/api/game/{gid}/state", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["game_over"] is True
    assert data["final_victory"] is not None
    assert data["final_victory"]["required_systems"] == 5


def test_orders_returns_409(locked_game):
    gid = locked_game["gid"]; pid = locked_game["pid"]
    r = requests.post(f"{BASE}/api/game/{gid}/orders",
                      json={"player_id": pid, "orders": []}, timeout=15)
    assert r.status_code == 409, r.text


def test_build_orders_returns_409(locked_game):
    gid = locked_game["gid"]; pid = locked_game["pid"]
    r = requests.post(f"{BASE}/api/game/{gid}/build-orders",
                      json={"player_id": pid, "build_orders": {}}, timeout=15)
    assert r.status_code == 409, r.text


def test_ready_returns_409(locked_game):
    gid = locked_game["gid"]; pid = locked_game["pid"]
    r = requests.post(f"{BASE}/api/game/{gid}/ready",
                      json={"player_id": pid, "ready": True}, timeout=15)
    assert r.status_code == 409, r.text


def test_resolve_turn_returns_409(locked_game):
    gid = locked_game["gid"]
    r = requests.post(f"{BASE}/api/game/{gid}/resolve-turn", timeout=15)
    assert r.status_code == 409, r.text


def test_timer_returns_409(locked_game):
    gid = locked_game["gid"]; pid = locked_game["pid"]
    r = requests.post(f"{BASE}/api/game/{gid}/timer",
                      json={"player_id": pid, "action": "pause"}, timeout=15)
    assert r.status_code == 409, r.text


def test_rally_returns_409(locked_game):
    gid = locked_game["gid"]; pid = locked_game["pid"]; sf_id = locked_game["sf_id"]
    if not sf_id:
        pytest.skip("No starfleet available for rally test")
    r = requests.post(f"{BASE}/api/game/{gid}/starfleets/{sf_id}/rally",
                      json={"player_id": pid, "rally_system_id": None}, timeout=15)
    assert r.status_code == 409, r.text
