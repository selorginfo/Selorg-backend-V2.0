/**
 * Spine checks for the five E2E order cases against live Mongo.
 * Run: npx ts-node -r tsconfig-paths/register src/scripts/e2e-order-spine.ts
 */
import '../config/env';
import mongoose from 'mongoose';
import { connectDB } from '../database/mongoose';
import { Order } from '../modules/orders/order.model';
import { HHDOrder, HHDItem, HHDAssignOrder, HHDUser } from '../modules/hhd/hhd.models';
import { PickerUser } from '../modules/picker/picker.models';
import * as fulfillment from '../modules/orders/fulfillment.service';
import { DEFAULT_HUB_KEY } from '../modules/orders/fulfillment.service';
import * as pickerOrders from '../modules/picker/picker.order.service';
import { claimHhdOrder, listAvailableHhdOrders } from '../modules/hhd/hhd.claim';
import { AppError } from '../utils/AppError';

const TAG = `E2E-${Date.now().toString().slice(-8)}`;

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

function errCode(err: unknown): string {
  return String((err as AppError)?.code || (err as Error)?.message || err);
}

async function createOrder(suffix: string) {
  const userId = new mongoose.Types.ObjectId();
  const productId = new mongoose.Types.ObjectId();
  const orderNumber = `${TAG}-${suffix}`;
  const order = await Order.create({
    userId,
    orderNumber,
    items: [
      {
        productId,
        productName: 'E2E Tomato',
        quantity: 2,
        price: 40,
        variantSize: '500g',
      },
    ],
    status: 'pending',
    paymentStatus: 'paid',
    paymentMethod: {
      methodType: 'cash',
      instrument: 'COD',
      displayLabel: 'Cash',
      paymentMode: 'cod',
    },
    itemTotal: 80,
    totalTax: 0,
    handlingCharge: 0,
    deliveryFee: 0,
    deliveryTip: 0,
    discount: 0,
    walletDeduction: 0,
    onlineAmountDue: 0,
    totalBill: 80,
    deliveryAddress: {
      line1: '12 Test Street',
      city: 'Chennai',
      state: 'TN',
      pincode: '600020',
      latitude: 13.0067,
      longitude: 80.257,
    },
    deliveryType: 'standard',
    offerHubKey: DEFAULT_HUB_KEY,
  });
  return order;
}

async function createRider(n: number) {
  return PickerUser.create({
    phone: `9${String(Date.now()).slice(-8)}${n}`.slice(0, 10),
    status: 'ACTIVE',
    workforceRole: 'rider',
    name: `E2E Rider ${n}`,
    isOnline: true,
    deliveryMode: 'standard',
    vehicleType: 'bike',
    currentLocationId: DEFAULT_HUB_KEY,
  });
}

async function createHhd(n: number) {
  return HHDUser.create({
    mobile: `6${String(Date.now()).slice(-8)}${n}`.slice(0, 10),
    name: `E2E HHD ${n}`,
    warehouse: DEFAULT_HUB_KEY,
    darkstore: DEFAULT_HUB_KEY,
    isActive: true,
  });
}

async function cleanup(ids: {
  orders: string[];
  numbers: string[];
  riders: string[];
  hhds: string[];
}) {
  if (ids.numbers.length) {
    await HHDItem.deleteMany({ orderId: { $in: ids.numbers } });
    await HHDOrder.deleteMany({ orderId: { $in: ids.numbers } });
    await HHDAssignOrder.deleteMany({ orderId: { $in: ids.numbers } });
  }
  if (ids.orders.length) {
    await Order.deleteMany({ _id: { $in: ids.orders } });
  }
  if (ids.riders.length) {
    await PickerUser.deleteMany({ _id: { $in: ids.riders } });
  }
  if (ids.hhds.length) {
    await HHDUser.deleteMany({ _id: { $in: ids.hhds } });
  }
}

async function expectCode(work: () => Promise<unknown>, code: string) {
  try {
    await work();
    throw new Error(`Expected ${code} but call succeeded`);
  } catch (err) {
    const got = errCode(err);
    assert(got === code || got.includes(code), `Expected ${code}, got ${got}`);
  }
}

