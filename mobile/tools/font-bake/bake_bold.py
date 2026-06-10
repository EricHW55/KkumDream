"""Bake graduated Bold faces of NanumDaHaengCe with FontForge changeWeight (CJK).

The bundled NanumDaHaengCe handwriting font ships only a Regular face, so
`fontWeight` does nothing on iOS. The app's design uses several weights
(600/700/800), so we bake one Bold face per weight to preserve that hierarchy
on iOS — matching how Android renders the weights natively.

`changeWeight(amount, "cjk")` thickens stems while preserving counters and the
narrow notches in glyphs like 받 / 정 (unlike naive outline dilation, which fills
them into blobs). Runs in cubic to avoid TrueType 2nd-order-spline warnings.

Requires FontForge (NOT a pip package):
    winget install -e --id FontForge.FontForge
Run with FontForge's bundled python (ffpython), e.g. on Windows:
    "C:\\Program Files\\FontForgeBuilds\\bin\\ffpython.exe" tools/font-bake/bake_bold.py
    ... 22 NanumDaHaengCeBold 700     # bake one weight: amount, name, os2weight

With no args it bakes all three weights below. Output -> src/assets/fonts/.

Current amounts (tune to match Android on device):
    SemiBold (600) = cjk 14
    Bold     (700) = cjk 22
    ExtraBold(800) = cjk 30
"""
import os
import sys
import time

import fontforge

HERE = os.path.dirname(os.path.abspath(__file__))
MOBILE = os.path.abspath(os.path.join(HERE, "..", ".."))
FONTS = os.path.join(MOBILE, "src", "assets", "fonts")
SRC = os.path.join(FONTS, "NanumDaHaengCe.ttf")

WEIGHTS = [
    ("NanumDaHaengCeSemiBold", 14, 600),
    ("NanumDaHaengCeBold", 22, 700),
    ("NanumDaHaengCeExtraBold", 30, 800),
]
if len(sys.argv) > 1:
    WEIGHTS = [(sys.argv[2], int(sys.argv[1]), int(sys.argv[3]))]


def bake(name, amount, os2):
    t = time.time()
    f = fontforge.open(SRC)
    f.is_quadratic = False  # cubic avoids 2nd-order-spline warnings
    f.selection.all()
    n = 0
    for g in f.selection.byGlyphs:
        try:
            if g.isWorthOutputting():
                g.changeWeight(amount, "cjk")
                n += 1
        except Exception:
            pass
    f.familyname = name
    f.fontname = name
    f.fullname = name
    f.weight = "Bold"
    f.os2_weight = os2
    f.appendSFNTName("English (US)", "Family", name)
    f.appendSFNTName("English (US)", "SubFamily", "Regular")
    f.appendSFNTName("English (US)", "Fullname", name)
    f.appendSFNTName("English (US)", "PostScriptName", name)
    out = os.path.join(FONTS, name + ".ttf")
    f.generate(out)
    f.close()
    print("saved %s  (cjk %d, %d glyphs, %.0fs)" % (out, amount, n, time.time() - t))


for name, amount, os2 in WEIGHTS:
    bake(name, amount, os2)
