export type DreamStatus = 'draft' | 'given' | 'opened' | 'replied';
export type ImageStatus = 'empty' | 'queued' | 'generating' | 'ready' | 'failed';
export type Mood = '몽환' | '판타지' | '공포' | '코믹' | '따뜻함' | '추억' | '기괴함';

export interface Dream {
  id: string;
  giverId: string;
  receiverId: string | null;
  groupId: string | null;
  rawInput: string;
  title: string;
  titleVisible: boolean;
  shortMessage: string;
  summary: string;
  story: string;
  imagePrompt: string;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  mainMood: Mood | string;
  tags: string[];
  status: DreamStatus;
  imageStatus: ImageStatus;
  createdAt: string;
  givenAt: string | null;
  readAt: string | null;
  openedBackAt: string | null;
  ownerMainCommentId: string | null;
}

export interface DreamDraftPayload {
  rawInput: string;
  mood?: string;
}

export interface DreamGivePayload {
  receiverId?: string;
  groupId?: string;
}
