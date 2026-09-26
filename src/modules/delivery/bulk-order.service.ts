import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { recordAuditLog } from '../../services/audit.service';
import { Order, type IOrder } from '../orders/order.model';
import { Product } from '../products/products.model';
import { CustomerUser } from '../auth/auth.model';
import { DarkStore } from '../store/dark-store.model';
import { Store } from '../store/store.model';
import { PickerUser } from '../picker/picker.models';

export const BULK_ORDER_STAGES = [
  'Order Created',
  'Payment Confirmed',
  'Processing',
  'Picking',
  'Packed',
  'Ready for Delivery',
  'Rider Assigned',
  'Out for Delivery',
  'Delivered',
] as const;

export type BulkOrderStatus = 'Pending' | 'Processing' | 'Ready for Delivery' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
export type BulkPaymentStatus = 'Paid' | 'Pending' | 'Partially paid' | 'Refunded' | 'Failed';

const STATUS_STAGE: Partial<Record<BulkOrderStatus, number>> = {
  Pending: 0,
  Processing: 2,
  'Ready for Delivery': 5,
  'Out for Delivery': 7,
  Delivered: 8,
};

const PAYMENT_LABELS = new Set<BulkPaymentStatus>(['Paid', 'Pending', 'Partially paid', 'Refunded', 'Failed']);

export interface BulkOrderView {
  id: string;
  business: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  store: string;
  orderDate: string;
  deliveryDate: string;
  slot: string;
  items: Array<{ product: string; sku: string; qty: number; unitPrice: number }>;
  discount: number;
  deliveryCharge: number;
  taxRate: number;
  paymentStatus: BulkPaymentStatus;
  paymentMethod: string;
  status: BulkOrderStatus;
  stage: number;
  picker?: string;
  rider?: string;
  history: Array<{ stage: string; at: string; by: string; note?: string }>;
  customerId: string;
  orderId: string;
}

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function statusForStage(stage: number): BulkOrderStatus {
  if (stage >= 8) return 'Delivered';
  if (stage >= 7) return 'Out for Delivery';
  if (stage >= 5) return 'Ready for Delivery';
  if (stage >= 2) return 'Processing';
  return 'Pending';
}

function customerStatusForStage(stage: number, cancelled: boolean): IOrder['status'] {
  if (cancelled) return 'cancelled';
  if (stage >= 8) return 'delivered';
  if (stage >= 7) return 'on-the-way';
  if (stage >= 3) return 'getting-packed';
  if (stage >= 1) return 'confirmed';
  return 'pending';
}

function paymentEnum(label: BulkPaymentStatus): IOrder['paymentStatus'] {
  if (label === 'Paid' || label === 'Refunded') return 'paid';
  if (label === 'Failed') return 'failed';
  return 'pending';
}

function methodType(raw: string): 'card' | 'upi' | 'cash' | 'wallet' | 'digital' {
  const s = raw.toLowerCase();
  if (s.includes('upi')) return 'upi';
  if (s.includes('card')) return 'card';
  if (s.includes('wallet')) return 'wallet';
  if (s.includes('cash') || s.includes('cod')) return 'cash';
  return 'digital';
}

function view(order: IOrder & { createdAt?: Date }): BulkOrderView {
  const admin = order.adminFulfillment;
  const stage = admin?.stage ?? 0;
  const cancelled = order.status === 'cancelled';
  const items = (order.items as Array<Record<string, unknown>>).map((item) => ({
    product: String(item.productName ?? ''),
    sku: String(item.variantId || item.hsnCode || ''),
    qty: Number(item.quantity) || 0,
    unitPrice: Number(item.price) || 0,
  }));
  const taxable = Math.max(order.itemTotal - order.discount, 0);
  const taxRate = taxable > 0 ? order.totalTax / taxable : 0;
  const history = (order.timeline as Array<Record<string, unknown>>).map((event) => ({
    stage: String(event.note || event.status || ''),
    at: new Date(String(event.timestamp || order.createdAt || new Date())).toISOString(),
    by: String(event.actor || ''),
  }));
  const storeRef = order.storeId as unknown as { name?: string; code?: string } | string | undefined;
  const storeLabel = storeRef && typeof storeRef === 'object' ? storeRef.code || storeRef.name || '' : '';
  return {
    id: order.orderNumber,
    business: admin?.displayName || order.customerName,
    contactName: order.customerName,
    phone: order.customerPhone,
    email: admin?.contactEmail || '',
    address: admin?.addressText || order.deliveryAddress?.line1 || '',
    store: storeLabel,
    orderDate: new Date(order.createdAt ?? Date.now()).toISOString(),
    deliveryDate: (order.estimatedDelivery ?? order.createdAt ?? new Date()).toISOString(),
    slot: admin?.slot || order.deliverySlotLabel || '',
    items,
    discount: order.discount,
    deliveryCharge: order.deliveryFee,
    taxRate,
    paymentStatus: (admin?.paymentLabel as BulkPaymentStatus) || 'Pending',
    paymentMethod: order.paymentMethod?.displayLabel || order.paymentMethod?.methodType || '',
    status: cancelled ? 'Cancelled' : statusForStage(stage),
    stage,
    picker: admin?.pickerName || undefined,
    rider: admin?.riderName || order.riderId || undefined,
    history,
    customerId: String(order.userId),
    orderId: String(order._id),
  };
}

