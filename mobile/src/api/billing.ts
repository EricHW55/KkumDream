import { requestJson } from './httpClient';

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
}

export interface PassInfo {
  productId: string;
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
  token?: string | null,
) {
  return requestJson<Entitlement>('/billing/verify', {
    method: 'POST',
    token,
    body: JSON.stringify({ purchaseToken, productId }),
  });
}
