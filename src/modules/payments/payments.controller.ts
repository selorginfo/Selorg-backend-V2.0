import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import * as paymentMethodsService from './payment-methods.service';
import * as worldlineService from './worldline.service';
import { resolveWebAppBaseUrl } from './paymentRedirectUrls';
import { logger } from '../../utils/logger';
import type { AddPaymentMethodInput, UpdatePaymentMethodInput, CreateWorldlineSessionInput, CompleteWorldlinePaymentInput, AbortWorldlinePaymentInput } from './payments.validation';
import { statusCodeOf } from '../orders/order-pricing-guard';

function requireCustomerId(req: Request): string {
  if (!req.customer?._id) throw AppError.unauthorized();
  return req.customer._id;
}

function errorOf(x: unknown): string | null {
  return x && typeof x === 'object' && 'error' in x ? String((x as { error: unknown }).error) : null;
}

// ---- Payment methods CRUD (ported from legacy paymentsController.js) ----

export async function getMethods(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const data = await paymentMethodsService.listByUserId(userId);
    res.status(200).json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function addPaymentMethod(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const data = await paymentMethodsService.addMethod(userId, req.body as AddPaymentMethodInput);
    res.status(201).json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function updatePaymentMethod(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const data = await paymentMethodsService.updateMethod(userId, req.params.id, req.body as UpdatePaymentMethodInput);
    if (!data) throw AppError.notFound('Payment method');
    res.status(200).json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

export async function removePaymentMethod(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const ok = await paymentMethodsService.removeMethod(userId, req.params.id);
    if (!ok) throw AppError.notFound('Payment method');
    res.status(200).json(ResponseFormatter.success(null));
  } catch (err) {
    next(err);
  }
}

export async function setDefaultMethod(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const data = await paymentMethodsService.setDefault(userId, req.params.id);
    if (!data) throw AppError.notFound('Payment method');
    res.status(200).json(ResponseFormatter.success(data));
  } catch (err) {
    next(err);
  }
}

// ---- Worldline / Paynimo (ported from legacy worldlinePaymentsController.js) ----

export async function createWorldlineSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const body = req.body as CreateWorldlineSessionInput;
    const result = await worldlineService.createSession(userId, body);
    const err = errorOf(result);
    if (err) {
      const statusCode = statusCodeOf(result, 400);
      res.status(statusCode).json(ResponseFormatter.error(err, statusCode));
      return;
    }
    res.status(200).json(ResponseFormatter.success((result as { data: unknown }).data));
  } catch (err) {
    next(err);
  }
}

export async function completeWorldlinePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const { orderId, txnId, response, debug: clientDebug } = req.body as CompleteWorldlinePaymentInput;

    let resolvedOrderId = orderId != null ? String(orderId).trim() : '';
    let resolvedTxnId = txnId != null ? String(txnId).trim() : '';

    if (!resolvedOrderId || !resolvedTxnId) {
      const ctx = await worldlineService.resolvePaymentContextFromGatewayResponse(userId, response);
      const ctxErr = errorOf(ctx);
      if (ctxErr) {
        res.status(400).json(ResponseFormatter.error(ctxErr, 400));
        return;
      }
      const c = ctx as { orderId: string; txnId: string };
      resolvedOrderId = resolvedOrderId || c.orderId;
      resolvedTxnId = resolvedTxnId || c.txnId;
    }

    if (!resolvedOrderId) {
      res.status(400).json(ResponseFormatter.error('orderId is required', 400));
      return;
    }
    if (!resolvedTxnId) {
      res.status(400).json(ResponseFormatter.error('txnId is required', 400));
      return;
    }

    const result = await worldlineService.completePayment(userId, { orderId: resolvedOrderId, txnId: resolvedTxnId, response, clientDebug });
    const err = errorOf(result);
    if (err) {
      const statusCode = statusCodeOf(result, 400);
      res.status(statusCode).json(ResponseFormatter.error(err, statusCode, (result as { data?: unknown }).data));
      return;
    }
    res.status(200).json(ResponseFormatter.success((result as { data: unknown }).data));
  } catch (err) {
    next(err);
  }
}

