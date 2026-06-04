from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import Depends
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id
from app.models.user import User


async def db_session() -> AsyncIterator[AsyncSession]:
    async for session in get_db():
        yield session


async def current_user_id(
    user_id: UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(db_session),
) -> UUID:
    user = await session.get(User, user_id)
    if user is not None and user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account has been deleted",
        )
    return user_id
