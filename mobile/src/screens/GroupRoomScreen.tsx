import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { ArrowUp, ChevronLeft } from 'lucide-react-native';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
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
  loadRoomDreams,
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
  const token = useSessionStore(state => state.token);
  const sessionUserId = useSessionStore(state => state.userId);
  const room = getCachedRooms(sessionUserId).find(
    item => item.id === route.params.groupId,
  );
  const title = room?.name ?? route.params.groupName ?? '꿈방';
  const description =
    room?.description ??
    route.params.description ??
    '아직 주고받은 꿈카드가 없습니다';
  const { data: dreams = getCachedRoomDreams(route.params.groupId, sessionUserId) } = useQuery({
    queryKey: ['rooms', route.params.groupId, 'dreams', sessionUserId, token],
    queryFn: () => loadRoomDreams(route.params.groupId, token, sessionUserId),
    initialData: () => getCachedRoomDreams(route.params.groupId, sessionUserId),
    staleTime: 60 * 1000,
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
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
        <View style={styles.headerSpacer} />
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

      <View style={styles.composer}>
        <TextInput
          placeholder="메시지"
          placeholderTextColor={colors.textMuted}
          style={styles.messageInput}
        />
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.sendButton,
            pressed && interactionStyles.pressed,
          ]}
        >
          <ArrowUp color={colors.textSecondary} size={24} strokeWidth={2.8} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
    fontWeight: '800',
    includeFontPadding: false,
  },
  subtitle: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  headerSpacer: {
    width: 56,
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
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '800',
    includeFontPadding: false,
  },
  emptyText: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: '#EFEFF3',
  },
  messageInput: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E7E7ED',
    backgroundColor: colors.cardBase,
    paddingHorizontal: 20,
    color: colors.textPrimary,
    fontSize: 18,
  },
  sendButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7E7EA',
  },
});
