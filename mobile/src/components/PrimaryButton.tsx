import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';
import { handwritingFont } from '../theme/typography';

type Props = PropsWithChildren<{
  onPress: () => void;
  disabled?: boolean;
}>;

export function PrimaryButton({ children, disabled, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && interactionStyles.pressed,
      ]}
    >
      <Text style={styles.label}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 18,
    backgroundColor: colors.lavenderTint,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#D8CDBB',
    shadowColor: '#42321E',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  disabled: {
    backgroundColor: '#E4DDD1',
    opacity: 0.7,
  },
  label: {
    color: colors.primary,
    ...handwritingFont('700'),
    fontSize: 16,
  },
});
