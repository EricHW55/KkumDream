from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dream import Dream
from app.models.user import User


@dataclass
class DreamRoom:
    room_id: str
    title: str
    last_given_at: datetime | None
    dream_count: int


async def list_rooms(session: AsyncSession, user_id: UUID) -> list[DreamRoom]:
    other_user = case(
        (Dream.giver_id == user_id, Dream.receiver_id),
        else_=Dream.giver_id,
    )
    stmt = (
        select(
            other_user.label("other_user_id"),
            func.max(Dream.given_at).label("last_given_at"),
            func.count(Dream.id).label("dream_count"),
        )
        .where(
            Dream.receiver_id.is_not(None),
            Dream.status != "draft",
            or_(Dream.giver_id == user_id, Dream.receiver_id == user_id),
        )
        .group_by(other_user)
        .order_by(func.max(Dream.given_at).desc())
    )
    rows = (await session.execute(stmt)).all()
    other_user_ids = [row.other_user_id for row in rows if row.other_user_id is not None]
    users_by_id: dict[UUID, User] = {}
    if other_user_ids:
        users = await session.scalars(select(User).where(User.id.in_(other_user_ids)))
        users_by_id = {user.id: user for user in users}

    rooms: list[DreamRoom] = []
    for row in rows:
        ids = sorted([str(user_id), str(row.other_user_id)])
        other_user_name = users_by_id.get(row.other_user_id).nickname if row.other_user_id else None
        rooms.append(
            DreamRoom(
                room_id=f"{ids[0]}_{ids[1]}",
                title=other_user_name or "꿈친구",
                last_given_at=row.last_given_at,
                dream_count=row.dream_count,
            )
        )
    return rooms


async def list_room_dreams(
    session: AsyncSession,
    user_id: UUID,
    room_id: str,
    limit: int,
) -> list[Dream]:
    if room_id.startswith("g:"):
        group_id = UUID(room_id[2:])
        stmt = (
            select(Dream)
            .where(Dream.group_id == group_id, Dream.status != "draft")
            .order_by(Dream.given_at.desc().nullslast(), Dream.created_at.desc())
            .limit(limit)
        )
        return list((await session.scalars(stmt)).all())

    user_a, user_b = [UUID(value) for value in room_id.split("_", maxsplit=1)]
    if user_id not in {user_a, user_b}:
        return []
    stmt = (
        select(Dream)
        .where(
            Dream.status != "draft",
            or_(
                (Dream.giver_id == user_a) & (Dream.receiver_id == user_b),
                (Dream.giver_id == user_b) & (Dream.receiver_id == user_a),
            ),
        )
        .order_by(Dream.given_at.desc().nullslast(), Dream.created_at.desc())
        .limit(limit)
    )
    return list((await session.scalars(stmt)).all())
