import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';
import { fontFamily } from '../theme/typography';

type Props = {
  visible: boolean;
  required: boolean;
  message: string;
  onDismiss: () => void;
  onUpdate: () => void;
};

export function IosUpdateModal({
  visible,
  required,
  message,
  onDismiss,
  onUpdate,
}: Props) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={required ? undefined : onDismiss}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.badge}>UPDATE</Text>
          <Text style={styles.title}>새 버전이 있어요</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            {required ? null : (
              <Pressable
                accessibilityRole="button"
                onPress={onDismiss}
                style={({ pressed }) => [
                  styles.button,
                  styles.secondaryButton,
                  pressed && interactionStyles.pressedSoft,
                ]}
              >
                <Text style={styles.secondaryText}>나중에</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={onUpdate}
              style={({ pressed }) => [
                styles.button,
                styles.primaryButton,
                pressed && interactionStyles.pressed,
              ]}
            >
              <Text style={styles.primaryText}>업데이트하기</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    backgroundColor: 'rgba(28, 24, 38, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 12,
  },
  badge: {
    alignSelf: 'center',
    marginBottom: 8,
    color: colors.primary,
    fontFamily: fontFamily.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  title: {
    textAlign: 'center',
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 20,
    lineHeight: 27,
    includeFontPadding: false,
  },
  message: {
    marginTop: 12,
    textAlign: 'center',
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  button: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  primaryButton: {
    backgroundColor: colors.primary,
  },
  secondaryText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 15,
    includeFontPadding: false,
  },
  primaryText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 15,
    includeFontPadding: false,
  },
});
