import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'kkumdream-onboarding' });

const CARD_FLIP_GUIDE_KEY = 'hasSeenCardFlipGuide';

export function hasSeenCardFlipGuide() {
  return storage.getBoolean(CARD_FLIP_GUIDE_KEY) ?? false;
}

export function markCardFlipGuideSeen() {
  storage.set(CARD_FLIP_GUIDE_KEY, true);
}
