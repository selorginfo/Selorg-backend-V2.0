import mongoose from 'mongoose';
import { StoreInventory } from './store-inventory.model';

interface ProductStockFields {
  _id?: unknown;
  id?: unknown;
  catalogStockQuantity?: unknown;
  stockQuantity?: unknown;
  stock?: unknown;
  fixedStock?: unknown;
  storeStock?: unknown;
  availableStock?: unknown;
  isActive?: boolean;
  status?: string;
  isSaleable?: boolean;
  isPurchasable?: boolean;
  maxOrderLimit?: unknown;
}

/** Catalog Fixed Stock (`stockQuantity`/`stock`/`fixedStock`) from the master sheet — often 0, not the operational sellable qty. */
export function resolveCatalogStock(product?: ProductStockFields | null): number {
  if (!product || typeof product !== 'object') return 0;
  const candidates = [product.catalogStockQuantity, product.stockQuantity, product.stock, product.fixedStock];
  for (const raw of candidates) {
    if (raw === undefined || raw === null || raw === '') continue;
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  return 0;
}

function sellableFromInventoryRow(row: { isAvailable?: boolean; quantity?: number; reservedQty?: number } | null): number {
  if (!row || row.isAvailable === false) return 0;
  const qty = Number(row.quantity) || 0;
  const reserved = Number(row.reservedQty) || 0;
  return Math.max(0, Math.floor(qty - reserved));
}

/**
 * Operational sellable stock from dark-store StoreInventory. When storeId is omitted, uses
 * the best available qty across stores.
 */
export async function getStoreSellableQtyMap(productIds: unknown[], storeId: string | null = null): Promise<Map<string, number>> {
  const ids = [
    ...new Set(
      (productIds || [])
        .map((id) => {
          const s = String(id || '').trim();
          return s && mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : null;
        })
        .filter((v): v is mongoose.Types.ObjectId => v !== null),
    ),
  ];
  const map = new Map<string, number>();
  if (ids.length === 0) return map;

  const filter: Record<string, unknown> = { productId: { $in: ids }, isAvailable: true, quantity: { $gt: 0 } };
  if (storeId && mongoose.Types.ObjectId.isValid(String(storeId))) {
    filter.storeId = new mongoose.Types.ObjectId(String(storeId));
  }

  const rows = await StoreInventory.find(filter).select('productId quantity reservedQty isAvailable storeId').lean();

  for (const row of rows) {
    const key = String(row.productId);
    const sellable = sellableFromInventoryRow(row);
    if (sellable <= 0) continue;
    if (storeId) {
      map.set(key, sellable);
    } else {
      map.set(key, Math.max(map.get(key) || 0, sellable));
    }
  }
  return map;
}

/** Live sellable units = max(catalog Fixed Stock, store inventory) — store inventory is the operational source of truth. */
export function resolveAvailableStock(product?: ProductStockFields | null, storeQty: number | null = null): number {
  const catalog = resolveCatalogStock(product);
  const fromStore =
    storeQty != null && Number.isFinite(Number(storeQty))
      ? Math.max(0, Math.floor(Number(storeQty)))
      : Number.isFinite(Number(product?.storeStock))
        ? Math.max(0, Math.floor(Number(product?.storeStock)))
        : Number.isFinite(Number(product?.availableStock))
          ? Math.max(0, Math.floor(Number(product?.availableStock)))
          : 0;
  return Math.max(catalog, fromStore);
}

export function isProductPurchasable(product?: ProductStockFields | null, storeQty: number | null = null): boolean {
  if (!product) return false;
  if (product.isActive === false) return false;
  if (product.status === 'inactive' || product.status === 'draft') return false;
  // isSaleable gates listing; live stock comes from StoreInventory/stockQuantity. Catalog
  // isPurchasable is ignored — it's often false while dark-store inventory exists.
  if (product.isSaleable === false) return false;
  return resolveAvailableStock(product, storeQty) > 0;
}

/**
 * Attaches live sellable stock onto product docs for customer APIs. Sets stock/stockQuantity
 * to the live sellable qty (clients read those fields directly), keeps catalogStockQuantity/
 * storeStock for debugging transparency.
 */
export async function attachLiveSellableStock<T extends ProductStockFields>(products: T[], options: { storeId?: string | null } = {}): Promise<Array<T & { catalogStockQuantity: number; storeStock: number; availableStock: number; stockQuantity: number; stock: number }>> {
  const list = Array.isArray(products) ? products : [];
  if (list.length === 0) return list as never;
  const storeId = options.storeId || null;
  const ids = list.map((p) => p?._id || p?.id).filter(Boolean);
  const qtyById = await getStoreSellableQtyMap(ids, storeId);

  return list.map((p) => {
    const id = String(p._id || p.id || '');
    const catalog = resolveCatalogStock(p);
    const storeStock = qtyById.get(id) || 0;
    const available = Math.max(catalog, storeStock);
    return { ...p, catalogStockQuantity: catalog, storeStock, availableStock: available, stockQuantity: available, stock: available };
  });
}

export async function resolveAvailableStockForProduct(product?: ProductStockFields | null, options: { storeId?: string | null } = {}): Promise<number> {
  if (!product) return 0;
  const id = product._id || product.id;
  if (!id) return resolveAvailableStock(product);
  const map = await getStoreSellableQtyMap([id], options.storeId || null);
  return resolveAvailableStock(product, map.get(String(id)) || 0);
}

/** Master Sheet MaxOrderLimit — null/missing/<=0 means unlimited. */
export function resolveMaxOrderLimit(product?: ProductStockFields | null): number | null {
  if (!product) return null;
  const raw = product.maxOrderLimit;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

export interface StockCheckResult {
  error?: string;
  maxOrderLimit?: number | null;
  available?: number;
  stock?: number;
  inStock?: boolean;
}

export function assertMaxOrderLimit(product: ProductStockFields | null | undefined, requestedQty: number, existingCartQty = 0, mode: 'set' | 'add' = 'set'): StockCheckResult {
  const max = resolveMaxOrderLimit(product);
  if (max == null) return { maxOrderLimit: null };
  const desired = mode === 'add' ? (Number(existingCartQty) || 0) + (Number(requestedQty) || 0) : Number(requestedQty) || 0;
  if (desired > max) {
    return { error: `Maximum order limit reached. You can order only ${max} units of this product.`, maxOrderLimit: max };
  }
  return { maxOrderLimit: max };
}

/** Synchronous check using an already-resolved storeQty (e.g. from a bulk lookup). */
export function assertStockAllows(product: ProductStockFields | null | undefined, requestedQty: number, existingCartQty = 0, mode: 'set' | 'add' = 'set', storeQty: number | null = null): StockCheckResult {
  if (!product) return { error: 'Product not found' };
  if (product.isActive === false || product.status === 'inactive' || product.status === 'draft') {
    return { error: 'This product is currently unavailable.' };
  }
  if (product.isSaleable === false) {
    return { error: 'This product is currently unavailable.' };
  }
  const limitCheck = assertMaxOrderLimit(product, requestedQty, existingCartQty, mode);
  if (limitCheck.error) return limitCheck;

  const available = resolveAvailableStock(product, storeQty);
  if (available <= 0) return { error: 'This product is currently out of stock.' };
  const desired = mode === 'add' ? (Number(existingCartQty) || 0) + (Number(requestedQty) || 0) : Number(requestedQty) || 0;
  if (desired > available) return { error: `Only ${available} unit(s) available.`, available };
  return { available, stock: available, inStock: true, maxOrderLimit: limitCheck.maxOrderLimit };
}

/** Resolves live storeQty first (single DB round trip), then applies assertStockAllows. */
export async function assertStockAllowsAsync(product: ProductStockFields | null | undefined, requestedQty: number, existingCartQty = 0, mode: 'set' | 'add' = 'set', options: { storeId?: string | null } = {}): Promise<StockCheckResult> {
  if (!product) return { error: 'Product not found' };
  const available = await resolveAvailableStockForProduct(product, options);
  return assertStockAllows(product, requestedQty, existingCartQty, mode, available);
}
