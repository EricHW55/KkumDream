import { requestJson } from './httpClient';
import { Platform } from 'react-native';

export interface Entitlement {
  active: boolean;
  productId: string | null;
  state: string | null;
  expiresAt: string | null;
  autoRenewing: boolean;
}

export interface FreeDesign {
  cardColors: string[];
  cardFrames: string[];
  fontStyles: string[];
  imageTextures: string[];
  letterPapers: string[];
}

export interface PassInfo {
  productId: string;
  androidProductId: string;
  iosProductId: string;
  title: string;
  description: string;
  originalPriceLabel: string;
  freeDesign: FreeDesign;
  freeTones: string[];
  freeStoryLengths: string[];
  privatePostscriptRequiresPass: boolean;
}

export function fetchPassInfo() {
  return requestJson<PassInfo>('/billing/pass-info');
}

export function fetchEntitlement(token?: string | null) {
  return requestJson<Entitlement>('/billing/entitlement', { token });
}

export function verifyPurchase(
  purchaseToken: string,
  productId: string,
  platform: 'android' | 'ios',
  appAccountToken?: string,
  token?: string | null,
) {
  return requestJson<Entitlement>('/billing/verify', {
    method: 'POST',
    token,
    body: JSON.stringify({ purchaseToken, productId, platform, appAccountToken }),
  });
}

export function getPlatformPassProductId(passInfo: PassInfo | undefined): string | null {
  if (!passInfo) {
    return null;
  }
  if (Platform.OS === 'ios') {
    return passInfo.iosProductId || passInfo.productId || null;
  }
  return passInfo.androidProductId || passInfo.productId || null;
}
