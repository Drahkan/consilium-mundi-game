"""Tests for Fog of War visibility logic.

Locks in the behaviour of GameEngine.compute_visibility so future
refactors (e.g., adding an extended-sight upgrade) don't accidentally
regress the 1-jump rule or leak information into HIDDEN systems.
"""

import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "backend")))

from server import GameEngine, GameConfig, SolarSystem, Starfleet  # noqa: E402


def make_engine(fow_mode="basic"):
    engine = GameEngine(GameConfig(num_players=2, fow_mode=fow_mode))
    engine.players = ["A", "B"]
    return engine


def add_system(engine, sid, owner=None, upgrades=None, x=0, y=0):
    s = SolarSystem(sid, sid, x, y)
    s.owner = owner
    if upgrades:
        s.upgrades = list(upgrades)
    engine.systems[sid] = s
    return s


def connect(a, b):
    a.connections.append(b.id)
    b.connections.append(a.id)


def test_own_and_adjacent_are_full_others_hidden():
    e = make_engine()
    home = add_system(e, "home_a", owner="A")
    neighbour = add_system(e, "neigh", owner=None)
    far = add_system(e, "far", owner="B", upgrades=["starport"])
    connect(home, neighbour)
    connect(neighbour, far)

    vis = e.compute_visibility("A")
    assert vis["home_a"] == "full"
    assert vis["neigh"] == "full"       # 1 jump from an owned system
    assert vis["far"] == "hidden"       # 2 jumps → hidden


def test_hidden_system_leaks_no_owner_or_upgrades():
    e = make_engine()
    home = add_system(e, "home_a", owner="A")
    neighbour = add_system(e, "neigh")
    far = add_system(e, "far", owner="B", upgrades=["starport", "colony"])
    connect(home, neighbour)  # far is not connected → 2+ jumps away

    state = e.get_game_state("A")
    far_view = state["systems"]["far"]
    assert far_view["visibility"] == "hidden"
    assert far_view["name"] == "???"
    assert far_view["owner"] is None
    assert far_view["upgrades"] == []
    assert far_view["resources"] is None
    assert far_view["starfleets"] == 0
    assert far_view["has_owner"] is None
    assert far_view["has_upgrades"] is None


def test_fleet_presence_reveals_current_system():
    """A player's own fleet in a system reveals it, even if it isn't
    owned by them or adjacent to any owned system."""
    e = make_engine()
    home = add_system(e, "home_a", owner="A")
    far = add_system(e, "far", owner="B")
    # No connection: home_a and far are unrelated
    fleet = Starfleet("fleet_a1", "A", "far")
    e.starfleets["fleet_a1"] = fleet
    far.starfleets["fleet_a1"] = fleet

    vis = e.compute_visibility("A")
    assert vis["home_a"] == "full"
    assert vis["far"] == "full"


def test_fow_off_reveals_everything():
    e = make_engine(fow_mode="off")
    add_system(e, "home_a", owner="A")
    add_system(e, "far", owner="B", upgrades=["colony"])
    vis = e.compute_visibility("A")
    assert set(vis.values()) == {"full"}


def test_extended_sight_produces_partial_view():
    """Populating extended_sight[player] should downgrade HIDDEN → PARTIAL
    for that specific system, and PARTIAL should reveal presence-only
    flags without leaking identity/details.
    """
    e = make_engine()
    add_system(e, "home_a", owner="A")
    far = add_system(e, "far", owner="B", upgrades=["starport"])
    # Player A has a scout upgrade granting extended sight of "far"
    e.extended_sight["A"] = {"far"}

    state = e.get_game_state("A")
    far_view = state["systems"]["far"]
    assert far_view["visibility"] == "partial"
    assert far_view["name"] == "far"           # name revealed
    assert far_view["owner"] is None           # identity redacted
    assert far_view["upgrades"] == []          # specific upgrades redacted
    assert far_view["has_owner"] is True       # presence flag
    assert far_view["has_upgrades"] is True    # presence flag
    assert far_view["starfleets"] == 0         # fleet count redacted


def test_extended_sight_does_not_downgrade_full():
    e = make_engine()
    home = add_system(e, "home_a", owner="A")
    neighbour = add_system(e, "neigh", owner="B")
    connect(home, neighbour)
    e.extended_sight["A"] = {"neigh"}   # should NOT downgrade FULL → PARTIAL
    vis = e.compute_visibility("A")
    assert vis["neigh"] == "full"
