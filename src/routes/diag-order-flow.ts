/**
 * Temporary local diagnostic endpoint — hit via running selorg-service mongoose.
 * Mounted only when DIAG_ORDER_FLOW=1.
 */
import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import { Order } from '../modules/orders/order.model';
import { HHDOrder, HHDAssignOrder, HHDCompletedOrder, HHDUser } from '../modules/hhd/hhd.models';
import { PickerUser } from '../modules/picker/picker.models';
import { DEFAULT_HUB_KEY } from '../modules/orders/fulfillment.service';
import { ResponseFormatter } from '../utils/response';

export const diagOrderFlowRouter = Router();

diagOrderFlowRouter.get('/order-flow', async (req: Request, res: Response) => {
  const q = String(req.query.orderNumber || req.query.orderId || '').trim();
  const order = q
    ? mongoose.isValidObjectId(q)
      ? await Order.findById(q).lean()
      : await Order.findOne({ orderNumber: q }).lean()
    : await Order.findOne({}).sort({ updatedAt: -1 }).lean();

  if (!order) {
    res.status(404).json(ResponseFormatter.error('Order not found', 404, null, { appCode: 'NOT_FOUND' }));
    return;
  }

  const orderNumber = String((order as any).orderNumber || '');
  const [hhd, hhdDone, assign, riders, hhdUsers] = await Promise.all([
    HHDOrder.findOne({ orderId: orderNumber }).lean(),
    HHDCompletedOrder.findOne({ orderId: orderNumber }).lean(),
    HHDAssignOrder.findOne({ orderId: orderNumber }).lean(),
    PickerUser.find({})
      .sort({ updatedAt: -1 })
      .limit(10)
      .select('name phone status isOnline currentLocationId deliveryMode workforceRole')
      .lean(),
    HHDUser.find({}).limit(5).select('name warehouse darkstore mobile').lean(),
  ]);

  const o = order as any;
  const availableFilterExplain = {
    pickerId: o.pickerId ?? null,
    riderStage: o.riderStage ?? null,
    status: o.status,
    deliveryType: o.deliveryType ?? null,
    offerHubKey: o.offerHubKey ?? null,
    offerExpiresAt: o.offerExpiresAt ?? null,
    DEFAULT_HUB_KEY,
    wouldPassAvailableFilter: {
      pickerIdNull: o.pickerId == null,
      riderStageOffered: o.riderStage === 'offered',
      statusOk: ['confirmed', 'getting-packed'].includes(o.status),
      deliveryTypeStandardOrMissing: o.deliveryType == null || o.deliveryType === 'standard' || o.deliveryType === 'bulk',
      note: 'listAvailableOrders requires deliveryType EXACT match to rider mode (standard|bulk) — missing field FAILS',
    },
  };

  res.json(
    ResponseFormatter.success({
      customerOrder: {
        id: String(o._id),
        orderNumber: o.orderNumber,
        status: o.status,
        riderStage: o.riderStage ?? null,
        pickerId: o.pickerId ? String(o.pickerId) : null,
        riderId: o.riderId ?? null,
        offerHubKey: o.offerHubKey ?? null,
        deliveryType: o.deliveryType ?? null,
        bagCode: o.bagCode ?? null,
        offerExpiresAt: o.offerExpiresAt ?? null,
        updatedAt: o.updatedAt,
        timelineTail: Array.isArray(o.timeline) ? o.timeline.slice(-3) : [],
      },
      hhdOrder: hhd
        ? {
            orderId: (hhd as any).orderId,
            status: (hhd as any).status,
            hubKey: (hhd as any).hubKey ?? null,
            bagId: (hhd as any).bagId ?? null,
            rackLocation: (hhd as any).rackLocation ?? null,
            userId: (hhd as any).userId ? String((hhd as any).userId) : null,
          }
        : null,
      hhdCompleted: hhdDone
        ? {
            orderId: (hhdDone as any).orderId,
            status: (hhdDone as any).status,
            rackLocation: (hhdDone as any).rackLocation ?? null,
            completedAt: (hhdDone as any).completedAt ?? null,
          }
        : null,
      assignOrder: assign
        ? {
            orderId: (assign as any).orderId,
            status: (assign as any).status,
            handedOver: (assign as any).handedOver ?? false,
            hub: (assign as any).hub ?? null,
          }
        : null,
      riders: (riders as any[]).map((r) => ({
        id: String(r._id),
        name: r.name,
        phone: r.phone,
        status: r.status,
        isOnline: r.isOnline,
        currentLocationId: r.currentLocationId ?? null,
        deliveryMode: r.deliveryMode ?? null,
        workforceRole: r.workforceRole ?? null,
      })),
      hhdUsers: (hhdUsers as any[]).map((u) => ({
        id: String(u._id),
        name: u.name,
        warehouse: u.warehouse ?? null,
        darkstore: u.darkstore ?? null,
      })),
      availableFilterExplain,
      offeredCount: await Order.countDocuments({
        riderStage: 'offered',
        status: { $in: ['confirmed', 'getting-packed'] },
      }),
      offeredMissingDeliveryType: await Order.countDocuments({
        riderStage: 'offered',
        status: { $in: ['confirmed', 'getting-packed'] },
        $or: [{ deliveryType: null }, { deliveryType: { $exists: false } }],
      }),
      offeredStandard: await Order.countDocuments({
        riderStage: 'offered',
        status: { $in: ['confirmed', 'getting-packed'] },
        deliveryType: 'standard',
      }),
    }),
  );
});
