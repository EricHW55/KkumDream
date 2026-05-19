import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
import { radius } from '../theme/spacing';
import type { Dream } from '../types/dream';
import { getCachedRooms } from '../data/dreamRepository';
import { getDisplayMember } from '../data/members';
import { useSessionStore } from '../store/sessionStore';
import { DreamGenerationAnimation } from './DreamGenerationAnimation';
import { TagChip } from './TagChip';

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
  const sessionUserId = useSessionStore(state => state.userId);
  const [isBackVisible, setIsBackVisible] = useState(false);
  const [isImageActionPending, setIsImageActionPending] = useState(false);
  const rotation = useSharedValue(0);
  const cardHeight = size === 'full' ? 560 : 430;
  const imageHeight = size === 'full' ? 300 : 250;
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
  const dreamFontStyle = getDreamFontStyle(design.fontStyle);

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

  return (
    <View style={styles.pressable}>
      <View style={[styles.scene, { height: cardHeight }]}>
        <Animated.View
          pointerEvents={isBackVisible ? 'none' : 'auto'}
          style={[
            styles.card,
            styles.face,
            {
              height: cardHeight,
              backgroundColor: designTheme.card,
              shadowColor: designTheme.shadow,
            },
            isBackVisible ? styles.faceHidden : styles.faceVisible,
            frontStyle,
          ]}
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
                {
                  height: imageHeight,
                  backgroundColor: designTheme.image,
                },
              ]}
            >
              {hasImage ? (
                <Image
                  source={{
                    uri: dream.thumbnailUrl ?? dream.imageUrl ?? undefined,
                  }}
                  style={styles.image}
                />
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
              <Text
                style={[
                  styles.senderLine,
                  dreamFontStyle,
                  { color: designTheme.accent },
                ]}
              >
                {giverName} → {receiverName}
              </Text>
              <Text
                style={[
                  styles.message,
                  dreamFontStyle,
                  { color: designTheme.secondaryText },
                ]}
              >
                {dream.shortMessage}
              </Text>
              {dream.titleVisible ? (
                <Text
                  style={[
                    styles.title,
                    dreamFontStyle,
                    { color: designTheme.text },
                  ]}
                >
                  {dream.title}
                </Text>
              ) : null}
              <View style={styles.tags}>
                {dream.tags.map(tag => (
                  <TagChip
                    key={tag}
                    label={tag}
                    backgroundColor={designTheme.tagBackground}
                    textColor={designTheme.tagText}
                  />
                ))}
              </View>
            </View>
          </Pressable>
        </Animated.View>

        <Animated.View
          pointerEvents={isBackVisible ? 'auto' : 'none'}
          style={[
            styles.card,
            styles.face,
            styles.backFace,
            {
              height: cardHeight,
              backgroundColor: designTheme.back,
              shadowColor: designTheme.shadow,
            },
            isBackVisible ? styles.faceVisible : styles.faceHidden,
            backStyle,
          ]}
        >
          <View style={styles.facePressable}>
            <ScrollView
              bounces={false}
              nestedScrollEnabled
              persistentScrollbar
              showsVerticalScrollIndicator
              style={styles.backScroll}
              contentContainerStyle={styles.backContent}
            >
              <Text
                style={[
                  styles.backTitle,
                  dreamFontStyle,
                  { color: designTheme.text },
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
          </View>
        </Animated.View>
        {!isBackVisible ? renderImageActions() : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  scene: {
    width: '100%',
    position: 'relative',
  },
  facePressable: {
    flex: 1,
  },
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.cardIvory,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
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
    backgroundColor: colors.cardBase,
  },
  imageWrap: {
    backgroundColor: colors.lavenderTint,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderTint,
  },
  placeholderText: {
    color: colors.primaryDark,
    fontSize: 28,
    fontWeight: '700',
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
    padding: 18,
    gap: 12,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    includeFontPadding: false,
  },
  senderLine: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    includeFontPadding: false,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
    includeFontPadding: false,
  },
  tags: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  backScroll: {
    flex: 1,
  },
  backContent: {
    padding: 24,
    paddingBottom: 34,
    gap: 18,
    minHeight: '100%',
  },
  backTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    includeFontPadding: false,
  },
  backSenderLine: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    includeFontPadding: false,
  },
  story: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 26,
  },
  backFlipButton: {
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
    right: 14,
    bottom: 14,
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
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: colors.divider,
  },
  imageActionButtonDisabled: {
    opacity: 0.5,
  },
});
