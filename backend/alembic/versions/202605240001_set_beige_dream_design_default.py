"""set beige dream design default

Revision ID: 202605240001
Revises: 202605190001
Create Date: 2026-05-24 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "202605240001"
down_revision: str | None = "202605190001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


BEIGE_DEFAULT = (
    """'{"card_color": "beige", "card_frame": "classic", "font_style": "rounded"}'::jsonb"""
)
IVORY_DEFAULT = (
    """'{"card_color": "ivory", "card_frame": "classic", "font_style": "rounded"}'::jsonb"""
)


def upgrade() -> None:
    op.alter_column(
        "dreams",
        "design",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=False,
        server_default=sa.text(BEIGE_DEFAULT),
    )


def downgrade() -> None:
    op.alter_column(
        "dreams",
        "design",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=False,
        server_default=sa.text(IVORY_DEFAULT),
    )
