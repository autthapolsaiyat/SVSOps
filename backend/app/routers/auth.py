# backend/app/routers/auth.py
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, or_, func, insert

from ..database import get_session
from ..schemas.auth import LoginIn, LoginOut, MeOut, ChangePasswordIn
from ..security.password import verify_password, hash_password
from ..security.jwtauth import create_access_token, get_current_user_and_sid
from ..models import User, AuditLog, Session as SessionModel
from ..services.rbac_service import get_permissions, get_roles
from ..deps import require_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=LoginOut)
async def login(payload: LoginIn, request: Request, session: AsyncSession = Depends(get_session)):
    # username หรือ email
    user = (await session.execute(
        select(User).where(or_(User.username == payload.username, User.email == payload.username))
    )).scalar_one_or_none()

    if not user or user.status != "active" or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=2)

    # เตะ session เก่าทุกตัวของ user นี้ (single-device rule)
    await session.execute(
        update(SessionModel)
        .where(SessionModel.user_id == user.id, SessionModel.ended_at.is_(None), SessionModel.revoked.is_(False))
        .values(ended_at=now, revoked=True)
    )

    # สร้าง session ใหม่
    sid = uuid.uuid4()
    await session.execute(
        insert(SessionModel).values(
            id=sid,
            user_id=user.id,
            ip_addr=(request.client.host if request.client else None),
            user_agent=request.headers.get("user-agent"),
            last_seen_at=now,
            expires_at=expires_at,
        )
    )

    # อัปเดต last_login + บันทึก audit
    await session.execute(update(User).where(User.id == user.id).values(last_login_at=func.now()))
    await session.execute(insert(AuditLog).values(actor_id=user.id, action="login"))
    await session.commit()

    token = create_access_token(str(user.id), str(sid))

    # ✅ ตั้งค่า session cookie สำหรับ flow ที่ต้อง contextvar
    resp = JSONResponse({"access_token": token, "token_type": "bearer"})
    # dev บน http://localhost:5173 -> secure=False, samesite="lax"
    resp.set_cookie(
        key="svs_session",
        value=str(sid),
        httponly=True,
        secure=False,      # เปลี่ยนเป็น True เมื่อรัน https จริง
        samesite="lax",    # ถ้าอยู่หลัง reverse proxy ข้ามโดเมน ใช้ "none" และต้อง secure=True
        # path="/api" ก็ได้ แต่ปล่อย default "/" ครอบทุกเส้นทางจะง่ายกว่า
    )
    return resp

@router.get("/me", response_model=MeOut)
async def me(session: AsyncSession = Depends(get_session), user: User = Depends(require_user)):
    roles = await get_roles(session, user.id)
    perms = await get_permissions(session, user.id)
    return MeOut(id=str(user.id), username=user.username, email=user.email, roles=roles, permissions=perms)

@router.post("/change-password")
async def change_password(
    payload: ChangePasswordIn,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(require_user),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password too short (min 8 chars)")
    new_hash = hash_password(payload.new_password)
    await session.execute(update(User).where(User.id == user.id).values(password_hash=new_hash))
    await session.execute(insert(AuditLog).values(actor_id=user.id, action="password.change"))
    await session.commit()
    return {"ok": True}

@router.post("/logout")
async def logout(session: AsyncSession = Depends(get_session), user_sid=Depends(get_current_user_and_sid)):
    user_id_str, sid_str = user_sid
    try:
        sid = uuid.UUID(sid_str)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    await session.execute(update(SessionModel).where(SessionModel.id == sid).values(ended_at=func.now(), revoked=True))
    await session.execute(insert(AuditLog).values(action="logout"))
    await session.commit()
    return {"ok": True}

