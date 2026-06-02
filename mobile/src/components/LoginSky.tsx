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
import cloud2Blur from '../assets/illustrations/cloud_2_transparent_blur.png';
import cloud3Blur from '../assets/illustrations/cloud_3_transparent_blur.png';
import cloudLeftBlur from '../assets/illustrations/dream_loading_cloud_left_blur.png';
import moonImage from '../assets/illustrations/dream_loading_moon.png';
import starImage from '../assets/illustrations/dream_loading_star.png';
import starVioletImage from '../assets/illustrations/star_violet.png';

// Every cloud / star illustration ships square (1254 x 1254) with transparent
// padding, so a single aspect of 1 keeps them all from stretching.
const CLOUD_ASPECT = 1;
const MOON_ASPECT = 779 / 663;
const STAR_ASPECT = 605 / 571;
const VIOLET_STAR_ASPECT = 1; // 500 x 500

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
  // Top-right: cloud_3 (blurred), large — reaches in behind the logo.
  {
    key: 'cloud-top-right',
    source: cloud3Blur,
    widthRatio: 0.96,
    aspect: CLOUD_ASPECT,
    position: { top: '-4%', right: '-12%' },
    opacity: 0.95,
    duration: 7000,
    delay: 0,
    driftX: 12,
    floatY: 6,
  },
  // Bottom-left: cloud_2 (blurred), large and well onto the screen.
  {
    key: 'cloud-bottom-left',
    source: cloud3Blur,
    widthRatio: 0.86,
    aspect: CLOUD_ASPECT,
    position: { bottom: '-12%', left: '-10%' },
    opacity: 0.92,
    duration: 6600,
    delay: 300,
    driftX: 13,
    floatY: 6,
    flip: true,
  },
  // Bottom-right: cloud_1 (sharp), large. Flat right/bottom edges run off-screen.
  {
    key: 'cloud-bottom-right',
    source: cloud1,
    widthRatio: 0.92,
    aspect: CLOUD_ASPECT,
    position: { bottom: '3%', right: '-15%' },
    opacity: 0.95,
    duration: 9000,
    delay: 900,
    driftX: 10,
    floatY: 7,
  },
  // Centre-left, upper: cloud_3 (blurred), mirrored — pulled closer onto screen.
  {
    key: 'cloud-mid-left-top',
    source: cloud3Blur,
    widthRatio: 0.55,
    aspect: CLOUD_ASPECT,
    position: { top: '26%', left: '-4%' },
    opacity: 0.9,
    duration: 8200,
    delay: 600,
    driftX: 14,
    floatY: 8,
    flip: true,
  },
  // Centre-left, lower: the soft loading cloud (blurred), small and fully
  // on-screen so its whole shape reads — nestled close under the upper cloud.
  {
    key: 'cloud-mid-left-bottom',
    source: cloudLeftBlur,
    widthRatio: 0.42,
    aspect: CLOUD_ASPECT,
    position: { top: '32%', left: '4%' },
    opacity: 0.85,
    duration: 8600,
    delay: 450,
    driftX: 16,
    floatY: 6,
  },
  // (The moon lives in its own MoonCluster — see below — so it stays nestled
  // among its surrounding clouds and drifts as one piece.)
  // --- Yellow stars (twinkle in place) ---
  {
    key: 'star-1',
    source: starImage,
    widthRatio: 0.035,
    aspect: STAR_ASPECT,
    position: { top: '6%', left: '5%' },
    opacity: 0.95,
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
    position: { top: '29%', left: '25%' },
    opacity: 1,
    duration: 1500,
    delay: 300,
    rotate: 10,
    twinkle: true,
  },
  {
    key: 'star-3',
    source: starImage,
    widthRatio: 0.07,
    aspect: STAR_ASPECT,
    position: { top: '8%', left: '8%' },
    opacity: 0.95,
    duration: 1600,
    delay: 600,
    rotate: 12,
    twinkle: true,
  },
  // The big star tucked in by the crescent's tip (next to the moon cluster).
  {
    key: 'star-4',
    source: starImage,
    widthRatio: 0.09,
    aspect: STAR_ASPECT,
    position: { top: '43%', left: '56%' },
    opacity: 1,
    duration: 1250,
    delay: 200,
    rotate: 10,
    twinkle: true,
  },
  {
    key: 'star-5',
    source: starImage,
    widthRatio: 0.03,
    aspect: STAR_ASPECT,
    position: { top: '35%', right: '18%' },
    opacity: 0.85,
    duration: 1000,
    delay: 450,
    rotate: 14,
    twinkle: true,
  },
  {
    key: 'star-6',
    source: starImage,
    widthRatio: 0.03,
    aspect: STAR_ASPECT,
    position: { top: '59%', left: '16%' },
    opacity: 0.9,
    duration: 1500,
    delay: 150,
    rotate: 11,
    twinkle: true,
  },
  {
    key: 'star-7',
    source: starImage,
    widthRatio: 0.05,
    aspect: STAR_ASPECT,
    position: { top: '84%', left: '9%' },
    opacity: 0.9,
    duration: 1300,
    delay: 700,
    rotate: 12,
    twinkle: true,
  },
  {
    key: 'star-8',
    source: starImage,
    widthRatio: 0.06,
    aspect: STAR_ASPECT,
    position: { top: '4%', right: '10%' },
    opacity: 0.8,
    duration: 1150,
    delay: 350,
    rotate: 12,
    twinkle: true,
  },
  // --- Violet stars sprinkled in between (smaller than the yellow ones) ---
  {
    key: 'violet-1',
    source: starVioletImage,
    widthRatio: 0.1,
    aspect: VIOLET_STAR_ASPECT,
    position: { top: '8%', left: '52%' },
    opacity: 0.9,
    duration: 1700,
    delay: 250,
    rotate: 10,
    twinkle: true,
  },
  {
    key: 'violet-2',
    source: starVioletImage,
    widthRatio: 0.07,
    aspect: VIOLET_STAR_ASPECT,
    position: { top: '26%', left: '28%' },
    opacity: 1,
    duration: 1450,
    delay: 550,
    rotate: 12,
    twinkle: true,
  },
  {
    key: 'violet-3',
    source: starVioletImage,
    widthRatio: 0.1,
    aspect: VIOLET_STAR_ASPECT,
    position: { top: '22%', left: '62%' },
    opacity: 0.85,
    duration: 1200,
    delay: 100,
    rotate: 14,
    twinkle: true,
  },
  {
    key: 'violet-4',
    source: starVioletImage,
    widthRatio: 0.16,
    aspect: VIOLET_STAR_ASPECT,
    position: { top: '17%', right: '20%' },
    opacity: 0.85,
    duration: 1350,
    delay: 500,
    rotate: 11,
    twinkle: true,
  },
  {
    key: 'violet-5',
    source: starVioletImage,
    widthRatio: 0.08,
    aspect: VIOLET_STAR_ASPECT,
    position: { top: '39%', left: '37%' },
    opacity: 0.9,
    duration: 1550,
    delay: 400,
    rotate: 11,
    twinkle: true,
  },
  {
    key: 'violet-6',
    source: starVioletImage,
    widthRatio: 0.15,
    aspect: VIOLET_STAR_ASPECT,
    position: { top: '76.5%', right: '30%' },
    opacity: 0.8,
    duration: 1250,
    delay: 650,
    rotate: 12,
    twinkle: true,
  },
  {
    key: 'violet-7',
    source: starVioletImage,
    widthRatio: 0.12,
    aspect: VIOLET_STAR_ASPECT,
    position: { top: '60%', left: '7.5%' },
    opacity: 0.85,
    duration: 1500,
    delay: 200,
    rotate: 13,
    twinkle: true,
  },
  {
    key: 'violet-8',
    source: starVioletImage,
    widthRatio: 0.15,
    aspect: VIOLET_STAR_ASPECT,
    position: { top: '56%', right: '1%' },
    opacity: 0.9,
    duration: 1380,
    delay: 320,
    rotate: 12,
    twinkle: true,
  },
  {
    key: 'violet-9',
    source: starVioletImage,
    widthRatio: 0.07,
    aspect: VIOLET_STAR_ASPECT,
    position: { top: '76%', left: '62%' },
    opacity: 0.8,
    duration: 1180,
    delay: 480,
    rotate: 13,
    twinkle: true,
  },
  {
    key: 'violet-10',
    source: starVioletImage,
    widthRatio: 0.1,
    aspect: VIOLET_STAR_ASPECT,
    position: { top: '86%', left: '13%' },
    opacity: 0.85,
    duration: 1600,
    delay: 150,
    rotate: 11,
    twinkle: true,
  },
];

