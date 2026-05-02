from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_user_id, db_session
from app.schemas.friend import FriendRequestCreate, FriendshipOut
from app.services.friend_service import accept_friend_request, list_friends, request_friend

router = APIRouter()


@router.get("", response_model=list[FriendshipOut])
async def get_friends(
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> list[FriendshipOut]:
    friendships = await list_friends(session, user_id)
    return [FriendshipOut.model_validate(friendship) for friendship in friendships]


@router.post("/request", response_model=FriendshipOut)
async def create_friend_request(
    payload: FriendRequestCreate,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> FriendshipOut:
    friendship = await request_friend(session, user_id, payload.receiver_id)
    return FriendshipOut.model_validate(friendship)


@router.post("/accept", response_model=FriendshipOut)
async def accept_request(
    friendship_id: UUID,
    user_id: UUID = Depends(current_user_id),
    session: AsyncSession = Depends(db_session),
) -> FriendshipOut:
    friendship = await accept_friend_request(session, user_id, friendship_id)
    return FriendshipOut.model_validate(friendship)

