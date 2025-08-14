# backend/app/main.py
from fastapi import FastAPI

from .routers.health import router as health_router
from .routers.auth import router as auth_router
from .routers.admin_users import router as admin_users_router
from .routers.inventory import router as inventory_router
from .routers.sessions import router as sessions_router
from .routers.admin_sessions import router as admin_sessions_router

app = FastAPI(title="SVS-Ops API", version="0.1.0")

# register routers
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(admin_users_router)
app.include_router(inventory_router)
app.include_router(sessions_router)
app.include_router(admin_sessions_router)

