import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  Link2,
  MessageCircle,
  MoreVertical,
  Share2,
  X as XIcon,
} from 'lucide-react-native';
import {
  Clipboard,
  Keyboard,
  type LayoutChangeEvent,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardFlipGuide } from '../components/CardFlipGuide';
import { useConfirmDialog } from '../components/ConfirmDialog';
import { DreamCard } from '../components/DreamCard';
import {
  DreamFrontPreviewGenerator,
  needsFrontPreview,
} from '../components/DreamFrontPreview';
import { PaperTextureOverlay } from '../components/PaperTextureOverlay';
import { ReactionBar } from '../components/ReactionBar';
import {
  addDreamComment,
  deleteDreamComment,
  fetchDream,
  fetchDreamComments,
  fetchDreamReactions,
  markDreamBackOpened,
  markDreamRead,
  shareDream,
  toggleDreamReaction,
} from '../api/dreams';
import { blockUser, reportContent } from '../api/safety';
import { getCurrentUserId, isCurrentUserId } from '../data/currentUser';
import { applyDreamPreviewToCaches } from '../data/dreamRepository';
import { getDisplayMember } from '../data/members';
import {
  hasSeenCardFlipGuide,
  markCardFlipGuideSeen,
} from '../data/onboarding';
import type { RootStackParamList } from '../navigation/types';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';
import { fontFamily } from '../theme/typography';
import type {
  DreamComment,
  Dream,
  DreamReactionSummary,
  DreamReactionType,
} from '../types/dream';
import { DREAM_REACTION_TYPES } from '../types/dream';

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

