# Selorg Customer API Contract

Source of truth: `selorg-service/src/app.ts` (mount points) and each module's
`routes → controller → service → model/validation` files. This document
covers `/api/v1/customer/*` in full, plus the public `/api/v1/support`
endpoint. All other backend modules (admin/rider/picker/vendor/finance/
darkstore/warehouse/hhd/logistics/production/merch — ~30 modules serving
other apps on the same backend) are out of scope for the customer webapp and
are listed only as a one-line summary at the end.

Verified live against a running `selorg-service` instance (real MongoDB
Atlas data) on 2026-09-01, in addition to static source reading.

## Base URL & envelope

- Base URL: `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:3333`).
- All customer routes are mounted under `/api/v1/customer`.
- Standard envelope (`ResponseFormatter`):
  ```json
  { "success": true, "message": "...", "data": { ... }, "error": null, "pagination": null, "timestamp": "..." }
  ```
  Errors: `success: false`, `error: { code, message, details? }`, HTTP status non-2xx.
- **Raw envelope bypass**: some controllers `res.json({ success, data, ... })`
  directly instead of using `ResponseFormatter` — functionally identical
  shape, called out per-endpoint below only where it differs materially.

## Auth

- `Authorization: Bearer <token>` header. JWT, ~24h TTL, **no refresh-token
  mechanism** — an expired token just means the client re-authenticates via
  OTP again (no silent refresh).
- Most GETs are optional-auth (`optionalCustomerAuth` middleware): same
  response shape for guest and logged-in callers, with logged-in callers
  getting personalization where applicable (e.g. `/coupons` eligibility).
  Mutating endpoints (cart, orders, addresses, wallet, payments,
  notifications/preferences) require `authenticateCustomer`.

---

## Auth & account

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/auth/send-otp` | POST | public | `{ phoneNumber \| email, channel: "sms"\|"whatsapp"\|"email" }` → `{ sessionId, channel, resendCooldownSeconds }`. Phone must be `+91XXXXXXXXXX`. |
| `/auth/verify-otp` | POST | public | `{ sessionId, otp }` → `{ accessToken, isNewUser, user }`. |
| `/auth/resend-otp` | POST | public | `{ sessionId }`. |
| `/auth/logout` | POST | required | Best-effort server-side invalidation; frontend never blocks local logout on this call. |
| `/auth/link-phone/send-otp` | POST | required | Re-verification flow for changing the profile phone number. |
| `/auth/link-phone/verify-otp` | POST | required | Completes the phone-change flow. |
| `/user/profile` | GET | required | `{ _id, name, email, phoneNumber, phoneVerified }`. |
| `/user/profile` | PUT | required | `{ name?, email? }`. |
| `/addresses` | GET/POST | required | List / create. Backend field is `label` (Home/Work/Other), not `type`. |
| `/addresses/:id` | PUT/DELETE | required | |
| `/addresses/:id/default` | POST | required | Marks an address default. |

## Catalog: categories, products, search, home, collections

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/categories` | GET | public | Top-level category list: `{ id, name, slug, imageUrl, thumbnailUrl, cardImageUrl, emoji, order }[]`. |
| `/categories/:slug/products` | GET | public | **The real category-browse endpoint.** Query: `sort` (`sortOrder\|price_asc\|price_desc\|name_asc\|newest`), `page`, `limit`, `inStock`, `subcategory`. Returns `{ category, subcategories[], products[], pagination }`. **Live-verified gap:** product cards in this response do **not** include `categoryId`/`subcategoryId` — the frontend fills `cat` in from the already-known parent category, but per-product subcategory linkage is unrecoverable from this endpoint as currently implemented, so subcategory filtering/counts are hidden client-side rather than shown broken. |
| `/categories/:id` | GET | public | Detail-by-id (Mongo ObjectId) variant — different field names (`originalPrice` not `mrp`), includes `banners[]`. Used as a deep-link fallback when only an id is known. |
| `/products/search?q=` | GET | public | `q.length >= 2` required server-side. Query: `page`, `limit`, `category`. **This is the only general product query endpoint** — there is no `GET /products` listing. |
| `/products/search/suggestions?q=` | GET | public | Typeahead. |
| `/products/search/trending` | GET | public | `string[]`. |
| `/products/:id` | GET | public | **Never 404s** — an invalid/inactive id returns `200` with `{ product: { isActive: false }, variants: [], relatedProducts: [] }`; the frontend treats that as not-found. Returns `{ product, variants, relatedProducts }`; variant "was-price" field here is `originalPrice`, not `mrp`. |
| `/home` | GET | optional | CMS-driven home screen. `{ config, sectionDefinitions: [{key,label}], sections: { [key]: Category[]\|Banner[]\|LifestyleItem[] }, promoBlocks }`. **No flat products array** — `sections{}` only inlines categories/banners/lifestyle content; product-carousel section keys are absent from `sections{}` entirely. |
| `/sections/:key/products` | GET | public | The only way to get a home carousel's actual products. **404s** if the key doesn't exist (unlike `/products/:id`). `{ title, products[], pagination }`. |
| `/collections/:slug` | GET | public | Curated collection browse (used by some home `sectionDefinitions` entries, e.g. `collections_trending_now`). |
| `/pages/:slug` | GET | public | Static content pages (About/Terms/etc.) — not wired into the frontend in this phase; see audit §H. |
| `/store` | GET | public | Store/darkstore metadata for the customer's location — not wired into the frontend in this phase. |

