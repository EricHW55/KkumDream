from app.schemas.base import ApiModel


class PlatformUpdateConfigOut(ApiModel):
    latest_version: str
    min_supported_version: str
    store_url: str
    message: str


class AppConfigOut(ApiModel):
    ios: PlatformUpdateConfigOut
