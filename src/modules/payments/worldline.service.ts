import crypto from 'crypto';
import mongoose from 'mongoose';
import { Order, IOrder } from '../orders/order.model';
import { WorldlinePayment } from './worldline-payment.model';
import { releaseOrderFulfillment, voidUnpaidOnlineOrder } from '../orders/orders.service';
import { inferInstrumentFieldsFromWorldline } from '../orders/paymentMethodDisplay';
import {
  resolveReturnUrlForPlatform,
  resolveWebAppBaseUrl,
  sanitizeCheckoutOrigin,
} from './paymentRedirectUrls';
import { creditWallet, MAX_TOP_UP_AMOUNT } from '../wallet/wallet.service';
import { logger } from '../../utils/logger';
import {
  trimEnv,
  parseAlgoToken,
  resolveWorldlineHashAlgo,
  deviceIdForPlatform,
  canonicalizePaynimoPaymentMode,
  formatWorldlineTxnAmount,
  computeToken,
  isTerminal,
  mapStatus,
  resolvePaymentOutcome,
  verifyGatewayResponse,
  logWorldlineCallbackPayload,
  normalizeWorldlineGatewayPayload,
  WORLDLINE_ERROR_INCOMPLETE_NORMALIZE,
  WORLDLINE_ERROR_HASH_MISMATCH_EMPTY_TPSL,
} from './worldline.crypto';

/**
 * Ported from legacy `customer-backend/services/worldlinePaymentsService.js` (2372 lines).
 * Session creation, webhook/callback verification (`completePayment` / `processGatewayReturn`),
 * abort, and status polling for the customer checkout flow.
 *
 * `createWalletTopUpSession` / `maybeCreditWalletForSuccessfulPayment` (wallet top-up via
 * Paynimo, crediting `wallet` module's `CustomerWallet` after verified success) are ported
 * below now that the `wallet` module exists.
 *
 * Deliberately NOT ported (documented boundaries, not gaps):
 * - `createStandalonePaymentSession` / `getStandalonePaymentStatus` (payment session without a
 *   `customer_orders` row, e.g. `/api/payment/initiate`) — a separate, rarely-used entry point;
 *   `standaloneCheckout` fields exist on the model for forward-compat but this pass only wires
 *   the order-attached flow.
 * - Push/email payment-outcome notifications (legacy `notificationService.js`) — same no-op
 *   stub convention already established in `orders/orders.service.ts` (non-blocking,
 *   errors-swallowed in legacy, so a no-op preserves the same fire-and-forget contract).
 * - The developer-machine debug log (`appendPaynimoDebugLog` writing to a hardcoded local
 *   path) and the verbose `console.log` "for LM Group support" blocks in the legacy
 *   controller — replaced with structured `logger` calls only.
 */

function notifyPaymentOutcome(_order: IOrder | null, _outcome: string): void {
  // Deferred — see module doc comment above.
}

function applyWorldlineInstrumentToOrder(order: IOrder, worldlinePayment: Record<string, unknown>): void {
  if (!order || !worldlinePayment) return;
  try {
    const fields = inferInstrumentFieldsFromWorldline(worldlinePayment);
    if (!order.paymentMethod) (order as unknown as { paymentMethod: Record<string, unknown> }).paymentMethod = {};
    const pm = order.paymentMethod as unknown as Record<string, unknown>;
    if (fields.instrument) pm.instrument = fields.instrument;
    if (fields.displayLabel) pm.displayLabel = fields.displayLabel;
    if (fields.paymentMode) pm.paymentMode = fields.paymentMode;
  } catch (e) {
    logger.warn('applyWorldlineInstrumentToOrder failed', { error: (e as Error)?.message });
  }
}

