import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { launchImageLibrary, type Asset } from 'react-native-image-picker';
import {
  ExternalLink,
  Plus,
  RefreshCw,
  Settings,
  UserX,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteAccount, updateProfile, uploadProfileImage } from '../api/auth';
import { getPlatformPassProductId } from '../api/billing';
import { claimDream } from '../api/dreams';
import { fetchBlockedUsers, unblockUser } from '../api/safety';
import { signOutGoogle } from '../auth/googleSignIn';
import { useConfirmDialog } from '../components/ConfirmDialog';
import {
  DEFAULT_PROFILE_AVATAR,
  PROFILE_AVATAR_PRESETS,
  ProfileAvatar,
  normalizeProfileAvatarValue,
} from '../components/ProfileAvatar';
import { Screen } from '../components/Screen';
import { ANDROID_PACKAGE_NAME } from '../config/env';
import { useEntitlement, usePassInfo } from '../hooks/usePass';
import { usePassPurchaseRecovery } from '../hooks/usePassPurchaseRecovery';
import { useSessionStore } from '../store/sessionStore';
import {
  isAnyPushEnabled,
  useSettingsStore,
  type ArchiveColumns,
  type PushNotificationType,
} from '../store/settingsStore';
import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';
import {
  registerPushToken,
  unregisterPushToken,
} from '../services/pushNotifications';
import { fontFamily } from '../theme/typography';

const PROFILE_EDITOR_MAX_HEIGHT = 560;
const PROFILE_EDITOR_COLLAPSED_GAP = -12;
const SETTINGS_PANEL_MAX_HEIGHT = 620;
const SETTINGS_PANEL_COLLAPSED_GAP = -12;
const BLOCK_PANEL_MAX_HEIGHT = 520;
const BLOCK_PANEL_COLLAPSED_GAP = -12;

const PUSH_NOTIFICATION_ITEMS: {
  type: PushNotificationType;
  label: string;
}[] = [
  { type: 'dream_given', label: '새 꿈카드가 도착했을 때' },
  { type: 'dream_ready', label: '내가 보낸 꿈의 이미지가 완성됐을 때' },
  { type: 'dream_comment', label: '받은 꿈카드에 댓글이 달렸을 때' },
  { type: 'owner_comment', label: '꿈 주인이 댓글에 답을 남겼을 때' },
  { type: 'dream_claimed', label: '공유한 꿈카드를 상대가 받았을 때' },
];

