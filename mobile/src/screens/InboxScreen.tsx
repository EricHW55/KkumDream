import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { DreamLibraryView } from '../components/DreamLibraryView';
import { Screen } from '../components/Screen';
import {
  getCachedInbox,
  getInboxCacheUpdatedAt,
  hasCachedInbox,
  loadInbox,
} from '../data/dreamRepository';
import { useSessionStore } from '../store/sessionStore';

const DREAM_LIBRARY_STALE_MS = 60 * 1000;

export function InboxScreen() {
  const token = useSessionStore(state => state.token);
  const userId = useSessionStore(state => state.userId);
  const queryClient = useQueryClient();
  const [isLibraryHydrated, setIsLibraryHydrated] = useState(false);
  const [hasLoadedCache, setHasLoadedCache] = useState(false);
  const queryKey = useMemo(
    () => ['dreams', 'inbox', userId, token] as const,
    [token, userId],
  );
  const {
    data: inbox = [],
    dataUpdatedAt,
    isFetching,
    refetch: refetchInbox,
  } = useQuery({
    queryKey,
    queryFn: () => loadInbox(token, userId),
    enabled: isLibraryHydrated,
    staleTime: DREAM_LIBRARY_STALE_MS,
    refetchOnMount: false,
  });
  const displayedInbox = isLibraryHydrated ? inbox : [];

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;
      let animationFrame: number | null = null;
      setIsLibraryHydrated(false);
      setHasLoadedCache(false);

      const task = InteractionManager.runAfterInteractions(() => {
        animationFrame = requestAnimationFrame(() => {
          if (isCancelled) {
            return;
          }

          const cachedAt = getInboxCacheUpdatedAt(userId);
          const cachedDreams = getCachedInbox(userId);
          const hasCache = hasCachedInbox(userId);
          queryClient.setQueryData(queryKey, cachedDreams, {
            updatedAt: cachedAt || Date.now(),
          });
          setHasLoadedCache(hasCache);
          setIsLibraryHydrated(true);

          if (!hasCache || Date.now() - cachedAt > DREAM_LIBRARY_STALE_MS) {
            refetchInbox().catch(() => undefined);
          }
        });
      });

      return () => {
        isCancelled = true;
        task.cancel();
        if (animationFrame !== null) {
          cancelAnimationFrame(animationFrame);
        }
        setIsLibraryHydrated(false);
        setHasLoadedCache(false);
      };
    }, [queryClient, queryKey, refetchInbox, userId]),
  );

  return (
    <Screen>
      <DreamLibraryView
        title="받은 꿈"
        description="친구들이 보내준 꿈카드를 보관함이나 날짜별 캘린더에서 볼 수 있어요."
        calendarLabel="받은 꿈카드"
        emptyMessage="받은 꿈 카드가 없습니다."
        dreams={displayedInbox}
        isLoading={
          !isLibraryHydrated ||
          (!hasLoadedCache && displayedInbox.length === 0 && dataUpdatedAt === 0)
        }
        isRefreshing={isFetching}
      />
    </Screen>
  );
}
