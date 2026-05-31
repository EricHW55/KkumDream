import { Platform } from 'react-native';
import SpInAppUpdates, {
  IAUUpdateKind,
  type StartUpdateOptions,
} from 'sp-react-native-in-app-updates';

const inAppUpdates = new SpInAppUpdates(false);
let hasCheckedForUpdate = false;

export async function checkForImmediateAndroidUpdate(): Promise<void> {
  if (Platform.OS !== 'android' || hasCheckedForUpdate) {
    return;
  }

  hasCheckedForUpdate = true;

  try {
    const updateInfo = await inAppUpdates.checkNeedsUpdate();
    if (!updateInfo.shouldUpdate) {
      return;
    }

    const options: StartUpdateOptions = {
      updateType: IAUUpdateKind.IMMEDIATE,
    };
    await inAppUpdates.startUpdate(options);
  } catch {
    // Failing silently avoids blocking app startup if Play Services is unavailable.
  }
}
