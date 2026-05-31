from datetime import UTC, datetime, timedelta
from hashlib import sha256
from uuid import UUID

import pytest

from app.services import billing_service
from app.services.billing_service import BillingVerificationError, SubscriptionStatus
from app.models.subscription import STORE_GOOGLE_PLAY


def test_expected_obfuscated_account_id_matches_mobile_contract() -> None:
    user_id = UUID("00000000-0000-0000-0000-000000000001")
    expected = sha256(f"kkumdream-google-play-account:{user_id}".encode()).hexdigest()

    assert billing_service.expected_obfuscated_account_id(user_id) == expected


def test_validate_verified_status_rejects_wrong_product() -> None:
    user_id = UUID("00000000-0000-0000-0000-000000000001")
    status = SubscriptionStatus(
        store=STORE_GOOGLE_PLAY,
        product_id="other_product",
        state="active",
        expires_at=datetime.now(UTC) + timedelta(days=30),
        auto_renewing=True,
        obfuscated_external_account_id=billing_service.expected_obfuscated_account_id(user_id),
        original_transaction_id=None,
        app_account_token=None,
        raw={},
    )

    with pytest.raises(BillingVerificationError):
        billing_service.validate_verified_status(user_id, status)


def test_validate_verified_status_rejects_wrong_account() -> None:
    user_id = UUID("00000000-0000-0000-0000-000000000001")
    status = SubscriptionStatus(
        store=STORE_GOOGLE_PLAY,
        product_id="kkumdream_pass_monthly",
        state="active",
        expires_at=datetime.now(UTC) + timedelta(days=30),
        auto_renewing=True,
        obfuscated_external_account_id="wrong",
        original_transaction_id=None,
        app_account_token=None,
        raw={},
    )

    with pytest.raises(BillingVerificationError):
        billing_service.validate_verified_status(user_id, status)
