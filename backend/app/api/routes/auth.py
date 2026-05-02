from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, db_session
from app.schemas.user import UserOut
from app.services.user_service import get_or_create_mock_user, get_user

router = APIRouter()


@router.post("/login")
async def login() -> dict[str, str]:
    return {
        "message": "Use Supabase Auth on the client and send its bearer token to this API.",
    }


@router.post("/logout")
async def logout() -> dict[str, bool]:
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> UserOut:
    user = await get_user(session, user_id)
    if user is None:
        user = await get_or_create_mock_user(session, user_id)
    return UserOut.model_validate(user)

