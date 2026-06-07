from fastapi import APIRouter

from app.api.routes import (
    app_config,
    auth,
    billing,
    devices,
    dreams,
    friends,
    health,
    rooms,
    safety,
)

api_router = APIRouter()
api_router.include_router(health.router, tags=["health"])
api_router.include_router(app_config.router, tags=["app-config"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(devices.router, prefix="/devices", tags=["devices"])
api_router.include_router(friends.router, prefix="/friends", tags=["friends"])
api_router.include_router(dreams.router, prefix="/dreams", tags=["dreams"])
api_router.include_router(rooms.router, prefix="/rooms", tags=["rooms"])
api_router.include_router(billing.router, prefix="/billing", tags=["billing"])
api_router.include_router(safety.router, prefix="/safety", tags=["safety"])
