from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Response,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, db_session
from app.schemas.dream import (
    DreamClaimRequest,
    DreamCommentCreate,
    DreamCommentOut,
    DreamDraftCreate,
    DreamGiveRequest,
    DreamOut,
    DreamReactionSummary,
    DreamReactionToggle,
    DreamReactionToggleResponse,
    DreamShareRequest,
    DreamShareResponse,
    DreamUpdate,
)
from app.services.dream_service import (
    claim_dream_via_token,
    create_dream_comment,
    create_dream_draft,
    delete_dream_comment,
    get_dream_for_user,
    get_latest_dream_draft,
    give_dream,
    issue_dream_share_token,
    list_dream_comments,
    list_dream_reactions,
    list_inbox,
    list_outbox,
    mark_opened_back,
    mark_read,
    set_front_preview,
    to_dream_out,
    toggle_dream_reaction,
    update_dream_text,
)

router = APIRouter()

MAX_FRONT_PREVIEW_UPLOAD_BYTES = 5 * 1024 * 1024


@router.post("/draft", response_model=DreamOut)
async def create_draft(
    payload: DreamDraftCreate,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamOut:
    dream = await create_dream_draft(session, user_id, payload)
    return to_dream_out(dream, user_id)


@router.get("/draft/current", response_model=DreamOut | None)
async def current_draft(
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamOut | None:
    dream = await get_latest_dream_draft(session, user_id)
    if dream is None:
        return None
    return to_dream_out(dream, user_id)


@router.patch("/{dream_id}", response_model=DreamOut)
async def update_dream(
    dream_id: UUID,
    payload: DreamUpdate,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamOut:
    dream = await update_dream_text(session, user_id, dream_id, payload)
    return to_dream_out(dream, user_id)


@router.post("/{dream_id}/give", response_model=DreamOut, status_code=status.HTTP_202_ACCEPTED)
async def give(
    dream_id: UUID,
    payload: DreamGiveRequest,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamOut:
    dream = await give_dream(session, user_id, dream_id, payload)
    return to_dream_out(dream, user_id)


@router.get("/inbox", response_model=list[DreamOut])
async def inbox(
    limit: int = Query(default=30, ge=1, le=100),
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> list[DreamOut]:
    dreams = await list_inbox(session, user_id, limit)
    return [to_dream_out(dream, user_id) for dream in dreams]


@router.get("/outbox", response_model=list[DreamOut])
async def outbox(
    limit: int = Query(default=30, ge=1, le=100),
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> list[DreamOut]:
    dreams = await list_outbox(session, user_id, limit)
    return [to_dream_out(dream, user_id) for dream in dreams]


@router.post("/{dream_id}/front-preview", response_model=DreamOut)
async def upload_front_preview(
    dream_id: UUID,
    file: UploadFile = File(...),
    version: int = Form(...),
    content_hash: str | None = Form(default=None),
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamOut:
    if version < 1 or version > 1000:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid preview version",
        )
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미지 파일만 업로드할 수 있어요.",
        )
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="업로드할 미리보기 이미지가 비어 있어요.",
        )
    if len(image_bytes) > MAX_FRONT_PREVIEW_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="미리보기 이미지는 5MB 이하로 업로드해주세요.",
        )
    dream = await set_front_preview(
        session, user_id, dream_id, version, image_bytes, content_hash
    )
    return to_dream_out(dream, user_id)


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
    result = await toggle_dream_reaction(
        session,
        user_id,
        dream_id,
        payload.reaction_type,
        payload.reacted,
    )
    return DreamReactionToggleResponse.model_validate(result)


@router.post("/{dream_id}/share", response_model=DreamShareResponse)
async def share(
    dream_id: UUID,
    payload: DreamShareRequest,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamShareResponse:
    result = await issue_dream_share_token(
        session,
        user_id,
        dream_id,
        expires_in_hours=payload.expires_in_hours,
    )
    return DreamShareResponse.model_validate(result)


@router.post("/claim", response_model=DreamOut)
async def claim(
    payload: DreamClaimRequest,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamOut:
    dream = await claim_dream_via_token(session, user_id, payload.token)
    return to_dream_out(dream, user_id)


@router.get("/{dream_id}", response_model=DreamOut)
async def detail(
    dream_id: UUID,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamOut:
    dream = await get_dream_for_user(session, user_id, dream_id)
    return to_dream_out(dream, user_id)


@router.post("/{dream_id}/read", response_model=DreamOut)
async def read(
    dream_id: UUID,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamOut:
    dream = await mark_read(session, user_id, dream_id)
    return to_dream_out(dream, user_id)


@router.post("/{dream_id}/open-back", response_model=DreamOut)
async def open_back(
    dream_id: UUID,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamOut:
    dream = await mark_opened_back(session, user_id, dream_id)
    return to_dream_out(dream, user_id)
