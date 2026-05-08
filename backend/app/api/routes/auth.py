from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, db_session
from app.core.config import settings
from app.core.security import create_app_access_token
from app.schemas.user import AuthSessionOut, GoogleLoginRequest, UserOut, UserUpdate
from app.services.user_service import (
    get_or_create_google_user,
    get_or_create_mock_user,
    get_user,
    update_user_profile,
)

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
