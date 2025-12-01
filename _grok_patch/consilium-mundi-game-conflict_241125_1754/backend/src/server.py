from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import os
import uuid
import random
import math
from datetime import datetime, timezone
import json
from pathlib
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from persistence import GameDAO

# Load .env
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Persistence (optional Mongo)
MONGO_URL = os.environ.get("MONGO_URL")
_mongo_client = AsyncIOMotorClient(MONGO_URL) if MONGO_URL else None
_db = _mongo_client["consilium_mundi"] if _mongo_client else None
_dao = GameDAO(_db) if _db else None

# In-memory state
games: Dict[str, Any] = {}
players: Dict[str, Any] = {}
lobby_ready: Dict[str, Dict[str, bool]] = {}  # game_id → {player_id: ready}

# ... [your existing classes: GameConfig, PlayerAction, SolarSystem, Starfleet, GameEngine – unchanged] ...

# Your existing endpoints (create-game, join-game, get-state, etc.) remain exactly as they were

# NEW ENDPOINTS ADDED / FIXED

@app.post("/api/game/{game_id}/orders")
async def submit_orders(game_id: str, payload: Dict):
    if game_id not in games and _dao:
        doc = await _dao.load_game(game_id)
        if doc:
            games[game_id] = GameEngine.from_dict(doc["engine"])
            # reload players too
    game = games[game_id]
    player_id = payload["player_id"]
    order_type = payload.get("type")
    orders = payload.get("orders", [])

    if order_type == "movement":
        game.player_orders[player_id] = {"type": "movement", "orders": orders}
    elif order_type == "build":
        game.player_orders[player_id] = {"type": "build", "orders": orders}

    if _dao:
        await _dao.save_game(game_id, game.to_dict(), players_index_for_game(game_id))
    return {"status": "ok"}

@app.post("/api/game/{game_id}/ready")
async def player_ready(game_id: str, payload: Dict):
    if game_id not in games and _dao:
        doc = await _dao.load_game(game_id)
        if doc:
            games[game_id] = GameEngine.from_dict(doc["engine"])
    game = games[game_id]
    player_id = payload["player_id"]
    ready = payload.get("ready", True)
    lobby_ready.setdefault(game_id, {})[player_id] = ready

    # Auto-resolve when everyone ready
    if all(lobby_ready.get(game_id, {}) and
       all(lobby_ready[game_id].get(p, False) for p in game.players)):
        game.resolve_turn()
        lobby_ready[game_id] = {}  # reset for next turn

    if _dao:
        await _dao.save_game(game_id, game.to_dict(), players_index_for_game(game_id))
    return {"status": "ok"}

@app.post("/api/game/{game_id}/resolve")
async def manual_resolve(game_id: str):
    if game_id not in games and _dao:
        doc = await _dao.load_game(game_id)
        if doc:
            games[game_id] = GameEngine.from_dict(doc["engine"])
    game = games[game_id]
    game.resolve_turn()
    if _dao:
        await _dao.save_game(game_id, game.to_dict(), players_index_for_game(game_id))
    return {"status": "turn resolved"}

# Keep the rest of your server.py exactly as it was – only these new endpoints were missing/broken.