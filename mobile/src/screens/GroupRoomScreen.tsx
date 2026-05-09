import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  Copy,
  Settings,
  UsersRound,
  X,
} from 'lucide-react-native';
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MoonAvatar } from '../components/MoonAvatar';
import { TagChip } from '../components/TagChip';
import {
  getCachedRoomDreams,
  getCachedRooms,
  leaveGroupRoom,
  loadRoomDreams,
  loadRooms,
  updateGroupRoom,
} from '../data/dreamRepository';
import { isCurrentUserId } from '../data/currentUser';
import { getDisplayMember } from '../data/members';
import type { RootStackParamList } from '../navigation/types';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';
import type { Dream } from '../types/dream';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupRoom'>;

export function GroupRoomScreen({ navigation, route }: Props) {
  const queryClient = useQueryClient();
  const token = useSessionStore(state => state.token);
  const sessionUserId = useSessionStore(state => state.userId);
  const [roomOverride, setRoomOverride] = useState<
    ReturnType<typeof getCachedRooms>[number] | null
  >(null);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isMembersVisible, setIsMembersVisible] = useState(false);
  const [roomNameDraft, setRoomNameDraft] = useState('');
  const [roomError, setRoomError] = useState<string | null>(null);
  const [isSavingRoom, setIsSavingRoom] = useState(false);
  const [isLeavingRoom, setIsLeavingRoom] = useState(false);
  const roomsQueryKey = ['rooms', sessionUserId, token] as const;
  const {
    data: rooms = getCachedRooms(sessionUserId),
    refetch: refetchRooms,
  } = useQuery({
    queryKey: roomsQueryKey,
    queryFn: () => loadRooms(token, sessionUserId),
    initialData: () => getCachedRooms(sessionUserId),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const cachedRoom = rooms.find(item => item.id === route.params.groupId);
  const room = roomOverride ?? cachedRoom;
  const title = room?.name ?? route.params.groupName ?? '꿈방';
  const description =
    room?.description ??
    route.params.description ??
    '아직 주고받은 꿈카드가 없습니다';
  const {
    data: dreams = getCachedRoomDreams(route.params.groupId, sessionUserId),
    refetch: refetchDreams,
  } = useQuery({
    queryKey: ['rooms', route.params.groupId, 'dreams', sessionUserId, token],
    queryFn: () => loadRoomDreams(route.params.groupId, token, sessionUserId),
    initialData: () => getCachedRoomDreams(route.params.groupId, sessionUserId),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const members =
    (room?.members ?? []).length > 0
      ? (room?.members ?? [])
      : (room?.memberIds ?? []).map(memberId =>
          getDisplayMember(memberId, sessionUserId),
        );

  useFocusEffect(
    useCallback(() => {
      refetchRooms().catch(() => undefined);
      refetchDreams().catch(() => undefined);
    }, [refetchDreams, refetchRooms]),
  );

  const openSettings = () => {
    setRoomNameDraft(title);
    setRoomError(null);
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
      setRoomError(error instanceof Error ? error.message : '꿈방 설정을 저장하지 못했어요.');
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
      setRoomError(error instanceof Error ? error.message : '꿈방을 나가지 못했어요.');
    } finally {
      setIsLeavingRoom(false);
    }
  };

  return (
    <View style={styles.root}>
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
            <UsersRound color={colors.textPrimary} size={21} strokeWidth={2.4} />
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

      <View style={styles.roomInfo}>
        <View>
          <Text style={styles.infoLabel}>초대 코드</Text>
          <Text selectable style={styles.inviteCode}>
            {room?.inviteCode ?? '초대 코드 없음'}
          </Text>
        </View>
        <Copy color={colors.primary} size={20} />
      </View>

      <FlatList
        data={dreams}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.messages,
          dreams.length === 0 && styles.emptyMessages,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>첫 꿈카드를 기다리는 중</Text>
            <Text style={styles.emptyText}>
              아래 메시지 창에서 짧은 인사를 함께 남길 수 있어요.
            </Text>
          </View>
        }
        ListHeaderComponent={
          dreams.length > 0 ? <Text style={styles.dateDivider}>오늘</Text> : null
        }
        renderItem={({ item }) => (
          <DreamMessage
            dream={item}
            onPress={() => navigation.navigate('DreamDetail', { dream: item })}
          />
        )}
      />

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
            {roomError ? <Text style={styles.errorText}>{roomError}</Text> : null}
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
                  <MoonAvatar size={42} color={member.avatarColor} />
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

function DreamMessage({
  dream,
  onPress,
}: {
  dream: Dream;
  onPress: () => void;
}) {
  const sessionUserId = useSessionStore(state => state.userId);
  const sender = getDisplayMember(dream.giverId, sessionUserId);
  const isMine = isCurrentUserId(dream.giverId, sessionUserId);
  const visibleTags = dream.tags.slice(0, 3);

  return (
    <View style={[styles.messageRow, isMine && styles.myMessageRow]}>
      {!isMine ? <Avatar color={sender.avatarColor} /> : null}
      <View style={[styles.messageBody, isMine && styles.myMessageBody]}>
        <Text style={[styles.senderName, isMine && styles.mySenderName]}>
          {sender.name}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [
            styles.dreamBubble,
            isMine && styles.myDreamBubble,
            pressed && interactionStyles.pressedSoft,
          ]}
        >
          <View style={styles.previewWrap}>
            {dream.thumbnailUrl || dream.imageUrl ? (
              <Image
                source={{
                  uri: dream.thumbnailUrl ?? dream.imageUrl ?? undefined,
                }}
                style={styles.previewImage}
              />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Text style={styles.previewMood}>{dream.mainMood}</Text>
              </View>
            )}
          </View>
          <View style={styles.bubbleText}>
            <Text style={styles.bubbleMeta}>
              {formatSentAt(dream.givenAt ?? dream.createdAt)}
            </Text>
            <Text style={styles.bubbleTitle}>{dream.title}</Text>
            <Text style={styles.bubbleSummary} numberOfLines={2}>
              {dream.summary}
            </Text>
            <View style={styles.tags}>
              {visibleTags.map(tag => (
                <TagChip key={tag} label={tag} />
              ))}
            </View>
          </View>
        </Pressable>
      </View>
      {isMine ? <Avatar color={sender.avatarColor} /> : null}
    </View>
  );
}

function Avatar({ color }: { color: string }) {
  return (
    <View style={styles.avatar}>
      <MoonAvatar size={42} color={color} />
    </View>
  );
}

function formatSentAt(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
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
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: '#EFEFF3',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
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
    borderColor: '#EFEFF3',
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
  infoLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
  },
  inviteCode: {
    marginTop: 5,
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: '700',
    includeFontPadding: false,
  },
  messages: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 18,
    gap: 22,
  },
  emptyMessages: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  dateDivider: {
    alignSelf: 'center',
    color: '#B3B3B8',
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
    marginBottom: 2,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
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
    fontSize: 13,
    fontWeight: '700',
    includeFontPadding: false,
  },
  mySenderName: {
    marginRight: 2,
  },
  dreamBubble: {
    overflow: 'hidden',
    borderRadius: 22,
    backgroundColor: colors.cardBase,
    shadowColor: colors.primary,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  myDreamBubble: {
    backgroundColor: colors.lavenderMist,
  },
  previewWrap: {
    height: 188,
    backgroundColor: colors.lavenderTint,
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
    padding: 16,
    gap: 8,
  },
  bubbleMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
  },
  bubbleTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    includeFontPadding: false,
  },
  bubbleSummary: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
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
    fontSize: 20,
    fontWeight: '700',
    includeFontPadding: false,
  },
  emptyText: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
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
    fontSize: 22,
    fontWeight: '700',
    includeFontPadding: false,
  },
  sheetSubtitle: {
    marginTop: 5,
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    includeFontPadding: false,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F3F4',
  },
  inputLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    includeFontPadding: false,
  },
  sheetInput: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    paddingHorizontal: 16,
    fontSize: 17,
    fontWeight: '700',
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
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },
  dangerAction: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF1F1',
    borderWidth: 1,
    borderColor: '#F1CACA',
  },
  dangerActionText: {
    color: '#B84A4A',
    fontSize: 15,
    fontWeight: '700',
    includeFontPadding: false,
  },
  errorText: {
    color: colors.error,
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
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },
  memberRole: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