**Live-verified data-quality notes** (backend content, not a frontend bug):
some home banner objects have `redirectValue` pointing at stale/legacy
category codes (e.g. `"A101"`) that don't match any current category slug;
some banner image URLs 403/500 from their CDN/S3 origin (broken or
access-restricted objects). Neither is fixable from the frontend.

## Cart

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/cart` | GET | required | Returns `{ items[], subtotal, total, ... }`. **Documented stub**: `discount`, `deliveryFee`, `handlingCharge`, `tax` are always `0` here — only `itemTotal`/`subtotal` reflects real line pricing. The only authoritative pricing engine runs at order-create time (see below). |
| `/cart/items` | POST | required | Add: `{ productId, quantity, variantId? }`. |
| `/cart/items` | PUT | required | Update by product: `{ productId, quantity, variantId? }` — used instead of the per-item-id PUT for a straightforward "set quantity" call. |
| `/cart/items/:itemId` | PUT/DELETE | required | Update/remove a specific cart line by its own id. |
| `/cart/clear` | DELETE | required | |
| `/cart/merge` | POST | required | `{ items[], mergeKey? }` — guest→login cart merge. **Not currently called by the frontend** (see audit §E/§L: guest carts are local-only and never merged into a real cart on login). |

## Coupons

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/coupons` | GET | optional | `?cart_value=` (snake_case query param). `{ coupons: [{ _id, code, displayName, discountType, discountValue, minOrderValue, maxDiscountCap, eligible, ineligibilityReason }] }`. Per-user eligibility when logged in. **Live-verified**: returns `{ coupons: [] }` when the store has no active coupons configured — frontend falls back to static demo coupons for display in that case (the real `/coupons/validate` call is unaffected by this fallback). |
| `/coupons/validate` | POST | optional | **Body is snake_case** — a genuine, confirmed inconsistency vs. the rest of the (camelCase) API: `{ coupon_code, cart_value, cart_items?, payment_method?, zone?, delivery_fee? }`. Success: `{ valid: true, discount_amount, coupon_type, display_name, is_cashback, cashback_value }`. Failure: `{ valid: false, error_code, min_required?, allowed? }` with `error_code` one of `INVALID_CODE\|COUPON_INACTIVE\|COUPON_NOT_VALID_NOW\|NOT_ELIGIBLE\|MIN_ORDER_NOT_MET\|COUPON_EXHAUSTED\|PAYMENT_METHOD_NOT_ELIGIBLE`. |

