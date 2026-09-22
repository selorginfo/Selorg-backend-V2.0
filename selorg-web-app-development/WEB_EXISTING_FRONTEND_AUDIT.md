# WEB_EXISTING_FRONTEND_AUDIT.md — Phase 2: audit of the existing Next.js app

## 1. Stack

| Item | Value |
|---|---|
| Framework | Next.js **16.3.2**, **App Router** (`src/app`), React 19.2 |
| Language | TypeScript 5.9, `strict: true`, path alias `@/*` → `src/*` |
| Styling | Tailwind CSS **v4** (`@import "tailwindcss"` + `@theme` tokens in `src/app/globals.css`), `@tailwindcss/postcss` |
| Icons | `lucide-react` |
| Utils | `clsx` + `tailwind-merge` (`src/lib/cn.ts`) |
| Tests | Vitest + Testing Library + jsdom (`src/lib/*.test.ts`) |
| Font | `next/font/google` — Plus Jakarta Sans → `--font-plus-jakarta` |
| Images | `next/image`, remote patterns: `images.pexels.com`, `*.amazonaws.com`, `*.cloudfront.net` |

Baseline health before this pass: **`tsc --noEmit` 0 errors, `eslint .` 0 errors, `next build` succeeds (27 routes)**.

## 2. Design tokens already ported

`globals.css` `@theme` maps every HTML token 1:1 — `--color-accent #5e8c3a`, `--color-accent-dark #446a20`, `--color-accent-tint #eef4e6`, `--color-ink`, `--color-muted`, `--color-line`, `--color-warn`, `--color-star`, `--radius-app 16px`, plus custom breakpoints `xs 520`, `sm-alt 560`, `pdp 900`. All 13 keyframes from the prototype (`shimmer`, `toastIn`, `drawerIn`, `fadeIn`, `spin`, `authCardIn`, `authStepIn`, `authFieldIn`, `floatY`, `glowPulse`, `otpPop`, `badgePop`, `popIn`) exist with `.animate-*` helpers, plus `.skel` and `.no-scrollbar`.

**This is a good base and is reused, not replaced.**

## 3. Route map (27 routes)

```
app/
├── layout.tsx                     AppProviders + CartDrawer + ModalHost + Toast
├── not-found.tsx
├── auth/page.tsx                  → AuthClient (phone → otp → details)
└── (shop)/layout.tsx              Header + main + Footer
    ├── page.tsx                   home (server, force-dynamic, CMS-driven)
    ├── category/[categoryId]/     page (server) → CategoryClient + loading + not-found
    ├── product/[productId]/       page (server) → ProductClient + loading + not-found
    ├── search/                    SearchClient
    ├── offers/                    OffersClient
    ├── cart/                      CartClient
    ├── checkout/                  CheckoutClient
    │   ├── payment/               PaymentClient (gateway)
    │   └── confirmation/          ConfirmationClient
    ├── payment/                   standalone payment-details page
    ├── orders/                    OrdersClient
    │   └── [orderId]/             OrderDetailClient
    ├── account/layout.tsx         AccountNav + outlet (auth-guarded)
    │   ├── profile · orders · addresses · wallet · payments
    │   ├── notifications · preferences · refunds
    ├── support/ + support/[ticketId]/
    ├── faq/
    └── legal/privacy · legal/terms
```

Compared with the prototype the app **adds** real-backend screens the prototype has no design for: `search`, `support`, `support/[ticketId]`, `faq`, `legal/*`, `account/refunds`, `payment`. These are kept.

## 4. Component inventory (before this pass)

