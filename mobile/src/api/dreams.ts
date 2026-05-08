import { requestJson, requestVoid } from './httpClient';
import type {
  Dream,
  DreamComment,
  DreamDraftPayload,
  DreamGivePayload,
  DreamReactionSummary,
  DreamReactionToggleResult,
  DreamReactionType,
} from '../types/dream';

export function createDreamDraft(payload: DreamDraftPayload, token?: string | null) {
  return requestJson<Dream>('/dreams/draft', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function giveDream(dreamId: string, payload: DreamGivePayload, token?: string | null) {
  return requestJson<Pick<Dream, 'id' | 'status' | 'givenAt' | 'imageStatus'>>(
    `/dreams/${dreamId}/give`,
    {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    },
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
