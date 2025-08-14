from pydantic import BaseModel
from typing import List

class UserCreate(BaseModel):
    # ถ้าต้องการบังคับรูปแบบอีเมลแบบเข้ม ให้ใช้ EmailStr; แต่เพื่อรองรับโดเมนภายใน ใช้ str
    email: str
    username: str
    password: str
    roles: List[str] = []  # role names

class UserOut(BaseModel):
    id: str
    email: str
    username: str
    status: str
    roles: list[str]

