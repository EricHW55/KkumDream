"""add report auto-hide columns

Revision ID: 202606050002
Revises: 202606050001
Create Date: 2026-06-05 00:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "202606050002"
down_revision: str | None = "202606050001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "dreams",
        sa.Column("hidden_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "dream_comments",
        sa.Column("hidden_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("dream_comments", "hidden_at")
    op.drop_column("dreams", "hidden_at")
