import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MessageCircle } from 'lucide-react-native';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DreamCard } from '../components/DreamCard';
import { getCurrentUserId, isCurrentUserId } from '../data/currentUser';
import { getDisplayMember } from '../data/members';
import type { RootStackParamList } from '../navigation/types';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';

type Props = NativeStackScreenProps<RootStackParamList, 'DreamDetail'>;

type DreamComment = {
  id: string;
  authorId: string;
  body: string;
};

const initialComments: DreamComment[] = [
  {
    id: 'comment-1',
    authorId: 'mock-user-2',
    body: '이 꿈은 색감이 너무 선명해서 카드로 보면 더 오래 기억될 것 같아.',
  },
  {
    id: 'comment-2',
    authorId: 'mock-user-3',
    body: '다시 읽으니까 장면이 이어지는 느낌이라 좋다.',
  },
];

export function DreamDetailScreen({ route }: Props) {
  const { dream } = route.params;
  const sessionUserId = useSessionStore(state => state.userId);
  const currentUserId = getCurrentUserId(sessionUserId);
  const [commentDraft, setCommentDraft] = useState('');
  const [comments, setComments] = useState(initialComments);
  const visibleComments = comments.filter(
    comment => comment.authorId !== dream.giverId,
  );
  const ownerComment =
    visibleComments.find(comment => comment.id === dream.ownerMainCommentId) ??
    visibleComments.find(comment => comment.authorId === dream.receiverId) ??
    null;
  const regularComments = visibleComments.filter(
    comment => comment.id !== ownerComment?.id,
  );
  const isSender = isCurrentUserId(dream.giverId, sessionUserId);
  const canSubmit = !isSender && commentDraft.trim().length > 0;

  const submitComment = () => {
    if (!canSubmit) {
      return;
    }

    setComments(currentComments => [
      ...currentComments,
      {
        id: `local-comment-${Date.now()}`,
        authorId: currentUserId,
        body: commentDraft.trim(),
      },
    ]);
    setCommentDraft('');
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <DreamCard dream={dream} size="full" />

      <View style={styles.commentBox}>
        <View style={styles.commentHeader}>
          <MessageCircle color={colors.primary} size={20} />
          <Text style={styles.commentTitle}>댓글</Text>
        </View>

        {ownerComment ? (
          <CommentItem comment={ownerComment} isOwner />
        ) : null}

        {regularComments.map(comment => (
          <CommentItem key={comment.id} comment={comment} />
        ))}

        {isSender ? (
          <View style={styles.commentNotice}>
            <Text style={styles.commentNoticeText}>
              꿈을 보낸 사람은 이 카드에 댓글을 남길 수 없어요.
            </Text>
          </View>
        ) : (
          <View style={styles.composer}>
            <TextInput
              value={commentDraft}
              onChangeText={setCommentDraft}
              multiline
              placeholder="댓글 쓰기"
              placeholderTextColor={colors.textMuted}
              style={styles.commentInput}
            />
            <Pressable
              accessibilityRole="button"
              disabled={!canSubmit}
              onPress={submitComment}
              style={({ pressed }) => [
                styles.commentSubmit,
                !canSubmit && styles.commentSubmitDisabled,
                pressed && canSubmit && interactionStyles.pressed,
              ]}
            >
              <Text style={styles.commentSubmitText}>등록</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function CommentItem({
  comment,
  isOwner = false,
}: {
  comment: DreamComment;
  isOwner?: boolean;
}) {
  const author = getDisplayMember(comment.authorId);

  return (
    <View style={[styles.commentItem, isOwner && styles.ownerCommentItem]}>
      <View style={styles.commentAuthorRow}>
        <Text style={styles.commentAuthor}>{author.name}</Text>
        {isOwner ? <Text style={styles.ownerBadge}>꿈주인</Text> : null}
      </View>
      <Text style={styles.commentText}>{comment.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 18,
  },
  commentBox: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 14,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  commentItem: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.lavenderMist,
  },
  ownerCommentItem: {
    backgroundColor: '#FFF8D8',
    borderWidth: 1,
    borderColor: '#F1D780',
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentAuthor: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  ownerBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    color: colors.primaryDark,
    backgroundColor: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    includeFontPadding: false,
  },
  commentText: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
  },
  composer: {
    gap: 10,
    paddingTop: 4,
  },
  commentInput: {
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: '#FFFFFF',
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: 'top',
  },
  commentSubmit: {
    alignSelf: 'flex-end',
    minWidth: 72,
    minHeight: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
  },
  commentSubmitDisabled: {
    opacity: 0.42,
  },
  commentSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    includeFontPadding: false,
  },
  commentNotice: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: '#F3F3F4',
  },
  commentNoticeText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
});