async function findBulk(id: string): Promise<IOrder> {
  const order = await Order.findOne({ orderNumber: id, deliveryType: 'bulk' }).populate('storeId', 'name code');
  if (!order) throw AppError.notFound('Bulk order', id);
  return order;
}

async function commit(order: IOrder, expectedStage: number): Promise<IOrder> {
  const patch = {
    status: order.status,
    timeline: order.timeline,
    adminFulfillment: order.adminFulfillment,
    paymentStatus: order.paymentStatus,
    refundStatus: order.refundStatus,
    refundAmount: order.refundAmount,
    pickerId: order.pickerId,
    riderId: order.riderId,
    riderStage: order.riderStage,
    assignedAt: order.assignedAt,
    riderReassignmentCount: order.riderReassignmentCount,
    deliveredAt: order.deliveredAt,
    cancellationReason: order.cancellationReason,
  };
  // Match both explicit stage and legacy docs that never wrote adminFulfillment.stage.
  const stageMatch =
    expectedStage === 0
      ? {
          $or: [
            { 'adminFulfillment.stage': 0 },
            { 'adminFulfillment.stage': { $exists: false } },
            { adminFulfillment: { $exists: false } },
          ],
        }
      : { 'adminFulfillment.stage': expectedStage };
  const saved = await Order.findOneAndUpdate(
    { _id: order._id, deliveryType: 'bulk', ...stageMatch },
    { $set: patch },
    { new: true },
  );
  if (!saved) throw AppError.conflict('This bulk order was updated by someone else. Reload and try again.', 'CONCURRENT_UPDATE');
  const fresh = await Order.findById(saved._id).populate('storeId', 'name code');
  if (!fresh) throw AppError.notFound('Bulk order', String(order.orderNumber));
  return fresh;
}

function pushStage(order: IOrder, from: number, to: number, by: string, note?: string, customerStatus?: IOrder['status']) {
  const now = new Date();
  for (let s = from + 1; s <= to; s++) {
    order.timeline.push({
      status: customerStatusForStage(s, false),
      timestamp: now,
      note: s === to && note ? `${BULK_ORDER_STAGES[s]} · ${note}` : BULK_ORDER_STAGES[s],
      actor: by,
    });
  }
  order.adminFulfillment = { ...(order.adminFulfillment ?? emptyAdmin()), stage: to };
  order.status = customerStatus ?? customerStatusForStage(to, false);
  if (to >= 8) order.deliveredAt = now;
}

function emptyAdmin() {
  return { stage: 0, paymentLabel: 'Pending', slot: '', contactEmail: '', displayName: '', pickerName: '', riderName: '', addressText: '' };
}

export async function listProducts() {
  const products = await Product.find({
    sku: { $exists: true, $nin: ['', null] },
    isActive: true,
  })
    .select('name sku price gstRate taxPercent')
    .sort({ name: 1 })
    .limit(500)
    .lean();
  return products.map((p) => ({
    product: p.name,
    sku: p.sku,
    unitPrice: p.price,
    gstRate: p.gstRate || p.taxPercent || 0,
  }));
}

