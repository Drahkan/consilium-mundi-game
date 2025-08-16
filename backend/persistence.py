"""
Lightweight MongoDB persistence layer for Consilium Mundi.
- Uses UUID string IDs (no ObjectId in JSON)
- Stores entire GameEngine snapshot per game in `games` collection
- Provides lazy load on-demand when a game_id is requested but not in memory

NOTE: This module intentionally avoids any URL/port hardcoding.
It expects the caller to construct the AsyncIOMotorClient with os.environ['MONGO_URL'] and pass a DB handle.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

class GameDAO:
    def __init__(self, db):
        self.db = db
        self.coll = db.games if db else None

    async def save_game(self, game_id: str, engine_dict: Dict[str, Any], players_index: List[Dict[str, Any]]):
        if not self.coll:
            return
        doc = {
            "_id": game_id,
            "engine": engine_dict,
            "players_index": players_index,
            "updated_at": datetime.now(tz=timezone.utc).isoformat(),
        }
        await self.coll.replace_one({"_id": game_id}, doc, upsert=True)

    async def load_game(self, game_id: str) -> Optional[Dict[str, Any]]:
        if not self.coll:
            return None
        return await self.coll.find_one({"_id": game_id})

    async def list_games_info(self) -> List[Dict[str, Any]]:
        if not self.coll:
            return []
        cursor = self.coll.find({}, {"engine.current_turn": 1, "engine.phase": 1, "engine.config.num_players": 1})
        results: List[Dict[str, Any]] = []
        async for doc in cursor:
            eng = doc.get("engine", {})
            results.append({
                "id": doc.get("_id"),
                "players": len(eng.get("players", [])),
                "max_players": (eng.get("config", {}) or {}).get("num_players"),
                "phase": eng.get("phase"),
                "turn": eng.get("current_turn"),
            })
        return results