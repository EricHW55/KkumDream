from dataclasses import dataclass
from typing import Any

from anthropic import AsyncAnthropic

from app.core.config import settings

MOOD_DREAMY = "\ubabd\ud658"
MOOD_FANTASY = "\ud310\ud0c0\uc9c0"
MOOD_SCARY = "\uacf5\ud3ec"
MOOD_FUNNY = "\ucf54\ubbf9"
MOOD_WARM = "\ub530\ub73b\ud568"
MOOD_NOSTALGIC = "\ucd94\uc5b5"
MOOD_STRANGE = "\uae30\uad34\ud568"
VALID_MOODS = (
    MOOD_DREAMY,
    MOOD_FANTASY,
    MOOD_SCARY,
    MOOD_FUNNY,
    MOOD_WARM,
    MOOD_NOSTALGIC,
    MOOD_STRANGE,
)
DEFAULT_MOOD = MOOD_DREAMY
TONE_WARM = "warm"
TONE_POLITE = "polite"
TONE_CASUAL = "casual"
TONE_MZ_COMIC = "mz_comic"
TONE_STORY = "story"
TONE_POETIC = "poetic"
VALID_TONES = (
    TONE_WARM,
    TONE_POLITE,
    TONE_CASUAL,
    TONE_MZ_COMIC,
    TONE_STORY,
    TONE_POETIC,
)
DEFAULT_TONE = TONE_WARM
LENGTH_SHORT = "short"
LENGTH_STANDARD = "standard"
LENGTH_LONG = "long"
VALID_STORY_LENGTHS = (LENGTH_SHORT, LENGTH_STANDARD, LENGTH_LONG)
DEFAULT_STORY_LENGTH = LENGTH_STANDARD
TONE_GUIDES = {
    TONE_WARM: {
        "label": "warm letter style",
        "instruction": (
            "Use soft, friendly Korean that feels like a personal note. "
            "Prefer natural 존댓말 with gentle warmth."
        ),
    },
    TONE_POLITE: {
        "label": "polite style",
        "instruction": (
            "Use calm, respectful 존댓말. Keep sentences clear, composed, "
            "and not overly intimate."
        ),
    },
    TONE_CASUAL: {
        "label": "casual friend style",
        "instruction": (
            "Use natural, everyday Korean 반말 as if talking to a close friend. "
            "Keep it warm, relaxed, direct, and easy to read."
        ),
    },
    TONE_MZ_COMIC: {
        "label": "MZ comic slang style",
        "instruction": (
            "Use playful Korean with modern slang and abbreviations where natural, "
            "such as ㅋㅋ, ㄹㅇ, 찐, 텐션, 레전드, and 폼 미쳤다. Keep it funny, "
            "affectionate, and readable; avoid insults, obscenity, or harsh sarcasm."
        ),
    },
    TONE_STORY: {
        "label": "literary story style",
        "instruction": (
            "Use scene-focused narrative prose. Emphasize motion, atmosphere, "
            "and sensory details while staying concise."
        ),
    },
    TONE_POETIC: {
        "label": "poetic style",
        "instruction": (
            "Use compact, lyrical Korean with vivid images and lingering rhythm. "
            "Avoid becoming obscure or overly ornate."
        ),
    },
}
STORY_LENGTH_GUIDES = {
    LENGTH_SHORT: {
        "label": "concise",
        "instruction": (
            "story: 160-300 Korean characters. Keep only the clearest dream "
            "scene and emotion."
        ),
        "max_chars": 340,
        "max_tokens": 950,
    },
    LENGTH_STANDARD: {
        "label": "balanced",
        "instruction": (
            "story: 300-600 Korean characters. Connect the dream naturally "
            "without making it a long fantasy plot."
        ),
        "max_chars": 660,
        "max_tokens": 1250,
    },
    LENGTH_LONG: {
        "label": "rich",
        "instruction": (
            "story: 600-900 Korean characters. Let the scene breathe with "
            "more sensory detail while keeping the user's original scenes visible."
        ),
        "max_chars": 940,
        "max_tokens": 1650,
    },
}
ANTHROPIC_TOKEN_PRICES = {
    "claude-haiku-4-5": (1.0, 5.0),
    "claude-sonnet-4-6": (3.0, 15.0),
    "claude-sonnet-4-5": (3.0, 15.0),
}

