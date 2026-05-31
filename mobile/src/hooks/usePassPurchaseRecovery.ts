import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { usePassInfo } from './usePass';
import { getPlatformPassProductId } from '../api/billing';
import { recoverPassPurchases } from '../services/passPurchases';
import { useSessionStore } from '../store/sessionStore';

export function usePassPurchaseRecovery() {
  const { data: passInfo } = usePassInfo();
  const productId = getPlatformPassProductId(passInfo);
  const token = useSessionStore(state => state.token);
  const userId = useSessionStore(state => state.userId);
  const queryClient = useQueryClient();
  const isRecovering = useRef(false);

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
      if (recovered > 0) {
        await queryClient.invalidateQueries({ queryKey: ['entitlement'] });
      }
      return recovered;
    } finally {
      isRecovering.current = false;
    }
  }, [productId, queryClient, token, userId]);

  useEffect(() => {
    recover().catch(() => undefined);
  }, [recover]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        recover().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, [recover]);

  return recover;
}
