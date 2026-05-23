import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  Path,
} from 'react-native-svg';

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

  return (
    <View
      style={[
        styles.root,
        height !== undefined && { height },
        shadowColor && styles.shadow,
        shadowColor && { shadowColor },
        style,
      ]}
    >
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
          href={paperTexture}
          opacity={minimal ? (compact ? 0.06 : 0.08) : compact ? 0.08 : 0.12}
          preserveAspectRatio="xMidYMid slice"
          width={FRAME_WIDTH}
          x={0}
          y={0}
        />

        <G
          clipPath={`url(#${clipId})`}
          opacity={minimal ? (compact ? 0.03 : 0.04) : compact ? 0.04 : 0.06}
        >
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

        {minimal ? null : (
          <>
            <G clipPath={`url(#${clipId})`} opacity={compact ? 0.07 : 0.1}>
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
            <G clipPath={`url(#${clipId})`} opacity={compact ? 0.1 : 0.15}>
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
          opacity={compact ? 0.2 : 0.3}
          stroke={borderColor}
          strokeDasharray={frame === 'classic' ? '3 7' : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={compact ? 0.5 : 0.7}
        />
        <Path
          d={accentPath}
          fill="none"
          opacity={compact ? 0.07 : 0.11}
          stroke={borderColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={0.45}
        />

        <Path
          d={shapePath}
          fill="none"
          clipRule="evenodd"
          fillRule="evenodd"
          stroke={borderColor}
          strokeLinejoin="round"
          strokeWidth={compact ? 0.7 : 0.95}
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
    return 'M 24 0 H 316 L 340 24 V 486 L 316 510 H 24 L 0 486 V 24 Z';
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
    return 'M 34 18 H 306 L 322 34 V 476 L 306 492 H 34 L 18 476 V 34 Z';
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
    return 'M 42 30 H 298 L 310 42 V 468 L 298 480 H 42 L 30 468 V 42 Z';
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
  },
  shadow: {
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
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
