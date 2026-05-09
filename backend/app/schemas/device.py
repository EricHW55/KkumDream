from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import ApiModel


class DeviceTokenRegister(ApiModel):
    platform: str = Field(pattern="^(android|ios)$")
    token: str = Field(min_length=1, max_length=512)


class DeviceTokenOut(ApiModel):
    id: UUID
    platform: str
    enabled: bool
    created_at: datetime
    updated_at: datetime
    last_seen_at: datetime | None = None
