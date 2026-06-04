from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, db_session
from app.schemas.safety import (
    BlockCreate,
    BlockedUserOut,
    BlockOut,
    ReportCreate,
    ReportOut,
)
from app.services.safety_service import (
    block_user,
    create_report,
    list_blocked_users,
    unblock_user,
)

router = APIRouter()


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
