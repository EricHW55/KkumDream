/**
 * Typography tokens for KKUMDREAM.
 *
 * Korean UI font preference now leans toward a warm handwritten feel.
 * Bundled custom Korean handwriting fonts can replace these platform
 * fallbacks later without changing component code.
 */

import { Platform, type TextStyle } from 'react-native';

import { nanumHandwritingFonts } from './fonts';
// TEMP preview toggle — delete with src/debug/handwritingBoldPreview.tsx.
import { isHandwritingFakeBoldForced } from '../debug/handwritingBoldPreview';

/**
 * Resolve a handwriting weight to a real font face.
 *
 * The Nanum handwriting font ships only a Regular face, so on iOS `fontWeight`
 * is ignored and bold titles render thin. We bundle a pre-baked Bold face
 * (NanumDaHaengCeBold, outline-dilated from the Regular) and select it by name
 * for weight >= 600, which renders identically and cleanly on both platforms.
 *
 * Android keeps its native synthetic-bold (`fontWeight`) for now; the dev
 * preview toggle flips Android onto the baked path so the two can be compared.
 * Once confirmed, drop the toggle and let Android use the baked faces too.
 */
const HANDWRITING_BOLD = 'NanumDaHaengCeBold';

export function handwritingFont(
  weight: TextStyle['fontWeight'],
): Pick<TextStyle, 'fontFamily' | 'fontWeight'> {
  const isBold = Number(weight) >= 600;
  // TEMP: `|| isHandwritingFakeBoldForced()` lets the Android toggle preview the
  // baked path. Remove the call when deleting the preview tooling.
  const useBaked = Platform.OS === 'ios' || isHandwritingFakeBoldForced();
  if (useBaked) {
    return {
      fontFamily: isBold ? HANDWRITING_BOLD : nanumHandwritingFonts.dahaeng,
    };
  }
  return { fontFamily: nanumHandwritingFonts.dahaeng, fontWeight: weight };
}

export const fontFamily = {
  /** Korean UI — bundled handwritten font. */
  korean: nanumHandwritingFonts.dahaeng,
  /** English metadata — monospaced ticket print. */
  mono: Platform.select<string | undefined>({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  }),
  /** Display serif for titles and the dream wordmark. */
  serif: Platform.select<string | undefined>({
    ios: 'Georgia',
    android: 'serif',
    default: 'serif',
  }),
  /** Hand-written feel for app UI. */
  handwritten: nanumHandwritingFonts.dahaeng,
} as const;

type TypoStyle = Pick<
  TextStyle,
  'fontFamily' | 'fontSize' | 'fontWeight' | 'lineHeight' | 'letterSpacing'
>;

/**
 * Reusable text presets. Compose with `StyleSheet` like:
 *
 *   <Text style={[textStyle.title, { color: colors.textPrimary }]} />
 */
export const textStyle = {
  display: {
    fontFamily: fontFamily.serif,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
    letterSpacing: -0.3,
  },
  title: {
    fontFamily: fontFamily.serif,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: fontFamily.korean,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontFamily: fontFamily.korean,
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 21,
  },
  caption: {
    fontFamily: fontFamily.korean,
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 17,
  },
  metaLabel: {
    fontFamily: fontFamily.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  metaValue: {
    fontFamily: fontFamily.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  wordmark: {
    fontFamily: fontFamily.serif,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  storyBody: {
    fontFamily: fontFamily.serif,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 26,
  },
} as const satisfies Record<string, TypoStyle>;

export type TextPreset = keyof typeof textStyle;
