import json
from dataclasses import dataclass

from anthropic import AsyncAnthropic

from app.core.config import settings


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


async def generate_dream_text(raw_input: str, mood: str | None) -> DreamTextResult:
    if settings.ai_mock_mode or not settings.anthropic_api_key:
        return _mock_dream_text(raw_input, mood)
    return await _generate_with_anthropic(raw_input, mood)


def _mock_dream_text(raw_input: str, mood: str | None) -> DreamTextResult:
    selected_mood = mood or "몽환"
    clipped = raw_input[:80]
    return DreamTextResult(
        title="밤하늘에 접어 둔 꿈",
        short_message="오늘 내가 꾼 꿈을 너에게 줄게",
        summary=f"{clipped}... 라는 장면에서 시작된 {selected_mood}한 꿈.",
        story=(
            "꿈속에서 익숙한 길은 천천히 낯선 정원으로 바뀌었다. "
            "손에 쥔 작은 카드가 빛나자 기억하던 장면들이 조용히 펼쳐졌고, "
            "그 끝에는 누군가에게 건네고 싶은 한 문장이 남았다."
        ),
        main_mood=selected_mood,
        tags=[selected_mood, "기억", "선물"],
        image_prompt=(
            "A dreamy Korean storybook illustration of a glowing card unfolding into a quiet "
            "night garden, soft pastel colors, gentle light, emotional and warm atmosphere"
        ),
        model_name="mock",
    )


async def _generate_with_anthropic(raw_input: str, mood: str | None) -> DreamTextResult:
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    prompt = f"""
You create a Korean dream gift card.
Return strict JSON with:
title, shortMessage, summary, story, mainMood, tags, imagePrompt.

Rules:
- story: Korean, 250-800 Korean characters
- tags: exactly 2-3 Korean strings
- mainMood: one of 몽환, 판타지, 공포, 코믹, 따뜻함, 추억, 기괴함
- imagePrompt: English, dreamy storybook illustration style
- Keep the concept: "내 꿈을 너에게 줄게"

User dream:
{raw_input}

Preferred mood:
{mood or "not specified"}
"""
    message = await client.messages.create(
        model="claude-3-5-haiku-latest",
        max_tokens=1200,
        temperature=0.7,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(block.text for block in message.content if getattr(block, "type", None) == "text")
    data = json.loads(text)
    return DreamTextResult(
        title=data["title"],
        short_message=data["shortMessage"],
        summary=data["summary"],
        story=data["story"],
        main_mood=data["mainMood"],
        tags=data["tags"],
        image_prompt=data["imagePrompt"],
        model_name="claude-3-5-haiku-latest",
        token_count=getattr(message.usage, "input_tokens", 0) + getattr(message.usage, "output_tokens", 0),
    )

