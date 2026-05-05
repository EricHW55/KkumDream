import { useQuery } from '@tanstack/react-query';

import { DreamLibraryView } from '../components/DreamLibraryView';
import { Screen } from '../components/Screen';
import { getCachedInbox, loadInbox } from '../data/dreamRepository';
import { useSessionStore } from '../store/sessionStore';

export function InboxScreen() {
  const token = useSessionStore(state => state.token);
  const { data: inbox = getCachedInbox() } = useQuery({
    queryKey: ['dreams', 'inbox', token],
    queryFn: () => loadInbox(token),
    initialData: getCachedInbox,
    staleTime: 60 * 1000,
  });

  return (
    <Screen>
      <DreamLibraryView
        title="받은 꿈"
        description="친구들이 보내준 꿈카드를 보관함이나 날짜별 캘린더에서 볼 수 있어요."
        calendarLabel="받은 꿈카드"
        dreams={inbox}
      />
    </Screen>
  );
}
