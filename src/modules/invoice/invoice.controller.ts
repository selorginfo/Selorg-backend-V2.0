import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../../utils/AppError';
import { ResponseFormatter } from '../../utils/response';
import { getOrderById } from '../orders/orders.service';

/**
 * Ported from legacy `customer-backend/controllers/invoiceController.js`. Reuses the same
 * app-formatted order shape `orders.service.getOrderById` already produces (deliveryAddress,
 * items, paymentMethodDisplay) rather than re-deriving it from the raw Order document.
 */

type FormattedDeliveryAddress = {
  line1?: string;
  line2?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

type FormattedOrderItem = {
  productName?: string;
  quantity?: number;
  price?: number;
  originalPrice?: number;
  variantSize?: string;
};

export async function invoice(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.customer?._id) throw AppError.unauthorized();
    const orderId = req.params.id;

    const order = (await getOrderById(req.customer._id, orderId)) as Record<string, unknown> | null;
    if (!order) {
      res.status(404).json(ResponseFormatter.error('Order not found', 404));
      return;
    }

    const addr = order.deliveryAddress as FormattedDeliveryAddress | undefined;
    const addressStr = addr
      ? [addr.line1, addr.line2, addr.address, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ') || 'N/A'
      : 'N/A';

    const items = ((order.items as FormattedOrderItem[]) || []).map((item) => ({
      name: item.productName || 'Item',
      quantity: item.quantity || 1,
      unitPrice: item.price || 0,
      originalPrice: item.originalPrice || item.price || 0,
      total: (item.price || 0) * (item.quantity || 1),
      variantSize: item.variantSize || null,
    }));

    const invoiceData = {
      invoiceNumber: `INV-${String(order.orderNumber || orderId).toUpperCase()}`,
      orderNumber: order.orderNumber || orderId,
      orderDate: order.createdAt || new Date().toISOString(),
      deliveryAddress: addressStr,
      paymentMethod: order.paymentMethodDisplay || 'N/A',
      items,
      subtotal: order.itemTotal || items.reduce((sum, i) => sum + i.total, 0),
      handlingCharge: order.handlingCharge || 0,
      deliveryFee: order.deliveryFee || 0,
      discount: order.discount || 0,
      totalAmount: order.totalBill || 0,
      taxInfo: {
        gstNumber: 'GSTIN: 27AABCU9603R1ZM',
        note: 'Prices are inclusive of all applicable taxes',
      },
    };

    res.status(200).json(ResponseFormatter.success(invoiceData));
  } catch (err) {
    next(err);
  }
}
