import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import cloudLeftImage from '../assets/illustrations/dream_loading_cloud_left.png';
import cloudRightImage from '../assets/illustrations/dream_loading_cloud_right.png';
import moonImage from '../assets/illustrations/dream_loading_moon.png';
import starImage from '../assets/illustrations/dream_loading_star.png';
import { colors } from '../theme/colors';
import { handwritingFont } from '../theme/typography';

// Watercolour clouds are drawn wider than they are tall.
const CLOUD_ASPECT = 0.72;

type Props = {
  title: string;
  subtitle?: string;
  compact?: boolean;
};

export function DreamGenerationAnimation({ title, subtitle, compact }: Props) {
  const float = useSharedValue(0);
  const drift = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, {
        duration: 1800,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
    drift.value = withRepeat(
      withTiming(1, {
        duration: 2600,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
    glow.value = withRepeat(
      withTiming(1, {
        duration: 1200,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [drift, float, glow]);

  const moonStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(float.value, [0, 1], [4, -8]) },
      { rotate: `${interpolate(float.value, [0, 1], [-6, 6])}deg` },
    ],
  }));

  const leftCloudStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drift.value, [0, 1], [0.7, 1]),
    transform: [{ translateX: interpolate(drift.value, [0, 1], [-8, 10]) }],
  }));

  const rightCloudStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drift.value, [0, 1], [1, 0.7]),
    transform: [{ translateX: interpolate(drift.value, [0, 1], [9, -9]) }],
  }));

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.3, 1]),
    transform: [
      { scale: interpolate(glow.value, [0, 1], [0.82, 1.12]) },
      { rotate: `${interpolate(glow.value, [0, 1], [-8, 8])}deg` },
    ],
  }));

  const moonSize = compact ? 50 : 64;
  const starSize = compact ? 22 : 28;
  const leftCloudWidth = compact ? 46 : 58;
  const rightCloudWidth = compact ? 52 : 66;

  return (
    <View style={[styles.root, compact && styles.compactRoot]}>
      <View style={[styles.sky, compact && styles.compactSky]}>
        <Animated.View style={[styles.cloudLeft, leftCloudStyle]}>
          <Image
            source={cloudLeftImage}
            fadeDuration={0}
            resizeMode="contain"
            style={{
              width: leftCloudWidth,
              height: leftCloudWidth * CLOUD_ASPECT,
            }}
          />
        </Animated.View>
        <Animated.View style={[styles.moon, moonStyle]}>
          <Image
            source={moonImage}
            fadeDuration={0}
            resizeMode="contain"
            style={{ width: moonSize, height: moonSize }}
          />
        </Animated.View>
        <Animated.View style={[styles.sparkle, sparkleStyle]}>
          <Image
            source={starImage}
            fadeDuration={0}
            resizeMode="contain"
            style={{ width: starSize, height: starSize }}
          />
        </Animated.View>
        <Animated.View style={[styles.cloudRight, rightCloudStyle]}>
          <Image
            source={cloudRightImage}
            fadeDuration={0}
            resizeMode="contain"
            style={{
              width: rightCloudWidth,
              height: rightCloudWidth * CLOUD_ASPECT,
            }}
          />
        </Animated.View>
      </View>
      <Text style={[styles.title, compact && styles.compactTitle]}>{title}</Text>
      {subtitle ? (
        <Text style={[styles.subtitle, compact && styles.compactSubtitle]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 196,
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderMist,
    borderWidth: 1,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  compactRoot: {
    flex: 1,
    minHeight: 0,
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: colors.lavenderTint,
  },
  sky: {
    width: 156,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactSky: {
    width: 132,
    height: 76,
  },
  moon: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloudLeft: {
    position: 'absolute',
    left: 2,
    bottom: 12,
  },
  cloudRight: {
    position: 'absolute',
    right: 0,
    bottom: 4,
  },
  sparkle: {
    position: 'absolute',
    top: 6,
    right: 24,
  },
  title: {
    marginTop: 14,
    color: colors.primaryDark,
    ...handwritingFont('800'),
    fontSize: 18,
    includeFontPadding: false,
  },
  compactTitle: {
    marginTop: 8,
    fontSize: 16,
  },
  subtitle: {
    marginTop: 8,
    color: colors.textSecondary,
    ...handwritingFont('600'),
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  compactSubtitle: {
    maxWidth: 220,
    fontSize: 12,
    lineHeight: 17,
  },
});
