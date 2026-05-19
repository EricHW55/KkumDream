from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta
from secrets import choice
from string import ascii_uppercase, digits
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestError, ForbiddenError, NotFoundError
from app.models.dream import Dream, DreamGroup
from app.models.group import Group, GroupMember
from app.models.user import User


@dataclass
class DreamRoom:
    room_id: str
    title: str
    invite_code: str
    last_given_at: datetime | None
    dream_count: int
    today_dream_count: int
    member_ids: list[UUID]
    members: list["RoomMember"]
    latest_dream_id: UUID | None
    today_giver_ids: list[UUID]


@dataclass
class RoomMember:
    id: UUID
    nickname: str
    profile_image_url: str | None
    role: str


async def create_room(session: AsyncSession, user_id: UUID, name: str) -> DreamRoom:
    normalized_name = name.strip()
    if not normalized_name:
        raise BadRequestError("Room name is required")

    group = Group(
        name=normalized_name,
        owner_id=user_id,
        invite_code=await _build_unique_invite_code(session),
    )
    session.add(group)
    await session.flush()
    session.add(GroupMember(group_id=group.id, user_id=user_id, role="owner"))
    await session.commit()
    return await _build_room(session, group)


async def join_room(session: AsyncSession, user_id: UUID, invite_code: str) -> DreamRoom:
    normalized_code = _normalize_invite_code(invite_code)
    if normalized_code.startswith("CLOSED-"):
        raise NotFoundError("Room invite code was not found")
    group = await session.scalar(select(Group).where(Group.invite_code == normalized_code))
    if group is None:
        raise NotFoundError("Room invite code was not found")

    existing_member = await session.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group.id,
            GroupMember.user_id == user_id,
        )
    )
    if existing_member is None:
        member_count = await session.scalar(
            select(func.count(GroupMember.id)).where(GroupMember.group_id == group.id)
        )
        role = "owner" if not member_count else "member"
        if role == "owner":
            group.owner_id = user_id
        session.add(GroupMember(group_id=group.id, user_id=user_id, role=role))
        await session.commit()
    return await _build_room(session, group)


async def leave_room(session: AsyncSession, user_id: UUID, room_id: str) -> None:
    group_id = _parse_room_id(room_id)
    member = await session.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )
    if member is None:
        raise ForbiddenError("You are not a member of this room")

    group = await session.get(Group, group_id)
    if group is None:
        raise NotFoundError("Room not found")

    was_owner = member.role == "owner"
    await session.delete(member)
    await session.flush()

    next_owner = await session.scalar(
        select(GroupMember)
        .where(GroupMember.group_id == group_id)
        .order_by(GroupMember.joined_at.asc())
    )
    if next_owner is None:
        await _cleanup_memberless_room(session, group)
        await session.commit()
        return

    if was_owner:
        next_owner.role = "owner"
        group.owner_id = next_owner.user_id
    await session.commit()


async def update_room(session: AsyncSession, user_id: UUID, room_id: str, name: str) -> DreamRoom:
    group_id = _parse_room_id(room_id)
    group = await session.get(Group, group_id)
    if group is None:
        raise NotFoundError("Room not found")
    owner_id = await session.scalar(
        select(GroupMember.user_id).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
            GroupMember.role == "owner",
        )
    )
    if owner_id is None:
        raise ForbiddenError("Only the room owner can edit this room")
    normalized_name = name.strip()
    if not normalized_name:
        raise BadRequestError("Room name is required")
    group.name = normalized_name
    await session.commit()
    await session.refresh(group)
    return await _build_room(session, group)


async def list_rooms(session: AsyncSession, user_id: UUID) -> list[DreamRoom]:
    today_start, today_end = _today_bounds_utc()
    dream_activity_at = func.coalesce(Dream.given_at, Dream.created_at)
    stats_subquery = (
        select(
            DreamGroup.group_id.label("group_id"),
            func.max(Dream.given_at).label("last_given_at"),
            func.count(Dream.id).label("dream_count"),
            func.count(Dream.id)
            .filter(dream_activity_at >= today_start, dream_activity_at < today_end)
            .label("today_dream_count"),
        )
        .join(Dream, Dream.id == DreamGroup.dream_id)
        .where(Dream.status != "draft")
        .group_by(DreamGroup.group_id)
        .subquery()
    )
    stmt = (
        select(
            Group,
            stats_subquery.c.last_given_at,
            func.coalesce(stats_subquery.c.dream_count, 0).label("dream_count"),
            func.coalesce(stats_subquery.c.today_dream_count, 0).label(
                "today_dream_count"
            ),
        )
        .join(GroupMember, GroupMember.group_id == Group.id)
        .outerjoin(stats_subquery, stats_subquery.c.group_id == Group.id)
        .where(GroupMember.user_id == user_id)
        .order_by(stats_subquery.c.last_given_at.desc().nullslast(), Group.created_at.desc())
    )
    rows = (await session.execute(stmt)).all()
    rooms: list[DreamRoom] = []
    for group, last_given_at, dream_count, today_dream_count in rows:
        rooms.append(
            await _build_room(
                session,
                group=group,
                last_given_at=last_given_at,
                dream_count=dream_count,
                today_dream_count=today_dream_count,
            )
        )
    return rooms


async def list_room_dreams(
    session: AsyncSession,
    user_id: UUID,
    room_id: str,
    limit: int,
) -> list[Dream]:
    from app.services.dream_service import _attach_group_ids_batch

    group_id = _parse_room_id(room_id)
    await _require_group_member(session, group_id, user_id)
    stmt = (
        select(Dream)
        .join(DreamGroup, DreamGroup.dream_id == Dream.id)
        .where(DreamGroup.group_id == group_id, Dream.status != "draft")
        .order_by(Dream.given_at.asc().nullsfirst(), Dream.created_at.asc())
        .limit(limit)
    )
    dreams = list((await session.scalars(stmt)).all())
    return await _attach_group_ids_batch(session, dreams)


