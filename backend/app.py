# backend/app.py
import os
from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware

# 1) แอป + CORS
app = FastAPI(title="SVS-Ops API")
origins = [
    "http://localhost:5173", "http://127.0.0.1:5173",
    "http://localhost:8888", "http://127.0.0.1:8888",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2) router หลัก /api
api = APIRouter(prefix="/api")

@api.get("/health")
def health(): return {"ok": True}

@api.get("/")
def api_root(): return {"status": "SVS-Ops backend is up", "scope": "api"}

# 3) รวม routers ย่อย (อยู่หลังประกาศ api เสมอ)
try:
    if os.getenv("DEV_AUTH", "1") == "1":
        from routes.auth import router as auth_router   # stub dev
    else:
        from routes.auth_real import router as auth_router  # auth จริง
    api.include_router(auth_router, prefix="/auth", tags=["auth"])
except Exception:
    pass

try:
    from routes.dashboard import router as dashboard_router
    api.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
except Exception:
    pass

try:
    from routes.admin_users import router as admin_users_router
    api.include_router(admin_users_router, prefix="/admin", tags=["admin"])
except Exception:
    pass

try:
    from routes.admin import router as admin_router
    api.include_router(admin_router, prefix="/admin", tags=["admin"])
except Exception:
    pass

try:
    from routes.inventory import router as inv_router
    api.include_router(inv_router, prefix="/inventory", tags=["inventory"])
except Exception:
    pass

# 4) mount /api
app.include_router(api)

