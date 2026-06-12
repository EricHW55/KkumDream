/**
 * Typography tokens for KKUMDREAM.
 *
 * Korean UI font preference now leans toward a warm handwritten feel.
 * Bundled custom Korean handwriting fonts can replace these platform
 * fallbacks later without changing component code.
 */

import { Platform, type TextStyle } from 'react-native';

import { getHandwritingFontMode } from '../data/fontMode';
import { nanumDahaengWeightFonts, nanumHandwritingFonts } from './fonts';

/**
 * Resolve the handwritten UI font.
 *
 * Android's design baseline uses the Regular font plus native `fontWeight`.
 * iOS does not synthesize the same handwritten weights, so its default mode
 * maps each Android weight to a baked face. The floating test toggle switches
 * between these two render paths.
 */
const BAKED_FACES = {
  medium: nanumDahaengWeightFonts.medium, // 500
  semibold: nanumDahaengWeightFonts.semibold, // 600
  bold: nanumDahaengWeightFonts.bold, // 700
  extrabold: nanumDahaengWeightFonts.extrabold, // 800
  heavy: nanumDahaengWeightFonts.heavy, // 900+
} as const;

function bakedFamily(weight: TextStyle['fontWeight']): string {
  const w = Number(weight);
  if (w >= 900) return BAKED_FACES.heavy;
  if (w >= 800) return BAKED_FACES.extrabold;
  if (w >= 700) return BAKED_FACES.bold;
  if (w >= 600) return BAKED_FACES.semibold;
  if (w >= 500) return BAKED_FACES.medium;
  return nanumHandwritingFonts.dahaeng; // 400 stays Regular
}

export function handwritingFont(
  weight: TextStyle['fontWeight'],
): Pick<TextStyle, 'fontFamily' | 'fontWeight'> {
  if (getHandwritingFontMode() === 'ios-baked') {
    return { fontFamily: bakedFamily(weight) };
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
    ...handwritingFont('700'),
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    ...handwritingFont('500'),
    fontSize: 14,
    lineHeight: 21,
  },
  caption: {
    ...handwritingFont('600'),
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
