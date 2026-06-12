import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Stop,
} from 'react-native-svg';

import { ApiError } from '../api/httpClient';
import { colors } from '../theme/colors';
import { handwritingFont } from '../theme/typography';
import type {
  DreamReactionSummary,
  DreamReactionToggleResult,
  DreamReactionType,
} from '../types/dream';
import { DREAM_REACTION_TYPES } from '../types/dream';

const reactionMeta: Record<
  DreamReactionType,
  { accessibilityLabel: string }
> = {
  heart: { accessibilityLabel: '좋아요 반응' },
  laugh: { accessibilityLabel: '웃겨요 반응' },
  tear: { accessibilityLabel: '감동 또는 슬픔 반응' },
  surprise: { accessibilityLabel: '놀람 반응' },
  dream: { accessibilityLabel: '꿈같아요 반응' },
};
const REACTION_SAVE_RETRY_DELAYS_MS = [800, 1600, 3000];
const RETRYABLE_REACTION_SAVE_STATUSES = new Set([502, 503, 504]);

type DesiredReaction = {
  reactionType: DreamReactionType;
  reacted: boolean;
};

function wait(ms: number) {
  return new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });
}

function isRetryableReactionSaveError(error: unknown) {
  if (error instanceof ApiError) {
    return RETRYABLE_REACTION_SAVE_STATUSES.has(error.status);
  }
  return error instanceof Error && error.message === 'Network request failed';
}

async function retryReactionSave<T>(request: () => Promise<T>) {
  let lastError: unknown;
  for (
    let attempt = 0;
    attempt <= REACTION_SAVE_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
      const shouldRetry =
        attempt < REACTION_SAVE_RETRY_DELAYS_MS.length &&
        isRetryableReactionSaveError(error);
      if (!shouldRetry) {
        throw error;
      }
      await wait(REACTION_SAVE_RETRY_DELAYS_MS[attempt]);
    }
  }
  throw lastError;
}

type ReactionState = {
  counts: Record<DreamReactionType, number>;
  selected: DreamReactionType | null;
};

function toState(summary: DreamReactionSummary[]): ReactionState {
  const counts = {} as Record<DreamReactionType, number>;
  let selected: DreamReactionType | null = null;
  for (const reactionType of DREAM_REACTION_TYPES) {
    const row = summary.find(item => item.reactionType === reactionType);
    counts[reactionType] = Math.max(0, row?.count ?? 0);
    if (row?.reacted) {
      selected = reactionType;
    }
  }
  return { counts, selected };
}

function applyTap(state: ReactionState, reactionType: DreamReactionType): ReactionState {
  const counts = { ...state.counts };
  if (state.selected === reactionType) {
    counts[reactionType] = Math.max(0, counts[reactionType] - 1);
    return { counts, selected: null };
  }
  if (state.selected) {
    counts[state.selected] = Math.max(0, counts[state.selected] - 1);
  }
  counts[reactionType] = counts[reactionType] + 1;
  return { counts, selected: reactionType };
}

type ReactionBarProps = {
  summary: DreamReactionSummary[];
  disabled?: boolean;
  onToggle: (
    reactionType: DreamReactionType,
    reacted: boolean,
  ) => Promise<DreamReactionToggleResult>;
};

export function ReactionBar({ summary, disabled = false, onToggle }: ReactionBarProps) {
  const [state, setStateRaw] = useState<ReactionState>(() => toState(summary));
  const stateRef = useRef(state);
  const committedRef = useRef(state);
  const inFlightRef = useRef(0);
  const isMountedRef = useRef(true);
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef<DesiredReaction | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setState = useCallback((next: ReactionState) => {
    stateRef.current = next;
    setStateRaw(next);
  }, []);

  // Adopt server truth whenever no optimistic request is in flight, so that
  // background refetches and the initial load stay authoritative.
  useEffect(() => {
    if (inFlightRef.current === 0) {
      const next = toState(summary);
      committedRef.current = next;
      setState(next);
    }
  }, [summary, setState]);

  useEffect(
    () => () => {
      isMountedRef.current = false;
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    },
    [],
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const processPendingSave = useCallback(async () => {
    if (isSavingRef.current) {
      return;
    }
    isSavingRef.current = true;
    inFlightRef.current = 1;
    try {
      while (pendingSaveRef.current) {
        const desired = pendingSaveRef.current;
        pendingSaveRef.current = null;
        try {
          const result = await retryReactionSave(() =>
            onToggle(desired.reactionType, desired.reacted),
          );
          const serverState = toState(result.summary);
          committedRef.current = serverState;
          if (isMountedRef.current && !pendingSaveRef.current) {
            setState(serverState);
          }
        } catch {
          if (isMountedRef.current && !pendingSaveRef.current) {
            setState(committedRef.current);
            showToast('반응을 저장하지 못했어요. 다시 시도해주세요.');
          }
        }
      }
    } finally {
      inFlightRef.current = 0;
      isSavingRef.current = false;
    }
  }, [onToggle, setState, showToast]);

  const handlePress = useCallback(
    (reactionType: DreamReactionType) => {
      if (disabled) {
        return;
      }
      const next = applyTap(stateRef.current, reactionType);
      setState(next);

      pendingSaveRef.current = {
        reactionType,
        reacted: next.selected === reactionType,
      };
      void processPendingSave();
    },
    [disabled, processPendingSave, setState],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {DREAM_REACTION_TYPES.map(reactionType => (
          <ReactionChip
            key={reactionType}
            reactionType={reactionType}
            count={state.counts[reactionType] ?? 0}
            selected={state.selected === reactionType}
            disabled={disabled}
            onPress={handlePress}
          />
        ))}
      </ScrollView>
      {toast ? (
        <View pointerEvents="none" style={styles.toastWrap}>
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(220)}
            style={styles.toast}
          >
            <Text style={styles.toastText}>{toast}</Text>
          </Animated.View>
        </View>
      ) : null}
    </View>
  );
}

