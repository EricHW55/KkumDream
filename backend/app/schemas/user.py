from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import ApiModel


class UserOut(ApiModel):
    id: UUID
    nickname: str
    email: str | None = None
    profile_image_url: str | None = None
    provider: str
    created_at: datetime


class GoogleLoginRequest(ApiModel):
    id_token: str = Field(min_length=20)


class AuthSessionOut(ApiModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserUpdate(ApiModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=50)
    profile_image_url: str | None = Field(default=None, max_length=500)
