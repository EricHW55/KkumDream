from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import ApiModel


class RoomCreate(ApiModel):
    name: str = Field(min_length=1, max_length=50)


class RoomJoin(ApiModel):
    invite_code: str = Field(min_length=4, max_length=16)


class RoomUpdate(ApiModel):
    name: str = Field(min_length=1, max_length=50)


class RoomMemberOut(ApiModel):
    id: UUID
    nickname: str
    profile_image_url: str | None = None
    role: str


class DreamRoomOut(ApiModel):
    room_id: str
    title: str
    invite_code: str
    last_given_at: datetime | None
    dream_count: int
    today_dream_count: int = 0
    member_ids: list[UUID]
    members: list[RoomMemberOut]
    latest_dream_id: UUID | None = None
    today_giver_ids: list[UUID] = Field(default_factory=list)
