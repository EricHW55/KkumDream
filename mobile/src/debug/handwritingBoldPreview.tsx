/**
 * TEMP preview tooling — DELETE once Android is switched to the baked fonts too.
 *
 * Forces Android to use the iOS path (baked Bold font) so the two can be A/B'd
 * on one device. The weight→font choice is resolved at StyleSheet build time,
 * so the flag is persisted in MMKV (read synchronously at startup) and the
 * floating button flips it and reloads the JS bundle.
 *
 * To remove: delete this file, the `<HandwritingBoldPreviewToggle />` in
 * App.tsx, and the `|| isHandwritingFakeBoldForced()` branch in
 * theme/typography.ts.
 */
import { createMMKV } from 'react-native-mmkv';
import {
  DevSettings,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const storage = createMMKV({ id: 'kkumdream-debug' });
const KEY = 'forceHandwritingBakedBold';

// Read once at module load so StyleSheet.create() sees a stable value.
let forced = storage.getBoolean(KEY) ?? false;

export function isHandwritingFakeBoldForced(): boolean {
  return forced;
}

function toggleAndReload() {
  forced = !forced;
  storage.set(KEY, forced);
  DevSettings.reload();
}

export function HandwritingBoldPreviewToggle() {
  if (!__DEV__ || Platform.OS !== 'android') {
    return null;
  }

  const on = forced;
  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        onPress={toggleAndReload}
        style={[styles.button, on ? styles.buttonOn : styles.buttonOff]}
      >
        <Text style={styles.mode}>{on ? 'iOS (baked)' : '기존 Android'}</Text>
        <Text style={styles.hint}>탭 → 전환·리로드</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 14,
    bottom: 90,
    zIndex: 9999,
    elevation: 9999,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  buttonOn: {
    backgroundColor: '#1F1E1B',
    borderColor: '#1F1E1B',
  },
  buttonOff: {
    backgroundColor: '#FFFFFF',
    borderColor: '#1F1E1B',
  },
  mode: {
    color: '#8B7BC8',
    fontSize: 13,
    fontWeight: '700',
  },
  hint: {
    color: '#9A8E80',
    fontSize: 10,
    marginTop: 2,
  },
});
