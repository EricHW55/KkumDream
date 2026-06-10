import {
  Platform,
  StyleSheet,
  Text,
  type TextProps,
  type StyleProp,
  type TextStyle,
  View,
} from 'react-native';

type FakeBoldTextProps = TextProps & {
  style?: StyleProp<TextStyle>;
  /** Horizontal overdraw in px. Start ~0.35; raise to 0.5–0.6 for heavier. */
  offset?: number;
};

/**
 * iOS-only fake-bold for the Nanum handwriting fonts, which ship no real Bold
 * face. Draws the same text twice — a lower copy nudged horizontally — to
 * thicken the stroke. The overlay copy inherits `style`, so its color always
 * matches; nothing to pass in. On Android (where `fontWeight` faux-bolds) it
 * renders a plain `Text`.
 *
 * This is the FALLBACK to {@link handwritingEmphasis}'s textShadow path: the
 * overlay wraps text in a `View`, which can shift layout, so reach for it only
 * on specific short titles where the textShadow result looks off. Not for body
 * copy or text that wraps — the absolute copy does not drive layout.
 */
export function FakeBoldText({
  style,
  offset = 0.35,
  children,
  ...rest
}: FakeBoldTextProps) {
  if (Platform.OS !== 'ios') {
    return (
      <Text style={style} {...rest}>
        {children}
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[style, styles.overlay, { left: offset }]}
        {...rest}
      >
        {children}
      </Text>
      <Text style={style} {...rest}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  overlay: {
    position: 'absolute',
    top: 0,
  },
});
