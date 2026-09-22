# CUSTOMERAPP_BACKEND_API_AUTOMATION_TEST_REPORT

Generated: **2026-09-16T13:05:57.944Z**

## 1. Test environment

| Item | Value |
|------|-------|
| Date | 2026-09-16T13:05:57.944Z |
| Frontend | selorg-customer-app (React Native 0.83) |
| Backend | selorg-service @ `http://127.0.0.1:3333` |
| Customer API prefix | `/api/v1/customer` |
| App DEV API base | `http://localhost:3333/api/v1/customer` (`.env`) |
| Auth test identity | OTP_TEST_MOBILE default `9698790921` / OTP `8790` (non-prod fixed OTP) |
| OS | Windows |
| Data policy | Real backend only — no API mocks in the test harness |

## 2. Testing tools used

- **Playwright** (`@playwright/test`) — APIRequestContext for live integration + journey/contract flows
- Existing **Jest** unit tests were **not** used for this live API audit (RN component/unit scope)
- Native UI E2E (Detox/Maestro) is **not configured** — user flows covered via real-backend API journeys matching `src/services`
- Config: `playwright.config.ts`, specs under `e2e/api/*` and `e2e/flows/*`
- Report source: `test-results/playwright-report.json`

## 3. API inventory (customer-app services → `/api/v1/customer`)

> Extracted from `selorg-customer-app/src/services/*` + contexts during audit.
> Base URL resolution: `src/config/api.ts` → `DEV_API_BASE_URL` / Metro host / `10.0.2.2:3333` / localhost.
> HTTP client: `src/api/index.ts` (native fetch, Bearer from MMKV `accessToken`, 20s timeout, multi-host fallback).

