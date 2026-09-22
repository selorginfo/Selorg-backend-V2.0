# Selorg Webapp

Production Next.js frontend for Selorg — a 12-minute organic grocery delivery app. This is a
ground-up React/Next.js/TypeScript/Tailwind port of a Claude Design canvas export
(`Selorg Web.dc.html`), rebuilt as real App Router routes, components, and typed state instead of
the canvas template/runtime.

## Stack

- **Next.js 16** (App Router, Server + Client Components)
- **React 19** / **TypeScript** (strict)
- **Tailwind CSS v4**
- **lucide-react** for icons
- **Vitest** + **Testing Library** for unit tests

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts:

```bash
npm run build   # production build
npm run start   # run the production build
npm run lint     # eslint
npm run test     # vitest (single run)
npm run test:watch
```

Copy `.env.example` to `.env.local` if/when a real backend replaces the mock service layer.

## Architecture

```
src/
├── app/            Next.js App Router routes (see below)
├── components/     UI components, grouped by domain (ui, layout, product, cart,
│                   checkout, payment, orders, account, auth, category, home)
├── context/        React Context providers holding all app state (auth, cart,
│                   addresses, wallet, checkout/payment flow, orders, UI/toasts/modals)
├── hooks/          Reusable hooks (useRequireAuth, useOrderTracking-style timers,
│                   useBannerRotation, useCountdown, useMediaQuery, etc.)
├── lib/            Pure business logic + static data (cart totals, coupon rules,
│                   order lifecycle, validation, formatting, the product catalog)
├── services/       Async-shaped "API" boundary (payment/OTP/top-up simulations,
│                   product lookups) — swap these for real HTTP calls later without
│                   touching components
└── types/          Shared TypeScript types
```

### Routes

Every screen in the source design has a real route:

- `/auth` — combined login/signup (phone → OTP → signup details)
- `/` — home
- `/category/[categoryId]` — category listing with filters/sort
- `/offers` — coupons, bank offers, FAQ
- `/product/[productId]` — product detail
- `/cart`
- `/checkout` → `/checkout/payment` (gateway simulation) → `/checkout/confirmation`
- `/orders` and `/orders/[orderId]` (with live tracking simulation)
- `/account/*` — `profile`, `orders`, `addresses`, `wallet`, `payments`, `notifications`,
  `preferences`, each a real sub-route sharing an `AccountLayout` sidebar

Routes that require a signed-in user (`/checkout`, `/orders`, `/account/*`) use `useRequireAuth`,
which redirects to `/auth?redirect=<path>` and returns the user to where they were headed after
login.

### State

State lives entirely in React Context (`src/context`) — there is intentionally **no persistence
layer** (no `localStorage`/cookies), matching the source app's behavior exactly: a full reload
resets to the seeded demo data (sample orders, addresses, wallet balance, profile).

### Demo credentials / codes

Since there's no real backend, several flows use fixed demo codes (ported from the source app):

- Login/signup OTP: **any 4+ digit code** succeeds.
- Profile phone-number change re-verification: **1234**.
- Payment and wallet top-up OTP confirmation: **123456**.

### Testing

Unit tests cover the highest-value deterministic logic — cart totals, coupon rules, order
lifecycle/cancellability, and input validation (`src/lib/*.test.ts`). This is not full page/E2E
coverage; UI flows were verified manually via the dev server across desktop/tablet/mobile widths.
