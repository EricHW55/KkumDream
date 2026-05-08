from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestError
from app.models.user import User


async def get_user(session: AsyncSession, user_id: UUID) -> User | None:
    return await session.get(User, user_id)


async def get_or_create_mock_user(session: AsyncSession, user_id: UUID) -> User:
    user = await session.get(User, user_id)
    if user is not None:
        return user
    user = User(
        id=user_id,
        nickname="KkumDream User",
        email=None,
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
        user.email = email
        user.nickname = user.nickname or nickname or email
        user.profile_image_url = user.profile_image_url or profile_image_url
        await session.commit()
        await session.refresh(user)
        return user

    user = User(
        nickname=nickname or email,
        email=email,
        profile_image_url=profile_image_url,
        provider="google",
        provider_user_id=provider_user_id,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def update_user_profile(
    session: AsyncSession,
    user_id: UUID,
    nickname: str | None,
    profile_image_url: str | None,
) -> User:
    user = await get_user(session, user_id)
    if user is None:
        user = await get_or_create_mock_user(session, user_id)
    if nickname is not None:
        normalized_nickname = nickname.strip()
        if not normalized_nickname:
            raise BadRequestError("Nickname is required")
        user.nickname = normalized_nickname
    if profile_image_url is not None:
        user.profile_image_url = profile_image_url.strip() or None
    await session.commit()
    await session.refresh(user)
    return user
