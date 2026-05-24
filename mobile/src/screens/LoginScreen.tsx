import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { loginWithGoogleIdToken } from '../api/auth';
import { getGoogleIdToken } from '../auth/googleSignIn';
import { MoonAvatar } from '../components/MoonAvatar';
import { PaperTextureOverlay } from '../components/PaperTextureOverlay';
import { GOOGLE_WEB_CLIENT_ID } from '../config/env';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';
import { fontFamily } from '../theme/typography';

export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const setSession = useSessionStore(state => state.setSession);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isGoogleConfigured = GOOGLE_WEB_CLIENT_ID.length > 0;

  const login = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const idToken = await getGoogleIdToken();
      const session = await loginWithGoogleIdToken(idToken);
      setSession(session.accessToken, session.user);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : 'Google 로그인에 실패했어요.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: Math.max(insets.top + 48, 96),
          paddingBottom: Math.max(insets.bottom + 36, 72),
        },
      ]}
    >
      <PaperTextureOverlay />
      <View style={styles.brand}>
        <MoonAvatar size={74} color={colors.primary} />
        <Text style={styles.title}>꿈드림</Text>
        <Text style={styles.subtitle}>함께 꿈을 주고받는 방</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>로그인</Text>
        <Text style={styles.panelText}>
          Google 계정으로 로그인하면 이 기기에 세션이 저장되어 다음 실행부터
          바로 들어올 수 있어요.
        </Text>

        <Pressable
          accessibilityRole="button"
          disabled={!isGoogleConfigured || isSubmitting}
          onPress={login}
          style={({ pressed }) => [
            styles.googleButton,
            (!isGoogleConfigured || isSubmitting) && styles.disabledButton,
            pressed &&
              isGoogleConfigured &&
              !isSubmitting &&
              interactionStyles.pressed,
          ]}
        >
          <GoogleLogoMark />
          <Text style={styles.googleButtonText}>
            {isSubmitting ? '로그인 중...' : 'Google로 계속하기'}
          </Text>
        </Pressable>

        {!isGoogleConfigured ? (
          <Text style={styles.setupText}>
            GOOGLE_WEB_CLIENT_ID를 설정하면 Google 로그인이 활성화됩니다.
          </Text>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </View>
  );
}

function GoogleLogoMark() {
  return (
    <Svg width={22} height={22} viewBox="0 0 48 48">
      <Path
        fill="#FFC107"
        d="M43.61 20.08H42V20H24v8h11.3C33.65 32.66 29.22 36 24 36c-6.63 0-12-5.37-12-12s5.37-12 12-12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.27 4 24 4 12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20c0-1.34-.14-2.65-.39-3.92z"
      />
      <Path
        fill="#FF3D00"
        d="m6.31 14.69 6.57 4.82C14.66 15.11 18.96 12 24 12c3.06 0 5.84 1.15 7.96 3.04l5.66-5.66C34.05 6.05 29.27 4 24 4 16.32 4 9.66 8.34 6.31 14.69z"
      />
      <Path
        fill="#4CAF50"
        d="M24 44c5.17 0 9.86-1.98 13.41-5.19l-6.19-5.24C29.14 35.15 26.64 36 24 36c-5.2 0-9.62-3.31-11.28-7.94l-6.52 5.03C9.51 39.56 16.23 44 24 44z"
      />
      <Path
        fill="#1976D2"
        d="M43.61 20.08H42V20H24v8h11.3a12.04 12.04 0 0 1-4.09 5.57l6.19 5.24C36.97 39.2 44 34 44 24c0-1.34-.14-2.65-.39-3.92z"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 96,
    paddingBottom: 36,
    backgroundColor: colors.background,
  },
  brand: {
    gap: 12,
    marginTop: 34,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 42,
    includeFontPadding: false,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontSize: 16,
    fontWeight: '700',
  },
  panel: {
    borderRadius: 28,
    padding: 22,
    gap: 14,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
    marginBottom: 72,
  },
  panelTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 24,
    includeFontPadding: false,
  },
  panelText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  googleButton: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.divider,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.cardBase,
  },
  disabledButton: {
    opacity: 0.48,
  },
  googleButtonText: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 16,
    includeFontPadding: false,
  },
  setupText: {
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    color: colors.error,
    fontFamily: fontFamily.handwritten,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
