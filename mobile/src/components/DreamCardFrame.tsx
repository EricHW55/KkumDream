import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  FeGaussianBlur,
  FeOffset,
  Filter,
  G,
  Image as SvgImage,
  Path,
} from 'react-native-svg';

import agedLetterPaperTexture from '../assets/textures/aged_letter_paper.webp';
import paperTexture from '../assets/textures/paper_texture.webp';
import type { DreamCardFrame as DreamCardFrameType } from '../types/dream';

type Props = {
  backgroundColor: string;
  borderColor: string;
  children: ReactNode;
  compact?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  frame: DreamCardFrameType;
  height?: number;
  minimal?: boolean;
  shadowColor?: string;
  style?: StyleProp<ViewStyle>;
  textureColor: string;
};

export const DREAM_CARD_ASPECT_RATIO = 0.61;

const FRAME_WIDTH = 340;
const FRAME_HEIGHT = 510;
const SHADOW_SPREAD = 34;
const DARK_TEXTURE_LUMINANCE_THRESHOLD = 0.35;
const paperSpecks = [
  [44, 48, 1.1],
  [118, 36, 0.8],
  [248, 64, 0.9],
  [304, 128, 0.8],
  [62, 188, 0.9],
  [226, 176, 1],
  [124, 254, 0.8],
  [288, 308, 1.1],
  [48, 366, 0.8],
  [196, 420, 0.9],
  [278, 462, 0.8],
  [104, 486, 1],
] as const;

const paperScuffs = [
  'M 18 18 C 42 12 62 18 84 15',
  'M 248 16 C 270 12 292 18 318 14',
  'M 20 492 C 48 486 70 492 98 488',
  'M 236 492 C 262 486 288 492 318 488',
  'M 20 76 C 25 94 18 112 24 130',
  'M 318 76 C 312 98 322 118 316 138',
  'M 21 392 C 28 408 18 430 25 448',
  'M 318 386 C 310 408 324 428 316 448',
  'M 42 34 L 54 30 M 286 34 L 298 30',
  'M 42 474 L 54 480 M 286 474 L 298 480',
] as const;

const cornerMarks = [
  'M 30 34 C 36 27 44 27 50 34',
  'M 290 34 C 296 27 304 27 310 34',
  'M 30 476 C 36 483 44 483 50 476',
  'M 290 476 C 296 483 304 483 310 476',
] as const;

const ornamentDots = [
  [32, 30],
  [308, 30],
  [32, 480],
  [308, 480],
] as const;

const agedLetterMarks = [
  'M 17 56 C 28 50 40 56 50 51',
  'M 292 52 C 306 46 318 54 326 47',
  'M 11 286 C 20 296 13 310 22 320',
  'M 316 214 C 326 226 318 238 327 250',
  'M 38 494 C 58 486 74 494 94 488',
  'M 232 500 C 248 492 268 499 286 492',
] as const;

