import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
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
import type { Dream } from '../types/dream';
import { TagChip } from './TagChip';

type LibraryMode = 'archive' | 'calendar';
type Navigation = NativeStackNavigationProp<RootStackParamList>;

type Props = {
  title: string;
  description: string;
  calendarLabel: string;
  dreams: Dream[];
};

const cardColors = ['#E9E4FB', '#F4EFFF', '#E4F6FB', '#FFF2C9', '#FDFBF6'];

export function DreamLibraryView({
  title,
  description,
  calendarLabel,
  dreams,
}: Props) {
  const navigation = useNavigation<Navigation>();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<LibraryMode>('archive');
  const [selectedDream, setSelectedDream] = useState<Dream | null>(null);
  const groupedDreams = useMemo(
    () => groupDreamsByDate(dreams, calendarLabel),
    [calendarLabel, dreams],
  );
  const miniCardWidth = Math.floor((width - 40 - 20) / 3);

  const openDetail = (dream: Dream) => {
    setSelectedDream(null);
    navigation.navigate('DreamDetail', { dream });
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
          style={[styles.segment, mode === 'archive' && styles.segmentActive]}
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
            카드보관함
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setMode('calendar')}
          style={[styles.segment, mode === 'calendar' && styles.segmentActive]}
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
          contentContainerStyle={styles.archiveGrid}
          renderItem={({ item, index }) => (
            <MiniDreamCard
              dream={item}
              index={index}
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
          {groupedDreams.map(group => (
            <View key={group.dateKey} style={styles.dateGroup}>
              <Text style={styles.dateTitle}>{group.label}</Text>
              <View style={styles.dateCards}>
                {group.items.map((dream, index) => (
                  <Pressable
                    key={dream.id}
                    accessibilityRole="button"
                    onPress={() => setSelectedDream(dream)}
                    style={styles.calendarCard}
                  >
                    <View
                      style={[
                        styles.calendarThumb,
                        {
                          backgroundColor:
                            cardColors[index % cardColors.length],
                        },
                      ]}
                    >
                      <Text style={styles.calendarMood}>{dream.mainMood}</Text>
                    </View>
                    <View style={styles.calendarText}>
                      <Text style={styles.calendarCardTitle}>
                        {dream.title}
                      </Text>
                      <Text style={styles.calendarSummary} numberOfLines={1}>
                        {dream.summary}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal
        animationType="fade"
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
              onPress={() => openDetail(selectedDream)}
            >
              <Pressable
                accessibilityLabel="닫기"
                accessibilityRole="button"
                onPress={() => setSelectedDream(null)}
                style={styles.previewClose}
              >
                <X color={colors.textSecondary} size={18} />
              </Pressable>
              <View style={styles.previewImage}>
                <Text style={styles.previewMood}>{selectedDream.mainMood}</Text>
              </View>
              <View style={styles.previewBody}>
                <Text style={styles.previewMeta}>
                  {selectedDream.shortMessage}
                </Text>
                <Text style={styles.previewTitle}>{selectedDream.title}</Text>
                <Text style={styles.previewSummary} numberOfLines={2}>
                  {selectedDream.summary}
                </Text>
                <View style={styles.previewTags}>
                  {selectedDream.tags.slice(0, 3).map(tag => (
                    <TagChip key={tag} label={tag} />
                  ))}
                </View>
                <Text style={styles.previewHint}>카드를 눌러 자세히 보기</Text>
              </View>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}

function MiniDreamCard({
  dream,
  index,
  width,
  onPress,
}: {
  dream: Dream;
  index: number;
  width: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.miniCard, { width }]}
    >
      <View
        style={[
          styles.miniImage,
          { backgroundColor: cardColors[index % cardColors.length] },
        ]}
      >
        <Text style={styles.miniMood}>{dream.mainMood}</Text>
      </View>
      <View style={styles.miniBody}>
        <Text style={styles.miniTitle} numberOfLines={2}>
          {dream.title}
        </Text>
        <Text style={styles.miniMeta} numberOfLines={1}>
          {dream.tags
            .slice(0, 2)
            .map(tag => `#${tag}`)
            .join(' ')}
        </Text>
      </View>
    </Pressable>
  );
}

function groupDreamsByDate(dreams: Dream[], calendarLabel: string) {
  const groups = new Map<string, Dream[]>();

  dreams.forEach(dream => {
    const sourceDate = dream.givenAt ?? dream.createdAt;
    const date = new Date(sourceDate);
    const dateKey = Number.isNaN(date.getTime())
      ? 'unknown'
      : date.toISOString().slice(0, 10);
    const items = groups.get(dateKey) ?? [];
    groups.set(dateKey, [...items, dream]);
  });

  return Array.from(groups.entries()).map(([dateKey, items]) => ({
    dateKey,
    label:
      dateKey === 'unknown'
        ? '날짜 없음'
        : formatCalendarLabel(dateKey, calendarLabel, items.length),
    items,
  }));
}

function formatCalendarLabel(
  dateKey: string,
  calendarLabel: string,
  count: number,
) {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}월 ${Number(day)}일 ${calendarLabel} ${count}개`;
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
    fontWeight: '800',
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
    backgroundColor: '#F0F0F2',
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
    backgroundColor: '#FFFFFF',
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
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  miniImage: {
    height: 94,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniMood: {
    color: colors.primaryDark,
    fontSize: 19,
    fontWeight: '800',
    includeFontPadding: false,
  },
  miniBody: {
    padding: 10,
    gap: 7,
  },
  miniTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
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
  dateGroup: {
    gap: 10,
  },
  dateTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    includeFontPadding: false,
  },
  dateCards: {
    gap: 10,
  },
  calendarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    padding: 12,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  calendarThumb: {
    width: 74,
    height: 74,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMood: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: '800',
    includeFontPadding: false,
  },
  calendarText: {
    flex: 1,
  },
  calendarCardTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    includeFontPadding: false,
  },
  calendarSummary: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  previewBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.38)',
  },
  previewCard: {
    overflow: 'hidden',
    borderRadius: 28,
    backgroundColor: colors.cardIvory,
  },
  previewClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  previewImage: {
    height: 250,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderTint,
  },
  previewMood: {
    color: colors.primaryDark,
    fontSize: 34,
    fontWeight: '800',
    includeFontPadding: false,
  },
  previewBody: {
    padding: 20,
    gap: 10,
  },
  previewMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    includeFontPadding: false,
  },
  previewTitle: {
    color: colors.textPrimary,
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 31,
  },
  previewSummary: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  previewTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewHint: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    includeFontPadding: false,
  },
});