CREATE_DREAM_CARD_TOOL = {
    "name": "create_dream_card",
    "description": "Create the Korean dream-card text and a short image scene.",
    "input_schema": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "title",
            "shortMessage",
            "summary",
            "story",
            "tags",
            "imageScene",
        ],
        "properties": {
            "title": {
                "type": "string",
                "description": "Korean title, 8-20 Korean characters.",
            },
            "shortMessage": {
                "type": "string",
                "description": (
                    "Korean gift-card message, 16-45 Korean characters, "
                    "dream-specific and friendly."
                ),
            },
            "summary": {
                "type": "string",
                "description": "One Korean sentence, 45-90 Korean characters.",
            },
            "story": {
                "type": "string",
                "description": "Korean polished dream story following requested length.",
            },
            "tags": {
                "type": "array",
                "minItems": 2,
                "maxItems": 3,
                "items": {"type": "string"},
                "description": "2-3 short Korean words, no hashtags.",
            },
            "imageScene": {
                "type": "string",
                "description": (
                    "English visual scene only, 30-60 words, no style terms."
                ),
            },
        },
    },
}

SYSTEM_PROMPT = """
You write warm Korean dream cards for KkumDream.
Preserve the user's core dream scenes and symbols.
Make the result suitable to send to a close friend.
Do not interpret the dream or explain its meaning.
Add only gentle connective details when needed.
Never mention AI, prompts, tools, JSON, policies, or image generation to the user.
Use the create_dream_card tool exactly once.
""".strip()

# Single unified art style for every card. Lead the final prompt with the medium
# so flux locks onto "hand-drawn" instead of drifting toward a photo. Moods only
# tint palette/atmosphere; they must never change the medium or rendering style.
IMAGE_STYLE_PREFIX = "A hand-drawn pastel storybook illustration"
IMAGE_STYLE_GUIDE = """
drawn by hand with soft oil pastels and gouache, visible crayon and brush-stroke
texture, grainy textured art paper, gentle muted pastel color palette, naive
children's picture-book art, rounded hand-painted shapes, imperfect hand-made
linework, flat soft matte lighting, cozy and emotionally warm, clear focal subject,
mobile card thumbnail friendly, absolutely not a photograph, not photorealistic,
not a 3D render, not CGI, not anime, no glossy reflections, no camera bokeh,
no realistic skin or fabric texture
""".replace("\n", " ").strip()
# Keep each mood to palette + atmosphere ONLY, so the hand-drawn medium stays
# identical across moods and just the feeling shifts.
MOOD_IMAGE_GUIDES = {
    MOOD_DREAMY: (
        "dreamy atmosphere with a hazy glow, floating light and a soft "
        "lavender-blue palette, quiet wonder"
    ),
    MOOD_FANTASY: (
        "fantasy atmosphere with gentle sparkles and a magical sense of scale, "
        "warm storybook palette, adventurous wonder"
    ),
    MOOD_SCARY: (
        "softly eerie atmosphere with moonlit shadows and a cool muted palette, "
        "gentle suspense, no gore, no violence"
    ),
    MOOD_FUNNY: (
        "playful cheerful atmosphere with whimsical shapes and a bright candy "
        "palette, light visual humor"
    ),
    MOOD_WARM: (
        "cozy affectionate atmosphere with soft warm light and a peach, cream "
        "and honey palette, comforting and tender"
    ),
    MOOD_NOSTALGIC: (
        "nostalgic atmosphere with faded afternoon light and a gentle sepia "
        "palette, memory-like softness"
    ),
    MOOD_STRANGE: (
        "gently uncanny atmosphere with offbeat objects and a muted mysterious "
        "palette, surreal but calm"
    ),
}


