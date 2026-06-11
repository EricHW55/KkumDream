from app.services.ai_text_service import MOOD_DREAMY, _build_final_image_prompt
from app.services.image_generation_service import apply_image_texture_prompt


def test_final_image_prompt_adds_world_building_guide() -> None:
    prompt = _build_final_image_prompt(
        "a small child walking through a moonlit hospital hallway",
        MOOD_DREAMY,
    )

    assert "layered emotional situation rather than isolated symbols" in prompt
    assert "foreground, midground, and background details" in prompt
    assert "clear path for the eye to travel" in prompt
    assert "square composition, no text, no logo, no watermark" in prompt


def test_texture_prompt_changes_material_without_changing_style() -> None:
    prompt = apply_image_texture_prompt("base scene", "watercolor")

    assert "watercolor texture" in prompt
    assert "keep the same hand-drawn storybook drawing style" in prompt
    assert "change only the physical art texture and material finish" in prompt


def test_unknown_texture_falls_back_to_oil_pastel() -> None:
    prompt = apply_image_texture_prompt("base scene", "unknown")

    assert "oil pastel and gouache texture" in prompt
