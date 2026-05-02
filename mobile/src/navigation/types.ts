import type { Dream } from '../types/dream';

export type RootStackParamList = {
  MainTabs: undefined;
  Compose: undefined;
  DreamDetail: { dream: Dream };
};

export type MainTabParamList = {
  Home: undefined;
  Inbox: undefined;
  Outbox: undefined;
  Profile: undefined;
};

