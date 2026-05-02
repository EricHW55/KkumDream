from collections.abc import AsyncIterator
from uuid import UUID

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user_id


async def db_session() -> AsyncIterator[AsyncSession]:
    async for session in get_db():
        yield session


async def current_user_id(user_id: UUID = Depends(get_current_user_id)) -> UUID:
    return user_id

