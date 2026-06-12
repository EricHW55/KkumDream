import { NativeModules, Platform } from 'react-native';

import type { WakeReminderTime } from '../store/settingsStore';

type MorningReminderModule = {
  schedule: (
    hour: number,
    minute: number,
    title: string,
    body: string,
  ) => Promise<boolean>;
  cancel: () => Promise<boolean>;
};

const nativeModule = NativeModules.MorningReminder as
  | MorningReminderModule
  | undefined;

const MORNING_REMINDER_TITLE = '꿈이 흐릿해지기 전에';
const MORNING_REMINDER_BODY = '간밤에 스친 꿈을 꿈드림에 살짝 적어보세요.';

export async function scheduleMorningDreamReminder(time: WakeReminderTime) {
  if (!nativeModule || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
    return false;
  }

  return nativeModule.schedule(
    time.hour,
    time.minute,
    MORNING_REMINDER_TITLE,
    MORNING_REMINDER_BODY,
  );
}

export async function cancelMorningDreamReminder() {
  if (!nativeModule || (Platform.OS !== 'ios' && Platform.OS !== 'android')) {
    return false;
  }

  return nativeModule.cancel();
}
