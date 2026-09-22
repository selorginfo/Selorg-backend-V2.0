# Frontend → API Map

Page (route) → service function(s) it calls → backend endpoint → backend
controller → status. See `API_INTEGRATION_AUDIT.md` for the full reasoning
behind each status; this doc is the quick per-page lookup.

Status legend: ✅ real · ⚠️ partial/fallback · 🔶 stub (deliberate) · ⬜ static/local only · ❌ not wired at all

**2026-09-01**: re-verified every row against actual call sites (not just
that the service file exists) — see `API_INTEGRATION_AUDIT.md` §D.8–9, §N
for what changed.

---

### `/` — Home (`src/app/(shop)/page.tsx`)
| Service call | Endpoint | Controller | Status |
|---|---|---|---|
| `homeService.getHome()` | `GET /home` | `home.controller` | ✅ |
| `homeService.getSectionProducts(key)` per section | `GET /sections/:key/products` | `sections.controller` | ✅ |
| `useCategories()` (sidebar) | `GET /categories` | `categories.controller` | ✅ |
| `useCouponList()` (coupon strip) | `GET /coupons` | `coupons.controller` | ⚠️ falls back to static list when empty |
| `PromoStrip` / `TrustGrid` | — | — | ⬜ decorative, no backend equivalent |
| `RecentlyViewedSection` | `GET /products/:id` (for ids not in the static catalog) | `products.controller` | ✅ fixed this pass — previously only resolved static-catalog ids, silently dropping every real product from the section |

### `/category/:categoryId` — Category (`category/[categoryId]/page.tsx` + `CategoryClient.tsx`)
| Service call | Endpoint | Controller | Status |
|---|---|---|---|
| `categoryService.getBySlug(slug)` | `GET /categories/:slug/products` | `categories.controller` | ✅ (⚠️ subcategory linkage missing from response — hidden client-side, see audit §D.4) |
| unknown slug | — | — | `notFound()` — there is no static catalog to fall back to |
| Rating filter/sort | — | — | hidden entirely when no product has `rating` |

### `/product/:productId` — Product detail (`product/[productId]/page.tsx` + `ProductClient.tsx`)
| Service call | Endpoint | Controller | Status |
|---|---|---|---|
| `productService.getWithRelated(id)` | `GET /products/:id` | `products.controller` | ✅ |
| `categoryService.getById(product.cat)` (breadcrumb category) | `GET /categories/:id` | `categories.controller` | ✅ |
| unknown id | — | — | `notFound()` — there is no static catalog to fall back to |
| "Ratings & reviews" section | — | — | removed; selorg-service has no review system |
| `useCart().addToCart` | `POST/PUT /cart/items` (if logged in) | `cart.controller` | ✅ (bug fixed this phase — §D.3) |