type ReactionChipProps = {
  reactionType: DreamReactionType;
  count: number;
  selected: boolean;
  disabled: boolean;
  onPress: (reactionType: DreamReactionType) => void;
};

function ReactionChip({
  reactionType,
  count,
  selected,
  disabled,
  onPress,
}: ReactionChipProps) {
  const meta = reactionMeta[reactionType];
  const chipScale = useSharedValue(1);
  const emojiScale = useSharedValue(1);
  const countTranslateY = useSharedValue(0);
  const countOpacity = useSharedValue(1);
  const highlight = useSharedValue(selected ? 1 : 0);
  const starProgress = useSharedValue(0);
  const prevSelected = useRef(selected);
  const prevCount = useRef(count);

  useEffect(() => {
    const wasSelected = prevSelected.current;
    if (selected && !wasSelected) {
      // Pop only the newly selected chip (not the one being switched away from).
      chipScale.value = withSequence(
        withTiming(1.08, { duration: 90, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) }),
      );
      emojiScale.value = withSequence(
        withTiming(0.8, { duration: 0 }),
        withSpring(1.25, { damping: 7, stiffness: 220 }),
        withSpring(1, { damping: 12, stiffness: 180 }),
      );
      if (reactionType === 'dream') {
        starProgress.value = 0;
        starProgress.value = withTiming(1, {
          duration: 620,
          easing: Easing.out(Easing.quad),
        });
      }
    }
    // Highlight fades both ways, so deselect settles smoothly without a pop.
    highlight.value = withTiming(selected ? 1 : 0, { duration: 160 });
    prevSelected.current = selected;
  }, [selected, reactionType, chipScale, emojiScale, highlight, starProgress]);

  useEffect(() => {
    if (count > prevCount.current) {
      countTranslateY.value = withSequence(
        withTiming(-3, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 130, easing: Easing.out(Easing.quad) }),
      );
      countOpacity.value = withSequence(
        withTiming(0.7, { duration: 0 }),
        withTiming(1, { duration: 200 }),
      );
    }
    prevCount.current = count;
  }, [count, countTranslateY, countOpacity]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: chipScale.value }],
    backgroundColor: interpolateColor(
      highlight.value,
      [0, 1],
      [colors.lavenderMist, colors.lavenderTint],
    ),
    borderColor: interpolateColor(
      highlight.value,
      [0, 1],
      [colors.divider, colors.primary],
    ),
    shadowOpacity: highlight.value * 0.18,
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }],
  }));
  const countStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: countTranslateY.value }],
    opacity: countOpacity.value,
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={meta.accessibilityLabel}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={() => onPress(reactionType)}
    >
      <Animated.View
        style={[styles.chip, selected && styles.chipSelected, containerStyle]}
      >
        {reactionType === 'dream' ? (
          <DreamStars progress={starProgress} />
        ) : null}
        <Animated.View style={[styles.icon, iconStyle]}>
          <ReactionIcon reactionType={reactionType} selected={selected} />
        </Animated.View>
        <Animated.Text
          style={[styles.count, selected && styles.countSelected, countStyle]}
        >
          {count}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

function HeartIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="reactionHeartFill" x1="17" y1="12" x2="49" y2="54">
          <Stop offset="0" stopColor="#FFE4EC" />
          <Stop offset="1" stopColor="#FFD1DD" />
        </LinearGradient>
      </Defs>
      <Path
        d="M31.9 52.4C30.9 51.5 16.5 38.9 13.2 28.6C10.8 21.3 14.4 14.7 21.2 13.5C25.5 12.7 29.5 14.7 31.9 18.3C34.4 14.7 38.6 12.7 42.9 13.6C49.4 14.9 53.1 21.5 50.6 28.7C47.1 39 33 51.5 31.9 52.4Z"
        fill="url(#reactionHeartFill)"
        stroke="#E98DA8"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M20.2 19.8C22.9 17.7 26.1 18 28.4 20.5"
        stroke="#FFF7FA"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.9}
      />
      <Path
        d="M31.9 52.4C30.9 51.5 16.5 38.9 13.2 28.6"
        stroke={stroke}
        strokeWidth={1.2}
        strokeLinecap="round"
        opacity={0.28}
      />
    </Svg>
  );
}

function SmileSparkleIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="reactionSmileFill" x1="17" y1="15" x2="45" y2="50">
          <Stop offset="0" stopColor="#FFF7D6" />
          <Stop offset="1" stopColor="#FFF1B8" />
        </LinearGradient>
      </Defs>
      <Circle
        cx={32}
        cy={33}
        r={18}
        fill="url(#reactionSmileFill)"
        stroke={stroke}
        strokeWidth={4}
      />
      <Path
        d="M23.5 31.2C25.1 27.9 29.1 27.9 30.7 31.2"
        stroke={stroke}
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      <Path
        d="M35.2 31.2C36.8 27.9 40.8 27.9 42.4 31.2"
        stroke={stroke}
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      <Path
        d="M24.5 39C28.3 44.2 36.2 44.2 40.1 39"
        stroke={stroke}
        strokeWidth={3.4}
        strokeLinecap="round"
      />
      <Path
        d="M15.5 18.5L17.6 23.1L22.2 25.2L17.6 27.3L15.5 31.9L13.4 27.3L8.8 25.2L13.4 23.1L15.5 18.5Z"
        fill="#FFD36B"
        stroke="#F0B94E"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Path
        d="M48.8 39L50.5 42.6L54.1 44.3L50.5 46L48.8 49.6L47.1 46L43.5 44.3L47.1 42.6L48.8 39Z"
        fill="#FFD36B"
        stroke="#F0B94E"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TearIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="reactionDropFill" x1="22" y1="11" x2="42" y2="54">
          <Stop offset="0" stopColor="#F3EDFF" />
          <Stop offset="1" stopColor="#EDE7FF" />
        </LinearGradient>
        <LinearGradient id="reactionTearFill" x1="44" y1="35" x2="52" y2="51">
          <Stop offset="0" stopColor="#CFEAFF" />
          <Stop offset="1" stopColor="#8FCBF4" />
        </LinearGradient>
      </Defs>
      <Path
        d="M32 9.5C32 9.5 18.3 25.2 18.3 37.1C18.3 46 24.3 52.4 32 52.4C39.7 52.4 45.7 46 45.7 37.1C45.7 25.2 32 9.5 32 9.5Z"
        fill="url(#reactionDropFill)"
        stroke={stroke}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <Circle cx={26.4} cy={34.1} r={2.4} fill={stroke} />
      <Circle cx={37.3} cy={34.1} r={2.4} fill={stroke} />
      <Path
        d="M26.2 43.2C29.5 39.8 34.3 39.8 37.7 43.2"
        stroke={stroke}
        strokeWidth={3}
        strokeLinecap="round"
      />
      <Path
        d="M47.9 36.3C47.9 36.3 41.7 43.7 41.7 48.1C41.7 52 44.3 54.7 47.9 54.7C51.5 54.7 54.1 52 54.1 48.1C54.1 43.7 47.9 36.3 47.9 36.3Z"
        fill="url(#reactionTearFill)"
        stroke="#76BCEB"
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SurpriseStarIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="reactionStarFill" x1="17" y1="15" x2="47" y2="50">
          <Stop offset="0" stopColor="#F7F0FF" />
          <Stop offset="1" stopColor="#EEE5FF" />
        </LinearGradient>
      </Defs>
      <Path
        d="M32 10.5L37.4 22.3L50.2 19.5L44.8 31.4L55 39.6L42.1 42.3L42.2 55.4L32 47.2L21.8 55.4L21.9 42.3L9 39.6L19.2 31.4L13.8 19.5L26.6 22.3L32 10.5Z"
        fill="url(#reactionStarFill)"
        stroke={stroke}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <Circle cx={26.2} cy={32.6} r={2.3} fill={stroke} />
      <Circle cx={37.8} cy={32.6} r={2.3} fill={stroke} />
      <Ellipse
        cx={32}
        cy={40.5}
        rx={3.4}
        ry={4.2}
        fill="#F8F0FF"
        stroke={stroke}
        strokeWidth={2.8}
      />
      <Path d="M15.3 13.5L12.7 9.8" stroke="#FFD36B" strokeWidth={3} strokeLinecap="round" />
      <Path d="M50.2 13.1L53.3 9.8" stroke="#FFD36B" strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

