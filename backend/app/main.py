# backend/app/main.py
from __future__ import annotations

import os
import asyncio
import sqlalchemy as sa
from fastapi import FastAPI, HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import create_async_engine

# === Import Routers ===
from .routers.health import router as health_router
from .routers.auth import router as auth_router
from .routers.admin_users import router as admin_users_router
from .routers.inventory import router as inventory_router
from .routers.sessions import router as sessions_router
from .routers.admin_sessions import router as admin_sessions_router
from .routers.reports import router as reports_router

API_PREFIX = "/api"

# === FastAPI app (docs & openapi under /api) ===
app = FastAPI(
    title="SVS-Ops API",
    version="0.1.0",
    docs_url=f"{API_PREFIX}/docs",
    redoc_url=None,
    openapi_url=f"{API_PREFIX}/openapi.json",
)

# === CORS (ปรับ origin ตามที่ใช้จริง) ===
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8888",
        "http://127.0.0.1:8888",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Database readiness check ===
DATABASE_URL = os.environ.get("DATABASE_URL")
_engine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True) if DATABASE_URL else None

# System router for liveness/readiness under /api/*
sys_router = APIRouter()

@sys_router.get("/health")
def health():
    return {"ok": True}

@sys_router.get("/ready")
async def ready():
    if not _engine:
        raise HTTPException(status_code=503, detail="DATABASE_URL not set")
    try:
        async with _engine.connect() as conn:
            await asyncio.wait_for(conn.execute(sa.text("select 1")), timeout=3.0)
        return {"ready": True}
    except asyncio.TimeoutError:
        raise HTTPException(status_code=503, detail="DB ping timed out")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"DB not ready: {type(e).__name__}: {e}")

# === Register routers under /api prefix ===
app.include_router(sys_router,             prefix=API_PREFIX)  # /api/health, /api/ready
app.include_router(health_router,          prefix=API_PREFIX)  # ถ้าไฟล์นี้มี endpoint เพิ่มเติม
app.include_router(auth_router,            prefix=API_PREFIX)
app.include_router(admin_users_router,     prefix=API_PREFIX)
app.include_router(inventory_router,       prefix=API_PREFIX)
app.include_router(sessions_router,        prefix=API_PREFIX)
app.include_router(admin_sessions_router,  prefix=API_PREFIX)
app.include_router(reports_router,         prefix=API_PREFIX)

