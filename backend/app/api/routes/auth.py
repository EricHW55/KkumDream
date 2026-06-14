from datetime import UTC, datetime
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, db_session
from app.core.config import settings
from app.core.security import create_app_access_token
from app.schemas.user import AuthSessionOut, GoogleLoginRequest, UserOut, UserUpdate
from app.services.user_service import (
    delete_user_account,
    get_or_create_google_user,
    get_or_create_mock_user,
    get_user,
    update_user_profile,
)
from app.services.storage_service import delete_profile_image, store_profile_image

router = APIRouter()


@router.post("/login")
async def login() -> dict[str, str]:
    return {
        "message": "Use Supabase Auth on the client and send its bearer token to this API.",
    }


@router.post("/logout")
async def logout() -> dict[str, bool]:
    return {"ok": True}


@router.post("/google", response_model=AuthSessionOut)
async def google_login(
    payload: GoogleLoginRequest,
    session: AsyncSession = Depends(db_session),
) -> AuthSessionOut:
    google_user = await _verify_google_id_token(payload.id_token)
    user = await get_or_create_google_user(
        session,
        provider_user_id=google_user["sub"],
        email=google_user["email"],
        nickname=google_user.get("name") or google_user.get("email"),
        profile_image_url=google_user.get("picture"),
    )
    if user.deleted_at is not None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account has been deleted",
        )
    if user.suspended_until is not None and user.suspended_until > datetime.now(UTC):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is suspended until {user.suspended_until.isoformat()}",
        )
    return AuthSessionOut(
        access_token=create_app_access_token(user.id),
        user=UserOut.model_validate(user),
    )


@router.get("/me", response_model=UserOut)
async def me(
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> UserOut:
    user = await get_user(session, user_id)
    if user is None:
        user = await get_or_create_mock_user(session, user_id)
    return UserOut.model_validate(user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> Response:
    await delete_user_account(session, user_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: UserUpdate,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> UserOut:
    user = await update_user_profile(
        session,
        user_id,
        payload.nickname,
        payload.profile_image_url,
    )
    return UserOut.model_validate(user)


@router.post("/me/profile-image", response_model=UserOut)
async def upload_profile_image(
    file: UploadFile = File(...),
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> UserOut:
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미지 파일만 업로드할 수 있어요.",
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="업로드할 이미지가 비어 있어요.",
        )
    if len(image_bytes) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="프로필 이미지는 5MB 이하로 업로드해주세요.",
        )

    existing_user = await get_user(session, user_id)
    previous_profile_image_url = (
        existing_user.profile_image_url if existing_user is not None else None
    )
    image_url = await store_profile_image(user_id, image_bytes)
    user = await update_user_profile(session, user_id, None, image_url)
    await delete_profile_image(previous_profile_image_url, keep_url=image_url)
    return UserOut.model_validate(user)


async def _verify_google_id_token(id_token: str) -> dict[str, str]:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": id_token},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not verify Google token",
        ) from exc

    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    data = response.json()
    if settings.google_web_client_id and data.get("aud") != settings.google_web_client_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google token audience does not match this app",
        )
    if data.get("email_verified") not in {"true", True}:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google email is not verified",
        )
    if not data.get("sub") or not data.get("email"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incomplete Google token")
    return data