```
components/
├── account/    AccountNav, LogoutModal, PhoneOtpModal, WalletTopupModal
├── auth/       AuthBrandPanel, DialCodePicker, PhoneStep, OtpStep, SignupDetailsStep
├── cart/       BillSummary, CartItemRow, CouponBox, ExclusiveOffers, SavedItemRow
├── category/   CategoryFilters, CategoryRightRail
├── checkout/   AddressCard, AddressFormModal, DeleteAddressModal,
│               PaymentMethodPicker, ReceiverForm, SlotPicker
├── home/       CouponStrip, DynamicHeroBanner, DynamicHomeSection, HomeRightRail,
│               HomeSidebar, PromoStrip, RecentlyViewedSection
├── layout/     CartDrawer, Footer, Header, LocationPicker, ModalHost
├── orders/     LiveTrackingMap, OrderCard, OrderTimeline, RiderCard
├── payment/    PaymentDetailsForm
├── product/    ProductCard, ProductGallery, ProductGrid, QuantityStepper,
│               ReviewSummaryBlock, StarRating, VariantSelector
└── ui/         Badge, Breadcrumb, Button, EmptyState, Input, Modal, OtpInput,
                Select, Skeleton, Switch, Toast
```

Deleted in an earlier pass (visible in `git status`): `home/CategoryBanners.tsx`, `home/FlashDeals.tsx`, `home/HeroBanner.tsx` — replaced by the CMS-driven `DynamicHomeSection` / `DynamicHeroBanner`, because the backend has no "flash deals"/"bestsellers" concept and the old components rendered hard-coded content.

## 5. State management — 15 React contexts

| Context | Owns |
|---|---|
| `AppProviders` | composition root, nests all providers |
| `AppConfigContext` | `/config` app settings |
| `AuthContext` | auth step machine, token, profile, signup, profile edit + phone-change OTP |
| `CategoriesContext` | category list (API, static fallback) |
| `CartContext` | cart map, variants, saved-for-later, coupon, totals; guest→user cart merge |
| `CheckoutContext` | slot, payment method, receiver, pay step machine, gateway session |
| `AddressContext` | addresses, selected address, location panel, geolocation detect |
| `DeliveryContext` | delivery promise text/ETA |
| `OrdersContext` | orders, order detail, tracking poll, rider info, reorder, cancel, rate |
| `WalletContext` | balance, transactions, top-up machine, toggles |
| `PreferencesContext` | notification + preference toggles |
| `NotificationsInboxContext` | inbox + unread count |
| `RecentlyViewedContext` | recently-viewed product ids (localStorage) |
| `UIContext` | drawer, modal host, toast |
| `AccountResetContext` | clears account state on logout |

## 6. API layer — 22 services (must not be broken)

`src/services/api.ts` is the single fetch client: base-URL resolution (`NEXT_PUBLIC_API_BASE_URL`, else same-host `:3333`), bearer token from `session.ts`, JSON envelope unwrapping, typed `ApiError` (`src/lib/apiError.ts`), timeout + abort.

```
addressService · appConfigService · authService · cartService · categoryService
contentService · couponService · deliveryService · homeService · locationService
notificationsService · orderService · paymentMethodsService · paymentService
productService (+ productAdapters) · refundService · storeService · supportService
walletService · session · paymentService.mock · walletService.mock
```

Payment integrates Worldline/Paynimo (`src/lib/worldline.ts`, `src/lib/paynimo.ts`) with a real-order-first flow: checkout places a pending order, then opens the gateway session, then polls/confirms.

Existing documentation of this layer: `API_CONTRACT.md`, `API_INTEGRATION_AUDIT.md`, `FRONTEND_API_MAP.md`.

**Rule applied for this pass: no service file, context data flow, endpoint, payload, or response mapping is modified. All changes are presentational.**

## 7. Hooks

`useBannerRotation`, `useCartTotals`, `useCategoryLoading`, `useCountdown`, `useCouponList`, `useDebouncedValue`, `useMediaQuery`, `useMounted`, `useOnClickOutside`, `useRequireAuth`.

Note: `useCountdown` exists but had **no consumer** before this pass (the Flash-Deals countdown it was written for was deleted with `FlashDeals.tsx`).

## 8. Static/demo catalogue

`src/lib/data/catalog.ts` mirrors `selorg-data.js` exactly (9 categories, ~90 products, promos, trust, coupons, banners). It is used as a **fallback** when the backend is unreachable and for the demo product catalogue, not as a substitute for live data — every screen prefers API data and falls back only when a call returns nothing.
