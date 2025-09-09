from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os, uuid, psycopg2
from psycopg2.extras import RealDictCursor
from passlib.hash import bcrypt

router = APIRouter()

def get_conn():
    url = os.getenv("DATABASE_URL_DOCKER") or os.getenv("DATABASE_URL")
    return psycopg2.connect(url, cursor_factory=RealDictCursor)

class UserCreate(BaseModel):
    username: str
    password: str
    status: str = "active"

class UserUpdate(BaseModel):
    password: str | None = None
    status: str | None = None

@router.get("/users")
def list_users():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT id, username, status FROM users ORDER BY lower(username)")
        return cur.fetchall()

@router.post("/users")
def create_user(body: UserCreate):
    uid = str(uuid.uuid4())
    ph = bcrypt.hash(body.password)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT 1 FROM users WHERE lower(username)=lower(%s)", (body.username,))
        if cur.fetchone():
            raise HTTPException(409, "Username already exists")
        cur.execute(
            "INSERT INTO users (id, username, password_hash, status) VALUES (%s,%s,%s,%s)",
            (uid, body.username, ph, body.status),
        )
        conn.commit()
    return {"id": uid}

@router.patch("/users/{user_id}")
def update_user(user_id: str, body: UserUpdate):
    sets, vals = [], []
    if body.password:
        sets.append("password_hash=%s"); vals.append(bcrypt.hash(body.password))
    if body.status:
        sets.append("status=%s"); vals.append(body.status)
    if not sets:
        return {"ok": True}
    vals.append(user_id)
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(f"UPDATE users SET {', '.join(sets)} WHERE id=%s", vals)
        if cur.rowcount == 0:
            raise HTTPException(404, "User not found")
        conn.commit()
    return {"ok": True}

@router.delete("/users/{user_id}")
def delete_user(user_id: str):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM users WHERE id=%s", (user_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "User not found")
        conn.commit()
    return {"ok": True}
