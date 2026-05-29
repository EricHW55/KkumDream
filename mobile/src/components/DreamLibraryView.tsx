import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  InteractionManager,
  type LayoutChangeEvent,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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

import { readCache, writeCache } from '../data/cache';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { CARD_COLOR_THEMES, normalizeDreamDesign } from '../theme/dreamDesigns';
import { interactionStyles } from '../theme/interactions';
import { fontFamily } from '../theme/typography';
import type { Dream } from '../types/dream';
import { DreamCard } from './DreamCard';
import { DREAM_CARD_ASPECT_RATIO } from './DreamCardFrame';
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
}: Props) {
  const navigation = useNavigation<Navigation>();
  const isFocused = useIsFocused();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<LibraryMode>(() =>
    readLibraryMode(viewModeCacheKey),
  );
  const [selectedDream, setSelectedDream] = useState<Dream | null>(null);
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
  const [viewableArchiveIds, setViewableArchiveIds] = useState<string[]>([]);
  const [upgradedArchiveIds, setUpgradedArchiveIds] = useState<Set<string>>(
    () => new Set(),
  );
  const archiveItemLayoutsRef = useRef(
    new Map<string, { height: number; index: number; y: number }>(),
  );
  const archiveViewportHeightRef = useRef(0);
  const archiveScrollOffsetRef = useRef(0);
  const isArchiveInputActiveRef = useRef(false);
  const archiveUpgradeResumeTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const previewPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 80) {
            setSelectedDream(null);
          }
        },
      }),
    [],
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
  const archiveCardWidth = Math.floor((width - 40 - archiveColumnGap * 2) / 3);
  const archiveCardHeight = Math.round(
    archiveCardWidth / DREAM_CARD_ASPECT_RATIO,
  );
  const archiveRowHeight = archiveCardHeight + 12;
  const calendarCellSize = Math.max(
    40,
    Math.min(62, Math.floor((width - 72) / 7)),
  );
  const dayPreviewSize = Math.max(40, Math.min(56, calendarCellSize - 4));

  const updateArchiveUpgradeQueue = useCallback(() => {
    if (isArchiveInputActiveRef.current) {
      return;
    }
    if (mode !== 'archive' || archiveDreams.length === 0) {
      setViewableArchiveIds([]);
      return;
    }

    const viewportHeight = archiveViewportHeightRef.current;
    if (viewportHeight <= 0) {
      setViewableArchiveIds(
        archiveDreams
          .slice(0, INITIAL_ARCHIVE_RENDER_COUNT)
          .map(dream => dream.id),
      );
      return;
    }

    const viewportTop = archiveScrollOffsetRef.current;
    const viewportBottom = viewportTop + viewportHeight;
    const viewportCenter = (viewportTop + viewportBottom) / 2;
    const visibleScores: Array<{ id: string; index: number; ratio: number }> = [];
    const backgroundScores: Array<{
      distance: number;
      id: string;
      index: number;
    }> = [];

    archiveDreams.forEach((dream, fallbackIndex) => {
      const layout = archiveItemLayoutsRef.current.get(dream.id);
      const index = layout?.index ?? fallbackIndex;
      if (!layout || layout.height <= 0) {
        backgroundScores.push({
          distance: Math.abs(fallbackIndex - Math.floor(archiveScrollOffsetRef.current / archiveRowHeight) * 3),
          id: dream.id,
          index,
        });
        return;
      }

      const itemTop = layout.y;
      const itemBottom = layout.y + layout.height;
      const visibleHeight = Math.max(
        0,
        Math.min(itemBottom, viewportBottom) - Math.max(itemTop, viewportTop),
      );
      const ratio = visibleHeight / layout.height;
      if (ratio > 0) {
        visibleScores.push({ id: dream.id, index, ratio });
        return;
      }

      const itemCenter = itemTop + layout.height / 2;
      backgroundScores.push({
        distance: Math.abs(itemCenter - viewportCenter),
        id: dream.id,
        index,
      });
    });

    visibleScores.sort((left, right) => {
      if (right.ratio !== left.ratio) {
        return right.ratio - left.ratio;
      }
      return left.index - right.index;
    });
    backgroundScores.sort((left, right) => {
      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }
      return left.index - right.index;
    });

    setViewableArchiveIds([
      ...visibleScores.map(score => score.id),
      ...backgroundScores.map(score => score.id),
    ]);
  }, [archiveDreams, archiveRowHeight, mode]);

  const handleArchiveItemLayout = useCallback(
    (dreamId: string, index: number, event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout;
      const y = Math.floor(index / 3) * archiveRowHeight;
      archiveItemLayoutsRef.current.set(dreamId, { height, index, y });
      updateArchiveUpgradeQueue();
    },
    [archiveRowHeight, updateArchiveUpgradeQueue],
  );

  const handleArchiveLayout = useCallback(
    (event: LayoutChangeEvent) => {
      archiveViewportHeightRef.current = event.nativeEvent.layout.height;
      updateArchiveUpgradeQueue();
    },
    [updateArchiveUpgradeQueue],
  );

  const handleArchiveScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      archiveScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
      updateArchiveUpgradeQueue();
    },
    [updateArchiveUpgradeQueue],
  );

  const clearArchiveUpgradeResumeTimer = useCallback(() => {
    if (archiveUpgradeResumeTimerRef.current !== null) {
      clearTimeout(archiveUpgradeResumeTimerRef.current);
      archiveUpgradeResumeTimerRef.current = null;
    }
  }, []);

  const pauseArchiveUpgradeWork = useCallback(() => {
    isArchiveInputActiveRef.current = true;
    clearArchiveUpgradeResumeTimer();
  }, [clearArchiveUpgradeResumeTimer]);

  const resumeArchiveUpgradeWork = useCallback(() => {
    clearArchiveUpgradeResumeTimer();
    archiveUpgradeResumeTimerRef.current = setTimeout(() => {
      isArchiveInputActiveRef.current = false;
      archiveUpgradeResumeTimerRef.current = null;
      updateArchiveUpgradeQueue();
    }, 80);
  }, [clearArchiveUpgradeResumeTimer, updateArchiveUpgradeQueue]);

  const openDetail = (dream: Dream) => {
    setSelectedDream(null);
    navigation.navigate('DreamDetail', { dream });
  };

  const handleSelectDream = useCallback((dream: Dream) => {
    setSelectedDream(dream);
  }, []);

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
    const dreamIds = new Set(dreams.map(dream => dream.id));
    setViewableArchiveIds([]);
    archiveItemLayoutsRef.current.clear();
    archiveScrollOffsetRef.current = 0;
    setUpgradedArchiveIds(current => {
      const next = new Set<string>();
      current.forEach(id => {
        if (dreamIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [dreams]);

  useEffect(() => {
    updateArchiveUpgradeQueue();
  }, [updateArchiveUpgradeQueue]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    setViewableArchiveIds([]);
    setUpgradedArchiveIds(new Set());
  }, [isFocused]);

  useEffect(() => {
    if (
      !isFocused ||
      mode !== 'archive' ||
      viewableArchiveIds.length > 0 ||
      archiveDreams.length === 0
    ) {
      return undefined;
    }

    let frameId: number | null = null;
    let isCancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      frameId = requestAnimationFrame(() => {
        if (!isCancelled) {
          setViewableArchiveIds(
            archiveDreams
              .slice(0, INITIAL_ARCHIVE_RENDER_COUNT)
              .map(dream => dream.id),
          );
        }
      });
    });

    return () => {
      isCancelled = true;
      task.cancel?.();
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [archiveDreams, isFocused, mode, viewableArchiveIds.length]);

  useEffect(() => {
    if (mode !== 'archive' || viewableArchiveIds.length === 0) {
      return undefined;
    }
    if (isArchiveInputActiveRef.current) {
      return undefined;
    }

    const nextId = viewableArchiveIds.find(id => !upgradedArchiveIds.has(id));
    if (!nextId) {
      return undefined;
    }

    let isCancelled = false;
    const frameId = requestAnimationFrame(() => {
      if (isCancelled || isArchiveInputActiveRef.current) {
        return;
      }
      setUpgradedArchiveIds(current => {
        if (current.has(nextId)) {
          return current;
        }
        const next = new Set(current);
        next.add(nextId);
        return next;
      });
    });

    return () => {
      isCancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [mode, upgradedArchiveIds, viewableArchiveIds]);

  useEffect(() => clearArchiveUpgradeResumeTimer, [clearArchiveUpgradeResumeTimer]);

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
      setSelectedDream(group.items[0]);
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
          data={archiveDreams}
          getItemLayout={(_, index) => ({
            length: archiveRowHeight,
            offset: archiveRowHeight * Math.floor(index / 3),
            index,
          })}
          initialNumToRender={12}
          keyExtractor={item => item.id}
          maxToRenderPerBatch={6}
          numColumns={3}
          onLayout={handleArchiveLayout}
          onScroll={handleArchiveScroll}
          onScrollBeginDrag={pauseArchiveUpgradeWork}
          onScrollEndDrag={resumeArchiveUpgradeWork}
          onMomentumScrollBegin={pauseArchiveUpgradeWork}
          onMomentumScrollEnd={resumeArchiveUpgradeWork}
          onTouchStart={pauseArchiveUpgradeWork}
          onTouchEnd={resumeArchiveUpgradeWork}
          onTouchCancel={resumeArchiveUpgradeWork}
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
            dreams.length > archiveDreams.length ? (
              <Text style={styles.archiveLoadingMoreText}>
                꿈카드를 더 불러오는 중이에요.
              </Text>
            ) : null
          }
          renderItem={({ item, index }) => (
            <MiniDreamCard
              dream={item}
              index={index}
              isUpgraded={upgradedArchiveIds.has(item.id)}
              onLayout={handleArchiveItemLayout}
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
                        setSelectedDream(dream);
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
        animationType="slide"
        transparent
        visible={selectedDream !== null}
        onRequestClose={() => setSelectedDream(null)}
      >
        <Pressable
          style={styles.previewBackdrop}
          onPress={() => setSelectedDream(null)}
        >
          {selectedDream ? (
            <Pressable
              style={styles.previewCard}
              onPress={event => event.stopPropagation()}
              {...previewPanResponder.panHandlers}
            >
              <View style={styles.previewHandle} />
              <Pressable
                accessibilityLabel="닫기"
                accessibilityRole="button"
                onPress={() => setSelectedDream(null)}
                style={({ pressed }) => [
                  styles.previewClose,
                  pressed && interactionStyles.pressed,
                ]}
              >
                <X color={colors.textSecondary} size={18} />
              </Pressable>
              <DreamCard
                dream={selectedDream}
                loadFullImageProgressively
                size="full"
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => openDetail(selectedDream)}
                style={({ pressed }) => [
                  styles.detailButton,
                  pressed && interactionStyles.pressed,
                ]}
              >
                <Text style={styles.detailButtonText}>상세보기</Text>
              </Pressable>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
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

const MiniDreamCard = memo(function MiniDreamCard({
  dream,
  index,
  isUpgraded,
  onLayout,
  width,
  onPress,
}: {
  dream: Dream;
  index: number;
  isUpgraded: boolean;
  onLayout: (dreamId: string, index: number, event: LayoutChangeEvent) => void;
  width: number;
  onPress: (dream: Dream) => void;
}) {
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => onLayout(dream.id, index, event),
    [onLayout, dream.id, index],
  );
  const handlePress = useCallback(() => onPress(dream), [onPress, dream]);

  if (isUpgraded) {
    return (
      <View onLayout={handleLayout}>
        <DreamCard
          disableFlip
          dream={dream}
          onPress={handlePress}
          preferThumbnail
          showImageActions={false}
          width={width}
        />
      </View>
    );
  }

  return (
    <View onLayout={handleLayout}>
      <DreamCard
        variant="lite"
        dream={dream}
        onPress={handlePress}
        width={width}
      />
    </View>
  );
});

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
    marginBottom: 18,
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
    paddingBottom: 120,
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
    paddingBottom: 120,
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
    paddingBottom: 120,
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
    justifyContent: 'flex-end',
    padding: 16,
    backgroundColor: 'rgba(40, 35, 63, 0.38)',
  },
  previewCard: {
    position: 'relative',
    maxHeight: '92%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 16,
    paddingTop: 26,
    gap: 12,
    backgroundColor: colors.background,
  },
  previewHandle: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.lavenderTint,
  },
  previewClose: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 30,
    elevation: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,252,255,0.92)',
  },
  detailButton: {
    minHeight: 48,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderTint,
    borderWidth: 1,
    borderColor: '#D8CDBB',
  },
  detailButtonText: {
    color: colors.primary,
    fontFamily: fontFamily.handwritten,
    fontSize: 15,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
