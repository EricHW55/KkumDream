"""allow dream receiver with group

Revision ID: 202605090002
Revises: 202605090001
Create Date: 2026-05-09 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op


revision: str = "202605090002"
down_revision: str | None = "202605090001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("dreams_receiver_group_xor", "dreams", type_="check")


def downgrade() -> None:
    op.create_check_constraint(
        "dreams_receiver_group_xor",
        "dreams",
        "NOT (receiver_id IS NOT NULL AND group_id IS NOT NULL)",
    )
