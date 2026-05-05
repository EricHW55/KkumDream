import { fetchInbox, fetchOutbox } from '../api/dreams';
import { fetchRoomDreams, fetchRooms, type ApiDreamRoom } from '../api/rooms';
import { mockDreams } from '../mocks/dreams';
import { mockGroupMessages, mockGroupRooms } from '../mocks/groups';
import type { Dream } from '../types/dream';
import type { GroupRoom } from '../types/group';
import { LOCAL_MOCK_USER_ID } from './currentUser';
import { readCache, writeCache } from './cache';

const CACHE_KEYS = {
  rooms: 'rooms',
  inbox: 'dreams:inbox',
  outbox: 'dreams:outbox',
  allDreams: 'dreams:all',
  roomDreams: (roomId: string) => `rooms:${roomId}:dreams`,
};

export function getCachedRooms() {
  return readCache<GroupRoom[]>(CACHE_KEYS.rooms) ?? mockGroupRooms;
}

export async function loadRooms(token?: string | null) {
  try {
    const apiRooms = await fetchRooms(token);
    const rooms = apiRooms.map(toGroupRoom);
    writeCache(CACHE_KEYS.rooms, rooms);
    return rooms;
  } catch {
    return getCachedRooms();
  }
}

export function getCachedInbox() {
  return (
    readCache<Dream[]>(CACHE_KEYS.inbox) ??
    mockDreams.filter(dream => dream.receiverId === LOCAL_MOCK_USER_ID)
  );
}

export async function loadInbox(token?: string | null) {
  try {
    const dreams = await fetchInbox(token);
    writeDreamCaches(CACHE_KEYS.inbox, dreams);
    return dreams;
  } catch {
    return getCachedInbox();
  }
}

export function getCachedOutbox() {
  return (
    readCache<Dream[]>(CACHE_KEYS.outbox) ??
    mockDreams.filter(dream => dream.giverId === LOCAL_MOCK_USER_ID)
  );
}

export async function loadOutbox(token?: string | null) {
  try {
    const dreams = await fetchOutbox(token);
    writeDreamCaches(CACHE_KEYS.outbox, dreams);
    return dreams;
  } catch {
    return getCachedOutbox();
  }
}

export function getCachedRoomDreams(roomId: string) {
  return readCache<Dream[]>(CACHE_KEYS.roomDreams(roomId)) ?? getSeedRoomDreams(roomId);
}

export async function loadRoomDreams(roomId: string, token?: string | null) {
  try {
    const dreams = await fetchRoomDreams(roomId, token);
    writeDreamCaches(CACHE_KEYS.roomDreams(roomId), dreams);
    return dreams;
  } catch {
    return getCachedRoomDreams(roomId);
  }
}

export function getCachedDream(dreamId: string) {
  const cachedDreams = readCache<Dream[]>(CACHE_KEYS.allDreams) ?? [];
  return (
    cachedDreams.find(dream => dream.id === dreamId) ??
    mockDreams.find(dream => dream.id === dreamId) ??
    null
  );
}

function writeDreamCaches(key: string, dreams: Dream[]) {
  writeCache(key, dreams);
  const cachedDreams = readCache<Dream[]>(CACHE_KEYS.allDreams) ?? [];
  const merged = new Map(cachedDreams.map(dream => [dream.id, dream]));
  dreams.forEach(dream => merged.set(dream.id, dream));
  writeCache(CACHE_KEYS.allDreams, Array.from(merged.values()));
}

function toGroupRoom(room: ApiDreamRoom): GroupRoom {
  return {
    id: room.roomId,
    name: room.title || '꿈방',
    description:
      room.dreamCount > 0 ? `꿈카드 ${room.dreamCount}개` : '아직 꿈카드가 없어요',
    inviteCode: '',
    lastActivityLabel: room.lastGivenAt ? formatActivityLabel(room.lastGivenAt) : '',
    unreadCount: 0,
    memberIds: [],
    latestDreamId: null,
  };
}

function getSeedRoomDreams(roomId: string) {
  const dreamIds = mockGroupMessages
    .filter(message => message.groupId === roomId)
    .map(message => message.dreamId);
  return mockDreams.filter(dream => dreamIds.includes(dream.id));
}

function formatActivityLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const elapsedMs = Date.now() - date.getTime();
  const elapsedHours = Math.max(0, Math.floor(elapsedMs / 1000 / 60 / 60));
  if (elapsedHours < 1) {
    return '방금';
  }
  if (elapsedHours < 24) {
    return `${elapsedHours}시간 전`;
  }
  return `${Math.floor(elapsedHours / 24)}일 전`;
}
