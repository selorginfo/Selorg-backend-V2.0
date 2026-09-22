import type { CartMap, CartVariantMap, Product } from "@/types";
import type { ApiCart, ApiCartLine } from "@/services/cartService";

function lineToProduct(item: ApiCartLine): Product {
  const price = Number(item.price) || 0;
  const mrp = Number(item.originalPrice ?? item.price) || price;
  return {
    id: item.productId,
    name: item.productName || "Product",
    cat: "",
    sub: "",
    unit: item.variantSize || "1 unit",
    price,
    mrp,
    bg: "#f6f6f0",
    brand: "",
    stock: true,
    best: false,
    only: 0,
    discount: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0,
    photo: item.image || "",
    photos: item.image ? [item.image] : [],
    variants: [
      {
        label: item.variantSize || "1 unit",
        price,
        mrp,
        variantId: item.variantId || item.productId,
      },
    ],
  };
}

/** Maps a selorg-service cart response into the webapp's local cart state shape. */
export function mapApiCartToLocalState(
  apiCart: ApiCart,
  catalogProducts: Product[],
): { cart: CartMap; cartVariant: CartVariantMap; productCache: Record<string, Product> } {
  const cart: CartMap = {};
  const cartVariant: CartVariantMap = {};
  const productCache: Record<string, Product> = {};

  for (const item of apiCart.items ?? []) {
    if (!item.productId || item.quantity <= 0) continue;
    cart[item.productId] = item.quantity;

    const catalog = catalogProducts.find((p) => p.id === item.productId);
    const base = catalog ?? lineToProduct(item);
    productCache[item.productId] = base;

    const vIdx = base.variants.findIndex((v) => v.variantId === item.variantId);
    cartVariant[item.productId] = vIdx >= 0 ? vIdx : 0;
  }

  return { cart, cartVariant, productCache };
}
