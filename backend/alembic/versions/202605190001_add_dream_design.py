"""add dream design options

Revision ID: 202605190001
Revises: 202605100001
Create Date: 2026-05-19 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "202605190001"
down_revision: str | None = "202605100001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


DEFAULT_DESIGN = (
    """'{"card_color": "ivory", "card_frame": "classic", "font_style": "rounded"}'::jsonb"""
)


def upgrade() -> None:
    op.add_column(
        "dreams",
        sa.Column(
            "design",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text(DEFAULT_DESIGN),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("dreams", "design")
