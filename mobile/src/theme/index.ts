/**
 * KKUMDREAM Design System — central import.
 *
 * Reach for `designSystem` when you need everything bundled; reach for
 * the individual tokens (`colors`, `textStyle`, `spacing`, `radius`)
 * when you only need part of the system.
 */

export { colors, palette } from './colors';
export type { AppColor } from './colors';
export { fontFamily, textStyle } from './typography';
export type { TextPreset } from './typography';
export { radius, spacing } from './spacing';
export { interactionStyles } from './interactions';

import { colors, palette } from './colors';
import { fontFamily, textStyle } from './typography';
import { interactionStyles } from './interactions';
import { radius, spacing } from './spacing';

/**
 * Design principles surfaced as code so component authors can reference
 * them, lint against them, and write tests around the intended visual
 * language. Keep the list short — anything bigger than a sentence
 * belongs in docs/design-system.md.
 */
export const principles = {
  /** Cards are the primary content unit. Screens are containers. */
  cardFirst: true,
  /** Dream rooms render only dream cards, never free chat bubbles. */
  cardOnlyRooms: true,
  /** Received and sent cards are presented as separate collections. */
  separatedInboxOutbox: true,
  /** Soft shadows only; no glossy / neon highlights. */
  matteShadows: true,
  /** Tone: calm, magical, intimate. */
  toneKeywords: ['calm', 'magical', 'intimate'] as const,
} as const;

/**
 * What this design system explicitly avoids. Pair with a code review
 * checklist; if a screen drifts toward one of these, refactor.
 */
export const avoid = [
  'tarot-card-style',
  'trading-card-game-style',
  'casino-ticket-style',
  'pure-black-and-white-ui',
  'corporate-saas-look',
  'generic-ai-chatbot-look',
  'busy-sns-feed-look',
] as const;

export const designSystem = {
  palette,
  colors,
  fontFamily,
  textStyle,
  spacing,
  radius,
  interactionStyles,
  principles,
  avoid,
} as const;

export type DesignSystem = typeof designSystem;
