import { Platform } from 'react-native';
import { createMMKV } from 'react-native-mmkv';

export type HandwritingFontMode = 'ios-baked' | 'android-native';

const storage = createMMKV({ id: 'kkumdream-font-mode' });
const HANDWRITING_FONT_MODE_KEY = 'handwriting-font-mode';
const DEFAULT_HANDWRITING_FONT_MODE: HandwritingFontMode =
  Platform.OS === 'ios' ? 'ios-baked' : 'android-native';

export function getHandwritingFontMode(): HandwritingFontMode {
  const value = storage.getString(HANDWRITING_FONT_MODE_KEY);
  return value === 'android-native' || value === 'ios-baked'
    ? value
    : DEFAULT_HANDWRITING_FONT_MODE;
}

export function setHandwritingFontMode(mode: HandwritingFontMode) {
  storage.set(HANDWRITING_FONT_MODE_KEY, mode);
}

export function getNextHandwritingFontMode(
  mode = getHandwritingFontMode(),
): HandwritingFontMode {
  return mode === 'ios-baked' ? 'android-native' : 'ios-baked';
}
