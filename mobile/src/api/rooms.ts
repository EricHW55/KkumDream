import { requestJson } from './httpClient';
import type { Dream } from '../types/dream';

export type ApiDreamRoom = {
  roomId: string;
  title: string;
  inviteCode: string;
  lastGivenAt: string | null;
  dreamCount: number;
  memberIds: string[];
  members: {
    id: string;
    nickname: string;
    profileImageUrl: string | null;
    role: string;
  }[];
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

export function fetchRoomDreams(
  roomId: string,
  token?: string | null,
  limit = 30,
) {
  return requestJson<Dream[]>(
    `/rooms/${encodeURIComponent(roomId)}/dreams?limit=${limit}`,
    { token },
  );
}
