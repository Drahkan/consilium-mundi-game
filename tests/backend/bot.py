"""Legal random-mover bot for multi-turn integration/soak testing.

Drives a player through the public HTTP API exactly the way a real
browser would (build orders, fleet move/support orders, rally points)
so multi-turn tests exercise the same code paths a human player hits,
instead of poking GameEngine internals directly. This is deliberately
NOT a strategic AI -- it only guarantees every action it takes is legal
(affordable, connected, owned), so tests using it measure engine
robustness under realistic *shapes* of traffic, not win/lose skill.
"""
import random

BUILD_COSTS = {
    "starfleet": {"tech": 1, "metals": 1, "chon": 1},
    "starport": {"tech": 2, "metals": 2, "chon": 2},
    "shipyard": {"tech": 3, "metals": 3, "chon": 1},
    "colony": {"tech": 0, "metals": 2, "chon": 2},
    "mining_facilities": {"tech": 2, "metals": 2, "chon": 1},
    "wormhole_generator": {"tech": 6, "metals": 2, "chon": 0},
}


def _affordable(resources, cost):
    return all(resources.get(k, 0) >= v for k, v in cost.items())


def _deduct(resources, cost):
    for k, v in cost.items():
        resources[k] = resources.get(k, 0) - v


def play_random_legal_turn(client, game_id, player_id, rng=None):
    """Submit a random-but-legal set of build/move/support/rally orders
    for one player, via the same HTTP endpoints the frontend uses.

    Returns a summary dict of what was submitted (useful for debugging
    a failing soak/concurrency test).
    """
    rng = rng or random.Random()
    state = client.get(f"/api/game/{game_id}/state", params={"player_id": player_id}).json()
    summary = {"builds": 0, "moves": 0, "supports": 0, "rallies": 0}

    if state.get("phase") != "activity":
        return summary

    resources = dict(state.get("player_resources") or {})
    owned_systems = [s for s in state["systems"].values() if s.get("owner") == player_id]

    # --- Build orders: at most one affordable build attempt per owned system ---
    build_orders = []
    for system in owned_systems:
        candidates = list(BUILD_COSTS.keys())
        rng.shuffle(candidates)
        for build_type in candidates:
            if build_type == "starfleet" and "shipyard" not in system.get("upgrades", []):
                continue
            if build_type != "starfleet" and build_type in system.get("upgrades", []):
                continue
            cost = BUILD_COSTS[build_type]
            if _affordable(resources, cost):
                _deduct(resources, cost)
                build_orders.append({"type": "build", "build_type": build_type, "system_id": system["id"]})
                break

    if build_orders:
        client.post(f"/api/game/{game_id}/build-orders", json={"player_id": player_id, "orders": build_orders})
        summary["builds"] = len(build_orders)

    # --- Fleet orders: randomly move / support / hold for every owned fleet ---
    fleet_orders = []
    for system in owned_systems:
        connections = system.get("connections", [])
        for sf in system.get("starfleet_details", []):
            if sf.get("owner") != player_id:
                continue
            if not connections:
                continue
            choice = rng.random()
            if choice < 0.4:
                target = rng.choice(connections)
                fleet_orders.append({"starfleet_id": sf["id"], "order_type": "move", "target_system": target})
                summary["moves"] += 1
            elif choice < 0.6:
                target = rng.choice(connections)
                fleet_orders.append({"starfleet_id": sf["id"], "order_type": "support", "support_target": target})
                summary["supports"] += 1
            # else: hold this turn (no order submitted)

            # Occasionally set a rally point so retreat logic gets exercised too.
            if owned_systems and rng.random() < 0.2:
                rally_target = rng.choice(owned_systems)["id"]
                client.post(
                    f"/api/game/{game_id}/starfleets/{sf['id']}/rally",
                    json={"player_id": player_id, "rally_system_id": rally_target},
                )
                summary["rallies"] += 1

    if fleet_orders:
        client.post(f"/api/game/{game_id}/orders", json={"player_id": player_id, "orders": fleet_orders})

    return summary