// The moon nestled among clouds, built from three layered images: a cloud
// behind the moon, the moon, then a cloud in front so it looks half-buried.
// Positions and sizes are relative to the (square) cluster box so the whole
// thing scales as one piece.
//
// Which animation layer a piece belongs to. Both clouds share one drift so they
// move as a single body; the moon bobs on its own, independent of the clouds.
type ClusterLayer = 'back-cloud' | 'moon' | 'front-cloud';

type ClusterPiece = {
  key: string;
  source: ImageSourcePropType;
  /** Width as a fraction of the cluster box width. */
  widthFrac: number;
  aspect: number;
  position: Position;
  opacity: number;
  flip?: boolean;
  layer: ClusterLayer;
};

const CLUSTER_PIECES: ClusterPiece[] = [
  // Bottom layer: cloud_2 (blurred), mirrored — a big cloud bedded behind the
  // moon, slightly larger and lifted so the moon is less buried.
  {
    key: 'back-cloud',
    source: cloud2Blur,
    widthFrac: 1.05,
    aspect: CLOUD_ASPECT,
    position: { bottom: '18%', left: '0%' },
    opacity: 0.95,
    flip: true,
    layer: 'back-cloud',
  },
  // Middle layer: the crescent, mirrored — sitting a little lower.
  {
    key: 'moon',
    source: moonImage,
    widthFrac: 0.44,
    aspect: MOON_ASPECT,
    position: { top: '19%', right: '18%' },
    opacity: 1,
    flip: true,
    layer: 'moon',
  },
  // Top layer: the soft loading cloud (blurred), mirrored — lifted up so it
  // just clips the moon's lower-right corner.
  {
    key: 'front-cloud',
    source: cloudLeftBlur,
    widthFrac: 0.52,
    aspect: CLOUD_ASPECT,
    position: { bottom: '18%', right: '5%' },
    opacity: 0.97,
    flip: true,
    layer: 'front-cloud',
  },
];

