# WEB_INTERACTION_AUDIT.md — Phase 10: every interaction in the HTML prototype

Extracted from the `DCLogic` class in `selorg-standalone-src.html` (lines 1253–1970).
"React" = where the behaviour lives in the Next.js app. **Where the prototype fakes a result with local state and the app has a real endpoint, the app's real behaviour is kept** — the prototype is the design source of truth, not the behaviour source of truth.

## Navigation

| Prototype handler | Behaviour | React equivalent | Status |
|---|---|---|---|
| `goHome` | route → home, scroll top | `<Link href="/">` (logo, breadcrumbs) | ✅ |
| `goOrders` | auth-gated → orders | `/orders` + `useRequireAuth` | ✅ |
| `goOffers` | → offers | `/offers` | ✅ |
| `goAccount` | auth-gated → account/profile | `/account/profile` + guard in `account/layout` | ✅ |
| `goWallet` | auth-gated → account tab wallet | `/account/wallet` | ✅ |
| `goSignIn` | account if logged in else auth | `HomeRightRail` CTA | ✅ |
| `goCart` | close drawer → cart | `CartDrawer` "View full cart" | ✅ |
| `goBack` / `_hist` | pop internal history stack | `router.back()` | ✅ |
| `onOpenCategory` | loading 480 ms → category | `/category/[id]` + `useCategoryLoading` | ✅ |
| `onOpenProduct` | push recent → product | `/product/[id]` + `RecentlyViewedContext` | ✅ |
| `openOrder` | → orderDetail + start tracking | `/orders/[id]` + `startTracking` | ✅ |
| `trackOrder` | confirm → orderDetail, reset progress | Confirmation "Track order" | ✅ |
| `setAcctTab` | switch account tab | account sub-routes | ✅ (real routes, better) |

## Header / chrome

| Handler | Behaviour | React | Status |
|---|---|---|---|
| `toggleLocPanel` / `closeLoc` | open/close location panel, reset query | `AddressContext.setLocOpen` + `useOnClickOutside` | ✅ |
| `onLocQuery` | filter saved addresses | `LocationPicker` | ✅ |
| `pickAddress` | select address, close, toast | `selectAddr` | ✅ |
| `detectLocation` | 1.2 s fake detect → default address | `detectLocation()` → real geolocation + `locationService` | ✅ real |
| `addFromLoc` | close panel → open address modal | **was missing** → added | 🔧 fixed |
| `openDrawer` / `closeDrawer` | cart drawer | `UIContext` | ✅ |
| `setBanner` | select hero slide | `useBannerRotation` | ✅ |
| (auto) `_bi` | rotate hero every 4.5 s on home | `useBannerRotation` | ✅ |
| (auto) `_tick` | 1 s flash-deal countdown | `useCountdown` — **had no consumer** → wired into the deals section header | 🔧 fixed |
| `runSearch` / `onSuggestion` / `clearQuery` | search + suggestions | `Header` debounced `productService.getSearchSuggestions` → `/search` | ✅ real |

## Cart

| Handler | Behaviour | React | Status |
|---|---|---|---|
| `onAdd` / `onInc` / `onDec` / `addCore` | qty ±1, delete at 0, toast on add | `CartContext.addToCart/increment/decrement` (+ API sync) | ✅ |
| `stop` | stopPropagation inside card | `e.stopPropagation()` in `QuantityStepper`, `e.preventDefault()` in `ProductCard` | ✅ |
| `removeItem` | remove + toast | `removeItem` | ✅ |
| `saveForLater` | move to saved list + toast | `saveForLater` | ✅ |
| `moveToCart` | saved → cart | `moveToCart` | ✅ |
| `onCoupon` / `applyCoupon` | validate min order, compute flat/pct/max, toast | `CartContext.applyCoupon` + `couponService` | ✅ real |
| `applyNamed` | apply a listed coupon | `ExclusiveOffers` | ✅ |
| `copyCoupon` | clipboard + set field + toast | `CouponStrip`, `CouponBox`, offers page | ✅ |
| `removeCoupon` | clear coupon | `CouponBox` | ✅ |
| `toggleWalletCheckout` | refuse when balance 0, else toggle | `WalletContext.toggleWalletCheckout` | ✅ |
| `getTotals` | sub, MRP sum, discount, coupon, delivery (free ≥ ₹199 else ₹25), handling ₹5, wallet, grand | `useCartTotals` / `lib/cart.ts` (fees from `AppConfigContext`) | ✅ real |

## Category / filters

`setSort`, `setPrice` (multi-select bands), `toggleInStock`, `toggleOffer`, `setRating` (single, toggles off), `toggleBrand`, `setSubcat` (toggles off), `clearSubcat`, `clearFilters` → all in `CategoryFilters` + `lib/products.ts` (`filterProducts`, `sortProducts`, `PRICE_BANDS`, `RATING_BANDS`). ✅
Brand filter is not rendered in the prototype markup (state only) — not implemented, matching the design.
Loading skeleton for 480 ms after a filter/sort/category change → `useCategoryLoading`. ✅

## Product detail

