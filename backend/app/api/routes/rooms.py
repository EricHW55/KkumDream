from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, db_session
from app.schemas.dream import DreamOut
from app.schemas.room import DreamRoomOut, RoomCreate, RoomJoin, RoomUpdate
from app.services.room_service import (
    create_room,
    join_room,
    leave_room,
    list_room_dreams,
    list_rooms,
    update_room,
)

router = APIRouter()


@router.get("", response_model=list[DreamRoomOut])
async def rooms(
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> list[DreamRoomOut]:
    result = await list_rooms(session, user_id)
    return [DreamRoomOut.model_validate(room) for room in result]


@router.post("", response_model=DreamRoomOut)
async def create(
    payload: RoomCreate,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamRoomOut:
    room = await create_room(session, user_id, payload.name)
    return DreamRoomOut.model_validate(room)


@router.post("/join", response_model=DreamRoomOut)
async def join(
    payload: RoomJoin,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamRoomOut:
    room = await join_room(session, user_id, payload.invite_code)
    return DreamRoomOut.model_validate(room)


@router.patch("/{room_id}", response_model=DreamRoomOut)
async def update(
    room_id: str,
    payload: RoomUpdate,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> DreamRoomOut:
    room = await update_room(session, user_id, room_id, payload.name)
    return DreamRoomOut.model_validate(room)


@router.delete("/{room_id}")
async def leave(
    room_id: str,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> dict[str, bool]:
    await leave_room(session, user_id, room_id)
    return {"ok": True}


@router.get("/{room_id}/dreams", response_model=list[DreamOut])
async def room_dreams(
    room_id: str,
    limit: int = Query(default=30, ge=1, le=100),
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> list[DreamOut]:
    dreams = await list_room_dreams(session, user_id, room_id, limit)
    return [DreamOut.model_validate(dream) for dream in dreams]
