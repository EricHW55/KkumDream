from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.schemas.base import ApiModel

ReactionType = Literal["heart", "laugh", "tear", "surprise", "dream"]
REACTION_TYPES: tuple[ReactionType, ...] = (
    "heart",
    "laugh",
    "tear",
    "surprise",
    "dream",
)
CardColor = Literal["beige", "ivory", "lilac", "peach", "mint", "midnight"]
CardFrame = Literal["ticket", "beveled", "tag", "classic"]
FontStyle = Literal[
    "dahaeng",
    "daegwangyuri",
    "miraenamu",
    "agisarang",
    "yedang",
    "rounded",
    "serif",
    "clean",
]
ImageTexture = Literal[
    "watercolor",
    "acrylic",
    "crayon",
    "colored_pencil",
    "oil_pastel",
]
LetterPaper = Literal[
    "plain",
    "lined",
    "ornament",
    "vintage",
    "botanical",
    "postcard",
    "moonlit",
    "butterfly",
    # Kept for stored-card compatibility; the client no longer exposes these.
    "corner_flower",
    "rose",
    "seashell_beach",
    "cat_nap",
    "blossom",
    "wildflower",
]
StoryLength = Literal["short", "standard", "long"]

# Current flattened front-preview format version. Bump this when the baked
# front-side card design changes (or a generation bug shipped) so clients
# regenerate and re-upload previews under a new R2 key.
# v2: fixed a blank-image-region bug in the client off-screen capture.
# v3: raised baked preview resolution/quality (600/82 -> 800/88) for sharper text.
# v4: re-bake — early v3 uploads landed on the old backend (still 600/82) before
#     the 800/88 deploy, so bump again to regenerate them at the new quality.
# v5: widened the capture margin + alpha-preserving WebP for the soft shadow; the
#     host aspect ratio changed, so old previews must be re-baked. Must stay in
#     sync with the client's FRONT_PREVIEW_VERSION in DreamFrontPreview.tsx.
FRONT_PREVIEW_VERSION = 5


class DreamDesign(ApiModel):
    card_color: CardColor = "beige"
    card_frame: CardFrame = "classic"
    font_style: FontStyle = "dahaeng"
    image_texture: ImageTexture = "oil_pastel"
    letter_paper: LetterPaper = "plain"


class DreamDraftCreate(ApiModel):
    raw_input: str = Field(min_length=1, max_length=500)
    mood: str | None = Field(default=None, max_length=20)
    tone: str | None = Field(default=None, max_length=30)
    story_length: StoryLength = "standard"
    design: DreamDesign = Field(default_factory=DreamDesign)


class DreamUpdate(ApiModel):
    title: str | None = Field(default=None, max_length=80)
    title_visible: bool | None = None
    short_message: str | None = Field(default=None, max_length=120)
    summary: str | None = Field(default=None, max_length=220)
    story: str | None = Field(default=None, max_length=1000)
    tags: list[str] | None = None
    design: DreamDesign | None = None


class DreamGiveRequest(ApiModel):
    receiver_id: UUID | None = None
    receiver_label: str | None = Field(default=None, max_length=50)
    group_ids: list[UUID] = Field(default_factory=list)
    private_postscript: str | None = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def validate_target(self) -> "DreamGiveRequest":
        if self.receiver_id is None and not self.receiver_label:
            raise ValueError("receiverId or receiverLabel is required")
        return self


class DreamOut(ApiModel):
    id: UUID
    giver_id: UUID
    receiver_id: UUID | None = None
    receiver_label: str | None = None
    giver_display_name: str | None = None
    receiver_display_name: str | None = None
    private_postscript: str | None = None
    group_ids: list[UUID] = Field(default_factory=list)
    raw_input: str
    title: str
    title_visible: bool
    short_message: str
    summary: str
    story: str
    image_prompt: str
    image_url: str | None = None
    thumbnail_url: str | None = None
    front_preview_url: str | None = None
    front_preview_version: int | None = None
    front_preview_hash: str | None = None
    main_mood: str
    tags: list[str]
    design: DreamDesign
    status: str
    image_status: str
    created_at: datetime
    given_at: datetime | None = None
    read_at: datetime | None = None
    opened_back_at: datetime | None = None
    owner_main_comment_id: UUID | None = None
    is_hidden: bool = False


class DreamCommentCreate(ApiModel):
    content: str = Field(min_length=1, max_length=200)


class DreamCommentOut(ApiModel):
    id: UUID
    dream_id: UUID
    author_id: UUID
    author_nickname: str
    author_profile_image_url: str | None = None
    content: str
    is_owner_main: bool
    created_at: datetime
    is_hidden: bool = False


class DreamReactionToggle(ApiModel):
    reaction_type: ReactionType
    reacted: bool | None = None


class DreamReactionSummary(ApiModel):
    reaction_type: ReactionType
    count: int
    reacted: bool


class DreamReactionToggleResponse(ApiModel):
    reaction_type: ReactionType
    reacted: bool
    count: int
    summary: list[DreamReactionSummary]


class DreamShareRequest(ApiModel):
    expires_in_hours: int | None = Field(default=None, ge=1, le=24 * 365)


class DreamShareResponse(ApiModel):
    token: str
    dream_id: UUID
    expires_at: datetime | None = None
    share_url: str


class DreamClaimRequest(ApiModel):
    token: str = Field(min_length=1, max_length=64)
