"""add private postscript to dreams

Revision ID: 202605270001
Revises: 202605250001
Create Date: 2026-05-27 10:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "202605270001"
down_revision: str | None = "202605250001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "dreams",
        sa.Column("private_postscript", sa.String(length=120), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("dreams", "private_postscript")
