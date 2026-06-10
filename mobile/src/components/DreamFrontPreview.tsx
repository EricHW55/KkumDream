import { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  type LayoutChangeEvent,
  Image,
  PixelRatio,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { uploadDreamFrontPreview } from '../api/dreams';
import { normalizeDreamDesign } from '../theme/dreamDesigns';
import { interactionStyles } from '../theme/interactions';
import type { Dream } from '../types/dream';
import { DreamCard } from './DreamCard';
import { DREAM_CARD_ASPECT_RATIO } from './DreamCardFrame';

// Bump this (and the backend FRONT_PREVIEW_VERSION) whenever the baked front
// design changes — or when a generation bug produced bad previews — so old
// previews are treated as outdated and regenerated under a new R2 key.
// v2: fixed a blank-image-region bug in the off-screen capture.
// v3: raised baked preview resolution/quality (600/82 -> 800/88) for sharper text.
// v4: re-bake — early v3 uploads landed on the old backend (still 600/82) before
//     the 800/88 deploy, so bump again to regenerate them at the new quality.
// v5: widened the capture margin (the soft shadow was within ~1-2px of the host
//     edge) and the backend now preserves the alpha shadow (near-lossless alpha).
//     The host aspect ratio changed, so old previews must be re-baked.
export const FRONT_PREVIEW_VERSION = 5;

// Geometry of the off-screen capture host. The card is rendered at a fixed
// resolution and wrapped in a transparent margin wide enough to contain the
// frame's drop shadow, so the captured PNG has the shadow baked in. Keeping
// these fixed makes the stored preview's aspect ratio deterministic.
const GEN_CARD_WIDTH = 320;
const GEN_CARD_HEIGHT = Math.round(GEN_CARD_WIDTH / DREAM_CARD_ASPECT_RATIO);
// The frame's drop shadow extends ~53px (x) / ~58px (y) beyond the scaled card.
// Keep a comfortable margin so the soft shadow falloff is never nipped at the
// capture edge (previously only ~1-2px of slack remained).
const GEN_PAD_X = 66;
const GEN_PAD_Y = 72;
const GEN_HOST_WIDTH = GEN_CARD_WIDTH + GEN_PAD_X * 2;
const GEN_HOST_HEIGHT = GEN_CARD_HEIGHT + GEN_PAD_Y * 2;

// The backend downscales every uploaded preview to a max 800px long side
// (storage_service._to_webp). Capturing at the device's full resolution
// (~1356x2007 on a 3x phone) therefore uploads ~5x more bytes than survive the
// transcode — pure waste on the slowest (upload) step. Capture at ~900px long
// side instead: above the 800 cap so the stored WebP is bit-for-bit the same
// quality, but a fraction of the bytes to upload.
const PREVIEW_CAPTURE_LONG_SIDE = 900;

// Cap how long we wait for the thumbnail to decode before giving up on this card
// and letting the queue move to the next one. Without it, a thumbnail that never
// fires onLoad (slow/stalled network, no error event) would block all further
// baking indefinitely. The card stays unbaked and is retried later.
//
// Thumbnails are prefetched by the archive (THUMBNAIL_PREFETCH_LIMIT), so onLoad
// usually fires near-instantly and this never triggers — it's purely a stall
// guard. Keep it short so one stuck thumbnail doesn't hog the single-flight
// queue, but not so short that a legitimately slow load on weak cellular is
// abandoned (and needlessly retried) before it finishes.
const PREVIEW_IMAGE_LOAD_TIMEOUT_MS = 4000;

// Aspect ratio (width / height) of the flattened preview, including the shadow
// margin. The archive grid sizes its cells with this so the preview image fills
// the cell exactly with no cropping.
export const PREVIEW_ASPECT_RATIO = GEN_HOST_WIDTH / GEN_HOST_HEIGHT;
// Fraction of the cell width the actual card occupies (the rest is shadow halo).
const CARD_WIDTH_FRACTION = GEN_CARD_WIDTH / GEN_HOST_WIDTH;

export function hasValidFrontPreview(dream: Dream): boolean {
  return Boolean(
    dream.frontPreviewUrl &&
      dream.frontPreviewVersion === FRONT_PREVIEW_VERSION &&
      // Also key on the content hash so a card whose front-relevant data changed
      // after it was baked (e.g. an external recipient claimed it and "오빠"
      // became their real name, or the title/design was edited) is treated as
      // stale and re-baked, instead of showing the outdated preview forever.
      dream.frontPreviewHash === computeFrontPreviewHash(dream),
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

// Lightweight archive/list item. When the flattened preview exists it renders a
// single image (image feed). Until then it falls back to a lite DreamCard — a
// simple frame + thumbnail, no shadow/flip — so the cell still reads as a card
// while its preview is being baked in the background.
export const DreamArchivePreview = memo(function DreamArchivePreview({
  dream,
  index,
  width,
  onPress,
  onLayout,
}: ArchivePreviewProps) {
  // The cell footprint is the card itself (like the old grid). The flattened
  // preview image also contains a shadow halo, so it is rendered larger than the
  // cell and centered, letting the halo bleed into the grid gaps exactly as the
  // live card's drop shadow used to — so the card is the same size as before.
  const cellHeight = Math.round(width / DREAM_CARD_ASPECT_RATIO);
  const previewWidth = Math.round(width / CARD_WIDTH_FRACTION);
  const previewHeight = Math.round(previewWidth / PREVIEW_ASPECT_RATIO);
  const handlePress = useCallback(() => onPress(dream), [onPress, dream]);
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => onLayout?.(dream.id, index, event),
    [onLayout, dream.id, index],
  );
  const hasPreview = hasValidFrontPreview(dream);

  return (
    <View onLayout={handleLayout} style={[styles.cell, { width, height: cellHeight }]}>
      {hasPreview ? (
        <Pressable
          accessibilityRole="button"
          onPress={handlePress}
          style={({ pressed }) => [
            styles.previewFill,
            pressed && interactionStyles.pressedSoft,
          ]}
        >
          <Image
            resizeMode="stretch"
            source={{ uri: dream.frontPreviewUrl ?? undefined }}
            style={{
              position: 'absolute',
              width: previewWidth,
              height: previewHeight,
              left: Math.round((width - previewWidth) / 2),
              top: Math.round((cellHeight - previewHeight) / 2),
            }}
          />
        </Pressable>
      ) : (
        <DreamCard
          disableFlip
          dream={dream}
          onPress={handlePress}
          preferThumbnail
          showImageActions={false}
          variant="lite"
          width={width}
        />
      )}
    </View>
  );
});

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
  // Gate the capture on the thumbnail actually decoding (onLoad), not a guessed
  // delay. A blank image region happens when the snapshot runs before the
  // thumbnail has painted, so we wait for a real load signal first.
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  useEffect(() => {
    if (!dream.thumbnailUrl) {
      onError(dream.id);
    }
  }, [dream.id, dream.thumbnailUrl, onError]);

  // Bail out (releasing the queue to the next card) if the thumbnail hasn't
  // decoded within the timeout, so a stalled image never blocks baking forever.
  useEffect(() => {
    if (isImageLoaded || !dream.thumbnailUrl) {
      return undefined;
    }
    const timer = setTimeout(() => {
      onError(dream.id);
    }, PREVIEW_IMAGE_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [dream.id, dream.thumbnailUrl, isImageLoaded, onError]);

  useEffect(() => {
    if (!isImageLoaded) {
      return undefined;
    }

    let isCancelled = false;
    let raf1 = 0;
    let raf2 = 0;

    const capture = async () => {
      if (isCancelled) {
        return;
      }
      try {
        // react-native-view-shot sizing differs by platform: on iOS width/height
        // are points (output = points x device scale), on Android they are the
        // final pixels. Normalize so the PNG is ~900px tall on both, keeping the
        // host aspect ratio so the stored preview geometry is unchanged.
        const captureScale = Platform.OS === 'ios' ? PixelRatio.get() : 1;
        const captureHeight = Math.round(PREVIEW_CAPTURE_LONG_SIDE / captureScale);
        const captureWidth = Math.round(
          captureHeight * (GEN_HOST_WIDTH / GEN_HOST_HEIGHT),
        );
        const uri = await captureRef(hostRef, {
          format: 'png',
          quality: 1,
          width: captureWidth,
          height: captureHeight,
          result: 'tmpfile',
        });
        if (isCancelled) {
          return;
        }
        const updated = await uploadDreamFrontPreview(
          dream.id,
          {
            uri,
            version: FRONT_PREVIEW_VERSION,
            hash: computeFrontPreviewHash(dream),
          },
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

    // The thumbnail has decoded; wait two frames so the card has actually
    // painted it into the layer before snapshotting.
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(capture);
    });

    return () => {
      isCancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [dream, isImageLoaded, onError, onGenerated, token]);

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
      {/* Invisible probe that fires onLoad once the thumbnail is decoded; the
          card above renders the same URI from cache, so it is painted by then. */}
      {dream.thumbnailUrl ? (
        <Image
          onError={() => onError(dream.id)}
          onLoad={() => setIsImageLoaded(true)}
          source={{ uri: dream.thumbnailUrl }}
          style={styles.loadProbe}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  previewFill: {
    width: '100%',
    height: '100%',
  },
  generatorLayer: {
    // Kept on-screen (top-left) but at ~0 opacity instead of far off-screen: a
    // view fully outside the window may not composite its image layer, which is
    // what left a blank image region in the snapshot. The captured host below
    // keeps full opacity, so the PNG is unaffected by this wrapper's opacity.
    position: 'absolute',
    top: 0,
    left: 0,
    width: GEN_HOST_WIDTH,
    height: GEN_HOST_HEIGHT,
    opacity: 0.01,
    zIndex: -1,
  },
  generatorHost: {
    width: GEN_HOST_WIDTH,
    height: GEN_HOST_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  loadProbe: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
});
