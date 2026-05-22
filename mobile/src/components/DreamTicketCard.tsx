/**
 * DreamTicketCard
 *
 * A reusable, presentation-only ticket card component for KKUMDREAM.
 * - Visuals follow a vintage dream-ticket / postage stamp aesthetic.
 * - Does no API, navigation, or animation work. Callers wire those.
 *
 * Example usage:
 *
 *   <DreamTicketCard
 *     card={{
 *       id: 'd-1',
 *       title: '고양이의 지하철',
 *       shortMessage: '오늘 내가 꾼 꿈을 너에게 줄게',
 *       senderName: '유성현',
 *       receiverName: '엄마',
 *       date: '2026-05-09T09:00:00Z',
 *       mainMood: '몽환',
 *       tags: ['몽환', '고양이', '지하철'],
 *     }}
 *     side="front"
 *     size="feed"
 *     onPress={() => navigation.navigate('DreamDetail', ...)}
 *     onFlip={() => setSide('back')}
 *   />
 */

import { useMemo } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, Path } from 'react-native-svg';

import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';

export type DreamTicketCardData = {
  id: string;
  title: string;
  shortMessage: string;
  summary?: string;
  story?: string;
  imageUrl?: string;
  senderName: string;
  receiverName: string;
  date: string;
  mainMood?: string;
  tags: string[];
  titleVisible?: boolean;
};

export type DreamTicketSize = 'thumb' | 'feed' | 'full';

export type DreamTicketCardProps = {
  card: DreamTicketCardData;
  side: 'front' | 'back';
  size?: DreamTicketSize;
  align?: 'left' | 'right';
  onPress?: () => void;
  onFlip?: () => void;
  /**
   * Optional slot for reaction/share/save buttons drawn under the back-side
   * story. The component renders the slot but never owns the controls.
   */
  actionSlot?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

const TICKET = {
  paper: colors.cardIvory,
  paperBack: '#F8F1DD',
  ink: '#2C2218',
  inkSoft: '#6B5A47',
  inkMuted: '#9C8B73',
  illustration: '#E9E3F5',
  star: colors.moonAccent,
  starSoft: '#FFE5A8',
  tagFill: '#F1E7CF',
  divider: colors.divider,
} as const;

const SERIF_FAMILY = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: undefined,
});

const SIZE_MAP: Record<
  DreamTicketSize,
  {
    width: number;
    titleSize: number;
    metaLabel: number;
    metaValue: number;
    headerSize: number;
    showCopy: boolean;
    showWordmark: boolean;
    showHeaderBar: boolean;
    insetIllustration: boolean;
  }
> = {
  thumb: {
    width: 148,
    titleSize: 12,
    metaLabel: 6,
    metaValue: 7.5,
    headerSize: 6,
    showCopy: false,
    showWordmark: false,
    showHeaderBar: false,
    insetIllustration: false,
  },
  feed: {
    width: 320,
    titleSize: 24,
    metaLabel: 9,
    metaValue: 11.5,
    headerSize: 9,
    showCopy: true,
    showWordmark: true,
    showHeaderBar: true,
    insetIllustration: true,
  },
  full: {
    width: 374,
    titleSize: 28,
    metaLabel: 10,
    metaValue: 13,
    headerSize: 10,
    showCopy: true,
    showWordmark: true,
    showHeaderBar: true,
    insetIllustration: true,
  },
};

const ASPECT_RATIO = 2 / 3.05;

const TICKET_DATE_MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