@dataclass(frozen=True)
class DreamTextResult:
    title: str
    short_message: str
    summary: str
    story: str
    main_mood: str
    tags: list[str]
    image_prompt: str
    model_name: str
    token_count: int | None = None
    cost_estimate: float | None = None


async def generate_dream_text(
    raw_input: str,
    mood: str | None,
    tone: str | None = None,
    story_length: str | None = None,
) -> DreamTextResult:
    if settings.ai_mock_mode or not settings.anthropic_api_key:
        return _mock_dream_text(raw_input, mood, tone, story_length)
    return await _generate_with_anthropic(raw_input, mood, tone, story_length)


def _mock_dream_text(
    raw_input: str,
    mood: str | None,
    tone: str | None,
    story_length: str | None,
) -> DreamTextResult:
    selected_mood = _select_mood(mood)
    selected_tone = _select_tone(tone)
    selected_story_length = _select_story_length(story_length)
    clipped = raw_input.strip()[:70] or "\uc774\ub984 \uc5c6\ub294 \uc7a5\uba74"
    return DreamTextResult(
        title=f"{selected_mood}\ud55c \uafc8 \uc870\uac01",
        short_message="\uc624\ub298 \ub5a0\uc624\ub978 \uafc8\uc744 \uc870\uc6a9\ud788 "
        "\uac74\ub124\uace0 \uc2f6\uc5b4.",
        summary=f"{clipped}\uc5d0\uc11c \uc2dc\uc791\ub41c {selected_mood}\ud55c "
        "\uafc8\uc758 \uc7a5\uba74\uc744 \ubd80\ub4dc\ub7fd\uac8c "
        "\uc5ee\uc5c8\uc5b4\uc694.",
        story=_apply_mock_length(
            _apply_mock_tone(_build_mock_story(clipped), selected_tone),
            selected_story_length,
        ),
        main_mood=selected_mood,
        tags=[selected_mood, "\uae30\uc5b5", "\uc120\ubb3c"],
        image_prompt=_build_final_image_prompt(
            _fallback_image_scene(clipped, ""), selected_mood
        ),
        model_name="mock",
    )


async def _generate_with_anthropic(
    raw_input: str,
    mood: str | None,
    tone: str | None,
    story_length: str | None,
) -> DreamTextResult:
    selected_mood = _select_mood(mood)
    selected_tone = _select_tone(tone)
    selected_story_length = _select_story_length(story_length)
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    message = await client.messages.create(
        model=settings.anthropic_text_model,
        max_tokens=STORY_LENGTH_GUIDES[selected_story_length]["max_tokens"],
        temperature=0.55,
        system=SYSTEM_PROMPT,
        tools=[CREATE_DREAM_CARD_TOOL],
        tool_choice={"type": "tool", "name": CREATE_DREAM_CARD_TOOL["name"]},
        messages=[
            {
                "role": "user",
                "content": _build_user_prompt(
                    raw_input.strip(),
                    selected_mood,
                    selected_tone,
                    selected_story_length,
                ),
            }
        ],
    )
    tool_input = _extract_tool_input(message.content)
    input_tokens = getattr(message.usage, "input_tokens", 0)
    output_tokens = getattr(message.usage, "output_tokens", 0)
    return _normalize_result(
        tool_input,
        selected_mood=selected_mood,
        selected_story_length=selected_story_length,
        model_name=settings.anthropic_text_model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
    )


def _build_user_prompt(
    raw_input: str,
    mood: str,
    tone: str,
    story_length: str,
) -> str:
    tone_guide = TONE_GUIDES[tone]
    length_guide = STORY_LENGTH_GUIDES[story_length]
    return f"""
User dream memo:
{raw_input}

Mood: {mood}
Writing tone — {tone_guide["label"]}: {tone_guide["instruction"]}
Story length — {length_guide["label"]}: {length_guide["instruction"]}

Write the dream card:
- Apply the writing tone to shortMessage, summary, and story.
- shortMessage: a sender-facing line that feels like a small gift, specific to this dream.
- imageScene: English visual scene only. Describe the main objects, place,
  atmosphere, and visual action. No style words, no "no text" phrases.

Avoid: dream interpretation, fortune-telling, therapy or moral lessons; new
characters, violence, gore, sexual content, and real brand names.
""".strip()


