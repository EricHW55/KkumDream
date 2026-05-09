from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, db_session
from app.schemas.device import DeviceTokenOut, DeviceTokenRegister
from app.services.device_token_service import (
    register_device_token,
    unregister_device_token,
)

router = APIRouter()
CurrentUserId = Annotated[UUID, Depends(current_user_id)]
DbSession = Annotated[AsyncSession, Depends(db_session)]


@router.post("", response_model=DeviceTokenOut)
async def register_device(
    payload: DeviceTokenRegister,
    user_id: CurrentUserId,
    session: DbSession,
) -> DeviceTokenOut:
    device_token = await register_device_token(session, user_id, payload)
    return DeviceTokenOut.model_validate(device_token)


@router.post("/unregister")
async def unregister_device(
    payload: DeviceTokenRegister,
    user_id: CurrentUserId,
    session: DbSession,
) -> dict[str, bool]:
    await unregister_device_token(session, user_id, payload)
    return {"ok": True}
