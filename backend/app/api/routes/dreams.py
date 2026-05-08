from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, db_session
from app.schemas.dream import (
    DreamCommentCreate,
    DreamCommentOut,
    DreamDraftCreate,
    DreamGiveRequest,
    DreamGiveResponse,
    DreamOut,
    DreamReactionSummary,
    DreamReactionToggle,
    DreamReactionToggleResponse,
    DreamUpdate,
)
from app.services.dream_service import (
    create_dream_draft,
    create_dream_comment,
    delete_dream_comment,
    get_dream_for_user,
    give_dream,
    list_dream_comments,
    list_dream_reactions,
    list_inbox,
    list_outbox,
    mark_opened_back,
    mark_read,
    toggle_dream_reaction,
    update_dream_text,
)

router = APIRouter()


@router.post("/draft", response_model=DreamOut)
async def create_draft(
    payload: DreamDraftCreate,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamOut:
    dream = await create_dream_draft(session, user_id, payload)
    return DreamOut.model_validate(dream)


@router.patch("/{dream_id}", response_model=DreamOut)
async def update_dream(
    dream_id: UUID,
    payload: DreamUpdate,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamOut:
    dream = await update_dream_text(session, user_id, dream_id, payload)
    return DreamOut.model_validate(dream)


@router.post("/{dream_id}/give", response_model=DreamGiveResponse, status_code=status.HTTP_202_ACCEPTED)
async def give(
    dream_id: UUID,
    payload: DreamGiveRequest,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamGiveResponse:
    dream = await give_dream(session, user_id, dream_id, payload)
    return DreamGiveResponse.model_validate(dream)


@router.get("/inbox", response_model=list[DreamOut])
async def inbox(
    limit: int = Query(default=30, ge=1, le=100),
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> list[DreamOut]:
    dreams = await list_inbox(session, user_id, limit)
    return [DreamOut.model_validate(dream) for dream in dreams]


@router.get("/outbox", response_model=list[DreamOut])
async def outbox(
    limit: int = Query(default=30, ge=1, le=100),
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> list[DreamOut]:
    dreams = await list_outbox(session, user_id, limit)
    return [DreamOut.model_validate(dream) for dream in dreams]


@router.get("/{dream_id}/comments", response_model=list[DreamCommentOut])
async def comments(
    dream_id: UUID,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> list[DreamCommentOut]:
    result = await list_dream_comments(session, user_id, dream_id)
    return [DreamCommentOut.model_validate(comment) for comment in result]


@router.post("/{dream_id}/comments", response_model=DreamCommentOut)
async def create_comment(
    dream_id: UUID,
    payload: DreamCommentCreate,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamCommentOut:
    comment = await create_dream_comment(session, user_id, dream_id, payload.content)
    return DreamCommentOut.model_validate(comment)


@router.delete("/{dream_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    dream_id: UUID,
    comment_id: UUID,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> Response:
    await delete_dream_comment(session, user_id, dream_id, comment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{dream_id}/reactions", response_model=list[DreamReactionSummary])
async def reactions(
    dream_id: UUID,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> list[DreamReactionSummary]:
    summary = await list_dream_reactions(session, user_id, dream_id)
    return [DreamReactionSummary.model_validate(row) for row in summary]


@router.post("/{dream_id}/reactions", response_model=DreamReactionToggleResponse)
async def toggle_reaction(
    dream_id: UUID,
    payload: DreamReactionToggle,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamReactionToggleResponse:
    result = await toggle_dream_reaction(session, user_id, dream_id, payload.reaction_type)
    return DreamReactionToggleResponse.model_validate(result)


@router.get("/{dream_id}", response_model=DreamOut)
async def detail(
    dream_id: UUID,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamOut:
    dream = await get_dream_for_user(session, user_id, dream_id)
    return DreamOut.model_validate(dream)


@router.post("/{dream_id}/read", response_model=DreamOut)
async def read(
    dream_id: UUID,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamOut:
    dream = await mark_read(session, user_id, dream_id)
    return DreamOut.model_validate(dream)


@router.post("/{dream_id}/open-back", response_model=DreamOut)
async def open_back(
    dream_id: UUID,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamOut:
    dream = await mark_opened_back(session, user_id, dream_id)
    return DreamOut.model_validate(dream)
