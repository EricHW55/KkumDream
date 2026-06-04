"""dedupe content reports and add per-user-per-target unique constraint

Revision ID: 202606050003
Revises: 202606050002
Create Date: 2026-06-05 00:20:00.000000
"""

from collections.abc import Sequence

from alembic import op


revision: str = "202606050003"
down_revision: str | None = "202606050002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Collapse existing duplicate reports (keep one row per reporter+target) so
    # the unique constraint can be added. Rows with NULL target_id are left
    # alone (NULLs are treated as distinct by the constraint anyway).
    op.execute(
        """
        DELETE FROM content_reports a
        USING content_reports b
        WHERE a.target_id IS NOT NULL
          AND a.reporter_id = b.reporter_id
          AND a.target_type = b.target_type
          AND a.target_id = b.target_id
          AND a.ctid > b.ctid
        """
    )
    op.create_unique_constraint(
        "content_reports_reporter_target_key",
        "content_reports",
        ["reporter_id", "target_type", "target_id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "content_reports_reporter_target_key",
        "content_reports",
        type_="unique",
    )
