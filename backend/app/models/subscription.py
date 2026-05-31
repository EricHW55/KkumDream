import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base

# Normalized subscription states derived from Google Play subscriptionsv2.
# Entitlement is granted while state is in ENTITLED_STATES and expires_at is in the future.
ENTITLED_STATES = ("active", "in_grace", "canceled")


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        UniqueConstraint("user_id", name="subscriptions_user_id_key"),
        UniqueConstraint("purchase_token", name="subscriptions_purchase_token_key"),
        Index("ix_subscriptions_purchase_token", "purchase_token"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    product_id: Mapped[str] = mapped_column(String(100), nullable=False)
    purchase_token: Mapped[str] = mapped_column(Text, nullable=False)

    state: Mapped[str] = mapped_column(String(20), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    auto_renewing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    latest_notification_type: Mapped[int | None] = mapped_column(Integer, nullable=True)
    raw: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RtdnEvent(Base):
    __tablename__ = "rtdn_events"

    message_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    package_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    purchase_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    notification_type: Mapped[int | None] = mapped_column(Integer, nullable=True)
    raw: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
