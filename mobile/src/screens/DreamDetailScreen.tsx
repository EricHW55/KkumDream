import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DreamCard } from '../components/DreamCard';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'DreamDetail'>;

export function DreamDetailScreen({ route }: Props) {
  const { dream } = route.params;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <DreamCard dream={dream} size="full" />
      <View style={styles.commentBox}>
        <Text style={styles.commentTitle}>꿈 주인의 메인 코멘트</Text>
        <Text style={styles.commentText}>이 꿈은 너에게 주고 싶어서 카드로 접어두었어.</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    gap: 18,
  },
  commentBox: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  commentTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  commentText: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
  },
});

