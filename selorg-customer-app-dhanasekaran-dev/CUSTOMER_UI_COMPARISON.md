# CUSTOMER_UI_COMPARISON.md — HTML design vs React Native, screen by screen

Read with `CUSTOMER_UI_AUDIT.md` (design side) and `CUSTOMER_EXISTING_FRONTEND_AUDIT.md` (code side).

**"RN before"** = fidelity to the HTML design before this pass, judged on structure/blocks present, not pixel colour.
**API safety** = which live integration the screen must keep while its UI changes.

---

## 0. Two deliberate deviations from the HTML

| # | Deviation | Why |
|---|---|---|
| 1 | **Brand green stays `#034703`**, not the prototype's `#5E8C3A`. `#456E29` → `#023502`, `#2A3326` → `#1A1A1A`, `#E7EBE0` → `#E0E0E0`, `#EAF1E1` → `#E8F0E8`, `#D64C3B` → `#D32F2F`, `#C4771E` → `#B5741A`. | The ZIP's own `docs/REDESIGN_SPEC.md` says the palette is "unchanged from repo" (`#034703`), and the shipped Android splash, notification icon, adaptive icon and store listing already use it. Changing the primary brand colour is a brand decision, not a UI gap. **Every other visual property follows the HTML.** |
| 2 | **Font stays Poppins**, not Plus Jakarta Sans. | Poppins is bundled and linked via `react-native.config.js`; Plus Jakarta Sans is a Google-Fonts web link with no TTFs in the ZIP. The design's **weight ladder** (600 body / 700 label / 800 emphatic) is matched exactly. |

Everything else in this document is treated as a gap to close.

---

## 1. Screen matrix

