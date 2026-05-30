import type { Dream, DreamDesign, DreamStoryLength } from '../types/dream';
import { getCacheUpdatedAt, readCache, removeCache, writeCache } from './cache';

// Korea Standard Time has a fixed +9h offset (no DST), so the most recent
// KST midnight can be computed by arithmetic without a timezone library.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function kstTodayStartMs(now = Date.now()) {
  return Math.floor((now + KST_OFFSET_MS) / DAY_MS) * DAY_MS - KST_OFFSET_MS;
}

export type ComposeRecipientMode = 'friend' | 'external';
export type ComposeToneValue =
  | 'warm'
  | 'polite'
  | 'casual'
  | 'mz_comic'
  | 'story'
  | 'poetic';

export type ComposeDraftSnapshot = {
  version: 1;
  rawInput: string;
  mood: string;
  tone: ComposeToneValue;
  storyLength: DreamStoryLength;
  selectedDesign: DreamDesign;
  draft: Dream | null;
  recipientMode: ComposeRecipientMode;
  selectedReceiverId: string | null;
  externalLabel: string;
  selectedGroupIds: string[];
  privatePostscript: string;
};

const composeDraftSnapshots = new Map<string, ComposeDraftSnapshot | null>();

export function getComposeDraftCacheKey(userId?: string | null) {
  return `compose_draft_v1:${userId ?? 'anonymous'}`;
}

// Mirror the backend's midnight (KST) draft purge: a snapshot last saved
// before today's KST midnight is stale, so drop it locally too. Validated on
// every read so it also expires while the app stays open across midnight.
function discardStaleSnapshot(key: string) {
  const updatedAt = getCacheUpdatedAt(key);
  if (updatedAt && updatedAt < kstTodayStartMs()) {
    removeCache(key);
    composeDraftSnapshots.set(key, null);
    return true;
  }
  return false;
}

export function prehydrateComposeDraftCache(userId?: string | null) {
  const key = getComposeDraftCacheKey(userId);
  if (discardStaleSnapshot(key)) {
    return;
  }
  if (!composeDraftSnapshots.has(key)) {
    composeDraftSnapshots.set(key, readCache<ComposeDraftSnapshot>(key));
  }
}

export function readComposeDraftSnapshot(userId?: string | null) {
  const key = getComposeDraftCacheKey(userId);
  if (discardStaleSnapshot(key)) {
    return null;
  }
  if (!composeDraftSnapshots.has(key)) {
    prehydrateComposeDraftCache(userId);
  }
  return composeDraftSnapshots.get(key) ?? null;
}

export function writeComposeDraftSnapshot(
  userId: string | null | undefined,
  snapshot: ComposeDraftSnapshot,
) {
  const key = getComposeDraftCacheKey(userId);
  writeCache(key, snapshot);
  composeDraftSnapshots.set(key, snapshot);
}

export function removeComposeDraftSnapshot(userId?: string | null) {
  const key = getComposeDraftCacheKey(userId);
  removeCache(key);
  composeDraftSnapshots.set(key, null);
}
