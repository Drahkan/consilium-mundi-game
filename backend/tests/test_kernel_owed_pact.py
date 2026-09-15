"""
Iteration 5 — kernel v3 owed-pact end-to-end flow.

Grok's must-fix: ObligationsHUD banner must consume inbox.owedDeliveries and
deliver-pact must succeed against a REAL accepted trade (not just 400-on-bogus-id).

Also validates:
  - kernel ping returns version=3
  - inbox response contains owedDeliveries + allyIds (kernel v3 fields)
  - persistence roundtrip regression still works
"""
import os
import subprocess
import time
import json
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"


# ---- kernel CLI ping ----
def test_kernel_ping_v3():
    r = subprocess.run(
        ["node", "/app/packages/consilium-kernel/cli.mjs"],
        input='{"op":"ping"}',
        capture_output=True,
        text=True,
        timeout=15,
    )
    assert r.returncode == 0, r.stderr
    data = json.loads(r.stdout.strip().splitlines()[-1])
    assert data.get("ok") is True
    assert data.get("pong") is True
    assert data.get("version") == 3, f"expected v3, got {data}"


# ---- helpers ----
def _owner(s):
    return s.get("owner") or s.get("owner_id") or s.get("ownerId")


def _pick_landing_for(state, other_id):
    """A full-visibility system NOT owned by other_id that borders one they own."""
    systems = state.get("systems") or {}
    other_owned = [sid for sid, s in systems.items() if _owner(s) == other_id]
    for sid in other_owned:
        sys = systems[sid]
        for nb in sys.get("connections") or sys.get("neighbors") or []:
            neigh = systems.get(nb)
            if not neigh or _owner(neigh) == other_id:
                continue
            if neigh.get("visibility") == "full":
                return nb
    return None


CTX = {}


