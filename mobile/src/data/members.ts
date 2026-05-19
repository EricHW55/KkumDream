import { mockMembers } from '../mocks/groups';
import { isCurrentUserId } from './currentUser';

const fallbackColors = ['#6F61AD', '#9B8AC7', '#9BDDEB', '#8ED7E8', '#76CDBA'];

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
