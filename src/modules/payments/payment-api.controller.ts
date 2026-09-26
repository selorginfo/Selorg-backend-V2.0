import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import { logger } from '../../utils/logger';
import { Order } from '../orders/order.model';
import { isPositivePrice, matchOrderPayment, payableAmount, pricingFromOrder, statusCodeOf } from '../orders/order-pricing-guard';
import {
  createStandalonePaymentSession,
  processGatewayReturn,
  getStandalonePaymentStatus,
} from './worldline.service';
import { WorldlinePayment } from './worldline-payment.model';

function isValidIso8601(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  return !isNaN(Date.parse(s));
}

/**
 * POST /api/payment/initiate
 * Auth: Bearer JWT (customer).
 * Body: { orderId, amount, customerEmail?, customerPhone, platform?, algo?, paymentMode? }
 */
export async function initiateStandalonePayment(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body || {};
    const { orderId: clientOrderId, amount, customerEmail, customerPhone, platform = 'android', algo, paymentMode } = body;

    if (clientOrderId == null || clientOrderId === '') {
      res.status(400).json({ success: false, message: 'orderId is required' });
      return;
    }
    if (amount == null || Number.isNaN(Number(amount))) {
      res.status(400).json({ success: false, message: 'amount is required' });
      return;
    }
    if (!isPositivePrice(amount)) {
      res.status(400).json({ success: false, message: 'Item price cannot be zero.' });
      return;
    }

    let chargedAmount = Number(amount);
    if (mongoose.Types.ObjectId.isValid(String(clientOrderId))) {
      const order = await Order.findOne({ _id: clientOrderId, userId: req.customer!._id }).lean();
      if (order) {
        const mismatch = matchOrderPayment(order, chargedAmount);
        if (mismatch) {
          res.status(mismatch.statusCode).json({ success: false, message: mismatch.error });
          return;
        }
        chargedAmount = payableAmount(pricingFromOrder(order));
      }
    }
    if (!customerEmail && !customerPhone) {
      res.status(400).json({ success: false, message: 'customerEmail or customerPhone is required' });
      return;
    }

    const result = await createStandalonePaymentSession(String(req.customer!._id), {
      externalOrderRef: String(clientOrderId),
      amountInr: chargedAmount,
      consumerEmailId: customerEmail ? String(customerEmail).trim() : '',
      consumerMobileNo: customerPhone ? String(customerPhone).trim() : '',
      platform,
      algo,
      paymentMode,
    });

    if ('error' in result) {
      res.status(400).json({ success: false, message: result.error });
      return;
    }

    res.status(200).json({
      success: true,
      data: result.data,
      meta: {
        clientOrderRef: (result.data as Record<string, unknown>).clientOrderRef,
        note: 'Poll GET /api/payment/status/:orderId with the same Bearer token.',
      },
    });
  } catch (err) {
    logger.error('payment initiate error', { error: (err as Error)?.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/payment/callback
 * Auth: Bearer JWT (customer). App/SDK posts gateway payload; ownership verified vs payment.userId.
 */
export async function paymentCallback(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body || {};

    logger.info('POST /api/payment/callback raw request', {
      contentType: req.headers['content-type'],
      bodyKeys: Object.keys(body),
    });

    const merged = { ...(req.query || {}), ...body };
    const result = await processGatewayReturn({ response: merged, allowedUserId: String(req.customer!._id) });

    if ('error' in result && result.error === 'Unauthorized') {
      res.status(403).json({ success: false, message: result.error });
      return;
    }
    if ('error' in result) {
      res.status(statusCodeOf(result, 400)).json({
        success: false,
        message: result.error,
        ...((result as { data?: Record<string, unknown> }).data ? { data: (result as { data?: Record<string, unknown> }).data } : {}),
      });
      return;
    }

    const data = result.data as Record<string, unknown>;
    const status = String(data.status || '').toLowerCase().trim();
    const hashOk = data.hashOk !== false;
    const verr = data.verificationError;
    const captureSuccess = status === 'success' && hashOk && (typeof verr !== 'string' || verr === '' || verr === 'none');

    if (!captureSuccess) {
      const msg =
        data && typeof data.statusMessage === 'string' && String(data.statusMessage).trim()
          ? String(data.statusMessage).trim()
          : 'Payment was not completed';
      res.status(400).json({ success: false, message: msg, data });
      return;
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    logger.error('payment callback error', { error: (err as Error)?.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * GET /api/payment/status/:orderId
 * Auth: Bearer JWT (customer). Scoped to authenticated user via externalOrderRef lookup.
 */
export async function getPaymentStatus(req: Request, res: Response): Promise<void> {
  try {
    const result = await getStandalonePaymentStatus(req.params.orderId, String(req.customer!._id));
    if ('error' in result) {
      res.status(400).json({ success: false, message: result.error });
      return;
    }
    res.status(200).json({ success: true, data: result.data });
  } catch (err) {
    logger.error('payment status error', { error: (err as Error)?.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * POST /api/payment/transaction-status
 * No auth — Type O post-transaction reconciliation query initiated by the gateway itself.
 * Responds with payment status for the given txnId/orderId.
 */
export async function getTransactionStatusPostTxn(req: Request, res: Response): Promise<void> {
  const startedAt = Date.now();
  const { merchantId, txnId, orderId, txnAmount, requestType, queryTimestamp } = req.body || {};

  logger.info('Type O status query received', {
    txnId: String(txnId || ''),
    orderId: String(orderId || ''),
    requestType: String(requestType || ''),
    requestTimestamp: new Date().toISOString(),
  });

  const expectedMerchantId = String(
    process.env.WORLDLINE_MERCHANT_ID || process.env.WORLDLINE_MERCHANT_CODE || '',
  ).trim();
  const merchantMatches =
    String(merchantId || '').trim() !== '' && String(merchantId).trim() === expectedMerchantId;
  const requiredFieldsPresent =
    String(merchantId || '').trim() !== '' &&
    String(txnId || '').trim() !== '' &&
    String(orderId || '').trim() !== '' &&
    String(requestType || '').trim() !== '' &&
    isValidIso8601(String(queryTimestamp || ''));

  logger.info('Type O request validation', {
    requestTypeValid: requestType === 'O',
    merchantMatches,
    requiredFieldsPresent,
  });

  if (!requiredFieldsPresent || requestType !== 'O') {
    res.status(400).json({
      success: false,
      message: 'Invalid Type O query — required fields: merchantId, txnId, orderId, requestType=O, queryTimestamp (ISO 8601)',
      processingTime: Date.now() - startedAt,
    });
    return;
  }

  if (!merchantMatches) {
    logger.warn('Type O merchantId mismatch', {
      received: String(merchantId || '').slice(0, 4) + '***',
      expectedLength: expectedMerchantId.length,
    });
    res.status(403).json({ success: false, message: 'merchantId mismatch' });
    return;
  }

  try {
    const payment = await WorldlinePayment.findOne({ txnId: String(txnId).trim() }).lean();
    const processingTime = Date.now() - startedAt;

    if (!payment) {
      res.status(200).json({
        success: true,
        found: false,
        txnId,
        orderId,
        status: 'UNKNOWN',
        message: 'Transaction not found in system',
        processingTime,
      });
      return;
    }

    res.status(200).json({
      success: true,
      found: true,
      txnId: payment.txnId,
      orderId: String(payment.orderId),
      status: String(payment.status || '').toUpperCase(),
      verificationError: payment.verificationError || null,
      amountInr: payment.amountInr,
      requestedTxnAmount: txnAmount,
      processingTime,
    });
  } catch (err) {
    logger.error('Type O transaction status error', { error: (err as Error)?.message });
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
}
