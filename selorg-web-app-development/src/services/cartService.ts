import { apiDelete, apiGet, apiPost, apiPut } from "./api";

// ── Types (aligned with selorg-service cart.service CartLineDto / CartResponse) ─

export interface ApiCartLine {
  id: string;
  productId: string;
  productName?: string;
  variantId?: string;
  variantSize?: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  image?: string;
  inStock?: boolean;
}

export interface ApiCart {
  items: ApiCartLine[];
  itemTotal?: number;
  discount?: number;
  deliveryFee?: number;
  handlingCharge?: number;
  tax?: number;
  total?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const cartService = {
  async getCart(): Promise<ApiCart> {
    return apiGet<ApiCart>("/cart");
  },

  async addItem(productId: string, quantity = 1, variantId?: string): Promise<ApiCart> {
    return apiPost<ApiCart>("/cart/items", { productId, quantity, variantId });
  },

  async updateItem(itemId: string, quantity: number, productId?: string, variantId?: string): Promise<ApiCart> {
    return apiPut<ApiCart>(`/cart/items/${itemId}`, { quantity, productId, variantId });
  },

  async updateByProduct(productId: string, quantity: number, variantId?: string): Promise<ApiCart> {
    return apiPut<ApiCart>("/cart/items", { productId, quantity, variantId });
  },

  async clearCart(): Promise<void> {
    await apiDelete("/cart/clear");
  },

  /** POST /cart/merge — idempotent guest→user cart merge (requires mergeKey). */
  async mergeCart(
    mergeKey: string,
    items: Array<{ productId: string; quantity: number; variantId?: string }>,
  ): Promise<ApiCart> {
    return apiPost<ApiCart>("/cart/merge", { mergeKey, items });
  },
};
