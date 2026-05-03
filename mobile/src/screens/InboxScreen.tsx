import { DreamLibraryView } from '../components/DreamLibraryView';
import { Screen } from '../components/Screen';
import { mockDreams } from '../mocks/dreams';

export function InboxScreen() {
  const inbox = mockDreams.filter(dream => dream.receiverId === 'mock-user-1');

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
