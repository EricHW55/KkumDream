import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Camera,
  Copy,
  LogIn,
  PenLine,
  Plus,
  UsersRound,
  X,
} from 'lucide-react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { MoonAvatar } from '../components/MoonAvatar';
import { Screen } from '../components/Screen';
import {
  getCachedDream,
  getCachedRooms,
  loadRooms,
} from '../data/dreamRepository';
import { getCurrentUserId } from '../data/currentUser';
import { getDisplayMember } from '../data/members';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';
import type { GroupRoom } from '../types/group';

type Navigation = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;
type RoomSheetMode = 'menu' | 'created' | 'join';

function buildInviteCode() {
  return `DREAM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();
  const token = useSessionStore(state => state.token);
  const sessionUserId = useSessionStore(state => state.userId);
  const [isRoomSheetVisible, setIsRoomSheetVisible] = useState(false);
  const [roomSheetMode, setRoomSheetMode] = useState<RoomSheetMode>('menu');
  const [joinCode, setJoinCode] = useState('');
  const [createdRoom, setCreatedRoom] = useState<GroupRoom | null>(null);
  const [localRooms, setLocalRooms] = useState<GroupRoom[]>([]);
  const { data: syncedRooms = getCachedRooms() } = useQuery({
    queryKey: ['rooms', token],
    queryFn: () => loadRooms(token),
    initialData: getCachedRooms,
    staleTime: 60 * 1000,
  });
  const rooms = useMemo(
    () => [...localRooms, ...syncedRooms],
    [localRooms, syncedRooms],
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
    setJoinCode('');
    setIsRoomSheetVisible(true);
  };

  const createRoom = () => {
    const room: GroupRoom = {
      id: `local-create-${Date.now()}`,
      name: '새 꿈방',
      description: '첫 꿈카드를 기다리는 중',
      inviteCode: buildInviteCode(),
      lastActivityLabel: '새 방',
      unreadCount: 0,
      memberIds: [getCurrentUserId(sessionUserId)],
      latestDreamId: null,
    };

    setLocalRooms(currentRooms => [room, ...currentRooms]);
    setCreatedRoom(room);
    setRoomSheetMode('created');
  };

  const joinRoom = () => {
    const normalizedCode = joinCode.trim().toUpperCase();
    if (!normalizedCode) {
      return;
    }

    const existingRoom = rooms.find(room => room.inviteCode === normalizedCode);
    const room: GroupRoom =
      existingRoom ??
      ({
        id: `local-join-${Date.now()}`,
        name: '초대받은 꿈방',
        description: `${normalizedCode} 코드로 참가함`,
        inviteCode: normalizedCode,
        lastActivityLabel: '참가',
        unreadCount: 0,
        memberIds: [getCurrentUserId(sessionUserId)],
        latestDreamId: null,
      } satisfies GroupRoom);

    if (!existingRoom) {
      setLocalRooms(currentRooms => [room, ...currentRooms]);
    }

    setIsRoomSheetVisible(false);
    openRoom(room);
  };

  const enterCreatedRoom = () => {
    if (!createdRoom) {
      return;
    }

    setIsRoomSheetVisible(false);
    openRoom(createdRoom);
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
            accessibilityLabel="그룹방 추가"
            accessibilityRole="button"
            onPress={openRoomSheet}
            style={({ pressed }) => [
              styles.circleButton,
              pressed && interactionStyles.pressed,
            ]}
          >
            <Plus color={colors.textPrimary} size={28} strokeWidth={2.6} />
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
            <MoonAvatar size={48} color={colors.primary} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.helperText}>
            백엔드와 동기화된 꿈방이 여기에 표시됩니다.
          </Text>
        }
        renderItem={({ item }) => (
          <GroupRoomItem room={item} onPress={() => openRoom(item)} />
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
              <Text style={styles.sheetTitle}>그룹방</Text>
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

            {roomSheetMode === 'menu' ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  onPress={createRoom}
                  style={({ pressed }) => [
                    styles.sheetAction,
                    pressed && interactionStyles.pressedSoft,
                  ]}
                >
                  <View style={styles.actionIcon}>
                    <UsersRound color={colors.primary} size={22} />
                  </View>
                  <View style={styles.actionTextWrap}>
                    <Text style={styles.actionTitle}>그룹방 만들기</Text>
                    <Text style={styles.actionSubtitle}>
                      초대 코드를 만들어 친구를 초대합니다.
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
                    <Text style={styles.actionTitle}>초대 코드로 참가</Text>
                    <Text style={styles.actionSubtitle}>
                      받은 코드를 입력해 그룹방에 들어갑니다.
                    </Text>
                  </View>
                </Pressable>
              </>
            ) : null}

            {roomSheetMode === 'created' && createdRoom ? (
              <View style={styles.codePanel}>
                <Text style={styles.codeLabel}>참가 코드</Text>
                <View style={styles.inviteCodeRow}>
                  <Text selectable style={styles.inviteCode}>
                    {createdRoom.inviteCode}
                  </Text>
                  <Copy color={colors.primary} size={22} />
                </View>
                <Text style={styles.codeHelp}>
                  친구에게 이 코드를 보내면 같은 꿈방에 참가할 수 있습니다.
                </Text>
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
                <Text style={styles.codeLabel}>초대 코드 입력</Text>
                <TextInput
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={joinCode}
                  onChangeText={setJoinCode}
                  placeholder="예: SING-0503"
                  placeholderTextColor={colors.textMuted}
                  style={styles.codeInput}
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={!joinCode.trim()}
                  onPress={joinRoom}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    !joinCode.trim() && styles.disabledAction,
                    pressed && joinCode.trim() && interactionStyles.pressed,
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
  onPress,
}: {
  room: GroupRoom;
  onPress: () => void;
}) {
  const latestDream = room.latestDreamId
    ? getCachedDream(room.latestDreamId)
    : null;
  const members = room.memberIds
    .map(memberId => getDisplayMember(memberId))
    .slice(0, 3);

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
          {room.lastActivityLabel ? `${room.lastActivityLabel} ` : ''}
          {room.description}
        </Text>
      </View>
      <View style={styles.roomSide}>
        <View style={styles.memberStack}>
          {members.map((member, index) =>
            member ? (
              <View
                key={member.id}
                style={[
                  styles.memberDot,
                  index > 0 && styles.stackedMemberDot,
                ]}
              >
                <MoonAvatar size={27} color={member.avatarColor} />
              </View>
            ) : null,
          )}
        </View>
        <View style={styles.roomDivider} />
        {latestDream ? (
          <View style={styles.latestBadge}>
            <Text style={styles.latestMood}>
              {latestDream.mainMood.slice(0, 1)}
            </Text>
          </View>
        ) : (
          <Camera color="#000000" size={24} fill="#000000" />
        )}
      </View>
    </Pressable>
  );
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
    fontSize: 34,
    fontWeight: '800',
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: 8,
    color: colors.textMuted,
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
    backgroundColor: '#F2F2F4',
  },
  profileBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 4,
    borderColor: '#F2F2F4',
  },
  helperText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginBottom: 14,
  },
  list: {
    gap: 14,
    paddingBottom: 120,
  },
  roomItem: {
    minHeight: 96,
    borderRadius: 28,
    backgroundColor: '#F3F3F4',
    paddingHorizontal: 22,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roomText: {
    flex: 1,
    paddingRight: 12,
  },
  roomName: {
    color: '#000000',
    fontSize: 24,
    fontWeight: '800',
    includeFontPadding: false,
  },
  roomMeta: {
    marginTop: 8,
    color: colors.textMuted,
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
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E5E8',
    overflow: 'hidden',
  },
  stackedMemberDot: {
    marginLeft: -8,
  },
  roomDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#D9D9DE',
  },
  latestBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBase,
  },
  latestMood: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: '800',
    includeFontPadding: false,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '800',
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
  inviteCode: {
    color: colors.primaryDark,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
    includeFontPadding: false,
  },
  codeHelp: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  codeInput: {
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.divider,
    color: colors.textPrimary,
    backgroundColor: '#FFFFFF',
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
    fontWeight: '800',
    includeFontPadding: false,
  },
});
