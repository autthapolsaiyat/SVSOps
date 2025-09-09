# backend/routes/auth_real.py
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from jose import jwt, JWTError
from passlib.hash import bcrypt
import os, time, psycopg2
from psycopg2.extras import RealDictCursor

router = APIRouter()

JWT_ALG = "HS256"
ACCESS_TTL_MIN = int(os.getenv("ACCESS_TTL_MIN", "120"))

def _secret() -> str:
    return os.getenv("JWT_SECRET", "dev-secret")

def get_conn():
    url = os.getenv("DATABASE_URL_DOCKER") or os.getenv("DATABASE_URL")
    return psycopg2.connect(url, cursor_factory=RealDictCursor)

def _user_perms_by_username(username: str):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT id, username FROM users WHERE lower(username)=lower(%s)", (username,))
        u = cur.fetchone()
        if not u:
            raise HTTPException(404, "User not found")

        # ดึงรายการ permission name ของผู้ใช้ (ผ่าน role → role_permissions → permissions)
        cur.execute("""
          SELECT DISTINCT p.name
          FROM user_roles ur
          JOIN role_permissions rp ON rp.role_id = ur.role_id
          JOIN permissions p ON p.id = rp.permission_id
          WHERE ur.user_id = %s
          ORDER BY p.name
        """, (u["id"],))
        perms = [row["name"] for row in cur.fetchall()]
    return u, perms

class LoginReq(BaseModel):
    username: str
    password: str

@router.post("/login")
def login(body: LoginReq):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("""
          SELECT id, username, password_hash, status
          FROM users WHERE lower(username)=lower(%s)
        """, (body.username,))
        u = cur.fetchone()
        if not u or u["status"] != "active":
            raise HTTPException(401, "Invalid credentials")
        if not bcrypt.verify(body.password, u["password_hash"]):
            raise HTTPException(401, "Invalid credentials")

        # ดึง roles
        cur.execute("""
          SELECT r.name FROM user_roles ur
          JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = %s
        """, (u["id"],))
        roles = [row["name"] for row in cur.fetchall()]

        # ดึง perms (permission name) ของผู้ใช้
        cur.execute("""
          SELECT DISTINCT p.name
          FROM user_roles ur
          JOIN role_permissions rp ON rp.role_id = ur.role_id
          JOIN permissions p ON p.id = rp.permission_id
          WHERE ur.user_id = %s
          ORDER BY p.name
        """, (u["id"],))
        perms = [row["name"] for row in cur.fetchall()]

    now_ts = int(time.time())
    exp_ts = now_ts + ACCESS_TTL_MIN * 60
    payload = {"sub": u["username"], "roles": roles, "iat": now_ts, "exp": exp_ts}
    token = jwt.encode(payload, _secret(), algorithm=JWT_ALG)

    # ✅ ส่งรูปแบบที่ UI เดิมคาด: มี user และ user.perms
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": ACCESS_TTL_MIN * 60,
        "roles": roles,
        "perms": perms,  # เผื่อบางจุดอ่าน perms บน top-level
        "user": {
            "id": u["id"],
            "username": u["username"],
            "perms": perms,  # ✅ ที่ UI ใช้อยู่: res.user.perms
        },
    }

def _decode(authz: str | None):
    if not authz or not authz.lower().startswith("bearer "):
        raise HTTPException(401, "Missing token")
    token = authz.split(" ", 1)[1].strip()
    try:
        return jwt.decode(token, _secret(), algorithms=[JWT_ALG])
    except Exception:
        raise HTTPException(401, "Invalid token")

@router.get("/me")
def me(authorization: str | None = Header(default=None)):
    p = _decode(authorization)
    u, perms = _user_perms_by_username(p["sub"])  # หยิบ id และ perms จาก DB
    # ✅ รองรับได้ทั้งรูปแบบใหม่/เก่า
    return {
        "ok": True,
        "username": p["sub"],
        "roles": p.get("roles", []),
        "permissions": perms,                # ชื่อใหม่
        "perms": perms,                      # ชื่อเก่า (ยังคงไว้ให้ UI เดิม)
        "user": {"id": u["id"], "username": u["username"]},
    }

