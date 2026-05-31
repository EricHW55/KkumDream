import { verifyPurchase } from '../api/billing';
import {
  finishTransaction,
  getAvailablePassPurchases,
  initBilling,
  type Purchase,
} from './iap';
import { getAppAccountToken } from './billingAccount';

type ProcessPassPurchaseParams = {
  productId: string;
  token: string;
  userId: string;
};

export async function processPassPurchase(
  purchase: Purchase,
  { productId, token, userId }: ProcessPassPurchaseParams,
): Promise<boolean> {
  const purchaseToken = purchase.purchaseToken;
  if (!purchaseToken || !isPassPurchase(purchase, productId)) {
    return false;
  }

  await verifyPurchase(
    purchaseToken,
    productId,
    purchase.platform === 'ios' ? 'ios' : 'android',
    (purchase as { appAccountToken?: string | null }).appAccountToken ??
      getAppAccountToken(userId),
    token,
  );
  await finishTransaction({ purchase, isConsumable: false });
  return true;
}

export async function recoverPassPurchases(
  params: ProcessPassPurchaseParams,
): Promise<number> {
  await initBilling();
  const purchases = await getAvailablePassPurchases(params.productId);
  let recovered = 0;
  for (const purchase of purchases) {
    if (await processPassPurchase(purchase, params)) {
      recovered += 1;
    }
  }
  return recovered;
}

function isPassPurchase(purchase: Purchase, productId: string): boolean {
  const ids = (purchase as { ids?: string[] | null }).ids;
  return purchase.productId === productId || ids?.includes(productId) === true;
}
