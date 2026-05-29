import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AppState,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  type StyleProp,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import {
  Check,
  Lock,
  Palette,
  PencilLine,
  Search,
  Share2,
  X,
} from 'lucide-react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createDreamDraft,
  fetchLatestDreamDraft,
  giveDream,
  shareDream,
  updateDream,
} from '../api/dreams';
import { DreamCard } from '../components/DreamCard';
import { DreamCardFrame } from '../components/DreamCardFrame';
import { DreamGenerationAnimation } from '../components/DreamGenerationAnimation';
import { PaperTextureOverlay } from '../components/PaperTextureOverlay';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { PrimaryButton } from '../components/PrimaryButton';
import {
  readComposeDraftSnapshot,
  removeComposeDraftSnapshot,
  writeComposeDraftSnapshot,
  type ComposeDraftSnapshot,
  type ComposeRecipientMode,
  type ComposeToneValue,
} from '../data/composeDraftCache';
import { getCachedRooms, loadRooms } from '../data/dreamRepository';
import { LOCAL_MOCK_USER_ID } from '../data/currentUser';
import { getDisplayMember, getSeedFriends } from '../data/members';
import { buildMockDraft } from '../mocks/dreams';
import type { RootStackParamList } from '../navigation/types';
import { useDesignLock } from '../hooks/usePass';
import { usePassModalStore } from '../store/passModalStore';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import {
  CARD_COLOR_OPTIONS,
  CARD_FRAME_OPTIONS,
  DEFAULT_DREAM_DESIGN,
  FONT_STYLE_OPTIONS,
  getDreamFontStyle,
  normalizeDreamDesign,
} from '../theme/dreamDesigns';
import { interactionStyles } from '../theme/interactions';
import { fontFamily } from '../theme/typography';
import type { Dream, DreamDesign, DreamStoryLength } from '../types/dream';

const PRIVATE_POSTSCRIPT_MAX_LENGTH = 120;
const VISIBLE_ROOM_PICKER_COUNT = 4;

const moods = ['몽환', '판타지', '공포', '코믹', '따뜻함', '추억', '기괴함'];
const toneOptions = [
  {
    value: 'warm',
    label: '다정한 편지체',
    description: '부드럽고 친근하게 마음을 전해요.',
  },
  {
    value: 'polite',
    label: '공손한 말투',
    description: '차분한 존댓말로 정돈해서 써요.',
  },
  {
    value: 'casual',
    label: '친구 말투',
    description: '일상적으로 친구에게 말하듯 편하게 써요.',
  },
  {
    value: 'mz_comic',
    label: 'MZ 코믹체',
    description: '신조어와 줄임말을 섞어 가볍고 웃기게 써요.',
  },
  {
    value: 'story',
    label: '소설체',
    description: '장면과 움직임이 살아나게 풀어줘요.',
  },
  {
    value: 'poetic',
    label: '시적인 문장',
    description: '짧고 감각적인 문장으로 여운을 남겨요.',
  },
] as const;
const lengthOptions: readonly {
  value: DreamStoryLength;
  label: string;
  description: string;
}[] = [
  {
    value: 'short',
    label: '간결',
    description: '핵심 장면만 짧고 선명하게 담아요.',
  },
  {
    value: 'standard',
    label: '기본',
    description: '장면과 감정을 균형 있게 담아요.',
  },
  {
    value: 'long',
    label: '풍부',
    description: '꿈의 흐름을 더 천천히 풀어줘요.',
  },
];

type RecipientMode = ComposeRecipientMode;
type RecipientFriend = {
  id: string;
  name: string;
  avatarColor: string;
  profileImageUrl?: string | null;
};
type ToneValue = ComposeToneValue;

type Props = NativeStackScreenProps<RootStackParamList, 'Compose'>;