## Orders

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/orders` | GET | required | `?page&limit&status`. Response shape varies (`{list\|orders}[]` or a bare array) — frontend normalizes both. |
| `/orders/active` | GET | required | Currently in-flight orders. |
| `/orders/:id` | GET | required | |
| `/orders` | POST | required | **The real pricing/checkout engine runs here.** `{ items[{productId, variantId?, quantity}], addressId, paymentMethodType, couponCode?, deliveryTip?, deliveryNotes?, customerName? }`. Effective delivery-fee/handling-charge/free-delivery-threshold logic (see `deliveryPricing.service.ts`, mirrored client-side via `/customer/bootstrap`'s `appConfig.checkout`): `deliveryFee = 0` once `itemTotal ≥ freeDeliveryMinAmount`, else the flat `deliveryFee`; `handlingCharge` flat whenever `itemTotal > 0`; `tax` currently always `0` (GST-inclusive pricing). |
| `/orders/:id/cancel` | POST | required | `{ reason? }`. |
| `/orders/:id/reorder` | POST | required | Real backend endpoint exists; **not currently called by the frontend** — `OrdersContext.reorder` re-adds items to the local cart by matching `item.name` instead, because `OrderItem` (frontend type) has no `productId` field to call `addToCart` with directly. See audit §L. |
| `/orders/:id/tracking` | GET | required | `{ statusIndex?, etaMin?, status? }`. |
| `/orders/:id/rate` | POST | required | `{ rating, comment? }`. |
| Order status enum | — | — | `pending\|confirmed\|getting-packed\|on-the-way\|arrived\|delivered\|cancelled`. |
| `/invoice/:orderId` | GET | required | Not wired into the frontend in this phase (no invoice/receipt view exists). |

## Payments (Worldline / Paynimo)

Session-based gateway — **not** redirect-URL-based. `sessionPayload` is
meant for Paynimo's client-side JS SDK, whose script/invocation API were not
available in this environment (no docs, no sandbox credentials).

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/payments/worldline/session` | POST | required | `{ orderId, platform: "web" }` → `{ paymentId, orderId, txnId, attemptNo, hashAlgo, sessionPayload }`. Only valid for orders paid by card/UPI/digital, not cash/pure-wallet. |
| `/payments/worldline/status` | GET | required | `?orderId=` → `{ orderPaymentStatus, uiState, recommendedAction, latestPayment? }`. |
| `/payments/worldline/complete` | POST | required | `{ orderId, txnId, response }` — server-side verification of the gateway's client-side result. |
| `/payments/worldline/abort` | POST | required | `{ orderId, txnId, reason? }`. |
| `/payments/worldline/return` | — | — | Server-side bounce target after the SDK redirects back; not directly called by the SPA. |

**Frontend integration status**: session-create/status/complete/abort are
wired to the real endpoints for logged-in users. The actual "open Paynimo's
checkout UI" step (`openPaynimoCheckout` in `paymentService.ts`) is an
**intentional stub** that rejects with a clear error — see audit §F. Guests
keep the pre-existing simulated inline payment flow unchanged.

## Wallet

Same gateway mechanics as order payment.

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/wallet/balance` | GET | required | `{ balance, pendingCredits, currency, isActive }`. |
| `/wallet/transactions?limit=` | GET | required | `{ _id, type: "credit"\|"debit", amount, description, createdAt }[]`. |
| `/wallet/top-up/session` | POST | required | `{ amount, platform: "web" }` → same `CreateSessionResult` shape as order payment. **Fixed this phase**: the frontend previously assumed `{ redirectUrl }`, which the backend has never returned — see audit §D. |

## Notifications

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/notifications/preferences` | GET/PUT | required | `{ push, inApp, sms, whatsapp, email, dnd, dndStartHour, dndEndHour, categories: { [key]: {push,inApp,sms,whatsapp,email} } }`. Only `sms`/`whatsapp`/`categories.offers` map cleanly onto the frontend's 3 toggles — see audit §G. |

## App config / bootstrap

| Endpoint | Method | Auth | Notes |
|---|---|---|---|
| `/bootstrap` | GET | optional | Single app-startup payload: `{ appConfig: { checkout, wallet, paymentMethods[], featureFlags?, search? }, homeConfig?, featureFlags? }`. `appConfig.checkout` is pre-resolved server-side to the *effective* pricing values (see Orders above) — the frontend sources its delivery-fee/handling-fee/free-delivery-threshold constants from here at runtime instead of hardcoding them. |
| `/app-config` | GET | optional | Same `AppConfig` shape alone, if the rest of bootstrap isn't needed. |

## Other public/customer endpoints (not deeply exercised this phase)

- `/banners`, `/onboarding`, `/legal`, `/faq` — CMS/content endpoints referenced in the original module audit; not wired into any current frontend page (the home page's own banners come from `/home`, not a separate `/banners` call).
- `/locations` (address/pincode lookups) — not wired; the frontend's location picker is a local simulation (`services/locationService.ts` — a timer, no HTTP call at all).
- `/delivery` — delivery-zone/slot info; not wired.
- `GET /api/v1/support` (public, outside the `/customer` prefix) — contact/help endpoint; the frontend's "Chat with us"/support buttons are placeholders (`showToast("Support chat coming soon")`), not wired to this.

## Non-customer modules (out of scope, one-line summary)

The backend also serves ~30 other route groups under `/api/v1/*` for
separate apps sharing this monolith — none are reachable or relevant from
the customer webapp: `admin`, `rider`, `picker`, `vendor`, `finance`,
`darkstore`, `warehouse`, `hhd` (hand-held-device), `logistics`,
`production`, `merch`, and related sub-modules for each. These were not
audited in this phase beyond confirming (via `app.ts`) that they exist under
separate mount prefixes and share no routes with `/api/v1/customer/*`.
