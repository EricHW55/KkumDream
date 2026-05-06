"""add group invite codes

Revision ID: 202605070001
Revises: 202605060001
Create Date: 2026-05-07 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202605070001"
down_revision: str | None = "202605060001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("groups", sa.Column("invite_code", sa.String(length=16), nullable=True))
    op.execute(
        """
        UPDATE groups
        SET invite_code = 'DREAM-' || upper(substr(md5(id::text), 1, 6))
        WHERE invite_code IS NULL
        """
    )
    op.alter_column("groups", "invite_code", nullable=False)
    op.create_unique_constraint("groups_invite_code_key", "groups", ["invite_code"])


def downgrade() -> None:
    op.drop_constraint("groups_invite_code_key", "groups", type_="unique")
    op.drop_column("groups", "invite_code")
