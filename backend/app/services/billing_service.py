import asyncio
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
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.subscription import ENTITLED_STATES, Subscription

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
    product_id: str | None
    state: str
    expires_at: datetime | None
    auto_renewing: bool
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

    return SubscriptionStatus(
        product_id=product_id,
        state=state,
        expires_at=expires_at,
        auto_renewing=auto_renewing,
        raw=data,
    )


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
    session: AsyncSession, purchase_token: str
) -> Subscription | None:
    return await session.scalar(
        select(Subscription).where(Subscription.purchase_token == purchase_token)
    )


async def has_active_pass(session: AsyncSession, user_id: UUID) -> bool:
    return is_entitled(await get_subscription(session, user_id))


def _write_status(
    sub: Subscription,
    purchase_token: str,
    status: SubscriptionStatus,
    notification_type: int | None,
) -> None:
    sub.product_id = status.product_id or settings.google_play_product_id
    sub.purchase_token = purchase_token
    sub.state = status.state
    sub.expires_at = status.expires_at
    sub.auto_renewing = status.auto_renewing
    sub.latest_notification_type = notification_type
    sub.raw = status.raw
    # RTDN notificationType=12 means subscription access is revoked.
    if notification_type == 12:
        sub.state = "revoked"
        sub.expires_at = datetime.now(UTC)
        sub.auto_renewing = False


async def apply_verified_status(
    session: AsyncSession,
    user_id: UUID,
    purchase_token: str,
    status: SubscriptionStatus,
    notification_type: int | None = None,
) -> Subscription:
    """Persist a verified status, keyed by user (one subscription per user)."""
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
    sub = await get_subscription_by_token(session, purchase_token)
    if sub is None:
        return None
    status = await verify_purchase_token(purchase_token)
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
    sub = await get_subscription_by_token(session, purchase_token)
    if sub is None:
        return None
    now = datetime.now(UTC)
    sub.state = "revoked"
    sub.expires_at = now
    sub.auto_renewing = False
    sub.raw = {
        **(sub.raw or {}),
        "voided": {
            "refundType": refund_type,
            "revokedAt": now.isoformat(),
        },
    }
    await session.commit()
    await session.refresh(sub)
    return sub
