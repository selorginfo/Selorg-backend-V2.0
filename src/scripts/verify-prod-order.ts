import '../config/env';
import mongoose from 'mongoose';
import { connectDB } from '../database/mongoose';
import { Order } from '../modules/orders/order.model';
import * as ops from '../modules/admin/ops-flow.service';

const ORDER = process.argv[2] || 'PROD-41400692-ORD';

async function main() {
  await connectDB();
  const o = await Order.findOne({ orderNumber: ORDER }).lean();
  if (!o) {
    console.error('ORDER_MISSING', ORDER);
    process.exitCode = 1;
    return;
  }
  console.log(
    'ORDER',
    JSON.stringify(
      {
        orderNumber: o.orderNumber,
        status: o.status,
        fulfillmentStage: o.fulfillmentStage,
        paymentStatus: o.paymentStatus,
        otpVerified: o.otpVerified,
        ratingScore: o.ratingScore,
        hhdUserId: o.hhdUserId,
        pickerId: o.pickerId,
        riderId: o.riderId,
        hsdDeviceId: o.hsdDeviceId,
        dispatchBay: o.dispatchBay,
        codCollectedAmount: o.codCollectedAmount,
      },
      null,
      2,
    ),
  );
  const progress = await ops.listOrderProgress({ limit: 100 });
  console.log('OPS_PROGRESS', JSON.stringify(progress.find((p) => p.orderNumber === ORDER), null, 2));
  const cod = await ops.getCodSummary('this_month');
  console.log('COD_ROW', JSON.stringify(cod.orders.find((x) => x.orderNumber === ORDER), null, 2));
  const reviews = await ops.listReviews({});
  console.log(
    'REVIEW',
    JSON.stringify(
      reviews.find((r) => r.orderNumber === ORDER),
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.race([mongoose.disconnect(), new Promise((r) => setTimeout(r, 3000))]);
    process.exit(process.exitCode ?? 0);
  });
