"""
Kernel-backed end-to-end tests for Consilium Mundi:
  1. Full game loop (create, join, state shape, orders, ready → turn advance, replay)
  2. Diplomacy ops (send, counter, accept, decline) with valid landing systems.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"


# --- helpers ---
def _owner(s):
    return s.get("owner") or s.get("owner_id") or s.get("ownerId")


def _pick_landing_for(state, viewer_id, other_id):
    """A visible-to-viewer system NOT owned by other_id that borders a system other_id owns."""
    systems = state.get("systems") or {}
    other_owned = [sid for sid, s in systems.items() if _owner(s) == other_id]
    for sid in other_owned:
        sys = systems[sid]
        for nb in sys.get("connections") or sys.get("neighbors") or []:
            neigh = systems.get(nb)
            if not neigh:
                continue
            if _owner(neigh) == other_id:
                continue
            if neigh.get("visibility") == "full":
                return nb
    return None


# --- shared state across tests ---
CTX = {}


class TestFullGameLoop:
    def test_01_create_game(self):
        r = requests.post(
            f"{API}/create-game",
            json={
                "player_name": "Alice",
                "config": {"num_players": 3, "turn_time_seconds": 600, "fow_mode": "basic"},
            },
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "game_id" in data and "player_id" in data
        CTX["game_id"] = data["game_id"]
        CTX["alice"] = data["player_id"]

    def test_02_join_bob(self):
        r = requests.post(
            f"{API}/join-game",
            json={"player_name": "Bob", "game_id": CTX["game_id"]},
        )
        assert r.status_code == 200, r.text
        CTX["bob"] = r.json()["player_id"]

    def test_03_join_carol_auto_start(self):
        r = requests.post(
            f"{API}/join-game",
            json={"player_name": "Carol", "game_id": CTX["game_id"]},
        )
        assert r.status_code == 200, r.text
        CTX["carol"] = r.json()["player_id"]

    def test_04_state_shape(self):
        r = requests.get(f"{API}/game/{CTX['game_id']}/state", params={"player_id": CTX["alice"]})
        assert r.status_code == 200, r.text
        state = r.json()
        for k in ["systems", "player_resources", "kernel", "ready_players", "turn_deadline"]:
            assert k in state, f"missing {k}. keys={list(state.keys())}"
        assert "game_over" in state
        assert isinstance(state["systems"], dict)
        assert "threads" in state["kernel"]
        CTX["state_alice"] = state

    def test_05_submit_fleet_order(self):
        state = CTX["state_alice"]
        systems = state["systems"]
        # find a fleet Alice owns via system starfleet_details
        fleet = None
        origin = None
        for sid, s in systems.items():
            for f in s.get("starfleet_details") or []:
                if (f.get("owner") or f.get("owner_id")) == CTX["alice"]:
                    fleet = f
                    origin = sid
                    break
            if fleet:
                break
        if not fleet:
            pytest.skip("Alice has no starfleets to move")
        neigh = None
        for nb in systems[origin].get("connections") or []:
            if nb in systems:
                neigh = nb
                break
        if not neigh:
            pytest.skip("no neighbor system")
        order = {
            "starfleet_id": fleet["id"],
            "target_system_id": neigh,
            "action": "move",
        }
        r = requests.post(
            f"{API}/game/{CTX['game_id']}/orders",
            json={"player_id": CTX["alice"], "orders": [order]},
        )
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "ok"

    def test_06_ready_all_advances_turn(self):
        # capture turn
        r0 = requests.get(f"{API}/game/{CTX['game_id']}/state", params={"player_id": CTX["alice"]})
        turn_before = r0.json().get("turn") or r0.json().get("kernel", {}).get("turn") or 0
        CTX["turn_before"] = turn_before
        for pid in [CTX["alice"], CTX["bob"], CTX["carol"]]:
            r = requests.post(
                f"{API}/game/{CTX['game_id']}/ready",
                json={"player_id": pid, "ready": True},
            )
            assert r.status_code == 200, f"ready failed for {pid}: {r.text}"
        time.sleep(1.5)
        r1 = requests.get(f"{API}/game/{CTX['game_id']}/state", params={"player_id": CTX["alice"]})
        turn_after = r1.json().get("turn") or r1.json().get("kernel", {}).get("turn") or 0
        assert turn_after > turn_before, f"turn did not advance: {turn_before} -> {turn_after}"
        CTX["state_after_resolve"] = r1.json()

    def test_07_replay_snapshots(self):
        r = requests.get(f"{API}/game/{CTX['game_id']}/replay")
        assert r.status_code == 200
        snaps = r.json().get("snapshots") or []
        assert len(snaps) >= 1, "no snapshots after resolve"


class TestDiplomacy:
    def test_01_send_offer(self):
        # fetch fresh state as Alice
        r = requests.get(f"{API}/game/{CTX['game_id']}/state", params={"player_id": CTX["alice"]})
        state_alice = r.json()
        give_sys = _pick_landing_for(state_alice, CTX["alice"], CTX["alice"])  # a system Alice doesn't own but borders one she does
        # ^ correct: system alice does NOT own but borders one she DOES own
        assert give_sys, "no landing system found for Alice give"

        # fetch state as Bob to find a landing system for Bob (bob doesn't own but borders a bob-owned)
        rb = requests.get(f"{API}/game/{CTX['game_id']}/state", params={"player_id": CTX["bob"]})
        state_bob = rb.json()
        req_sys = _pick_landing_for(state_bob, CTX["bob"], CTX["bob"])
        assert req_sys, "no landing system found for Bob request"

        CTX["give_sys"] = give_sys
        CTX["req_sys"] = req_sys

        payload = {
            "player_id": CTX["alice"],
            "to_id": CTX["bob"],
            "topic": "trade",
            "attitude": "neutral",
            "terms": {
                "give": {"tech": 0, "metals": 0, "chon": 2},
                "request": {"tech": 1, "metals": 0, "chon": 0},
                "giveSystemId": give_sys,
                "requestSystemId": req_sys,
            },
        }
        r = requests.post(f"{API}/game/{CTX['game_id']}/diplomacy/send", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("status") == "ok"
        assert data.get("thread_id"), f"no thread_id: {data}"
        CTX["thread_id"] = data["thread_id"]

    def test_02_bob_sees_open_message(self):
        r = requests.get(f"{API}/game/{CTX['game_id']}/state", params={"player_id": CTX["bob"]})
        assert r.status_code == 200
        threads = r.json().get("kernel", {}).get("threads") or []
        assert threads, f"Bob sees no threads. state keys={list(r.json().keys())}"
        t0 = threads[0]
        msgs = t0.get("messages") or []
        assert msgs, "thread has no messages"
        m0 = msgs[0]
        assert m0.get("status") == "open", f"first message status={m0.get('status')} msg={m0}"
        assert m0.get("terms"), "message missing terms"
        CTX["msg_id"] = m0["id"]

    def test_03_bob_counter(self):
        # Bob counters with valid landing systems (from his perspective)
        rb = requests.get(f"{API}/game/{CTX['game_id']}/state", params={"player_id": CTX["bob"]})
        state_bob = rb.json()
        # Bob's give = system bob doesn't own but borders bob-owned
        bob_give = _pick_landing_for(state_bob, CTX["bob"], CTX["bob"])
        # Bob's request = system that alice would land on (alice doesn't own but borders alice-owned)
        ra = requests.get(f"{API}/game/{CTX['game_id']}/state", params={"player_id": CTX["alice"]})
        state_alice = ra.json()
        alice_land = _pick_landing_for(state_alice, CTX["alice"], CTX["alice"])
        assert bob_give and alice_land

        payload = {
            "player_id": CTX["bob"],
            "message_id": CTX["msg_id"],
            "terms": {
                "give": {"tech": 1, "metals": 0, "chon": 0},
                "request": {"tech": 0, "metals": 2, "chon": 0},
                "giveSystemId": bob_give,
                "requestSystemId": alice_land,
            },
        }
        r = requests.post(f"{API}/game/{CTX['game_id']}/diplomacy/counter", json=payload)
        assert r.status_code == 200, r.text

        # verify: original message 'countered', new open message toward Alice
        ra2 = requests.get(f"{API}/game/{CTX['game_id']}/state", params={"player_id": CTX["alice"]})
        threads = ra2.json().get("kernel", {}).get("threads") or []
        assert threads
        msgs = threads[0].get("messages") or []
        first = next((m for m in msgs if m["id"] == CTX["msg_id"]), None)
        assert first, "original message missing"
        assert first.get("status") == "countered", f"orig status={first.get('status')}"
        new_open = [m for m in msgs if m.get("status") == "open" and m.get("toPlayerId") == CTX["alice"]]
        assert new_open, "no new open message from Bob to Alice"
        CTX["counter_msg_id"] = new_open[-1]["id"]

    def test_04_alice_accepts_counter(self):
        payload = {
            "player_id": CTX["alice"],
            "message_id": CTX["counter_msg_id"],
        }
        r = requests.post(f"{API}/game/{CTX['game_id']}/diplomacy/accept", json=payload)
        assert r.status_code == 200, r.text

        # verify kernel.pacts entry & status accepted
        rs = requests.get(f"{API}/game/{CTX['game_id']}/state", params={"player_id": CTX["alice"]})
        state = rs.json()
        pacts = state.get("kernel", {}).get("pacts") or []
        assert pacts, f"no pacts after accept. kernel keys={list(state.get('kernel', {}).keys())}"
        threads = state.get("kernel", {}).get("threads") or []
        msgs = threads[0].get("messages") or []
        accepted = [m for m in msgs if m["id"] == CTX["counter_msg_id"]][0]
        assert accepted.get("status") == "accepted"

    def test_05_decline_flow(self):
        # send a fresh offer Alice→Carol then Carol declines
        ra = requests.get(f"{API}/game/{CTX['game_id']}/state", params={"player_id": CTX["alice"]})
        state_alice = ra.json()
        give_sys = _pick_landing_for(state_alice, CTX["alice"], CTX["alice"])
        rc = requests.get(f"{API}/game/{CTX['game_id']}/state", params={"player_id": CTX["carol"]})
        state_carol = rc.json()
        req_sys = _pick_landing_for(state_carol, CTX["carol"], CTX["carol"])
        if not give_sys or not req_sys:
            pytest.skip("no landing systems for decline test")

        r = requests.post(
            f"{API}/game/{CTX['game_id']}/diplomacy/send",
            json={
                "player_id": CTX["alice"],
                "to_id": CTX["carol"],
                "topic": "trade",
                "attitude": "neutral",
                "terms": {
                    "give": {"tech": 0, "metals": 1, "chon": 0},
                    "request": {"tech": 0, "metals": 0, "chon": 1},
                    "giveSystemId": give_sys,
                    "requestSystemId": req_sys,
                },
            },
        )
        assert r.status_code == 200, r.text

        # locate open msg to Carol
        rc2 = requests.get(f"{API}/game/{CTX['game_id']}/state", params={"player_id": CTX["carol"]})
        threads = rc2.json().get("kernel", {}).get("threads") or []
        target_msg = None
        for t in threads:
            for m in t.get("messages") or []:
                if m.get("status") == "open" and m.get("toPlayerId") == CTX["carol"]:
                    target_msg = m["id"]
                    break
        assert target_msg, "no open offer to Carol"

        rd = requests.post(
            f"{API}/game/{CTX['game_id']}/diplomacy/decline",
            json={"player_id": CTX["carol"], "message_id": target_msg},
        )
        assert rd.status_code == 200, rd.text
