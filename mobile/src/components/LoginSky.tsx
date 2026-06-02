import { useEffect } from 'react';
import {
  Image,
  type ImageSourcePropType,
  StyleSheet,
  useWindowDimensions,
  View,
  type DimensionValue,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import cloud1 from '../assets/illustrations/cloud_1_transparent.png';
import cloud2 from '../assets/illustrations/cloud_2_transparent.png';
import cloud3 from '../assets/illustrations/cloud_3_transparent.png';
import cloudLeftImage from '../assets/illustrations/dream_loading_cloud_left.png';
import cloudRightImage from '../assets/illustrations/dream_loading_cloud_right.png';
import moonImage from '../assets/illustrations/dream_loading_moon.png';
import starImage from '../assets/illustrations/dream_loading_star.png';

// Source artwork is shipped with transparent padding; these ratios keep the
// rendered image from stretching.
const CLOUD_ASPECT = 1; // 1254 x 1254
const MOON_ASPECT = 779 / 663;
const STAR_ASPECT = 605 / 571;
const CLOUD_LEFT_ASPECT = 804 / 1235;
const CLOUD_RIGHT_ASPECT = 772 / 1154;

type Position = {
  top?: DimensionValue;
  bottom?: DimensionValue;
  left?: DimensionValue;
  right?: DimensionValue;
};

type Decoration = {
  key: string;
  source: ImageSourcePropType;
  /** Width as a fraction of the screen width. */
  widthRatio: number;
  aspect: number;
  position: Position;
  opacity: number;
  /** Full cycle duration in ms (one out-and-back). */
  duration: number;
  delay: number;
  /** Horizontal drift amplitude in px. */
  driftX?: number;
  /** Vertical float amplitude in px. */
  floatY?: number;
  /** Rotation amplitude in degrees. */
  rotate?: number;
  /** Stars fade + pulse instead of drifting. */
  twinkle?: boolean;
  /** Mirror the artwork horizontally. */
  flip?: boolean;
};

// Clouds, moon and stars sprinkled across the lobby sky. Each element animates
// on its own clock (varied duration + delay) so the scene never marches in
// lockstep. Mirrors the floaty feel of the dream-loading animation.
const DECORATIONS: Decoration[] = [
  // --- Clouds (slow horizontal drift) ---
  // cloud_3 hugs the right wall up high.
  {
    key: 'cloud-right',
    source: cloud3,
    widthRatio: 0.6,
    aspect: CLOUD_ASPECT,
    position: { top: '4%', right: '-20%' },
    opacity: 0.95,
    duration: 7000,
    delay: 0,
    driftX: 12,
    floatY: 6,
  },
  // cloud_2 hugs the left wall around the middle.
  {
    key: 'cloud-left',
    source: cloud2,
    widthRatio: 0.54,
    aspect: CLOUD_ASPECT,
    position: { top: '22%', left: '-14%' },
    opacity: 0.9,
    duration: 8200,
    delay: 600,
    driftX: 14,
    floatY: 8,
  },
  // cloud_1, mirrored, anchors the bottom-left (bigger near the ground).
  {
    key: 'cloud-bottom-left',
    source: cloud1,
    widthRatio: 0.78,
    aspect: CLOUD_ASPECT,
    position: { bottom: '4%', left: '-16%' },
    opacity: 0.9,
    duration: 6600,
    delay: 300,
    driftX: 13,
    floatY: 6,
    flip: true,
  },
  // cloud_1 anchors the bottom-right where the moon rests — the biggest cloud.
  {
    key: 'cloud-bottom-right',
    source: cloud1,
    widthRatio: 0.98,
    aspect: CLOUD_ASPECT,
    position: { bottom: '2%', right: '-18%' },
    opacity: 0.92,
    duration: 9000,
    delay: 900,
    driftX: 10,
    floatY: 7,
  },
  // Soft loading-style clouds drifting through the empty middle of the screen.
  {
    key: 'cloud-mid-left',
    source: cloudLeftImage,
    widthRatio: 0.4,
    aspect: CLOUD_LEFT_ASPECT,
    position: { top: '44%', left: '-4%' },
    opacity: 0.7,
    duration: 8600,
    delay: 450,
    driftX: 16,
    floatY: 6,
  },
  // --- Moon (gentle bob + sway) — sits on top of the bottom-right clouds. ---
  {
    key: 'moon',
    source: moonImage,
    widthRatio: 0.34,
    aspect: MOON_ASPECT,
    position: { bottom: '16%', right: '14%' },
    opacity: 1,
    duration: 3200,
    delay: 0,
    floatY: 7,
    rotate: 5,
  },
  // Soft cloud drifting in front of the moon, hugging its upper edge.
  {
    key: 'cloud-mid-right',
    source: cloudRightImage,
    widthRatio: 0.42,
    aspect: CLOUD_RIGHT_ASPECT,
    position: { bottom: '28%', right: '6%' },
    opacity: 0.72,
    duration: 7400,
    delay: 1100,
    driftX: 18,
    floatY: 5,
  },
  // --- Stars (twinkle in place) ---
  {
    key: 'star-1',
    source: starImage,
    widthRatio: 0.075,
    aspect: STAR_ASPECT,
    position: { top: '13%', left: '14%' },
    opacity: 1,
    duration: 1400,
    delay: 0,
    rotate: 12,
    twinkle: true,
  },
  {
    key: 'star-2',
    source: starImage,
    widthRatio: 0.05,
    aspect: STAR_ASPECT,
    position: { top: '7%', right: '32%' },
    opacity: 0.9,
    duration: 1100,
    delay: 300,
    rotate: 10,
    twinkle: true,
  },
  {
    key: 'star-3',
    source: starImage,
    widthRatio: 0.055,
    aspect: STAR_ASPECT,
    position: { top: '32%', left: '9%' },
    opacity: 0.95,
    duration: 1600,
    delay: 600,
    rotate: 12,
    twinkle: true,
  },
  {
    key: 'star-4',
    source: starImage,
    widthRatio: 0.062,
    aspect: STAR_ASPECT,
    position: { top: '36%', right: '4%' },
    opacity: 1,
    duration: 1250,
    delay: 200,
    rotate: 10,
    twinkle: true,
  },
  {
    key: 'star-5',
    source: starImage,
    widthRatio: 0.045,
    aspect: STAR_ASPECT,
    position: { top: '28%', left: '47%' },
    opacity: 0.85,
    duration: 1000,
    delay: 450,
    rotate: 14,
    twinkle: true,
  },
  {
    key: 'star-6',
    source: starImage,
    widthRatio: 0.05,
    aspect: STAR_ASPECT,
    position: { top: '52%', left: '23%' },
    opacity: 0.9,
    duration: 1500,
    delay: 150,
    rotate: 11,
    twinkle: true,
  },
  {
    key: 'star-7',
    source: starImage,
    widthRatio: 0.042,
    aspect: STAR_ASPECT,
    position: { top: '47%', right: '26%' },
    opacity: 0.8,
    duration: 1300,
    delay: 700,
    rotate: 12,
    twinkle: true,
  },
];

export function LoginSky() {
  const { width } = useWindowDimensions();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {DECORATIONS.map(item => (
        <FloatingDecoration key={item.key} item={item} screenWidth={width} />
      ))}
    </View>
  );
}

