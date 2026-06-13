import {
  endConnection,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';
import { Platform } from 'react-native';

export type { Purchase, PurchaseError };
export { finishTransaction, purchaseErrorListener, purchaseUpdatedListener };

export type PassProduct = NonNullable<
  Awaited<ReturnType<typeof fetchProducts>>
>[number];

let billingReady = false;
let billingInitPromise: Promise<boolean> | null = null;

export async function initBilling(): Promise<void> {
  if (billingReady) {
    return;
  }

  if (!billingInitPromise) {
    billingInitPromise = initConnection()
      .then(connected => {
        billingReady = connected;
        return connected;
      })
      .finally(() => {
        billingInitPromise = null;
      });
  }

  const connected = await billingInitPromise;
  if (!connected) {
    throw new Error('Billing connection was not initialized.');
  }
}

export async function endBilling(): Promise<void> {
  if (billingInitPromise) {
    await billingInitPromise.catch(() => false);
  }
  if (!billingReady) {
    return;
  }
  billingReady = false;
  await endConnection();
}

export async function fetchPassProduct(
  productId: string,
): Promise<PassProduct | null> {
  await initBilling();
  const products = await fetchProducts({ skus: [productId], type: 'subs' });
  return products?.[0] ?? null;
}

function getOfferToken(product: PassProduct | null): string | undefined {
  const offers = (product as { subscriptionOfferDetailsAndroid?: { offerToken: string }[] } | null)
    ?.subscriptionOfferDetailsAndroid;
  return offers?.[0]?.offerToken;
}

export function getDisplayPrice(product: PassProduct | null): string | null {
  if (!product) {
    return null;
  }
  const p = product as {
    displayPrice?: string;
    subscriptionOfferDetailsAndroid?: {
      pricingPhases?: { pricingPhaseList?: { formattedPrice?: string }[] };
    }[];
  };
  if (p.displayPrice) {
    return p.displayPrice;
  }
  const phase = p.subscriptionOfferDetailsAndroid?.[0]?.pricingPhases?.pricingPhaseList?.[0];
  return phase?.formattedPrice ?? null;
}

export async function requestPassPurchase(
  productId: string,
  product: PassProduct | null,
  account: { obfuscatedAccountId: string; appAccountToken: string },
): Promise<void> {
  await initBilling();
  const offerToken = getOfferToken(product);
  if (Platform.OS === 'ios') {
    await requestPurchase({
      type: 'subs',
      request: {
        ios: {
          sku: productId,
          appAccountToken: account.appAccountToken,
        },
      },
    });
    return;
  }
  await requestPurchase({
    type: 'subs',
    request: {
      google: {
        skus: [productId],
        obfuscatedAccountId: account.obfuscatedAccountId,
        subscriptionOffers: offerToken ? [{ sku: productId, offerToken }] : [],
      },
    },
  });
}

export async function getAvailablePassPurchases(productId: string): Promise<Purchase[]> {
  await initBilling();
  const purchases = await getAvailablePurchases({
    onlyIncludeActiveItemsIOS: true,
    includeSuspendedAndroid: false,
  });
  return purchases.filter(purchase => {
    const ids = (purchase as { ids?: string[] | null }).ids;
    return purchase.productId === productId || ids?.includes(productId);
  });
}
