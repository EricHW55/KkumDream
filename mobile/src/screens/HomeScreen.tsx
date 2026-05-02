import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PenLine } from 'lucide-react-native';

import { DreamCard } from '../components/DreamCard';
import { Screen } from '../components/Screen';
import { mockDreams } from '../mocks/dreams';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const navigation = useNavigation<Navigation>();

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.wordmark}>꿈드림</Text>
          <Text style={styles.date}>오늘의 꿈을 건넬 시간</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Compose')}
          style={styles.composeButton}>
          <PenLine color="#FFFFFF" size={20} />
        </Pressable>
      </View>

      <FlatList
        data={mockDreams}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.composePanel}>
            <Text style={styles.panelTitle}>내 꿈을 너에게 줄게</Text>
            <Text style={styles.panelText}>
              하루에 하나, 꿈을 카드로 만들어 특정한 사람에게 건넵니다.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <DreamCard
            dream={item}
            onPress={() => navigation.navigate('DreamDetail', { dream: item })}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  wordmark: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '900',
  },
  date: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 14,
  },
  composeButton: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: 18,
    paddingBottom: 32,
  },
  composePanel: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.lavenderMist,
    marginBottom: 18,
  },
  panelTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  panelText: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
});

