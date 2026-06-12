"""Enforce one reaction per dream per user.

Revision ID: 202606130001
Revises: 202606090001
Create Date: 2026-06-12
"""

from alembic import op


revision: str = "202606130001"
down_revision: str | None = "202606090001"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.drop_constraint("dream_reactions_key", "dream_reactions", type_="unique")
    op.execute(
        """
        DELETE FROM dream_reactions
        WHERE id IN (
            SELECT id
            FROM (
                SELECT
                    id,
                    row_number() OVER (
                        PARTITION BY dream_id, user_id
                        ORDER BY created_at DESC NULLS LAST, id DESC
                    ) AS row_number
                FROM dream_reactions
            ) ranked
            WHERE ranked.row_number > 1
        )
        """
    )
    op.create_unique_constraint(
        "dream_reactions_dream_user_key",
        "dream_reactions",
        ["dream_id", "user_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "dream_reactions_dream_user_key",
        "dream_reactions",
        type_="unique",
    )
    op.create_unique_constraint(
        "dream_reactions_key",
        "dream_reactions",
        ["dream_id", "user_id", "reaction_type"],
    )
