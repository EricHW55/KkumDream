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

export const DREAM_CARD_ASPECT_RATIO = 390 / 772;

const FRAME_WIDTH = 390;
const FRAME_HEIGHT = 772;
const TICKET_TOP_CUTOUTS = [18, 66, 114, 162, 210, 258, 306, 354];
const TICKET_BOTTOM_CUTOUTS = [42, 92, 142, 192, 242, 292, 342];

const paperFibers = [
  'M 28 58 C 92 51 144 67 205 58 S 308 49 362 61',
  'M 22 132 C 85 120 143 142 201 130 S 302 119 366 133',
  'M 38 214 C 104 202 156 226 222 214 S 315 202 354 217',
  'M 24 302 C 96 288 151 313 216 300 S 312 287 366 303',
  'M 36 402 C 98 389 156 414 222 401 S 312 390 356 404',
  'M 22 512 C 96 498 153 524 218 510 S 314 500 368 514',
  'M 36 636 C 104 622 162 648 229 635 S 318 622 356 638',
  'M 54 32 C 48 134 58 242 52 344 S 50 585 58 744',
  'M 188 25 C 180 133 192 244 184 348 S 182 588 191 748',
  'M 330 40 C 322 148 334 270 326 374 S 324 596 333 740',
];

const paperSpecks = [
  [46, 66, 1.2],
  [128, 44, 0.9],
  [284, 82, 1],
  [348, 168, 0.8],
  [75, 256, 1],
  [251, 238, 1.1],
  [143, 346, 0.9],
  [326, 418, 1.2],
  [48, 506, 0.8],
  [221, 578, 1],
  [312, 670, 0.9],
  [111, 724, 1.1],
] as const;

const paperFoldLines = [
  'M 70 0 C 62 188 75 358 66 772',
  'M 196 0 C 190 178 202 368 194 772',
  'M 326 0 C 318 190 330 374 320 772',
  'M 0 584 C 96 572 180 590 260 580 S 344 573 390 590',
] as const;

const cornerStarPath =
  'M 0 -7 L 1.6 -1.8 L 7 0 L 1.6 1.8 L 0 7 L -1.6 1.8 L -7 0 L -1.6 -1.8 Z';

const cornerOrnaments: { x: number; y: number; rotation?: number }[] = [
  { x: 30, y: 30 },
  { x: 360, y: 30, rotation: 22 },
  { x: 30, y: 742 },
  { x: 360, y: 742, rotation: 22 },
];

const inkStains: { x: number; y: number; r: number; opacity: number }[] = [
  { x: 48, y: 188, r: 2.4, opacity: 0.22 },
  { x: 332, y: 116, r: 1.6, opacity: 0.18 },
  { x: 308, y: 462, r: 2.8, opacity: 0.16 },
  { x: 78, y: 612, r: 1.4, opacity: 0.2 },
  { x: 274, y: 698, r: 2.2, opacity: 0.18 },
  { x: 156, y: 462, r: 1.2, opacity: 0.2 },
];