| Domain | Method | Path | Auth | Frontend usage |
|--------|--------|------|------|----------------|
| Auth | POST | /auth/send-otp | skip | AuthContext / EnterMobile |
| Auth | POST | /auth/verify-otp | skip | AuthContext / OTP |
| Auth | POST | /auth/resend-otp | skip | AuthContext / OTP |
| Auth | POST | /auth/logout | Bearer | AuthContext |
| Profile | GET | /user/profile | Bearer | AuthContext / profileDetails |
| Profile | PUT | /user/profile | Bearer | AuthContext / profileDetails |
| Address | GET | /addresses | Bearer | AddressContext |
| Address | GET | /addresses/default | Bearer | address.service |
| Address | POST | /addresses | Bearer | AddressContext / AddAddress |
| Address | PUT | /addresses/:id | Bearer | AddressContext |
| Address | DELETE | /addresses/:id | Bearer | AddressContext |
| Address | POST | /addresses/:id/default | Bearer | AddressContext |
| Cart | GET | /cart | Bearer | CartContext |
| Cart | POST | /cart/items | Bearer | CartContext |
| Cart | PUT | /cart/items | Bearer | CartContext (by product) |
| Cart | PUT | /cart/items/:itemId | Bearer | CartContext |
| Cart | DELETE | /cart/items/:itemId | Bearer | CartContext |
| Cart | DELETE | /cart/clear | Bearer | CartContext |
| Cart | POST | /cart/merge | Bearer | CartContext |
| Orders | GET | /orders | Bearer | OrdersContext |
| Orders | GET | /orders/active | Bearer | OrdersContext |
| Orders | GET | /orders/:id | Bearer | OrderDetail |
| Orders | POST | /orders | Bearer | checkout (+ Idempotency-Key) |
| Orders | POST | /orders/:id/cancel | Bearer | OrdersContext |
| Orders | GET | /orders/:id/can-cancel | Bearer | OrdersContext |
| Orders | GET | /orders/:id/tracking | Bearer | Tracking |
| Orders | GET | /orders/:id/status | Bearer | OrderDetail |
| Orders | POST | /orders/:id/rate | Bearer | RateOrder |
| Orders | POST | /orders/:id/verify-otp | Bearer | delivery OTP |
| Orders | POST | /orders/:id/reorder | Bearer | OrdersContext |
| Orders | GET | /orders/:id/invoice | Bearer | Invoice |
| Payment | GET/POST/DELETE | /payments/methods* | Bearer | payments.service |
| Payment | POST | /payments/worldline/session|complete|abort | Bearer | checkout / WebView |
| Payment | GET | /payments/worldline/status | Bearer | PaymentScreen |
| Products | GET | /products/search|suggestions|trending|/:id | optional | Search / ProductDetail |
| Categories | GET | /categories|/:id|/products|/subcategories | optional | Categories |
| Home | GET | /home|/sections/:key/products|/collections/:slug | optional | Home / Collection |
| Location | GET | /locations/suggestions|approximate | skip | LocationPermission |
| Wallet | GET | /wallet/balance|transactions | Bearer | WalletContext |
| Wallet | POST | /wallet/top-up/session | Bearer | WalletContext (platform android/ios) |
| Wallet | POST | /wallet/debit | Bearer | checkout |
| Coupons | GET | /coupons | optional | Cart |
| Coupons | POST | /coupons/validate|redeem | Bearer | Cart (snake_case body) |
| Store | POST | /store/assign | skip | location flow |
| Store | GET | /store/:id/inventory | skip | store.service |
| Delivery | GET | /delivery/estimate|fee | skip | checkout |
| Notifications | GET/PUT/DELETE | /notifications/* | Bearer | NotificationsContext |
| Push | POST | /notifications/register-token|remove-token | Bearer | push.service |
| Support | GET/POST | /support/tickets/* | Bearer | SupportContext |
| Refunds | GET/POST | /refunds* | Bearer | RefundsContext (**no mock**) |
| Legal | GET/POST | /legal/* | mixed | policy screen |
| Config | GET | /bootstrap|/app-config | optional | Splash / bootstrap |

**Total frontend-mapped customer endpoints:** ~70 function→HTTP mappings across `src/services`.

## 4. Totals

| Metric | Count |
|--------|------:|
| Total tests executed | 107 |
| Passed | 107 |
| Failed | 0 |
| Skipped | 0 |
| Blocked (data/env skip) | 0 |
| API project tests | 97 |
| Flows / journey tests | 21 |
| Playwright stats.expected | 107 |
| Playwright stats.unexpected | 0 |
| Playwright stats.skipped | 0 |

## 5. Passed tests

- ✅ [api] OTP auth contract (customer AuthContext) › send-otp rejects missing identifier
- ✅ [api] OTP auth contract (customer AuthContext) › send-otp rejects invalid phone
- ✅ [api] OTP auth contract (customer AuthContext) › verify-otp rejects wrong otp
- ✅ [api] OTP auth contract (customer AuthContext) › verify-otp rejects missing fields
- ✅ [api] OTP auth contract (customer AuthContext) › resend-otp with invalid session → 4xx
- ✅ [api] OTP auth contract (customer AuthContext) › login with fixed test OTP succeeds and returns accessToken + user
- ✅ [api] Auth-gated APIs without token (negative) › GET /user/profile without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /addresses without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /addresses/default without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /cart without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /orders without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /wallet/balance without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /wallet/transactions?limit=10 without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /notifications?page=1&limit=10 without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /notifications/preferences without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /refunds?page=1&limit=10 without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /support/tickets without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /payments/methods without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › POST /orders without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › POST /wallet/debit without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › POST /auth/logout without token is idempotent (200)
- ✅ [api] Auth-gated APIs without token (negative) › GET /coupons without token (auth-optional contract)
- ✅ [api] Auth-gated APIs without token (negative) › invalid Bearer token → 401
- ✅ [api] Auth-gated APIs without token (negative) › malformed Authorization header → 401
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET /bootstrap — bootstrap
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET /app-config — app-config
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET /home — home
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET /categories — categories
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET /products/search?q=ab&page=1&limit=5 — products search (short q)
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET /products/search?q=milk&page=1&limit=5 — products search (valid q)
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET /products/search/suggestions?q=mi — search suggestions
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET /products/search/trending — trending searches
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET /legal/terms — legal terms
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET /legal/privacy — legal privacy
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET /legal/config — legal config
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET /legal/license — legal license
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET /locations/approximate — locations approximate
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET /locations/suggestions?q=chennai — locations suggestions
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET /categories then products + subcategories
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET /home then sections/collections used by Home screen
- ✅ [api] Public / guest-tolerant APIs used by customer app › POST /store/assign with Chennai coords
- ✅ [api] Public / guest-tolerant APIs used by customer app › GET delivery estimate/fee when store assign returns storeId
- ✅ [api] Environment & connectivity › backend is reachable on configured API_BASE
- ✅ [api] Environment & connectivity › customer-app DEV_API_BASE_URL path resolves (APP_API_BASE)
- ✅ [api] Environment & connectivity › OPTIONS preflight on bootstrap (WebView / hybrid checkout relevance)
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › GET /coupons
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › POST /coupons/validate invalid code → 4xx or success=false
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › POST /coupons/redeem missing order_id → 4xx
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › GET /wallet/balance
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › GET /wallet/transactions
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › POST /wallet/top-up/session invalid amount → 4xx
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › POST /wallet/debit invalid amount → 4xx
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › GET /notifications + unread-count + preferences
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › PUT /notifications/read-all
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › PUT /notifications/preferences
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › POST /notifications/register-token (FCM shape)
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › GET /support/tickets + active
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › GET /refunds (customer refunds.service — no mock fallback)
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › GET /payments/methods
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › GET /orders + /orders/active
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › POST /orders with empty items → 4xx
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › GET /orders/invalid-id → 4xx
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › GET /orders/:id/can-cancel invalid id — domain deny (not 5xx)
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › CONTRACT: can-cancel response field is canCancel (orders.service)
- ✅ [api] Coupons / wallet / notifications / support / refunds / payments › GET payment status missing orderId → 4xx
- ✅ [api] Cart operations (cart.service / CartContext) › resolve a productId from search or categories
- ✅ [api] Cart operations (cart.service / CartContext) › GET /cart
- ✅ [api] Cart operations (cart.service / CartContext) › POST /cart/items add
- ✅ [api] Cart operations (cart.service / CartContext) › PUT /cart/items by product quantity (updateItemByProduct)
- ✅ [api] Cart operations (cart.service / CartContext) › PUT /cart/items/:itemId (updateItem)
- ✅ [api] Cart operations (cart.service / CartContext) › DELETE /cart/items/:itemId (removeItem)
- ✅ [api] Cart operations (cart.service / CartContext) › POST /cart/items missing productId → 4xx
- ✅ [api] Cart operations (cart.service / CartContext) › POST /cart/items invalid productId → 4xx
- ✅ [api] Cart operations (cart.service / CartContext) › DELETE /cart/clear
- ✅ [api] Cart operations (cart.service / CartContext) › POST /cart/merge with mergeKey
- ✅ [api] Addresses CRUD (address.service / AddressContext) › GET /addresses list
- ✅ [api] Addresses CRUD (address.service / AddressContext) › GET /addresses/default
- ✅ [api] Addresses CRUD (address.service / AddressContext) › POST /addresses create
- ✅ [api] Addresses CRUD (address.service / AddressContext) › PUT /addresses/:id update
- ✅ [api] Addresses CRUD (address.service / AddressContext) › POST /addresses/:id/default
- ✅ [api] Addresses CRUD (address.service / AddressContext) › PUT /addresses invalid id → 4xx
- ✅ [api] Addresses CRUD (address.service / AddressContext) › POST /addresses missing line1 → 4xx (backend validation)
- ✅ [api] Addresses CRUD (address.service / AddressContext) › DELETE /addresses/:id
- ✅ [api] Profile (auth.service / AuthContext) › GET /user/profile returns user fields
- ✅ [api] Profile (auth.service / AuthContext) › PUT /user/profile with name updates
- ✅ [api] Profile (auth.service / AuthContext) › PUT /user/profile with invalid email (expect validation 4xx)
- ✅ [api] api\03-journey.api.spec.ts › 1. Login / OTP (EnterMobile → OTP screens)
- ✅ [api] api\03-journey.api.spec.ts › 2. Session — profile load (AuthContext persistence shape)
- ✅ [api] api\03-journey.api.spec.ts › 3. Address create/list (AddAddress / AddressContext)
- ✅ [api] api\03-journey.api.spec.ts › 4. Product / category / search (Home / Search / Categories)
- ✅ [api] api\03-journey.api.spec.ts › 5. Cart add / read (Cart screen)
- ✅ [api] api\03-journey.api.spec.ts › 6. Checkout — create order COD (checkout screen)
- ✅ [api] api\03-journey.api.spec.ts › 7. Order status / tracking / invoice / can-cancel
- ✅ [api] api\03-journey.api.spec.ts › 8. Payment Worldline session (android platform — payments.service)
- ✅ [api] api\03-journey.api.spec.ts › 9. Wallet balance / transactions (Wallet screen)
- ✅ [api] api\03-journey.api.spec.ts › 10. Logout + token post-logout probe
- ✅ [api] api\03-journey.api.spec.ts › 11. CRITICAL: re-login after logout must return a usable NEW token
- ✅ [flows] flows\01-frontend-contract.flows.spec.ts › Envelope shape: public bootstrap has success + data
- ✅ [flows] flows\01-frontend-contract.flows.spec.ts › Envelope shape: error responses set success=false (invalid OTP)
- ✅ [flows] flows\01-frontend-contract.flows.spec.ts › Auth login returns accessToken shape used by AuthContext/Storage
- ✅ [flows] flows\01-frontend-contract.flows.spec.ts › Cart response has items[] + totals (CartContext mapping)
- ✅ [flows] flows\01-frontend-contract.flows.spec.ts › Wallet balance has numeric balance field (WalletContext)
- ✅ [flows] flows\01-frontend-contract.flows.spec.ts › Orders list shape matches OrdersContext listFrom (array | {list} | {data})
- ✅ [flows] flows\01-frontend-contract.flows.spec.ts › Search products shape usable by catalogApi.mapProducts
- ✅ [flows] flows\01-frontend-contract.flows.spec.ts › Categories list is array (Categories screen)
- ✅ [flows] flows\01-frontend-contract.flows.spec.ts › Empty / invalid product id — expect 4xx (StateView error path)
- ✅ [flows] flows\01-frontend-contract.flows.spec.ts › Unauthorized after bad token matches AuthContext 401 handler contract

## 6. Failed tests

- _(none)_
## 7. Blocked / skipped tests

- _(none)_

## 8. E2E flows tested

| Flow | Covered by | Notes |
|------|------------|-------|
| Login / OTP | api journey + auth API | Fixed non-prod OTP |
| Session persistence | profile after login | Token Bearer contract (MMKV in app) |
| Logout | journey + authenticated API | Post-logout token probe |
| Address CRUD | authenticated API | create/update/default/delete |
| Product/category/collection | public API + journey | Home/Search/Categories |
| Search | public API | suggestions + trending |
| Cart operations | authenticated API | add/update/remove/clear/merge |
| Checkout / order create | journey API | COD preferred; domain 4xx classified |
| Payment flow | journey Worldline session | android platform |
| Wallet | authenticated + journey | balance/transactions/top-up negative |
| Order status | journey | detail/status/tracking/invoice/can-cancel |
| Profile/account | authenticated API | GET/PUT profile |
| Frontend envelope/mappers | flows contract specs | success/data/list shapes |
| Native UI loading/empty | _not automated_ | Detox/Maestro not in repo |

## 9. API integration issues

Auto-extracted from failures (review each):

- No hard test failures recorded in this run.

### Previously failed contracts — now fixed

| Issue | Fix | Status |
|-------|-----|--------|
| Orders `listFrom` missing paginated `data.data` | `orders.service.ts` accepts array / `{list}` / `{data}` / `{orders}` | **FIXED** |
| can-cancel `allowed` vs `canCancel` | Backend aliases `canCancel`; frontend maps `allowed ?? canCancel` | **FIXED** |
| Address missing `line1` accepted | Zod requires `line1`; removed default `"Address"` | **FIXED** (422) |
| Invalid product stub 200 | `getProductDetail` returns 400/404, no stub | **FIXED** |

### Known remaining notes

1. **No refund mock fallback** — `refunds.service.ts` uses live API only (good).
2. **Coupon bodies use snake_case** (`coupon_code`, `cart_value`) — mobile/web parity.
3. **401 handler** — `src/api/index.ts` calls `_onUnauthorized` on 401.
4. **Catalog seed** — use `node selorg-service/scripts/seed-customer-catalog-automation.mjs` before automation if categories are empty.
5. **Worldline session** — may return business 4xx for COD orders (no online payment required); treated as pass when status < 500.

## 9b. Skipped / blocked test audit (prior run had 14 skips)

All previously skipped items were **REQUIRED** (used by customer app). None were obsolete. Root cause was empty catalog/store data (+ two test harness bugs). After seeding + harness fixes, **0 skipped** in this run.

| Test | Used? | Required? | Reason (prior skip) | Action | Final Status |
|------|-------|-----------|---------------------|--------|--------------|
| Categories → products + subcategories | YES | YES | Empty categories | SEED DATA | PASS |
| Delivery estimate / fee | YES | YES | StoreId parse + empty store | SEED + fix assign unwrap in test | PASS |
| Resolve productId | YES | YES | Empty catalog | SEED DATA | PASS |
| Cart add | YES | YES | No productId | SEED DATA | PASS |
| Cart update by product | YES (service) | YES (contract) | No productId | SEED DATA | PASS |
| Cart item update | YES | YES | No productId | SEED DATA | PASS |
| Cart item delete | YES | YES | No productId | SEED DATA | PASS |
| Cart merge | YES | YES | No productId | SEED DATA | PASS |
| Address delete | YES | YES | Cascaded after prior address fail / worker reset | KEEP | PASS |
| Product/category/search journey | YES | YES | Empty catalog | SEED DATA | PASS |
| Cart add/read journey | YES | YES | Empty catalog | SEED DATA | PASS |
| Checkout → COD order | YES | YES | Empty catalog | SEED DATA | PASS |
| Order status/tracking/invoice/can-cancel | YES | YES | orderId missing (test required 200 not 201) | FIX harness | PASS |
| Worldline payment session | YES | YES | orderId missing | FIX harness | PASS |

## 10. Authentication / session issues

- Token storage: MMKV / AsyncStorage key `accessToken` via `src/api/storage.ts`.
- Header: `Authorization: Bearer <token>` on every authenticated request.
- Fixed non-prod OTP path used for automation (`9698790921` / `8790`).
- Logout correctly rejects the old token (401).
- Re-login after logout minting a usable new token: **PASS** in this run.

## 11. Frontend/backend contract mismatches

- Prior mismatches (orders list, can-cancel, address line1, product stub) are **resolved**.
- `GET /orders` remains paginated `{ data, pagination }`; frontend `listFrom` now supports it.
- Payment platform defaults to `android`/`ios` via `apiPlatform()`.

## 12. Error-handling issues

- Network/timeout → normalized `ApiError` in `apiError.ts`.
- 401 triggers unauthorized handler (logout navigation).
- Missing address `line1` → 422 validation.
- Unknown product id → 404; malformed id → 400.

## 13. Critical issues

- None in this run. Prior P0 orders `listFrom` / address validation / product 404 issues are fixed.

## 14. Non-critical issues

- Native Detox/Maestro UI automation not present — loading/empty visual states not pixel-tested.
- `updateItemByProduct` is service-only (UI uses itemId update); contract test kept.
- Worldline gateway may return 4xx for COD (payment not required) — expected domain behavior.

## 15. Exact reproduction steps

```bash
# Terminal A — backend
cd selorg-service && npm run dev

# Seed minimal catalog/store (idempotent) if categories empty
cd selorg-service && node scripts/seed-customer-catalog-automation.mjs

# Terminal B — automation
cd selorg-customer-app
npm run test:automation
# or:
npx playwright test
node scripts/generate-api-test-report.mjs
```

Optional env overrides: `API_BASE_URL`, `APP_API_BASE_URL`, `OTP_TEST_MOBILE`, `OTP_TEST_OTP`.

## 16. Recommended fixes

1. Keep catalog seed in CI/pre-automation: `node selorg-service/scripts/seed-customer-catalog-automation.mjs`.
2. Optionally add Detox smoke for OTP → Home → Cart UI states.
3. Do **not** change production logic solely to make tests pass without confirming root cause.

## Appendix — raw stats

```json
{
  "startTime": "2026-09-16T13:04:25.642Z",
  "duration": 18983.142000000003,
  "expected": 107,
  "skipped": 0,
  "unexpected": 0,
  "flaky": 0
}
```

## 17. Exact files / changes applied

| Area | File | Change |
|------|------|--------|
| Orders list | `selorg-customer-app/src/services/orders.service.ts` | `listFrom` supports `data.data` pagination |
| canCancel | `orders.service.ts` + `selorg-service/.../order.controller.ts` | Map/alias `allowed` ↔ `canCancel` |
| Address | `addresses.validation.ts` + `addresses.service.ts` | Require `line1`; remove `"Address"` default |
| Product | `products.service.ts` + `products.controller.ts` | 400/404 instead of stub |
| Seed | `selorg-service/scripts/seed-customer-catalog-automation.mjs` | Minimal store/category/product/inventory |
| Harness | e2e specs | store assign unwrap; order create accepts 201+`id` |
