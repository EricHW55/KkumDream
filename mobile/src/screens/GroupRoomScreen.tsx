import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import type { InfiniteData } from '@tanstack/react-query';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Copy,
  Settings,
  Share2,
  UsersRound,
  X,
} from 'lucide-react-native';
import {
  Clipboard,
  FlatList,
  type LayoutChangeEvent,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DreamCard } from '../components/DreamCard';
import { DREAM_CARD_ASPECT_RATIO } from '../components/DreamCardFrame';
import { PaperTextureOverlay } from '../components/PaperTextureOverlay';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { readCache, writeCache } from '../data/cache';
import {
  getCachedRoomDreamPage,
  getCachedRooms,
  type CachedRoomDreamPage,
  leaveGroupRoom,
  loadRoomDreamPage,
  loadRooms,
  updateGroupRoom,
} from '../data/dreamRepository';
import { isCurrentUserId } from '../data/currentUser';
import { getDisplayMember } from '../data/members';
import type { RootStackParamList } from '../navigation/types';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';
import { fontFamily } from '../theme/typography';
import type { Dream } from '../types/dream';
import type { GroupMember } from '../types/group';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupRoom'>;
const INVITE_COLLAPSED_CACHE_PREFIX = 'ui:group-room:invite-collapsed';

export function GroupRoomScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const token = useSessionStore(state => state.token);
  const sessionUserId = useSessionStore(state => state.userId);
  const dreamListRef = useRef<FlatList<Dream>>(null);
  const shouldScrollToLatestRef = useRef(false);
  const lastLatestDreamIdRef = useRef<string | null>(null);
  const savedScrollOffsetRef = useRef(0);
  const pendingScrollRestoreOffsetRef = useRef<number | null>(null);
  const scrollRetryTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const dreamItemLayoutsRef = useRef(
    new Map<string, { height: number; index: number; y: number }>(),
  );
  const timelineViewportHeightRef = useRef(0);
  const timelineScrollOffsetRef = useRef(0);
  const isTimelineInputActiveRef = useRef(false);
  const upgradeResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [roomOverride, setRoomOverride] = useState<
    ReturnType<typeof getCachedRooms>[number] | null
  >(null);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isMembersVisible, setIsMembersVisible] = useState(false);
  const [roomNameDraft, setRoomNameDraft] = useState('');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [isInviteCollapsed, setIsInviteCollapsed] = useState(true);
  const [isRoomContentHydrated, setIsRoomContentHydrated] = useState(false);
  const [isRestoringRoomScroll, setIsRestoringRoomScroll] = useState(false);
  const [isSavingRoom, setIsSavingRoom] = useState(false);
  const [isLeavingRoom, setIsLeavingRoom] = useState(false);
  const [viewableDreamIds, setViewableDreamIds] = useState<string[]>([]);
  const [upgradedDreamIds, setUpgradedDreamIds] = useState<Set<string>>(
    () => new Set(),
  );
  const roomsQueryKey = useMemo(
    () => ['rooms', sessionUserId, token] as const,
    [sessionUserId, token],
  );
  const dreamsQueryKey = useMemo(
    () =>
      ['rooms', route.params.groupId, 'dreams', sessionUserId, token] as const,
    [route.params.groupId, sessionUserId, token],
  );
  const { data: rooms = [], refetch: refetchRooms } = useQuery({
    queryKey: roomsQueryKey,
    queryFn: () => loadRooms(token, sessionUserId),
    enabled: isRoomContentHydrated,
    staleTime: 0,
    refetchOnMount: false,
  });
  const cachedRoom = rooms.find(item => item.id === route.params.groupId);
  const room = roomOverride ?? cachedRoom;
  const title = room?.name ?? route.params.groupName ?? '꿈방';
  const description =
    room?.description ??
    route.params.description ??
    '오늘 꿈카드 0개';
  const {
    data: dreamPages,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchDreams,
  } = useInfiniteQuery({
    queryKey: dreamsQueryKey,
    queryFn: ({ pageParam }) =>
      loadRoomDreamPage(route.params.groupId, token, sessionUserId, pageParam),
    enabled: isRoomContentHydrated,
    initialPageParam: null as string | null,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    staleTime: 0,
    refetchOnMount: false,
    refetchInterval: query =>
      hasPendingImage(flattenRoomDreamPages(query.state.data?.pages)) ? 5000 : false,
  });
  const visibleDreams = useMemo(
    () =>
      isRoomContentHydrated
        ? flattenRoomDreamPages(dreamPages?.pages)
        : [],
    [dreamPages?.pages, isRoomContentHydrated],
  );
  const latestVisibleDreamId = visibleDreams[visibleDreams.length - 1]?.id ?? null;
  const shouldShowTimelineLoading = !isRoomContentHydrated;
  const members = useMemo(
    () =>
      (room?.members ?? []).length > 0
        ? room?.members ?? []
        : (room?.memberIds ?? []).map(memberId =>
            getDisplayMember(memberId, sessionUserId),
          ),
    [room?.members, room?.memberIds, sessionUserId],
  );

  const updateDreamUpgradeQueue = useCallback(() => {
    if (isTimelineInputActiveRef.current) {
      return;
    }

    const viewportHeight = timelineViewportHeightRef.current;
    if (viewportHeight <= 0 || visibleDreams.length === 0) {
      setViewableDreamIds([]);
      return;
    }

    const viewportTop = timelineScrollOffsetRef.current;
    const viewportBottom = viewportTop + viewportHeight;
    const viewportCenter = (viewportTop + viewportBottom) / 2;
    const visibleScores: Array<{ id: string; index: number; ratio: number }> = [];
    const backgroundScores: Array<{
      distance: number;
      id: string;
      index: number;
    }> = [];
    const measuredLayouts = Array.from(dreamItemLayoutsRef.current.values());
    const estimatedItemHeight =
      measuredLayouts.length > 0
        ? measuredLayouts.reduce((sum, layout) => sum + layout.height, 0) /
          measuredLayouts.length
        : 260;

    visibleDreams.forEach((dream, fallbackIndex) => {
      const layout = dreamItemLayoutsRef.current.get(dream.id);
      const index = layout?.index ?? fallbackIndex;
      if (!layout || layout.height <= 0) {
        backgroundScores.push({
          distance: Math.abs(
            fallbackIndex * estimatedItemHeight + estimatedItemHeight / 2 -
              viewportCenter,
          ),
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
        visibleScores.push({
          id: dream.id,
          index,
          ratio,
        });
        return;
      }

      backgroundScores.push({
        distance: Math.abs(itemTop + layout.height / 2 - viewportCenter),
        id: dream.id,
        index,
      });
    });

    visibleScores.sort((left, right) => {
      if (right.ratio !== left.ratio) {
        return right.ratio - left.ratio;
      }
      return right.index - left.index;
    });
    backgroundScores.sort((left, right) => {
      if (left.distance !== right.distance) {
        return left.distance - right.distance;
      }
      return Math.abs(left.index) - Math.abs(right.index);
    });

    setViewableDreamIds([
      ...visibleScores.map(score => score.id),
      ...backgroundScores.map(score => score.id),
    ]);
  }, [visibleDreams]);

  const clearUpgradeResumeTimer = useCallback(() => {
    if (upgradeResumeTimerRef.current !== null) {
      clearTimeout(upgradeResumeTimerRef.current);
      upgradeResumeTimerRef.current = null;
    }
  }, []);

  const pauseDreamUpgradeWork = useCallback(() => {
    isTimelineInputActiveRef.current = true;
    clearUpgradeResumeTimer();
  }, [clearUpgradeResumeTimer]);

  const resumeDreamUpgradeWork = useCallback(() => {
    clearUpgradeResumeTimer();
    upgradeResumeTimerRef.current = setTimeout(() => {
      isTimelineInputActiveRef.current = false;
      upgradeResumeTimerRef.current = null;
      updateDreamUpgradeQueue();
    }, 80);
  }, [clearUpgradeResumeTimer, updateDreamUpgradeQueue]);

  const handleDreamItemLayout = useCallback(
    (dreamId: string, index: number, event: LayoutChangeEvent) => {
      const { height, y } = event.nativeEvent.layout;
      dreamItemLayoutsRef.current.set(dreamId, { height, index, y });
      updateDreamUpgradeQueue();
    },
    [updateDreamUpgradeQueue],
  );

  const handleTimelineScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      savedScrollOffsetRef.current = offset;
      timelineScrollOffsetRef.current = offset;
      if (offset <= 180 && hasNextPage && !isFetchingNextPage) {
        shouldScrollToLatestRef.current = false;
        fetchNextPage().catch(() => undefined);
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  );

  useEffect(() => {
    const dreamIds = new Set(visibleDreams.map(dream => dream.id));
    setUpgradedDreamIds(current => {
      const next = new Set<string>();
      current.forEach(id => {
        if (dreamIds.has(id)) {
          next.add(id);
        }
      });
      return next;
    });
  }, [visibleDreams]);

  useEffect(() => {
    setViewableDreamIds([]);
    setUpgradedDreamIds(new Set());
    dreamItemLayoutsRef.current.clear();
    timelineScrollOffsetRef.current = 0;
  }, [route.params.groupId]);

  useEffect(() => {
    updateDreamUpgradeQueue();
  }, [updateDreamUpgradeQueue]);

  useEffect(() => {
    if (viewableDreamIds.length === 0) {
      return undefined;
    }
    if (isTimelineInputActiveRef.current) {
      return undefined;
    }

    const nextId = viewableDreamIds.find(id => !upgradedDreamIds.has(id));
    if (!nextId) {
      return undefined;
    }

    let isCancelled = false;
    const frameId = requestAnimationFrame(() => {
      if (isCancelled || isTimelineInputActiveRef.current) {
        return;
      }
      setUpgradedDreamIds(current => {
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
  }, [upgradedDreamIds, viewableDreamIds]);

  const clearScrollRetryTimers = useCallback(() => {
    scrollRetryTimersRef.current.forEach(timer => {
      clearTimeout(timer);
    });
    scrollRetryTimersRef.current = [];
  }, []);

  const scrollToLatestDream = useCallback(() => {
    if (visibleDreams.length === 0) {
      clearScrollRetryTimers();
      return;
    }

    clearScrollRetryTimers();

    const scrollToEnd = () => {
      if (!shouldScrollToLatestRef.current) {
        return;
      }
      dreamListRef.current?.scrollToEnd({ animated: false });
    };

    requestAnimationFrame(scrollToEnd);
    [80, 220].forEach(delay => {
      const timer = setTimeout(scrollToEnd, delay);
      scrollRetryTimersRef.current.push(timer);
    });
  }, [clearScrollRetryTimers, visibleDreams.length]);

  const restoreSavedScrollPosition = useCallback(() => {
    const offset = pendingScrollRestoreOffsetRef.current;
    if (offset === null || visibleDreams.length === 0) {
      return;
    }

    shouldScrollToLatestRef.current = false;
    clearScrollRetryTimers();

    const scrollToOffset = () => {
      dreamListRef.current?.scrollToOffset({
        animated: false,
        offset: Math.max(0, offset),
      });
    };

    requestAnimationFrame(scrollToOffset);
    [80, 220].forEach(delay => {
      const timer = setTimeout(scrollToOffset, delay);
      scrollRetryTimersRef.current.push(timer);
    });
    const finishTimer = setTimeout(() => {
      if (pendingScrollRestoreOffsetRef.current === offset) {
        pendingScrollRestoreOffsetRef.current = null;
      }
      setIsRestoringRoomScroll(false);
    }, 320);
    scrollRetryTimersRef.current.push(finishTimer);
  }, [clearScrollRetryTimers, visibleDreams.length]);

  const handleTimelineLayout = useCallback(
    (event: LayoutChangeEvent) => {
      timelineViewportHeightRef.current = event.nativeEvent.layout.height;
      if (pendingScrollRestoreOffsetRef.current !== null) {
        restoreSavedScrollPosition();
        return;
      }
      if (shouldScrollToLatestRef.current) {
        scrollToLatestDream();
      }
      updateDreamUpgradeQueue();
    },
    [restoreSavedScrollPosition, scrollToLatestDream, updateDreamUpgradeQueue],
  );

  useEffect(() => clearScrollRetryTimers, [clearScrollRetryTimers]);

  useEffect(
    () => () => {
      clearUpgradeResumeTimer();
    },
    [clearUpgradeResumeTimer],
  );

  useEffect(() => {
    if (pendingScrollRestoreOffsetRef.current !== null) {
      shouldScrollToLatestRef.current = false;
      restoreSavedScrollPosition();
      return;
    }

    if (latestVisibleDreamId === null) {
      lastLatestDreamIdRef.current = null;
      return;
    }

    if (latestVisibleDreamId === lastLatestDreamIdRef.current) {
      return;
    }

    lastLatestDreamIdRef.current = latestVisibleDreamId;
    shouldScrollToLatestRef.current = true;
    scrollToLatestDream();
  }, [
    latestVisibleDreamId,
    restoreSavedScrollPosition,
    route.params.groupId,
    scrollToLatestDream,
  ]);

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;
      const shouldRestoreScroll =
        pendingScrollRestoreOffsetRef.current !== null;
      setIsRoomContentHydrated(false);
      setIsRestoringRoomScroll(shouldRestoreScroll);
      setIsInviteCollapsed(true);
      setViewableDreamIds([]);
      setUpgradedDreamIds(new Set());
      isTimelineInputActiveRef.current = false;
      clearUpgradeResumeTimer();
      shouldScrollToLatestRef.current = false;
      clearScrollRetryTimers();

      const cachedRooms = getCachedRooms(sessionUserId);
      const cachedDreamPage = getCachedRoomDreamPage(
        route.params.groupId,
        sessionUserId,
      );
      const cachedDreams = cachedDreamPage.dreams;
      queryClient.setQueryData(roomsQueryKey, cachedRooms);
      queryClient.setQueryData(
        dreamsQueryKey,
        buildCachedRoomDreamInfiniteData(cachedDreamPage),
      );
      setIsInviteCollapsed(
        readInviteCollapsedState(route.params.groupId, sessionUserId),
      );
      setIsRoomContentHydrated(true);
      shouldScrollToLatestRef.current =
        !shouldRestoreScroll && cachedDreams.length > 0;

      refetchRooms().catch(() => undefined);
      refetchDreams()
        .then(result => {
          if (isCancelled) {
            return;
          }

          const nextDreams = flattenRoomDreamPages(result.data?.pages);
          shouldScrollToLatestRef.current =
            !shouldRestoreScroll && nextDreams.length > 0;
        })
        .catch(() => undefined);

      return () => {
        isCancelled = true;
        setIsRoomContentHydrated(false);
        setIsRestoringRoomScroll(false);
        setIsInviteCollapsed(true);
        setViewableDreamIds([]);
        setUpgradedDreamIds(new Set());
        isTimelineInputActiveRef.current = false;
        clearUpgradeResumeTimer();
        shouldScrollToLatestRef.current = false;
        clearScrollRetryTimers();
      };
    }, [
      clearScrollRetryTimers,
      dreamsQueryKey,
      queryClient,
      refetchDreams,
      refetchRooms,
      route.params.groupId,
      roomsQueryKey,
      clearUpgradeResumeTimer,
      sessionUserId,
    ]),
  );

  const openSettings = () => {
    setRoomNameDraft(title);
    setRoomError(null);
    setInviteStatus(null);
    setIsSettingsVisible(true);
  };

  const saveRoomSettings = async () => {
    const name = roomNameDraft.trim();
    if (!name || !token) {
      setRoomError(!token ? '로그인이 필요합니다.' : '꿈방 이름을 입력하세요.');
      return;
    }

    setRoomError(null);
    setIsSavingRoom(true);
    try {
      const updatedRoom = await updateGroupRoom(
        route.params.groupId,
        name,
        token,
        sessionUserId,
      );
      setRoomOverride(updatedRoom);
      queryClient.setQueryData<ReturnType<typeof getCachedRooms>>(
        roomsQueryKey,
        currentRooms =>
          currentRooms?.map(item =>
            item.id === updatedRoom.id ? updatedRoom : item,
          ) ?? [updatedRoom],
      );
      setIsSettingsVisible(false);
    } catch (error) {
      setRoomError(
        error instanceof Error
          ? error.message
          : '꿈방 설정을 저장하지 못했어요.',
      );
    } finally {
      setIsSavingRoom(false);
    }
  };

  const leaveCurrentRoom = async () => {
    if (!token) {
      setRoomError('로그인이 필요합니다.');
      return;
    }

    setRoomError(null);
    setIsLeavingRoom(true);
    try {
      const nextRooms = await leaveGroupRoom(
        route.params.groupId,
        token,
        sessionUserId,
      );
      queryClient.setQueryData(roomsQueryKey, nextRooms);
      queryClient.invalidateQueries({ queryKey: ['rooms', sessionUserId] });
      setIsSettingsVisible(false);
      navigation.goBack();
    } catch (error) {
      setRoomError(
        error instanceof Error ? error.message : '꿈방을 나가지 못했어요.',
      );
    } finally {
      setIsLeavingRoom(false);
    }
  };

  const copyInviteCode = () => {
    if (!room?.inviteCode) {
      setInviteStatus('복사할 초대 코드가 없어요.');
      return;
    }
    Clipboard.setString(room.inviteCode);
    setInviteStatus('초대 코드를 복사했어요.');
  };

  const shareInviteCode = async () => {
    if (!room?.inviteCode) {
      setInviteStatus('공유할 초대 코드가 없어요.');
      return;
    }

    try {
      await Share.share({
        title: `${title} 초대`,
        message: buildInviteMessage(title, room.inviteCode),
      });
    } catch (error) {
      setInviteStatus(
        error instanceof Error
          ? error.message
          : '초대 코드를 공유하지 못했어요.',
      );
    }
  };

  const updateInviteCollapsed = (nextValue: boolean) => {
    setIsInviteCollapsed(nextValue);
    writeInviteCollapsedState(
      route.params.groupId,
      sessionUserId,
      nextValue,
    );
  };

  const openDreamDetail = useCallback(
    (dream: Dream) => {
      pendingScrollRestoreOffsetRef.current = savedScrollOffsetRef.current;
      shouldScrollToLatestRef.current = false;
      clearScrollRetryTimers();
      navigation.navigate('DreamDetail', { dream });
    },
    [clearScrollRetryTimers, navigation],
  );

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top + 12, 42) }]}>
      <PaperTextureOverlay />
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="뒤로가기"
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [
            styles.backButton,
            pressed && interactionStyles.pressed,
          ]}
        >
          <ChevronLeft color={colors.textPrimary} size={26} strokeWidth={2.8} />
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{description}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="멤버 보기"
            accessibilityRole="button"
            onPress={() => setIsMembersVisible(true)}
            style={({ pressed }) => [
              styles.headerIconButton,
              pressed && interactionStyles.pressed,
            ]}
          >
            <UsersRound
              color={colors.textPrimary}
              size={21}
              strokeWidth={2.4}
            />
          </Pressable>
          <Pressable
            accessibilityLabel="방 설정"
            accessibilityRole="button"
            onPress={openSettings}
            style={({ pressed }) => [
              styles.headerIconButton,
              pressed && interactionStyles.pressed,
            ]}
          >
            <Settings color={colors.textPrimary} size={21} strokeWidth={2.4} />
          </Pressable>
        </View>
      </View>

      <View style={styles.timelineContainer}>
        <FlatList
          ref={dreamListRef}
          data={visibleDreams}
          keyExtractor={item => item.id}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          showsVerticalScrollIndicator={false}
          style={[
            styles.timelineList,
          ]}
          onContentSizeChange={() => {
            if (pendingScrollRestoreOffsetRef.current !== null) {
              restoreSavedScrollPosition();
              return;
            }
            if (!shouldScrollToLatestRef.current) {
              return;
            }
            scrollToLatestDream();
          }}
          onLayout={handleTimelineLayout}
          onScrollBeginDrag={() => {
            pauseDreamUpgradeWork();
            pendingScrollRestoreOffsetRef.current = null;
            setIsRestoringRoomScroll(false);
            shouldScrollToLatestRef.current = false;
            clearScrollRetryTimers();
          }}
          onScrollEndDrag={resumeDreamUpgradeWork}
          onMomentumScrollBegin={pauseDreamUpgradeWork}
          onMomentumScrollEnd={resumeDreamUpgradeWork}
          onScroll={handleTimelineScroll}
          scrollEventThrottle={16}
          onTouchStart={pauseDreamUpgradeWork}
          onTouchEnd={resumeDreamUpgradeWork}
          onTouchCancel={resumeDreamUpgradeWork}
          contentContainerStyle={[
            styles.messages,
            visibleDreams.length === 0 && styles.emptyMessages,
          ]}
          ListEmptyComponent={
            shouldShowTimelineLoading ? (
              <DreamRoomLoadingState />
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>첫 꿈카드를 기다리는 중</Text>
                <Text style={styles.emptyText}>
                  초대 코드를 공유해 친구를 초대하고, 첫 꿈카드를 건네보세요.
                </Text>
              </View>
            )
          }
          ListHeaderComponent={
            visibleDreams.length > 0 ? (
              <View>
                {isFetchingNextPage ? (
                  <Text style={styles.historyLoadingText}>
                    이전 꿈카드를 불러오고 있어요
                  </Text>
                ) : null}
              </View>
            ) : null
          }
          ListFooterComponent={
            visibleDreams.length > 0 ? (
              <View style={{ height: insets.bottom + 22 }} />
            ) : null
          }
          renderItem={({ item, index }) => {
            const previousDream = visibleDreams[index - 1];
            const currentDateKey = getDreamDateKey(item);
            const previousDateKey = previousDream
              ? getDreamDateKey(previousDream)
              : null;
            return (
              <DreamMessage
                dateLabel={
                  currentDateKey !== previousDateKey
                    ? formatRoomDateLabel(currentDateKey)
                    : null
                }
                dream={item}
                index={index}
                isUpgraded={upgradedDreamIds.has(item.id)}
                members={members}
                onLayout={handleDreamItemLayout}
                onPress={openDreamDetail}
              />
            );
          }}
        />
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.inviteOverlay,
          { top: Math.max(insets.top + 12, 42) + 74 },
        ]}
      >
        {isInviteCollapsed ? (
          <View style={styles.collapsedInviteWrap}>
            <Pressable
              accessibilityLabel="초대 코드 펼치기"
              accessibilityRole="button"
              onPress={() => updateInviteCollapsed(false)}
              style={({ pressed }) => [
                styles.collapsedInviteButton,
                pressed && interactionStyles.pressed,
              ]}
            >
              <ChevronDown
                color={colors.primary}
                size={20}
                strokeWidth={2.5}
              />
            </Pressable>
          </View>
        ) : (
          <InviteCodeCard
            inviteCode={room?.inviteCode}
            onCollapse={() => updateInviteCollapsed(true)}
            onCopy={copyInviteCode}
            onShare={shareInviteCode}
          />
        )}
        {inviteStatus && !isInviteCollapsed ? (
          <Text style={styles.inviteStatus}>{inviteStatus}</Text>
        ) : null}
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={isSettingsVisible}
        onRequestClose={() => setIsSettingsVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsSettingsVisible(false)}
        >
          <Pressable
            style={styles.sheet}
            onPress={event => event.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>방 설정</Text>
              <Pressable
                accessibilityLabel="닫기"
                accessibilityRole="button"
                onPress={() => setIsSettingsVisible(false)}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && interactionStyles.pressed,
                ]}
              >
                <X color={colors.textSecondary} size={20} />
              </Pressable>
            </View>
            <InviteCodeCard
              inSheet
              inviteCode={room?.inviteCode}
              onCopy={copyInviteCode}
              onShare={shareInviteCode}
            />
            {inviteStatus ? (
              <Text style={styles.sheetInviteStatus}>{inviteStatus}</Text>
            ) : null}
            <Text style={styles.inputLabel}>꿈방 이름</Text>
            <TextInput
              autoCorrect={false}
              spellCheck={false}
              defaultValue={roomNameDraft}
              onChangeText={setRoomNameDraft}
              placeholder="꿈방 이름"
              placeholderTextColor={colors.textMuted}
              style={styles.sheetInput}
            />
            {roomError ? (
              <Text style={styles.errorText}>{roomError}</Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={isSavingRoom}
              onPress={saveRoomSettings}
              style={({ pressed }) => [
                styles.primaryAction,
                isSavingRoom && styles.disabledAction,
                pressed && !isSavingRoom && interactionStyles.pressed,
              ]}
            >
              <Text style={styles.primaryActionText}>
                {isSavingRoom ? '저장 중...' : '저장'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={isLeavingRoom}
              onPress={leaveCurrentRoom}
              style={({ pressed }) => [
                styles.dangerAction,
                isLeavingRoom && styles.disabledAction,
                pressed && !isLeavingRoom && interactionStyles.pressed,
              ]}
            >
              <Text style={styles.dangerActionText}>
                {isLeavingRoom ? '나가는 중...' : '꿈방 나가기'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isMembersVisible}
        onRequestClose={() => setIsMembersVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsMembersVisible(false)}
        >
          <Pressable
            style={styles.sheet}
            onPress={event => event.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>멤버</Text>
                <Text style={styles.sheetSubtitle}>{members.length}명</Text>
              </View>
              <Pressable
                accessibilityLabel="닫기"
                accessibilityRole="button"
                onPress={() => setIsMembersVisible(false)}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && interactionStyles.pressed,
                ]}
              >
                <X color={colors.textSecondary} size={20} />
              </Pressable>
            </View>
            <View style={styles.memberList}>
              {members.map(member => (
                <View key={member.id} style={styles.memberItem}>
                  <ProfileAvatar
                    value={member.profileImageUrl}
                    name={member.name}
                    size={42}
                    fallbackColor={member.avatarColor}
                  />
                  <View style={styles.memberText}>
                    <Text style={styles.memberName}>
                      {member.id === sessionUserId ? '나' : member.name}
                    </Text>
                    <Text style={styles.memberRole}>
                      {member.role === 'owner' ? '방장' : '멤버'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function DreamRoomLoadingState() {
  return (
    <View style={styles.loadingConversation}>
      <Text style={styles.loadingConversationText}>
        꿈방 대화를 불러오고 있어요.
      </Text>
    </View>
  );
}

const DreamMessage = memo(function DreamMessage({
  dateLabel,
  dream,
  index,
  isUpgraded,
  members,
  onLayout,
  onPress,
}: {
  dateLabel: string | null;
  dream: Dream;
  index: number;
  isUpgraded: boolean;
  members: GroupMember[];
  onLayout: (dreamId: string, index: number, event: LayoutChangeEvent) => void;
  onPress: (dream: Dream) => void;
}) {
  const sessionUserId = useSessionStore(state => state.userId);
  const { width: windowWidth } = useWindowDimensions();
  const sender =
    members.find(member => member.id === dream.giverId) ??
    getDisplayMember(dream.giverId, sessionUserId);
  const receiver = dream.receiverId
    ? members.find(member => member.id === dream.receiverId) ??
      getDisplayMember(dream.receiverId, sessionUserId)
    : null;
  const isMine = isCurrentUserId(dream.giverId, sessionUserId);
  const senderName = isMine ? '나' : sender.name;
  const cardWidth = Math.min(Math.floor(windowWidth * 0.56), 260);
  const cardHeight = Math.round(cardWidth / DREAM_CARD_ASPECT_RATIO);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => onLayout(dream.id, index, event),
    [onLayout, dream.id, index],
  );
  const handlePress = useCallback(() => onPress(dream), [onPress, dream]);

  return (
    <View onLayout={handleLayout}>
      {dateLabel ? (
        <View style={styles.roomDateDivider}>
          <View style={styles.roomDateDividerLine} />
          <Text style={styles.roomDateDividerText}>{dateLabel}</Text>
          <View style={styles.roomDateDividerLine} />
        </View>
      ) : null}
      <View style={[styles.messageRow, isMine && styles.myMessageRow]}>
        {!isMine ? <Avatar member={sender} /> : null}
        <View style={[styles.messageBody, isMine && styles.myMessageBody]}>
          <Text style={[styles.senderName, isMine && styles.mySenderName]}>
            {senderName}
          </Text>
          <View
            style={[
              styles.dreamBubble,
              {
                width: cardWidth,
                height: cardHeight,
              },
            ]}
          >
            {isUpgraded ? (
              <DreamCard
                disableFlip
                dream={dream}
                giverName={sender.name}
                onPress={handlePress}
                preferThumbnail
                receiverName={receiver?.name}
                showImageActions={false}
                width={cardWidth}
              />
            ) : (
              <DreamCard
                variant="lite"
                dream={dream}
                giverName={sender.name}
                onPress={handlePress}
                receiverName={receiver?.name}
                width={cardWidth}
              />
            )}
          </View>
        </View>
      </View>
    </View>
  );
});

function InviteCodeCard({
  inSheet = false,
  inviteCode,
  onCollapse,
  onCopy,
  onShare,
}: {
  inSheet?: boolean;
  inviteCode?: string | null;
  onCollapse?: () => void;
  onCopy: () => void;
  onShare: () => void;
}) {
  return (
    <View style={[styles.roomInfo, inSheet && styles.sheetInviteCard]}>
      <View style={styles.inviteTextWrap}>
        <Text style={styles.infoLabel}>초대 코드</Text>
        <Text selectable style={styles.inviteCode}>
          {inviteCode ?? '초대 코드 없음'}
        </Text>
      </View>
      <View style={styles.inviteActions}>
        <Pressable
          accessibilityLabel="초대 코드 복사"
          accessibilityRole="button"
          onPress={onCopy}
          style={({ pressed }) => [
            styles.inviteActionButton,
            pressed && interactionStyles.pressed,
          ]}
        >
          <Copy color={colors.primary} size={19} />
        </Pressable>
        <Pressable
          accessibilityLabel="초대 코드 공유"
          accessibilityRole="button"
          onPress={onShare}
          style={({ pressed }) => [
            styles.inviteActionButton,
            pressed && interactionStyles.pressed,
          ]}
        >
          <Share2 color={colors.primary} size={19} />
        </Pressable>
        {onCollapse ? (
          <Pressable
            accessibilityLabel="초대 코드 접기"
            accessibilityRole="button"
            onPress={onCollapse}
            style={({ pressed }) => [
              styles.inviteActionButton,
              styles.inviteCollapseButton,
              pressed && interactionStyles.pressed,
            ]}
          >
            <ChevronUp color={colors.textMuted} size={18} strokeWidth={2.5} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function hasPendingImage(dreams?: Dream[]) {
  return dreams?.some(dream => isImagePending(dream)) ?? false;
}

function isImagePending(dream: Dream) {
  return dream.imageStatus === 'queued' || dream.imageStatus === 'generating';
}

function getDreamDateKey(dream: Dream) {
  const value = dream.givenAt ?? dream.createdAt;
  if (!value) {
    return 'unknown';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }
  return date.toISOString().slice(0, 10);
}

function formatRoomDateLabel(dateKey: string) {
  if (dateKey === 'unknown') {
    return '날짜 없음';
  }
  const [year, month, day] = dateKey.split('-');
  return `${year}.${month}.${day}`;
}

function Avatar({
  member,
}: {
  member: Pick<GroupMember, 'avatarColor' | 'name' | 'profileImageUrl'>;
}) {
  return (
    <View style={styles.avatar}>
      <ProfileAvatar
        fallbackColor={member.avatarColor}
        name={member.name}
        size={42}
        value={member.profileImageUrl}
      />
    </View>
  );
}

function buildInviteMessage(roomName: string, inviteCode: string) {
  return `꿈드림 꿈방 "${roomName}"에 초대합니다.\n초대 코드: ${inviteCode}\n\n꿈드림 앱에서 초대코드로 참가해 주세요.`;
}

function inviteCollapsedCacheKey(roomId: string, userId?: string | null) {
  return `${INVITE_COLLAPSED_CACHE_PREFIX}:${userId ?? 'local'}:${roomId}`;
}

function readInviteCollapsedState(roomId: string, userId?: string | null) {
  return readCache<boolean>(inviteCollapsedCacheKey(roomId, userId)) ?? false;
}

function writeInviteCollapsedState(
  roomId: string,
  userId: string | null | undefined,
  value: boolean,
) {
  writeCache(inviteCollapsedCacheKey(roomId, userId), value);
}

function buildCachedRoomDreamInfiniteData(page: CachedRoomDreamPage): InfiniteData<CachedRoomDreamPage, string | null> {
  return {
    pages: [page],
    pageParams: [null],
  };
}

function flattenRoomDreamPages(pages?: CachedRoomDreamPage[]) {
  if (!pages?.length) {
    return [];
  }

  const merged = new Map<string, Dream>();
  [...pages].reverse().forEach(page => {
    page.dreams.forEach(dream => {
      merged.set(dream.id, dream);
    });
  });
  return Array.from(merged.values());
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 42,
  },
  header: {
    minHeight: 78,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 22,
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontSize: 12,
    fontWeight: '700',
  },
  headerActions: {
    width: 96,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  roomInfo: {
    minHeight: 64,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 2,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.lavenderMist,
  },
  sheetInviteCard: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
  },
  inviteOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 12,
  },
  collapsedInviteWrap: {
    minHeight: 44,
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 2,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  collapsedInviteButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderMist,
    borderWidth: 1,
    borderColor: 'rgba(110, 91, 198, 0.16)',
  },
  inviteTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 8,
  },
  inviteActionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBase,
  },
  inviteCollapseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 253, 247, 0.72)',
  },
  inviteStatus: {
    marginHorizontal: 24,
    marginTop: 8,
    color: colors.primaryDark,
    fontFamily: fontFamily.handwritten,
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
  },
  sheetInviteStatus: {
    marginTop: -4,
    color: colors.primaryDark,
    fontFamily: fontFamily.handwritten,
    fontSize: 12,
    includeFontPadding: false,
  },
  timelineContainer: {
    flex: 1,
    position: 'relative',
  },
  timelineList: {
    flex: 1,
  },
  infoLabel: {
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 12,
    includeFontPadding: false,
  },
  inviteCode: {
    marginTop: 5,
    color: colors.primaryDark,
    fontFamily: fontFamily.handwritten,
    fontSize: 17,
    fontWeight: '700',
    includeFontPadding: false,
  },
  messages: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 0,
    gap: 22,
  },
  emptyMessages: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  dateDivider: {
    alignSelf: 'center',
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 16,
    includeFontPadding: false,
    marginBottom: 2,
  },
  historyLoadingText: {
    marginBottom: 10,
    textAlign: 'center',
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 12,
    includeFontPadding: false,
  },
  roomDateDivider: {
    marginTop: 4,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roomDateDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(154, 139, 120, 0.34)',
  },
  roomDateDividerText: {
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 12,
    includeFontPadding: false,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  messageBody: {
    flex: 1,
    maxWidth: '82%',
  },
  myMessageBody: {
    alignItems: 'flex-end',
  },
  senderName: {
    marginBottom: 8,
    marginLeft: 2,
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 13,
    includeFontPadding: false,
  },
  mySenderName: {
    marginRight: 2,
  },
  dreamBubble: {
    backgroundColor: 'transparent',
  },
  myDreamBubble: {
    backgroundColor: 'transparent',
  },
  previewWrap: {
    height: 182,
    backgroundColor: colors.lavenderTint,
    borderRadius: 8,
    borderWidth: 1.2,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderTint,
  },
  previewMood: {
    color: colors.primaryDark,
    fontSize: 30,
    fontWeight: '700',
    includeFontPadding: false,
  },
  bubbleText: {
    paddingHorizontal: 3,
    paddingTop: 9,
    gap: 7,
  },
  bubbleMeta: {
    color: colors.textMuted,
    fontSize: 10.5,
    fontWeight: '700',
    includeFontPadding: false,
  },
  bubbleTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 23,
    includeFontPadding: false,
  },
  bubbleSummary: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontSize: 13,
    lineHeight: 19,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptyBox: {
    borderRadius: 24,
    padding: 22,
    backgroundColor: colors.lavenderMist,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 20,
    includeFontPadding: false,
  },
  emptyText: {
    marginTop: 8,
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontSize: 14,
    lineHeight: 21,
  },
  loadingConversation: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingConversationText: {
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 14,
    includeFontPadding: false,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(40, 35, 63, 0.28)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 34,
    gap: 14,
    backgroundColor: colors.cardBase,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 22,
    includeFontPadding: false,
  },
  sheetSubtitle: {
    marginTop: 5,
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontWeight: '600',
    fontSize: 13,
    includeFontPadding: false,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderMist,
  },
  inputLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 14,
    includeFontPadding: false,
  },
  sheetInput: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    paddingHorizontal: 16,
    fontWeight: '700',
    fontSize: 17,
  },
  primaryAction: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  disabledAction: {
    opacity: 0.45,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 16,
    includeFontPadding: false,
  },
  dangerAction: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF0F4',
    borderWidth: 1,
    borderColor: '#F3C2D0',
  },
  dangerActionText: {
    color: '#B84A68',
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 15,
    includeFontPadding: false,
  },
  errorText: {
    color: colors.error,
    fontFamily: fontFamily.handwritten,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  memberList: {
    gap: 10,
  },
  memberItem: {
    minHeight: 62,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.lavenderMist,
  },
  memberText: {
    flex: 1,
  },
  memberName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 16,
    includeFontPadding: false,
  },
  memberRole: {
    marginTop: 4,
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
