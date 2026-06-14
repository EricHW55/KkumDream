from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, db_session
from app.core.config import settings
from app.models.dream import Dream, DreamComment
from app.models.user import User
from app.schemas.safety import (
    AdminModerationActionCreate,
    AdminModerationActionOut,
    AdminReportOut,
    BlockCreate,
    BlockedUserOut,
    BlockOut,
    ReportCreate,
    ReportOut,
    ReportSummaryOut,
    ReportTargetSummary,
)
from app.services.safety_service import (
    apply_admin_moderation_action,
    block_user,
    create_report,
    list_blocked_users,
    list_reports_for_admin,
    report_summary,
    unblock_user,
)

router = APIRouter()


def require_admin(x_admin_token: str | None = Header(default=None)) -> None:
    """Guard the read-only moderation endpoints with a shared admin token."""
    expected = settings.admin_api_token
    if not expected or x_admin_token != expected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


@router.post("/reports", response_model=ReportOut)
async def report_content(
    payload: ReportCreate,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> ReportOut:
    report = await create_report(session, user_id, payload)
    return ReportOut.model_validate(report)


@router.get("/blocks", response_model=list[BlockedUserOut])
async def blocks(
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> list[BlockedUserOut]:
    result = await list_blocked_users(session, user_id)
    return [
        BlockedUserOut(
            id=block.id,
            blocker_id=block.blocker_id,
            blocked_user_id=block.blocked_user_id,
            blocked_user_nickname=user.nickname,
            blocked_user_profile_image_url=user.profile_image_url,
            created_at=block.created_at,
        )
        for block, user in result
    ]


@router.post("/blocks", response_model=BlockOut)
async def create_block(
    payload: BlockCreate,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> BlockOut:
    block = await block_user(session, user_id, payload.blocked_user_id)
    return BlockOut.model_validate(block)


@router.delete("/blocks/{blocked_user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_block(
    blocked_user_id: UUID,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> Response:
    await unblock_user(session, user_id, blocked_user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/admin/reports",
    response_model=list[AdminReportOut],
    dependencies=[Depends(require_admin)],
)
async def admin_reports(
    status_filter: str | None = None,
    limit: int = 200,
    session: AsyncSession = Depends(db_session),
) -> list[AdminReportOut]:
    rows = await list_reports_for_admin(session, status_filter, min(max(limit, 1), 500))
    result: list[AdminReportOut] = []
    for report, reporter_nick, reported_nick in rows:
        target_title, target_content, target_hidden = await _report_target_preview(
            session,
            report.target_type,
            report.target_id,
        )
        reported_user = (
            await session.get(User, report.reported_user_id)
            if report.reported_user_id is not None
            else None
        )
        result.append(
            AdminReportOut(
                id=report.id,
                target_type=report.target_type,
                target_id=report.target_id,
                target_title=target_title,
                target_content=target_content,
                target_hidden=target_hidden,
                reporter_id=report.reporter_id,
                reporter_nickname=reporter_nick,
                reported_user_id=report.reported_user_id,
                reported_user_nickname=reported_nick,
                reported_user_deleted_at=(
                    reported_user.deleted_at if reported_user is not None else None
                ),
                reported_user_suspended_until=(
                    reported_user.suspended_until if reported_user is not None else None
                ),
                reason=report.reason,
                detail=report.detail,
                status=report.status,
                created_at=report.created_at,
            )
        )
    return result


@router.get(
    "/admin/reports/summary",
    response_model=ReportSummaryOut,
    dependencies=[Depends(require_admin)],
)
async def admin_report_summary(
    limit: int = 20,
    session: AsyncSession = Depends(db_session),
) -> ReportSummaryOut:
    open_count, top_targets = await report_summary(session, min(max(limit, 1), 100))
    return ReportSummaryOut(
        open_reports=open_count,
        auto_hide_threshold=settings.report_auto_hide_threshold,
        top_targets=[
            ReportTargetSummary(
                target_type=target_type,
                target_id=target_id,
                distinct_reporters=reporters,
                total_reports=reports,
            )
            for target_type, target_id, reporters, reports in top_targets
        ],
    )


@router.post(
    "/admin/actions",
    response_model=AdminModerationActionOut,
    dependencies=[Depends(require_admin)],
)
async def admin_moderation_action(
    payload: AdminModerationActionCreate,
    session: AsyncSession = Depends(db_session),
) -> AdminModerationActionOut:
    action = await apply_admin_moderation_action(session, payload)
    return AdminModerationActionOut.model_validate(action)


async def _report_target_preview(
    session: AsyncSession,
    target_type: str,
    target_id: UUID | None,
) -> tuple[str | None, str | None, bool]:
    if target_id is None:
        return None, None, False
    if target_type == "dream":
        dream = await session.get(Dream, target_id)
        if dream is None:
            return None, None, False
        content = " / ".join(
            part
            for part in (
                dream.short_message,
                dream.story,
                dream.raw_input,
            )
            if part
        )
        return dream.title, content[:500], dream.hidden_at is not None
    if target_type == "comment":
        comment = await session.get(DreamComment, target_id)
        if comment is None:
            return None, None, False
        return "댓글", comment.content[:500], comment.hidden_at is not None
    return None, None, False
