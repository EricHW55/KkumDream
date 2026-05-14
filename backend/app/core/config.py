from functools import lru_cache

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "KKUMDREAM"
    environment: str = "local"
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = ["*"]

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/kkumdream"
    auth_mock_user_id: str | None = None
    supabase_jwt_secret: str | None = None
    app_jwt_secret: str = "change-me-in-production"
    app_jwt_expire_days: int = 30
    google_web_client_id: str | None = None

    ai_mock_mode: bool = True
    anthropic_api_key: str | None = None
    anthropic_text_model: str = "claude-haiku-4-5"
    openai_api_key: str | None = None
    replicate_api_token: str | None = None
    replicate_flux_model: str = "black-forest-labs/flux-schnell"

    r2_account_id: str | None = None
    r2_access_key_id: str | None = None
    r2_secret_access_key: str | None = None
    r2_bucket: str | None = None
    r2_public_base_url: str = "https://img.kkumdream.app"

    firebase_credentials_json: str | None = Field(default=None)

    share_base_url: str = "https://kkumdream.app"
    share_token_default_expire_days: int = 30
    android_package_name: str = "com.kkumdreammobile"
    android_play_store_url: str = (
        "https://play.google.com/store/apps/details?id=com.kkumdreammobile"
    )
    android_app_link_sha256_fingerprints: list[str] = []
    ios_app_store_url: str = "https://apps.apple.com/app/kkumdream"
    ios_app_id: str | None = None

    @computed_field
    @property
    def is_local(self) -> bool:
        return self.environment == "local"

    @computed_field
    @property
    def r2_endpoint_url(self) -> str | None:
        if not self.r2_account_id:
            return None
        return f"https://{self.r2_account_id}.r2.cloudflarestorage.com"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