export async function abortWorldlinePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const body = req.body as AbortWorldlinePaymentInput;
    const result = await worldlineService.abortPayment(userId, body);
    const err = errorOf(result);
    if (err) {
      res.status(400).json(ResponseFormatter.error(err, 400));
      return;
    }
    res.status(200).json(ResponseFormatter.success((result as { data: unknown }).data));
  } catch (err) {
    next(err);
  }
}

export async function getWorldlineStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = requireCustomerId(req);
    const orderId = String(req.query.orderId || '');
    const result = await worldlineService.getStatus(userId, { orderId });
    const err = errorOf(result);
    if (err) {
      res.status(400).json(ResponseFormatter.error(err, 400));
      return;
    }
    res.status(200).json(ResponseFormatter.success((result as { data: unknown }).data));
  } catch (err) {
    next(err);
  }
}

// ---- Gateway return (no customer auth — Worldline calls this directly) ----

function resolveWorldlineResponseStatus(status: unknown): 'success' | 'cancelled' | 'pending' | 'failed' {
  const key = String(status || '').trim().toLowerCase();
  if (key === 'success') return 'success';
  if (['cancelled', 'canceled', 'cancel', 'user_cancelled', 'user_canceled', 'aborted', 'abort', '0392', '0002'].includes(key)) return 'cancelled';
  if (key === 'pending' || key === '0398' || key === '0396' || key === 'unknown') return 'pending';
  if (key === 'timeout' || key === 'error') return 'failed';
  return 'failed';
}

/**
 * Presentation for the browser redirect after the gateway return — a UI hint only.
 * Success is derived ONLY from the server-verified result, never the raw (attacker-controllable)
 * gateway query string.
 */
function inferWorldlineReturnPresentation(response: Record<string, unknown>, resultStatus: string | null, errorMessage?: string): { status: string; message: string } {
  const merged = response && typeof response === 'object' ? response : {};
  const err = String(errorMessage || '').trim();

  if (resultStatus) {
    const resolved = resolveWorldlineResponseStatus(resultStatus);
    if (resolved === 'success') return { status: 'success', message: '' };
    if (resolved === 'cancelled') return { status: 'cancelled', message: 'You cancelled the payment. No amount has been charged.' };
    if (resolved === 'pending') return { status: 'pending', message: 'Your payment is being verified.' };
    return { status: 'failed', message: err };
  }

  const txnStatus = String(merged.txn_status || merged.statusCode || merged.TXN_STATUS || merged.status || '').trim().toLowerCase();

  if (txnStatus === '0392' || txnStatus === '0002' || txnStatus === 'cancelled' || txnStatus === 'cancel') {
    return { status: 'cancelled', message: 'You cancelled the payment. No amount has been charged.' };
  }

  const errLower = err.toLowerCase();
  if (errLower.includes('cancel') || errLower.includes('0392') || errLower.includes('missing clnt_txn_ref') || errLower.includes('missing txnid') || Object.keys(merged).length === 0) {
    return { status: 'cancelled', message: 'You cancelled the payment. No amount has been charged.' };
  }

  if (txnStatus === '0300' || txnStatus === 'success' || txnStatus === '0398' || txnStatus === '0396') {
    return { status: 'pending', message: 'Your payment is being verified.' };
  }

  return { status: 'failed', message: err };
}

function buildPaymentResultRedirectUrl({
  status,
  message,
  orderId,
  txnId,
  amount,
  purpose,
  checkoutOrigin,
}: {
  status: string;
  message?: string;
  orderId?: unknown;
  txnId?: unknown;
  amount?: unknown;
  purpose?: unknown;
  checkoutOrigin?: unknown;
}): string {
  const base = resolveWebAppBaseUrl(logger, checkoutOrigin);
  // Current V1.3 web app payment page is /checkout/payment (not legacy /payment on www.selorg.com).
  const path = purpose === 'wallet_topup' ? '/account/wallet' : '/checkout/payment';
  const url = new URL(path, base.endsWith('/') ? base : `${base}/`);
  url.searchParams.set('paynimo_bridge', '1');
  url.searchParams.set('status', resolveWorldlineResponseStatus(status));
  if (orderId) url.searchParams.set('orderId', String(orderId));
  if (txnId) url.searchParams.set('txnId', String(txnId));
  if (amount != null && String(amount).trim() !== '') url.searchParams.set('amount', String(amount));
  if (purpose) url.searchParams.set('purpose', String(purpose));
  if (message) url.searchParams.set('message', String(message).slice(0, 500));
  return url.toString();
}

