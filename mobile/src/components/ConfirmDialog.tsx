import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme/colors';
import { interactionStyles } from '../theme/interactions';
import { fontFamily, handwritingEmphasis } from '../theme/typography';

export type ConfirmTone = 'default' | 'danger';

export type ConfirmOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

/**
 * Drop-in replacement for the OS `Alert.alert` confirm flow, styled to match
 * the app's paper/handwritten look. Returns an imperative `confirm()` that
 * resolves to true/false, plus a `dialog` element to render once per screen.
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>(resolve => {
        setState({ ...options, resolve });
      }),
    [],
  );

  const close = useCallback((result: boolean) => {
    setState(current => {
      current?.resolve(result);
      return null;
    });
  }, []);

  const dialog = (
    <ConfirmDialog
      visible={state !== null}
      title={state?.title ?? ''}
      message={state?.message}
      confirmText={state?.confirmText}
      cancelText={state?.cancelText}
      tone={state?.tone}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, dialog };
}

type Props = ConfirmOptions & {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  tone = 'default',
  onConfirm,
  onCancel,
}: Props) {
  const isDanger = tone === 'danger';
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <Text style={styles.star}>✦</Text>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                pressed && interactionStyles.pressedSoft,
              ]}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                isDanger ? styles.dangerButton : styles.confirmButton,
                pressed && interactionStyles.pressed,
              ]}
            >
              <Text style={isDanger ? styles.dangerText : styles.confirmText}>
                {confirmText}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
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
    paddingTop: 26,
    paddingBottom: 18,
    backgroundColor: colors.cardBase,
    borderWidth: 1,
    borderColor: colors.divider,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 12,
  },
  star: {
    textAlign: 'center',
    color: colors.primary,
    fontSize: 16,
    marginBottom: 6,
    includeFontPadding: false,
  },
  title: {
    textAlign: 'center',
    color: colors.textPrimary,
    fontFamily: fontFamily.handwritten,
    fontSize: 19,
    lineHeight: 26,
    includeFontPadding: false,
    ...handwritingEmphasis(colors.textPrimary, 'title'),
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
  cancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  dangerButton: {
    backgroundColor: colors.error,
  },
  cancelText: {
    color: colors.textSecondary,
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 15,
    includeFontPadding: false,
  },
  confirmText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 15,
    includeFontPadding: false,
  },
  dangerText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.handwritten,
    fontWeight: '800',
    fontSize: 15,
    includeFontPadding: false,
  },
});
