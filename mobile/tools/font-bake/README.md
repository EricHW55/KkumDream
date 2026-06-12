# Font baking - NanumDaHaengCe iOS weights

The bundled **NanumDaHaengCe** handwriting font ships only a Regular face, so
`fontWeight` is not rendered identically across iOS and Android. Android is the
design baseline and keeps the Regular face plus native `fontWeight`; iOS uses
one baked face per Android weight.

## What's where

- `bake_bold.py` - the bake script (FontForge stem-aware `changeWeight`, CJK).
- `pin_metrics.py` - post-process (fontTools): replaces the few glyphs
  `changeWeight` corrupts and pins each face's vertical metrics to the Regular's
  so baked faces keep the same line box.
- Runtime iOS fonts are bundled on build and listed in
  `ios/KkumdreamMobile/Info.plist`:
  - `src/assets/fonts/NanumDaHaengCeMedium.ttf` (500)
  - `src/assets/fonts/NanumDaHaengCeSemiBold.ttf` (600)
  - `src/assets/fonts/NanumDaHaengCeBold.ttf` (700)
  - `src/assets/fonts/NanumDaHaengCeExtraBold.ttf` (800)
  - `src/assets/fonts/NanumDaHaengCeHeavy.ttf` (900+)
- `handwritingFont(weight)` in `src/theme/typography.ts` maps iOS to baked
  faces and Android to the existing Regular + `fontWeight` path.
- The temporary floating font toggle switches between `ios-baked` and
  `android-native` render modes for device comparison.

## Re-bake

FontForge is required (a standalone app, not a pip package):

```bash
winget install -e --id FontForge.FontForge
FF="C:\Program Files\FontForgeBuilds\bin\ffpython.exe"

"$FF" tools/font-bake/bake_bold.py
"$FF" tools/font-bake/bake_bold.py 26 NanumDaHaengCeBold 700
python tools/font-bake/pin_metrics.py
```

`amount` is the `changeWeight` stroke amount (font units, em = 1000); higher is
thicker. Current amounts: **Medium 11, SemiBold 16, Bold 26, ExtraBold 32,
Heavy 40**. Use the floating font toggle to compare the iOS baked path against
Android's native `fontWeight` path on device.

Always run `pin_metrics.py` after `bake_bold.py`. It fixes corrupted glyphs and
the font bbox. After re-baking, rebuild the app.

## Why FontForge

A naive outline dilation emboldens every edge uniformly and can fill narrow
notches in handwriting glyphs. `changeWeight(amount, "cjk")` is stem-aware: it
thickens strokes while preserving counters and notches, so the bold stays clean.

`changeWeight` prints `Invalid 2nd order spline` / `overlap` internal warnings
on some glyphs. Those warnings are non-fatal.
