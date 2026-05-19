import { Image, StyleSheet, View } from 'react-native';
import { UserRound } from 'lucide-react-native';

import { colors } from '../theme/colors';
import { MoonAvatar } from './MoonAvatar';

export const DEFAULT_PROFILE_AVATAR = 'kkumdream-avatar:app-default';

export const PROFILE_AVATAR_PRESETS = [
  {
    value: 'kkumdream-avatar:google-default',
    label: '기본',
    type: 'google',
    color: colors.textMuted,
  },
  {
    value: DEFAULT_PROFILE_AVATAR,
    label: '새벽달',
    type: 'app',
    color: colors.primary,
  },
  {
    value: 'kkumdream-avatar:app-midnight',
    label: '깊은밤',
    type: 'app',
    color: colors.primaryDark,
  },
  {
    value: 'kkumdream-avatar:app-lavender',
    label: '보랏새벽',
    type: 'app',
    color: colors.primaryLight,
  },
  {
    value: 'kkumdream-avatar:app-sky',
    label: '하늘새벽',
    type: 'app',
    color: colors.outboxAccent,
  },
] as const;

type ProfileAvatarPreset = (typeof PROFILE_AVATAR_PRESETS)[number];

type Props = {
  value?: string | null;
  name?: string | null;
  size?: number;
  fallbackColor?: string;
};

export function normalizeProfileAvatarValue(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed || DEFAULT_PROFILE_AVATAR;
}

export function isRemoteProfileImage(value?: string | null) {
  return /^https?:\/\//i.test(value?.trim() ?? '');
}

export function isProfileImageUri(value?: string | null) {
  return /^(https?|file|content|ph):\/\//i.test(value?.trim() ?? '');
}

export function getProfileAvatarPreset(value?: string | null) {
  const normalized = normalizeProfileAvatarValue(value);
  return PROFILE_AVATAR_PRESETS.find(preset => preset.value === normalized);
}

export function ProfileAvatar({
  value,
  size = 48,
  fallbackColor = colors.primary,
}: Props) {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return <MoonAvatar size={size} color={fallbackColor} />;
  }

  const normalizedValue = normalizeProfileAvatarValue(trimmedValue);
  const preset = getProfileAvatarPreset(normalizedValue);

  if (preset) {
    return <PresetAvatar preset={preset} size={size} />;
  }

  if (isProfileImageUri(normalizedValue)) {
    return (
      <Image
        source={{ uri: normalizedValue }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return <MoonAvatar size={size} color={fallbackColor} />;
}

function PresetAvatar({
  preset,
  size,
}: {
  preset: ProfileAvatarPreset;
  size: number;
}) {
  if (preset.type === 'google') {
    return (
      <View
        style={[
          styles.googleAvatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
      >
        <UserRound
          color={preset.color}
          size={Math.round(size * 0.54)}
          strokeWidth={2.2}
        />
      </View>
    );
  }

  return <MoonAvatar size={size} color={preset.color} />;
}

const styles = StyleSheet.create({
  googleAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderMist,
    borderWidth: 1,
    borderColor: colors.divider,
  },
});
