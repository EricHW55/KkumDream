"""add flattened front-preview columns to dreams

Revision ID: 202606090001
Revises: 202606050003
Create Date: 2026-06-09 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "202606090001"
down_revision: str | None = "202606050003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("dreams", sa.Column("front_preview_url", sa.Text(), nullable=True))
    op.add_column(
        "dreams", sa.Column("front_preview_version", sa.Integer(), nullable=True)
    )
    op.add_column(
        "dreams", sa.Column("front_preview_hash", sa.String(length=64), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("dreams", "front_preview_hash")
    op.drop_column("dreams", "front_preview_version")
    op.drop_column("dreams", "front_preview_url")
