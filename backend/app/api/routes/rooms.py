from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, db_session
from app.schemas.dream import DreamOut
from app.schemas.room import DreamRoomOut
from app.services.room_service import list_room_dreams, list_rooms

router = APIRouter()


@router.get("", response_model=list[DreamRoomOut])
async def rooms(
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> list[DreamRoomOut]:
    result = await list_rooms(session, user_id)
    return [DreamRoomOut.model_validate(room) for room in result]


@router.get("/{room_id}/dreams", response_model=list[DreamOut])
async def room_dreams(
    room_id: str,
    limit: int = Query(default=30, ge=1, le=100),
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> list[DreamOut]:
    dreams = await list_room_dreams(session, user_id, room_id, limit)
    return [DreamOut.model_validate(dream) for dream in dreams]

