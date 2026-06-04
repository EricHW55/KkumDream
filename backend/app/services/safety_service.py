from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, delete, distinct, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.config import settings
from app.core.errors import BadRequestError, NotFoundError
from app.models.dream import Dream, DreamComment
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
    await _maybe_auto_hide(session, payload.target_type, payload.target_id)
    return report


async def _maybe_auto_hide(
    session: AsyncSession,
    target_type: str,
    target_id: UUID | None,
) -> None:
    """Hide a dream/comment once enough *distinct* users have reported it.

    This is the unmanned safeguard: no operator is required to take obviously
    objectionable content out of circulation. The content is masked (not
    deleted), so it can be restored on review.
    """
    if target_id is None or target_type not in ("dream", "comment"):
        return
    threshold = settings.report_auto_hide_threshold
    if threshold <= 0:
        return

    distinct_reporters = await session.scalar(
        select(func.count(distinct(ContentReport.reporter_id))).where(
            ContentReport.target_type == target_type,
            ContentReport.target_id == target_id,
        )
    )
    if (distinct_reporters or 0) < threshold:
        return

    model = Dream if target_type == "dream" else DreamComment
    await session.execute(
        update(model)
        .where(model.id == target_id, model.hidden_at.is_(None))
        .values(hidden_at=datetime.now(UTC))
    )
    await session.commit()


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
    """Users that ``user_id`` has chosen to hide (the people *this* user blocked).

    Visibility is intentionally one-directional so blocking behaves like a shadow
    ban: the blocker stops seeing the blocked user everywhere, but the blocked
    user's app looks normal — their cards/comments are simply never delivered to
    or shown to the blocker.
    """
    rows = await session.scalars(
        select(UserBlock.blocked_user_id).where(UserBlock.blocker_id == user_id)
    )
    return set(rows.all())


async def list_reports_for_admin(
    session: AsyncSession,
    status_filter: str | None,
    limit: int,
) -> list[tuple[ContentReport, str | None, str | None]]:
    reporter = aliased(User)
    reported = aliased(User)
    stmt = (
        select(ContentReport, reporter.nickname, reported.nickname)
        .join(reporter, reporter.id == ContentReport.reporter_id)
        .outerjoin(reported, reported.id == ContentReport.reported_user_id)
        .order_by(ContentReport.created_at.desc())
        .limit(limit)
    )
    if status_filter:
        stmt = stmt.where(ContentReport.status == status_filter)
    rows = (await session.execute(stmt)).all()
    return [(report, reporter_nick, reported_nick) for report, reporter_nick, reported_nick in rows]


async def report_summary(
    session: AsyncSession,
    limit: int,
) -> tuple[int, list[tuple[str, UUID, int, int]]]:
    open_count = (
        await session.scalar(
            select(func.count())
            .select_from(ContentReport)
            .where(ContentReport.status == "open")
        )
    ) or 0
    rows = (
        await session.execute(
            select(
                ContentReport.target_type,
                ContentReport.target_id,
                func.count(distinct(ContentReport.reporter_id)),
                func.count(ContentReport.id),
            )
            .where(ContentReport.target_id.is_not(None))
            .group_by(ContentReport.target_type, ContentReport.target_id)
            .order_by(func.count(distinct(ContentReport.reporter_id)).desc())
            .limit(limit)
        )
    ).all()
    top_targets = [
        (target_type, target_id, reporters, reports)
        for target_type, target_id, reporters, reports in rows
    ]
    return open_count, top_targets