export async function listBulkOrders(query: {
  q?: string;
  status?: string;
  paymentStatus?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}) {
  const filter: Record<string, unknown> = { deliveryType: 'bulk' };
  if (query.from || query.to) {
    filter.createdAt = {
      ...(query.from ? { $gte: new Date(query.from) } : {}),
      ...(query.to ? { $lte: new Date(query.to) } : {}),
    };
  }
  if (query.paymentStatus) {
    if (!PAYMENT_LABELS.has(query.paymentStatus as BulkPaymentStatus)) {
      throw AppError.badRequest('Invalid payment status');
    }
    filter['adminFulfillment.paymentLabel'] = query.paymentStatus;
  }
  const page = Math.max(1, query.page || 1);
  const pageSize = Math.min(200, Math.max(1, query.pageSize || 25));
  const [docs, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).populate('storeId', 'name code'),
    Order.countDocuments(filter),
  ]);
  let items = docs.map((doc) => view(doc));
  if (query.status) {
    items = items.filter((o) => o.status === query.status);
  }
  if (query.q) {
    const q = query.q.toLowerCase();
    items = items.filter((o) => [o.id, o.business, o.contactName, o.phone, o.status].join(' ').toLowerCase().includes(q));
  }
  return { items, total: query.status || query.q ? items.length : total, page, pageSize };
}

export async function getBulkOrder(id: string): Promise<BulkOrderView> {
  return view(await findBulk(id));
}

export interface CreateBulkInput {
  business?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  store?: string;
  deliveryDate?: string;
  slot?: string;
  paymentMethod?: string;
  items?: Array<{ sku?: string; qty?: number }>;
}

async function resolveStore(raw: string): Promise<{ id: mongoose.Types.ObjectId; label: string } | null> {
  const value = raw.trim();
  if (!value) return null;
  const byId = mongoose.isValidObjectId(value);
  const store = await Store.findOne({
    ...(byId ? { _id: value } : { $or: [{ code: value.toUpperCase() }, { name: value }, { code: value }] }),
    status: 'active',
  });
  if (store) return { id: store._id as mongoose.Types.ObjectId, label: store.code || store.name };

  const dark = await DarkStore.findOne({
    ...(byId ? { _id: value } : { $or: [{ code: value }, { name: value }] }),
    isActive: true,
  });
  if (dark) return { id: dark._id as mongoose.Types.ObjectId, label: dark.code || dark.name };
  return null;
}

async function nextBulkOrderNumber(): Promise<string> {
  const latest = await Order.findOne({ deliveryType: 'bulk', orderNumber: /^BLK-\d+$/ })
    .sort({ orderNumber: -1 })
    .select('orderNumber')
    .lean();
  const prev = Number(String(latest?.orderNumber ?? 'BLK-4400').replace(/\D/g, '')) || 4400;
  return `BLK-${prev + 1}`;
}

export async function createBulkOrder(input: CreateBulkInput, by: string): Promise<BulkOrderView> {
  const required: Array<[keyof CreateBulkInput, string]> = [
    ['contactName', 'contactName'],
    ['phone', 'phone'],
    ['address', 'address'],
    ['store', 'store'],
    ['deliveryDate', 'deliveryDate'],
    ['slot', 'slot'],
    ['paymentMethod', 'paymentMethod'],
  ];
  for (const [key, field] of required) {
    if (!String(input[key] ?? '').trim()) throw AppError.badRequest(`${field} is required`, [{ field, message: 'Required' }]);
  }
  if (!input.items?.length) throw AppError.badRequest('At least one product line is required', [{ field: 'items', message: 'Required' }]);

  const deliveryDate = new Date(input.deliveryDate!);
  if (Number.isNaN(deliveryDate.getTime())) throw AppError.badRequest('Invalid delivery date', [{ field: 'deliveryDate', message: 'Invalid date' }]);

  const phone = digits(input.phone!);
  const customer = await CustomerUser.findOne({
    $or: [
      { phoneNumber: input.phone },
      { phoneNumber: phone },
      ...(input.email ? [{ email: input.email.toLowerCase() }] : []),
    ],
  });
  if (!customer) {
    throw AppError.badRequest('No customer matches this phone or email', [{ field: 'phone', message: 'Invalid customer' }]);
  }
  if (customer.status !== 'active') {
    throw AppError.badRequest('Customer is not active', [{ field: 'phone', message: 'Inactive customer' }]);
  }

  const store = await resolveStore(input.store!);
  if (!store) {
    throw AppError.badRequest('Store was not found or is inactive', [{ field: 'store', message: 'Invalid store' }]);
  }

  const items = [];
  let itemTotal = 0;
  let totalTax = 0;
  for (const line of input.items) {
    const qty = Number(line.qty);
    if (!line.sku || !Number.isInteger(qty) || qty < 1) {
      throw AppError.badRequest('Each line needs a SKU and a quantity of at least 1', [{ field: 'items', message: 'Invalid quantity' }]);
    }
    const product = await Product.findOne({ sku: line.sku, isActive: true });
    if (!product) {
      throw AppError.badRequest(`Unknown or inactive SKU ${line.sku}`, [{ field: 'sku', message: 'Invalid product' }]);
    }
    const raw = product.gstRate || product.taxPercent || 0;
    const rate = raw > 1 ? raw / 100 : raw;
    const lineTax = Math.round(product.price * qty * rate);
    itemTotal += product.price * qty;
    totalTax += lineTax;
    items.push({
      productId: product._id,
      productName: product.name,
      variantId: product.sku,
      quantity: qty,
      price: product.price,
      hsnCode: product.hsnCode || '',
      gstRate: product.gstRate || product.taxPercent || 0,
      taxAmount: lineTax,
      itemStatus: 'pending' as const,
    });
  }

  const orderNumber = await nextBulkOrderNumber();
  const now = new Date();
  const order = await Order.create({
    userId: customer._id,
    orderNumber,
    items,
    status: 'pending',
    timeline: [{ status: 'pending', timestamp: now, note: 'Order Created', actor: by }],
    customerName: input.contactName,
    customerPhone: input.phone,
    deliveryAddress: { line1: input.address },
    deliveryMode: 'scheduled',
    deliverySlotLabel: input.slot,
    estimatedDelivery: deliveryDate,
    paymentMethod: {
      methodType: methodType(input.paymentMethod!),
      instrument: input.paymentMethod,
      displayLabel: input.paymentMethod,
      paymentMode: input.paymentMethod,
    },
    paymentStatus: 'pending',
    itemTotal,
    totalTax,
    deliveryFee: 0,
    discount: 0,
    totalBill: itemTotal + totalTax,
    storeId: store.id,
    deliveryType: 'bulk',
    adminFulfillment: {
      stage: 0,
      paymentLabel: 'Pending',
      slot: input.slot,
      contactEmail: input.email || customer.email || '',
      displayName: input.business || input.contactName,
      pickerName: '',
      riderName: '',
      addressText: input.address,
    },
  });

  await recordAuditLog({
    module: 'delivery',
    action: 'bulk_order_create',
    entityType: 'BulkOrder',
    entityId: order.orderNumber,
    details: { by, customerId: String(customer._id), storeId: String(store.id) },
  });
  const shaped = view(order);
  shaped.store = store.label;
  return shaped;
}

