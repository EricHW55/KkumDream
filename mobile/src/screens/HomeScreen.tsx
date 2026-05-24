import { useCallback, useState } from 'react';
import {
  Clipboard,
  FlatList,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Copy,
  LogIn,
  PenLine,
  Plus,
  Share2,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ProfileAvatar } from '../components/ProfileAvatar';
import { Screen } from '../components/Screen';
import {
  createGroupRoom,
  getCachedRooms,
  joinGroupRoom,
  loadRooms,
} from '../data/dreamRepository';
import { getDisplayMember } from '../data/members';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';
import { fontFamily } from '../theme/typography';
import type { GroupRoom } from '../types/group';

type Navigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type RoomSheetMode = 'menu' | 'create' | 'created' | 'join';

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const queryClient = useQueryClient();
  const token = useSessionStore(state => state.token);
  const sessionUserId = useSessionStore(state => state.userId);
  const user = useSessionStore(state => state.user);
  const [isRoomSheetVisible, setIsRoomSheetVisible] = useState(false);
  const [roomSheetMode, setRoomSheetMode] = useState<RoomSheetMode>('menu');
  const [roomNameDraft, setRoomNameDraft] = useState('새 꿈방');
  const [joinCode, setJoinCode] = useState('');
  const [createdRoom, setCreatedRoom] = useState<GroupRoom | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [isRoomActionPending, setIsRoomActionPending] = useState(false);
  const roomsQueryKey = ['rooms', sessionUserId, token] as const;
  const { data: rooms = getCachedRooms(sessionUserId), refetch: refetchRooms } =
    useQuery({
      queryKey: roomsQueryKey,
      queryFn: () => loadRooms(token, sessionUserId),
      initialData: () => getCachedRooms(sessionUserId),
      staleTime: 0,
      refetchOnMount: 'always',
    });

  useFocusEffect(
    useCallback(() => {
      refetchRooms().catch(() => undefined);
    }, [refetchRooms]),
  );

  const openRoom = (room: GroupRoom) => {
    navigation.navigate('GroupRoom', {
      groupId: room.id,
      groupName: room.name,
      description: room.description,
    });
  };

  const openRoomSheet = () => {
    setRoomSheetMode('menu');
    setCreatedRoom(null);
    setRoomNameDraft('새 꿈방');
    setJoinCode('');
    setRoomError(null);
    setInviteStatus(null);
    setIsRoomSheetVisible(true);
  };

  const createRoom = async () => {
    if (!token) {
      setRoomError('로그인이 필요합니다.');
      return;
    }

    setRoomError(null);
    setIsRoomActionPending(true);
    try {
      const roomName = roomNameDraft.trim() || '새 꿈방';
      const room = await createGroupRoom(roomName, token, sessionUserId);
      queryClient.setQueryData<GroupRoom[]>(roomsQueryKey, currentRooms =>
        upsertRoom(currentRooms ?? [], room),
      );
      setCreatedRoom(room);
      setRoomSheetMode('created');
    } catch (error) {
      setRoomError(
        error instanceof Error ? error.message : '꿈방을 만들지 못했어요.',
      );
    } finally {
      setIsRoomActionPending(false);
    }
  };

  const joinRoom = async () => {
    const normalizedCode = joinCode.trim().toUpperCase();
    if (!normalizedCode) {
      return;
    }

    const existingRoom = rooms.find(room => room.inviteCode === normalizedCode);
    if (existingRoom) {
      setIsRoomSheetVisible(false);
      openRoom(existingRoom);
      return;
    }

    if (!token) {
      setRoomError('로그인이 필요합니다.');
      return;
    }

    setRoomError(null);
    setIsRoomActionPending(true);
    try {
      const room = await joinGroupRoom(normalizedCode, token, sessionUserId);
      queryClient.setQueryData<GroupRoom[]>(roomsQueryKey, currentRooms =>
        upsertRoom(currentRooms ?? [], room),
      );
      setIsRoomSheetVisible(false);
      openRoom(room);
    } catch (error) {
      setRoomError(
        error instanceof Error
          ? error.message
          : '초대코드를 확인하지 못했어요.',
      );
    } finally {
      setIsRoomActionPending(false);
    }
  };

  const enterCreatedRoom = () => {
    if (!createdRoom) {
      return;
    }

    setIsRoomSheetVisible(false);
    openRoom(createdRoom);
  };

  const copyInviteCode = (room: GroupRoom) => {
    Clipboard.setString(room.inviteCode);
    setInviteStatus('초대 코드를 복사했어요.');
  };

  const shareInviteCode = async (room: GroupRoom) => {
    try {
      await Share.share({
        title: `${room.name} 초대`,
        message: buildInviteMessage(room),
      });
    } catch (error) {
      setInviteStatus(
        error instanceof Error
          ? error.message
          : '초대 코드를 공유하지 못했어요.',
      );
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.wordmark}>꿈드림</Text>
          <Text style={styles.subtitle}>함께 꿈을 주고받는 방</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityLabel="꿈 작성"
            accessibilityRole="button"
            onPress={() => navigation.navigate('Compose')}
            style={({ pressed }) => [
              styles.circleButton,
              pressed && interactionStyles.pressed,
            ]}
          >
            <PenLine color={colors.textPrimary} size={26} strokeWidth={2.5} />
          </Pressable>
          <Pressable
            accessibilityLabel="내 정보"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => navigation.navigate('Profile')}
            style={({ pressed }) => [
              styles.profileBadge,
              pressed && interactionStyles.pressed,
            ]}
          >
            <ProfileAvatar
              value={user?.profileImageUrl}
              name={user?.nickname}
              size={48}
            />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.list,
          rooms.length === 0 && styles.emptyList,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>현재 가입된 꿈방이 없습니다.</Text>
            <Text style={styles.emptyText}>
              초대코드로 들어가거나 새 꿈방을 만들어보세요.
            </Text>
          </View>
        }
        ListFooterComponent={
          <Pressable
            accessibilityLabel="꿈방 참가 또는 생성"
            accessibilityRole="button"
            onPress={openRoomSheet}
            style={({ pressed }) => [
              styles.addRoomFooter,
              pressed && interactionStyles.pressed,
            ]}
          >
            <View style={styles.addRoomIcon}>
              <Plus color={colors.primaryDark} size={24} strokeWidth={2.6} />
            </View>
            <View style={styles.addRoomText}>
              <Text style={styles.addRoomTitle}>꿈방 참가 또는 생성</Text>
              <Text style={styles.addRoomSubtitle}>
                초대코드로 들어가거나 새 꿈방을 만들 수 있어요.
              </Text>
            </View>
          </Pressable>
        }
        renderItem={({ item }) => (
          <GroupRoomItem
            room={item}
            sessionUserId={sessionUserId}
            onPress={() => openRoom(item)}
          />
        )}
      />

      <Modal
        animationType="fade"
        transparent
        visible={isRoomSheetVisible}
        onRequestClose={() => setIsRoomSheetVisible(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setIsRoomSheetVisible(false)}
        >
          <Pressable
            style={styles.sheet}
            onPress={event => event.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>꿈방</Text>
              <Pressable
                accessibilityLabel="닫기"
                accessibilityRole="button"
                onPress={() => setIsRoomSheetVisible(false)}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && interactionStyles.pressed,
                ]}
              >
                <X color={colors.textSecondary} size={20} />
              </Pressable>
            </View>

            {roomError ? (
              <Text style={styles.errorText}>{roomError}</Text>
            ) : null}

            {roomSheetMode === 'menu' ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  disabled={isRoomActionPending}
                  onPress={() => setRoomSheetMode('create')}
                  style={({ pressed }) => [
                    styles.sheetAction,
                    isRoomActionPending && styles.disabledAction,
                    pressed && interactionStyles.pressedSoft,
                  ]}
                >
                  <View style={styles.actionIcon}>
                    <UsersRound color={colors.primary} size={22} />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <Text style={styles.actionTitle}>꿈방 만들기</Text>
                    <Text style={styles.actionSubtitle}>
                      DB에 새 꿈방을 만들고 초대코드를 발급합니다.
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => setRoomSheetMode('join')}
                  style={({ pressed }) => [
                    styles.sheetAction,
                    pressed && interactionStyles.pressedSoft,
                  ]}
                >
                  <View style={styles.actionIcon}>
                    <LogIn color={colors.primary} size={22} />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <Text style={styles.actionTitle}>초대코드로 참가</Text>
                    <Text style={styles.actionSubtitle}>
                      받은 초대코드를 입력해 같은 꿈방에 들어갑니다.
                    </Text>
                  </View>
                </Pressable>
              </>
            ) : null}

            {roomSheetMode === 'create' ? (
              <View style={styles.codePanel}>
                <Text style={styles.codeLabel}>꿈방 이름</Text>
                <TextInput
                  autoCorrect={false}
                  spellCheck={false}
                  defaultValue={roomNameDraft}
                  onChangeText={setRoomNameDraft}
                  placeholder="꿈방 이름"
                  placeholderTextColor={colors.textMuted}
                  style={styles.codeInput}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={isRoomActionPending}
                  onPress={createRoom}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    isRoomActionPending && styles.disabledAction,
                    pressed &&
                      !isRoomActionPending &&
                      interactionStyles.pressed,
                  ]}
                >
                  <Text style={styles.primaryActionText}>
                    {isRoomActionPending ? '만드는 중...' : '꿈방 만들기'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {roomSheetMode === 'created' && createdRoom ? (
              <View style={styles.codePanel}>
                <Text style={styles.codeLabel}>초대코드</Text>
                <View style={styles.inviteCodeRow}>
                  <Text selectable style={styles.inviteCode}>
                    {createdRoom.inviteCode}
                  </Text>
                  <Pressable
                    accessibilityLabel="초대 코드 복사"
                    accessibilityRole="button"
                    onPress={() => copyInviteCode(createdRoom)}
                    style={({ pressed }) => [
                      styles.codeIconButton,
                      pressed && interactionStyles.pressed,
                    ]}
                  >
                    <Copy color={colors.primary} size={21} />
                  </Pressable>
                </View>
                <Text style={styles.codeHelp}>
                  친구에게 이 코드를 보내면 같은 꿈방에 참가할 수 있어요.
                </Text>
                {inviteStatus ? (
                  <Text style={styles.statusText}>{inviteStatus}</Text>
                ) : null}
                <View style={styles.inviteActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => copyInviteCode(createdRoom)}
                    style={({ pressed }) => [
                      styles.secondaryAction,
                      pressed && interactionStyles.pressed,
                    ]}
                  >
                    <Copy color={colors.primary} size={18} />
                    <Text style={styles.secondaryActionText}>복사</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => shareInviteCode(createdRoom)}
                    style={({ pressed }) => [
                      styles.secondaryAction,
                      pressed && interactionStyles.pressed,
                    ]}
                  >
                    <Share2 color={colors.primary} size={18} />
                    <Text style={styles.secondaryActionText}>공유</Text>
                  </Pressable>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={enterCreatedRoom}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    pressed && interactionStyles.pressed,
                  ]}
                >
                  <Text style={styles.primaryActionText}>방 들어가기</Text>
                </Pressable>
              </View>
            ) : null}

            {roomSheetMode === 'join' ? (
              <View style={styles.codePanel}>
                <Text style={styles.codeLabel}>초대코드 입력</Text>
                <TextInput
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={joinCode}
                  onChangeText={setJoinCode}
                  placeholder="예: DREAM-ABC123"
                  placeholderTextColor={colors.textMuted}
                  style={styles.codeInput}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={!joinCode.trim() || isRoomActionPending}
                  onPress={joinRoom}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    (!joinCode.trim() || isRoomActionPending) &&
                      styles.disabledAction,
                    pressed &&
                      joinCode.trim() &&
                      !isRoomActionPending &&
                      interactionStyles.pressed,
                  ]}
                >
                  <Text style={styles.primaryActionText}>참가하기</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function GroupRoomItem({
  room,
  sessionUserId,
  onPress,
}: {
  room: GroupRoom;
  sessionUserId?: string | null;
  onPress: () => void;
}) {
  const todayGiverIds = room.todayGiverIds ?? [];
  const uploaders = todayGiverIds
    .slice(0, 3)
    .map(giverId => resolveRoomMember(room, giverId, sessionUserId));
  const latestGiverId = todayGiverIds[0] ?? null;
  const latestUploader = latestGiverId
    ? resolveRoomMember(room, latestGiverId, sessionUserId)
    : null;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.roomItem,
        pressed && interactionStyles.pressedSoft,
      ]}
    >
      <View style={styles.roomText}>
        <Text style={styles.roomName}>{room.name}</Text>
        <Text style={styles.roomMeta} numberOfLines={1}>
          {room.lastActivityLabel ? `${room.lastActivityLabel} · ` : ''}
          {room.description}
        </Text>
      </View>
      <View style={styles.roomSide}>
        <View style={styles.memberStack}>
          {uploaders.map((member, index) => (
            <View
              key={member.id}
              style={[styles.memberDot, index > 0 && styles.stackedMemberDot]}
            >
              <RoomMemberAvatar member={member} size={27} />
            </View>
          ))}
        </View>
        <View style={styles.roomDivider} />
        {latestUploader ? (
          <View style={styles.latestBadge}>
            <RoomMemberAvatar member={latestUploader} size={36} />
          </View>
        ) : (
          <View style={styles.emptyDreamBadge}>
            <Sparkles color={colors.primaryDark} size={22} strokeWidth={2.4} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

function resolveRoomMember(
  room: GroupRoom,
  memberId: string,
  sessionUserId?: string | null,
) {
  return (
    (room.members ?? []).find(member => member.id === memberId) ??
    getDisplayMember(memberId, sessionUserId)
  );
}

function RoomMemberAvatar({
  member,
  size,
}: {
  member: {
    avatarColor: string;
    name: string;
    profileImageUrl?: string | null;
  };
  size: number;
}) {
  return (
    <ProfileAvatar
      value={member.profileImageUrl}
      name={member.name}
      size={size}
      fallbackColor={member.avatarColor}
    />
  );
}

function upsertRoom(rooms: GroupRoom[], room: GroupRoom) {
  return [room, ...rooms.filter(item => item.id !== room.id)];
}

function buildInviteMessage(room: GroupRoom) {
  return `꿈드림 꿈방 "${room.name}"에 초대합니다.\n초대 코드: ${room.inviteCode}\n\n꿈드림 앱에서 초대코드로 참가해 주세요.`;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  wordmark: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 34,
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: 8,
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontSize: 15,
    fontWeight: '700',
    includeFontPadding: false,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  circleButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderMist,
  },
  profileBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: colors.lavenderTint,
  },
  list: {
    gap: 14,
    paddingBottom: 120,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
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
  addRoomFooter: {
    minHeight: 82,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.lavenderTint,
    borderWidth: 1,
    borderColor: colors.primaryLight,
  },
  addRoomIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderMist,
  },
  addRoomText: {
    flex: 1,
  },
  addRoomTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 17,
    includeFontPadding: false,
  },
  addRoomSubtitle: {
    marginTop: 5,
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
  },
  roomItem: {
    minHeight: 96,
    borderRadius: 28,
    backgroundColor: colors.lavenderMist,
    paddingHorizontal: 22,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  roomText: {
    flex: 1,
    paddingRight: 12,
  },
  roomName: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 24,
    includeFontPadding: false,
  },
  roomMeta: {
    marginTop: 8,
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  roomSide: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  memberStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberDot: {
    width: 29,
    height: 29,
    borderRadius: 14.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBase,
    borderWidth: 2,
    borderColor: colors.lavenderTint,
    overflow: 'hidden',
  },
  stackedMemberDot: {
    marginLeft: -8,
  },
  roomDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.lavenderTint,
  },
  latestBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBase,
    overflow: 'hidden',
  },
  latestMood: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },
  emptyDreamBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBase,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(40, 35, 63, 0.28)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.cardBase,
    padding: 22,
    paddingBottom: 34,
    gap: 14,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
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
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    padding: 16,
    backgroundColor: colors.lavenderMist,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBase,
  },
  actionTextWrap: {
    flex: 1,
  },
  actionTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    includeFontPadding: false,
  },
  actionSubtitle: {
    marginTop: 5,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  codePanel: {
    gap: 14,
  },
  codeLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },
  inviteCodeRow: {
    minHeight: 64,
    borderRadius: 18,
    backgroundColor: colors.lavenderMist,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  codeIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBase,
  },
  inviteCode: {
    color: colors.primaryDark,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 1,
    includeFontPadding: false,
  },
  codeHelp: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  statusText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.lavenderMist,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '700',
    includeFontPadding: false,
  },
  codeInput: {
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.divider,
    color: colors.textPrimary,
    backgroundColor: colors.cardBase,
    paddingHorizontal: 16,
    fontSize: 18,
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
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
