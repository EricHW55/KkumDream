import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DreamCard } from '../components/DreamCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { buildMockDraft } from '../mocks/dreams';
import { colors } from '../theme/colors';
import type { Dream } from '../types/dream';

const moods = ['몽환', '판타지', '공포', '코믹', '따뜻함', '추억', '기괴함'];

export function ComposeScreen() {
  const [rawInput, setRawInput] = useState('');
  const [mood, setMood] = useState('몽환');
  const [draft, setDraft] = useState<Dream | null>(null);

  const canGenerate = rawInput.trim().length > 0;

  return (
    <ScrollView
      style={styles.root}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}>
      <Text style={styles.label}>오늘 꾼 꿈</Text>
      <TextInput
        value={rawInput}
        onChangeText={setRawInput}
        multiline
        maxLength={500}
        textAlignVertical="top"
        placeholder="꿈에서 본 장면을 짧게 적어보세요."
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />

      <Text style={styles.label}>무드</Text>
      <View style={styles.moodGrid}>
        {moods.map(item => (
          <Text
            key={item}
            onPress={() => setMood(item)}
            style={[styles.mood, item === mood && styles.moodActive]}>
            {item}
          </Text>
        ))}
      </View>

      <PrimaryButton
        disabled={!canGenerate}
        onPress={() => setDraft(buildMockDraft(rawInput.trim(), mood))}>
        카드 미리보기 만들기
      </PrimaryButton>

      {draft ? (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>미리보기</Text>
          <DreamCard dream={draft} />
          <PrimaryButton onPress={() => undefined}>받는 사람 선택하기</PrimaryButton>
        </View>
      ) : null}
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
    gap: 16,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  input: {
    minHeight: 150,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.cardBase,
    padding: 16,
    color: colors.textPrimary,
    fontSize: 16,
    lineHeight: 24,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mood: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    color: colors.textSecondary,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
    fontWeight: '700',
  },
  moodActive: {
    color: '#FFFFFF',
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  preview: {
    gap: 16,
    paddingTop: 8,
  },
  previewTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
});

