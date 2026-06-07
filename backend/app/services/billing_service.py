import asyncio
import base64
import hashlib
import json
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from time import time
from uuid import UUID

import httpx
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2 import id_token as google_id_token
from google.oauth2 import service_account
from jose import jwt as jose_jwt
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.subscription import (
    ENTITLED_STATES,
    RtdnEvent,
    STORE_APP_STORE,
    STORE_GOOGLE_PLAY,
    Subscription,
)

logger = logging.getLogger(__name__)

_SCOPE = "https://www.googleapis.com/auth/androidpublisher"
_API_BASE = "https://androidpublisher.googleapis.com"
_APPLE_PRODUCTION_API_BASE = "https://api.storekit.apple.com"
_APPLE_SANDBOX_API_BASE = "https://api.storekit-sandbox.apple.com"
_APPLE_AUDIENCE = "appstoreconnect-v1"

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


def _parse_apple_timestamp(value: int | str | None) -> datetime | None:
    if value is None:
        return None
    try:
        milliseconds = int(value)
    except (TypeError, ValueError):
        return None
    return datetime.fromtimestamp(milliseconds / 1000, UTC)


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(value + padding)


def _decode_jws_part(value: str) -> dict:
    return json.loads(_b64url_decode(value))


def _verify_apple_signed_jws(signed_jws: str) -> dict:
    try:
        header_b64, payload_b64, signature_b64 = signed_jws.split(".")
    except ValueError as exc:
        raise BillingVerificationError("Invalid Apple signed transaction payload") from exc

    header = _decode_jws_part(header_b64)
    if header.get("alg") != "ES256":
        raise BillingVerificationError("Unsupported Apple signature algorithm")

    cert_chain = header.get("x5c") or []
    if not cert_chain:
        raise BillingVerificationError("Apple signed payload is missing certificate chain")

    try:
        leaf = x509.load_der_x509_certificate(base64.b64decode(cert_chain[0]))
        if len(cert_chain) > 1:
            intermediate = x509.load_der_x509_certificate(base64.b64decode(cert_chain[1]))
            intermediate.public_key().verify(
                leaf.signature,
                leaf.tbs_certificate_bytes,
                ec.ECDSA(leaf.signature_hash_algorithm),
            )
        if len(cert_chain) > 2:
            root = x509.load_der_x509_certificate(base64.b64decode(cert_chain[2]))
            root.public_key().verify(
                intermediate.signature,
                intermediate.tbs_certificate_bytes,
                ec.ECDSA(intermediate.signature_hash_algorithm),
            )
    except Exception as exc:  # noqa: BLE001
        raise BillingVerificationError("Apple certificate chain validation failed") from exc

    signature = _b64url_decode(signature_b64)
    if len(signature) != 64:
        raise BillingVerificationError("Apple signature length is invalid")

    r = int.from_bytes(signature[:32], "big")
    s = int.from_bytes(signature[32:], "big")
    der_signature = encode_dss_signature(r, s)

    signed_content = f"{header_b64}.{payload_b64}".encode("utf-8")
    try:
        leaf.public_key().verify(
            der_signature,
            signed_content,
            ec.ECDSA(hashes.SHA256()),
        )
    except Exception as exc:  # noqa: BLE001
        raise BillingVerificationError("Apple payload signature verification failed") from exc

    return _decode_jws_part(payload_b64)


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


def _get_apple_private_key() -> str:
    if not settings.apple_iap_private_key:
        raise BillingConfigError("APPLE_IAP_PRIVATE_KEY is not configured")
    return settings.apple_iap_private_key.replace("\\n", "\n").strip()


def _build_apple_server_api_token() -> str:
    if not settings.apple_iap_issuer_id:
        raise BillingConfigError("APPLE_IAP_ISSUER_ID is not configured")
    if not settings.apple_iap_key_id:
        raise BillingConfigError("APPLE_IAP_KEY_ID is not configured")

    now = int(time())
    payload = {
        "iss": settings.apple_iap_issuer_id,
        "iat": now,
        "exp": now + 300,
        "aud": _APPLE_AUDIENCE,
        "bid": settings.ios_bundle_id,
    }
    headers = {"kid": settings.apple_iap_key_id, "typ": "JWT"}
    return jose_jwt.encode(
        payload,
        _get_apple_private_key(),
        algorithm="ES256",
        headers=headers,
    )


