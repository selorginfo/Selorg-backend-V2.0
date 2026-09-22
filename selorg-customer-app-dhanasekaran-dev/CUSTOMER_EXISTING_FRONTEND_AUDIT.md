# CUSTOMER_EXISTING_FRONTEND_AUDIT.md — The shipping React Native app

**Audited:** `selorg-customer-app` @ `main` (working tree, 2026-09-02)
**Role:** SOURCE OF TRUTH FOR API INTEGRATION AND BUSINESS LOGIC.

Baseline before any change: **TypeScript 0 errors · ESLint 9 errors / 15 warnings · 90 API call sites · 0 screens using mock data.**

---

## 1. Architecture

```
App.tsx
 └─ SafeAreaProvider
     └─ AppProviders            src/context/AppProviders.tsx
         Auth → Address → Wishlist → Cart → Orders → Wallet → Notifications → Support → Refunds
         └─ RootNavigator       src/navigation/RootNavigator.tsx  (native-stack, headerShown:false)
             ├─ Splash / Onboarding / auth flow / LocationPermission
             ├─ Main            src/navigation/MainTabNavigator.tsx (5 tabs, custom MainTabBar)
             └─ 30 stack screens
         └─ ToastHost + InAppNotificationBanner
```

| Layer | Location | Notes |
|---|---|---|
| **HTTP client** | `src/api/index.ts` | `fetch` wrapper; multi-candidate base-URL failover, request IDs, retry/log, 401 → `setUnauthorizedHandler` → logout. Verbs: `get`, `getURL`, `getBulk`, `post`, `update` (PUT), `patch`, `delete`. |
| **Base URL resolution** | `src/config/api.ts` | `APP_MODE` env, `__DEV__` routing, Metro-host discovery, `10.0.2.2` for Android emulator, prod fallback `https://api.selorg.com/api/v1/customer`. Also `normalizeApiAssetUrl()` which rewrites localhost asset URLs onto the API origin. |
| **Token storage** | `src/api/storage.ts`, `src/lib/storage.ts` | MMKV-backed. |
| **Envelope handling** | `src/utils/apiResponse.ts` | `unwrapApiData` / `unwrapApiList` for `{ success, data }`. |
| **Error normalisation** | `src/utils/apiError.ts` | `normalizeApiError`, `getErrorCode`, `STATUS_TITLES`. |
| **Domain mapping** | `src/utils/catalogMappers.ts`, `mappers.ts`, `orderTaxDiscounts.ts`, `discounts.ts` | API shape → UI shape. |
| **Services (22)** | `src/services/*.service.ts` | Thin, typed, one per backend module. |
| **State (10 contexts)** | `src/context/*` | All network + business logic lives here; screens are presentational. |
| **Design tokens** | `src/theme/*` | `colors`, `typography` (Poppins), `spacing`, `radii`, `shadows`, `images`. |
| **Shared components (24)** | `src/components/*` | See §4. |
| **Native** | Firebase messaging + Notifee (push), `react-native-maps`, `react-native-webview` (Worldline), `react-native-html-to-pdf` + blob-util (invoice), `lucide-react-native` (icons), `react-native-linear-gradient`, `@shopify/flash-list`. |

---

## 2. API integration inventory — **90 call sites across 22 services**

Every one of these is live and must be preserved.