class TestOwedPactE2E:
    """2 humans + 1 AI (kernel min=3). Alice sends trade → Bob accepts →
    inbox for Alice shows owedDeliveries → deliver-pact succeeds."""

    def test_01_setup_game(self):
        r = requests.post(
            f"{API}/create-game",
            json={
                "player_name": "Alice",
                "config": {"num_players": 3, "turn_time_seconds": 600, "fow_mode": "basic"},
            },
        )
        assert r.status_code == 200, r.text
        d = r.json()
        CTX["gid"] = d["game_id"]
        CTX["alice"] = d["player_id"]

        r = requests.post(f"{API}/join-game", json={"player_name": "Bob", "game_id": CTX["gid"]})
        assert r.status_code == 200, r.text
        CTX["bob"] = r.json()["player_id"]

        # 2 humans reach playerCount=3? kernel clamps. Only 2 humans -> not auto-started
        # add-ai-players is a no-op reporter; kernel already seeded AI slots. Try /start
        r = requests.post(f"{API}/game/{CTX['gid']}/start")
        # start returns 200 or already_started
        assert r.status_code in (200, 409), r.text

    def test_02_inbox_has_v3_fields(self):
        r = requests.get(f"{API}/game/{CTX['gid']}/diplomacy/inbox/{CTX['alice']}")
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["pending", "incidents", "unsentPacts", "owedDeliveries", "allyIds"]:
            assert k in d, f"inbox missing {k}: {list(d.keys())}"
            assert isinstance(d[k], list), f"{k} not a list"

    def test_03_send_trade_alice_to_bob(self):
        ra = requests.get(f"{API}/game/{CTX['gid']}/state", params={"player_id": CTX["alice"]})
        assert ra.status_code == 200
        state_a = ra.json()
        # Alice must choose a giveSystem (system Alice doesn't own, but borders alice-owned)
        give_sys = _pick_landing_for(state_a, CTX["alice"])
        assert give_sys, "no give landing system for Alice"

        rb = requests.get(f"{API}/game/{CTX['gid']}/state", params={"player_id": CTX["bob"]})
        state_b = rb.json()
        req_sys = _pick_landing_for(state_b, CTX["bob"])
        assert req_sys, "no request landing system near Bob"

        payload = {
            "player_id": CTX["alice"],
            "to_id": CTX["bob"],
            "topic": "trade",
            "attitude": "neutral",
            "terms": {
                "give": {"tech": 1, "metals": 0, "chon": 0},
                "request": {"tech": 0, "metals": 0, "chon": 1},
                "giveSystemId": give_sys,
                "requestSystemId": req_sys,
            },
        }
        r = requests.post(f"{API}/game/{CTX['gid']}/diplomacy/send", json=payload)
        assert r.status_code == 200, r.text
        CTX["thread_id"] = r.json().get("thread_id")

        # find open message id to Bob
        rb2 = requests.get(f"{API}/game/{CTX['gid']}/state", params={"player_id": CTX["bob"]})
        threads = rb2.json().get("kernel", {}).get("threads") or []
        msg_id = None
        for t in threads:
            for m in t.get("messages") or []:
                if m.get("status") == "open" and m.get("toPlayerId") == CTX["bob"]:
                    msg_id = m["id"]
                    break
        assert msg_id, "no open offer for Bob"
        CTX["msg_id"] = msg_id

    def test_04_bob_accepts(self):
        r = requests.post(
            f"{API}/game/{CTX['gid']}/diplomacy/accept",
            json={"player_id": CTX["bob"], "message_id": CTX["msg_id"]},
        )
        assert r.status_code == 200, r.text

    def test_05_alice_inbox_shows_owed_delivery(self):
        r = requests.get(f"{API}/game/{CTX['gid']}/diplomacy/inbox/{CTX['alice']}")
        assert r.status_code == 200, r.text
        d = r.json()
        owed = d.get("owedDeliveries") or []
        assert owed, f"owedDeliveries empty after accept! full inbox={d}"
        item = owed[0]
        # Shape: {pactId, resources, systemId, otherId}
        for k in ["pactId", "resources", "systemId", "otherId"]:
            assert k in item, f"owedDelivery missing {k}: {item}"
        # Alice gave 1 tech
        assert item["resources"].get("tech") == 1, f"resources={item['resources']}"
        assert item["otherId"] == CTX["bob"]
        CTX["pact_id"] = item["pactId"]

    def test_06_bob_inbox_also_shows_owed_delivery(self):
        # Both sides of a bilateral trade owe delivery
        r = requests.get(f"{API}/game/{CTX['gid']}/diplomacy/inbox/{CTX['bob']}")
        assert r.status_code == 200
        d = r.json()
        owed = d.get("owedDeliveries") or []
        # Bob promised 1 chon
        assert owed, f"Bob has no owed deliveries: {d}"
        assert any(it["resources"].get("chon") == 1 for it in owed), owed

    def test_07_deliver_pact_succeeds(self):
        r = requests.post(
            f"{API}/game/{CTX['gid']}/diplomacy/deliver-pact",
            json={"player_id": CTX["alice"], "pact_id": CTX["pact_id"]},
        )
        assert r.status_code == 200, f"deliver-pact failed: {r.status_code} {r.text}"
        assert r.json().get("status") == "ok"

    def test_08_deliver_pact_bogus_still_400(self):
        # Regression: bogus pact_id still 400
        r = requests.post(
            f"{API}/game/{CTX['gid']}/diplomacy/deliver-pact",
            json={"player_id": CTX["alice"], "pact_id": "nope-nope-nope"},
        )
        assert r.status_code == 400
        # detail is kernel-derived, non-empty
        detail = r.json().get("detail") or ""
        assert detail, f"empty detail: {r.json()}"

    def test_09_after_deliver_owed_shrinks(self):
        # After Alice's delivery, her side should no longer appear (or resources cleared)
        r = requests.get(f"{API}/game/{CTX['gid']}/diplomacy/inbox/{CTX['alice']}")
        d = r.json()
        owed = d.get("owedDeliveries") or []
        # Either empty for alice, or her side's pactId no longer present with nonzero resources
        remaining = [o for o in owed if o["pactId"] == CTX["pact_id"]]
        # It's ok if kernel keeps the record with cleared resources — banner filters nonEmpty
        for o in remaining:
            total = sum((o.get("resources") or {}).values())
            assert total == 0 or o.get("delivered"), f"alice still owes after deliver: {o}"


# ---- persistence regression (iter 4) ----
class TestPersistenceRegression:
    def test_persistence_roundtrip(self):
        r = requests.post(
            f"{API}/create-game",
            json={"player_name": "PersistUser", "config": {"num_players": 3, "turn_time_seconds": 600}},
        )
        assert r.status_code == 200
        gid = r.json()["game_id"]
        pid = r.json()["player_id"]

        r0 = requests.get(f"{API}/game/{gid}/state", params={"player_id": pid})
        assert r0.status_code == 200
        systems_before = list((r0.json().get("systems") or {}).keys())
        assert systems_before

        subprocess.run(["sudo", "supervisorctl", "restart", "backend"], capture_output=True, timeout=30)
        # wait for backend up
        for _ in range(30):
            time.sleep(1)
            try:
                if requests.get(f"{API}/games", timeout=2).status_code == 200:
                    break
            except Exception:
                continue

        r1 = requests.get(f"{API}/game/{gid}/state", params={"player_id": pid})
        assert r1.status_code == 200, f"post-restart state failed: {r1.status_code} {r1.text}"
        systems_after = list((r1.json().get("systems") or {}).keys())
        assert set(systems_before) == set(systems_after), "persistence lost systems"
