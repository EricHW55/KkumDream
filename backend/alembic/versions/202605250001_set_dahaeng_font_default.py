"""set dahaeng dream font default

Revision ID: 202605250001
Revises: 202605240001
Create Date: 2026-05-25 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = "202605250001"
down_revision: str | None = "202605240001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


DAHAENG_DEFAULT = (
    """'{"card_color": "beige", "card_frame": "classic", "font_style": "dahaeng"}'::jsonb"""
)
ROUNDED_DEFAULT = (
    """'{"card_color": "beige", "card_frame": "classic", "font_style": "rounded"}'::jsonb"""
)


def upgrade() -> None:
    op.alter_column(
        "dreams",
        "design",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=False,
        server_default=sa.text(DAHAENG_DEFAULT),
    )


def downgrade() -> None:
    op.alter_column(
        "dreams",
        "design",
        existing_type=postgresql.JSONB(astext_type=sa.Text()),
        existing_nullable=False,
        server_default=sa.text(ROUNDED_DEFAULT),
    )