export function DreamTicketCard({
  card,
  side,
  size = 'feed',
  align,
  onPress,
  onFlip,
  actionSlot,
  style,
}: DreamTicketCardProps) {
  const dims = SIZE_MAP[size];
  const cardWidth = dims.width;
  const cardHeight = Math.round(cardWidth / ASPECT_RATIO);

  const formattedDate = useMemo(() => formatTicketDate(card.date), [card.date]);

  const containerStyle: StyleProp<ViewStyle> = [
    styles.outer,
    align === 'left' && { alignSelf: 'flex-start' },
    align === 'right' && { alignSelf: 'flex-end' },
    style,
  ];

  const cardBody =
    side === 'front' ? (
      <FrontFace card={card} dims={dims} formattedDate={formattedDate} />
    ) : (
      <BackFace
        actionSlot={actionSlot}
        card={card}
        dims={dims}
        formattedDate={formattedDate}
      />
    );

  return (
    <View style={containerStyle}>
      <Pressable
        accessibilityRole="button"
        onLongPress={onFlip}
        onPress={onPress}
        style={({ pressed }) => [
          styles.cardWrap,
          {
            width: cardWidth,
            height: cardHeight,
            opacity: pressed ? 0.92 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          },
        ]}
      >
        <TicketBackdrop
          paper={side === 'front' ? TICKET.paper : TICKET.paperBack}
        />
        <View style={[styles.cardContent, { padding: paddingForSize(size) }]}>
          {cardBody}
        </View>
        {onFlip ? (
          <Pressable
            accessibilityLabel="카드 뒤집기"
            accessibilityRole="button"
            hitSlop={6}
            onPress={onFlip}
            style={styles.flipButton}
          >
            <Text style={[styles.flipButtonText, { color: TICKET.inkSoft }]}>
              {side === 'front' ? '뒷면' : '앞면'}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
    </View>
  );
}

// ============================================================================
// Front face
// ============================================================================

type FaceProps = {
  card: DreamTicketCardData;
  dims: (typeof SIZE_MAP)[DreamTicketSize];
  formattedDate: string;
};

function FrontFace({ card, dims, formattedDate }: FaceProps) {
  return (
    <View style={styles.faceColumn}>
      {dims.showHeaderBar ? (
        <View style={styles.headerBar}>
          <View style={styles.headerLeft}>
            <Text
              style={[
                styles.headerTitle,
                {
                  color: TICKET.ink,
                  fontSize: dims.headerSize + 1,
                  fontFamily: SERIF_FAMILY,
                },
              ]}
            >
              ✦ KKUMDREAM
            </Text>
            <Text
              style={[
                styles.headerSub,
                { color: TICKET.inkSoft, fontSize: dims.headerSize },
              ]}
            >
              ADMIT ONE DREAM
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text
              style={[
                styles.dateStamp,
                {
                  color: TICKET.inkSoft,
                  fontFamily: SERIF_FAMILY,
                  fontSize: dims.headerSize,
                },
              ]}
            >
              {formattedDate}
            </Text>
          </View>
        </View>
      ) : null}

      {dims.showHeaderBar ? (
        <PrintedRule color={TICKET.ink} dashed style={{ marginVertical: 6 }} />
      ) : null}

      <IllustrationWindow
        imageUrl={card.imageUrl}
        moodFallback={card.mainMood}
        backgroundColor={TICKET.illustration}
        borderColor={TICKET.ink}
        inset={dims.insetIllustration}
      />

      {card.titleVisible !== false ? (
        <Text
          numberOfLines={2}
          style={[
            styles.title,
            {
              color: TICKET.ink,
              fontFamily: SERIF_FAMILY,
              fontSize: dims.titleSize,
              lineHeight: Math.round(dims.titleSize * 1.18),
            },
          ]}
        >
          {card.title}
        </Text>
      ) : null}

      {dims.showCopy ? (
        <Text
          numberOfLines={1}
          style={[
            styles.copyLine,
            { color: TICKET.inkSoft, fontSize: dims.headerSize + 1 },
          ]}
        >
          오늘 내가 꾼 꿈에 너를 초대합니다
        </Text>
      ) : null}

      {dims.showCopy ? (
        <Text
          numberOfLines={2}
          style={[
            styles.shortMessage,
            { color: TICKET.inkSoft, fontSize: dims.metaValue },
          ]}
        >
          {card.shortMessage}
        </Text>
      ) : null}

      <PrintedRule
        color={TICKET.ink}
        ornament="star"
        style={{ marginVertical: 4 }}
      />

      <MetaPair
        items={[
          { label: 'FROM', value: card.senderName },
          { label: 'TO', value: card.receiverName },
        ]}
        labelSize={dims.metaLabel}
        valueSize={dims.metaValue}
        arrow
      />

      {dims.showCopy ? (
        <MetaPair
          items={[
            { label: 'DATE', value: formattedDate },
            { label: 'MOOD', value: card.mainMood ?? '몽환' },
          ]}
          labelSize={dims.metaLabel}
          valueSize={dims.metaValue}
        />
      ) : null}

      {dims.showCopy && card.tags.length > 0 ? (
        <View style={styles.tagsRow}>
          {card.tags.slice(0, 3).map(tag => (
            <View key={tag} style={[styles.tag, { borderColor: TICKET.ink }]}>
              <Text
                style={[
                  styles.tagText,
                  { color: TICKET.ink, fontSize: dims.metaValue - 1 },
                ]}
              >
                #{tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.spacer} />

      {dims.showWordmark ? (
        <View style={styles.wordmarkRow}>
          <Text
            style={[
              styles.wordmark,
              {
                color: TICKET.ink,
                fontFamily: SERIF_FAMILY,
                fontSize: dims.headerSize + 2,
              },
            ]}
          >
            ✦ 꿈드림 ✦
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// ============================================================================
// Back face
// ============================================================================

type BackProps = FaceProps & {
  actionSlot?: React.ReactNode;
};

function BackFace({ actionSlot, card, dims, formattedDate }: BackProps) {
  return (
    <View style={styles.faceColumn}>
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <Text
            style={[
              styles.headerSub,
              { color: TICKET.inkSoft, fontSize: dims.headerSize },
            ]}
          >
            DREAM RECORD
          </Text>
          <Text
            numberOfLines={2}
            style={[
              styles.title,
              {
                color: TICKET.ink,
                fontFamily: SERIF_FAMILY,
                fontSize: dims.titleSize - 2,
                lineHeight: Math.round((dims.titleSize - 2) * 1.18),
              },
            ]}
          >
            {card.title}
          </Text>
        </View>
        <Text
          style={[
            styles.dateStamp,
            {
              color: TICKET.inkSoft,
              fontFamily: SERIF_FAMILY,
              fontSize: dims.headerSize,
            },
          ]}
        >
          {formattedDate}
        </Text>
      </View>

      <PrintedRule color={TICKET.ink} dashed style={{ marginVertical: 6 }} />

      <View style={styles.summaryRow}>
        <View
          style={[
            styles.thumb,
            { backgroundColor: TICKET.illustration, borderColor: TICKET.ink },
          ]}
        >
          {card.imageUrl ? (
            <Image source={{ uri: card.imageUrl }} style={styles.thumbImage} />
          ) : (
            <Text style={[styles.thumbMood, { color: TICKET.inkSoft }]}>
              {card.mainMood ?? '꿈'}
            </Text>
          )}
        </View>
        <Text
          style={[
            styles.summary,
            {
              color: TICKET.inkSoft,
              fontSize: dims.metaValue,
              fontFamily: SERIF_FAMILY,
            },
          ]}
        >
          {card.summary ?? card.shortMessage}
        </Text>
      </View>

      <PrintedRule color={TICKET.ink} dashed style={{ marginVertical: 6 }} />

      <ScrollView
        bounces={false}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        style={styles.storyScroll}
      >
        <Text
          style={[
            styles.storyText,
            {
              color: TICKET.ink,
              fontSize: dims.metaValue + 1,
              lineHeight: Math.round((dims.metaValue + 1) * 1.55),
              fontFamily: SERIF_FAMILY,
            },
          ]}
        >
          {card.story ?? card.shortMessage}
        </Text>
      </ScrollView>

      {card.tags.length > 0 ? (
        <View style={styles.tagsRow}>
          {card.tags.map(tag => (
            <View key={tag} style={[styles.tag, { borderColor: TICKET.ink }]}>
              <Text
                style={[
                  styles.tagText,
                  { color: TICKET.ink, fontSize: dims.metaValue - 1 },
                ]}
              >
                #{tag}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <PrintedRule color={TICKET.ink} style={{ marginVertical: 6 }} />

      <View style={styles.metaBlock}>
        <MetaPair
          items={[
            { label: 'FROM', value: card.senderName },
            { label: 'TO', value: card.receiverName },
          ]}
          labelSize={dims.metaLabel}
          valueSize={dims.metaValue}
        />
        <MetaPair
          items={[
            { label: 'DATE', value: formattedDate },
            { label: 'MOOD', value: card.mainMood ?? '몽환' },
          ]}
          labelSize={dims.metaLabel}
          valueSize={dims.metaValue}
        />
      </View>

      {actionSlot ? (
        <View style={styles.actionSlot}>{actionSlot}</View>
      ) : (
        <View style={styles.actionSlot}>
          <View style={styles.actionPlaceholder}>
            <Text
              style={[styles.actionPlaceholderText, { color: TICKET.inkMuted }]}
            >
              ♡ ↗ ↓
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// Building blocks
// ============================================================================

function IllustrationWindow({
  imageUrl,
  moodFallback,
  backgroundColor,
  borderColor,
  inset,
}: {
  imageUrl?: string;
  moodFallback?: string;
  backgroundColor: string;
  borderColor: string;
  inset: boolean;
}) {
  return (
    <View
      style={[
        styles.illustrationWrap,
        inset && styles.illustrationInset,
        { borderColor, backgroundColor },
      ]}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.illustrationImage} />
      ) : (
        <View style={styles.illustrationFallback}>
          <Text style={[styles.illustrationStar, { color: TICKET.star }]}>
            ✦
          </Text>
          <Text
            style={[
              styles.illustrationMood,
              { color: TICKET.inkSoft, fontFamily: SERIF_FAMILY },
            ]}
          >
            {moodFallback ?? 'KKUMDREAM'}
          </Text>
        </View>
      )}
    </View>
  );
}

function PrintedRule({
  color,
  dashed = false,
  ornament,
  style,
}: {
  color: string;
  dashed?: boolean;
  ornament?: 'star';
  style?: StyleProp<ViewStyle>;
}) {
  if (ornament === 'star') {
    return (
      <View style={[styles.ruleRow, style]}>
        <View style={[styles.ruleSegment, { backgroundColor: color }]} />
        <Text style={[styles.ruleStar, { color }]}>✦</Text>
        <View style={[styles.ruleSegment, { backgroundColor: color }]} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.simpleRule,
        {
          borderColor: color,
          borderStyle: dashed ? 'dashed' : 'solid',
        },
        style,
      ]}
    />
  );
}

function MetaPair({
  items,
  labelSize,
  valueSize,
  arrow = false,
}: {
  items: { label: string; value: string }[];
  labelSize: number;
  valueSize: number;
  arrow?: boolean;
}) {
  return (
    <View style={styles.metaPairRow}>
      {items.map((item, index) => (
        <View key={item.label} style={styles.metaPairCell}>
          <Text
            style={[
              styles.metaLabel,
              {
                color: TICKET.inkMuted,
                fontSize: labelSize,
                fontFamily: SERIF_FAMILY,
              },
            ]}
          >
            {item.label}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.metaValue,
              {
                color: TICKET.ink,
                fontSize: valueSize,
                fontFamily: SERIF_FAMILY,
              },
            ]}
          >
            {item.value}
          </Text>
          {arrow && index === 0 ? (
            <View style={styles.metaArrowWrap}>
              <Text style={[styles.metaArrow, { color: TICKET.inkSoft }]}>
                →
              </Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

// ============================================================================
// Paper backdrop SVG (ticket shape + texture)
// ============================================================================

function TicketBackdrop({ paper }: { paper: string }) {
  const clipId = 'dream-ticket-clip';
  const w = 200;
  const h = Math.round(w / ASPECT_RATIO);
  const shape = ticketShapePath(w, h);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
      >
        <Defs>
          <ClipPath id={clipId}>
            <Path d={shape} fillRule="evenodd" />
          </ClipPath>
        </Defs>
        <Path d={shape} fill={paper} fillRule="evenodd" />

        {/* Paper specks */}
        <G clipPath={`url(#${clipId})`} opacity={0.16}>
          {paperSpecks.map(([cx, cy, r]) => (
            <Circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              fill={TICKET.inkMuted}
              r={r}
            />
          ))}
        </G>

        {/* Perforation line near bottom */}
        <Line
          x1={12}
          x2={w - 12}
          y1={Math.round(h * 0.68)}
          y2={Math.round(h * 0.68)}
          stroke={TICKET.ink}
          strokeDasharray="2 5"
          strokeOpacity={0.4}
          strokeWidth={0.6}
        />

        {/* Outer border */}
        <Path
          d={shape}
          fill="none"
          stroke={TICKET.ink}
          strokeOpacity={0.95}
          strokeWidth={1.6}
          fillRule="evenodd"
        />
      </Svg>
    </View>
  );
}

function ticketShapePath(w: number, h: number): string {
  const r = 14;
  const notchR = 6;
  const notchY = Math.round(h * 0.62);
  return [
    `M ${r} 0`,
    `H ${w - r}`,
    `Q ${w} 0 ${w} ${r}`,
    `V ${notchY - notchR}`,
    `a ${notchR} ${notchR} 0 0 0 0 ${notchR * 2}`,
    `V ${h - r}`,
    `Q ${w} ${h} ${w - r} ${h}`,
    `H ${r}`,
    `Q 0 ${h} 0 ${h - r}`,
    `V ${notchY + notchR}`,
    `a ${notchR} ${notchR} 0 0 0 0 ${-notchR * 2}`,
    `V ${r}`,
    `Q 0 0 ${r} 0`,
    'Z',
  ].join(' ');
}

const paperSpecks: [number, number, number][] = [
  [22, 32, 0.7],
  [180, 48, 0.6],
  [142, 88, 0.5],
  [38, 140, 0.6],
  [170, 168, 0.5],
  [60, 220, 0.7],
  [120, 240, 0.5],
  [188, 280, 0.6],
  [44, 304, 0.4],
];

// ============================================================================
// Helpers
// ============================================================================

function paddingForSize(size: DreamTicketSize): number {
  if (size === 'thumb') return spacing.xs + 2;
  if (size === 'full') return spacing.md + 2;
  return spacing.md;
}

function formatTicketDate(iso: string): string {
  if (!iso) return '— · —';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = String(date.getDate()).padStart(2, '0');
  const month = TICKET_DATE_MONTHS[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${day} ${month} ${year}`;
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  outer: {
    alignSelf: 'center',
    padding: 2,
  },
  cardWrap: {
    overflow: 'hidden',
    borderRadius: radius.card,
    shadowColor: TICKET.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 3,
  },
  cardContent: {
    flex: 1,
  },
  faceColumn: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontWeight: '900',
    letterSpacing: 1.2,
    includeFontPadding: false,
  },
  headerSub: {
    fontWeight: '800',
    letterSpacing: 1.6,
    includeFontPadding: false,
    textTransform: 'uppercase',
  },
  dateStamp: {
    fontWeight: '800',
    letterSpacing: 1.6,
    includeFontPadding: false,
  },
  illustrationWrap: {
    width: '100%',
    aspectRatio: 1,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: TICKET.illustration,
  },
  illustrationInset: {
    marginTop: 2,
    marginBottom: 6,
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
  },
  illustrationFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  illustrationStar: {
    fontSize: 28,
    lineHeight: 32,
    includeFontPadding: false,
  },
  illustrationMood: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.8,
    includeFontPadding: false,
  },
  title: {
    fontWeight: '900',
    letterSpacing: -0.3,
    includeFontPadding: false,
    marginTop: 4,
  },
  copyLine: {
    marginTop: 4,
    letterSpacing: 0.6,
    fontWeight: '700',
    includeFontPadding: false,
  },
  shortMessage: {
    marginTop: 4,
    fontWeight: '600',
    lineHeight: 18,
    includeFontPadding: false,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ruleSegment: {
    flex: 1,
    height: 1,
    opacity: 0.7,
  },
  ruleStar: {
    fontSize: 10,
    includeFontPadding: false,
    opacity: 0.8,
  },
  simpleRule: {
    width: '100%',
    borderTopWidth: 1,
    opacity: 0.75,
  },
  metaPairRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 2,
  },
  metaPairCell: {
    flex: 1,
    gap: 1,
    position: 'relative',
  },
  metaLabel: {
    fontWeight: '900',
    letterSpacing: 1.4,
    includeFontPadding: false,
  },
  metaValue: {
    fontWeight: '700',
    includeFontPadding: false,
  },
  metaArrowWrap: {
    position: 'absolute',
    right: -spacing.sm + 1,
    top: '50%',
  },
  metaArrow: {
    fontSize: 14,
    fontWeight: '800',
    includeFontPadding: false,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 6,
  },
  tag: {
    height: 22,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  tagText: {
    fontWeight: '800',
    letterSpacing: 0.6,
    includeFontPadding: false,
  },
  spacer: {
    flex: 1,
  },
  wordmarkRow: {
    alignItems: 'center',
    paddingTop: 4,
  },
  wordmark: {
    letterSpacing: 2.4,
    fontWeight: '900',
    includeFontPadding: false,
  },
  flipButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.chip,
    backgroundColor: 'rgba(255, 253, 246, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(44, 34, 24, 0.18)',
  },
  flipButtonText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    includeFontPadding: false,
  },
  // Back-face specific
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    marginTop: 4,
  },
  thumb: {
    width: 64,
    height: 64,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbMood: {
    fontSize: 16,
    fontWeight: '800',
    includeFontPadding: false,
  },
  summary: {
    flex: 1,
    lineHeight: 18,
    includeFontPadding: false,
  },
  storyScroll: {
    flexGrow: 0,
    flexShrink: 1,
    maxHeight: 220,
    marginTop: 4,
  },
  storyText: {
    fontWeight: '500',
    includeFontPadding: false,
  },
  metaBlock: {
    gap: 6,
    marginTop: 2,
  },
  actionSlot: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: TICKET.divider,
  },
  actionPlaceholder: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 4,
  },
  actionPlaceholderText: {
    fontSize: 18,
    letterSpacing: 6,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
