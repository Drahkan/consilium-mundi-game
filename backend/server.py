from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import os
import uuid
import random
import math
from datetime import datetime
import json
from pathlib import Path
from dotenv import load_dotenv

# Load backend .env (protected by platform; do not modify values)
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


# New imports for Phase 1 persistence
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import timezone
from persistence import GameDAO

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Optional Mongo client (do not hardcode - use env)
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "test_database")
_mongo_client = AsyncIOMotorClient(MONGO_URL) if MONGO_URL else None
_db = _mongo_client[DB_NAME] if _mongo_client else None
_dao = GameDAO(_db) if _db else None

# Game State Storage (in-memory cache; persisted via DAO when available)
games: Dict[str, Any] = {}
players: Dict[str, Any] = {}

class GameConfig(BaseModel):
    num_players: int = 4
    galaxy_size: str = "standard"  # small, standard, large
    turn_time_limit: int = 24  # hours

class PlayerAction(BaseModel):
    player_id: str
    game_id: str
    action_type: str
    action_data: Dict[str, Any]

class CreateGameRequest(BaseModel):
    player_name: str
    config: GameConfig

class JoinGameRequest(BaseModel):
    player_name: str
    game_id: str

class StarfleetOrder(BaseModel):
    starfleet_id: str
    order_type: str  # move, hold, support, retreat
    target_system: Optional[str] = None
    support_target: Optional[str] = None

# Galaxy Generation Classes
class SolarSystem:
    def __init__(self, id: str, name: str, x: float, y: float):
        self.id = id
        self.name = name
        self.x = x
        self.y = y
        self.owner = None
        self.starfleets = {}  # starfleet_id -> Starfleet object
        self.upgrades = []
        self.resources = {"tech": 0, "metals": 0, "chon": 0}
        self.connections = []  # List of connected system IDs
        self.is_home_system = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "x": self.x,
            "y": self.y,
            "owner": self.owner,
            "upgrades": list(self.upgrades),
            "resources": dict(self.resources),
            "connections": list(self.connections),
            "is_home_system": self.is_home_system,
        }

    @staticmethod
    def from_dict(d: Dict[str, Any]) -> "SolarSystem":
        s = SolarSystem(d["id"], d["name"], d["x"], d["y"])
        s.owner = d.get("owner")
        s.upgrades = list(d.get("upgrades", []))
        s.resources = dict(d.get("resources", {"tech": 0, "metals": 0, "chon": 0}))
        s.connections = list(d.get("connections", []))
        s.is_home_system = d.get("is_home_system", False)
        s.starfleets = {}
        return s

class Starfleet:
    def __init__(self, id: str, owner: str, system_id: str):
        self.id = id
        self.owner = owner
        self.system_id = system_id
        self.orders = None
        self.rally_point = None
        self.strength = 1  # All starfleets have equal strength

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "owner": self.owner,
            "system_id": self.system_id,
            "orders": self.orders,
            "rally_point": self.rally_point,
            "strength": self.strength,
        }

    @staticmethod
    def from_dict(d: Dict[str, Any]) -> "Starfleet":
        sf = Starfleet(d["id"], d["owner"], d["system_id"])
        sf.orders = d.get("orders")
        sf.rally_point = d.get("rally_point")
        sf.strength = d.get("strength", 1)
        return sf

