from __future__ import annotations
import os
from functools import lru_cache
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

@lru_cache(maxsize=1)
def get_engine() -> AsyncEngine:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL not set")
    return create_async_engine(url, echo=False, pool_pre_ping=True)
