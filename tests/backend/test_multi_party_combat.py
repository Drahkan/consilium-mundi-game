"""Targeted unit tests for multi-party combat resolution in GameEngine.

Validates the fixes for Issue 3 from the handoff:
  - 3-way fights list every participant (including support-only players)
  - Defender counts include a starport / support breakdown
  - The starport-sabotage boolean bug no longer inflates defender strength
  - A tie for strongest attacker resolves as `contested` instead of picking
    an arbitrary winner
"""

import os
import sys
import pytest

# Make backend importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

from server import GameEngine, GameConfig, SolarSystem, Starfleet  # noqa: E402


def make_engine():
    engine = GameEngine(GameConfig(num_players=3))
    engine.players = ["A", "B", "C"]
    engine.current_turn = 1
    engine.combat_reports = []
    return engine


def add_system(engine, sid, owner=None, x=0.0, y=0.0):
    s = SolarSystem(sid, sid, x, y)
    s.owner = owner
    engine.systems[sid] = s
    return s


def add_fleet(engine, fid, owner, system_id):
    f = Starfleet(fid, owner, system_id)
    engine.starfleets[fid] = f
    engine.systems[system_id].starfleets[fid] = f
    return f


def test_starport_bonus_only_when_starport_present():
    engine = make_engine()
    add_system(engine, "home_b", owner="B")
    add_system(engine, "sys_x", owner="A")  # controlled but no starport
    f_atk = add_fleet(engine, "atk1", "B", "home_b")

    engine.resolve_system_combat("sys_x", [f_atk])

    report = engine.combat_reports[-1]
    # No defender fleets, no starport, no support → defender strength must be 0
    assert report["defender_breakdown"]["starport"] == 0
    assert report["defender_breakdown"]["fleets"] == 0
    assert report["defenders"] == 0
    assert report["outcome"] == "attacker_victory"
    assert report["winner"] == "B"


def test_starport_sabotage_disables_bonus():
    engine = make_engine()
    add_system(engine, "home_b", owner="B")
    sys_x = add_system(engine, "sys_x", owner="A")
    sys_x.upgrades = ["starport"]
    sys_x.sabotaged_upgrades = ["starport"]
    f_atk = add_fleet(engine, "atk1", "B", "home_b")

    engine.resolve_system_combat("sys_x", [f_atk])
    report = engine.combat_reports[-1]
    assert report["defender_breakdown"]["starport"] == 0


def test_support_only_attacker_is_counted_and_listed():
    """Player C never moves a fleet in but issues a support order for B's
    attack on A. The report must list C as an attacker with support=1."""
    engine = make_engine()
    add_system(engine, "home_b", owner="B")
    add_system(engine, "home_c", owner="C")
    add_system(engine, "sys_x", owner="A")

    # A's defender
    d = add_fleet(engine, "def1", "A", "sys_x")
    # B moves in
    f_b = add_fleet(engine, "atk_b", "B", "home_b")
    # C supports B's attack
    f_c = add_fleet(engine, "sup_c", "C", "home_c")
    f_c.orders = {"type": "support", "target": "sys_x"}

    engine.resolve_system_combat("sys_x", [f_b])

    report = engine.combat_reports[-1]
    assert "B" in report["attackers"], report
    assert "C" in report["attackers"], "Support-only attacker C must be listed"
    assert report["attacker_breakdown"]["C"]["fleets"] == 0
    assert report["attacker_breakdown"]["C"]["support"] == 1
    assert report["attacker_breakdown"]["B"]["fleets"] == 1
    # Total attacker strength (1 fleet + 1 support) beats 1 defender
    assert report["outcome"] == "attacker_victory"
    assert report["winner"] == "B"


def test_tied_attackers_result_in_contested_outcome():
    """B and C each bring 2 fleets vs A's 1 defender. Combined 4 > 1 so
    defenders lose, but B and C tie for strongest → nobody takes the system.
    """
    engine = make_engine()
    add_system(engine, "home_b", owner="B")
    add_system(engine, "home_c", owner="C")
    add_system(engine, "sys_x", owner="A")

    add_fleet(engine, "def1", "A", "sys_x")
    b1 = add_fleet(engine, "b1", "B", "home_b")
    b2 = add_fleet(engine, "b2", "B", "home_b")
    c1 = add_fleet(engine, "c1", "C", "home_c")
    c2 = add_fleet(engine, "c2", "C", "home_c")

    engine.resolve_system_combat("sys_x", [b1, b2, c1, c2])

    report = engine.combat_reports[-1]
    assert report["outcome"] == "contested"
    assert report["winner"] is None
    assert set(report["contested_between"]) == {"B", "C"}
    # System should be left uncontrolled after a contested victory
    assert engine.systems["sys_x"].owner is None
    # Defenders were destroyed
    assert len(report["casualties"]["defenders"]) == 1


def test_strongest_attacker_wins_when_no_tie():
    engine = make_engine()
    add_system(engine, "home_b", owner="B")
    add_system(engine, "home_c", owner="C")
    add_system(engine, "sys_x", owner="A")

    add_fleet(engine, "def1", "A", "sys_x")
    b1 = add_fleet(engine, "b1", "B", "home_b")
    b2 = add_fleet(engine, "b2", "B", "home_b")
    c1 = add_fleet(engine, "c1", "C", "home_c")  # only 1 fleet for C

    engine.resolve_system_combat("sys_x", [b1, b2, c1])
    report = engine.combat_reports[-1]
    assert report["outcome"] == "attacker_victory"
    assert report["winner"] == "B"
    assert engine.systems["sys_x"].owner == "B"