export function DreamCardFrame({
  backgroundColor,
  borderColor,
  children,
  compact = false,
  contentStyle,
  frame,
  height,
  minimal = false,
  shadowColor,
  style,
  textureColor,
}: Props) {
  const shapePath = getFramePath(frame);
  const innerPath = getInnerFramePath(frame);
  const accentPath = getAccentFramePath(frame);
  const clipId = `dream-card-frame-${frame}`;
  const contactShadowId = `${clipId}-contact-shadow`;
  const softShadowId = `${clipId}-soft-shadow`;
  const textureOpacity = minimal
    ? compact
      ? 0.08
      : 0.1
    : compact
      ? 0.09
      : 0.13;
  const speckOpacity = minimal
    ? compact
      ? 0.045
      : 0.06
    : compact
      ? 0.05
      : 0.075;
  const paperScuffOpacity = compact ? 0.09 : 0.13;
  const agedMarkOpacity = minimal
    ? compact
      ? 0.13
      : 0.18
    : compact
      ? 0.13
      : 0.2;
  const cornerMarkOpacity = compact ? 0.12 : 0.18;
  const innerStrokeOpacity = minimal
    ? compact
      ? 0.28
      : 0.4
    : compact
      ? 0.24
      : 0.38;
  const innerStrokeWidth =
    frame === 'classic' ? (compact ? 0.62 : 0.9) : compact ? 0.55 : 0.78;
  const accentStrokeOpacity = minimal
    ? compact
      ? 0.1
      : 0.16
    : compact
      ? 0.08
      : 0.13;
  const outerStrokeOpacity = minimal
    ? compact
      ? 0.36
      : 0.48
    : compact
      ? 0.32
      : 0.46;
  const outerStrokeWidth = compact ? 0.5 : 0.68;
  const contactShadowOpacity = compact ? 0.08 : 0.1;
  const softShadowOpacity = compact ? 0.07 : 0.09;
  const isAgedLetterFrame = frame === 'ticket';
  const isDarkTextureBase = isDarkColor(backgroundColor);
  const frameTexture = frame === 'ticket' ? agedLetterPaperTexture : paperTexture;
  const frameTextureOpacity =
    isAgedLetterFrame
      ? isDarkTextureBase
        ? minimal
          ? compact
            ? 0.12
            : 0.16
          : compact
            ? 0.14
            : 0.18
        : minimal
          ? compact
            ? 0.16
            : 0.2
          : compact
            ? 0.18
            : 0.24
      : textureOpacity;
  const frameTextureColorWashOpacity =
    isAgedLetterFrame ? (isDarkTextureBase ? 0.18 : 0.3) : 0;

  return (
    <View
      style={[
        styles.root,
        height !== undefined && { height },
        style,
      ]}
    >
      {shadowColor ? (
        <Svg
          height="100%"
          pointerEvents="none"
          preserveAspectRatio="none"
          style={styles.shadowSvg}
          viewBox={`${-SHADOW_SPREAD} ${-SHADOW_SPREAD} ${
            FRAME_WIDTH + SHADOW_SPREAD * 2
          } ${FRAME_HEIGHT + SHADOW_SPREAD * 2}`}
          width="100%"
        >
          <Defs>
            <Filter
              id={contactShadowId}
              filterUnits="userSpaceOnUse"
              height={FRAME_HEIGHT + SHADOW_SPREAD * 2}
              width={FRAME_WIDTH + SHADOW_SPREAD * 2}
              x={-SHADOW_SPREAD}
              y={-SHADOW_SPREAD}
            >
              <FeOffset dx={0} dy={compact ? 2 : 3} result="contactOffset" />
              <FeGaussianBlur
                in="contactOffset"
                stdDeviation={compact ? 2.4 : 3.2}
              />
            </Filter>
            <Filter
              id={softShadowId}
              filterUnits="userSpaceOnUse"
              height={FRAME_HEIGHT + SHADOW_SPREAD * 2}
              width={FRAME_WIDTH + SHADOW_SPREAD * 2}
              x={-SHADOW_SPREAD}
              y={-SHADOW_SPREAD}
            >
              <FeOffset dx={0} dy={compact ? 7 : 10} result="softOffset" />
              <FeGaussianBlur
                in="softOffset"
                stdDeviation={compact ? 6 : 8.5}
              />
            </Filter>
          </Defs>
          <Path
            d={shapePath}
            filter={`url(#${softShadowId})`}
            fill={shadowColor}
            opacity={softShadowOpacity}
          />
          <Path
            d={shapePath}
            filter={`url(#${contactShadowId})`}
            fill={shadowColor}
            opacity={contactShadowOpacity}
          />
        </Svg>
      ) : null}

      <Svg
        height="100%"
        pointerEvents="none"
        preserveAspectRatio="none"
        style={styles.svg}
        viewBox={`0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}`}
        width="100%"
      >
        <Defs>
          <ClipPath id={clipId}>
            <Path d={shapePath} clipRule="evenodd" fillRule="evenodd" />
          </ClipPath>
        </Defs>

        <Path d={shapePath} fill={backgroundColor} fillRule="evenodd" />
        <SvgImage
          clipPath={`url(#${clipId})`}
          height={FRAME_HEIGHT}
          href={frameTexture}
          opacity={frameTextureOpacity}
          preserveAspectRatio="xMidYMid slice"
          width={FRAME_WIDTH}
          x={0}
          y={0}
        />
        {frameTextureColorWashOpacity > 0 ? (
          <Path
            d={shapePath}
            fill={backgroundColor}
            fillRule="evenodd"
            opacity={frameTextureColorWashOpacity}
          />
        ) : null}

        <G clipPath={`url(#${clipId})`} opacity={speckOpacity}>
          {paperSpecks.map(([cx, cy, r]) => (
            <Circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              fill={textureColor}
              opacity={0.34}
              r={r}
            />
          ))}
        </G>

        {minimal ? (
          frame === 'ticket' ? (
            <G clipPath={`url(#${clipId})`} opacity={agedMarkOpacity}>
              {agedLetterMarks.map(line => (
                <Path
                  key={line}
                  d={line}
                  fill="none"
                  stroke={textureColor}
                  strokeLinecap="round"
                  strokeWidth={compact ? 0.55 : 0.75}
                />
              ))}
            </G>
          ) : null
        ) : (
          <>
            <G clipPath={`url(#${clipId})`} opacity={paperScuffOpacity}>
              {paperScuffs.map(line => (
                <Path
                  key={line}
                  d={line}
                  fill="none"
                  stroke={borderColor}
                  strokeLinecap="round"
                  strokeWidth={compact ? 0.35 : 0.5}
                />
              ))}
            </G>
            {frame === 'ticket' ? (
              <G clipPath={`url(#${clipId})`} opacity={agedMarkOpacity}>
                {agedLetterMarks.map(line => (
                  <Path
                    key={line}
                    d={line}
                    fill="none"
                    stroke={textureColor}
                    strokeLinecap="round"
                    strokeWidth={compact ? 0.55 : 0.75}
                  />
                ))}
                <Circle
                  cx={52}
                  cy={84}
                  fill={textureColor}
                  opacity={0.18}
                  r={compact ? 5 : 8}
                />
                <Circle
                  cx={286}
                  cy={420}
                  fill={textureColor}
                  opacity={0.16}
                  r={compact ? 8 : 13}
                />
              </G>
            ) : null}
            <G clipPath={`url(#${clipId})`} opacity={cornerMarkOpacity}>
              {cornerMarks.map(mark => (
                <Path
                  key={mark}
                  d={mark}
                  fill="none"
                  stroke={borderColor}
                  strokeLinecap="round"
                  strokeWidth={compact ? 0.42 : 0.62}
                />
              ))}
              {ornamentDots.map(([cx, cy]) => (
                <Circle
                  key={`${cx}-${cy}`}
                  cx={cx}
                  cy={cy}
                  fill={borderColor}
                  r={compact ? 0.9 : 1.3}
                />
              ))}
            </G>
          </>
        )}

        <Path
          d={innerPath}
          fill="none"
          opacity={innerStrokeOpacity}
          stroke={borderColor}
          strokeDasharray={frame === 'classic' ? '3 7' : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={innerStrokeWidth}
        />
        <Path
          d={accentPath}
          fill="none"
          opacity={accentStrokeOpacity}
          stroke={borderColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={compact ? 0.45 : 0.55}
        />

        <Path
          d={shapePath}
          fill="none"
          clipRule="evenodd"
          fillRule="evenodd"
          opacity={outerStrokeOpacity}
          stroke={borderColor}
          strokeLinejoin="round"
          strokeWidth={outerStrokeWidth}
        />
        <Path
          d={shapePath}
          fill="none"
          clipRule="evenodd"
          fillRule="evenodd"
          opacity={compact ? 0.06 : 0.09}
          stroke={borderColor}
          strokeLinejoin="round"
          strokeWidth={0.35}
        />
      </Svg>

      <View
        style={[
          styles.content,
          height !== undefined && styles.fixedContent,
          compact ? styles.compactContent : styles.contentInset,
          frame === 'ticket' &&
            (compact ? styles.compactTicketInset : styles.ticketInset),
          frame === 'tag' &&
            (compact ? styles.compactTagInset : styles.tagInset),
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

function isDarkColor(color: string) {
  const normalized = color.replace('#', '');
  const hex =
    normalized.length === 3
      ? normalized
          .split('')
          .map(char => char + char)
          .join('')
      : normalized;

  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return false;
  }

  const red = parseInt(hex.slice(0, 2), 16) / 255;
  const green = parseInt(hex.slice(2, 4), 16) / 255;
  const blue = parseInt(hex.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

  return luminance < DARK_TEXTURE_LUMINANCE_THRESHOLD;
}

function getFramePath(frame: DreamCardFrameType) {
  if (frame === 'ticket') {
    return [
      'M 18 0',
      'H 96',
      'C 104 0 108 8 114 8',
      'C 121 8 124 0 132 0',
      'H 216',
      'C 224 0 228 8 234 8',
      'C 241 8 244 0 252 0',
      'H 322',
      'Q 340 0 340 18',
      'V 166',
      'C 333 170 333 178 340 182',
      'V 492',
      'Q 340 510 322 510',
      'H 236',
      'C 230 510 226 502 220 502',
      'C 213 502 210 510 202 510',
      'H 22',
      'Q 0 510 0 488',
      'V 332',
      'C 7 328 7 320 0 316',
      'V 18',
      'Q 0 0 18 0',
      'Z',
    ].join(' ');
  }

  if (frame === 'beveled') {
    return movieTicketPath();
  }

  if (frame === 'tag') {
    return (
      'M 52 0 H 288 L 340 52 V 488 Q 340 510 318 510 H 22 Q 0 510 0 488 V 52 Z ' +
      circlePath(170, 26, 8)
    );
  }

  return roundedRectPath(0, 0, FRAME_WIDTH, FRAME_HEIGHT, 18);
}

function getInnerFramePath(frame: DreamCardFrameType) {
  if (frame === 'beveled') {
    return roundedRectPath(24, 24, 292, 462, 10);
  }

  if (frame === 'tag') {
    return 'M 58 24 H 282 L 318 60 V 476 Q 318 492 302 492 H 38 Q 22 492 22 476 V 60 Z';
  }

  if (frame === 'ticket') {
    return [
      'M 28 24',
      'H 312',
      'Q 320 24 320 32',
      'V 478',
      'Q 320 486 312 486',
      'H 28',
      'Q 20 486 20 478',
      'V 32',
      'Q 20 24 28 24',
      'Z',
    ].join(' ');
  }

  return roundedRectPath(20, 20, 300, 470, 12);
}

function getAccentFramePath(frame: DreamCardFrameType) {
  if (frame === 'beveled') {
    return roundedRectPath(36, 40, 268, 430, 7);
  }

  if (frame === 'tag') {
    return 'M 66 36 H 274 L 306 68 V 466 Q 306 480 292 480 H 48 Q 34 480 34 466 V 68 Z';
  }

  if (frame === 'ticket') {
    return [
      'M 38 38',
      'H 302',
      'Q 308 38 308 44',
      'V 466',
      'Q 308 472 302 472',
      'H 38',
      'Q 32 472 32 466',
      'V 44',
      'Q 32 38 38 38',
      'Z',
    ].join(' ');
  }

  return roundedRectPath(30, 30, 280, 450, 9);
}

function roundedRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const right = x + width;
  const bottom = y + height;
  return [
    `M ${x + radius} ${y}`,
    `H ${right - radius}`,
    `Q ${right} ${y} ${right} ${y + radius}`,
    `V ${bottom - radius}`,
    `Q ${right} ${bottom} ${right - radius} ${bottom}`,
    `H ${x + radius}`,
    `Q ${x} ${bottom} ${x} ${bottom - radius}`,
    `V ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    'Z',
  ].join(' ');
}

function movieTicketPath() {
  const notchRadiusX = 15;
  const notchDepth = 13;
  const notchCenters = [48, 96, 144, 196, 244, 292];
  const sideNotchY = 326;
  const sideNotchRadius = 14;
  const topNotches = notchCenters
    .map(cx => topNotchPath(cx, notchRadiusX, notchDepth))
    .join(' ');
  const bottomNotches = [...notchCenters]
    .reverse()
    .map(cx => bottomNotchPath(cx, notchRadiusX, notchDepth))
    .join(' ');

  return [
    `M ${notchRadiusX} 0`,
    topNotches,
    `H ${FRAME_WIDTH - notchRadiusX}`,
    topRightCornerNotchPath(notchRadiusX, notchDepth),
    `V ${sideNotchY - sideNotchRadius}`,
    rightSideNotchPath(sideNotchY, sideNotchRadius),
    `V ${FRAME_HEIGHT - notchDepth}`,
    bottomRightCornerNotchPath(notchRadiusX, notchDepth),
    bottomNotches,
    `H ${notchRadiusX}`,
    bottomLeftCornerNotchPath(notchRadiusX, notchDepth),
    `V ${sideNotchY + sideNotchRadius}`,
    leftSideNotchPath(sideNotchY, sideNotchRadius),
    `V ${notchDepth}`,
    topLeftCornerNotchPath(notchRadiusX, notchDepth),
    'Z',
  ].join(' ');
}

function topNotchPath(cx: number, radiusX: number, depth: number) {
  const handleX = radiusX * 0.55;
  const handleY = depth * 0.55;

  return [
    `H ${cx - radiusX}`,
    `C ${cx - radiusX} ${handleY} ${cx - handleX} ${depth} ${cx} ${depth}`,
    `C ${cx + handleX} ${depth} ${cx + radiusX} ${handleY} ${cx + radiusX} 0`,
  ].join(' ');
}

function bottomNotchPath(cx: number, radiusX: number, depth: number) {
  const handleX = radiusX * 0.55;
  const handleY = depth * 0.55;

  return [
    `H ${cx + radiusX}`,
    `C ${cx + radiusX} ${FRAME_HEIGHT - handleY} ${cx + handleX} ${
      FRAME_HEIGHT - depth
    } ${cx} ${FRAME_HEIGHT - depth}`,
    `C ${cx - handleX} ${FRAME_HEIGHT - depth} ${cx - radiusX} ${
      FRAME_HEIGHT - handleY
    } ${cx - radiusX} ${FRAME_HEIGHT}`,
  ].join(' ');
}

function topRightCornerNotchPath(radiusX: number, depth: number) {
  const handleX = radiusX * 0.55;
  const handleY = depth * 0.55;

  return [
    `C ${FRAME_WIDTH - radiusX} ${handleY} ${
      FRAME_WIDTH - handleX
    } ${depth} ${FRAME_WIDTH} ${depth}`,
  ].join(' ');
}

function bottomRightCornerNotchPath(radiusX: number, depth: number) {
  const handleX = radiusX * 0.55;
  const handleY = depth * 0.55;

  return [
    `C ${FRAME_WIDTH - handleX} ${FRAME_HEIGHT - depth} ${
      FRAME_WIDTH - radiusX
    } ${FRAME_HEIGHT - handleY} ${FRAME_WIDTH - radiusX} ${FRAME_HEIGHT}`,
  ].join(' ');
}

function bottomLeftCornerNotchPath(radiusX: number, depth: number) {
  const handleX = radiusX * 0.55;
  const handleY = depth * 0.55;

  return [
    `C ${radiusX} ${FRAME_HEIGHT - handleY} ${handleX} ${
      FRAME_HEIGHT - depth
    } 0 ${FRAME_HEIGHT - depth}`,
  ].join(' ');
}

function topLeftCornerNotchPath(radiusX: number, depth: number) {
  const handleX = radiusX * 0.55;
  const handleY = depth * 0.55;

  return [`C ${handleX} ${depth} ${radiusX} ${handleY} ${radiusX} 0`].join(' ');
}

function rightSideNotchPath(cy: number, radius: number) {
  const handle = radius * 0.55;

  return [
    `C ${FRAME_WIDTH - handle} ${cy - radius} ${FRAME_WIDTH - radius} ${
      cy - handle
    } ${FRAME_WIDTH - radius} ${cy}`,
    `C ${FRAME_WIDTH - radius} ${cy + handle} ${FRAME_WIDTH - handle} ${
      cy + radius
    } ${FRAME_WIDTH} ${cy + radius}`,
  ].join(' ');
}

function leftSideNotchPath(cy: number, radius: number) {
  const handle = radius * 0.55;

  return [
    `C ${handle} ${cy + radius} ${radius} ${cy + handle} ${radius} ${cy}`,
    `C ${radius} ${cy - handle} ${handle} ${cy - radius} 0 ${cy - radius}`,
  ].join(' ');
}

function circlePath(cx: number, cy: number, radius: number) {
  return [
    `M ${cx - radius} ${cy}`,
    `A ${radius} ${radius} 0 1 0 ${cx + radius} ${cy}`,
    `A ${radius} ${radius} 0 1 0 ${cx - radius} ${cy}`,
    'Z',
  ].join(' ');
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    width: '100%',
    aspectRatio: DREAM_CARD_ASPECT_RATIO,
    overflow: 'visible',
  },
  shadowSvg: {
    position: 'absolute',
    top: -SHADOW_SPREAD,
    right: -SHADOW_SPREAD,
    bottom: -SHADOW_SPREAD,
    left: -SHADOW_SPREAD,
  },
  svg: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  content: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
  },
  fixedContent: {
    flex: 1,
  },
  contentInset: {
    paddingHorizontal: 24,
    paddingVertical: 26,
  },
  ticketInset: {
    paddingTop: 25,
    paddingRight: 23,
    paddingBottom: 25,
    paddingLeft: 23,
  },
  tagInset: {
    paddingTop: 42,
  },
  compactContent: {
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  compactTicketInset: {
    paddingTop: 9,
    paddingRight: 7,
    paddingBottom: 9,
    paddingLeft: 7,
  },
  compactTagInset: {
    paddingTop: 13,
  },
});
