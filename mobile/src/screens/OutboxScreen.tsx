import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FlatList, StyleSheet, Text } from 'react-native';

import { DreamCard } from '../components/DreamCard';
import { Screen } from '../components/Screen';
import { mockDreams } from '../mocks/dreams';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function OutboxScreen() {
  const navigation = useNavigation<Navigation>();
  const outbox = mockDreams.filter(dream => dream.giverId === 'mock-user-1');

  return (
    <Screen>
      <Text style={styles.title}>보낸 꿈함</Text>
      <FlatList
        data={outbox}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
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
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 18,
  },
  list: {
    gap: 18,
    paddingBottom: 32,
  },
});

