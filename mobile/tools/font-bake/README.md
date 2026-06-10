# Font baking — NanumDaHaengCe bold weights

The bundled **NanumDaHaengCe** handwriting font ships only a Regular face, so
`fontWeight` is ignored on iOS and bold text renders thin. The app's design uses
several weights (600 / 700 / 800), so we bake **one face per weight** to keep the
hierarchy on iOS — matching how Android renders the weights natively.

## What's where

- `bake_bold.py` — the bake script (FontForge stem-aware `changeWeight`, CJK).
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
"$FF" tools/font-bake/bake_bold.py 26 NanumDaHaengCeBold 700   # one weight: amount name os2
```

`amount` is the `changeWeight` stroke amount (font units, em = 1000); higher =
thicker. Current amounts: **SemiBold 14, Bold 22, ExtraBold 30** — tune these on
device against Android (the dev toggle flips Android onto the baked path). After
re-baking, rebuild the app.

## Why FontForge (not outline dilation)

A naive "dilate the outline" embolden grows every edge uniformly, so it **fills
the narrow notches** in handwriting glyphs (e.g. the ㅏ joint in 받, the crossing
in ㅈ) into solid blobs. `changeWeight(amount, "cjk")` is stem-aware: it thickens
strokes while preserving counters and notches, so the bold stays clean.

`changeWeight` prints `Invalid 2nd order spline` / `overlap` internal warnings on
some glyphs — non-fatal; the generated fonts render correctly.
