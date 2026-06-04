from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestError
from app.models.dream import DailyGiveLimit, Dream, DreamComment, DreamReaction
from app.models.friendship import Friendship
from app.models.group import Group, GroupMember
from app.models.safety import UserBlock
from app.models.user import DeviceToken, User


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


async def delete_user_account(session: AsyncSession, user_id: UUID) -> None:
    user = await session.get(User, user_id)
    if user is None:
        return
    if user.deleted_at is not None:
        return

    now = datetime.now(UTC)
    await _delete_user_drafts(session, user_id)
    await _remove_user_from_rooms(session, user_id)
    await session.execute(
        delete(Friendship).where(
            or_(Friendship.requester_id == user_id, Friendship.receiver_id == user_id)
        )
    )
    await session.execute(delete(DeviceToken).where(DeviceToken.user_id == user_id))
    await session.execute(delete(DreamReaction).where(DreamReaction.user_id == user_id))
    await session.execute(
        update(Dream)
        .where(
            Dream.owner_main_comment_id.in_(
                select(DreamComment.id).where(DreamComment.user_id == user_id)
            )
        )
        .values(owner_main_comment_id=None)
    )
    await session.execute(delete(DreamComment).where(DreamComment.user_id == user_id))
    await session.execute(delete(DailyGiveLimit).where(DailyGiveLimit.user_id == user_id))
    await session.execute(
        delete(UserBlock).where(
            or_(UserBlock.blocker_id == user_id, UserBlock.blocked_user_id == user_id)
        )
    )

    user.nickname = "탈퇴한 사용자"
    user.email = None
    user.profile_image_url = None
    user.provider = "deleted"
    user.provider_user_id = f"deleted:{user.id}"
    user.deleted_at = now
    await session.commit()


async def _delete_user_drafts(session: AsyncSession, user_id: UUID) -> None:
    draft_ids = list(
        (
            await session.scalars(
                select(Dream.id).where(Dream.giver_id == user_id, Dream.status == "draft")
            )
        ).all()
    )
    if not draft_ids:
        return
    await session.execute(delete(DreamReaction).where(DreamReaction.dream_id.in_(draft_ids)))
    await session.execute(delete(DreamComment).where(DreamComment.dream_id.in_(draft_ids)))
    await session.execute(delete(Dream).where(Dream.id.in_(draft_ids)))


async def _remove_user_from_rooms(session: AsyncSession, user_id: UUID) -> None:
    memberships = list(
        (
            await session.scalars(select(GroupMember).where(GroupMember.user_id == user_id))
        ).all()
    )
    for membership in memberships:
        group = await session.get(Group, membership.group_id)
        if group is None:
            await session.delete(membership)
            continue

        was_owner = membership.role == "owner" or group.owner_id == user_id
        await session.delete(membership)
        await session.flush()
        next_owner = await session.scalar(
            select(GroupMember)
            .where(GroupMember.group_id == group.id)
            .order_by(GroupMember.joined_at.asc())
        )
        if next_owner is None:
            await session.delete(group)
            continue
        if was_owner:
            next_owner.role = "owner"
            group.owner_id = next_owner.user_id


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
