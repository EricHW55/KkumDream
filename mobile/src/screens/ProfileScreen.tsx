import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

export function ProfileScreen() {
  return (
    <Screen>
      <Text style={styles.title}>내 정보</Text>
      <View style={styles.panel}>
        <Text style={styles.name}>꿈드림 사용자</Text>
        <Text style={styles.meta}>Supabase Auth 연결 예정</Text>
      </View>
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
});