def _extract_tool_input(content: list[Any]) -> dict[str, Any]:
    for block in content:
        if (
            getattr(block, "type", None) == "tool_use"
            and getattr(block, "name", None) == CREATE_DREAM_CARD_TOOL["name"]
        ):
            tool_input = getattr(block, "input", None)
            if isinstance(tool_input, dict):
                return tool_input
    raise RuntimeError("Claude did not return a dream-card tool result")


def _normalize_result(
    data: dict[str, Any],
    *,
    selected_mood: str,
    selected_story_length: str,
    model_name: str,
    input_tokens: int,
    output_tokens: int,
) -> DreamTextResult:
    title = _text(data.get("title"), "\uafc8 \uc870\uac01", 80)
    short_message = _text(
        data.get("shortMessage"),
        "\uc624\ub298\uc758 \uafc8\uc744 \ub108\uc5d0\uac8c \uac74\ub124\uace0 "
        "\uc2f6\uc5b4.",
        120,
    )
    summary = _text(
        data.get("summary"),
        "\ud750\ub9bf\ud55c \uafc8\uc758 \uc7a5\uba74\uc744 \ub530\ub73b\ud55c "
        "\uce74\ub4dc\ub85c \uc5ee\uc5c8\uc5b4\uc694.",
        220,
    )
    story = _text(
        data.get("story"),
        summary,
        int(STORY_LENGTH_GUIDES[selected_story_length]["max_chars"]),
    )
    main_mood = selected_mood
    tags = _normalize_tags(data.get("tags"), main_mood)
    image_scene = _text(
        data.get("imageScene"),
        _fallback_image_scene(summary, story),
        600,
    )
    image_prompt = _build_final_image_prompt(image_scene, main_mood)

    token_count = input_tokens + output_tokens
    cost_estimate = _estimate_cost(model_name, input_tokens, output_tokens)

    return DreamTextResult(
        title=title,
        short_message=short_message,
        summary=summary,
        story=story,
        main_mood=main_mood,
        tags=tags,
        image_prompt=image_prompt,
        model_name=model_name,
        token_count=token_count,
        cost_estimate=cost_estimate,
    )


def _select_mood(mood: str | None) -> str:
    if mood in VALID_MOODS:
        return mood
    return DEFAULT_MOOD


def _select_tone(tone: str | None) -> str:
    if tone in VALID_TONES:
        return tone
    return DEFAULT_TONE


def _select_story_length(story_length: str | None) -> str:
    if story_length in VALID_STORY_LENGTHS:
        return story_length
    return DEFAULT_STORY_LENGTH


def _build_mock_story(scene: str) -> str:
    return (
        f"{scene}\ub77c\ub294 \uc7a5\uba74\uc740 \uafc8\uc18d\uc5d0\uc11c "
        "\uc624\ub798 \ub0a8\ub294 \uc791\uc740 \ubb38\ucc98\ub7fc "
        "\uc5f4\ub838\uc5b4\uc694. \ud750\ub9bf\ud588\ub358 "
        "\uc21c\uac04\ub4e4\uc740 \ucc9c\ucc9c\ud788 \uc774\uc5b4\uc9c0\uace0, "
        "\uadf8 \uc548\uc5d0 \uc788\ub358 \uac10\uc815\uc740 \uc870\uc6a9\ud55c "
        "\ube5b\ucc98\ub7fc \uc120\uba85\ud574\uc84c\uc2b5\ub2c8\ub2e4. "
        "\ub9d0\ub85c \ub2e4 \uc124\uba85\ud560 \uc218 \uc5c6\ub294 "
        "\uc7a5\uba74\uc774\uc9c0\ub9cc, \ub204\uad70\uac00\uc5d0\uac8c "
        "\uac74\ub124\uba74 \uc624\ub298\uc758 \ub9c8\uc74c\uc744 "
        "\uc870\uae08 \ub354 \ub2e4\uc815\ud558\uac8c \uc804\ud574 \uc904 "
        "\uc218 \uc788\ub294 \uafc8\uc774 \ub418\uc5c8\uc5b4\uc694."
    )


