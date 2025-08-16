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

from motor.motor_asyncio import AsyncIOMotorClient
from datetime import timezone

app = FastAPI()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Game State Storage (In production, this would be a database)
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

class Starfleet:
    def __init__(self, id: str, owner: str, system_id: str):
        self.id = id
        self.owner = owner
        self.system_id = system_id
        self.orders = None
        self.rally_point = None
        self.strength = 1  # All starfleets have equal strength

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
        
    def generate_galaxy(self):
        """Generate a balanced galaxy map with guaranteed connectivity"""
        num_players = self.config.num_players
        systems_per_player = 8
        total_systems = num_players * systems_per_player + 1
        
        # Clear existing systems
        self.systems = {}
        
        # Galaxy dimensions
        map_x, map_y = 800, 600
        center_x, center_y = map_x // 2, map_y // 2
        
        # Phase 1: Create home systems in a balanced circle
        home_systems = []
        home_radius = 180  # Distance from center
        
        for i in range(num_players):
            angle = (2 * math.pi * i) / num_players
            # Add some randomness to avoid perfect symmetry
            angle += random.uniform(-0.3, 0.3)
            
            x = center_x + home_radius * math.cos(angle)
            y = center_y + home_radius * math.sin(angle)
            
            system = SolarSystem(
                id=f"home_{i}",
                name=f"Home System {i+1}",
                x=x,
                y=y
            )
            system.is_home_system = True
            system.resources = {"tech": 1, "metals": 1, "chon": 1}
            home_systems.append(system)
        
        # Phase 2: Create core systems (25% of remaining systems)
        remaining_systems = total_systems - len(home_systems)
        core_systems_count = max(1, int(remaining_systems * 0.25))
        core_systems = []
        core_radius = 100  # Distance from center for core systems
        
        for i in range(core_systems_count):
            # Place core systems in center area
            attempts = 0
            while attempts < 100:
                angle = random.uniform(0, 2 * math.pi)
                radius = random.uniform(20, core_radius)
                x = center_x + radius * math.cos(angle)
                y = center_y + radius * math.sin(angle)
                
                # Check minimum distance from existing systems
                valid = True
                min_distance = 60
                
                for existing in home_systems + core_systems:
                    dist = math.sqrt((x - existing.x)**2 + (y - existing.y)**2)
                    if dist < min_distance:
                        valid = False
                        break
                
                if valid:
                    system = SolarSystem(
                        id=f"core_{i}",
                        name=f"Core System {i+1}",
                        x=x,
                        y=y
                    )
                    system.resources = self.generate_system_resources()
                    core_systems.append(system)
                    break
                
                attempts += 1
        
        # Phase 3: Create player region systems
        player_systems = []
        systems_per_player_region = (remaining_systems - core_systems_count) // num_players
        
        for player_idx in range(num_players):
            home_system = home_systems[player_idx]
            player_region_systems = []
            
            for i in range(systems_per_player_region):
                attempts = 0
                while attempts < 100:
                    # Place systems around the home system
                    angle = random.uniform(0, 2 * math.pi)
                    distance = random.uniform(50, 120)
                    x = home_system.x + distance * math.cos(angle)
                    y = home_system.y + distance * math.sin(angle)
                    
                    # Keep within map bounds
                    x = max(50, min(map_x - 50, x))
                    y = max(50, min(map_y - 50, y))
                    
                    # Check minimum distance from all existing systems
                    valid = True
                    min_distance = 60
                    all_systems = home_systems + core_systems + player_systems
                    
                    for existing in all_systems:
                        dist = math.sqrt((x - existing.x)**2 + (y - existing.y)**2)
                        if dist < min_distance:
                            valid = False
                            break
                    
                    if valid:
                        system = SolarSystem(
                            id=f"player_{player_idx}_system_{i}",
                            name=f"System {len(home_systems + core_systems + player_systems) + 1}",
                            x=x,
                            y=y
                        )
                        system.resources = self.generate_system_resources()
                        player_region_systems.append(system)
                        player_systems.append(system)
                        break
                    
                    attempts += 1
        
        # Combine all systems
        all_systems = home_systems + core_systems + player_systems
        
        # Phase 4: Generate guaranteed connectivity
        self.generate_guaranteed_connections(all_systems, home_systems, core_systems, num_players)
        
        # Store all systems
        for system in all_systems:
            self.systems[system.id] = system
    
    def generate_system_resources(self):
        """Generate resources based on design document percentages"""
        resource_roll = random.random()
        if resource_roll < 0.15:  # 15% no resources
            return {"tech": 0, "metals": 0, "chon": 0}
        elif resource_roll < 0.40:  # 25% only CHON
            return {"tech": 0, "metals": 0, "chon": 1}
        elif resource_roll < 0.65:  # 25% only Metals
            return {"tech": 0, "metals": 1, "chon": 0}
        elif resource_roll < 0.85:  # 20% both
            return {"tech": 0, "metals": 1, "chon": 1}
        elif resource_roll < 0.90:  # 5% Metals + 2 CHON
            return {"tech": 0, "metals": 1, "chon": 2}
        elif resource_roll < 0.95:  # 5% 2 Metals + CHON
            return {"tech": 0, "metals": 2, "chon": 1}
        else:  # 5% 2 Metals + 2 CHON
            return {"tech": 0, "metals": 2, "chon": 2}
    
    def generate_guaranteed_connections(self, all_systems, home_systems, core_systems, num_players):
        """Generate wormhole connections ensuring no isolated regions"""
        # Phase 1: Connect each player's home system to nearest core system
        for home_system in home_systems:
            nearest_core = min(core_systems, 
                             key=lambda core: math.sqrt((home_system.x - core.x)**2 + (home_system.y - core.y)**2))
            
            home_system.connections.append(nearest_core.id)
            nearest_core.connections.append(home_system.id)
        
        # Phase 2: Connect adjacent player regions (ring topology)
        for i in range(num_players):
            current_home = home_systems[i]
            next_home = home_systems[(i + 1) % num_players]
            
            # Find closest non-home systems between these players
            current_region = [s for s in all_systems 
                            if not s.is_home_system 
                            and s not in core_systems
                            and math.sqrt((s.x - current_home.x)**2 + (s.y - current_home.y)**2) < 150]
            
            next_region = [s for s in all_systems 
                         if not s.is_home_system 
                         and s not in core_systems
                         and math.sqrt((s.x - next_home.x)**2 + (s.y - next_home.y)**2) < 150]
            
            if current_region and next_region:
                # Find closest pair between regions
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
                    
                    # Connect these bridge systems to their respective home systems
                    best_pair[0].connections.append(current_home.id)
                    current_home.connections.append(best_pair[0].id)
                    
                    best_pair[1].connections.append(next_home.id)
                    next_home.connections.append(best_pair[1].id)
        
        # Phase 3: Fill in additional connections to meet minimum requirements
        for system in all_systems:
            target_connections = 4 if system.is_home_system else random.randint(3, 5)
            
            while len(system.connections) < target_connections:
                # Find nearest unconnected systems
                candidates = []
                for other in all_systems:
                    if (other.id != system.id and 
                        other.id not in system.connections):
                        
                        dist = math.sqrt((system.x - other.x)**2 + (system.y - other.y)**2)
                        candidates.append((other, dist))
                
                if not candidates:
                    break
                
                # Sort by distance and connect to nearest
                candidates.sort(key=lambda x: x[1])
                nearest = candidates[0][0]
                
                # Avoid over-connecting systems
                if len(nearest.connections) < 6:
                    system.connections.append(nearest.id)
                    nearest.connections.append(system.id)
                else:
                    break
    
    def create_initial_starfleets(self):
        """Create starting starfleets for each player"""
        home_systems = [s for s in self.systems.values() if s.is_home_system]
        
        for i, player_id in enumerate(self.players):
            if i < len(home_systems):
                home_system = home_systems[i]
                home_system.owner = player_id
                
                # Initialize player resources with surplus (base 3 + 1 surplus per starfleet)
                self.player_resources[player_id] = {"tech": 4, "metals": 4, "chon": 4}
                self.player_orders[player_id] = []
                
                # Create initial starfleet
                starfleet = Starfleet(
                    id=f"fleet_{player_id}_0",
                    owner=player_id,
                    system_id=home_system.id
                )
                
                # Add to system and global registry
                home_system.starfleets[starfleet.id] = starfleet
                self.starfleets[starfleet.id] = starfleet
                
                # Add starport, shipyard, and colony to home system for better resource generation
                home_system.upgrades = ["starport", "shipyard", "colony"]
    
    def submit_starfleet_orders(self, player_id: str, orders: List[StarfleetOrder]):
        """Submit starfleet orders for a player"""
        if self.phase != "activity":
            raise ValueError("Can only submit orders during activity phase")
        
        # Validate and store orders
        player_starfleets = [sf for sf in self.starfleets.values() if sf.owner == player_id]
        
        for order in orders:
            # Find the starfleet
            starfleet = self.starfleets.get(order.starfleet_id)
            if not starfleet or starfleet.owner != player_id:
                continue
            
            # Validate order
            if order.order_type == "move":
                # Check if target system is connected
                current_system = self.systems[starfleet.system_id]
                if order.target_system not in current_system.connections:
                    continue
            
            # Store the order
            starfleet.orders = {
                "type": order.order_type,
                "target": order.target_system,
                "support_target": order.support_target
            }
    
    def resolve_turn(self):
        """Execute the full turn resolution according to Consilium Mundi rules"""
        if self.phase != "activity":
            return
        
        try:
            # Auto-submit any pending orders for players who haven't finalized
            self.auto_submit_pending_orders()
            
            # Phase 1: Resource Phase
            self.resource_phase()
            
            # Phase 2: Upkeep Phase  
            self.upkeep_phase()
            
            # Phase 3: Resolution Phase
            self.resolution_phase()
            
            # Phase 4: Build Phase
            self.build_phase()
            
            # Advance turn
            self.current_turn += 1
            self.phase = "activity"
            
            # Clear orders for next turn
            for starfleet in self.starfleets.values():
                starfleet.orders = None
        except Exception as e:
            print(f"Turn resolution error: {e}")
            # Continue anyway to prevent game from getting stuck
            self.current_turn += 1

    def auto_submit_pending_orders(self):
        """Auto-submit any pending orders for players who haven't explicitly finalized"""
        # Note: In the current implementation, orders are submitted immediately when created
        # This method ensures that any pending orders in the UI are considered active
        # The actual auto-submission logic is handled by the frontend during turn resolution
        pass
    
    def resource_phase(self):
        """Phase 1: Collect resources from controlled systems"""
        for player_id in self.players:
            new_resources = {"tech": 0, "metals": 0, "chon": 0}
            
            # Sum up resources from all owned systems
            for system in self.systems.values():
                if system.owner == player_id:
                    new_resources["tech"] += system.resources["tech"]
                    new_resources["metals"] += system.resources["metals"]
                    new_resources["chon"] += system.resources["chon"]
                    
                    # Add bonus from upgrades
                    if "colony" in system.upgrades:
                        new_resources["tech"] += 1
                    if "mining_facilities" in system.upgrades:
                        new_resources["metals"] += 1
                        new_resources["chon"] += 1
            
            # Add new resources to existing player resources (accumulate globally)
            current_resources = self.player_resources.get(player_id, {"tech": 0, "metals": 0, "chon": 0})
            self.player_resources[player_id] = {
                "tech": current_resources["tech"] + new_resources["tech"],
                "metals": current_resources["metals"] + new_resources["metals"],
                "chon": current_resources["chon"] + new_resources["chon"]
            }
    
    def upkeep_phase(self):
        """Phase 2: Pay upkeep for starfleets"""
        for player_id in self.players:
            player_starfleets = [sf for sf in self.starfleets.values() if sf.owner == player_id]
            resources = self.player_resources[player_id]
            
            # Calculate upkeep cost (1 of each resource per starfleet)
            upkeep_cost = len(player_starfleets)
            
            # Check if player can afford upkeep
            if (resources["tech"] >= upkeep_cost and 
                resources["metals"] >= upkeep_cost and 
                resources["chon"] >= upkeep_cost):
                
                # Pay upkeep
                resources["tech"] -= upkeep_cost
                resources["metals"] -= upkeep_cost  
                resources["chon"] -= upkeep_cost
            else:
                # Destroy starfleets that can't be maintained
                self.destroy_unmaintainable_starfleets(player_id)
    
    def destroy_unmaintainable_starfleets(self, player_id: str):
        """Destroy starfleets that can't be maintained due to insufficient resources"""
        player_starfleets = [sf for sf in self.starfleets.values() if sf.owner == player_id]
        resources = self.player_resources[player_id]
        
        # Calculate how many can be maintained
        max_maintainable = min(resources["tech"], resources["metals"], resources["chon"])
        to_destroy = len(player_starfleets) - max_maintainable
        
        if to_destroy > 0:
            # Destroy farthest starfleets first (as per rules)
            starfleets_by_distance = sorted(player_starfleets, 
                                          key=lambda sf: self.calculate_supply_distance(sf),
                                          reverse=True)
            
            for i in range(to_destroy):
                starfleet = starfleets_by_distance[i]
                self.destroy_starfleet(starfleet.id)
            
            # Pay upkeep for remaining starfleets
            remaining = len(player_starfleets) - to_destroy
            resources["tech"] = max(0, resources["tech"] - remaining)
            resources["metals"] = max(0, resources["metals"] - remaining)
            resources["chon"] = max(0, resources["chon"] - remaining)
    
    def calculate_supply_distance(self, starfleet: Starfleet) -> float:
        """Calculate supply chain distance for starfleet destruction priority"""
        # Simplified: just return distance from nearest home system
        current_system = self.systems[starfleet.system_id]
        home_systems = [s for s in self.systems.values() 
                       if s.is_home_system and s.owner == starfleet.owner]
        
        min_distance = float('inf')
        for home in home_systems:
            dist = math.sqrt((current_system.x - home.x)**2 + (current_system.y - home.y)**2)
            min_distance = min(min_distance, dist)
        
        return min_distance
    
    def resolution_phase(self):
        """Phase 3: Resolve all starfleet movement and combat"""
        # First resolve espionage
        self.resolve_espionage()
        
        movements = {}  # system_id -> list of incoming starfleets
        
        # Collect all movement orders
        for starfleet in self.starfleets.values():
            if starfleet.orders and starfleet.orders["type"] == "move":
                target_system = starfleet.orders["target"]
                if target_system not in movements:
                    movements[target_system] = []
                movements[target_system].append(starfleet)
        
        # Resolve each system with incoming movements
        for system_id, incoming_starfleets in movements.items():
            self.resolve_system_combat(system_id, incoming_starfleets)
    
    def resolve_system_combat(self, system_id: str, incoming_starfleets: List[Starfleet]):
        """Resolve combat in a specific system with support mechanics"""
        target_system = self.systems[system_id]
        defending_starfleets = list(target_system.starfleets.values())
        
        # Check if system is uncontrolled (no owner, no starfleets)
        if not target_system.owner and len(defending_starfleets) == 0:
            # Automatic capture of uncontrolled system
            if incoming_starfleets:
                # Find strongest attacking player
                attacker_groups = {}
                for starfleet in incoming_starfleets:
                    owner = starfleet.owner
                    if owner not in attacker_groups:
                        attacker_groups[owner] = []
                    attacker_groups[owner].append(starfleet)
                
                strongest_attacker = max(attacker_groups.keys(), 
                                       key=lambda owner: len(attacker_groups[owner]))
                
                # Transfer system ownership
                target_system.owner = strongest_attacker
                
                # Move strongest attacker's starfleets to the system
                for starfleet in incoming_starfleets:
                    if starfleet.owner == strongest_attacker:
                        # Move starfleet to new system
                        old_system = self.systems[starfleet.system_id]
                        del old_system.starfleets[starfleet.id]
                        
                        starfleet.system_id = system_id
                        target_system.starfleets[starfleet.id] = starfleet
                    else:
                        # Other attackers retreat (though shouldn't happen in uncontrolled systems)
                        self.retreat_starfleet(starfleet)
                
                # Create combat report for automatic capture
                combat_report = {
                    "system": target_system.name,
                    "turn": self.current_turn,
                    "attackers": {owner: len(group) for owner, group in attacker_groups.items()},
                    "defenders": 0,
                    "outcome": "automatic_capture",
                    "casualties": {"attackers": [], "defenders": []}
                }
                
                if not hasattr(self, 'combat_reports'):
                    self.combat_reports = []
                self.combat_reports.append(combat_report)
            
            return  # End function for uncontrolled systems
        
        # Normal combat resolution for controlled systems
        # Calculate attacking forces by player
        attacker_forces = {}
        for starfleet in incoming_starfleets:
            owner = starfleet.owner
            if owner not in attacker_forces:
                attacker_forces[owner] = {"starfleets": [], "support": 0}
            attacker_forces[owner]["starfleets"].append(starfleet)
        
        # Calculate support for attackers
        for owner in attacker_forces:
            for starfleet in self.starfleets.values():
                if (starfleet.orders and starfleet.orders.get("type") == "support" and
                    starfleet.owner == owner and starfleet.orders.get("target") == system_id):
                    attacker_forces[owner]["support"] += 1
        
        # Calculate defending forces
        defender_owner = target_system.owner
        defender_strength = len(defending_starfleets)
        
        # Add starport defense if present and not sabotaged (only for controlled systems)
        if (defender_owner and "starport" in target_system.upgrades and 
            not hasattr(target_system, 'sabotaged_upgrades') or
            "starport" not in getattr(target_system, 'sabotaged_upgrades', [])):
            defender_strength += 1
        
        # Add support for defenders (only if system has an owner)
        if defender_owner:
            for starfleet in self.starfleets.values():
                if (starfleet.orders and starfleet.orders.get("type") == "support" and
                    starfleet.owner == defender_owner and starfleet.orders.get("target") == system_id):
                    defender_strength += 1
        
        # Calculate total attacking strength
        total_attacker_strength = 0
        strongest_attacker = None
        max_attacker_strength = 0
        
        for owner, forces in attacker_forces.items():
            owner_strength = len(forces["starfleets"]) + forces["support"]
            total_attacker_strength += owner_strength
            
            if owner_strength > max_attacker_strength:
                max_attacker_strength = owner_strength
                strongest_attacker = owner
        
        # Create detailed combat report
        combat_report = {
            "system": target_system.name,
            "turn": self.current_turn,
            "attackers": {owner: len(forces["starfleets"]) + forces["support"] 
                         for owner, forces in attacker_forces.items()},
            "defenders": defender_strength,
            "outcome": None,
            "casualties": {"attackers": [], "defenders": []}
        }
        
        # Determine combat outcome
        if total_attacker_strength > defender_strength:
            # Attackers win
            combat_report["outcome"] = "attacker_victory"
            
            # Destroy defending starfleets
            for starfleet in defending_starfleets:
                combat_report["casualties"]["defenders"].append(starfleet.id)
                self.destroy_starfleet(starfleet.id)
            
            # Destroy starport if present (unless destabilized)
            if ("starport" in target_system.upgrades and 
                not getattr(target_system, 'destabilized', False)):
                target_system.upgrades.remove("starport")
            
            # Transfer system ownership to strongest attacker
            target_system.owner = strongest_attacker
            
            # Move strongest attacker's starfleets to the system
            for starfleet in incoming_starfleets:
                if starfleet.owner == strongest_attacker:
                    # Move starfleet to new system
                    old_system = self.systems[starfleet.system_id]
                    del old_system.starfleets[starfleet.id]
                    
                    starfleet.system_id = system_id
                    target_system.starfleets[starfleet.id] = starfleet
                else:
                    # Other attackers retreat
                    combat_report["casualties"]["attackers"].append(starfleet.id)
                    self.retreat_starfleet(starfleet)
        
        elif total_attacker_strength == defender_strength:
            # Stalemate - all attacking starfleets retreat
            combat_report["outcome"] = "stalemate"
            for starfleet in incoming_starfleets:
                self.retreat_starfleet(starfleet)
        
        else:
            # Defenders win - attacking starfleets retreat or are destroyed
            combat_report["outcome"] = "defender_victory"
            for starfleet in incoming_starfleets:
                if max_attacker_strength < defender_strength - 1:
                    # Overwhelming defender victory - destroy some attackers
                    combat_report["casualties"]["attackers"].append(starfleet.id)
                    self.destroy_starfleet(starfleet.id)
                else:
                    # Close victory - attackers retreat
                    self.retreat_starfleet(starfleet)
        
        # Store combat report for players to review
        if not hasattr(self, 'combat_reports'):
            self.combat_reports = []
        self.combat_reports.append(combat_report)
        
        # Clear temporary espionage effects
        if hasattr(target_system, 'sabotaged_upgrades'):
            delattr(target_system, 'sabotaged_upgrades')
        if hasattr(target_system, 'destabilized'):
            delattr(target_system, 'destabilized')
        if hasattr(target_system, 'counter_espionage'):
            delattr(target_system, 'counter_espionage')
    
    def retreat_starfleet(self, starfleet: Starfleet):
        """Handle starfleet retreat"""
        # For now, just keep it in current system
        # TODO: Implement proper retreat logic with rally points
        pass
    
    def destroy_starfleet(self, starfleet_id: str):
        """Remove a starfleet from the game"""
        if starfleet_id in self.starfleets:
            starfleet = self.starfleets[starfleet_id]
            
            # Remove from system
            system = self.systems[starfleet.system_id]
            if starfleet_id in system.starfleets:
                del system.starfleets[starfleet_id]
            
            # Remove from global registry
            del self.starfleets[starfleet_id]
    
    def build_phase(self):
        """Phase 4: Build new starfleets and upgrades"""
        for player_id in self.players:
            if player_id in self.player_orders:
                for order in self.player_orders[player_id]:
                    if order.get("type") == "build":
                        self.execute_build_order(player_id, order)
        
        # Clear build orders
        for player_id in self.players:
            self.player_orders[player_id] = []
    
    def execute_build_order(self, player_id: str, order: Dict[str, Any]):
        """Execute a single build order"""
        build_type = order.get("build_type")
        system_id = order.get("system_id")
        
        if system_id not in self.systems:
            return
        
        system = self.systems[system_id]
        if system.owner != player_id:
            return
        
        resources = self.player_resources[player_id]
        
        if build_type == "starfleet":
            # Cost: 1 Tech, 1 Metals, 1 CHON
            if (resources["tech"] >= 1 and resources["metals"] >= 1 and resources["chon"] >= 1 and
                "shipyard" in system.upgrades):
                
                # Pay cost
                resources["tech"] -= 1
                resources["metals"] -= 1
                resources["chon"] -= 1
                
                # Create starfleet
                fleet_id = f"fleet_{player_id}_{len(self.starfleets)}"
                starfleet = Starfleet(fleet_id, player_id, system_id)
                
                system.starfleets[fleet_id] = starfleet
                self.starfleets[fleet_id] = starfleet
        
        elif build_type == "starport":
            # Cost: 2 Tech, 2 Metals, 2 CHON
            if (resources["tech"] >= 2 and resources["metals"] >= 2 and resources["chon"] >= 2 and
                "starport" not in system.upgrades):
                
                resources["tech"] -= 2
                resources["metals"] -= 2
                resources["chon"] -= 2
                system.upgrades.append("starport")
        
        elif build_type == "shipyard":
            # Cost: 3 Tech, 3 Metals, 1 CHON
            if (resources["tech"] >= 3 and resources["metals"] >= 3 and resources["chon"] >= 1 and
                "shipyard" not in system.upgrades):
                
                resources["tech"] -= 3
                resources["metals"] -= 3
                resources["chon"] -= 1
                system.upgrades.append("shipyard")
        
        elif build_type == "colony":
            # Cost: 0 Tech, 2 Metals, 2 CHON
            if (resources["metals"] >= 2 and resources["chon"] >= 2 and
                "colony" not in system.upgrades):
                
                resources["metals"] -= 2
                resources["chon"] -= 2
                system.upgrades.append("colony")
        
        elif build_type == "mining_facilities":
            # Cost: 2 Tech, 2 Metals, 1 CHON
            if (resources["tech"] >= 2 and resources["metals"] >= 2 and resources["chon"] >= 1 and
                "mining_facilities" not in system.upgrades):
                
                resources["tech"] -= 2
                resources["metals"] -= 2
                resources["chon"] -= 1
                system.upgrades.append("mining_facilities")
        
        elif build_type == "wormhole_generator":
            # Cost: 6 Tech, 2 Metals, 0 CHON
            if (resources["tech"] >= 6 and resources["metals"] >= 2 and
                "wormhole_generator" not in system.upgrades):
                
                resources["tech"] -= 6
                resources["metals"] -= 2
                system.upgrades.append("wormhole_generator")
    
    def check_victory_condition(self):
        """Check if any player has won the game"""
        if not self.systems:
            return None
        
        total_systems = len(self.systems)
        required_systems = (total_systems // 2) + 1  # More than 50%
        
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
                    "required_systems": required_systems
                }
        
        return None
    def submit_espionage_orders(self, player_id: str, orders: List[Dict[str, Any]]):
        """Submit espionage orders for a player"""
        if self.phase != "activity":
            raise ValueError("Can only submit espionage orders during activity phase")
        
        resources = self.player_resources[player_id]
        
        for order in orders:
            espionage_type = order.get("espionage_type")
            target_system = order.get("target_system")
            
            # Check if player has enough Tech resources (each espionage costs 1 Tech)
            if resources["tech"] >= 1:
                resources["tech"] -= 1
                
                # Store espionage order for resolution phase
                if player_id not in self.player_orders:
                    self.player_orders[player_id] = []
                
                self.player_orders[player_id].append({
                    "type": "espionage",
                    "espionage_type": espionage_type,
                    "target_system": target_system,
                    "target_player": order.get("target_player")
                })
    
    def resolve_espionage(self):
        """Resolve all espionage actions during resolution phase"""
        for player_id in self.players:
            if player_id in self.player_orders:
                for order in self.player_orders[player_id]:
                    if order.get("type") == "espionage":
                        self.execute_espionage_order(player_id, order)
    
    def execute_espionage_order(self, player_id: str, order: Dict[str, Any]):
        """Execute a single espionage order"""
        espionage_type = order.get("espionage_type")
        target_system_id = order.get("target_system")
        
        if target_system_id not in self.systems:
            return
        
        target_system = self.systems[target_system_id]
        
        # Check if target system is adjacent to a player-owned system
        adjacent_owned = False
        for conn_id in target_system.connections:
            conn_system = self.systems.get(conn_id)
            if conn_system and conn_system.owner == player_id:
                adjacent_owned = True
                break
        
        if not adjacent_owned:
            return
        
        if espionage_type == "sabotage":
            # Sabotage a system upgrade or starfleets
            if target_system.upgrades:
                # Sabotage random upgrade
                upgrade = target_system.upgrades[0]
                # Mark as sabotaged (simplified - just remove temporarily)
                if "sabotaged_upgrades" not in target_system.__dict__:
                    target_system.sabotaged_upgrades = []
                target_system.sabotaged_upgrades.append(upgrade)
            
            elif target_system.starfleets:
                # Sabotage starfleets (prevent their movement)
                for starfleet in target_system.starfleets.values():
                    if starfleet.orders:
                        starfleet.orders = {"type": "hold"}  # Force hold position
        
        elif espionage_type == "destabilize":
            # Prevent system upgrade destruction and starport auto-destruction
            target_system.destabilized = True
        
        elif espionage_type == "counter_espionage":
            # Protect owned system from espionage
            target_system.counter_espionage = True
    
    def submit_build_orders(self, player_id: str, orders: List[Dict[str, Any]]):
        """Submit build orders for a player"""
        if self.phase != "activity":
            raise ValueError("Can only submit build orders during activity phase")
        
        # Store orders for build phase
        if player_id not in self.player_orders:
            self.player_orders[player_id] = []
        
        for order in orders:
            if order.get("type") == "build":
                # Validate the build order
                system_id = order.get("system_id")
                if system_id in self.systems and self.systems[system_id].owner == player_id:
                    self.player_orders[player_id].append(order)
    
    def get_game_state(self, player_id: str = None):
        """Get current game state (optionally filtered for specific player)"""
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
                        {
                            "id": sf.id,
                            "owner": sf.owner,
                            "orders": sf.orders
                        }
                        for sf in s.starfleets.values()
                    ],
                    "upgrades": s.upgrades,
                    "is_home_system": s.is_home_system
                }
                for sid, s in self.systems.items()
            },
            "players": self.players,
            "player_resources": self.player_resources.get(player_id) if player_id else self.player_resources,
            "combat_reports": getattr(self, 'combat_reports', []),
            "victory_status": self.check_victory_condition(),
            "config": {
                "num_players": self.config.num_players,
                "galaxy_size": self.config.galaxy_size
            }
        }

