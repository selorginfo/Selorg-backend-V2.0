import { apiGet, apiPost } from "./api";

// ── Types (aligned with selorg-service orders.service formatOrderForApp) ─────

export interface ApiOrderItem {
  id?: string;
  productId: string;
  productName?: string;
  name?: string;
  variantId?: string;
  variantSize?: string;
  variant?: string;
  quantity: number;
  price?: number;
  photo?: string;
  image?: string;
}

export interface ApiOrderAddress {
  id?: string;
  label?: string;
  address?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  landmark?: string;
}

export interface CreateOrderInput {
  items: Array<{ productId: string; variantId?: string; quantity: number }>;
  addressId: string;
  paymentMethodType?: "card" | "upi" | "cash" | "wallet" | "digital";
  paymentMethodId?: string;
  couponCode?: string;
  deliveryTip?: number;
  deliveryNotes?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

export interface ApiOrder {
  _id?: string;
  id?: string;
  orderNumber?: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  items?: ApiOrderItem[];
  addressId?: string;
  address?: ApiOrderAddress;
  deliveryAddress?: ApiOrderAddress;
  subtotal?: number;
  itemTotal?: number;
  deliveryFee?: number;
  discount?: number;
  total?: number;
  totalBill?: number;
  paymentMethodType?: string;
  paymentMethodDisplay?: string;
  paymentMethod?: { display?: string; type?: string };
  walletDeduction?: number;
  onlineAmountDue?: number;
  requiresOnlinePayment?: boolean;
  paymentStatus?: string;
  couponCode?: string;
  eta?: string;
  estimatedDeliveryMessage?: string;
  deliveryTimeMinutes?: number | null;
  tracking?: {
    statusIndex?: number;
    etaMin?: number;
  };
  timeline?: Array<{ status: string; timestamp?: string; note?: string }>;
}

interface ListOrdersEnvelope {
  data?: ApiOrder[];
  list?: ApiOrder[];
  orders?: ApiOrder[];
  pagination?: { page: number; limit: number; total: number; totalPages?: number };
}

export interface OrderTrackingResult {
  status?: string;
  statusIndex?: number;
  deliveryTimeMinutes?: number | null;
  estimatedDelivery?: string;
  deliveryAddressLine?: string;
  deliveryPartner?: {
    name?: string;
    phone?: string;
    rating?: number;
    vehicle?: string;
    initial?: string;
  };
  riderLocation?: {
    latitude?: number;
    longitude?: number;
    updatedAt?: string;
  };
}

export interface OrderInvoice {
  invoiceNumber: string;
  orderNumber: string;
  orderDate: string;
  deliveryAddress: string;
  paymentMethod: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    variantSize?: string | null;
  }>;
  subtotal: number;
  handlingCharge: number;
  deliveryFee: number;
  discount: number;
  totalAmount: number;
  taxInfo?: { gstNumber?: string; note?: string };
}

// ── Service ───────────────────────────────────────────────────────────────────

function unwrapOrderList(result: ListOrdersEnvelope | ApiOrder[]): ApiOrder[] {
  if (Array.isArray(result)) return result;
  return result?.data ?? result?.list ?? result?.orders ?? [];
}

export const orderService = {
  async listOrders(params?: { page?: number; limit?: number; status?: string }): Promise<ApiOrder[]> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);
    const qs = query.toString();
    const result = await apiGet<ListOrdersEnvelope | ApiOrder[]>(`/orders${qs ? `?${qs}` : ""}`);
    return unwrapOrderList(result);
  },

  async getActiveOrder(): Promise<ApiOrder | null> {
    return apiGet<ApiOrder | null>("/orders/active");
  },

  async getOrderById(id: string): Promise<ApiOrder> {
    return apiGet<ApiOrder>(`/orders/${id}`);
  },

  async createOrder(input: CreateOrderInput, opts?: { idempotencyKey?: string }): Promise<ApiOrder> {
    return apiPost<ApiOrder>("/orders", input, {
      headers: opts?.idempotencyKey
        ? { "Idempotency-Key": opts.idempotencyKey }
        : undefined,
    });
  },

  async cancelOrder(id: string, reason?: string): Promise<void> {
    // Always send a JSON object — empty body fails Zod `cancelOrderSchema` (422).
    await apiPost(`/orders/${id}/cancel`, reason ? { reason } : {});
  },

  async reorder(id: string): Promise<void> {
    await apiPost(`/orders/${id}/reorder`);
  },

  async getTracking(id: string): Promise<OrderTrackingResult> {
    return apiGet<OrderTrackingResult>(`/orders/${id}/tracking`);
  },

  async rateOrder(id: string, rating: number, comment?: string): Promise<void> {
    await apiPost(`/orders/${id}/rate`, { rating, comment });
  },

  async getInvoice(id: string): Promise<OrderInvoice> {
    return apiGet<OrderInvoice>(`/orders/${id}/invoice`);
  },
};
