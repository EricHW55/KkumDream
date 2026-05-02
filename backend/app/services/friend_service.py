from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestError, ForbiddenError, NotFoundError
from app.models.friendship import Friendship


async def list_friends(session: AsyncSession, user_id: UUID) -> list[Friendship]:
    stmt = select(Friendship).where(
        or_(Friendship.requester_id == user_id, Friendship.receiver_id == user_id)
    )
    return list((await session.scalars(stmt)).all())


async def request_friend(session: AsyncSession, requester_id: UUID, receiver_id: UUID) -> Friendship:
    if requester_id == receiver_id:
        raise BadRequestError("Cannot request yourself as a friend")
    friendship = Friendship(
        requester_id=requester_id,
        receiver_id=receiver_id,
        status="pending",
    )
    session.add(friendship)
    await session.commit()
    await session.refresh(friendship)
    return friendship


async def accept_friend_request(
    session: AsyncSession,
    user_id: UUID,
    friendship_id: UUID,
) -> Friendship:
    friendship = await session.get(Friendship, friendship_id)
    if friendship is None:
        raise NotFoundError("Friend request not found")
    if friendship.receiver_id != user_id:
        raise ForbiddenError("Only the receiver can accept this request")
    friendship.status = "accepted"
    friendship.accepted_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(friendship)
    return friendship

