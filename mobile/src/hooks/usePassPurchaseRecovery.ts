import { useCallback, useEffect, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { useEntitlement, usePassInfo } from './usePass';
import { getPlatformPassProductId } from '../api/billing';
import { recoverPassPurchases } from '../services/passPurchases';
import { useSessionStore } from '../store/sessionStore';

type PassPurchaseRecoveryOptions = {
  auto?: boolean;
  autoDelayMs?: number;
};

export function usePassPurchaseRecovery({
  auto = false,
  autoDelayMs = 2500,
}: PassPurchaseRecoveryOptions = {}) {
  const { data: passInfo } = usePassInfo();
  const { data: entitlement } = useEntitlement();
  const productId = getPlatformPassProductId(passInfo);
  const token = useSessionStore(state => state.token);
  const userId = useSessionStore(state => state.userId);
  const queryClient = useQueryClient();
  const isRecovering = useRef(false);
  const hasAutoRecovered = useRef(false);

  const recover = useCallback(async (): Promise<number> => {
    if (!productId || !token || !userId || isRecovering.current) {
      return 0;
    }
    isRecovering.current = true;
    try {
      const recovered = await recoverPassPurchases({
        productId,
        token,
        userId,
      });
      await queryClient.invalidateQueries({ queryKey: ['entitlement'] });
      return recovered;
    } finally {
      isRecovering.current = false;
    }
  }, [productId, queryClient, token, userId]);

  useEffect(() => {
    if (
      !auto ||
      hasAutoRecovered.current ||
      !productId ||
      !token ||
      !userId ||
      entitlement?.active !== false
    ) {
      return undefined;
    }

    hasAutoRecovered.current = true;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const interaction = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        if (!cancelled) {
          recover().catch(() => undefined);
        }
      }, autoDelayMs);
    });

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
      interaction.cancel();
    };
  }, [
    auto,
    autoDelayMs,
    entitlement?.active,
    productId,
    recover,
    token,
    userId,
  ]);

  return recover;
}
