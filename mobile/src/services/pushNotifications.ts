import messaging from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';

import { registerDeviceToken, unregisterDeviceToken } from '../api/devices';

let tokenRefreshUnsubscribe: (() => void) | null = null;

export async function registerPushToken(appToken: string) {
  const fcmToken = await getFcmToken();
  if (!fcmToken) {
    return null;
  }

  await registerDeviceToken(
    { platform: getPlatform(), token: fcmToken },
    appToken,
  );
  watchTokenRefresh(appToken);
  return fcmToken;
}

export async function unregisterPushToken(appToken: string) {
  stopWatchingTokenRefresh();
  try {
    const fcmToken = await messaging().getToken();
    if (!fcmToken) {
      return;
    }
    await unregisterDeviceToken(
      { platform: getPlatform(), token: fcmToken },
      appToken,
    );
  } catch {
    // Logout should not be blocked by Firebase availability.
  }
}

export function stopWatchingTokenRefresh() {
  tokenRefreshUnsubscribe?.();
  tokenRefreshUnsubscribe = null;
}

async function getFcmToken() {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      return null;
    }
    if (Platform.OS === 'ios') {
      await messaging().registerDeviceForRemoteMessages();
    }
    return await messaging().getToken();
  } catch {
    return null;
  }
}

async function requestNotificationPermission() {
  if (Platform.OS === 'android') {
    const version =
      typeof Platform.Version === 'number'
        ? Platform.Version
        : Number.parseInt(String(Platform.Version), 10);
    if (version < 33) {
      return true;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }

  const authorizationStatus = await messaging().requestPermission();
  return (
    authorizationStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authorizationStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
}

function watchTokenRefresh(appToken: string) {
  if (tokenRefreshUnsubscribe) {
    return;
  }

  tokenRefreshUnsubscribe = messaging().onTokenRefresh(nextToken => {
    registerDeviceToken(
      { platform: getPlatform(), token: nextToken },
      appToken,
    ).catch(() => undefined);
  });
}

function getPlatform() {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}
