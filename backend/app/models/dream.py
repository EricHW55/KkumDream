import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

DEFAULT_DREAM_DESIGN = {
    "card_color": "beige",
    "card_frame": "classic",
    "font_style": "dahaeng",
}


class Dream(Base):
    __tablename__ = "dreams"
    __table_args__ = (
        CheckConstraint(
            "status = 'draft' OR receiver_id IS NOT NULL OR receiver_label IS NOT NULL",
            name="dreams_must_have_recipient_when_given",
        ),
        CheckConstraint(
            "status IN ('draft', 'given', 'opened', 'replied')",
            name="dreams_status_check",
        ),
        CheckConstraint(
            "image_status IN ('empty', 'queued', 'generating', 'ready', 'failed')",
            name="dreams_image_status_check",
        ),
        Index("ix_dreams_giver_status_given_at", "giver_id", "status", "given_at"),
        Index("ix_dreams_receiver_status_given_at", "receiver_id", "status", "given_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    giver_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    receiver_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    receiver_label: Mapped[str | None] = mapped_column(String(50), nullable=True)

    raw_input: Mapped[str] = mapped_column(String(500), nullable=False)
    title: Mapped[str] = mapped_column(String(80), nullable=False)
    title_visible: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    short_message: Mapped[str] = mapped_column(String(120), nullable=False)
    summary: Mapped[str] = mapped_column(String(220), nullable=False)
    story: Mapped[str] = mapped_column(Text, nullable=False)
    image_prompt: Mapped[str] = mapped_column(Text, nullable=False)

    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    main_mood: Mapped[str] = mapped_column(String(20), nullable=False)
    tags: Mapped[list[str]] = mapped_column(
        JSONB, nullable=False, default=list, server_default=text("'[]'::jsonb")
    )
    design: Mapped[dict[str, str]] = mapped_column(
        JSONB,
        nullable=False,
        default=lambda: DEFAULT_DREAM_DESIGN.copy(),
        server_default=text(
            """'{"card_color": "beige", "card_frame": "classic", "font_style": "dahaeng"}'::jsonb"""
        ),
    )

    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft", server_default="draft"
    )
    image_status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="empty", server_default="empty"
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    given_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    opened_back_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    owner_main_comment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )


class DreamComment(Base):
    __tablename__ = "dream_comments"
    __table_args__ = (
        Index("ix_dream_comments_dream_created_at", "dream_id", "created_at"),
        Index("ix_dream_comments_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dream_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dreams.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    content: Mapped[str] = mapped_column(String(200), nullable=False)
    is_owner_main: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DreamGroup(Base):
    __tablename__ = "dream_groups"
    __table_args__ = (
        Index("ix_dream_groups_group_id", "group_id"),
    )

    dream_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("dreams.id", ondelete="CASCADE"),
        primary_key=True,
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DreamClaimToken(Base):
    __tablename__ = "dream_claim_tokens"
    __table_args__ = (
        UniqueConstraint("token", name="dream_claim_tokens_token_key"),
        Index("ix_dream_claim_tokens_dream_id", "dream_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dream_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("dreams.id", ondelete="CASCADE"),
        nullable=False,
    )
    token: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    claimed_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )


class DreamReaction(Base):
    __tablename__ = "dream_reactions"
    __table_args__ = (
        UniqueConstraint("dream_id", "user_id", "reaction_type", name="dream_reactions_key"),
        Index("ix_dream_reactions_dream_id", "dream_id"),
        Index("ix_dream_reactions_user_id", "user_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dream_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("dreams.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    reaction_type: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DailyGiveLimit(Base):
    __tablename__ = "daily_give_limits"
    __table_args__ = (
        UniqueConstraint("user_id", "date", name="daily_give_limits_user_date_key"),
        CheckConstraint("given_count >= 0", name="daily_give_limits_count_check"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    given_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default=text("0")
    )
