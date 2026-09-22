import mongoose from 'mongoose';
import { AppError } from '../../utils/AppError';
import { cacheService } from '../../utils/cache';
import { pickFirstNonStubString } from '../../utils/mediaEnrichment';
import { pickMaxOrderLimit } from '../../utils/catalogMediaFields';
import { Product } from '../products/products.model';
import {
  resolveAvailableStock,
  resolveAvailableStockForProduct,
  resolveMaxOrderLimit,
  isProductPurchasable,
  assertStockAllowsAsync,
  attachLiveSellableStock,
} from '../products/products.stock';
import * as cartRepo from './cart.repository';
import { ICart, ICartItem } from './cart.model';

interface CartOptions {
  userId?: string;
  couponCode?: string | null;
  zone?: string | null;
  paymentMethod?: string | null;
}

interface CartLineDto {
  id: string;
  productId: string;
  productName: string;
  variantId: string;
  variantSize: string;
  quantity: number;
  price: number;
  originalPrice?: number;
  gstRate: number;
  image: string;
  stock?: number;
  inStock?: boolean;
  storeStock?: number;
  catalogStockQuantity?: number;
  maxOrderLimit?: number | null;
}

interface CartResponse {
  items: CartLineDto[];
  itemTotal: number;
  discount: number;
  deliveryFee: number;
  handlingCharge: number;
  tax: number;
  total: number;
  skippedItems?: Array<{ productId: string; reason: string }>;
}

const EMPTY_CART: CartResponse = { items: [], itemTotal: 0, discount: 0, deliveryFee: 0, handlingCharge: 0, tax: 0, total: 0 };

/**
 * The legacy service computed totals via a dynamic pricing engine (coupon/zone/payment-
 * aware) with a plain item-sum as its shadow/fallback. That pricing engine (coupons, zone
 * delivery-fee tables, payment-method surcharges) has not been ported yet — deferred to a
 * future dedicated module, same as `search`. Until then cart totals always use the plain
 * sum (== legacy's fallback path); `couponCode`/`zone`/`paymentMethod` are accepted for API
 * shape compatibility but currently have no effect on the numbers returned.
 */
function computeTotals(items: CartLineDto[]) {
  const itemTotal = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  return { itemTotal, discount: 0, deliveryFee: 0, handlingCharge: 0, tax: 0, total: itemTotal };
}

function toObjectId(userId: string | undefined): mongoose.Types.ObjectId {
  const str = String(userId || '').trim();
  if (!mongoose.Types.ObjectId.isValid(str)) throw AppError.unauthorized('Invalid user id');
  return new mongoose.Types.ObjectId(str);
}

function tryObjectId(userId: string | undefined): mongoose.Types.ObjectId | null {
  const str = String(userId || '').trim();
  return mongoose.Types.ObjectId.isValid(str) ? new mongoose.Types.ObjectId(str) : null;
}

/** Drop cached GET /cart responses so checkout clears are visible immediately. */
export async function invalidateCartGetCache(): Promise<void> {
  await cacheService.delPattern('cache:*customer/cart*');
  await cacheService.delPattern('cache:*/cart*');
}

/** Stable cart line key — empty variantId and productId-only SKUs must match. */
function normalizeVariantId(productId: unknown, variantId: unknown): string {
  const pid = String(productId || '').trim();
  const vid = variantId != null ? String(variantId).trim() : '';
  if (!vid || vid === pid) return pid;
  return vid;
}

function matchCartLine(it: { productId: unknown; variantId?: unknown }, productId: unknown, variantId: unknown): boolean {
  const pid = String(productId || '').trim();
  const vid = normalizeVariantId(pid, variantId);
  const linePid = String(it.productId || '').trim();
  const lineVid = normalizeVariantId(it.productId, it.variantId);
  return linePid === pid && lineVid === vid;
}

function pickPrimaryImage(product: Record<string, unknown> | null | undefined): string {
  if (!product) return '';
  const images = product.images;
  const img0 = Array.isArray(images) && images.length > 0 && typeof images[0] === 'string' ? (images[0] as string).trim() : '';
  return pickFirstNonStubString(product.thumbnailUrl, product.cardImageUrl, product.imageUrl, img0);
}

interface LineSnapshot {
  lineProductId: string;
  lineVariantId: string;
  variantSize: string;
  quantityPrice: number;
  originalPrice: number;
  productName: string;
  image: string;
  gstRate: number;
  catalogProduct: Record<string, unknown>;
}

