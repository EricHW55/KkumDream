import { mockDreams } from './dreams';
import type { GroupDreamMessage, GroupMember, GroupRoom } from '../types/group';

export const mockMembers: GroupMember[] = [
  {
    id: 'mock-user-1',
    name: '나',
    avatarColor: '#6F61AD',
  },
  {
    id: 'mock-user-2',
    name: '유하람',
    avatarColor: '#9B8AC7',
  },
  {
    id: 'mock-user-3',
    name: '권민준',
    avatarColor: '#9BDDEB',
  },
  {
    id: 'mock-user-4',
    name: '유찬',
    avatarColor: '#8ED7E8',
  },
];

export const mockGroupRooms: GroupRoom[] = [
  {
    id: 'group-room-1',
    name: '싱어송',
    description: '새 꿈카드 5시간',
    inviteCode: 'SING-0503',
    lastActivityLabel: '새 로그',
    unreadCount: 4,
    memberIds: ['mock-user-1', 'mock-user-2', 'mock-user-3', 'mock-user-4'],
    members: mockMembers,
    latestDreamId: 'mock-dream-1',
    todayGiverIds: ['mock-user-2', 'mock-user-3', 'mock-user-1'],
  },
  {
    id: 'group-room-2',
    name: '고양이의 삶',
    description: '메시지 보냄 22시간',
    inviteCode: 'CAT-2210',
    lastActivityLabel: '메시지 보냄',
    unreadCount: 2,
    memberIds: ['mock-user-1', 'mock-user-2'],
    members: mockMembers.filter(member =>
      ['mock-user-1', 'mock-user-2'].includes(member.id),
    ),
    latestDreamId: 'mock-dream-2',
    todayGiverIds: ['mock-user-1'],
  },
  {
    id: 'group-room-3',
    name: 'vlog',
    description: '나만의 공간, 매일 오전 4시에 하루 시작',
    inviteCode: 'VLOG-0400',
    lastActivityLabel: '매일 기록',
    unreadCount: 0,
    memberIds: ['mock-user-1'],
    members: mockMembers.filter(member => member.id === 'mock-user-1'),
    latestDreamId: null,
    todayGiverIds: [],
  },
];

export const mockGroupMessages: GroupDreamMessage[] = [
  {
    id: 'group-message-1',
    groupId: 'group-room-1',
    senderId: 'mock-user-2',
    dreamId: 'mock-dream-1',
    sentAtLabel: '일, 5월 3 오전 7:40',
  },
  {
    id: 'group-message-2',
    groupId: 'group-room-1',
    senderId: 'mock-user-3',
    dreamId: 'mock-dream-3',
    sentAtLabel: '일, 5월 3 오전 8:10',
  },
  {
    id: 'group-message-4',
    groupId: 'group-room-1',
    senderId: 'mock-user-1',
    dreamId: 'mock-dream-4',
    sentAtLabel: '일, 5월 3 오전 8:42',
  },
  {
    id: 'group-message-3',
    groupId: 'group-room-2',
    senderId: 'mock-user-1',
    dreamId: 'mock-dream-2',
    sentAtLabel: '토, 5월 2 오후 10:12',
  },
];

export function getMember(memberId: string) {
  return mockMembers.find(member => member.id === memberId) ?? mockMembers[0];
}

export function getGroupRoom(groupId: string) {
  return mockGroupRooms.find(room => room.id === groupId) ?? null;
}

export function getDream(dreamId: string) {
  return mockDreams.find(dream => dream.id === dreamId) ?? mockDreams[0];
}

export function getGroupMessages(groupId: string) {
  return mockGroupMessages.filter(message => message.groupId === groupId);
}
