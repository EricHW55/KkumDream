import { fetchInbox, fetchOutbox } from '../api/dreams';
import {
  createRoom,
  fetchRoomDreams,
  fetchRooms,
  joinRoom,
  updateRoom,
  type ApiDreamRoom,
} from '../api/rooms';
import { mockDreams } from '../mocks/dreams';
import { mockGroupMessages, mockGroupRooms } from '../mocks/groups';
import type { Dream } from '../types/dream';
import type { GroupRoom } from '../types/group';
import { LOCAL_MOCK_USER_ID } from './currentUser';
import { readCache, writeCache } from './cache';

const CACHE_KEYS = {
  rooms: (userId?: string | null) => scopedKey(userId, 'rooms'),
  inbox: (userId?: string | null) => scopedKey(userId, 'dreams:inbox'),
  outbox: (userId?: string | null) => scopedKey(userId, 'dreams:outbox'),
  allDreams: (userId?: string | null) => scopedKey(userId, 'dreams:all'),
  roomDreams: (roomId: string, userId?: string | null) =>
    scopedKey(userId, `rooms:${roomId}:dreams`),
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

export function getCachedInbox(userId?: string | null) {
  return readCache<Dream[]>(CACHE_KEYS.inbox(userId)) ?? getMockInbox(userId);
}

export async function loadInbox(token?: string | null, userId?: string | null) {
  try {
    const dreams = await fetchInbox(token);
    writeDreamCaches(CACHE_KEYS.inbox(userId), dreams, userId);
    return dreams;
  } catch {
    return getCachedInbox(userId);
  }
}

export function getCachedOutbox(userId?: string | null) {
  return readCache<Dream[]>(CACHE_KEYS.outbox(userId)) ?? getMockOutbox(userId);
}

export async function loadOutbox(token?: string | null, userId?: string | null) {
  try {
    const dreams = await fetchOutbox(token);
    writeDreamCaches(CACHE_KEYS.outbox(userId), dreams, userId);
    return dreams;
  } catch {
    return getCachedOutbox(userId);
  }
}

export function getCachedRoomDreams(roomId: string, userId?: string | null) {
  return (
    readCache<Dream[]>(CACHE_KEYS.roomDreams(roomId, userId)) ??
    getSeedRoomDreams(roomId, userId)
  );
}

export async function loadRoomDreams(
  roomId: string,
  token?: string | null,
  userId?: string | null,
) {
  try {
    const dreams = await fetchRoomDreams(roomId, token);
    writeDreamCaches(CACHE_KEYS.roomDreams(roomId, userId), dreams, userId);
    return dreams;
  } catch {
    return getCachedRoomDreams(roomId, userId);
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
  const cachedDreams = readCache<Dream[]>(CACHE_KEYS.allDreams(userId)) ?? [];
  const merged = new Map(cachedDreams.map(dream => [dream.id, dream]));
  dreams.forEach(dream => merged.set(dream.id, dream));
  writeCache(CACHE_KEYS.allDreams(userId), Array.from(merged.values()));
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
    description:
      room.dreamCount > 0 ? `꿈카드 ${room.dreamCount}개` : '아직 꿈카드가 없어요',
    inviteCode: room.inviteCode,
    lastActivityLabel: room.lastGivenAt ? formatActivityLabel(room.lastGivenAt) : '',
    unreadCount: 0,
    memberIds: room.memberIds,
    members,
    latestDreamId: null,
  };
}

const fallbackColors = ['#F56BEF', '#B069FF', '#7FC8D9', '#FFD66B', '#7FC8B5'];

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
