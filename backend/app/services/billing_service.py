import asyncio
import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import id_token as google_id_token
from google.oauth2 import service_account
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.subscription import (
    ENTITLED_STATES,
    RtdnEvent,
    STORE_GOOGLE_PLAY,
    Subscription,
)

logger = logging.getLogger(__name__)

_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
_API_BASE = "https://androidpublisher.googleapis.com"

_STATE_MAP = {
    "SUBSCRIPTION_STATE_ACTIVE": "active",
    "SUBSCRIPTION_STATE_CANCELED": "canceled",
    "SUBSCRIPTION_STATE_IN_GRACE_PERIOD": "in_grace",
    "SUBSCRIPTION_STATE_ON_HOLD": "on_hold",
    "SUBSCRIPTION_STATE_PAUSED": "paused",
    "SUBSCRIPTION_STATE_EXPIRED": "expired",
    "SUBSCRIPTION_STATE_PENDING": "pending",
    "SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED": "canceled",
    "SUBSCRIPTION_STATE_REVOKED": "revoked",
}


class BillingConfigError(RuntimeError):
    """Service account credentials are missing or invalid."""


class BillingVerificationError(RuntimeError):
    """Google Play rejected the purchase token or returned an error."""


@dataclass
class SubscriptionStatus:
    store: str
    product_id: str | None
    state: str
    expires_at: datetime | None
    auto_renewing: bool
    obfuscated_external_account_id: str | None
    original_transaction_id: str | None
    app_account_token: str | None
    raw: dict


_credentials: service_account.Credentials | None = None


def _get_credentials() -> service_account.Credentials:
    global _credentials
    if _credentials is not None:
        return _credentials
    try:
        if settings.google_play_service_account_json:
            info = json.loads(settings.google_play_service_account_json)
            _credentials = service_account.Credentials.from_service_account_info(
                info, scopes=[_SCOPE]
            )
        elif settings.google_play_service_account_file:
            _credentials = service_account.Credentials.from_service_account_file(
                settings.google_play_service_account_file, scopes=[_SCOPE]
            )
        else:
            raise BillingConfigError("Google Play service account is not configured")
    except (ValueError, KeyError, OSError) as exc:
        raise BillingConfigError("Invalid service account credentials") from exc
    return _credentials


def _fetch_access_token() -> str:
    creds = _get_credentials()
    creds.refresh(GoogleAuthRequest())
    return creds.token


def _parse_rfc3339(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _normalize(data: dict) -> SubscriptionStatus:
    state = _STATE_MAP.get(data.get("subscriptionState", ""), "unknown")

    expires_at: datetime | None = None
    product_id: str | None = None
    auto_renewing = False
    for item in data.get("lineItems") or []:
        expiry = _parse_rfc3339(item.get("expiryTime"))
        if expiry and (expires_at is None or expiry > expires_at):
            expires_at = expiry
        product_id = item.get("productId") or product_id
        plan = item.get("autoRenewingPlan")
        if plan:
            auto_renewing = bool(plan.get("autoRenewEnabled", False))

    identifiers = data.get("externalAccountIdentifiers") or {}

    return SubscriptionStatus(
        store=STORE_GOOGLE_PLAY,
        product_id=product_id,
        state=state,
        expires_at=expires_at,
        auto_renewing=auto_renewing,
        obfuscated_external_account_id=identifiers.get("obfuscatedExternalAccountId"),
        original_transaction_id=None,
        app_account_token=None,
        raw=data,
    )


def allowed_google_product_ids() -> set[str]:
    return {settings.google_play_product_id, *settings.google_play_product_ids}


def expected_obfuscated_account_id(user_id: UUID) -> str:
    value = f"kkumdream-google-play-account:{user_id}"
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def validate_verified_status(user_id: UUID, status: SubscriptionStatus) -> None:
    if status.product_id not in allowed_google_product_ids():
        raise BillingVerificationError("Verified purchase product is not allowed")

    expected_account_id = expected_obfuscated_account_id(user_id)
    if status.obfuscated_external_account_id != expected_account_id:
        raise BillingVerificationError("Verified purchase account does not match this user")


async def verify_purchase_token(purchase_token: str) -> SubscriptionStatus:
    """Ask Google Play for the authoritative state of a subscription token.

    Never trust a client-supplied state; this is the only source of truth.
    """
    token = await asyncio.to_thread(_fetch_access_token)
    url = (
        f"{_API_BASE}/androidpublisher/v3/applications/"
        f"{settings.android_package_name}/purchases/subscriptionsv2/tokens/{purchase_token}"
    )
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})

    if resp.status_code != 200:
        raise BillingVerificationError(f"Play API {resp.status_code}: {resp.text}")

    return _normalize(resp.json())


def verify_pubsub_token(token: str) -> None:
    """Verify an OIDC token attached to a Pub/Sub push request.

    Confirms the request genuinely originates from our RTDN push subscription
    and was not forged against the public endpoint.
    """
    if not settings.google_play_rtdn_audience:
        raise BillingConfigError("GOOGLE_PLAY_RTDN_AUDIENCE is not configured")
    claims = google_id_token.verify_oauth2_token(
        token, GoogleAuthRequest(), settings.google_play_rtdn_audience
    )
    expected = settings.google_play_rtdn_service_account
    if expected and claims.get("email") != expected:
        raise BillingVerificationError("OIDC token email mismatch")


def is_entitled(sub: Subscription | None) -> bool:
    if sub is None or sub.state not in ENTITLED_STATES or sub.expires_at is None:
        return False
    return sub.expires_at > datetime.now(UTC)


async def get_subscription(session: AsyncSession, user_id: UUID) -> Subscription | None:
    return await session.scalar(select(Subscription).where(Subscription.user_id == user_id))


