import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  InteractionManager,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type ViewToken,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  X,
} from 'lucide-react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { readCache, writeCache } from '../data/cache';
import {
  applyDreamPreviewToCaches,
  type DreamFrontPreviewFields,
} from '../data/dreamRepository';
import type { RootStackParamList } from '../navigation/types';
import { useSessionStore } from '../store/sessionStore';
import { useSettingsStore } from '../store/settingsStore';
import { colors } from '../theme/colors';
import { CARD_COLOR_THEMES, normalizeDreamDesign } from '../theme/dreamDesigns';
import { interactionStyles } from '../theme/interactions';
import { fontFamily } from '../theme/typography';
import type { Dream } from '../types/dream';
import { DreamCard } from './DreamCard';
import { DREAM_CARD_ASPECT_RATIO } from './DreamCardFrame';
import {
  DreamArchivePreview,
  DreamFrontPreviewGenerator,
  needsFrontPreview,
} from './DreamFrontPreview';
import { HaloShadow } from './HaloShadow';

type LibraryMode = 'archive' | 'calendar';
type Navigation = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  title: string;
  description: string;
  calendarLabel: string;
  emptyMessage: string;
  dreams: Dream[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  viewModeCacheKey?: string;
  // When true, eagerly generate previews for the most-recent cards before they
  // are scrolled into view (used by the giver's outbox so receivers/rooms see a
  // ready preview without anyone having to browse to it first).
  eagerPreviewGeneration?: boolean;
};

type DateGroup = {
  dateKey: string;
  label: string;
  items: Dream[];
};

type CalendarCell = {
  dateKey: string;
  day: number;
} | null;

const monthNumbers = Array.from({ length: 12 }, (_, index) => index + 1);

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
const EMPTY_DREAMS: Dream[] = [];
const INITIAL_ARCHIVE_RENDER_COUNT = 12;
const ARCHIVE_RENDER_BATCH_SIZE = 6;
const ARCHIVE_RENDER_BATCH_DELAY_MS = 90;
const THUMBNAIL_PREFETCH_LIMIT = 8;
// How many of the most-recent cards may be generated eagerly (before they are
// scrolled into view) when eager generation is enabled, e.g. the giver's
// outbox. Kept small so we never bulk-generate the whole history.
const EAGER_PREVIEW_LIMIT = 8;
const DEFAULT_LIBRARY_MODE: LibraryMode = 'archive';