function MoonIcon({ stroke }: { stroke: string }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="reactionMoonFill" x1="18" y1="12" x2="42" y2="51">
          <Stop offset="0" stopColor="#FFEFA6" />
          <Stop offset="1" stopColor="#FFD66B" />
        </LinearGradient>
      </Defs>
      <Path
        d="M43.7 13.4C34.4 15.2 27.4 23.3 27.4 33.2C27.4 43.1 34.4 51.3 43.7 53C40.4 55 36.5 56.2 32.3 56.2C20.1 56.2 10.2 46.3 10.2 34.1C10.2 21.9 20.1 12 32.3 12C36.5 12 40.4 13.2 43.7 13.4Z"
        fill="url(#reactionMoonFill)"
        stroke={stroke}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <Path
        d="M23.2 41.5C26.2 44.4 31.2 44.4 34.2 41.5"
        stroke={stroke}
        strokeWidth={2.8}
        strokeLinecap="round"
        opacity={0.65}
      />
      <Path
        d="M49 16.2L51.6 21.8L57.2 24.4L51.6 27L49 32.6L46.4 27L40.8 24.4L46.4 21.8L49 16.2Z"
        fill="#F3ECFF"
        stroke={stroke}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <Circle cx={47.2} cy={39.7} r={1.9} fill="#BFA9EA" opacity={0.7} />
      <Circle cx={55.4} cy={37.2} r={1.4} fill="#FFD36B" opacity={0.85} />
    </Svg>
  );
}

function ReactionIcon({
  reactionType,
  selected,
}: {
  reactionType: DreamReactionType;
  selected: boolean;
}) {
  const stroke = selected ? colors.primaryDark : colors.primary;
  switch (reactionType) {
    case 'heart':
      return <HeartIcon stroke={stroke} />;
    case 'laugh':
      return <SmileSparkleIcon stroke={stroke} />;
    case 'tear':
      return <TearIcon stroke={stroke} />;
    case 'surprise':
      return <SurpriseStarIcon stroke={stroke} />;
    case 'dream':
      return <MoonIcon stroke={stroke} />;
  }
}

function DreamStars({
  progress,
}: {
  progress: ReturnType<typeof useSharedValue<number>>;
}) {
  const starOne = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.25, 1], [0, 1, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [2, -14]) },
      { scale: interpolate(progress.value, [0, 0.4, 1], [0.4, 1, 0.6]) },
    ],
  }));
  const starTwo = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.4, 1], [0, 1, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [4, -10]) },
      { scale: interpolate(progress.value, [0, 0.5, 1], [0.3, 0.9, 0.5]) },
    ],
  }));
  const starThree = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3, 0.9], [0, 1, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [2, -12]) },
      { scale: interpolate(progress.value, [0, 0.45, 1], [0.3, 0.8, 0.5]) },
    ],
  }));

  return (
    <View pointerEvents="none" style={styles.stars}>
      <Animated.Text style={[styles.star, styles.starLeft, starOne]}>✦</Animated.Text>
      <Animated.Text style={[styles.star, styles.starMid, starTwo]}>✦</Animated.Text>
      <Animated.Text style={[styles.star, styles.starRight, starThree]}>✦</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 13,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: colors.lavenderMist,
    borderColor: colors.divider,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    shadowOpacity: 0,
  },
  chipSelected: {
    elevation: 2,
  },
  icon: {
    width: 22,
    height: 22,
  },
  count: {
    minWidth: 12,
    textAlign: 'center',
    color: colors.textMuted,
    ...handwritingFont('700'),
    fontSize: 13,
    includeFontPadding: false,
  },
  countSelected: {
    color: colors.primaryDark,
  },
  stars: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    height: 16,
    alignItems: 'center',
  },
  star: {
    position: 'absolute',
    color: colors.starAccent,
    fontSize: 11,
    includeFontPadding: false,
  },
  starLeft: {
    left: 8,
  },
  starMid: {
    alignSelf: 'center',
  },
  starRight: {
    right: 8,
  },
  toastWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    maxWidth: 280,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: 'rgba(31, 30, 27, 0.86)',
  },
  toastText: {
    color: '#FFFFFF',
    ...handwritingFont('700'),
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
