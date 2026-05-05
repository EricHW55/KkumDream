from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import ApiModel


class UserOut(ApiModel):
    id: UUID
    nickname: str
    profile_image_url: str | None = None
    provider: str
    created_at: datetime


class GoogleLoginRequest(ApiModel):
    id_token: str = Field(min_length=20)


class AuthSessionOut(ApiModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
