# Font baking — NanumDaHaengCe Bold

The bundled **NanumDaHaengCe** handwriting font ships only a Regular face, so
`fontWeight` is ignored on iOS and bold titles render thin. We bake a real
**Bold** face from the Regular outlines so titles look the same — and clean —
on both platforms.

## What's where

- `bake_bold.py` — the bake script (outline dilation).
- Runtime font: **`src/assets/fonts/NanumDaHaengCeBold.ttf`** (bundled on build,
  listed in `ios/KkumdreamMobile/Info.plist`). This is the only baked file that
  ships.
- Consumed via `handwritingFont(weight)` in `src/theme/typography.ts`
  (weight ≥ 600 → the Bold face).

## Re-bake

```bash
pip install fonttools skia-pathops      # one-time
python tools/font-bake/bake_bold.py      # d=13 (current), writes the .ttf
python tools/font-bake/bake_bold.py 12   # lighter
python tools/font-bake/bake_bold.py 14   # heavier
```

`d` is the dilation amount in font units (em = 1000); higher = thicker. The
current shipped weight is **d = 13**. After re-baking, rebuild the app.

## Notes / limitations

- Dilation thickens uniformly, so very tight inner angles (e.g. the joints in
  ㅈ / ㅏ) fill in slightly at higher `d` — lower `d` if it bothers you, or use a
  stem-aware tool (FontForge `changeWeight`) for crisper counters.
- To add another weight (e.g. a SemiBold for `fontWeight: '600'`), bake a second
  file with a different name and split the mapping in `handwritingFont`.
