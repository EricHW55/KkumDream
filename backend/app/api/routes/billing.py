import asyncio
import base64
import binascii
import json
import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, db_session
from app.core.config import settings
from app.models.subscription import STORE_APP_STORE, STORE_GOOGLE_PLAY, Subscription
from app.schemas.billing import (
    EntitlementOut,
    FreeDesignOut,
    PassInfoOut,
    VerifyPurchaseIn,
)
from app.services import billing_service
from app.services.billing_service import BillingConfigError, BillingVerificationError

logger = logging.getLogger(__name__)
router = APIRouter()

CurrentUserId = Annotated[UUID, Depends(current_user_id)]
DbSession = Annotated[AsyncSession, Depends(db_session)]


def _entitlement_out(sub: Subscription | None) -> EntitlementOut:
    if sub is None:
        return EntitlementOut(active=False)
    return EntitlementOut(
        active=billing_service.is_entitled(sub),
        product_id=sub.product_id,
        state=sub.state,
        expires_at=sub.expires_at,
        auto_renewing=sub.auto_renewing,
    )


@router.get("/pass-info", response_model=PassInfoOut)
async def get_pass_info() -> PassInfoOut:
    return PassInfoOut(
        product_id=settings.google_play_product_id,
        android_product_id=settings.google_play_product_id,
        ios_product_id=settings.ios_product_id,
        title=settings.pass_title,
        description=settings.pass_description,
        original_price_label=settings.pass_original_price_label,
        free_design=FreeDesignOut(
            card_colors=settings.free_card_colors,
            card_frames=settings.free_card_frames,
            font_styles=settings.free_font_styles,
        ),
        free_tones=settings.free_tones,
        free_story_lengths=settings.free_story_lengths,
        private_postscript_requires_pass=settings.private_postscript_requires_pass,
    )


@router.get("/entitlement", response_model=EntitlementOut)
async def get_entitlement(user_id: CurrentUserId, session: DbSession) -> EntitlementOut:
    return _entitlement_out(await billing_service.get_subscription(session, user_id))


@router.post("/verify", response_model=EntitlementOut)
async def verify_purchase(
    payload: VerifyPurchaseIn,
    user_id: CurrentUserId,
    session: DbSession,
) -> EntitlementOut:
    try:
        if payload.platform == "ios":
            verified = await billing_service.verify_apple_purchase_token(payload.purchase_token)
            if (
                payload.app_account_token
                and verified.app_account_token != payload.app_account_token
            ):
                raise BillingVerificationError("App account token mismatch")
            existing = None
            if verified.original_transaction_id:
                existing = await billing_service.get_subscription_by_original_transaction_id(
                    session,
                    verified.original_transaction_id,
                    store=STORE_APP_STORE,
                )
            if existing is None:
                existing = await billing_service.get_subscription_by_token(
                    session,
                    payload.purchase_token,
                    store=STORE_APP_STORE,
                )
        else:
            existing = await billing_service.get_subscription_by_token(
                session,
                payload.purchase_token,
                store=STORE_GOOGLE_PLAY,
            )
            verified = await billing_service.verify_purchase_token(payload.purchase_token)

        if existing is not None and existing.user_id != user_id:
            raise HTTPException(status.HTTP_409_CONFLICT, detail="Purchase already claimed")

        sub = await billing_service.apply_verified_status(
            session, user_id, payload.purchase_token, verified
        )
    except BillingConfigError:
        logger.exception("Billing not configured")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Billing unavailable")
    except BillingVerificationError:
        logger.warning("Purchase verification failed", exc_info=True)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Could not verify purchase")
    return _entitlement_out(sub)


class _PubSubMessage(BaseModel):
    data: str | None = None
    message_id: str | None = Field(default=None, alias="messageId")


class _PubSubEnvelope(BaseModel):
    message: _PubSubMessage


@router.post("/rtdn", status_code=status.HTTP_204_NO_CONTENT)
async def receive_rtdn(
    envelope: _PubSubEnvelope,
    session: DbSession,
    authorization: Annotated[str | None, Header()] = None,
) -> Response:
    # Confirm the push really came from our Pub/Sub subscription.
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Missing OIDC token")
    bearer = authorization.removeprefix("Bearer ")
    try:
        await asyncio.to_thread(billing_service.verify_pubsub_token, bearer)
    except BillingConfigError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="RTDN not configured")
    except (BillingVerificationError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Invalid OIDC token")

    notification = _decode_notification(envelope.message.data)
    if notification is None:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    package_name = notification.get("packageName")
    if package_name != settings.android_package_name:
        logger.warning("RTDN package mismatch: %s", package_name)
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    message_id = envelope.message.message_id
    if message_id and await billing_service.has_rtdn_event(session, message_id):
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    sub_notification = notification.get("subscriptionNotification")
    voided = notification.get("voidedPurchaseNotification")
    purchase_token = None
    notification_type = None
    if sub_notification:
        purchase_token = sub_notification.get("purchaseToken")
        notification_type = sub_notification.get("notificationType")
    elif voided:
        purchase_token = voided.get("purchaseToken")
        if not purchase_token:
            return Response(status_code=status.HTTP_204_NO_CONTENT)
        refund_type = voided.get("refundType")
        await billing_service.revoke_subscription_by_token(
            session, purchase_token, refund_type=refund_type
        )
        if message_id:
            await billing_service.record_rtdn_event(
                session,
                message_id=message_id,
                package_name=package_name,
                purchase_token=purchase_token,
                notification_type=None,
                raw=notification,
            )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    if not purchase_token:
        # Test notifications and unrelated events: ack and move on.
        if message_id:
            await billing_service.record_rtdn_event(
                session,
                message_id=message_id,
                package_name=package_name,
                purchase_token=None,
                notification_type=notification_type,
                raw=notification,
            )
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    try:
        updated = await billing_service.refresh_subscription_by_token(
            session, purchase_token, notification_type
        )
    except BillingVerificationError:
        # Transient Play API failure: let Pub/Sub retry.
        logger.warning("RTDN re-verification failed", exc_info=True)
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Retry")

    if updated is None:
        logger.info("RTDN for unknown purchase token; acked")
    if message_id:
        await billing_service.record_rtdn_event(
            session,
            message_id=message_id,
            package_name=package_name,
            purchase_token=purchase_token,
            notification_type=notification_type,
            raw=notification,
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _decode_notification(data: str | None) -> dict | None:
    if not data:
        return None
    try:
        decoded = base64.b64decode(data)
        return json.loads(decoded)
    except (binascii.Error, ValueError):
        logger.warning("Could not decode RTDN payload")
        return None
