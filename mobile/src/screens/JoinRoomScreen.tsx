import { useEffect, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2 } from 'lucide-react-native';

import { loginWithGoogleIdToken } from '../api/auth';
import { getGoogleIdToken } from '../auth/googleSignIn';
import { MoonAvatar } from '../components/MoonAvatar';
import { PaperTextureOverlay } from '../components/PaperTextureOverlay';
import { joinGroupRoom } from '../data/dreamRepository';
import type { RootStackParamList } from '../navigation/types';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';
import { fontFamily } from '../theme/typography';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinRoom'>;

export function JoinRoomScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const token = useSessionStore(state => state.token);
  const userId = useSessionStore(state => state.userId);
  const setSession = useSessionStore(state => state.setSession);
  const inviteCode = useMemo(
    () => normalizeInviteCode(route.params?.inviteCode),
    [route.params?.inviteCode],
  );
  const [statusText, setStatusText] = useState('꿈방을 확인하는 중이에요.');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [joinedRoomName, setJoinedRoomName] = useState<string | null>(null);
  const [hasAttemptedJoin, setHasAttemptedJoin] = useState(false);

  useEffect(() => {
    if (!inviteCode || !token || joinedRoomName || hasAttemptedJoin) {
      return;
    }

    let cancelled = false;
    const run = async () => {
      setHasAttemptedJoin(true);
      setIsJoining(true);
      setErrorText(null);
      setStatusText('꿈방에 참가하는 중이에요.');
      try {
        const room = await joinGroupRoom(inviteCode, token, userId);
        if (cancelled) {
          return;
        }
        setJoinedRoomName(room.name);
        setStatusText(`"${room.name}" 꿈방에 참가했어요.`);
        queryClient.invalidateQueries({ queryKey: ['rooms', userId] });
        navigation.reset({
          index: 1,
          routes: [
            { name: 'MainTabs' },
            {
              name: 'GroupRoom',
              params: {
                groupId: room.id,
                groupName: room.name,
                description: room.description,
              },
            },
          ],
        });
      } catch (error) {
        if (!cancelled) {
          setErrorText(
            error instanceof Error
              ? error.message
              : '꿈방에 참가하지 못했어요.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsJoining(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    hasAttemptedJoin,
    inviteCode,
    joinedRoomName,
    navigation,
    queryClient,
    token,
    userId,
  ]);

  const login = async () => {
    setErrorText(null);
    setIsLoggingIn(true);
    try {
      const idToken = await getGoogleIdToken();
      const session = await loginWithGoogleIdToken(idToken);
      setSession(session.accessToken, session.user);
    } catch (error) {
      setErrorText(
        error instanceof Error ? error.message : 'Google 로그인에 실패했어요.',
      );
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
    <View
      style={[
        styles.root,
        {
          paddingTop: Math.max(insets.top + 24, 48),
          paddingBottom: Math.max(insets.bottom + 24, 72),
        },
      ]}
    >
      <PaperTextureOverlay />
      <View style={styles.panel}>
        <MoonAvatar size={70} color={colors.primary} />
        <Text style={styles.title}>꿈방 참가</Text>
        {!inviteCode ? (
          <Text style={styles.description}>
            링크에 초대 코드가 없어요. 공유받은 링크를 다시 확인해주세요.
          </Text>
        ) : token ? (
          <View style={styles.statusRow}>
            {joinedRoomName ? (
              <CheckCircle2 color={colors.primary} size={22} />
            ) : (
              <Loader2 color={colors.primary} size={22} />
            )}
            <Text style={styles.description}>{statusText}</Text>
          </View>
        ) : (
          <Text style={styles.description}>
            로그인하면 초대받은 꿈방에 바로 참가할 수 있어요.
          </Text>
        )}
        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        {!token && inviteCode ? (
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
              {isLoggingIn ? '로그인 중...' : 'Google로 로그인하고 참가'}
            </Text>
          </Pressable>
        ) : null}
        {token && inviteCode && errorText ? (
          <Pressable
            accessibilityRole="button"
            disabled={isJoining}
            onPress={() => setHasAttemptedJoin(false)}
            style={({ pressed }) => [
              styles.primaryButton,
              isJoining && styles.disabledButton,
              pressed && !isJoining && interactionStyles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>
              {isJoining ? '참가 중...' : '다시 참가하기'}
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

function normalizeInviteCode(value?: string | null) {
  return typeof value === 'string' && value.trim()
    ? value.trim().toUpperCase()
    : null;
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
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 26,
    includeFontPadding: false,
  },
  description: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
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
    fontFamily: fontFamily.handwritten,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
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
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 16,
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
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 14,
    includeFontPadding: false,
  },
  disabledButton: {
    opacity: 0.5,
  },
});