const CARD_SIZE_OPTIONS: {
  columns: ArchiveColumns;
  label: string;
  hint: string;
}[] = [
  { columns: 4, label: '작게', hint: '한 번에 더 많이' },
  { columns: 3, label: '보통', hint: '기본 크기' },
  { columns: 2, label: '크게', hint: '카드를 큼직하게' },
];

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirmDialog();
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsMounted, setIsSettingsMounted] = useState(false);
  const settingsProgress = useRef(new Animated.Value(0)).current;
  const [isBlockListOpen, setIsBlockListOpen] = useState(false);
  const [isBlockListMounted, setIsBlockListMounted] = useState(false);
  const blockListProgress = useRef(new Animated.Value(0)).current;
  const [blockSearch, setBlockSearch] = useState('');
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const pushPreferences = useSettingsStore(state => state.pushPreferences);
  const setPushPreference = useSettingsStore(state => state.setPushPreference);
  const archiveColumns = useSettingsStore(state => state.archiveColumns);
  const setArchiveColumns = useSettingsStore(state => state.setArchiveColumns);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [claimToken, setClaimToken] = useState('');
  const [claimStatus, setClaimStatus] = useState<string | null>(null);
  const [isClaiming, setIsClaiming] = useState(false);
  const { data: passInfo } = usePassInfo();
  const { data: entitlement } = useEntitlement();
  const recoverPassPurchases = usePassPurchaseRecovery();
  const [passStatus, setPassStatus] = useState<string | null>(null);
  const [isRestoringPass, setIsRestoringPass] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
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

  const { data: blockedUsers = [] } = useQuery({
    queryKey: ['safety', 'blocks', token],
    queryFn: () => fetchBlockedUsers(token ?? ''),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
  });
  const filteredBlockedUsers = useMemo(() => {
    const keyword = blockSearch.trim().toLowerCase();
    if (!keyword) {
      return blockedUsers;
    }
    return blockedUsers.filter(item =>
      (item.blockedUserNickname ?? '').toLowerCase().includes(keyword),
    );
  }, [blockedUsers, blockSearch]);

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

  useEffect(() => {
    if (isSettingsOpen) {
      setIsSettingsMounted(true);
    }

    const animation = Animated.timing(settingsProgress, {
      toValue: isSettingsOpen ? 1 : 0,
      duration: isSettingsOpen ? 420 : 320,
      easing: isSettingsOpen
        ? Easing.out(Easing.cubic)
        : Easing.in(Easing.cubic),
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished && !isSettingsOpen) {
        setIsSettingsMounted(false);
      }
    });

    return () => animation.stop();
  }, [isSettingsOpen, settingsProgress]);

  const toggleSettings = () => {
    setIsSettingsOpen(isOpen => !isOpen);
  };

  useEffect(() => {
    if (isBlockListOpen) {
      setIsBlockListMounted(true);
    }

    const animation = Animated.timing(blockListProgress, {
      toValue: isBlockListOpen ? 1 : 0,
      duration: isBlockListOpen ? 420 : 320,
      easing: isBlockListOpen
        ? Easing.out(Easing.cubic)
        : Easing.in(Easing.cubic),
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished && !isBlockListOpen) {
        setIsBlockListMounted(false);
      }
    });

    return () => animation.stop();
  }, [isBlockListOpen, blockListProgress]);

  const toggleBlockList = () => {
    if (isBlockListOpen) {
      setBlockSearch('');
    }
    setIsBlockListOpen(isOpen => !isOpen);
  };

  const handleUnblock = async (blockedUserId: string, nickname: string) => {
    if (!token) {
      return;
    }
    const ok = await confirm({
      title: '차단을 해제할까요?',
      message: `${nickname}님의 차단을 해제하면 서로의 꿈카드와 댓글을 다시 볼 수 있어요.`,
      confirmText: '차단 해제',
    });
    if (!ok) {
      return;
    }
    setUnblockingId(blockedUserId);
    try {
      await unblockUser(blockedUserId, token);
      await queryClient.invalidateQueries({ queryKey: ['safety', 'blocks'] });
      await queryClient.invalidateQueries({ queryKey: ['dreams'] });
    } catch {
      // Leave the entry in place; the user can retry.
    } finally {
      setUnblockingId(null);
    }
  };

  const handleTogglePush = (type: PushNotificationType, next: boolean) => {
    const hadAnyEnabled = isAnyPushEnabled(pushPreferences);
    const willHaveAnyEnabled = isAnyPushEnabled({
      ...pushPreferences,
      [type]: next,
    });
    setPushPreference(type, next);
    if (!token) {
      return;
    }
    // Only flip the device token at the on/off boundary; per-type prefs are
    // remembered locally.
    if (willHaveAnyEnabled && !hadAnyEnabled) {
      registerPushToken(token).catch(() => undefined);
    } else if (!willHaveAnyEnabled && hadAnyEnabled) {
      unregisterPushToken(token).catch(() => undefined);
    }
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

  const deleteAccountConfirmed = async () => {
    if (!token) {
      setStatusText('로그인이 필요합니다.');
      return;
    }

    setIsDeletingAccount(true);
    setStatusText(null);
    try {
      await deleteAccount(token);
      await signOutGoogle();
      queryClient.clear();
      clearSession();
    } catch (error) {
      setStatusText(
        error instanceof Error ? error.message : '계정을 삭제하지 못했어요.',
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const confirmDeleteAccount = async () => {
    const ok = await confirm({
      title: '계정을 삭제할까요?',
      message:
        '계정 정보와 로그인 정보는 삭제 또는 익명화되고, 이미 전달된 꿈카드의 FROM/TO 표시명은 카드 기록의 일부로 남을 수 있어요.',
      confirmText: '삭제',
      tone: 'danger',
    });
    if (ok) {
      await deleteAccountConfirmed();
    }
  };

  const restorePass = async () => {
    setPassStatus(null);
    setIsRestoringPass(true);
    try {
      const restored = await recoverPassPurchases();
      setPassStatus(
        restored > 0
          ? '패스 구매 내역을 복원했어요.'
          : '복원할 활성 패스 구매 내역이 없어요.',
      );
    } catch (error) {
      setPassStatus(
        error instanceof Error ? error.message : '패스 구매 내역을 복원하지 못했어요.',
      );
    } finally {
      setIsRestoringPass(false);
    }
  };

  const openSubscriptionManagement = async () => {
    const productId = getPlatformPassProductId(passInfo);
    const url =
      Platform.OS === 'android' && productId
        ? `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(
            productId,
          )}&package=${encodeURIComponent(ANDROID_PACKAGE_NAME)}`
        : 'https://apps.apple.com/account/subscriptions';
    await Linking.openURL(url);
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

        <View style={styles.panel}>
          <Text style={styles.sectionHeading}>꿈드림 패스</Text>
          <Text style={styles.sectionDescription}>
            {entitlement?.active
              ? '패스가 활성화되어 있어요. 구독 취소 후에도 남은 기간까지 사용할 수 있어요.'
              : '구매했는데 패스가 보이지 않으면 구매 내역을 복원하세요.'}
          </Text>
          {passStatus ? <Text style={styles.statusText}>{passStatus}</Text> : null}
          <View style={styles.passActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isRestoringPass}
              onPress={restorePass}
              style={({ pressed }) => [
                styles.passActionButton,
                isRestoringPass && styles.disabledButton,
                pressed && !isRestoringPass && interactionStyles.pressedSoft,
              ]}
            >
              <RefreshCw color={colors.primaryDark} size={18} strokeWidth={2.3} />
              <Text style={styles.passActionText}>
                {isRestoringPass ? '복원 중...' : '구매 복원'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={openSubscriptionManagement}
              style={({ pressed }) => [
                styles.passActionButton,
                pressed && interactionStyles.pressedSoft,
              ]}
            >
              <ExternalLink color={colors.primaryDark} size={18} strokeWidth={2.3} />
              <Text style={styles.passActionText}>구독 관리</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionDescription}>
            환불이나 취소는 스토어 구독 관리 화면에서 처리됩니다. 환불이 승인되면
            서버가 알림을 받아 패스 권한을 회수합니다.
          </Text>
        </View>

        <View style={styles.panel}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: isSettingsOpen }}
            onPress={toggleSettings}
            style={({ pressed }) => [
              styles.settingsHeader,
              pressed && interactionStyles.pressedSoft,
            ]}
          >
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: settingsProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '35deg'],
                    }),
                  },
                ],
              }}
            >
              <Settings color={colors.primaryDark} size={24} strokeWidth={2.2} />
            </Animated.View>
            <Text style={styles.settingsHeaderTitle}>설정</Text>
          </Pressable>

          {isSettingsMounted ? (
            <Animated.View
              pointerEvents={isSettingsOpen ? 'auto' : 'none'}
              style={[
                styles.settingsShell,
                {
                  maxHeight: settingsProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, SETTINGS_PANEL_MAX_HEIGHT],
                  }),
                  opacity: settingsProgress,
                  marginTop: settingsProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [SETTINGS_PANEL_COLLAPSED_GAP, 0],
                  }),
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.settingsBody,
                  {
                    transform: [
                      {
                        translateY: settingsProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-14, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.settingsGroup}>
                  <Text style={styles.settingsItemTitle}>푸시 알림</Text>
                  <Text style={styles.settingsItemDescription}>
                    받고 싶은 알림만 켜 두세요.
                  </Text>
                  <View style={styles.pushItemList}>
                    {PUSH_NOTIFICATION_ITEMS.map(item => (
                      <View key={item.type} style={styles.pushItemRow}>
                        <Text style={styles.pushItemLabel}>{item.label}</Text>
                        <Switch
                          value={pushPreferences[item.type]}
                          onValueChange={next => handleTogglePush(item.type, next)}
                          thumbColor="#FFFFFF"
                          trackColor={{
                            false: colors.divider,
                            true: colors.primary,
                          }}
                        />
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.settingsDivider} />

                <View style={styles.settingsGroup}>
                  <Text style={styles.settingsItemTitle}>카드 크기</Text>
                  <Text style={styles.settingsItemDescription}>
                    받은 꿈·보낸 꿈 목록에서 보이는 꿈카드 크기예요.
                  </Text>
                  <View style={styles.cardSizeOptions}>
                    {CARD_SIZE_OPTIONS.map(option => {
                      const isSelected = option.columns === archiveColumns;
                      return (
                        <Pressable
                          key={option.columns}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          onPress={() => setArchiveColumns(option.columns)}
                          style={({ pressed }) => [
                            styles.cardSizeOption,
                            isSelected && styles.cardSizeOptionActive,
                            pressed && interactionStyles.pressedSoft,
                          ]}
                        >
                          <Text
                            style={[
                              styles.cardSizeLabel,
                              isSelected && styles.cardSizeLabelActive,
                            ]}
                          >
                            {option.label}
                          </Text>
                          <Text
                            style={[
                              styles.cardSizeHint,
                              isSelected && styles.cardSizeHintActive,
                            ]}
                          >
                            {option.hint}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </Animated.View>
            </Animated.View>
          ) : null}
        </View>

        <View style={styles.panel}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: isBlockListOpen }}
            onPress={toggleBlockList}
            style={({ pressed }) => [
              styles.settingsHeader,
              pressed && interactionStyles.pressedSoft,
            ]}
          >
            <UserX color={colors.primaryDark} size={22} strokeWidth={2.2} />
            <Text style={styles.settingsHeaderTitle}>차단 관리</Text>
            {blockedUsers.length > 0 ? (
              <View style={styles.blockCountBadge}>
                <Text style={styles.blockCountText}>{blockedUsers.length}</Text>
              </View>
            ) : null}
          </Pressable>

          {isBlockListMounted ? (
            <Animated.View
              pointerEvents={isBlockListOpen ? 'auto' : 'none'}
              style={[
                styles.settingsShell,
                {
                  maxHeight: blockListProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, BLOCK_PANEL_MAX_HEIGHT],
                  }),
                  opacity: blockListProgress,
                  marginTop: blockListProgress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [BLOCK_PANEL_COLLAPSED_GAP, 0],
                  }),
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.settingsBody,
                  {
                    transform: [
                      {
                        translateY: blockListProgress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-14, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  value={blockSearch}
                  onChangeText={setBlockSearch}
                  placeholder="이름으로 검색"
                  placeholderTextColor={colors.textMuted}
                  style={styles.input}
                />
                {blockedUsers.length === 0 ? (
                  <Text style={styles.settingsItemDescription}>
                    차단한 사용자가 없어요.
                  </Text>
                ) : filteredBlockedUsers.length === 0 ? (
                  <Text style={styles.settingsItemDescription}>
                    검색 결과가 없어요.
                  </Text>
                ) : (
                  <View style={styles.blockList}>
                    {filteredBlockedUsers.map(item => {
                      const name =
                        item.blockedUserNickname ?? '알 수 없는 사용자';
                      const isUnblocking = unblockingId === item.blockedUserId;
                      return (
                        <View key={item.id} style={styles.blockRow}>
                          <ProfileAvatar
                            value={item.blockedUserProfileImageUrl}
                            name={name}
                            size={40}
                          />
                          <Text style={styles.blockName} numberOfLines={1}>
                            {name}
                          </Text>
                          <Pressable
                            accessibilityRole="button"
                            disabled={isUnblocking}
                            onPress={() => {
                              handleUnblock(item.blockedUserId, name).catch(
                                () => undefined,
                              );
                            }}
                            style={({ pressed }) => [
                              styles.unblockButton,
                              isUnblocking && styles.disabledButton,
                              pressed &&
                                !isUnblocking &&
                                interactionStyles.pressedSoft,
                            ]}
                          >
                            <Text style={styles.unblockText}>
                              {isUnblocking ? '해제 중...' : '차단 해제'}
                            </Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                )}
              </Animated.View>
            </Animated.View>
          ) : null}
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

        <View style={styles.dangerZone}>
          <Pressable
            accessibilityRole="button"
            disabled={isDeletingAccount}
            onPress={() => {
              confirmDeleteAccount().catch(() => undefined);
            }}
            style={({ pressed }) => [
              styles.deleteAccountButton,
              isDeletingAccount && styles.disabledButton,
              pressed && !isDeletingAccount && interactionStyles.pressed,
            ]}
          >
            <Text style={styles.deleteAccountText}>
              {isDeletingAccount ? '삭제 중...' : '계정 삭제'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      {dialog}
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
  passActions: {
    flexDirection: 'row',
    gap: 8,
  },
  passActionButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.lavenderMist,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  passActionText: {
    color: colors.primaryDark,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 13,
    includeFontPadding: false,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  settingsHeaderTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 19,
    includeFontPadding: false,
  },
  blockCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.lavenderMist,
  },
  blockCountText: {
    color: colors.primaryDark,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 12,
    includeFontPadding: false,
  },
  blockList: {
    gap: 8,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
  },
  blockName: {
    flex: 1,
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 15,
    includeFontPadding: false,
  },
  unblockButton: {
    minHeight: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: colors.lavenderMist,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  unblockText: {
    color: colors.primaryDark,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 13,
    includeFontPadding: false,
  },
  settingsShell: {
    overflow: 'hidden',
  },
  settingsBody: {
    gap: 16,
    paddingTop: 4,
  },
  settingsGroup: {
    gap: 10,
  },
  settingsItemTitle: {
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 15,
    includeFontPadding: false,
  },
  settingsItemDescription: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 19,
  },
  pushItemList: {
    gap: 4,
  },
  pushItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 40,
  },
  pushItemLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '700',
    fontSize: 13.5,
    lineHeight: 19,
  },
  settingsDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  cardSizeOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  cardSizeOption: {
    flex: 1,
    minHeight: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  cardSizeOptionActive: {
    backgroundColor: colors.lavenderMist,
    borderColor: colors.primary,
  },
  cardSizeLabel: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 15,
    includeFontPadding: false,
  },
  cardSizeLabelActive: {
    color: colors.primaryDark,
  },
  cardSizeHint: {
    color: colors.textMuted,
    fontFamily: fontFamily.handwritten,
    fontWeight: '600',
    fontSize: 11,
    includeFontPadding: false,
    textAlign: 'center',
  },
  cardSizeHintActive: {
    color: colors.primaryDark,
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
  dangerZone: {
    paddingTop: 28,
    marginTop: 8,
  },
  deleteAccountButton: {
    minHeight: 50,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.error,
  },
  deleteAccountText: {
    color: colors.error,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 15,
    includeFontPadding: false,
  },
});
