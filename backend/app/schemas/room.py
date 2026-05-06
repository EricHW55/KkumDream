from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import ApiModel


class RoomCreate(ApiModel):
    name: str = Field(min_length=1, max_length=50)


class RoomJoin(ApiModel):
    invite_code: str = Field(min_length=4, max_length=16)


class DreamRoomOut(ApiModel):
    room_id: str
    title: str
    invite_code: str
    last_given_at: datetime | None
    dream_count: int
    member_ids: list[UUID]