`selectVariant` (per-product index), `pdpAdd` (add with selected variant), `buyNow` (add if absent → checkout). ✅ all present in `ProductClient`.

## Auth

| Handler | Prototype | React | Status |
|---|---|---|---|
| `setAuthMode` | login/signup tab, resets step+phone | `setAuthMode` | ✅ |
| `onAuthMethod` | mobile / whatsapp / email | `setAuthMethod` | ✅ |
| `toggleDial` / `pickDial` | 9-country dial picker with flag images | `DialCodePicker` | ✅ |
| `onAuthPhone` / `onOtp` | digit-only, 10 / 4 max | `setAuthPhone` / `setOtp` | ✅ |
| `sendOtp` / `startSignup` | validate then step → otp | `startLogin` / `startSignup` → `authService` | ✅ real |
| `verifyOtp` | `1234` demo; signup → details, login → home | `verifyOtp` → real OTP verify + token | ✅ real |
| `resendOtp` | toast | `resendOtp` → real resend | ✅ real |
| `backToPhone` | step → phone | `backToPhone` | ✅ |
| `completeSignup` | validate name/email → register | `completeSignup` → real register | ✅ real |
| `_requireAuth(dest)` | route to auth, remember destination | `useRequireAuth` → `/auth?redirect=…` | ✅ |
| `logout` | reset auth + cart, toast | `LogoutModal` → `AuthContext.logout` + `AccountResetContext` | ✅ |
| — | prototype has no guest mode | `loginAsGuest` ("Skip for now") | ✅ extra |

Signup stepper (Number → Verify → Details) rendered by `signupStepper` — **was missing** in React → added. 🔧

## Addresses

`openAddrModal`, `closeModal`, `onAddrField`, `setAddrType`, `saveAddr` (validates name+line, then area; edit vs create; first address becomes default), `editAddr`, `setDefaultAddr`, `askDeleteAddr` → confirm modal → `confirmDeleteAddr` (reassigns selection and default), `closeConfirm`, `selectAddr`. → `AddressFormModal`, `DeleteAddressModal`, `AddressCard`, `AddressContext` (+ `addressService`). ✅

## Checkout / payment

| Handler | Prototype | React | Status |
|---|---|---|---|
| `setSlot` | Express / today / tomorrow | `SlotPicker` | ✅ |
| `setPayment` | upi / card / netbanking / cod | `PaymentMethodPicker` | ✅ |
| `onReceiver` | name / phone (10 digits) / note | `ReceiverForm` | ✅ |
| `startPayment` | COD or ₹0 → place order; else → gateway | `CheckoutClient.startPayment` → places pending order then opens real gateway | ✅ real |
| `payFor` | masks card number `#### ####`, expiry `MM/YY`, CVV 3, OTP 6 | `setPayField` / `PaymentDetailsForm` | ✅ |
| `setUpiApp` / `setBank` | select tile | `PaymentDetailsForm` | ✅ |
| `submitPayment` | per-method validation → processing 1.6 s → otp | `submitPayment` (mock path) / `runRealGatewaySession` (real) | ✅ |
| `confirmPayOtp` | `123456` else failed | `confirmPayOtp` | ✅ |
| `retryPayment` / `changePayMethod` / `cancelPayment` | reset step, back to checkout, toast | present | ✅ |
| `placeOrder` | build order, debit wallet, clear cart, → confirm | `OrdersContext.placeOrder` → real `orderService` | ✅ real |

## Orders

`reorder` (adds every line back, → cart, toast), `cancelOrder` (status → Cancelled), `_startTrack` (1 s poll, progress +0.006, ETA), `_riderAt` / `_routeD` / `_traveledD` (waypoint interpolation for the map), `_decorateOrder` (status colour, badge bg, timeline marks, thumb stack, `canCancel = statusIndex 0–2`). → `OrdersContext` + `lib/orders.ts`. ✅
The illustrated tracking map and the 4-step track list were **simplified/missing** in React → ported. 🔧

## Account

`startEditProfile`, `cancelEditProfile`, `onProfileField`, `saveProfile` (name ≥2, email regex, 10-digit phone; **changing the phone opens an OTP modal**), `onPhoneOtp`, `verifyPhoneChange` (`1234`), `resendPhoneOtp`, `cancelPhoneOtp` → `AuthContext` + `PhoneOtpModal`. ✅
`togglePref` (offers / sms / whatsapp / veg) → `PreferencesContext`. ✅

## Wallet

`onWalletTopup` (digits, max 5), `setTopupPreset`, `addMoney` (min ₹50, max ₹20 000 → opens modal), `setTopupMethod`, `onTopupField`, `submitTopup` (UPI regex / 16-digit card → processing → otp), `confirmTopupOtp` (`123456` → credit + txn + ref, else failed), `retryTopup`, `closeTopup`, `toggleAutoTopup` → `WalletContext` + `WalletTopupModal`. ✅

## Feedback

`showToast(text)` — bottom-centre pill, auto-dismiss 1.8 s → `UIContext.showToast` + `ui/Toast`. ✅
`toastHelp` — "Our support team will reach out shortly" → replaced by real links to `/support`. ✅ real
