import type { ViewStyle } from 'react-native';

export const interactionStyles = {
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  pressedSoft: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
} satisfies Record<string, ViewStyle>;
