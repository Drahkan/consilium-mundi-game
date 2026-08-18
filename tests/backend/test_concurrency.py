"""Concurrency tests.

Real players act simultaneously from separate browsers, not one-at-a-time
like the rest of this suite. These fire genuinely concurrent requests at a
shared game to catch race conditions the sequential tests structurally
cannot see -- e.g. two-to-four players all hitting "Ready" within the same
instant during the 2-browser demo.
"""
import sys
from concurrent.futures import ThreadPoolExecutor

sys.path.append("/app/backend")
import server as srv  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

srv._dao = None
client = TestClient(srv.app)


def _new_game(num_players):
    resp = client.post("/api/create-game", json={
        "player_name": "Host",
        "config": {"num_players": num_players, "galaxy_size": "standard"},
    })
    game_id = resp.json()["game_id"]
    player_ids = [resp.json()["player_id"]]
    for i in range(num_players - 1):
        join = client.post("/api/join-game", json={"player_name": f"P{i}", "game_id": game_id})
        player_ids.append(join.json()["player_id"])
    # Game auto-starts once the roster is full (join_game does this itself);
    # this call is a harmless no-op safety net if it somehow isn't full yet.
    client.post(f"/api/game/{game_id}/start", json={"fill_with_ai": False})
    assert srv.games[game_id].phase == "activity"
    return game_id, player_ids


def test_concurrent_ready_up_resolves_turn_exactly_once():
    game_id, player_ids = _new_game(num_players=4)
    engine = srv.games[game_id]
    turn_before = engine.current_turn

    with ThreadPoolExecutor(max_workers=len(player_ids)) as pool:
        results = list(pool.map(
            lambda pid: client.post(
                f"/api/game/{game_id}/ready", json={"player_id": pid, "ready": True}
            ).json(),
            player_ids,
        ))

    assert all(r["status"] == "ok" for r in results)
    assert any(r["resolved"] for r in results), "no concurrent ready call ever triggered a resolve"

    # The turn must advance by EXACTLY one -- zero means the game got stuck,
    # two-or-more means a race let resolve_turn() fire twice for one ready-up.
    assert engine.current_turn == turn_before + 1, (
        f"expected exactly one turn advance under concurrent ready-up, "
        f"got {turn_before} -> {engine.current_turn}"
    )
    assert engine.ready_players == set()


def test_concurrent_order_submission_from_different_players_does_not_clobber():
    game_id, player_ids = _new_game(num_players=2)
    engine = srv.games[game_id]

    fleets_by_owner = {}
    for sf in engine.starfleets.values():
        fleets_by_owner.setdefault(sf.owner, []).append(sf)
    assert all(pid in fleets_by_owner for pid in player_ids), "each player should start with a home fleet"

    def submit(pid):
        fleet = fleets_by_owner[pid][0]
        system = engine.systems[fleet.system_id]
        target = system.connections[0]
        return client.post(f"/api/game/{game_id}/orders", json={
            "player_id": pid,
            "orders": [{"starfleet_id": fleet.id, "order_type": "move", "target_system": target}],
        }).status_code

    with ThreadPoolExecutor(max_workers=len(player_ids)) as pool:
        statuses = list(pool.map(submit, player_ids))

    assert all(s == 200 for s in statuses)

    # Neither player's order should have been lost/overwritten by the other
    # player's concurrent request touching the same shared game object.
    for pid in player_ids:
        fleet = fleets_by_owner[pid][0]
        assert fleet.orders is not None, f"order for player {pid}'s fleet was lost under concurrency"
        assert fleet.orders["type"] == "move"
