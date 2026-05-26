import { createMMKV } from 'react-native-mmkv';

const cache = createMMKV({ id: 'kkumdream-data-cache' });

function updatedAtKey(key: string) {
  return `${key}:updatedAt`;
}

export function readCache<T>(key: string): T | null {
  const raw = cache.getString(key);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    cache.remove(key);
    return null;
  }
}

export function writeCache<T>(key: string, value: T) {
  cache.set(key, JSON.stringify(value));
  cache.set(updatedAtKey(key), Date.now());
}

export function hasCache(key: string) {
  return cache.contains(key);
}

export function getCacheUpdatedAt(key: string) {
  return cache.getNumber(updatedAtKey(key)) ?? 0;
}
