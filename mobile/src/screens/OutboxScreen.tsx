import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { DreamLibraryView } from '../components/DreamLibraryView';
import { Screen } from '../components/Screen';
import {
  getCachedOutbox,
  getOutboxCacheUpdatedAt,
  hasCachedOutbox,
  loadOutbox,
} from '../data/dreamRepository';
import { useSessionStore } from '../store/sessionStore';
import type { Dream } from '../types/dream';

const DREAM_LIBRARY_STALE_MS = 60 * 1000;
const OUTBOX_VIEW_MODE_CACHE_PREFIX = 'ui:dream-library:outbox:view-mode';

export function OutboxScreen() {
  const token = useSessionStore(state => state.token);
  const userId = useSessionStore(state => state.userId);
  const queryClient = useQueryClient();
  const [isLibraryHydrated, setIsLibraryHydrated] = useState(false);
  const [hasLoadedCache, setHasLoadedCache] = useState(false);
  const queryKey = useMemo(
    () => ['dreams', 'outbox', userId, token] as const,
    [token, userId],
  );
  const initialCachedAt = getOutboxCacheUpdatedAt(userId);
  const {
    data: outbox = [],
    dataUpdatedAt,
    isFetching,
    refetch: refetchOutbox,
  } = useQuery({
    queryKey,
    queryFn: () => loadOutbox(token, userId),
    enabled: isLibraryHydrated,
    staleTime: DREAM_LIBRARY_STALE_MS,
    refetchOnMount: false,
    refetchInterval: query =>
      hasPendingImage(query.state.data) ? 5000 : false,
    initialData: () =>
      hasCachedOutbox(userId) ? getCachedOutbox(userId) : undefined,
    initialDataUpdatedAt: () => initialCachedAt || undefined,
  });
  const displayedOutbox = outbox;
  const viewModeCacheKey = `${OUTBOX_VIEW_MODE_CACHE_PREFIX}:${
    userId ?? 'local'
  }`;

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;
      let animationFrame: number | null = null;

      const cachedAt = getOutboxCacheUpdatedAt(userId);
      const cachedDreams = getCachedOutbox(userId);
      const hasCache = hasCachedOutbox(userId);
      if (hasCache) {
        queryClient.setQueryData(queryKey, cachedDreams, {
          updatedAt: cachedAt || Date.now(),
        });
        setHasLoadedCache(true);
        setIsLibraryHydrated(true);
      }

      const task = InteractionManager.runAfterInteractions(() => {
        animationFrame = requestAnimationFrame(() => {
          if (isCancelled) {
            return;
          }

          queryClient.setQueryData(queryKey, cachedDreams, {
            updatedAt: cachedAt || Date.now(),
          });
          setHasLoadedCache(hasCache);
          setIsLibraryHydrated(true);

          if (!hasCache || Date.now() - cachedAt > DREAM_LIBRARY_STALE_MS) {
            refetchOutbox().catch(() => undefined);
          }
        });
      });

      return () => {
        isCancelled = true;
        task.cancel();
        if (animationFrame !== null) {
          cancelAnimationFrame(animationFrame);
        }
      };
    }, [queryClient, queryKey, refetchOutbox, userId]),
  );

  return (
    <Screen>
      <DreamLibraryView
        title="보낸 꿈"
        description="내가 건넨 꿈카드를 보관함이나 날짜별 캘린더에서 다시 열어볼 수 있어요."
        calendarLabel="보낸 꿈카드"
        emptyMessage="보낸 꿈 카드가 없습니다."
        dreams={displayedOutbox}
        viewModeCacheKey={viewModeCacheKey}
        isLoading={
          !isLibraryHydrated &&
          !hasLoadedCache &&
          displayedOutbox.length === 0 &&
          dataUpdatedAt === 0
        }
        isRefreshing={isFetching}
      />
    </Screen>
  );
}

function hasPendingImage(dreams?: Dream[]) {
  return (
    dreams?.some(
      dream => dream.imageStatus === 'queued' || dream.imageStatus === 'generating',
    ) ?? false
  );
}
