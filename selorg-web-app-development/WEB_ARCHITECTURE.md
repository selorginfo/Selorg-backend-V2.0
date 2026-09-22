# WEB_ARCHITECTURE.md

Selorg customer web app — Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v4.

## 1. Layers

```
app/                 routing, layouts, server components, data assembly
 └─ *Client.tsx      one client component per interactive screen
components/          presentation (ui → domain → layout)
context/             cross-screen state (15 providers, composed in AppProviders)
hooks/               reusable behaviour
services/            the ONLY place that talks to the backend
lib/                 pure logic: money, cart maths, coupons, orders, validation
types/               shared domain types
```

Rule the codebase follows: **screens never call `fetch`.** Server components call a service directly; client components go through a context, which calls a service. `src/services/api.ts` is the single HTTP client.

## 2. Rendering

| Route | Mode | Why |
|---|---|---|
| `/` | `force-dynamic` server component | The home page is CMS-curated; a build-time snapshot would freeze admin changes (and would bake in a failed fetch if the backend were down at build time). |
| `/category/[categoryId]`, `/product/[productId]`, `/orders/[orderId]`, `/support/[ticketId]` | dynamic server component → client child | Data fetched server-side, interactivity delegated. |
| Everything else | static shell + client component | Cart, checkout, account etc. are entirely user-state driven. |

The home page resolves sections in two steps because the backend splits them that way: `/customer/home` returns `sectionDefinitions` (order + labels) plus a `sections{}` map that only inlines categories / banners / lifestyle; product carousels must each be fetched from `/sections/:key/products`.

## 3. Design system

`src/app/globals.css` is the single source of styling truth:

* `@theme` maps every token from the design source (`--color-accent`, `--color-accent-dark`, `--color-accent-tint`, `--color-ink`, `--color-muted`, `--color-line`, `--color-warn`, `--color-star`, `--radius-app`) plus the extra breakpoints `xs 520`, `sm-alt 560`, `pdp 900`.
* `.wrap` — the source's page shell (max 1680, 34 px gutters, 15 px below 560). Used by every page.
* `.skel`, `.no-scrollbar`, and 13 keyframes (`shimmer`, `toastIn`, `drawerIn`, `fadeIn`, `spin`, `authCardIn`, `authStepIn`, `authFieldIn`, `floatY`, `glowPulse`, `otpPop`, `badgePop`, `popIn`) with `.animate-*` helpers.

Non-Tailwind breakpoints from the source are expressed as arbitrary variants (`min-[861px]:`, `min-[941px]:`, `min-[1041px]:`, `min-[1081px]:`, `min-[1221px]:`) so the layout switches exactly where the design does — see `WEB_RESPONSIVE_AUDIT.md`.

Icons are `lucide-react` throughout; the design source draws the same 24×24 stroked glyphs. **Emoji are never used as icons** (the source carries emoji in its promo/trust data but maps them to SVG before rendering — `PromoStrip` does the same).

## 4. Component map

```
ui/          Badge Breadcrumb Button EmptyState Input Modal OtpInput Select
             Skeleton Switch Toast
product/     ProductCard ProductGrid ProductGallery QuantityStepper StarRating
             VariantSelector ReviewSummaryBlock
cart/        CartItemRow SavedItemRow BillSummary CouponBox ExclusiveOffers
checkout/    AddressCard AddressFormModal DeleteAddressModal PaymentMethodPicker
             ReceiverForm SlotPicker
orders/      OrderCard OrderTimeline LiveTrackingMap RiderCard
home/        DynamicHeroBanner DynamicHomeSection SectionCountdown PromoStrip
             CouponStrip HomeSidebar HomeRightRail RecentlyViewedSection
category/    CategoryFilters CategoryRightRail
account/     AccountNav LogoutModal PhoneOtpModal WalletTopupModal
auth/        AuthBrandPanel PhoneStep OtpStep SignupDetailsStep SignupStepper
             DialCodePicker
layout/      Header Footer CartDrawer LocationPicker ModalHost
payment/     PaymentDetailsForm
```

`BillSummary` is shared by cart and checkout via a `variant` prop (`cart` shows MRP + product discount; `checkout` shows the discounted subtotal) plus an optional `header` slot — checkout puts its scrollable order-summary list there so the design's single sticky card is preserved.

All modals are mounted once by `ModalHost` in the root layout and read `UIContext.modal` to decide whether they are open.

## 5. State

Fifteen providers, composed in `AppProviders`:

`AppConfig` (fees/config) · `Auth` (step machine, token, profile, phone-change OTP) · `Categories` · `Cart` (map + variants + saved + coupon, guest→user merge) · `Checkout` (slot, method, receiver, pay-step machine, gateway session) · `Address` (list, selection, location panel, geolocation) · `Delivery` (promise text) · `Orders` (list, detail, tracking poll, rider, reorder, cancel, rate) · `Wallet` (balance, txns, top-up machine) · `Preferences` · `NotificationsInbox` · `RecentlyViewed` · `UI` (drawer, modal, toast) · `AccountReset`.

Known gap (pre-existing, not introduced by the UI pass): the **guest cart lives only in React state**. It survives in-app navigation but not a hard refresh; only a signed-in cart is persisted server-side. Fixing it means either `localStorage` persistence or a guest cart session on the backend — a data-flow change, so it was left alone and is flagged here.

## 6. API integration

`services/api.ts` — base URL from `NEXT_PUBLIC_API_BASE_URL`, else same host on `:3333`; bearer token from `session.ts`; envelope unwrapping; typed `ApiError`; timeout + abort.

22 services: `addressService appConfigService authService cartService categoryService contentService couponService deliveryService homeService locationService notificationsService orderService paymentMethodsService paymentService productService refundService storeService supportService walletService session` + `productAdapters` and two mock modules.

Payments use Worldline/Paynimo (`lib/worldline.ts`, `lib/paynimo.ts`) with a real-order-first flow: checkout places a pending order, opens the gateway session, then polls/confirms and only then clears the cart.

Endpoint-by-endpoint detail lives in `API_CONTRACT.md`, `API_INTEGRATION_AUDIT.md` and `FRONTEND_API_MAP.md`.

## 7. Navigation

`Header` (logo → location → search → Offers/Orders/Alerts → account → cart) and, below 861 px, a scrolling category rail with an active state. `Footer` links the four Shop categories, Company pages, FAQ and support. Auth-gated routes (`/orders`, `/account/*`, `/checkout`) use `useRequireAuth`, which redirects to `/auth?redirect=…` and returns the user afterwards.

## 8. Quality gates

`npx tsc --noEmit` · `npm run lint` · `npm test` (Vitest) · `npm run build`. All four are clean, and the production build emits all 27 routes.