async def _build_room(
    session: AsyncSession,
    group: Group,
    last_given_at: datetime | None = None,
    dream_count: int | None = None,
    today_dream_count: int | None = None,
) -> DreamRoom:
    today_start, today_end = _today_bounds_utc()
    dream_activity_at = func.coalesce(Dream.given_at, Dream.created_at)
    if dream_count is None:
        dream_count = await session.scalar(
            select(func.count(Dream.id))
            .join(DreamGroup, DreamGroup.dream_id == Dream.id)
            .where(DreamGroup.group_id == group.id, Dream.status != "draft")
        )
    if today_dream_count is None:
        today_dream_count = await session.scalar(
            select(func.count(Dream.id))
            .join(DreamGroup, DreamGroup.dream_id == Dream.id)
            .where(
                DreamGroup.group_id == group.id,
                Dream.status != "draft",
                dream_activity_at >= today_start,
                dream_activity_at < today_end,
            )
        )
    latest_dream_id = await session.scalar(
        select(Dream.id)
        .join(DreamGroup, DreamGroup.dream_id == Dream.id)
        .where(DreamGroup.group_id == group.id, Dream.status != "draft")
        .order_by(Dream.given_at.desc().nullslast(), Dream.created_at.desc())
        .limit(1)
    )
    today_giver_ids = await _list_today_giver_ids(session, group.id)
    member_rows = (
        await session.execute(
            select(GroupMember.user_id, GroupMember.role, User.nickname, User.profile_image_url)
            .join(User, User.id == GroupMember.user_id)
            .where(GroupMember.group_id == group.id)
            .order_by(GroupMember.joined_at.asc())
        )
    ).all()
    members = [
        RoomMember(
            id=user_id,
            nickname=nickname,
            profile_image_url=profile_image_url,
            role=role,
        )
        for user_id, role, nickname, profile_image_url in member_rows
    ]
    member_ids = [member.id for member in members]
    if not member_ids:
        member_ids = list(
            (
                await session.scalars(
                    select(GroupMember.user_id)
                    .where(GroupMember.group_id == group.id)
                    .order_by(GroupMember.joined_at.asc())
                )
            ).all()
        )
        members = [
            RoomMember(id=member_id, nickname="꿈친구", profile_image_url=None, role="member")
            for member_id in member_ids
        ]
    return DreamRoom(
        room_id=f"g:{group.id}",
        title=group.name,
        invite_code=group.invite_code,
        last_given_at=last_given_at,
        dream_count=dream_count or 0,
        today_dream_count=today_dream_count or 0,
        member_ids=member_ids,
        members=members,
        latest_dream_id=latest_dream_id,
        today_giver_ids=today_giver_ids,
    )


async def _list_today_giver_ids(session: AsyncSession, group_id: UUID) -> list[UUID]:
    start, end = _today_bounds_utc()
    dream_activity_at = func.coalesce(Dream.given_at, Dream.created_at)
    rows = (
        await session.scalars(
            select(Dream.giver_id)
            .join(DreamGroup, DreamGroup.dream_id == Dream.id)
            .where(
                DreamGroup.group_id == group_id,
                Dream.status != "draft",
                dream_activity_at >= start,
                dream_activity_at < end,
            )
            .order_by(Dream.given_at.desc().nullslast(), Dream.created_at.desc())
        )
    ).all()
    return list(dict.fromkeys(rows))


def _today_bounds_utc() -> tuple[datetime, datetime]:
    timezone = ZoneInfo("Asia/Seoul")
    today = datetime.now(timezone).date()
    start = datetime.combine(today, time.min, tzinfo=timezone).astimezone(UTC)
    return start, start + timedelta(days=1)


async def _require_group_member(session: AsyncSession, group_id: UUID, user_id: UUID) -> None:
    member = await session.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )
    if member is None:
        raise ForbiddenError("You are not a member of this room")


async def _cleanup_memberless_room(session: AsyncSession, group: Group) -> None:
    receiverless_shared_dream_count = await session.scalar(
        select(func.count(Dream.id))
        .join(DreamGroup, DreamGroup.dream_id == Dream.id)
        .where(
            DreamGroup.group_id == group.id,
            Dream.receiver_id.is_(None),
            Dream.receiver_label.is_(None),
            Dream.status != "draft",
        )
    )
    if receiverless_shared_dream_count:
        group.invite_code = await _build_unique_invite_code(
            session,
            prefix="CLOSED-",
            random_length=9,
        )
        return

    await session.execute(delete(DreamGroup).where(DreamGroup.group_id == group.id))
    await session.delete(group)


async def _build_unique_invite_code(
    session: AsyncSession,
    prefix: str = "DREAM-",
    random_length: int = 6,
) -> str:
    for _ in range(20):
        code = prefix + "".join(choice(ascii_uppercase + digits) for _ in range(random_length))
        exists = await session.scalar(select(Group.id).where(Group.invite_code == code))
        if exists is None:
            return code
    raise RuntimeError("Could not generate a unique invite code")


def _parse_room_id(room_id: str) -> UUID:
    if not room_id.startswith("g:"):
        raise NotFoundError("Room not found")
    try:
        return UUID(room_id[2:])
    except ValueError as exc:
        raise NotFoundError("Room not found") from exc


def _normalize_invite_code(invite_code: str) -> str:
    return invite_code.strip().upper()
