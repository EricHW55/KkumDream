from fastapi import APIRouter

from app.core.config import settings
from app.schemas.app_config import AppConfigOut, PlatformUpdateConfigOut

router = APIRouter()


@router.get("/app-config", response_model=AppConfigOut)
async def get_app_config() -> AppConfigOut:
    return AppConfigOut(
        ios=PlatformUpdateConfigOut(
            latest_version=settings.ios_latest_version,
            min_supported_version=settings.ios_min_supported_version,
            store_url=settings.ios_app_store_url,
            message=settings.ios_update_message,
        )
    )
