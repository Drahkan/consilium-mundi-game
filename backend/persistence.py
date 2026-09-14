"""
MongoDB persistence for Consilium Mundi.

`engine` is the CLI `serialize` blob (the full kernel GameState including
`turnSnapshots`). It is loaded back through CLI `load` — never rehydrated by
hand and never a legacy view.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone


class GameDAO:
    def __init__(self, db):
        self.db = db
        self.coll = db.games if db is not None else None

    async def save_game(
        self,
        game_id: str,
        engine_blob: Dict[str, Any],
        players_index: List[Dict[str, Any]],
        host_meta: Optional[Dict[str, Any]] = None,
    ):
        if self.coll is None:
            return
        doc = {
            "_id": game_id,
            "engine": engine_blob,
            "players_index": players_index,
            "host_meta": host_meta or {},
            "updated_at": datetime.now(tz=timezone.utc).isoformat(),
        }
        await self.coll.replace_one({"_id": game_id}, doc, upsert=True)

    async def load_game(self, game_id: str) -> Optional[Dict[str, Any]]:
        if self.coll is None:
            return None
        return await self.coll.find_one({"_id": game_id})

    async def list_games_info(self) -> List[Dict[str, Any]]:
        if self.coll is None:
            return []
        # Read kernel-shape fields: engine.turn and engine.options.playerCount
        cursor = self.coll.find(
            {},
            {"engine.turn": 1, "engine.options.playerCount": 1, "engine.phase": 1, "engine.players": 1},
        )
        results: List[Dict[str, Any]] = []
        async for doc in cursor:
            eng = doc.get("engine", {}) or {}
            opts = eng.get("options", {}) or {}
            humans = [p for p in (eng.get("players") or []) if p.get("kind") == "human"]
            results.append({
                "id": doc.get("_id"),
                "players": len(humans),
                "max_players": opts.get("playerCount"),
                "phase": eng.get("phase"),
                "turn": eng.get("turn"),
            })
        return results