/**
 * Resolve catalog row + line keys for add-to-cart (embedded variants, single SKU, hierarchy sibling).
 */
async function resolveLineSnapshot(productId: string, variantId?: string | null): Promise<LineSnapshot | { error: string }> {
  const pid = String(productId || '').trim();
  if (!pid || !mongoose.Types.ObjectId.isValid(pid)) return { error: 'Product not found' };

  let catalogProduct = await Product.findById(pid).lean<Record<string, unknown>>();
  if (!catalogProduct) return { error: 'Product not found' };

  const requestedVid = variantId != null ? String(variantId).trim() : '';
  const lineVariantId = normalizeVariantId(pid, requestedVid);
  let lineProductId = pid;
  let price = Number(catalogProduct.price || 0);
  let originalPrice = Number((catalogProduct.originalPrice as number) ?? (catalogProduct.mrp as number) ?? price);
  let variantSize = String(catalogProduct.size || catalogProduct.quantity || '').trim();
  let productName = (catalogProduct.name as string) || '';
  let image = pickPrimaryImage(catalogProduct);
  let gstRate = (catalogProduct.gstRate as number) || 0;

  const variants = catalogProduct.variants as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(variants) && variants.length > 0) {
    const embedded = variants.find(
      (v, i) => String(v.id ?? v._id ?? `${pid}-v${i}`) === requestedVid || String(v._id ?? '') === requestedVid,
    );
    if (embedded) {
      price = Number(embedded.price ?? catalogProduct.price ?? 0);
      originalPrice = Number((embedded.originalPrice as number) ?? (embedded.mrp as number) ?? (catalogProduct.mrp as number) ?? price);
      variantSize = String(embedded.size || embedded.quantity || variantSize).trim() || '1 unit';
    }
  } else if (requestedVid && requestedVid !== pid && mongoose.Types.ObjectId.isValid(requestedVid)) {
    const skuDoc = await Product.findById(requestedVid).lean<Record<string, unknown>>();
    if (skuDoc) {
      catalogProduct = skuDoc;
      lineProductId = String(skuDoc._id);
      price = Number(skuDoc.price || 0);
      originalPrice = Number((skuDoc.originalPrice as number) ?? (skuDoc.mrp as number) ?? price);
      variantSize = String(skuDoc.size || skuDoc.quantity || '').trim() || '1 unit';
      productName = (skuDoc.name as string) || productName;
      image = pickPrimaryImage(skuDoc) || image;
      gstRate = (skuDoc.gstRate as number) || gstRate;
    }
  }

  if (!variantSize) variantSize = '1 unit';

  catalogProduct = await ensureMaxOrderLimitFromStyle(catalogProduct);

  return { lineProductId, lineVariantId, variantSize, quantityPrice: price, originalPrice, productName, image, gstRate, catalogProduct };
}

/**
 * When a Variant SKU has no MaxOrderLimit, inherit from the Style (or any sibling) row.
 */
async function ensureMaxOrderLimitFromStyle(catalogProduct: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!catalogProduct) return catalogProduct;
  if (resolveMaxOrderLimit(catalogProduct) != null) return catalogProduct;
  const code = String(catalogProduct.hierarchyCode || '').trim();
  if (!code) return catalogProduct;
  const style = await Product.findOne({ hierarchyCode: code, classification: 'Style', isActive: true, maxOrderLimit: { $gt: 0 } })
    .select('maxOrderLimit')
    .lean<{ maxOrderLimit?: number }>();
  if (style && resolveMaxOrderLimit(style) != null) return { ...catalogProduct, maxOrderLimit: style.maxOrderLimit };
  const sibling = await Product.findOne({ hierarchyCode: code, isActive: true, maxOrderLimit: { $gt: 0 }, _id: { $ne: catalogProduct._id } })
    .select('maxOrderLimit')
    .lean<{ maxOrderLimit?: number }>();
  if (sibling && resolveMaxOrderLimit(sibling) != null) return { ...catalogProduct, maxOrderLimit: sibling.maxOrderLimit };
  return catalogProduct;
}

