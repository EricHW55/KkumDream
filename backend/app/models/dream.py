import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Dream(Base):
    __tablename__ = "dreams"
    __table_args__ = (
        CheckConstraint(
            "status = 'draft' OR receiver_id IS NOT NULL OR group_id IS NOT NULL",
            name="dreams_must_have_receiver_when_given",
        ),
        CheckConstraint(
            "NOT (receiver_id IS NOT NULL AND group_id IS NOT NULL)",
            name="dreams_receiver_group_xor",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    giver_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    receiver_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    group_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("groups.id"), nullable=True)

    raw_input: Mapped[str] = mapped_column(String(500), nullable=False)
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    title_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    short_message: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str] = mapped_column(String(220), nullable=False)
    story: Mapped[str] = mapped_column(Text, nullable=False)
    image_prompt: Mapped[str] = mapped_column(Text, nullable=False)

    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    main_mood: Mapped[str] = mapped_column(String(20), nullable=False)
    tags: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    image_status: Mapped[str] = mapped_column(String(20), nullable=False, default="empty")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    given_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    opened_back_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owner_main_comment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)


class DreamComment(Base):
    __tablename__ = "dream_comments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dream_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dreams.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(String(200), nullable=False)
    is_owner_main: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DreamReaction(Base):
    __tablename__ = "dream_reactions"
    __table_args__ = (UniqueConstraint("dream_id", "user_id", "reaction_type", name="dream_reactions_key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dream_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dreams.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    reaction_type: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DailyGiveLimit(Base):
    __tablename__ = "daily_give_limits"
    __table_args__ = (UniqueConstraint("user_id", "date", name="daily_give_limits_user_date_key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    given_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