def _apple_api_base(environment: str | None) -> str:
    if str(environment or "").lower() == "sandbox":
        return _APPLE_SANDBOX_API_BASE
    return _APPLE_PRODUCTION_API_BASE


def _normalize_apple_transaction(data: dict) -> SubscriptionStatus:
    expires_at = _parse_apple_timestamp(data.get("expiresDate"))
    revocation_date = _parse_apple_timestamp(data.get("revocationDate"))
    now = datetime.now(UTC)

    if revocation_date is not None:
        state = "revoked"
    elif expires_at is not None and expires_at <= now:
        state = "expired"
    else:
        state = "active"

    return SubscriptionStatus(
        store=STORE_APP_STORE,
        product_id=data.get("productId"),
        state=state,
        expires_at=expires_at,
        auto_renewing=False,
        obfuscated_external_account_id=None,
        original_transaction_id=data.get("originalTransactionId"),
        app_account_token=data.get("appAccountToken"),
        raw=data,
    )


def allowed_google_product_ids() -> set[str]:
    return {settings.google_play_product_id, *settings.google_play_product_ids}


def allowed_ios_product_ids() -> set[str]:
    return {settings.ios_product_id, *settings.ios_product_ids}


def expected_obfuscated_account_id(user_id: UUID) -> str:
    value = f"kkumdream-google-play-account:{user_id}"
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def expected_app_account_token(user_id: UUID) -> str:
    return str(user_id)


def validate_verified_status(user_id: UUID, status: SubscriptionStatus) -> None:
    if status.store == STORE_GOOGLE_PLAY:
        if status.product_id not in allowed_google_product_ids():
            raise BillingVerificationError("Verified purchase product is not allowed")

        expected_account_id = expected_obfuscated_account_id(user_id)
        if status.obfuscated_external_account_id != expected_account_id:
            raise BillingVerificationError("Verified purchase account does not match this user")
        return

    if status.store == STORE_APP_STORE:
        if status.product_id not in allowed_ios_product_ids():
            raise BillingVerificationError("Verified purchase product is not allowed")
        if status.app_account_token != expected_app_account_token(user_id):
            raise BillingVerificationError("Verified purchase account does not match this user")
        if status.raw.get("bundleId") != settings.ios_bundle_id:
            raise BillingVerificationError("Verified purchase bundle does not match this app")
        return

    raise BillingVerificationError("Unknown billing store")


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


async def verify_apple_purchase_token(
    signed_transaction_or_token: str,
) -> SubscriptionStatus:
    local_payload: dict | None = None
    environment: str | None = None
    transaction_id = signed_transaction_or_token

    if signed_transaction_or_token.count(".") == 2:
        local_payload = _verify_apple_signed_jws(signed_transaction_or_token)
        transaction_id = str(
            local_payload.get("transactionId")
            or local_payload.get("originalTransactionId")
            or ""
        ).strip()
        environment = local_payload.get("environment")

    if not transaction_id:
        raise BillingVerificationError("Apple transaction identifier is missing")

    token = _build_apple_server_api_token()
    base_url = _apple_api_base(environment)
    url = f"{base_url}/inApps/v1/transactions/{transaction_id}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers={"Authorization": f"Bearer {token}"})

    if resp.status_code != 200:
        raise BillingVerificationError(f"App Store API {resp.status_code}: {resp.text}")

    response_payload = resp.json()
    signed_transaction = response_payload.get("signedTransactionInfo")
    if not signed_transaction:
        raise BillingVerificationError("App Store response did not include transaction info")

    transaction_payload = _verify_apple_signed_jws(signed_transaction)
    if local_payload is not None:
        local_transaction_id = local_payload.get("transactionId")
        canonical_transaction_id = transaction_payload.get("transactionId")
        if local_transaction_id and canonical_transaction_id != local_transaction_id:
            raise BillingVerificationError("Apple transaction identifier mismatch")

    return _normalize_apple_transaction(transaction_payload)


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
    default_product_id = (
        settings.ios_product_id
        if status.store == STORE_APP_STORE
        else settings.google_play_product_id
    )
    sub.store = status.store
    sub.product_id = status.product_id or default_product_id
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
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        sub = await session.scalar(select(Subscription).where(Subscription.user_id == user_id))
        if sub is None:
            raise
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
