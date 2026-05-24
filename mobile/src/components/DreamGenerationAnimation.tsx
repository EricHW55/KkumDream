import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { colors } from '../theme/colors';

const INK = '#3C3530';
const MOON_LIGHT = '#FFE08A';
const MOON_SHADOW = '#E8B85A';
const STAR_FILL = '#FFD66B';
const CLOUD_FILL = '#FFFCF3';

function CrescentMoonIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path
        d="M 49 13
           C 38 10 24 14 19 24
           C 13 35 17 49 29 53
           C 38 55 47 53 52 47
           C 43 49 35 45 31 38
           C 27 31 28 22 34 16
           C 38 13 44 12 49 13 Z"
        fill={MOON_SHADOW}
      />
      <Path
        d="M 47 15
           C 36 13 24 17 21 27
           C 17 37 23 48 34 50
           C 41 51 47 49 51 45
           C 43 45 36 41 33 35
           C 30 28 31 21 36 17
           C 39 15 43 14 47 15 Z"
        fill={MOON_LIGHT}
      />
      <Path
        d="M 47 15
           C 36 13 24 17 21 27
           C 17 37 23 48 34 50
           C 41 51 47 49 51 45
           C 43 45 36 41 33 35
           C 30 28 31 21 36 17
           C 39 15 43 14 47 15 Z"
        fill="none"
        stroke={INK}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function CloudIcon({ size }: { size: number }) {
  return (
    <Svg
      width={size}
      height={size * 0.7}
      viewBox="0 0 64 44"
    >
      <Path
        d="M 11 37
           C 7 37 5 33 8 30
           C 4 27 7 21 12 22
           C 11 14 21 13 23 18
           C 22 10 33 8 37 14
           C 39 8 49 10 49 17
           C 56 16 60 22 56 27
           C 60 30 58 36 53 36
           L 11 37 Z"
        fill={CLOUD_FILL}
        stroke={INK}
        strokeWidth={1.4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function StarIcon({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path
        d="M 16 3
           C 16.6 12.5 18 14.5 29 16
           C 18 17.6 16.6 19.5 16 29
           C 15.4 19.5 14 17.6 3 16
           C 14 14.5 15.4 12.5 16 3 Z"
        fill={STAR_FILL}
        stroke={INK}
        strokeWidth={1.1}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

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
    opacity: interpolate(drift.value, [0, 1], [0.55, 0.9]),
    transform: [{ translateX: interpolate(drift.value, [0, 1], [-8, 10]) }],
  }));

  const rightCloudStyle = useAnimatedStyle(() => ({
    opacity: interpolate(drift.value, [0, 1], [0.9, 0.55]),
    transform: [{ translateX: interpolate(drift.value, [0, 1], [9, -9]) }],
  }));

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.25, 1]),
    transform: [
      { scale: interpolate(glow.value, [0, 1], [0.82, 1.12]) },
      { rotate: `${interpolate(glow.value, [0, 1], [-8, 8])}deg` },
    ],
  }));

  return (
    <View style={[styles.root, compact && styles.compactRoot]}>
      <View style={[styles.sky, compact && styles.compactSky]}>
        <Animated.View style={[styles.cloudLeft, leftCloudStyle]}>
          <CloudIcon size={compact ? 44 : 56} />
        </Animated.View>
        <Animated.View style={[styles.moon, moonStyle]}>
          <CrescentMoonIcon size={compact ? 46 : 58} />
        </Animated.View>
        <Animated.View style={[styles.sparkle, sparkleStyle]}>
          <StarIcon size={compact ? 22 : 28} />
        </Animated.View>
        <Animated.View style={[styles.cloudRight, rightCloudStyle]}>
          <CloudIcon size={compact ? 48 : 62} />
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
    top: 14,
    alignSelf: 'center',
    width: 70,
    height: 70,
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
    fontSize: 18,
    fontWeight: '800',
    includeFontPadding: false,
  },
  compactTitle: {
    marginTop: 8,
    fontSize: 16,
  },
  subtitle: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    textAlign: 'center',
  },
  compactSubtitle: {
    maxWidth: 220,
    fontSize: 12,
    lineHeight: 17,
  },
});
