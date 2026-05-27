import { fetchInbox, fetchOutbox } from '../api/dreams';
import {
  createRoom,
  fetchRoomDreams,
  fetchRooms,
  joinRoom,
  leaveRoom,
  updateRoom,
  type ApiRoomDreamPage,
  type ApiDreamRoom,
} from '../api/rooms';
import { mockDreams } from '../mocks/dreams';
import { mockGroupMessages, mockGroupRooms } from '../mocks/groups';
import type { Dream } from '../types/dream';
import type { GroupRoom } from '../types/group';
import { LOCAL_MOCK_USER_ID } from './currentUser';
import { getCacheUpdatedAt, hasCache, readCache, writeCache } from './cache';

const DREAM_LIST_CACHE_LIMIT = 60;
const ALL_DREAM_CACHE_LIMIT = 120;

const CACHE_KEYS = {
  rooms: (userId?: string | null) => scopedKey(userId, 'rooms'),
  inbox: (userId?: string | null) => scopedKey(userId, 'dreams:inbox'),
  outbox: (userId?: string | null) => scopedKey(userId, 'dreams:outbox'),
  allDreams: (userId?: string | null) => scopedKey(userId, 'dreams:all'),
  roomDreams: (roomId: string, userId?: string | null) =>
    scopedKey(userId, `rooms:${roomId}:dreams`),
};

export type CachedRoomDreamPage = {
  dreams: Dream[];
  nextCursor: string | null;
};

export function getCachedRooms(userId?: string | null) {
  return readCache<GroupRoom[]>(CACHE_KEYS.rooms(userId)) ?? getMockRooms(userId);
}

export async function loadRooms(token?: string | null, userId?: string | null) {
  try {
    const apiRooms = await fetchRooms(token);
    const rooms = apiRooms.map(toGroupRoom);
    writeCache(CACHE_KEYS.rooms(userId), rooms);
    return rooms;
  } catch {
    return getCachedRooms(userId);
  }
}

export async function createGroupRoom(
  name: string,
  token?: string | null,
  userId?: string | null,
) {
  const room = toGroupRoom(await createRoom(name, token));
  const rooms = [room, ...getCachedRooms(userId).filter(item => item.id !== room.id)];
  writeCache(CACHE_KEYS.rooms(userId), rooms);
  return room;
}

export async function joinGroupRoom(
  inviteCode: string,
  token?: string | null,
  userId?: string | null,
) {
  const room = toGroupRoom(await joinRoom(inviteCode, token));
  const rooms = [room, ...getCachedRooms(userId).filter(item => item.id !== room.id)];
  writeCache(CACHE_KEYS.rooms(userId), rooms);
  return room;
}

export async function updateGroupRoom(
  roomId: string,
  name: string,
  token?: string | null,
  userId?: string | null,
) {
  const room = toGroupRoom(await updateRoom(roomId, { name }, token));
  const rooms = [room, ...getCachedRooms(userId).filter(item => item.id !== room.id)];
  writeCache(CACHE_KEYS.rooms(userId), rooms);
  return room;
}

export async function leaveGroupRoom(
  roomId: string,
  token?: string | null,
  userId?: string | null,
) {
  await leaveRoom(roomId, token);
  const rooms = getCachedRooms(userId).filter(item => item.id !== roomId);
  writeCache(CACHE_KEYS.rooms(userId), rooms);
  return rooms;
}

export function getCachedInbox(userId?: string | null) {
  return readCache<Dream[]>(CACHE_KEYS.inbox(userId)) ?? getMockInbox(userId);
}

export function hasCachedInbox(userId?: string | null) {
  return hasCache(CACHE_KEYS.inbox(userId));
}

export function getInboxCacheUpdatedAt(userId?: string | null) {
  return getCacheUpdatedAt(CACHE_KEYS.inbox(userId));
}

export async function loadInbox(token?: string | null, userId?: string | null) {
  try {
    const dreams = await fetchInbox(token);
    writeDreamCaches(
      CACHE_KEYS.inbox(userId),
      limitDreamCache(dreams, DREAM_LIST_CACHE_LIMIT),
      userId,
    );
    return dreams;
  } catch {
    return getCachedInbox(userId);
  }
}

export function getCachedOutbox(userId?: string | null) {
  return readCache<Dream[]>(CACHE_KEYS.outbox(userId)) ?? getMockOutbox(userId);
}

export function hasCachedOutbox(userId?: string | null) {
  return hasCache(CACHE_KEYS.outbox(userId));
}

export function getOutboxCacheUpdatedAt(userId?: string | null) {
  return getCacheUpdatedAt(CACHE_KEYS.outbox(userId));
}

export async function loadOutbox(token?: string | null, userId?: string | null) {
  try {
    const dreams = await fetchOutbox(token);
    writeDreamCaches(
      CACHE_KEYS.outbox(userId),
      limitDreamCache(dreams, DREAM_LIST_CACHE_LIMIT),
      userId,
    );
    return dreams;
  } catch {
    return getCachedOutbox(userId);
  }
}

export function getCachedRoomDreams(roomId: string, userId?: string | null) {
  return getCachedRoomDreamPage(roomId, userId).dreams;
}

