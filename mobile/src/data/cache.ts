import { createMMKV } from 'react-native-mmkv';

const cache = createMMKV({ id: 'kkumdream-data-cache' });

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
}
