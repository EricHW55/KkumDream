from collections.abc import AsyncIterator
from datetime import UTC, datetime
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
    if (
        user is not None
        and user.suspended_until is not None
        and user.suspended_until > datetime.now(UTC)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is suspended until {user.suspended_until.isoformat()}",
        )
    return user_id
