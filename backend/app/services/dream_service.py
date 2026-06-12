import secrets
from datetime import UTC, datetime, time as datetime_time, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import HTTPException, status
from sqlalchemy import Select, delete, func, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import premium_design
from app.core.config import settings
from app.core.errors import BadRequestError, ForbiddenError, NotFoundError
from app.models.ai_generation import AiGenerationJob, AiGenerationLog
from app.models.dream import (
    DailyGiveLimit,
    Dream,
    DreamClaimToken,
    DreamComment,
    DreamGroup,
    DreamReaction,
)
from app.models.group import GroupMember
from app.models.user import User
from app.schemas.dream import (
    REACTION_TYPES,
    DreamDesign,
    DreamDraftCreate,
    DreamGiveRequest,
    DreamOut,
    DreamUpdate,
    ReactionType,
)
from app.services.ai_text_service import generate_dream_text
from app.services.billing_service import has_active_pass
from app.services.storage_service import store_front_preview
from app.services.push_service import (
    send_dream_claimed_push,
    send_dream_comment_push,
    send_dream_given_push,
    send_owner_comment_push,
)
from app.services.safety_service import blocked_user_ids_for, is_blocked_between


_KST = ZoneInfo("Asia/Seoul")


def _kst_today_start_utc(now: datetime | None = None) -> datetime:
    now_kst = (now or datetime.now(UTC)).astimezone(_KST)
    midnight_kst = datetime.combine(now_kst.date(), datetime_time.min, tzinfo=_KST)
    return midnight_kst.astimezone(UTC)


async def _purge_stale_drafts_for_user(session: AsyncSession, user_id: UUID) -> None:
    cutoff = _kst_today_start_utc()
    await _delete_drafts_matching(
        session,
        Dream.giver_id == user_id,
        Dream.status == "draft",
        Dream.created_at < cutoff,
    )


async def purge_all_stale_drafts(session: AsyncSession) -> int:
    cutoff = _kst_today_start_utc()
    deleted_count = await _delete_drafts_matching(
        session,
        Dream.status == "draft",
        Dream.created_at < cutoff,
    )
    await session.commit()
    return deleted_count


async def _delete_drafts_matching(session: AsyncSession, *criteria: object) -> int:
    draft_ids = select(Dream.id).where(*criteria).scalar_subquery()
    await session.execute(
        update(AiGenerationLog)
        .where(AiGenerationLog.dream_id.in_(draft_ids))
        .values(dream_id=None)
    )
    result = await session.execute(delete(Dream).where(Dream.id.in_(draft_ids)))
    return result.rowcount or 0


async def _lock_text_generation_for_user(session: AsyncSession, user_id: UUID) -> None:
    # Serialize draft creation per user for the rest of this transaction. The
    # paid AI text call happens before the row that records the daily quota is
    # committed, so without this lock concurrent /draft requests would each pass
    # the "already generated today?" check and trigger a separate paid generation.
    # pg_advisory_xact_lock auto-releases on commit/rollback.
    await session.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
        {"key": f"dream_text:{user_id}"},
    )


async def _has_text_generation_today(session: AsyncSession, user_id: UUID) -> bool:
    cutoff = _kst_today_start_utc()
    existing_log_id = await session.scalar(
        select(AiGenerationLog.id)
        .where(
            AiGenerationLog.user_id == user_id,
            AiGenerationLog.generation_type == "text",
            AiGenerationLog.status == "success",
            AiGenerationLog.created_at >= cutoff,
        )
        .limit(1)
    )
    return existing_log_id is not None


class DreamCommentView:
    def __init__(self, comment: DreamComment, author: User) -> None:
        self.id = comment.id
        self.dream_id = comment.dream_id
        self.author_id = comment.user_id
        self.author_nickname = author.nickname
        self.author_profile_image_url = author.profile_image_url
        self.is_hidden = comment.hidden_at is not None
        self.content = (
            "신고가 접수되어 가려진 댓글이에요." if self.is_hidden else comment.content
        )
        self.is_owner_main = comment.is_owner_main
        self.created_at = comment.created_at