export function isEnabled(): boolean {
  const raw = String(process.env.WORLDLINE_ENABLED || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

/**
 * Paynimo feature flags for hosted checkout.
 * `enableExpressPay` loads the saved-instruments strip under "All Payment Options".
 * When the merchant kit has no registered instruments (typical for new / test setups),
 * that strip renders as a blank white panel with broken markers — so it stays off unless
 * WORLDLINE_ENABLE_EXPRESS_PAY is explicitly enabled.
 */
function envFlagTrue(name: string): boolean {
  const raw = String(process.env[name] || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export function buildPaynimoCheckoutFeatures(): Record<string, boolean> {
  const expressPay = envFlagTrue('WORLDLINE_ENABLE_EXPRESS_PAY');
  return {
    enableAbortResponse: true,
    enableMerTxnDetails: true,
    showLoader: true,
    enableExpressPay: expressPay,
    enableInstrumentDeRegistration: expressPay,
  };
}

/** Reused DB sessions may still carry old feature flags — normalize before handing to the SDK. */
function withCurrentPaynimoFeatures(sessionPayload: unknown): Record<string, unknown> {
  const base =
    sessionPayload && typeof sessionPayload === 'object'
      ? { ...(sessionPayload as Record<string, unknown>) }
      : {};
  return {
    ...base,
    features: buildPaynimoCheckoutFeatures(),
  };
}

const DEFAULT_MIN_AMOUNT_INR = 1;
const DEFAULT_MAX_AMOUNT_INR = 10;

function getAmountLimits(): { min: number; max: number } {
  const parsedMin = parseFloat(process.env.WORLDLINE_MIN_AMOUNT_INR ?? '');
  const parsedMax = parseFloat(process.env.WORLDLINE_MAX_AMOUNT_INR ?? '');
  const min = Number.isFinite(parsedMin) ? parsedMin : DEFAULT_MIN_AMOUNT_INR;
  let max = Number.isFinite(parsedMax) ? parsedMax : DEFAULT_MAX_AMOUNT_INR;
  if (max < min) max = min;
  return { min: Math.max(0, min), max };
}

function worldlineAmountRangeError(amount: number, min: number, max: number): string {
  const rounded = Math.round(amount * 100) / 100;
  if (amount > max) {
    return (
      `Worldline in this environment only accepts ₹${min}–₹${max} per payment. ` +
      `Your order total is ₹${rounded} (items + delivery + handling + tip − discounts), not just cart subtotal. ` +
      `Use Cash on Delivery for larger tests, or keep the full order within ₹${max}. ` +
      `In production, set WORLDLINE_MAX_AMOUNT_INR to match your live merchant limit.`
    );
  }
  if (amount < min) {
    return `Order total ₹${rounded} is below the minimum ₹${min} for online payment in this environment.`;
  }
  return `Amount must be between ₹${min} and ₹${max} in this environment`;
}

function normalizePlatform(platform: unknown): 'android' | 'ios' | 'web' | null {
  const p = String(platform || '').toLowerCase();
  if (p === 'android') return 'android';
  if (p === 'ios') return 'ios';
  if (p === 'web') return 'web';
  return null;
}

let worldlineMerchantEnvMismatchLogged = false;
function warnWorldlineMerchantEnvMismatchOnce(): void {
  if (worldlineMerchantEnvMismatchLogged) return;
  const id = trimEnv(process.env.WORLDLINE_MERCHANT_ID);
  const code = trimEnv(process.env.WORLDLINE_MERCHANT_CODE);
  if (id && code && id !== code) {
    worldlineMerchantEnvMismatchLogged = true;
    logger.error(
      `WORLDLINE merchant env mismatch: WORLDLINE_MERCHANT_ID=${id} vs WORLDLINE_MERCHANT_CODE=${code}. ` +
        'Token/session use WORLDLINE_MERCHANT_ID when set. Align both to the same live/test id.',
    );
  }
}

/** Payment-session notifications only ever apply to gateway prepayment orders. */
function isGatewayPrepaymentOrder(order: { paymentMethod?: { methodType?: string } } | null): boolean {
  const methodType = order?.paymentMethod?.methodType;
  return methodType === 'card' || methodType === 'upi' || methodType === 'digital';
}

type CreateSessionInput = {
  orderId: string;
  platform: string;
  algo?: string;
  consumerEmailId?: string;
  consumerMobileNo?: string;
  paymentMode?: string;
  checkoutOrigin?: string;
};

export async function createSession(
  userId: string,
  { orderId, platform, algo, consumerEmailId, consumerMobileNo, paymentMode, checkoutOrigin }: CreateSessionInput,
): Promise<{ error: string } | { data: Record<string, unknown> }> {
  if (!isEnabled()) return { error: 'Worldline payment is not enabled' };
  warnWorldlineMerchantEnvMismatchOnce();

  const normalizedPlatform = normalizePlatform(platform);
  if (!normalizedPlatform) return { error: 'platform must be android, ios, or web' };

  const deviceId = deviceIdForPlatform(normalizedPlatform, algo);
  if (!deviceId) return { error: 'Unable to determine deviceId for platform' };

  const merchantId = trimEnv(process.env.WORLDLINE_MERCHANT_ID || process.env.WORLDLINE_MERCHANT_CODE);
  const schemeCode = trimEnv(process.env.WORLDLINE_SCHEME_CODE) || 'FIRST';
  const salt = trimEnv(process.env.WORLDLINE_SALT);
  const safeCheckoutOrigin = sanitizeCheckoutOrigin(checkoutOrigin) || '';
  const returnUrl = resolveReturnUrlForPlatform(normalizedPlatform, logger, safeCheckoutOrigin || undefined);

  if (!merchantId || !salt || !returnUrl) return { error: 'Worldline configuration incomplete' };

  const order = await Order.findOne({ _id: orderId, userId: new mongoose.Types.ObjectId(userId) }).lean<IOrder>();
  if (!order) return { error: 'Order not found' };

  if (!isGatewayPrepaymentOrder(order as unknown as { paymentMethod?: { methodType?: string } })) {
    return { error: 'This order does not use online payment — no payment session is required.' };
  }

  if ((order as unknown as { status?: string }).status === 'cancelled') {
    return { error: 'This order was cancelled. Please place a new order — your items were restored to the cart.' };
  }
  if ((order as unknown as { paymentStatus?: string }).paymentStatus === 'paid') {
    return { error: 'This order is already paid.' };
  }

  const orderRec = order as unknown as { walletDeduction?: number; onlineAmountDue?: number; totalBill?: number };
  const walletPart = Number(orderRec.walletDeduction) || 0;
  const chargedAmount =
    walletPart > 0
      ? orderRec.onlineAmountDue != null && Number(orderRec.onlineAmountDue) >= 0
        ? Number(orderRec.onlineAmountDue)
        : Math.max(0, Number(orderRec.totalBill || 0) - walletPart)
      : Number(orderRec.totalBill || 0);
  const amountStr = formatWorldlineTxnAmount(chargedAmount);
  const { min, max } = getAmountLimits();
  if (!(chargedAmount >= min && chargedAmount <= max)) {
    return { error: worldlineAmountRangeError(chargedAmount, min, max) };
  }

  const latestAttempt = await WorldlinePayment.findOne({ orderId, platform: normalizedPlatform }).sort({ attemptNo: -1 });

  let attemptNo = 1;
  let txnId = '';
  let shouldCreateNew = true;

  if (latestAttempt) {
    const isExpired = latestAttempt.sessionExpiresAt && new Date() > latestAttempt.sessionExpiresAt;
    if (!isTerminal(latestAttempt.status) && !isExpired) {
      txnId = latestAttempt.txnId;
      attemptNo = latestAttempt.attemptNo;
      shouldCreateNew = false;
    } else {
      attemptNo = latestAttempt.attemptNo + 1;
    }
  }

  if (shouldCreateNew) {
    txnId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${attemptNo}`;
  }

  const consumerId = String(userId).slice(-20);
  const mobileForHash = consumerMobileNo ? String(consumerMobileNo).trim() : '';
  const emailForHash = consumerEmailId ? String(consumerEmailId).trim() : '';

  const token = computeToken({
    merchantId,
    txnId: txnId!,
    totalAmount: amountStr,
    consumerId,
    consumerMobileNo: mobileForHash,
    consumerEmailId: emailForHash,
    salt,
    deviceId,
  });

  // Prefer client paymentMode; otherwise scope Paynimo to the order's instrument.
  // `digital` is also used for wallet_partial_worldline — do NOT force netBanking
  // or UPI disappears when the customer selected UPI for the online remainder.
  // Web hosted checkout: always use `all`. Single-mode payloads frequently render
  // an empty instrument list when the scheme isn't configured for that mode alone.
  const orderMethodType = String(
    (order as unknown as { paymentMethod?: { methodType?: string } }).paymentMethod?.methodType || '',
  )
    .trim()
    .toLowerCase();
  const modeFromOrder =
    orderMethodType === 'upi'
      ? 'upi'
      : orderMethodType === 'card'
        ? 'cards'
        : orderMethodType === 'digital'
          ? 'all'
          : undefined;
  const resolvedPaymentMode =
    normalizedPlatform === 'web'
      ? 'all'
      : canonicalizePaynimoPaymentMode(paymentMode || modeFromOrder);

  const idempotencyKey = `worldline:${orderId}:${normalizedPlatform}:${attemptNo}`;

  const sessionPayload = {
    features: buildPaynimoCheckoutFeatures(),
    consumerData: {
      deviceId,
      token,
      returnUrl,
      paymentMode: resolvedPaymentMode,
      merchantId,
      currency: 'INR',
      consumerId,
      consumerMobileNo: mobileForHash,
      consumerEmailId: emailForHash,
      txnId,
      totalAmount: amountStr,
      items: [{ itemId: schemeCode, amount: amountStr, comAmt: '0.00' }],
      customStyle: {
        PRIMARY_COLOR_CODE: '#034703',
        SECONDARY_COLOR_CODE: '#FFFFFF',
        BUTTON_COLOR_CODE_1: '#034703',
        BUTTON_COLOR_CODE_2: '#FFFFFF',
      },
    },
  };

  const sessionDurationMs = 30 * 60 * 1000;
  const sessionExpiresAt = new Date(Date.now() + sessionDurationMs);
  const webAppBaseForRedirect = resolveWebAppBaseUrl(logger, safeCheckoutOrigin || undefined);

  const doc = await WorldlinePayment.findOneAndUpdate(
    { orderId, attemptNo },
    {
      $set: {
        token,
        txnId,
        deviceId,
        amountInr: chargedAmount,
        status: 'created',
        sessionExpiresAt,
        rawSessionRequest: sessionPayload,
        ...(safeCheckoutOrigin ? { checkoutOrigin: safeCheckoutOrigin } : {}),
      },
      $setOnInsert: {
        userId: new mongoose.Types.ObjectId(userId),
        orderId: new mongoose.Types.ObjectId(orderId),
        idempotencyKey,
        merchantId,
        schemeCode,
        platform: normalizedPlatform,
        attemptNo,
      },
    },
    { upsert: true, new: true },
  ).lean();

  // Safe redirect diagnostics only — never log salts, tokens, or merchant secrets.
  logger.info('Worldline payment initiated', {
    event: 'worldline_payment_initiated',
    transactionId: doc!.txnId,
    orderId: String(orderId),
    attemptNo: doc!.attemptNo,
    isNew: shouldCreateNew,
    paymentMode: resolvedPaymentMode,
    returnUrl,
    // Paynimo uses a single returnUrl; cancel/success/failure are status values after verify.
    cancelUrl: webAppBaseForRedirect ? `${webAppBaseForRedirect}/checkout/payment` : null,
    successUrl: webAppBaseForRedirect ? `${webAppBaseForRedirect}/checkout/payment` : null,
    failureUrl: webAppBaseForRedirect ? `${webAppBaseForRedirect}/checkout/payment` : null,
    checkoutOrigin: safeCheckoutOrigin || null,
    webAppBaseUrl: webAppBaseForRedirect,
  });

  logger.info('Worldline session managed', {
    orderId: String(orderId),
    txnId: doc!.txnId,
    attemptNo: doc!.attemptNo,
    isNew: shouldCreateNew,
    checkoutOrigin: safeCheckoutOrigin || null,
  });

  return {
    data: {
      paymentId: String(doc!._id),
      orderId: String(orderId),
      txnId: doc!.txnId,
      attemptNo: doc!.attemptNo,
      hashAlgo: resolveWorldlineHashAlgo(algo),
      sessionPayload,
    },
  };
}

/** Stable synthetic ObjectId for standalone payments (no `customer_orders` row). Scoped per user + client ref. */
function syntheticOrderObjectIdForExternalRef(externalOrderRef: string, userId: string): mongoose.Types.ObjectId {
  const twelve = crypto.createHash('sha256').update(`selorg-payment:${externalOrderRef}:${userId}`, 'utf8').digest().subarray(0, 12);
  return new mongoose.Types.ObjectId(twelve);
}

type CreateWalletTopUpSessionInput = {
  amount: unknown;
  platform?: string;
  algo?: string;
  consumerEmailId?: string;
  consumerMobileNo?: string;
  paymentMode?: string;
  checkoutOrigin?: string;
};

/** Start a Worldline/Paynimo checkout for wallet top-up (no `customer_orders` row involved). */
export async function createWalletTopUpSession(
  userId: string,
  { amount, platform = 'web', algo, consumerEmailId, consumerMobileNo, paymentMode, checkoutOrigin }: CreateWalletTopUpSessionInput,
): Promise<{ error: string } | { data: Record<string, unknown> }> {
  if (!isEnabled()) return { error: 'Worldline payment is not enabled' };
  warnWorldlineMerchantEnvMismatchOnce();

  const uidRaw = userId != null ? String(userId).trim() : '';
  if (!uidRaw || !mongoose.Types.ObjectId.isValid(uidRaw)) {
    return { error: 'Authenticated user id is required' };
  }
  const userObjectId = new mongoose.Types.ObjectId(uidRaw);

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return { error: 'Invalid amount' };
  }
  if (parsedAmount > MAX_TOP_UP_AMOUNT) {
    return { error: `Amount cannot exceed ₹${MAX_TOP_UP_AMOUNT}` };
  }

  const { min, max } = getAmountLimits();
  if (!(parsedAmount >= min && parsedAmount <= max)) {
    return {
      error: `Wallet top-up amount must be between ₹${min} and ₹${max} in this payment environment. Requested ₹${Math.round(parsedAmount * 100) / 100}.`,
    };
  }

  const normalizedPlatform = normalizePlatform(platform) || 'web';
  const deviceId = deviceIdForPlatform(normalizedPlatform, algo);
  if (!deviceId) return { error: 'Unable to determine deviceId for platform' };

  const merchantId = trimEnv(process.env.WORLDLINE_MERCHANT_ID || process.env.WORLDLINE_MERCHANT_CODE);
  const schemeCode = trimEnv(process.env.WORLDLINE_SCHEME_CODE) || 'FIRST';
  const salt = trimEnv(process.env.WORLDLINE_SALT);
  const safeCheckoutOrigin = sanitizeCheckoutOrigin(checkoutOrigin) || '';
  const returnUrl = resolveReturnUrlForPlatform(normalizedPlatform, logger, safeCheckoutOrigin || undefined);
  if (!merchantId || !salt || !returnUrl) return { error: 'Worldline configuration incomplete' };

  const amountStr = formatWorldlineTxnAmount(parsedAmount);
  const externalOrderRef = `wallet-${String(userObjectId).slice(-8)}-${crypto.randomUUID().slice(0, 8)}`;
  const syntheticOrderId = syntheticOrderObjectIdForExternalRef(externalOrderRef, String(userObjectId));

  const latestAttempt = await WorldlinePayment.findOne({
    purpose: 'wallet_topup',
    standaloneCheckout: true,
    userId: userObjectId,
    amountInr: parsedAmount,
    platform: normalizedPlatform,
    status: { $nin: ['success', 'failed', 'cancelled'] },
  }).sort({ attemptNo: -1 });

  let attemptNo = 1;
  let txnId = '';
  let shouldCreateNew = true;

  if (latestAttempt) {
    const isExpired = latestAttempt.sessionExpiresAt && new Date() > latestAttempt.sessionExpiresAt;
    if (!isExpired) {
      txnId = latestAttempt.txnId;
      attemptNo = latestAttempt.attemptNo;
      shouldCreateNew = false;
    }
  }

  if (shouldCreateNew) {
    const lastForRef = await WorldlinePayment.findOne({ purpose: 'wallet_topup', orderId: syntheticOrderId }).sort({ attemptNo: -1 });
    attemptNo = lastForRef ? lastForRef.attemptNo + 1 : 1;
    txnId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${attemptNo}`;
  }

  // When reusing an active session, return its existing payload.
  if (!shouldCreateNew && latestAttempt) {
    return {
      data: {
        paymentId: String(latestAttempt._id),
        purpose: 'wallet_topup',
        clientOrderRef: latestAttempt.externalOrderRef,
        orderId: String(latestAttempt.orderId),
        txnId: latestAttempt.txnId,
        attemptNo: latestAttempt.attemptNo,
        amount: latestAttempt.amountInr,
        hashAlgo: resolveWorldlineHashAlgo(algo),
        sessionPayload: withCurrentPaynimoFeatures(latestAttempt.rawSessionRequest),
      },
    };
  }

  const consumerId = String(userObjectId).slice(-20);
  const mobileForHash = consumerMobileNo ? String(consumerMobileNo).trim() : '';
  const emailForHash = consumerEmailId ? String(consumerEmailId).trim() : '';

  const token = computeToken({
    merchantId,
    txnId,
    totalAmount: amountStr,
    consumerId,
    consumerMobileNo: mobileForHash,
    consumerEmailId: emailForHash,
    salt,
    deviceId,
  });

  const resolvedPaymentMode = canonicalizePaynimoPaymentMode(paymentMode);
  const idempotencyKey = `worldline:wallet_topup:${String(userObjectId)}:${externalOrderRef}:${normalizedPlatform}:${attemptNo}`;

  const sessionPayload = {
    features: buildPaynimoCheckoutFeatures(),
    consumerData: {
      deviceId,
      token,
      returnUrl,
      paymentMode: resolvedPaymentMode,
      merchantId,
      currency: 'INR',
      consumerId,
      consumerMobileNo: mobileForHash,
      consumerEmailId: emailForHash,
      txnId,
      totalAmount: amountStr,
      items: [{ itemId: schemeCode, amount: amountStr, comAmt: '0.00' }],
      customStyle: {
        PRIMARY_COLOR_CODE: '#034703',
        SECONDARY_COLOR_CODE: '#FFFFFF',
        BUTTON_COLOR_CODE_1: '#034703',
        BUTTON_COLOR_CODE_2: '#FFFFFF',
      },
    },
  };

  const sessionExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

  const doc = await WorldlinePayment.findOneAndUpdate(
    { orderId: syntheticOrderId, attemptNo },
    {
      $set: {
        token,
        txnId,
        deviceId,
        amountInr: parsedAmount,
        status: 'created',
        sessionExpiresAt,
        rawSessionRequest: sessionPayload,
        standaloneCheckout: true,
        externalOrderRef,
        purpose: 'wallet_topup',
        walletCredited: false,
        walletCreditedAt: null,
        ...(safeCheckoutOrigin ? { checkoutOrigin: safeCheckoutOrigin } : {}),
      },
      $setOnInsert: {
        userId: userObjectId,
        orderId: syntheticOrderId,
        idempotencyKey,
        merchantId,
        schemeCode,
        platform: normalizedPlatform,
        attemptNo,
      },
    },
    { upsert: true, new: true },
  ).lean();

  const webAppBaseForRedirect = resolveWebAppBaseUrl(logger, safeCheckoutOrigin || undefined);
  logger.info('Worldline payment initiated', {
    event: 'worldline_payment_initiated',
    purpose: 'wallet_topup',
    transactionId: doc!.txnId,
    attemptNo: doc!.attemptNo,
    isNew: shouldCreateNew,
    paymentMode: resolvedPaymentMode,
    returnUrl,
    cancelUrl: webAppBaseForRedirect ? `${webAppBaseForRedirect}/account/wallet` : null,
    successUrl: webAppBaseForRedirect ? `${webAppBaseForRedirect}/account/wallet` : null,
    failureUrl: webAppBaseForRedirect ? `${webAppBaseForRedirect}/account/wallet` : null,
    checkoutOrigin: safeCheckoutOrigin || null,
    webAppBaseUrl: webAppBaseForRedirect,
  });
  logger.info('Wallet top-up session managed', { userId: uidRaw, txnId: doc!.txnId, attemptNo: doc!.attemptNo, isNew: shouldCreateNew });

  return {
    data: {
      paymentId: String(doc!._id),
      purpose: 'wallet_topup',
      clientOrderRef: externalOrderRef,
      orderId: String(syntheticOrderId),
      txnId: doc!.txnId,
      attemptNo: doc!.attemptNo,
      amount: parsedAmount,
      hashAlgo: resolveWorldlineHashAlgo(algo),
      sessionPayload,
    },
  };
}

/**
 * After a verified Worldline success for purpose=wallet_topup, credit the customer wallet once.
 * Safe against webhook + app complete + status poll retries.
 */
export async function maybeCreditWalletForSuccessfulPayment(
  paymentInput: { _id?: unknown; id?: unknown; purpose?: string; status?: string; verificationError?: string } | null,
): Promise<{ error: string } | { alreadyCredited: true } | { balance: number; credited: number; alreadyCredited?: boolean } | null> {
  if (!paymentInput) return null;
  const paymentId = paymentInput._id || paymentInput.id;
  if (!paymentId) return null;
  if (String(paymentInput.purpose || '') !== 'wallet_topup') return null;
  if (paymentInput.status !== 'success' || paymentInput.verificationError !== 'none') return null;

  const claimed = await WorldlinePayment.findOneAndUpdate(
    { _id: paymentId, purpose: 'wallet_topup', walletCredited: { $ne: true } },
    { $set: { walletCredited: true, walletCreditedAt: new Date() } },
    { new: true },
  );
  if (!claimed) {
    return { alreadyCredited: true };
  }

  try {
    const result = await creditWallet(claimed.userId, claimed.amountInr, {
      source: 'payment_topup',
      description: 'Money added to wallet',
      referenceId: claimed.txnId,
      referenceType: 'payment',
    });

    if ('error' in result) {
      await WorldlinePayment.updateOne({ _id: claimed._id }, { $set: { walletCredited: false }, $unset: { walletCreditedAt: 1 } });
      logger.error('Wallet top-up credit failed after verified payment', { paymentId: String(claimed._id), txnId: claimed.txnId, error: result.error });
      return { error: result.error };
    }

    logger.info('Wallet topped up after Worldline payment', {
      paymentId: String(claimed._id),
      txnId: claimed.txnId,
      userId: String(claimed.userId),
      amount: claimed.amountInr,
      balance: result.balance,
      alreadyCredited: !!result.alreadyCredited,
    });

    return result;
  } catch (err) {
    await WorldlinePayment.updateOne({ _id: claimed._id }, { $set: { walletCredited: false }, $unset: { walletCreditedAt: 1 } });
    logger.error('Wallet top-up credit exception', { paymentId: String(claimed._id), error: (err as Error)?.message });
    throw err;
  }
}

const MSG_ORDER = [
  'txn_status',
  'txn_msg',
  'txn_err_msg',
  'clnt_txn_ref',
  'tpsl_bank_cd',
  'tpsl_txn_id',
  'txn_amt',
  'clnt_rqst_meta',
  'tpsl_txn_time',
  'bal_amt',
  'card_id',
  'alias_name',
  'BankTransactionID',
  'mandate_reg_no',
  'token',
];
void MSG_ORDER; // documents the field order verifyGatewayResponse uses internally

type PaymentDoc = mongoose.Document & {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  txnId: string;
  status: string;
  statusCode: string;
  statusMessage: string;
  verificationError: string;
  responseHash: string;
  tpslTxnId: string;
  bankTxnId: string;
  deviceId: string;
  amountInr: number;
  standaloneCheckout?: boolean;
  externalOrderRef?: string;
  purpose?: string;
  sessionExpiresAt?: Date | null;
};

export async function completePayment(
  userId: string,
  { orderId, txnId, response, clientDebug }: { orderId: string; txnId: string; response: unknown; clientDebug?: unknown },
): Promise<{ error: string; data?: Record<string, unknown> } | { data: Record<string, unknown> }> {
  if (!isEnabled()) return { error: 'Worldline payment is not enabled' };

  const salt = trimEnv(process.env.WORLDLINE_SALT);
  if (!salt) return { error: 'Worldline configuration incomplete' };

  const payment = (await WorldlinePayment.findOne({
    orderId: new mongoose.Types.ObjectId(orderId),
    txnId: String(txnId),
  })) as unknown as PaymentDoc | null;
  if (!payment) return { error: 'Payment session not found for order/txnId' };

  if (payment.standaloneCheckout) {
    if (String(payment.userId) !== String(userId)) return { error: 'Unauthorized' };
  }

  const order = payment.standaloneCheckout ? null : await Order.findOne({ _id: orderId, userId: new mongoose.Types.ObjectId(userId) });
  if (!payment.standaloneCheckout && !order) return { error: 'Order not found' };

  if (isTerminal(payment.status) && payment.responseHash) {
    if (payment.status === 'success' && payment.verificationError === 'none') {
      if (order) {
        try {
          await releaseOrderFulfillment(String(orderId));
        } catch (e) {
          logger.warn('releaseOrderFulfillment idempotent path failed', { orderId: String(orderId), error: (e as Error)?.message });
        }
      } else if (payment.purpose === 'wallet_topup') {
        try {
          await maybeCreditWalletForSuccessfulPayment(payment);
        } catch (e) {
          logger.warn('wallet top-up credit idempotent path failed', { orderId: String(orderId), error: (e as Error)?.message });
        }
      }
    }
    return {
      data: {
        orderId: String(orderId),
        txnId: String(txnId),
        status: payment.status,
        statusCode: payment.statusCode,
        statusMessage: payment.statusMessage,
        hashOk: payment.verificationError === 'none',
        tpslTxnId: payment.tpslTxnId,
        bankTxnId: payment.bankTxnId,
        purpose: payment.purpose || 'order',
      },
    };
  }

  // Presentation redirects (`paynimo_bridge=1`) only carry UI hints. Applying them here
  // used to mark real payments failed (mapStatus('failed') + hash mismatch). Ignore and
  // let the client poll /worldline/status — processGatewayReturn already verified.
  const responseObj =
    response && typeof response === 'object' && !Array.isArray(response)
      ? (response as Record<string, unknown>)
      : null;
  const isPresentationOnly =
    !!responseObj &&
    (String(responseObj.paynimo_bridge || '') === '1' ||
      (!String(responseObj.msg || responseObj.hash || responseObj.tpsl_txn_id || responseObj.clnt_txn_ref || responseObj.txn_status || '').trim() &&
        ['success', 'failed', 'cancelled', 'canceled', 'pending'].includes(String(responseObj.status || '').toLowerCase())));

  if (isPresentationOnly) {
    logger.info('Worldline complete ignored presentation-only payload', {
      orderId: String(orderId),
      txnId: String(txnId),
      keys: responseObj ? Object.keys(responseObj) : [],
      paymentStatus: payment.status,
    });
    return {
      data: {
        orderId: String(orderId),
        txnId: String(txnId),
        status: payment.status,
        statusCode: payment.statusCode,
        statusMessage: payment.statusMessage || 'Awaiting verification — poll status',
        hashOk: payment.verificationError === 'none',
        tpslTxnId: payment.tpslTxnId,
        bankTxnId: payment.bankTxnId,
        purpose: payment.purpose || 'order',
        presentationOnly: true,
      },
    };
  }

  logWorldlineCallbackPayload('completePayment', response);

  if (clientDebug && typeof clientDebug === 'object') {
    logger.warn('Worldline complete: client attached SDK debug metadata', { orderId: String(orderId), txnId: String(txnId), clientDebug });
  }

  const rawTopKeys = response && typeof response === 'object' && !Array.isArray(response) ? Object.keys(response as object) : [];

  const { hashOk, amountOk, verificationError, receivedHash, statusCode, statusMessage, normalized, payloadError } = verifyGatewayResponse({
    payment,
    response,
    salt,
    logContext: 'completePayment',
  });

  const tpslEmpty = !String(normalized?.tpsl_txn_id || '').trim();
  const mapped = mapStatus(statusCode);

  const rawGatewayResponseStored =
    response && typeof response === 'object' && !Array.isArray(response)
      ? {
          ...(response as Record<string, unknown>),
          _serverNormalizedKeys: Object.keys(normalized || {}),
          _serverTxnStatus: String(normalized?.txn_status || ''),
          ...(clientDebug && typeof clientDebug === 'object' ? { _clientSdkDebug: clientDebug } : {}),
        }
      : response || null;

  const update: Record<string, unknown> = {
    status: mapped,
    statusCode,
    statusMessage,
    verificationSource: 'app_complete',
    verificationError,
    tpslTxnId: String(normalized?.tpsl_txn_id || ''),
    bankTxnId: String(normalized?.BankTransactionID || ''),
    tpslBankCd: String(normalized?.tpsl_bank_cd || ''),
    tpslTxnTime: String(normalized?.tpsl_txn_time || ''),
    responseHash: receivedHash,
    rawGatewayResponse: rawGatewayResponseStored,
  };

  if (!hashOk || !amountOk) {
    if (mapped === 'cancelled' || mapped === 'failed') {
      update.status = mapped;
      update.statusMessage = statusMessage || (mapped === 'cancelled' ? 'Payment cancelled by user' : 'Payment failed');
    } else {
      update.status = 'unknown';
      update.statusMessage = !hashOk ? (tpslEmpty ? WORLDLINE_ERROR_HASH_MISMATCH_EMPTY_TPSL : 'Hash verification failed') : 'Amount mismatch';
    }
  } else if (tpslEmpty) {
    logger.warn('Worldline verify ok but tpsl_txn_id empty (unusual)', { orderId: String(orderId), txnId: String(txnId), rawTopKeys });
  }

  const finalPayment = await WorldlinePayment.findOneAndUpdate(
    { _id: payment._id, status: { $nin: ['success', 'failed', 'cancelled'] } },
    { $set: update },
    { new: true },
  ).lean();

  const effectivePayment = (finalPayment || (await WorldlinePayment.findById(payment._id).lean())) as unknown as PaymentDoc;

  if (effectivePayment.status === 'success' && effectivePayment.verificationError === 'none') {
    if (order) {
      if ((order as unknown as { status?: string }).status === 'cancelled') {
        logger.warn('Worldline success on cancelled order — refund attention needed', { orderId: String(orderId), txnId: String(txnId) });
      } else {
        (order as unknown as { paymentStatus: string }).paymentStatus = 'paid';
        applyWorldlineInstrumentToOrder(order as unknown as IOrder, effectivePayment as unknown as Record<string, unknown>);
        await order.save();
        try {
          await releaseOrderFulfillment(String(orderId));
        } catch (e) {
          logger.warn('releaseOrderFulfillment failed', { orderId: String(orderId), error: (e as Error)?.message });
        }
      }
    } else if (effectivePayment.purpose === 'wallet_topup') {
      try {
        await maybeCreditWalletForSuccessfulPayment(effectivePayment);
      } catch (e) {
        logger.warn('wallet top-up credit failed', { orderId: String(orderId), error: (e as Error)?.message });
      }
    }
  } else if (effectivePayment.status === 'failed' || effectivePayment.status === 'cancelled') {
    const orderRec = order as unknown as { paymentStatus?: string; fulfillmentReleased?: boolean; save: () => Promise<unknown> } | null;
    if (orderRec && orderRec.paymentStatus !== 'paid' && orderRec.fulfillmentReleased !== true) {
      orderRec.paymentStatus = 'failed';
      await orderRec.save();
      try {
        await voidUnpaidOnlineOrder(
          userId,
          orderId,
          effectivePayment.statusMessage || 'Payment failed',
          effectivePayment.status === 'cancelled' ? 'cancelled' : 'failed',
        );
      } catch (e) {
        logger.warn('voidUnpaidOnlineOrder failed', { orderId: String(orderId), error: (e as Error)?.message });
      }
    }
    if (finalPayment) notifyPaymentOutcome(order as unknown as IOrder | null, effectivePayment.status);
  } else if (effectivePayment.status === 'pending') {
    if (order && finalPayment && payment.status !== 'pending') {
      notifyPaymentOutcome(order as unknown as IOrder, 'pending');
    }
  }

  const outOrderId =
    payment.standaloneCheckout && payment.purpose !== 'wallet_topup' && payment.externalOrderRef ? payment.externalOrderRef : String(orderId);

  const baseData = {
    orderId: outOrderId,
    txnId: String(txnId),
    status: effectivePayment.status,
    statusCode: effectivePayment.statusCode,
    statusMessage: effectivePayment.statusMessage,
    hashOk: effectivePayment.verificationError === 'none',
    tpslTxnId: effectivePayment.tpslTxnId,
    bankTxnId: effectivePayment.bankTxnId,
    verificationError: effectivePayment.verificationError,
    purpose: payment.purpose || 'order',
  };

  if (payloadError) {
    if (payloadError === WORLDLINE_ERROR_INCOMPLETE_NORMALIZE) {
      logger.error('Worldline payment verification blocked (incomplete payload)', { orderId: String(orderId), txnId: String(txnId), verificationError, rawTopKeys });
    } else {
      logger.error('Worldline hash_mismatch with empty tpsl_txn_id', { orderId: String(orderId), txnId: String(txnId), rawTopKeys });
    }
    return { error: payloadError, data: baseData };
  }

  return { data: baseData };
}

/** Lightweight lookup for redirect routing — no status mutation. */
export async function peekGatewayReturnContext(
  response: unknown,
): Promise<{ orderId?: string; txnId?: string; purpose?: string; checkoutOrigin?: string } | null> {
  try {
    const respObj = (response && typeof response === 'object' ? response : {}) as Record<string, unknown>;
    const normalized = normalizeWorldlineGatewayPayload(response);
    const txnId = String(
      normalized.clnt_txn_ref ||
        respObj.clnt_txn_ref ||
        respObj.txnId ||
        respObj.TXN_ID ||
        respObj.clntTxnRef ||
        '',
    ).trim();
    if (!txnId) return null;
    const payment = await WorldlinePayment.findOne({ txnId }).lean();
    if (!payment) return { txnId };
    return {
      txnId,
      orderId: String(payment.orderId),
      purpose: (payment as { purpose?: string }).purpose || 'order',
      checkoutOrigin: (payment as { checkoutOrigin?: string }).checkoutOrigin || '',
    };
  } catch {
    return null;
  }
}

/**
 * Worldline can POST/GET to the merchant returnUrl after checkout.
 * This endpoint must not require customer auth — the gateway calls it directly.
 */
export async function processGatewayReturn({
  response,
  allowedUserId,
}: {
  response: unknown;
  allowedUserId?: string;
}): Promise<{ error: string; data?: Record<string, unknown> } | { data: Record<string, unknown> }> {
  if (!isEnabled()) return { error: 'Worldline payment is not enabled' };
  const salt = trimEnv(process.env.WORLDLINE_SALT);
  if (!salt) return { error: 'Worldline configuration incomplete' };

  logWorldlineCallbackPayload('processGatewayReturn', response);
  const respObj = (response && typeof response === 'object' ? response : {}) as Record<string, unknown>;
  const normalizedLookup = normalizeWorldlineGatewayPayload(response);
  const txnId = String(
    normalizedLookup.clnt_txn_ref ||
      respObj.clnt_txn_ref ||
      respObj.txnId ||
      respObj.TXN_ID ||
      respObj.clntTxnRef ||
      '',
  ).trim();
  if (!txnId) return { error: 'Missing clnt_txn_ref/txnId in gateway response (after normalizing msg / aliases)' };

  const payment = (await WorldlinePayment.findOne({ txnId })) as unknown as PaymentDoc | null;
  if (!payment) return { error: 'Payment session not found for txnId' };

  if (allowedUserId != null && String(allowedUserId).trim() !== '') {
    if (String(payment.userId) !== String(allowedUserId).trim()) return { error: 'Unauthorized' };
  }

  const order = payment.standaloneCheckout ? null : await Order.findOne({ _id: payment.orderId });
  if (!payment.standaloneCheckout && !order) {
    return { error: 'Order not found for payment', data: { checkoutOrigin: (payment as unknown as { checkoutOrigin?: string }).checkoutOrigin || '', purpose: payment.purpose || 'order' } };
  }

  if (isTerminal(payment.status) && payment.responseHash) {
    if (payment.status === 'success' && payment.verificationError === 'none') {
      if (order) {
        try {
          await releaseOrderFulfillment(String(order._id));
        } catch (e) {
          logger.warn('releaseOrderFulfillment gateway return idempotent path failed', { orderId: String(order._id), error: (e as Error)?.message });
        }
      } else if (payment.purpose === 'wallet_topup') {
        try {
          await maybeCreditWalletForSuccessfulPayment(payment);
        } catch (e) {
          logger.warn('wallet top-up credit gateway return idempotent path failed', { orderId: String(payment.orderId), error: (e as Error)?.message });
        }
      }
    }
    return {
      data: {
        orderId: payment.purpose === 'wallet_topup' ? String(payment.orderId) : payment.standaloneCheckout && payment.externalOrderRef ? payment.externalOrderRef : String(order!._id),
        txnId,
        status: payment.status,
        statusCode: payment.statusCode,
        statusMessage: payment.statusMessage,
        hashOk: payment.verificationError === 'none',
        purpose: payment.purpose || 'order',
        amountInr: payment.amountInr,
        checkoutOrigin: (payment as unknown as { checkoutOrigin?: string }).checkoutOrigin || '',
      },
    };
  }

  const rawTopKeys = response && typeof response === 'object' && !Array.isArray(response) ? Object.keys(response as object) : [];

  const { hashOk, amountOk, verificationError, receivedHash, statusCode, statusMessage, normalized, payloadError } = verifyGatewayResponse({
    payment,
    response,
    salt,
    logContext: 'processGatewayReturn',
  });

  const tpslEmpty = !String(normalized?.tpsl_txn_id || '').trim();
  const mapped = mapStatus(statusCode);

  const clientDebugFromBody = respObj.debug ?? respObj.clientSdkDebug;
  const rawGatewayReturnStored =
    response && typeof response === 'object' && !Array.isArray(response)
      ? {
          ...(response as Record<string, unknown>),
          _serverNormalizedKeys: Object.keys(normalized || {}),
          _serverTxnStatus: String(normalized?.txn_status || ''),
          ...(clientDebugFromBody && typeof clientDebugFromBody === 'object' ? { _clientSdkDebug: clientDebugFromBody } : {}),
        }
      : response || null;

  const update: Record<string, unknown> = {
    status: mapped,
    statusCode,
    statusMessage,
    verificationSource: 'gateway_return',
    verificationError,
    tpslTxnId: String(normalized?.tpsl_txn_id || ''),
    bankTxnId: String(normalized?.BankTransactionID || ''),
    tpslBankCd: String(normalized?.tpsl_bank_cd || ''),
    tpslTxnTime: String(normalized?.tpsl_txn_time || ''),
    responseHash: receivedHash,
    rawGatewayReturn: rawGatewayReturnStored,
  };

  if (!hashOk || !amountOk) {
    if (mapped === 'cancelled' || mapped === 'failed') {
      update.status = mapped;
      update.statusMessage = statusMessage || (mapped === 'cancelled' ? 'Payment cancelled by user' : 'Payment failed');
    } else {
      update.status = 'unknown';
      update.statusMessage = !hashOk ? (tpslEmpty ? WORLDLINE_ERROR_HASH_MISMATCH_EMPTY_TPSL : 'Hash verification failed') : 'Amount mismatch';
    }
  }

  const finalPayment = await WorldlinePayment.findOneAndUpdate(
    { _id: payment._id, status: { $nin: ['success', 'failed', 'cancelled'] } },
    { $set: update },
    { new: true },
  ).lean();

  const effectivePayment = (finalPayment || (await WorldlinePayment.findById(payment._id).lean())) as unknown as PaymentDoc;

  if (effectivePayment.status === 'success' && effectivePayment.verificationError === 'none') {
    if (order) {
      if ((order as unknown as { status?: string }).status === 'cancelled') {
        logger.warn('Worldline gateway return success on cancelled order — refund attention needed', { orderId: String(order._id), txnId });
      } else {
        (order as unknown as { paymentStatus: string }).paymentStatus = 'paid';
        applyWorldlineInstrumentToOrder(order as unknown as IOrder, effectivePayment as unknown as Record<string, unknown>);
        await order.save();
        try {
          await releaseOrderFulfillment(String(order._id));
        } catch (e) {
          logger.warn('releaseOrderFulfillment gateway return failed', { orderId: String(order._id), error: (e as Error)?.message });
        }
      }
    } else if (effectivePayment.purpose === 'wallet_topup') {
      try {
        await maybeCreditWalletForSuccessfulPayment(effectivePayment);
      } catch (e) {
        logger.warn('wallet top-up credit gateway return failed', { orderId: String(payment.orderId), error: (e as Error)?.message });
      }
    }
  } else if (effectivePayment.status === 'failed' || effectivePayment.status === 'cancelled') {
    const orderRec = order as unknown as { userId?: unknown; paymentStatus?: string; fulfillmentReleased?: boolean; save: () => Promise<unknown> } | null;
    if (orderRec && orderRec.paymentStatus !== 'paid' && orderRec.fulfillmentReleased !== true) {
      orderRec.paymentStatus = 'failed';
      await orderRec.save();
      try {
        await voidUnpaidOnlineOrder(
          String(orderRec.userId),
          String(order!._id),
          effectivePayment.statusMessage || 'Payment failed',
          effectivePayment.status === 'cancelled' ? 'cancelled' : 'failed',
        );
      } catch (e) {
        logger.warn('voidUnpaidOnlineOrder gateway return failed', { orderId: String(order!._id), error: (e as Error)?.message });
      }
    }
    if (finalPayment) notifyPaymentOutcome(order as unknown as IOrder | null, effectivePayment.status);
  } else if (effectivePayment.status === 'pending') {
    if (order && finalPayment && payment.status !== 'pending') {
      notifyPaymentOutcome(order as unknown as IOrder, 'pending');
    }
  }

  const logOrderId = order ? String(order._id) : String(payment.orderId);

  logger.info('Worldline return processed', {
    orderId: logOrderId,
    txnId,
    status: effectivePayment.status,
    statusCode: effectivePayment.statusCode,
    verificationError: effectivePayment.verificationError,
    tpslTxnId: effectivePayment.tpslTxnId,
  });

  const baseData = {
    orderId: payment.purpose === 'wallet_topup' ? String(payment.orderId) : payment.standaloneCheckout && payment.externalOrderRef ? payment.externalOrderRef : logOrderId,
    txnId,
    status: effectivePayment.status,
    statusCode: effectivePayment.statusCode,
    statusMessage: effectivePayment.statusMessage,
    hashOk: effectivePayment.verificationError === 'none',
    amountOk,
    verificationError: effectivePayment.verificationError,
    tpslTxnId: effectivePayment.tpslTxnId,
    amountInr: effectivePayment.amountInr,
    purpose: payment.purpose || 'order',
    checkoutOrigin: (payment as unknown as { checkoutOrigin?: string }).checkoutOrigin || '',
  };

  if (payloadError) {
    if (payloadError === WORLDLINE_ERROR_INCOMPLETE_NORMALIZE) {
      logger.error('Worldline gateway return blocked (incomplete payload)', { txnId, rawTopKeys });
    } else {
      logger.error('Worldline gateway return hash_mismatch with empty tpsl_txn_id', { txnId, rawTopKeys });
    }
    return { error: payloadError, data: baseData };
  }

  return { data: baseData };
}

/**
 * Customer aborted checkout without the gateway producing any response payload
 * (closed window, browser back, cancel without codes). Marks the attempt
 * cancelled and voids the unpaid order immediately — money-safe (only claims
 * non-terminal attempts, only voids an UNPAID order belonging to the caller).
 */
export async function abortPayment(
  userId: string,
  { orderId, txnId, reason }: { orderId: string; txnId: string; reason?: string },
): Promise<{ error: string } | { data: Record<string, unknown> }> {
  if (!isEnabled()) return { error: 'Worldline payment is not enabled' };
  if (!mongoose.Types.ObjectId.isValid(String(orderId))) return { error: 'Invalid orderId' };

  const payment = (await WorldlinePayment.findOne({
    orderId: new mongoose.Types.ObjectId(orderId),
    txnId: String(txnId),
  })) as unknown as PaymentDoc | null;
  if (!payment) return { error: 'Payment session not found for order/txnId' };
  if (String(payment.userId) !== String(userId)) return { error: 'Unauthorized' };

  const statusMessage = String(reason || '').trim() || 'Payment cancelled by user';

  const claimed = await WorldlinePayment.findOneAndUpdate(
    { _id: payment._id, status: { $nin: ['success', 'failed', 'cancelled'] } },
    { $set: { status: 'cancelled', statusMessage, verificationSource: 'client_abort' } },
    { new: true },
  ).lean();

  const effectivePayment = (claimed || (await WorldlinePayment.findById(payment._id).lean())) as unknown as PaymentDoc;

  if (!payment.standaloneCheckout && (effectivePayment.status === 'cancelled' || effectivePayment.status === 'failed')) {
    const order = await Order.findOne({ _id: payment.orderId, userId: new mongoose.Types.ObjectId(userId) }).lean<IOrder>();
    const orderRec = order as unknown as { _id: unknown; paymentStatus?: string; fulfillmentReleased?: boolean } | null;
    if (orderRec && orderRec.paymentStatus !== 'paid' && orderRec.fulfillmentReleased !== true) {
      try {
        await voidUnpaidOnlineOrder(
          userId,
          String(orderRec._id),
          effectivePayment.statusMessage || statusMessage,
          effectivePayment.status === 'cancelled' ? 'cancelled' : 'failed',
        );
      } catch (e) {
        logger.warn('voidUnpaidOnlineOrder abort failed', { orderId: String(orderId), error: (e as Error)?.message });
      }
    }
  }

  logger.info('Worldline payment aborted by client', { orderId: String(orderId), txnId: String(txnId), claimed: !!claimed, status: effectivePayment.status });

  return {
    data: {
      orderId: String(orderId),
      txnId: String(txnId),
      status: effectivePayment.status,
      statusMessage: effectivePayment.statusMessage,
      purpose: payment.purpose || 'order',
    },
  };
}

export async function getStatus(userId: string, { orderId }: { orderId: string }): Promise<{ error: string } | { data: Record<string, unknown> }> {
  if (!mongoose.Types.ObjectId.isValid(String(orderId))) return { error: 'Invalid orderId' };
  const oid = new mongoose.Types.ObjectId(orderId);
  const userOid = new mongoose.Types.ObjectId(userId);

  const order = await Order.findOne({ _id: oid, userId: userOid }).lean<IOrder>();

  // Wallet top-up / standalone: no CustomerOrder row.
  if (!order) {
    const walletPayments = (await WorldlinePayment.find({ orderId: oid, userId: userOid }).sort({ attemptNo: -1 })) as unknown as PaymentDoc[];
    const walletPayment = walletPayments[0];
    if (!walletPayment || (walletPayment.purpose !== 'wallet_topup' && !walletPayment.standaloneCheckout)) {
      return { error: 'Order not found' };
    }

    if (walletPayment.status === 'success' && walletPayment.verificationError === 'none') {
      try {
        await maybeCreditWalletForSuccessfulPayment(walletPayment);
      } catch (e) {
        logger.warn('wallet top-up credit getStatus self-heal failed', { orderId: String(orderId), error: (e as Error)?.message });
      }
    }

    // Re-read after self-heal so walletCredited is current.
    const freshWalletPayment =
      ((await WorldlinePayment.findById(walletPayment._id).lean()) as unknown as PaymentDoc | null) || walletPayment;
    const credited = !!(freshWalletPayment as unknown as { walletCredited?: boolean }).walletCredited;

    let walletUiState = 'WAITING_FOR_PAYMENT';
    let walletRecommendedAction = 'NONE';
    const isExpired = freshWalletPayment.sessionExpiresAt && new Date() > (freshWalletPayment.sessionExpiresAt as unknown as Date);

    // Credited wins over a later cancel/abort presentation — money already moved.
    if (credited || (freshWalletPayment.status === 'success' && freshWalletPayment.verificationError === 'none')) {
      walletUiState = 'PAID';
      walletRecommendedAction = 'NONE';
    } else if (freshWalletPayment.status === 'pending') {
      walletUiState = 'PENDING_VERIFICATION';
      walletRecommendedAction = 'POLL_STATUS';
    } else if (freshWalletPayment.status === 'unknown') {
      walletUiState = 'UNKNOWN';
      walletRecommendedAction = 'CONTACT_SUPPORT';
    } else if (freshWalletPayment.status === 'failed') {
      walletUiState = 'FAILED';
      walletRecommendedAction = 'RETRY_PAYMENT';
    } else if (freshWalletPayment.status === 'cancelled') {
      walletUiState = 'RETRY_AVAILABLE';
      walletRecommendedAction = 'RETRY_PAYMENT';
    } else if (isTerminal(freshWalletPayment.status) || isExpired) {
      walletUiState = 'RETRY_AVAILABLE';
      walletRecommendedAction = 'RETRY_PAYMENT';
    } else if (freshWalletPayment.status === 'created' || freshWalletPayment.status === 'initiated') {
      walletUiState = 'WAITING_FOR_PAYMENT';
      walletRecommendedAction = 'OPEN_GATEWAY';
    }

    return {
      data: {
        orderId: String(orderId),
        orderPaymentStatus: credited || (freshWalletPayment.status === 'success' && freshWalletPayment.verificationError === 'none') ? 'paid' : 'pending',
        uiState: walletUiState,
        recommendedAction: walletRecommendedAction,
        purpose: freshWalletPayment.purpose || 'order',
        walletCredited: credited,
        amountInr: freshWalletPayment.amountInr,
        latestPayment: {
          txnId: freshWalletPayment.txnId,
          status: freshWalletPayment.status,
          statusCode: freshWalletPayment.statusCode,
          statusMessage: freshWalletPayment.statusMessage,
          verificationError: freshWalletPayment.verificationError,
          isExpired: !!isExpired,
        },
      },
    };
  }

  const orderRec = order as unknown as { paymentStatus?: string; fulfillmentReleased?: boolean };
  const payments = (await WorldlinePayment.find({ orderId: oid }).sort({ attemptNo: -1 })) as unknown as PaymentDoc[];
  const payment = payments[0];

  let uiState = 'WAITING_FOR_PAYMENT';
  let recommendedAction = 'NONE';

  if (!payment) {
    uiState = 'WAITING_FOR_PAYMENT';
    recommendedAction = 'CREATE_SESSION';
  } else {
    const isExpired = payment.sessionExpiresAt && new Date() > (payment.sessionExpiresAt as unknown as Date);

    if (payment.status === 'success' && payment.verificationError === 'none') {
      uiState = 'PAID';
      recommendedAction = 'GO_TO_ORDER';
    } else if (payment.status === 'pending') {
      uiState = 'PENDING_VERIFICATION';
      recommendedAction = 'POLL_STATUS';
    } else if (payment.status === 'unknown') {
      uiState = 'UNKNOWN';
      recommendedAction = 'CONTACT_SUPPORT';
    } else if (isTerminal(payment.status) || isExpired) {
      uiState = 'RETRY_AVAILABLE';
      recommendedAction = 'RETRY_PAYMENT';
    } else if (payment.status === 'created' || payment.status === 'initiated') {
      uiState = 'WAITING_FOR_PAYMENT';
      recommendedAction = 'OPEN_GATEWAY';
    } else if (payment.status === 'failed') {
      uiState = 'FAILED';
      recommendedAction = 'RETRY_PAYMENT';
    } else if (payment.status === 'cancelled') {
      uiState = 'RETRY_AVAILABLE';
      recommendedAction = 'RETRY_PAYMENT';
    }
  }

  logger.info('Payment status check', {
    orderId: String(orderId),
    paymentExists: !!payment,
    status: payment?.status,
    uiState,
    verificationError: payment?.verificationError,
  });

  if (payment && payment.status === 'success' && payment.verificationError === 'none' && orderRec.paymentStatus === 'paid' && orderRec.fulfillmentReleased === false) {
    try {
      await releaseOrderFulfillment(String(orderId));
    } catch (e) {
      logger.warn('releaseOrderFulfillment getStatus self-heal failed', { orderId: String(orderId), error: (e as Error)?.message });
    }
  }

  return {
    data: {
      orderId: String(orderId),
      orderPaymentStatus: orderRec.paymentStatus,
      uiState,
      recommendedAction,
      paymentOutcome: resolvePaymentOutcome(payment as unknown as { status?: string; statusCode?: string; verificationError?: string; statusMessage?: string; sessionExpiresAt?: Date | null }),
      purpose: 'order',
      latestPayment: payment
        ? {
            txnId: payment.txnId,
            attemptNo: (payment as unknown as { attemptNo: number }).attemptNo,
            status: payment.status,
            statusCode: payment.statusCode,
            statusMessage: payment.statusMessage,
            verificationError: payment.verificationError,
            isExpired: payment.sessionExpiresAt ? new Date() > (payment.sessionExpiresAt as unknown as Date) : false,
            updatedAt: (payment as unknown as { updatedAt: Date }).updatedAt,
            verificationSource: (payment as unknown as { verificationSource?: string }).verificationSource,
            tpslTxnId: payment.tpslTxnId,
            bankTxnId: payment.bankTxnId,
          }
        : null,
      allAttempts: payments.map((p) => ({
        txnId: p.txnId,
        attemptNo: (p as unknown as { attemptNo: number }).attemptNo,
        status: p.status,
        statusCode: p.statusCode,
        verificationError: p.verificationError,
        createdAt: (p as unknown as { createdAt: Date }).createdAt,
      })),
    },
  };
}

/** Resolve orderId/txnId from a raw gateway response body when the client omits them (SDK success callback shape). */
export async function resolvePaymentContextFromGatewayResponse(userId: string, response: unknown): Promise<{ error: string } | { orderId: string; txnId: string }> {
  const respObj = (response && typeof response === 'object' ? response : {}) as Record<string, unknown>;
  const txnId = String(respObj.clnt_txn_ref || respObj.txnId || respObj.TXN_ID || respObj.clntTxnRef || '').trim();
  if (!txnId) return { error: 'Unable to resolve txnId from gateway response' };
  const payment = await WorldlinePayment.findOne({ txnId, userId: new mongoose.Types.ObjectId(userId) }).lean();
  if (!payment) return { error: 'Payment session not found for txnId' };
  return { orderId: String(payment.orderId), txnId };
}

// ─── Standalone payment (no customer_orders row) ──────────────────────────────

function standaloneInitiateEnabled(): boolean {
  const flag = String(process.env.PAYMENT_STANDALONE_INITIATE || '').trim().toLowerCase();
  return flag === 'true' || flag === '1' || process.env.NODE_ENV !== 'production';
}

type CreateStandaloneSessionInput = {
  externalOrderRef: string;
  amountInr: number;
  consumerEmailId?: string;
  consumerMobileNo?: string;
  platform?: string;
  algo?: string;
  paymentMode?: string;
};

/** Create a Worldline payment session that is not tied to a customer_orders row.
 *  Enabled only when PAYMENT_STANDALONE_INITIATE=true or NODE_ENV !== production. */
export async function createStandalonePaymentSession(
  userId: string,
  { externalOrderRef, amountInr, consumerEmailId, consumerMobileNo, platform = 'android', algo, paymentMode }: CreateStandaloneSessionInput,
): Promise<{ error: string } | { data: Record<string, unknown> }> {
  if (!isEnabled()) return { error: 'Worldline payment is not enabled' };
  warnWorldlineMerchantEnvMismatchOnce();
  if (!standaloneInitiateEnabled()) {
    return { error: 'Standalone payment initiate is disabled. Set PAYMENT_STANDALONE_INITIATE=true or run with NODE_ENV!=production' };
  }

  const ref = String(externalOrderRef || '').trim();
  if (!ref) return { error: 'orderId (client reference) is required' };

  const uidRaw = userId != null ? String(userId).trim() : '';
  if (!uidRaw || !mongoose.Types.ObjectId.isValid(uidRaw)) return { error: 'Authenticated user id is required' };
  const userOid = new mongoose.Types.ObjectId(uidRaw);

  const normalizedPlatform = normalizePlatform(platform);
  if (!normalizedPlatform) return { error: 'platform must be android, ios, or web' };

  const deviceId = deviceIdForPlatform(normalizedPlatform, algo);
  if (!deviceId) return { error: 'Unable to determine deviceId for platform' };

  const merchantId = trimEnv(process.env.WORLDLINE_MERCHANT_ID || process.env.WORLDLINE_MERCHANT_CODE);
  const schemeCode = trimEnv(process.env.WORLDLINE_SCHEME_CODE) || 'FIRST';
  const salt = trimEnv(process.env.WORLDLINE_SALT);
  const returnUrl = resolveReturnUrlForPlatform(normalizedPlatform, logger);
  if (!merchantId || !salt || !returnUrl) return { error: 'Worldline configuration incomplete' };

  const amount = Number(amountInr);
  const { min, max } = getAmountLimits();
  if (!(amount >= min && amount <= max)) return { error: worldlineAmountRangeError(amount, min, max) };

  const amountStr = formatWorldlineTxnAmount(amount);
  const syntheticOrderId = syntheticOrderObjectIdForExternalRef(ref, uidRaw);

  const latestAttempt = await WorldlinePayment.findOne({
    standaloneCheckout: true,
    externalOrderRef: ref,
    userId: userOid,
    platform: normalizedPlatform,
  }).sort({ attemptNo: -1 });

  let attemptNo = 1;
  let txnId = '';
  let shouldCreateNew = true;

  if (latestAttempt) {
    const isExpired = latestAttempt.sessionExpiresAt && new Date() > (latestAttempt.sessionExpiresAt as unknown as Date);
    if (!isTerminal(latestAttempt.status) && !isExpired) {
      txnId = latestAttempt.txnId;
      attemptNo = latestAttempt.attemptNo;
      shouldCreateNew = false;
    } else {
      attemptNo = latestAttempt.attemptNo + 1;
    }
  }

  if (shouldCreateNew) {
    txnId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${attemptNo}`;
  }

  const consumerId = uidRaw.slice(-20);
  const mobileForHash = consumerMobileNo ? String(consumerMobileNo).trim() : '';
  const emailForHash = consumerEmailId ? String(consumerEmailId).trim() : '';

  const token = computeToken({ merchantId, txnId, totalAmount: amountStr, consumerId, consumerMobileNo: mobileForHash, consumerEmailId: emailForHash, salt, deviceId });
  const resolvedPaymentMode = canonicalizePaynimoPaymentMode(paymentMode);
  const idempotencyKey = `worldline:standalone:${uidRaw}:${ref}:${normalizedPlatform}:${attemptNo}`;

  const sessionPayload = {
    features: buildPaynimoCheckoutFeatures(),
    consumerData: {
      deviceId, token, returnUrl, paymentMode: resolvedPaymentMode, merchantId, currency: 'INR',
      consumerId, consumerMobileNo: mobileForHash, consumerEmailId: emailForHash, txnId, totalAmount: amountStr,
      items: [{ itemId: schemeCode, amount: amountStr, comAmt: '0.00' }],
      customStyle: { PRIMARY_COLOR_CODE: '#034703', SECONDARY_COLOR_CODE: '#FFFFFF', BUTTON_COLOR_CODE_1: '#034703', BUTTON_COLOR_CODE_2: '#FFFFFF' },
    },
  };

  const sessionExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

  const doc = await WorldlinePayment.findOneAndUpdate(
    { orderId: syntheticOrderId, attemptNo },
    {
      $set: { token, txnId, deviceId, amountInr: amount, status: 'created', sessionExpiresAt, rawSessionRequest: sessionPayload, standaloneCheckout: true, externalOrderRef: ref },
      $setOnInsert: { userId: userOid, orderId: syntheticOrderId, idempotencyKey, merchantId, schemeCode, platform: normalizedPlatform, attemptNo },
    },
    { upsert: true, new: true },
  ).lean();

  logger.info('Worldline standalone session', { externalOrderRef: ref, internalOrderId: String(syntheticOrderId), txnId: doc!.txnId, attemptNo: doc!.attemptNo });

  return {
    data: {
      paymentId: String(doc!._id),
      clientOrderRef: ref,
      orderId: String(syntheticOrderId),
      txnId: doc!.txnId,
      attemptNo: doc!.attemptNo,
      hashAlgo: resolveWorldlineHashAlgo(algo),
      sessionPayload,
    },
  };
}

/** Get standalone payment status by external order reference (client-side orderId). */
export async function getStandalonePaymentStatus(
  externalOrderRef: string,
  userId: string,
): Promise<{ error: string } | { data: Record<string, unknown> }> {
  const ref = String(externalOrderRef || '').trim();
  if (!ref) return { error: 'orderId is required' };

  const uidRaw = userId != null ? String(userId).trim() : '';
  if (!uidRaw || !mongoose.Types.ObjectId.isValid(uidRaw)) return { error: 'Authenticated user id is required' };
  const userOid = new mongoose.Types.ObjectId(uidRaw);

  const payments = (await WorldlinePayment.find({ standaloneCheckout: true, externalOrderRef: ref, userId: userOid }).sort({ attemptNo: -1 })) as unknown as PaymentDoc[];
  const payment = payments[0];

  let uiState = 'WAITING_FOR_PAYMENT';
  let recommendedAction = 'CREATE_SESSION';

  if (payment) {
    const isExpired = payment.sessionExpiresAt && new Date() > (payment.sessionExpiresAt as unknown as Date);
    if (payment.status === 'success' && payment.verificationError === 'none') {
      uiState = 'PAID'; recommendedAction = 'NONE';
    } else if (payment.status === 'pending') {
      uiState = 'PENDING_VERIFICATION'; recommendedAction = 'POLL_STATUS';
    } else if (payment.status === 'unknown') {
      uiState = 'UNKNOWN'; recommendedAction = 'CONTACT_SUPPORT';
    } else if (isTerminal(payment.status) || isExpired) {
      uiState = 'RETRY_AVAILABLE'; recommendedAction = 'RETRY_PAYMENT';
    } else if (payment.status === 'created' || payment.status === 'initiated') {
      uiState = 'WAITING_FOR_PAYMENT'; recommendedAction = 'OPEN_GATEWAY';
    } else if (payment.status === 'failed') {
      uiState = 'FAILED'; recommendedAction = 'RETRY_PAYMENT';
    } else if (payment.status === 'cancelled') {
      uiState = 'RETRY_AVAILABLE'; recommendedAction = 'RETRY_PAYMENT';
    }
  }

  return {
    data: {
      clientOrderRef: ref,
      orderId: payment ? String(payment.orderId) : null,
      uiState,
      recommendedAction,
      paymentOutcome: resolvePaymentOutcome(payment),
      latestPayment: payment
        ? {
            txnId: payment.txnId,
            attemptNo: (payment as unknown as { attemptNo: number }).attemptNo,
            status: payment.status,
            statusCode: payment.statusCode,
            statusMessage: payment.statusMessage,
            verificationError: payment.verificationError,
            isExpired: !!(payment.sessionExpiresAt && new Date() > (payment.sessionExpiresAt as unknown as Date)),
            updatedAt: (payment as unknown as { updatedAt: Date }).updatedAt,
          }
        : null,
      allAttempts: payments.map((p) => ({
        txnId: p.txnId,
        attemptNo: (p as unknown as { attemptNo: number }).attemptNo,
        status: p.status,
        statusCode: p.statusCode,
        verificationError: p.verificationError,
        createdAt: (p as unknown as { createdAt: Date }).createdAt,
      })),
    },
  };
}