| Service | Endpoints |
|---|---|
| `auth.service` | `POST /auth/send-otp`, `/auth/verify-otp`, `/auth/resend-otp`, `/auth/logout`; `GET /user/profile`; `PUT /user/profile` |
| `catalog.service` | `GET /products/search`, `/products/search/suggestions`, `/products/search/trending`, `/products/{id}`, `/categories`, `/categories/{id}`, `/categories/{slug}/products`, `/categories/{slug}/subcategories`, `/collections/{slug}`, `/home`, `/sections/{key}/products` |
| `cart.service` | `GET /cart`; `POST /cart/items`, `/cart/merge`; `PUT /cart/items`, `/cart/items/{id}`; `DELETE /cart/items/{id}`, `/cart/clear` |
| `orders.service` | `GET /orders`, `/orders/active`, `/orders/{id}`, `/orders/{id}/tracking`, `/orders/{id}/status`, `/orders/{id}/can-cancel`, `/orders/{id}/invoice`; `POST /orders`, `/orders/{id}/cancel`, `/orders/{id}/rate`, `/orders/{id}/reorder`, `/orders/{id}/verify-otp` |
| `payments.service` | `POST /payments/worldline/session`, `/complete`, `/abort`; `GET /payments/worldline/status`; `GET/POST/DELETE /payments/methods`; `POST /payments/methods/{id}/default` |
| `wallet.service` | `GET /wallet/balance`, `/wallet/transactions`; `POST /wallet/top-up/session`, `/wallet/debit` |
| `coupons.service` | `GET /coupons`; `POST /coupons/validate`, `/coupons/redeem` |
| `address.service` | `GET /addresses`, `/addresses/default`; `POST /addresses`, `/addresses/{id}/default`; `PUT /addresses/{id}`; `DELETE /addresses/{id}` |
| `notifications.service` | `GET /notifications`, `/notifications/unread-count`, `/notifications/preferences`; `PUT /notifications/{id}/read`, `/notifications/read-all`, `/notifications/preferences`; `DELETE /notifications/{id}`; `POST /notifications/register-token`, `/remove-token` |
| `refunds.service` | `GET /refunds`, `/refunds/{id}`, `/refunds/{id}/details`; `POST /refunds/request` |
| `support.service` | `GET /support/tickets`, `/support/tickets/active`, `/support/tickets/{id}/messages`; `POST /support/tickets`, `/{id}/messages`, `/{id}/reopen` |
| `delivery.service` | `GET /delivery/estimate`, `/delivery/fee` |
| `store.service` | `POST /store/assign`; `GET /store/{id}/inventory` |
| `locations-api.service` | `GET /locations/suggestions`, `/locations/approximate` |
| `legal.service` | `GET /legal/terms`, `/legal/privacy`, `/legal/license`, `/legal/config`; `POST /legal/accept` |
| `bootstrap` / `app-config` | `GET /bootstrap`, `/app-config` |
| `location.service` | Native geolocation + reverse geocode (no HTTP of its own) |
| `push.service` / `pushNotifications` | FCM token lifecycle, Notifee channels |

**Mock data:** `src/services/mockData/` exists but is imported by exactly **one** file, and only for a **type**: `ProductCard.tsx` imports `type { Product }`. **No screen renders mock data.** That must stay true.

---

## 3. Context layer — where the business logic lives

| Context | Lines | Owns |
|---|---|---|
| `AuthContext` | 354 | OTP session (`sendOtp` / `verifyOtp` / `resendOtp`), cooldown + attempts, tokens, guest mode, `completeSignupProfile`, single-flight logout, 401 handler wiring |
| `CartContext` | 454 | Server cart sync, optimistic qty mutations, guest cart + `mergeGuestCartOnLogin`, coupon apply/remove, tip, `itemTotal` / `deliveryFee` / `discount` / `grandTotal` |
| `OrdersContext` | 385 | Order list + active order, **create-order-before-pay**, Worldline session → WebView → complete, `payState` machine (`idle/processing/awaiting_gateway/failed/error`), retry, cancel + `canCancel`, reorder, rate, tracking poll |
| `WalletContext` | 445 | Balance, ledger, `covers()`, top-up session → WebView → complete, refresh |
| `AddressContext` | 158 | CRUD, default, selected address |
| `NotificationsContext` | 134 | Inbox, unread count, read / read-all / delete, preferences |
| `SupportContext` | 106 | Tickets, messages, `chatWithRider`, `newTicket` |
| `RefundsContext` | 96 | Refund list, `submitReturn` |
| `WishlistContext` | 29 | Local wishlist (no backend endpoint exists) |

---

## 4. Shared components (24)

`AppBottomNav` (+`MainTabBar`) · `BackButton` · `BillSummaryCard` · `BottomSheet` · `BrandSvg` · `CancelOrderSheet` · `CleanBadges` · `Header` · `Icon` (79 lucide names) · `InAppNotificationBanner` · `OrderTimeline` · `OtpBoxInput` · `PasswordField` · `PasswordRules` · `PrimaryButton` · `ProductCard` · `QuantityStepper` · `ScreenContainer` · `SearchBar` · `Spinner` · `StateView` · `StatusPill` · `ToastHost` · `WorldlineCheckoutWebView`

