from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import and_, delete, distinct, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.config import settings
from app.core.errors import BadRequestError, ConflictError, NotFoundError
from app.models.dream import Dream, DreamComment
from app.models.safety import ContentModerationAction, ContentReport, UserBlock
from app.models.user import User
from app.schemas.safety import AdminModerationActionCreate, ReportCreate
from app.services.user_service import delete_user_account


async def create_report(
    session: AsyncSession,
    reporter_id: UUID,
    payload: ReportCreate,
) -> ContentReport:
    reported_user_id = payload.reported_user_id or await _infer_reported_user_id(
        session,
        payload.target_type,
        payload.target_id,
    )
    if reported_user_id == reporter_id:
        raise BadRequestError("Cannot report yourself")

    report = ContentReport(
        reporter_id=reporter_id,
        target_type=payload.target_type,
        target_id=payload.target_id,
        reported_user_id=reported_user_id,
        reason=payload.reason,
        detail=payload.detail.strip() if payload.detail else None,
    )
    session.add(report)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError(_already_reported_message(payload.target_type)) from exc
    await session.refresh(report)
    await _maybe_auto_hide(session, payload.target_type, payload.target_id)
    return report


async def _infer_reported_user_id(
    session: AsyncSession,
    target_type: str,
    target_id: UUID | None,
) -> UUID | None:
    if target_id is None:
        return None
    if target_type == "dream":
        dream = await session.get(Dream, target_id)
        return dream.giver_id if dream is not None else None
    if target_type == "comment":
        comment = await session.get(DreamComment, target_id)
        return comment.user_id if comment is not None else None
    return None


def _already_reported_message(target_type: str) -> str:
    if target_type == "dream":
        return "이미 신고한 카드예요."
    if target_type == "comment":
        return "이미 신고한 댓글이에요."
    return "이미 신고했어요."


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


async def apply_admin_moderation_action(
    session: AsyncSession,
    payload: AdminModerationActionCreate,
    admin_label: str = "admin",
) -> ContentModerationAction:
    report = await _load_report(session, payload.report_id)
    target_type = payload.target_type or (report.target_type if report else None)
    target_id = payload.target_id or (report.target_id if report else None)
    reported_user_id = payload.reported_user_id or (
        report.reported_user_id if report else None
    )
    report_status = "resolved"

    if payload.action == "mark_resolved":
        _require_report_or_target(report, target_type, target_id, reported_user_id)
    elif payload.action == "dismiss_report":
        _require_report_or_target(report, target_type, target_id, reported_user_id)
        report_status = "dismissed"
    elif payload.action == "hide_dream":
        await _set_hidden_at(session, Dream, target_id, datetime.now(UTC))
        target_type = "dream"
    elif payload.action == "restore_dream":
        await _set_hidden_at(session, Dream, target_id, None)
        target_type = "dream"
        report_status = "dismissed"
    elif payload.action == "hide_comment":
        await _set_hidden_at(session, DreamComment, target_id, datetime.now(UTC))
        target_type = "comment"
    elif payload.action == "restore_comment":
        await _set_hidden_at(session, DreamComment, target_id, None)
        target_type = "comment"
        report_status = "dismissed"
    elif payload.action == "suspend_user":
        if reported_user_id is None:
            raise BadRequestError("reportedUserId is required")
        if payload.duration_days is None:
            raise BadRequestError("durationDays is required")
        user = await session.get(User, reported_user_id)
        if user is None:
            raise NotFoundError("User not found")
        user.suspended_until = datetime.now(UTC) + timedelta(days=payload.duration_days)
    elif payload.action == "delete_user":
        if reported_user_id is None:
            raise BadRequestError("reportedUserId is required")
        await delete_user_account(session, reported_user_id)
    else:
        raise BadRequestError("Unsupported moderation action")

    await _mark_related_reports(
        session,
        report=report,
        target_type=target_type,
        target_id=target_id,
        reported_user_id=reported_user_id,
        status=report_status,
    )
    action = ContentModerationAction(
        report_id=report.id if report else None,
        action=payload.action,
        target_type=target_type,
        target_id=target_id,
        reported_user_id=reported_user_id,
        duration_days=payload.duration_days,
        note=payload.note.strip() if payload.note else None,
        admin_label=admin_label,
    )
    session.add(action)
    await session.commit()
    await session.refresh(action)
    return action


async def _load_report(
    session: AsyncSession,
    report_id: UUID | None,
) -> ContentReport | None:
    if report_id is None:
        return None
    report = await session.get(ContentReport, report_id)
    if report is None:
        raise NotFoundError("Report not found")
    return report


def _require_report_or_target(
    report: ContentReport | None,
    target_type: str | None,
    target_id: UUID | None,
    reported_user_id: UUID | None,
) -> None:
    if report is not None:
        return
    if target_type and target_id:
        return
    if reported_user_id is not None:
        return
    raise BadRequestError("reportId or target information is required")


async def _set_hidden_at(
    session: AsyncSession,
    model: type[Dream] | type[DreamComment],
    target_id: UUID | None,
    hidden_at: datetime | None,
) -> None:
    if target_id is None:
        raise BadRequestError("targetId is required")
    target = await session.get(model, target_id)
    if target is None:
        raise NotFoundError("Target not found")
    target.hidden_at = hidden_at


async def _mark_related_reports(
    session: AsyncSession,
    *,
    report: ContentReport | None,
    target_type: str | None,
    target_id: UUID | None,
    reported_user_id: UUID | None,
    status: str,
) -> None:
    conditions = []
    if target_type and target_id:
        conditions.append(
            and_(
                ContentReport.target_type == target_type,
                ContentReport.target_id == target_id,
            )
        )
    if reported_user_id is not None:
        conditions.append(ContentReport.reported_user_id == reported_user_id)
    if not conditions and report is not None:
        conditions.append(ContentReport.id == report.id)
    if not conditions:
        return
    await session.execute(
        update(ContentReport)
        .where(ContentReport.status == "open", or_(*conditions))
        .values(status=status)
    )