async def create_dream_draft(
    session: AsyncSession,
    giver_id: UUID,
    payload: DreamDraftCreate,
) -> Dream:
    await _assert_draft_features_allowed(session, giver_id, payload)
    await _lock_text_generation_for_user(session, giver_id)
    await _purge_stale_drafts_for_user(session, giver_id)
    existing = await session.scalar(
        select(Dream)
        .where(Dream.giver_id == giver_id, Dream.status == "draft")
        .order_by(Dream.created_at.desc())
        .limit(1)
    )
    if existing is not None:
        await session.commit()
        return await _attach_group_ids(session, existing)

    if await _has_text_generation_today(session, giver_id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="You can generate only one dream text per day",
        )

    result = await generate_dream_text(
        payload.raw_input,
        payload.mood,
        payload.tone,
        payload.story_length,
    )
    dream = Dream(
        giver_id=giver_id,
        giver_display_name=await _snapshot_user_name(session, giver_id),
        raw_input=payload.raw_input,
        title=result.title,
        title_visible=True,
        short_message=result.short_message,
        summary=result.short_message,
        story=result.story,
        image_prompt=result.image_prompt,
        main_mood=result.main_mood,
        tags=result.tags,
        design=_normalize_design(payload.design),
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
    return await _attach_group_ids(session, dream)


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
    if "short_message" in updates:
        updates["summary"] = updates["short_message"]
    elif "summary" in updates:
        updates["summary"] = dream.short_message

    design_update = updates.get("design")
    if isinstance(design_update, dict):
        await _assert_premium_design_allowed(session, user_id, design_update)
    for key, value in updates.items():
        if key == "design":
            value = _normalize_design(value)
        setattr(dream, key, value)
    await session.commit()
    await session.refresh(dream)
    return await _attach_group_ids(session, dream)


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

    label = payload.receiver_label.strip() if payload.receiver_label else None
    private_postscript = (
        payload.private_postscript.strip() if payload.private_postscript else None
    )

    if (
        private_postscript
        and settings.private_postscript_requires_pass
        and not await has_active_pass(session, user_id)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Private postscript requires an active pass",
        )

    # Shadow ban: a blocked sender's card is still created (their outbox looks
    # normal), but it is never delivered to the blocker — filtered from the
    # blocker's inbox and no push sent.
    suppress_delivery = False
    if payload.receiver_id is not None:
        await _require_shared_group_member(session, user_id, payload.receiver_id)
        suppress_delivery = await is_blocked_between(session, user_id, payload.receiver_id)

    group_ids = list(dict.fromkeys(payload.group_ids))
    for group_id in group_ids:
        await _require_group_member(session, group_id, user_id)

    if settings.environment == "production":
        await _consume_daily_give_limit(session, user_id)

    dream.receiver_id = payload.receiver_id
    dream.receiver_label = label
    if not dream.giver_display_name:
        dream.giver_display_name = await _snapshot_user_name(session, user_id)
    dream.receiver_display_name = (
        await _snapshot_user_name(session, payload.receiver_id)
        if payload.receiver_id is not None
        else label
    )
    dream.private_postscript = private_postscript or None
    dream.status = "given"
    dream.image_status = "queued"
    dream.given_at = datetime.now(UTC)

    for group_id in group_ids:
        session.add(DreamGroup(dream_id=dream.id, group_id=group_id))

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
    if dream.receiver_id is not None and not suppress_delivery:
        await send_dream_given_push(
            session,
            dream.receiver_id,
            str(dream.id),
            dream.title,
        )
    return await _attach_group_ids(session, dream)


async def set_front_preview(
    session: AsyncSession,
    user_id: UUID,
    dream_id: UUID,
    version: int,
    image_bytes: bytes,
    content_hash: str | None,
) -> Dream:
    # Reuse the standard access/block checks (giver, receiver, or room member);
    # also attaches group_ids for the response.
    dream = await get_dream_for_user(session, user_id, dream_id)
    if dream.status == "draft":
        raise BadRequestError("Cannot create a preview for a draft dream")
    if dream.hidden_at is not None:
        raise BadRequestError("Cannot create a preview for a hidden dream")

    # Skip the R2 write only when an identical preview already exists — same
    # version AND same content hash. A version bump (format change) or a hash
    # change (the card's front-relevant data changed, e.g. an external recipient
    # claimed it and the name updated) re-bakes and overwrites the stored URL.
    if (
        dream.front_preview_url
        and dream.front_preview_version == version
        and dream.front_preview_hash == content_hash
    ):
        return dream

    url = await store_front_preview(dream.id, version, image_bytes, content_hash)
    dream.front_preview_url = url
    dream.front_preview_version = version
    dream.front_preview_hash = content_hash
    await session.commit()
    await session.refresh(dream)
    return await _attach_group_ids(session, dream)


def to_dream_out(dream: Dream, user_id: UUID) -> DreamOut:
    result = DreamOut.model_validate(dream)
    if dream.giver_id != user_id and dream.receiver_id != user_id:
        result.private_postscript = None
    if dream.hidden_at is not None:
        _mask_hidden_dream(result)
    return result


def _mask_hidden_dream(result: DreamOut) -> None:
    """Blank a report-hidden card's content so the client shows a "신고됨" state.

    FROM/TO names and dates are kept so the masked card still reads as a card.
    """
    result.is_hidden = True
    result.title = "신고된 카드"
    result.title_visible = True
    result.short_message = "신고가 누적되어 가려진 카드예요."
    result.summary = ""
    result.story = "신고가 누적되어 가려진 카드예요. 검토 후 다시 표시될 수 있어요."
    result.image_prompt = ""
    result.image_url = None
    result.thumbnail_url = None
    result.front_preview_url = None
    result.front_preview_version = None
    result.front_preview_hash = None
    result.tags = []
    result.private_postscript = None


async def list_inbox(session: AsyncSession, user_id: UUID, limit: int) -> list[Dream]:
    blocked_ids = await blocked_user_ids_for(session, user_id)
    stmt = (
        select(Dream)
        .where(Dream.receiver_id == user_id, Dream.status != "draft")
        .order_by(Dream.given_at.desc().nullslast(), Dream.created_at.desc())
        .limit(limit)
    )
    if blocked_ids:
        stmt = stmt.where(Dream.giver_id.notin_(blocked_ids))
    dreams = list((await session.scalars(stmt)).all())
    return await _attach_group_ids_batch(session, dreams)


async def list_outbox(session: AsyncSession, user_id: UUID, limit: int) -> list[Dream]:
    blocked_ids = await blocked_user_ids_for(session, user_id)
    stmt = (
        select(Dream)
        .where(Dream.giver_id == user_id, Dream.status != "draft")
        .order_by(Dream.given_at.desc().nullslast(), Dream.created_at.desc())
        .limit(limit)
    )
    if blocked_ids:
        stmt = stmt.where(
            or_(Dream.receiver_id.is_(None), Dream.receiver_id.notin_(blocked_ids))
        )
    dreams = list((await session.scalars(stmt)).all())
    return await _attach_group_ids_batch(session, dreams)


async def get_latest_dream_draft(
    session: AsyncSession,
    user_id: UUID,
) -> Dream | None:
    await _purge_stale_drafts_for_user(session, user_id)
    await session.commit()
    stmt = (
        select(Dream)
        .where(Dream.giver_id == user_id, Dream.status == "draft")
        .order_by(Dream.created_at.desc())
        .limit(1)
    )
    dream = await session.scalar(stmt)
    if dream is None:
        return None
    return await _attach_group_ids(session, dream)


async def get_dream_for_user(session: AsyncSession, user_id: UUID, dream_id: UUID) -> Dream:
    dream = await _get_dream(session, dream_id)
    if not await _can_access_dream(session, dream, user_id):
        raise ForbiddenError("You cannot access this dream")
    if await _is_dream_hidden_by_block(session, dream, user_id):
        raise ForbiddenError("You cannot access this dream")
    return await _attach_group_ids(session, dream)


async def list_dream_comments(
    session: AsyncSession,
    user_id: UUID,
    dream_id: UUID,
) -> list[DreamCommentView]:
    dream = await get_dream_for_user(session, user_id, dream_id)
    blocked_ids = await blocked_user_ids_for(session, user_id)
    stmt = (
        select(DreamComment, User)
        .join(User, User.id == DreamComment.user_id)
        .where(DreamComment.dream_id == dream.id)
        .order_by(DreamComment.is_owner_main.desc(), DreamComment.created_at.asc())
    )
    if blocked_ids:
        stmt = stmt.where(DreamComment.user_id.notin_(blocked_ids))
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
    counterpart_id = dream.giver_id if dream.receiver_id == user_id else dream.receiver_id
    # Shadow ban: a blocked user can still comment, but it never reaches the
    # blocker — their comment is filtered out of the blocker's view and no push
    # is delivered.
    suppress_delivery = await is_blocked_between(session, user_id, counterpart_id)
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
    if not suppress_delivery:
        if is_owner_main:
            await send_owner_comment_push(session, dream.giver_id, str(dream.id), dream.title)
        else:
            recipient_ids = [
                recipient_id
                for recipient_id in (dream.giver_id, dream.receiver_id)
                if recipient_id is not None and recipient_id != user_id
            ]
            await send_dream_comment_push(session, recipient_ids, str(dream.id), dream.title)
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
    desired_reacted: bool | None = None,
) -> dict[str, object]:
    dream = await get_dream_for_user(session, user_id, dream_id)
    existing = await session.scalar(
        select(DreamReaction).where(
            DreamReaction.dream_id == dream.id,
            DreamReaction.user_id == user_id,
            DreamReaction.reaction_type == reaction_type,
        )
    )
    should_react = (
        existing is None
        if desired_reacted is None
        else desired_reacted
    )
    if should_react:
        # One reaction per card: clear any other reaction this user left first.
        if existing is None:
            await session.execute(
                delete(DreamReaction).where(
                    DreamReaction.dream_id == dream.id,
                    DreamReaction.user_id == user_id,
                )
            )
            session.add(
                DreamReaction(
                    dream_id=dream.id,
                    user_id=user_id,
                    reaction_type=reaction_type,
                )
            )
        reacted = True
    else:
        if existing is not None:
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


