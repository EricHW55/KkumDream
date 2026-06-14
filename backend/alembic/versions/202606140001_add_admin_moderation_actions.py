"""Add admin moderation actions.

Revision ID: 202606140001
Revises: 202606130001
Create Date: 2026-06-14
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "202606140001"
down_revision: str | None = "202606130001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("suspended_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "content_moderation_actions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("report_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column("target_type", sa.String(length=20), nullable=True),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reported_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("duration_days", sa.Integer(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("admin_label", sa.String(length=80), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["report_id"], ["content_reports.id"]),
        sa.ForeignKeyConstraint(["reported_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_content_moderation_actions_report_id",
        "content_moderation_actions",
        ["report_id"],
    )
    op.create_index(
        "ix_content_moderation_actions_target",
        "content_moderation_actions",
        ["target_type", "target_id"],
    )
    op.create_index(
        "ix_content_moderation_actions_reported_user_id",
        "content_moderation_actions",
        ["reported_user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_content_moderation_actions_reported_user_id",
        table_name="content_moderation_actions",
    )
    op.drop_index(
        "ix_content_moderation_actions_target",
        table_name="content_moderation_actions",
    )
    op.drop_index(
        "ix_content_moderation_actions_report_id",
        table_name="content_moderation_actions",
    )
    op.drop_table("content_moderation_actions")
    op.drop_column("users", "suspended_until")
