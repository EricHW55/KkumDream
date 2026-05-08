"""add user email

Revision ID: 202605090001
Revises: 202605070001
Create Date: 2026-05-09 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "202605090001"
down_revision: str | None = "202605070001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("email", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "email")