def _apply_mock_length(story: str, story_length: str) -> str:
    if story_length == LENGTH_SHORT:
        return story[:320]
    if story_length == LENGTH_LONG:
        return (
            f"{story} "
            "\uadf8 \uc7a5\uba74\uc758 \ub05d\uc5d0\uc11c \ub0a8\uc740 "
            "\ube5b\uc740 \uc624\ub798 \uc0ac\ub77c\uc9c0\uc9c0 \uc54a\uace0, "
            "\uc544\uce68\uc774 \ub418\uc5b4\ub3c4 \ub9c8\uc74c \ud55c\ucabd\uc5d0 "
            "\uc791\uc740 \uae38\ucc98\ub7fc \uc774\uc5b4\uc84c\uc5b4\uc694."
        )[:1000]
    return story[:760]


def _apply_mock_tone(story: str, tone: str) -> str:
    if tone == TONE_CASUAL:
        return story.replace(
            "\uc5c8\uc5b4\uc694.",
            "\uc5c8\uc5b4.",
        )
    if tone == TONE_MZ_COMIC:
        return (
            story.replace(
                "\uc5c8\uc5b4\uc694.",
                "\uc5c8\uc5b4.",
                2,
            )
            + " \uc774\uac74 \u3139\u3147 \uafc8 \ud150\uc158 "
            "\ub808\uc804\ub4dc\uc600\uc5b4. \uae30\uc5b5 \uc800\uc7a5 \uac01."
        )
    if tone == TONE_STORY:
        return story.replace(
            "\uc5c8\uc5b4\uc694.",
            "\uc5c8\uc2b5\ub2c8\ub2e4.",
            2,
        )
    if tone == TONE_POETIC:
        return (
            f"{story} "
            "\uadf8 \ubc24\uc758 \ube5b\uc740 \uc624\ub798 \ub0a8\uc558\uc5b4\uc694."
        )
    return story


def _text(value: Any, fallback: str, limit: int) -> str:
    if isinstance(value, str):
        text = " ".join(value.split())
    else:
        text = ""
    if not text:
        text = fallback
    return text[:limit]


def _normalize_tags(value: Any, main_mood: str) -> list[str]:
    if isinstance(value, list):
        tags = [_text(item, "", 12) for item in value]
        tags = [tag for tag in tags if tag]
    else:
        tags = []

    unique_tags: list[str] = []
    for tag in [main_mood, *tags, "\uafc8"]:
        if tag and tag not in unique_tags:
            unique_tags.append(tag)
        if len(unique_tags) == 3:
            break
    return unique_tags[:3]


def _build_final_image_prompt(image_scene: str, mood: str) -> str:
    scene = " ".join(image_scene.split()).strip()
    mood_guide = MOOD_IMAGE_GUIDES.get(mood, MOOD_IMAGE_GUIDES[DEFAULT_MOOD])
    return (
        f"{IMAGE_STYLE_PREFIX} of {scene}. {mood_guide}. {IMAGE_STYLE_GUIDE}, "
        "square composition, no text, no logo, no watermark"
    )


def _fallback_image_scene(summary: str, story: str) -> str:
    base = " ".join((summary or story or "").split())[:120]
    if not base:
        base = "조용한 꿈의 장면"
    return f"A gentle dream scene inspired by: {base}"


def _estimate_cost(model_name: str, input_tokens: int, output_tokens: int) -> float | None:
    for model_prefix, (input_price, output_price) in ANTHROPIC_TOKEN_PRICES.items():
        if model_name.startswith(model_prefix):
            return (
                (input_tokens / 1_000_000) * input_price
                + (output_tokens / 1_000_000) * output_price
            )
    return None
