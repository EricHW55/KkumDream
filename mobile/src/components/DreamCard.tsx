import { useEffect, useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';
import {
  Alert,
  Image,
  InteractionManager,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { Download, Share2 } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';

import paperTexture from '../assets/textures/paper_texture.webp';
import letterButterfly from '../assets/letter-paper/decorations/butterfly.png';
import letterButterfly2 from '../assets/letter-paper/decorations/butterfly2.png';
import letterFlower1 from '../assets/letter-paper/decorations/flower1.png';
import letterFlower2 from '../assets/letter-paper/decorations/flower2.png';
import letterFlower3 from '../assets/letter-paper/decorations/flower3.png';
import letterFlower4 from '../assets/letter-paper/decorations/flower4.png';
import { colors } from '../theme/colors';
import {
  CARD_COLOR_THEMES,
  getDreamFontStyle,
  getImageTextureLabel,
  normalizeDreamDesign,
} from '../theme/dreamDesigns';
import { interactionStyles } from '../theme/interactions';
import { fontFamily } from '../theme/typography';
import { saveDreamImage, shareDreamImage } from '../native/dreamImageActions';
import type { Dream, DreamLetterPaper } from '../types/dream';
import { getCachedRooms } from '../data/dreamRepository';
import { getDisplayMember } from '../data/members';
import { useSessionStore } from '../store/sessionStore';
import { DREAM_CARD_ASPECT_RATIO, DreamCardFrame } from './DreamCardFrame';
import { DreamGenerationAnimation } from './DreamGenerationAnimation';

const BACK_SCROLL_EDGE_EPS = 2;
const LETTER_LINE_MAX_COUNT = 72;
const LETTER_LINE_CHAR_WIDTH = 18;
const LETTER_EXTRA_LINE_COUNT = 3;
const DEFAULT_LETTER_CONTENT_PADDING = { top: 16, bottom: 16 };
// Height of the inline blossom flower (keep in sync with letterBlossomInline).
const BLOSSOM_INLINE_HEIGHT = 158;
const DEFAULT_LETTER_TEXT_INSET = { top: 0, bottom: 0 };
const LETTER_CONTENT_PADDING_BY_PAPER: Record<
  DreamLetterPaper,
  { top: number; bottom: number }
> = {
  plain: DEFAULT_LETTER_CONTENT_PADDING,
  lined: DEFAULT_LETTER_CONTENT_PADDING,
  ornament: DEFAULT_LETTER_CONTENT_PADDING,
  vintage: DEFAULT_LETTER_CONTENT_PADDING,
  botanical: DEFAULT_LETTER_CONTENT_PADDING,
  moonlit: DEFAULT_LETTER_CONTENT_PADDING,
  postcard: { top: 36, bottom: 16 },
  butterfly: { top: 16, bottom: 72 },
  corner_flower: { top: 0, bottom: 18 },
  rose: { top: 16, bottom: 132 },
  blossom: { top: 0, bottom: 20 },
  wildflower: { top: 18, bottom: 148 },
};
const LETTER_TEXT_INSET_BY_PAPER: Record<
  DreamLetterPaper,
  { top: number; bottom: number }
> = {
  plain: DEFAULT_LETTER_TEXT_INSET,
  lined: DEFAULT_LETTER_TEXT_INSET,
  ornament: DEFAULT_LETTER_TEXT_INSET,
  vintage: DEFAULT_LETTER_TEXT_INSET,
  botanical: DEFAULT_LETTER_TEXT_INSET,
  moonlit: DEFAULT_LETTER_TEXT_INSET,
  postcard: DEFAULT_LETTER_TEXT_INSET,
  butterfly: DEFAULT_LETTER_TEXT_INSET,
  corner_flower: DEFAULT_LETTER_TEXT_INSET,
  rose: DEFAULT_LETTER_TEXT_INSET,
  blossom: DEFAULT_LETTER_TEXT_INSET,
  wildflower: DEFAULT_LETTER_TEXT_INSET,
};
export const POSTCARD_STAMP_VARIANTS = [
  { accent: '#A9815B', background: 'rgba(251, 233, 196, 0.76)', mark: '✦' },
  { accent: '#8F755F', background: 'rgba(244, 226, 201, 0.78)', mark: '☾' },
  { accent: '#9B7F4B', background: 'rgba(249, 235, 189, 0.76)', mark: '✿' },
  { accent: '#7E875F', background: 'rgba(232, 238, 206, 0.76)', mark: '✾' },
  { accent: '#8F6C8A', background: 'rgba(241, 224, 239, 0.72)', mark: '✧' },
  { accent: '#7A7F9A', background: 'rgba(226, 231, 245, 0.72)', mark: '★' },
  { accent: '#9A7053', background: 'rgba(248, 224, 203, 0.74)', mark: '⌁' },
] as const;

type Props = {
  dream: Dream;
  size?: 'feed' | 'full';
  width?: number;
  disableFlip?: boolean;
  onPress?: () => void;
  onBackOpen?: () => void;
  preferThumbnail?: boolean;
  loadFullImageProgressively?: boolean;
  showImageActions?: boolean;
  giverName?: string;
  receiverName?: string;
  variant?: 'full' | 'lite';
  initialSide?: 'front' | 'back';
  onParentScrollEnabledChange?: (enabled: boolean) => void;
};

export function DreamCard({
  dream,
  size = 'feed',
  width,
  disableFlip = false,
  onPress,
  onBackOpen,
  preferThumbnail = false,
  loadFullImageProgressively = false,
  showImageActions = true,
  giverName: giverNameOverride,
  receiverName: receiverNameOverride,
  variant = 'full',
  initialSide = 'front',
  onParentScrollEnabledChange,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const sessionUserId = useSessionStore(state => state.userId);
  const isLite = variant === 'lite';
  const isHidden = Boolean(dream.isHidden);
  const flipDisabled = disableFlip || isLite || isHidden;
  const startsOnBack = initialSide === 'back' && !flipDisabled;
  const useThumbnail = preferThumbnail || isLite;
  const allowImageActions = showImageActions && !isLite;
  const [isBackVisible, setIsBackVisible] = useState(startsOnBack);
  const [isImageActionPending, setIsImageActionPending] = useState(false);
  const frontCardCaptureRef = useRef<View>(null);
  const backTouchStart = useRef<{ x: number; y: number } | null>(null);
  const backTouchMoved = useRef(false);
  const backScrollY = useRef(0);
  const backContentHeight = useRef(0);
  const backLayoutHeight = useRef(0);
  const backDragLastY = useRef<number | null>(null);
  const parentScrollEnabled = useRef(true);
  const [backScrollViewportHeight, setBackScrollViewportHeight] = useState(0);
  const [measuredBackTextLineCount, setMeasuredBackTextLineCount] = useState<
    number | null
  >(null);
  const rotation = useSharedValue(startsOnBack ? 180 : 0);
  const horizontalMargin = size === 'full' ? 44 : 36;
  const requestedCardWidth =
    width ?? Math.min(windowWidth - horizontalMargin, 340);
  const layoutCardWidth = requestedCardWidth < 340 ? 340 : requestedCardWidth;
  const cardScale = requestedCardWidth / layoutCardWidth;
  const cardHeight = Math.round(layoutCardWidth / DREAM_CARD_ASPECT_RATIO);
  const sceneHeight = Math.round(cardHeight * cardScale);
  const imageHeight = Math.round(cardHeight * 0.54);
  const roomMembers = useMemo(() => {
    if (giverNameOverride && (receiverNameOverride || !dream.receiverId)) {
      return [];
    }
    return getCachedRooms(sessionUserId).flatMap(room => room.members ?? []);
  }, [dream.receiverId, giverNameOverride, receiverNameOverride, sessionUserId]);
  const giverName =
    giverNameOverride ??
    dream.giverDisplayName ??
    roomMembers.find(member => member.id === dream.giverId)?.name ??
    getDisplayMember(dream.giverId, sessionUserId).name;
  const receiverName = dream.receiverId
    ? receiverNameOverride ??
      dream.receiverDisplayName ??
      roomMembers.find(member => member.id === dream.receiverId)?.name ??
      getDisplayMember(dream.receiverId, sessionUserId).name
    : dream.receiverDisplayName ?? dream.receiverLabel ?? '받는 사람 미정';

  const imageUrl = dream.imageUrl ?? dream.thumbnailUrl;
  const shouldLoadFullImageProgressively = Boolean(
    loadFullImageProgressively &&
      !useThumbnail &&
      dream.thumbnailUrl &&
      dream.imageUrl &&
      dream.thumbnailUrl !== dream.imageUrl,
  );
  const displayImageUrl = useThumbnail
    ? dream.thumbnailUrl
    : shouldLoadFullImageProgressively
      ? dream.thumbnailUrl
      : dream.imageUrl ?? dream.thumbnailUrl;
  const fullImageUrl = shouldLoadFullImageProgressively
    ? dream.imageUrl
    : null;
  const [didRemoteImageFail, setDidRemoteImageFail] = useState(false);
  const [canStartFullImageLoad, setCanStartFullImageLoad] = useState(false);
  const [isFullImageReady, setIsFullImageReady] = useState(false);
  const [didFullImageFail, setDidFullImageFail] = useState(false);
  const hasImage = Boolean(displayImageUrl) && !didRemoteImageFail;
  const isImageGenerating =
    dream.imageStatus === 'queued' || dream.imageStatus === 'generating';
  const design = normalizeDreamDesign(dream.design);
  const designTheme = CARD_COLOR_THEMES[design.cardColor];
  const imageTextureLabel = getImageTextureLabel(design.imageTexture);
  const usesCenteredFromTo =
    design.cardFrame === 'classic' || design.cardFrame === 'ticket';
  const isMovieTicketFrame = design.cardFrame === 'beveled';
  const isDarkTheme = design.cardColor === 'midnight';
  const frameBorderColor = isDarkTheme ? designTheme.line : '#CBBFAE';
  const titleColor = isDarkTheme ? designTheme.text : '#2D2923';
  const movieTicketImageBorderColor = isDarkTheme
    ? designTheme.line
    : colors.textSecondary;
  const metaColor = isDarkTheme ? designTheme.accent : '#6F675D';
  const letterColor = isDarkTheme ? designTheme.secondaryText : '#6F675D';
  const dreamFontStyle = getDreamFontStyle(design.fontStyle);
  const visibleTags = dream.tags.slice(0, 3);
  const frontDate = formatShortDate(dream.givenAt ?? dream.createdAt);
  const postcardStampVariant = getPostcardStampVariant(
    dream.givenAt ?? dream.createdAt,
  );
  const serifTitleFamily = Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: undefined,
  });
  const ticketMetaFamily = Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'monospace',
  });
  const frontTitleFamily = serifTitleFamily;
  const frontBodyFamily = isMovieTicketFrame
    ? ticketMetaFamily
    : serifTitleFamily;
  const ticketTagText = visibleTags.length
    ? visibleTags.map(tag => `#${tag}`).join(' ')
    : '-';
  const backStory = dream.privatePostscript
    ? `${dream.story}\n\np.s. ${dream.privatePostscript}`
    : dream.story;
  // Carve a top-right triangular gap so the corner flower stays text-free.
  const displayBackStory =
    design.letterPaper === 'corner_flower'
      ? wrapTextForCornerFlower(backStory, LETTER_LINE_CHAR_WIDTH, 7, 11)
      : backStory;
  const letterLineHeight =
    typeof dreamFontStyle.lineHeight === 'number' ? dreamFontStyle.lineHeight : 27;
  const estimatedLetterLineCount = displayBackStory
    .split('\n')
    .reduce(
      (sum, line) =>
        sum + Math.max(1, Math.ceil(line.length / LETTER_LINE_CHAR_WIDTH)),
      0,
    );
  const visibleLetterLineCount = Math.ceil(
    Math.max(220, cardHeight - 130) / letterLineHeight,
  );
  const measuredLetterLineCount =
    measuredBackTextLineCount ?? estimatedLetterLineCount;
  // Inline decorations (e.g. the blossom flower) live inside the scroll
  // content above the text, so their height has to count toward scrollability.
  const letterInlineDecorationHeight =
    design.letterPaper === 'blossom' ? BLOSSOM_INLINE_HEIGHT : 0;
  const letterTextHeight =
    Math.max(letterLineHeight, measuredLetterLineCount * letterLineHeight) +
    letterInlineDecorationHeight;
  const letterContentPadding =
    LETTER_CONTENT_PADDING_BY_PAPER[design.letterPaper] ??
    DEFAULT_LETTER_CONTENT_PADDING;
  const letterTextInset =
    LETTER_TEXT_INSET_BY_PAPER[design.letterPaper] ?? DEFAULT_LETTER_TEXT_INSET;
  const letterContentVerticalPadding =
    letterContentPadding.top +
    letterContentPadding.bottom +
    letterTextInset.top +
    letterTextInset.bottom;
  const letterViewportContentHeight =
    backScrollViewportHeight > 0
      ? Math.max(0, backScrollViewportHeight - letterContentVerticalPadding)
      : visibleLetterLineCount * letterLineHeight;
  const estimatedLetterTextHeight =
    Math.max(letterLineHeight, estimatedLetterLineCount * letterLineHeight) +
    letterInlineDecorationHeight;
  const isBackStoryScrollable =
    backScrollViewportHeight > 0
      ? letterTextHeight > letterViewportContentHeight + BACK_SCROLL_EDGE_EPS
      : estimatedLetterTextHeight > visibleLetterLineCount * letterLineHeight;
  const hasLetterRules =
    design.letterPaper !== 'plain' &&
    design.letterPaper !== 'postcard' &&
    design.letterPaper !== 'butterfly' &&
    design.letterPaper !== 'corner_flower' &&
    design.letterPaper !== 'rose' &&
    design.letterPaper !== 'blossom' &&
    design.letterPaper !== 'wildflower';
  const letterLineCount = Math.min(
    LETTER_LINE_MAX_COUNT,
    Math.max(1, measuredLetterLineCount + LETTER_EXTRA_LINE_COUNT),
  );
  const isMoonlitLetterPaper = design.letterPaper === 'moonlit';
  const letterRuleColor = isMoonlitLetterPaper
    ? 'rgba(245, 215, 147, 0.35)'
    : isDarkTheme
    ? 'rgba(217, 199, 147, 0.24)'
    : 'rgba(113, 91, 64, 0.26)';
  const letterAccentColor = isMoonlitLetterPaper
    ? 'rgba(255, 221, 154, 0.86)'
    : isDarkTheme
    ? 'rgba(217, 199, 147, 0.72)'
    : 'rgba(141, 119, 91, 0.72)';
  const letterTextColor = isMoonlitLetterPaper
    ? '#FFF7D6'
    : designTheme.text;
  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1100 }, { rotateY: `${rotation.value}deg` }],
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1100 },
      { rotateY: `${rotation.value + 180}deg` },
    ],
  }));

  useEffect(() => {
    setDidRemoteImageFail(false);
    setCanStartFullImageLoad(false);
    setIsFullImageReady(false);
    setDidFullImageFail(false);

    if (!fullImageUrl) {
      return undefined;
    }

    let isCancelled = false;
    let frameId: number | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      frameId = requestAnimationFrame(() => {
        if (!isCancelled) {
          setCanStartFullImageLoad(true);
        }
      });
    });

    return () => {
      isCancelled = true;
      task.cancel?.();
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [displayImageUrl, fullImageUrl]);

  useEffect(() => {
    setMeasuredBackTextLineCount(null);
    backScrollY.current = 0;
  }, [backStory, design.fontStyle, layoutCardWidth]);

  const flip = () => {
    if (flipDisabled) {
      return;
    }

    const next = !isBackVisible;
    setIsBackVisible(next);
    if (next) {
      onBackOpen?.();
    }
    rotation.value = withSpring(next ? 180 : 0, {
      stiffness: 180,
      damping: 22,
    });
  };

  useEffect(() => {
    if (!isBackVisible) {
      setParentScrollEnabled(true);
    }
    // setParentScrollEnabled is a stable ref-backed closure; only react to flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBackVisible]);

  const runImageAction = async (action: 'share' | 'save') => {
    if (!imageUrl) {
      const message =
        dream.imageStatus === 'failed'
          ? '이미지 생성에 실패했어요. 잠시 후 새 카드로 다시 시도해 주세요.'
          : '이미지가 완성되면 저장하거나 공유할 수 있어요.';
      Alert.alert(
        isImageGenerating ? '이미지 생성 중이에요' : '이미지가 아직 없어요',
        message,
      );
      return;
    }
    if (isImageActionPending) {
      return;
    }

    setIsImageActionPending(true);
    try {
      const fileName = `kkumdream_${dream.id}`;
      const cardImageUri = await captureRef(frontCardCaptureRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      });
      if (action === 'share') {
        await shareDreamImage(cardImageUri, fileName);
      } else {
        await saveDreamImage(cardImageUri, fileName);
        Alert.alert('저장 완료', '꿈카드 이미지를 갤러리에 저장했어요.');
      }
    } catch {
      Alert.alert(
        action === 'share' ? '공유 실패' : '저장 실패',
        '이미지를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setIsImageActionPending(false);
    }
  };

  const renderImageActions = () => (
    <View style={styles.imageActions}>
      <Pressable
        accessibilityLabel="꿈카드 공유"
        accessibilityRole="button"
        disabled={isImageActionPending}
        hitSlop={8}
        onPress={() => runImageAction('share')}
        style={({ pressed }) => [
          styles.imageActionButton,
          isImageActionPending && styles.imageActionButtonDisabled,
          pressed && !isImageActionPending && interactionStyles.pressed,
        ]}
      >
        <Share2 color={metaColor} size={17} strokeWidth={2.2} />
      </Pressable>
      <Pressable
        accessibilityLabel="꿈카드 저장"
        accessibilityRole="button"
        disabled={isImageActionPending}
        hitSlop={8}
        onPress={() => runImageAction('save')}
        style={({ pressed }) => [
          styles.imageActionButton,
          isImageActionPending && styles.imageActionButtonDisabled,
          pressed && !isImageActionPending && interactionStyles.pressed,
        ]}
      >
        <Download color={metaColor} size={17} strokeWidth={2.2} />
      </Pressable>
    </View>
  );

  const cardPressHandler = onPress ?? flip;
  const setParentScrollEnabled = (enabled: boolean) => {
    if (!onParentScrollEnabledChange || parentScrollEnabled.current === enabled) {
      return;
    }
    parentScrollEnabled.current = enabled;
    onParentScrollEnabledChange(enabled);
  };
  const getBackScrollEdges = () => {
    const scrollable =
      isBackStoryScrollable &&
      backContentHeight.current > backLayoutHeight.current + BACK_SCROLL_EDGE_EPS;
    const atTop = backScrollY.current <= BACK_SCROLL_EDGE_EPS;
    const atBottom =
      backScrollY.current + backLayoutHeight.current >=
      backContentHeight.current - BACK_SCROLL_EDGE_EPS;
    return { scrollable, atTop, atBottom };
  };
  // Hand the gesture to the parent only when the body is pinned to the edge it is being pulled past.
  const syncParentScrollForDrag = (dy: number) => {
    const { scrollable, atTop, atBottom } = getBackScrollEdges();
    if (!scrollable) {
      setParentScrollEnabled(true);
      return;
    }
    const pullingDownFromTop = atTop && dy > 0;
    const pullingUpFromBottom = atBottom && dy < 0;
    setParentScrollEnabled(pullingDownFromTop || pullingUpFromBottom);
  };
  const resetBackTouch = () => {
    backTouchStart.current = null;
    backTouchMoved.current = false;
    backDragLastY.current = null;
    setParentScrollEnabled(true);
  };
  const handleBackTouchStart = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    backTouchStart.current = { x: pageX, y: pageY };
    backTouchMoved.current = false;
    backDragLastY.current = pageY;
    const { scrollable } = getBackScrollEdges();
    setParentScrollEnabled(!scrollable);
  };
  const handleBackTouchMove = (event: GestureResponderEvent) => {
    const start = backTouchStart.current;
    const { pageX, pageY } = event.nativeEvent;
    if (
      start &&
      (Math.abs(pageX - start.x) > 8 || Math.abs(pageY - start.y) > 8)
    ) {
      backTouchMoved.current = true;
    }

    const last = backDragLastY.current;
    backDragLastY.current = pageY;
    if (last === null || pageY === last) {
      return;
    }
    syncParentScrollForDrag(pageY - last);
  };
  const handleBackTouchEnd = () => {
    if (!backTouchMoved.current) {
      flip();
    }
    resetBackTouch();
  };

  const renderImageScene = (customStyle?: StyleProp<ViewStyle>) => (
    <View
      style={[
        styles.imageWrap,
        customStyle,
        {
          height: imageHeight,
          backgroundColor: designTheme.image,
          borderColor: isMovieTicketFrame
            ? movieTicketImageBorderColor
            : frameBorderColor,
        },
      ]}
    >
      {isHidden ? (
        <View
          style={[
            styles.placeholder,
            { backgroundColor: designTheme.placeholder },
          ]}
        >
          <View
            style={[styles.placeholderStamp, { borderColor: frameBorderColor }]}
          />
          <Text style={[styles.failureText, { color: designTheme.accent }]}>
            신고된 카드
          </Text>
          <Text
            style={[
              styles.placeholderHint,
              { color: designTheme.secondaryText },
            ]}
          >
            신고가 누적되어 가려졌어요.
          </Text>
        </View>
      ) : hasImage ? (
        <>
          <Image
            onError={() => {
              setDidRemoteImageFail(true);
            }}
            source={{
              uri: displayImageUrl ?? undefined,
            }}
            style={styles.image}
          />
          {fullImageUrl && canStartFullImageLoad && !didFullImageFail ? (
            <Image
              fadeDuration={160}
              onError={() => setDidFullImageFail(true)}
              onLoadEnd={() => setIsFullImageReady(true)}
              source={{ uri: fullImageUrl }}
              style={[
                styles.image,
                styles.fullImageLayer,
                !isFullImageReady && styles.fullImageLayerHidden,
              ]}
            />
          ) : null}
          {!useThumbnail &&
          (!shouldLoadFullImageProgressively || isFullImageReady) ? (
            <View pointerEvents="none" style={styles.imagePaperWash} />
          ) : null}
        </>
      ) : displayImageUrl && didRemoteImageFail ? (
        <View
          style={[
            styles.placeholder,
            { backgroundColor: designTheme.placeholder },
          ]}
        >
          <View
            style={[styles.placeholderStamp, { borderColor: frameBorderColor }]}
          />
          <Text
            style={[
              styles.failureText,
              { color: designTheme.accent },
            ]}
          >
            이미지를 불러오지 못했어요
          </Text>
        </View>
      ) : isImageGenerating ? (
        <DreamGenerationAnimation
          compact
          title="이미지 생성 중"
          subtitle="달빛과 구름을 모아 카드 그림을 만들고 있어요."
        />
      ) : dream.imageStatus === 'failed' ? (
        <View
          style={[
            styles.placeholder,
            { backgroundColor: designTheme.placeholder },
          ]}
        >
          <View
            style={[styles.placeholderStamp, { borderColor: frameBorderColor }]}
          />
          <Text
            style={[
              styles.failureText,
              { color: designTheme.accent },
            ]}
          >
            이미지 준비 실패
          </Text>
          <Text
            style={[
              styles.placeholderHint,
              { color: designTheme.secondaryText },
            ]}
          >
            다시 보내거나 새 카드로 시도해 주세요.
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.placeholder,
            { backgroundColor: designTheme.placeholder },
          ]}
        >
          <View
            style={[styles.placeholderStamp, { borderColor: frameBorderColor }]}
          />
          <Text
            style={[
              styles.placeholderText,
              { color: designTheme.accent },
            ]}
          >
            {dream.mainMood}
            {'\n'}
            <Text style={styles.placeholderTextureText}>
              {imageTextureLabel}
            </Text>
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.pressable, { width: requestedCardWidth }]}>
      <View
        style={[
          styles.scene,
          { width: requestedCardWidth, height: sceneHeight },
        ]}
      >
        <View
          style={[
            styles.scaledScene,
            {
              width: layoutCardWidth,
              height: cardHeight,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          <Animated.View
            pointerEvents={isBackVisible ? 'none' : 'auto'}
            style={[
              styles.card,
              styles.face,
              { width: layoutCardWidth, height: cardHeight },
              isBackVisible ? styles.faceHidden : styles.faceVisible,
              frontStyle,
            ]}
          >
            <View
              ref={frontCardCaptureRef}
              collapsable={false}
              style={styles.captureTarget}
            >
              <DreamCardFrame
                backgroundColor={designTheme.card}
                borderColor={frameBorderColor}
                frame={design.cardFrame}
                height={cardHeight}
                lite={isLite}
                shadowColor={isLite ? undefined : designTheme.shadow}
                textureColor={designTheme.texture}
              >
                <Pressable
                  onPress={cardPressHandler}
                  onLongPress={flipDisabled ? undefined : flip}
                  style={({ pressed }) => [
                    styles.facePressable,
                    pressed && interactionStyles.pressedSoft,
                  ]}
                >
                  {isMovieTicketFrame ? null : (
                    <View style={styles.frontAccentRow}>
                      <Text
                        style={[
                          styles.frontAccentStar,
                          isDarkTheme
                            ? styles.darkStarAccent
                            : styles.warmStarAccent,
                        ]}
                      >
                        ✦
                      </Text>
                      <Text
                        style={[
                          styles.frontAccentText,
                          { color: metaColor, fontFamily: frontBodyFamily },
                        ]}
                      >
                        잠에서 건져 올린 작은 꿈
                      </Text>
                      <Text
                        style={[styles.frontAccentStar, { color: metaColor }]}
                      >
                        ✧
                      </Text>
                    </View>
                  )}
                  <View style={styles.imageMount}>
                    {isMovieTicketFrame ? null : (
                      <>
                        {isLite ? null : (
                          <>
                            <PaperTape
                              crease="left"
                              style={[styles.paperTape, styles.paperTapeLeft]}
                            />
                            <PaperTape
                              crease="right"
                              style={[styles.paperTape, styles.paperTapeRight]}
                            />
                          </>
                        )}
                        <View
                          pointerEvents="none"
                          style={[
                            styles.frontStampMark,
                            { borderColor: frameBorderColor },
                          ]}
                        />
                      </>
                    )}
                    {renderImageScene(
                      isMovieTicketFrame
                        ? styles.movieTicketImageWrap
                        : undefined,
                    )}
                  </View>
                  {isMovieTicketFrame ? (
                    <View style={styles.movieTicketContent}>
                      {dream.titleVisible ? (
                        <Text
                          style={[
                            styles.movieTicketTitle,
                            { color: titleColor, fontFamily: frontTitleFamily },
                          ]}
                          numberOfLines={2}
                        >
                          {dream.title}
                        </Text>
                      ) : null}
                      <Text
                        style={[
                          styles.movieTicketSubtitle,
                          { color: titleColor, fontFamily: frontBodyFamily },
                        ]}
                        numberOfLines={2}
                      >
                        {dream.shortMessage}
                      </Text>
                      <View
                        style={[
                          styles.movieTicketDivider,
                          { borderColor: titleColor },
                        ]}
                      />
                      <View style={styles.movieTicketGrid}>
                        <View style={styles.movieTicketInfoCell}>
                          <Text
                            style={[
                              styles.movieTicketLabel,
                              {
                                color: titleColor,
                                fontFamily: frontBodyFamily,
                              },
                            ]}
                          >
                            FROM :
                          </Text>
                          <Text
                            style={[
                              styles.movieTicketValue,
                              {
                                color: titleColor,
                                fontFamily: frontBodyFamily,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {giverName}
                          </Text>
                        </View>
                        <View style={styles.movieTicketInfoCell}>
                          <Text
                            style={[
                              styles.movieTicketLabel,
                              {
                                color: titleColor,
                                fontFamily: frontBodyFamily,
                              },
                            ]}
                          >
                            TO :
                          </Text>
                          <Text
                            style={[
                              styles.movieTicketValue,
                              {
                                color: titleColor,
                                fontFamily: frontBodyFamily,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {receiverName}
                          </Text>
                        </View>
                        <View style={styles.movieTicketInfoCell}>
                          <Text
                            style={[
                              styles.movieTicketLabel,
                              {
                                color: titleColor,
                                fontFamily: frontBodyFamily,
                              },
                            ]}
                          >
                            DATE :
                          </Text>
                          <Text
                            style={[
                              styles.movieTicketValue,
                              {
                                color: titleColor,
                                fontFamily: frontBodyFamily,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {frontDate}
                          </Text>
                        </View>
                        <View style={styles.movieTicketInfoCell}>
                          <Text
                            style={[
                              styles.movieTicketLabel,
                              {
                                color: titleColor,
                                fontFamily: frontBodyFamily,
                              },
                            ]}
                          >
                            TAG :
                          </Text>
                          <Text
                            style={[
                              styles.movieTicketValue,
                              {
                                color: titleColor,
                                fontFamily: frontBodyFamily,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {ticketTagText}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.movieTicketFooter}>
                        <Text
                          style={[
                            styles.movieTicketWordmark,
                            { color: metaColor, fontFamily: frontBodyFamily },
                          ]}
                        >
                          ✦ 꿈드림 ✦
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.content}>
                      <View style={styles.titleRow}>
                        <Text
                          style={[styles.titleDoodle, { color: metaColor }]}
                        >
                          ✧
                        </Text>
                        {dream.titleVisible ? (
                          <Text
                            style={[
                              styles.title,
                              {
                                color: titleColor,
                                fontFamily: frontTitleFamily,
                              },
                            ]}
                            numberOfLines={2}
                          >
                            {dream.title}
                          </Text>
                        ) : null}
                        <Text
                          style={[
                            styles.titleDoodle,
                            isDarkTheme
                              ? styles.darkStarAccent
                              : styles.warmStarAccent,
                          ]}
                        >
                          ✦
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.message,
                          { color: letterColor, fontFamily: frontBodyFamily },
                        ]}
                        numberOfLines={2}
                      >
                        {dream.shortMessage}
                      </Text>
                      <View style={styles.fromToRow}>
                        <View
                          style={[
                            styles.fromToPaper,
                            usesCenteredFromTo && styles.centeredFromToPaper,
                            isDarkTheme
                              ? styles.darkNotePaper
                              : styles.lightNotePaper,
                            {
                              borderColor: frameBorderColor,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.fromToLabel,
                              usesCenteredFromTo && styles.centeredFromToLabel,
                              {
                                color: titleColor,
                                fontFamily: serifTitleFamily,
                              },
                            ]}
                          >
                            FROM
                          </Text>
                          <Text
                            style={[
                              styles.fromToValue,
                              {
                                color: metaColor,
                                fontFamily: frontBodyFamily,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {giverName}
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.fromToArrow,
                            { color: metaColor, fontFamily: serifTitleFamily },
                          ]}
                        >
                          →
                        </Text>
                        <View
                          style={[
                            styles.fromToPaper,
                            usesCenteredFromTo && styles.centeredFromToPaper,
                            isDarkTheme
                              ? styles.darkNotePaper
                              : styles.lightNotePaper,
                            {
                              borderColor: frameBorderColor,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.fromToLabel,
                              usesCenteredFromTo && styles.centeredFromToLabel,
                              {
                                color: titleColor,
                                fontFamily: serifTitleFamily,
                              },
                            ]}
                          >
                            TO
                          </Text>
                          <Text
                            style={[
                              styles.fromToValue,
                              {
                                color: metaColor,
                                fontFamily: frontBodyFamily,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {receiverName}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.metaFooter}>
                        <Text
                          style={[
                            styles.frontDate,
                            { color: metaColor, fontFamily: serifTitleFamily },
                          ]}
                        >
                          {frontDate}
                        </Text>
                        <View style={styles.tags}>
                          {visibleTags.map(tag => (
                            <View
                              key={tag}
                              style={[
                                styles.frontTagChip,
                                isDarkTheme
                                  ? styles.darkNotePaper
                                  : styles.tagChipPaper,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.frontTagText,
                                  {
                                    color: metaColor,
                                    fontFamily: frontBodyFamily,
                                  },
                                ]}
                              >
                                #{tag}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.frontWordmark,
                          styles.frontWordmarkPinned,
                          { color: metaColor, fontFamily: serifTitleFamily },
                        ]}
                      >
                        ✦ 꿈드림 ✦
                      </Text>
                    </View>
                  )}
                </Pressable>
              </DreamCardFrame>
            </View>
          </Animated.View>

          {flipDisabled ? null : (
          <Animated.View
            pointerEvents={isBackVisible ? 'auto' : 'none'}
            style={[
              styles.card,
              styles.face,
              styles.backFace,
              { width: layoutCardWidth, height: cardHeight },
              isBackVisible ? styles.faceVisible : styles.faceHidden,
              backStyle,
            ]}
          >
            <DreamCardFrame
              backgroundColor={designTheme.back}
              borderColor={frameBorderColor}
              frame={design.cardFrame}
              height={cardHeight}
              minimal
              shadowColor={designTheme.shadow}
              textureColor={designTheme.texture}
            >
              <View style={styles.backLayout}>
                <View
                  style={[
                    styles.letterPaper,
                    isDarkTheme
                      ? styles.darkLetterPaper
                      : styles.lightLetterPaper,
                    !isDarkTheme &&
                      design.letterPaper === 'ornament' &&
                      styles.ornamentLetterPaper,
                    !isDarkTheme &&
                      design.letterPaper === 'vintage' &&
                      styles.vintageLetterPaper,
                    !isDarkTheme &&
                      design.letterPaper === 'botanical' &&
                      styles.botanicalLetterPaper,
                    !isDarkTheme &&
                      design.letterPaper === 'postcard' &&
                      styles.postcardLetterPaper,
                    !isDarkTheme &&
                      design.letterPaper === 'butterfly' &&
                      styles.butterflyLetterPaper,
                    !isDarkTheme &&
                      design.letterPaper === 'corner_flower' &&
                      styles.cornerFlowerLetterPaper,
                    !isDarkTheme &&
                      design.letterPaper === 'rose' &&
                      styles.roseLetterPaper,
                    !isDarkTheme &&
                      design.letterPaper === 'blossom' &&
                      styles.blossomLetterPaper,
                    !isDarkTheme &&
                      design.letterPaper === 'wildflower' &&
                      styles.wildflowerLetterPaper,
                    isMoonlitLetterPaper && styles.moonlitLetterPaper,
                    { borderColor: frameBorderColor },
                  ]}
                >
                  <PaperTape style={styles.letterTape} />
                  {design.letterPaper === 'lined' ||
                  design.letterPaper === 'moonlit' ? (
                    <Text
                      pointerEvents="none"
                      style={[
                        styles.letterHeaderStars,
                        { color: letterAccentColor },
                      ]}
                    >
                      ✦  ✦  ✦
                    </Text>
                  ) : null}
                  {design.letterPaper === 'moonlit' ? (
                    <>
                      <Text
                        pointerEvents="none"
                        style={[
                          styles.letterMoonMark,
                          { color: letterAccentColor },
                        ]}
                      >
                        ☾
                      </Text>
                      <View
                        pointerEvents="none"
                        style={[
                          styles.letterMoonGlow,
                          { borderColor: letterAccentColor },
                        ]}
                      />
                    </>
                  ) : null}
                  {design.letterPaper === 'ornament' ? (
                    <>
                      <Text
                        pointerEvents="none"
                        style={[
                          styles.letterOrnament,
                          styles.letterOrnamentTopLeft,
                          { color: letterAccentColor },
                        ]}
                      >
                        ❦
                      </Text>
                      <Text
                        pointerEvents="none"
                        style={[
                          styles.letterOrnament,
                          styles.letterOrnamentTopRight,
                          { color: letterAccentColor },
                        ]}
                      >
                        ❦
                      </Text>
                      <View
                        pointerEvents="none"
                        style={[
                          styles.letterSideRule,
                          styles.letterSideRuleLeft,
                          { backgroundColor: letterRuleColor },
                        ]}
                      />
                      <View
                        pointerEvents="none"
                        style={[
                          styles.letterSideRule,
                          styles.letterSideRuleRight,
                          { backgroundColor: letterRuleColor },
                        ]}
                      />
                    </>
                  ) : null}
                  {design.letterPaper === 'vintage' ? (
                    <>
                      <View
                        pointerEvents="none"
                        style={[
                          styles.letterStampMark,
                          { borderColor: frameBorderColor },
                        ]}
                      />
                      <Text
                        pointerEvents="none"
                        style={[
                          styles.letterDoodle,
                          styles.letterDoodleTop,
                          isDarkTheme
                            ? styles.darkStarAccent
                            : styles.warmStarAccent,
                        ]}
                      >
                        ✦
                      </Text>
                      <Text
                        pointerEvents="none"
                        style={[
                          styles.letterDoodle,
                          styles.letterDoodleBottom,
                          { color: metaColor },
                        ]}
                      >
                        ✧
                      </Text>
                      <Text
                        pointerEvents="none"
                        style={[
                          styles.letterFlowerMark,
                          { color: letterAccentColor },
                        ]}
                      >
                        ✿
                      </Text>
                    </>
                  ) : null}
                  {design.letterPaper === 'botanical' ? (
                    <>
                      <Text
                        pointerEvents="none"
                        style={[
                          styles.letterBotanicalMark,
                          styles.letterBotanicalTop,
                          { color: letterAccentColor },
                        ]}
                      >
                        ✾
                      </Text>
                      <Text
                        pointerEvents="none"
                        style={[
                          styles.letterBotanicalMark,
                          styles.letterBotanicalBottom,
                          { color: letterAccentColor },
                        ]}
                      >
                        ✿
                      </Text>
                    </>
                  ) : null}
                  {design.letterPaper === 'butterfly' ? (
                    <>
                      <Image
                        resizeMode="contain"
                        source={letterButterfly}
                        style={[
                          styles.letterDecorationImage,
                          styles.letterButterflyTop,
                        ]}
                      />
                      <Image
                        resizeMode="contain"
                        source={letterButterfly2}
                        style={[
                          styles.letterDecorationImage,
                          styles.letterButterflyTopSmall,
                        ]}
                      />
                      <Image
                        resizeMode="contain"
                        source={letterButterfly2}
                        style={[
                          styles.letterDecorationImage,
                          styles.letterButterflyBottom,
                        ]}
                      />
                      <Image
                        resizeMode="contain"
                        source={letterButterfly2}
                        style={[
                          styles.letterDecorationImage,
                          styles.letterButterflyBottomSmall,
                        ]}
                      />
                    </>
                  ) : null}
                  {design.letterPaper === 'rose' ? (
                    <Image
                      resizeMode="contain"
                      source={letterFlower1}
                      style={[
                        styles.letterDecorationImage,
                        styles.letterRoseDecoration,
                      ]}
                    />
                  ) : null}
                  {design.letterPaper === 'wildflower' ? (
                    <>
                      <Image
                        resizeMode="contain"
                        source={letterFlower4}
                        style={[
                          styles.letterDecorationImage,
                          styles.letterWildflowerDecoration,
                        ]}
                      />
                      <PaperTape
                        crease="left"
                        style={styles.letterWildflowerTape}
                      />
                    </>
                  ) : null}
                  {design.letterPaper === 'postcard' ? (
                    <View
                      pointerEvents="none"
                      style={[
                        styles.letterPostcardStamp,
                        {
                          backgroundColor: postcardStampVariant.background,
                          borderColor: letterRuleColor,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.letterPostcardStampInner,
                          { borderColor: postcardStampVariant.accent },
                        ]}
                      >
                        <Text
                          style={[
                            styles.letterPostcardStampMark,
                            { color: postcardStampVariant.accent },
                          ]}
                        >
                          {postcardStampVariant.mark}
                        </Text>
                        <Text
                          style={[
                            styles.letterPostcardStampLabel,
                            { color: postcardStampVariant.accent },
                          ]}
                        >
                          DREAM
                        </Text>
                      </View>
                    </View>
                  ) : null}
                  <ScrollView
                    bounces={false}
                    nestedScrollEnabled
                    scrollEnabled={isBackStoryScrollable}
                    scrollEventThrottle={16}
                    onScroll={event => {
                      backScrollY.current = event.nativeEvent.contentOffset.y;
                    }}
                    onContentSizeChange={(_width, height) => {
                      backContentHeight.current = height;
                    }}
                    onLayout={event => {
                      const nextHeight = event.nativeEvent.layout.height;
                      backLayoutHeight.current = nextHeight;
                      setBackScrollViewportHeight(current =>
                        Math.abs(current - nextHeight) < 1 ? current : nextHeight,
                      );
                    }}
                    onScrollBeginDrag={() => {
                      backTouchMoved.current = true;
                    }}
                    onTouchCancel={resetBackTouch}
                    onTouchEnd={handleBackTouchEnd}
                    onTouchMove={handleBackTouchMove}
                    onTouchStart={handleBackTouchStart}
                    persistentScrollbar={false}
                    showsVerticalScrollIndicator={false}
                    style={styles.backScroll}
                    contentContainerStyle={[
                      styles.letterContent,
                      {
                        paddingTop: letterContentPadding.top,
                        paddingBottom: letterContentPadding.bottom,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.letterSheetBody,
                        { minHeight: letterLineCount * letterLineHeight },
                      ]}
                    >
                      {design.letterPaper === 'corner_flower' ? (
                        <Image
                          resizeMode="contain"
                          source={letterFlower3}
                          style={[
                            styles.letterDecorationImage,
                            styles.letterCornerFlower,
                          ]}
                        />
                      ) : null}
                      {design.letterPaper === 'blossom' ? (
                        <Image
                          resizeMode="contain"
                          source={letterFlower2}
                          style={styles.letterBlossomInline}
                        />
                      ) : null}
                      {hasLetterRules ? (
                        <View
                          pointerEvents="none"
                          style={styles.letterRuleLayer}
                        >
                          {Array.from({ length: letterLineCount }).map(
                            (_, index) => (
                              <View
                                key={`letter-line-${index}`}
                                style={[
                                  styles.letterRule,
                                  {
                                    borderBottomColor: letterRuleColor,
                                    height: letterLineHeight,
                                  },
                                ]}
                              />
                            ),
                          )}
                        </View>
                      ) : null}
                      <Text
                        onTextLayout={event => {
                          const lineCount = event.nativeEvent.lines.length;
                          setMeasuredBackTextLineCount(current =>
                            current === lineCount ? current : lineCount,
                          );
                        }}
                        style={[
                          styles.letterStory,
                          dreamFontStyle,
                          {
                            color: letterTextColor,
                            lineHeight: letterLineHeight,
                            paddingTop: letterTextInset.top,
                            paddingBottom: letterTextInset.bottom,
                          },
                        ]}
                      >
                        {displayBackStory}
                      </Text>
                    </View>
                  </ScrollView>
                </View>
              </View>
            </DreamCardFrame>
          </Animated.View>
          )}
          {allowImageActions && !isBackVisible ? renderImageActions() : null}
        </View>
      </View>
    </View>
  );
}

type PaperTapeProps = {
  crease?: 'center' | 'left' | 'right';
  style?: StyleProp<ViewStyle>;
};

function PaperTape({ crease = 'center', style }: PaperTapeProps) {
  return (
    <View pointerEvents="none" style={[styles.tapeBase, style]}>
      <Image
        resizeMode="cover"
        source={paperTexture}
        style={styles.tapeTexture}
      />
      <View pointerEvents="none" style={styles.tapeWarmth} />
      <View pointerEvents="none" style={styles.tapeLeftEdge} />
      <View pointerEvents="none" style={styles.tapeRightEdge} />
      <View
        pointerEvents="none"
        style={[
          styles.tapeCrease,
          crease === 'left' && styles.tapeCreaseLeft,
          crease === 'right' && styles.tapeCreaseRight,
          crease === 'center' && styles.tapeCreaseCenter,
        ]}
      />
    </View>
  );
}

// Reflow text so the first `steps` lines are short and grow longer downward.
// With left-aligned text this leaves the top-right corner empty, carving a
// triangular gap for a top-right corner decoration (e.g. the corner flower).
// How far a word may cross the boundary before we still wrap after it, so the
// text fills right up to (or just past) the diagonal instead of stopping short.
const CORNER_WRAP_TOLERANCE = 2;
function wrapTextForCornerFlower(
  text: string,
  fullChars: number,
  steps: number,
  topExclude: number,
): string {
  const widthForLine = (index: number) =>
    index >= steps
      ? fullChars
      : Math.max(
          4,
          fullChars -
            Math.round((topExclude * (steps - 1 - index)) / (steps - 1)),
        );
  const lines: string[] = [];
  let lineIndex = 0;
  const pushLine = (value: string) => {
    lines.push(value);
    lineIndex += 1;
  };
  for (const paragraph of text.split('\n')) {
    if (paragraph === '') {
      pushLine('');
      continue;
    }
    let current = '';
    for (const word of paragraph.split(' ')) {
      const cap = widthForLine(lineIndex);
      const tentative = current ? `${current} ${word}` : word;
      if (!current) {
        current = word;
      } else if (tentative.length <= cap + CORNER_WRAP_TOLERANCE) {
        // Reaches or only slightly crosses the boundary: keep it on this line.
        current = tentative;
      } else {
        pushLine(current);
        current = word;
      }
      // Once the line has reached the boundary, wrap before the next word.
      if (current.length >= widthForLine(lineIndex)) {
        pushLine(current);
        current = '';
      }
    }
    if (current) {
      pushLine(current);
    }
  }
  return lines.join('\n');
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) {
    return '— · —';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '— · —';
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function getPostcardStampVariant(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date();
  const day = Number.isNaN(date.getTime()) ? 0 : date.getDay();
  return POSTCARD_STAMP_VARIANTS[day] ?? POSTCARD_STAMP_VARIANTS[0];
}

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  scene: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  scaledScene: {
    position: 'relative',
    overflow: 'visible',
  },
  facePressable: {
    flex: 1,
  },
  card: {
    backgroundColor: 'transparent',
    overflow: 'visible',
  },
  captureTarget: {
    width: '100%',
    height: '100%',
    overflow: 'visible',
  },
  face: {
    width: '100%',
    backfaceVisibility: 'hidden',
    overflow: 'visible',
  },
  faceVisible: {
    zIndex: 2,
  },
  faceHidden: {
    zIndex: 0,
  },
  backFace: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'transparent',
  },
  frontAccentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 11,
  },
  frontAccentStar: {
    fontSize: 12,
    fontWeight: '700',
    includeFontPadding: false,
  },
  warmStarAccent: {
    color: '#FFD66B',
  },
  darkStarAccent: {
    color: '#D9C793',
  },
  frontAccentText: {
    fontSize: 11,
    fontWeight: '600',
    includeFontPadding: false,
    opacity: 0.72,
  },
  imageMount: {
    position: 'relative',
    marginHorizontal: 2,
    marginBottom: 13,
  },
  tapeBase: {
    overflow: 'hidden',
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(164, 132, 92, 0.18)',
    backgroundColor: '#E8D4B3',
  },
  tapeTexture: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.34,
  },
  tapeWarmth: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(232, 200, 153, 0.22)',
  },
  tapeLeftEdge: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 5,
    backgroundColor: 'rgba(255, 248, 231, 0.25)',
  },
  tapeRightEdge: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 5,
    backgroundColor: 'rgba(128, 92, 52, 0.08)',
  },
  tapeCrease: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    width: 1.4,
    borderRadius: 1,
    backgroundColor: 'rgba(111, 86, 54, 0.22)',
  },
  tapeCreaseLeft: {
    left: 22,
    transform: [{ rotate: '-13deg' }],
  },
  tapeCreaseRight: {
    right: 20,
    transform: [{ rotate: '12deg' }],
  },
  tapeCreaseCenter: {
    left: '50%',
    marginLeft: -0.7,
    transform: [{ rotate: '-7deg' }],
  },
  paperTape: {
    position: 'absolute',
    top: -8,
    zIndex: 4,
    width: 62,
    height: 20,
    opacity: 0.78,
    shadowColor: '#5A4329',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  paperTapeLeft: {
    left: 17,
    transform: [{ rotate: '-3deg' }],
  },
  paperTapeRight: {
    right: 18,
    transform: [{ rotate: '4deg' }],
  },
  frontStampMark: {
    position: 'absolute',
    right: 17,
    bottom: -8,
    zIndex: 5,
    width: 48,
    height: 30,
    borderRadius: 999,
    borderWidth: 0.7,
    opacity: 0.16,
    transform: [{ rotate: '-8deg' }],
  },
  imageWrap: {
    backgroundColor: colors.lavenderTint,
    borderRadius: 11,
    overflow: 'hidden',
  },
  movieTicketImageWrap: {
    borderRadius: 3,
    borderWidth: 1.6,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fullImageLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  fullImageLayerHidden: {
    opacity: 0,
  },
  imagePaperWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255, 247, 230, 0.22)',
    borderWidth: 0,
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderTint,
  },
  placeholderStamp: {
    position: 'absolute',
    top: 18,
    right: 18,
    bottom: 18,
    left: 18,
    borderWidth: 1,
    borderRadius: 7,
    opacity: 0.18,
  },
  placeholderText: {
    color: colors.primaryDark,
    fontFamily: fontFamily.handwritten,
    fontSize: 30,
    fontWeight: '500',
    includeFontPadding: false,
    lineHeight: 38,
    textAlign: 'center',
  },
  placeholderTextureText: {
    fontSize: 17,
    fontWeight: '700',
  },
  failureText: {
    color: colors.primaryDark,
    fontFamily: fontFamily.handwritten,
    fontSize: 20,
    fontWeight: '800',
    includeFontPadding: false,
    textAlign: 'center',
  },
  placeholderHint: {
    marginTop: 10,
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontSize: 13,
    fontWeight: '600',
    includeFontPadding: false,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 3,
    paddingBottom: 2,
    gap: 7,
  },
  movieTicketContent: {
    flex: 1,
    paddingHorizontal: 5,
    paddingTop: 1,
  },
  movieTicketTitle: {
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 23,
    letterSpacing: 0,
    includeFontPadding: false,
    textAlign: 'left',
  },
  movieTicketSubtitle: {
    marginTop: 4,
    fontSize: 10.5,
    fontWeight: '800',
    lineHeight: 14,
    letterSpacing: 0,
    includeFontPadding: false,
    textAlign: 'left',
  },
  movieTicketDivider: {
    marginTop: 6,
    marginBottom: 7,
    borderTopWidth: 1.2,
    borderStyle: 'dotted',
    opacity: 0.74,
  },
  movieTicketGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 22,
    rowGap: 12,
  },
  movieTicketInfoCell: {
    width: '45%',
  },
  movieTicketLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  movieTicketValue: {
    marginTop: 4,
    fontSize: 11.5,
    fontWeight: '800',
    lineHeight: 15,
    letterSpacing: 0,
    includeFontPadding: false,
  },
  movieTicketFooter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 5,
  },
  movieTicketWordmark: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0,
    includeFontPadding: false,
    opacity: 0.82,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  titleDoodle: {
    fontSize: 13,
    includeFontPadding: false,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontWeight: '500',
    includeFontPadding: false,
    lineHeight: 18,
    opacity: 0.94,
    textAlign: 'center',
  },
  title: {
    color: colors.textPrimary,
    flexShrink: 1,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 24,
    letterSpacing: 0,
    includeFontPadding: false,
    textAlign: 'center',
  },
  fromToRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  fromToPaper: {
    flex: 1,
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 0.45,
    paddingHorizontal: 9,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  centeredFromToPaper: {
    justifyContent: 'center',
  },
  lightNotePaper: {
    backgroundColor: 'rgba(255,249,238,0.68)',
  },
  darkNotePaper: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  fromToCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  fromToCellRight: {
    justifyContent: 'flex-start',
  },
  fromToLabel: {
    fontSize: 7.5,
    fontWeight: '700',
    letterSpacing: 0,
    includeFontPadding: false,
    opacity: 0.72,
  },
  centeredFromToLabel: {
    fontSize: 9,
    fontWeight: '800',
  },
  fromToValue: {
    flexShrink: 1,
    fontSize: 10.5,
    fontWeight: '600',
    includeFontPadding: false,
  },
  fromToArrow: {
    fontSize: 14,
    fontWeight: '600',
    includeFontPadding: false,
    opacity: 0.7,
  },
  frontDate: {
    fontSize: 9.3,
    fontWeight: '600',
    letterSpacing: 0,
    includeFontPadding: false,
    textAlign: 'center',
    opacity: 0.8,
  },
  metaFooter: {
    alignItems: 'center',
    gap: 7,
    paddingTop: 1,
  },
  tags: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  frontTagChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagChipPaper: {
    backgroundColor: '#F4E7D2',
  },
  frontTagText: {
    fontSize: 9.4,
    fontWeight: '600',
    letterSpacing: 0,
    includeFontPadding: false,
    opacity: 0.85,
  },
  frontWordmark: {
    fontSize: 9.8,
    fontWeight: '600',
    letterSpacing: 0,
    includeFontPadding: false,
    opacity: 0.78,
  },
  frontWordmarkPinned: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -15,
    textAlign: 'center',
  },
  backLayout: {
    flex: 1,
    paddingHorizontal: 3,
    paddingTop: 2,
    paddingBottom: 3,
  },
  letterPaper: {
    flex: 1,
    position: 'relative',
    overflow: 'visible',
    borderRadius: 18,
    borderWidth: 0.5,
    paddingHorizontal: 20,
    paddingTop: 34,
    paddingBottom: 24,
    shadowColor: '#42321E',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  lightLetterPaper: {
    backgroundColor: '#FFF8EA',
  },
  ornamentLetterPaper: {
    backgroundColor: '#FFF9ED',
  },
  vintageLetterPaper: {
    backgroundColor: '#FFF4DF',
  },
  botanicalLetterPaper: {
    backgroundColor: '#FFF9E8',
  },
  postcardLetterPaper: {
    backgroundColor: '#FFF6E4',
  },
  butterflyLetterPaper: {
    backgroundColor: '#FFFDFC',
  },
  cornerFlowerLetterPaper: {
    backgroundColor: '#FFF9F2',
  },
  roseLetterPaper: {
    backgroundColor: '#FFF7F0',
  },
  blossomLetterPaper: {
    backgroundColor: '#FFF9F6',
  },
  wildflowerLetterPaper: {
    backgroundColor: '#FFFCF5',
  },
  moonlitLetterPaper: {
    backgroundColor: '#28243E',
  },
  darkLetterPaper: {
    backgroundColor: '#2C2739',
  },
  letterTape: {
    position: 'absolute',
    top: -10,
    left: '50%',
    zIndex: 2,
    marginLeft: -42,
    width: 84,
    height: 20,
    opacity: 0.52,
    transform: [{ rotate: '-2deg' }],
  },
  letterStampMark: {
    position: 'absolute',
    top: 24,
    right: 17,
    width: 58,
    height: 38,
    borderRadius: 999,
    borderWidth: 0.7,
    opacity: 0.14,
    transform: [{ rotate: '-9deg' }],
  },
  letterDoodle: {
    position: 'absolute',
    fontSize: 14,
    fontWeight: '700',
    includeFontPadding: false,
    opacity: 0.62,
  },
  letterDoodleTop: {
    top: 36,
    left: 22,
    transform: [{ rotate: '-10deg' }],
  },
  letterDoodleBottom: {
    right: 24,
    bottom: 22,
    transform: [{ rotate: '8deg' }],
  },
  letterHeaderStars: {
    position: 'absolute',
    top: 19,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9.5,
    fontWeight: '700',
    includeFontPadding: false,
    opacity: 0.72,
  },
  letterOrnament: {
    position: 'absolute',
    top: 22,
    fontSize: 18,
    fontWeight: '700',
    includeFontPadding: false,
    opacity: 0.7,
  },
  letterOrnamentTopLeft: {
    left: 17,
    transform: [{ rotate: '-14deg' }],
  },
  letterOrnamentTopRight: {
    right: 17,
    transform: [{ rotate: '14deg' }, { scaleX: -1 }],
  },
  letterSideRule: {
    position: 'absolute',
    top: 62,
    bottom: 29,
    width: StyleSheet.hairlineWidth,
    opacity: 0.78,
  },
  letterSideRuleLeft: {
    left: 16,
  },
  letterSideRuleRight: {
    right: 16,
  },
  letterFlowerMark: {
    position: 'absolute',
    left: 19,
    bottom: 18,
    fontSize: 15,
    fontWeight: '700',
    includeFontPadding: false,
    opacity: 0.52,
    transform: [{ rotate: '-11deg' }],
  },
  letterBotanicalMark: {
    position: 'absolute',
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
    opacity: 0.58,
  },
  letterBotanicalTop: {
    top: 24,
    right: 26,
    transform: [{ rotate: '13deg' }],
  },
  letterBotanicalBottom: {
    left: 24,
    bottom: 18,
    transform: [{ rotate: '-14deg' }],
  },
  letterPostcardStamp: {
    position: 'absolute',
    top: 22,
    right: 19,
    width: 48,
    height: 40,
    borderRadius: 7,
    borderStyle: 'dashed',
    borderWidth: 0.9,
    opacity: 0.78,
    padding: 4,
  },
  letterPostcardStampInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 1,
  },
  letterPostcardStampMark: {
    fontSize: 13,
    fontWeight: '800',
    includeFontPadding: false,
  },
  letterPostcardStampLabel: {
    fontSize: 4.8,
    fontWeight: '800',
    letterSpacing: 0,
    includeFontPadding: false,
  },
  letterMoonMark: {
    position: 'absolute',
    top: 21,
    right: 24,
    fontSize: 23,
    fontWeight: '700',
    includeFontPadding: false,
    opacity: 0.86,
  },
  letterMoonGlow: {
    position: 'absolute',
    right: 17,
    bottom: 17,
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: StyleSheet.hairlineWidth,
    opacity: 0.22,
  },
  letterDecorationImage: {
    position: 'absolute',
    zIndex: 0,
  },
  letterButterflyTop: {
    top: 38,
    left: 8,
    width: 92,
    height: 76,
    opacity: 0.62,
    transform: [{ rotate: '23deg' }],
  },
  letterButterflyTopSmall: {
    top: -1,
    left: 64,
    width: 64,
    height: 64,
    opacity: 0.62,
    transform: [{ rotate: '13deg' }],
  },
  letterButterflyBottom: {
    right: 18,
    bottom: 44,
    width: 78,
    height: 78,
    opacity: 0.64,
    transform: [{ rotate: '-22deg' }],
  },
  letterButterflyBottomSmall: {
    right: 52,
    bottom: 10,
    width: 50,
    height: 50,
    opacity: 0.56,
    transform: [{ rotate: '12deg' }],
  },
  letterCornerFlower: {
    top: -28,
    right: -34,
    width: 208,
    height: 208,
    opacity: 0.82,
    transform: [{ rotate: '-4deg' }],
  },
  letterRoseDecoration: {
    left: -8,
    bottom: 4,
    width: 132,
    height: 120,
    opacity: 0.66,
    transform: [{ rotate: '4deg' }],
  },
  letterBlossomInline: {
    alignSelf: 'center',
    width: 168,
    height: 158,
    marginBottom: 0,
    opacity: 0.56,
    transform: [{ rotate: '-2deg' }],
  },
  letterWildflowerDecoration: {
    right: -26,
    bottom: -2,
    width: 158,
    height: 176,
    opacity: 0.84,
    transform: [{ rotate: '18deg' }],
  },
  letterWildflowerTape: {
    position: 'absolute',
    right: 36,
    bottom: 27,
    zIndex: 1,
    width: 50,
    height: 15,
    opacity: 0.62,
    transform: [{ rotate: '42deg' }],
  },
  letterContent: {
    zIndex: 1,
  },
  letterSheetBody: {
    position: 'relative',
    overflow: 'hidden',
  },
  letterRuleLayer: {
    ...StyleSheet.absoluteFill,
  },
  letterRule: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  letterStory: {
    color: colors.textSecondary,
    fontSize: 13.4,
    fontWeight: '500',
    lineHeight: 24,
    includeFontPadding: false,
  },
  backScroll: {
    flex: 1,
  },
  imageActions: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    flexDirection: 'row',
    gap: 7,
    zIndex: 10,
    elevation: 10,
  },
  imageActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8EE',
    borderWidth: 0.7,
    borderColor: '#D8CDBB',
    shadowColor: '#42321E',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  imageActionButtonDisabled: {
    opacity: 0.5,
  },
});
