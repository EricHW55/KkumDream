import { mockMembers } from '../mocks/groups';
import { isCurrentUserId } from './currentUser';

const fallbackColors = ['#F56BEF', '#B069FF', '#7FC8D9', '#FFD66B', '#7FC8B5'];

function colorForId(id: string) {
  const total = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return fallbackColors[total % fallbackColors.length];
}

export function getDisplayMember(memberId: string, sessionUserId?: string | null) {
  const seedMember = mockMembers.find(member => member.id === memberId);
  if (seedMember) {
    return seedMember;
  }

  if (isCurrentUserId(memberId, sessionUserId)) {
    return {
      id: memberId,
      name: '나',
      avatarColor: fallbackColors[0],
    };
  }

  return {
    id: memberId,
    name: '꿈친구',
    avatarColor: colorForId(memberId),
  };
}

export function getSeedFriends() {
  return mockMembers.filter(member => !isCurrentUserId(member.id));
}
