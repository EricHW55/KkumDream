"""initial schema

Revision ID: 202605060001
Revises:
Create Date: 2026-05-06 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "202605060001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _timestamp_column(name: str) -> sa.Column:
    return sa.Column(
        name,
        sa.DateTime(timezone=True),
        server_default=sa.func.now(),
        nullable=False,
    )


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nickname", sa.String(length=50), nullable=False),
        sa.Column("profile_image_url", sa.String(), nullable=True),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("provider_user_id", sa.String(length=255), nullable=False),
        _timestamp_column("created_at"),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider", "provider_user_id", name="users_provider_uid_key"),
    )

    op.create_table(
        "device_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("platform", sa.String(length=20), nullable=False),
        sa.Column("token", sa.String(length=512), nullable=False),
        sa.Column("enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        _timestamp_column("created_at"),
        _timestamp_column("updated_at"),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("platform", "token", name="device_tokens_platform_token_key"),
    )
    op.create_index("ix_device_tokens_user_id", "device_tokens", ["user_id"])

    op.create_table(
        "friendships",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("requester_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("receiver_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        _timestamp_column("created_at"),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("requester_id <> receiver_id", name="friendships_no_self_request"),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'rejected')",
            name="friendships_status_check",
        ),
        sa.ForeignKeyConstraint(["receiver_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "requester_id",
            "receiver_id",
            name="friendships_requester_receiver_key",
        ),
    )
    op.create_index("ix_friendships_receiver_id", "friendships", ["receiver_id"])
    op.create_index("ix_friendships_requester_id", "friendships", ["requester_id"])

    op.create_table(
        "groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        _timestamp_column("created_at"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_groups_owner_id", "groups", ["owner_id"])

    op.create_table(
        "group_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=20), server_default="member", nullable=False),
        _timestamp_column("joined_at"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("group_id", "user_id", name="group_members_group_user_key"),
    )
    op.create_index("ix_group_members_user_id", "group_members", ["user_id"])

    op.create_table(
        "dreams",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("giver_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("receiver_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("raw_input", sa.String(length=500), nullable=False),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("title_visible", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("short_message", sa.String(length=120), nullable=False),
        sa.Column("summary", sa.String(length=220), nullable=False),
        sa.Column("story", sa.Text(), nullable=False),
        sa.Column("image_prompt", sa.Text(), nullable=False),
        sa.Column("image_url", sa.Text(), nullable=True),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("main_mood", sa.String(length=20), nullable=False),
        sa.Column(
            "tags",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'[]'::jsonb"),
            nullable=False,
        ),
        sa.Column("status", sa.String(length=20), server_default="draft", nullable=False),
        sa.Column("image_status", sa.String(length=20), server_default="empty", nullable=False),
        _timestamp_column("created_at"),
        sa.Column("given_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("opened_back_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("owner_main_comment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.CheckConstraint(
            "NOT (receiver_id IS NOT NULL AND group_id IS NOT NULL)",
            name="dreams_receiver_group_xor",
        ),
        sa.CheckConstraint(
            "image_status IN ('empty', 'queued', 'generating', 'ready', 'failed')",
            name="dreams_image_status_check",
        ),
        sa.CheckConstraint(
            "status = 'draft' OR receiver_id IS NOT NULL OR group_id IS NOT NULL",
            name="dreams_must_have_receiver_when_given",
        ),
        sa.CheckConstraint(
            "status IN ('draft', 'given', 'opened', 'replied')",
            name="dreams_status_check",
        ),
        sa.ForeignKeyConstraint(["giver_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
        sa.ForeignKeyConstraint(["receiver_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_dreams_giver_status_given_at", "dreams", ["giver_id", "status", "given_at"])
    op.create_index("ix_dreams_group_given_at", "dreams", ["group_id", "given_at"])
    op.create_index(
        "ix_dreams_receiver_status_given_at",
        "dreams",
        ["receiver_id", "status", "given_at"],
    )

    op.create_table(
        "ai_generation_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dream_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("generation_type", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("attempt_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("max_attempts", sa.Integer(), server_default=sa.text("2"), nullable=False),
        sa.Column(
            "payload",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
        _timestamp_column("created_at"),
        _timestamp_column("updated_at"),
        sa.ForeignKeyConstraint(["dream_id"], ["dreams.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_generation_jobs_dream_id", "ai_generation_jobs", ["dream_id"])
    op.create_index(
        "ix_ai_generation_jobs_status_created_at",
        "ai_generation_jobs",
        ["status", "created_at"],
    )

    op.create_table(
        "ai_generation_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dream_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("model_name", sa.String(length=80), nullable=False),
        sa.Column("generation_type", sa.String(length=20), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=True),
        sa.Column("cost_estimate", sa.Numeric(precision=10, scale=6), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        _timestamp_column("created_at"),
        sa.ForeignKeyConstraint(["dream_id"], ["dreams.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_generation_logs_dream_id", "ai_generation_logs", ["dream_id"])
    op.create_index(
        "ix_ai_generation_logs_user_created_at",
        "ai_generation_logs",
        ["user_id", "created_at"],
    )

    op.create_table(
        "daily_give_limits",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("given_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.CheckConstraint("given_count >= 0", name="daily_give_limits_count_check"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "date", name="daily_give_limits_user_date_key"),
    )

    op.create_table(
        "dream_comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dream_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("content", sa.String(length=200), nullable=False),
        sa.Column("is_owner_main", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        _timestamp_column("created_at"),
        _timestamp_column("updated_at"),
        sa.ForeignKeyConstraint(["dream_id"], ["dreams.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_dream_comments_dream_created_at",
        "dream_comments",
        ["dream_id", "created_at"],
    )
    op.create_index("ix_dream_comments_user_id", "dream_comments", ["user_id"])

    op.create_table(
        "dream_reactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("dream_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reaction_type", sa.String(length=30), nullable=False),
        _timestamp_column("created_at"),
        sa.ForeignKeyConstraint(["dream_id"], ["dreams.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dream_id", "user_id", "reaction_type", name="dream_reactions_key"),
    )
    op.create_index("ix_dream_reactions_dream_id", "dream_reactions", ["dream_id"])
    op.create_index("ix_dream_reactions_user_id", "dream_reactions", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_dream_reactions_user_id", table_name="dream_reactions")
    op.drop_index("ix_dream_reactions_dream_id", table_name="dream_reactions")
    op.drop_table("dream_reactions")
    op.drop_index("ix_dream_comments_user_id", table_name="dream_comments")
    op.drop_index("ix_dream_comments_dream_created_at", table_name="dream_comments")
    op.drop_table("dream_comments")
    op.drop_table("daily_give_limits")
    op.drop_index("ix_ai_generation_logs_user_created_at", table_name="ai_generation_logs")
    op.drop_index("ix_ai_generation_logs_dream_id", table_name="ai_generation_logs")
    op.drop_table("ai_generation_logs")
    op.drop_index("ix_ai_generation_jobs_status_created_at", table_name="ai_generation_jobs")
    op.drop_index("ix_ai_generation_jobs_dream_id", table_name="ai_generation_jobs")
    op.drop_table("ai_generation_jobs")
    op.drop_index("ix_dreams_receiver_status_given_at", table_name="dreams")
    op.drop_index("ix_dreams_group_given_at", table_name="dreams")
    op.drop_index("ix_dreams_giver_status_given_at", table_name="dreams")
    op.drop_table("dreams")
    op.drop_index("ix_group_members_user_id", table_name="group_members")
    op.drop_table("group_members")
    op.drop_index("ix_groups_owner_id", table_name="groups")
    op.drop_table("groups")
    op.drop_index("ix_friendships_requester_id", table_name="friendships")
    op.drop_index("ix_friendships_receiver_id", table_name="friendships")
    op.drop_table("friendships")
    op.drop_index("ix_device_tokens_user_id", table_name="device_tokens")
    op.drop_table("device_tokens")
    op.drop_table("users")