async def issue_dream_share_token(
    session: AsyncSession,
    user_id: UUID,
    dream_id: UUID,
    expires_in_hours: int | None = None,
) -> dict[str, object]:
    dream = await _get_dream(session, dream_id)
    if dream.giver_id != user_id:
        raise ForbiddenError("Only the giver can share this dream")
    if dream.status == "draft":
        raise BadRequestError("Cannot share a draft dream")

    now = datetime.now(UTC)
    base = settings.share_base_url.rstrip("/")

    # Reuse an existing, still-valid link instead of minting a new token on each
    # share. This keeps any copy the recipient already received working and
    # avoids piling up redundant tokens for the same dream.
    existing = await session.scalar(
        select(DreamClaimToken)
        .where(
            DreamClaimToken.dream_id == dream.id,
            DreamClaimToken.claimed_at.is_(None),
            or_(
                DreamClaimToken.expires_at.is_(None),
                DreamClaimToken.expires_at > now,
            ),
        )
        .order_by(DreamClaimToken.created_at.desc())
        .limit(1)
    )
    if existing is not None:
        return {
            "token": existing.token,
            "dream_id": dream.id,
            "expires_at": existing.expires_at,
            "share_url": f"{base}/d/{dream.id}?claim={existing.token}",
        }

    expires_at: datetime | None
    if expires_in_hours is None:
        expires_at = now + timedelta(days=settings.share_token_default_expire_days)
    elif expires_in_hours <= 0:
        expires_at = None
    else:
        expires_at = now + timedelta(hours=expires_in_hours)

    token = secrets.token_urlsafe(32)
    record = DreamClaimToken(
        dream_id=dream.id,
        token=token,
        expires_at=expires_at,
    )
    session.add(record)
    await session.commit()
    await session.refresh(record)

    return {
        "token": token,
        "dream_id": dream.id,
        "expires_at": expires_at,
        "share_url": f"{base}/d/{dream.id}?claim={token}",
    }


