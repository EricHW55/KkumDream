import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';
import { Plus } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { updateProfile, uploadProfileImage } from '../api/auth';
import { claimDream } from '../api/dreams';
import { signOutGoogle } from '../auth/googleSignIn';
import {
  DEFAULT_PROFILE_AVATAR,
  PROFILE_AVATAR_PRESETS,
  ProfileAvatar,
  normalizeProfileAvatarValue,
} from '../components/ProfileAvatar';
import { Screen } from '../components/Screen';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';
import { unregisterPushToken } from '../services/pushNotifications';
import { fontFamily } from '../theme/typography';

const PROFILE_EDITOR_MAX_HEIGHT = 560;
const PROFILE_EDITOR_COLLAPSED_GAP = -12;

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const user = useSessionStore(state => state.user);
  const userId = useSessionStore(state => state.userId);
  const token = useSessionStore(state => state.token);
  const updateUser = useSessionStore(state => state.updateUser);
  const clearSession = useSessionStore(state => state.clearSession);
  const [nicknameDraft, setNicknameDraft] = useState(user?.nickname ?? '');
  const [profileAvatarValue, setProfileAvatarValue] = useState(
    normalizeProfileAvatarValue(user?.profileImageUrl),
  );
  const [pendingProfileImage, setPendingProfileImage] = useState<Asset | null>(
    null,
  );
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [isProfileEditorMounted, setIsProfileEditorMounted] = useState(false);
  const profileEditorProgress = useRef(new Animated.Value(0)).current;
  const [statusText, setStatusText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [claimToken, setClaimToken] = useState('');
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const avatarOptions = useMemo(() => {
    const isPreset = PROFILE_AVATAR_PRESETS.some(
      option => option.value === profileAvatarValue,
    );
    if (!isPreset && profileAvatarValue) {
      return [
        ...PROFILE_AVATAR_PRESETS,
        {
          value: profileAvatarValue,
          label: '내 사진',
        },
      ];
    }
    return PROFILE_AVATAR_PRESETS;
  }, [profileAvatarValue]);

  useEffect(() => {
    if (isProfileEditorOpen) {
      setIsProfileEditorMounted(true);
    }

    const animation = Animated.timing(profileEditorProgress, {
      toValue: isProfileEditorOpen ? 1 : 0,
      duration: isProfileEditorOpen ? 420 : 320,
      easing: isProfileEditorOpen
        ? Easing.out(Easing.cubic)
        : Easing.in(Easing.cubic),
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished && !isProfileEditorOpen) {
        setIsProfileEditorMounted(false);
      }
    });

    return () => animation.stop();
  }, [isProfileEditorOpen, profileEditorProgress]);

  const toggleProfileEditor = () => {
    setStatusText(null);
    if (isProfileEditorOpen) {
      setNicknameDraft(user?.nickname ?? '');
      setProfileAvatarValue(normalizeProfileAvatarValue(user?.profileImageUrl));
      setPendingProfileImage(null);
    }
    setIsProfileEditorOpen(isOpen => !isOpen);
  };

  const pickProfileImage = async () => {
    setStatusText(null);
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.9,
    });

    if (result.didCancel) {
      return;
    }
    if (result.errorMessage) {
      setStatusText(result.errorMessage);
      return;
    }

    const asset = result.assets?.[0];
    if (!asset?.uri) {
      setStatusText('선택한 이미지를 불러오지 못했어요.');
      return;
    }

    setPendingProfileImage(asset);
    setProfileAvatarValue(asset.uri);
  };

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
      setClaimStatus(
        error instanceof Error ? error.message : '카드를 받지 못했어요.',
      );
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
      let nextProfileImageUrl = profileAvatarValue || DEFAULT_PROFILE_AVATAR;
      if (pendingProfileImage?.uri) {
        const uploadedUser = await uploadProfileImage(
          {
            uri: pendingProfileImage.uri,
            fileName: pendingProfileImage.fileName,
            type: pendingProfileImage.type,
          },
          token,
        );
        nextProfileImageUrl =
          uploadedUser.profileImageUrl ?? DEFAULT_PROFILE_AVATAR;
      }

      const nextUser = await updateProfile(
        {
          nickname,
          profileImageUrl: nextProfileImageUrl,
        },
        token,
      );
      updateUser(nextUser);
      setPendingProfileImage(null);
      setProfileAvatarValue(
        normalizeProfileAvatarValue(nextUser.profileImageUrl),
      );
      setIsProfileEditorOpen(false);
      setStatusText('내 정보를 저장했어요.');
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : '내 정보를 저장하지 못했어요.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 48, 96) },
        ]}
      >
        <Text style={styles.title}>내 정보</Text>
        <View style={styles.panel}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarWrap}>
              <ProfileAvatar
                value={profileAvatarValue}
                name={nicknameDraft || user?.nickname}
                size={64}
              />
            </View>
            <View style={styles.profileText}>
              <Text style={styles.name}>
                {user?.nickname ?? '꿈드림 사용자'}
              </Text>
              <Text style={styles.meta}>
                {user?.email ?? '구글 계정 이메일 없음'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={toggleProfileEditor}
              style={({ pressed }) => [
                styles.editProfileButton,
                pressed && interactionStyles.pressed,
              ]}
            >
              <Text style={styles.editProfileButtonText}>
                {isProfileEditorOpen ? '닫기' : '수정'}
              </Text>
            </Pressable>
          </View>

          {statusText ? (
            <Text style={styles.statusText}>{statusText}</Text>
          ) : null}

          {isProfileEditorMounted ? (
            <Animated.View
              pointerEvents={isProfileEditorOpen ? 'auto' : 'none'}
              style={[
                styles.profileEditorShell,
                {
                  maxHeight: profileEditorProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, PROFILE_EDITOR_MAX_HEIGHT],
                  }),
                  opacity: profileEditorProgress,
                  marginTop: profileEditorProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [PROFILE_EDITOR_COLLAPSED_GAP, 0],
                  }),
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.profileEditor,
                  {
                    transform: [
                      {
                        translateY: profileEditorProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-14, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
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

                <Text style={styles.inputLabel}>프로필 아이콘</Text>
                <View style={styles.avatarOptions}>
                  {avatarOptions.map(option => {
                    const isSelected = option.value === profileAvatarValue;
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => {
                          setPendingProfileImage(null);
                          setProfileAvatarValue(option.value);
                        }}
                        style={({ pressed }) => [
                          styles.avatarOption,
                          isSelected && styles.avatarOptionActive,
                          pressed && interactionStyles.pressedSoft,
                        ]}
                      >
                        <ProfileAvatar
                          value={option.value}
                          name={nicknameDraft || user?.nickname}
                          size={42}
                        />
                        <Text
                          style={[
                            styles.avatarOptionLabel,
                            isSelected && styles.avatarOptionLabelActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="갤러리에서 프로필 이미지 선택"
                    onPress={pickProfileImage}
                    style={({ pressed }) => [
                      styles.avatarOption,
                      styles.uploadAvatarOption,
                      pressed && interactionStyles.pressedSoft,
                    ]}
                  >
                    <View style={styles.uploadAvatarIcon}>
                      <Plus
                        color={colors.primary}
                        size={24}
                        strokeWidth={2.5}
                      />
                    </View>
                    <Text style={styles.avatarOptionLabel}>사진 추가</Text>
                  </Pressable>
                </View>

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
                  <Text style={styles.saveText}>
                    {isSaving ? '저장 중...' : '저장'}
                  </Text>
                </Pressable>
              </Animated.View>
            </Animated.View>
          ) : null}
        </View>
        <View style={styles.panel}>
          <Text style={styles.sectionHeading}>꿈카드 받기</Text>
          <Text style={styles.sectionDescription}>
            누군가 카톡 등으로 보낸 꿈카드 링크를 여기에 붙여넣으면 받은
            카드함에 담을 수 있어요.
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
          {claimStatus ? (
            <Text style={styles.statusText}>{claimStatus}</Text>
          ) : null}
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
            <Text style={styles.saveText}>
              {isClaiming ? '받는 중...' : '카드 받기'}
            </Text>
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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
  },
  title: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 24,
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
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 16,
    includeFontPadding: false,
  },
  sectionDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '600',
    fontSize: 13,
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
  profileText: {
    flex: 1,
  },
  name: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 18,
  },
  meta: {
    marginTop: 6,
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontSize: 14,
  },
  editProfileButton: {
    minWidth: 54,
    minHeight: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: colors.lavenderMist,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  editProfileButtonText: {
    color: colors.primaryDark,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 13,
    includeFontPadding: false,
  },
  profileEditorShell: {
    overflow: 'hidden',
  },
  profileEditor: {
    gap: 12,
  },
  inputLabel: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 14,
    includeFontPadding: false,
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    paddingHorizontal: 14,
    fontWeight: '700',
    fontSize: 16,
  },
  avatarOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  avatarOption: {
    width: '30%',
    minHeight: 80,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  avatarOptionActive: {
    backgroundColor: colors.lavenderMist,
    borderColor: colors.primary,
  },
  uploadAvatarOption: {
    borderStyle: 'dashed',
  },
  uploadAvatarIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderMist,
  },
  avatarOptionLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 10,
    includeFontPadding: false,
  },
  avatarOptionLabelActive: {
    color: colors.primaryDark,
  },
  statusText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 13,
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
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 15,
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
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 16,
    includeFontPadding: false,
  },
});
