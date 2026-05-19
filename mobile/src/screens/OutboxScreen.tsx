import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { DreamLibraryView } from '../components/DreamLibraryView';
import { Screen } from '../components/Screen';
import { getCachedOutbox, loadOutbox } from '../data/dreamRepository';
import { useSessionStore } from '../store/sessionStore';
import type { Dream } from '../types/dream';

export function OutboxScreen() {
  const token = useSessionStore(state => state.token);
  const userId = useSessionStore(state => state.userId);
  const {
    data: outbox = getCachedOutbox(userId),
    refetch: refetchOutbox,
  } = useQuery({
    queryKey: ['dreams', 'outbox', userId, token],
    queryFn: () => loadOutbox(token, userId),
    initialData: () => getCachedOutbox(userId),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: query =>
      hasPendingImage(query.state.data) ? 5000 : false,
  });

  useFocusEffect(
    useCallback(() => {
      refetchOutbox().catch(() => undefined);
    }, [refetchOutbox]),
  );

  return (
    <Screen>
      <DreamLibraryView
        title="보낸 꿈"
        description="내가 건넨 꿈카드를 보관함이나 날짜별 캘린더에서 다시 열어볼 수 있어요."
        calendarLabel="보낸 꿈카드"
        emptyMessage="보낸 꿈 카드가 없습니다."
        dreams={outbox}
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
