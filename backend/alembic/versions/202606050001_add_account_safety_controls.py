"""add account deletion and safety controls

Revision ID: 202606050001
Revises: 202606010001
Create Date: 2026-06-05 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "202606050001"
down_revision: str | None = "202606010001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


DESIGN_WITH_TEXTURE_DEFAULT = (
    "'{"
    '"card_color": "beige", '
    '"card_frame": "classic", '
    '"font_style": "dahaeng", '
    '"image_texture": "oil_pastel"'
    "}'::jsonb"
)
DESIGN_WITHOUT_TEXTURE_DEFAULT = (
    "'{"
    '"card_color": "beige", '
    '"card_frame": "classic", '
    '"font_style": "dahaeng"'
    "}'::jsonb"
)


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "dreams",
        sa.Column("giver_display_name", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "dreams",
        sa.Column("receiver_display_name", sa.String(length=50), nullable=True),
    )
    op.execute(
        """
        UPDATE dreams
        SET giver_display_name = LEFT(users.nickname, 50)
        FROM users
        WHERE dreams.giver_id = users.id
          AND dreams.giver_display_name IS NULL
        """
    )
    op.execute(
        """
        UPDATE dreams
        SET receiver_display_name = LEFT(users.nickname, 50)
        FROM users
        WHERE dreams.receiver_id = users.id
          AND dreams.receiver_display_name IS NULL
        """
    )
    op.execute(
        """
        UPDATE dreams
        SET receiver_display_name = LEFT(receiver_label, 50)
        WHERE receiver_id IS NULL
          AND receiver_label IS NOT NULL
          AND receiver_display_name IS NULL
        """
    )
    op.execute(
        """
        UPDATE dreams
        SET design = design || '{"image_texture": "oil_pastel"}'::jsonb
        WHERE NOT (design ? 'image_texture')
        """
    )
    op.alter_column(
        "dreams",
        "design",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=False,
        server_default=sa.text(DESIGN_WITH_TEXTURE_DEFAULT),
    )

    op.create_table(
        "user_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("blocker_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("blocked_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "blocker_id <> blocked_user_id",
            name="user_blocks_no_self_block",
        ),
        sa.ForeignKeyConstraint(["blocked_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["blocker_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "blocker_id",
            "blocked_user_id",
            name="user_blocks_pair_key",
        ),
    )
    op.create_index("ix_user_blocks_blocker_id", "user_blocks", ["blocker_id"])
    op.create_index(
        "ix_user_blocks_blocked_user_id",
        "user_blocks",
        ["blocked_user_id"],
    )

    op.create_table(
        "content_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reporter_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("target_type", sa.String(length=20), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reported_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("reason", sa.String(length=40), nullable=False),
        sa.Column("detail", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="open", nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["reported_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reporter_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_content_reports_reporter_id",
        "content_reports",
        ["reporter_id"],
    )
    op.create_index(
        "ix_content_reports_target",
        "content_reports",
        ["target_type", "target_id"],
    )
    op.create_index(
        "ix_content_reports_reported_user_id",
        "content_reports",
        ["reported_user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_content_reports_reported_user_id", table_name="content_reports")
    op.drop_index("ix_content_reports_target", table_name="content_reports")
    op.drop_index("ix_content_reports_reporter_id", table_name="content_reports")
    op.drop_table("content_reports")

    op.drop_index("ix_user_blocks_blocked_user_id", table_name="user_blocks")
    op.drop_index("ix_user_blocks_blocker_id", table_name="user_blocks")
    op.drop_table("user_blocks")

    op.alter_column(
        "dreams",
        "design",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=False,
        server_default=sa.text(DESIGN_WITHOUT_TEXTURE_DEFAULT),
    )
    op.execute("UPDATE dreams SET design = design - 'image_texture'")
    op.drop_column("dreams", "receiver_display_name")
    op.drop_column("dreams", "giver_display_name")
    op.drop_column("users", "deleted_at")
