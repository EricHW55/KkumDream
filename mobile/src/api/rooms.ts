import { requestJson } from './httpClient';
import type { Dream } from '../types/dream';

export type ApiDreamRoom = {
  roomId: string;
  title: string;
  lastGivenAt: string | null;
  dreamCount: number;
};

export function fetchRooms(token?: string | null) {
  return requestJson<ApiDreamRoom[]>('/rooms', { token });
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