async def claim_dream_via_token(
    session: AsyncSession,
    user_id: UUID,
    token: str,
) -> Dream:
    record = await session.scalar(
        select(DreamClaimToken).where(DreamClaimToken.token == token)
    )
    if record is None:
        raise NotFoundError("Invalid claim token")

    now = datetime.now(UTC)
    if record.expires_at is not None and record.expires_at < now:
        raise BadRequestError("Claim token has expired")

    dream = await _get_dream(session, record.dream_id)
    if dream.giver_id == user_id:
        raise BadRequestError("Cannot claim your own dream")
    # Shadow ban: claiming still works for the receiver, but the giver who
    # blocked them gets no "claimed" push and won't see them in their outbox.
    suppress_delivery = await is_blocked_between(session, dream.giver_id, user_id)

    if record.claimed_by_id == user_id and dream.receiver_id == user_id:
        return await _attach_group_ids(session, dream)

    if record.claimed_at is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This dream has already been claimed",
        )

    if dream.receiver_id is not None and dream.receiver_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This dream has already been received",
        )

    dream.receiver_id = user_id
    # An externally-shared dream stored the giver's placeholder label (e.g. "오빠")
    # in receiver_display_name at give-time. Now that a real user has claimed it,
    # their account name is authoritative: overwrite the placeholder and clear the
    # external label so the card shows the claimer instead of the giver's guess.
    dream.receiver_display_name = await _snapshot_user_name(session, user_id)
    dream.receiver_label = None
    record.claimed_at = now
    record.claimed_by_id = user_id
    await session.commit()
    await session.refresh(dream)
    if not suppress_delivery:
        await send_dream_claimed_push(session, dream.giver_id, str(dream.id), dream.title)
    return await _attach_group_ids(session, dream)


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
    return await _attach_group_ids(session, dream)


