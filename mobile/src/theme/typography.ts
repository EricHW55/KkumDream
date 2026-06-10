/**
 * Typography tokens for KKUMDREAM.
 *
 * Korean UI font preference now leans toward a warm handwritten feel.
 * Bundled custom Korean handwriting fonts can replace these platform
 * fallbacks later without changing component code.
 */

import { Platform, type TextStyle } from 'react-native';

import { colors } from './colors';
import { nanumHandwritingFonts } from './fonts';

/**
 * Fake-bold for the bundled Nanum handwriting fonts.
 *
 * These fonts ship a single Regular face (`NanumDaHaengCe.ttf`, etc.) with no
 * real Bold. Android still faux-bolds via `fontWeight`, but iOS ignores it and
 * renders thin — so handwriting titles look weak on iOS. We thicken the stroke
 * with a zero-radius `textShadow` painted in the text's OWN color. The shadow
 * must match the glyph color, otherwise it reads as a drop shadow instead of a
 * heavier stroke — which is why this is a function of `color`, not a static
 * style. Android keeps the cheaper faux-bold path.
 *
 * Apply ONLY to titles / logos / short emphasis. Never to long body copy:
 * the overdraw muddies small text and the shadow has a real fill cost.
 */
export type HandwritingEmphasisLevel = 'title' | 'subtitle';

const IOS_EMPHASIS_OFFSET: Record<HandwritingEmphasisLevel, number> = {
  // Tune 0.25–0.6. Bump toward 0.5–0.6 if titles still look thin on device.
  title: 0.4,
  subtitle: 0.25,
};

const ANDROID_EMPHASIS_WEIGHT: Record<
  HandwritingEmphasisLevel,
  TextStyle['fontWeight']
> = {
  title: '700',
  subtitle: '600',
};

export function handwritingEmphasis(
  color: string,
  level: HandwritingEmphasisLevel = 'title',
): TextStyle {
  if (Platform.OS === 'ios') {
    return {
      textShadowColor: color,
      textShadowOffset: { width: IOS_EMPHASIS_OFFSET[level], height: 0 },
      textShadowRadius: 0,
    };
  }
  return { fontWeight: ANDROID_EMPHASIS_WEIGHT[level] };
}

/** Ready-made emphasis for the dominant ink colors. */
export const handwritingTitleEmphasis = handwritingEmphasis(
  colors.textPrimary,
  'title',
);
export const handwritingSubtitleEmphasis = handwritingEmphasis(
  colors.textSecondary,
  'subtitle',
);

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
  // Handwriting subtitle / short emphasis. The fontWeight only faux-bolds on
  // Android; for the matching iOS treatment compose with
  // `handwritingEmphasis(color, 'subtitle')` at the call site (it needs the
  // text color). See the helper above.
  subtitle: {
    fontFamily: fontFamily.korean,
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 22,
  },
  // Handwriting body copy — kept Regular on both platforms. Do NOT add
  // fake-bold here; the overdraw muddies long, small text.
  body: {
    fontFamily: fontFamily.korean,
    fontWeight: '400',
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
