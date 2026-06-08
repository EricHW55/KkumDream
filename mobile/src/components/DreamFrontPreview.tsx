import { memo, useCallback, useEffect, useRef } from 'react';
import {
  type LayoutChangeEvent,
  Image,
  InteractionManager,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { uploadDreamFrontPreview } from '../api/dreams';
import { colors } from '../theme/colors';
import { CARD_COLOR_THEMES, normalizeDreamDesign } from '../theme/dreamDesigns';
import { interactionStyles } from '../theme/interactions';
import { fontFamily } from '../theme/typography';
import type { Dream } from '../types/dream';
import { DreamCard } from './DreamCard';
import { DREAM_CARD_ASPECT_RATIO } from './DreamCardFrame';

// Bump this (and the backend FRONT_PREVIEW_VERSION) whenever the baked front
// design changes so old previews are treated as outdated and regenerated.
export const FRONT_PREVIEW_VERSION = 1;

// Geometry of the off-screen capture host. The card is rendered at a fixed
// resolution and wrapped in a transparent margin wide enough to contain the
// frame's drop shadow, so the captured PNG has the shadow baked in. Keeping
// these fixed makes the stored preview's aspect ratio deterministic.
const GEN_CARD_WIDTH = 320;
const GEN_CARD_HEIGHT = Math.round(GEN_CARD_WIDTH / DREAM_CARD_ASPECT_RATIO);
const GEN_PAD_X = 54;
const GEN_PAD_Y = 60;
const GEN_HOST_WIDTH = GEN_CARD_WIDTH + GEN_PAD_X * 2;
const GEN_HOST_HEIGHT = GEN_CARD_HEIGHT + GEN_PAD_Y * 2;

// Aspect ratio (width / height) of the flattened preview, including the shadow
// margin. The archive grid sizes its cells with this so the preview image fills
// the cell exactly with no cropping.
export const PREVIEW_ASPECT_RATIO = GEN_HOST_WIDTH / GEN_HOST_HEIGHT;
// Fraction of the cell width the actual card occupies (the rest is shadow halo).
const CARD_WIDTH_FRACTION = GEN_CARD_WIDTH / GEN_HOST_WIDTH;

export function hasValidFrontPreview(dream: Dream): boolean {
  return Boolean(
    dream.frontPreviewUrl &&
      dream.frontPreviewVersion === FRONT_PREVIEW_VERSION,
  );
}

// A card needs a generated preview when it lacks a current one and has a
// thumbnail to bake in. Drafts/hidden cards never reach the archive, and a card
// whose image is still generating has no thumbnail yet, so we wait.
export function needsFrontPreview(dream: Dream): boolean {
  return Boolean(
    !hasValidFrontPreview(dream) &&
      dream.thumbnailUrl &&
      !dream.isHidden &&
      dream.status !== 'draft',
  );
}

// Stable, order-independent hash of the front-relevant fields. Stored alongside
// the preview so a future change in design data can be detected; cache validity
// itself keys on the version, this is informational / for CDN cache busting.
export function computeFrontPreviewHash(dream: Dream): string {
  const design = normalizeDreamDesign(dream.design);
  const parts = [
    FRONT_PREVIEW_VERSION,
    design.cardColor,
    design.cardFrame,
    design.fontStyle,
    design.imageTexture,
    dream.title,
    dream.titleVisible ? '1' : '0',
    dream.shortMessage,
    dream.mainMood,
    dream.tags.slice(0, 3).join(','),
    dream.giverDisplayName ?? '',
    dream.receiverDisplayName ?? dream.receiverLabel ?? '',
    dream.givenAt ?? dream.createdAt ?? '',
    dream.thumbnailUrl ?? '',
  ].join('|');

  let hash = 5381;
  for (let index = 0; index < parts.length; index += 1) {
    hash = (hash * 33) ^ parts.charCodeAt(index);
  }
  return (hash >>> 0).toString(16);
}

type ArchivePreviewProps = {
  dream: Dream;
  index: number;
  width: number;
  onPress: (dream: Dream) => void;
  onLayout?: (dreamId: string, index: number, event: LayoutChangeEvent) => void;
};

// Lightweight archive/list item. Renders the pre-rendered flattened preview as a
// single image when available, otherwise a cheap thumbnail placeholder. It never
// mounts the full DreamCard, so the list scrolls like an image feed.
export const DreamArchivePreview = memo(function DreamArchivePreview({
  dream,
  index,
  width,
  onPress,
  onLayout,
}: ArchivePreviewProps) {
  const cellHeight = Math.round(width / PREVIEW_ASPECT_RATIO);
  const handlePress = useCallback(() => onPress(dream), [onPress, dream]);
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => onLayout?.(dream.id, index, event),
    [onLayout, dream.id, index],
  );
  const hasPreview = hasValidFrontPreview(dream);

  return (
    <Pressable
      accessibilityRole="button"
      onLayout={handleLayout}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.cell,
        { width, height: cellHeight },
        pressed && interactionStyles.pressedSoft,
      ]}
    >
      {hasPreview ? (
        <Image
          resizeMode="contain"
          source={{ uri: dream.frontPreviewUrl ?? undefined }}
          style={styles.previewImage}
        />
      ) : (
        <FrontPreviewFallback dream={dream} cellWidth={width} />
      )}
    </Pressable>
  );
});