export function DreamLibraryView({
  title,
  description,
  calendarLabel,
  emptyMessage,
  dreams,
  isLoading = false,
  isRefreshing = false,
  viewModeCacheKey,
  eagerPreviewGeneration = false,
}: Props) {
  const navigation = useNavigation<Navigation>();
  const isFocused = useIsFocused();
  const { width, height: windowHeight } = useWindowDimensions();
  const [mode, setMode] = useState<LibraryMode>(() =>
    readLibraryMode(viewModeCacheKey),
  );
  const [selectedDream, setSelectedDream] = useState<Dream | null>(null);
  const previewTranslateY = useSharedValue(0);
  const previewCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: previewTranslateY.value }],
  }));

  const navigateToDetail = useCallback(
    (dream: Dream) => {
      setSelectedDream(null);
      navigation.navigate('DreamDetail', { dream });
    },
    [navigation],
  );

  // Slide the card up off-screen, then hand off to the detail screen.
  const openDetail = useCallback(
    (dream: Dream) => {
      previewTranslateY.value = withTiming(
        -windowHeight,
        { duration: 240, easing: Easing.in(Easing.cubic) },
        finished => {
          if (finished) {
            runOnJS(navigateToDetail)(dream);
          }
        },
      );
    },
    [navigateToDetail, previewTranslateY, windowHeight],
  );

  // Slide the card down off-screen, then dismiss the preview.
  const dismissPreview = useCallback(() => {
    previewTranslateY.value = withTiming(
      windowHeight,
      { duration: 220, easing: Easing.in(Easing.cubic) },
      finished => {
        if (finished) {
          runOnJS(setSelectedDream)(null);
        }
      },
    );
  }, [previewTranslateY, windowHeight]);
  const [selectedDateKeys, setSelectedDateKeys] = useState<string[]>([]);
  const [selectedCalendarMonthKey, setSelectedCalendarMonthKey] = useState<
    string | null
  >(null);
  const [isMonthPickerVisible, setIsMonthPickerVisible] = useState(false);
  const [monthPickerYear, setMonthPickerYear] = useState(() =>
    Number(getCurrentMonthKey().slice(0, 4)),
  );
  const [multiDreamDateGroup, setMultiDreamDateGroup] =
    useState<DateGroup | null>(null);
  const [visibleArchiveCount, setVisibleArchiveCount] = useState(
    INITIAL_ARCHIVE_RENDER_COUNT,
  );
  // The card currently being flattened into a preview (rendered off-screen). We
  // generate one at a time so capture/upload work never competes with scrolling.
  const [generatingDream, setGeneratingDream] = useState<Dream | null>(null);
  // Previews produced this session, mirrored over the fetched dreams so the grid
  // swaps from placeholder to flattened image immediately (also persisted to the
  // local cache so it survives restarts).
  const [previewOverrides, setPreviewOverrides] = useState<
    Record<string, DreamFrontPreviewFields>
  >({});
  const token = useSessionStore(state => state.token);
  const userId = useSessionStore(state => state.userId);
  const generatingIdRef = useRef<string | null>(null);
  const isArchiveScrollingRef = useRef(false);
  const viewableArchiveIdsRef = useRef<string[]>([]);
  const attemptedPreviewIdsRef = useRef<Set<string>>(new Set());
  const archiveDreamMapRef = useRef<Map<string, Dream>>(new Map());
  const eagerCandidateIdsRef = useRef<string[]>([]);
  const tickGenerationRef = useRef<() => void>(() => undefined);
  const previewPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 80) {
            dismissPreview();
          }
        },
      }),
    [dismissPreview],
  );
  const calendarDreams = mode === 'calendar' ? dreams : EMPTY_DREAMS;
  const archiveDreams = useMemo(
    () => dreams.slice(0, Math.min(visibleArchiveCount, dreams.length)),
    [dreams, visibleArchiveCount],
  );
  const groupedDreams = useMemo(
    () => groupDreamsByDate(calendarDreams, calendarLabel),
    [calendarDreams, calendarLabel],
  );
  const groupedDreamMap = useMemo(
    () => new Map(groupedDreams.map(group => [group.dateKey, group])),
    [groupedDreams],
  );
  const availableMonthKeys = useMemo(
    () => getCalendarMonthKeys(groupedDreams),
    [groupedDreams],
  );
  const availableMonthKeySet = useMemo(
    () => new Set(availableMonthKeys),
    [availableMonthKeys],
  );
  const visibleCalendarMonthKey =
    selectedCalendarMonthKey ?? availableMonthKeys[0] ?? getCurrentMonthKey();
  const visibleCalendarMonth = useMemo(
    () => buildCalendarMonth(visibleCalendarMonthKey),
    [visibleCalendarMonthKey],
  );
  const calendarMonths = [visibleCalendarMonth];
  const selectedMonthNumber = Number(visibleCalendarMonthKey.slice(5, 7));
  const archiveColumnGap = 10;
  const archiveColumns = useSettingsStore(state => state.archiveColumns);
  const archiveCardWidth = Math.floor(
    (width - 40 - archiveColumnGap * (archiveColumns - 1)) / archiveColumns,
  );
  // Cells are sized to the card footprint (the preview's shadow halo bleeds into
  // the gaps), matching the previous live-card grid.
  const archiveCardHeight = Math.round(archiveCardWidth / DREAM_CARD_ASPECT_RATIO);
  const archiveRowHeight = archiveCardHeight + 12;
  const calendarCellSize = Math.max(
    40,
    Math.min(62, Math.floor((width - 72) / 7)),
  );
  const dayPreviewSize = Math.max(40, Math.min(56, calendarCellSize - 4));

  // Mirror previews generated this session over the fetched cards so an item
  // swaps from placeholder to flattened image as soon as it is ready.
  const decoratedArchiveDreams = useMemo(
    () =>
      archiveDreams.map(dream => {
        const override = previewOverrides[dream.id];
        return override ? { ...dream, ...override } : dream;
      }),
    [archiveDreams, previewOverrides],
  );

  useEffect(() => {
    archiveDreamMapRef.current = new Map(
      decoratedArchiveDreams.map(dream => [dream.id, dream]),
    );
    eagerCandidateIdsRef.current = decoratedArchiveDreams
      .slice(0, EAGER_PREVIEW_LIMIT)
      .map(dream => dream.id);
  }, [decoratedArchiveDreams]);

  // Single-flight preview generation: pick the first card that is missing a
  // current preview and hasn't been attempted, preferring on-screen cards and
  // (when eager generation is on) the most-recent cards. Never starts while the
  // list is actively scrolling.
  const tickGeneration = useCallback(() => {
    if (!token || mode !== 'archive') {
      return;
    }
    if (generatingIdRef.current || isArchiveScrollingRef.current) {
      return;
    }
    const map = archiveDreamMapRef.current;
    const orderedIds = eagerPreviewGeneration
      ? [...viewableArchiveIdsRef.current, ...eagerCandidateIdsRef.current]
      : viewableArchiveIdsRef.current;
    let next: Dream | undefined;
    for (const id of orderedIds) {
      const dream = map.get(id);
      if (
        dream &&
        needsFrontPreview(dream) &&
        !attemptedPreviewIdsRef.current.has(dream.id)
      ) {
        next = dream;
        break;
      }
    }
    if (next) {
      generatingIdRef.current = next.id;
      setGeneratingDream(next);
    }
  }, [eagerPreviewGeneration, mode, token]);

  useEffect(() => {
    tickGenerationRef.current = tickGeneration;
  }, [tickGeneration]);

  const handlePreviewGenerated = useCallback(
    (updated: Dream) => {
      attemptedPreviewIdsRef.current.add(updated.id);
      const fields: DreamFrontPreviewFields = {
        frontPreviewUrl: updated.frontPreviewUrl ?? null,
        frontPreviewVersion: updated.frontPreviewVersion ?? null,
        frontPreviewHash: updated.frontPreviewHash ?? null,
      };
      setPreviewOverrides(current => ({ ...current, [updated.id]: fields }));
      applyDreamPreviewToCaches(updated.id, fields, userId);
      generatingIdRef.current = null;
      setGeneratingDream(null);
      requestAnimationFrame(() => tickGenerationRef.current());
    },
    [userId],
  );

  const handlePreviewError = useCallback((dreamId: string) => {
    attemptedPreviewIdsRef.current.add(dreamId);
    generatingIdRef.current = null;
    setGeneratingDream(null);
    requestAnimationFrame(() => tickGenerationRef.current());
  }, []);

  const onArchiveViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      viewableArchiveIdsRef.current = viewableItems
        .map(item => (item.item as Dream | undefined)?.id)
        .filter((id): id is string => Boolean(id));
      if (!isArchiveScrollingRef.current) {
        tickGenerationRef.current();
      }
    },
  ).current;

  const archiveViewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 120,
  }).current;

  const handleArchiveScrollBegin = useCallback(() => {
    isArchiveScrollingRef.current = true;
  }, []);

  const handleArchiveScrollEnd = useCallback(() => {
    isArchiveScrollingRef.current = false;
    tickGenerationRef.current();
  }, []);

  // Single entry point so the card always starts off-screen below before
  // sliding up into view, regardless of where the preview was opened from.
  const handleSelectDream = useCallback(
    (dream: Dream) => {
      previewTranslateY.value = windowHeight;
      setSelectedDream(dream);
    },
    [previewTranslateY, windowHeight],
  );

  useEffect(() => {
    if (!selectedDream) {
      return;
    }
    previewTranslateY.value = withTiming(0, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    });
  }, [previewTranslateY, selectedDream]);

  const openMonthPicker = () => {
    setMonthPickerYear(Number(visibleCalendarMonthKey.slice(0, 4)));
    setIsMonthPickerVisible(true);
  };

  const selectCalendarMonth = (month: number) => {
    setSelectedCalendarMonthKey(
      `${monthPickerYear}-${String(month).padStart(2, '0')}`,
    );
    setSelectedDateKeys([]);
    setIsMonthPickerVisible(false);
  };

  const updateMode = (nextMode: LibraryMode) => {
    setMode(nextMode);
    if (viewModeCacheKey) {
      writeCache(viewModeCacheKey, nextMode);
    }
  };

  useEffect(() => {
    setMode(readLibraryMode(viewModeCacheKey));
  }, [viewModeCacheKey]);

  useEffect(() => {
    if (mode !== 'calendar') {
      setSelectedDateKeys([]);
      return;
    }

    setSelectedDateKeys(
      groupedDreams
        .filter(group => group.dateKey.startsWith(`${visibleCalendarMonthKey}-`))
        .map(group => group.dateKey),
    );
  }, [groupedDreams, mode, visibleCalendarMonthKey]);

  useEffect(() => {
    if (dreams.length <= INITIAL_ARCHIVE_RENDER_COUNT) {
      setVisibleArchiveCount(INITIAL_ARCHIVE_RENDER_COUNT);
      return undefined;
    }

    let timeout: ReturnType<typeof setTimeout> | undefined;
    let isCancelled = false;
    setVisibleArchiveCount(INITIAL_ARCHIVE_RENDER_COUNT);

    const revealNextBatch = () => {
      if (isCancelled) {
        return;
      }

      setVisibleArchiveCount(currentCount => {
        const nextCount = Math.min(
          currentCount + ARCHIVE_RENDER_BATCH_SIZE,
          dreams.length,
        );
        if (nextCount < dreams.length) {
          timeout = setTimeout(
            revealNextBatch,
            ARCHIVE_RENDER_BATCH_DELAY_MS,
          );
        }
        return nextCount;
      });
    };

    timeout = setTimeout(revealNextBatch, ARCHIVE_RENDER_BATCH_DELAY_MS);

    return () => {
      isCancelled = true;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [dreams]);

  useEffect(() => {
    // A new dream list invalidates the in-flight generation and prunes overrides
    // for cards that are no longer present.
    const dreamIds = new Set(dreams.map(dream => dream.id));
    viewableArchiveIdsRef.current = [];
    generatingIdRef.current = null;
    setGeneratingDream(null);
    setPreviewOverrides(current => {
      const next: Record<string, DreamFrontPreviewFields> = {};
      Object.keys(current).forEach(id => {
        if (dreamIds.has(id)) {
          next[id] = current[id];
        }
      });
      return next;
    });
  }, [dreams]);

  useEffect(() => {
    if (!isFocused) {
      isArchiveScrollingRef.current = false;
      return;
    }
    // Re-enable previews that failed earlier this session and resume the queue.
    attemptedPreviewIdsRef.current.clear();
    requestAnimationFrame(() => tickGenerationRef.current());
  }, [isFocused]);

  useEffect(() => {
    const thumbnailUrls = Array.from(
      new Set(
        dreams
          .map(dream => dream.thumbnailUrl)
          .filter((url): url is string => Boolean(url)),
      ),
    ).slice(0, THUMBNAIL_PREFETCH_LIMIT);

    if (thumbnailUrls.length === 0) {
      return undefined;
    }

    let isCancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      thumbnailUrls.reduce<Promise<void>>(
        (chain, url) =>
          chain.then(async () => {
            if (isCancelled) {
              return;
            }
            try {
              await Image.prefetch(url);
            } catch {
              // Prefetch is only an optimization; normal image rendering can retry.
            }
          }),
        Promise.resolve(),
      );
    });

    return () => {
      isCancelled = true;
      task.cancel?.();
    };
  }, [dreams]);

  const onPressCalendarDate = (dateKey: string) => {
    const group = groupedDreamMap.get(dateKey);
    if (!group) {
      return;
    }

    if (!selectedDateKeys.includes(dateKey)) {
      setSelectedDateKeys(currentKeys =>
        currentKeys.includes(dateKey) ? currentKeys : [...currentKeys, dateKey],
      );
      return;
    }

    setSelectedDateKeys(currentKeys =>
      currentKeys.filter(key => key !== dateKey),
    );

    if (group.items.length === 1) {
      handleSelectDream(group.items[0]);
      return;
    }

    setMultiDreamDateGroup(group);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      <View style={styles.segmented}>
        <Pressable
          accessibilityRole="button"
          onPress={() => updateMode('archive')}
          style={({ pressed }) => [
            styles.segment,
            mode === 'archive' && styles.segmentActive,
            pressed && interactionStyles.pressed,
          ]}
        >
          <Grid2X2
            color={mode === 'archive' ? colors.textPrimary : colors.textMuted}
            size={18}
          />
          <Text
            style={[
              styles.segmentLabel,
              mode === 'archive' && styles.segmentLabelActive,
            ]}
          >
            카드보기
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => updateMode('calendar')}
          style={({ pressed }) => [
            styles.segment,
            mode === 'calendar' && styles.segmentActive,
            pressed && interactionStyles.pressed,
          ]}
        >
          <CalendarDays
            color={mode === 'calendar' ? colors.textPrimary : colors.textMuted}
            size={18}
          />
          <Text
            style={[
              styles.segmentLabel,
              mode === 'calendar' && styles.segmentLabelActive,
            ]}
          >
            캘린더
          </Text>
        </Pressable>
      </View>

      {mode === 'archive' && isLoading ? (
        <DreamLibraryLoadingState cardWidth={archiveCardWidth} />
      ) : mode === 'archive' ? (
        <FlatList
          key={`archive-grid-${archiveColumns}`}
          data={decoratedArchiveDreams}
          getItemLayout={(_, index) => ({
            length: archiveRowHeight,
            offset: archiveRowHeight * Math.floor(index / archiveColumns),
            index,
          })}
          initialNumToRender={12}
          keyExtractor={item => item.id}
          maxToRenderPerBatch={8}
          numColumns={archiveColumns}
          onViewableItemsChanged={onArchiveViewableItemsChanged}
          viewabilityConfig={archiveViewabilityConfig}
          onScrollBeginDrag={handleArchiveScrollBegin}
          onMomentumScrollBegin={handleArchiveScrollBegin}
          onScrollEndDrag={handleArchiveScrollEnd}
          onMomentumScrollEnd={handleArchiveScrollEnd}
          refreshing={isRefreshing && dreams.length === 0}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          updateCellsBatchingPeriod={60}
          windowSize={5}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[
            styles.archiveGrid,
            dreams.length === 0 && styles.emptyArchiveGrid,
          ]}
          ListEmptyComponent={<EmptyDreamState message={emptyMessage} />}
          ListFooterComponent={
            dreams.length > decoratedArchiveDreams.length ? (
              <Text style={styles.archiveLoadingMoreText}>
                꿈카드를 더 불러오는 중이에요.
              </Text>
            ) : null
          }
          renderItem={({ item, index }) => (
            <DreamArchivePreview
              dream={item}
              index={index}
              width={archiveCardWidth}
              onPress={handleSelectDream}
            />
          )}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.calendarList}
        >
          {calendarMonths.map(month => (
            <View key={month.monthKey} style={styles.calendarMonth}>
              <Pressable
                accessibilityLabel="달력 월 선택"
                accessibilityRole="button"
                hitSlop={8}
                onPress={openMonthPicker}
                style={({ pressed }) => [
                  styles.monthTitleButton,
                  pressed && interactionStyles.pressed,
                ]}
              >
                <Text style={styles.monthTitle}>{month.label}</Text>
              </Pressable>
              <View style={styles.weekdayRow}>
                {weekdays.map(day => (
                  <Text key={day} style={styles.weekdayText}>
                    {day}
                  </Text>
                ))}
              </View>
              <View style={styles.monthGrid}>
                {month.cells.map((cell, index) => {
                  if (!cell) {
                    return (
                      <View
                        key={`blank-${index}`}
                        style={[styles.dayCell, { height: calendarCellSize }]}
                      />
                    );
                  }

                  const group = groupedDreamMap.get(cell.dateKey);
                  const isSelected = selectedDateKeys.includes(cell.dateKey);
                  const firstDream = group?.items[0];
                  const previewImageUrl = firstDream?.thumbnailUrl;
                  const previewDesign = normalizeDreamDesign(
                    firstDream?.design,
                  );
                  const previewTheme =
                    CARD_COLOR_THEMES[previewDesign.cardColor];
                  return (
                    <Pressable
                      key={cell.dateKey}
                      accessibilityRole="button"
                      disabled={!group}
                      onPress={() => onPressCalendarDate(cell.dateKey)}
                      style={({ pressed }) => [
                        styles.dayCell,
                        { height: calendarCellSize },
                        group && styles.dayCellWithDream,
                        isSelected && styles.dayCellSelected,
                        pressed && group && interactionStyles.pressed,
                      ]}
                    >
                      {group && isSelected ? (
                        <View
                          style={[
                            styles.dayPreview,
                            {
                              width: dayPreviewSize,
                              height: dayPreviewSize,
                              borderRadius: dayPreviewSize / 2,
                            },
                          ]}
                        >
                          <HaloShadow
                            ambientBlur={5}
                            ambientOpacity={0.11}
                            borderRadius={dayPreviewSize / 2}
                            color={colors.textPrimary}
                            contactBlur={1.4}
                            contactOpacity={0.07}
                            inset={8}
                          />
                          {previewImageUrl ? (
                            <Image
                              source={{ uri: previewImageUrl }}
                              style={styles.dayPreviewImage}
                            />
                          ) : (
                            <View
                              style={[
                                styles.dayPreviewFallback,
                                { backgroundColor: previewTheme.placeholder },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.dayPreviewMood,
                                  { color: previewTheme.accent },
                                ]}
                              >
                                {firstDream && isImagePending(firstDream)
                                  ? '생성중'
                                  : firstDream?.mainMood.slice(0, 2)}
                              </Text>
                            </View>
                          )}
                          <View style={styles.dayPreviewOverlay}>
                            <Text style={styles.dayPreviewDay}>{cell.day}</Text>
                            {group.items.length > 1 ? (
                              <Text style={styles.dayPreviewCount}>
                                {group.items.length}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ) : (
                        <View
                          style={[
                            styles.dayNumberFrame,
                            {
                              width: dayPreviewSize,
                              height: dayPreviewSize,
                              borderRadius: dayPreviewSize / 2,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dayText,
                              group && styles.dayTextWithDream,
                            ]}
                          >
                            {cell.day}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {dreams.length === 0 ? (
            <View style={styles.calendarHintBox}>
              <Text style={styles.calendarHintText}>{emptyMessage}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      <Modal
        animationType="fade"
        transparent
        visible={isMonthPickerVisible}
        onRequestClose={() => setIsMonthPickerVisible(false)}
      >
        <Pressable
          style={styles.pickerBackdrop}
          onPress={() => setIsMonthPickerVisible(false)}
        >
          <Pressable
            style={styles.monthPickerSheet}
            onPress={event => event.stopPropagation()}
          >
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>달력 날짜 선택</Text>
              <Pressable
                accessibilityLabel="닫기"
                accessibilityRole="button"
                onPress={() => setIsMonthPickerVisible(false)}
                style={({ pressed }) => [
                  styles.pickerClose,
                  pressed && interactionStyles.pressed,
                ]}
              >
                <X color={colors.textSecondary} size={18} />
              </Pressable>
            </View>
            <View style={styles.monthPickerYearRow}>
              <Pressable
                accessibilityLabel="이전 연도"
                accessibilityRole="button"
                onPress={() => setMonthPickerYear(year => year - 1)}
                style={({ pressed }) => [
                  styles.monthPickerYearButton,
                  pressed && interactionStyles.pressed,
                ]}
              >
                <ChevronLeft color={colors.textPrimary} size={18} />
              </Pressable>
              <Text style={styles.monthPickerYearText}>{monthPickerYear}년</Text>
              <Pressable
                accessibilityLabel="다음 연도"
                accessibilityRole="button"
                onPress={() => setMonthPickerYear(year => year + 1)}
                style={({ pressed }) => [
                  styles.monthPickerYearButton,
                  pressed && interactionStyles.pressed,
                ]}
              >
                <ChevronRight color={colors.textPrimary} size={18} />
              </Pressable>
            </View>
            <View style={styles.monthPickerGrid}>
              {monthNumbers.map(month => {
                const monthKey = `${monthPickerYear}-${String(month).padStart(
                  2,
                  '0',
                )}`;
                const isSelected =
                  monthPickerYear ===
                    Number(visibleCalendarMonthKey.slice(0, 4)) &&
                  month === selectedMonthNumber;
                const hasDreams = availableMonthKeySet.has(monthKey);
                return (
                  <Pressable
                    key={month}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => selectCalendarMonth(month)}
                    style={({ pressed }) => [
                      styles.monthPickerOption,
                      isSelected && styles.monthPickerOptionSelected,
                      pressed && interactionStyles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.monthPickerOptionText,
                        isSelected && styles.monthPickerOptionTextSelected,
                      ]}
                    >
                      {month}월
                    </Text>
                    {hasDreams ? <View style={styles.monthPickerDot} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={multiDreamDateGroup !== null}
        onRequestClose={() => setMultiDreamDateGroup(null)}
      >
        <Pressable
          style={styles.pickerBackdrop}
          onPress={() => setMultiDreamDateGroup(null)}
        >
          {multiDreamDateGroup ? (
            <Pressable
              style={styles.pickerSheet}
              onPress={event => event.stopPropagation()}
            >
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>
                  {multiDreamDateGroup.label}
                </Text>
                <Pressable
                  accessibilityLabel="닫기"
                  accessibilityRole="button"
                  onPress={() => setMultiDreamDateGroup(null)}
                  style={({ pressed }) => [
                    styles.pickerClose,
                    pressed && interactionStyles.pressed,
                  ]}
                >
                  <X color={colors.textSecondary} size={18} />
                </Pressable>
              </View>
              <View style={styles.pickerGrid}>
                {multiDreamDateGroup.items.map(dream => {
                  const imageUrl = dream.thumbnailUrl;
                  const design = normalizeDreamDesign(dream.design);
                  const designTheme = CARD_COLOR_THEMES[design.cardColor];
                  return (
                    <Pressable
                      key={dream.id}
                      accessibilityRole="button"
                      onPress={() => {
                        setMultiDreamDateGroup(null);
                        handleSelectDream(dream);
                      }}
                      style={({ pressed }) => [
                        styles.pickerThumbButton,
                        pressed && interactionStyles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.pickerThumbRing,
                          { borderColor: designTheme.accent },
                        ]}
                      >
                        {imageUrl ? (
                          <Image
                            source={{ uri: imageUrl }}
                            style={styles.pickerThumbImage}
                          />
                        ) : (
                          <View
                            style={[
                              styles.pickerThumbFallback,
                              { backgroundColor: designTheme.placeholder },
                            ]}
                          >
                            <Text
                              style={[
                                styles.pickerThumbMood,
                                { color: designTheme.accent },
                              ]}
                            >
                              {isImagePending(dream)
                                ? '생성중'
                                : dream.mainMood.slice(0, 2)}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.pickerThumbLabel} numberOfLines={1}>
                        {dream.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={selectedDream !== null}
        onRequestClose={dismissPreview}
      >
        <Pressable style={styles.previewBackdrop} onPress={dismissPreview}>
          {selectedDream ? (
            <Animated.View
              style={[styles.previewCard, previewCardStyle]}
              {...previewPanResponder.panHandlers}
            >
              <DreamCard
                disableFlip
                dream={selectedDream}
                loadFullImageProgressively
                onPress={() => openDetail(selectedDream)}
                size="full"
              />
            </Animated.View>
          ) : null}
        </Pressable>
      </Modal>

      {generatingDream ? (
        <DreamFrontPreviewGenerator
          dream={generatingDream}
          token={token}
          onGenerated={handlePreviewGenerated}
          onError={handlePreviewError}
        />
      ) : null}
    </View>
  );
}

function EmptyDreamState({ message }: { message: string }) {
  return (
    <View style={styles.emptyDreamBox}>
      <Text style={styles.emptyDreamText}>{message}</Text>
    </View>
  );
}

function DreamLibraryLoadingState({ cardWidth }: { cardWidth: number }) {
  return (
    <View style={styles.loadingState}>
      <Text style={styles.loadingText}>꿈카드 정보를 받아오고 있어요.</Text>
      <View style={styles.loadingGrid}>
        {Array.from({ length: 6 }, (_, index) => (
          <View
            key={index}
            style={[
              styles.loadingCard,
              {
                width: cardWidth,
                height: Math.round(cardWidth / DREAM_CARD_ASPECT_RATIO),
              },
            ]}
          >
            <View style={styles.loadingImageBlock} />
            <View style={styles.loadingLineStrong} />
            <View style={styles.loadingLine} />
            <View style={styles.loadingPillRow}>
              <View style={styles.loadingPill} />
              <View style={styles.loadingPill} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
function groupDreamsByDate(
  dreams: Dream[],
  calendarLabel: string,
): DateGroup[] {
  const groups = new Map<string, Dream[]>();

  dreams.forEach(dream => {
    const dateKey = toDateKey(dream.givenAt ?? dream.createdAt);
    const items = groups.get(dateKey) ?? [];
    groups.set(dateKey, [...items, dream]);
  });

  return Array.from(groups.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([dateKey, items]) => ({
      dateKey,
      label: formatCalendarLabel(dateKey, calendarLabel, items.length),
      items,
    }));
}

function buildCalendarMonths(groups: DateGroup[]) {
  const monthKeys = Array.from(
    new Set(
      groups
        .filter(group => group.dateKey !== 'unknown')
        .map(group => group.dateKey.slice(0, 7)),
    ),
  ).sort((left, right) => right.localeCompare(left));

  return monthKeys.map(monthKey => {
    const [yearText, monthText] = monthKey.split('-');
    const year = Number(yearText);
    const monthIndex = Number(monthText) - 1;
    const firstDay = new Date(year, monthIndex, 1).getDay();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cells: CalendarCell[] = Array.from({ length: firstDay }, () => null);

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({
        day,
        dateKey: `${yearText}-${monthText}-${String(day).padStart(2, '0')}`,
      });
    }

    return {
      monthKey,
      label: `${year}년 ${monthIndex + 1}월`,
      cells,
    };
  });
}

function getCalendarMonthKeys(groups: DateGroup[]) {
  return buildCalendarMonths(groups).map(month => month.monthKey);
}

function buildCalendarMonth(monthKey: string) {
  const [yearText, monthText] = monthKey.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const month = buildCalendarMonths([
    {
      dateKey: `${monthKey}-01`,
      label: '',
      items: [],
    },
  ])[0];

  return {
    monthKey,
    label: `${year}년 ${monthIndex + 1}월`,
    cells: month?.cells ?? [],
  };
}

function getCurrentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}`;
}

function toDateKey(value: string | null) {
  if (!value) {
    return 'unknown';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }

  return date.toISOString().slice(0, 10);
}

function formatCalendarLabel(
  dateKey: string,
  calendarLabel: string,
  count: number,
) {
  if (dateKey === 'unknown') {
    return `날짜 없음 ${calendarLabel} ${count}개`;
  }

  const [, month, day] = dateKey.split('-');
  return `${Number(month)}월 ${Number(day)}일 ${calendarLabel} ${count}개`;
}

function isImagePending(dream: Dream) {
  return dream.imageStatus === 'queued' || dream.imageStatus === 'generating';
}

function readLibraryMode(cacheKey?: string): LibraryMode {
  if (!cacheKey) {
    return DEFAULT_LIBRARY_MODE;
  }

  const cachedMode = readCache<LibraryMode>(cacheKey);
  return cachedMode === 'calendar' || cachedMode === 'archive'
    ? cachedMode
    : DEFAULT_LIBRARY_MODE;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 28,
    includeFontPadding: false,
  },
  description: {
    marginTop: 8,
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
  },
  segmented: {
    height: 52,
    borderRadius: 26,
    padding: 4,
    marginBottom: 10,
    flexDirection: 'row',
    backgroundColor: colors.lavenderMist,
  },
  segment: {
    flex: 1,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  segmentActive: {
    backgroundColor: colors.cardBase,
  },
  segmentLabel: {
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 14,
    includeFontPadding: false,
  },
  segmentLabelActive: {
    color: colors.textPrimary,
  },
  archiveGrid: {
    paddingTop: 14,
    paddingBottom: 28,
  },
  emptyArchiveGrid: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  archiveLoadingMoreText: {
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 13,
    includeFontPadding: false,
  },
  emptyDreamBox: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: colors.lavenderMist,
  },
  emptyDreamText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
  },
  loadingState: {
    flex: 1,
    paddingTop: 14,
    paddingBottom: 28,
  },
  loadingText: {
    marginBottom: 14,
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 14,
    includeFontPadding: false,
  },
  loadingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  loadingCard: {
    borderRadius: 8,
    padding: 7,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: 'rgba(216, 205, 187, 0.7)',
  },
  loadingImageBlock: {
    height: '52%',
    borderRadius: 7,
    backgroundColor: colors.lavenderMist,
  },
  loadingLineStrong: {
    width: '76%',
    height: 7,
    borderRadius: 999,
    marginTop: 9,
    backgroundColor: '#E5DCCF',
  },
  loadingLine: {
    width: '58%',
    height: 5,
    borderRadius: 999,
    marginTop: 7,
    backgroundColor: '#EEE6DA',
  },
  loadingPillRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 8,
  },
  loadingPill: {
    width: 24,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#F0E7D9',
  },
  gridRow: {
    gap: 10,
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  calendarList: {
    gap: 16,
    paddingTop: 6,
    paddingBottom: 28,
  },
  calendarMonth: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  monthTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontSize: 18,
    fontWeight: '700',
    includeFontPadding: false,
  },
  monthTitleButton: {
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  dayCellWithDream: {
    backgroundColor: 'transparent',
  },
  dayCellSelected: {
    backgroundColor: 'transparent',
  },
  dayNumberFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontSize: 14,
    fontWeight: '700',
    includeFontPadding: false,
  },
  dayTextWithDream: {
    color: colors.textPrimary,
  },
  dayPreview: {
    width: 46,
    height: 46,
    borderRadius: 23,
    position: 'relative',
    backgroundColor: 'transparent',
  },
  dayPreviewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  dayPreviewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderTint,
    borderRadius: 999,
  },
  dayPreviewMood: {
    color: colors.primaryDark,
    fontFamily: fontFamily.handwritten,
    fontSize: 10,
    fontWeight: '700',
    includeFontPadding: false,
  },
  dayPreviewOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(40, 35, 63, 0.28)',
    borderRadius: 999,
  },
  dayPreviewDay: {
    color: '#FFFFFF',
    fontFamily: fontFamily.handwritten,
    fontSize: 13,
    fontWeight: '800',
    includeFontPadding: false,
  },
  dayPreviewCount: {
    position: 'absolute',
    right: 5,
    bottom: 3,
    textAlign: 'center',
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontSize: 11,
    fontWeight: '900',
    includeFontPadding: false,
    textShadowColor: colors.cardBase,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 2,
  },
  calendarHintBox: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: colors.lavenderMist,
  },
  calendarHintText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  pickerBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: 'rgba(40, 35, 63, 0.34)',
  },
  pickerSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
    gap: 16,
    backgroundColor: colors.background,
  },
  pickerHeader: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  pickerTitle: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontSize: 17,
    fontWeight: '700',
    includeFontPadding: false,
  },
  pickerClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBase,
  },
  monthPickerSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 18,
    gap: 18,
    backgroundColor: colors.background,
  },
  monthPickerYearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthPickerYearButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBase,
  },
  monthPickerYearText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontSize: 20,
    fontWeight: '800',
    includeFontPadding: false,
  },
  monthPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  monthPickerOption: {
    width: '30.8%',
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.cardBase,
  },
  monthPickerOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.lavenderMist,
  },
  monthPickerOptionText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontSize: 15,
    fontWeight: '800',
    includeFontPadding: false,
  },
  monthPickerOptionTextSelected: {
    color: colors.textPrimary,
  },
  monthPickerDot: {
    position: 'absolute',
    right: 10,
    bottom: 8,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primary,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingBottom: 4,
  },
  pickerThumbButton: {
    width: 76,
    alignItems: 'center',
    gap: 7,
  },
  pickerThumbRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 3,
    borderWidth: 3,
    backgroundColor: colors.cardBase,
    overflow: 'hidden',
  },
  pickerThumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  pickerThumbFallback: {
    flex: 1,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderTint,
  },
  pickerThumbMood: {
    color: colors.primaryDark,
    fontFamily: fontFamily.handwritten,
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
  },
  pickerThumbLabel: {
    width: '100%',
    textAlign: 'center',
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontSize: 11,
    fontWeight: '700',
    includeFontPadding: false,
  },
  previewBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(40, 35, 63, 0.38)',
  },
  previewCard: {
    position: 'relative',
  },
});
