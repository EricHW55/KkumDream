import { requestJson } from './httpClient';
import type { Dream } from '../types/dream';

export type ApiDreamRoom = {
  roomId: string;
  title: string;
  inviteCode: string;
  lastGivenAt: string | null;
  dreamCount: number;
  todayDreamCount: number;
  memberIds: string[];
  members: {
    id: string;
    nickname: string;
    profileImageUrl: string | null;
    role: string;
  }[];
  latestDreamId: string | null;
  todayGiverIds: string[];
};

export type ApiRoomDreamPage = {
  dreams: Dream[];
  nextCursor: string | null;
};

export function fetchRooms(token?: string | null) {
  return requestJson<ApiDreamRoom[]>('/rooms', { token });
}

export function createRoom(name: string, token?: string | null) {
  return requestJson<ApiDreamRoom>('/rooms', {
    method: 'POST',
    token,
    body: JSON.stringify({ name }),
  });
}

export function joinRoom(inviteCode: string, token?: string | null) {
  return requestJson<ApiDreamRoom>('/rooms/join', {
    method: 'POST',
    token,
    body: JSON.stringify({ inviteCode }),
  });
}

export function updateRoom(
  roomId: string,
  payload: { name: string },
  token?: string | null,
) {
  return requestJson<ApiDreamRoom>(`/rooms/${encodeURIComponent(roomId)}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(payload),
  });
}

export function leaveRoom(roomId: string, token?: string | null) {
  return requestJson<{ ok: boolean }>(`/rooms/${encodeURIComponent(roomId)}`, {
    method: 'DELETE',
    token,
  });
}

export function fetchRoomDreams(
  roomId: string,
  token?: string | null,
  limit = 20,
  before?: string | null,
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) {
    params.set('before', before);
  }
  return requestJson<ApiRoomDreamPage>(
    `/rooms/${encodeURIComponent(roomId)}/dreams?${params.toString()}`,
    { token },
  );
}
