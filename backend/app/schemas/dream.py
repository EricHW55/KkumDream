from datetime import datetime
from uuid import UUID

from pydantic import Field, model_validator

from app.schemas.base import ApiModel


class DreamDraftCreate(ApiModel):
    raw_input: str = Field(min_length=1, max_length=500)
    mood: str | None = Field(default=None, max_length=20)


class DreamUpdate(ApiModel):
    title: str | None = Field(default=None, max_length=80)
    title_visible: bool | None = None
    short_message: str | None = Field(default=None, max_length=120)
    summary: str | None = Field(default=None, max_length=220)
    story: str | None = Field(default=None, max_length=1000)
    tags: list[str] | None = None


class DreamGiveRequest(ApiModel):
    receiver_id: UUID | None = None
    group_id: UUID | None = None

    @model_validator(mode="after")
    def validate_target(self) -> "DreamGiveRequest":
        if bool(self.receiver_id) == bool(self.group_id):
            raise ValueError("Exactly one of receiverId or groupId is required")
        return self


class DreamOut(ApiModel):
    id: UUID
    giver_id: UUID
    receiver_id: UUID | None = None
    group_id: UUID | None = None
    raw_input: str
    title: str
    title_visible: bool
    short_message: str
    summary: str
    story: str
    image_prompt: str
    image_url: str | None = None
    thumbnail_url: str | None = None
    main_mood: str
    tags: list[str]
    status: str
    image_status: str
    created_at: datetime
    given_at: datetime | None = None
    read_at: datetime | None = None
    opened_back_at: datetime | None = None
    owner_main_comment_id: UUID | None = None


class DreamGiveResponse(ApiModel):
    id: UUID
    status: str
    given_at: datetime | None
    image_status: str

