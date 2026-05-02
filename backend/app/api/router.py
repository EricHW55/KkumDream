from fastapi import APIRouter

from app.api.routes import auth, dreams, friends, health, rooms

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(friends.router, prefix="/friends", tags=["friends"])
api_router.include_router(dreams.router, prefix="/dreams", tags=["dreams"])
api_router.include_router(rooms.router, prefix="/rooms", tags=["rooms"])

