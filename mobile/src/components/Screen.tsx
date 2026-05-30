import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { PaperTextureOverlay } from './PaperTextureOverlay';

export function Screen({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: insets.top + 12,
          // No bottom padding: these screens sit directly above the tab bar,
          // which already provides the bottom safe-area spacing. Any padding
          // here shows as a white gap above the tab bar's rounded top edge.
          paddingBottom: 0,
        },
      ]}
    >
      <PaperTextureOverlay />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 20,
  },
});
