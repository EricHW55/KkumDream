import { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { updateProfile } from '../api/auth';
import { claimDream } from '../api/dreams';
import { signOutGoogle } from '../auth/googleSignIn';
import { MoonAvatar } from '../components/MoonAvatar';
import { Screen } from '../components/Screen';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';
import { unregisterPushToken } from '../services/pushNotifications';

export function ProfileScreen() {
  const queryClient = useQueryClient();
  const user = useSessionStore(state => state.user);
  const userId = useSessionStore(state => state.userId);
  const token = useSessionStore(state => state.token);
  const updateUser = useSessionStore(state => state.updateUser);
  const clearSession = useSessionStore(state => state.clearSession);
  const [nicknameDraft, setNicknameDraft] = useState(user?.nickname ?? '');
  const [profileImageDraft, setProfileImageDraft] = useState(
    user?.profileImageUrl ?? '',
  );
  const [statusText, setStatusText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [claimToken, setClaimToken] = useState('');
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);

  const submitClaim = async () => {
    if (!token) {
      setClaimStatus('로그인이 필요합니다.');
      return;
    }
    const trimmed = claimToken.trim();
    if (!trimmed) {
      setClaimStatus('받은 링크의 토큰을 입력하세요.');
      return;
    }

    let parsed = trimmed;
    const claimMatch = trimmed.match(/[?&]claim=([^&\s]+)/);
    if (claimMatch) {
      parsed = decodeURIComponent(claimMatch[1]);
    }

    setClaimStatus(null);
    setIsClaiming(true);
    try {
      const dream = await claimDream(parsed, token);
      queryClient.invalidateQueries({ queryKey: ['dreams', 'inbox', userId] });
      setClaimToken('');
      setClaimStatus(`"${dream.title}" 카드를 받은 카드함에 담았어요.`);
    } catch (error) {
      setClaimStatus(error instanceof Error ? error.message : '카드를 받지 못했어요.');
    } finally {
      setIsClaiming(false);
    }
  };

  const logout = async () => {
    if (token) {
      await unregisterPushToken(token);
    }
    await signOutGoogle();
    clearSession();
  };

  const saveProfile = async () => {
    if (!token) {
      setStatusText('로그인이 필요합니다.');
      return;
    }
    const nickname = nicknameDraft.trim();
    if (!nickname) {
      setStatusText('이름을 입력하세요.');
      return;
    }

    setStatusText(null);
    setIsSaving(true);
    try {
      const nextUser = await updateProfile(
        {
          nickname,
          profileImageUrl: profileImageDraft.trim() || null,
        },
        token,
      );
      updateUser(nextUser);
      setStatusText('내 정보를 저장했어요.');
    } catch (error) {
      setStatusText(error instanceof Error ? error.message : '내 정보를 저장하지 못했어요.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.title}>내 정보</Text>
      <View style={styles.panel}>
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            {profileImageDraft.trim() ? (
              <Image
                source={{ uri: profileImageDraft.trim() }}
                style={styles.avatarImage}
              />
            ) : (
              <MoonAvatar size={64} color={colors.primary} />
            )}
          </View>
          <View style={styles.profileText}>
            <Text style={styles.name}>{user?.nickname ?? '꿈드림 사용자'}</Text>
            <Text style={styles.meta}>
              {user?.email ?? '구글 계정 이메일 없음'}
            </Text>
          </View>
        </View>

        <Text style={styles.inputLabel}>이름</Text>
        <TextInput
          autoCorrect={false}
          spellCheck={false}
          defaultValue={nicknameDraft}
          onChangeText={setNicknameDraft}
          placeholder="이름"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />

        <Text style={styles.inputLabel}>프로필 사진 URL</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          defaultValue={profileImageDraft}
          onChangeText={setProfileImageDraft}
          placeholder="https://..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />

        {statusText ? <Text style={styles.statusText}>{statusText}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSaving}
          onPress={saveProfile}
          style={({ pressed }) => [
            styles.saveButton,
            isSaving && styles.disabledButton,
            pressed && !isSaving && interactionStyles.pressed,
          ]}
        >
          <Text style={styles.saveText}>{isSaving ? '저장 중...' : '저장'}</Text>
        </Pressable>
      </View>
      <View style={styles.panel}>
        <Text style={styles.sectionHeading}>꿈카드 받기</Text>
        <Text style={styles.sectionDescription}>
          누군가 카톡 등으로 보낸 꿈카드 링크를 여기에 붙여넣으면 받은 카드함에 담을 수 있어요.
        </Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          value={claimToken}
          onChangeText={setClaimToken}
          placeholder="https://kkumdream.app/d/...?claim=... 또는 토큰"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        {claimStatus ? <Text style={styles.statusText}>{claimStatus}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={isClaiming}
          onPress={submitClaim}
          style={({ pressed }) => [
            styles.saveButton,
            isClaiming && styles.disabledButton,
            pressed && !isClaiming && interactionStyles.pressed,
          ]}
        >
          <Text style={styles.saveText}>{isClaiming ? '받는 중...' : '카드 받기'}</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={logout}
        style={({ pressed }) => [
          styles.logoutButton,
          pressed && interactionStyles.pressed,
        ]}
      >
        <Text style={styles.logoutText}>로그아웃</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 18,
  },
  panel: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
    gap: 12,
    marginBottom: 14,
  },
  sectionHeading: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },
  sectionDescription: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 4,
  },
  avatarWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.lavenderMist,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileText: {
    flex: 1,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  meta: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 14,
  },
  inputLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    includeFontPadding: false,
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '700',
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  disabledButton: {
    opacity: 0.45,
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    includeFontPadding: false,
  },
  logoutButton: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    backgroundColor: colors.primary,
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
