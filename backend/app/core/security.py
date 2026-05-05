from uuid import UUID
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.core.config import settings

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> UUID:
    if credentials is None and settings.is_local and settings.auth_mock_user_id:
        return UUID(settings.auth_mock_user_id)

    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    app_user_id = _decode_app_token(credentials.credentials)
    if app_user_id is not None:
        return app_user_id

    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No supported JWT verifier is configured",
        )

    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has no subject")
    return UUID(subject)


def create_app_access_token(user_id: UUID) -> str:
    expires_at = datetime.now(UTC) + timedelta(days=settings.app_jwt_expire_days)
    return jwt.encode(
        {
            "sub": str(user_id),
            "iss": settings.app_name,
            "exp": expires_at,
        },
        settings.app_jwt_secret,
        algorithm="HS256",
    )


def _decode_app_token(token: str) -> UUID | None:
    try:
        payload = jwt.decode(
            token,
            settings.app_jwt_secret,
            algorithms=["HS256"],
            issuer=settings.app_name,
        )
    except JWTError:
        return None

    subject = payload.get("sub")
    if not subject:
        return None
    return UUID(subject)
