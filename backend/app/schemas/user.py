from datetime import datetime
from uuid import UUID

from app.schemas.base import ApiModel


class UserOut(ApiModel):
    id: UUID
    nickname: str
    profile_image_url: str | None = None
    provider: str
    created_at: datetime

