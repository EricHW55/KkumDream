"""add rtdn events table

Revision ID: 202605310001
Revises: 202605290001
Create Date: 2026-05-31 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202605310001"
down_revision: str | None = "202605290001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "rtdn_events",
        sa.Column("message_id", sa.String(length=128), nullable=False),
        sa.Column("package_name", sa.String(length=255), nullable=True),
        sa.Column("purchase_token", sa.Text(), nullable=True),
        sa.Column("notification_type", sa.Integer(), nullable=True),
        sa.Column("raw", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("message_id"),
    )


def downgrade() -> None:
    op.drop_table("rtdn_events")