class GameEngine:
    def __init__(self, config: GameConfig):
        self.config = config
        self.systems = {}
        self.starfleets = {}  # starfleet_id -> Starfleet object
        self.players = []
        self.player_resources = {}  # player_id -> {tech: x, metals: y, chon: z}
        self.player_orders = {}  # player_id -> [orders]
        self.current_turn = 1
        self.phase = "setup"  # setup, resource, upkeep, activity, resolution, trade, build
        self.turn_deadline = None
        self.combat_reports = []
        
    def to_dict(self) -> Dict[str, Any]:
        return {
            "config": {
                "num_players": self.config.num_players,
                "galaxy_size": self.config.galaxy_size,
                "turn_time_limit": self.config.turn_time_limit,
            },
            "systems": {sid: s.to_dict() for sid, s in self.systems.items()},
            "starfleets": {fid: sf.to_dict() for fid, sf in self.starfleets.items()},
            "players": list(self.players),
            "player_resources": dict(self.player_resources),
            "player_orders": dict(self.player_orders),
            "current_turn": self.current_turn,
            "phase": self.phase,
            "turn_deadline": self.turn_deadline,
            "combat_reports": list(getattr(self, 'combat_reports', [])),
        }

    @staticmethod
    def from_dict(d: Dict[str, Any]) -> "GameEngine":
        cfg = d.get("config", {})
        engine = GameEngine(GameConfig(**cfg))
        # Systems first
        engine.systems = {sid: SolarSystem.from_dict(sd) for sid, sd in d.get("systems", {}).items()}
        # Starfleets then
        engine.starfleets = {fid: Starfleet.from_dict(sf) for fid, sf in d.get("starfleets", {}).items()}
        # Attach starfleets to systems
        for sf in engine.starfleets.values():
            sys_obj = engine.systems.get(sf.system_id)
            if sys_obj is not None:
                sys_obj.starfleets[sf.id] = sf
        # Simple fields
        engine.players = list(d.get("players", []))
        engine.player_resources = dict(d.get("player_resources", {}))
        engine.player_orders = dict(d.get("player_orders", {}))
        engine.current_turn = d.get("current_turn", 1)
        engine.phase = d.get("phase", "setup")
        engine.turn_deadline = d.get("turn_deadline")
        engine.combat_reports = list(d.get("combat_reports", []))
        return engine

    def generate_galaxy(self):
        # ... existing implementation remains (omitted here for brevity)
        num_players = self.config.num_players
        systems_per_player = 8
        total_systems = num_players * systems_per_player + 1
        self.systems = {}
        map_x, map_y = 800, 600
        center_x, center_y = map_x // 2, map_y // 2
        home_systems = []
        home_radius = 180
        for i in range(num_players):
            angle = (2 * math.pi * i) / num_players
            angle += random.uniform(-0.3, 0.3)
            x = center_x + home_radius * math.cos(angle)
            y = center_y + home_radius * math.sin(angle)
            system = SolarSystem(id=f"home_{i}", name=f"Home System {i+1}", x=x, y=y)
            system.is_home_system = True
            system.resources = {"tech": 1, "metals": 1, "chon": 1}
            home_systems.append(system)
        remaining_systems = total_systems - len(home_systems)
        core_systems_count = max(1, int(remaining_systems * 0.25))
        core_systems = []
        core_radius = 100
        for i in range(core_systems_count):
            attempts = 0
            while attempts < 100:
                angle = random.uniform(0, 2 * math.pi)
                radius = random.uniform(20, core_radius)
                x = center_x + radius * math.cos(angle)
                y = center_y + radius * math.sin(angle)
                valid = True
                min_distance = 60
                for existing in home_systems + core_systems:
                    dist = math.sqrt((x - existing.x)**2 + (y - existing.y)**2)
                    if dist < min_distance:
                        valid = False
                        break
                if valid:
                    system = SolarSystem(id=f"core_{i}", name=f"Core System {i+1}", x=x, y=y)
                    system.resources = self.generate_system_resources()
                    core_systems.append(system)
                    break
                attempts += 1
        player_systems = []
        systems_per_player_region = (remaining_systems - core_systems_count) // num_players
        for player_idx in range(num_players):
            home_system = home_systems[player_idx]
            for i in range(systems_per_player_region):
                attempts = 0
                while attempts < 100:
                    angle = random.uniform(0, 2 * math.pi)
                    distance = random.uniform(50, 120)
                    x = home_system.x + distance * math.cos(angle)
                    y = home_system.y + distance * math.sin(angle)
                    x = max(50, min(map_x - 50, x))
                    y = max(50, min(map_y - 50, y))
                    valid = True
                    min_distance = 60
                    all_systems = home_systems + core_systems + player_systems
                    for existing in all_systems:
                        dist = math.sqrt((x - existing.x)**2 + (y - existing.y)**2)
                        if dist < min_distance:
                            valid = False
                            break
                    if valid:
                        system = SolarSystem(id=f"player_{player_idx}_system_{i}", name=f"System {len(home_systems + core_systems + player_systems) + 1}", x=x, y=y)
                        system.resources = self.generate_system_resources()
                        player_systems.append(system)
                        break
                    attempts += 1
        all_systems = home_systems + core_systems + player_systems
        self.generate_guaranteed_connections(all_systems, home_systems, core_systems, num_players)
        for system in all_systems:
            self.systems[system.id] = system

    def generate_system_resources(self):
        resource_roll = random.random()
        if resource_roll < 0.15:
            return {"tech": 0, "metals": 0, "chon": 0}
        elif resource_roll < 0.40:
            return {"tech": 0, "metals": 0, "chon": 1}
        elif resource_roll < 0.65:
            return {"tech": 0, "metals": 1, "chon": 0}
        elif resource_roll < 0.85:
            return {"tech": 0, "metals": 1, "chon": 1}
        elif resource_roll < 0.90:
            return {"tech": 0, "metals": 1, "chon": 2}
        elif resource_roll < 0.95:
            return {"tech": 0, "metals": 2, "chon": 1}
        else:
            return {"tech": 0, "metals": 2, "chon": 2}

    def generate_guaranteed_connections(self, all_systems, home_systems, core_systems, num_players):
        for home_system in home_systems:
            nearest_core = min(core_systems, key=lambda core: math.sqrt((home_system.x - core.x)**2 + (home_system.y - core.y)**2))
            home_system.connections.append(nearest_core.id)
            nearest_core.connections.append(home_system.id)
        for i in range(num_players):
            current_home = home_systems[i]
            next_home = home_systems[(i + 1) % num_players]
            current_region = [s for s in all_systems if not s.is_home_system and s not in core_systems and math.sqrt((s.x - current_home.x)**2 + (s.y - current_home.y)**2) < 150]
            next_region = [s for s in all_systems if not s.is_home_system and s not in core_systems and math.sqrt((s.x - next_home.x)**2 + (s.y - next_home.y)**2) < 150]
            if current_region and next_region:
                min_dist = float('inf')
                best_pair = None
                for curr_sys in current_region:
                    for next_sys in next_region:
                        dist = math.sqrt((curr_sys.x - next_sys.x)**2 + (curr_sys.y - next_sys.y)**2)
                        if dist < min_dist:
                            min_dist = dist
                            best_pair = (curr_sys, next_sys)
                if best_pair:
                    best_pair[0].connections.append(best_pair[1].id)
                    best_pair[1].connections.append(best_pair[0].id)
                    best_pair[0].connections.append(current_home.id)
                    current_home.connections.append(best_pair[0].id)
                    best_pair[1].connections.append(next_home.id)
                    next_home.connections.append(best_pair[1].id)
        for system in all_systems:
            target_connections = 4 if system.is_home_system else random.randint(3, 5)
            while len(system.connections) < target_connections:
                candidates = []
                for other in all_systems:
                    if (other.id != system.id and other.id not in system.connections):
                        dist = math.sqrt((system.x - other.x)**2 + (system.y - other.y)**2)
                        candidates.append((other, dist))
                if not candidates:
                    break
                candidates.sort(key=lambda x: x[1])
                nearest = candidates[0][0]
                if len(nearest.connections) < 6:
                    system.connections.append(nearest.id)
                    nearest.connections.append(system.id)
                else:
                    break

    # The rest of GameEngine methods remain identical (submit orders, resolve phases, etc.)
    # --- BEGIN original methods (unchanged) ---
    def create_initial_starfleets(self):
        home_systems = [s for s in self.systems.values() if s.is_home_system]
        for i, player_id in enumerate(self.players):
            if i < len(home_systems):
                home_system = home_systems[i]
                home_system.owner = player_id
                self.player_resources[player_id] = {"tech": 4, "metals": 4, "chon": 4}
                self.player_orders[player_id] = []
                starfleet = Starfleet(id=f"fleet_{player_id}_0", owner=player_id, system_id=home_system.id)
                home_system.starfleets[starfleet.id] = starfleet
                self.starfleets[starfleet.id] = starfleet
                home_system.upgrades = ["starport", "shipyard", "colony"]
    def submit_starfleet_orders(self, player_id: str, orders: List[StarfleetOrder]):
        if self.phase != "activity":
            raise ValueError("Can only submit orders during activity phase")
        player_starfleets = [sf for sf in self.starfleets.values() if sf.owner == player_id]
        for order in orders:
            starfleet = self.starfleets.get(order.starfleet_id)
            if not starfleet or starfleet.owner != player_id:
                continue
            if order.order_type == "move":
                current_system = self.systems[starfleet.system_id]
                if order.target_system not in current_system.connections:
                    continue
            starfleet.orders = {"type": order.order_type, "target": order.target_system, "support_target": order.support_target}
    def resolve_turn(self):
        if self.phase != "activity":
            return
        try:
            self.auto_submit_pending_orders()
            self.resource_phase()
            self.upkeep_phase()
            self.resolution_phase()
            self.build_phase()
            self.current_turn += 1
            self.phase = "activity"
            for starfleet in self.starfleets.values():
                starfleet.orders = None
        except Exception as e:
            print(f"Turn resolution error: {e}")
            self.current_turn += 1
    def auto_submit_pending_orders(self):
        pass
    def resource_phase(self):
        for player_id in self.players:
            new_resources = {"tech": 0, "metals": 0, "chon": 0}
            for system in self.systems.values():
                if system.owner == player_id:
                    new_resources["tech"] += system.resources["tech"]
                    new_resources["metals"] += system.resources["metals"]
                    new_resources["chon"] += system.resources["chon"]
                    if "colony" in system.upgrades:
                        new_resources["tech"] += 1
                    if "mining_facilities" in system.upgrades:
                        new_resources["metals"] += 1
                        new_resources["chon"] += 1
            current_resources = self.player_resources.get(player_id, {"tech": 0, "metals": 0, "chon": 0})
            self.player_resources[player_id] = {
                "tech": current_resources["tech"] + new_resources["tech"],
                "metals": current_resources["metals"] + new_resources["metals"],
                "chon": current_resources["chon"] + new_resources["chon"],
            }
    def upkeep_phase(self):
        for player_id in self.players:
            player_starfleets = [sf for sf in self.starfleets.values() if sf.owner == player_id]
            resources = self.player_resources[player_id]
            upkeep_cost = len(player_starfleets)
            if (resources["tech"] >= upkeep_cost and resources["metals"] >= upkeep_cost and resources["chon"] >= upkeep_cost):
                resources["tech"] -= upkeep_cost
                resources["metals"] -= upkeep_cost
                resources["chon"] -= upkeep_cost
            else:
                self.destroy_unmaintainable_starfleets(player_id)
    def destroy_unmaintainable_starfleets(self, player_id: str):
        player_starfleets = [sf for sf in self.starfleets.values() if sf.owner == player_id]
        resources = self.player_resources[player_id]
        max_maintainable = min(resources["tech"], resources["metals"], resources["chon"])
        to_destroy = len(player_starfleets) - max_maintainable
        if to_destroy > 0:
            starfleets_by_distance = sorted(player_starfleets, key=lambda sf: self.calculate_supply_distance(sf), reverse=True)
            for i in range(to_destroy):
                starfleet = starfleets_by_distance[i]
                self.destroy_starfleet(starfleet.id)
            remaining = len(player_starfleets) - to_destroy
            resources["tech"] = max(0, resources["tech"] - remaining)
            resources["metals"] = max(0, resources["metals"] - remaining)
            resources["chon"] = max(0, resources["chon"] - remaining)
    def calculate_supply_distance(self, starfleet):
        current_system = self.systems[starfleet.system_id]
        home_systems = [s for s in self.systems.values() if s.is_home_system and s.owner == starfleet.owner]
        min_distance = float('inf')
        for home in home_systems:
            dist = math.sqrt((current_system.x - home.x)**2 + (current_system.y - home.y)**2)
            min_distance = min(min_distance, dist)
        return min_distance
    def resolution_phase(self):
        self.resolve_espionage()
        movements = {}
        for starfleet in self.starfleets.values():
            if starfleet.orders and starfleet.orders["type"] == "move":
                target_system = starfleet.orders["target"]
                if target_system not in movements:
                    movements[target_system] = []
                movements[target_system].append(starfleet)
        for system_id, incoming_starfleets in movements.items():
            self.resolve_system_combat(system_id, incoming_starfleets)
    def resolve_system_combat(self, system_id: str, incoming_starfleets: List[Starfleet]):
        target_system = self.systems[system_id]
        defending_starfleets = list(target_system.starfleets.values())
        if not target_system.owner and len(defending_starfleets) == 0:
            if incoming_starfleets:
                attacker_groups = {}
                for starfleet in incoming_starfleets:
                    owner = starfleet.owner
                    if owner not in attacker_groups:
                        attacker_groups[owner] = []
                    attacker_groups[owner].append(starfleet)
                strongest_attacker = max(attacker_groups.keys(), key=lambda owner: len(attacker_groups[owner]))
                target_system.owner = strongest_attacker
                for starfleet in incoming_starfleets:
                    if starfleet.owner == strongest_attacker:
                        old_system = self.systems[starfleet.system_id]
                        del old_system.starfleets[starfleet.id]
                        starfleet.system_id = system_id
                        target_system.starfleets[starfleet.id] = starfleet
                    else:
                        self.retreat_starfleet(starfleet)
                combat_report = {
                    "system": target_system.name,
                    "turn": self.current_turn,
                    "attackers": {owner: len(group) for owner, group in attacker_groups.items()},
                    "defenders": 0,
                    "outcome": "automatic_capture",
                    "casualties": {"attackers": [], "defenders": []},
                }
                if not hasattr(self, 'combat_reports'):
                    self.combat_reports = []
                self.combat_reports.append(combat_report)
            return
        attacker_forces = {}
        for starfleet in incoming_starfleets:
            owner = starfleet.owner
            if owner not in attacker_forces:
                attacker_forces[owner] = {"starfleets": [], "support": 0}
            attacker_forces[owner]["starfleets"].append(starfleet)
        for owner in attacker_forces:
            for starfleet in self.starfleets.values():
                if (starfleet.orders and starfleet.orders.get("type") == "support" and starfleet.owner == owner and starfleet.orders.get("target") == system_id):
                    attacker_forces[owner]["support"] += 1
        defender_owner = target_system.owner
        defender_strength = len(defending_starfleets)
        if (defender_owner and "starport" in target_system.upgrades and (not hasattr(target_system, 'sabotaged_upgrades') or "starport" not in getattr(target_system, 'sabotaged_upgrades', []))):
            defender_strength += 1
        if defender_owner:
            for starfleet in self.starfleets.values():
                if (starfleet.orders and starfleet.orders.get("type") == "support" and starfleet.owner == defender_owner and starfleet.orders.get("target") == system_id):
                    defender_strength += 1
        total_attacker_strength = 0
        strongest_attacker = None
        max_attacker_strength = 0
        for owner, forces in attacker_forces.items():
            owner_strength = len(forces["starfleets"]) + forces["support"]
            total_attacker_strength += owner_strength
            if owner_strength > max_attacker_strength:
                max_attacker_strength = owner_strength
                strongest_attacker = owner
        combat_report = {
            "system": target_system.name,
            "turn": self.current_turn,
            "attackers": {owner: len(forces["starfleets"]) + forces["support"] for owner, forces in attacker_forces.items()},
            "defenders": defender_strength,
            "outcome": None,
            "casualties": {"attackers": [], "defenders": []},
        }
        if total_attacker_strength > defender_strength:
            combat_report["outcome"] = "attacker_victory"
            for starfleet in defending_starfleets:
                combat_report["casualties"]["defenders"].append(starfleet.id)
                self.destroy_starfleet(starfleet.id)
            if ("starport" in target_system.upgrades and not getattr(target_system, 'destabilized', False)):
                target_system.upgrades.remove("starport")
            target_system.owner = strongest_attacker
            for starfleet in incoming_starfleets:
                if starfleet.owner == strongest_attacker:
                    old_system = self.systems[starfleet.system_id]
                    del old_system.starfleets[starfleet.id]
                    starfleet.system_id = system_id
                    target_system.starfleets[starfleet.id] = starfleet
                else:
                    combat_report["casualties"]["attackers"].append(starfleet.id)
                    self.retreat_starfleet(starfleet)
        elif total_attacker_strength == defender_strength:
            combat_report["outcome"] = "stalemate"
            for starfleet in incoming_starfleets:
                self.retreat_starfleet(starfleet)
        else:
            combat_report["outcome"] = "defender_victory"
            for starfleet in incoming_starfleets:
                if max_attacker_strength < defender_strength - 1:
                    combat_report["casualties"]["attackers"].append(starfleet.id)
                    self.destroy_starfleet(starfleet.id)
                else:
                    self.retreat_starfleet(starfleet)
        if not hasattr(self, 'combat_reports'):
            self.combat_reports = []
        self.combat_reports.append(combat_report)
        if hasattr(target_system, 'sabotaged_upgrades'):
            delattr(target_system, 'sabotaged_upgrades')
        if hasattr(target_system, 'destabilized'):
            delattr(target_system, 'destabilized')
        if hasattr(target_system, 'counter_espionage'):
            delattr(target_system, 'counter_espionage')
    def retreat_starfleet(self, starfleet: Starfleet):
        pass
    def destroy_starfleet(self, starfleet_id: str):
        if starfleet_id in self.starfleets:
            starfleet = self.starfleets[starfleet_id]
            system = self.systems[starfleet.system_id]
            if starfleet_id in system.starfleets:
                del system.starfleets[starfleet_id]
            del self.starfleets[starfleet_id]
    def build_phase(self):
        for player_id in self.players:
            if player_id in self.player_orders:
                for order in self.player_orders[player_id]:
                    if order.get("type") == "build":
                        self.execute_build_order(player_id, order)
        for player_id in self.players:
            self.player_orders[player_id] = []
    def execute_build_order(self, player_id: str, order: Dict[str, Any]):
        build_type = order.get("build_type")
        system_id = order.get("system_id")
        if system_id not in self.systems:
            return
        system = self.systems[system_id]
        if system.owner != player_id:
            return
        resources = self.player_resources[player_id]
        if build_type == "starfleet":
            if (resources["tech"] >= 1 and resources["metals"] >= 1 and resources["chon"] >= 1 and "shipyard" in system.upgrades):
                resources["tech"] -= 1
                resources["metals"] -= 1
                resources["chon"] -= 1
                fleet_id = f"fleet_{player_id}_{len(self.starfleets)}"
                starfleet = Starfleet(fleet_id, player_id, system_id)
                system.starfleets[fleet_id] = starfleet
                self.starfleets[fleet_id] = starfleet
        elif build_type == "starport":
            if (resources["tech"] >= 2 and resources["metals"] >= 2 and resources["chon"] >= 2 and "starport" not in system.upgrades):
                resources["tech"] -= 2
                resources["metals"] -= 2
                resources["chon"] -= 2
                system.upgrades.append("starport")
        elif build_type == "shipyard":
            if (resources["tech"] >= 3 and resources["metals"] >= 3 and resources["chon"] >= 1 and "shipyard" not in system.upgrades):
                resources["tech"] -= 3
                resources["metals"] -= 3
                resources["chon"] -= 1
                system.upgrades.append("shipyard")
        elif build_type == "colony":
            if (resources["metals"] >= 2 and resources["chon"] >= 2 and "colony" not in system.upgrades):
                resources["metals"] -= 2
                resources["chon"] -= 2
                system.upgrades.append("colony")
        elif build_type == "mining_facilities":
            if (resources["tech"] >= 2 and resources["metals"] >= 2 and resources["chon"] >= 1 and "mining_facilities" not in system.upgrades):
                resources["tech"] -= 2
                resources["metals"] -= 2
                resources["chon"] -= 1
                system.upgrades.append("mining_facilities")
        elif build_type == "wormhole_generator":
            if (resources["tech"] >= 6 and resources["metals"] >= 2 and "wormhole_generator" not in system.upgrades):
                resources["tech"] -= 6
                resources["metals"] -= 2
                system.upgrades.append("wormhole_generator")
    def check_victory_condition(self):
        if not self.systems:
            return None
        total_systems = len(self.systems)
        required_systems = (total_systems // 2) + 1
        player_system_counts = {}
        for system in self.systems.values():
            if system.owner:
                player_system_counts[system.owner] = player_system_counts.get(system.owner, 0) + 1
        for player_id, count in player_system_counts.items():
            if count >= required_systems:
                return {
                    "winner": player_id,
                    "systems_controlled": count,
                    "total_systems": total_systems,
                    "required_systems": required_systems,
                }
        return None
    def submit_espionage_orders(self, player_id: str, orders: List[Dict[str, Any]]):
        if self.phase != "activity":
            raise ValueError("Can only submit espionage orders during activity phase")
        resources = self.player_resources[player_id]
        for order in orders:
            espionage_type = order.get("espionage_type")
            target_system = order.get("target_system")
            if resources["tech"] >= 1:
                resources["tech"] -= 1
                if player_id not in self.player_orders:
                    self.player_orders[player_id] = []
                self.player_orders[player_id].append({
                    "type": "espionage",
                    "espionage_type": espionage_type,
                    "target_system": target_system,
                    "target_player": order.get("target_player"),
                })
    def resolve_espionage(self):
        for player_id in self.players:
            if player_id in self.player_orders:
                for order in self.player_orders[player_id]:
                    if order.get("type") == "espionage":
                        self.execute_espionage_order(player_id, order)
    def execute_espionage_order(self, player_id: str, order: Dict[str, Any]):
        espionage_type = order.get("espionage_type")
        target_system_id = order.get("target_system")
        if target_system_id not in self.systems:
            return
        target_system = self.systems[target_system_id]
        adjacent_owned = False
        for conn_id in target_system.connections:
            conn_system = self.systems.get(conn_id)
            if conn_system and conn_system.owner == player_id:
                adjacent_owned = True
                break
        if not adjacent_owned:
            return
        if espionage_type == "sabotage":
            if target_system.upgrades:
                upgrade = target_system.upgrades[0]
                if "sabotaged_upgrades" not in target_system.__dict__:
                    target_system.sabotaged_upgrades = []
                target_system.sabotaged_upgrades.append(upgrade)
            elif target_system.starfleets:
                for starfleet in target_system.starfleets.values():
                    if starfleet.orders:
                        starfleet.orders = {"type": "hold"}
        elif espionage_type == "destabilize":
            target_system.destabilized = True
        elif espionage_type == "counter_espionage":
            target_system.counter_espionage = True
    def submit_build_orders(self, player_id: str, orders: List[Dict[str, Any]]):
        if self.phase != "activity":
            raise ValueError("Can only submit build orders during activity phase")
        if player_id not in self.player_orders:
            self.player_orders[player_id] = []
        for order in orders:
            if order.get("type") == "build":
                system_id = order.get("system_id")
                if system_id in self.systems and self.systems[system_id].owner == player_id:
                    self.player_orders[player_id].append(order)
    def get_game_state(self, player_id: str = None):
        return {
            "turn": self.current_turn,
            "phase": self.phase,
            "systems": {
                sid: {
                    "id": s.id,
                    "name": s.name,
                    "x": s.x,
                    "y": s.y,
                    "owner": s.owner,
                    "resources": s.resources,
                    "connections": s.connections,
                    "starfleets": len(s.starfleets),
                    "starfleet_details": [
                        {"id": sf.id, "owner": sf.owner, "orders": sf.orders}
                        for sf in s.starfleets.values()
                    ],
                    "upgrades": s.upgrades,
                    "is_home_system": s.is_home_system,
                }
                for sid, s in self.systems.items()
            },
            "players": self.players,
            "player_resources": self.player_resources.get(player_id) if player_id else self.player_resources,
            "combat_reports": getattr(self, 'combat_reports', []),
            "victory_status": self.check_victory_condition(),
            "config": {
                "num_players": self.config.num_players,
                "galaxy_size": self.config.galaxy_size,
            },
        }
    # --- END original methods ---

# Helper to build players_index for persistence
def _players_index_for_game(game_id: str) -> List[Dict[str, Any]]:
    return [
        {"id": p["id"], "name": p["name"], "game_id": p["game_id"]}
        for p in players.values() if p.get("game_id") == game_id
    ]

# API routes
@app.post("/api/create-game")
async def create_game(request: CreateGameRequest):
    game_id = str(uuid.uuid4())
    player_id = str(uuid.uuid4())
    engine = GameEngine(request.config)
    engine.players.append(player_id)
    engine.generate_galaxy()
    games[game_id] = engine
    players[player_id] = {"id": player_id, "name": request.player_name, "game_id": game_id}
    # Persist
    if _dao:
        await _dao.save_game(game_id, engine.to_dict(), _players_index_for_game(game_id))
    return {"game_id": game_id, "player_id": player_id, "status": "created"}

@app.post("/api/join-game")
async def join_game(request: JoinGameRequest):
    if request.game_id not in games:
        # Try loading from DB
        if _dao:
            doc = await _dao.load_game(request.game_id)
            if doc:
                eng = GameEngine.from_dict(doc.get("engine", {}))
                games[request.game_id] = eng
                for entry in doc.get("players_index", []):
                    players[entry["id"]] = entry
    if request.game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[request.game_id]
    if len(game.players) >= game.config.num_players:
        raise HTTPException(status_code=400, detail="Game is full")
    player_id = str(uuid.uuid4())
    game.players.append(player_id)
    players[player_id] = {"id": player_id, "name": request.player_name, "game_id": request.game_id}
    if len(game.players) == game.config.num_players:
        game.create_initial_starfleets()
        game.phase = "activity"
    if _dao:
        await _dao.save_game(request.game_id, game.to_dict(), _players_index_for_game(request.game_id))
    return {"game_id": request.game_id, "player_id": player_id, "status": "joined"}

@app.post("/api/game/{game_id}/add-ai-players")
async def add_ai_players(game_id: str):
    if game_id not in games:
        if _dao:
            doc = await _dao.load_game(game_id)
            if doc:
                eng = GameEngine.from_dict(doc.get("engine", {}))
                games[game_id] = eng
                for entry in doc.get("players_index", []):
                    players[entry["id"]] = entry
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    ai_names = ["Admiral Zara", "Commander Vex", "Captain Nova"]
    added_players = []
    for ai_name in ai_names:
        if len(game.players) >= game.config.num_players:
            break
        player_id = str(uuid.uuid4())
        game.players.append(player_id)
        players[player_id] = {"id": player_id, "name": ai_name, "game_id": game_id}
        added_players.append({"id": player_id, "name": ai_name})
    if len(game.players) == game.config.num_players:
        game.create_initial_starfleets()
        game.phase = "activity"
    if _dao:
        await _dao.save_game(game_id, game.to_dict(), _players_index_for_game(game_id))
    return {"game_id": game_id, "players_added": added_players, "total_players": len(game.players), "status": "success"}

@app.get("/api/game/{game_id}/state")
async def get_game_state(game_id: str, player_id: Optional[str] = None):
    if game_id not in games and _dao:
        doc = await _dao.load_game(game_id)
        if doc:
            eng = GameEngine.from_dict(doc.get("engine", {}))
            games[game_id] = eng
            for entry in doc.get("players_index", []):
                players[entry["id"]] = entry
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    return games[game_id].get_game_state(player_id)

@app.get("/api/game/{game_id}/players")
async def get_game_players(game_id: str):
    if game_id not in games and _dao:
        doc = await _dao.load_game(game_id)
        if doc:
            eng = GameEngine.from_dict(doc.get("engine", {}))
            games[game_id] = eng
            for entry in doc.get("players_index", []):
                players[entry["id"]] = entry
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    game_players = []
    for pid in game.players:
        if pid in players:
            game_players.append(players[pid])
    return {"players": game_players}

@app.post("/api/game/{game_id}/orders")
async def submit_orders(game_id: str, orders_data: Dict[str, Any]):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    player_id = orders_data.get("player_id")
    orders = orders_data.get("orders", [])
    try:
        starfleet_orders = [StarfleetOrder(**order) for order in orders]
        game.submit_starfleet_orders(player_id, starfleet_orders)
        if _dao:
            await _dao.save_game(game_id, game.to_dict(), _players_index_for_game(game_id))
        return {"status": "orders_submitted", "count": len(orders)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/game/{game_id}/espionage-orders")
async def submit_espionage_orders(game_id: str, espionage_data: Dict[str, Any]):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    player_id = espionage_data.get("player_id")
    orders = espionage_data.get("orders", [])
    try:
        game.submit_espionage_orders(player_id, orders)
        if _dao:
            await _dao.save_game(game_id, game.to_dict(), _players_index_for_game(game_id))
        return {"status": "espionage_orders_submitted", "count": len(orders)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/game/{game_id}/build-orders")
async def submit_build_orders(game_id: str, build_data: Dict[str, Any]):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    player_id = build_data.get("player_id")
    orders = build_data.get("orders", [])
    try:
        game.submit_build_orders(player_id, orders)
        if _dao:
            await _dao.save_game(game_id, game.to_dict(), _players_index_for_game(game_id))
        return {"status": "build_orders_submitted", "count": len(orders)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/game/{game_id}/resolve-turn")
async def resolve_turn(game_id: str):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    try:
        game.resolve_turn()
        if _dao:
            await _dao.save_game(game_id, game.to_dict(), _players_index_for_game(game_id))
        return {"status": "turn_resolved", "new_turn": game.current_turn}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/game/{game_id}/action")
async def submit_action(game_id: str, action: PlayerAction):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    # No-op placeholder
    return {"status": "action_received", "action": action.action_type}

@app.get("/api/games")
async def list_games():
    if _dao:
        # Merge in-memory and persisted games for completeness
        persisted = await _dao.list_games_info()
        in_mem = [
            {
                "id": gid,
                "players": len(game.players),
                "max_players": game.config.num_players,
                "phase": game.phase,
                "turn": game.current_turn,
            }
            for gid, game in games.items()
        ]
        # Deduplicate by id preferring in-memory
        known = {g["id"]: g for g in in_mem}
        for g in persisted:
            if g["id"] not in known:
                known[g["id"]] = g
        return {"games": list(known.values())}
    # Fallback to memory-only
    return {
        "games": [
            {
                "id": gid,
                "players": len(game.players),
                "max_players": game.config.num_players,
                "phase": game.phase,
                "turn": game.current_turn,
            }
            for gid, game in games.items()
        ]
    }

@app.post("/api/lobby/{game_id}/start")
async def start_lobby(game_id: str):
    # Force start a lobby by creating initial starfleets and setting phase to activity.
    # Safe to call multiple times; no-op if already started.
    if game_id not in games and _dao:
        doc = await _dao.load_game(game_id)
        if doc:
            eng = GameEngine.from_dict(doc.get("engine", {}))
            games[game_id] = eng
            for entry in doc.get("players_index", []):
                players[entry["id"]] = entry
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    if game.phase != "activity" and len(game.players) > 0:
        game.create_initial_starfleets()
        game.phase = "activity"
    if _dao:
        await _dao.save_game(game_id, game.to_dict(), _players_index_for_game(game_id))
    return {"status": "started", "phase": game.phase}

@app.post("/api/login")
async def login(payload: Dict[str, Any]):
    name = (payload or {}).get("name") or "Player"
    token = str(uuid.uuid4())
    return {"token": token, "name": name}

@app.get("/")
async def root():
    return {"message": "Consilium Mundi Game Server", "status": "running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)