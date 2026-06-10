"""Bake a Bold face of NanumDaHaengCe by outline dilation.

The bundled Nanum handwriting font ships only a Regular face, so `fontWeight`
does nothing on iOS. This bakes a real Bold face so titles render the same,
cleanly, on both platforms (see src/theme/typography.ts -> handwritingFont).

Method: for every glyph, union the outline with copies translated in N
directions by `d` font units (em = 1000), then simplify. This thickens the
stroke ~d units per side, baked into the outline (no raster overdraw).

Usage (from mobile/):
    pip install fonttools skia-pathops
    python tools/font-bake/bake_bold.py            # d=13 -> NanumDaHaengCeBold
    python tools/font-bake/bake_bold.py 12         # lighter
    python tools/font-bake/bake_bold.py 14 NanumDaHaengCeBold

Output goes straight to src/assets/fonts/<Name>.ttf, which is bundled on the
next native build (and listed in ios/KkumdreamMobile/Info.plist).

Current shipped weight: d=13.
"""
import math
import os
import sys
import time

from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.recordingPen import DecomposingRecordingPen
from pathops import Path, op, PathOp

HERE = os.path.dirname(os.path.abspath(__file__))
MOBILE = os.path.abspath(os.path.join(HERE, "..", ".."))
FONTS = os.path.join(MOBILE, "src", "assets", "fonts")
SRC = os.path.join(FONTS, "NanumDaHaengCe.ttf")

D = int(sys.argv[1]) if len(sys.argv) > 1 else 13
NAME = sys.argv[2] if len(sys.argv) > 2 else "NanumDaHaengCeBold"
OUT = os.path.join(FONTS, f"{NAME}.ttf")
N_DIRS = 12

dirs = [
    (D * math.cos(2 * math.pi * i / N_DIRS), D * math.sin(2 * math.pi * i / N_DIRS))
    for i in range(N_DIRS)
]

f = TTFont(SRC)
glyf = f["glyf"]
gs = f.getGlyphSet()
start = time.time()
done = 0
for name in list(glyf.keys()):
    g = glyf[name]
    if g.numberOfContours == 0 or g.isComposite():
        continue
    rec = DecomposingRecordingPen(gs)
    gs[name].draw(rec)

    def build():
        p = Path()
        rec.replay(p.getPen())
        return p

    result = build()
    for dx, dy in dirs:
        # transform() returns a NEW path; it does not mutate in place.
        result = op(result, build().transform(1, 0, 0, 1, dx, dy), PathOp.UNION)
    result.simplify()
    ttp = TTGlyphPen(None)
    result.draw(Cu2QuPen(ttp, max_err=1.0, reverse_direction=True))
    glyf[name] = ttp.glyph()
    done += 1
    if done % 2000 == 0:
        print(f"  {done} glyphs  ({time.time() - start:.0f}s)")

name_tbl = f["name"]
for rec in list(name_tbl.names):
    if rec.nameID in (1, 4, 6, 16):
        name_tbl.setName(NAME, rec.nameID, rec.platformID, rec.platEncID, rec.langID)
    elif rec.nameID in (2, 17):
        name_tbl.setName("Regular", rec.nameID, rec.platformID, rec.platEncID, rec.langID)
name_tbl.setName(NAME, 1, 3, 1, 0x409)
name_tbl.setName("Regular", 2, 3, 1, 0x409)
name_tbl.setName(NAME, 4, 3, 1, 0x409)
name_tbl.setName(NAME, 6, 3, 1, 0x409)
f["OS/2"].usWeightClass = 700

f.save(OUT)
print(f"saved {OUT}  ({done} glyphs, {time.time() - start:.0f}s, {os.path.getsize(OUT) // 1024} KB)")
