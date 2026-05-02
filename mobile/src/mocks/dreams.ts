import type { Dream } from '../types/dream';

const now = new Date().toISOString();

export const mockDreams: Dream[] = [
  {
    id: 'mock-dream-1',
    giverId: 'mock-user-1',
    receiverId: 'mock-user-2',
    groupId: null,
    rawInput: '학교 옥상에서 친구와 함께 밤하늘을 날았다.',
    title: '고요한 옥상 비행',
    titleVisible: true,
    shortMessage: '오늘 내가 꾼 꿈을 너에게 줄게',
    summary: '밤의 옥상에서 시작된 조용하고 이상한 비행.',
    story:
      '꿈속에서 우리는 학교 옥상에 서 있었다. 발밑의 그림자가 물처럼 흔들리더니, 어느새 몸이 가벼워졌다. 도시의 불빛은 별자리처럼 멀어졌고, 너는 아무 말 없이 내 손에 작은 카드를 쥐여 주었다.',
    imagePrompt: 'A dreamy storybook illustration of two friends flying above a school rooftop',
    imageUrl: null,
    thumbnailUrl: null,
    mainMood: '몽환',
    tags: ['몽환', '친구', '비행'],
    status: 'opened',
    imageStatus: 'ready',
    createdAt: now,
    givenAt: now,
    readAt: now,
    openedBackAt: null,
    ownerMainCommentId: null,
  },
  {
    id: 'mock-dream-2',
    giverId: 'mock-user-2',
    receiverId: 'mock-user-1',
    groupId: null,
    rawInput: '고양이가 교장선생님이 되어 종을 울렸다.',
    title: '고양이 교장선생님의 종',
    titleVisible: true,
    shortMessage: '오늘 내가 꾼 꿈을 너에게 줄게',
    summary: '낯선 학교에서 울린 이상하고 다정한 종소리.',
    story:
      '복도 끝에는 커다란 고양이가 앉아 있었다. 고양이는 낡은 안경을 고쳐 쓰고 종을 울렸다. 이상하게도 그 소리를 듣자 모두가 잊고 있던 약속을 떠올렸다.',
    imagePrompt: 'A whimsical cat principal ringing a bell in a dreamy school hallway',
    imageUrl: null,
    thumbnailUrl: null,
    mainMood: '코믹',
    tags: ['코믹', '학교', '고양이'],
    status: 'given',
    imageStatus: 'queued',
    createdAt: now,
    givenAt: now,
    readAt: null,
    openedBackAt: null,
    ownerMainCommentId: null,
  },
];

export function buildMockDraft(rawInput: string, mood: string): Dream {
  return {
    ...mockDreams[0],
    id: `draft-${Date.now()}`,
    rawInput,
    title: '밤하늘에 접어 둔 꿈',
    summary: `${rawInput.slice(0, 40)}...`,
    story:
      '꿈속에서 익숙한 장면은 천천히 낯선 정원으로 바뀌었다. 손에 쥔 작은 카드가 빛나자 기억하던 풍경들이 조용히 펼쳐졌고, 그 끝에는 누군가에게 건네고 싶은 한 문장이 남았다.',
    mainMood: mood,
    tags: [mood, '기억', '선물'],
    status: 'draft',
    imageStatus: 'empty',
    givenAt: null,
    readAt: null,
    openedBackAt: null,
  };
}