export function LoginSky() {
  const { width } = useWindowDimensions();

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {DECORATIONS.map(item => (
        <FloatingDecoration key={item.key} item={item} screenWidth={width} />
      ))}
      <MoonCluster screenWidth={width} />
    </View>
  );
}

function MoonCluster({ screenWidth }: { screenWidth: number }) {
  const clusterWidth = screenWidth * 0.76;
  const cloudFloat = useSharedValue(0);
  const moonFloat = useSharedValue(0);

  useEffect(() => {
    cloudFloat.value = withRepeat(
      withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    moonFloat.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [cloudFloat, moonFloat]);

  // Clouds drift together as one body (both layers share this style)...
  const cloudStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(cloudFloat.value, [0, 1], [-5, 6]) },
      { translateY: interpolate(cloudFloat.value, [0, 1], [4, -6]) },
    ],
  }));
  // ...while the moon bobs on its own, tilted slightly clockwise, independent
  // of the clouds.
  const moonStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(moonFloat.value, [0, 1], [5, -8]) },
      { rotate: `${interpolate(moonFloat.value, [0, 1], [9, 15])}deg` },
    ],
  }));

  const layerStyle = {
    'back-cloud': cloudStyle,
    moon: moonStyle,
    'front-cloud': cloudStyle,
  } as const;

  // Pieces are painted bottom-to-top (back cloud → moon → front cloud) so the
  // moon stays nestled between the clouds. Both cloud layers share cloudStyle,
  // so they drift identically — one body — while the moon bobs on its own.
  return (
    <View
      style={[
        styles.cluster,
        { width: clusterWidth, height: clusterWidth * 1.2 },
      ]}
    >
      {CLUSTER_PIECES.map(piece => {
        const pieceWidth = clusterWidth * piece.widthFrac;
        return (
          <Animated.View
            key={piece.key}
            style={[styles.clusterPiece, piece.position, layerStyle[piece.layer]]}
          >
            <View style={piece.flip ? styles.flipped : undefined}>
              <Image
                source={piece.source}
                fadeDuration={0}
                resizeMode="contain"
                style={{
                  width: pieceWidth,
                  height: pieceWidth * piece.aspect,
                  opacity: piece.opacity,
                }}
              />
            </View>
          </Animated.View>
        );
      })}
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
          // Stars run a one-way 0->1 loop (fade in → hold → fade out) on a
          // linear timeline; clouds ease back and forth, so they reverse.
          duration: item.twinkle ? item.duration * 2 : item.duration,
          easing: item.twinkle ? Easing.linear : Easing.inOut(Easing.ease),
        }),
        -1,
        !item.twinkle,
      ),
    );
  }, [item.delay, item.duration, item.twinkle, progress]);

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

    if (item.twinkle) {
      // One-way 0->1 loop shaped as: fade in (0–0.35), hold bright (0.35–0.6),
      // fade out (0.6–1). Endpoints match so each repeat is seamless.
      const stops = [0, 0.35, 0.6, 1];
      if (item.rotate) {
        transform.push({
          rotate: `${interpolate(
            progress.value,
            [0, 0.5, 1],
            [-item.rotate, item.rotate, -item.rotate],
          )}deg`,
        });
      }
      transform.push({
        scale: interpolate(progress.value, stops, [0.8, 1.12, 1.12, 0.8]),
      });
      return {
        opacity: interpolate(progress.value, stops, [
          item.opacity * 0.2,
          item.opacity,
          item.opacity,
          item.opacity * 0.2,
        ]),
        transform,
      };
    }

    // Clouds: gentle back-and-forth drift (reversing loop).
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

    return { opacity: item.opacity, transform };
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
  cluster: {
    position: 'absolute',
    top: '30%',
    right: '-6%',
  },
  clusterPiece: {
    position: 'absolute',
  },
  flipped: {
    transform: [{ scaleX: -1 }],
  },
});
