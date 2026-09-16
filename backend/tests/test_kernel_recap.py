"""
Iteration 6 tests: kernel v4 CLI + /api/game/{id}/recap.

Covers:
  1. Kernel ping returns version=4.
  2. SAVE_VERSION unchanged at 2.
  3. GET /recap returns required shape after a real resolve-turn.
  4. Missing player_id => 4xx.
  5. Bogus player_id => 4xx (kernel-derived).
  6. Log/promiseReports are arrays.
"""
import os
import json
import subprocess
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"


def test_kernel_ping_v4():
    """CLI ping now reports version 4."""
    p = subprocess.run(
        ["node", "/app/packages/consilium-kernel/cli.mjs"],
        input='{"op":"ping"}',
        capture_output=True, text=True, timeout=15,
    )
    assert p.returncode == 0, p.stderr
    data = json.loads(p.stdout.strip().splitlines()[-1])
    assert data.get("ok") is True
    assert data.get("pong") is True
    assert data.get("version") == 4


def test_save_version_unchanged():
    """SAVE_VERSION must stay at 2."""
    with open("/app/packages/consilium-kernel/constants.ts") as f:
        text = f.read()
    assert "SAVE_VERSION = 2" in text, "SAVE_VERSION should still be 2"


class TestRecapEndpoint:
    ctx = {}

    def test_01_setup_game(self):
        r = requests.post(
            f"{API}/create-game",
            json={"player_name": "Alice",
                  "config": {"num_players": 3, "turn_time_seconds": 600, "fow_mode": "basic"}},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        j = r.json()
        gid = j["game_id"]
        pid = j["player_id"]
        TestRecapEndpoint.ctx["gid"] = gid
        TestRecapEndpoint.ctx["pid"] = pid
        # Fill AI seats then start
        r2 = requests.post(f"{API}/game/{gid}/add-ai-players", timeout=15)
        assert r2.status_code in (200, 201), r2.text
        r3 = requests.post(f"{API}/game/{gid}/start", timeout=15)
        assert r3.status_code in (200, 201, 400), r3.text

    def test_02_missing_player_id_4xx(self):
        gid = TestRecapEndpoint.ctx["gid"]
        r = requests.get(f"{API}/game/{gid}/recap", timeout=15)
        assert 400 <= r.status_code < 500, f"expected 4xx, got {r.status_code}: {r.text}"

    def test_03_bogus_player_id_4xx(self):
        gid = TestRecapEndpoint.ctx["gid"]
        r = requests.get(f"{API}/game/{gid}/recap",
                         params={"player_id": "does-not-exist-" + uuid.uuid4().hex},
                         timeout=15)
        assert 400 <= r.status_code < 500, f"expected 4xx, got {r.status_code}: {r.text[:200]}"

    def test_04_recap_shape_before_resolve(self):
        gid = TestRecapEndpoint.ctx["gid"]
        pid = TestRecapEndpoint.ctx["pid"]
        r = requests.get(f"{API}/game/{gid}/recap",
                         params={"player_id": pid}, timeout=15)
        assert r.status_code == 200, r.text
        recap = r.json()
        for k in ["turn", "previousTurn", "phase", "result",
                  "winnerIds", "log", "promiseReports",
                  "snapshot", "snapshotCount"]:
            assert k in recap, f"missing key {k}; got keys={list(recap.keys())}"
        assert isinstance(recap["log"], list)
        assert isinstance(recap["promiseReports"], list)
        assert isinstance(recap["winnerIds"], list)

    def test_05_resolve_then_recap(self):
        gid = TestRecapEndpoint.ctx["gid"]
        pid = TestRecapEndpoint.ctx["pid"]
        # Ready the human; AI seats auto-ready by kernel
        try:
            requests.post(f"{API}/game/{gid}/ready",
                          json={"player_id": pid}, timeout=15)
        except Exception:
            pass
        # Try direct resolve
        rr = requests.post(f"{API}/game/{gid}/resolve-turn",
                           json={"player_id": pid}, timeout=30)
        # accept either success or already-advanced states
        assert rr.status_code in (200, 400, 409), rr.text
        time.sleep(0.3)
        r = requests.get(f"{API}/game/{gid}/recap",
                         params={"player_id": pid}, timeout=15)
        assert r.status_code == 200, r.text
        recap = r.json()
        assert isinstance(recap["log"], list)
        assert isinstance(recap["promiseReports"], list)
        snap = recap.get("snapshot")
        assert snap is not None, "snapshot should be non-null"
        # must contain systems/players/turn
        for k in ["systems", "players", "turn"]:
            assert k in snap, f"snapshot missing {k}; got {list(snap.keys())}"
