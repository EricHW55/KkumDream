import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, PencilLine, X } from 'lucide-react-native';

import { DreamCard } from '../components/DreamCard';
import { MoonAvatar } from '../components/MoonAvatar';
import { PrimaryButton } from '../components/PrimaryButton';
import { buildMockDraft } from '../mocks/dreams';
import { getGroupRoom, getMember, mockGroupRooms } from '../mocks/groups';
import { colors } from '../theme/colors';
import type { Dream } from '../types/dream';

const moods = ['몽환', '판타지', '공포', '코믹', '따뜻함', '추억', '기괴함'];
const currentUserId = 'mock-user-1';

export function ComposeScreen() {
  const [rawInput, setRawInput] = useState('');
  const [mood, setMood] = useState('몽환');
  const [draft, setDraft] = useState<Dream | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editStory, setEditStory] = useState('');
  const [isRecipientModalVisible, setIsRecipientModalVisible] = useState(false);
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(
    null,
  );
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const friends = useMemo(() => {
    const memberIds = new Set<string>();

    mockGroupRooms.forEach(room => {
      room.memberIds.forEach(memberId => {
        if (memberId !== currentUserId) {
          memberIds.add(memberId);
        }
      });
    });

    return Array.from(memberIds).map(memberId => getMember(memberId));
  }, []);

  const availableGroups = useMemo(() => {
    if (!selectedReceiverId) {
      return [];
    }

    return mockGroupRooms.filter(
      room =>
        room.memberIds.includes(currentUserId) &&
        room.memberIds.includes(selectedReceiverId),
    );
  }, [selectedReceiverId]);

  const canGenerate = rawInput.trim().length > 0;
  const selectedReceiver = selectedReceiverId
    ? getMember(selectedReceiverId)
    : null;
  const selectedGroup = selectedGroupId ? getGroupRoom(selectedGroupId) : null;

  const createPreview = () => {
    const nextDraft = buildMockDraft(rawInput.trim(), mood);
    setDraft(nextDraft);
    setEditTitle(nextDraft.title);
    setEditStory(nextDraft.story);
    setIsEditOpen(false);
  };

  const openEdit = () => {
    if (!draft) {
      return;
    }

    setEditTitle(draft.title);
    setEditStory(draft.story);
    setIsEditOpen(true);
  };

  const saveEdit = () => {
    setDraft(currentDraft =>
      currentDraft
        ? {
            ...currentDraft,
            title: editTitle.trim() || currentDraft.title,
            story: editStory.trim() || currentDraft.story,
            summary: editStory.trim().slice(0, 48) || currentDraft.summary,
          }
        : currentDraft,
    );
    setIsEditOpen(false);
  };

  const chooseReceiver = (memberId: string) => {
    setSelectedReceiverId(memberId);
    const firstAvailableGroup = mockGroupRooms.find(
      room =>
        room.memberIds.includes(currentUserId) &&
        room.memberIds.includes(memberId),
    );
    setSelectedGroupId(firstAvailableGroup?.id ?? null);
  };

  const confirmRecipient = () => {
    if (!selectedReceiverId || !selectedGroupId) {
      return;
    }

    setDraft(currentDraft =>
      currentDraft
        ? {
            ...currentDraft,
            receiverId: selectedReceiverId,
            groupId: selectedGroupId,
            status: 'given',
            givenAt: new Date().toISOString(),
          }
        : currentDraft,
    );
    setIsRecipientModalVisible(false);
  };

  return (
    <ScrollView
      style={styles.root}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
    >
      <Text style={styles.label}>오늘 꾼 꿈</Text>
      <TextInput
        value={rawInput}
        onChangeText={setRawInput}
        multiline
        maxLength={500}
        textAlignVertical="top"
        placeholder="꿈에서 본 장면을 짧게 적어보세요."
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

      <Text style={styles.label}>무드</Text>
      <View style={styles.moodGrid}>
        {moods.map(item => (
          <Text
            key={item}
            onPress={() => setMood(item)}
            style={[styles.mood, item === mood && styles.moodActive]}
          >
            {item}
          </Text>
        ))}
      </View>

      <PrimaryButton disabled={!canGenerate} onPress={createPreview}>
        카드 미리보기 만들기
      </PrimaryButton>

      {draft ? (
        <View style={styles.preview}>
          <View style={styles.previewHeader}>
            <View>
              <Text style={styles.previewTitle}>미리보기</Text>
              <Text style={styles.previewMeta}>
                {selectedReceiver && selectedGroup
                  ? `${selectedReceiver.name}에게, ${selectedGroup.name}에 공유`
                  : '받는 사람과 공유할 그룹방을 선택하세요.'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={openEdit}
              style={styles.editButton}
            >
              <PencilLine color={colors.primary} size={18} />
              <Text style={styles.editButtonText}>수정</Text>
            </Pressable>
          </View>

          {isEditOpen ? (
            <View style={styles.editPanel}>
              <Text style={styles.editLabel}>카드 제목</Text>
              <TextInput
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="카드 제목"
                placeholderTextColor={colors.textMuted}
                style={styles.editInput}
              />
              <Text style={styles.editLabel}>뒷면 내용</Text>
              <TextInput
                value={editStory}
                onChangeText={setEditStory}
                multiline
                textAlignVertical="top"
                placeholder="카드 뒷면에 들어갈 꿈 이야기"
                placeholderTextColor={colors.textMuted}
                style={[styles.editInput, styles.storyInput]}
              />
              <PrimaryButton onPress={saveEdit}>수정 저장</PrimaryButton>
            </View>
          ) : null}

          <DreamCard dream={draft} />
          <PrimaryButton onPress={() => setIsRecipientModalVisible(true)}>
            받는 사람 선택하기
          </PrimaryButton>
        </View>
      ) : null}

      <Modal
        animationType="fade"
        transparent
        visible={isRecipientModalVisible}
        onRequestClose={() => setIsRecipientModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsRecipientModalVisible(false)}
        >
          <Pressable
            style={styles.recipientSheet}
            onPress={event => event.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>받는 사람 선택</Text>
                <Text style={styles.sheetSubtitle}>
                  친구 한 명을 고른 뒤, 그 친구가 포함된 그룹방에 공유합니다.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="닫기"
                accessibilityRole="button"
                onPress={() => setIsRecipientModalVisible(false)}
                style={styles.closeButton}
              >
                <X color={colors.textSecondary} size={20} />
              </Pressable>
            </View>

            <Text style={styles.sectionTitle}>친구</Text>
            <View style={styles.friendList}>
              {friends.map(friend => (
                <Pressable
                  key={friend.id}
                  accessibilityRole="button"
                  onPress={() => chooseReceiver(friend.id)}
                  style={[
                    styles.friendItem,
                    selectedReceiverId === friend.id && styles.selectedItem,
                  ]}
                >
                  <MoonAvatar size={38} color={friend.avatarColor} />
                  <Text style={styles.friendName}>{friend.name}</Text>
                  {selectedReceiverId === friend.id ? (
                    <Check color={colors.primary} size={20} />
                  ) : null}
                </Pressable>
              ))}
            </View>

            <Text style={styles.sectionTitle}>공유할 그룹방</Text>
            <View style={styles.groupList}>
              {availableGroups.map(room => (
                <Pressable
                  key={room.id}
                  accessibilityRole="button"
                  onPress={() => setSelectedGroupId(room.id)}
                  style={[
                    styles.groupItem,
                    selectedGroupId === room.id && styles.selectedItem,
                  ]}
                >
                  <View style={styles.groupText}>
                    <Text style={styles.groupName}>{room.name}</Text>
                    <Text style={styles.groupMeta} numberOfLines={1}>
                      {room.memberIds
                        .map(memberId => getMember(memberId).name)
                        .join(', ')}
                    </Text>
                  </View>
                  {selectedGroupId === room.id ? (
                    <Check color={colors.primary} size={20} />
                  ) : null}
                </Pressable>
              ))}
              {selectedReceiverId && availableGroups.length === 0 ? (
                <Text style={styles.emptyText}>
                  선택한 친구가 포함된 그룹방이 없습니다.
                </Text>
              ) : null}
            </View>

            <PrimaryButton
              disabled={!selectedReceiverId || !selectedGroupId}
              onPress={confirmRecipient}
            >
              선택 완료
            </PrimaryButton>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    includeFontPadding: false,
  },
  input: {
    minHeight: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.cardBase,
    padding: 16,
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 24,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mood: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    color: colors.textSecondary,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
    fontWeight: '700',
  },
  moodActive: {
    color: '#FFFFFF',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  preview: {
    gap: 16,
    paddingTop: 8,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  previewTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    includeFontPadding: false,
  },
  previewMeta: {
    marginTop: 5,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  editButton: {
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lavenderMist,
  },
  editButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
    includeFontPadding: false,
  },
  editPanel: {
    borderRadius: 20,
    padding: 16,
    gap: 10,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  editLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    includeFontPadding: false,
  },
  editInput: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  storyInput: {
    minHeight: 140,
    paddingTop: 14,
    lineHeight: 22,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  recipientSheet: {
    maxHeight: '86%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 34,
    gap: 14,
    backgroundColor: colors.cardBase,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
  },
  sheetTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    includeFontPadding: false,
  },
  sheetSubtitle: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F3F4',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    includeFontPadding: false,
  },
  friendList: {
    gap: 10,
  },
  friendItem: {
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.lavenderMist,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  selectedItem: {
    borderColor: colors.primary,
    backgroundColor: '#F7F3FF',
  },
  friendName: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    includeFontPadding: false,
  },
  groupList: {
    gap: 10,
  },
  groupItem: {
    minHeight: 64,
    borderRadius: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.lavenderMist,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  groupText: {
    flex: 1,
  },
  groupName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    includeFontPadding: false,
  },
  groupMeta: {
    marginTop: 5,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
});