@app.post("/api/create-game")
async def create_game(request: CreateGameRequest):
    """Create a new game instance"""
    game_id = str(uuid.uuid4())
    player_id = str(uuid.uuid4())
    
    # Create game engine
    engine = GameEngine(request.config)
    engine.players.append(player_id)
    
    # Generate galaxy
    engine.generate_galaxy()
    
    # Store game
    games[game_id] = engine
    players[player_id] = {
        "id": player_id,
        "name": request.player_name,
        "game_id": game_id
    }
    
    return {
        "game_id": game_id,
        "player_id": player_id,
        "status": "created"
    }

@app.post("/api/join-game")
async def join_game(request: JoinGameRequest):
    """Join an existing game"""
    if request.game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[request.game_id]
    
    if len(game.players) >= game.config.num_players:
        raise HTTPException(status_code=400, detail="Game is full")
    
    player_id = str(uuid.uuid4())
    game.players.append(player_id)
    
    players[player_id] = {
        "id": player_id,
        "name": request.player_name,
        "game_id": request.game_id
    }
    
    # If game is now full, start it
    if len(game.players) == game.config.num_players:
        game.create_initial_starfleets()
        game.phase = "activity"
    
    return {
        "game_id": request.game_id,
        "player_id": player_id,
        "status": "joined"
    }

