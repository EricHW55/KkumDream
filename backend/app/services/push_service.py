import json
import logging
from collections.abc import Sequence
from typing import Literal
from uuid import UUID

import firebase_admin
from firebase_admin import credentials, messaging
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import DeviceToken

logger = logging.getLogger(__name__)

AndroidPriority = Literal["high", "normal"]

DREAM_IMPORTANT_CHANNEL_ID = "dream_important"
DREAM_ACTIVITY_CHANNEL_ID = "dream_activity"


def initialize_firebase() -> bool:
    if firebase_admin._apps:
        return True
    if not settings.firebase_credentials_json:
        return False

    try:
        info = json.loads(settings.firebase_credentials_json)
        firebase_admin.initialize_app(credentials.Certificate(info))
    except Exception:
        logger.exception("Failed to initialize Firebase Admin SDK")
        return False
    return True


async def send_dream_ready_push(token: str, dream_id: str) -> None:
    await _send_token_push(
        token=token,
        title="꿈 이미지가 완성됐어요",
        body="받은 꿈카드에서 이미지를 확인해보세요.",
        dream_id=dream_id,
        notification_type="dream_ready",
        channel_id=DREAM_ACTIVITY_CHANNEL_ID,
        priority="normal",
    )


async def send_dream_given_push(
    session: AsyncSession,
    receiver_id: UUID,
    dream_id: str,
    dream_title: str,
) -> None:
    await _send_user_pushes(
        session=session,
        recipient_ids=[receiver_id],
        title="꿈카드가 도착했어요",
        body=f'"{dream_title}" 카드를 열어보세요.',
        dream_id=dream_id,
        notification_type="dream_given",
        channel_id=DREAM_IMPORTANT_CHANNEL_ID,
        priority="high",
    )


async def send_owner_comment_push(
    session: AsyncSession,
    giver_id: UUID,
    dream_id: str,
    dream_title: str,
) -> None:
    await _send_user_pushes(
        session=session,
        recipient_ids=[giver_id],
        title="꿈주인이 댓글을 남겼어요",
        body=f'"{dream_title}"에 답장이 도착했어요.',
        dream_id=dream_id,
        notification_type="owner_comment",
        channel_id=DREAM_IMPORTANT_CHANNEL_ID,
        priority="high",
    )


async def send_dream_comment_push(
    session: AsyncSession,
    recipient_ids: Sequence[UUID],
    dream_id: str,
    dream_title: str,
) -> None:
    await _send_user_pushes(
        session=session,
        recipient_ids=recipient_ids,
        title="꿈카드에 댓글이 달렸어요",
        body=f'"{dream_title}"에서 새 댓글을 확인해보세요.',
        dream_id=dream_id,
        notification_type="dream_comment",
        channel_id=DREAM_ACTIVITY_CHANNEL_ID,
        priority="normal",
    )


async def send_dream_claimed_push(
    session: AsyncSession,
    giver_id: UUID,
    dream_id: str,
    dream_title: str,
) -> None:
    await _send_user_pushes(
        session=session,
        recipient_ids=[giver_id],
        title="공유한 꿈카드가 받아졌어요",
        body=f'"{dream_title}" 카드가 공유 링크로 전달됐어요.',
        dream_id=dream_id,
        notification_type="dream_claimed",
        channel_id=DREAM_ACTIVITY_CHANNEL_ID,
        priority="normal",
    )


async def _send_user_pushes(
    session: AsyncSession,
    recipient_ids: Sequence[UUID],
    title: str,
    body: str,
    dream_id: str,
    notification_type: str,
    channel_id: str,
    priority: AndroidPriority,
) -> None:
    unique_recipient_ids = list(dict.fromkeys(recipient_ids))
    if not unique_recipient_ids:
        return

    tokens = list(
        (
            await session.scalars(
                select(DeviceToken.token).where(
                    DeviceToken.user_id.in_(unique_recipient_ids),
                    DeviceToken.enabled.is_(True),
                )
            )
        ).all()
    )
    if not tokens:
        return

    for token in tokens:
        await _send_token_push(
            token=token,
            title=title,
            body=body,
            dream_id=dream_id,
            notification_type=notification_type,
            channel_id=channel_id,
            priority=priority,
        )


async def _send_token_push(
    token: str,
    title: str,
    body: str,
    dream_id: str,
    notification_type: str,
    channel_id: str,
    priority: AndroidPriority,
) -> None:
    if not initialize_firebase():
        return

    message = messaging.Message(
        token=token,
        notification=messaging.Notification(title=title, body=body),
        data={
            "dreamId": dream_id,
            "route": "DreamDetail",
            "notificationType": notification_type,
            "channelId": channel_id,
        },
        android=messaging.AndroidConfig(
            priority=priority,
            notification=messaging.AndroidNotification(channel_id=channel_id),
        ),
    )
    try:
        messaging.send(message)
    except Exception:
        logger.exception("Failed to send FCM push notification")
