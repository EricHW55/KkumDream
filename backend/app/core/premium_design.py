"""Which dream design values are free vs. require an active pass.

The server is the enforcer; the mobile client mirrors these sets for lock UI.
Any valid design value not listed as free is pass-only.
"""

FREE_CARD_COLORS = frozenset({"beige", "ivory", "peach"})
FREE_CARD_FRAMES = frozenset({"classic", "tag"})
FREE_FONT_STYLES = frozenset({"dahaeng", "daegwangyuri", "rounded", "clean"})


def premium_values(design: dict) -> list[str]:
    found: list[str] = []
    color = design.get("card_color")
    if color is not None and color not in FREE_CARD_COLORS:
        found.append(f"card_color:{color}")
    frame = design.get("card_frame")
    if frame is not None and frame not in FREE_CARD_FRAMES:
        found.append(f"card_frame:{frame}")
    font = design.get("font_style")
    if font is not None and font not in FREE_FONT_STYLES:
        found.append(f"font_style:{font}")
    return found


def requires_pass(design: dict) -> bool:
    return bool(premium_values(design))
