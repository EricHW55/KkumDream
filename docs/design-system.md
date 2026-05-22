# KKUMDREAM Design System

The visual language for KKUMDREAM. Every screen, card, and surface
should be reducible to the tokens and principles below. When in doubt
prefer **less ornament + warmer paper** over decorative additions.

## 1. Visual Metaphor

> Dream ticket + vintage paper ephemera + collectible stamp + soft
> storybook illustration.

A dream card is a small physical-feeling object you give to a friend.
The app's role is to make that object feel earned, calm, and personal —
not to feel like an SNS feed, a tarot deck, a trading card, or a
chatbot.

## 2. Color Palette

Canonical tokens live in [`mobile/src/theme/colors.ts`](../mobile/src/theme/colors.ts). All values are
exported as `palette.*`. Application color names map onto these.

### Surfaces (paper)

| Token | Hex | Use |
|---|---|---|
| `appBackground` | `#FBFAF4` | App background, primary |
| `appBackgroundAlt` | `#F8F4EA` | App background, second variant for screens that need warmer paper |
| `cardPaper` | `#FFFDF7` | Card front paper |
| `cardPaperAlt` | `#FDF5E6` | Card back paper, alt variant |

### Ink (text + borders)

| Token | Hex | Use |
|---|---|---|
| `inkDeep` | `#1F1E1B` | Primary text, dark borders, icon strokes |
| `inkMuted` | `#5F5A52` | Secondary text, metadata values |
| `inkDivider` | `#D8CDBB` | Hairlines, dotted dividers, perforations |

### Brand

| Token | Hex | Use |
|---|---|---|
| `lavenderPrimary` | `#6E5BC6` | Primary buttons, focused states, accents |
| `lavenderSoft` | `#E9E4FB` | Background washes, chip fills |

### Accents

| Token | Hex | Use |
|---|---|---|
| `starYellow` | `#FFD66B` | Stars, wordmark glyphs, "new dream" markers |
| `oceanBlue` | `#8DD6D1` | Outbox cells, inbox accents |
| `softPink` | `#FFD6E8` | Friendly highlights, warm states |

**Avoid** introducing new colors without adding them here first.

## 3. Typography

Canonical tokens live in [`mobile/src/theme/typography.ts`](../mobile/src/theme/typography.ts).

### Font families

| Token | Korean preferred | English/metadata preferred |
|---|---|---|
| `fontFamily.korean` | Pretendard / SUIT | falls back to system |
| `fontFamily.mono` | — | Menlo / monospace |
| `fontFamily.serif` | — | Georgia / serif |
| `fontFamily.handwritten` | — | Marker Felt / casual |

To ship Pretendard or SUIT to production, drop the `.otf` files into
`mobile/android/app/src/main/assets/fonts/` and link them on iOS, then
remove the system fallback in `typography.ts`.

### Text presets (`textStyle`)

| Preset | Used for |
|---|---|
| `display` | Hero screen titles, large stamp values |
| `title` | Card title, section header |
| `subtitle` | "오늘 내가 꾼 꿈에 너를 초대합니다" copy line |
| `body` | Default UI text |
| `caption` | Small helper text |
| `metaLabel` | "FROM" / "TO" / "MOOD" — small monospaced |
| `metaValue` | The value next to a metaLabel |
| `wordmark` | "✦ 꿈드림 ✦" |
| `storyBody` | Back-of-card story paragraph |

Reach for a preset before writing inline font properties.

## 4. Card Anatomy

### Frame
- Ticket-like outer outline (rounded corners, side or top/bottom
  half-circle notches)
- Slightly imperfect printed border — single thin stroke (~1.2pt) in
  `inkDeep`
- Subtle paper texture (fibers, specks); never glossy
- Soft matte shadow (no neon glow)

### Content
- Front face uses bold serif title + subtitle copy "오늘 내가 꾼 꿈에
  너를 초대합니다"
