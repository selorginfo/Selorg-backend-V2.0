# Order Success & Failure Flow Audit

## Current Problem

After placing an order (especially COD / zero-due), the Customer Web App returned to **Cart** instead of the Order Success screen (`/checkout/confirmation`).

## Root Cause

In `CheckoutClient.tsx`, an empty-cart guard ran:

```ts
useEffect(() => {
  if (loggedIn && lines.length === 0) {
    router.replace("/cart");
  }
}, [loggedIn, lines.length, router]);
```

COD / zero-due flow called `placeOrder()` with the default `clearCartOnSuccess: true`, which emptied the cart **while still on `/checkout`**. React then ran the empty-cart effect and `router.replace("/cart")` raced with (and usually beat) `router.push("/checkout/confirmation?orderId=…")`.

Secondary path: Paynimo bridge return **without** `orderId` redirected to `/checkout`; with the cart already cleared server-side after a paid charge, the same empty-cart guard bounced the user to `/cart`.

Cart clearing was incorrectly coupled to navigation.

## Existing Checkout Flow

```
/cart → /checkout
  ├─ COD / grand===0:
  │    placeOrder(clearCart=true)  →  empty-cart effect → /cart   ❌
  │    (intended) push /checkout/confirmation
  └─ UPI/card/netbanking:
       placeOrder(clearCart=false) → /checkout/payment?orderId=
         → Paynimo → /payments/worldline/return → bridge URL
         → paid → /checkout/confirmation
         → failed/cancelled → /checkout/failed
```

Routes (unchanged, project convention):

| Intent | Route |
|--------|--------|
| Success | `/checkout/confirmation?orderId=` |
| Failure | `/checkout/failed?orderId=&reason=` |
| Payment | `/checkout/payment?orderId=` |
| Track | `/orders/[orderId]` |

## Fixed Checkout Flow

```
/cart → /checkout
  ├─ COD / grand===0:
  │    leavingCheckout lock ON
  │    placeOrder(clearCart=false)
  │    router.replace(/checkout/confirmation?orderId=)
  │    clearCart()
  │    → Success screen with real order ✅
  └─ Online:
       leavingCheckout lock ON
       placeOrder(clearCart=false)
       router.replace(/checkout/payment?orderId=)
         → Paynimo bridge
         → paid: clearCart + replace confirmation (+ txnId)
         → failed/cancelled/pending: replace failed (+ reason, txnId)
         → bridge missing orderId after paid: /orders (not empty checkout → cart)
```

## Success Flow

1. Backend `POST /orders` returns real `id` / `orderNumber` / items / address / totals / `paymentStatus`.
2. Frontend navigates to `/checkout/confirmation?orderId=<realId>`.
3. Confirmation loads order from context or `GET /orders/:id` (refresh-safe).
4. Cart cleared **after** success is confirmed (or after navigation for COD).
5. UI shows: success icon, order number, ETA, items, address, payment method, optional real txn id, Track order, Continue shopping.
6. Only `paymentStatus` of `paid` or `cod_pending` stays on success; `pending` / `failed` redirect to failure.

## Failure Flow

1. Payment fail / cancel / pending verification / session start failure → `/checkout/failed`.
2. Shows customer-safe reason (no stacks / internal errors).
3. Actions: Retry / Complete payment, Back to cart, change method, Continue shopping.
4. Cart **not** cleared on failure (items remain for retry).
5. If order later settles to `paid` / `cod_pending`, auto-redirect to confirmation.

## Payment Handling

| Gateway / order status | UI |
|------------------------|-----|
| `paid` | Success |
| `cod_pending` | Success (COD accepted) |
| `failed` / cancelled | Failure + retry |
| `pending` / PENDING_VERIFICATION | Failure/pending recovery (not success) |
| HTTP 200 alone | Not treated as paid — uses `orderPaymentStatus` / `uiState` from `GET /payments/worldline/status` |

Fake `TXN*` ids from `generateTxnId()` removed. Transaction ID only shown when present from Paynimo session, bridge `txnId`, or payment status API.

## API Endpoints Verified

