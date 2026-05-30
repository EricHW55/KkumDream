import { create } from 'zustand';

import { readCache, writeCache } from '../data/cache';

export type ArchiveColumns = 2 | 3 | 4;

/** Push notification kinds, mirroring the backend `notificationType` values. */
export type PushNotificationType =
  | 'dream_given'
  | 'dream_ready'
  | 'dream_comment'
  | 'owner_comment'
  | 'dream_claimed';

export type PushPreferences = Record<PushNotificationType, boolean>;

const PUSH_PREFERENCES_KEY = 'ui:settings:push-preferences';
const ARCHIVE_COLUMNS_KEY = 'ui:settings:archive-columns';

const DEFAULT_ARCHIVE_COLUMNS: ArchiveColumns = 3;
const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  dream_given: true,
  dream_ready: true,
  dream_comment: true,
  owner_comment: true,
  dream_claimed: true,
};

function readPushPreferences(): PushPreferences {
  const stored = readCache<Partial<PushPreferences>>(PUSH_PREFERENCES_KEY);
  if (!stored || typeof stored !== 'object') {
    return { ...DEFAULT_PUSH_PREFERENCES };
  }
  // Merge with defaults so newly added notification kinds default to on.
  const merged = { ...DEFAULT_PUSH_PREFERENCES };
  (Object.keys(DEFAULT_PUSH_PREFERENCES) as PushNotificationType[]).forEach(
    type => {
      if (typeof stored[type] === 'boolean') {
        merged[type] = stored[type] as boolean;
      }
    },
  );
  return merged;
}

function readArchiveColumns(): ArchiveColumns {
  const value = readCache<number>(ARCHIVE_COLUMNS_KEY);
  return value === 2 || value === 3 || value === 4
    ? value
    : DEFAULT_ARCHIVE_COLUMNS;
}

type SettingsState = {
  pushPreferences: PushPreferences;
  archiveColumns: ArchiveColumns;
  setPushPreference: (type: PushNotificationType, enabled: boolean) => void;
  setArchiveColumns: (columns: ArchiveColumns) => void;
};

/**
 * User-facing app preferences kept on-device only (MMKV). These are
 * intentionally not synced to the backend — if the app is reinstalled the
 * user simply sets them again.
 */
export const useSettingsStore = create<SettingsState>(set => ({
  pushPreferences: readPushPreferences(),
  archiveColumns: readArchiveColumns(),
  setPushPreference: (type, enabled) =>
    set(state => {
      const pushPreferences = { ...state.pushPreferences, [type]: enabled };
      writeCache(PUSH_PREFERENCES_KEY, pushPreferences);
      return { pushPreferences };
    }),
  setArchiveColumns: columns => {
    writeCache(ARCHIVE_COLUMNS_KEY, columns);
    set({ archiveColumns: columns });
  },
}));

export function isAnyPushEnabled(preferences: PushPreferences): boolean {
  return Object.values(preferences).some(Boolean);
}