| # | Screen | HTML | RN before | Missing | Incorrect | Action | API to preserve |
|---|--------|:----:|:---------:|---------|-----------|--------|-----------------|
| 1 | Splash | 100 % | 85 % | Loading spinner | Wordmark 34 vs 26 · tagline 15 vs 13 · subtitle 12.5 vs 11 · no logo shadow · gap 12 vs 18 | Fix | `AuthContext` bootstrap |
| 2 | Onboarding | 100 % | 60 % | **Slide-2 8-tile category mosaic** · **auto-advance 3.2 s** · **tappable dots** | Fixed 320 px carousel (should flex-fill) · full radius (should be top-only 28) · no touch-cancels-autoplay | Fix | `mmkvStorage` onboarding flag |
| 3 | Login (EnterMobile) | 100 % | 75 % | **Country-code picker + flag** · **country-code bottom sheet (8 entries)** | Signup shows 3 methods (should be 2: SMS/WhatsApp) · label always "Mobile number" · trust copy not signup-aware · flat hero (should be gradient) | Fix | `AuthContext.sendOtp` + `USER_NOT_FOUND` / `PHONE_EXISTS` branching |
| 4 | OTP | 100 % | 90 % | — | Resend `30s` (should be `00:30`) · flat icon tile (should be radial gradient) | Fix | `verifyOtp` / `resendOtp` / `mergeGuestCartOnLogin` |
| 5 | ProfileSetup | 100 % | 95 % | — | — | Keep | `completeSignupProfile` |
| 6 | AuthSuccess | 100 % | 40 % | **210×160 hero image** · **CTA button** ("Continue to Home" / "Start Shopping") | Auto-navigates after 1.2 s instead of waiting for the CTA · flat bg (should be gradient) | Fix | none |
| 7 | LocationPermission | 100 % | 90 % | — | "Enter address manually" enters the app instead of opening AddAddress | Fix | `resolveCurrentPlace` · `storeApi.assign` · `saveAddress` |
| 8 | LoginPassword | 100 % | n/a | **Route not registered in `RootNavigator`** | Calls `navigate('Forgot')` → would throw | Fix | none yet |
| 9 | CreatePassword | 100 % | n/a | **Route not registered** | — | Fix | none |
| 10 | Forgot | 100 % | n/a | **Route not registered** | — | Fix | none |
| 11 | ResetPassword | 100 % | n/a | **Route not registered** | — | Fix | none |
| 12 | **Home** | 100 % | 70 % | **Skeleton loading state** · **error state + retry** · **empty state** · hero shadow | Hero CTA "Shop now" (should be "Shop fruits") · hero sub copy wrong · extra profile icon not in design · `sectionTitle` double bottom margin · grid `flexBasis:48%` overflows with `gap:12` | Fix | `getHome` · `getCategories` · `getCollection`×3 · Orders/Notifications/Cart/Wishlist/Auth contexts |
| 13 | Categories | 100 % | 80 % | Empty state · error state | Sub-tiles capped at 8 · `width:'22%'` with a fixed 66 px thumb overflows below 360 px | Fix | `getCategories` |
| 14 | CategoryProducts | 100 % | 55 % | **Back button (screen has none)** · **separate Sort sheet** · **price range** · **discount pills** · **rating pills** · **availability checkboxes** · **"N products found"** · **Clear All** | One sheet behind both buttons · loading state drops the sidebar · sidebar active style differs (left bar vs 3 px bottom border) | Fix | `getCategory` · `getCategoryProducts` |
| 15 | Collection | 100 % | 70 % | Same filter gaps as #14 | Both buttons open the same sheet | Fix | `getCollection` |
| 16 | Search | 100 % | 65 % | **"BROWSE ALL PRODUCTS" default grid** (screen is blank when empty) | Search field not green-bordered when active | Fix | `searchSuggestions` · `searchProducts` |
| 17 | **ProductDetail** | 100 % | 35 % | **Gallery carousel** · **page counter** · **dots** · **zoom overlay** · **share button** · **scroll-reactive floating header** · **variant selector** · **description paragraph** · **review count** · **"Why you'll love it" grid** · **Clean Food Promise card** · **3 of 4 accordions** · **review summary card** · **review rail** · **related-products rail** · **"Go to cart" CTA** · **"Delivering to {city}"** | Static image · plain header · single accordion · off-ribbon radius 4 (should be 999) | Fix | `getProductDetail` — **`variants` and `relatedProducts` are already returned and currently discarded** |
| 18 | Reviews | 100 % | 20 % | **Score card** · **star row** · **5-bar histogram** · **review cards** | Whole screen is one empty state | Fix — render from API, keep the empty state when the backend has no reviews | none (no reviews endpoint) |
| 19 | WriteReview | 100 % | 85 % | — | `setSubmitting` never called | Fix | `getProductDetail` |
| 20 | Cart | 100 % | 90 % | — | Coupon placeholder copy | Fix | `CartContext` server cart + coupon |
| 21 | **Checkout** | 100 % | 55 % | **"This order is for someone else" + receiver name/phone** · **payment-method radio list** · **coupon row** · **ETA display** | Static CTA label (should switch between Place order / Pay with Wallet / Proceed to Pay / Add address) | Fix | `deliveryApi.getEstimate` · `AddressContext` · `CartContext` |
| 22 | Payment | 100 % | 85 % | **"Choose another method" on failure** | COD CTA says "Pay ₹X" (should be "Place order · ₹X") · `card` icon (should be `bank`) | Fix | `placeOrder` · `retryPayment` · Worldline session/complete/abort · `wallet.covers` |
| 23 | Addresses | 100 % | 95 % | — | — | Keep | `AddressContext` CRUD |
| 24 | AddAddress | 100 % | 90 % | — | Field-set alignment | Fix | `addressApi` · `locationsApi` |
| 25 | OrderPlaced | 100 % | 95 % | — | Flat bg (should be gradient) | Fix | `OrdersContext` |
| 26 | **Tracking** | 100 % | 40 % | **Illustrated map** · **overlapping bottom sheet** · **order card** · **rider row (avatar, rating, chat, call)** · **TRIP section label** · **"HOW IS YOUR SHIPPER?" stars** · **report-issue action** · **help chip in header** | Grey "map not available" box · timeline starts at `pending` (design starts at `confirmed`) · dark ETA card not in the design · `riderName` never set | Fix | `openTracking` · `canCancel` · `chatWithRider` |
| 27 | Orders | 100 % | 70 % | **Filter chips All/Active/Completed/Cancelled + counts** · loading state · per-filter empty state | — | Fix | `OrdersContext` list + `reorder` |
| 28 | OrderDetail | 100 % | 70 % | **⋮ header button** · **Order-options bottom sheet** · **Reorder** · **Write a review** | 4 actions stacked as buttons instead of a sheet | Fix | `OrdersContext` · `SupportContext` · `AddressContext` |
| 29 | Cancel | 100 % | 80 % | **Blocked / not-cancellable error state** | Bottom sheet vs full screen (sheet is acceptable on mobile) | Fix the state | `canCancel` · `cancelOrder` |
| 30 | Invoice | 100 % | 90 % | — | Layout alignment | Fix | `ordersApi.getInvoice` |
| 31 | Refunds | 100 % | 85 % | `approved` and `completed` status pills | — | Fix | `RefundsContext` |
| 32 | RefundDetail | 100 % | 90 % | — | — | Keep | `RefundsContext` |
| 33 | ReturnRequest | 100 % | 90 % | — | Reason chips vs radio rows | Fix | `submitReturn` |
| 34 | RateOrder | 100 % | 95 % | — | — | Keep | `rateOrder` |
| 35 | RatingSuccess | 100 % | 85 % | — | Flat bg (should be gradient) | Fix | none |
| 36 | **Account** | 100 % | 65 % | **3 quick-stat tiles (Wallet/Orders/Refunds)** · **Edit chip on the profile card** · **Terms & privacy row** · **Log out button** | — | Fix | Auth · Wallet · Notifications contexts |
| 37 | EditProfile | 100 % | 90 % | — | Disabled-phone "Verified" note | Fix | `authApi.updateProfile` |
| 38 | Settings | 100 % | 95 % | — | Native `Switch` vs custom track — accepted | Keep | `togglePref` · `logout` |
| 39 | Wallet | 100 % | 75 % | **Watermark wallet icon on the hero** · **top-up sheet gradient header** · **security strip** · **Worldline footer** | Presets `100/200/500` (should be `100/250/500`) | Fix | full `WalletContext` top-up flow |
| 40 | Notifications | 100 % | 95 % | — | — | Keep | `NotificationsContext` |
| 41 | Support | 100 % | 70 % | **"QUICK HELP" 4-FAQ list** | — | Fix | `SupportContext` |
| 42 | TicketDetail | 100 % | 90 % | — | — | Keep | `supportApi` messages / reopen |
| 43 | Legal | 100 % | 95 % | — | — | Keep | `legalApi` |
| 44 | NoInternet | 100 % | 95 % | — | — | Keep | — |
| 45 | Wishlist | n/a | — | Not in the HTML — RN superset | — | Keep | `WishlistContext` |
| 46 | enterMobile (HTML variant) | dead | — | Superseded by #3 | — | No action | — |
| 47 | Video modal (HTML) | dead | — | Never invoked in the prototype | — | No action | — |

