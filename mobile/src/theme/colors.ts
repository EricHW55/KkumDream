/**
 * KKUMDREAM color tokens.
 *
 * Stable hex values mirror the published design-system spec
 * (docs/design-system.md). Keep this file in sync with that doc; if you
 * need a new color, add it here first and document it.
 */

export const palette = {
  // Surfaces
  appBackground: '#FBFAF4',
  appBackgroundAlt: '#F8F4EA',
  cardPaper: '#FFFDF7',
  cardPaperAlt: '#FDF5E6',

  // Inks
  inkDeep: '#1F1E1B',
  inkMuted: '#5F5A52',
  inkDivider: '#D8CDBB',

  // Brand
  lavenderPrimary: '#6E5BC6',
  lavenderSoft: '#E9E4FB',

  // Accents
  starYellow: '#FFD66B',
  oceanBlue: '#8DD6D1',
  softPink: '#FFD6E8',
} as const;

/**
 * Application-facing color names. Some are legacy aliases preserved so
 * existing screens keep building; new code should prefer the canonical
 * palette tokens above.
 */
export const colors = {
  // Background / surfaces
  background: palette.appBackground,
  backgroundAlt: palette.appBackgroundAlt,
  cardBase: palette.cardPaper,
  cardIvory: palette.cardPaper,
  cardPaperAlt: palette.cardPaperAlt,

  // Brand lavender
  primary: palette.lavenderPrimary,
  primaryDark: palette.inkDeep,
  primaryLight: '#A99CF2',
  lavenderTint: palette.lavenderSoft,
  lavenderMist: '#F1EAF6',

  // Sky / ocean
  skyTint: '#E4F3F0',
  skyMist: '#F1FAF6',

  // Inks / text
  textPrimary: palette.inkDeep,
  textSecondary: palette.inkMuted,
  textMuted: '#8B7F6F',
  divider: palette.inkDivider,

  // Accents (legacy names kept; canonical names live alongside)
  accent: palette.oceanBlue,
  oceanAccent: palette.oceanBlue,
  outboxAccent: palette.oceanBlue,
  starAccent: palette.starYellow,
  moonAccent: palette.starYellow,
  pinkAccent: palette.softPink,

  // Status
  success: '#6CB89E',
  warning: '#DDAF58',
  error: '#D97E8E',
} as const;

export type AppColor = keyof typeof colors;
