from datetime import UTC, datetime
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.errors import BadRequestError, ForbiddenError, NotFoundError
from app.models.ai_generation import AiGenerationJob, AiGenerationLog
from app.models.dream import DailyGiveLimit, Dream, DreamComment, DreamReaction
from app.models.friendship import Friendship
from app.models.group import GroupMember
from app.models.user import User
from app.schemas.dream import (
    REACTION_TYPES,
    DreamDraftCreate,
    DreamGiveRequest,
    DreamUpdate,
    ReactionType,
)
from app.services.ai_text_service import generate_dream_text


class DreamCommentView:
    def __init__(self, comment: DreamComment, author: User) -> None:
        self.id = comment.id
        self.dream_id = comment.dream_id
        self.author_id = comment.user_id
        self.author_nickname = author.nickname
        self.author_profile_image_url = author.profile_image_url
        self.content = comment.content
        self.is_owner_main = comment.is_owner_main
        self.created_at = comment.created_at


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
    if payload.receiver_id is not None and payload.receiver_id == user_id:
        raise BadRequestError("Cannot give a dream to yourself")
    if payload.group_id is not None:
        await _require_group_member(session, payload.group_id, user_id)
        if payload.receiver_id is not None:
            await _require_group_member(session, payload.group_id, payload.receiver_id)
    elif payload.receiver_id is not None:
        await _require_friend_or_shared_group(session, user_id, payload.receiver_id)

    if settings.environment == "production":
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
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        if "dreams_receiver_group_xor" in str(exc):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Database migration required. Run alembic upgrade head.",
            ) from exc
        raise
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
    if not await _can_access_dream(session, dream, user_id):
        raise ForbiddenError("You cannot access this dream")
    return dream


async def list_dream_comments(
    session: AsyncSession,
    user_id: UUID,
    dream_id: UUID,
) -> list[DreamCommentView]:
    dream = await get_dream_for_user(session, user_id, dream_id)
    stmt = (
        select(DreamComment, User)
        .join(User, User.id == DreamComment.user_id)
        .where(DreamComment.dream_id == dream.id)
        .order_by(DreamComment.is_owner_main.desc(), DreamComment.created_at.asc())
    )
    rows = (await session.execute(stmt)).all()
    return [DreamCommentView(comment, author) for comment, author in rows]


async def create_dream_comment(
    session: AsyncSession,
    user_id: UUID,
    dream_id: UUID,
    content: str,
) -> DreamCommentView:
    dream = await get_dream_for_user(session, user_id, dream_id)
    if dream.giver_id == user_id:
        raise ForbiddenError("The giver cannot comment on this dream")
    normalized_content = content.strip()
    if not normalized_content:
        raise BadRequestError("Comment content is required")
    is_owner_main = dream.receiver_id == user_id and dream.owner_main_comment_id is None
    comment = DreamComment(
        dream_id=dream.id,
        user_id=user_id,
        content=normalized_content,
        is_owner_main=is_owner_main,
    )
    session.add(comment)
    await session.flush()
    if is_owner_main:
        dream.owner_main_comment_id = comment.id
    await session.commit()
    author = await session.get(User, user_id)
    if author is None:
        raise NotFoundError("User not found")
    await session.refresh(comment)
    return DreamCommentView(comment, author)


async def delete_dream_comment(
    session: AsyncSession,
    user_id: UUID,
    dream_id: UUID,
    comment_id: UUID,
) -> None:
    dream = await get_dream_for_user(session, user_id, dream_id)
    comment = await session.get(DreamComment, comment_id)
    if comment is None or comment.dream_id != dream.id:
        raise NotFoundError("Comment not found")
    if comment.user_id != user_id:
        raise ForbiddenError("Only the author can delete this comment")
    if dream.owner_main_comment_id == comment.id:
        dream.owner_main_comment_id = None
    await session.delete(comment)
    await session.commit()