async function main() {
  const results: Array<{ id: string; pass: boolean; detail: string }> = [];
  const ids = { orders: [] as string[], numbers: [] as string[], riders: [] as string[], hhds: [] as string[] };

  await connectDB();

  try {
    // TC1 — COD confirm → HHD ticket → pick → handover → rider accept/pickup/complete
    const o1 = await createOrder('TC1');
    ids.orders.push(String(o1._id));
    ids.numbers.push(o1.orderNumber);
    await fulfillment.runPostOrderIntegrations(String(o1.userId), { id: String(o1._id) }, 'paid', 'cash', 80);
    const confirmed = await Order.findById(o1._id);
    const ticket = await HHDOrder.findOne({ orderId: o1.orderNumber });
    assert(confirmed?.status === 'confirmed', `TC1 status ${confirmed?.status}`);
    assert(!!confirmed?.deliveryOtp && confirmed!.deliveryOtp!.length === 4, 'TC1 missing deliveryOtp');
    assert(!!confirmed?.bagCode, 'TC1 missing bagCode');
    assert(ticket?.status === 'pending' && ticket.userId == null, 'TC1 HHD ticket not unassigned pending');
    assert(ticket?.hubKey === DEFAULT_HUB_KEY || !ticket?.hubKey, 'TC1 hubKey missing');

    const hhdA = await createHhd(1);
    const hhdB = await createHhd(2);
    const hhdC = await createHhd(3);
    ids.hhds.push(String(hhdA._id), String(hhdB._id), String(hhdC._id));

    const seenA = await listAvailableHhdOrders(String(hhdA._id));
    const seenB = await listAvailableHhdOrders(String(hhdB._id));
    const seenC = await listAvailableHhdOrders(String(hhdC._id));
    assert(seenA.some((o) => o.orderId === o1.orderNumber), 'HHD A did not see available order');
    assert(seenB.some((o) => o.orderId === o1.orderNumber), 'HHD B did not see available order');
    assert(seenC.some((o) => o.orderId === o1.orderNumber), 'HHD C did not see available order');

    const hhdRace = await Promise.allSettled([
      claimHhdOrder(String(hhdA._id), o1.orderNumber),
      claimHhdOrder(String(hhdB._id), o1.orderNumber),
      claimHhdOrder(String(hhdC._id), o1.orderNumber),
    ]);
    const hhdWins = hhdRace.filter((r) => r.status === 'fulfilled');
    const hhdLosses = hhdRace.filter((r) => r.status === 'rejected');
    assert(hhdWins.length === 1, `HHD race wins ${hhdWins.length}`);
    assert(hhdLosses.length === 2, `HHD race losses ${hhdLosses.length}`);
    for (const loss of hhdLosses) {
      const reason = (loss as PromiseRejectedResult).reason;
      assert(errCode(reason) === 'ORDER_ALREADY_ASSIGNED', `HHD loser code ${errCode(reason)}`);
    }
    const claimedTicket = await HHDOrder.findOne({ orderId: o1.orderNumber });
    assert(!!claimedTicket?.userId, 'HHD ticket still unassigned after accept');
    const hidden = await listAvailableHhdOrders(String(hhdB._id));
    assert(!hidden.some((o) => o.orderId === o1.orderNumber), 'Losing HHD still sees accepted order');
    results.push({ id: 'HHD-RACE', pass: true, detail: '3 HHD accepts → 1 success, 2 ORDER_ALREADY_ASSIGNED' });

    await fulfillment.onHhdStatusChanged(o1.orderNumber, 'picking');
    const picking = await Order.findById(o1._id);
    assert(picking?.status === 'getting-packed', `TC1 picking status ${picking?.status}`);

    const scannerId = new mongoose.Types.ObjectId();
    await fulfillment.completeHandover({
      hhdOrderId: o1.orderNumber,
      scannedBy: String(scannerId),
      hub: null,
      bagId: confirmed!.bagCode,
      packageId: o1.orderNumber,
    });
    const offered = await Order.findById(o1._id);
    assert(offered?.riderStage === 'offered', `TC1 riderStage ${offered?.riderStage}`);
    assert(offered?.pickerId == null, 'TC1 pickerId should be null after handover');

    const r1 = await createRider(1);
    const r2 = await createRider(2);
    const r3 = await createRider(3);
    ids.riders.push(String(r1._id), String(r2._id), String(r3._id));

    await pickerOrders.updateOrderStatus(String(r1._id), String(o1._id), { status: 'accepted' });
    await pickerOrders.updateOrderStatus(String(r1._id), String(o1._id), {
      status: 'picked_up',
      itemsVerified: true,
    });
    const out = await pickerOrders.completeDelivery(String(r1._id), String(o1._id), {
      otp: offered!.deliveryOtp || confirmed!.deliveryOtp || '',
    });
    const delivered = await Order.findById(o1._id);
    assert(out.completed === true, 'TC1 completeDelivery not completed');
    assert(delivered?.status === 'delivered', `TC1 final status ${delivered?.status}`);
    assert(delivered?.riderStage === 'delivered', `TC1 riderStage ${delivered?.riderStage}`);
    results.push({ id: 'TC1', pass: true, detail: `${o1.orderNumber} delivered` });

    // TC2 — unknown package + wrong-status handover
    await expectCode(
      () => Promise.resolve(fulfillment.resolvePackageScan('NOT-A-CODE', o1.orderNumber, offered?.bagCode)),
      'INVALID_BAG_QR',
    );
    const pending = await createOrder('TC2');
    ids.orders.push(String(pending._id));
    ids.numbers.push(pending.orderNumber);
    await expectCode(
      () =>
        fulfillment.completeHandover({
          hhdOrderId: pending.orderNumber,
          scannedBy: String(scannerId),
        }),
      'WRONG_STATUS',
    );
    const unchanged = await Order.findById(pending._id);
    assert(unchanged?.status === 'pending' && !unchanged?.riderStage, 'TC2 mutated pending order');
    results.push({ id: 'TC2', pass: true, detail: 'INVALID_BAG_QR + WRONG_STATUS, order unchanged' });

    // TC3 — second handover
    await expectCode(
      () =>
        fulfillment.completeHandover({
          hhdOrderId: o1.orderNumber,
          scannedBy: String(scannerId),
        }),
      'ALREADY_HANDED_OVER',
    );
    const handovers = await HHDAssignOrder.countDocuments({
      orderId: o1.orderNumber,
      handedOver: true,
    });
    assert(handovers === 1, `TC3 expected 1 handover, got ${handovers}`);
    results.push({ id: 'TC3', pass: true, detail: '409 ALREADY_HANDED_OVER, one handover record' });

    // TC4 — three riders accept
    const o4 = await createOrder('TC4');
    ids.orders.push(String(o4._id));
    ids.numbers.push(o4.orderNumber);
    await fulfillment.runPostOrderIntegrations(String(o4.userId), { id: String(o4._id) });
    await claimHhdOrder(String(hhdA._id), o4.orderNumber);
    await fulfillment.completeHandover({
      hhdOrderId: o4.orderNumber,
      scannedBy: String(hhdA._id),
      hub: DEFAULT_HUB_KEY,
    });
    const riderRace = await Promise.allSettled([
      pickerOrders.updateOrderStatus(String(r1._id), String(o4._id), { status: 'accepted' }),
      pickerOrders.updateOrderStatus(String(r2._id), String(o4._id), { status: 'accepted' }),
      pickerOrders.updateOrderStatus(String(r3._id), String(o4._id), { status: 'accepted' }),
    ]);
    const riderWins = riderRace.filter((r) => r.status === 'fulfilled');
    const riderLosses = riderRace.filter((r) => r.status === 'rejected');
    assert(riderWins.length === 1, `Rider race wins ${riderWins.length}`);
    assert(riderLosses.length === 2, `Rider race losses ${riderLosses.length}`);
    for (const loss of riderLosses) {
      const reason = (loss as PromiseRejectedResult).reason;
      assert(errCode(reason) === 'ORDER_ALREADY_ASSIGNED', `Rider loser code ${errCode(reason)}`);
    }
    const claimed = await Order.findById(o4._id);
    assert(!!claimed?.pickerId, 'TC4 missing rider assignment');
    results.push({ id: 'TC4', pass: true, detail: '3 riders → 1 success, 2 ORDER_ALREADY_ASSIGNED' });

    // TC5 — cancel at confirmed / picking / offered
    const c1 = await createOrder('TC5a');
    ids.orders.push(String(c1._id));
    ids.numbers.push(c1.orderNumber);
    await fulfillment.runPostOrderIntegrations(String(c1.userId), { id: String(c1._id) });
    await Order.updateOne({ _id: c1._id }, { $set: { status: 'cancelled' } });
    await fulfillment.onCustomerOrderCancelled((await Order.findById(c1._id))!);
    assert(!(await HHDOrder.findOne({ orderId: c1.orderNumber })), 'TC5a HHD ticket remained');

    const c2 = await createOrder('TC5b');
    ids.orders.push(String(c2._id));
    ids.numbers.push(c2.orderNumber);
    await fulfillment.runPostOrderIntegrations(String(c2.userId), { id: String(c2._id) });
    await fulfillment.onHhdStatusChanged(c2.orderNumber, 'picking');
    await Order.updateOne({ _id: c2._id }, { $set: { status: 'cancelled' } });
    await fulfillment.onCustomerOrderCancelled((await Order.findById(c2._id))!);
    await expectCode(
      () => fulfillment.assertCustomerOrderPickable(c2.orderNumber),
      'ORDER_CANCELLED',
    );

    const c3 = await createOrder('TC5c');
    ids.orders.push(String(c3._id));
    ids.numbers.push(c3.orderNumber);
    await fulfillment.runPostOrderIntegrations(String(c3.userId), { id: String(c3._id) });
    await claimHhdOrder(String(hhdA._id), c3.orderNumber);
    await fulfillment.completeHandover({
      hhdOrderId: c3.orderNumber,
      scannedBy: String(hhdA._id),
    });
    await Order.updateOne({ _id: c3._id }, { $set: { status: 'cancelled' } });
    await fulfillment.onCustomerOrderCancelled((await Order.findById(c3._id))!);
    const released = await Order.findById(c3._id);
    assert(released?.riderStage === 'cancelled', `TC5c riderStage ${released?.riderStage}`);
    results.push({ id: 'TC5', pass: true, detail: 'cancel at confirmed / picking / offered' });
  } catch (err) {
    results.push({
      id: 'RUN',
      pass: false,
      detail: (err as Error)?.stack || String(err),
    });
  } finally {
    try {
      await cleanup(ids);
    } catch (cleanupErr) {
      console.error('cleanup failed', cleanupErr);
    }
    for (const row of results) {
      console.log(`${row.pass ? 'PASS' : 'FAIL'} ${row.id} — ${row.detail}`);
    }
    try {
      await Promise.race([
        mongoose.disconnect(),
        new Promise<void>((resolve) => setTimeout(resolve, 4000)),
      ]);
    } catch {
      // ignore
    }
    process.exit(results.some((r) => !r.pass) ? 1 : 0);
  }
}

void main();