/** Merge duplicate cart lines (same product + variant) before formatting. */
async function dedupeCartLines(userId: mongoose.Types.ObjectId): Promise<void> {
  const cart = await cartRepo.findByUser(userId);
  if (!cart || !Array.isArray(cart.items) || cart.items.length < 2) return;

  const merged = new Map<string, ICartItem>();
  for (const it of cart.items) {
    const pid = String(it.productId);
    const vid = normalizeVariantId(pid, it.variantId);
    const key = `${pid}::${vid}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity += Number(it.quantity) || 0;
      if (!pickFirstNonStubString(existing.image) && pickFirstNonStubString(it.image)) existing.image = it.image;
    } else {
      const plain = (it as unknown as { toObject?: () => ICartItem }).toObject?.() ?? it;
      merged.set(key, { ...plain, productId: it.productId, variantId: vid } as ICartItem);
    }
  }

  cart.set('items', Array.from(merged.values()));
  await cart.save();
}

/**
 * Cap each line at Master Sheet MaxOrderLimit so stale over-limit carts cannot
 * proceed to checkout display / payment with illegal quantities.
 */
async function clampCartToMaxOrderLimits(userId: mongoose.Types.ObjectId): Promise<void> {
  const cart = await cartRepo.findByUser(userId);
  if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) return;

  const productIds = [...new Set(cart.items.map((it) => String(it.productId || '').trim()).filter((id) => id && mongoose.Types.ObjectId.isValid(id)))];
  if (productIds.length === 0) return;

  const products = await Product.find({ _id: { $in: productIds } }).select('maxOrderLimit hierarchyCode classification').lean<Record<string, unknown>[]>();
  const withLimits = await Promise.all(products.map((p) => ensureMaxOrderLimitFromStyle(p)));
  const byId = new Map(withLimits.map((p) => [String(p._id), p]));

  let changed = false;
  for (const it of cart.items) {
    const max = resolveMaxOrderLimit(byId.get(String(it.productId)));
    if (max == null) continue;
    const qty = Number(it.quantity) || 0;
    if (qty > max) {
      it.quantity = max;
      changed = true;
    }
  }

  if (changed) {
    await cart.save();
    await invalidateCartGetCache();
  }
}

async function hydrateCartItemImages(items: CartLineDto[]): Promise<CartLineDto[]> {
  if (items.length === 0) return items;
  const missing = items.filter((it) => !pickFirstNonStubString(it.image));
  if (missing.length === 0) return items;

  const productIds = [...new Set(missing.map((it) => it.productId).filter((id) => mongoose.Types.ObjectId.isValid(id)))];
  if (productIds.length === 0) return items;

  const products = await Product.find({ _id: { $in: productIds } }).select('imageUrl thumbnailUrl cardImageUrl images').lean<Record<string, unknown>[]>();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  return items.map((it) => {
    if (pickFirstNonStubString(it.image)) return it;
    const resolved = pickPrimaryImage(byId.get(it.productId));
    return resolved ? { ...it, image: resolved } : it;
  });
}

/** Attach live stockStatus from Product + StoreInventory onto each cart line. */
async function hydrateCartItemStock(items: CartLineDto[]): Promise<CartLineDto[]> {
  if (items.length === 0) return items;
  const productIds = [...new Set(items.map((it) => it.productId).filter((id) => mongoose.Types.ObjectId.isValid(id)))];
  if (productIds.length === 0) return items.map((it) => ({ ...it, stock: 0, inStock: false }));

  const products = await Product.find({ _id: { $in: productIds } })
    .select('stock stockQuantity fixedStock isActive isSaleable isPurchasable status maxOrderLimit hierarchyCode classification')
    .lean<Record<string, unknown>[]>();
  const withInherited = await Promise.all(products.map((p) => ensureMaxOrderLimitFromStyle(p)));
  const withStock = await attachLiveSellableStock(withInherited);
  const byId = new Map(withStock.map((p) => [String(p._id), p]));

  return items.map((it) => {
    const catalog = byId.get(it.productId);
    const stock = resolveAvailableStock(catalog);
    const inStock = isProductPurchasable(catalog);
    return {
      ...it,
      stock,
      inStock,
      storeStock: catalog?.storeStock as number | undefined,
      catalogStockQuantity: catalog?.catalogStockQuantity as number | undefined,
      maxOrderLimit: pickMaxOrderLimit(catalog || {}),
    };
  });
}

async function formatCartResponse(cart: { items: ICartItem[] }, _options: CartOptions = {}): Promise<CartResponse> {
  let items: CartLineDto[] = (cart.items || []).map((it) => ({
    id: String(it._id),
    productId: String(it.productId),
    productName: it.productName || '',
    variantId: normalizeVariantId(it.productId, it.variantId),
    variantSize: it.variantSize || '',
    quantity: it.quantity,
    price: it.price,
    originalPrice: it.originalPrice,
    gstRate: it.gstRate || 0,
    image: pickFirstNonStubString(it.image),
  }));
  items = await hydrateCartItemImages(items);
  items = await hydrateCartItemStock(items);

  return { items, ...computeTotals(items) };
}

/**
 * Resolve catalog keys and locate a cart line (handles parent vs SKU product ids).
 */
async function locateCartLine(cart: ICart | null, productId: string, variantId?: string | null) {
  if (!cart || !Array.isArray(cart.items) || !productId) return null;

  let line = cart.items.find((it) => matchCartLine(it, productId, variantId));
  if (line) return line;

  const snapshot = await resolveLineSnapshot(productId, variantId);
  if ('error' in snapshot) return null;

  line = cart.items.find((it) => matchCartLine(it, snapshot.lineProductId, snapshot.lineVariantId));
  if (line) return line;

  return cart.items.find(
    (it) => String(it.variantId || '').trim() === snapshot.lineVariantId && (String(it.productId) === snapshot.lineProductId || String(it.productId) === String(productId)),
  );
}

/** Live stock lookup that degrades to catalog stock if StoreInventory query fails. */
async function resolveAvailableStockForProductSafe(product: Record<string, unknown>): Promise<number> {
  try {
    return await resolveAvailableStockForProduct(product);
  } catch {
    return resolveAvailableStock(product);
  }
}

export async function getCartForUser(userId: string | undefined, options: CartOptions = {}): Promise<CartResponse> {
  const uid = toObjectId(userId);
  await dedupeCartLines(uid);
  await clampCartToMaxOrderLimits(uid);
  const cart = await cartRepo.findByUserLean(uid);
  if (!cart || !cart.items || cart.items.length === 0) return EMPTY_CART;
  return formatCartResponse(cart as unknown as { items: ICartItem[] }, { userId: uid.toString(), ...options });
}

export async function addItem(userId: string | undefined, body: { productId?: string; variantId?: string; quantity?: number }): Promise<CartResponse | { error: string }> {
  const uid = toObjectId(userId);
  const { productId, variantId, quantity } = body;
  const qty = Math.max(1, Number(quantity) || 1);
  if (!productId) return { error: 'productId and quantity required' };

  const snapshot = await resolveLineSnapshot(productId, variantId);
  if ('error' in snapshot) return snapshot;

  const { lineProductId, lineVariantId, variantSize, quantityPrice, originalPrice, productName, image, gstRate, catalogProduct } = snapshot;

  await dedupeCartLines(uid);

  let cart = await cartRepo.findByUser(uid);
  const existingQty = cart ? Number(cart.items.find((it) => matchCartLine(it, lineProductId, lineVariantId))?.quantity) || 0 : 0;

  const stockCheck = await assertStockAllowsAsync(catalogProduct, qty, existingQty, 'add');
  if (stockCheck.error) return { error: stockCheck.error };

  if (!cart) {
    cart = await cartRepo.create({
      userId: uid,
      items: [
        {
          productId: new mongoose.Types.ObjectId(lineProductId),
          variantId: lineVariantId,
          variantSize,
          quantity: qty,
          price: quantityPrice,
          originalPrice,
          gstRate: gstRate || 0,
          productName,
          image,
        },
      ],
    });
    await invalidateCartGetCache();
    return formatCartResponse(cart.toObject(), { userId: uid.toString() });
  }

  const existing = cart.items.find((it) => matchCartLine(it, lineProductId, lineVariantId));
  if (existing) {
    existing.quantity = (Number(existing.quantity) || 0) + qty;
    if (!pickFirstNonStubString(existing.image) && pickFirstNonStubString(image)) existing.image = image;
  } else {
    cart.items.push({
      productId: new mongoose.Types.ObjectId(lineProductId),
      variantId: lineVariantId,
      variantSize,
      quantity: qty,
      price: quantityPrice,
      originalPrice,
      gstRate: gstRate || 0,
      productName,
      image,
    } as ICartItem);
  }

  await cart.save();
  await dedupeCartLines(uid);
  await invalidateCartGetCache();
  const fresh = await cartRepo.findByUser(uid);
  return formatCartResponse((fresh || cart).toObject(), { userId: uid.toString() });
}

export async function updateItem(
  userId: string | undefined,
  itemId: string | null,
  quantity: number | null | undefined,
  opts: { productId?: string; variantId?: string } = {},
): Promise<CartResponse | { error: string }> {
  const { productId, variantId } = opts;
  if (quantity == null || quantity < 0) return { error: 'Invalid quantity' };
  if (quantity === 0) return removeItem(userId, itemId, opts);

  const uid = tryObjectId(userId);
  if (!uid) return { error: 'Invalid user id' };

  let productForStock: Record<string, unknown> | null = null;
  if (productId && mongoose.Types.ObjectId.isValid(String(productId))) {
    const snapshot = await resolveLineSnapshot(productId, variantId);
    if (!('error' in snapshot)) productForStock = snapshot.catalogProduct;
  } else if (itemId && mongoose.Types.ObjectId.isValid(itemId)) {
    const existingCart = await cartRepo.findByUserLean(uid);
    const line = existingCart?.items?.find((it) => String(it._id) === String(itemId));
    if (line?.productId) productForStock = await Product.findById(line.productId).lean<Record<string, unknown>>();
  }
  if (productForStock) {
    const stockCheck = await assertStockAllowsAsync(productForStock, quantity, 0, 'set');
    if (stockCheck.error) return { error: stockCheck.error };
  }

  let itemObjectId: mongoose.Types.ObjectId | null = null;
  if (itemId && mongoose.Types.ObjectId.isValid(itemId)) {
    itemObjectId = new mongoose.Types.ObjectId(itemId);
  } else if (productId) {
    const cart = await cartRepo.findByUserLean(uid);
    const line = await locateCartLine(cart as unknown as ICart | null, productId, variantId);
    if (!line) return { error: 'Item not found' };
    itemObjectId = line._id as mongoose.Types.ObjectId;
  } else {
    return { error: 'Item not found' };
  }

  const cart = await cartRepo.setQuantityByItemId(uid, itemObjectId, quantity);
  if (!cart) return { error: 'Item not found' };

  await invalidateCartGetCache();
  return formatCartResponse(cart as unknown as { items: ICartItem[] }, { userId: uid.toString() });
}

export async function removeItem(userId: string | undefined, itemId: string | null, opts: { productId?: string; variantId?: string } = {}): Promise<CartResponse | { error: string }> {
  const { productId, variantId } = opts;
  const uid = tryObjectId(userId);
  if (!uid) return { error: 'Invalid user id' };

  let itemObjectId: mongoose.Types.ObjectId;
  if (itemId && mongoose.Types.ObjectId.isValid(itemId)) {
    itemObjectId = new mongoose.Types.ObjectId(itemId);
  } else if (productId) {
    const cart = await cartRepo.findByUserLean(uid);
    const line = await locateCartLine(cart as unknown as ICart | null, productId, variantId);
    if (!line) return { error: 'Item not found' };
    itemObjectId = line._id as mongoose.Types.ObjectId;
  } else {
    return { error: 'Item not found' };
  }

  const cart = await cartRepo.pullItem(uid, itemObjectId);
  if (!cart) return { error: 'Cart not found' };

  await invalidateCartGetCache();
  return formatCartResponse(cart as unknown as { items: ICartItem[] }, { userId: uid.toString() });
}

export async function clearCart(userId: string | undefined, session?: mongoose.ClientSession): Promise<CartResponse> {
  const uid = toObjectId(userId);
  await cartRepo.clearItems(uid, session);
  if (!session) await invalidateCartGetCache();
  return EMPTY_CART;
}

/** Map order line items back to cart-item shape (used by restoreCartFromOrder). */
function mapOrderItemsToCartItems(orderItems: Array<Record<string, unknown>>): Array<Partial<ICartItem>> {
  return (orderItems || []).map((it) => ({
    productId: new mongoose.Types.ObjectId(String(it.productId)),
    variantId: (it.variantId as string) || '',
    variantSize: (it.variantSize as string) || '',
    quantity: it.quantity as number,
    price: it.price as number,
    originalPrice: (it.originalPrice as number) ?? (it.price as number),
    gstRate: (it.gstRate as number) || 0,
    productName: (it.productName as string) || '',
    image: (it.image as string) || '',
  }));
}

/**
 * Replace-by-merge server cart with line items from a customer order (e.g. after failed
 * online payment). Ported from legacy `cartService.restoreCartFromOrder` — merges into the
 * live cart rather than replacing it (the restore can run minutes after checkout via
 * webhook/reconciliation, and the customer may have added new items since); existing lines
 * win, only order lines the cart does not already contain are added back.
 *
 * Exactly-once is enforced by the caller (orders module) via `Order.cartRestoredAt` claim —
 * this function itself is not idempotent, callers must claim first.
 */
export async function restoreCartFromOrder(userId: string, orderItems: Array<Record<string, unknown>>): Promise<{ ok: true }> {
  const uid = toObjectId(userId);
  const restoredItems = mapOrderItemsToCartItems(orderItems);
  const cart = await cartRepo.ensureExists(uid);
  for (const line of restoredItems) {
    const exists = cart.items.some((it) => matchCartLine(it, line.productId, line.variantId));
    if (!exists) cart.items.push(line as ICartItem);
  }
  await cart.save();
  await dedupeCartLines(uid);
  await invalidateCartGetCache();
  return { ok: true };
}

/** Cap of remembered merge idempotency keys per cart (oldest dropped first). */
const MAX_APPLIED_MERGE_KEYS = 20;

/**
 * Merge a guest cart into the authenticated user's server cart — exactly once.
 *
 * Business rule: quantities of the same product+variant are summed (guest qty added on top
 * of server qty); new products become new lines.
 *
 * Idempotency: `mergeKey` is a client-generated key persisted on the cart. Replaying the
 * same key (page refresh, retry, second tab) is a no-op that returns the current cart, so a
 * guest cart can never be applied twice.
 */
export async function mergeGuestItems(
  userId: string | undefined,
  guestItems: Array<{ productId?: string; variantId?: string; quantity?: number }>,
  mergeKey: string,
): Promise<CartResponse | { error: string }> {
  const uid = toObjectId(userId);
  const key = String(mergeKey || '').trim();
  if (!key) return { error: 'mergeKey required' };

  const list = (Array.isArray(guestItems) ? guestItems : [])
    .map((raw) => ({
      productId: String(raw?.productId || '').trim(),
      variantId: raw?.variantId != null ? String(raw.variantId).trim() : '',
      quantity: Math.floor(Number(raw?.quantity) || 0),
    }))
    .filter((it) => it.productId && it.quantity > 0);

  await dedupeCartLines(uid);

  await cartRepo.ensureExists(uid);
  const cart = await cartRepo.claimMergeKey(uid, key, MAX_APPLIED_MERGE_KEYS);
  if (!cart) {
    const current = await cartRepo.findByUserLean(uid);
    return formatCartResponse((current || { items: [] }) as unknown as { items: ICartItem[] }, { userId: uid.toString() });
  }

  const skipped: Array<{ productId: string; reason: string }> = [];
  for (const guestLine of list) {
    const snapshot = await resolveLineSnapshot(guestLine.productId, guestLine.variantId);
    if ('error' in snapshot) {
      skipped.push({ productId: guestLine.productId, reason: snapshot.error });
      continue;
    }

    const { lineProductId, lineVariantId, variantSize, quantityPrice, originalPrice, productName, image, gstRate, catalogProduct } = snapshot;

    const existing = cart.items.find((it) => matchCartLine(it, lineProductId, lineVariantId));
    const existingQty = Number(existing?.quantity) || 0;

    const available = await resolveAvailableStockForProductSafe(catalogProduct);
    if (!isProductPurchasable(catalogProduct, available) || available <= 0) {
      skipped.push({ productId: guestLine.productId, reason: 'Out of stock' });
      continue;
    }
    const maxOrder = resolveMaxOrderLimit(catalogProduct);
    const purchasableCap = maxOrder != null ? Math.min(available, maxOrder) : available;
    const desired = existingQty + guestLine.quantity;
    const target = Math.min(desired, purchasableCap);
    if (target <= existingQty) {
      if (desired > existingQty) {
        skipped.push({
          productId: guestLine.productId,
          reason: maxOrder != null && desired > maxOrder ? `Maximum order limit reached. You can order only ${maxOrder} units of this product.` : 'Stock limit reached',
        });
      }
      continue;
    }

    if (existing) {
      existing.quantity = target;
      if (!pickFirstNonStubString(existing.image) && pickFirstNonStubString(image)) existing.image = image;
    } else {
      cart.items.push({
        productId: new mongoose.Types.ObjectId(lineProductId),
        variantId: lineVariantId,
        variantSize,
        quantity: target,
        price: quantityPrice,
        originalPrice,
        gstRate: gstRate || 0,
        productName,
        image,
      } as ICartItem);
    }
  }

  await cart.save();
  await dedupeCartLines(uid);
  await clampCartToMaxOrderLimits(uid);
  await invalidateCartGetCache();

  const fresh = await cartRepo.findByUserLean(uid);
  const response = await formatCartResponse((fresh || cart.toObject()) as unknown as { items: ICartItem[] }, { userId: uid.toString() });
  if (skipped.length > 0) response.skippedItems = skipped;
  return response;
}
