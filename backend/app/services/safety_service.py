from uuid import UUID

from sqlalchemy import and_, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestError, NotFoundError
from app.models.safety import ContentReport, UserBlock
from app.models.user import User
from app.schemas.safety import ReportCreate


async def create_report(
    session: AsyncSession,
    reporter_id: UUID,
    payload: ReportCreate,
) -> ContentReport:
    if payload.reported_user_id == reporter_id:
        raise BadRequestError("Cannot report yourself")

    report = ContentReport(
        reporter_id=reporter_id,
        target_type=payload.target_type,
        target_id=payload.target_id,
        reported_user_id=payload.reported_user_id,
        reason=payload.reason,
        detail=payload.detail.strip() if payload.detail else None,
    )
    session.add(report)
    await session.commit()
    await session.refresh(report)
    return report


async def block_user(
    session: AsyncSession,
    blocker_id: UUID,
    blocked_user_id: UUID,
) -> UserBlock:
    if blocker_id == blocked_user_id:
        raise BadRequestError("Cannot block yourself")
    blocked_user = await session.get(User, blocked_user_id)
    if blocked_user is None:
        raise NotFoundError("User not found")

    existing = await session.scalar(
        select(UserBlock).where(
            UserBlock.blocker_id == blocker_id,
            UserBlock.blocked_user_id == blocked_user_id,
        )
    )
    if existing is not None:
        return existing

    block = UserBlock(blocker_id=blocker_id, blocked_user_id=blocked_user_id)
    session.add(block)
    await session.commit()
    await session.refresh(block)
    return block


async def unblock_user(
    session: AsyncSession,
    blocker_id: UUID,
    blocked_user_id: UUID,
) -> None:
    await session.execute(
        delete(UserBlock).where(
            UserBlock.blocker_id == blocker_id,
            UserBlock.blocked_user_id == blocked_user_id,
        )
    )
    await session.commit()


async def list_blocked_users(
    session: AsyncSession, blocker_id: UUID
) -> list[tuple[UserBlock, User]]:
    rows = await session.execute(
        select(UserBlock, User)
        .join(User, User.id == UserBlock.blocked_user_id)
        .where(UserBlock.blocker_id == blocker_id)
        .order_by(UserBlock.created_at.desc())
    )
    return [(block, user) for block, user in rows]


async def is_blocked_between(
    session: AsyncSession,
    user_a: UUID,
    user_b: UUID | None,
) -> bool:
    if user_b is None:
        return False
    block_id = await session.scalar(
        select(UserBlock.id)
        .where(
            or_(
                and_(
                    UserBlock.blocker_id == user_a,
                    UserBlock.blocked_user_id == user_b,
                ),
                and_(
                    UserBlock.blocker_id == user_b,
                    UserBlock.blocked_user_id == user_a,
                ),
            )
        )
        .limit(1)
    )
    return block_id is not None


async def blocked_user_ids_for(session: AsyncSession, user_id: UUID) -> set[UUID]:
    rows = await session.execute(
        select(UserBlock.blocker_id, UserBlock.blocked_user_id).where(
            or_(
                UserBlock.blocker_id == user_id,
                UserBlock.blocked_user_id == user_id,
            )
        )
    )
    blocked_ids: set[UUID] = set()
    for blocker_id, blocked_user_id in rows:
        blocked_ids.add(blocked_user_id if blocker_id == user_id else blocker_id)
    return blocked_ids