---

## 5. Screen-by-screen audit

Legend — **UI status** is measured against `CUSTOMER_UI_AUDIT.md`.

### Auth / onboarding

| Screen | File | API integration | UI status | Missing / incorrect | Required change |
|---|---|---|---|---|---|
| Splash | `Splash/index.tsx` | `AuthContext` bootstrap | 85 % | No spinner; wordmark 34 vs 26; tagline 15 vs 13; no logo shadow | Add spinner, correct type scale |
| Onboarding | `onboarding/Onboarding.tsx` | `mmkvStorage` flag | 60 % | **No auto-advance**; **dots not tappable**; **slide 2 mosaic missing** (uses a photo); fixed 320 px carousel instead of flex fill; full radius instead of top-only | Add autoplay + tappable dots + `OnboardMosaic`; make the image area flex |
| Login / EnterMobile | `auth/EnterMobile.tsx` | `sendOtp()` — send-otp + `USER_NOT_FOUND` / `PHONE_EXISTS` branching | 75 % | **No country-code picker**; signup shows 3 methods instead of 2; label always "Mobile number"; trust copy not signup-aware; flat hero (no gradient) | Add `CountryCodeSheet`, mode-aware method list, dynamic labels |
| OTP | `auth/otp.tsx` | `verifyOtp`, `resendOtp`, `mergeGuestCartOnLogin` | 90 % | Resend shows `30s` not `00:30`; icon tile is flat not radial-gradient | Format timer, gradient tile |
| ProfileSetup | `auth/ProfileSetup.tsx` | `completeSignupProfile` | 95 % | — | — |
| AuthSuccess | `auth/AuthSuccess.tsx` | none (timer) | 40 % | **Hero image missing**; **CTA button missing** — auto-navigates after 1.2 s instead | Add image + "Continue to Home" / "Start Shopping" CTA |
| LocationPermission | `location/LocationPermission.tsx` | `resolveCurrentPlace`, `storeApi.assign`, `saveAddress` | 90 % | "Enter address manually" enters the app instead of opening AddAddress | Route to `AddAddress` |
| LoginPassword / CreatePassword / Forgot / ResetPassword | `auth/*.tsx` | none yet | n/a | **Declared in `ROUTES` and `RootStackParamList` but NOT registered in `RootNavigator`** — `LoginPassword` calls `navigate('Forgot')`, which would throw | Register all four |
| Welcome | `auth/Welcome.tsx` | — | — | 5-line dead re-export, zero references | Delete |

### Shopping

| Screen | File | API integration | UI status | Missing / incorrect | Required change |
|---|---|---|---|---|---|
| Home | `home/index.tsx` | `catalogApi.getHome`, `getCategories`, `getCollection` × 3; Orders/Notifications/Cart/Wishlist/Auth contexts | 70 % | **No loading skeleton, no error state, no empty state**; hero copy differs; no hero shadow; extra profile icon not in design; `sectionTitle` double margin; card grid uses `flexBasis 48%` (overflow risk) | Add `HomeSkeleton` + error/empty; fix copy, shadow, spacing, grid |
| Categories | `categories/index.tsx` | `catalogApi.getCategories` | 80 % | Sub-tiles capped at 8 (design shows all); **no empty/error state**; `width:'22%'` + fixed 66 px thumb overflows below 360 px | Show all subs, add states, make tiles fluid |
| CategoryProducts | `categories/CategoryProducts.tsx` | `getCategory`, `getCategoryProducts` | 55 % | **No back button anywhere on the screen**; filter and sort buttons open the *same* sheet; filter sheet is a stub (see below); no count badge parity; loading state loses the sidebar | Add back chip; split sort/filter; rebuild the sheet |
| Collection | `categories/Collection.tsx` | `catalogApi.getCollection` | 70 % | Same stubbed sheet; both buttons open it | Same |
| Search | `home/Search.tsx` | `searchSuggestions`, `searchProducts` | 65 % | **Blank screen when the query is empty** — the design shows a "BROWSE ALL PRODUCTS" grid; search field not green-bordered | Add default browse grid + focus styling |
| ProductDetail | `product/ProductDetail.tsx` | `getProductDetail` (**`variants` and `relatedProducts` returned by the service are discarded**) | 35 % | **13 blocks missing** — gallery carousel, page counter, dots, zoom, share, floating scroll-reactive header, variant selector, description, "Why you'll love it", Clean Food Promise, 3 of 4 accordions, review summary + rail, related-products rail, "Go to cart" CTA, "Delivering to {city}" | Largest rebuild — see comparison doc |
| Reviews | `product/Reviews.tsx` | none (no reviews endpoint) | 20 % | **Score card, histogram and review list all missing** — screen is a single empty state | Build the real layout, driven by API data when available, empty state when not |
| WriteReview | `product/WriteReview.tsx` | `getProductDetail`; submit is a stub toast | 85 % | `setSubmitting` never called (ESLint error) | Wire the submit state |

