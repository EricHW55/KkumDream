import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';

export function Screen({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.root, { paddingTop: insets.top + 12 }]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
});