export function DreamDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { confirm, dialog } = useConfirmDialog();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const composerOffsetYRef = useRef(0);
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
  const [safetyStatus, setSafetyStatus] = useState<string | null>(null);
  const [isSafetyMenuOpen, setIsSafetyMenuOpen] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [localComments, setLocalComments] = useState(initialComments);
  const [isPageScrollEnabled, setIsPageScrollEnabled] = useState(true);
  const [showFlipGuide, setShowFlipGuide] = useState(
    () => !hasSeenCardFlipGuide(),
  );
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isPreparingShare, setIsPreparingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  // Opportunistically flatten this card's front preview while it's open, if it
  // doesn't have a current one yet (the full card is already mounted here).
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const previewAttemptedRef = useRef(false);
  // A dream sent to an external recipient stays unclaimed (no receiverId, just
  // the typed-in label) until someone opens the share link. While it is in that
  // state, let the sender re-surface the claim link to copy or resend it. (A
  // dream may also belong to a room, so group membership is irrelevant here.)
  const isExternalSharePending =
    isSender &&
    dream.status !== 'draft' &&
    !dream.receiverId &&
    Boolean(dream.receiverLabel);
  const counterpartUserId = isSender ? dream.receiverId : dream.giverId;
  const canBlockCounterpart = Boolean(
    token && counterpartUserId && counterpartUserId !== currentUserId,
  );
  // The card's text/image is authored by the giver, so the sender has nothing to
  // report on their own card. The receiver or a room member viewing it still can.
  const canReport = Boolean(token) && !isSender;
  const showSafetyMenu = canReport || canBlockCounterpart;
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
  const { data: refreshedDream } = useQuery({
    queryKey: ['dreams', dream.id, 'detail', token],
    queryFn: () => fetchDream(dream.id, token),
    enabled: Boolean(token),
    initialData: dream,
    staleTime: 0,
    refetchInterval: query => (isImagePending(query.state.data) ? 3000 : false),
  });

  useEffect(() => {
    if (refreshedDream.id === dream.id) {
      mergeDreamUpdate(refreshedDream);
    }
  }, [dream.id, mergeDreamUpdate, refreshedDream]);

  const onPreviewGenerated = useCallback(
    (updated: Dream) => {
      previewAttemptedRef.current = true;
      setIsGeneratingPreview(false);
      mergeDreamUpdate(updated);
      applyDreamPreviewToCaches(
        updated.id,
        {
          frontPreviewUrl: updated.frontPreviewUrl ?? null,
          frontPreviewVersion: updated.frontPreviewVersion ?? null,
          frontPreviewHash: updated.frontPreviewHash ?? null,
        },
        sessionUserId,
      );
    },
    [mergeDreamUpdate, sessionUserId],
  );

  const onPreviewError = useCallback(() => {
    previewAttemptedRef.current = true;
    setIsGeneratingPreview(false);
  }, []);

  useEffect(() => {
    if (!token || previewAttemptedRef.current || isGeneratingPreview) {
      return;
    }
    // Wait until the image is ready (thumbnail present); polling above keeps
    // `dream` fresh, so this fires once generation finishes.
    if (needsFrontPreview(dream)) {
      setIsGeneratingPreview(true);
    }
  }, [dream, isGeneratingPreview, token]);

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
    setShowFlipGuide(false);

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

  useEffect(() => {
    if (!showFlipGuide) {
      return;
    }
    markCardFlipGuideSeen();
    const timer = setTimeout(() => setShowFlipGuide(false), 2500);
    return () => clearTimeout(timer);
  }, [showFlipGuide]);

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

  const onToggleReaction = useCallback(
    (reactionType: DreamReactionType) =>
      toggleDreamReaction(dream.id, reactionType, token).then(result => {
        queryClient.setQueryData<DreamReactionSummary[]>(
          ['dreams', dream.id, 'reactions', token],
          result.summary,
        );
        return result;
      }),
    [dream.id, queryClient, token],
  );

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

  const reportDreamContent = async () => {
    if (!token) {
      setSafetyStatus('로그인이 필요합니다.');
      return;
    }
    setSafetyStatus(null);
    try {
      await reportContent(
        {
          targetType: 'dream',
          targetId: dream.id,
          reportedUserId:
            counterpartUserId && counterpartUserId !== currentUserId
              ? counterpartUserId
              : null,
          reason: 'inappropriate',
        },
        token,
      );
      setSafetyStatus('신고가 접수됐어요.');
    } catch (error) {
      setSafetyStatus(
        error instanceof Error ? error.message : '신고를 접수하지 못했어요.',
      );
    }
  };

  const blockCounterpartUser = async () => {
    if (!token || !counterpartUserId || counterpartUserId === currentUserId) {
      setSafetyStatus('차단할 사용자를 찾지 못했어요.');
      return;
    }
    setSafetyStatus(null);
    try {
      await blockUser(counterpartUserId, token);
      await queryClient.invalidateQueries({ queryKey: ['dreams'] });
      await queryClient.invalidateQueries({ queryKey: commentsQueryKey });
      setSafetyStatus('차단했어요. 서로의 카드와 댓글이 숨겨져요.');
    } catch (error) {
      setSafetyStatus(
        error instanceof Error ? error.message : '사용자를 차단하지 못했어요.',
      );
    }
  };

  const confirmBlockCounterpart = async () => {
    if (!canBlockCounterpart) {
      setSafetyStatus('차단할 사용자를 찾지 못했어요.');
      return;
    }
    const ok = await confirm({
      title: '사용자를 차단할까요?',
      message:
        '차단하면 서로의 꿈카드와 댓글이 보이지 않고, 새 꿈카드를 주고받을 수 없어요.',
      confirmText: '차단',
      tone: 'danger',
    });
    if (ok) {
      await blockCounterpartUser();
    }
  };

  const confirmReportDream = async () => {
    if (!token) {
      setSafetyStatus('로그인이 필요합니다.');
      return;
    }
    const ok = await confirm({
      title: '이 꿈카드를 신고할까요?',
      message:
        '부적절한 내용으로 신고하면 운영팀이 검토해요. 같은 사용자를 더는 보고 싶지 않다면 차단도 할 수 있어요.',
      confirmText: '신고',
      tone: 'danger',
    });
    if (ok) {
      await reportDreamContent();
    }
  };

  const onSelectReport = () => {
    setIsSafetyMenuOpen(false);
    confirmReportDream().catch(() => undefined);
  };

  const onSelectBlock = () => {
    setIsSafetyMenuOpen(false);
    confirmBlockCounterpart().catch(() => undefined);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: showSafetyMenu
        ? () => (
            <Pressable
              accessibilityLabel="신고 및 차단 메뉴"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => {
                setSafetyStatus(null);
                setIsSafetyMenuOpen(open => !open);
              }}
              style={({ pressed }) => [
                styles.headerMenuButton,
                pressed && interactionStyles.pressedSoft,
              ]}
            >
              <MoreVertical color={colors.textPrimary} size={22} />
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, showSafetyMenu]);

  const reportCommentContent = async (comment: DreamComment) => {
    if (!token) {
      setSafetyStatus('로그인이 필요합니다.');
      return;
    }
    setSafetyStatus(null);
    try {
      await reportContent(
        {
          targetType: 'comment',
          targetId: comment.id,
          reportedUserId:
            comment.authorId !== currentUserId ? comment.authorId : null,
          reason: 'inappropriate',
        },
        token,
      );
      setSafetyStatus('댓글 신고가 접수됐어요.');
    } catch (error) {
      setSafetyStatus(
        error instanceof Error ? error.message : '댓글 신고를 접수하지 못했어요.',
      );
    }
  };

  const blockCommentAuthor = async (comment: DreamComment) => {
    if (!token || comment.authorId === currentUserId) {
      setSafetyStatus('차단할 사용자를 찾지 못했어요.');
      return;
    }
    setSafetyStatus(null);
    try {
      await blockUser(comment.authorId, token);
      queryClient.setQueryData<DreamComment[]>(commentsQueryKey, current =>
        (current ?? []).filter(item => item.authorId !== comment.authorId),
      );
      setLocalComments(current =>
        current.filter(item => item.authorId !== comment.authorId),
      );
      await queryClient.invalidateQueries({ queryKey: ['dreams'] });
      setSafetyStatus('차단했어요. 해당 사용자의 댓글이 숨겨져요.');
    } catch (error) {
      setSafetyStatus(
        error instanceof Error ? error.message : '사용자를 차단하지 못했어요.',
      );
    }
  };

  const confirmReportComment = async (comment: DreamComment) => {
    if (!token) {
      setSafetyStatus('로그인이 필요합니다.');
      return;
    }
    const ok = await confirm({
      title: '이 댓글을 신고할까요?',
      message: '부적절한 내용으로 신고하면 운영팀이 검토해요.',
      confirmText: '신고',
      tone: 'danger',
    });
    if (ok) {
      await reportCommentContent(comment);
    }
  };

  const confirmBlockCommentAuthor = async (comment: DreamComment) => {
    if (comment.authorId === currentUserId) {
      return;
    }
    const ok = await confirm({
      title: '댓글 작성자를 차단할까요?',
      message:
        '차단하면 서로의 꿈카드와 댓글이 보이지 않고, 새 꿈카드를 주고받을 수 없어요.',
      confirmText: '차단',
      tone: 'danger',
    });
    if (ok) {
      await blockCommentAuthor(comment);
    }
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
            authorNickname:
              user?.nickname ?? getDisplayMember(currentUserId).name,
            authorProfileImageUrl: user?.profileImageUrl ?? null,
            content,
            isOwnerMain: dream.receiverId === currentUserId,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch (error) {
      setCommentError(
        error instanceof Error ? error.message : '댓글을 등록하지 못했어요.',
      );
      return;
    } finally {
      setIsSubmittingComment(false);
    }
    setCommentDraft('');
    setCommentInputKey(key => key + 1);
  };

  const onCommentInputFocus = useCallback(() => {
    // Wait for the soft keyboard to settle (and the window to resize on
    // Android) before bringing the composer fully into view.
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, composerOffsetYRef.current - 24),
        animated: true,
      });
    }, 250);
  }, []);

  const onComposerLayout = useCallback((event: LayoutChangeEvent) => {
    composerOffsetYRef.current = event.nativeEvent.layout.y;
  }, []);

  useEffect(() => {
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = Keyboard.addListener(showEvent, event => {
      setKeyboardHeight(event.endCoordinates.height);
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, composerOffsetYRef.current - 24),
          animated: true,
        });
      }, 60);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, []);

  const ensureShareUrl = useCallback(async (): Promise<string | null> => {
    if (shareUrl) {
      return shareUrl;
    }
    if (!token) {
      setShareError('로그인 후에 공유 링크를 만들 수 있어요.');
      return null;
    }
    setIsPreparingShare(true);
    setShareError(null);
    try {
      const result = await shareDream(dream.id, token);
      setShareUrl(result.shareUrl);
      return result.shareUrl;
    } catch (error) {
      setShareError(
        error instanceof Error ? error.message : '공유 링크를 만들지 못했어요.',
      );
      return null;
    } finally {
      setIsPreparingShare(false);
    }
  }, [dream.id, shareUrl, token]);

  const toggleShareMenu = useCallback(() => {
    setIsShareMenuOpen(open => {
      const next = !open;
      if (next) {
        setShareLinkCopied(false);
        setShareError(null);
        // Warm the link up front so copy/share feel instant.
        ensureShareUrl().catch(() => null);
      }
      return next;
    });
  }, [ensureShareUrl]);

  const onCopyShareLink = useCallback(async () => {
    const url = await ensureShareUrl();
    if (!url) {
      return;
    }
    Clipboard.setString(url);
    setShareLinkCopied(true);
    setIsShareMenuOpen(false);
  }, [ensureShareUrl]);

  const onSendShareLink = useCallback(async () => {
    const url = await ensureShareUrl();
    if (!url) {
      return;
    }
    setIsShareMenuOpen(false);
    try {
      await Share.share({
        title: dream.title,
        url,
        message: buildShareLinkMessage(dream, url),
      });
    } catch {
      // The native share sheet was dismissed; nothing to recover from.
    }
  }, [dream, ensureShareUrl]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.root}
        scrollEnabled={isPageScrollEnabled}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: Math.max(
              insets.bottom + 44 + (Platform.OS === 'android' ? keyboardHeight : 0),
              88,
            ),
          },
        ]}
      >
        <PaperTextureOverlay />
        <View style={styles.cardSlot}>
          <DreamCard
            dream={dream}
            loadFullImageProgressively
            onBackOpen={onBackOpen}
            onParentScrollEnabledChange={setIsPageScrollEnabled}
            size="full"
          />
          {showFlipGuide ? <CardFlipGuide /> : null}
        </View>

        <ReactionBar
          summary={reactionSummary}
          disabled={!token}
          onToggle={onToggleReaction}
        />

        {safetyStatus ? (
          <Text style={styles.safetyStatusText}>{safetyStatus}</Text>
        ) : null}

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
              canReport={ownerComment.authorId !== currentUserId && !ownerComment.isHidden}
              canBlock={ownerComment.authorId !== currentUserId && !ownerComment.isHidden}
              onDelete={() => onDeleteComment(ownerComment.id)}
              onReport={() => confirmReportComment(ownerComment)}
              onBlock={() => confirmBlockCommentAuthor(ownerComment)}
            />
          ) : null}

          {regularComments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              canDelete={comment.authorId === currentUserId}
              canReport={comment.authorId !== currentUserId && !comment.isHidden}
              canBlock={comment.authorId !== currentUserId && !comment.isHidden}
              onDelete={() => onDeleteComment(comment.id)}
              onReport={() => confirmReportComment(comment)}
              onBlock={() => confirmBlockCommentAuthor(comment)}
            />
          ))}

          {isSender ? (
            <View style={styles.commentNotice}>
              <Text style={styles.commentNoticeText}>
                꿈을 보낸 사람은 이 카드에 댓글을 남길 수 없어요.
              </Text>
            </View>
          ) : (
            <View style={styles.composer} onLayout={onComposerLayout}>
              <TextInput
                key={commentInputKey}
                autoCorrect={false}
                spellCheck={false}
                defaultValue={commentDraft}
                onChangeText={setCommentDraft}
                multiline
                onFocus={onCommentInputFocus}
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
          {commentError ? (
            <Text style={styles.errorText}>{commentError}</Text>
          ) : null}
        </View>
      </ScrollView>

      {isSafetyMenuOpen ? (
        <>
          <Pressable
            accessibilityLabel="메뉴 닫기"
            style={styles.safetyMenuBackdrop}
            onPress={() => setIsSafetyMenuOpen(false)}
          />
          <View style={styles.safetyMenu}>
            {canReport ? (
              <Pressable
                accessibilityRole="button"
                onPress={onSelectReport}
                style={({ pressed }) => [
                  styles.safetyMenuItem,
                  pressed && interactionStyles.pressedSoft,
                ]}
              >
                <Text style={styles.safetyMenuItemText}>신고</Text>
              </Pressable>
            ) : null}
            {canReport && canBlockCounterpart ? (
              <View style={styles.safetyMenuDivider} />
            ) : null}
            {canBlockCounterpart ? (
              <Pressable
                accessibilityRole="button"
                onPress={onSelectBlock}
                style={({ pressed }) => [
                  styles.safetyMenuItem,
                  pressed && interactionStyles.pressedSoft,
                ]}
              >
                <Text style={styles.safetyMenuDangerText}>차단</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      ) : null}

      {dialog}

      {isExternalSharePending ? (
        <View
          style={[styles.shareFabArea, { bottom: insets.bottom + 24 }]}
          pointerEvents="box-none"
        >
          {isShareMenuOpen ? (
            <Pressable
              accessibilityLabel="공유 메뉴 닫기"
              style={styles.shareFabBackdrop}
              onPress={() => setIsShareMenuOpen(false)}
            />
          ) : null}

          {isShareMenuOpen ? (
            <View style={styles.shareMenu}>
              <Pressable
                accessibilityRole="button"
                disabled={isPreparingShare}
                onPress={onCopyShareLink}
                style={({ pressed }) => [
                  styles.shareMenuItem,
                  isPreparingShare && styles.shareActionDisabled,
                  pressed && !isPreparingShare && interactionStyles.pressed,
                ]}
              >
                <Copy color={colors.primaryDark} size={18} />
                <Text style={styles.shareMenuItemText}>
                  {shareLinkCopied ? '복사됨' : '복사'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isPreparingShare}
                onPress={onSendShareLink}
                style={({ pressed }) => [
                  styles.shareMenuItem,
                  isPreparingShare && styles.shareActionDisabled,
                  pressed && !isPreparingShare && interactionStyles.pressed,
                ]}
              >
                <Share2 color={colors.primaryDark} size={18} />
                <Text style={styles.shareMenuItemText}>공유</Text>
              </Pressable>
              {shareError ? (
                <Text style={styles.shareMenuError}>{shareError}</Text>
              ) : null}
            </View>
          ) : null}

          <Pressable
            accessibilityLabel="공유 링크"
            accessibilityRole="button"
            onPress={toggleShareMenu}
            style={({ pressed }) => [
              styles.shareFab,
              pressed && interactionStyles.pressed,
            ]}
          >
            {isShareMenuOpen ? (
              <XIcon color="#FFFFFF" size={24} />
            ) : (
              <Link2 color="#FFFFFF" size={24} />
            )}
          </Pressable>
        </View>
      ) : null}

      {isGeneratingPreview ? (
        <DreamFrontPreviewGenerator
          dream={dream}
          token={token}
          onGenerated={onPreviewGenerated}
          onError={onPreviewError}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

function buildShareLinkMessage(dream: Dream, shareUrl: string) {
  const recipient = dream.receiverLabel?.trim();
  const recipientText = recipient ? `${recipient}에게 보낸 꿈카드` : '꿈카드';
  return `${recipientText}\n"${dream.shortMessage}"\n\n${shareUrl}\n\n링크를 열면 꿈드림 앱에서 바로 카드를 받을 수 있어요.`;
}

function isImagePending(dream?: Dream) {
  return dream?.imageStatus === 'queued' || dream?.imageStatus === 'generating';
}

function CommentItem({
  comment,
  isOwner = false,
  canDelete = false,
  canReport = false,
  canBlock = false,
  onDelete,
  onReport,
  onBlock,
}: {
  comment: DreamComment;
  isOwner?: boolean;
  canDelete?: boolean;
  canReport?: boolean;
  canBlock?: boolean;
  onDelete?: () => void;
  onReport?: () => void;
  onBlock?: () => void;
}) {
  const author = getDisplayMember(comment.authorId);
  const hasActions = canReport || canBlock || canDelete;

  return (
    <View style={[styles.commentItem, isOwner && styles.ownerCommentItem]}>
      <View style={styles.commentAuthorRow}>
        <Text style={styles.commentAuthor}>
          {comment.authorNickname || author.name}
        </Text>
        {isOwner ? <Text style={styles.ownerBadge}>꿈주인</Text> : null}
        {hasActions ? (
          <View style={styles.commentAuthorActions}>
            {canReport && onReport ? (
              <Pressable
                accessibilityRole="button"
                onPress={onReport}
                style={({ pressed }) => [
                  styles.commentActionButton,
                  pressed && interactionStyles.pressedSoft,
                ]}
              >
                <Text style={styles.commentActionText}>신고</Text>
              </Pressable>
            ) : null}
            {canBlock && onBlock ? (
              <Pressable
                accessibilityRole="button"
                onPress={onBlock}
                style={({ pressed }) => [
                  styles.commentActionButton,
                  pressed && interactionStyles.pressedSoft,
                ]}
              >
                <Text style={styles.commentDangerActionText}>차단</Text>
              </Pressable>
            ) : null}
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
        ) : null}
      </View>
      <Text
        style={[
          styles.commentText,
          comment.isHidden && styles.hiddenCommentText,
        ]}
      >
        {comment.content}
      </Text>
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
  cardSlot: {
    position: 'relative',
  },
  headerMenuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -4,
  },
  safetyMenuBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  safetyMenu: {
    position: 'absolute',
    top: 6,
    right: 12,
    minWidth: 128,
    borderRadius: 14,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingVertical: 4,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  safetyMenuItem: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  safetyMenuDivider: {
    height: 1,
    marginHorizontal: 12,
    backgroundColor: colors.divider,
  },
  safetyMenuItemText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 15,
    includeFontPadding: false,
  },
  safetyMenuDangerText: {
    color: colors.error,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 15,
    includeFontPadding: false,
  },
  safetyStatusText: {
    marginTop: -6,
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  shareFabArea: {
    position: 'absolute',
    right: 20,
    alignItems: 'flex-end',
  },
  shareFabBackdrop: {
    position: 'absolute',
    top: -2000,
    bottom: -2000,
    left: -2000,
    right: -2000,
  },
  shareFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 5,
  },
  shareMenu: {
    marginBottom: 12,
    gap: 8,
    alignItems: 'stretch',
  },
  shareMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minWidth: 116,
    minHeight: 46,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  shareMenuItemText: {
    color: colors.primaryDark,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 14,
    includeFontPadding: false,
  },
  shareMenuError: {
    maxWidth: 180,
    textAlign: 'right',
    color: colors.error,
    fontFamily: fontFamily.handwritten,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  shareActionDisabled: {
    opacity: 0.5,
  },
  deleteButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBase,
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
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 17,
  },
  commentItem: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.lavenderMist,
  },
  ownerCommentItem: {
    backgroundColor: colors.skyMist,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  commentAuthorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentAuthor: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 14,
  },
  commentAuthorActions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentActionButton: {
    minHeight: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  commentActionText: {
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 11,
    includeFontPadding: false,
  },
  commentDangerActionText: {
    color: colors.error,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 11,
    includeFontPadding: false,
  },
  ownerBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    color: colors.primaryDark,
    backgroundColor: colors.cardBase,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 11,
    includeFontPadding: false,
  },
  commentText: {
    marginTop: 6,
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontSize: 15,
    lineHeight: 23,
  },
  hiddenCommentText: {
    color: colors.textMuted,
    fontStyle: 'italic',
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
    backgroundColor: colors.cardBase,
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
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
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 14,
    includeFontPadding: false,
  },
  commentNotice: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.lavenderMist,
  },
  commentNoticeText: {
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    color: colors.error,
    fontFamily: fontFamily.handwritten,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
