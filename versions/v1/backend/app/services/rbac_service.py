from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ..models import User, Role, Permission, UserRole, RolePermission

async def get_permissions(session: AsyncSession, user_id):
    q = (
        select(Permission.code)
        .select_from(UserRole)
        .join(Role, Role.id == UserRole.role_id)
        .join(RolePermission, RolePermission.role_id == Role.id)
        .join(Permission, Permission.id == RolePermission.permission_id)
        .where(UserRole.user_id == user_id)
    )
    rows = (await session.execute(q)).scalars().all()
    return sorted(set(rows))

async def get_roles(session: AsyncSession, user_id):
    q = (
        select(Role.name)
        .select_from(UserRole)
        .join(Role, Role.id == UserRole.role_id)
        .where(UserRole.user_id == user_id)
    )
    return sorted(set((await session.execute(q)).scalars().all()))

