from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def get_user(session: AsyncSession, user_id: UUID) -> User | None:
    return await session.get(User, user_id)


async def get_or_create_mock_user(session: AsyncSession, user_id: UUID) -> User:
    user = await session.get(User, user_id)
    if user is not None:
        return user
    user = User(
        id=user_id,
        nickname="꿈드림 사용자",
        provider="mock",
        provider_user_id=str(user_id),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user

