import { useState } from 'react';
import { DevSettings, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getHandwritingFontMode,
  getNextHandwritingFontMode,
  setHandwritingFontMode,
  type HandwritingFontMode,
} from '../data/fontMode';
import { colors } from '../theme/colors';

const SHOW_FONT_MODE_TOGGLE = true;

export function FontModeFloatingToggle() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<HandwritingFontMode>(() =>
    getHandwritingFontMode(),
  );

  if (!SHOW_FONT_MODE_TOGGLE) {
    return null;
  }

  const nextMode = getNextHandwritingFontMode(mode);

  const toggleMode = () => {
    setHandwritingFontMode(nextMode);
    setMode(nextMode);
    setTimeout(() => {
      const reload = (DevSettings as unknown as { reload?: () => void }).reload;
      reload?.();
    }, 80);
  };

  return (
    <Pressable
      accessibilityLabel="Toggle handwriting font mode"
      accessibilityRole="button"
      onPress={toggleMode}
      style={[
        styles.toggle,
        { bottom: Math.max(insets.bottom + 92, 112) },
      ]}
    >
      <Text style={styles.modeText}>
        {mode === 'ios-baked' ? 'iOS baked' : 'Android weight'}
      </Text>
      <Text style={styles.hintText}>tap to switch</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: {
    position: 'absolute',
    right: 12,
    zIndex: 1000,
    elevation: 12,
    minWidth: 96,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.lavenderTint,
    backgroundColor: 'rgba(255, 253, 247, 0.96)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#2A233F',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  modeText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '800',
  },
  hintText: {
    marginTop: 2,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
});
