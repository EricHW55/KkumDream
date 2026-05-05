import { Pressable, StyleSheet, Text, View } from 'react-native';

import { signOutGoogle } from '../auth/googleSignIn';
import { Screen } from '../components/Screen';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';

export function ProfileScreen() {
  const user = useSessionStore(state => state.user);
  const clearSession = useSessionStore(state => state.clearSession);

  const logout = async () => {
    await signOutGoogle();
    clearSession();
  };

  return (
    <Screen>
      <Text style={styles.title}>내 정보</Text>
      <View style={styles.panel}>
        <Text style={styles.name}>{user?.nickname ?? '꿈드림 사용자'}</Text>
        <Text style={styles.meta}>{user?.provider ?? 'google'}</Text>
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
    fontWeight: '900',
    marginBottom: 18,
  },
  panel: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  meta: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 14,
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
    fontWeight: '800',
    includeFontPadding: false,
  },
});
