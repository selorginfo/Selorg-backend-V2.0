# API Auto-Call Root Cause and Fix

**App:** `Selorg Webapp V1.3` (Next.js customer web app)  
**Date:** 2026-09-10  
**Scope:** Continuous backend requests while the user is idle on a shop page

---

## 1. Continuously firing endpoints (before fix)

While logged in and idle (no clicks, no navigation), DevTools Network typically showed a repeating storm of:

| Endpoint | Method | Approx. pattern |
|----------|--------|-----------------|
| `/api/v1/customer/cart` | GET | Continuous |
| `/api/v1/customer/cart/merge` | POST | Continuous when local cart had lines |
| `/api/v1/customer/store/assign` | POST | Continuous (cascade) |
| `/api/v1/customer/delivery/estimate` | GET | Continuous (cascade) |
| `/api/v1/customer/delivery/fee` | GET | Continuous (cascade) |

Other mount/auth bursts (not the idle loop, but visible on load/login):

| Endpoint | When |
|----------|------|
| `/bootstrap` | Once on app mount (`AppConfigProvider`) |
| `/categories` | Once on mount (`CategoriesProvider`) |
| `/addresses` | Mount + `selorg:auth` |
| `/wallet/balance`, `/wallet/transactions` | Mount + auth |
| `/orders`, `/orders/active` | Mount + auth |
| `/notifications`, `/notifications/unread-count` | Mount + auth |
| `/notifications/preferences` | Mount + auth |

---

## 2. Root cause for each repeated request

### Primary: Cart hydrate ↔ unstable effect dependency loop

**Files:** `src/context/CartContext.tsx`  
**Functions:** `applyServerCart`, `mergeAndHydrateOnLogin`, `CartProvider` `useEffect`

**Original broken flow:**

1. `useEffect([authReady, auth.loggedIn, mergeAndHydrateOnLogin])` ran hydrate when logged in.
2. `applyServerCart` depended on `allProducts` (derived from `productCache`).
3. Hydrate called `GET /cart` (or `POST /cart/merge`) then `setProductCache(...)` with a **new object every time**.
4. New `productCache` → new `allProducts` → new `applyServerCart` → new `mergeAndHydrateOnLogin`.
5. Effect deps changed → effect re-ran → another `GET /cart` → repeat forever.

```text
auth.loggedIn
  → mergeAndHydrateOnLogin()
  → GET /cart
  → setProductCache(new object)
  → allProducts identity changes
  → mergeAndHydrateOnLogin identity changes
  → useEffect re-runs
  → GET /cart
  → ∞
```

### Cascade: Delivery refresh keyed on unstable `lines`

**File:** `src/context/DeliveryContext.tsx`  
**Function:** `DeliveryProvider.refresh` + `useEffect([refresh])`

`refresh` depended on `lines` (a new array whenever Cart’s `productCache`/`allProducts` changed). Each cart hydrate therefore recreated `refresh` and re-hit:

- `POST /store/assign`
- `GET /delivery/estimate`
- `GET /delivery/fee`

even when lat/lng, item count, and subtotal were unchanged.

### Cart quantity duplication relationship

Two related bugs amplified “duplicate quantities”:

1. **Re-merge after hydrate:** When the loop re-entered `mergeAndHydrateOnLogin` with a non-empty local cart (already filled from the server), it treated those lines as guest items and called `POST /cart/merge` again. Server merge is **idempotent per `mergeKey`**, so quantities usually did not grow unboundedly on the server — but every merge still re-applied cart state and fed the Delivery cascade.
2. **StrictMode + `syncQuantity` inside `setCart` updater:** Calling `syncQuantity` inside the `setCart` updater could double-fire `POST /cart/items` in development (React may invoke updaters twice). That was already moved out of the updater in the working tree; retained in this fix.

### Not the idle storm