| Endpoint | Role | Key fields |
|----------|------|------------|
| `POST /api/v1/customer/orders` | Create order | `id`, `orderNumber`, `paymentStatus`, items, totals |
| `GET /api/v1/customer/orders/:id` | Refresh success page | same |
| `POST /api/v1/customer/payments/worldline/session` | Start Paynimo | `orderId`, `txnId`, `sessionPayload` |
| `GET /api/v1/customer/payments/worldline/status?orderId=` | Poll | `orderPaymentStatus`, `uiState`, `latestPayment.txnId` |
| `POST /api/v1/customer/payments/worldline/complete` | Verify return | `status`, `txnId` |
| `POST /api/v1/customer/payments/worldline/abort` | Cancel | — |
| Bridge query | Return URL | `paynimo_bridge`, `status`, `orderId`, `txnId` |

## Routing Changes

- COD / zero-due: `push` → **`replace`** to confirmation (avoids back into dead checkout).
- Online place: **`replace`** to payment.
- Success/failure URLs unchanged; `txnId` query added when known.
- Bridge without `orderId` after paid → `/orders` (not `/checkout` → `/cart`).

## Cart State Handling

| Event | Cart |
|-------|------|
| COD success | Cleared after navigate to confirmation |
| Online place (unpaid draft) | Kept until paid |
| Online paid | Cleared on confirmation / after paid bridge |
| Payment failure / cancel | Kept for retry |
| Empty cart on `/checkout` (idle) | Still redirects to `/cart` (guard intact) |
| Empty cart while `leavingCheckout` | Guard skipped |

## Test Results

| Test | Expected | Actual | Status |
|------|----------|--------|--------|
| 1. COD order → Success | Confirmation with real order id | Code path fixed; typecheck/tests pass | Fixed (manual COD verify in browser) |
| 2. Online payment success | Confirmation after paid | Bridge → confirmation + clearCart | Fixed |
| 3. Payment failure | Failure + retry | `goToFailed` + FailedClient | Fixed |
| 4. Payment cancellation | Failure, cart preserved | Cancel reason + no clearCart | Fixed |
| 5. Order create failure | Toast, stay checkout | catch + unlock leavingCheckout | Preserved |
| 6. Network failure | Error toast / failed screen | Existing ApiError handling | Preserved |
| 7. Refresh success page | Fetch order by id | `fetchOrderById` | Works |
| 8. Track order | `/orders/:id` | primaryAction href | Works |
| 9. Continue shopping | `/`, cart not restored | secondaryAction `/` + clearCart | Works |
| Unit tests | Pass | 34/34 passed | Pass |
| Typecheck | Pass | `tsc --noEmit` exit 0 | Pass |
| Lint (changed files) | Pass | eslint exit 0 | Pass |

## Files Changed

- `src/app/(shop)/checkout/CheckoutClient.tsx` — empty-cart race fix; navigate then clear
- `src/app/(shop)/checkout/confirmation/ConfirmationClient.tsx` — real txn, clear cart on settle, refresh-safe
- `src/app/(shop)/checkout/failed/FailedClient.tsx` — pending/failure copy, Back to cart, safe reasons
- `src/app/(shop)/checkout/payment/PaymentClient.tsx` — bridge hardening, txnId passthrough, pending handling
- `src/context/OrdersContext.tsx` — removed fake `generateTxnId()` on place
- `src/context/CheckoutContext.tsx` — set `payTxn` from real session `txnId`
- `src/components/checkout/OrderResultCard.tsx` — item line layout (name + variant × qty)

## Remaining Issues

- Full end-to-end Paynimo sandbox charge still needs a live gateway run in the browser (credentials / return URL host).
- Repo-wide `npm run lint` still reports pre-existing errors outside this flow (`CartContext` refs, `useRequireAuth`, etc.).

## Final Verdict

- **Why Cart before:** empty-cart `replace("/cart")` raced COD cart clear before confirmation navigation.
- **What changed:** leave-checkout lock; clear cart only after confirmed navigation / paid; real txn ids only; hardened Paynimo bridge fallthrough.
- **Success screen:** `/checkout/confirmation` with backend order data — yes.
- **Failure screen:** `/checkout/failed` with retry / back to cart — yes.
- **Real order data:** yes (`orderId` / `orderNumber` / items / address / totals from API).
- **Payment result:** driven by `paymentStatus` / Worldline `uiState`, not HTTP 200 alone.
- **Cart state:** cleared on success only; preserved on failure.
- **Track order:** links to `/orders/{realId}`.
- **Continue shopping:** links to `/`.
