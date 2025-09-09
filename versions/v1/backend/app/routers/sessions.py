# backend/app/routers/sessions.py
from __future__ import annotations

import uuid
from datetime import timezone, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, insert

from ..database import get_session
from ..deps import require_user
from ..security.jwtauth import get_current_user_and_sid
from ..models import Session as SessionModel, AuditLog
from ..schemas.session import SessionOut, RevokeCountOut

router = APIRouter(prefix="/auth/sessions", tags=["auth"])

def _iso(dt: Optional[datetime]) -> Optional[str]:
    return dt.isoformat() if isinstance(dt, datetime) else None

def _to_out(s: SessionModel, current_sid: uuid.UUID) -> SessionOut:
    ip_str = str(s.ip_addr) if s.ip_addr is not None else None
    ua = s.user_agent if s.user_agent else None
    return SessionOut(
        id=str(s.id),
        created_at=_iso(s.created_at) or "",
        last_seen_at=_iso(s.last_seen_at) or "",
        expires_at=_iso(s.expires_at) or "",
        ended_at=_iso(s.ended_at),
        revoked=bool(getattr(s, "revoked", False)),
        ip_addr=ip_str,
        user_agent=ua,
        current=(s.id == current_sid),
    )

@router.get("", response_model=List[SessionOut])
async def list_my_sessions(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_user),
    user_sid=Depends(get_current_user_and_sid),
):
    _, sid_str = user_sid
    current_sid = uuid.UUID(sid_str)

    rows = (
        await session.execute(
            select(SessionModel)
            .where(SessionModel.user_id == user.id)
            .order_by(SessionModel.created_at.desc())
        )
    ).scalars().all()

    return [_to_out(s, current_sid) for s in rows]

# ---------- ประกาศเส้นคงที่ก่อน! ----------
@router.delete("/others", response_model=RevokeCountOut)
async def revoke_other_sessions(
    session: AsyncSession = Depends(get_session),
    user=Depends(require_user),
    user_sid=Depends(get_current_user_and_sid),
):
    _, sid_str = user_sid
    current_sid = uuid.UUID(sid_str)
    now = datetime.now(timezone.utc)

    result = await session.execute(
        update(SessionModel)
        .where(
            SessionModel.user_id == user.id,
            SessionModel.id != current_sid,
            SessionModel.ended_at.is_(None),
            SessionModel.revoked.is_(False),
        )
        .values(ended_at=now, revoked=True)
        .returning(SessionModel.id)
    )
    revoked_ids = [r[0] for r in result.fetchall()]
    if revoked_ids:
        await session.execute(
            insert(AuditLog).values(actor_id=user.id, action="session.revoke_others")
        )
    await session.commit()
    return {"revoked": len(revoked_ids)}

# ---------- ค่อยตามด้วยเส้นไดนามิก ----------
@router.delete("/{sid}")
async def revoke_session(
    sid: str,
    session: AsyncSession = Depends(get_session),
    user=Depends(require_user),
):
    try:
        sid_uuid = uuid.UUID(sid)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session id")

    target = (
        await session.execute(
            select(SessionModel).where(
                SessionModel.id == sid_uuid, SessionModel.user_id == user.id
            )
        )
    ).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now(timezone.utc)
    await session.execute(
        update(SessionModel)
        .where(SessionModel.id == sid_uuid)
        .values(ended_at=now, revoked=True)
    )
    await session.execute(
        insert(AuditLog).values(actor_id=user.id, action="session.revoke", subject_id=sid_uuid)
    )
    await session.commit()
    return {"ok": True}