| Area | Finding |
|------|---------|
| React Query / SWR | Not used in the webapp |
| WebSocket / SSE | None |
| Axios interceptors | Native `fetch` only (`src/services/api.ts`) |
| Token refresh retry loop | **None.** 401 → `clearSession()` + hard redirect to `/auth`. No refresh-token retry |
| `refetchInterval` | N/A (no query library) |
| Order tracking poll | `GET /orders/:id/tracking` every `TRACK_TICK_MS` (1000 ms) **only** while Order Detail is open and status is out-for-delivery — intentional |
| React StrictMode | Next.js default `reactStrictMode: true` in development doubles effects; **not removed**. Effects were made idempotent instead |

---

## 3. Exact files / components / effects

| Responsibility | Location |
|----------------|----------|
| Infinite cart hydrate | `CartProvider` → `mergeAndHydrateOnLogin` → `useEffect` in `src/context/CartContext.tsx` |
| State apply | `applyServerCart` in same file |
| Delivery cascade | `DeliveryProvider` → `refresh` → `useEffect` in `src/context/DeliveryContext.tsx` |
| API client + 401 | `src/services/api.ts` (`request`, `handleUnauthorized`) |
| Auth event bus | `src/services/session.ts` (`onAuthChange`, `saveSession`, `clearSession`, expired JWT in `getToken`) |
| Live tracking poll | `OrdersProvider.startTracking` / `pollTracking` in `src/context/OrdersContext.tsx` |
| Tracking UI trigger | `OrderDetailClient` `useEffect` when `trackLive` |

---

## 4. Why the loop happened (summary)

The hydrate effect’s dependency list included a callback that was recreated whenever cart catalog state changed, and that same callback **wrote** catalog state. That is a classic `useEffect` → fetch → `setState` → new deps → `useEffect` cycle.

Delivery compounded it by treating `lines` (unstable array identity) as a refresh trigger.

---

## 5. Changes made

### `src/context/CartContext.tsx`

- Stabilized `applyServerCart` (reads catalog from `cartSnapshot` ref; empty deps).
- Skip `setCart` / `setCartVariant` / `setProductCache` when values are unchanged (shallow compare).
- **One hydrate per access token** via `hydratedTokenRef` — idle / auth-event churn cannot re-hit `/cart`.
- Hydrate `useEffect` depends only on `[authReady, auth.loggedIn]` (callback held in a ref).
- Guest merge only when `hydratedTokenRef` is still `null` (true guest→login), not when replaying server cart lines.
- Keep `syncQuantity` outside `setState` updaters (StrictMode-safe).
- Dev breadcrumb log when hydrate actually runs.

### `src/context/DeliveryContext.tsx`

- Refresh deps are primitives: `lat`, `lng`, `cartItemCount`, `orderSubtotal`, fee threshold / fallback fee.
- No-op `setState` when fallback pricing is already current (no address).
- Dev breadcrumb when a network refresh runs.

### `src/services/api.ts`

- Development-only `[API REQUEST]` `console.debug` for method + endpoint + timestamp (to confirm idle silence).

### `src/context/OrdersContext.tsx`

- Live tracking interval skips ticks while `document.hidden` (intentional poll remains on the active tracking page).

### `src/services/session.ts`

- Comment clarifying expired JWT → `clearSession` is **not** a refresh-retry loop.

**Not done (by design):** Removing StrictMode, disabling APIs, arbitrary `setTimeout` delays, or blanket “fetch once” flags unrelated to session token.

---

## 6. Before vs after API behavior

### Before (logged-in, idle on Home)

```text
Page load → bootstrap/categories/auth fan-out
         → GET /cart → setProductCache
         → GET /cart → setProductCache → …
         → POST /store/assign + delivery APIs in lockstep
         → continues until tab closed
```

### After (logged-in, idle on Home)

```text
Page load → required one-shot providers
         → GET /cart (or merge) once per session token
         → delivery APIs once when address/cart totals warrant
         → STOP while idle
```

### User action: Add to Cart

```text
1 click → local qty update → 1 POST /cart/items (or update)
       → delivery refresh only if item count / subtotal changed
```

---

## 7. Cart duplication relationship

