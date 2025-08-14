# backend/app/schemas/auth.py
from pydantic import BaseModel

class LoginIn(BaseModel):
    username: str
    password: str

class MeOut(BaseModel):
    id: str
    username: str
    email: str
    roles: list[str]
    permissions: list[str]

class LoginOut(BaseModel):
    access_token: str
    token_type: str = "bearer"

class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str

