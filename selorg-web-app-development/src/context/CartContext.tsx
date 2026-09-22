"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { calculateTotals, getCartLines } from "@/lib/cart";
import { mapApiCartToLocalState } from "@/lib/cartApiMapper";
import { getCartMergeKey } from "@/lib/cartMerge";
import { cartService } from "@/services/cartService";
import { couponService, couponErrorMessage } from "@/services/couponService";
import { ApiError } from "@/services/api";
import { getToken, onAuthChange } from "@/services/session";
import type { AppliedCoupon, CartLine, CartMap, CartTotals, CartVariantMap, Product } from "@/types";
import { useAuth } from "./AuthContext";
import { useUI } from "./UIContext";
import { useWallet } from "./WalletContext";
import { useAppConfig } from "./AppConfigContext";

interface CartContextValue {
  cart: CartMap;
  cartVariant: CartVariantMap;
  saved: string[];
  lines: CartLine[];
  savedLines: CartLine[];
  totals: CartTotals;
  coupon: string;
  couponApplied: AppliedCoupon | null;
  cartLoading: boolean;
  addToCart: (productId: string, variantIndex?: number, product?: Product) => void;
  increment: (productId: string) => void;
  decrement: (productId: string) => void;
  removeItem: (productId: string) => void;
  saveForLater: (productId: string) => void;
  moveToCart: (productId: string) => void;
  setCoupon: (code: string) => void;
  applyCoupon: (codeOverride?: string) => void;
  removeCoupon: () => void;
  clearCart: () => void;
  /** Re-fetch the server cart (e.g. after reorder). */
  refreshFromServer: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

function shallowQtyMapEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function productCacheRefsEqual(
  a: Record<string, Product>,
  b: Record<string, Product>,
): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { showToast } = useUI();
  const { wallet } = useWallet();
  const { pricing } = useAppConfig();
  const { authReady, auth } = useAuth();
  const [cart, setCart] = useState<CartMap>({});
  const [cartVariant, setCartVariant] = useState<CartVariantMap>({});
  const [saved, setSaved] = useState<string[]>([]);
  const [coupon, setCoupon] = useState("");
  const [couponApplied, setCouponApplied] = useState<AppliedCoupon | null>(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [productCache, setProductCache] = useState<Record<string, Product>>({});
  const syncing = useRef(false);
  /** Token we already hydrated for — prevents GET /cart on every auth/callback churn. */
  const hydratedTokenRef = useRef<string | null>(null);
  const hydrateGenRef = useRef(0);
  const mergeAndHydrateRef = useRef<() => Promise<void>>(async () => {});

  // Only products we actually received from the API: every `addToCart` caller
  // passes the product it rendered, and `mapApiCartToLocalState` synthesizes a
  // product from the server cart line for anything else.
  const allProducts = useMemo(() => Object.values(productCache), [productCache]);

  const cartSnapshot = useRef({ cart, cartVariant, allProducts });

  useEffect(() => {
    cartSnapshot.current = { cart, cartVariant, allProducts };
  }, [cart, cartVariant, allProducts]);

  // Stable: read catalog from snapshot so productCache growth (add-to-cart) does
  // not recreate this callback and re-trigger the login hydrate/merge effect.
  const applyServerCart = useCallback((apiCart: Awaited<ReturnType<typeof cartService.getCart>>) => {
    const prevCart = cartSnapshot.current.cart;
    const prevVariant = cartSnapshot.current.cartVariant;
    const prevCache = Object.fromEntries(
      cartSnapshot.current.allProducts.map((p) => [p.id, p] as const),
    );
    const mapped = mapApiCartToLocalState(apiCart, cartSnapshot.current.allProducts);
    const nextCache: Record<string, Product> = { ...prevCache, ...mapped.productCache };

    const cartSame = shallowQtyMapEqual(prevCart, mapped.cart);
    const variantSame = shallowQtyMapEqual(prevVariant, mapped.cartVariant);
    const cacheSame = productCacheRefsEqual(prevCache, nextCache);
    if (cartSame && variantSame && cacheSame) return;

    cartSnapshot.current = {
      cart: mapped.cart,
      cartVariant: mapped.cartVariant,
      allProducts: Object.values(nextCache),
    };
    if (!cartSame) setCart(mapped.cart);
    if (!variantSame) setCartVariant(mapped.cartVariant);
    if (!cacheSame) setProductCache(nextCache);
  }, []);

  const refreshFromServer = useCallback(async () => {
    if (!getToken()) return;
    setCartLoading(true);
    try {
      const apiCart = await cartService.getCart();
      applyServerCart(apiCart);
    } catch (err) {
      console.warn("[cart] refresh failed:", err);
    } finally {
      setCartLoading(false);
    }
  }, [applyServerCart]);

  const mergeAndHydrateOnLogin = useCallback(async () => {
    const token = getToken();
    if (!token || syncing.current) return;
    // Same session already hydrated — idle pages must not keep hitting /cart.
    if (hydratedTokenRef.current === token) return;

    syncing.current = true;
    const gen = ++hydrateGenRef.current;
    setCartLoading(true);
    if (process.env.NODE_ENV === "development") {
      console.debug("[API REQUEST]\nmethod: GET|POST\nendpoint: /cart or /cart/merge\ntrigger: CartProvider.mergeAndHydrateOnLogin\ntimestamp:", new Date().toISOString());
    }
    try {
      const { cart: localCart, cartVariant: localVariant, allProducts: catalog } = cartSnapshot.current;
      // Only treat local lines as a *guest* cart before the first hydrate for this
      // token. After hydrate, local state mirrors the server — re-merging it would
      // be a no-op (idempotent mergeKey) but still churns state → Delivery APIs.
      const guestItems =
        hydratedTokenRef.current == null
          ? getCartLines(localCart, localVariant, catalog).map((l) => ({
              productId: l.product.id,
              variantId: l.variant.variantId,
              quantity: l.qty,
            }))
          : [];

      if (guestItems.length > 0) {
        const merged = await cartService.mergeCart(getCartMergeKey(), guestItems);
        if (gen !== hydrateGenRef.current) return;
        applyServerCart(merged);
      } else {
        const apiCart = await cartService.getCart();
        if (gen !== hydrateGenRef.current) return;
        applyServerCart(apiCart);
      }
      hydratedTokenRef.current = token;
    } catch (err) {
      // 401 already clears the session and redirects via api.request —
      // retrying GET /cart would only repeat the same unauthorized hop.
      if (err instanceof ApiError && err.status === 401) {
        hydratedTokenRef.current = null;
        console.warn("[cart] merge/hydrate skipped: session expired");
        return;
      }
      console.warn("[cart] merge/hydrate failed:", err);
      await refreshFromServer();
      if (getToken()) hydratedTokenRef.current = getToken();
    } finally {
      if (gen === hydrateGenRef.current) {
        syncing.current = false;
        setCartLoading(false);
      }
    }
  }, [applyServerCart, refreshFromServer]);

  mergeAndHydrateRef.current = mergeAndHydrateOnLogin;

  useEffect(() => {
    if (!authReady) return;

    // Wait until AuthContext has restored (or rejected) the persisted session
    // so a stale token does not fire merge during the first paint.
    // Deps are auth flags only — NOT the hydrate callback — so productCache /
    // cart updates never re-subscribe or re-fetch.
    const token = getToken();
    if (!auth.loggedIn || !token) {
      hydratedTokenRef.current = null;
      syncing.current = false;
    } else {
      void mergeAndHydrateRef.current();
    }

    return onAuthChange(() => {
      const next = getToken();
      if (!next) {
        hydratedTokenRef.current = null;
        syncing.current = false;
        return;
      }
      if (hydratedTokenRef.current !== next) {
        syncing.current = false;
        void mergeAndHydrateRef.current();
      }
    });
  }, [authReady, auth.loggedIn]);

  const syncQuantity = useCallback(
    (productId: string, quantity: number, prevQuantity: number, variantIndex?: number) => {
      if (!getToken()) return;
      const product = cartSnapshot.current.allProducts.find((p) => p.id === productId);
      const variant =
        product?.variants[variantIndex ?? cartSnapshot.current.cartVariant[productId] ?? 0];
      const variantId = variant?.variantId;

      const run = async () => {
        try {
          if (quantity <= 0) {
            await cartService.updateByProduct(productId, 0, variantId);
          } else if (prevQuantity <= 0) {
            await cartService.addItem(productId, quantity, variantId);
          } else {
            await cartService.updateByProduct(productId, quantity, variantId);
          }
        } catch (err) {
          console.warn("[cart] sync failed:", err);
        }
      };
      void run();
    },
    [],
  );

  const MAX_CART_QTY = 6;

  const addCore = useCallback(
    (productId: string, delta: number, variantIndex?: number) => {
      // Read qty from the eager snapshot (not inside setState). Calling
      // syncQuantity inside the updater double-fires POST /cart/items under
      // React StrictMode because updaters may run twice in development.
      const prevQty = cartSnapshot.current.cart[productId] ?? 0;

      if (delta > 0 && prevQty >= MAX_CART_QTY) {
        showToast(`You can only add up to ${MAX_CART_QTY} of this item`);
        return;
      }

      const nextQty = prevQty + delta;
      const updatedCart = { ...cartSnapshot.current.cart };
      if (nextQty <= 0) {
        delete updatedCart[productId];
      } else {
        updatedCart[productId] = nextQty;
      }
      cartSnapshot.current = { ...cartSnapshot.current, cart: updatedCart };
      setCart(updatedCart);

      if (variantIndex !== undefined) {
        const updatedVariant = { ...cartSnapshot.current.cartVariant, [productId]: variantIndex };
        cartSnapshot.current = { ...cartSnapshot.current, cartVariant: updatedVariant };
        setCartVariant(updatedVariant);
      }

      syncQuantity(productId, Math.max(0, nextQty), prevQty, variantIndex);
      if (delta > 0) showToast("Added to cart");
    },
    [showToast, syncQuantity],
  );

  const addToCart = useCallback(
    (productId: string, variantIndex?: number, product?: Product) => {
      if (product) {
        setProductCache((prev) => {
          const updated = { ...prev, [productId]: product };
          cartSnapshot.current = {
            ...cartSnapshot.current,
            allProducts: Object.values(updated),
          };
          return updated;
        });
      }
      addCore(productId, 1, variantIndex);
    },
    [addCore],
  );
  const increment = useCallback((productId: string) => addCore(productId, 1), [addCore]);
  const decrement = useCallback((productId: string) => addCore(productId, -1), [addCore]);

  const removeItem = useCallback(
    (productId: string) => {
      const prevQty = cartSnapshot.current.cart[productId] ?? 0;
      const updatedCart = { ...cartSnapshot.current.cart };
      delete updatedCart[productId];
      cartSnapshot.current = { ...cartSnapshot.current, cart: updatedCart };
      setCart(updatedCart);
      syncQuantity(productId, 0, prevQty);
      showToast("Removed from cart");
    },
    [showToast, syncQuantity],
  );

  const saveForLater = useCallback(
    (productId: string) => {
      const prevQty = cartSnapshot.current.cart[productId] ?? 0;
      const updatedCart = { ...cartSnapshot.current.cart };
      delete updatedCart[productId];
      cartSnapshot.current = { ...cartSnapshot.current, cart: updatedCart };
      setCart(updatedCart);
      syncQuantity(productId, 0, prevQty);
      setSaved((prev) => (prev.includes(productId) ? prev : [...prev, productId]));
      showToast("Saved for later");
    },
    [showToast, syncQuantity],
  );

  const moveToCart = useCallback(
    (productId: string) => {
      setSaved((prev) => prev.filter((id) => id !== productId));
      addCore(productId, 1);
    },
    [addCore],
  );

  const applyCoupon = useCallback(
    (codeOverride?: string) => {
      const code = (codeOverride ?? coupon).trim();
      const currentLines = getCartLines(cart, cartVariant, allProducts);
      const sub = currentLines.reduce((s, l) => s + l.lineTotal, 0);

      // `/coupons/validate` is a public endpoint, so guests are validated by the
      // same engine that prices the order — never against a local coupon table.
      couponService
        .validate({
          couponCode: code,
          cartValue: sub,
          cartItems: currentLines.map((l) => ({
            productId: l.product.id,
            price: l.variant.price,
            quantity: l.qty,
          })),
        })
        .then((result) => {
          if (result.valid) {
            setCouponApplied({ code: code.toUpperCase(), amount: result.discount_amount });
            setCoupon(code.toUpperCase());
            showToast(`${code.toUpperCase()} applied · you saved ₹${result.discount_amount}`);
          } else {
            if (result.error_code !== "MIN_ORDER_NOT_MET") setCouponApplied(null);
            showToast(couponErrorMessage(result, code.toUpperCase()));
          }
        })
        .catch(() => showToast("Could not validate the coupon. Please try again."));
    },
    [cart, cartVariant, coupon, showToast, allProducts],
  );

  const removeCoupon = useCallback(() => {
    setCouponApplied(null);
    setCoupon("");
  }, []);

  const clearCart = useCallback(() => {
    setCart({});
    setCartVariant({});
    setCouponApplied(null);
    setCoupon("");
    cartSnapshot.current = { ...cartSnapshot.current, cart: {}, cartVariant: {} };
    if (getToken()) {
      cartService.clearCart().catch((err) => console.warn("[cart] clear failed:", err));
    }
  }, []);

  const lines = useMemo(
    () => getCartLines(cart, cartVariant, allProducts),
    [cart, cartVariant, allProducts],
  );

  const savedLines = useMemo(() => {
    const savedMap: CartMap = Object.fromEntries(saved.map((id) => [id, 1]));
    return getCartLines(savedMap, {}, allProducts);
  }, [saved, allProducts]);

  const totals = useMemo(
    () => calculateTotals(lines, couponApplied, wallet.useAtCheckout, wallet.balance, pricing),
    [couponApplied, lines, wallet.balance, wallet.useAtCheckout, pricing],
  );

  return (
    <CartContext.Provider
      value={{
        cart,
        cartVariant,
        saved,
        lines,
        savedLines,
        totals,
        coupon,
        couponApplied,
        cartLoading,
        addToCart,
        increment,
        decrement,
        removeItem,
        saveForLater,
        moveToCart,
        setCoupon,
        applyCoupon,
        removeCoupon,
        clearCart,
        refreshFromServer,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
