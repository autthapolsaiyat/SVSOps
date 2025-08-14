from pydantic import BaseModel
from typing import Optional

class SessionOut(BaseModel):
    id: str
    created_at: str
    last_seen_at: str
    expires_at: str
    ended_at: Optional[str] = None
    revoked: bool
    ip_addr: Optional[str] = None
    user_agent: Optional[str] = None
    current: bool

class RevokeCountOut(BaseModel):
    revoked: int

