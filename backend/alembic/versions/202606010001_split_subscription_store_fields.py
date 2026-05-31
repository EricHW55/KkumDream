"""split subscription store fields

Revision ID: 202606010001
Revises: 202605310001
Create Date: 2026-06-01 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "202606010001"
down_revision: str | None = "202605310001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STORE_GOOGLE_PLAY = "google_play"


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column(
            "store",
            sa.String(length=20),
            nullable=False,
            server_default=STORE_GOOGLE_PLAY,
        ),
    )
    op.add_column(
        "subscriptions",
        sa.Column("original_transaction_id", sa.String(length=191), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("app_account_token", sa.String(length=191), nullable=True),
    )
    op.add_column(
        "subscriptions",
        sa.Column("latest_notification_subtype", sa.String(length=64), nullable=True),
    )
    op.alter_column("subscriptions", "purchase_token", existing_type=sa.Text(), nullable=True)
    op.drop_constraint(
        "subscriptions_purchase_token_key",
        "subscriptions",
        type_="unique",
    )
    op.drop_index("ix_subscriptions_purchase_token", table_name="subscriptions")
    op.create_unique_constraint(
        "subscriptions_store_purchase_token_key",
        "subscriptions",
        ["store", "purchase_token"],
    )
    op.create_unique_constraint(
        "subscriptions_store_original_transaction_id_key",
        "subscriptions",
        ["store", "original_transaction_id"],
    )
    op.create_index(
        "ix_subscriptions_store_purchase_token",
        "subscriptions",
        ["store", "purchase_token"],
    )
    op.create_index(
        "ix_subscriptions_store_original_transaction_id",
        "subscriptions",
        ["store", "original_transaction_id"],
    )

    op.add_column(
        "rtdn_events",
        sa.Column(
            "store",
            sa.String(length=20),
            nullable=False,
            server_default=STORE_GOOGLE_PLAY,
        ),
    )


def downgrade() -> None:
    op.drop_column("rtdn_events", "store")

    op.drop_index(
        "ix_subscriptions_store_original_transaction_id",
        table_name="subscriptions",
    )
    op.drop_index("ix_subscriptions_store_purchase_token", table_name="subscriptions")
    op.drop_constraint(
        "subscriptions_store_original_transaction_id_key",
        "subscriptions",
        type_="unique",
    )
    op.drop_constraint(
        "subscriptions_store_purchase_token_key",
        "subscriptions",
        type_="unique",
    )
    op.create_unique_constraint(
        "subscriptions_purchase_token_key",
        "subscriptions",
        ["purchase_token"],
    )
    op.create_index(
        "ix_subscriptions_purchase_token",
        "subscriptions",
        ["purchase_token"],
    )
    op.alter_column("subscriptions", "purchase_token", existing_type=sa.Text(), nullable=False)
    op.drop_column("subscriptions", "latest_notification_subtype")
    op.drop_column("subscriptions", "app_account_token")
    op.drop_column("subscriptions", "original_transaction_id")
    op.drop_column("subscriptions", "store")
