from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.schemas.base import ApiModel

ReportTargetType = Literal["dream", "comment", "user", "room"]
ReportReason = Literal[
    "inappropriate",
    "harassment",
    "spam",
    "privacy",
    "minor_safety",
    "other",
]


class ReportCreate(ApiModel):
    target_type: ReportTargetType
    target_id: UUID | None = None
    reported_user_id: UUID | None = None
    reason: ReportReason
    detail: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def validate_target(self) -> "ReportCreate":
        if self.target_type != "user" and self.target_id is None:
            raise ValueError("targetId is required for this report target")
        if self.target_type == "user" and self.reported_user_id is None:
            raise ValueError("reportedUserId is required for user reports")
        return self


class ReportOut(ApiModel):
    id: UUID
    target_type: str
    target_id: UUID | None = None
    reported_user_id: UUID | None = None
    reason: str
    detail: str | None = None
    status: str
    created_at: datetime


class BlockCreate(ApiModel):
    blocked_user_id: UUID


class BlockOut(ApiModel):
    id: UUID
    blocker_id: UUID
    blocked_user_id: UUID
    created_at: datetime


class BlockedUserOut(ApiModel):
    id: UUID
    blocker_id: UUID
    blocked_user_id: UUID
    blocked_user_nickname: str | None = None
    blocked_user_profile_image_url: str | None = None
    created_at: datetime
