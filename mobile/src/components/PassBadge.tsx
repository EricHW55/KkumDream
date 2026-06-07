import { Image, StyleSheet, Text, View } from 'react-native';

import passBadgeImage from '../assets/badges/pass_badge.webp';
import { colors } from '../theme/colors';
import { fontFamily } from '../theme/typography';

type PassBadgeProps = {
  compact?: boolean;
  label?: string;
  opacity?: number;
  size?: number;
};

export function PassBadge({
  compact = false,
  label = '패스',
  opacity = 0.99,
  size,
}: PassBadgeProps) {
  const iconSize = size ?? (compact ? 34 : 38);

  return (
    <View style={[styles.badge, compact && styles.badgeCompact]}>
      <Image
        accessibilityIgnoresInvertColors
        source={passBadgeImage}
        style={[
          styles.icon,
          {
            width: iconSize,
            height: iconSize,
            opacity,
          },
        ]}
      />
      {!compact ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minHeight: 32,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 3,
    paddingLeft: 3,
    paddingRight: 10,
    backgroundColor: '#FFF7C7',
    borderWidth: 1,
    borderColor: 'rgba(211, 176, 75, 0.48)',
  },
  badgeCompact: {
    minHeight: 24,
    paddingVertical: 1,
    paddingLeft: 1,
    paddingRight: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  icon: {
    resizeMode: 'contain',
  },
  label: {
    color: colors.primaryDark,
    fontFamily: fontFamily.handwritten,
    fontSize: 12,
    fontWeight: '900',
    includeFontPadding: false,
  },
});
