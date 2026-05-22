import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, Path } from 'react-native-svg';

import type { DreamCardFrame as DreamCardFrameType } from '../types/dream';

type Props = {
  backgroundColor: string;
  borderColor: string;
  children: ReactNode;
  compact?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  frame: DreamCardFrameType;
  height?: number;
  shadowColor?: string;
  style?: StyleProp<ViewStyle>;
  textureColor: string;
};

const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 430;

const paperFibers = [
  'M 28 42 C 74 38 118 48 166 42 S 246 35 294 43',
  'M 18 92 C 64 84 112 99 159 91 S 243 82 302 93',
  'M 36 139 C 91 130 132 149 184 139 S 252 132 286 143',
  'M 22 190 C 80 181 121 201 175 190 S 246 179 298 191',
  'M 34 248 C 81 239 127 258 178 248 S 245 239 289 249',
  'M 19 308 C 78 299 119 318 174 307 S 247 300 302 309',
  'M 33 366 C 92 356 135 376 190 366 S 252 356 288 368',
  'M 46 25 C 43 88 49 143 44 206 S 43 330 50 407',
  'M 154 18 C 148 83 157 138 151 201 S 150 323 157 414',
  'M 270 28 C 264 91 272 152 267 214 S 265 334 273 404',
];

const paperSpecks = [
  [46, 66, 1.2],
  [104, 31, 0.9],
  [233, 58, 1],
  [287, 116, 0.8],
  [75, 172, 1],
  [211, 164, 1.1],
  [123, 226, 0.9],
  [276, 251, 1.2],
  [48, 294, 0.8],
  [181, 318, 1],
  [260, 365, 0.9],
  [111, 392, 1.1],
] as const;

export function DreamCardFrame({
  backgroundColor,
  borderColor,
  children,
  compact = false,
  contentStyle,
  frame,
  height,
  shadowColor,
  style,
  textureColor,
}: Props) {
  const shapePath = getFramePath(frame);
  const innerPath = getInnerFramePath(frame);
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
            <Path d={shapePath} fillRule="evenodd" />
          </ClipPath>
        </Defs>
        <Path d={shapePath} fill={backgroundColor} fillRule="evenodd" />
        <G clipPath={`url(#${clipId})`} opacity={compact ? 0.12 : 0.18}>
          {paperFibers.map(fiber => (
            <Path
              key={fiber}
              d={fiber}
              fill="none"
              stroke={textureColor}
              strokeLinecap="round"
              strokeWidth={0.7}
            />
          ))}
          {paperSpecks.map(([cx, cy, r]) => (
            <Circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              fill={textureColor}
              opacity={0.42}
              r={r}
            />
          ))}
        </G>
        <Path
          d={innerPath}
          fill="none"
          opacity={compact ? 0.38 : 0.46}
          stroke={borderColor}
          strokeDasharray={frame === 'classic' ? '4 5' : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={compact ? 1.5 : 1.8}
        />
        {frame === 'ticket' ? (
          <>
            <Line
              opacity={compact ? 0.24 : 0.36}
              stroke={borderColor}
              strokeDasharray="3 7"
              strokeLinecap="round"
              strokeWidth={2}
              x1={30}
              x2={290}
              y1={342}
              y2={342}
            />
            <Circle cx={30} cy={342} fill={borderColor} opacity={0.36} r={2} />
            <Circle cx={290} cy={342} fill={borderColor} opacity={0.36} r={2} />
          </>
        ) : null}
        <Path
          d={shapePath}
          fill="none"
          fillRule="evenodd"
          stroke={borderColor}
          strokeLinejoin="round"
          strokeWidth={compact ? 2 : 2.6}
        />
      </Svg>
      <View
        style={[
          styles.content,
          height !== undefined && styles.fixedContent,
          compact ? styles.compactContent : styles.contentInset,
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
    const topBites = [48, 80, 112, 144, 176, 208, 240, 272]
      .map(cx => circlePath(cx, 8, 9))
      .join(' ');
    const bottomBites = [48, 80, 112, 144, 176, 208, 240, 272]
      .map(cx => circlePath(cx, 422, 9))
      .join(' ');
    return `${roundedRectPath(
      8,
      8,
      304,
      414,
      20,
    )} ${topBites} ${bottomBites} ${circlePath(8, 218, 14)} ${circlePath(
      312,
      218,
      14,
    )}`;
  }

  if (frame === 'beveled') {
    return 'M 38 8 H 282 L 312 38 V 392 L 282 422 H 38 L 8 392 V 38 Z';
  }

  if (frame === 'tag') {
    return (
      'M 50 8 H 270 L 312 50 V 402 Q 312 422 292 422 H 28 Q 8 422 8 402 V 50 Z ' +
      circlePath(160, 31, 8)
    );
  }

  return roundedRectPath(8, 8, 304, 414, 18);
}

function getInnerFramePath(frame: DreamCardFrameType) {
  if (frame === 'beveled') {
    return 'M 44 26 H 276 L 294 44 V 386 L 276 404 H 44 L 26 386 V 44 Z';
  }

  if (frame === 'tag') {
    return 'M 56 28 H 264 L 292 56 V 386 Q 292 404 274 404 H 46 Q 28 404 28 386 V 56 Z';
  }

  if (frame === 'ticket') {
    return roundedRectPath(26, 28, 268, 374, 10);
  }

  return roundedRectPath(26, 26, 268, 378, 10);
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
  },
  shadow: {
    shadowOpacity: 0.12,
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
    position: 'relative',
    zIndex: 1,
  },
  fixedContent: {
    flex: 1,
  },
  contentInset: {
    padding: 18,
  },
  compactContent: {
    padding: 9,
  },
  tagInset: {
    paddingTop: 24,
  },
  compactTagInset: {
    paddingTop: 13,
  },
});