---

## 2. Shared-component matrix

| Component | HTML | RN before | Missing | Incorrect | Action |
|---|:----:|:---------:|---------|-----------|--------|
| Bottom tab bar | 100 % | 60 % | Floating-pill geometry (16 px side inset, 20 px bottom, radius 30) · notch cut-out around the FAB | FAB 46 px (should be 58) · badge 16 px (should be 20) · labels shown (design has none) · full-width bar with 22 px top corners | Fix |
| Header | 100 % | 70 % | — | Back chip is a 12 px rounded square (should be a 38 px circle with translucent fill + border + shadow) | Fix |
| BottomSheet | 100 % | 80 % | **Drag handle** | Header layout | Fix |
| ProductCard | 100 % | 55 % | Card shadow · **"SOLD OUT" two-line label** | 10 px card padding + 118 px fixed image (should be edge-to-edge 1:1) · default add is the "ADD" pill (should be a 38 px circular +) · radius 16 (should be 20) | Fix |
| QuantityStepper | 100 % | 80 % | — | Grid variant should be a 999-radius pill, 26 px buttons | Fix |
| StatusPill | 100 % | 85 % | — | `radii.round` (should be 8) | Fix |
| SearchBar | 100 % | 95 % | — | — | Keep |
| PrimaryButton | 100 % | 95 % | — | — | Keep |
| StateView | 100 % | 95 % | — | — | Keep |
| CleanBadges | 100 % | 95 % | — | — | Keep |
| OtpBoxInput | 100 % | 100 % | — | — | Keep |
| BillSummaryCard | 100 % | 95 % | — | — | Keep |
| OrderTimeline | 100 % | 85 % | Design starts at `confirmed`, RN starts at `pending` | — | Fix (make the first step configurable) |
| Icon | 100 % | 100 % | — | 79 names, superset of the design's 60 | Keep |

---

## 3. Modal / sheet matrix

| # | HTML overlay | RN before | Action |
|---|---|---|---|
| 1 | Country-code sheet | **absent** | Build `CountryCodeSheet` |
| 2 | Filters sheet (price range, discount, rating, availability, count, Clear All) | stub with 2 chips | Rebuild |
| 3 | Sort sheet (separate) | merged into the filter sheet | Split out |
| 4 | Collection filter sheet | same stub | Covered by #2/#3 |
| 5 | Order-options sheet | **absent** (buttons instead) | Build `OrderOptionsSheet` |
| 6 | Rate-order prompt | **absent** | Build `RateOrderPrompt` |
| 7 | Wallet top-up sheet | present, unbranded | Add gradient header, security strip, Worldline footer |
| 8 | PDP zoom | **absent** | Build |
| 9 | Video modal | absent | No action — dead in the prototype |
| — | Toast host | present | Keep |
| — | Cancel-order sheet | present | Add the blocked state |

---

## 4. Gap totals

| Metric | Before |
|---|---|
| HTML screens | 47 (43 live) |
| RN screens implemented | 46 files / 43 registered routes |
| Screens at or above 90 % fidelity | 18 |
| Screens between 60 % and 90 % | 15 |
| Screens below 60 % | 8 (ProductDetail, Reviews, Tracking, CategoryProducts, Checkout, Collection*, AuthSuccess, Onboarding) |
| Missing UI blocks/sections | 61 |
| Missing buttons / actions | 19 |
| Missing cards | 12 |
| Missing modals / sheets | 5 |
| Missing states (loading / empty / error) | 11 |
| Broken navigation (unregistered routes) | 4 |
| Screens with no back affordance | 1 (CategoryProducts) |
| Responsive defects | 12 (see `CUSTOMER_RESPONSIVE_AUDIT.md`) |
| API integrations found | 90 call sites / 22 services |
| API integrations broken | 0 |
| Screens rendering mock data | 0 |

\* Collection is 70 % but shares the filter-sheet gap, so it is grouped with the rebuild set.
