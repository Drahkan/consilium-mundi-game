"""
Drop-in FastAPI routes that wrap the sealed TypeScript kernel and speak the
JSON shape App.js already uses.

In server.py (after creating `app`):

    from kernel_api import mount_kernel
    mount_kernel(app)

Do not construct GameEngine for new matches. Keep GameEngine in server.py only
as a legacy import for old tests until those are rewritten.
"""
from __future__ import annotations

import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from kernel_bridge import KernelError, kernel

# In-memory matches. persistence.GameDAO can be wired by the host.
matches: Dict[str, Dict[str, Any]] = {}
player_index: Dict[str, Dict[str, Any]] = {}


class CreateGameRequest(BaseModel):
    player_name: str
    config: Dict[str, Any] = {}


class JoinGameRequest(BaseModel):
    player_name: str
    game_id: str


def _now_ms() -> int:
    return int(time.time() * 1000)


def _due(m: Dict[str, Any]) -> Optional[int]:
    if m.get("turn_paused"):
        return None
    return m.get("turn_due_at")


def _reset_deadline(m: Dict[str, Any]) -> None:
    seconds = int(m.get("turn_seconds") or 300)
    if seconds < 30:
        seconds = 30
    m["turn_seconds"] = seconds
    m["turn_due_at"] = _now_ms() + seconds * 1000
    m["turn_paused"] = False
    m["turn_paused_remaining"] = 0


def _save_engine(m: Dict[str, Any], data: Dict[str, Any]) -> None:
    m["engine"] = data["state"]
    m["updated_at"] = _now_ms()


def _call(op: str, **payload: Any) -> Dict[str, Any]:
    try:
        return kernel(op, **payload)
    except KernelError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


def _require_match(game_id: str) -> Dict[str, Any]:
    m = matches.get(game_id)
    if not m:
        raise HTTPException(status_code=404, detail="Game not found")
    return m


def _require_active(m: Dict[str, Any]) -> None:
    eng = m.get("engine") or {}
    if eng.get("phase") == "ended":
        raise HTTPException(status_code=409, detail="Game is over")


def _maybe_resolve(m: Dict[str, Any]) -> None:
    eng = m["engine"]
    due = _due(m) if m.get("started") else None
    data = _call("resolveIfDue", state=eng, turnDueAt=due)
    if data.get("resolved"):
        framed = _call("replayFrame", state=data["state"])
        m.setdefault("snapshots", []).append(framed.get("frame"))
        skipped = _call("skipReport", state=data["state"])
        _save_engine(m, skipped)
        if skipped["state"].get("phase") != "ended":
            _reset_deadline(m)
    else:
        _save_engine(m, data)


def _legacy_view(m: Dict[str, Any], player_id: Optional[str]) -> Dict[str, Any]:
    data = _call(
        "viewLegacy",
        state=m["engine"],
        viewerId=player_id,
        turnDueAt=_due(m),
        turnSeconds=m.get("turn_seconds", 300),
        turnPaused=m.get("turn_paused", False),
        turnPausedRemaining=m.get("turn_paused_remaining", 0),
        started=m.get("started", False),
    )
    return data["view"]


