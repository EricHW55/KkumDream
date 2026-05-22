/**
 * Typography tokens for KKUMDREAM.
 *
 * Korean UI font preference: Pretendard or SUIT. These are not bundled
 * with React Native by default — to use them in production, add the
 * .otf/.ttf files under android/app/src/main/assets/fonts and to the
 * iOS project, then drop the Platform fallback below.
 *
 * Until bundled the system fallback (`undefined` fontFamily) is used,
 * which on iOS resolves to SF Pro and on Android to Roboto.
 */

import { Platform, type TextStyle } from 'react-native';

export const fontFamily = {
  /** Korean UI — Pretendard/SUIT when bundled. Falls back to system. */
  korean: Platform.select<string | undefined>({
    ios: 'Pretendard',
    android: 'Pretendard',
    default: undefined,
  }),
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
  /** Hand-written feel for the wordmark fallback. */
  handwritten: Platform.select<string | undefined>({
    ios: 'Marker Felt',
    android: 'casual',
    default: undefined,
  }),
} as const;

type TypoStyle = Pick<
  TextStyle,
  | 'fontFamily'
  | 'fontSize'
  | 'fontWeight'
  | 'lineHeight'
  | 'letterSpacing'
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
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  body: {
    fontFamily: fontFamily.korean,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
  },
  caption: {
    fontFamily: fontFamily.korean,
    fontSize: 12,
    fontWeight: '600',
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