- Single illustration window inset from the border with rounded corners
- "FROM → TO" row in monospaced metadata
- "DATE" and "MOOD" cells share a row beneath FROM/TO
- "#tags" rendered as bordered chips — no fill, just outline
- Wordmark "✦ 꿈드림 ✦" at the bottom

### Back
- Clean letter layout — no decoration in the inner area
- Title (serif), sender line (small), full story (serif body)
- Metadata block (FROM, TO, DATE, MOOD) sits below the story
- Action slot at the bottom for reactions / save / share
- The card frame may keep its outline but skip corner stars and ink
  stains for legibility (the `minimal` prop on `DreamCardFrame`)

### Sizes

| Size | Width | When |
|---|---|---|
| `thumb` | ~148 px | Grid cells, calendar dots |
| `feed` | ~320 px | Default in lists |
| `full` | ~374 px | Detail screen |

## 5. Illustration Style

For the AI-generated illustration that lives inside the card window:

- **Direction**: soft storybook / gouache / watercolor / hand-drawn
  ink. Colorful and warm.
- **Motifs**: stars, moon, clouds, sea, cats, floating objects, tiny
  houses, dreamlike scenes
- **Mood handling**: 무드 태그가 "공포·기괴함"일 때만 어둡거나 으스스한
  방향을 허용; 그 외엔 항상 따뜻하고 코지한 방향
- **Avoid**: photorealism, anime-bombastic palettes, tarot iconography,
  trading-card framing, sharp neon, generative "stock illustration"
  look

A sample AI image prompt template:

> "A soft storybook gouache illustration of {scene}, warm cozy
> palette, dreamy starlight, subtle paper texture, gentle composition,
> no text, no logo, square aspect."

## 6. UI Principles

Captured in code at [`mobile/src/theme/index.ts`](../mobile/src/theme/index.ts) under `principles`:

- **Card-first.** The card is the content; screens are containers.
- **Card-only rooms.** Dream rooms hold dream cards. No free-text chat
  bubbles.
- **Separated collections.** "Received" and "sent" feel like two
  different stamp albums, not a unified inbox.
- **Matte shadows.** Soft, low-opacity. Never glossy or neon.
- **Tone.** Calm, magical, intimate. If a screen feels noisy or
  marketing-y, remove rather than add.

## 7. What To Avoid

Mirrored in code at [`mobile/src/theme/index.ts`](../mobile/src/theme/index.ts) under `avoid`:

| Anti-pattern | What it looks like in our app |
|---|---|
| tarot-card-style | Symmetric borders, occult motifs, gold filigree |
| trading-card-game-style | Stat blocks, rarity ribbons, mana costs |
| casino-ticket-style | Loud red/black, scratch-off textures |
| pure-black-and-white-ui | Removes the warmth that defines the brand |
| corporate-saas-look | Flat blue gradients, geometric sans, big CTAs |
| generic-ai-chatbot-look | Bubble UI, model-name footers, "Ask me" |
| busy-sns-feed-look | Infinite scrolls, engagement counters at top |

If you're tempted to add a new visual element, check whether it pushes
the app toward one of the above. Prefer the dream-stamp metaphor.

## 8. Using the System in Code

```ts
import { colors, textStyle, spacing, radius, designSystem } from '../theme';

const styles = StyleSheet.create({
  paper: {
    backgroundColor: colors.cardPaperAlt,
    borderRadius: radius.card,
    padding: spacing.md,
  },
  title: {
    ...textStyle.title,
    color: colors.textPrimary,
  },
  meta: {
    ...textStyle.metaLabel,
    color: colors.textSecondary,
  },
});
```

For one-off prototyping you can also do `designSystem.colors.inkDeep`
to keep the import surface minimal.

## 9. Adding to the System

When introducing a new token:

1. Add the hex to `palette` (or text preset to `textStyle`).
2. Expose it through `colors` if it deserves an application-facing
   name.
3. Document the use in this file.
4. Search the codebase for inline hex values that the new token now
   replaces and convert them.

Tokens that exist only inside one screen should stay inline — if you
find yourself reaching for the same hex twice, that's the threshold to
promote it.