def mount_kernel(app: FastAPI) -> None:
    """Register kernel-backed routes on the existing FastAPI app."""

    @app.post("/api/create-game")
    async def create_game(request: CreateGameRequest):
        cfg = request.config or {}
        data = _call(
            "openMatchLegacy",
            hostName=request.player_name,
            config=cfg,
            seed=str(uuid.uuid4()),
        )
        state = data["state"]
        host_id = state["humanPlayerId"]
        game_id = state["id"]
        m = {
            "engine": state,
            "started": False,
            "turn_seconds": int(cfg.get("turn_time_seconds") or 300),
            "turn_due_at": None,
            "turn_paused": False,
            "turn_paused_remaining": 0,
            "snapshots": [],
            "host_player_id": host_id,
        }
        matches[game_id] = m
        player_index[host_id] = {
            "id": host_id,
            "name": request.player_name,
            "game_id": game_id,
        }
        return {"game_id": game_id, "player_id": host_id, "status": "created"}

    @app.post("/api/join-game")
    async def join_game(request: JoinGameRequest):
        m = _require_match(request.game_id)
        data = _call(
            "claimSeatNamed",
            state=m["engine"],
            name=request.player_name,
            seed=str(uuid.uuid4()),
        )
        _save_engine(m, data)
        seat = data["player"]
        player_index[seat["id"]] = {
            "id": seat["id"],
            "name": request.player_name,
            "game_id": request.game_id,
        }
        humans = [p for p in data["state"]["players"] if p.get("kind") == "human"]
        wanted = data["state"]["options"]["playerCount"]
        if len(humans) >= wanted:
            m["started"] = True
            _reset_deadline(m)
        return {
            "game_id": request.game_id,
            "player_id": seat["id"],
            "status": "joined",
        }

    @app.post("/api/game/{game_id}/add-ai-players")
    async def add_ai_players(game_id: str):
        m = _require_match(game_id)
        state = m["engine"]
        ais = [p for p in state["players"] if p.get("kind") == "ai"]
        added = [{"id": p["id"], "name": p.get("name") or p.get("civ", {}).get("name")} for p in ais]
        return {
            "game_id": game_id,
            "players_added": added,
            "total_players": len(state["players"]),
            "status": "success",
        }

    @app.post("/api/game/{game_id}/start")
    async def start_game(game_id: str, payload: Optional[Dict[str, Any]] = None):
        m = _require_match(game_id)
        if m.get("started"):
            return {"status": "already_started", "game_id": game_id, "phase": "activity"}
        m["started"] = True
        _reset_deadline(m)
        return {
            "status": "started",
            "game_id": game_id,
            "phase": "activity",
            "player_count": len(m["engine"]["players"]),
        }

    @app.get("/api/game/{game_id}/state")
    async def get_game_state(game_id: str, player_id: Optional[str] = None):
        m = _require_match(game_id)
        if m.get("started"):
            _maybe_resolve(m)
        return _legacy_view(m, player_id)

    @app.get("/api/game/{game_id}/players")
    async def get_game_players(game_id: str):
        m = _require_match(game_id)
        out = []
        for p in m["engine"]["players"]:
            row = player_index.get(p["id"])
            if row:
                out.append(row)
            else:
                out.append(
                    {
                        "id": p["id"],
                        "name": p.get("name") or p.get("civ", {}).get("name"),
                        "game_id": game_id,
                    }
                )
        return {"players": out}

    @app.get("/api/game/{game_id}/replay")
    async def get_game_replay(game_id: str):
        m = _require_match(game_id)
        meta = []
        for p in m["engine"]["players"]:
            row = player_index.get(p["id"])
            meta.append(
                {
                    "id": p["id"],
                    "name": (row or {}).get("name") or p.get("name") or p["id"][:8],
                }
            )
        return {
            "game_id": game_id,
            "players": meta,
            "snapshots": m.get("snapshots") or [],
        }

    @app.post("/api/game/{game_id}/orders")
    async def submit_orders(game_id: str, payload: Dict[str, Any]):
        m = _require_match(game_id)
        _require_active(m)
        data = _call(
            "applyLegacyFleetOrders",
            state=m["engine"],
            playerId=payload.get("player_id"),
            orders=payload.get("orders") or [],
        )
        _save_engine(m, data)
        return {"status": "ok"}

    @app.post("/api/game/{game_id}/build-orders")
    async def submit_build_orders(game_id: str, build_data: Dict[str, Any]):
        m = _require_match(game_id)
        _require_active(m)
        data = _call(
            "applyLegacyBuildOrders",
            state=m["engine"],
            playerId=build_data.get("player_id"),
            orders=build_data.get("orders") or [],
        )
        _save_engine(m, data)
        return {"status": "build_orders_submitted", "count": len(build_data.get("orders") or [])}

    @app.post("/api/game/{game_id}/espionage-orders")
    async def submit_espionage_orders(game_id: str, espionage_data: Dict[str, Any]):
        m = _require_match(game_id)
        _require_active(m)
        player_id = espionage_data.get("player_id")
        state = m["engine"]
        for order in espionage_data.get("orders") or []:
            kind = order.get("espionage_type") or order.get("kind") or "sabotage"
            if kind == "counter_espionage":
                kind = "counter"
            data = _call(
                "applyEspionage",
                state=state,
                espionage={
                    "id": "",
                    "playerId": player_id,
                    "kind": kind,
                    "systemId": order.get("system_id") or order.get("systemId"),
                    "otherPlayerId": order.get("other_player_id"),
                    "thirdPlayerId": order.get("third_player_id"),
                },
            )
            state = data["state"]
        m["engine"] = state
        return {"status": "espionage_orders_submitted"}

    @app.post("/api/game/{game_id}/resolve-turn")
    async def resolve_turn(game_id: str):
        m = _require_match(game_id)
        _require_active(m)
        data = _call("resolveIfDue", state=m["engine"], turnDueAt=0)
        framed = _call("replayFrame", state=data["state"])
        m.setdefault("snapshots", []).append(framed.get("frame"))
        skipped = _call("skipReport", state=data["state"])
        _save_engine(m, skipped)
        if skipped["state"].get("phase") != "ended":
            _reset_deadline(m)
        return {"status": "turn_resolved", "new_turn": skipped["state"].get("turn")}

    @app.post("/api/game/{game_id}/timer")
    async def control_timer(game_id: str, payload: Dict[str, Any]):
        m = _require_match(game_id)
        action = (payload or {}).get("action")
        extra = int((payload or {}).get("seconds") or 120)
        if action == "pause" and not m.get("turn_paused"):
            left = max(0, (m.get("turn_due_at") or _now_ms()) - _now_ms())
            m["turn_paused"] = True
            m["turn_paused_remaining"] = left // 1000
            m["turn_due_at"] = None
        elif action == "resume" and m.get("turn_paused"):
            m["turn_paused"] = False
            m["turn_due_at"] = _now_ms() + int(m.get("turn_paused_remaining") or 0) * 1000
        elif action == "extend":
            if m.get("turn_paused"):
                m["turn_paused_remaining"] = int(m.get("turn_paused_remaining") or 0) + extra
            else:
                m["turn_due_at"] = (m.get("turn_due_at") or _now_ms()) + extra * 1000
        return {"status": "ok", "turn_deadline": m.get("turn_due_at")}

    @app.post("/api/game/{game_id}/ready")
    async def player_ready(game_id: str, payload: Dict[str, Any]):
        m = _require_match(game_id)
        _require_active(m)
        player_id = payload.get("player_id")
        ready = payload.get("ready", True)
        op = "markReady" if ready else "markUnready"
        data = _call(op, state=m["engine"], playerId=player_id)
        _save_engine(m, data)
        if ready:
            _maybe_resolve(m)
        return {"status": "ok"}

    @app.post("/api/game/{game_id}/starfleets/{starfleet_id}/rally")
    async def set_rally(game_id: str, starfleet_id: str, payload: Dict[str, Any]):
        m = _require_match(game_id)
        _require_active(m)
        data = _call(
            "applyLegacyRally",
            state=m["engine"],
            playerId=payload.get("player_id"),
            fleetId=starfleet_id,
            rallySystemId=payload.get("rally_system_id"),
        )
        _save_engine(m, data)
        return {"status": "ok"}

    @app.post("/api/game/{game_id}/diplomacy/send")
    async def diplomacy_send(game_id: str, payload: Dict[str, Any]):
        m = _require_match(game_id)
        _require_active(m)
        args = {
            "fromId": payload.get("player_id"),
            "toId": payload.get("to_id"),
            "topic": payload.get("topic") or "trade",
            "attitude": payload.get("attitude") or "neutral",
        }
        if payload.get("system_id"):
            args["systemId"] = payload["system_id"]
        if payload.get("neighbor_id"):
            args["neighborId"] = payload["neighbor_id"]
        if payload.get("about_player_id"):
            args["aboutPlayerId"] = payload["about_player_id"]
        if payload.get("thread_id"):
            args["threadId"] = payload["thread_id"]
        if payload.get("terms") is not None:
            args["terms"] = payload["terms"]
        data = _call("sendDispatch", state=m["engine"], args=args)
        _save_engine(m, data)
        thread = data.get("thread") or {}
        return {"status": "ok", "thread_id": thread.get("id")}

    @app.post("/api/game/{game_id}/diplomacy/accept")
    async def diplomacy_accept(game_id: str, payload: Dict[str, Any]):
        m = _require_match(game_id)
        _require_active(m)
        data = _call(
            "acceptDispatch",
            state=m["engine"],
            viewerId=payload.get("player_id"),
            messageId=payload.get("message_id"),
        )
        _save_engine(m, data)
        return {"status": "ok"}

    @app.post("/api/game/{game_id}/diplomacy/decline")
    async def diplomacy_decline(game_id: str, payload: Dict[str, Any]):
        m = _require_match(game_id)
        _require_active(m)
        data = _call(
            "declineDispatch",
            state=m["engine"],
            viewerId=payload.get("player_id"),
            messageId=payload.get("message_id"),
        )
        _save_engine(m, data)
        return {"status": "ok"}

    @app.post("/api/game/{game_id}/diplomacy/counter")
    async def diplomacy_counter(game_id: str, payload: Dict[str, Any]):
        m = _require_match(game_id)
        _require_active(m)
        data = _call(
            "counterDispatch",
            state=m["engine"],
            viewerId=payload.get("player_id"),
            messageId=payload.get("message_id"),
            terms=payload.get("terms") or {},
        )
        _save_engine(m, data)
        return {"status": "ok"}

    @app.post("/api/game/{game_id}/diplomacy/denounce")
    async def diplomacy_denounce(game_id: str, payload: Dict[str, Any]):
        m = _require_match(game_id)
        _require_active(m)
        data = _call(
            "denounce",
            state=m["engine"],
            playerId=payload.get("player_id"),
            toId=payload.get("to_id"),
            reason=payload.get("reason"),
        )
        _save_engine(m, data)
        return {"status": "ok"}

    @app.get("/api/games")
    async def list_games():
        out = []
        for gid, m in matches.items():
            eng = m.get("engine") or {}
            out.append(
                {
                    "id": gid,
                    "players": len(eng.get("players") or []),
                    "phase": eng.get("phase"),
                    "turn": eng.get("turn"),
                }
            )
        return {"games": out}

    @app.get("/")
    async def root():
        return {
            "message": "Consilium Mundi Game Server",
            "status": "running",
            "resolver": "consilium-kernel",
            "kernel_node": os.environ.get("KERNEL_NODE", "node"),
        }