async def get_subscription_by_token(
    session: AsyncSession,
    purchase_token: str,
    *,
    store: str = STORE_GOOGLE_PLAY,
) -> Subscription | None:
    return await session.scalar(
        select(Subscription).where(
            Subscription.store == store,
            Subscription.purchase_token == purchase_token,
        )
    )


async def get_subscription_by_original_transaction_id(
    session: AsyncSession,
    original_transaction_id: str,
    *,
    store: str,
) -> Subscription | None:
    return await session.scalar(
        select(Subscription).where(
            Subscription.store == store,
            Subscription.original_transaction_id == original_transaction_id,
        )
    )


async def has_active_pass(session: AsyncSession, user_id: UUID) -> bool:
    return is_entitled(await get_subscription(session, user_id))


async def has_rtdn_event(session: AsyncSession, message_id: str) -> bool:
    stmt = select(RtdnEvent.message_id).where(RtdnEvent.message_id == message_id)
    return await session.scalar(stmt) is not None


async def record_rtdn_event(
    session: AsyncSession,
    *,
    message_id: str,
    package_name: str | None,
    purchase_token: str | None,
    notification_type: int | None,
    raw: dict,
) -> None:
    session.add(
        RtdnEvent(
            message_id=message_id,
            store=STORE_GOOGLE_PLAY,
            package_name=package_name,
            purchase_token=purchase_token,
            notification_type=notification_type,
            raw=raw,
        )
    )
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()


def _write_status(
    sub: Subscription,
    purchase_token: str | None,
    status: SubscriptionStatus,
    notification_type: int | None,
) -> None:
    sub.store = status.store
    sub.product_id = status.product_id or settings.google_play_product_id
    sub.purchase_token = purchase_token
    sub.original_transaction_id = status.original_transaction_id
    sub.app_account_token = status.app_account_token
    sub.state = status.state
    sub.expires_at = status.expires_at
    sub.auto_renewing = status.auto_renewing
    sub.latest_notification_type = notification_type
    sub.latest_notification_subtype = None
    sub.raw = status.raw
    # RTDN notificationType=12 means subscription access is revoked.
    if notification_type == 12:
        sub.state = "revoked"
        sub.expires_at = datetime.now(UTC)
        sub.auto_renewing = False


async def apply_verified_status(
    session: AsyncSession,
    user_id: UUID,
    purchase_token: str | None,
    status: SubscriptionStatus,
    notification_type: int | None = None,
) -> Subscription:
    """Persist a verified status, keyed by user (one subscription per user)."""
    validate_verified_status(user_id, status)
    sub = await session.scalar(select(Subscription).where(Subscription.user_id == user_id))
    if sub is None:
        sub = Subscription(user_id=user_id)
        session.add(sub)
    _write_status(sub, purchase_token, status, notification_type)
    await session.commit()
    await session.refresh(sub)
    return sub


async def refresh_subscription_by_token(
    session: AsyncSession,
    purchase_token: str,
    notification_type: int | None = None,
) -> Subscription | None:
    """Re-verify a token (e.g. on an RTDN event) and update its row.

    Returns None when the token maps to no known user — RTDN carries only the
    token, so a purchase we have never seen via /verify cannot be attributed.
    """
    sub = await get_subscription_by_token(
        session,
        purchase_token,
        store=STORE_GOOGLE_PLAY,
    )
    if sub is None:
        return None
    status = await verify_purchase_token(purchase_token)
    try:
        validate_verified_status(sub.user_id, status)
    except BillingVerificationError as exc:
        _revoke_subscription(sub, reason=str(exc))
        await session.commit()
        await session.refresh(sub)
        return sub
    _write_status(sub, purchase_token, status, notification_type)
    await session.commit()
    await session.refresh(sub)
    return sub


async def revoke_subscription_by_token(
    session: AsyncSession,
    purchase_token: str,
    *,
    refund_type: int | None = None,
) -> Subscription | None:
    """Immediately revoke entitlement for a voided purchase token."""
    sub = await get_subscription_by_token(
        session,
        purchase_token,
        store=STORE_GOOGLE_PLAY,
    )
    if sub is None:
        return None
    _revoke_subscription(
        sub,
        reason="voided_purchase",
        raw_extra={"refundType": refund_type},
    )
    await session.commit()
    await session.refresh(sub)
    return sub


def _revoke_subscription(
    sub: Subscription,
    *,
    reason: str,
    raw_extra: dict | None = None,
) -> None:
    now = datetime.now(UTC)
    sub.state = "revoked"
    sub.expires_at = now
    sub.auto_renewing = False
    sub.raw = {
        **(sub.raw or {}),
        "revocation": {
            **(raw_extra or {}),
            "reason": reason,
            "revokedAt": now.isoformat(),
        },
    }


async def reconcile_active_subscriptions(session: AsyncSession) -> int:
    now = datetime.now(UTC)
    result = await session.scalars(
        select(Subscription).where(
            Subscription.store == STORE_GOOGLE_PLAY,
            Subscription.state.in_(ENTITLED_STATES),
            Subscription.expires_at.is_not(None),
            Subscription.expires_at > now,
        )
    )
    subscriptions = list(result)
    refreshed = 0
    for sub in subscriptions:
        status = await verify_purchase_token(sub.purchase_token)
        try:
            validate_verified_status(sub.user_id, status)
        except BillingVerificationError as exc:
            _revoke_subscription(sub, reason=str(exc))
        else:
            _write_status(sub, sub.purchase_token, status, sub.latest_notification_type)
        refreshed += 1

    if refreshed:
        await session.commit()
    return refreshed
