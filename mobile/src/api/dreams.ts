import { requestJson, requestVoid } from './httpClient';
import type {
  Dream,
  DreamComment,
  DreamDraftPayload,
  DreamGivePayload,
  DreamUpdatePayload,
  DreamReactionSummary,
  DreamReactionToggleResult,
  DreamReactionType,
  DreamShareResult,
} from '../types/dream';

export function createDreamDraft(payload: DreamDraftPayload, token?: string | null) {
  return requestJson<Dream>('/dreams/draft', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function giveDream(dreamId: string, payload: DreamGivePayload, token?: string | null) {
  return requestJson<Dream>(
    `/dreams/${dreamId}/give`,
    {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    },
  );
}

export function updateDream(
  dreamId: string,
  payload: DreamUpdatePayload,
  token?: string | null,
) {
  return requestJson<Dream>(
    `/dreams/${encodeURIComponent(dreamId)}`,
    {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload),
    },
  );
}

export function shareDream(
  dreamId: string,
  token?: string | null,
  expiresInHours?: number,
) {
  return requestJson<DreamShareResult>(`/dreams/${dreamId}/share`, {
    method: 'POST',
    token,
    body: JSON.stringify(expiresInHours ? { expiresInHours } : {}),
  });
}

export function claimDream(claimToken: string, token?: string | null) {
  return requestJson<Dream>('/dreams/claim', {
    method: 'POST',
    token,
    body: JSON.stringify({ token: claimToken }),
  });
}

export function markDreamRead(dreamId: string, token?: string | null) {
  return requestJson<Dream>(
    `/dreams/${encodeURIComponent(dreamId)}/read`,
    { method: 'POST', token },
  );
}

export function markDreamBackOpened(dreamId: string, token?: string | null) {
  return requestJson<Dream>(
    `/dreams/${encodeURIComponent(dreamId)}/open-back`,
    { method: 'POST', token },
  );
}

export function fetchInbox(token?: string | null) {
  return requestJson<Dream[]>('/dreams/inbox', { token });
}

export function fetchOutbox(token?: string | null) {
  return requestJson<Dream[]>('/dreams/outbox', { token });
}

export function fetchDreamComments(dreamId: string, token?: string | null) {
  return requestJson<DreamComment[]>(
    `/dreams/${encodeURIComponent(dreamId)}/comments`,
    { token },
  );
}

export function addDreamComment(
  dreamId: string,
  content: string,
  token?: string | null,
) {
  return requestJson<DreamComment>(
    `/dreams/${encodeURIComponent(dreamId)}/comments`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({ content }),
    },
  );
}

export function deleteDreamComment(
  dreamId: string,
  commentId: string,
  token?: string | null,
) {
  return requestVoid(
    `/dreams/${encodeURIComponent(dreamId)}/comments/${encodeURIComponent(commentId)}`,
    { method: 'DELETE', token },
  );
}

export function fetchDreamReactions(dreamId: string, token?: string | null) {
  return requestJson<DreamReactionSummary[]>(
    `/dreams/${encodeURIComponent(dreamId)}/reactions`,
    { token },
  );
}

export function toggleDreamReaction(
  dreamId: string,
  reactionType: DreamReactionType,
  token?: string | null,
) {
  return requestJson<DreamReactionToggleResult>(
    `/dreams/${encodeURIComponent(dreamId)}/reactions`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({ reactionType }),
    },
  );
}
