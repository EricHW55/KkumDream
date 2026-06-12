"""Bake graduated faces of NanumDaHaengCe with FontForge changeWeight (CJK).

The bundled NanumDaHaengCe handwriting font ships only a Regular face, and
iOS does not synthesize the same handwritten weights as Android. Android keeps
the Regular font plus native `fontWeight`; iOS maps the Android weights to
baked faces.

`changeWeight(amount, "cjk")` thickens stems while preserving counters and the
narrow notches in glyphs like 받 / 정 (unlike naive outline dilation, which fills
them into blobs). Runs in cubic to avoid TrueType 2nd-order-spline warnings.

Requires FontForge (NOT a pip package):
    winget install -e --id FontForge.FontForge
Run with FontForge's bundled python (ffpython), e.g. on Windows:
    "C:\\Program Files\\FontForgeBuilds\\bin\\ffpython.exe" tools/font-bake/bake_bold.py
    ... 20 NanumDaHaengCeBold 700     # bake one weight: amount, name, os2weight

With no args it bakes all weights below. Output -> src/assets/fonts/.

Current amounts (tune on device with the floating font-mode toggle):
    Medium   (500) = cjk 7
    SemiBold (600) = cjk 12
    Bold     (700) = cjk 20
    ExtraBold(800) = cjk 28
    Heavy    (900) = cjk 36
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
    ("NanumDaHaengCeMedium", 7, 500),
    ("NanumDaHaengCeSemiBold", 12, 600),
    ("NanumDaHaengCeBold", 20, 700),
    ("NanumDaHaengCeExtraBold", 28, 800),
    ("NanumDaHaengCeHeavy", 36, 900),
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
    # NOTE: changeWeight corrupts a few rare glyphs (runaway coords) and FontForge
    # recomputes the font bbox from them. pin_metrics.py (run afterwards) replaces
    # those glyphs and pins the vertical metrics to the Regular's.
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
