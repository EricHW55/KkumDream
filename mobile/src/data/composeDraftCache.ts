import type { Dream, DreamDesign, DreamStoryLength } from '../types/dream';
import { readCache, removeCache, writeCache } from './cache';

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

export function prehydrateComposeDraftCache(userId?: string | null) {
  const key = getComposeDraftCacheKey(userId);
  if (!composeDraftSnapshots.has(key)) {
    composeDraftSnapshots.set(key, readCache<ComposeDraftSnapshot>(key));
  }
}

export function readComposeDraftSnapshot(userId?: string | null) {
  const key = getComposeDraftCacheKey(userId);
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
