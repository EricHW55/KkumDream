from datetime import datetime

from pydantic import Field

from app.schemas.base import ApiModel


class VerifyPurchaseIn(ApiModel):
    purchase_token: str = Field(min_length=1)
    product_id: str | None = None


class EntitlementOut(ApiModel):
    active: bool
    product_id: str | None = None
    state: str | None = None
    expires_at: datetime | None = None
    auto_renewing: bool = False


class FreeDesignOut(ApiModel):
    card_colors: list[str]
    card_frames: list[str]
    font_styles: list[str]


class PassInfoOut(ApiModel):
    product_id: str
    title: str
    description: str
    original_price_label: str
    free_design: FreeDesignOut
