import { useEffect, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react-native';

import { loginWithGoogleIdToken } from '../api/auth';
import { claimDream } from '../api/dreams';
import { getGoogleIdToken } from '../auth/googleSignIn';
import { MoonAvatar } from '../components/MoonAvatar';
import type { RootStackParamList } from '../navigation/types';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';

type Props = NativeStackScreenProps<RootStackParamList, 'ClaimDream'>;

export function ClaimDreamScreen({ navigation, route }: Props) {
  const queryClient = useQueryClient();
  const token = useSessionStore(state => state.token);
  const userId = useSessionStore(state => state.userId);
  const setSession = useSessionStore(state => state.setSession);
  const claimToken = useMemo(() => extractClaimToken(route.params), [route.params]);
  const [statusText, setStatusText] = useState('꿈카드를 확인하는 중이에요.');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [claimedDreamId, setClaimedDreamId] = useState<string | null>(null);
  const [hasAttemptedClaim, setHasAttemptedClaim] = useState(false);

  useEffect(() => {
    if (!claimToken || !token || claimedDreamId || hasAttemptedClaim) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      setHasAttemptedClaim(true);
      setIsClaiming(true);
      setErrorText(null);
      setStatusText('꿈카드를 받은 카드함에 담는 중이에요.');
      try {
        const dream = await claimDream(claimToken, token);
        if (cancelled) {
          return;
        }
        setClaimedDreamId(dream.id);
        setStatusText('꿈카드를 받았어요.');
        queryClient.invalidateQueries({ queryKey: ['dreams', 'inbox', userId] });
        navigation.replace('DreamDetail', { dream });
      } catch (error) {
        if (!cancelled) {
          setErrorText(error instanceof Error ? error.message : '꿈카드를 받지 못했어요.');
        }
      } finally {
        if (!cancelled) {
          setIsClaiming(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [claimToken, claimedDreamId, hasAttemptedClaim, navigation, queryClient, token, userId]);

  const login = async () => {
    setErrorText(null);
    setIsLoggingIn(true);
    try {
      const idToken = await getGoogleIdToken();
      const session = await loginWithGoogleIdToken(idToken);
      setSession(session.accessToken, session.user);
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Google 로그인에 실패했어요.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const goHome = () => {
    if (token) {
      navigation.replace('MainTabs');
      return;
    }
    navigation.replace('Login');
  };

  return (
    <View style={styles.root}>
      <View style={styles.panel}>
        <MoonAvatar size={70} color={colors.primary} />
        <Text style={styles.title}>꿈카드 받기</Text>
        {!claimToken ? (
          <Text style={styles.description}>
            링크에 카드 받기 토큰이 없어요. 공유받은 링크를 다시 확인해주세요.
          </Text>
        ) : token ? (
          <View style={styles.statusRow}>
            {claimedDreamId ? (
              <CheckCircle2 color={colors.primary} size={22} />
            ) : (
              <Loader2 color={colors.primary} size={22} />
            )}
            <Text style={styles.description}>{statusText}</Text>
          </View>
        ) : (
          <Text style={styles.description}>
            로그인하면 공유받은 꿈카드가 자동으로 받은 카드함에 담겨요.
          </Text>
        )}
        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        {!token && claimToken ? (
          <Pressable
            accessibilityRole="button"
            disabled={isLoggingIn}
            onPress={login}
            style={({ pressed }) => [
              styles.primaryButton,
              isLoggingIn && styles.disabledButton,
              pressed && !isLoggingIn && interactionStyles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isLoggingIn ? '로그인 중...' : 'Google로 로그인하고 받기'}
            </Text>
          </Pressable>
        ) : null}
        {token && claimToken && errorText ? (
          <Pressable
            accessibilityRole="button"
            disabled={isClaiming}
            onPress={() => setHasAttemptedClaim(false)}
            style={({ pressed }) => [
              styles.primaryButton,
              isClaiming && styles.disabledButton,
              pressed && !isClaiming && interactionStyles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isClaiming ? '받는 중...' : '다시 받기'}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={goHome}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && interactionStyles.pressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>홈으로</Text>
        </Pressable>
      </View>
    </View>
  );
}

function extractClaimToken(params: RootStackParamList['ClaimDream']) {
  const value = params?.claim ?? params?.token;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  panel: {
    borderRadius: 28,
    padding: 24,
    gap: 16,
    alignItems: 'center',
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    includeFontPadding: false,
  },
  description: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  errorText: {
    color: colors.error,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  primaryButton: {
    width: '100%',
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },
  secondaryButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderMist,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    includeFontPadding: false,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