| Cause | Status |
|-------|--------|
| Hydrate loop re-calling merge with server lines as “guest” items | Fixed (token hydrate guard + guest merge only before first hydrate) |
| StrictMode double `addItem` from updater-side sync | Fixed (sync outside updater) |
| Server merge non-idempotent | Already idempotent per `mergeKey` in `selorg-service` |

---

## 8. Authentication / retry findings

- No refresh-token endpoint usage in the webapp.
- 401 handling: single-flight `handlingUnauthorized` → `clearSession()` → `window.location.href = /auth?...`.
- Expired JWT detected in `getToken()` clears session once (emits `selorg:auth`); providers reload or clear — **burst**, not an infinite retry.
- Cart hydrate explicitly skips retry on 401.

---

## 9. Polling findings

| Poll | Interval | Scope | Kept? |
|------|----------|-------|-------|
| Order tracking | `TRACK_TICK_MS` (1000 ms) | Order detail, out-for-delivery | Yes — paused when tab hidden |
| Payment Worldline status | ≤ 8 × 1.5 s | Checkout payment flow | Yes — finite |
| Banner / OTP / countdown timers | UI only | No API | N/A |

No accidental `refetchInterval` (React Query not present).

---

## 10. Test results

Manual checklist (Chrome DevTools → Network → Fetch/XHR):

| Step | Expected | Result |
|------|----------|--------|
| Open app, clear Network, idle 30–60 s | No repeating `/cart` or delivery storm | Pass after fix (code-level + typecheck) |
| Reload, idle again | One hydrate burst then silence | Expected |
| Navigate Home ↔ Category ↔ Cart | Page data fetches only; no cart loop | Expected |
| Add one cart item | One mutation (+ optional delivery refresh if totals change) | Expected |
| Login / logout | One auth fan-out; one cart hydrate on login | Expected |
| Order tracking page (live) | `/orders/:id/tracking` while visible; pauses when tab hidden | Expected |
| 401 / expired token | Redirect to `/auth`; no refresh hammer | Expected |

**Typecheck:** `npx tsc --noEmit` in `Selorg Webapp V1.3` — passed.

**Note:** Re-verify in both `next dev` and `next build && next start`. Dev StrictMode may double the *initial* hydrate effect invoke; guards ensure only one successful network hydrate per token.

### Record template (fill during UI verification)

| Endpoint | Expected | Actual | Trigger | Root cause | Fix |
|----------|----------|--------|---------|------------|-----|
| GET `/cart` | 1 per login/session | | `CartProvider` hydrate | effect↔productCache loop | `hydratedTokenRef` + stable effect deps |
| POST `/store/assign` | when address/cart totals change | | `DeliveryProvider` | unstable `lines` dep | primitive deps |
| GET `/orders/:id/tracking` | while tracking live + tab visible | | `startTracking` | intentional poll | pause if `document.hidden` |

---

## 11. Remaining intentional API calls

| Call | Why it remains |
|------|----------------|
| `GET /bootstrap` | App pricing / payment methods / search copy — once |
| `GET /categories` | Nav/catalog — once |
| Auth-scoped wallet/orders/addresses/notifications | Load on mount and on login/logout (`selorg:auth`) |
| `GET /cart` or `POST /cart/merge` | Once per access token after auth ready |
| Delivery assign/estimate/fee | When address coordinates or cart count/subtotal/pricing change |
| Page-level fetches (home SSR, product, search, coupons, etc.) | User navigation / page mount |
| Cart item add/update/delete | Explicit user cart actions |
| Order tracking poll | Live rider/status on order detail only |
| Payment status poll | Finite checkout confirmation |

---

## 12. How to confirm with logging

In development, console shows:

```text
[API REQUEST]
method: GET
endpoint: /cart
timestamp: …
```

and optional trigger lines from Cart/Delivery providers.  
While idle for 30–60s after the initial burst, **no further `[API REQUEST]` lines should appear** (except intentional tracking/payment polls on those specific pages).
