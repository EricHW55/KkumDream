from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import DeviceToken
from app.schemas.device import DeviceTokenRegister


async def register_device_token(
    session: AsyncSession,
    user_id: UUID,
    payload: DeviceTokenRegister,
) -> DeviceToken:
    now = datetime.now(UTC)
    device_token = await session.scalar(
        select(DeviceToken).where(
            DeviceToken.platform == payload.platform,
            DeviceToken.token == payload.token,
        )
    )

    if device_token is None:
        device_token = DeviceToken(
            user_id=user_id,
            platform=payload.platform,
            token=payload.token,
            enabled=True,
            last_seen_at=now,
            updated_at=now,
        )
        session.add(device_token)
    else:
        device_token.user_id = user_id
        device_token.enabled = True
        device_token.last_seen_at = now
        device_token.updated_at = now

    await session.commit()
    await session.refresh(device_token)
    return device_token


async def unregister_device_token(
    session: AsyncSession,
    user_id: UUID,
    payload: DeviceTokenRegister,
) -> None:
    now = datetime.now(UTC)
    device_token = await session.scalar(
        select(DeviceToken).where(
            DeviceToken.user_id == user_id,
            DeviceToken.platform == payload.platform,
            DeviceToken.token == payload.token,
        )
    )
    if device_token is None:
        return

    device_token.enabled = False
    device_token.updated_at = now
    device_token.last_seen_at = now
    await session.commit()
