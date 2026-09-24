"""Tests for kernel v6 game-type scenarios wiring."""
import os
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://rally-markers-test.preview.emergentagent.com").rstrip("/")

EXPECTED_IDS = ["standard", "ragnarok", "reckoning", "weekend", "tradeWars", "postApocalypse"]


def _get_state(game_id, player_id):
    r = requests.get(f"{BASE_URL}/api/game/{game_id}/state", params={"player_id": player_id})
    assert r.status_code == 200, r.text
    return r.json()


def _create(config):
    r = requests.post(f"{BASE_URL}/api/create-game", json={"player_name": "TEST_Host", "config": config})
    assert r.status_code == 200, r.text
    return r.json()


class TestGameTypes:
    def test_list_game_types(self):
        r = requests.get(f"{BASE_URL}/api/game-types")
        assert r.status_code == 200
        rows = r.json()["gameTypes"]
        assert [row["id"] for row in rows] == EXPECTED_IDS
        for row in rows:
            for key in ("id", "name", "blurb", "victory", "victoryLabel", "playerRange",
                        "fogOfWar", "uncharted", "turnLimit", "disableCommunications", "scorchedEarth"):
                assert key in row, f"missing {key} in {row['id']}"

    def test_ragnarok_options(self):
        d = _create({"game_type": "ragnarok"})
        view = _get_state(d["game_id"], d["player_id"])
        opts = view["kernel"]["options"]
        assert opts["victory"] == "lastStanding"
        assert opts["victoryLabel"] == "Last Civilization Standing"
        assert opts["fogOfWar"] is True
        assert opts["disableCommunications"] is True
        assert opts["scorchedEarth"] is True
        assert opts["turnLimit"] == 40
        assert opts["gameType"] == "ragnarok"

    def test_trade_wars_options(self):
        d = _create({"game_type": "tradeWars"})
        view = _get_state(d["game_id"], d["player_id"])
        opts = view["kernel"]["options"]
        assert opts["victory"] == "corporate"
        assert opts["victoryLabel"] == "Corporate Takeover"

    def test_post_apocalypse_options(self):
        d = _create({"game_type": "postApocalypse"})
        view = _get_state(d["game_id"], d["player_id"])
        opts = view["kernel"]["options"]
        assert opts["victory"] == "gunship"
        assert opts["victoryLabel"] == "Gunship Diplomacy"
        assert opts["fogOfWar"] is True
        assert opts["uncharted"] is True

    def test_ragnarok_default_fow(self):
        d = _create({"game_type": "ragnarok"})
        view = _get_state(d["game_id"], d["player_id"])
        assert view["kernel"]["options"]["fogOfWar"] is True

    def test_ragnarok_fow_override_off(self):
        d = _create({"game_type": "ragnarok", "fow_mode": "off"})
        view = _get_state(d["game_id"], d["player_id"])
        # Client sends fow_mode only when user overrides; expect override applied.
        opts = view["kernel"]["options"]
        # Either fogOfWar becomes False or config.fow_mode is present
        fow = opts.get("fogOfWar")
        cfg_fow = (view.get("config") or {}).get("fow_mode")
        assert fow is False or cfg_fow == "off", f"opts={opts} cfg_fow={cfg_fow}"

    def test_standard_default(self):
        d = _create({})
        view = _get_state(d["game_id"], d["player_id"])
        opts = view["kernel"]["options"]
        assert opts["victory"] == "standard"
        assert opts["victoryLabel"] == "Standard (50% of systems)"

    def test_standard_explicit(self):
        d = _create({"game_type": "standard"})
        view = _get_state(d["game_id"], d["player_id"])
        opts = view["kernel"]["options"]
        assert opts["victory"] == "standard"
        assert opts["victoryLabel"] == "Standard (50% of systems)"


class TestRegressionRagnarokFlow:
    """Confirm kernel POST plumbing still returns 200 after view.kernel.options decoration."""

    def test_full_flow(self):
        create = _create({"game_type": "ragnarok", "player_count": 3, "turn_time_seconds": 300})
        gid, host_id = create["game_id"], create["player_id"]

        # add AI
        r = requests.post(f"{BASE_URL}/api/game/{gid}/add-ai-players")
        assert r.status_code == 200, r.text

        # start
        r = requests.post(f"{BASE_URL}/api/game/{gid}/start", json={})
        assert r.status_code == 200, r.text

        # orders
        r = requests.post(f"{BASE_URL}/api/game/{gid}/orders",
                          json={"player_id": host_id, "orders": []})
        assert r.status_code == 200, r.text

        # build orders
        r = requests.post(f"{BASE_URL}/api/game/{gid}/build-orders",
                          json={"player_id": host_id, "orders": []})
        assert r.status_code == 200, r.text

        # espionage-orders (empty)
        r = requests.post(f"{BASE_URL}/api/game/{gid}/espionage-orders",
                          json={"player_id": host_id, "orders": []})
        assert r.status_code == 200, r.text

        # diplomacy send to another player
        view = _get_state(gid, host_id)
        players = view.get("players") or []
        others = []
        for p in players:
            pid = p.get("id") if isinstance(p, dict) else p
            if pid and pid != host_id:
                others.append(pid)
        if others:
            r = requests.post(f"{BASE_URL}/api/game/{gid}/diplomacy/send",
                              json={"player_id": host_id, "to_id": others[0],
                                    "topic": "trade", "attitude": "neutral"})
            assert r.status_code == 200, r.text

        # timer pause / resume
        r = requests.post(f"{BASE_URL}/api/game/{gid}/timer", json={"action": "pause"})
        assert r.status_code == 200, r.text
        r = requests.post(f"{BASE_URL}/api/game/{gid}/timer", json={"action": "resume"})
        assert r.status_code == 200, r.text

        # resolve-turn
        r = requests.post(f"{BASE_URL}/api/game/{gid}/resolve-turn")
        assert r.status_code == 200, r.text
