export type DreamStatus = 'draft' | 'given' | 'opened' | 'replied';
export type ImageStatus =
  | 'empty'
  | 'queued'
  | 'generating'
  | 'ready'
  | 'failed';
export type Mood =
  | '몽환'
  | '판타지'
  | '공포'
  | '코믹'
  | '따뜻함'
  | '추억'
  | '기괴함';
export type DreamCardColor =
  | 'beige'
  | 'ivory'
  | 'lilac'
  | 'peach'
  | 'mint'
  | 'midnight';
export type DreamCardFrame = 'ticket' | 'beveled' | 'tag' | 'classic';
export type DreamFontStyle = 'rounded' | 'serif' | 'clean';
export type DreamStoryLength = 'short' | 'standard' | 'long';

export interface DreamDesign {
  cardColor: DreamCardColor;
  cardFrame: DreamCardFrame;
  fontStyle: DreamFontStyle;
}

export interface Dream {
  id: string;
  giverId: string;
  receiverId: string | null;
  receiverLabel: string | null;
  groupIds: string[];
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
  design?: DreamDesign;
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
  tone?: string;
  storyLength?: DreamStoryLength;
  design?: DreamDesign;
}

export interface DreamGivePayload {
  receiverId?: string;
  receiverLabel?: string;
  groupIds?: string[];
}

export interface DreamUpdatePayload {
  title?: string;
  titleVisible?: boolean;
  shortMessage?: string;
  summary?: string;
  story?: string;
  tags?: string[];
  design?: DreamDesign;
}

export interface DreamShareResult {
  token: string;
  dreamId: string;
  expiresAt: string | null;
  shareUrl: string;
}

export interface DreamComment {
  id: string;
  dreamId: string;
  authorId: string;
  authorNickname: string;
  authorProfileImageUrl: string | null;
  content: string;
  isOwnerMain: boolean;
  createdAt: string;
}

export type DreamReactionType = 'heart' | 'sparkle' | 'moon' | 'cloud';

export const DREAM_REACTION_TYPES: readonly DreamReactionType[] = [
  'heart',
  'sparkle',
  'moon',
  'cloud',
];

export interface DreamReactionSummary {
  reactionType: DreamReactionType;
  count: number;
  reacted: boolean;
}

export interface DreamReactionToggleResult {
  reactionType: DreamReactionType;
  reacted: boolean;
  count: number;
  summary: DreamReactionSummary[];
}
