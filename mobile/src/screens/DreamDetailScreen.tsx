import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MessageCircle } from 'lucide-react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { DreamCard } from '../components/DreamCard';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'DreamDetail'>;

const comments = [
  {
    id: 'comment-1',
    author: '유하람',
    body: '이 꿈은 색감이 너무 선명해서 카드로 보면 더 오래 기억날 것 같아.',
  },
  {
    id: 'comment-2',
    author: '나',
    body: '뒤집어서 읽으니까 장면이 이어지는 느낌이 좋다.',
  },
];

export function DreamDetailScreen({ route }: Props) {
  const { dream } = route.params;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <DreamCard dream={dream} size="full" />

      <View style={styles.commentBox}>
        <View style={styles.commentHeader}>
          <MessageCircle color={colors.primary} size={20} />
          <Text style={styles.commentTitle}>댓글</Text>
        </View>
        {comments.map(comment => (
          <View key={comment.id} style={styles.commentItem}>
            <Text style={styles.commentAuthor}>{comment.author}</Text>
            <Text style={styles.commentText}>{comment.body}</Text>
          </View>
        ))}
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
    gap: 14,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  commentTitle: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
  },
  commentItem: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.lavenderMist,
  },
  commentAuthor: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '900',
  },
  commentText: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 23,
  },
});
