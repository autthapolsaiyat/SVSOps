# FILE: backend/app/routers/debug.py
from __future__ import annotations
from fastapi import APIRouter, Body, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from collections import deque
import asyncio, json, time
from typing import AsyncGenerator, Dict, Any

router = APIRouter()

# in-memory log store
MAX_LOGS = 1000
LOGS: "deque[dict]" = deque(maxlen=MAX_LOGS)

# sse subscribers
SUBSCRIBERS: "set[asyncio.Queue]" = set()

class DebugEntry(BaseModel):
    ts: float | None = None
    level: str = "info"     # info|warn|error|debug|net
    source: str = "fe"      # fe|be|net
    message: str
    data: Dict[str, Any] | None = None
    context: Dict[str, Any] | None = None

def _broadcast(obj: dict):
    for q in list(SUBSCRIBERS):
        try:
            q.put_nowait(obj)
        except Exception:
            pass

@router.get("/debug/ping")
async def debug_ping():
    return {"ok": True, "server_time": time.time(), "count": len(LOGS)}

@router.post("/debug/log")
async def debug_log(entry: DebugEntry):
    obj = entry.dict()
    if not obj.get("ts"):
        obj["ts"] = time.time()
    LOGS.append(obj)
    _broadcast(obj)
    return {"ok": True}

@router.get("/debug/logs")
async def debug_logs(limit: int = 200):
    limit = max(1, min(limit, MAX_LOGS))
    return list(LOGS)[-limit:]

@router.post("/debug/flush")
async def debug_flush():
    LOGS.clear()
    _broadcast({"ts": time.time(), "level": "info", "source": "be", "message": "__flush__"})
    return {"ok": True}

async def _event_stream(q: asyncio.Queue) -> AsyncGenerator[bytes, None]:
    try:
        while True:
            item = await q.get()
            payload = json.dumps(item, ensure_ascii=False)
            yield f"data: {payload}\n\n".encode("utf-8")
    finally:
        pass

@router.get("/debug/stream")
async def debug_stream(request: Request):
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    SUBSCRIBERS.add(q)
    # push a hello event
    try:
        q.put_nowait({"ts": time.time(), "level": "info", "source": "be", "message": "__hello__"})
    except Exception:
        pass

    async def generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                async for chunk in _event_stream(q):
                    yield chunk
        finally:
            SUBSCRIBERS.discard(q)

    return StreamingResponse(generator(), media_type="text/event-stream")

