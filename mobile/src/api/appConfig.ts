import { requestJson } from './httpClient';

export type PlatformUpdateConfig = {
  latestVersion: string;
  minSupportedVersion: string;
  storeUrl: string;
  message: string;
};

export type AppConfig = {
  ios: PlatformUpdateConfig;
};

export function fetchAppConfig(): Promise<AppConfig> {
  return requestJson<AppConfig>('/app-config');
}
