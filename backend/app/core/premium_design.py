"""Which dream design values are free vs. require an active pass.

The free sets live in settings (env-overridable); anything not listed as free
is pass-only. The server enforces this on dream writes, and the mobile client
mirrors it via GET /billing/pass-info so locks change without an app release.
"""

from app.core.config import settings


def premium_values(design: dict) -> list[str]:
    found: list[str] = []
    color = design.get("card_color")
    if color is not None and color not in settings.free_card_colors:
        found.append(f"card_color:{color}")
    frame = design.get("card_frame")
    if frame is not None and frame not in settings.free_card_frames:
        found.append(f"card_frame:{frame}")
    font = design.get("font_style")
    if font is not None and font not in settings.free_font_styles:
        found.append(f"font_style:{font}")
    letter_paper = design.get("letter_paper")
    if letter_paper is not None and letter_paper not in settings.free_letter_papers:
        found.append(f"letter_paper:{letter_paper}")
    return found


def requires_pass(design: dict) -> bool:
    return bool(premium_values(design))


def tone_requires_pass(tone: str | None) -> bool:
    return tone is not None and tone not in settings.free_tones


def story_length_requires_pass(length: str | None) -> bool:
    return length is not None and length not in settings.free_story_lengths
