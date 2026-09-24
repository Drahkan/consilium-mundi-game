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

import asyncio
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from kernel_bridge import KernelError, kernel

log = logging.getLogger("kernel_api")

# In-memory match cache (source of truth is Mongo via _dao).
matches: Dict[str, Dict[str, Any]] = {}
player_index: Dict[str, Dict[str, Any]] = {}

# Persistence hook. Set by server.py at startup via set_dao(dao).
_dao = None

# Cached kernel game types (populated lazily on first request).
_game_types_cache: Optional[List[Dict[str, Any]]] = None


def _game_types() -> List[Dict[str, Any]]:
    """Fetch the kernel's canonical game type list. Cached process-wide.

    The cache lives for the lifetime of the FastAPI process. If Grok Build
    hot-swaps cli.mjs without a backend restart, this list can go stale —
    restart the backend after unpacking a new kernel zip.
    """
    global _game_types_cache
    if _game_types_cache is None:
        data = kernel("listGameTypes")
        _game_types_cache = data.get("gameTypes") or []
    return _game_types_cache


def _victory_label(victory_id: Optional[str]) -> Optional[str]:
    if not victory_id:
        return None
    for row in _game_types():
        if row.get("victory") == victory_id:
            return row.get("victoryLabel")
    return None


def set_dao(dao) -> None:
    global _dao
    _dao = dao


HOST_META_KEYS = (
    "started",
    "turn_seconds",
    "turn_due_at",
    "turn_paused",
    "turn_paused_remaining",
    "host_player_id",
)


def _players_index_list(game_id: str) -> List[Dict[str, Any]]:
    return [row for row in player_index.values() if row.get("game_id") == game_id]


def _host_meta(m: Dict[str, Any]) -> Dict[str, Any]:
    return {k: m.get(k) for k in HOST_META_KEYS}


def _persist(game_id: str, m: Dict[str, Any]) -> None:
    """Serialize via CLI and fire-and-forget save to Mongo."""
    if _dao is None:
        return
    try:
        data = kernel("serialize", state=m["engine"])
        blob = data.get("blob") or m["engine"]
    except KernelError as e:
        log.warning("persist: CLI serialize failed for %s: %s", game_id, e)
        return

    async def _do_save():
        try:
            await _dao.save_game(
                game_id,
                blob,
                _players_index_list(game_id),
                host_meta=_host_meta(m),
            )
        except Exception as e:  # noqa: BLE001
            log.error("persist: DAO save_game failed for %s: %s", game_id, e)

    try:
        loop = asyncio.get_running_loop()
        loop.create_task(_do_save())
    except RuntimeError:
        # Called outside a running loop (tests). Do a best-effort sync run.
        asyncio.run(_do_save())


async def _hydrate_from_dao(game_id: str) -> Optional[Dict[str, Any]]:
    if _dao is None:
        return None
    doc = await _dao.load_game(game_id)
    if not doc:
        return None
    blob = doc.get("engine")
    if not blob:
        return None
    try:
        data = kernel("load", blob=blob)
    except KernelError as e:
        log.error("hydrate: CLI load rejected blob for %s: %s", game_id, e)
        return None
    state = data.get("state")
    if not state:
        return None
    host_meta = doc.get("host_meta") or {}
    m: Dict[str, Any] = {
        "engine": state,
        "started": bool(host_meta.get("started")),
        "turn_seconds": int(host_meta.get("turn_seconds") or 300),
        "turn_due_at": host_meta.get("turn_due_at"),
        "turn_paused": bool(host_meta.get("turn_paused") or False),
        "turn_paused_remaining": int(host_meta.get("turn_paused_remaining") or 0),
        "snapshots": [],
        "host_player_id": host_meta.get("host_player_id"),
        "updated_at": _now_ms(),
    }
    matches[game_id] = m
    for row in doc.get("players_index") or []:
        pid = row.get("id")
        if pid:
            player_index[pid] = row
    return m


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
    gid = m["engine"].get("id")
    if gid:
        _persist(gid, m)


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


async def _require_match_async(game_id: str) -> Dict[str, Any]:
    m = matches.get(game_id)
    if m:
        return m
    m = await _hydrate_from_dao(game_id)
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
    view = data["view"]
    # Expose kernel scenario options to the HUD (victory chip, fog toggle, etc.)
    # per ui-reference/GAME_TYPES.md. Do NOT reinterpret rules here.
    opts = (m.get("engine") or {}).get("options") or {}
    if opts:
        kernel_view = view.setdefault("kernel", {})
        kernel_view["options"] = {
            **opts,
            "victoryLabel": _victory_label(opts.get("victory")),
        }
    return view