### Cart / checkout / payment

| Screen | File | API integration | UI status | Missing / incorrect | Required change |
|---|---|---|---|---|---|
| Cart | `cart/cart.tsx` | `CartContext` (server cart, coupon) | 90 % | Coupon placeholder differs; no per-item remove affordance beyond the stepper | Minor copy fixes |
| Checkout | `cart/checkout.tsx` | `deliveryApi.getEstimate` (**fetched into `etaLabel` and never rendered — ESLint error**), `AddressContext`, `CartContext` | 55 % | **Gift/receiver block missing**; **payment-method selector missing**; **coupon row missing**; static CTA label; ETA never shown | Add all three blocks + dynamic CTA + render ETA |
| Payment | `orders/PaymentScreen.tsx` | `OrdersContext.placeOrder` / `retryPayment` / Worldline WebView, `WalletContext.covers` | 85 % | **"Choose another method" missing on failure**; COD CTA label wrong; `bank` icon vs `card` | Add secondary action + label logic |
| Addresses | `profile/addresses.tsx` | `AddressContext` CRUD | 95 % | — | — |
| AddAddress | `profile/AddAddress.tsx` | `addressApi`, `locationsApi` | 90 % | Verify label chips / receiver fields against design | Align field set |
| OrderPlaced | `orders/OrderPlaced.tsx` | `OrdersContext` | 95 % | Flat background vs gradient | Add gradient |

### Orders / after-sales

| Screen | File | API integration | UI status | Missing / incorrect | Required change |
|---|---|---|---|---|---|
| Orders | `orders/index.tsx` | `OrdersContext` | 70 % | **Filter chips (All/Active/Completed/Cancelled + counts) missing**; no loading state; no per-filter empty state | Add chips + states |
| OrderDetail | `orders/OrderDetail.tsx` | `OrdersContext`, `SupportContext`, `AddressContext` | 70 % | **⋮ header button + Order-options bottom sheet missing** (4 actions rendered as stacked buttons instead); **Reorder and Write-a-review missing for delivered orders** | Add `OrderOptionsSheet` + actions |
| Tracking | `orders/Tracking.tsx` | `openTracking`, `canCancel`, `chatWithRider` | 40 % | **Illustrated map missing** (grey text box); **overlapping bottom sheet missing**; **order card missing**; **rider row missing**; **TRIP label missing**; **"HOW IS YOUR SHIPPER?" block missing**; **report-issue action missing**; **help chip missing**; `riderName` set nowhere (ESLint error) | Major rebuild |
| Invoice | `orders/Invoice.tsx` | `ordersApi.getInvoice`, html-to-pdf | 90 % | Verify against invoice-card layout | Align |
| RateOrder | `orders/RateOrder.tsx` | `rateOrder` | 95 % | — | — |
| RatingSuccess | `orders/RatingSuccess.tsx` | — | 85 % | Flat background vs gradient | Add gradient |
| Refunds | `refunds/index.tsx` | `RefundsContext` | 85 % | Only 3 of 5 status pills styled (`approved` / `completed` fall through) | Add the missing statuses |
| RefundDetail | `refunds/RefundDetail.tsx` | `RefundsContext` | 90 % | — | — |
| ReturnRequest | `refunds/ReturnRequest.tsx` | `submitReturn` | 90 % | Reason chips vs radio rows | Align |

