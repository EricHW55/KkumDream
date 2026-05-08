import { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
import { addDreamComment, fetchDreamComments } from '../api/dreams';
import { getCurrentUserId, isCurrentUserId } from '../data/currentUser';
import { getDisplayMember } from '../data/members';
import type { RootStackParamList } from '../navigation/types';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';
import type { DreamComment } from '../types/dream';

type Props = NativeStackScreenProps<RootStackParamList, 'DreamDetail'>;

const initialComments: DreamComment[] = [
  {
    id: 'comment-1',
    dreamId: 'mock-dream',
    authorId: 'mock-user-2',
    authorNickname: '유하람',
    authorProfileImageUrl: null,
    content: '이 꿈은 색감이 너무 선명해서 카드로 보면 더 오래 기억될 것 같아.',
    isOwnerMain: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'comment-2',
    dreamId: 'mock-dream',
    authorId: 'mock-user-3',
    authorNickname: '권민준',
    authorProfileImageUrl: null,
    content: '다시 읽으니까 장면이 이어지는 느낌이라 좋다.',
    isOwnerMain: false,
    createdAt: new Date().toISOString(),
  },
];

export function DreamDetailScreen({ route }: Props) {
  const queryClient = useQueryClient();
  const { dream } = route.params;
  const token = useSessionStore(state => state.token);
  const user = useSessionStore(state => state.user);
  const sessionUserId = useSessionStore(state => state.userId);
  const currentUserId = getCurrentUserId(sessionUserId);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentInputKey, setCommentInputKey] = useState(0);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [localComments, setLocalComments] = useState(initialComments);
  const commentsQueryKey = ['dreams', dream.id, 'comments', token] as const;
  const { data: remoteComments = [] } = useQuery({
    queryKey: commentsQueryKey,
    queryFn: () => fetchDreamComments(dream.id, token).catch(() => []),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
  });
  const comments = token ? remoteComments : localComments;
  const visibleComments = comments.filter(
    comment => comment.authorId !== dream.giverId,
  );
  const ownerComment =
    visibleComments.find(comment => comment.isOwnerMain) ??
    visibleComments.find(comment => comment.id === dream.ownerMainCommentId) ??
    visibleComments.find(comment => comment.authorId === dream.receiverId) ??
    null;
  const regularComments = visibleComments.filter(
    comment => comment.id !== ownerComment?.id,
  );
  const isSender = isCurrentUserId(dream.giverId, sessionUserId);
  const canSubmit =
    !isSender && commentDraft.trim().length > 0 && !isSubmittingComment;

  const submitComment = async () => {
    if (!canSubmit) {
      return;
    }

    const content = commentDraft.trim();
    setCommentError(null);
    setIsSubmittingComment(true);
    try {
      if (token) {
        const nextComment = await addDreamComment(dream.id, content, token);
        queryClient.setQueryData<DreamComment[]>(
          commentsQueryKey,
          currentComments => [...(currentComments ?? []), nextComment],
        );
      } else {
        setLocalComments(currentComments => [
          ...currentComments,
          {
            id: `local-comment-${Date.now()}`,
            dreamId: dream.id,
            authorId: currentUserId,
            authorNickname: user?.nickname ?? getDisplayMember(currentUserId).name,
            authorProfileImageUrl: user?.profileImageUrl ?? null,
            content,
            isOwnerMain: dream.receiverId === currentUserId,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      setCommentError(error instanceof Error ? error.message : '댓글을 등록하지 못했어요.');
      return;
    } finally {
      setIsSubmittingComment(false);
    }
    setCommentDraft('');
    setCommentInputKey(key => key + 1);
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
              key={commentInputKey}
              autoCorrect={false}
              spellCheck={false}
              defaultValue={commentDraft}
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
              <Text style={styles.commentSubmitText}>
                {isSubmittingComment ? '등록 중' : '등록'}
              </Text>
            </Pressable>
          </View>
        )}
        {commentError ? <Text style={styles.errorText}>{commentError}</Text> : null}
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
        <Text style={styles.commentAuthor}>
          {comment.authorNickname || author.name}
        </Text>
        {isOwner ? <Text style={styles.ownerBadge}>꿈주인</Text> : null}
      </View>
      <Text style={styles.commentText}>{comment.content}</Text>
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
    fontWeight: '700',
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
    fontWeight: '700',
  },
  ownerBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    color: colors.primaryDark,
    backgroundColor: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
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
    fontWeight: '700',
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
  errorText: {
    color: colors.error,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