def mount_kernel(app: FastAPI) -> None:
    """Register kernel-backed routes on the existing FastAPI app."""

    @app.get("/api/game-types")
    async def list_game_types():
        # CLI listGameTypes is the source of truth (id/name/blurb/victory/
        # victoryLabel/playerRange/fogOfWar/uncharted/turnLimit/etc.).
        return {"gameTypes": _game_types()}

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
        _persist(game_id, m)
        return {"game_id": game_id, "player_id": host_id, "status": "created"}

    @app.post("/api/join-game")
    async def join_game(request: JoinGameRequest):
        m = await _require_match_async(request.game_id)
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
        _persist(request.game_id, m)
        return {
            "game_id": request.game_id,
            "player_id": seat["id"],
            "status": "joined",
        }

    @app.post("/api/game/{game_id}/add-ai-players")
    async def add_ai_players(game_id: str):
        m = await _require_match_async(game_id)
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
        m = await _require_match_async(game_id)
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
        m = await _require_match_async(game_id)
        if m.get("started"):
            _maybe_resolve(m)
        return _legacy_view(m, player_id)

    @app.get("/api/game/{game_id}/players")
    async def get_game_players(game_id: str):
        m = await _require_match_async(game_id)
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
        m = await _require_match_async(game_id)
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
        m = await _require_match_async(game_id)
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
        m = await _require_match_async(game_id)
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
        m = await _require_match_async(game_id)
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
        gid = state.get("id")
        if gid:
            _persist(gid, m)
        return {"status": "espionage_orders_submitted"}

    @app.post("/api/game/{game_id}/resolve-turn")
    async def resolve_turn(game_id: str):
        m = await _require_match_async(game_id)
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
        m = await _require_match_async(game_id)
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
        m = await _require_match_async(game_id)
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
        m = await _require_match_async(game_id)
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
        m = await _require_match_async(game_id)
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
        m = await _require_match_async(game_id)
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
        m = await _require_match_async(game_id)
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
        m = await _require_match_async(game_id)
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
        m = await _require_match_async(game_id)
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

    @app.get("/api/game/{game_id}/diplomacy/inbox/{player_id}")
    async def diplomacy_inbox(game_id: str, player_id: str):
        m = await _require_match_async(game_id)
        data = _call("inboxForPlayer", state=m["engine"], viewerId=player_id)
        inbox = data.get("inbox") or {}
        return {
            "pending": inbox.get("pending") or [],
            "incidents": inbox.get("incidents") or [],
            "unsentPacts": inbox.get("unsentPacts") or [],
            "owedDeliveries": inbox.get("owedDeliveries") or [],
            "allyIds": inbox.get("allyIds") or [],
        }

    @app.get("/api/game/{game_id}/diplomacy/frontier")
    async def diplomacy_frontier(game_id: str, player_id: str, to_id: str):
        m = await _require_match_async(game_id)
        data = _call(
            "tradeFrontier",
            state=m["engine"],
            playerId=player_id,
            toId=to_id,
        )
        return {"systemIds": data.get("systemIds") or []}

    @app.post("/api/game/{game_id}/diplomacy/answer-incident")
    async def diplomacy_answer_incident(game_id: str, payload: Dict[str, Any]):
        m = await _require_match_async(game_id)
        _require_active(m)
        kwargs = {
            "state": m["engine"],
            "viewerId": payload.get("player_id"),
            "incidentId": payload.get("incident_id"),
            "action": payload.get("action"),
        }
        if payload.get("unless"):
            kwargs["unless"] = payload["unless"]
        data = _call("answerIncident", **kwargs)
        _save_engine(m, data)
        return {"status": "ok"}

    @app.post("/api/game/{game_id}/diplomacy/deliver-pact")
    async def diplomacy_deliver_pact(game_id: str, payload: Dict[str, Any]):
        m = await _require_match_async(game_id)
        _require_active(m)
        data = _call(
            "deliverPact",
            state=m["engine"],
            playerId=payload.get("player_id"),
            pactId=payload.get("pact_id"),
        )
        _save_engine(m, data)
        return {"status": "ok"}

    @app.get("/api/game/{game_id}/recap")
    async def game_recap(game_id: str, player_id: str):
        # Kernel v4: CLI `recap` returns { turn, previousTurn, phase, result,
        # winnerIds, log, promiseReports, snapshot, snapshotCount } for the
        # given viewer. This does NOT invent a second event log — it is the
        # kernel's own log filtered per player.
        m = await _require_match_async(game_id)
        engine = m.get("engine") or {}
        known_ids = {p.get("id") for p in (engine.get("players") or []) if p.get("id")}
        if player_id not in known_ids:
            raise HTTPException(status_code=404, detail="unknown player_id")
        data = _call("recap", state=engine, viewerId=player_id)
        return data.get("recap") or {}

    @app.get("/api/games")
    async def list_games():
        # Prefer Mongo (survives restart); fall back to in-memory for tests.
        if _dao is not None:
            try:
                rows = await _dao.list_games_info()
                if rows:
                    return {"games": rows}
            except Exception as e:
                log.warning("list_games: DAO failed, falling back: %s", e)
        out = []
        for gid, m in matches.items():
            eng = m.get("engine") or {}
            humans = [p for p in (eng.get("players") or []) if p.get("kind") == "human"]
            out.append(
                {
                    "id": gid,
                    "players": len(humans),
                    "max_players": (eng.get("options") or {}).get("playerCount"),
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
