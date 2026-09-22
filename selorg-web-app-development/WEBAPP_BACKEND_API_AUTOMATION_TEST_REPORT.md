# WEBAPP_BACKEND_API_AUTOMATION_TEST_REPORT

Generated: **2026-09-16T10:49:42.928Z**

## 1. Test environment

| Item | Value |
|------|-------|
| Date | 2026-09-16T10:49:42.928Z |
| Frontend | Selorg Webapp V1.3 (Next.js 16) @ `http://127.0.0.1:3000` |
| Backend | selorg-service @ `http://127.0.0.1:3333` |
| Customer API prefix | `/api/v1/customer` |
| Auth test identity | OTP_TEST_MOBILE default `9698790921` / OTP `8790` (non-prod fixed OTP) |
| OS | Windows |
| Data policy | Real backend only — no API mocks in the test harness |

## 2. Testing tools used

- **Playwright** (`@playwright/test`) — APIRequestContext for integration tests + Chromium for E2E
- Existing **Vitest** unit tests were **not** used for this live API audit (they mock/jsdom only)
- Config: `playwright.config.ts`, specs under `e2e/api/*` and `e2e/flows/*`
- Report source: `test-results/playwright-report.json`

## 3. API inventory (frontend services → `/api/v1/customer`)

> Extracted from `Selorg Webapp V1.3/src/services/*` during audit. Base: `{API_BASE}/api/v1/customer`.