@app.post("/api/game/{game_id}/add-ai-players")
async def add_ai_players(game_id: str):
    """Add AI players to a game for testing"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[game_id]
    
    ai_names = ["Admiral Zara", "Commander Vex", "Captain Nova"]
    added_players = []
    
    # Add AI players up to the game limit
    for ai_name in ai_names:
        if len(game.players) >= game.config.num_players:
            break
            
        player_id = str(uuid.uuid4())
        game.players.append(player_id)
        
        players[player_id] = {
            "id": player_id,
            "name": ai_name,
            "game_id": game_id
        }
        added_players.append({"id": player_id, "name": ai_name})
    
    # If game is now full, start it
    if len(game.players) == game.config.num_players:
        game.create_initial_starfleets()
        game.phase = "activity"
    
    return {
        "game_id": game_id,
        "players_added": added_players,
        "total_players": len(game.players),
        "status": "success"
    }

@app.get("/api/game/{game_id}/state")
async def get_game_state(game_id: str, player_id: Optional[str] = None):
    """Get current game state"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[game_id]
    return game.get_game_state(player_id)

@app.get("/api/game/{game_id}/players")
async def get_game_players(game_id: str):
    """Get all players in a game (for testing UI)"""
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
    """Submit starfleet orders for a player"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[game_id]
    player_id = orders_data.get("player_id")
    orders = orders_data.get("orders", [])
    
    try:
        # Convert dict orders to StarfleetOrder objects
        starfleet_orders = []
        for order in orders:
            starfleet_orders.append(StarfleetOrder(**order))
        
        game.submit_starfleet_orders(player_id, starfleet_orders)
        
        return {"status": "orders_submitted", "count": len(orders)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/game/{game_id}/espionage-orders")
async def submit_espionage_orders(game_id: str, espionage_data: Dict[str, Any]):
    """Submit espionage orders for a player"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[game_id]
    player_id = espionage_data.get("player_id")
    orders = espionage_data.get("orders", [])
    
    try:
        game.submit_espionage_orders(player_id, orders)
        return {"status": "espionage_orders_submitted", "count": len(orders)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/game/{game_id}/build-orders")
async def submit_build_orders(game_id: str, build_data: Dict[str, Any]):
    """Submit build orders for a player"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[game_id]
    player_id = build_data.get("player_id")
    orders = build_data.get("orders", [])
    
    try:
        game.submit_build_orders(player_id, orders)
        return {"status": "build_orders_submitted", "count": len(orders)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/game/{game_id}/resolve-turn")
async def resolve_turn(game_id: str):
    """Resolve the current turn (for testing)"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[game_id]
    
    try:
        game.resolve_turn()
        return {"status": "turn_resolved", "new_turn": game.current_turn}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/game/{game_id}/action")
async def submit_action(game_id: str, action: PlayerAction):
    """Submit a player action"""
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[game_id]
    
    # For now, just acknowledge the action
    # TODO: Implement action processing
    
    return {"status": "action_received", "action": action.action_type}

@app.get("/api/games")
async def list_games():
    """List all active games (for development/testing)"""
    return {
        "games": [
            {
                "id": gid,
                "players": len(game.players),
                "max_players": game.config.num_players,
                "phase": game.phase,
                "turn": game.current_turn
            }
            for gid, game in games.items()
        ]
    }

@app.get("/")
async def root():
    return {"message": "Consilium Mundi Game Server", "status": "running"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)