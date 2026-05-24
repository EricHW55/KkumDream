import { useRef, useState } from 'react';
import type { GestureResponderEvent, StyleProp, ViewStyle } from 'react-native';
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
import { captureRef } from 'react-native-view-shot';

import paperTexture from '../assets/textures/paper_texture.webp';
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
  width?: number;
  disableFlip?: boolean;
  onPress?: () => void;
  onBackOpen?: () => void;
  showImageActions?: boolean;
};

export function DreamCard({
  dream,
  size = 'feed',
  width,
  disableFlip = false,
  onPress,
  onBackOpen,
  showImageActions = true,
}: Props) {
  const { width: windowWidth } = useWindowDimensions();
  const sessionUserId = useSessionStore(state => state.userId);
  const [isBackVisible, setIsBackVisible] = useState(false);
  const [isImageActionPending, setIsImageActionPending] = useState(false);
  const frontCardCaptureRef = useRef<View>(null);
  const backTouchStart = useRef<{ x: number; y: number } | null>(null);
  const backTouchMoved = useRef(false);
  const rotation = useSharedValue(0);
  const horizontalMargin = size === 'full' ? 44 : 36;
  const requestedCardWidth =
    width ?? Math.min(windowWidth - horizontalMargin, 340);
  const layoutCardWidth = requestedCardWidth < 340 ? 340 : requestedCardWidth;
  const cardScale = requestedCardWidth / layoutCardWidth;
  const cardHeight = Math.round(layoutCardWidth / DREAM_CARD_ASPECT_RATIO);
  const sceneHeight = Math.round(cardHeight * cardScale);
  const imageHeight = Math.round(cardHeight * 0.54);
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
  const isMovieTicketFrame = design.cardFrame === 'beveled';
  const isDarkTheme = design.cardColor === 'midnight';
  const frameBorderColor = isDarkTheme ? designTheme.line : '#CBBFAE';
  const titleColor = isDarkTheme ? designTheme.text : '#2D2923';
  const metaColor = isDarkTheme ? designTheme.accent : '#6F675D';
  const letterColor = isDarkTheme ? designTheme.secondaryText : '#6F675D';
  const dreamFontStyle = getDreamFontStyle(design.fontStyle);
  const visibleTags = dream.tags.slice(0, 3);
  const frontDate = formatShortDate(dream.givenAt ?? dream.createdAt);
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
    if (disableFlip) {
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

  const renderImageScene = (customStyle?: StyleProp<ViewStyle>) => (
    <View
      style={[
        styles.imageWrap,
        customStyle,
        {
          height: imageHeight,
          backgroundColor: designTheme.image,
          borderColor: isMovieTicketFrame ? titleColor : frameBorderColor,
        },
      ]}
    >
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
            style={[styles.placeholderStamp, { borderColor: frameBorderColor }]}
          />
          <Text
            style={[
              styles.failureText,
              { color: designTheme.accent, fontFamily: frontTitleFamily },
            ]}
          >
            이미지 준비 실패
          </Text>
          <Text
            style={[
              styles.placeholderHint,
              { color: designTheme.secondaryText, fontFamily: frontBodyFamily },
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
              { color: designTheme.accent, fontFamily: frontTitleFamily },
            ]}
          >
            {dream.mainMood}
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
                shadowColor={designTheme.shadow}
                textureColor={designTheme.texture}
              >
                <Pressable
                  onPress={cardPressHandler}
                  onLongPress={disableFlip ? undefined : flip}
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
                        <PaperTape
                          crease="left"
                          style={[styles.paperTape, styles.paperTapeLeft]}
                        />
                        <PaperTape
                          crease="right"
                          style={[styles.paperTape, styles.paperTapeRight]}
                        />
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
                        <Text
                          style={[
                            styles.frontWordmark,
                            { color: metaColor, fontFamily: serifTitleFamily },
                          ]}
                        >
                          ✦ 꿈드림 ✦
                        </Text>
                      </View>
                    </View>
                  )}
                </Pressable>
              </DreamCardFrame>
            </View>
          </Animated.View>

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
                    { borderColor: frameBorderColor },
                  ]}
                >
                  <PaperTape style={styles.letterTape} />
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
                    persistentScrollbar={false}
                    showsVerticalScrollIndicator={false}
                    style={styles.backScroll}
                    contentContainerStyle={styles.letterContent}
                  >
                    <Text
                      style={[
                        styles.letterStory,
                        dreamFontStyle,
                        { color: designTheme.text },
                      ]}
                    >
                      {dream.story}
                    </Text>
                  </ScrollView>
                </View>
              </View>
            </DreamCardFrame>
          </Animated.View>
          {showImageActions && !isBackVisible ? renderImageActions() : null}
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

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'center',
    alignItems: 'center',
  },
  scene: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaledScene: {
    position: 'relative',
  },
  facePressable: {
    flex: 1,
  },
  card: {
    backgroundColor: 'transparent',
  },
  captureTarget: {
    width: '100%',
    height: '100%',
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
  letterContent: {
    paddingTop: 16,
    paddingBottom: 16,
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
