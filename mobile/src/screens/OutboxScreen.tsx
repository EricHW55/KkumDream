import { DreamLibraryView } from '../components/DreamLibraryView';
import { Screen } from '../components/Screen';
import { mockDreams } from '../mocks/dreams';

export function OutboxScreen() {
  const outbox = mockDreams.filter(dream => dream.giverId === 'mock-user-1');

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
