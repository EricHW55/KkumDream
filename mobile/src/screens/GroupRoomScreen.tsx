import type { NativeStackScreenProps } from '@react-navigation/native-stack';
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

import { TagChip } from '../components/TagChip';
import { MoonAvatar } from '../components/MoonAvatar';
import {
  getDream,
  getGroupMessages,
  getGroupRoom,
  getMember,
} from '../mocks/groups';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import type { GroupDreamMessage } from '../types/group';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupRoom'>;

export function GroupRoomScreen({ navigation, route }: Props) {
  const room = getGroupRoom(route.params.groupId);
  const title = room?.name ?? route.params.groupName ?? '새 꿈방';
  const description =
    room?.description ??
    route.params.description ??
    '아직 도착한 꿈카드가 없습니다';
  const messages = getGroupMessages(route.params.groupId);

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
          style={styles.backButton}
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
        data={messages}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.messages,
          messages.length === 0 && styles.emptyMessages,
        ]}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>첫 꿈카드를 기다리는 중</Text>
            <Text style={styles.emptyText}>
              아래 메시지 창에서 짧은 인사를 남길 수 있어요.
            </Text>
          </View>
        }
        ListHeaderComponent={
          messages.length > 0 ? (
            <Text style={styles.dateDivider}>일, 5월 3</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <DreamMessage
            message={item}
            onPress={() =>
              navigation.navigate('DreamDetail', {
                dream: getDream(item.dreamId),
              })
            }
          />
        )}
      />

      <View style={styles.composer}>
        <TextInput
          placeholder="메시지"
          placeholderTextColor={colors.textMuted}
          style={styles.messageInput}
        />
        <Pressable accessibilityRole="button" style={styles.sendButton}>
          <ArrowUp color={colors.textSecondary} size={24} strokeWidth={2.8} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function DreamMessage({
  message,
  onPress,
}: {
  message: GroupDreamMessage;
  onPress: () => void;
}) {
  const dream = getDream(message.dreamId);
  const sender = getMember(message.senderId);
  const isMine = sender.id === 'mock-user-1';
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
            pressed && styles.pressedBubble,
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
            <Text style={styles.bubbleMeta}>{message.sentAtLabel}</Text>
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
  pressedBubble: {
    opacity: 0.88,
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
