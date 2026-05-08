"""cleanup empty rooms

Revision ID: 202605090003
Revises: 202605090002
Create Date: 2026-05-09 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op


revision: str = "202605090003"
down_revision: str | None = "202605090002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("group_members_group_id_fkey", "group_members", type_="foreignkey")
    op.create_foreign_key(
        "group_members_group_id_fkey",
        "group_members",
        "groups",
        ["group_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.drop_constraint("dreams_group_id_fkey", "dreams", type_="foreignkey")
    op.create_foreign_key(
        "dreams_group_id_fkey",
        "dreams",
        "groups",
        ["group_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.execute(
        """
        UPDATE dreams
        SET group_id = NULL
        WHERE group_id IN (
            SELECT groups.id
            FROM groups
            WHERE NOT EXISTS (
                SELECT 1 FROM group_members
                WHERE group_members.group_id = groups.id
            )
        )
        AND (receiver_id IS NOT NULL OR status = 'draft')
        """
    )
    op.execute(
        """
        DELETE FROM groups
        WHERE NOT EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = groups.id
        )
        AND NOT EXISTS (
            SELECT 1 FROM dreams
            WHERE dreams.group_id = groups.id
            AND dreams.receiver_id IS NULL
            AND dreams.status != 'draft'
        )
        """
    )
    op.execute(
        """
        UPDATE groups
        SET invite_code = 'CLOSED-' || substring(replace(id::text, '-', '') FROM 1 FOR 9)
        WHERE NOT EXISTS (
            SELECT 1 FROM group_members
            WHERE group_members.group_id = groups.id
        )
        AND EXISTS (
            SELECT 1 FROM dreams
            WHERE dreams.group_id = groups.id
            AND dreams.receiver_id IS NULL
            AND dreams.status != 'draft'
        )
        AND invite_code NOT LIKE 'CLOSED-%'
        """
    )


def downgrade() -> None:
    op.drop_constraint("dreams_group_id_fkey", "dreams", type_="foreignkey")
    op.create_foreign_key(
        "dreams_group_id_fkey",
        "dreams",
        "groups",
        ["group_id"],
        ["id"],
    )
    op.drop_constraint("group_members_group_id_fkey", "group_members", type_="foreignkey")
    op.create_foreign_key(
        "group_members_group_id_fkey",
        "group_members",
        "groups",
        ["group_id"],
        ["id"],
    )