// Cheap placeholder shown until the flattened preview exists (or for cards whose
// image is still being generated). Matches the card footprint of the real
// preview so the cell does not jump when the image swaps in.
function FrontPreviewFallback({
  dream,
  cellWidth,
}: {
  dream: Dream;
  cellWidth: number;
}) {
  const design = normalizeDreamDesign(dream.design);
  const theme = CARD_COLOR_THEMES[design.cardColor];
  const cardWidth = Math.round(cellWidth * CARD_WIDTH_FRACTION);
  const cardHeight = Math.round(cardWidth / DREAM_CARD_ASPECT_RATIO);
  const isPending =
    dream.imageStatus === 'queued' || dream.imageStatus === 'generating';

  return (
    <View
      style={[
        styles.fallbackCard,
        { width: cardWidth, height: cardHeight, backgroundColor: theme.card },
      ]}
    >
      {dream.thumbnailUrl ? (
        <Image
          resizeMode="cover"
          source={{ uri: dream.thumbnailUrl }}
          style={styles.fallbackImage}
        />
      ) : (
        <View
          style={[
            styles.fallbackPlaceholder,
            { backgroundColor: theme.placeholder },
          ]}
        >
          <Text style={[styles.fallbackMood, { color: theme.accent }]}>
            {isPending ? '생성중' : String(dream.mainMood).slice(0, 2)}
          </Text>
        </View>
      )}
    </View>
  );
}

type GeneratorProps = {
  dream: Dream;
  token?: string | null;
  onGenerated: (dream: Dream) => void;
  onError: (dreamId: string) => void;
};

// Off-screen worker that renders the real card front once, captures it to a PNG
// (with the shadow baked into the transparent margin), and uploads it so the
// backend transcodes it to WebP on R2. Mount exactly one at a time.
export function DreamFrontPreviewGenerator({
  dream,
  token,
  onGenerated,
  onError,
}: GeneratorProps) {
  const hostRef = useRef<View>(null);

  useEffect(() => {
    let isCancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      try {
        if (dream.thumbnailUrl) {
          // Make sure the baked-in thumbnail is loaded before we snapshot.
          await Image.prefetch(dream.thumbnailUrl).catch(() => undefined);
        }
        if (isCancelled) {
          return;
        }
        const uri = await captureRef(hostRef, {
          format: 'png',
          quality: 1,
          result: 'tmpfile',
        });
        if (isCancelled) {
          return;
        }
        const updated = await uploadDreamFrontPreview(
          dream.id,
          { uri, version: FRONT_PREVIEW_VERSION, hash: computeFrontPreviewHash(dream) },
          token,
        );
        if (!isCancelled) {
          onGenerated(updated);
        }
      } catch {
        if (!isCancelled) {
          onError(dream.id);
        }
      }
    };

    const task = InteractionManager.runAfterInteractions(() => {
      // Give the off-screen card a moment to lay out and paint the (prefetched)
      // thumbnail before capture, so we never snapshot the placeholder.
      timer = setTimeout(run, 400);
    });

    return () => {
      isCancelled = true;
      task.cancel?.();
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [dream, onError, onGenerated, token]);

  return (
    <View pointerEvents="none" style={styles.generatorLayer}>
      <View ref={hostRef} collapsable={false} style={styles.generatorHost}>
        <DreamCard
          disableFlip
          dream={dream}
          preferThumbnail
          showImageActions={false}
          width={GEN_CARD_WIDTH}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  fallbackCard: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  fallbackImage: {
    width: '100%',
    height: '100%',
  },
  fallbackPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackMood: {
    fontFamily: fontFamily.handwritten,
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },
  generatorLayer: {
    // Fully off-screen rather than transparent: a parent opacity of 0 can make
    // the capture come back blank on Android.
    position: 'absolute',
    left: -10000,
    top: 0,
    width: GEN_HOST_WIDTH,
    height: GEN_HOST_HEIGHT,
  },
  generatorHost: {
    width: GEN_HOST_WIDTH,
    height: GEN_HOST_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