### `/cart` — Cart (`cart/CartClient.tsx` + `CartContext`)
| Service call | Endpoint | Controller | Status |
|---|---|---|---|
| `cartService.updateByProduct` (on every qty change, if logged in) | `PUT /cart/items` | `cart.controller` | ✅ |
| `cartService.clearCart` | `DELETE /cart/clear` | `cart.controller` | ✅ |
| `couponService.validate` (`applyCoupon`, if logged in) | `POST /coupons/validate` | `coupons.controller` | ✅ |
| local `evaluateCoupon` (guest fallback) | — | — | ⬜ guests only |
| totals math | — | sourced from `AppConfigContext` (`GET /bootstrap`) | ✅ real pricing constants, computed client-side to mirror `POST /orders`'s real engine |
| "You may also like" | `GET /categories/:id` (first cart line's category) | `categories.controller` | ⚠️ falls back to static catalog if the cart's first item isn't real/has no category id |
| `CouponBox`/`ExclusiveOffers` display lists | `GET /coupons` | `coupons.controller` | ⚠️ falls back to static list when empty |

### `/checkout` — Checkout (`CheckoutClient.tsx` + `CheckoutContext`, `OrdersContext`)
| Service call | Endpoint | Controller | Status |
|---|---|---|---|
| `orderService.createOrder` (`placeOrder`, if logged in) | `POST /orders` | `orders.controller` | ✅ (coupon pass-through bug fixed — §D.5; `variantId` was hardcoded `undefined` until this pass — §D.8) |
| local order simulation (guest fallback) | — | — | ⬜ guests only |

### `/checkout/payment` — Payment (`PaymentClient.tsx` + `CheckoutContext`)
| Service call | Endpoint | Controller | Status |
|---|---|---|---|
| `paymentService.createOrderPaymentSession` (`runRealGatewaySession`, if logged in + real order) | `POST /payments/worldline/session` | `payments.controller` | ✅ |
| `openPaynimoCheckout` | — (client-side SDK hand-off) | — | 🔶 deliberate stub — see audit §F |
| `paymentService.getPaymentStatus/completePayment/abortPayment` | `GET/POST /payments/worldline/*` | `payments.controller` | ✅ wired, reached once the SDK stub above is replaced with a real implementation |
| guest simulated flow (`details`/`otp` steps) | — | — | ⬜ guests only, unchanged from before this phase |

### `/checkout/confirmation`
No direct API calls — reads already-fetched order state from `OrdersContext`.

### `/orders`, `/orders/:orderId`, `/account/orders` — Order history/detail
| Service call | Endpoint | Controller | Status |
|---|---|---|---|
| `orderService.listOrders` | `GET /orders` | `orders.controller` | ✅ |
| `orderService.getOrderById` | `GET /orders/:id` | `orders.controller` | ✅ |
| `orderService.cancelOrder` | `POST /orders/:id/cancel` | `orders.controller` | ✅ |
| `orderService.getTracking` | `GET /orders/:id/tracking` | `orders.controller` | ✅ |
| `reorder` | — (should be `POST /orders/:id/reorder`) | `orders.controller` | ❌ uses local name-matching instead — see audit §E/§L |

### `/offers` — Offers (`OffersClient.tsx`)
| Service call | Endpoint | Controller | Status |
|---|---|---|---|
| `useCouponList()` | `GET /coupons` | `coupons.controller` | ⚠️ falls back to static list when empty |
| `applyCoupon` | `POST /coupons/validate` | `coupons.controller` | ✅ |
| Bank offers, FAQ, "Deals by category" banners | — | — | ⬜ no clean backend fit (see audit §H) |

### `/auth` — Sign in / sign up
| Service call | Endpoint | Controller | Status |
|---|---|---|---|
| `authService.sendOtp/verifyOtp/resendOtp` | `POST /auth/*-otp` | `auth.controller` | ✅ |

### `/account`, `/account/profile`
| Service call | Endpoint | Controller | Status |
|---|---|---|---|
| `authService.getProfile/updateProfile` | `GET/PUT /user/profile` | `user.controller` | ✅ |
| `authService.sendPhoneChangeOtp/verifyPhoneChangeOtp` | `POST /auth/link-phone/*` | `auth.controller` | ✅ |

### `/account/addresses`
| Service call | Endpoint | Controller | Status |
|---|---|---|---|
| `addressService.*` | `GET/POST/PUT/DELETE /addresses*` | `addresses.controller` | ✅ |

### `/account/wallet`
| Service call | Endpoint | Controller | Status |
|---|---|---|---|
| `walletService.getBalance/getTransactions` | `GET /wallet/balance`, `GET /wallet/transactions` | `wallet.controller` | ✅ |
| `walletService.initiateTopUp` + `openPaynimoCheckout` | `POST /wallet/top-up/session` | `wallet.controller` | ✅ session create real; SDK hand-off 🔶 stub (fixed shape assumption this phase — §D.7) |

### `/account/notifications`
| Service call | Endpoint | Controller | Status |
|---|---|---|---|
| `notificationsService.getPreferences/updatePreferences` | `GET/PUT /notifications/preferences` | `notifications.controller` | ✅ for `sms`/`whatsapp`/`categories.offers`; other toggles are local-only (no backend field — see audit §G) |

### `/account/preferences`
| Service call | Endpoint | Controller | Status |
|---|---|---|---|
| (same as `/account/notifications` — shares `PreferencesContext`) | — | — | ⚠️ "Show organic-only"/"Personalised deals"/"Veg only" are local-only, no backend field |

### `/account/payments`
**No API calls.** Renders a hardcoded array (`SAVED_METHODS`) with a
fabricated UPI id and card number, presented as the logged-in user's real
saved payment methods. selorg-service has no stored-payment-instrument
endpoint at all (only `paymentMethods[]` from `/bootstrap`, which lists
available method *types*, not a user's saved instances) — so this can't be
made real without a backend addition, but displaying invented account
details as real is a fabrication issue independent of that, flagged in
`API_INTEGRATION_AUDIT.md` §N.2 rather than fixed yet. | ❌ hardcoded/fake |

### Layout-level (every page)
| Service call | Endpoint | Controller | Status |
|---|---|---|---|
| `CategoriesContext` (header, sidebar) | `GET /categories` | `categories.controller` | ✅ falls back to static catalog until resolved (or forever for guests if unreachable) |
| `AppConfigContext` (pricing, wallet presets, payment methods) | `GET /bootstrap` | `bootstrap.controller` | ✅ |
| `LocationPicker` | — | — | ⬜ local timer simulation, no `/locations` call |
| Header search bar (`Header.tsx`) | `GET /products/search`, `/search/suggestions`, `/search/trending` (none called) | `products.controller` | ❌ **not wired at all** — the `<input>` has no `value`/`onChange`/`onSubmit`; `productService.search/getSearchSuggestions/getTrendingSearches` are real, correct, and have zero call sites anywhere in the UI. No `/search` route or results view exists. See `API_INTEGRATION_AUDIT.md` §N.1. |