function redirectToPaymentResultPage(
  res: Response,
  payload: { status: string; message?: string; orderId?: unknown; txnId?: unknown; amount?: unknown; purpose?: unknown; checkoutOrigin?: unknown },
): void {
  const redirectUrl = buildPaymentResultRedirectUrl(payload);
  const webBase = resolveWebAppBaseUrl(logger, payload.checkoutOrigin);
  const resultPath = payload.purpose === 'wallet_topup' ? '/account/wallet' : '/checkout/payment';
  logger.info('WORLDLINE_RETURN_REDIRECT', {
    event: 'worldline_return_redirect',
    status: payload.status,
    orderId: payload.orderId || '',
    txnId: payload.txnId || '',
    redirectUrl,
    webAppBaseUrl: webBase,
    cancelUrl: `${webBase}${resultPath}`,
    successUrl: `${webBase}${resultPath}`,
    failureUrl: `${webBase}${resultPath}`,
    checkoutOrigin: payload.checkoutOrigin || null,
  });
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Selorg-Payment-Return', 'redirect-v2');
  res.setHeader('X-Selorg-Redirect-Target', redirectUrl);
  res.redirect(302, redirectUrl);
}

export async function worldlineReturn(req: Request, res: Response): Promise<void> {
  try {
    const response = { ...(req.query || {}), ...(req.body || {}) } as Record<string, unknown>;

    logger.info('WORLDLINE_RETURN_RECEIVED', {
      event: 'worldline_return_received',
      method: req.method,
      contentType: req.headers['content-type'] || '',
      queryKeys: Object.keys(req.query || {}),
      bodyKeys: Object.keys(req.body || {}),
    });

    const result = await worldlineService.processGatewayReturn({ response });
    const data = (result as { data?: Record<string, unknown> }).data;
    const gatewayAmount = response?.txn_amt ?? response?.txnAmount ?? response?.amount ?? data?.amountInr ?? '';

    const err = errorOf(result);
    if (err) {
      const presentation = inferWorldlineReturnPresentation(response, null, err);
      // Always forward purpose when known so wallet top-ups never land on order UI.
      redirectToPaymentResultPage(res, {
        status: presentation.status,
        message: presentation.message || String(err),
        orderId: data?.orderId,
        txnId: data?.txnId,
        amount: gatewayAmount,
        purpose: data?.purpose,
        checkoutOrigin: data?.checkoutOrigin,
      });
      return;
    }

    const presentation = inferWorldlineReturnPresentation(response, String(data!.status), String(data!.statusMessage || ''));
    redirectToPaymentResultPage(res, {
      status: presentation.status,
      message: presentation.message || String(data!.statusMessage || ''),
      orderId: data!.orderId,
      txnId: data!.txnId,
      amount: gatewayAmount || data!.amountInr,
      purpose: data!.purpose,
      checkoutOrigin: data!.checkoutOrigin,
    });
  } catch (err) {
    logger.error('worldline return error', { error: (err as Error)?.message });
    // Recover purpose when possible so wallet top-ups still redirect to /account/wallet.
    // Do NOT re-run processGatewayReturn (may have partially applied updates).
    const response = { ...(req.query || {}), ...(req.body || {}) } as Record<string, unknown>;
    const recovered = await worldlineService.peekGatewayReturnContext(response).catch(() => null);
    redirectToPaymentResultPage(res, {
      status: 'failed',
      message: 'We could not confirm your payment status right now. Please try again.',
      orderId: recovered?.orderId,
      txnId: recovered?.txnId,
      purpose: recovered?.purpose,
      checkoutOrigin: recovered?.checkoutOrigin,
    });
  }
}
