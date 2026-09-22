/**
 * Follow-through for a customer-API-created order: HHD pick → handover → rider accept/pickup.
 * Run: npx ts-node --transpile-only -r tsconfig-paths/register src/scripts/e2e-customer-web-followthrough.ts
 */
import '../config/env';
import mongoose from 'mongoose';
import { connectDB } from '../database/mongoose';
import { Order } from '../modules/orders/order.model';
import { PickerUser } from '../modules/picker/picker.models';
import { PickerLocationPing } from '../modules/picker/picker.rider.models';
import * as fulfillment from '../modules/orders/fulfillment.service';
import { DEFAULT_HUB_KEY } from '../modules/orders/fulfillment.service';
import * as pickerOrders from '../modules/picker/picker.order.service';

const ORDER_NUMBER = process.argv[2] || 'ORD-20260909-00441';

async function main() {
  await connectDB();
  const order = await Order.findOne({ orderNumber: ORDER_NUMBER });
  if (!order) throw new Error(`Order ${ORDER_NUMBER} not found`);

  await fulfillment.onHhdStatusChanged(ORDER_NUMBER, 'picking');
  const picking = await Order.findById(order._id);
  if (picking?.status !== 'getting-packed') throw new Error(`expected getting-packed, got ${picking?.status}`);

  await fulfillment.completeHandover({
    hhdOrderId: ORDER_NUMBER,
    scannedBy: String(new mongoose.Types.ObjectId()),
    hub: null,
    bagId: picking.bagCode,
    packageId: ORDER_NUMBER,
  });
  const offered = await Order.findById(order._id);
  if (offered?.riderStage !== 'offered') throw new Error(`expected offered, got ${offered?.riderStage}`);

  const rider = await PickerUser.create({
    phone: `9${String(Date.now()).slice(-9)}`.slice(0, 10),
    status: 'ACTIVE',
    workforceRole: 'rider',
    name: 'Web Audit Rider',
    isOnline: true,
    deliveryMode: 'standard',
    vehicleType: 'bike',
    currentLocationId: DEFAULT_HUB_KEY,
  });

  await pickerOrders.updateOrderStatus(String(rider._id), String(order._id), { status: 'accepted' });
  await pickerOrders.updateOrderStatus(String(rider._id), String(order._id), {
    status: 'picked_up',
    itemsVerified: true,
  });
  await PickerLocationPing.create({
    pickerId: rider._id,
    orderId: order._id,
    latitude: 13.0067,
    longitude: 80.257,
    accuracy: 12,
    recordedAt: new Date(),
  });

  const live = await Order.findById(order._id).lean();
  console.log(JSON.stringify({
    orderId: String(order._id),
    orderNumber: ORDER_NUMBER,
    status: live?.status,
    riderStage: live?.riderStage,
    pickerId: live?.pickerId ? String(live.pickerId) : null,
    riderName: rider.name,
  }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
