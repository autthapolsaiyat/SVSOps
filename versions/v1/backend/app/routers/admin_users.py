from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, delete, update
from ..database import get_session
from ..schemas.user import UserCreate, UserOut
from ..models import User, Role, Permission, UserRole
from ..security.password import hash_password
from ..deps import require_perm

router = APIRouter(prefix="/admin/users", tags=["admin-users"])

@router.get("", response_model=list[UserOut], dependencies=[Depends(require_perm("user:view"))])
async def list_users(session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(User))
    users = result.scalars().all()
    out = []
    for u in users:
        roles_q = await session.execute(select(Role.name).join(UserRole, UserRole.role_id == Role.id).where(UserRole.user_id == u.id))
        roles = sorted(set(roles_q.scalars().all()))
        out.append(UserOut(id=str(u.id), email=u.email, username=u.username, status=u.status, roles=roles))
    return out

@router.post("", dependencies=[Depends(require_perm("user:create"))])
async def create_user(payload: UserCreate, session: AsyncSession = Depends(get_session)):
    # check dup
    if (await session.execute(select(User).where((User.username==payload.username) | (User.email==payload.email)))).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username or email already exists")
    hashed = hash_password(payload.password)
    res = await session.execute(insert(User).values(email=payload.email, username=payload.username, password_hash=hashed, status="active").returning(User.id))
    user_id = res.scalar_one()
    # assign roles by name
    if payload.roles:
        roles = (await session.execute(select(Role).where(Role.name.in_(payload.roles)))).scalars().all()
        for r in roles:
            await session.execute(insert(UserRole).values(user_id=user_id, role_id=r.id))
    await session.commit()
    return {"id": str(user_id)}