async def mark_opened_back(session: AsyncSession, user_id: UUID, dream_id: UUID) -> Dream:
    dream = await mark_read(session, user_id, dream_id)
    if dream.opened_back_at is None:
        dream.opened_back_at = datetime.now(UTC)
        dream.status = "replied"
    await session.commit()
    await session.refresh(dream)
    return await _attach_group_ids(session, dream)


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


async def _require_shared_group_member(
    session: AsyncSession,
    user_id: UUID,
    receiver_id: UUID,
) -> None:
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
        raise ForbiddenError("You can only send dreams to people in your dream rooms")


async def _can_access_dream(session: AsyncSession, dream: Dream, user_id: UUID) -> bool:
    if dream.giver_id == user_id or dream.receiver_id == user_id:
        return True
    member_id = await session.scalar(
        select(GroupMember.id)
        .join(DreamGroup, DreamGroup.group_id == GroupMember.group_id)
        .where(
            DreamGroup.dream_id == dream.id,
            GroupMember.user_id == user_id,
        )
        .limit(1)
    )
    return member_id is not None


async def _is_dream_hidden_by_block(
    session: AsyncSession,
    dream: Dream,
    user_id: UUID,
) -> bool:
    blocked_ids = await blocked_user_ids_for(session, user_id)
    if not blocked_ids:
        return False
    participant_ids = [
        participant_id
        for participant_id in (dream.giver_id, dream.receiver_id)
        if participant_id is not None and participant_id != user_id
    ]
    return any(participant_id in blocked_ids for participant_id in participant_ids)


async def _snapshot_user_name(session: AsyncSession, user_id: UUID | None) -> str | None:
    if user_id is None:
        return None
    user = await session.get(User, user_id)
    if user is None:
        return None
    return user.nickname.strip()[:50] or None


async def _attach_group_ids(session: AsyncSession, dream: Dream) -> Dream:
    group_ids = list(
        (
            await session.scalars(
                select(DreamGroup.group_id).where(DreamGroup.dream_id == dream.id)
            )
        ).all()
    )
    dream.group_ids = group_ids  # type: ignore[attr-defined]
    return dream


async def _attach_group_ids_batch(
    session: AsyncSession,
    dreams: list[Dream],
) -> list[Dream]:
    if not dreams:
        return dreams
    dream_ids = [dream.id for dream in dreams]
    rows = (
        await session.execute(
            select(DreamGroup.dream_id, DreamGroup.group_id).where(
                DreamGroup.dream_id.in_(dream_ids)
            )
        )
    ).all()
    bucket: dict[UUID, list[UUID]] = {dream_id: [] for dream_id in dream_ids}
    for dream_id, group_id in rows:
        bucket[dream_id].append(group_id)
    for dream in dreams:
        dream.group_ids = bucket.get(dream.id, [])  # type: ignore[attr-defined]
    return dreams


async def _assert_premium_design_allowed(
    session: AsyncSession, user_id: UUID, design: dict
) -> None:
    if premium_design.requires_pass(design) and not await has_active_pass(session, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Premium design requires an active pass",
        )


async def _assert_draft_features_allowed(
    session: AsyncSession, user_id: UUID, payload: DreamDraftCreate
) -> None:
    locked = (
        premium_design.requires_pass(payload.design.model_dump())
        or premium_design.tone_requires_pass(payload.tone)
        or premium_design.story_length_requires_pass(payload.story_length)
    )
    if locked and not await has_active_pass(session, user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This option requires an active pass",
        )


def _normalize_design(value: DreamDesign | dict | None) -> dict[str, str]:
    if isinstance(value, DreamDesign):
        return value.model_dump()
    if isinstance(value, dict):
        return DreamDesign.model_validate(value).model_dump()
    return DreamDesign().model_dump()


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