const crosshatchLines = [
  'M 12 14 L 26 14 M 12 18 L 26 18',
  'M 364 16 L 378 16 M 364 20 L 378 20',
  'M 12 754 L 26 754 M 12 758 L 26 758',
  'M 364 754 L 378 754 M 364 758 L 378 758',
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
              opacity={0.38}
              r={r}
            />
          ))}
        </G>
        <G clipPath={`url(#${clipId})`} opacity={compact ? 0.12 : 0.2}>
          {paperFoldLines.map(line => (
            <Path
              key={line}
              d={line}
              fill="none"
              stroke={textureColor}
              strokeLinecap="round"
              strokeWidth={0.65}
            />
          ))}
        </G>
        <G clipPath={`url(#${clipId})`}>
          {inkStains.map(stain => (
            <Circle
              key={`${stain.x}-${stain.y}`}
              cx={stain.x}
              cy={stain.y}
              fill={borderColor}
              opacity={stain.opacity}
              r={stain.r}
            />
          ))}
        </G>
        <G clipPath={`url(#${clipId})`} opacity={compact ? 0.4 : 0.55}>
          {crosshatchLines.map(line => (
            <Path
              key={line}
              d={line}
              fill="none"
              stroke={borderColor}
              strokeLinecap="round"
              strokeWidth={compact ? 0.6 : 1}
            />
          ))}
        </G>
        <G clipPath={`url(#${clipId})`}>
          {cornerOrnaments.map(ornament => (
            <G
              key={`${ornament.x}-${ornament.y}`}
              transform={`translate(${ornament.x} ${ornament.y}) rotate(${ornament.rotation ?? 0})`}
            >
              <Path
                d={cornerStarPath}
                fill={borderColor}
                opacity={compact ? 0.55 : 0.7}
              />
            </G>
          ))}
        </G>
        <Path
          d={innerPath}
          fill="none"
          opacity={frame === 'ticket' ? 1 : compact ? 0.42 : 0.5}
          stroke={borderColor}
          strokeDasharray={frame === 'classic' ? '4 5' : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={
            frame === 'ticket' ? (compact ? 1.5 : 2.2) : compact ? 1.5 : 1.8
          }
        />
        <Path
          d={innerPath}
          fill="none"
          opacity={compact ? 0.16 : 0.24}
          stroke={borderColor}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={0.75}
        />
        {frame === 'ticket' ? (
          <>
            <Line
              opacity={0.95}
              stroke={borderColor}
              strokeDasharray="2 7"
              strokeLinecap="round"
              strokeWidth={compact ? 1.6 : 2.6}
              x1={20}
              x2={370}
              y1={568}
              y2={568}
            />
            <Line
              opacity={0.95}
              stroke={borderColor}
              strokeDasharray="2 7"
              strokeLinecap="round"
              strokeWidth={compact ? 1.6 : 2.6}
              x1={20}
              x2={370}
              y1={640}
              y2={640}
            />
          </>
        ) : null}
        <Path
          d={shapePath}
          fill="none"
          fillRule="evenodd"
          stroke={borderColor}
          strokeLinejoin="round"
          strokeWidth={
            frame === 'ticket' ? (compact ? 2 : 3.4) : compact ? 2 : 2.6
          }
        />
        <Path
          d={shapePath}
          fill="none"
          fillRule="evenodd"
          opacity={compact ? 0.16 : 0.26}
          stroke={borderColor}
          strokeLinejoin="round"
          strokeWidth={0.9}
        />
      </Svg>
      <View
        style={[
          styles.content,
          height !== undefined && styles.fixedContent,
          compact ? styles.compactContent : styles.contentInset,
          frame === 'ticket' &&
            (compact ? styles.compactTicketContent : styles.ticketContentInset),
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
    const topBites = TICKET_TOP_CUTOUTS.map(cx => circlePath(cx, 0, 16)).join(
      ' ',
    );
    const bottomBites = TICKET_BOTTOM_CUTOUTS.map(cx =>
      circlePath(cx, FRAME_HEIGHT, 17),
    ).join(' ');
    return `${rectPath(
      0,
      0,
      FRAME_WIDTH,
      FRAME_HEIGHT,
    )} ${topBites} ${bottomBites} ${circlePath(0, 560, 17)} ${circlePath(
      FRAME_WIDTH,
      560,
      17,
    )}`;
  }

  if (frame === 'beveled') {
    return 'M 40 0 H 350 L 390 40 V 732 L 350 772 H 40 L 0 732 V 40 Z';
  }

  if (frame === 'tag') {
    return (
      'M 62 0 H 328 L 390 62 V 732 Q 390 772 350 772 H 40 Q 0 772 0 732 V 62 Z ' +
      circlePath(195, 32, 10)
    );
  }

  return roundedRectPath(0, 0, FRAME_WIDTH, FRAME_HEIGHT, 22);
}

function getInnerFramePath(frame: DreamCardFrameType) {
  if (frame === 'beveled') {
    return 'M 46 24 H 344 L 366 46 V 726 L 344 748 H 46 L 24 726 V 46 Z';
  }

  if (frame === 'tag') {
    return 'M 68 28 H 322 L 362 68 V 724 Q 362 748 338 748 H 52 Q 28 748 28 724 V 68 Z';
  }

  if (frame === 'ticket') {
    return rectPath(20, 34, 350, 468);
  }

  return roundedRectPath(24, 24, 342, 724, 12);
}

function rectPath(x: number, y: number, width: number, height: number) {
  const right = x + width;
  const bottom = y + height;
  return [`M ${x} ${y}`, `H ${right}`, `V ${bottom}`, `H ${x}`, 'Z'].join(' ');
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
    shadowOpacity: 0.14,
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
    padding: 22,
  },
  ticketContentInset: {
    paddingTop: 34,
    paddingRight: 20,
    paddingBottom: 28,
    paddingLeft: 20,
  },
  compactContent: {
    padding: 9,
  },
  compactTicketContent: {
    paddingTop: 11,
    paddingRight: 6,
    paddingBottom: 9,
    paddingLeft: 6,
  },
  tagInset: {
    paddingTop: 34,
  },
  compactTagInset: {
    paddingTop: 14,
  },
});
