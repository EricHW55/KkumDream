from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, db_session
from app.schemas.dream import (
    DreamDraftCreate,
    DreamGiveRequest,
    DreamGiveResponse,
    DreamOut,
    DreamUpdate,
)
from app.services.dream_service import (
    create_dream_draft,
    get_dream_for_user,
    give_dream,
    list_inbox,
    list_outbox,
    mark_opened_back,
    mark_read,
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

