import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { Order } from '../orders/order.model';
import { CustomerUser } from '../auth/auth.model';
import * as walletService from '../wallet/wallet.service';
import * as refundsRepository from './refunds.repository';
import type { CreateRefundRequestInput } from './refunds.validation';

/**
 * Ported from legacy `customer-backend/services/refundsService.js`. RefundRequest itself is
 * created by `orders/cancellation.service.ts` (self_service channel) and by
 * `triggerAutoRefundForMissingItems` below (auto_missing_item channel, called by the
 * darkstore/picker sub-app once that's ported — not wired to anything yet since darkstore
 * doesn't exist in selorg-service). This module is the customer-facing read/create surface.
 */

const AUTO_APPROVE_THRESHOLD = 500;

function mapStatusForCustomer(status: string): 'completed' | 'rejected' | 'pending' {
  if (status === 'processed' || status === 'approved') return 'completed';
  if (status === 'rejected') return 'rejected';
  return 'pending';
}

function getStatusText(status: string): string {
  const map: Record<string, string> = {
    pending: 'Refund pending',
    approved: 'Refund approved',
    processed: 'Refund completed',
    rejected: 'Refund rejected',
    escalated: 'Refund under review',
  };
  return map[status] || 'Refund pending';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRefundForCustomer(refund: any) {
  return {
    id: String(refund._id),
    orderId: refund.orderId,
    orderNumber: refund.orderNumber || `Order #${refund.orderId}`,
    date: refund.requestedAt ? new Date(refund.requestedAt).toISOString() : null,
    status: mapStatusForCustomer(refund.status),
    statusText: getStatusText(refund.status),
    amount: refund.amount,
    currency: refund.currency,
    reasonCode: refund.reasonCode,
    reasonText: refund.reasonText,
  };
}

export async function listRefunds(customerId: string, page = 1, pageSize = 20) {
  const safePage = Math.max(1, page);
  const skip = (safePage - 1) * pageSize;
  const [refunds, total] = await refundsRepository.findByCustomer(customerId, skip, pageSize);
  return {
    refunds: refunds.map(mapRefundForCustomer),
    pagination: { page: safePage, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
  };
}

export async function getRefundById(customerId: string, refundId: string) {
  const refund = await refundsRepository.findByIdForCustomer(refundId);
  if (!refund) return null;
  if (String(refund.customerId) !== String(customerId)) return null;
  return mapRefundForCustomer(refund);
}

export async function getRefundDetailsForCustomer(customerId: string, refundId: string) {
  const refund = await refundsRepository.findByIdForCustomer(refundId);
  if (!refund) return null;
  if (String(refund.customerId) !== String(customerId)) return null;

  const orderQuery: Record<string, unknown> = { userId: new mongoose.Types.ObjectId(customerId) };
  if (mongoose.Types.ObjectId.isValid(String(refund.orderId))) {
    orderQuery._id = new mongoose.Types.ObjectId(String(refund.orderId));
  } else {
    orderQuery.$or = [{ orderNumber: refund.orderId }, { _id: refund.orderId }];
  }
  const order = await Order.findOne(orderQuery).lean();

  const items = (order?.items || []).map((it: Record<string, unknown>, idx: number) => ({
    id: String(it._id || idx + 1),
    name: it.productName || 'Item',
    weight: it.variantSize || '',
    discountedPrice: `₹${it.price ?? 0}`,
    originalPrice: it.originalPrice ? `₹${it.originalPrice}` : undefined,
    imageUrl: it.image,
  }));

  const requestedAt = refund.requestedAt ? new Date(refund.requestedAt) : new Date();
  const approvedAmount = ['processed', 'approved'].includes(refund.status) ? refund.amount : 0;

  return {
    id: String(refund._id),
    orderNumber: order?.orderNumber || refund.orderId || `Order #${refund.orderId}`,
    dateTime: requestedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
    totalItems: `${items.length} item${items.length !== 1 ? 's' : ''}`,
    refundAmountRequested: `₹${refund.amount}`,
    refundAmountApproved: `₹${approvedAmount}`,
    status: mapStatusForCustomer(refund.status),
    products: items,
  };
}

export async function createRefundRequest(customerId: string, body: CreateRefundRequestInput) {
  const { orderId, reasonCode, reasonText, amount, currency = 'INR' } = body;

  const user = await CustomerUser.findById(customerId).lean();
  if (!user) throw AppError.notFound('Customer');

  const orderMatch: Record<string, unknown>[] = [{ orderNumber: orderId }];
  if (mongoose.Types.ObjectId.isValid(orderId)) orderMatch.unshift({ _id: orderId });
  const order = await Order.findOne({
    $or: orderMatch,
    userId: customerId,
  }).lean();
  if (!order) throw AppError.notFound('Order');

  const refundAmount = typeof amount === 'number' && amount > 0 ? amount : order.totalBill ?? order.itemTotal ?? 0;
  if (refundAmount <= 0) throw AppError.badRequest('Invalid refund amount');

  const existing = await refundsRepository.findExistingActiveForOrder(String(order._id), customerId);
  if (existing) throw AppError.conflict('Refund request already exists for this order');

  const refund = await refundsRepository.createRefundRequest({
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    customerId: String(customerId),
    customerName: user.name || user.email || 'Customer',
    customerEmail: user.email || '',
    reasonCode,
    reasonText,
    amount: refundAmount,
    currency: currency || 'INR',
    status: 'pending',
    channel: 'self_service',
  });

  return mapRefundForCustomer(refund);
}

/**
 * Ported from legacy `autoRefundService.js::triggerAutoRefundForMissingItems`. Not wired to
 * any caller yet — the darkstore/picker "missing items during picking" flow that invokes this
 * doesn't exist in selorg-service. Kept here, ready for that future phase to call.
 *
 * Deviation from legacy: legacy's `creditWallet` helper here did a non-atomic
 * read-modify-write (findOne -> mutate -> save, no session, no idempotency guard) — a real
 * race-condition bug if two refunds landed concurrently. This uses the already-hardened
 * `wallet.service.creditWallet` (idempotent on referenceId, atomic balance update) instead of
 * reimplementing that unsafe pattern.
 */
export async function triggerAutoRefundForMissingItems(
  orderId: string,
  missingItems: Array<{ productId?: unknown; productName?: string; quantity?: number; refundAmount?: number; price?: number }>,
) {
  const order = await Order.findById(orderId).lean();
  if (!order) throw new Error(`Order ${orderId} not found`);

  const refundAmount = missingItems.reduce((sum, item) => sum + (item.refundAmount || (item.price || 0) * (item.quantity || 0)), 0);
  if (refundAmount <= 0) return null;

  const status = refundAmount <= AUTO_APPROVE_THRESHOLD ? 'approved' : 'pending';

  // Legacy bug fix: `autoRefundService.js` hardcoded customerEmail: '' here, but
  // RefundRequest.customerEmail is a required schema field — every call to this function
  // would throw a validation error in production. Look up the real customer instead, same as
  // the self-service createRefundRequest path above.
  const user = await CustomerUser.findById(order.userId).lean();

  const refund = await refundsRepository.createRefundRequest({
    orderId: String(order._id),
    orderNumber: order.orderNumber,
    customerId: String(order.userId),
    customerName: user?.name || user?.email || 'Customer',
    customerEmail: user?.email || 'no-email@selorg.internal',
    reasonCode: 'item_not_available',
    reasonText: `${missingItems.length} item(s) not available during picking`,
    amount: refundAmount,
    currency: 'INR',
    status,
    channel: 'auto_missing_item',
    refundMethod: 'wallet',
    missingItems: missingItems.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      refundAmount: item.refundAmount || (item.price || 0) * (item.quantity || 0),
    })),
    timeline: [
      { status: 'pending', timestamp: new Date(), note: 'Auto-created from missing items during picking' },
      ...(status === 'approved'
        ? [{ status: 'approved', timestamp: new Date(), note: `Auto-approved (below ₹${AUTO_APPROVE_THRESHOLD} threshold)` }]
        : []),
    ],
  });

  await Order.findByIdAndUpdate(orderId, {
    refundId: refund._id,
    refundStatus: refund.status,
    refundAmount,
  });

  if (refund.status === 'approved') {
    const result = await walletService.creditWallet(order.userId, refundAmount, {
      source: 'refund',
      referenceId: refund._id.toString(),
      referenceType: 'refund',
      description: 'Refund for order — missing items',
    });
    if ('error' in result) {
      throw new Error(`Auto-refund wallet credit failed: ${result.error}`);
    }
  }

  return refund;
}
