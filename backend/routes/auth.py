# backend/routes/auth.py
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

router = APIRouter()

class LoginReq(BaseModel):
    username: str
    password: str

@router.post("/login")
def login(body: LoginReq):
    # ⚠️ DEV ONLY: ยอมรับเฉพาะ sysop/test1234 เพื่อเทสต์ UI
    if body.username != "sysop" or body.password != "test1234":
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # ออก token แบบง่าย (dev) แล้วให้ role superadmin ไปเลย
    return {
        "access_token": "dev.sysop",   # token จำลอง
        "token_type": "bearer",
        "expires_in": 7200
    }

@router.get("/me")
def me(authorization: str | None = Header(default=None)):
    # ⚠️ DEV ONLY: ไม่ตรวจ JWT จริง แค่เช็คว่า header มี token
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    token = authorization.split(" ", 1)[1]
    if token != "dev.sysop":
        raise HTTPException(status_code=401, detail="Invalid token")

    # ส่ง role 'superadmin' เพื่อ bypass เมนูทั้งหมด
    return {
        "username": "sysop",
        "roles": ["sysop", "superadmin"],
        "permissions": []  # ไม่จำเป็นถ้า frontend bypass เมื่อเป็น superadmin
    }

