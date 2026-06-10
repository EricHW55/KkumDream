import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Moon } from 'lucide-react-native';

import { getPlatformPassProductId } from '../api/billing';
import { usePassInfo } from '../hooks/usePass';
import { getAppAccountToken, getObfuscatedAccountId } from '../services/billingAccount';
import { processPassPurchase } from '../services/passPurchases';
import { usePassModalStore } from '../store/passModalStore';
import { useSessionStore } from '../store/sessionStore';
import { colors } from '../theme/colors';
import { handwritingFont, fontFamily } from '../theme/typography';
import {
  endBilling,
  fetchPassProduct,
  getDisplayPrice,
  initBilling,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPassPurchase,
  type PassProduct,
  type Purchase,
} from '../services/iap';

type Status = 'idle' | 'purchasing' | 'verifying' | 'success';

function isUserCancelled(error: { code?: string } | null | undefined): boolean {
  const code = error?.code ?? '';
  return code.toLowerCase().includes('cancel');
}

export function PassModal() {
  const isOpen = usePassModalStore(state => state.isOpen);
  const close = usePassModalStore(state => state.close);
  const token = useSessionStore(state => state.token);
  const userId = useSessionStore(state => state.userId);
  const { data: passInfo } = usePassInfo();
  const queryClient = useQueryClient();

  const [product, setProduct] = useState<PassProduct | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const productId = getPlatformPassProductId(passInfo);

  useEffect(() => {
    let mounted = true;
    initBilling().catch(() => undefined);

    const updateSub = purchaseUpdatedListener(async (purchase: Purchase) => {
      const purchaseToken = purchase.purchaseToken;
      if (!purchaseToken || !productId || !token || !userId) {
        return;
      }
      try {
        if (mounted) {
          setStatus('verifying');
        }
        const processed = await processPassPurchase(purchase, { productId, token, userId });
        if (!processed) {
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ['entitlement'] });
        if (mounted) {
          setStatus('success');
        }
      } catch (e) {
        if (mounted) {
          setError(e instanceof Error ? e.message : '구매 확인에 실패했어요.');
          setStatus('idle');
        }
      }
    });

    const errorSub = purchaseErrorListener(e => {
      if (!mounted) {
        return;
      }
      setStatus('idle');
      if (!isUserCancelled(e)) {
        setError(e?.message ?? '결제 중 문제가 생겼어요.');
      }
    });

    return () => {
      mounted = false;
      updateSub.remove();
      errorSub.remove();
      endBilling().catch(() => undefined);
    };
  }, [productId, token, queryClient, userId]);

  useEffect(() => {
    if (!isOpen || !productId) {
      return;
    }
    fetchPassProduct(productId)
      .then(setProduct)
      .catch(() => undefined);
  }, [isOpen, productId]);

  const priceLabel = getDisplayPrice(product) ?? '1,900원';

  const handlePurchase = async () => {
    if (!productId) {
      return;
    }
    if (!userId) {
      setError('로그인이 필요합니다.');
      return;
    }
    setError(null);
    setStatus('purchasing');
    try {
      await requestPassPurchase(productId, product, {
        obfuscatedAccountId: getObfuscatedAccountId(userId),
        appAccountToken: getAppAccountToken(userId),
      });
    } catch (e) {
      setStatus('idle');
      setError(e instanceof Error ? e.message : '결제를 시작할 수 없어요.');
    }
  };

  const handleClose = () => {
    setStatus('idle');
    setError(null);
    close();
  };

  const busy = status === 'purchasing' || status === 'verifying';

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.scrim} onPress={handleClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <View style={styles.iconWrap}>
            <Moon color={colors.primary} size={26} strokeWidth={1.8} />
          </View>

          <Text style={styles.title}>{passInfo?.title ?? '꿈드림 패스'}</Text>
          <Text style={styles.description}>
            {passInfo?.description ??
              '프리미엄 카드 디자인을 모두 잠금 해제해요.'}
          </Text>

          {status === 'success' ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>패스가 활성화됐어요 ✨</Text>
              <Pressable style={styles.primaryButton} onPress={handleClose}>
                <Text style={styles.primaryButtonText}>꿈 꾸러 가기</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.priceRow}>
                <View style={styles.originalPriceWrap}>
                  <Text style={styles.originalPrice}>
                    {passInfo?.originalPriceLabel ?? '₩2,900'}
                  </Text>
                  <View style={styles.originalPriceStrike} />
                </View>
                <Text style={styles.price}>
                  {priceLabel}
                  <Text style={styles.priceUnit}> / 월</Text>
                </Text>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Pressable
                style={[styles.primaryButton, busy && styles.primaryButtonBusy]}
                onPress={handlePurchase}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>구독하기</Text>
                )}
              </Pressable>

              <Pressable onPress={handleClose} hitSlop={8} disabled={busy}>
                <Text style={styles.laterText}>다음에 할게요</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(31, 30, 27, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.cardBase,
    borderRadius: 24,
    paddingHorizontal: 26,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.lavenderTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    ...handwritingFont('900'),
    fontSize: 25,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  description: {
    ...handwritingFont('600'),
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 22,
  },
  priceRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  originalPriceWrap: {
    justifyContent: 'center',
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 17,
    fontWeight: '600',
    color: 'rgba(150, 120, 116, 0.7)',
    letterSpacing: 0.3,
  },
  originalPriceStrike: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1.5,
    backgroundColor: 'rgba(158, 106, 98, 0.9)',
    transform: [{ translateY: -1 }],
  },
  price: {
    fontSize: 27,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.2,
  },
  priceUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  error: {
    fontFamily: fontFamily.korean,
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonBusy: {
    opacity: 0.7,
  },
  primaryButtonText: {
    ...handwritingFont('800'),
    fontSize: 16,
    color: '#FFFFFF',
  },
  laterText: {
    fontFamily: fontFamily.korean,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 14,
  },
  successBox: {
    width: '100%',
    alignItems: 'center',
  },
  successText: {
    fontFamily: fontFamily.korean,
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 18,
  },
});
