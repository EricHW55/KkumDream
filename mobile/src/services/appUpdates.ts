import { Linking, Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

import { fetchAppConfig, type PlatformUpdateConfig } from '../api/appConfig';
import { readCache, writeCache } from '../data/cache';

const DISMISSED_IOS_UPDATE_KEY = 'ui:updates:dismissed-ios-version';

export type IosUpdateNotice = {
  latestVersion: string;
  currentVersion: string;
  message: string;
  storeUrl: string;
  required: boolean;
};

export async function checkForIosUpdateNotice(): Promise<IosUpdateNotice | null> {
  if (Platform.OS !== 'ios') {
    return null;
  }

  const config = (await fetchAppConfig()).ios;
  const currentVersion = DeviceInfo.getVersion();
  const latestVersion = config.latestVersion.trim();
  const minSupportedVersion = config.minSupportedVersion.trim();

  if (!latestVersion || compareVersions(currentVersion, latestVersion) >= 0) {
    return null;
  }

  const required = compareVersions(currentVersion, minSupportedVersion) < 0;
  if (!required && readCache<string>(DISMISSED_IOS_UPDATE_KEY) === latestVersion) {
    return null;
  }

  return toNotice(config, currentVersion, required);
}

export function dismissIosUpdateNotice(latestVersion: string) {
  writeCache(DISMISSED_IOS_UPDATE_KEY, latestVersion);
}

export async function openUpdateUrl(url: string): Promise<void> {
  if (url) {
    await Linking.openURL(url);
  }
}

function toNotice(
  config: PlatformUpdateConfig,
  currentVersion: string,
  required: boolean,
): IosUpdateNotice {
  return {
    latestVersion: config.latestVersion,
    currentVersion,
    message: config.message,
    storeUrl: config.storeUrl,
    required,
  };
}

function compareVersions(left: string, right: string): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftValue = leftParts[index] ?? 0;
    const rightValue = rightParts[index] ?? 0;
    if (leftValue !== rightValue) {
      return leftValue > rightValue ? 1 : -1;
    }
  }

  return 0;
}

function parseVersion(version: string): number[] {
  return version
    .split(/[^\d]+/)
    .filter(Boolean)
    .map(part => Number(part))
    .filter(Number.isFinite);
}
