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

    # Google Play billing (subscription verification + RTDN).
    # Prod: set the JSON env var (fly secret). Local: point the file path at secrets/.
    google_play_service_account_json: str | None = None
    google_play_service_account_file: str | None = None
    google_play_product_id: str = "kkumdream_pass_monthly"
    google_play_product_ids: list[str] = []
    # Service account email Pub/Sub uses to sign OIDC tokens on RTDN push requests.
    google_play_rtdn_audience: str | None = None
    google_play_rtdn_service_account: str | None = None
    billing_reconciliation_interval_seconds: int = 60 * 60 * 6
    billing_reconciliation_initial_delay_seconds: int = 60

    # Which values are free; anything else is pass-only. Override via env
    # (JSON arrays) to change locks without an app release — the client reads these
    # through GET /billing/pass-info.
    free_card_colors: list[str] = ["beige", "ivory", "peach"]
    free_card_frames: list[str] = ["classic", "ticket"]
    free_font_styles: list[str] = ["dahaeng", "daegwangyuri", "rounded", "clean"]
    free_tones: list[str] = ["warm", "polite", "casual"]
    free_story_lengths: list[str] = ["short", "standard"]
    private_postscript_requires_pass: bool = True

    # Pass marketing copy shown in the purchase modal.
    pass_title: str = "꿈드림 패스"
    pass_description: str = "프리미엄 카드 디자인을 모두 잠금 해제하고, 마음을 더 예쁘게 전해보세요."
    pass_original_price_label: str = "₩2,900"

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

    def validate_production_settings(self) -> None:
        if self.environment != "production":
            return

        missing: list[str] = []
        if not self.app_jwt_secret or self.app_jwt_secret == "change-me-in-production":
            missing.append("APP_JWT_SECRET")
        if not (self.google_play_service_account_json or self.google_play_service_account_file):
            missing.append("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON")
        if not self.google_play_rtdn_audience:
            missing.append("GOOGLE_PLAY_RTDN_AUDIENCE")

        if missing:
            joined = ", ".join(missing)
            raise RuntimeError(f"Production settings are incomplete: {joined}")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
