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
    return found


def requires_pass(design: dict) -> bool:
    return bool(premium_values(design))
