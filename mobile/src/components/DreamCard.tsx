import { useRef, useState } from 'react';
import type { GestureResponderEvent } from 'react-native';
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Download, Share2 } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { colors } from '../theme/colors';
import {
  CARD_COLOR_THEMES,
  getDreamFontStyle,
  normalizeDreamDesign,
} from '../theme/dreamDesigns';
import { interactionStyles } from '../theme/interactions';
import { saveDreamImage, shareDreamImage } from '../native/dreamImageActions';
import type { Dream } from '../types/dream';
import { getCachedRooms } from '../data/dreamRepository';
import { getDisplayMember } from '../data/members';
import { useSessionStore } from '../store/sessionStore';
import { DREAM_CARD_ASPECT_RATIO, DreamCardFrame } from './DreamCardFrame';
import { DreamGenerationAnimation } from './DreamGenerationAnimation';

type Props = {
  dream: Dream;
  size?: 'feed' | 'full';
  onPress?: () => void;
  onBackOpen?: () => void;
};

export function DreamCard({
  dream,
  size = 'feed',
  onPress,
  onBackOpen,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const sessionUserId = useSessionStore(state => state.userId);
  const [isBackVisible, setIsBackVisible] = useState(false);
  const [isImageActionPending, setIsImageActionPending] = useState(false);
  const backTouchStart = useRef<{ x: number; y: number } | null>(null);
  const backTouchMoved = useRef(false);
  const rotation = useSharedValue(0);
  const horizontalMargin = size === 'full' ? 40 : 32;
  const cardWidth = Math.min(windowWidth - horizontalMargin, 390);
  const cardHeight = Math.round(cardWidth / DREAM_CARD_ASPECT_RATIO);
  const imageHeight = Math.round(cardWidth * 1.2);
  const rooms = getCachedRooms(sessionUserId);
  const roomMembers = rooms.flatMap(room => room.members ?? []);
  const giverName =
    roomMembers.find(member => member.id === dream.giverId)?.name ??
    getDisplayMember(dream.giverId, sessionUserId).name;
  const receiverName = dream.receiverId
    ? roomMembers.find(member => member.id === dream.receiverId)?.name ??
      getDisplayMember(dream.receiverId, sessionUserId).name
    : dream.receiverLabel ?? '받는 사람 미정';

  const imageUrl = dream.imageUrl ?? dream.thumbnailUrl;
  const hasImage = Boolean(dream.thumbnailUrl || dream.imageUrl);
  const isImageGenerating =
    dream.imageStatus === 'queued' || dream.imageStatus === 'generating';
  const design = normalizeDreamDesign(dream.design);
  const designTheme = CARD_COLOR_THEMES[design.cardColor];
  const frameBorderColor =
    design.cardColor === 'midnight' ? designTheme.line : '#050505';
  const isInkFrame = design.cardColor !== 'midnight';
  const titleColor = isInkFrame ? '#201C18' : designTheme.text;
  const metaColor = isInkFrame ? '#6F5E43' : designTheme.accent;
  const letterColor = isInkFrame ? '#6C604E' : designTheme.secondaryText;
  const dreamFontStyle = getDreamFontStyle(design.fontStyle);
  const visibleTags = dream.tags.slice(0, 3);
  const serifTitleFamily = Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: undefined,
  });
  const issueDate = formatPostmarkDate(dream.givenAt ?? dream.createdAt);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1100 }, { rotateY: `${rotation.value}deg` }],
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1100 },
      { rotateY: `${rotation.value + 180}deg` },
    ],
  }));

  const flip = () => {
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
      if (action === 'share') {
        await shareDreamImage(imageUrl, fileName);
      } else {
        await saveDreamImage(imageUrl, fileName);
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
        accessibilityLabel="꿈카드 이미지 공유"
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
        <Share2 color={colors.primaryDark} size={17} strokeWidth={2.4} />
      </Pressable>
      <Pressable
        accessibilityLabel="꿈카드 이미지 저장"
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
        <Download color={colors.primaryDark} size={17} strokeWidth={2.4} />
      </Pressable>
    </View>
  );

  const cardPressHandler = onPress ?? flip;
  const resetBackTouch = () => {
    backTouchStart.current = null;
    backTouchMoved.current = false;
  };
  const handleBackTouchStart = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent;
    backTouchStart.current = { x: pageX, y: pageY };
    backTouchMoved.current = false;
  };
  const handleBackTouchMove = (event: GestureResponderEvent) => {
    const start = backTouchStart.current;
    if (!start) {
      return;
    }

    const { pageX, pageY } = event.nativeEvent;
    const distanceX = Math.abs(pageX - start.x);
    const distanceY = Math.abs(pageY - start.y);
    if (distanceX > 8 || distanceY > 8) {
      backTouchMoved.current = true;
    }
  };
  const handleBackTouchEnd = () => {
    if (!backTouchMoved.current) {
      flip();
    }
    resetBackTouch();
  };

  return (
    <View style={styles.pressable}>
      <View style={[styles.scene, { width: cardWidth, height: cardHeight }]}>
        <Animated.View
          pointerEvents={isBackVisible ? 'none' : 'auto'}
          style={[
            styles.card,
            styles.face,
            { width: cardWidth, height: cardHeight },
            isBackVisible ? styles.faceHidden : styles.faceVisible,
            frontStyle,
          ]}
        >
          <DreamCardFrame
            backgroundColor={designTheme.card}
            borderColor={frameBorderColor}
            frame={design.cardFrame}
            height={cardHeight}
            shadowColor={designTheme.shadow}
            textureColor={designTheme.texture}
          >
            <Pressable
              onPress={cardPressHandler}
              onLongPress={flip}
              style={({ pressed }) => [
                styles.facePressable,
                pressed && interactionStyles.pressedSoft,
              ]}
            >
              <View
                style={[
                  styles.imageWrap,
                  isInkFrame && styles.inkImageWrap,
                  {
                    height: imageHeight,
                    backgroundColor: designTheme.image,
                    borderColor: frameBorderColor,
                  },
                ]}
              >
                <View
                  pointerEvents="none"
                  style={[
                    styles.postageStamp,
                    {
                      borderColor: frameBorderColor,
                      backgroundColor: designTheme.card,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.postageStampInner,
                      { borderColor: frameBorderColor },
                    ]}
                  >
                    <Text
                      style={[
                        styles.postageStampValue,
                        {
                          color: frameBorderColor,
                          fontFamily: serifTitleFamily,
                        },
                      ]}
                    >
                      {dream.mainMood}
                    </Text>
                    <Text
                      style={[
                        styles.postageStampLabel,
                        { color: frameBorderColor },
                      ]}
                    >
                      KKUM · POST
                    </Text>
                  </View>
                </View>
                {hasImage ? (
                  <>
                    <Image
                      source={{
                        uri: dream.imageUrl ?? dream.thumbnailUrl ?? undefined,
                      }}
                      style={styles.image}
                    />
                    <View pointerEvents="none" style={styles.imagePaperWash} />
                  </>
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
                      style={[
                        styles.placeholderStamp,
                        { borderColor: frameBorderColor },
                      ]}
                    />
                    <Text
                      style={[
                        styles.failureText,
                        dreamFontStyle,
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
                      style={[
                        styles.placeholderStamp,
                        { borderColor: frameBorderColor },
                      ]}
                    />
                    <Text
                      style={[
                        styles.placeholderText,
                        dreamFontStyle,
                        { color: designTheme.accent },
                      ]}
                    >
                      {dream.mainMood}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.content}>
                <View style={styles.wordmarkRow}>
                  <View
                    style={[
                      styles.wordmarkRule,
                      { backgroundColor: frameBorderColor },
                    ]}
                  />
                  <Text
                    style={[
                      styles.wordmark,
                      { color: frameBorderColor, fontFamily: serifTitleFamily },
                    ]}
                  >
                    KKUMDREAM · POSTCARD
                  </Text>
                  <View
                    style={[
                      styles.wordmarkRule,
                      { backgroundColor: frameBorderColor },
                    ]}
                  />
                </View>
                {dream.titleVisible ? (
                  <Text
                    style={[
                      styles.title,
                      { color: titleColor, fontFamily: serifTitleFamily },
                    ]}
                    numberOfLines={2}
                  >
                    {dream.title}
                  </Text>
                ) : null}
                <StarOrnamentDivider color={frameBorderColor} />
                <View style={styles.ticketMetaGrid}>
                  <View style={styles.ticketMetaCell}>
                    <Text
                      style={[
                        styles.ticketMetaLabel,
                        {
                          color: titleColor,
                          fontFamily: serifTitleFamily,
                        },
                      ]}
                    >
                      FROM
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.ticketMetaValue,
                        dreamFontStyle,
                        { color: metaColor },
                      ]}
                    >
                      {giverName}
                    </Text>
                  </View>
                  <View style={styles.ticketMetaCell}>
                    <Text
                      style={[
                        styles.ticketMetaLabel,
                        {
                          color: titleColor,
                          fontFamily: serifTitleFamily,
                        },
                      ]}
                    >
                      TO
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.ticketMetaValue,
                        dreamFontStyle,
                        { color: metaColor },
                      ]}
                    >
                      {receiverName}
                    </Text>
                  </View>
                  <View style={styles.ticketMetaCell}>
                    <Text
                      style={[
                        styles.ticketMetaLabel,
                        {
                          color: titleColor,
                          fontFamily: serifTitleFamily,
                        },
                      ]}
                    >
                      DATE
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.ticketMetaValue,
                        dreamFontStyle,
                        { color: metaColor },
                      ]}
                    >
                      {issueDate}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.message,
                    dreamFontStyle,
                    { color: letterColor },
                  ]}
                  numberOfLines={2}
                >
                  {dream.shortMessage}
                </Text>
                <StarOrnamentDivider color={frameBorderColor} compact />
                <View style={styles.tagsRow}>
                  <View style={styles.tags}>
                    {visibleTags.map(tag => (
                      <View
                        key={tag}
                        style={[
                          styles.ticketTag,
                          { borderColor: frameBorderColor },
                        ]}
                      >
                        <Text
                          style={[
                            styles.ticketTagText,
                            { color: frameBorderColor },
                          ]}
                        >
                          #{tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </Pressable>
          </DreamCardFrame>
        </Animated.View>

        <Animated.View
          pointerEvents={isBackVisible ? 'auto' : 'none'}
          style={[
            styles.card,
            styles.face,
            styles.backFace,
            { width: cardWidth, height: cardHeight },
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
            <ScrollView
              bounces={false}
              nestedScrollEnabled
              onScrollBeginDrag={() => {
                backTouchMoved.current = true;
              }}
              onTouchCancel={resetBackTouch}
              onTouchEnd={handleBackTouchEnd}
              onTouchMove={handleBackTouchMove}
              onTouchStart={handleBackTouchStart}
              persistentScrollbar
              showsVerticalScrollIndicator
              style={styles.backScroll}
              contentContainerStyle={styles.backContent}
            >
              <Text
                style={[
                  styles.backTitle,
                  {
                    color: designTheme.text,
                    fontFamily: serifTitleFamily,
                  },
                ]}
              >
                {dream.title}
              </Text>
              <Text
                style={[
                  styles.backSenderLine,
                  dreamFontStyle,
                  { color: designTheme.accent },
                ]}
              >
                {giverName}이 {receiverName}에게 보낸 꿈
              </Text>
              <Text
                style={[
                  styles.story,
                  dreamFontStyle,
                  { color: designTheme.secondaryText },
                ]}
              >
                {dream.story}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={cardPressHandler}
                onLongPress={flip}
                style={({ pressed }) => [
                  styles.backFlipButton,
                  pressed && interactionStyles.pressed,
                ]}
              >
                <Text style={[styles.backFlipButtonText, dreamFontStyle]}>
                  앞면 보기
                </Text>
              </Pressable>
            </ScrollView>
          </DreamCardFrame>
        </Animated.View>
        {renderImageActions()}
      </View>
    </View>
  );
}

function StarOrnamentDivider({
  color,
  compact = false,
}: {
  color: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.ornamentRow, compact && styles.ornamentRowCompact]}>
      <View style={[styles.ornamentRule, { backgroundColor: color }]} />
      <Text style={[styles.ornamentStar, { color }]}>✦</Text>
      <View style={[styles.ornamentRule, { backgroundColor: color }]} />
      <Text style={[styles.ornamentStar, { color }]}>✧</Text>
      <View style={[styles.ornamentRule, { backgroundColor: color }]} />
      <Text style={[styles.ornamentStar, { color }]}>✦</Text>
      <View style={[styles.ornamentRule, { backgroundColor: color }]} />
    </View>
  );
}

function formatPostmarkDate(value: string | null | undefined): string {
  if (!value) {
    return '— · —';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '— · —';
  }
  const day = String(date.getDate()).padStart(2, '0');
  const months = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  const month = months[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${day} ${month} ${year}`;
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
    alignItems: 'center',
  },
  scene: {
    position: 'relative',
  },
  facePressable: {
    flex: 1,
  },
  card: {
    backgroundColor: 'transparent',
  },
  face: {
    width: '100%',
    backfaceVisibility: 'hidden',
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
  imageWrap: {
    backgroundColor: colors.lavenderTint,
    borderRadius: 0,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inkImageWrap: {
    borderWidth: 2,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePaperWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(255, 247, 230, 0.18)',
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
    borderRadius: 2,
    opacity: 0.18,
  },
  placeholderText: {
    color: colors.primaryDark,
    fontSize: 30,
    fontWeight: '500',
    includeFontPadding: false,
    textAlign: 'center',
  },
  failureText: {
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: '800',
    includeFontPadding: false,
    textAlign: 'center',
  },
  placeholderHint: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    includeFontPadding: false,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 4,
    paddingTop: 10,
    paddingBottom: 2,
    gap: 6,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.8,
    includeFontPadding: false,
  },
  wordmarkRule: {
    flex: 1,
    height: 1,
    opacity: 0.85,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 12.5,
    fontWeight: '700',
    includeFontPadding: false,
    lineHeight: 18,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 29,
    letterSpacing: -0.3,
    includeFontPadding: false,
    marginTop: 2,
  },
  ornamentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginVertical: 2,
  },
  ornamentRowCompact: {
    marginVertical: 1,
  },
  ornamentRule: {
    flex: 1,
    height: 1,
    opacity: 0.75,
  },
  ornamentStar: {
    fontSize: 10,
    lineHeight: 12,
    includeFontPadding: false,
    opacity: 0.85,
  },
  ticketMetaGrid: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  ticketMetaCell: {
    flex: 1,
    gap: 3,
  },
  ticketMetaLabel: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.4,
    includeFontPadding: false,
  },
  ticketMetaValue: {
    fontSize: 11.5,
    fontWeight: '700',
    includeFontPadding: false,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tags: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  ticketTag: {
    height: 22,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  ticketTagText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
    includeFontPadding: false,
  },
  postageStamp: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 64,
    height: 78,
    padding: 5,
    borderWidth: 1.6,
    borderStyle: 'dashed',
    zIndex: 5,
    elevation: 5,
  },
  postageStampInner: {
    flex: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  postageStampValue: {
    fontSize: 16,
    fontWeight: '900',
    includeFontPadding: false,
  },
  postageStampLabel: {
    marginTop: 4,
    fontSize: 7,
    fontWeight: '800',
    letterSpacing: 0.8,
    includeFontPadding: false,
    opacity: 0.85,
  },
  backScroll: {
    flex: 1,
  },
  backContent: {
    padding: 8,
    paddingBottom: 72,
    gap: 14,
    minHeight: '100%',
  },
  backTitle: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 32,
    includeFontPadding: false,
    marginTop: 4,
  },
  backSenderLine: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
    includeFontPadding: false,
  },
  story: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 26,
  },
  backFlipButton: {
    display: 'none',
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderMist,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  backFlipButtonText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: '700',
    includeFontPadding: false,
  },
  imageActions: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
    elevation: 10,
  },
  imageActionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,252,255,0.94)',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  imageActionButtonDisabled: {
    opacity: 0.5,
  },
});
