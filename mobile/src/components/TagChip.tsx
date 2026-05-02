import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

export function TagChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.label}>#{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 28,
    borderRadius: 999,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderMist,
  },
  label: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '600',
  },
});

