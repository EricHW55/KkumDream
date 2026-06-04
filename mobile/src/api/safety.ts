import { requestJson, requestVoid } from './httpClient';

export type ReportTargetType = 'dream' | 'comment' | 'user' | 'room';
export type ReportReason =
  | 'inappropriate'
  | 'harassment'
  | 'spam'
  | 'privacy'
  | 'minor_safety'
  | 'other';

export type ReportPayload = {
  targetType: ReportTargetType;
  targetId?: string | null;
  reportedUserId?: string | null;
  reason: ReportReason;
  detail?: string | null;
};

export type ReportResult = {
  id: string;
  targetType: string;
  targetId: string | null;
  reportedUserId: string | null;
  reason: string;
  detail: string | null;
  status: string;
  createdAt: string;
};

export type BlockResult = {
  id: string;
  blockerId: string;
  blockedUserId: string;
  createdAt: string;
};

export type BlockedUser = {
  id: string;
  blockerId: string;
  blockedUserId: string;
  blockedUserNickname: string | null;
  blockedUserProfileImageUrl: string | null;
  createdAt: string;
};

export function fetchBlockedUsers(token: string) {
  return requestJson<BlockedUser[]>('/safety/blocks', { token });
}

export function reportContent(payload: ReportPayload, token: string) {
  return requestJson<ReportResult>('/safety/reports', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function blockUser(blockedUserId: string, token: string) {
  return requestJson<BlockResult>('/safety/blocks', {
    method: 'POST',
    token,
    body: JSON.stringify({ blockedUserId }),
  });
}

export function unblockUser(blockedUserId: string, token: string) {
  return requestVoid(`/safety/blocks/${encodeURIComponent(blockedUserId)}`, {
    method: 'DELETE',
    token,
  });
}
