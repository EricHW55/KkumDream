"""share model: dream_groups, receiver_label, claim tokens

Revision ID: 202605100001
Revises: 202605090003
Create Date: 2026-05-10 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "202605100001"
down_revision: str | None = "202605090003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "dreams",
        sa.Column("receiver_label", sa.String(length=50), nullable=True),
    )

    op.create_table(
        "dream_groups",
        sa.Column("dream_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["dream_id"], ["dreams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("dream_id", "group_id"),
    )
    op.create_index(
        "ix_dream_groups_group_id",
        "dream_groups",
        ["group_id"],
    )

    op.execute(
        """
        INSERT INTO dream_groups (dream_id, group_id)
        SELECT id, group_id FROM dreams WHERE group_id IS NOT NULL
        ON CONFLICT DO NOTHING
        """
    )

    op.execute(
        """
        UPDATE dreams
        SET receiver_label = COALESCE(
            (SELECT groups.name FROM groups WHERE groups.id = dreams.group_id),
            '꿈방 친구들'
        )
        WHERE status <> 'draft'
          AND receiver_id IS NULL
          AND receiver_label IS NULL
        """
    )

    op.drop_constraint("dreams_must_have_receiver_when_given", "dreams", type_="check")
    op.drop_index("ix_dreams_group_given_at", table_name="dreams")
    op.drop_constraint("dreams_group_id_fkey", "dreams", type_="foreignkey")
    op.drop_column("dreams", "group_id")

    op.create_check_constraint(
        "dreams_must_have_recipient_when_given",
        "dreams",
        "status = 'draft' OR receiver_id IS NOT NULL OR receiver_label IS NOT NULL",
    )

    op.create_table(
        "dream_claim_tokens",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("dream_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "claimed_by_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["dream_id"], ["dreams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["claimed_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("token", name="dream_claim_tokens_token_key"),
    )
    op.create_index(
        "ix_dream_claim_tokens_dream_id",
        "dream_claim_tokens",
        ["dream_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_dream_claim_tokens_dream_id", table_name="dream_claim_tokens")
    op.drop_table("dream_claim_tokens")

    op.add_column(
        "dreams",
        sa.Column("group_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.execute(
        """
        UPDATE dreams
        SET group_id = sub.group_id
        FROM (
            SELECT DISTINCT ON (dream_id) dream_id, group_id
            FROM dream_groups
            ORDER BY dream_id, added_at ASC
        ) sub
        WHERE dreams.id = sub.dream_id
        """
    )
    op.create_foreign_key(
        "dreams_group_id_fkey",
        "dreams",
        "groups",
        ["group_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_dreams_group_given_at",
        "dreams",
        ["group_id", "given_at"],
    )

    op.drop_constraint("dreams_must_have_recipient_when_given", "dreams", type_="check")
    op.create_check_constraint(
        "dreams_must_have_receiver_when_given",
        "dreams",
        "status = 'draft' OR receiver_id IS NOT NULL OR group_id IS NOT NULL",
    )

    op.drop_index("ix_dream_groups_group_id", table_name="dream_groups")
    op.drop_table("dream_groups")
    op.drop_column("dreams", "receiver_label")
