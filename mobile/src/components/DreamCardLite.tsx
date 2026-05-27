import { memo, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { CARD_COLOR_THEMES, normalizeDreamDesign } from '../theme/dreamDesigns';
import { interactionStyles } from '../theme/interactions';
import { fontFamily } from '../theme/typography';
import type { Dream } from '../types/dream';
import { DREAM_CARD_ASPECT_RATIO, DreamCardFrame } from './DreamCardFrame';

const FULL_CARD_IMAGE_ASPECT_RATIO = 1.06;

type Props = {
  dream: Dream;
  width: number;
  onPress?: () => void;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export const DreamCardLite = memo(function DreamCardLite({
  dream,
  width,
  onPress,
  compact = false,
  style,
}: Props) {
  const [didImageFail, setDidImageFail] = useState(false);
  const design = normalizeDreamDesign(dream.design);
  const theme = CARD_COLOR_THEMES[design.cardColor];
  const imageUrl = dream.thumbnailUrl ?? dream.imageUrl;
  const isImagePending =
    dream.imageStatus === 'queued' || dream.imageStatus === 'generating';
  const height = Math.round(width / DREAM_CARD_ASPECT_RATIO);
  const imageHorizontalInset = compact ? 18 : 24;
  const imageWidth = Math.max(1, width - imageHorizontalInset);
  const imageHeight = Math.round(imageWidth / FULL_CARD_IMAGE_ASPECT_RATIO);
  const hasImage = Boolean(imageUrl) && !didImageFail;
  const frameBorderColor = design.cardColor === 'midnight' ? theme.line : '#CBBFAE';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.root,
        compact && styles.rootCompact,
        {
          width,
          height,
          shadowColor: theme.shadow,
        },
        pressed && interactionStyles.pressedSoft,
        style,
      ]}
    >
      <DreamCardFrame
        backgroundColor={theme.card}
        borderColor={frameBorderColor}
        compact
        contentStyle={compact ? styles.frameContentCompact : styles.frameContent}
        frame={design.cardFrame}
        height={height}
        minimal
        textureColor={theme.texture}
      >
        <View
          style={[
            styles.imageFrame,
            {
              height: imageHeight,
              backgroundColor: theme.image,
              borderColor: frameBorderColor,
            },
          ]}
        >
          {hasImage ? (
            <Image
              onError={() => setDidImageFail(true)}
              resizeMode="cover"
              source={{ uri: imageUrl ?? undefined }}
              style={styles.image}
            />
          ) : (
            <View
              style={[
                styles.placeholder,
                { backgroundColor: theme.placeholder },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.placeholderText,
                  compact && styles.placeholderTextCompact,
                  { color: theme.accent },
                ]}
              >
                {isImagePending ? '생성중' : dream.mainMood}
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.body, compact && styles.bodyCompact]}>
          {dream.titleVisible ? (
            <Text
              numberOfLines={compact ? 1 : 2}
              style={[
                styles.title,
                compact && styles.titleCompact,
                { color: theme.text },
              ]}
            >
              {dream.title}
            </Text>
          ) : null}
          <Text
            numberOfLines={compact ? 1 : 2}
            style={[
              styles.message,
              compact && styles.messageCompact,
              { color: theme.secondaryText },
            ]}
          >
            {dream.shortMessage}
          </Text>
        </View>
      </DreamCardFrame>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  root: {
    overflow: 'visible',
    shadowOpacity: 0.12,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  rootCompact: {
    shadowOpacity: 0.1,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  frameContent: {
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  frameContentCompact: {
    paddingHorizontal: 9,
    paddingVertical: 10,
  },
  imageFrame: {
    borderRadius: 8,
    borderWidth: 0.8,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    paddingHorizontal: 8,
    textAlign: 'center',
    fontFamily: fontFamily.handwritten,
    fontSize: 20,
    fontWeight: '700',
    includeFontPadding: false,
  },
  placeholderTextCompact: {
    fontSize: 16,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 3,
    paddingTop: 7,
  },
  bodyCompact: {
    gap: 3,
    paddingTop: 5,
  },
  title: {
    textAlign: 'center',
    fontFamily: fontFamily.handwritten,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
    includeFontPadding: false,
  },
  titleCompact: {
    fontSize: 12,
    lineHeight: 15,
  },
  message: {
    textAlign: 'center',
    fontFamily: fontFamily.handwritten,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    includeFontPadding: false,
  },
  messageCompact: {
    fontSize: 9.5,
    lineHeight: 12,
  },
});
