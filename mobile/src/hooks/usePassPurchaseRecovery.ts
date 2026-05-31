import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { usePassInfo } from './usePass';
import { recoverPassPurchases } from '../services/passPurchases';
import { useSessionStore } from '../store/sessionStore';

export function usePassPurchaseRecovery() {
  const { data: passInfo } = usePassInfo();
  const token = useSessionStore(state => state.token);
  const queryClient = useQueryClient();
  const isRecovering = useRef(false);

  const recover = useCallback(async (): Promise<number> => {
    if (!passInfo?.productId || !token || isRecovering.current) {
      return 0;
    }
    isRecovering.current = true;
    try {
      const recovered = await recoverPassPurchases({
        productId: passInfo.productId,
        token,
      });
      if (recovered > 0) {
        await queryClient.invalidateQueries({ queryKey: ['entitlement'] });
      }
      return recovered;
    } finally {
      isRecovering.current = false;
    }
  }, [passInfo?.productId, queryClient, token]);

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
