import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { fetchEntitlement, fetchPassInfo } from '../api/billing';
import { useSessionStore } from '../store/sessionStore';
import type { DreamDesign } from '../types/dream';

export function usePassInfo() {
  return useQuery({
    queryKey: ['passInfo'],
    queryFn: fetchPassInfo,
    staleTime: 1000 * 60 * 60,
  });
}

export function useEntitlement() {
  const token = useSessionStore(state => state.token);
  return useQuery({
    queryKey: ['entitlement'],
    queryFn: () => fetchEntitlement(token),
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
  });
}

export function useHasPass(): boolean {
  const { data } = useEntitlement();
  return data?.active ?? false;
}

/**
 * Lock helpers derived from the server-owned catalog. While the catalog is
 * still loading we treat everything as unlocked so the UI never flickers locks
 * the server would not actually enforce.
 */
export function useDesignLock() {
  const { data: passInfo } = usePassInfo();
  const hasPass = useHasPass();

  return useMemo(() => {
    const free = passInfo?.freeDesign;
    const locked = (
      kind: 'cardColors' | 'cardFrames' | 'fontStyles',
      value: string,
    ): boolean => {
      if (hasPass || !free) {
        return false;
      }
      return !free[kind].includes(value);
    };

    return {
      hasPass,
      isColorLocked: (value: string) => locked('cardColors', value),
      isFrameLocked: (value: string) => locked('cardFrames', value),
      isFontLocked: (value: string) => locked('fontStyles', value),
      isDesignLocked: (design: DreamDesign) =>
        locked('cardColors', design.cardColor) ||
        locked('cardFrames', design.cardFrame) ||
        locked('fontStyles', design.fontStyle),
    };
  }, [passInfo, hasPass]);
}