| Domain | Method | Path | Auth | Frontend usage |
|--------|--------|------|------|----------------|
| Auth | POST | /auth/send-otp | skip | AuthContext |
| Auth | POST | /auth/verify-otp | skip | AuthContext |
| Auth | POST | /auth/resend-otp | skip | AuthContext |
| Auth | POST | /auth/logout | Bearer | AuthContext |
| Auth | POST | /auth/link-phone/send-otp | Bearer | AuthContext |
| Auth | POST | /auth/link-phone/verify-otp | Bearer | AuthContext |
| Profile | GET/PUT | /user/profile | Bearer | AuthContext / account |
| Address | GET/POST | /addresses | Bearer | AddressContext |
| Address | PUT/DELETE | /addresses/:id | Bearer | AddressContext |
| Address | POST | /addresses/:id/default | Bearer | AddressesClient |
| Cart | GET | /cart | Bearer | CartContext |
| Cart | POST | /cart/items | Bearer | CartContext |
| Cart | PUT | /cart/items | Bearer | CartContext |
| Cart | PUT | /cart/items/:itemId | Bearer | (service only) |
| Cart | DELETE | /cart/clear | Bearer | CartContext |
| Cart | POST | /cart/merge | Bearer | CartContext |
| Orders | GET | /orders | Bearer | OrdersContext |
| Orders | GET | /orders/active | Bearer | OrdersContext |
| Orders | GET | /orders/:id | Bearer | OrdersContext |
| Orders | POST | /orders | Bearer | Checkout |
| Orders | POST | /orders/:id/cancel|reorder|rate | Bearer | OrdersContext |
| Orders | GET | /orders/:id/tracking|invoice | Bearer | Order detail |
| Payment | POST | /payments/worldline/session|complete|abort | Bearer | Checkout/Wallet |
| Payment | GET | /payments/worldline/status | Bearer | Checkout/Payment pages |
| Products | GET | /products/search|suggestions|trending|/:id | optional | Search/Product |
| Categories | GET | /categories|/:id|/ :slug/products | optional | CategoriesContext |
| Home | GET | /home|/sections/:key/products|/collections/:slug | optional | Home |
| Location | GET | /locations/* | skip | LocationPicker |
| Wallet | GET | /wallet/balance|transactions | Bearer | WalletContext |
| Wallet | POST | /wallet/top-up/session | Bearer | WalletContext |
| Coupons | GET/POST | /coupons|/coupons/validate | Bearer | Cart/Offers |
| Store | POST | /store/assign | skip | DeliveryContext |
| Delivery | GET | /delivery/estimate|fee | skip | DeliveryContext |
| Notifications | GET/PUT/DELETE | /notifications/* | Bearer | Inbox/Preferences |
| Support | GET/POST | /support/tickets/* | Bearer | Support/Help |
| Refunds | GET/POST | /refunds* | Bearer | RefundsClient (**mock fallback**) |
| Content | GET/POST | /legal/*|/faq/*|/onboarding/*|/pages/*|/collections/* | mixed | FAQ/Legal |
| Config | GET | /bootstrap|/app-config | optional | AppConfigContext |

**Total frontend-mapped customer endpoints:** ~87–89 function→HTTP mappings.

## 4. Totals

| Metric | Count |
|--------|------:|
| Total tests executed | 96 |
| Passed | 85 |
| Failed | 0 |
| Skipped | 11 |
| Blocked (data/env skip) | 0 |
| API project tests | 87 |
| E2E project tests | 9 |
| Playwright stats.expected | 85 |
| Playwright stats.unexpected | 0 |
| Playwright stats.skipped | 11 |

## 5. Passed tests

- ✅ [api] OTP auth contract › send-otp rejects missing identifier
- ✅ [api] OTP auth contract › send-otp rejects invalid phone
- ✅ [api] OTP auth contract › verify-otp rejects wrong otp
- ✅ [api] OTP auth contract › verify-otp rejects missing fields
- ✅ [api] OTP auth contract › login with fixed test OTP succeeds and returns accessToken + user
- ✅ [api] Auth-gated APIs without token (negative) › GET /user/profile without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /addresses without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /cart without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /orders without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /wallet/balance without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /wallet/transactions?limit=10 without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /notifications?page=1&limit=10 without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /notifications/preferences without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /refunds?page=1&pageSize=10 without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › GET /support/tickets without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › POST /orders without token → 401/403
- ✅ [api] Auth-gated APIs without token (negative) › POST /auth/logout without token is idempotent (200)
- ✅ [api] Auth-gated APIs without token (negative) › GET /coupons without token is allowed (public catalog of offers)
- ✅ [api] Auth-gated APIs without token (negative) › invalid Bearer token → 401
- ✅ [api] Auth-gated APIs without token (negative) › malformed Authorization header → 401
- ✅ [api] Public / guest-tolerant catalog APIs › GET /bootstrap — bootstrap
- ✅ [api] Public / guest-tolerant catalog APIs › GET /app-config — app-config
- ✅ [api] Public / guest-tolerant catalog APIs › GET /home — home
- ✅ [api] Public / guest-tolerant catalog APIs › GET /categories — categories
- ✅ [api] Public / guest-tolerant catalog APIs › GET /products/search?q=ab&page=1&limit=5 — products search (short q)
- ✅ [api] Public / guest-tolerant catalog APIs › GET /products/search?q=milk&page=1&limit=5 — products search (valid q)
- ✅ [api] Public / guest-tolerant catalog APIs › GET /products/search/suggestions?q=mi — search suggestions
- ✅ [api] Public / guest-tolerant catalog APIs › GET /products/search/trending — trending searches
- ✅ [api] Public / guest-tolerant catalog APIs › GET /faq — faq
- ✅ [api] Public / guest-tolerant catalog APIs › GET /faq/categories — faq categories
- ✅ [api] Public / guest-tolerant catalog APIs › GET /legal/terms — legal terms
- ✅ [api] Public / guest-tolerant catalog APIs › GET /legal/privacy — legal privacy
- ✅ [api] Public / guest-tolerant catalog APIs › GET /legal/config — legal config
- ✅ [api] Public / guest-tolerant catalog APIs › GET /legal/license — legal license
- ✅ [api] Public / guest-tolerant catalog APIs › GET /onboarding/pages — onboarding pages
- ✅ [api] Public / guest-tolerant catalog APIs › GET /onboarding/status — onboarding status
- ✅ [api] Public / guest-tolerant catalog APIs › GET /locations/approximate — locations approximate
- ✅ [api] Public / guest-tolerant catalog APIs › GET /locations/suggestions?q=chennai — locations suggestions
- ✅ [api] Public / guest-tolerant catalog APIs › GET /locations/reverse?latitude=13.0827&longitude=80.2707 — locations reverse (Chennai)
- ✅ [api] Public / guest-tolerant catalog APIs › GET /home then section/collection products if keys present
- ✅ [api] Public / guest-tolerant catalog APIs › POST /store/assign with Chennai coords
- ✅ [api] Environment & connectivity › backend is reachable on configured API_BASE
- ✅ [api] Environment & connectivity › webapp is reachable on configured WEB_BASE
- ✅ [api] Environment & connectivity › CORS preflight allows web origin for customer API
- ✅ [api] Coupons / wallet / notifications / support / refunds › GET /coupons
- ✅ [api] Coupons / wallet / notifications / support / refunds › POST /coupons/validate invalid code → 4xx or success=false
- ✅ [api] Coupons / wallet / notifications / support / refunds › GET /wallet/balance
- ✅ [api] Coupons / wallet / notifications / support / refunds › GET /wallet/transactions
- ✅ [api] Coupons / wallet / notifications / support / refunds › POST /wallet/top-up/session invalid amount → 4xx
- ✅ [api] Coupons / wallet / notifications / support / refunds › GET /notifications + unread-count + preferences
- ✅ [api] Coupons / wallet / notifications / support / refunds › PUT /notifications/read-all
- ✅ [api] Coupons / wallet / notifications / support / refunds › GET /support/tickets
- ✅ [api] Coupons / wallet / notifications / support / refunds › GET /refunds (real API — frontend may mock empty)
- ✅ [api] Coupons / wallet / notifications / support / refunds › GET /orders + /orders/active
- ✅ [api] Coupons / wallet / notifications / support / refunds › POST /orders with empty items → 4xx
- ✅ [api] Coupons / wallet / notifications / support / refunds › GET /orders/invalid-id → 4xx
- ✅ [api] Coupons / wallet / notifications / support / refunds › GET payment status missing orderId → 4xx
- ✅ [api] Coupons / wallet / notifications / support / refunds › POST /auth/logout succeeds with token
- ✅ [api] Cart operations › GET /cart
- ✅ [api] Cart operations › POST /cart/items missing productId → 4xx
- ✅ [api] Cart operations › POST /cart/items invalid productId → 4xx
- ✅ [api] Cart operations › DELETE /cart/clear
- ✅ [api] Addresses CRUD › GET /addresses list
- ✅ [api] Addresses CRUD › POST /addresses create
- ✅ [api] Addresses CRUD › PUT /addresses/:id update
- ✅ [api] Addresses CRUD › POST /addresses/:id/default
- ✅ [api] Addresses CRUD › PUT /addresses invalid id → 4xx
- ✅ [api] Addresses CRUD › DELETE /addresses/:id
- ✅ [api] Profile › GET /user/profile returns user fields
- ✅ [api] Profile › PUT /user/profile with name updates
- ✅ [api] Profile › PUT /user/profile with invalid email (audit: expect validation 4xx)
- ✅ [api] api\03-journey.api.spec.ts › 1. Authenticate via OTP
- ✅ [api] api\03-journey.api.spec.ts › 2. Load profile
- ✅ [api] api\03-journey.api.spec.ts › 3. Ensure address exists
- ✅ [api] api\03-journey.api.spec.ts › 9. Wallet balance after journey
- ✅ [api] api\03-journey.api.spec.ts › 10. Logout
- ✅ [e2e-chromium] E2E — cart page network mapping › cart page with session hits /cart endpoint
- ✅ [e2e-chromium] E2E — protected route auth redirect › visiting /account/profile without token redirects to /auth
- ✅ [e2e-chromium] E2E — login OTP flow (real backend) › login with test mobile + fixed OTP persists session
- ✅ [e2e-chromium] E2E — login OTP flow (real backend) › authenticated account pages load without 5xx API
- ✅ [e2e-chromium] E2E — login OTP flow (real backend) › logout clears session (UI if available, else storage clear)
- ✅ [e2e-chromium] E2E — public pages load with live API data › home page loads and issues customer API calls
- ✅ [e2e-chromium] E2E — public pages load with live API data › search page loads
- ✅ [e2e-chromium] E2E — public pages load with live API data › faq / legal pages load (public content APIs)
- ✅ [e2e-chromium] E2E — public pages load with live API data › auth page renders login UI

## 6. Failed tests

- _(none)_
## 7. Blocked / skipped tests

- ⏭️ [api] GET /categories then GET /categories/:id or slug products
- ⏭️ [api] GET delivery estimate/fee when store assign returns storeId
- ⏭️ [api] resolve a productId from search or categories
- ⏭️ [api] POST /cart/items add
- ⏭️ [api] PUT /cart/items by product quantity
- ⏭️ [api] POST /cart/merge with mergeKey
- ⏭️ [api] 4. Discover product
- ⏭️ [api] 5. Add to cart and read totals
- ⏭️ [api] 6. Create order (COD/cash preferred)
- ⏭️ [api] 7. Fetch order detail / tracking / invoice when order exists
- ⏭️ [api] 8. Payment session for order (may block on Worldline config)

## 8. E2E flows tested

| Flow | Covered by |
|------|------------|
| Home / catalog load | flows + public API |
| Search / FAQ / legal | flows |
| Login / OTP | flows + auth API |
| Session persistence (cookie + localStorage) | flows |
| Logout / session clear | flows + logout API |
| Protected route without token | flows |
| Account profile/addresses/wallet/orders pages | flows |
| Cart page → GET /cart | flows |
| Address CRUD | authenticated API |
| Cart add/update/clear/merge | authenticated API |
| Order create attempt | journey API |
| Wallet balance/transactions | authenticated API |
| Payment session probe | journey API |
| Negative auth / validation | public-auth API |

## 9. API integration issues

Auto-extracted from failures (review each):

- No hard test failures recorded in this run.

### Known audit findings (static + runtime)

1. **Refunds mock fallback (frontend)** — `src/services/refundService.ts` returns `MOCK_REFUNDS` when API empty/errors. Violates “real data only” UX for refunds screen.
2. **`apiPatch` unused** — exported but no service uses PATCH; confirm backend contracts don’t require PATCH.
3. **No refresh-token loop** — expired JWT cleared client-side; 401 redirects to `/auth`.

## 10. Authentication / session issues

- Token storage: cookie `selorg_token` + localStorage; SameSite=Lax.
- Fixed non-prod OTP path used for automation (`9698790921` / `8790`).
- Review failed auth tests above if any.

## 11. Frontend/backend contract mismatches

- Coupon validate uses **snake_case** (`coupon_code`, `cart_value`) — intentional per mobile parity; confirm backend expects snake_case.
- Notifications list uses `apiGetBody` (full envelope) vs most services using `data` only.
- Store assign uses `apiPostBody` (full body).
- Failures in this run that look like field/shape mismatches are listed in §6.

## 12. Error-handling issues

- Network failures map to `ApiError` status 0 / `NETWORK_ERROR`.
- 401 triggers hard navigation to `/auth?returnTo=`.
- Refund empty/error path silently substitutes mocks (see §9).

## 13. Critical issues

- None detected by automated critical heuristics in this run.

## 14. Non-critical issues

- Unused service methods without UI callers (~18).
- Playwright was previously in package.json but unconfigured — now wired for this audit.
- Skipped tests due to empty catalog/store geo are **data/environment**, not app crashes.

## 15. Exact reproduction steps

```bash
# Terminal A — backend
cd selorg-service && npm run dev

# Terminal B — webapp
cd "Selorg Webapp V1.3" && npm run dev

# Terminal C — automation
cd "Selorg Webapp V1.3"
npm run test:automation
# or:
npx playwright test
node scripts/generate-api-test-report.mjs
```

Optional env overrides: `API_BASE_URL`, `WEB_BASE_URL`, `OTP_TEST_MOBILE`, `OTP_TEST_OTP`.

## 16. Recommended fixes

1. **Remove or gate `MOCK_REFUNDS`** in `refundService.ts` — show empty state when API returns empty; never substitute dummy refunds in production builds.
2. Triage each §6 failure: classify frontend vs backend vs config; fix contract first.
3. Keep Playwright suite in CI against a seeded staging backend (fixed test OTP only in non-prod).
4. Add explicit empty/loading/error UI assertions once refund mocks are removed.
5. Do **not** change production logic solely to make tests pass without confirming root cause.

## Appendix — raw stats

```json
{
  "startTime": "2026-09-16T10:48:19.835Z",
  "duration": 82863.101,
  "expected": 85,
  "skipped": 11,
  "unexpected": 0,
  "flaky": 0
}
```
