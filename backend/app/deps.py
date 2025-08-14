# backend/app/deps.py
from typing import Annotated
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from .database import get_session
from .security.jwtauth import get_current_user_and_sid, ACCESS_TTL_MIN
from .models import User, Role, Permission, UserRole, RolePermission, Session as SessionModel

SessionDep = Annotated[AsyncSession, Depends(get_session)]

async def require_user(session: SessionDep, user_sid=Depends(get_current_user_and_sid)):
    user_id_str, sid_str = user_sid
    try:
        uid = uuid.UUID(user_id_str)
        sid = uuid.UUID(sid_str)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    s = (await session.execute(
        select(SessionModel).where(SessionModel.id == sid, SessionModel.user_id == uid)
    )).scalar_one_or_none()

    if not s or s.revoked or s.ended_at is not None:
        raise HTTPException(status_code=401, detail="Session expired or revoked")

    now = datetime.now(timezone.utc)
    idle_limit = timedelta(minutes=ACCESS_TTL_MIN)

    last_seen = s.last_seen_at or s.created_at
    # idle timeout: ไม่ใช้งานเกิน 2 ชม. ให้เตะออก
    if (now - last_seen) > idle_limit:
        await session.execute(
            update(SessionModel).where(SessionModel.id == sid).values(ended_at=now, revoked=True)
        )
        await session.commit()
        raise HTTPException(status_code=401, detail="Session idle timeout")

    # absolute expiry เผื่อมี expires_at
    if s.expires_at and s.expires_at < now:
        await session.execute(
            update(SessionModel).where(SessionModel.id == sid).values(ended_at=now, revoked=True)
        )
        await session.commit()
        raise HTTPException(status_code=401, detail="Session expired")

    # touch last_seen ทุกครั้งที่เรียก API
    await session.execute(
        update(SessionModel).where(SessionModel.id == sid).values(last_seen_at=now)
    )
    await session.commit()

    user = (await session.execute(select(User).where(User.id == uid))).scalar_one_or_none()
    if not user or user.status != "active":
        raise HTTPException(status_code=401, detail="User not active")
    return user

def require_perm(code: str):
    async def _inner(session: SessionDep, user=Depends(require_user)):
        q = (
            select(func.count())
            .select_from(UserRole)
            .join(Role, Role.id == UserRole.role_id)
            .join(RolePermission, RolePermission.role_id == Role.id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(UserRole.user_id == user.id, Permission.code == code)
        )
        total = (await session.execute(q)).scalar_one()
        if total == 0:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return _inner

