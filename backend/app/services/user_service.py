from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

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


async def get_or_create_google_user(
    session: AsyncSession,
    provider_user_id: str,
    email: str,
    nickname: str | None,
    profile_image_url: str | None,
) -> User:
    stmt = select(User).where(
        User.provider == "google",
        User.provider_user_id == provider_user_id,
    )
    user = await session.scalar(stmt)
    if user is not None:
        user.nickname = nickname or user.nickname or email
        user.profile_image_url = profile_image_url or user.profile_image_url
        await session.commit()
        await session.refresh(user)
        return user

    user = User(
        nickname=nickname or email,
        profile_image_url=profile_image_url,
        provider="google",
        provider_user_id=provider_user_id,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user
