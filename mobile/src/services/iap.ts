import {
  endConnection,
  fetchProducts,
  finishTransaction,
  initConnection,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';

export type { Purchase, PurchaseError };
export { finishTransaction, purchaseErrorListener, purchaseUpdatedListener };

export type PassProduct = NonNullable<
  Awaited<ReturnType<typeof fetchProducts>>
>[number];

export async function initBilling(): Promise<void> {
  await initConnection();
}

export async function endBilling(): Promise<void> {
  await endConnection();
}

export async function fetchPassProduct(
  productId: string,
): Promise<PassProduct | null> {
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
): Promise<void> {
  const offerToken = getOfferToken(product);
  await requestPurchase({
    type: 'subs',
    request: {
      google: {
        skus: [productId],
        subscriptionOffers: offerToken ? [{ sku: productId, offerToken }] : [],
      },
    },
  });
}
