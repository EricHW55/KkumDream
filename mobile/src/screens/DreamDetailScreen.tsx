import { useCallback, useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Cloud,
  Heart,
  MessageCircle,
  Moon,
  Sparkles,
  X as XIcon,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DreamCard } from '../components/DreamCard';
import {
  addDreamComment,
  deleteDreamComment,
  fetchDreamComments,
  fetchDreamReactions,
  markDreamBackOpened,
  markDreamRead,
  toggleDreamReaction,
} from '../api/dreams';
import { getCurrentUserId, isCurrentUserId } from '../data/currentUser';
import { getDisplayMember } from '../data/members';
import type { RootStackParamList } from '../navigation/types';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';
import type {
  DreamComment,
  Dream,
  DreamReactionSummary,
  DreamReactionType,
} from '../types/dream';
import { DREAM_REACTION_TYPES } from '../types/dream';

const reactionMeta: Record<
  DreamReactionType,
  { label: string; Icon: LucideIcon }
> = {
  heart: { label: '좋아요', Icon: Heart },
  sparkle: { label: '반짝', Icon: Sparkles },
  moon: { label: '꿈같다', Icon: Moon },
  cloud: { label: '몽글', Icon: Cloud },
};

const emptyReactionSummary: DreamReactionSummary[] = DREAM_REACTION_TYPES.map(
  reactionType => ({ reactionType, count: 0, reacted: false }),
);

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
  const [displayDream, setDisplayDream] = useState(route.params.dream);
  const dream = displayDream;
  const token = useSessionStore(state => state.token);
  const user = useSessionStore(state => state.user);
  const sessionUserId = useSessionStore(state => state.userId);
  const currentUserId = getCurrentUserId(sessionUserId);
  const isSender = isCurrentUserId(dream.giverId, sessionUserId);
  const isReceiver = Boolean(
    dream.receiverId && isCurrentUserId(dream.receiverId, sessionUserId),
  );
  const [commentDraft, setCommentDraft] = useState('');
  const [commentInputKey, setCommentInputKey] = useState(0);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [localComments, setLocalComments] = useState(initialComments);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [pendingReaction, setPendingReaction] = useState<DreamReactionType | null>(
    null,
  );
  const commentsQueryKey = ['dreams', dream.id, 'comments', token] as const;
  const reactionsQueryKey = ['dreams', dream.id, 'reactions', token] as const;
  const { data: remoteComments = [] } = useQuery({
    queryKey: commentsQueryKey,
    queryFn: () => fetchDreamComments(dream.id, token).catch(() => []),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
  });
  const { data: reactionSummary = emptyReactionSummary } = useQuery({
    queryKey: reactionsQueryKey,
    queryFn: () =>
      fetchDreamReactions(dream.id, token).catch(() => emptyReactionSummary),
    enabled: Boolean(token),
    initialData: emptyReactionSummary,
    staleTime: 30 * 1000,
  });
  const mergeDreamUpdate = useCallback(
    (updatedDream: Dream) => {
      setDisplayDream(updatedDream);
      const updateList = (currentDreams?: Dream[]) =>
        currentDreams?.map(item =>
          item.id === updatedDream.id ? updatedDream : item,
        ) ?? currentDreams;

      queryClient.setQueryData<Dream[]>(
        ['dreams', 'inbox', sessionUserId, token],
        updateList,
      );
      queryClient.setQueryData<Dream[]>(
        ['dreams', 'outbox', sessionUserId, token],
        updateList,
      );
    },
    [queryClient, sessionUserId, token],
  );

  useEffect(() => {
    if (!token || !isReceiver || dream.readAt) {
      return;
    }

    let cancelled = false;
    markDreamRead(dream.id, token)
      .then(updatedDream => {
        if (!cancelled) {
          mergeDreamUpdate(updatedDream);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [dream.id, dream.readAt, isReceiver, mergeDreamUpdate, token]);

  const onBackOpen = useCallback(async () => {
    if (!token || !isReceiver || dream.openedBackAt) {
      return;
    }

    try {
      const updatedDream = await markDreamBackOpened(dream.id, token);
      mergeDreamUpdate(updatedDream);
    } catch {
      // Opening the card should not be blocked by analytics state updates.
    }
  }, [dream.id, dream.openedBackAt, isReceiver, mergeDreamUpdate, token]);

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
  const canSubmit =
    !isSender && commentDraft.trim().length > 0 && !isSubmittingComment;

  const onToggleReaction = async (reactionType: DreamReactionType) => {
    if (!token || pendingReaction) {
      return;
    }
    setReactionError(null);
    setPendingReaction(reactionType);
    try {
      const result = await toggleDreamReaction(dream.id, reactionType, token);
      queryClient.setQueryData<DreamReactionSummary[]>(
        reactionsQueryKey,
        result.summary,
      );
    } catch (error) {
      setReactionError(
        error instanceof Error ? error.message : '반응을 보낼 수 없어요.',
      );
    } finally {
      setPendingReaction(null);
    }
  };

  const onDeleteComment = async (commentId: string) => {
    if (token) {
      try {
        await deleteDreamComment(dream.id, commentId, token);
        queryClient.setQueryData<DreamComment[]>(
          commentsQueryKey,
          currentComments =>
            (currentComments ?? []).filter(comment => comment.id !== commentId),
        );
      } catch (error) {
        setCommentError(
          error instanceof Error ? error.message : '댓글을 삭제하지 못했어요.',
        );
      }
      return;
    }
    setLocalComments(currentComments =>
      currentComments.filter(comment => comment.id !== commentId),
    );
  };

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
      <DreamCard dream={dream} size="full" onBackOpen={onBackOpen} />

      <View style={styles.reactionBox}>
        <View style={styles.reactionRow}>
          {DREAM_REACTION_TYPES.map(reactionType => {
            const summary =
              reactionSummary.find(item => item.reactionType === reactionType) ??
              { reactionType, count: 0, reacted: false };
            const meta = reactionMeta[reactionType];
            const isPending = pendingReaction === reactionType;
            const disabled = !token || isPending;
            const Icon = meta.Icon;
            return (
              <Pressable
                key={reactionType}
                accessibilityRole="button"
                accessibilityLabel={meta.label}
                disabled={disabled}
                onPress={() => onToggleReaction(reactionType)}
                style={({ pressed }) => [
                  styles.reactionChip,
                  summary.reacted && styles.reactionChipActive,
                  disabled && styles.reactionChipDisabled,
                  pressed && !disabled && interactionStyles.pressed,
                ]}
              >
                <Icon
                  size={16}
                  color={summary.reacted ? colors.primary : colors.textSecondary}
                  fill={summary.reacted ? colors.primary : 'transparent'}
                />
                <Text
                  style={[
                    styles.reactionLabel,
                    summary.reacted && styles.reactionLabelActive,
                  ]}
                >
                  {meta.label}
                </Text>
                <Text
                  style={[
                    styles.reactionCount,
                    summary.reacted && styles.reactionCountActive,
                  ]}
                >
                  {summary.count}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {reactionError ? (
          <Text style={styles.errorText}>{reactionError}</Text>
        ) : null}
      </View>

      <View style={styles.commentBox}>
        <View style={styles.commentHeader}>
          <MessageCircle color={colors.primary} size={20} />
          <Text style={styles.commentTitle}>댓글</Text>
        </View>

        {ownerComment ? (
          <CommentItem
            comment={ownerComment}
            isOwner
            canDelete={ownerComment.authorId === currentUserId}
            onDelete={() => onDeleteComment(ownerComment.id)}
          />
        ) : null}

        {regularComments.map(comment => (
          <CommentItem
            key={comment.id}
            comment={comment}
            canDelete={comment.authorId === currentUserId}
            onDelete={() => onDeleteComment(comment.id)}
          />
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
  canDelete = false,
  onDelete,
}: {
  comment: DreamComment;
  isOwner?: boolean;
  canDelete?: boolean;
  onDelete?: () => void;
}) {
  const author = getDisplayMember(comment.authorId);

  return (
    <View style={[styles.commentItem, isOwner && styles.ownerCommentItem]}>
      <View style={styles.commentAuthorRow}>
        <Text style={styles.commentAuthor}>
          {comment.authorNickname || author.name}
        </Text>
        {isOwner ? <Text style={styles.ownerBadge}>꿈주인</Text> : null}
        {canDelete && onDelete ? (
          <Pressable
            accessibilityLabel="댓글 삭제"
            accessibilityRole="button"
            onPress={onDelete}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && interactionStyles.pressed,
            ]}
          >
            <XIcon color={colors.textMuted} size={14} />
          </Pressable>
        ) : null}
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
  reactionBox: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 12,
  },
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.lavenderMist,
  },
  reactionChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.lavenderTint,
  },
  reactionChipDisabled: {
    opacity: 0.6,
  },
  reactionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    includeFontPadding: false,
  },
  reactionLabelActive: {
    color: colors.primaryDark,
  },
  reactionCount: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    includeFontPadding: false,
  },
  reactionCountActive: {
    color: colors.primaryDark,
  },
  deleteButton: {
    marginLeft: 'auto',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.divider,
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
