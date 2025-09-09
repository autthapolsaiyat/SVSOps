# backend/app/routers/admin_sessions.py
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, or_, insert

from ..database import get_session
from ..deps import require_perm
from ..models import User, Session as SessionModel, AuditLog
from ..schemas.session import SessionOut

router = APIRouter(prefix="/admin/sessions", tags=["admin-sessions"])

def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if isinstance(dt, datetime) else None

def _to_out(s: SessionModel, current_sid: Optional[uuid.UUID] = None) -> SessionOut:
    return SessionOut(
        id=str(s.id),
        created_at=_iso(s.created_at) or "",
        last_seen_at=_iso(s.last_seen_at) or "",
        expires_at=_iso(s.expires_at) or "",
        ended_at=_iso(s.ended_at),
        revoked=bool(getattr(s, "revoked", False)),
        ip_addr=(str(s.ip_addr) if s.ip_addr is not None else None),
        user_agent=(s.user_agent if s.user_agent else None),
        current=(current_sid is not None and s.id == current_sid),
    )

# GET /admin/sessions?q=<username|email>  (ต้องมี perm: session:manage)
@router.get("", response_model=List[SessionOut], dependencies=[Depends(require_perm("session:manage"))])
async def list_user_sessions(
    q: str = Query(..., description="username หรือ email ของผู้ใช้"),
    session: AsyncSession = Depends(get_session),
):
    user = (await session.execute(
        select(User).where(or_(User.username == q, User.email == q))
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    rows = (await session.execute(
        select(SessionModel)
        .where(SessionModel.user_id == user.id)
        .order_by(SessionModel.created_at.desc())
    )).scalars().all()

    return [_to_out(s) for s in rows]

# DELETE /admin/sessions/{sid}  (revoke session เดี่ยว)
@router.delete("/{sid}", dependencies=[Depends(require_perm("session:manage"))])
async def admin_revoke_session(
    sid: str,
    session: AsyncSession = Depends(get_session),
):
    try:
        sid_uuid = uuid.UUID(sid)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session id")

    target = (await session.execute(
        select(SessionModel).where(SessionModel.id == sid_uuid)
    )).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now(timezone.utc)
    await session.execute(
        update(SessionModel).where(SessionModel.id == sid_uuid).values(ended_at=now, revoked=True)
    )
    await session.execute(insert(AuditLog).values(action="admin.session.revoke", subject_id=sid_uuid))
    await session.commit()
    return {"ok": True}

# DELETE /admin/sessions/user/{q} (revoke ทุกเซสชันของผู้ใช้)
@router.delete("/user/{q}", dependencies=[Depends(require_perm("session:manage"))])
async def admin_revoke_user_sessions(
    q: str,
    session: AsyncSession = Depends(get_session),
):
    user = (await session.execute(
        select(User).where(or_(User.username == q, User.email == q))
    )).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    now = datetime.now(timezone.utc)
    await session.execute(
        update(SessionModel)
        .where(SessionModel.user_id == user.id, SessionModel.ended_at.is_(None), SessionModel.revoked.is_(False))
        .values(ended_at=now, revoked=True)
    )
    await session.execute(insert(AuditLog).values(action="admin.session.revoke_all", subject_id=user.id))
    await session.commit()
    return {"ok": True}