async def list_dream_reactions(
    session: AsyncSession,
    user_id: UUID,
    dream_id: UUID,
) -> list[dict[str, object]]:
    dream = await get_dream_for_user(session, user_id, dream_id)
    return await _build_reaction_summary(session, dream.id, user_id)


async def toggle_dream_reaction(
    session: AsyncSession,
    user_id: UUID,
    dream_id: UUID,
    reaction_type: ReactionType,
) -> dict[str, object]:
    dream = await get_dream_for_user(session, user_id, dream_id)
    existing = await session.scalar(
        select(DreamReaction).where(
            DreamReaction.dream_id == dream.id,
            DreamReaction.user_id == user_id,
            DreamReaction.reaction_type == reaction_type,
        )
    )
    if existing is None:
        session.add(
            DreamReaction(
                dream_id=dream.id,
                user_id=user_id,
                reaction_type=reaction_type,
            )
        )
        reacted = True
    else:
        await session.delete(existing)
        reacted = False
    await session.commit()

    summary = await _build_reaction_summary(session, dream.id, user_id)
    matched = next((row for row in summary if row["reaction_type"] == reaction_type), None)
    count = int(matched["count"]) if matched else 0
    return {
        "reaction_type": reaction_type,
        "reacted": reacted,
        "count": count,
        "summary": summary,
    }


async def _build_reaction_summary(
    session: AsyncSession,
    dream_id: UUID,
    user_id: UUID,
) -> list[dict[str, object]]:
    count_rows = (
        await session.execute(
            select(DreamReaction.reaction_type, func.count(DreamReaction.id))
            .where(DreamReaction.dream_id == dream_id)
            .group_by(DreamReaction.reaction_type)
        )
    ).all()
    counts = {reaction_type: total for reaction_type, total in count_rows}
    reacted_types = set(
        (
            await session.scalars(
                select(DreamReaction.reaction_type).where(
                    DreamReaction.dream_id == dream_id,
                    DreamReaction.user_id == user_id,
                )
            )
        ).all()
    )
    summary: list[dict[str, object]] = []
    for reaction_type in REACTION_TYPES:
        summary.append(
            {
                "reaction_type": reaction_type,
                "count": int(counts.get(reaction_type, 0)),
                "reacted": reaction_type in reacted_types,
            }
        )
    return summary


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


async def _require_group_member(session: AsyncSession, group_id: UUID, user_id: UUID) -> None:
    member_id = await session.scalar(
        select(GroupMember.id).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )
    if member_id is None:
        raise ForbiddenError("You cannot give a dream to this room")


async def _require_friend_or_shared_group(
    session: AsyncSession,
    user_id: UUID,
    receiver_id: UUID,
) -> None:
    friendship_id = await session.scalar(
        select(Friendship.id).where(
            Friendship.status == "accepted",
            or_(
                and_(
                    Friendship.requester_id == user_id,
                    Friendship.receiver_id == receiver_id,
                ),
                and_(
                    Friendship.requester_id == receiver_id,
                    Friendship.receiver_id == user_id,
                ),
            ),
        )
    )
    if friendship_id is not None:
        return
    shared_group_id = await session.scalar(
        select(GroupMember.group_id)
        .where(GroupMember.user_id == user_id)
        .where(
            GroupMember.group_id.in_(
                select(GroupMember.group_id).where(GroupMember.user_id == receiver_id)
            )
        )
        .limit(1)
    )
    if shared_group_id is None:
        raise ForbiddenError("You can only send dreams to friends or shared room members")


async def _can_access_dream(session: AsyncSession, dream: Dream, user_id: UUID) -> bool:
    if dream.giver_id == user_id or dream.receiver_id == user_id:
        return True
    if dream.group_id is None:
        return False
    member_id = await session.scalar(
        select(GroupMember.id).where(
            GroupMember.group_id == dream.group_id,
            GroupMember.user_id == user_id,
        )
    )
    return member_id is not None


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
