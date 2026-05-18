import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';

export function TagChip({
  label,
  backgroundColor = colors.lavenderMist,
  textColor = colors.primaryDark,
}: {
  label: string;
  backgroundColor?: string;
  textColor?: string;
}) {
  return (
    <View style={[styles.chip, { backgroundColor }]}>
      <Text style={[styles.label, { color: textColor }]}>#{label}</Text>
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
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
