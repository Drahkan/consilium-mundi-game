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

# Galaxy Generation Classes
class SolarSystem:
    def __init__(self, id: str, name: str, x: float, y: float):
        self.id = id
        self.name = name
        self.x = x
        self.y = y
        self.owner = None
        self.starfleets = []
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

class GameEngine:
    def __init__(self, config: GameConfig):
        self.config = config
        self.systems = {}
        self.players = []
        self.current_turn = 1
        self.phase = "setup"  # setup, resource, upkeep, activity, resolution, trade, build
        self.turn_deadline = None
        
    def generate_galaxy(self):
        """Generate a balanced galaxy map with interconnected solar systems"""
        num_players = self.config.num_players
        systems_per_player = 8
        total_systems = num_players * systems_per_player + 1
        
        # Generate system positions in a circular pattern for balance
        systems = []
        center_x, center_y = 400, 300  # Center of the galaxy
        
        # Create home systems first - evenly spaced around a circle
        home_radius = 150
        home_systems = []
        for i in range(num_players):
            angle = (2 * math.pi * i) / num_players
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
            systems.append(system)
        
        # Generate remaining systems in rings around the galaxy
        remaining_systems = total_systems - num_players
        for i in range(remaining_systems):
            # Distribute in rings of varying radius
            ring = (i % 3) + 1  # 3 rings
            radius = 80 + (ring * 60)
            angle = random.uniform(0, 2 * math.pi)
            
            # Add some randomness to avoid perfect circles
            radius += random.uniform(-20, 20)
            x = center_x + radius * math.cos(angle)
            y = center_y + radius * math.sin(angle)
            
            system = SolarSystem(
                id=f"system_{i}",
                name=f"System {i+1}",
                x=x,
                y=y
            )
            
            # Generate random resources based on the design doc percentages
            resource_roll = random.random()
            if resource_roll < 0.15:  # 15% no resources
                system.resources = {"tech": 0, "metals": 0, "chon": 0}
            elif resource_roll < 0.40:  # 25% only CHON
                system.resources = {"tech": 0, "metals": 0, "chon": 1}
            elif resource_roll < 0.65:  # 25% only Metals
                system.resources = {"tech": 0, "metals": 1, "chon": 0}
            elif resource_roll < 0.85:  # 20% both
                system.resources = {"tech": 0, "metals": 1, "chon": 1}
            elif resource_roll < 0.90:  # 5% Metals + 2 CHON
                system.resources = {"tech": 0, "metals": 1, "chon": 2}
            elif resource_roll < 0.95:  # 5% 2 Metals + CHON
                system.resources = {"tech": 0, "metals": 2, "chon": 1}
            else:  # 5% 2 Metals + 2 CHON
                system.resources = {"tech": 0, "metals": 2, "chon": 2}
            
            systems.append(system)
        
        # Generate connections (wormholes) between systems
        self.generate_connections(systems)
        
        # Store systems
        for system in systems:
            self.systems[system.id] = system
    
    def generate_connections(self, systems):
        """Generate wormhole connections between systems"""
        # Create a distance matrix
        distances = {}
        for i, sys1 in enumerate(systems):
            for j, sys2 in enumerate(systems):
                if i != j:
                    dist = math.sqrt((sys1.x - sys2.x)**2 + (sys1.y - sys2.y)**2)
                    distances[(sys1.id, sys2.id)] = dist
        
        # Connect each system to its nearest neighbors
        for system in systems:
            # Find nearest systems
            nearest = sorted(
                [s for s in systems if s.id != system.id],
                key=lambda s: distances[(system.id, s.id)]
            )
            
            # Home systems connect to 4 others, regular systems 3-5
            if system.is_home_system:
                target_connections = 4
            else:
                target_connections = random.randint(3, 5)
            
            # Connect to nearest systems
            for neighbor in nearest[:target_connections]:
                if neighbor.id not in system.connections:
                    system.connections.append(neighbor.id)
                    # Make connections bidirectional
                    if system.id not in neighbor.connections:
                        neighbor.connections.append(system.id)
    
    def create_initial_starfleets(self):
        """Create starting starfleets for each player"""
        home_systems = [s for s in self.systems.values() if s.is_home_system]
        
        for i, player_id in enumerate(self.players):
            if i < len(home_systems):
                home_system = home_systems[i]
                home_system.owner = player_id
                
                # Create initial starfleet
                starfleet = Starfleet(
                    id=f"fleet_{player_id}_0",
                    owner=player_id,
                    system_id=home_system.id
                )
                home_system.starfleets.append(starfleet.id)
    
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
                    "upgrades": s.upgrades,
                    "is_home_system": s.is_home_system
                }
                for sid, s in self.systems.items()
            },
            "players": self.players,
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