"""Post-process baked fonts: fix corrupted glyphs and pin vertical metrics.

1. changeWeight occasionally blows a few glyphs' coordinates out to infinity.
   Replace any glyph with an absurd bounding box with the Regular outline.
2. Android's `includeFontPadding` derives line padding from font metrics (incl.
   the head bbox). Android's *native* bold uses the Regular face's metrics, so we
   copy the Regular's vertical metrics onto each baked face so the iOS baked
   faces sit identically.

Run with system python (fontTools) after baking.
"""
import os

from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen

FONTS = os.path.join(os.path.dirname(__file__), "..", "..", "src", "assets", "fonts")
ref = TTFont(os.path.join(FONTS, "NanumDaHaengCe.ttf"))
rh, rhh, ro = ref["head"], ref["hhea"], ref["OS/2"]
refglyf, refhmtx = ref["glyf"], ref["hmtx"]


def is_outlier(bounds):
    if not bounds:
        return False
    xmin, ymin, xmax, ymax = bounds
    return ymax > 1000 or ymin < -650 or xmax > 1200 or xmin < -650


for name in (
    "NanumDaHaengCeMedium",
    "NanumDaHaengCeSemiBold",
    "NanumDaHaengCeBold",
    "NanumDaHaengCeExtraBold",
    "NanumDaHaengCeHeavy",
):
    p = os.path.join(FONTS, name + ".ttf")
    f = TTFont(p)
    gs = f.getGlyphSet()
    glyf, hmtx = f["glyf"], f["hmtx"]
    fixed = 0
    for gn in f.getGlyphOrder():
        bp = BoundsPen(gs)
        try:
            gs[gn].draw(bp)
        except Exception:
            continue
        if is_outlier(bp.bounds):
            glyf[gn] = refglyf[gn]
            hmtx[gn] = refhmtx[gn]
            fixed += 1
    f["head"].yMin, f["head"].yMax = rh.yMin, rh.yMax
    f["hhea"].ascent, f["hhea"].descent, f["hhea"].lineGap = rhh.ascent, rhh.descent, rhh.lineGap
    o = f["OS/2"]
    o.sTypoAscender, o.sTypoDescender, o.sTypoLineGap = ro.sTypoAscender, ro.sTypoDescender, ro.sTypoLineGap
    o.usWinAscent, o.usWinDescent = ro.usWinAscent, ro.usWinDescent
    f.save(p)
    print("%s: replaced %d corrupted glyphs, pinned metrics" % (name, fixed))
