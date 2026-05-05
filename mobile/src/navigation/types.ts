import type { Dream } from '../types/dream';

export type RootStackParamList = {
  Login: undefined;
  MainTabs: undefined;
  GroupRoom: { groupId: string; groupName?: string; description?: string };
  Compose: undefined;
  DreamDetail: { dream: Dream };
};

export type MainTabParamList = {
  Home: undefined;
  Inbox: undefined;
  Outbox: undefined;
  Profile: undefined;
};
