import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loginWithGoogleIdToken } from '../api/auth';
import { getGoogleIdToken } from '../auth/googleSignIn';
import { MoonAvatar } from '../components/MoonAvatar';
import { GOOGLE_WEB_CLIENT_ID } from '../config/env';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';

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
      <View style={styles.brand}>
        <MoonAvatar size={74} color={colors.primary} />
        <Text style={styles.title}>꿈드림</Text>
        <Text style={styles.subtitle}>함께 꿈을 주고받는 방</Text>
      </View>

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>로그인</Text>
        <Text style={styles.panelText}>
          Google 계정으로 로그인하면 이 기기에 세션이 저장되어 다음 실행부터 바로
          들어올 수 있어요.
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
          <Text style={styles.googleMark}>G</Text>
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
  },
  title: {
    color: colors.textPrimary,
    fontSize: 42,
    fontWeight: '700',
    includeFontPadding: false,
  },
  subtitle: {
    color: colors.textMuted,
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
  },
  panelTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    includeFontPadding: false,
  },
  panelText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  googleButton: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#DADCE0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.48,
  },
  googleMark: {
    color: '#4285F4',
    fontSize: 20,
    fontWeight: '700',
    includeFontPadding: false,
  },
  googleButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },
  setupText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
});
