import { useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { colors } from '../theme/colors';
import { radius } from '../theme/spacing';
import type { Dream } from '../types/dream';
import { getMember } from '../mocks/groups';
import { TagChip } from './TagChip';

type Props = {
  dream: Dream;
  size?: 'feed' | 'full';
  onPress?: () => void;
};

export function DreamCard({ dream, size = 'feed', onPress }: Props) {
  const [isBackVisible, setIsBackVisible] = useState(false);
  const rotation = useSharedValue(0);
  const cardHeight = size === 'full' ? 560 : 430;
  const imageHeight = size === 'full' ? 300 : 250;
  const giverName = getMember(dream.giverId)?.name ?? '나';
  const receiverName = dream.receiverId
    ? getMember(dream.receiverId)?.name ?? '받는 사람'
    : '받는 사람 미정';

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
    rotation.value = withSpring(next ? 180 : 0, {
      stiffness: 180,
      damping: 22,
    });
  };

  return (
    <Pressable
      onPress={onPress ?? flip}
      onLongPress={flip}
      style={styles.pressable}
    >
      <View style={[styles.scene, { height: cardHeight }]}>
        <Animated.View
          style={[styles.card, styles.face, { height: cardHeight }, frontStyle]}
        >
          <View style={[styles.imageWrap, { height: imageHeight }]}>
            {dream.thumbnailUrl || dream.imageUrl ? (
              <Image
                source={{
                  uri: dream.thumbnailUrl ?? dream.imageUrl ?? undefined,
                }}
                style={styles.image}
              />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderText}>{dream.mainMood}</Text>
              </View>
            )}
          </View>
          <View style={styles.content}>
            <Text style={styles.senderLine}>
              {giverName} → {receiverName}
            </Text>
            <Text style={styles.message}>{dream.shortMessage}</Text>
            {dream.titleVisible ? (
              <Text style={styles.title}>{dream.title}</Text>
            ) : null}
            <View style={styles.tags}>
              {dream.tags.map(tag => (
                <TagChip key={tag} label={tag} />
              ))}
            </View>
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            styles.face,
            styles.backFace,
            { height: cardHeight },
            backStyle,
          ]}
        >
          <ScrollView
            bounces={false}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
            style={styles.backScroll}
            contentContainerStyle={styles.backContent}
          >
            <Text style={styles.backTitle}>{dream.title}</Text>
            <Text style={styles.backSenderLine}>
              {giverName}이 {receiverName}에게 보낸 꿈
            </Text>
            <Text style={styles.story}>{dream.story}</Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  scene: {
    width: '100%',
  },
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.cardIvory,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 5,
  },
  face: {
    width: '100%',
    backfaceVisibility: 'hidden',
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
    fontWeight: '800',
    includeFontPadding: false,
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
    fontWeight: '800',
    includeFontPadding: false,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
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
    gap: 18,
    minHeight: '100%',
  },
  backTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    includeFontPadding: false,
  },
  backSenderLine: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
    includeFontPadding: false,
  },
  story: {
    color: colors.textSecondary,
    fontSize: 16,
    lineHeight: 26,
  },
});
