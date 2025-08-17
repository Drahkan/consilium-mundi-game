import os
import pytest
from fastapi.testclient import TestClient

# Import the FastAPI app from backend
import sys
sys.path.append("/app/backend")
import server as srv  # type: ignore

# Disable persistence for unit tests using TestClient to avoid event loop issues with Motor
srv._dao = None

client = TestClient(srv.app)

@pytest.fixture
def new_game():
    resp = client.post("/api/create-game", json={
        "player_name": "PyTest",
        "config": {"num_players": 4, "galaxy_size": "standard", "turn_time_limit": 24}
    })
    assert resp.status_code == 200
    data = resp.json()
    return data["game_id"], data["player_id"]


def test_create_game(new_game):
    game_id, player_id = new_game
    assert isinstance(game_id, str) and len(game_id) > 0
    assert isinstance(player_id, str) and len(player_id) > 0


def test_add_ai_and_start_lobby(new_game):
    game_id, player_id = new_game

    # Add AI players
    resp = client.post(f"/api/game/{game_id}/add-ai-players")
    assert resp.status_code == 200

    # Force start lobby (phase -> activity and create starfleets)
    resp2 = client.post(f"/api/lobby/{game_id}/start")
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert data2["status"] == "started"
    assert data2["phase"] == "activity"

    # State should show activity and starfleets on home systems after start
    state = client.get(f"/api/game/{game_id}/state?player_id={player_id}")
    assert state.status_code == 200
    st = state.json()
    assert st["phase"] == "activity"
    assert isinstance(st.get("systems"), dict)


def test_orders_and_resolve_turn(new_game):
    game_id, player_id = new_game

    # Add AI and start lobby
    client.post(f"/api/game/{game_id}/add-ai-players")
    client.post(f"/api/lobby/{game_id}/start")

    # Load state, pick an owned system
    state = client.get(f"/api/game/{game_id}/state?player_id={player_id}").json()
    owned = [s for s in state["systems"].values() if s.get("owner") == player_id]
    assert len(owned) >= 1
    system_id = owned[0]["id"]

    # Submit a build order (e.g., starport) if not present
    orders_payload = {
        "player_id": player_id,
        "orders": [
            {"type": "build", "build_type": "starport", "system_id": system_id}
        ]
    }
    resp = client.post(f"/api/game/{game_id}/build-orders", json=orders_payload)
    assert resp.status_code == 200

    # Resolve turn
    r2 = client.post(f"/api/game/{game_id}/resolve-turn")
    assert r2.status_code == 200

    # Verify state returns and resources exist
    st2 = client.get(f"/api/game/{game_id}/state?player_id={player_id}").json()
    assert "player_resources" in st2


def test_lazy_load_if_persistence_enabled(new_game):
    game_id, player_id = new_game

    # Only run if persistence is enabled
    if srv._dao is None:
        pytest.skip("Persistence not enabled in this environment")

    # Persist baseline by a mutating call
    client.post(f"/api/game/{game_id}/add-ai-players")

    # Simulate memory clear (as if server restarted)
    srv.games.clear()
    srv.players.clear()

    # Calling state should lazy-load from DB
    state = client.get(f"/api/game/{game_id}/state?player_id={player_id}")
    assert state.status_code == 200
    st = state.json()
    assert st.get("turn") == 1