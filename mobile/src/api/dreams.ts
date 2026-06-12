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

export function fetchLatestDreamDraft(token?: string | null) {
  return requestJson<Dream | null>('/dreams/draft/current', { token });
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

export function fetchDream(dreamId: string, token?: string | null) {
  return requestJson<Dream>(
    `/dreams/${encodeURIComponent(dreamId)}`,
    { token },
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

export function uploadDreamFrontPreview(
  dreamId: string,
  preview: { uri: string; version: number; hash: string },
  token?: string | null,
) {
  const formData = new FormData();
  formData.append('file', {
    uri: preview.uri,
    name: `front-preview-${dreamId}.png`,
    type: 'image/png',
  } as unknown as Blob);
  formData.append('version', String(preview.version));
  formData.append('content_hash', preview.hash);

  return requestJson<Dream>(
    `/dreams/${encodeURIComponent(dreamId)}/front-preview`,
    {
      method: 'POST',
      token,
      body: formData,
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
  reacted?: boolean,
  token?: string | null,
) {
  return requestJson<DreamReactionToggleResult>(
    `/dreams/${encodeURIComponent(dreamId)}/reactions`,
    {
      method: 'POST',
      token,
      body: JSON.stringify({ reactionType, reacted }),
    },
  );
}
