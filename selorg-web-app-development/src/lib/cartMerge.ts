/** Stable idempotency key for POST /cart/merge — one merge per browser profile. */
const MERGE_KEY_STORAGE = "selorg_cart_merge_key";

export function getCartMergeKey(): string {
  if (typeof window === "undefined") return "ssr";
  let key = localStorage.getItem(MERGE_KEY_STORAGE);
  if (!key) {
    key = `merge_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(MERGE_KEY_STORAGE, key);
  }
  return key;
}
