import { useQuery } from '@tanstack/react-query';

import { DreamLibraryView } from '../components/DreamLibraryView';
import { Screen } from '../components/Screen';
import { getCachedOutbox, loadOutbox } from '../data/dreamRepository';
import { useSessionStore } from '../store/sessionStore';

export function OutboxScreen() {
  const token = useSessionStore(state => state.token);
  const userId = useSessionStore(state => state.userId);
  const { data: outbox = getCachedOutbox(userId) } = useQuery({
    queryKey: ['dreams', 'outbox', userId, token],
    queryFn: () => loadOutbox(token, userId),
    initialData: () => getCachedOutbox(userId),
    staleTime: 60 * 1000,
  });

  return (
    <Screen>
      <DreamLibraryView
        title="보낸 꿈"
        description="내가 건넨 꿈카드를 보관함이나 날짜별 캘린더에서 다시 열어볼 수 있어요."
        calendarLabel="보낸 꿈카드"
        dreams={outbox}
      />
    </Screen>
  );
}
