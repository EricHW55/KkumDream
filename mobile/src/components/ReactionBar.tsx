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
  { emoji: string; selectedEmoji?: string; accessibilityLabel: string }
> = {
  heart: { emoji: '♡', selectedEmoji: '❤️', accessibilityLabel: '좋아요 반응' },
  laugh: { emoji: '😂', accessibilityLabel: '웃겨요 반응' },
  tear: { emoji: '🥲', accessibilityLabel: '감동 또는 슬픔 반응' },
  surprise: { emoji: '😮', accessibilityLabel: '놀람 반응' },
  dream: { emoji: '🌙', accessibilityLabel: '꿈같아요 반응' },
};

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
  onToggle: (reactionType: DreamReactionType) => Promise<DreamReactionToggleResult>;
};

export function ReactionBar({ summary, disabled = false, onToggle }: ReactionBarProps) {
  const [state, setStateRaw] = useState<ReactionState>(() => toState(summary));
  const stateRef = useRef(state);
  const committedRef = useRef(state);
  const versionRef = useRef(0);
  const inFlightRef = useRef(0);
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

  const handlePress = useCallback(
    (reactionType: DreamReactionType) => {
      if (disabled) {
        return;
      }
      const next = applyTap(stateRef.current, reactionType);
      setState(next);

      const version = ++versionRef.current;
      inFlightRef.current += 1;
      onToggle(reactionType)
        .then(result => {
          // Only the most recent tap may settle the state; stale responses
          // arriving out of order must not clobber a newer optimistic value.
          if (versionRef.current === version) {
            const serverState = toState(result.summary);
            committedRef.current = serverState;
            setState(serverState);
          }
        })
        .catch(() => {
          if (versionRef.current === version) {
            setState(committedRef.current);
            showToast('반응을 저장하지 못했어요. 다시 시도해주세요.');
          }
        })
        .finally(() => {
          inFlightRef.current = Math.max(0, inFlightRef.current - 1);
        });
    },
    [disabled, onToggle, setState, showToast],
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
  const emojiStyle = useAnimatedStyle(() => ({
    transform: [{ scale: emojiScale.value }],
  }));
  const countStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: countTranslateY.value }],
    opacity: countOpacity.value,
  }));

  const emoji =
    selected && meta.selectedEmoji ? meta.selectedEmoji : meta.emoji;

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
        <Animated.Text style={[styles.emoji, emojiStyle]}>{emoji}</Animated.Text>
        <Animated.Text
          style={[styles.count, selected && styles.countSelected, countStyle]}
        >
          {count}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
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
  emoji: {
    fontSize: 17,
    lineHeight: 22,
    includeFontPadding: false,
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
