import { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { CalendarDays, Grid2X2, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import {
  CARD_COLOR_THEMES,
  getDreamFontStyle,
  normalizeDreamDesign,
} from '../theme/dreamDesigns';
import { interactionStyles } from '../theme/interactions';
import type { Dream } from '../types/dream';
import { DreamCard } from './DreamCard';

type LibraryMode = 'archive' | 'calendar';
type Navigation = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  title: string;
  description: string;
  calendarLabel: string;
  emptyMessage: string;
  dreams: Dream[];
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

const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

export function DreamLibraryView({
  title,
  description,
  calendarLabel,
  emptyMessage,
  dreams,
}: Props) {
  const navigation = useNavigation<Navigation>();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<LibraryMode>('archive');
  const [selectedDream, setSelectedDream] = useState<Dream | null>(null);
  const [selectedDateKeys, setSelectedDateKeys] = useState<string[]>([]);
  const [multiDreamDateGroup, setMultiDreamDateGroup] =
    useState<DateGroup | null>(null);
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
  const groupedDreams = useMemo(
    () => groupDreamsByDate(dreams, calendarLabel),
    [calendarLabel, dreams],
  );
  const groupedDreamMap = useMemo(
    () => new Map(groupedDreams.map(group => [group.dateKey, group])),
    [groupedDreams],
  );
  const calendarMonths = useMemo(
    () => buildCalendarMonths(groupedDreams),
    [groupedDreams],
  );
  const miniCardWidth = Math.floor((width - 40 - 20) / 3);
  const calendarCellSize = Math.max(
    40,
    Math.min(62, Math.floor((width - 72) / 7)),
  );
  const dayPreviewSize = Math.max(40, Math.min(56, calendarCellSize - 4));

  const openDetail = (dream: Dream) => {
    setSelectedDream(null);
    navigation.navigate('DreamDetail', { dream });
  };

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
          onPress={() => setMode('archive')}
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
          onPress={() => setMode('calendar')}
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

      {mode === 'archive' ? (
        <FlatList
          data={dreams}
          keyExtractor={item => item.id}
          numColumns={3}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={[
            styles.archiveGrid,
            dreams.length === 0 && styles.emptyArchiveGrid,
          ]}
          ListEmptyComponent={<EmptyDreamState message={emptyMessage} />}
          renderItem={({ item }) => (
            <MiniDreamCard
              dream={item}
              width={miniCardWidth}
              onPress={() => setSelectedDream(item)}
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
              <Text style={styles.monthTitle}>{month.label}</Text>
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
                  const previewImageUrl =
                    firstDream?.thumbnailUrl ?? firstDream?.imageUrl;
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

          {calendarMonths.length === 0 ? (
            <View style={styles.calendarHintBox}>
              <Text style={styles.calendarHintText}>{emptyMessage}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

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
                  const imageUrl = dream.thumbnailUrl ?? dream.imageUrl;
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
              <DreamCard dream={selectedDream} size="full" />
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

function MiniDreamCard({
  dream,
  width,
  onPress,
}: {
  dream: Dream;
  width: number;
  onPress: () => void;
}) {
  const design = normalizeDreamDesign(dream.design);
  const designTheme = CARD_COLOR_THEMES[design.cardColor];
  const dreamFontStyle = getDreamFontStyle(design.fontStyle);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.miniCard,
        {
          width,
          backgroundColor: designTheme.card,
          shadowColor: designTheme.shadow,
        },
        pressed && interactionStyles.pressedSoft,
      ]}
    >
      <View style={[styles.miniImage, { backgroundColor: designTheme.image }]}>
        {dream.thumbnailUrl || dream.imageUrl ? (
          <Image
            source={{ uri: dream.thumbnailUrl ?? dream.imageUrl ?? undefined }}
            style={styles.miniImageAsset}
          />
        ) : (
          <Text
            style={[
              styles.miniMood,
              dreamFontStyle,
              { color: designTheme.accent },
            ]}
          >
            {isImagePending(dream) ? '이미지 생성 중' : dream.mainMood}
          </Text>
        )}
      </View>
      <View style={[styles.miniBody, { backgroundColor: designTheme.card }]}>
        <Text
          style={[
            styles.miniTitle,
            dreamFontStyle,
            { color: designTheme.text },
          ]}
          numberOfLines={2}
        >
          {dream.title}
        </Text>
        <Text
          style={[
            styles.miniMeta,
            dreamFontStyle,
            { color: designTheme.secondaryText },
          ]}
          numberOfLines={1}
        >
          {dream.tags
            .slice(0, 2)
            .map(tag => `#${tag}`)
            .join(' ')}
        </Text>
      </View>
    </Pressable>
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    includeFontPadding: false,
  },
  description: {
    marginTop: 8,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 14,
    fontWeight: '700',
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
  emptyDreamBox: {
    borderRadius: 20,
    padding: 18,
    backgroundColor: colors.lavenderMist,
  },
  emptyDreamText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  gridRow: {
    gap: 10,
    marginBottom: 10,
  },
  miniCard: {
    minHeight: 170,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: colors.cardBase,
    shadowColor: colors.primary,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  miniImage: {
    height: 94,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  miniImageAsset: {
    width: '100%',
    height: '100%',
  },
  miniMood: {
    color: colors.primaryDark,
    fontSize: 19,
    fontWeight: '700',
    includeFontPadding: false,
  },
  miniBody: {
    padding: 10,
    gap: 7,
  },
  miniTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  miniMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
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
    fontSize: 18,
    fontWeight: '700',
    includeFontPadding: false,
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
    borderWidth: 3,
    borderColor: colors.cardBase,
    overflow: 'hidden',
    backgroundColor: colors.lavenderTint,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  dayPreviewImage: {
    width: '100%',
    height: '100%',
  },
  dayPreviewFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderTint,
  },
  dayPreviewMood: {
    color: colors.primaryDark,
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
  },
  dayPreviewDay: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    includeFontPadding: false,
  },
  dayPreviewCount: {
    position: 'absolute',
    right: 5,
    bottom: 4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    textAlign: 'center',
    color: colors.primaryDark,
    backgroundColor: colors.cardBase,
    fontSize: 8,
    fontWeight: '800',
    includeFontPadding: false,
    overflow: 'hidden',
  },
  calendarHintBox: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: colors.lavenderMist,
  },
  calendarHintText: {
    color: colors.textSecondary,
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
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
  },
  pickerThumbLabel: {
    width: '100%',
    textAlign: 'center',
    color: colors.textSecondary,
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
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  detailButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
