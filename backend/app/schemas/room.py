from datetime import datetime

from app.schemas.base import ApiModel


class DreamRoomOut(ApiModel):
    room_id: str
    title: str
    last_given_at: datetime | None
    dream_count: int