export function getCachedRoomDreamPage(roomId: string, userId?: string | null): CachedRoomDreamPage {
  const cachedPage = readCache<CachedRoomDreamPage | Dream[]>(
    CACHE_KEYS.roomDreams(roomId, userId),
  );
  if (Array.isArray(cachedPage)) {
    return {
      dreams: sortDreamsOldestFirst(cachedPage),
      nextCursor: null,
    };
  }
  if (cachedPage) {
    return {
      dreams: sortDreamsOldestFirst(cachedPage.dreams),
      nextCursor: cachedPage.nextCursor ?? null,
    };
  }
  return {
    dreams: sortDreamsOldestFirst(getSeedRoomDreams(roomId, userId)),
    nextCursor: null,
  };
}

export async function loadRoomDreamPage(
  roomId: string,
  token?: string | null,
  userId?: string | null,
  cursor?: string | null,
) {
  try {
    const page = normalizeRoomDreamPage(
      await fetchRoomDreams(roomId, token, 20, cursor),
    );
    writeRoomDreamPageCache(roomId, page, userId, cursor ?? null);
    return page;
  } catch {
    return cursor ? { dreams: [], nextCursor: null } : getCachedRoomDreamPage(roomId, userId);
  }
}

export function getCachedDream(dreamId: string, userId?: string | null) {
  const cachedDreams = readCache<Dream[]>(CACHE_KEYS.allDreams(userId)) ?? [];
  return (
    cachedDreams.find(dream => dream.id === dreamId) ??
    (userId ? null : mockDreams.find(dream => dream.id === dreamId) ?? null)
  );
}

function writeDreamCaches(key: string, dreams: Dream[], userId?: string | null) {
  writeCache(key, dreams);
  updateAllDreamCache(dreams, userId);
}

function updateAllDreamCache(dreams: Dream[], userId?: string | null) {
  const cachedDreams = readCache<Dream[]>(CACHE_KEYS.allDreams(userId)) ?? [];
  const merged = new Map(cachedDreams.map(dream => [dream.id, dream]));
  dreams.forEach(dream => merged.set(dream.id, dream));
  writeCache(
    CACHE_KEYS.allDreams(userId),
    limitDreamCache(Array.from(merged.values()), ALL_DREAM_CACHE_LIMIT),
  );
}

function writeRoomDreamPageCache(
  roomId: string,
  page: CachedRoomDreamPage,
  userId?: string | null,
  cursor?: string | null,
) {
  const existingPage = getCachedRoomDreamPage(roomId, userId);
  const mergedDreams = cursor
    ? mergeDreams(existingPage.dreams, page.dreams)
    : page.dreams;
  writeCache(CACHE_KEYS.roomDreams(roomId, userId), {
    dreams: mergedDreams,
    nextCursor: page.nextCursor,
  } satisfies CachedRoomDreamPage);
  updateAllDreamCache(mergedDreams, userId);
}

function normalizeRoomDreamPage(page: ApiRoomDreamPage): CachedRoomDreamPage {
  return {
    dreams: sortDreamsOldestFirst(page.dreams),
    nextCursor: page.nextCursor ?? null,
  };
}

function sortDreamsOldestFirst(dreams: Dream[]) {
  return [...dreams].sort((left, right) => {
    const leftTime = new Date(left.givenAt ?? left.createdAt).getTime();
    const rightTime = new Date(right.givenAt ?? right.createdAt).getTime();
    return leftTime - rightTime;
  });
}

function limitDreamCache(dreams: Dream[], limit: number) {
  return [...dreams]
    .sort((left, right) => {
      const leftTime = new Date(left.givenAt ?? left.createdAt).getTime();
      const rightTime = new Date(right.givenAt ?? right.createdAt).getTime();
      return rightTime - leftTime;
    })
    .slice(0, limit);
}

function mergeDreams(existingDreams: Dream[], nextDreams: Dream[]) {
  const merged = new Map(existingDreams.map(dream => [dream.id, dream]));
  nextDreams.forEach(dream => merged.set(dream.id, dream));
  return sortDreamsOldestFirst(Array.from(merged.values()));
}

function toGroupRoom(room: ApiDreamRoom): GroupRoom {
  const members = (room.members ?? []).map(member => ({
    id: member.id,
    name: member.nickname,
    avatarColor: colorForId(member.id),
    profileImageUrl: member.profileImageUrl,
    role: member.role,
  }));
  return {
    id: room.roomId,
    name: room.title || '꿈방',
    description: `오늘 꿈카드 ${room.todayDreamCount ?? 0}개`,
    inviteCode: room.inviteCode,
    lastActivityLabel: room.lastGivenAt ? formatActivityLabel(room.lastGivenAt) : '',
    todayDreamCount: room.todayDreamCount ?? 0,
    unreadCount: 0,
    memberIds: room.memberIds,
    members,
    latestDreamId: room.latestDreamId ?? null,
    todayGiverIds: room.todayGiverIds ?? [],
  };
}

const fallbackColors = ['#6F61AD', '#9B8AC7', '#9BDDEB', '#8ED7E8', '#76CDBA'];

function colorForId(id: string) {
  const total = Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return fallbackColors[total % fallbackColors.length];
}

function getMockRooms(userId?: string | null) {
  return userId ? [] : mockGroupRooms;
}

function getMockInbox(userId?: string | null) {
  return userId ? [] : mockDreams.filter(dream => dream.receiverId === LOCAL_MOCK_USER_ID);
}

function getMockOutbox(userId?: string | null) {
  return userId ? [] : mockDreams.filter(dream => dream.giverId === LOCAL_MOCK_USER_ID);
}

function getSeedRoomDreams(roomId: string, userId?: string | null) {
  if (userId) {
    return [];
  }
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

function scopedKey(userId: string | null | undefined, key: string) {
  return userId ? `users:${userId}:${key}` : `mock:${key}`;
}
