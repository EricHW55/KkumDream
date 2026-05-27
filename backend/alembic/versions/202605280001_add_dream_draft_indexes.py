"""add dream draft indexes

Revision ID: 202605280001
Revises: 202605270001
Create Date: 2026-05-28 12:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "202605280001"
down_revision: str | None = "202605270001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_dreams_giver_status_created_at",
        "dreams",
        ["giver_id", "status", "created_at"],
    )
    op.create_index(
        "ix_dreams_status_created_at",
        "dreams",
        ["status", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_dreams_status_created_at", table_name="dreams")
    op.drop_index("ix_dreams_giver_status_created_at", table_name="dreams")