export async function setBulkStatus(id: string, status: BulkOrderStatus, by: string, note?: string): Promise<BulkOrderView> {
  const order = await findBulk(id);
  const stage = order.adminFulfillment?.stage ?? 0;
  if (order.status === 'cancelled') throw AppError.conflict(`${id} is cancelled`, 'RECORD_CLOSED');
  if (status === 'Cancelled') return cancelBulkOrder(id, by, note);
  const target = STATUS_STAGE[status];
  if (target == null) throw AppError.badRequest(`Unsupported status ${status}`);
  if (target < stage) throw AppError.conflict(`${id} is already past "${status}"`, 'STATUS_BACKWARD');
  if (target >= 7 && !order.riderId && !order.adminFulfillment?.riderName) {
    throw AppError.conflict('Assign a rider before dispatching', 'RIDER_REQUIRED');
  }
  if (target === stage) {
    throw AppError.conflict(`${id} is already "${status}"`, 'STATUS_UNCHANGED');
  }
  pushStage(order, stage, target, by, note);
  if (target >= 7) {
    order.riderStage = 'accepted';
    if (!order.assignedAt) order.assignedAt = new Date();
  }
  const saved = await commit(order, stage);
  await recordAuditLog({ module: 'delivery', action: 'bulk_order_status', entityType: 'BulkOrder', entityId: id, details: { by, status } });
  return view(saved);
}

export async function setBulkPayment(id: string, paymentStatus: BulkPaymentStatus, by: string): Promise<BulkOrderView> {
  if (!PAYMENT_LABELS.has(paymentStatus)) throw AppError.badRequest('Invalid payment status');
  const order = await findBulk(id);
  if (order.status === 'cancelled' || order.status === 'delivered') {
    throw AppError.conflict(`${id} is ${order.status}`, 'RECORD_CLOSED');
  }
  const stage = order.adminFulfillment?.stage ?? 0;
  order.adminFulfillment = { ...(order.adminFulfillment ?? emptyAdmin()), paymentLabel: paymentStatus, stage };
  order.paymentStatus = paymentEnum(paymentStatus);
  if (paymentStatus === 'Refunded') {
    order.refundStatus = 'processed';
    order.refundAmount = order.totalBill;
  }
  if (paymentStatus === 'Paid' && stage < 1) pushStage(order, stage, 1, by, 'Payment confirmed');
  else {
    order.timeline.push({ status: order.status, timestamp: new Date(), note: `Payment marked ${paymentStatus.toLowerCase()}`, actor: by });
  }
  const saved = await commit(order, stage);
  await recordAuditLog({
    module: 'delivery',
    action: 'bulk_order_payment',
    entityType: 'BulkOrder',
    entityId: id,
    details: { by, paymentStatus },
  });
  return view(saved);
}

