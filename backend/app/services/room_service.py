from dataclasses import dataclass
from datetime import datetime
from secrets import choice
from string import ascii_uppercase, digits
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import BadRequestError, ForbiddenError, NotFoundError
from app.models.dream import Dream
from app.models.group import Group, GroupMember
from app.models.user import User


@dataclass
class DreamRoom:
    room_id: str
    title: str
    invite_code: str
    last_given_at: datetime | None
    dream_count: int
    member_ids: list[UUID]
    members: list["RoomMember"]


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
        session.add(GroupMember(group_id=group.id, user_id=user_id, role="member"))
        await session.commit()
    return await _build_room(session, group)


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
    stats_subquery = (
        select(
            Dream.group_id.label("group_id"),
            func.max(Dream.given_at).label("last_given_at"),
            func.count(Dream.id).label("dream_count"),
        )
        .where(Dream.group_id.is_not(None), Dream.status != "draft")
        .group_by(Dream.group_id)
        .subquery()
    )
    stmt = (
        select(
            Group,
            stats_subquery.c.last_given_at,
            func.coalesce(stats_subquery.c.dream_count, 0).label("dream_count"),
        )
        .join(GroupMember, GroupMember.group_id == Group.id)
        .outerjoin(stats_subquery, stats_subquery.c.group_id == Group.id)
        .where(GroupMember.user_id == user_id)
        .order_by(stats_subquery.c.last_given_at.desc().nullslast(), Group.created_at.desc())
    )
    rows = (await session.execute(stmt)).all()
    rooms: list[DreamRoom] = []
    for group, last_given_at, dream_count in rows:
        rooms.append(
            await _build_room(
                session,
                group=group,
                last_given_at=last_given_at,
                dream_count=dream_count,
            )
        )
    return rooms


async def list_room_dreams(
    session: AsyncSession,
    user_id: UUID,
    room_id: str,
    limit: int,
) -> list[Dream]:
    group_id = _parse_room_id(room_id)
    await _require_group_member(session, group_id, user_id)
    stmt = (
        select(Dream)
        .where(Dream.group_id == group_id, Dream.status != "draft")
        .order_by(Dream.given_at.desc().nullslast(), Dream.created_at.desc())
        .limit(limit)
    )
    return list((await session.scalars(stmt)).all())


async def _build_room(
    session: AsyncSession,
    group: Group,
    last_given_at: datetime | None = None,
    dream_count: int | None = None,
) -> DreamRoom:
    if dream_count is None:
        dream_count = await session.scalar(
            select(func.count(Dream.id)).where(Dream.group_id == group.id, Dream.status != "draft")
        )
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
        member_ids=member_ids,
        members=members,
    )


async def _require_group_member(session: AsyncSession, group_id: UUID, user_id: UUID) -> None:
    member = await session.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
        )
    )
    if member is None:
        raise ForbiddenError("You are not a member of this room")


async def _build_unique_invite_code(session: AsyncSession) -> str:
    for _ in range(20):
        code = "DREAM-" + "".join(choice(ascii_uppercase + digits) for _ in range(6))
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
