# backend/app/security/jwtauth.py
import os
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from fastapi import HTTPException, status, Request
from pydantic import BaseModel

JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE_ME")
JWT_ALGO = "HS256"
# อายุโทเคน 2 ชั่วโมง
ACCESS_TTL_MIN = int(os.getenv("ACCESS_TTL_MIN", "120"))

class TokenPair(BaseModel):
    access_token: str
    token_type: str = "bearer"

def create_access_token(sub: str, sid: str) -> str:
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub": sub,
        "sid": sid,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ACCESS_TTL_MIN)).timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def get_current_user_and_sid(request: Request) -> tuple[str, str]:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = auth.split(" ", 1)[1]
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        sub = data.get("sub")
        sid = data.get("sid")
        if not sub or not sid:
            raise HTTPException(status_code=401, detail="Invalid token")
        return sub, sid
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

# backward compatible (บางที่ยังเรียกอยู่)
async def get_current_user_id(request: Request) -> str:
    sub, _ = await get_current_user_and_sid(request)
    return sub