### Account

| Screen | File | API integration | UI status | Missing / incorrect | Required change |
|---|---|---|---|---|---|
| Account | `profile/index.tsx` | Auth / Wallet / Notifications | 65 % | **3 quick-stat tiles missing**; **Edit chip on the profile card missing**; **Terms & privacy row missing**; **Log out button missing** | Add all four |
| EditProfile | `profile/profileDetails.tsx` | `authApi.updateProfile` | 90 % | Verify disabled-phone "Verified" note | Align |
| Settings | `profile/settings.tsx` | `NotificationsContext.togglePref`, `logout` | 95 % | Native `Switch` vs custom 46×27 track (acceptable platform substitution) | — |
| Wallet | `wallet/index.tsx` | `WalletContext` full top-up flow | 75 % | Presets `100/200/500` vs `100/250/500`; **watermark icon missing**; **top-up sheet gradient header, security strip and Worldline footer missing** | Align sheet + hero |
| Notifications | `profile/notification.tsx` | `NotificationsContext` | 95 % | — | — |
| Support | `profile/helpSupport.tsx` | `SupportContext` | 70 % | **"QUICK HELP" 4-FAQ list missing** | Add FAQ list |
| TicketDetail | `profile/TicketDetail.tsx` | `supportApi` messages / reopen | 90 % | — | — |
| Legal | `profile/policy.tsx` | `legalApi.getTerms` / `getPrivacy` | 95 % | — | — |
| Wishlist | `profile/yourWishlist.tsx` | `WishlistContext` (local) | n/a | Not in the HTML design — RN superset, keep | — |
| NoInternet | `common/NoInternet.tsx` | — | 95 % | — | — |

---

## 6. Cross-cutting component gaps

| Component | Gap vs design |
|---|---|
| `AppBottomNav` | Full-width bar with 22 px top corners; design is a **floating pill** (16 px side inset, 20 px bottom inset, radius 30, notch mask). FAB 46 px vs **58 px**, badge 16 px vs **20 px**, and the design shows **no tab labels**. |
| `Header` | Back chip is a 12 px rounded square; design is a **38 px circle** with translucent fill + border + shadow. |
| `BottomSheet` | **No drag handle.** Design shows a 40×4–5 px pill on every sheet. |
| `ProductCard` | Card has 10 px padding and a 118 px fixed-height image; design is **edge-to-edge 1:1 image, zero card padding, radius 20, card shadow**. Add control defaults to the "ADD" pill; design uses a **38 px circular +**. Out-of-stock shows a grey `+`; design shows a two-line **"SOLD OUT"**. |
| `QuantityStepper` | Grid variant should be a **999-radius pill** with 26 px buttons. |
| `StatusPill` | `radii.round`; design uses **radius 8**. |
| `StateView` | Matches. |
| `PrimaryButton` | Matches. |
| `Icon` | 79 names registered, superset of the design's 60. |

---

## 7. Code-quality baseline

| Check | Result |
|---|---|
| `tsc --noEmit` | **0 errors** |
| `eslint . --ext .ts,.tsx` | **9 errors, 15 warnings** |
| Unused-var errors that are actually *missing UI* | `checkout.tsx: etaLabel`, `Tracking.tsx: setRiderName`, `WriteReview.tsx: setSubmitting` |
| Other unused-var errors | `AddressContext: isAuthenticated`, `CartContext: e`, `MainTabNavigator: StyleSheet/Text/View`, `apiError: status` |
| Dead files | `screens/auth/Welcome.tsx` (0 references) |
| Unregistered routes | `LoginPassword`, `CreatePassword`, `Forgot`, `ResetPassword` |
| Hardcoded API URLs | None — all through `src/config/api.ts` |
| Broken asset requires | None |

---

## 8. What must not be touched

* Every service in `src/services/` and the client in `src/api/`.
* Every context in `src/context/` — in particular `OrdersContext`'s create-order-before-pay sequence, the Worldline session/complete/abort handshake, and `CartContext`'s guest-merge single-flight.
* `src/config/api.ts` base-URL resolution.
* Token storage, the 401 → logout handler, and push-token registration.
* All screens keep their existing hooks and props; UI work is additive rendering, never a data-source swap.
