import { requestJson } from './httpClient';

type DevicePlatform = 'android' | 'ios';

type DeviceTokenPayload = {
  platform: DevicePlatform;
  token: string;
};

export function registerDeviceToken(
  payload: DeviceTokenPayload,
  token: string,
) {
  return requestJson('/devices', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}

export function unregisterDeviceToken(
  payload: DeviceTokenPayload,
  token: string,
) {
  return requestJson<{ ok: boolean }>('/devices/unregister', {
    method: 'POST',
    token,
    body: JSON.stringify(payload),
  });
}