async function findStaff(idOrName: string, role: 'picker' | 'rider') {
  const filter: Record<string, unknown> = { status: 'ACTIVE', workforceRole: role };
  if (mongoose.isValidObjectId(idOrName)) filter._id = idOrName;
  else filter.name = idOrName;
  const user = await PickerUser.findOne(filter);
  if (!user) {
    throw AppError.badRequest(`No active ${role} matches "${idOrName}"`, [
      { field: role === 'picker' ? 'pickerId' : 'riderId', message: `Invalid ${role}` },
    ]);
  }
  return user;
}

export async function assignBulkPicker(id: string, pickerId: string, by: string): Promise<BulkOrderView> {
  if (!pickerId) throw AppError.badRequest('pickerId is required', [{ field: 'pickerId', message: 'Required' }]);
  const order = await findBulk(id);
  if (order.status === 'cancelled' || order.status === 'delivered') throw AppError.conflict(`${id} is ${order.status}`, 'RECORD_CLOSED');
  const picker = await findStaff(pickerId, 'picker');
  const stage = order.adminFulfillment?.stage ?? 0;
  order.pickerId = picker._id;
  order.adminFulfillment = { ...(order.adminFulfillment ?? emptyAdmin()), stage, pickerName: picker.name || pickerId };
  if (stage === 2) pushStage(order, stage, 3, by, picker.name);
  else order.timeline.push({ status: order.status, timestamp: new Date(), note: 'Picker assigned', actor: by });
  const saved = await commit(order, stage);
  await recordAuditLog({
    module: 'delivery',
    action: 'bulk_order_assign_picker',
    entityType: 'BulkOrder',
    entityId: id,
    details: { by, pickerId: String(picker._id) },
  });
  return view(saved);
}

export async function assignBulkRider(id: string, riderId: string, by: string): Promise<BulkOrderView> {
  if (!riderId) throw AppError.badRequest('riderId is required', [{ field: 'riderId', message: 'Required' }]);
  const order = await findBulk(id);
  if (order.status === 'cancelled' || order.status === 'delivered') throw AppError.conflict(`${id} is ${order.status}`, 'RECORD_CLOSED');
  const rider = await findStaff(riderId, 'rider');
  const { assertRiderFreeForNewOrder } = await import('../picker/rider-lock');
  await assertRiderFreeForNewOrder(String(rider._id), String(order._id));
  const stage = order.adminFulfillment?.stage ?? 0;
  const previous = order.riderId;
  order.riderId = String(rider._id);
  order.assignedAt = new Date();
  order.riderStage = 'accepted';
  if (previous && previous !== order.riderId) order.riderReassignmentCount = (order.riderReassignmentCount || 0) + 1;
  order.adminFulfillment = { ...(order.adminFulfillment ?? emptyAdmin()), stage, riderName: rider.name || riderId };
  if (stage === 5) pushStage(order, stage, 6, by, rider.name);
  else order.timeline.push({ status: order.status, timestamp: new Date(), note: previous ? 'Rider reassigned' : 'Rider assigned', actor: by });
  const saved = await commit(order, stage);
  await recordAuditLog({
    module: 'delivery',
    action: 'bulk_order_assign_rider',
    entityType: 'BulkOrder',
    entityId: id,
    details: { by, riderId: String(rider._id) },
  });
  return view(saved);
}

export async function cancelBulkOrder(id: string, by: string, note?: string): Promise<BulkOrderView> {
  const order = await findBulk(id);
  if (order.status === 'delivered') throw AppError.conflict(`${id} is already delivered`, 'RECORD_CLOSED');
  if (order.status === 'cancelled') return view(order);
  const stage = order.adminFulfillment?.stage ?? 0;
  order.status = 'cancelled';
  order.cancellationReason = note || 'Cancelled';
  order.timeline.push({ status: 'cancelled', timestamp: new Date(), note: note || 'Cancelled', actor: by });
  const saved = await commit(order, stage);
  await recordAuditLog({ module: 'delivery', action: 'bulk_order_cancel', entityType: 'BulkOrder', entityId: id, details: { by, note } });
  return view(saved);
}