function FloatingDecoration({
  item,
  screenWidth,
}: {
  item: Decoration;
  screenWidth: number;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      item.delay,
      withRepeat(
        withTiming(1, {
          duration: item.duration,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      ),
    );
  }, [item.delay, item.duration, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const transform: (
      | { translateX: number }
      | { translateY: number }
      | { rotate: string }
      | { scale: number }
      | { scaleX: number }
    )[] = [];

    if (item.flip) {
      transform.push({ scaleX: -1 });
    }
    if (item.driftX) {
      transform.push({
        translateX: interpolate(progress.value, [0, 1], [-item.driftX, item.driftX]),
      });
    }
    if (item.floatY) {
      transform.push({
        translateY: interpolate(progress.value, [0, 1], [item.floatY, -item.floatY]),
      });
    }
    if (item.rotate) {
      transform.push({
        rotate: `${interpolate(progress.value, [0, 1], [-item.rotate, item.rotate])}deg`,
      });
    }
    if (item.twinkle) {
      transform.push({
        scale: interpolate(progress.value, [0, 1], [0.78, 1.15]),
      });
    }

    return {
      opacity: item.twinkle
        ? interpolate(progress.value, [0, 1], [item.opacity * 0.35, item.opacity])
        : item.opacity,
      transform,
    };
  });

  const width = screenWidth * item.widthRatio;

  return (
    <Animated.View style={[styles.decoration, item.position, animatedStyle]}>
      <Image
        source={item.source}
        fadeDuration={0}
        resizeMode="contain"
        style={{ width, height: width * item.aspect }}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  decoration: {
    position: 'absolute',
  },
});
