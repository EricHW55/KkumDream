from datetime import datetime
from uuid import UUID

from app.schemas.base import ApiModel


class FriendRequestCreate(ApiModel):
    receiver_id: UUID


class FriendshipOut(ApiModel):
    id: UUID
    requester_id: UUID
    receiver_id: UUID
    status: str
    created_at: datetime
    accepted_at: datetime | None = None

