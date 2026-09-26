/**
 * Production-ready order lifecycle proof against live Mongo.
 * Keeps one labeled order for Admin verification unless CLEANUP=1.
 *
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/e2e-production-ready-flow.ts
 */
import '../config/env';
import mongoose from 'mongoose';
import { connectDB } from '../database/mongoose';
import { Order } from '../modules/orders/order.model';
import { HHDOrder, HHDItem, HHDAssignOrder, HHDUser } from '../modules/hhd/hhd.models';
import { PickerUser, PickerDevice } from '../modules/picker/picker.models';
import * as fulfillment from '../modules/orders/fulfillment.service';
import { DEFAULT_HUB_KEY } from '../modules/orders/fulfillment.service';
import * as pickerOrders from '../modules/picker/picker.order.service';
import { claimHhdOrder } from '../modules/hhd/hhd.claim';
import { recordDeposit } from '../modules/picker/picker.cash.service';
import { deriveFulfillmentStage, adminLabelForStage } from '../modules/orders/order-lifecycle';
import { goOnline } from '../modules/picker/picker.shift.service';
import * as ops from '../modules/admin/ops-flow.service';

const TAG = `PROD-${Date.now().toString().slice(-8)}`;
const CLEANUP = process.env.CLEANUP === '1';

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

async function main() {
  const ids = {
    orderId: '' as string,
    orderNumber: '' as string,
    riderId: '' as string,
    hhdId: '' as string,
    deviceId: '' as string,
    customerUserId: '' as string,
  };

  await connectDB();
  console.log(`[${TAG}] connected — starting production flow`);

  try {
    // ── Actors ──────────────────────────────────────────────────────────────
    const customerUserId = new mongoose.Types.ObjectId();
    ids.customerUserId = String(customerUserId);

    const hhd = await HHDUser.create({
      mobile: `7${String(Date.now()).slice(-9)}`.slice(0, 10),
      name: `${TAG} HSD`,
      warehouse: DEFAULT_HUB_KEY,
      darkstore: DEFAULT_HUB_KEY,
      isActive: true,
    });
    ids.hhdId = String(hhd._id);

    // Register a real device and assign it so claim device-gate is exercised when fleet > 0
    const device = await PickerDevice.create({
      deviceId: `HSD-${TAG}`,
      type: 'HHD',
      deviceModel: 'Zebra TC21',
      status: 'assigned',
      assignedTo: hhd._id,
      assignedAt: new Date(),
      warehouseKey: DEFAULT_HUB_KEY,
    });
    ids.deviceId = device.deviceId;
    await HHDUser.updateOne({ _id: hhd._id }, { $set: { deviceId: device.deviceId } });

    const rider = await PickerUser.create({
      phone: `9${String(Date.now()).slice(-9)}`.slice(0, 10),
      status: 'ACTIVE',
      workforceRole: 'rider',
      name: `${TAG} Rider`,
      isOnline: false,
      deliveryMode: 'standard',
      vehicleType: 'bike',
      currentLocationId: DEFAULT_HUB_KEY,
      gpsLocation: { latitude: 13.0067, longitude: 80.257, timestamp: new Date() },
    });
    ids.riderId = String(rider._id);

    // ── 1. Customer places COD order ────────────────────────────────────────
    const productId = new mongoose.Types.ObjectId();
    const orderNumber = `${TAG}-ORD`;
    const order = await Order.create({
      userId: customerUserId,
      orderNumber,
      items: [
        {
          productId,
          productName: 'Prod Ready Tomato',
          quantity: 2,
          price: 49,
          variantSize: '500g',
        },
      ],
      status: 'pending',
      fulfillmentStage: 'pending',
      paymentStatus: 'cod_pending',
      paymentMethod: {
        methodType: 'cash',
        instrument: 'COD',
        displayLabel: 'Cash on Delivery',
        paymentMode: 'cod',
      },
      itemTotal: 98,
      totalTax: 0,
      handlingCharge: 0,
      deliveryFee: 20,
      deliveryTip: 0,
      discount: 0,
      walletDeduction: 0,
      onlineAmountDue: 0,
      totalBill: 118,
      customerName: `${TAG} Customer`,
      customerPhone: '9876543210',
      deliveryAddress: {
        line1: '14 Production Street',
        city: 'Chennai',
        state: 'TN',
        pincode: '600020',
        latitude: 13.0067,
        longitude: 80.257,
      },
      deliveryType: 'standard',
      offerHubKey: DEFAULT_HUB_KEY,
    });
    ids.orderId = String(order._id);
    ids.orderNumber = orderNumber;
    console.log(`[1] Order created ${orderNumber} pending/cod_pending`);

    // ── 2. Confirm (payment integration) ─────────────────────────────────────
    await fulfillment.runPostOrderIntegrations(ids.customerUserId, { id: ids.orderId }, 'cod_pending', 'cash', 118);
    let cur = await Order.findById(ids.orderId);
    assert(cur?.status === 'confirmed', `expected confirmed, got ${cur?.status}`);
    assert(deriveFulfillmentStage(cur!) === 'confirmed', `stage ${deriveFulfillmentStage(cur!)}`);
    assert(!!cur?.deliveryOtp && cur!.deliveryOtp!.length === 4, 'missing delivery OTP');
    const ticket = await HHDOrder.findOne({ orderId: orderNumber });
    assert(ticket?.status === 'pending' && !ticket.userId, 'HHD ticket not waiting for picker');
    console.log(`[2] Confirmed — ${adminLabelForStage('confirmed')} — OTP ${cur!.deliveryOtp}`);

    // ── 3. Offline rider must NOT accept (order not offered yet anyway) ──────
    // ── 4. HSD claim (picker accept) ─────────────────────────────────────────
    await claimHhdOrder(ids.hhdId, orderNumber);
    cur = await Order.findById(ids.orderId);
    assert(deriveFulfillmentStage(cur!) === 'picker_accepted', `after claim stage=${deriveFulfillmentStage(cur!)}`);
    assert(String(cur?.hhdUserId) === ids.hhdId, 'hhdUserId not set');
    assert(cur?.hsdDeviceId === ids.deviceId, `hsdDeviceId ${cur?.hsdDeviceId}`);
    assert(cur?.status === 'getting-packed', `status ${cur?.status}`);
    console.log(`[4] Picker accepted — device ${cur!.hsdDeviceId}`);

    // ── 5. Bag scan + rack ───────────────────────────────────────────────────
    await fulfillment.onHhdStatusChanged(orderNumber, 'bag_scanned');
    await fulfillment.onHhdStatusChanged(orderNumber, 'photo_verified');
    await fulfillment.onHhdStatusChanged(orderNumber, 'rack_assigned');
    cur = await Order.findById(ids.orderId);
    assert(cur?.bagScannedAt, 'bagScannedAt missing');
    console.log(`[5] Bag scanned / rack path — bay ${cur?.dispatchBay || '(set at handover)'}`);

    // ── 6. Handover → waiting for rider (no fake rider assign) ───────────────
    await fulfillment.completeHandover({
      hhdOrderId: orderNumber,
      scannedBy: ids.hhdId,
      hub: DEFAULT_HUB_KEY,
      bagId: cur!.bagCode || `SG-${orderNumber.slice(-6)}-A`,
      dispatchBay: 'Rack-D1-Slot3',
      deviceId: ids.deviceId,
    });
    cur = await Order.findById(ids.orderId);
    assert(deriveFulfillmentStage(cur!) === 'packed_in_rack', `stage ${deriveFulfillmentStage(cur!)}`);
    assert(cur?.riderStage === 'offered', `riderStage ${cur?.riderStage}`);
    assert(!cur?.pickerId, 'rider must not be assigned before accept');
    assert(cur?.dispatchBay === 'Rack-D1-Slot3', 'dispatchBay missing');
    assert(!!cur?.offerExpiresAt, 'offerExpiresAt not set');
    console.log(`[6] Waiting for Rider — bay ${cur!.dispatchBay}`);

    // ── 7. Offline rider blocked ─────────────────────────────────────────────
    let offlineBlocked = false;
    try {
      await pickerOrders.updateOrderStatus(ids.riderId, ids.orderId, { status: 'accepted' });
    } catch (err) {
      offlineBlocked = String((err as { code?: string }).code || '') === 'RIDER_OFFLINE';
    }
    assert(offlineBlocked, 'offline rider was allowed to accept');
    console.log('[7] Offline rider correctly blocked (RIDER_OFFLINE)');

    // ── 8. Rider goes online → accept ────────────────────────────────────────
    await goOnline(ids.riderId, {
      latitude: 13.0067,
      longitude: 80.257,
    });
    const online = (await PickerUser.findById(ids.riderId).select('isOnline').lean()) as {
      isOnline?: boolean;
    } | null;
    assert(online?.isOnline === true, 'rider not online');

    await pickerOrders.updateOrderStatus(ids.riderId, ids.orderId, { status: 'accepted' });
    cur = await Order.findById(ids.orderId);
    assert(deriveFulfillmentStage(cur!) === 'rider_accepted', `stage ${deriveFulfillmentStage(cur!)}`);
    assert(cur?.riderStage === 'accepted', `riderStage ${cur?.riderStage}`);
    assert(String(cur?.pickerId) === ids.riderId, 'pickerId (rider) not set');
    assert(String(cur?.riderId) === ids.riderId, 'riderId not set on accept');
    assert(cur?.status === 'getting-packed', 'customer status must stay getting-packed until pickup');
    console.log('[8] Rider accepted');

    // ── 9. Pickup ────────────────────────────────────────────────────────────
    await pickerOrders.updateOrderStatus(ids.riderId, ids.orderId, {
      status: 'picked_up',
      itemsVerified: true,
    });
    cur = await Order.findById(ids.orderId);
    assert(deriveFulfillmentStage(cur!) === 'rider_picked', `stage ${deriveFulfillmentStage(cur!)}`);
    assert(cur?.status === 'on-the-way', `status ${cur?.status}`);
    console.log('[9] Rider picked — on-the-way');

    // ── 10. Deliver with OTP + COD collect ───────────────────────────────────
    const otp = cur!.deliveryOtp!;
    const result = await pickerOrders.completeDelivery(ids.riderId, ids.orderId, {
      otp,
      codCollected: 118,
    });
    assert(result.completed === true, 'delivery not completed');
    cur = await Order.findById(ids.orderId);
    assert(cur?.status === 'delivered', `status ${cur?.status}`);
    assert(cur?.otpVerified === true, 'otpVerified false');
    assert(cur?.fulfillmentStage === 'delivered', `stage ${cur?.fulfillmentStage}`);
    assert(cur?.paymentStatus === 'cod_pending', `COD must stay pending until deposit, got ${cur?.paymentStatus}`);
    assert(cur?.codCollectedAmount === 118, `codCollectedAmount ${cur?.codCollectedAmount}`);
    console.log('[10] Delivered + COD collected (still pending settlement)');

    // ── 11. COD deposit → realized ───────────────────────────────────────────
    const deposit = await recordDeposit(ids.riderId, {
      amount: 118,
      method: 'upi',
      hubId: DEFAULT_HUB_KEY,
      note: `${TAG} COD settle`,
    });
    assert(deposit.status === 'confirmed', 'deposit not confirmed');
    cur = await Order.findById(ids.orderId);
    assert(cur?.paymentStatus === 'paid', `after deposit expected paid, got ${cur?.paymentStatus}`);
    console.log(`[11] COD settled — paymentStatus paid (ref ${deposit.ref})`);

    // ── 12. Customer review ──────────────────────────────────────────────────
    await Order.updateOne(
      { _id: ids.orderId },
      { $set: { ratingScore: 5, ratingComment: `${TAG} great delivery` } },
    );
    cur = await Order.findById(ids.orderId);
    assert(cur?.ratingScore === 5, 'rating not saved');
    console.log('[12] Customer review recorded');

    // ── 13. Admin ops reflection ─────────────────────────────────────────────
    const progress = await ops.listOrderProgress({ limit: 200 });
    const row = progress.find((p) => p.orderNumber === orderNumber);
    assert(!!row, 'order missing from order-progress');
    assert(row!.fulfillmentLabel === 'Delivered', `progress label ${row!.fulfillmentLabel}`);

    const reviews = await ops.listReviews({});
    assert(reviews.some((r) => r.orderNumber === orderNumber && r.rating === 5), 'review missing in ops');

    const devices = await ops.listHsdDevices();
    assert(devices.devices.some((d) => d.deviceId === ids.deviceId), 'device missing in ops');

    const riderDetail = await ops.getRiderDetails(ids.riderId);
    assert(!!riderDetail, 'rider details missing');
    assert(
      riderDetail!.stats.orders.some((o) => o.orderNumber === orderNumber),
      'delivered order missing from rider stats',
    );

    const pickerDetail = await ops.getPickerDetails(ids.hhdId);
    assert(!!pickerDetail, 'picker details missing');

    const cod = await ops.getCodSummary('this_month');
    const codRow = cod.orders.find((o) => o.orderNumber === orderNumber);
    assert(!!codRow, 'order missing from COD board');
    assert(codRow!.collectionStatus === 'settled' || codRow!.paymentStatus === 'paid', `COD row ${codRow!.collectionStatus}`);

    console.log('[13] Admin ops: progress, reviews, devices, rider/picker details, COD — OK');

    console.log('\n========== PRODUCTION FLOW PASS ==========');
    console.log(
      JSON.stringify(
        {
          orderNumber,
          orderId: ids.orderId,
          fulfillmentStage: cur!.fulfillmentStage,
          fulfillmentLabel: adminLabelForStage(deriveFulfillmentStage(cur!)),
          status: cur!.status,
          paymentStatus: cur!.paymentStatus,
          otpVerified: cur!.otpVerified,
          hhdUserId: ids.hhdId,
          hsdDeviceId: ids.deviceId,
          riderId: ids.riderId,
          bagCode: cur!.bagCode,
          dispatchBay: cur!.dispatchBay,
          ratingScore: cur!.ratingScore,
          keptInDb: !CLEANUP,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    console.error('\n========== PRODUCTION FLOW FAIL ==========');
    console.error((err as Error).stack || err);
    process.exitCode = 1;
  } finally {
    if (CLEANUP) {
      if (ids.orderNumber) {
        await HHDItem.deleteMany({ orderId: ids.orderNumber });
        await HHDOrder.deleteMany({ orderId: ids.orderNumber });
        await HHDAssignOrder.deleteMany({ orderId: ids.orderNumber });
      }
      if (ids.orderId) await Order.deleteMany({ _id: ids.orderId });
      if (ids.riderId) await PickerUser.deleteMany({ _id: ids.riderId });
      if (ids.hhdId) await HHDUser.deleteMany({ _id: ids.hhdId });
      if (ids.deviceId) await PickerDevice.deleteMany({ deviceId: ids.deviceId });
      console.log('[cleanup] removed flow artifacts');
    }
    await Promise.race([
      mongoose.disconnect(),
      new Promise<void>((r) => setTimeout(r, 4000)),
    ]);
    process.exit(process.exitCode ?? 0);
  }
}

void main();
