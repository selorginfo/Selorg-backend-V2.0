import type { NextFunction, Request, Response } from 'express';
import { ResponseFormatter } from '../../utils/response';
import { actor, assertOpsAccess } from '../delivery-stalls/ops-access';
import {
  assignBulkPicker,
  assignBulkRider,
  cancelBulkOrder,
  createBulkOrder,
  getBulkOrder,
  listBulkOrders,
  listProducts,
  setBulkPayment,
  setBulkStatus,
  type BulkOrderStatus,
  type BulkPaymentStatus,
} from './bulk-order.service';

export async function products(req: Request, res: Response, next: NextFunction) {
  try {
    assertOpsAccess(req, 'deliveries', 'view');
    res.json(ResponseFormatter.success(await listProducts()));
  } catch (err) { next(err); }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    assertOpsAccess(req, 'deliveries', 'view');
    const data = await listBulkOrders({
      q: req.query.q ? String(req.query.q) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      paymentStatus: req.query.paymentStatus ? String(req.query.paymentStatus) : undefined,
      from: req.query.from ? String(req.query.from) : undefined,
      to: req.query.to ? String(req.query.to) : undefined,
      page: req.query.page ? Number(req.query.page) : 1,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : 50,
    });
    res.json(ResponseFormatter.success(data));
  } catch (err) { next(err); }
}

export async function get(req: Request, res: Response, next: NextFunction) {
  try {
    assertOpsAccess(req, 'deliveries', 'view');
    res.json(ResponseFormatter.success(await getBulkOrder(String(req.params.id ?? req.params.bulkOrderId))));
  } catch (err) { next(err); }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    assertOpsAccess(req, 'deliveries', 'mutate');
    const data = await createBulkOrder(req.body ?? {}, actor(req));
    res.status(201).json(ResponseFormatter.success(data, 'Bulk order created'));
  } catch (err) { next(err); }
}

export async function setStatus(req: Request, res: Response, next: NextFunction) {
  try {
    assertOpsAccess(req, 'deliveries', 'mutate');
    const data = await setBulkStatus(String(req.params.id ?? req.params.bulkOrderId), req.body?.status as BulkOrderStatus, actor(req), req.body?.note);
    res.json(ResponseFormatter.success(data));
  } catch (err) { next(err); }
}

export async function setPayment(req: Request, res: Response, next: NextFunction) {
  try {
    assertOpsAccess(req, 'deliveries', 'mutate');
    const data = await setBulkPayment(String(req.params.id ?? req.params.bulkOrderId), req.body?.paymentStatus as BulkPaymentStatus, actor(req));
    res.json(ResponseFormatter.success(data));
  } catch (err) { next(err); }
}

export async function assignPicker(req: Request, res: Response, next: NextFunction) {
  try {
    assertOpsAccess(req, 'deliveries', 'mutate');
    const data = await assignBulkPicker(String(req.params.id ?? req.params.bulkOrderId), String(req.body?.pickerId ?? req.body?.picker ?? ''), actor(req));
    res.json(ResponseFormatter.success(data));
  } catch (err) { next(err); }
}

export async function assignRider(req: Request, res: Response, next: NextFunction) {
  try {
    assertOpsAccess(req, 'deliveries', 'mutate');
    const data = await assignBulkRider(String(req.params.id ?? req.params.bulkOrderId), String(req.body?.riderId ?? req.body?.rider ?? ''), actor(req));
    res.json(ResponseFormatter.success(data));
  } catch (err) { next(err); }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  try {
    assertOpsAccess(req, 'deliveries', 'mutate');
    const data = await cancelBulkOrder(String(req.params.id ?? req.params.bulkOrderId), actor(req), req.body?.note);
    res.json(ResponseFormatter.success(data));
  } catch (err) { next(err); }
}
