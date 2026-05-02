from datetime import UTC, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestError, ForbiddenError, NotFoundError
from app.models.ai_generation import AiGenerationJob, AiGenerationLog
from app.models.dream import DailyGiveLimit, Dream
from app.schemas.dream import DreamDraftCreate, DreamGiveRequest, DreamUpdate
from app.services.ai_text_service import generate_dream_text


async def create_dream_draft(
    session: AsyncSession,
    giver_id: UUID,
    payload: DreamDraftCreate,
) -> Dream:
    result = await generate_dream_text(payload.raw_input, payload.mood)
    dream = Dream(
        giver_id=giver_id,
        raw_input=payload.raw_input,
        title=result.title,
        title_visible=True,
        short_message=result.short_message,
        summary=result.summary,
        story=result.story,
        image_prompt=result.image_prompt,
        main_mood=result.main_mood,
        tags=result.tags,
        status="draft",
        image_status="empty",
    )
    session.add(dream)
    await session.flush()
    session.add(
        AiGenerationLog(
            user_id=giver_id,
            dream_id=dream.id,
            model_name=result.model_name,
            generation_type="text",
            token_count=result.token_count,
            cost_estimate=result.cost_estimate,
            status="success",
        )
    )
    await session.commit()
    await session.refresh(dream)
    return dream


async def update_dream_text(
    session: AsyncSession,
    user_id: UUID,
    dream_id: UUID,
    payload: DreamUpdate,
) -> Dream:
    dream = await _get_dream(session, dream_id)
    if dream.giver_id != user_id:
        raise ForbiddenError("Only the giver can edit this dream")
    if dream.status != "draft":
        raise BadRequestError("Only draft dreams can be edited")

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(dream, key, value)
    await session.commit()
    await session.refresh(dream)
    return dream


async def give_dream(
    session: AsyncSession,
    user_id: UUID,
    dream_id: UUID,
    payload: DreamGiveRequest,
) -> Dream:
    dream = await _get_dream(session, dream_id)
    if dream.giver_id != user_id:
        raise ForbiddenError("Only the giver can give this dream")
    if dream.status != "draft":
        raise BadRequestError("Dream has already been given")

    await _consume_daily_give_limit(session, user_id)
    dream.receiver_id = payload.receiver_id
    dream.group_id = payload.group_id
    dream.status = "given"
    dream.image_status = "queued"
    dream.given_at = datetime.now(UTC)

    session.add(
        AiGenerationJob(
            user_id=user_id,
            dream_id=dream.id,
            generation_type="image",
            status="pending",
            payload={"imagePrompt": dream.image_prompt},
        )
    )
    await session.commit()
    await session.refresh(dream)
    return dream


async def list_inbox(session: AsyncSession, user_id: UUID, limit: int) -> list[Dream]:
    stmt = (
        select(Dream)
        .where(Dream.receiver_id == user_id, Dream.status != "draft")
        .order_by(Dream.given_at.desc().nullslast(), Dream.created_at.desc())
        .limit(limit)
    )
    return list((await session.scalars(stmt)).all())


async def list_outbox(session: AsyncSession, user_id: UUID, limit: int) -> list[Dream]:
    stmt = (
        select(Dream)
        .where(Dream.giver_id == user_id, Dream.status != "draft")
        .order_by(Dream.given_at.desc().nullslast(), Dream.created_at.desc())
        .limit(limit)
    )
    return list((await session.scalars(stmt)).all())


async def get_dream_for_user(session: AsyncSession, user_id: UUID, dream_id: UUID) -> Dream:
    dream = await _get_dream(session, dream_id)
    if dream.giver_id != user_id and dream.receiver_id != user_id:
        raise ForbiddenError("You cannot access this dream")
    return dream


async def mark_read(session: AsyncSession, user_id: UUID, dream_id: UUID) -> Dream:
    dream = await get_dream_for_user(session, user_id, dream_id)
    if dream.receiver_id != user_id:
        raise ForbiddenError("Only the receiver can mark this dream as read")
    if dream.read_at is None:
        dream.read_at = datetime.now(UTC)
        if dream.status == "given":
            dream.status = "opened"
    await session.commit()
    await session.refresh(dream)
    return dream


async def mark_opened_back(session: AsyncSession, user_id: UUID, dream_id: UUID) -> Dream:
    dream = await mark_read(session, user_id, dream_id)
    if dream.opened_back_at is None:
        dream.opened_back_at = datetime.now(UTC)
        dream.status = "replied"
    await session.commit()
    await session.refresh(dream)
    return dream


async def _get_dream(session: AsyncSession, dream_id: UUID) -> Dream:
    dream = await session.get(Dream, dream_id)
    if dream is None:
        raise NotFoundError("Dream not found")
    return dream


async def _consume_daily_give_limit(session: AsyncSession, user_id: UUID) -> None:
    today = datetime.now(ZoneInfo("Asia/Seoul")).date()
    stmt: Select[tuple[DailyGiveLimit]] = select(DailyGiveLimit).where(
        DailyGiveLimit.user_id == user_id,
        DailyGiveLimit.date == today,
    )
    limit = await session.scalar(stmt)
    if limit is None:
        session.add(DailyGiveLimit(user_id=user_id, date=today, given_count=1))
        return
    if limit.given_count >= 1:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You can give only one dream per day",
        )
    limit.given_count += 1