export function ComposeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const composeScrollRef = useRef<ScrollView>(null);
  const queryClient = useQueryClient();
  const token = useSessionStore(state => state.token);
  const sessionUserId = useSessionStore(state => state.userId);
  const currentUserId = sessionUserId ?? LOCAL_MOCK_USER_ID;
  const initialComposeSnapshot = useMemo(
    () => readComposeDraftSnapshot(sessionUserId),
    [sessionUserId],
  );
  const initialComposeDesign = useMemo(
    () => getSnapshotDesign(initialComposeSnapshot),
    [initialComposeSnapshot],
  );
  const initialComposeDraft = useMemo(
    () => getSnapshotDraft(initialComposeSnapshot, initialComposeDesign),
    [initialComposeDesign, initialComposeSnapshot],
  );
  const [rawInput, setRawInput] = useState(() =>
    getSnapshotRawInput(initialComposeSnapshot, initialComposeDraft),
  );
  const [mood, setMood] = useState(() =>
    getSnapshotMood(initialComposeSnapshot),
  );
  const [tone, setTone] = useState<ToneValue>(() =>
    getSnapshotTone(initialComposeSnapshot),
  );
  const [storyLength, setStoryLength] = useState<DreamStoryLength>(() =>
    getSnapshotStoryLength(initialComposeSnapshot),
  );
  const [selectedDesign, setSelectedDesign] =
    useState<DreamDesign>(initialComposeDesign);
  const openPassModal = usePassModalStore(state => state.open);
  const { isColorLocked, isFrameLocked, isFontLocked } = useDesignLock();
  const [draft, setDraft] = useState<Dream | null>(initialComposeDraft);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(initialComposeDraft?.title ?? '');
  const [editStory, setEditStory] = useState(initialComposeDraft?.story ?? '');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isRecipientModalVisible, setIsRecipientModalVisible] = useState(false);
  const [isFriendPickerVisible, setIsFriendPickerVisible] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [recipientMode, setRecipientMode] = useState<RecipientMode>(() =>
    initialComposeSnapshot?.recipientMode === 'external'
      ? 'external'
      : 'friend',
  );
  const [selectedReceiverId, setSelectedReceiverId] = useState<string | null>(
    () =>
      typeof initialComposeSnapshot?.selectedReceiverId === 'string'
        ? initialComposeSnapshot.selectedReceiverId
        : null,
  );
  const [externalLabel, setExternalLabel] = useState(
    typeof initialComposeSnapshot?.externalLabel === 'string'
      ? initialComposeSnapshot.externalLabel
      : '',
  );
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>(() =>
    sanitizeGroupIds(initialComposeSnapshot?.selectedGroupIds),
  );
  const [privatePostscript, setPrivatePostscript] = useState(
    typeof initialComposeSnapshot?.privatePostscript === 'string'
      ? initialComposeSnapshot.privatePostscript
      : '',
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [isGiving, setIsGiving] = useState(false);
  const [hasHydratedComposeDraft, setHasHydratedComposeDraft] = useState(false);
  const cacheWriteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const draftDesignSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastSyncedDraftDesignRef = useRef<string | null>(null);
  const roomsQueryKey = ['rooms', sessionUserId, token] as const;
  const { data: rooms = getCachedRooms(sessionUserId) } = useQuery({
    queryKey: roomsQueryKey,
    queryFn: () => loadRooms(token, sessionUserId),
    initialData: () => getCachedRooms(sessionUserId),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const hydrateComposeSnapshot = useCallback(
    (
      snapshot: ComposeDraftSnapshot,
      options?: { markDesignSynced?: boolean },
    ) => {
      const nextDesign = normalizeDreamDesign(
        snapshot.draft?.design ?? snapshot.selectedDesign,
      );
      const nextDraft =
        snapshot.draft?.status === 'draft'
          ? { ...snapshot.draft, design: nextDesign }
          : null;

      setRawInput(
        typeof snapshot.rawInput === 'string'
          ? snapshot.rawInput
          : nextDraft?.rawInput ?? '',
      );
      setMood(typeof snapshot.mood === 'string' ? snapshot.mood : moods[0]);
      setTone(isToneValue(snapshot.tone) ? snapshot.tone : 'warm');
      setStoryLength(
        isStoryLength(snapshot.storyLength)
          ? snapshot.storyLength
          : 'standard',
      );
      setSelectedDesign(nextDesign);
      setDraft(nextDraft);
      setEditTitle(nextDraft?.title ?? '');
      setEditStory(nextDraft?.story ?? '');
      if (nextDraft && options?.markDesignSynced) {
        lastSyncedDraftDesignRef.current = getDraftDesignSyncKey(
          nextDraft.id,
          nextDesign,
        );
      }
      setRecipientMode(
        snapshot.recipientMode === 'external' ? 'external' : 'friend',
      );
      setSelectedReceiverId(
        typeof snapshot.selectedReceiverId === 'string'
          ? snapshot.selectedReceiverId
          : null,
      );
      setExternalLabel(
        typeof snapshot.externalLabel === 'string' ? snapshot.externalLabel : '',
      );
      setSelectedGroupIds(sanitizeGroupIds(snapshot.selectedGroupIds));
      setPrivatePostscript(
        typeof snapshot.privatePostscript === 'string'
          ? snapshot.privatePostscript
          : '',
      );
    },
    [],
  );

  useEffect(() => {
    let isCancelled = false;
    const cachedSnapshot = readComposeDraftSnapshot(sessionUserId);

    if (cachedSnapshot) {
      hydrateComposeSnapshot(cachedSnapshot);
    }

    if (!token || cachedSnapshot?.draft?.status === 'draft') {
      setHasHydratedComposeDraft(true);
      return () => {
        isCancelled = true;
      };
    }

    fetchLatestDreamDraft(token)
      .then(serverDraft => {
        if (isCancelled || serverDraft?.status !== 'draft') {
          return;
        }
        hydrateComposeSnapshot(
          {
            version: 1,
            rawInput: serverDraft.rawInput,
            mood: serverDraft.mainMood || moods[0],
            tone: 'warm',
            storyLength: 'standard',
            selectedDesign: normalizeDreamDesign(serverDraft.design),
            draft: serverDraft,
            recipientMode: 'friend',
            selectedReceiverId: null,
            externalLabel: '',
            selectedGroupIds: [],
            privatePostscript: '',
          },
          { markDesignSynced: true },
        );
      })
      .catch(() => undefined)
      .finally(() => {
        if (!isCancelled) {
          setHasHydratedComposeDraft(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [hydrateComposeSnapshot, sessionUserId, token]);

  const flushComposeDraftCache = useCallback(() => {
    if (!hasHydratedComposeDraft) {
      return;
    }

    const currentDraft = draft?.status === 'draft' ? draft : null;
    if (!currentDraft && (draft || rawInput.trim().length === 0)) {
      removeComposeDraftSnapshot(sessionUserId);
      return;
    }

    writeComposeDraftSnapshot(sessionUserId, {
      version: 1,
      rawInput,
      mood,
      tone,
      storyLength,
      selectedDesign: normalizeDreamDesign(selectedDesign),
      draft: currentDraft,
      recipientMode,
      selectedReceiverId,
      externalLabel,
      selectedGroupIds,
      privatePostscript,
    });
  }, [
    draft,
    externalLabel,
    hasHydratedComposeDraft,
    mood,
    privatePostscript,
    rawInput,
    recipientMode,
    selectedDesign,
    sessionUserId,
    selectedGroupIds,
    selectedReceiverId,
    storyLength,
    tone,
  ]);

  useEffect(() => {
    if (!hasHydratedComposeDraft) {
      return undefined;
    }

    if (cacheWriteTimeoutRef.current) {
      clearTimeout(cacheWriteTimeoutRef.current);
    }
    cacheWriteTimeoutRef.current = setTimeout(flushComposeDraftCache, 250);

    return () => {
      if (cacheWriteTimeoutRef.current) {
        clearTimeout(cacheWriteTimeoutRef.current);
      }
    };
  }, [flushComposeDraftCache, hasHydratedComposeDraft]);

  const flushDraftDesignToServer = useCallback(async () => {
    if (!token || draft?.status !== 'draft') {
      return;
    }

    const requestDesign = normalizeDreamDesign(selectedDesign);
    const syncKey = getDraftDesignSyncKey(draft.id, requestDesign);
    if (lastSyncedDraftDesignRef.current === syncKey) {
      return;
    }
    lastSyncedDraftDesignRef.current = syncKey;

    try {
      const updatedDream = await updateDream(
        draft.id,
        { design: requestDesign },
        token,
      );
      setDraft(currentDraft =>
        currentDraft?.id === updatedDream.id && currentDraft.status === 'draft'
          ? { ...updatedDream, design: requestDesign }
          : currentDraft,
      );
    } catch {
      lastSyncedDraftDesignRef.current = null;
    }
  }, [draft?.id, draft?.status, selectedDesign, token]);

  useEffect(() => {
    if (!hasHydratedComposeDraft || !token || draft?.status !== 'draft') {
      return undefined;
    }

    if (draftDesignSyncTimeoutRef.current) {
      clearTimeout(draftDesignSyncTimeoutRef.current);
    }
    draftDesignSyncTimeoutRef.current = setTimeout(() => {
      void flushDraftDesignToServer();
    }, 1000);

    return () => {
      if (draftDesignSyncTimeoutRef.current) {
        clearTimeout(draftDesignSyncTimeoutRef.current);
      }
    };
  }, [
    draft?.id,
    draft?.status,
    flushDraftDesignToServer,
    hasHydratedComposeDraft,
    selectedDesign,
    token,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        return;
      }
      if (cacheWriteTimeoutRef.current) {
        clearTimeout(cacheWriteTimeoutRef.current);
      }
      if (draftDesignSyncTimeoutRef.current) {
        clearTimeout(draftDesignSyncTimeoutRef.current);
      }
      flushComposeDraftCache();
      void flushDraftDesignToServer();
    });

    return () => {
      subscription.remove();
    };
  }, [flushComposeDraftCache, flushDraftDesignToServer]);

  const friends = useMemo(() => {
    const membersById = new Map<string, RecipientFriend>();

    rooms.forEach(room => {
      (room.members ?? []).forEach(member => {
        if (member.id !== currentUserId) {
          membersById.set(member.id, member);
        }
      });
      room.memberIds.forEach(memberId => {
        if (memberId !== currentUserId) {
          membersById.set(
            memberId,
            membersById.get(memberId) ??
              getDisplayMember(memberId, sessionUserId),
          );
        }
      });
    });

    const availableFriends = Array.from(membersById.values());
    if (availableFriends.length > 0 || sessionUserId) {
      return availableFriends;
    }
    return getSeedFriends();
  }, [currentUserId, rooms, sessionUserId]);
  const filteredFriends = useMemo(() => {
    const keyword = friendSearch.trim().toLowerCase();
    if (!keyword) {
      return friends;
    }

    return friends.filter(friend =>
      friend.name.toLowerCase().includes(keyword),
    );
  }, [friendSearch, friends]);

  const myRooms = useMemo(
    () => rooms.filter(room => room.memberIds.includes(currentUserId)),
    [rooms, currentUserId],
  );

  const canGenerate = rawInput.trim().length > 0 && !isGenerating;
  const selectedTone =
    toneOptions.find(item => item.value === tone) ?? toneOptions[0];
  const selectedLength =
    lengthOptions.find(item => item.value === storyLength) ?? lengthOptions[1];
  const selectedColorOption =
    CARD_COLOR_OPTIONS.find(item => item.value === selectedDesign.cardColor) ??
    CARD_COLOR_OPTIONS[0];
  const selectedFrameOption =
    CARD_FRAME_OPTIONS.find(item => item.value === selectedDesign.cardFrame) ??
    CARD_FRAME_OPTIONS[0];
  const selectedFontOption =
    FONT_STYLE_OPTIONS.find(item => item.value === selectedDesign.fontStyle) ??
    FONT_STYLE_OPTIONS[0];
  const trimmedLabel = externalLabel.trim();
  const trimmedPrivatePostscript = privatePostscript.trim();
  const recipientReady =
    recipientMode === 'friend'
      ? Boolean(selectedReceiverId)
      : trimmedLabel.length > 0;
  const isExternalRecipientReady =
    recipientMode === 'external' && recipientReady;
  const selectedReceiver = selectedReceiverId
    ? friends.find(friend => friend.id === selectedReceiverId) ??
      {
        ...getDisplayMember(selectedReceiverId, sessionUserId),
        profileImageUrl: null,
      }
    : null;
  const shouldConstrainRoomPicker = myRooms.length > VISIBLE_ROOM_PICKER_COUNT;

  const recipientSummary = (() => {
    if (recipientMode === 'friend') {
      return selectedReceiver ? `${selectedReceiver.name}에게` : null;
    }
    return trimmedLabel ? `${trimmedLabel}에게 (외부)` : null;
  })();

  const groupSummary =
    selectedGroupIds.length > 0
      ? selectedGroupIds
          .map(id => myRooms.find(room => room.id === id)?.name ?? '꿈방')
          .join(', ')
      : '꿈방 공유 없음';

  const previewDream = draft
    ? {
        ...draft,
        receiverId: recipientMode === 'friend' ? selectedReceiverId : null,
        receiverLabel:
          recipientMode === 'external' ? trimmedLabel || null : null,
        privatePostscript: trimmedPrivatePostscript || null,
        groupIds: selectedGroupIds,
        design: selectedDesign,
      }
    : null;

  const updateSelectedDesign = (nextDesign: DreamDesign) => {
    const normalizedDesign = normalizeDreamDesign(nextDesign);
    setSelectedDesign(normalizedDesign);
    setDraft(currentDraft =>
      currentDraft
        ? { ...currentDraft, design: normalizedDesign }
        : currentDraft,
    );
  };

  const updateCardColor = (cardColor: DreamDesign['cardColor']) => {
    if (isColorLocked(cardColor)) {
      openPassModal();
      return;
    }
    updateSelectedDesign({ ...selectedDesign, cardColor });
  };

  const updateCardFrame = (cardFrame: DreamDesign['cardFrame']) => {
    if (isFrameLocked(cardFrame)) {
      openPassModal();
      return;
    }
    updateSelectedDesign({ ...selectedDesign, cardFrame });
  };

  const updateFontStyle = (fontStyle: DreamDesign['fontStyle']) => {
    if (isFontLocked(fontStyle)) {
      openPassModal();
      return;
    }
    updateSelectedDesign({ ...selectedDesign, fontStyle });
  };

  const createPreview = async () => {
    const input = rawInput.trim();
    if (!input) {
      return;
    }

    setActionError(null);
    setIsGenerating(true);
    let nextDraft: Dream;
    const requestDesign = normalizeDreamDesign(selectedDesign);
    setSelectedDesign(requestDesign);
    try {
      nextDraft = await createDreamDraft(
        { rawInput: input, mood, tone, storyLength, design: requestDesign },
        token,
      );
    } catch (error) {
      if (token) {
        setActionError(
          error instanceof Error
            ? error.message
            : '카드 미리보기를 만들지 못했어요.',
        );
        return;
      }
      nextDraft = buildMockDraft(input, mood, requestDesign, storyLength);
    } finally {
      setIsGenerating(false);
    }

    const normalizedDraft = {
      ...nextDraft,
      design: normalizeDreamDesign(nextDraft.design ?? requestDesign),
    };
    lastSyncedDraftDesignRef.current = getDraftDesignSyncKey(
      normalizedDraft.id,
      normalizedDraft.design,
    );
    setRawInput(normalizedDraft.rawInput);
    setSelectedDesign(normalizedDraft.design);
    setDraft(normalizedDraft);
    setEditTitle(nextDraft.title);
    setEditStory(nextDraft.story);
    setIsEditOpen(false);
    setTimeout(() => {
      composeScrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 0);
  };

  const openEdit = () => {
    if (!draft) {
      return;
    }
    setEditTitle(draft.title);
    setEditStory(draft.story);
    setIsEditOpen(true);
  };

  const saveEdit = async () => {
    if (!draft) {
      return;
    }

    const title = editTitle.trim() || draft.title;
    const story = editStory.trim() || draft.story;
    const summary = story.slice(0, 48) || draft.summary;
    const requestDesign = normalizeDreamDesign(selectedDesign);
    setSelectedDesign(requestDesign);
    const nextDraft = {
      ...draft,
      title,
      story,
      summary,
      design: requestDesign,
    };

    if (!token) {
      setDraft(nextDraft);
      setIsEditOpen(false);
      return;
    }

    setActionError(null);
    setIsSavingEdit(true);
    try {
      const updatedDream = await updateDream(
        draft.id,
        { title, story, summary, design: requestDesign },
        token,
      );
      lastSyncedDraftDesignRef.current = getDraftDesignSyncKey(
        updatedDream.id,
        requestDesign,
      );
      setDraft(updatedDream);
      setIsEditOpen(false);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : '카드 수정을 저장하지 못했어요.',
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const toggleRoomSelection = (roomId: string) => {
    setSelectedGroupIds(currentIds =>
      currentIds.includes(roomId)
        ? currentIds.filter(id => id !== roomId)
        : [...currentIds, roomId],
    );
  };

  const confirmRecipient = () => {
    if (!recipientReady) {
      setActionError(
        recipientMode === 'friend'
          ? '받는 친구를 선택해주세요.'
          : '받는 사람 이름을 입력해주세요.',
      );
      return;
    }
    setActionError(null);
    setIsRecipientModalVisible(false);
  };

  const sendDream = async () => {
    if (!draft) {
      return;
    }
    if (!recipientReady) {
      setActionError('받는 사람을 먼저 선택하세요.');
      return;
    }
    if (!token) {
      setActionError('로그인이 필요합니다.');
      return;
    }

    setActionError(null);
    setIsGiving(true);
    const requestDesign = normalizeDreamDesign(selectedDesign);
    setSelectedDesign(requestDesign);
    if (draftDesignSyncTimeoutRef.current) {
      clearTimeout(draftDesignSyncTimeoutRef.current);
    }
    try {
      const dreamToGive = await updateDream(
        draft.id,
        { design: requestDesign },
        token,
      );
      lastSyncedDraftDesignRef.current = getDraftDesignSyncKey(
        dreamToGive.id,
        requestDesign,
      );
      setDraft(dreamToGive);
      const result = await giveDream(
        dreamToGive.id,
        {
          receiverId:
            recipientMode === 'friend' && selectedReceiverId
              ? selectedReceiverId
              : undefined,
          receiverLabel:
            recipientMode === 'external' ? trimmedLabel : undefined,
          groupIds: selectedGroupIds.map(toApiGroupId),
          privatePostscript: trimmedPrivatePostscript || undefined,
        },
        token,
      );
      removeComposeDraftSnapshot(sessionUserId);
      setDraft(result);
      setIsRecipientModalVisible(false);
      queryClient.setQueryData<Dream[]>(
        ['dreams', 'outbox', sessionUserId, token],
        currentDreams => [
          result,
          ...(currentDreams ?? []).filter(item => item.id !== result.id),
        ],
      );
      queryClient.invalidateQueries({ queryKey: ['rooms', sessionUserId] });
      selectedGroupIds.forEach(roomId => {
        queryClient.invalidateQueries({
          queryKey: ['rooms', roomId, 'dreams', sessionUserId],
        });
      });
      queryClient.invalidateQueries({
        queryKey: ['dreams', 'outbox', sessionUserId],
      });
      if (recipientMode === 'external') {
        try {
          const shareResult = await shareDream(result.id, token);
          await Share.share({
            title: result.title,
            url: shareResult.shareUrl,
            message: buildExternalShareMessage(
              result,
              shareResult.shareUrl,
              trimmedLabel,
            ),
          });
          navigation.navigate('MainTabs');
        } catch (shareError) {
          setActionError(
            shareError instanceof Error
              ? shareError.message
              : '카드는 보냈지만 공유 링크를 만들지 못했어요. 상세 화면에서 다시 공유해 주세요.',
          );
          navigation.replace('DreamDetail', { dream: result });
        }
        return;
      }
      const firstRoomId = selectedGroupIds[0];
      if (firstRoomId) {
        const firstRoom = myRooms.find(room => room.id === firstRoomId);
        navigation.replace('GroupRoom', {
          groupId: firstRoomId,
          groupName: firstRoom?.name,
          description: firstRoom?.description,
        });
      } else {
        navigation.navigate('MainTabs');
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : '꿈카드를 보내지 못했어요.',
      );
    } finally {
      setIsGiving(false);
    }
  };

  return (
    <ScrollView
      ref={composeScrollRef}
      style={styles.root}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        styles.content,
        { paddingBottom: Math.max(insets.bottom + 40, 84) },
      ]}
    >
      <PaperTextureOverlay />
      {!draft ? (
        <>
          <Text style={styles.label}>오늘 꾼 꿈</Text>
          <TextInput
            autoCorrect={false}
            spellCheck={false}
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
          <FadingHorizontalScroll
            style={styles.horizontalPicker}
            contentContainerStyle={styles.moodScroller}
          >
            {moods.map(item => {
              const isSelected = item === mood;
              return (
                <Pressable
                  key={item}
                  onPress={() => setMood(item)}
                  style={({ pressed }) => [
                    styles.moodButton,
                    isSelected && styles.moodButtonActive,
                    pressed && interactionStyles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.moodLabel,
                      isSelected && styles.moodLabelActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            })}
          </FadingHorizontalScroll>

          <Text style={styles.label}>어체</Text>
          <View style={styles.toneGrid}>
            {toneOptions.map(item => {
              const isSelected = item.value === tone;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  onPress={() => setTone(item.value)}
                  style={({ pressed }) => [
                    styles.toneOption,
                    isSelected && styles.toneOptionActive,
                    pressed && interactionStyles.pressedSoft,
                  ]}
                >
                  <Text
                    style={[
                      styles.toneLabel,
                      isSelected && styles.toneLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text style={styles.toneDescription}>{item.description}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.toneHint}>{selectedTone.description}</Text>

          <Text style={styles.label}>분량</Text>
          <View style={styles.lengthBar}>
            {lengthOptions.map(item => {
              const isSelected = item.value === storyLength;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setStoryLength(item.value)}
                  style={({ pressed }) => [
                    styles.lengthOption,
                    isSelected && styles.lengthOptionActive,
                    pressed && interactionStyles.pressedSoft,
                  ]}
                >
                  <Text
                    style={[
                      styles.lengthLabel,
                      isSelected && styles.lengthLabelActive,
                    ]}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.toneHint}>{selectedLength.description}</Text>

          {draft ? (
            <View style={styles.designPanel}>
              <View style={styles.designHeader}>
                <Palette color={colors.primary} size={19} strokeWidth={2.4} />
                <View style={styles.flex}>
                  <Text style={styles.designTitle}>카드 디자인</Text>
                  <Text style={styles.designSummary}>
                    {selectedFrameOption.label} · {selectedColorOption.label} ·{' '}
                    {selectedFontOption.label}
                  </Text>
                </View>
              </View>

              <Text style={styles.designLabel}>카드틀</Text>
              <View style={styles.frameGrid}>
                {CARD_FRAME_OPTIONS.map(option => {
                  const isSelected = option.value === selectedDesign.cardFrame;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityLabel={`${option.label} 카드틀`}
                      onPress={() => updateCardFrame(option.value)}
                      style={({ pressed }) => [
                        styles.frameOption,
                        isSelected && styles.frameOptionActive,
                        pressed && interactionStyles.pressedSoft,
                      ]}
                    >
                      <View style={styles.framePreview}>
                        <DreamCardFrame
                          compact
                          backgroundColor={isSelected ? '#FFF8EC' : '#FFFDF6'}
                          borderColor={isSelected ? colors.primary : '#A89473'}
                          frame={option.value}
                          height={88}
                          style={styles.framePreviewCard}
                          textureColor="#8A7A61"
                        >
                          <View style={styles.framePreviewImage} />
                          <View style={styles.framePreviewLine} />
                          <View
                            style={[
                              styles.framePreviewLine,
                              styles.framePreviewLineShort,
                            ]}
                          />
                        </DreamCardFrame>
                        {isFrameLocked(option.value) ? (
                          <View style={styles.designLockChip}>
                            <Lock
                              color={colors.primary}
                              size={11}
                              strokeWidth={2.5}
                            />
                          </View>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.frameOptionText,
                          isSelected && styles.frameOptionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.frameOptionDescription}>
                        {option.description}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.designLabel}>카드 색감</Text>
              <FadingHorizontalScroll
                style={styles.horizontalPicker}
                contentContainerStyle={styles.colorScroller}
                fadeColor={colors.cardBase}
              >
                {CARD_COLOR_OPTIONS.map(option => {
                  const isSelected = option.value === selectedDesign.cardColor;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      accessibilityLabel={`${option.label} 카드 색감`}
                      onPress={() => updateCardColor(option.value)}
                      style={({ pressed }) => [
                        styles.colorOption,
                        isSelected && styles.colorOptionActive,
                        pressed && interactionStyles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: option.swatch },
                          option.value === 'midnight' && styles.darkSwatch,
                        ]}
                      >
                        {isSelected ? (
                          <Check
                            color={
                              option.value === 'midnight'
                                ? '#FFFFFF'
                                : colors.primaryDark
                            }
                            size={15}
                            strokeWidth={3}
                          />
                        ) : isColorLocked(option.value) ? (
                          <Lock
                            color={
                              option.value === 'midnight'
                                ? '#FFFFFF'
                                : colors.textMuted
                            }
                            size={12}
                            strokeWidth={2.5}
                          />
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.colorOptionText,
                          isSelected && styles.colorOptionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </FadingHorizontalScroll>

              <Text style={styles.designLabel}>뒷면 글씨체</Text>
              <View style={styles.fontGrid}>
                {FONT_STYLE_OPTIONS.map(option => {
                  const isSelected = option.value === selectedDesign.fontStyle;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="button"
                      onPress={() => updateFontStyle(option.value)}
                      style={({ pressed }) => [
                        styles.fontOption,
                        isSelected && styles.fontOptionActive,
                        pressed && interactionStyles.pressedSoft,
                      ]}
                    >
                      <Text
                        style={[
                          styles.fontOptionTitle,
                          getDreamFontStyle(option.value),
                          isSelected && styles.fontOptionTitleActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                      <Text style={styles.fontOptionDescription}>
                        {option.description}
                      </Text>
                      {isFontLocked(option.value) ? (
                        <View style={styles.designLockChip}>
                          <Lock
                            color={colors.primary}
                            size={11}
                            strokeWidth={2.5}
                          />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          <PrimaryButton disabled={!canGenerate} onPress={createPreview}>
            {isGenerating ? '꿈카드 빚는 중...' : '카드 미리보기 만들기'}
          </PrimaryButton>
          {actionError ? (
            <Text style={styles.errorText}>{actionError}</Text>
          ) : null}
        </>
      ) : null}
      {draft ? (
        <View style={styles.preview}>
          <View style={styles.previewHeader}>
            <View style={styles.flex}>
              <Text style={styles.previewTitle}>미리보기</Text>
              <Text style={styles.previewMeta}>
                {recipientSummary
                  ? `${recipientSummary} · ${groupSummary}`
                  : '받는 사람을 선택하세요'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={openEdit}
              style={({ pressed }) => [
                styles.editButton,
                pressed && interactionStyles.pressed,
              ]}
            >
              <PencilLine color={colors.primary} size={18} />
              <Text style={styles.editButtonText}>수정</Text>
            </Pressable>
          </View>

          {isEditOpen ? (
            <View style={styles.editPanel}>
              <Text style={styles.editLabel}>카드 제목</Text>
              <TextInput
                autoCorrect={false}
                spellCheck={false}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="카드 제목"
                placeholderTextColor={colors.textMuted}
                style={styles.editInput}
              />
              <Text style={styles.editLabel}>뒷면 내용</Text>
              <TextInput
                autoCorrect={false}
                spellCheck={false}
                value={editStory}
                onChangeText={setEditStory}
                multiline
                textAlignVertical="top"
                placeholder="카드 뒷면에 들어갈 꿈 이야기"
                placeholderTextColor={colors.textMuted}
                style={[styles.editInput, styles.storyInput]}
              />
              <PrimaryButton disabled={isSavingEdit} onPress={saveEdit}>
                {isSavingEdit ? '저장 중...' : '수정 저장'}
              </PrimaryButton>
            </View>
          ) : null}

          {previewDream ? <DreamCard dream={previewDream} /> : null}
          <View style={styles.designPanel}>
            <View style={styles.designHeader}>
              <Palette color={colors.primary} size={19} strokeWidth={2.4} />
              <View style={styles.flex}>
                <Text style={styles.designTitle}>카드 디자인</Text>
                <Text style={styles.designSummary}>
                  {selectedFrameOption.label} · {selectedColorOption.label} ·{' '}
                  {selectedFontOption.label}
                </Text>
              </View>
            </View>

            <Text style={styles.designLabel}>카드틀</Text>
            <View style={styles.frameGrid}>
              {CARD_FRAME_OPTIONS.map(option => {
                const isSelected = option.value === selectedDesign.cardFrame;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityLabel={`${option.label} 카드틀`}
                    onPress={() => updateCardFrame(option.value)}
                    style={({ pressed }) => [
                      styles.frameOption,
                      isSelected && styles.frameOptionActive,
                      pressed && interactionStyles.pressedSoft,
                    ]}
                  >
                    <View style={styles.framePreview}>
                      <DreamCardFrame
                        compact
                        backgroundColor={isSelected ? '#FFF8EC' : '#FFFDF6'}
                        borderColor={isSelected ? colors.primary : '#A89473'}
                        frame={option.value}
                        height={88}
                        style={styles.framePreviewCard}
                        textureColor="#8A7A61"
                      >
                        <View style={styles.framePreviewImage} />
                        <View style={styles.framePreviewLine} />
                        <View
                          style={[
                            styles.framePreviewLine,
                            styles.framePreviewLineShort,
                          ]}
                        />
                      </DreamCardFrame>
                      {isFrameLocked(option.value) ? (
                        <View style={styles.designLockChip}>
                          <Lock
                            color={colors.primary}
                            size={11}
                            strokeWidth={2.5}
                          />
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.frameOptionText,
                        isSelected && styles.frameOptionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.frameOptionDescription}>
                      {option.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.designLabel}>카드 색감</Text>
            <FadingHorizontalScroll
              style={styles.horizontalPicker}
              contentContainerStyle={styles.colorScroller}
              fadeColor={colors.cardBase}
            >
              {CARD_COLOR_OPTIONS.map(option => {
                const isSelected = option.value === selectedDesign.cardColor;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    accessibilityLabel={`${option.label} 카드 색감`}
                    onPress={() => updateCardColor(option.value)}
                    style={({ pressed }) => [
                      styles.colorOption,
                      isSelected && styles.colorOptionActive,
                      pressed && interactionStyles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: option.swatch },
                        option.value === 'midnight' && styles.darkSwatch,
                      ]}
                    >
                      {isSelected ? (
                        <Check
                          color={
                            option.value === 'midnight'
                              ? '#FFFFFF'
                              : colors.primaryDark
                          }
                          size={15}
                          strokeWidth={3}
                        />
                      ) : isColorLocked(option.value) ? (
                        <Lock
                          color={
                            option.value === 'midnight'
                              ? '#FFFFFF'
                              : colors.textMuted
                          }
                          size={12}
                          strokeWidth={2.5}
                        />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        styles.colorOptionText,
                        isSelected && styles.colorOptionTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </FadingHorizontalScroll>

            <Text style={styles.designLabel}>뒷면 글씨체</Text>
            <View style={styles.fontGrid}>
              {FONT_STYLE_OPTIONS.map(option => {
                const isSelected = option.value === selectedDesign.fontStyle;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="button"
                    onPress={() => updateFontStyle(option.value)}
                    style={({ pressed }) => [
                      styles.fontOption,
                      isSelected && styles.fontOptionActive,
                      pressed && interactionStyles.pressedSoft,
                    ]}
                  >
                    <Text
                      style={[
                        styles.fontOptionTitle,
                        getDreamFontStyle(option.value),
                        isSelected && styles.fontOptionTitleActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.fontOptionDescription}>
                      {option.description}
                    </Text>
                    {isFontLocked(option.value) ? (
                      <View style={styles.designLockChip}>
                        <Lock
                          color={colors.primary}
                          size={11}
                          strokeWidth={2.5}
                        />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <PrimaryButton onPress={() => setIsRecipientModalVisible(true)}>
            {recipientReady ? '받는 사람 변경' : '받는 사람 선택하기'}
          </PrimaryButton>
          {isExternalRecipientReady ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="카톡 등으로 공유하기"
              disabled={isGiving}
              onPress={sendDream}
              style={({ pressed }) => [
                styles.externalShareButton,
                isGiving && styles.externalShareButtonDisabled,
                pressed && !isGiving && interactionStyles.pressed,
              ]}
            >
              <Share2 color={colors.primary} size={20} strokeWidth={2.5} />
              <Text style={styles.externalShareButtonText}>
                {isGiving ? '공유 준비 중...' : '카톡 등으로 공유하기'}
              </Text>
            </Pressable>
          ) : (
            <PrimaryButton
              disabled={!recipientReady || isGiving}
              onPress={sendDream}
            >
              {isGiving ? '보내는 중...' : '보내기'}
            </PrimaryButton>
          )}
          {actionError ? (
            <Text style={styles.errorText}>{actionError}</Text>
          ) : null}
        </View>
      ) : null}

      <Modal animationType="fade" transparent visible={isGenerating}>
        <View style={styles.loadingBackdrop}>
          <View style={styles.loadingPanel}>
            <DreamGenerationAnimation
              title="꿈카드를 만드는 중"
              subtitle="달빛과 구름 사이에서 카드 문장과 이미지를 고르고 있어요."
            />
          </View>
        </View>
      </Modal>

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
              <View style={styles.flex}>
                <Text style={styles.sheetTitle}>받는 사람과 공유 방</Text>
                <Text style={styles.sheetSubtitle}>
                  꿈카드는 한 사람에게 보내고, 원하는 꿈방에 함께 공유할 수
                  있어요.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="닫기"
                accessibilityRole="button"
                onPress={() => setIsRecipientModalVisible(false)}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && interactionStyles.pressed,
                ]}
              >
                <X color={colors.textSecondary} size={20} />
              </Pressable>
            </View>

            <View style={styles.modeRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setRecipientMode('friend')}
                style={({ pressed }) => [
                  styles.modeChip,
                  recipientMode === 'friend' && styles.modeChipActive,
                  pressed && interactionStyles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    recipientMode === 'friend' && styles.modeChipTextActive,
                  ]}
                >
                  꿈방 멤버
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => setRecipientMode('external')}
                style={({ pressed }) => [
                  styles.modeChip,
                  recipientMode === 'external' && styles.modeChipActive,
                  pressed && interactionStyles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.modeChipText,
                    recipientMode === 'external' && styles.modeChipTextActive,
                  ]}
                >
                  외부 (이름으로)
                </Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={styles.sheetScrollContent}
              showsVerticalScrollIndicator={false}
            >
              {recipientMode === 'friend' ? (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>받는 꿈방 멤버</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setIsFriendPickerVisible(true)}
                    style={({ pressed }) => [
                      styles.friendPickerButton,
                      selectedReceiver && styles.selectedItem,
                      pressed && interactionStyles.pressedSoft,
                    ]}
                  >
                    {selectedReceiver ? (
                      <ProfileAvatar
                        size={42}
                        value={selectedReceiver.profileImageUrl}
                        fallbackColor={selectedReceiver.avatarColor}
                      />
                    ) : (
                      <View style={styles.searchIconWrap}>
                        <Search color={colors.primary} size={20} />
                      </View>
                    )}
                    <View style={styles.friendPickerText}>
                      <Text style={styles.friendName}>
                        {selectedReceiver?.name ?? '꿈방 멤버 검색'}
                      </Text>
                      <Text style={styles.friendPickerHint}>
                        이름으로 검색해서 받는 사람을 선택해요.
                      </Text>
                    </View>
                    {selectedReceiver ? (
                      <Check color={colors.primary} size={20} />
                    ) : null}
                  </Pressable>
                  {friends.length === 0 ? (
                    <Text style={styles.emptyText}>
                      아직 함께 속한 꿈방 멤버가 없어요. 외부 모드로 보내보세요.
                    </Text>
                  ) : null}
                </View>
              ) : (
                <View style={styles.sectionBlock}>
                  <Text style={styles.sectionTitle}>받는 사람 이름</Text>
                  <TextInput
                    autoCorrect={false}
                    spellCheck={false}
                    value={externalLabel}
                    onChangeText={setExternalLabel}
                    placeholder="예: 엄마, 지영"
                    placeholderTextColor={colors.textMuted}
                    maxLength={50}
                    style={styles.labelInput}
                  />
                  <Text style={styles.hintText}>
                    링크로 카드를 받게 되는 사람에게 보여줄 호칭이에요. 카톡 등
                    외부에 공유한 링크로 그 사람이 들어와 카드를 받으면, 받는
                    사람이 자동으로 연결됩니다.
                  </Text>
                </View>
              )}

              <View style={styles.sectionBlock}>
                <Text style={styles.sectionTitle}>
                  공유할 꿈방 (다중 선택, 선택사항)
                </Text>
                <ScrollView
                  nestedScrollEnabled
                  scrollEnabled={shouldConstrainRoomPicker}
                  showsVerticalScrollIndicator={shouldConstrainRoomPicker}
                  style={
                    shouldConstrainRoomPicker
                      ? styles.groupListConstrained
                      : undefined
                  }
                  contentContainerStyle={styles.groupList}
                >
                  {myRooms.map(room => {
                    const isSelected = selectedGroupIds.includes(room.id);
                    return (
                      <Pressable
                        key={room.id}
                        accessibilityRole="button"
                        onPress={() => toggleRoomSelection(room.id)}
                        style={({ pressed }) => [
                          styles.groupItem,
                          isSelected && styles.selectedItem,
                          pressed && interactionStyles.pressedSoft,
                        ]}
                      >
                        <View style={styles.groupText}>
                          <Text style={styles.groupName}>{room.name}</Text>
                          <Text style={styles.groupMeta} numberOfLines={1}>
                            {((room.members ?? []).length > 0
                              ? room.members
                              : room.memberIds.map(memberId =>
                                  getDisplayMember(memberId, sessionUserId),
                                )
                            )
                              .map(member => member.name)
                              .join(', ')}
                          </Text>
                        </View>
                        {isSelected ? (
                          <Check color={colors.primary} size={20} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                  {myRooms.length === 0 ? (
                    <Text style={styles.emptyText}>
                      아직 가입한 꿈방이 없어요. 친구에게 1:1로 보내거나 새 방을
                      만들어보세요.
                    </Text>
                  ) : null}
                </ScrollView>
              </View>

              <View style={styles.sectionBlock}>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>비밀 추신</Text>
                  <Text style={styles.characterCount}>
                    {privatePostscript.length}/{PRIVATE_POSTSCRIPT_MAX_LENGTH}
                  </Text>
                </View>
                <TextInput
                  autoCorrect={false}
                  spellCheck={false}
                  value={privatePostscript}
                  onChangeText={setPrivatePostscript}
                  multiline
                  maxLength={PRIVATE_POSTSCRIPT_MAX_LENGTH}
                  textAlignVertical="top"
                  placeholder="받는 사람에게만 남길 짧은 말을 적어보세요."
                  placeholderTextColor={colors.textMuted}
                  style={[styles.labelInput, styles.postscriptInput]}
                />
                <Text style={styles.hintText}>
                  보낸 사람과 받은 사람에게만 보여요. 꿈방에 공유되어도 다른 멤버는 볼 수 없어요.
                </Text>
              </View>
            </ScrollView>

            <PrimaryButton
              disabled={!recipientReady}
              onPress={confirmRecipient}
            >
              선택 완료
            </PrimaryButton>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={isFriendPickerVisible}
        onRequestClose={() => setIsFriendPickerVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setIsFriendPickerVisible(false)}
        >
          <Pressable
            style={styles.friendPickerSheet}
            onPress={event => event.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.flex}>
                <Text style={styles.sheetTitle}>꿈방 멤버 선택</Text>
                <Text style={styles.sheetSubtitle}>
                  함께 가입된 꿈방 멤버 중 받을 사람을 검색해요.
                </Text>
              </View>
              <Pressable
                accessibilityLabel="닫기"
                accessibilityRole="button"
                onPress={() => setIsFriendPickerVisible(false)}
                style={({ pressed }) => [
                  styles.closeButton,
                  pressed && interactionStyles.pressed,
                ]}
              >
                <X color={colors.textSecondary} size={20} />
              </Pressable>
            </View>
            <View style={styles.searchInputWrap}>
              <Search color={colors.textMuted} size={19} />
              <TextInput
                autoCorrect={false}
                spellCheck={false}
                value={friendSearch}
                onChangeText={setFriendSearch}
                placeholder="이름 검색"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
              />
            </View>
            <ScrollView
              style={styles.friendPickerList}
              contentContainerStyle={styles.friendPickerListContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredFriends.map(friend => (
                <Pressable
                  key={friend.id}
                  accessibilityRole="button"
                  onPress={() => {
                    setSelectedReceiverId(friend.id);
                    setIsFriendPickerVisible(false);
                  }}
                  style={({ pressed }) => [
                    styles.friendItem,
                    selectedReceiverId === friend.id && styles.selectedItem,
                    pressed && interactionStyles.pressedSoft,
                  ]}
                >
                  <ProfileAvatar
                    size={38}
                    value={friend.profileImageUrl}
                    fallbackColor={friend.avatarColor}
                  />
                  <Text style={styles.friendName}>{friend.name}</Text>
                  {selectedReceiverId === friend.id ? (
                    <Check color={colors.primary} size={20} />
                  ) : null}
                </Pressable>
              ))}
              {filteredFriends.length === 0 ? (
                <Text style={styles.emptyText}>
                  검색 결과가 없어요. 같은 꿈방에 있는 멤버만 선택할 수 있어요.
                </Text>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function getSnapshotDesign(snapshot: ComposeDraftSnapshot | null) {
  return normalizeDreamDesign(
    snapshot?.draft?.design ?? snapshot?.selectedDesign ?? DEFAULT_DREAM_DESIGN,
  );
}

function getSnapshotDraft(
  snapshot: ComposeDraftSnapshot | null,
  design: DreamDesign,
) {
  return snapshot?.draft?.status === 'draft'
    ? { ...snapshot.draft, design }
    : null;
}

function getSnapshotRawInput(
  snapshot: ComposeDraftSnapshot | null,
  draft: Dream | null,
) {
  return typeof snapshot?.rawInput === 'string'
    ? snapshot.rawInput
    : draft?.rawInput ?? '';
}

function getSnapshotMood(snapshot: ComposeDraftSnapshot | null) {
  return typeof snapshot?.mood === 'string' ? snapshot.mood : moods[0];
}

function getSnapshotTone(snapshot: ComposeDraftSnapshot | null): ToneValue {
  return isToneValue(snapshot?.tone) ? snapshot.tone : 'warm';
}

function getSnapshotStoryLength(
  snapshot: ComposeDraftSnapshot | null,
): DreamStoryLength {
  return isStoryLength(snapshot?.storyLength)
    ? snapshot.storyLength
    : 'standard';
}

function sanitizeGroupIds(value: unknown) {
  return Array.isArray(value)
    ? value.filter((groupId): groupId is string => typeof groupId === 'string')
    : [];
}

function getDraftDesignSyncKey(draftId: string, design: DreamDesign) {
  const normalized = normalizeDreamDesign(design);
  return [
    draftId,
    normalized.cardColor,
    normalized.cardFrame,
    normalized.fontStyle,
  ].join(':');
}

function isToneValue(value: unknown): value is ToneValue {
  return toneOptions.some(option => option.value === value);
}

function isStoryLength(value: unknown): value is DreamStoryLength {
  return lengthOptions.some(option => option.value === value);
}

function toApiGroupId(groupId: string) {
  return groupId.startsWith('g:') ? groupId.slice(2) : groupId;
}

function buildExternalShareMessage(
  dream: Dream,
  shareUrl: string,
  recipientLabel: string,
) {
  const recipientText = recipientLabel || dream.receiverLabel || '친구';
  return `${recipientText}에게 보낸 꿈카드\n"${dream.shortMessage}"\n\n${shareUrl}\n\n링크를 열면 꿈드림 앱에서 바로 카드를 받을 수 있어요.`;
}

type FadingHorizontalScrollProps = {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  fadeColor?: string;
  style?: StyleProp<ViewStyle>;
};

function FadingHorizontalScroll({
  children,
  contentContainerStyle,
  fadeColor = colors.background,
  style,
}: FadingHorizontalScrollProps) {
  const reactId = useId();
  const gradientId = `horizontalFade-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const [viewportWidth, setViewportWidth] = useState(0);
  const [contentWidth, setContentWidth] = useState(0);
  const [scrollX, setScrollX] = useState(0);
  const showStartFade = scrollX > 2;
  const showEndFade = contentWidth - viewportWidth - scrollX > 2;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollX(event.nativeEvent.contentOffset.x);
  };

  return (
    <View
      style={[styles.horizontalFadeWrap, style]}
      onLayout={event => {
        setViewportWidth(event.nativeEvent.layout.width);
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onContentSizeChange={(width: number) => {
          setContentWidth(width);
        }}
        onScroll={handleScroll}
        style={styles.horizontalFadeScroll}
        contentContainerStyle={contentContainerStyle}
      >
        {children}
      </ScrollView>
      {showStartFade ? (
        <View pointerEvents="none" style={styles.horizontalFadeStart}>
          <Svg
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient
                id={`${gradientId}-start`}
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <Stop offset="0" stopColor={fadeColor} stopOpacity={1} />
                <Stop offset="0.32" stopColor={fadeColor} stopOpacity={0.78} />
                <Stop offset="1" stopColor={fadeColor} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill={`url(#${gradientId}-start)`}
            />
          </Svg>
        </View>
      ) : null}
      {showEndFade ? (
        <View pointerEvents="none" style={styles.horizontalFadeEnd}>
          <Svg
            width="100%"
            height="100%"
            preserveAspectRatio="none"
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={fadeColor} stopOpacity={0} />
                <Stop offset="0.68" stopColor={fadeColor} stopOpacity={0.78} />
                <Stop offset="1" stopColor={fadeColor} stopOpacity={1} />
              </LinearGradient>
            </Defs>
            <Rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill={`url(#${gradientId})`}
            />
          </Svg>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 15,
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
    fontFamily: fontFamily.handwritten,
    fontSize: 16,
    lineHeight: 24,
  },
  horizontalPicker: {
    flexGrow: 0,
  },
  horizontalFadeWrap: {
    position: 'relative',
    flexGrow: 0,
  },
  horizontalFadeScroll: {
    flexGrow: 0,
  },
  horizontalFadeEnd: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 46,
  },
  horizontalFadeStart: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 46,
  },
  moodScroller: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 42,
  },
  moodButton: {
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  moodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  moodLabel: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontFamily: fontFamily.handwritten,
    fontSize: 14,
    textAlign: 'center',
    includeFontPadding: false,
  },
  moodLabelActive: {
    color: '#FFFFFF',
  },
  toneGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  toneOption: {
    width: '48%',
    minHeight: 78,
    borderRadius: 16,
    padding: 12,
    justifyContent: 'center',
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  toneOptionActive: {
    backgroundColor: colors.lavenderMist,
    borderColor: colors.primary,
  },
  toneLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 14,
    includeFontPadding: false,
  },
  toneLabelActive: {
    color: colors.primaryDark,
  },
  toneDescription: {
    marginTop: 7,
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 17,
  },
  toneHint: {
    marginTop: -6,
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
  lengthBar: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  lengthOption: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lengthOptionActive: {
    backgroundColor: colors.primary,
  },
  lengthLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 13,
    includeFontPadding: false,
  },
  lengthLabelActive: {
    color: '#FFFFFF',
  },
  designPanel: {
    borderRadius: 20,
    padding: 16,
    gap: 12,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  designHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  designTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 16,
    includeFontPadding: false,
  },
  designSummary: {
    marginTop: 4,
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 12,
    includeFontPadding: false,
  },
  designLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 13,
    includeFontPadding: false,
  },
  frameGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  frameOption: {
    width: '48%',
    minHeight: 154,
    borderRadius: 16,
    padding: 11,
    gap: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  frameOptionActive: {
    backgroundColor: colors.lavenderMist,
    borderColor: colors.primary,
  },
  framePreview: {
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
  },
  designLockChip: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 253, 247, 0.92)',
    borderWidth: 1,
    borderColor: colors.lavenderTint,
  },
  framePreviewCard: {
    width: 58,
  },
  framePreviewImage: {
    height: 42,
    borderRadius: 4,
    backgroundColor: 'rgba(168, 148, 115, 0.17)',
  },
  framePreviewLine: {
    marginTop: 6,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(168, 148, 115, 0.3)',
  },
  framePreviewLineShort: {
    width: '62%',
  },
  frameOptionText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 13,
    includeFontPadding: false,
  },
  frameOptionTextActive: {
    color: colors.primaryDark,
  },
  frameOptionDescription: {
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontWeight: '600',
    fontSize: 10.5,
    lineHeight: 14,
  },
  colorScroller: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 42,
  },
  colorOption: {
    minHeight: 42,
    borderRadius: 999,
    paddingVertical: 7,
    paddingLeft: 7,
    paddingRight: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  colorOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.lavenderMist,
  },
  colorSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(40,35,63,0.08)',
  },
  darkSwatch: {
    borderColor: 'rgba(255,255,255,0.36)',
  },
  colorOptionText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 13,
    includeFontPadding: false,
  },
  colorOptionTextActive: {
    color: colors.primaryDark,
  },
  fontGrid: {
    gap: 8,
  },
  fontOption: {
    minHeight: 58,
    borderRadius: 16,
    paddingHorizontal: 13,
    paddingVertical: 11,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  fontOptionActive: {
    backgroundColor: colors.lavenderMist,
    borderColor: colors.primary,
  },
  fontOptionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontSize: 14,
    fontWeight: '800',
    includeFontPadding: false,
  },
  fontOptionTitleActive: {
    color: colors.primaryDark,
  },
  fontOptionDescription: {
    marginTop: 5,
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '600',
    fontSize: 12,
    lineHeight: 17,
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
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 18,
    includeFontPadding: false,
  },
  previewMeta: {
    marginTop: 5,
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '600',
    fontSize: 13,
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
    fontFamily: fontFamily.handwritten,
    fontSize: 14,
    fontWeight: '700',
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
    fontFamily: fontFamily.handwritten,
    fontSize: 14,
    fontWeight: '700',
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
    fontFamily: fontFamily.handwritten,
    fontSize: 15,
    fontWeight: '600',
  },
  storyInput: {
    minHeight: 140,
    paddingTop: 14,
    lineHeight: 22,
  },
  externalShareButton: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.lavenderMist,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 18,
  },
  externalShareButtonDisabled: {
    opacity: 0.5,
  },
  externalShareButtonText: {
    color: colors.primaryDark,
    fontFamily: fontFamily.handwritten,
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },
  loadingBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(248, 246, 255, 0.96)',
  },
  loadingPanel: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: 'rgba(255, 252, 255, 0.92)',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(40, 35, 63, 0.32)',
  },
  recipientSheet: {
    maxHeight: '90%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 28,
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
    fontFamily: fontFamily.handwritten,
    fontSize: 22,
    fontWeight: '700',
    includeFontPadding: false,
  },
  sheetSubtitle: {
    marginTop: 6,
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
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
    backgroundColor: colors.lavenderMist,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: colors.lavenderMist,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  modeChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.lavenderTint,
  },
  modeChipText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontSize: 14,
    fontWeight: '700',
    includeFontPadding: false,
  },
  modeChipTextActive: {
    color: colors.primaryDark,
  },
  sheetScroll: {
    maxHeight: 460,
  },
  sheetScrollContent: {
    gap: 18,
    paddingBottom: 8,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontSize: 15,
    fontWeight: '700',
    includeFontPadding: false,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  characterCount: {
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
  },
  labelInput: {
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.divider,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    paddingHorizontal: 14,
    fontFamily: fontFamily.handwritten,
    fontSize: 15,
    fontWeight: '600',
  },
  postscriptInput: {
    minHeight: 86,
    paddingTop: 12,
    paddingBottom: 12,
    lineHeight: 22,
  },
  hintText: {
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
  },
  friendPickerButton: {
    minHeight: 68,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.lavenderMist,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  searchIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBase,
  },
  friendPickerText: {
    flex: 1,
  },
  friendPickerHint: {
    marginTop: 4,
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontSize: 12,
    fontWeight: '600',
    includeFontPadding: false,
  },
  friendPickerSheet: {
    maxHeight: '82%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 28,
    gap: 14,
    backgroundColor: colors.cardBase,
  },
  searchInputWrap: {
    minHeight: 50,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontSize: 15,
    fontWeight: '600',
  },
  friendPickerList: {
    maxHeight: 380,
  },
  friendPickerListContent: {
    gap: 10,
    paddingBottom: 8,
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
    backgroundColor: colors.lavenderTint,
  },
  friendName: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },
  groupList: {
    gap: 10,
  },
  groupListConstrained: {
    maxHeight: 286,
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
    fontFamily: fontFamily.handwritten,
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },
  groupMeta: {
    marginTop: 5,
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    color: colors.error,
    fontFamily: fontFamily.handwritten,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
