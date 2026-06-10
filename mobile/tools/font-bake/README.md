# Font baking — NanumDaHaengCe bold weights

The bundled **NanumDaHaengCe** handwriting font ships only a Regular face, so
`fontWeight` is ignored on iOS and bold text renders thin. The app's design uses
several weights (600 / 700 / 800), so we bake **one face per weight** to keep the
hierarchy on iOS — matching how Android renders the weights natively.

## What's where

- `bake_bold.py` — the bake script (FontForge stem-aware `changeWeight`, CJK).
- `pin_metrics.py` — post-process (fontTools): replaces the few glyphs
  `changeWeight` corrupts and pins each face's vertical metrics to the Regular's
  (so Android `includeFontPadding` and iOS line height match the Regular exactly).
- Runtime fonts (bundled on build, listed in `ios/KkumdreamMobile/Info.plist`):
  - `src/assets/fonts/NanumDaHaengCeSemiBold.ttf`  (600)
  - `src/assets/fonts/NanumDaHaengCeBold.ttf`       (700)
  - `src/assets/fonts/NanumDaHaengCeExtraBold.ttf`  (800+)
- Consumed via `handwritingFont(weight)` in `src/theme/typography.ts`, which maps
  each weight to its face (400/500 stay Regular).

## Re-bake

FontForge is required (a standalone app, not a pip package):

```bash
winget install -e --id FontForge.FontForge
FF="C:\Program Files\FontForgeBuilds\bin\ffpython.exe"

"$FF" tools/font-bake/bake_bold.py                       # all three weights
"$FF" tools/font-bake/bake_bold.py 40 NanumDaHaengCeBold 700   # one weight: amount name os2
python tools/font-bake/pin_metrics.py                    # ALWAYS run after baking
```

`amount` is the `changeWeight` stroke amount (font units, em = 1000); higher =
thicker. Current amounts: **SemiBold 32, Bold 38, ExtraBold 44** — tuned on device
against Android (the dev toggle flips Android onto the baked path). **Always run
`pin_metrics.py` after `bake_bold.py`** — it fixes corrupted glyphs and the font
bbox. After re-baking, rebuild the app.

## Why FontForge (not outline dilation)

A naive "dilate the outline" embolden grows every edge uniformly, so it **fills
the narrow notches** in handwriting glyphs (e.g. the ㅏ joint in 받, the crossing
in ㅈ) into solid blobs. `changeWeight(amount, "cjk")` is stem-aware: it thickens
strokes while preserving counters and notches, so the bold stays clean.

`changeWeight` prints `Invalid 2nd order spline` / `overlap` internal warnings on
some glyphs — non-fatal; the generated fonts render correctly.
