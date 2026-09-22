# Backend Architecture & API Postman Audit

**Generated:** 2026-09-11T07:32:06.155Z
**Repository:** `selorg-service` (Selorg V1.3)
**Primary truth:** source routes in `src/app.ts` + `src/modules/**/**.routes.ts`
**Live base URL tested:** `http://127.0.0.1:3333`
**Postman MCP:** unavailable this session — verification performed via equivalent HTTP (`fetch`/Invoke-WebRequest) against the running server.

## 1. Executive Summary

The modular Express/TypeScript rewrite is structurally sound (app/server split, domain modules, Zod validation on core flows, response envelope, security middleware). **It is not fully production-ready.** Live verification found a **server boot blocker** (undefined picker route handlers — safely fixed), **split-brain admin rider dispatch** reading a legacy `orders` collection while the live spine uses `customer_orders`, multiple **hardcoded/stub admin endpoints**, missing customer **product/banner list** routes, and **JWT/OTP isolation gaps**. The customer→HHD→rider order spine passes service-level e2e (`e2e-order-spine.ts`: TC1–TC5 PASS).

| Metric | Value |
|--------|------:|
| Architecture status | **NEEDS IMPROVEMENT** (critical issues present) |
| Architecture score | **64/100** |
| Endpoints discovered (mounted) | **1632** |
| Unique METHOD+PATH | **1601** |
| HTTP tests executed (cases) | **95** |
| Unique endpoints exercised | **56** |
| PASS / FAIL / PARTIAL / BLOCKED / NOT_TESTED (test cases) | **66 / 5 / 18 / 6 / 0** |
| Inventory rows still NOT_TESTED | **1549** |

## 2. Repository / Environment Tested

| Item | Value |
|------|-------|
| Path | `C:\Users\lmbac\Desktop\Selorg V1.3\selorg-service` |
| Branch | `dhanasekaran/dev` (at audit start) |
| Runtime | Node v20.20.2, `npm run dev` (ts-node-dev) |
| Port | 3333 |
| NODE_ENV | development (from `.env`) |
| Database | MongoDB Atlas DB `selorg_test_02` (host masked) |
| Redis | Optional; in-memory fallback observed |
| Inventory artifact | `docs/endpoint-inventory.tsv` |
| Live results artifact | `docs/live-api-audit-results.json` |

Safe fix applied during audit (required to boot server): removed broken duplicate picker route registrations referencing undefined handlers `depositCash`, `startBulkDelivery`, `markBulkStopDelivered`, `markBulkStopFailed` in `src/modules/picker/picker.routes.ts`. Canonical validated routes already existed.

## 3. Architecture Assessment

### Structure
- `src/server.ts` — env validation, DB connect, listen, realtime init.
- `src/app.ts` — Express factory, middleware, mounts, Swagger, error handlers.
- `src/modules/*` — domain modules (customer, picker/rider-app, hhd, rider-admin, admin, warehouse, …).
- `src/middleware`, `src/services`, `src/database`, `src/utils`, `src/events`, `src/realtime` — shared cross-cutting.

### Module separation (verified)
| Actor | Mount | Auth | Evidence |
|-------|-------|------|----------|
| Customer | `/api/v1/customer/*` | `authenticateCustomer` | JWT issued via `/customer/auth/verify-otp`; profile/orders work |
| Rider mobile | `/api/v1/picker/*` | `authenticatePicker` (`aud: picker`) | Admin JWT → picker profile returns **401** |
| HHD | `/api/v1/hhd/*` | `protect` (HHD JWT) | Unauthed `/hhd/orders` → **401** |
| Admin dashboard rider ops | `/api/v1/rider/*` | `authenticateAdmin` | Unauthed dispatch → **401**; with admin JWT → **200** |
| Admin | `/api/v1/admin/*` | `authenticateAdmin` + RBAC | Login + `/users/me` **200** |
| Customer delivery ETA | `/api/v1/customer/delivery/*` | public/partial | Separate from rider delivery |

**Verdict:** Responsibilities are mostly separated by mount prefix. Rider **mobile** intentionally reuses picker infrastructure (`PickerUser`, picker JWT). Admin `/rider` is dashboard dispatch/HR — naming is confusing but not returning picker DTOs on `/rider`. The critical defect is **data-source split**, not payload mixing.

### Strengths
- Consistent API envelope via `apiEnvelopeMiddleware` / `ResponseFormatter`.
- Security stack: Helmet, mongo-sanitize, HPP, xss-clean, CORS, rate limit on `/api/v1`.
- Zod `validate` middleware on auth, orders, picker core routes.
- Real order spine in `fulfillment.service.ts` + picker order service; e2e spine PASS.
- Health endpoints (`/health`, `/health/db`, `/health/ready`) work against live Mongo.

### Weaknesses
- Dual order collections (`customer_orders` vs legacy `orders`) for dispatch.
- Stub/hardcoded admin system/integration endpoints.
- HHD JWT shares `JWT_SECRET` without audience (crossover risk).
- In-memory token blocklist / login lockout (multi-instance unsafe).
- Missing eslint config; typecheck fails; no Jest tests.
- Boot was broken until undefined route handlers removed.

## 4. Architecture Score

| Dimension | Score | Notes |
|-----------|------:|-------|
| Folder/module architecture | 78 | Clear modules; picker/rider naming debt |
| API design | 70 | Versioned `/api/v1`; gaps in catalog list routes; dual mounts |
| Authentication/authorization | 58 | Audience checks partial; HHD/admin secret overlap |
| Validation | 74 | Strong on picker/auth/orders; weaker on many admin/rider routes |
| Error handling | 78 | Global handler good; malformed JSON → 500 |
| Database architecture | 62 | Indexes on spine; split collections; limited transactions |
| Integration architecture | 65 | OTP/SMS chain real; FCM not dispatched; stubs elsewhere |
| Security | 55 | Middleware present; stubs, Math.random OTP, CORS open in non-prod |
| Maintainability | 66 | Large surface (1600+ routes); stubs/TODOs; duplicate mounts |
| Production readiness | 58 | Spine works; dispatch/stubs/boot/JWT issues block trust |
| **Overall** | **64** | NEEDS IMPROVEMENT |

## 5. Module-by-Module Assessment

| Module | Endpoints | Assessment | Evidence |
|--------|----------:|------------|----------|
| health | 4 | PASS | Live 200 healthy/db/ready |
| auth (customer) | 6 | PASS (test OTP in non-prod) | sessionId+OTP → JWT; empty body 422 |
| user/cart/orders/addresses | ~32 | Core PASS; create needs items[] | Live list/detail/cart add |
| products | 14 | PARTIAL/FAIL list | GET `/products` 404; search works |
| banners | 6 | FAIL customer list | GET `/banners` 404; only `/:id` |
| home/bootstrap/faq/legal | many | PASS public reads | 200 responses |
| wallet | 5 | PARTIAL root path | `/wallet` 404; `/wallet/balance` 200 |
| picker (rider app) | 184 | Auth gate PASS; OTP BLOCKED | send-otp 200; verify needs SMS; samples stub |
| hhd | 42 | Auth gate PASS; OTP BLOCKED | send-otp 200; verify needs SMS/user |
| rider (admin) | 120 | Auth PASS; dispatch FAIL correctness | Unassigned returns legacy ORD-20260331 |
| admin | 294 | Mixed | Login/me/orders PASS; system instances FAIL stub |
| darkstore/warehouse/vendor/finance | 600+ | Mostly NOT_TESTED | Auth required; spot checks 404 path mismatches |
| diag | 4 | PASS non-prod | order-flow/hubs 200 |
| payments | 13+ | NOT_TESTED / BLOCKED | Gateway credentials / redirects |

## 6. Complete Endpoint Inventory

Source scan produced **1632** mounted endpoints (**1601** unique METHOD+PATH). Full machine-readable copy: `docs/endpoint-inventory.tsv`.

Status column below reflects **live verification where performed**; otherwise `NOT_TESTED`. Do not treat `NOT_TESTED` as PASS.

| # | Method | Endpoint | Module | Auth | Role | Controller | Service | Status | Notes |
|---|--------|----------|--------|------|------|------------|---------|--------|-------|
| 1 | POST | `/api/payment/callback` | payments | yes | customer-jwt | paymentCallback | payment-api.service | NOT_TESTED | - |
| 2 | POST | `/api/payment/initiate` | payments | yes | customer-jwt | initiateStandalonePayment | payment-api.service | NOT_TESTED | - |
| 3 | GET | `/api/payment/status/:orderId` | payments | yes | customer-jwt | getPaymentStatus | payment-api.service | NOT_TESTED | - |
| 4 | POST | `/api/payment/transaction-status` | payments | no | - | getTransactionStatusPostTxn | payment-api.service | NOT_TESTED | - |
| 5 | GET | `/api/v1/admin/analytics/categories` | admin | yes | admin|super_admin | controller.getCategoryAnalytics | analytics.service | NOT_TESTED | analytics.routes.ts |
| 6 | POST | `/api/v1/admin/analytics/custom-report` | admin | yes | admin|super_admin | controller.createCustomReport | analytics.service | NOT_TESTED | analytics.routes.ts |
| 7 | GET | `/api/v1/admin/analytics/customers` | admin | yes | admin|super_admin | controller.getCustomerMetrics | analytics.service | NOT_TESTED | analytics.routes.ts |
| 8 | GET | `/api/v1/admin/analytics/export` | admin | yes | admin|super_admin | controller.exportReport | analytics.service | NOT_TESTED | analytics.routes.ts |
| 9 | GET | `/api/v1/admin/analytics/financial-summary` | admin | yes | admin|super_admin | controller.getFinancialSummary | analytics.service | NOT_TESTED | analytics.routes.ts |
| 10 | GET | `/api/v1/admin/analytics/funnel` | admin | yes | admin|super_admin | controller.getConversionFunnel | analytics.service | NOT_TESTED | analytics.routes.ts |
| 11 | GET | `/api/v1/admin/analytics/growth` | admin | yes | admin|super_admin | controller.getGrowthTrends | analytics.service | NOT_TESTED | analytics.routes.ts |
| 12 | GET | `/api/v1/admin/analytics/inventory-health` | admin | yes | admin|super_admin | controller.getInventoryHealth | analytics.service | NOT_TESTED | analytics.routes.ts |
| 13 | GET | `/api/v1/admin/analytics/operational` | admin | yes | admin|super_admin | controller.getOperationalMetrics | analytics.service | NOT_TESTED | analytics.routes.ts |
| 14 | GET | `/api/v1/admin/analytics/orders-by-hour` | admin | yes | admin|super_admin | controller.getOrdersByHour | analytics.service | NOT_TESTED | analytics.routes.ts |
| 15 | GET | `/api/v1/admin/analytics/payment-methods` | admin | yes | admin|super_admin | controller.getPaymentMethods | analytics.service | NOT_TESTED | analytics.routes.ts |
| 16 | GET | `/api/v1/admin/analytics/peak-hours` | admin | yes | admin|super_admin | controller.getPeakHours | analytics.service | NOT_TESTED | analytics.routes.ts |
| 17 | GET | `/api/v1/admin/analytics/picker-drilldown/:pickerId` | admin | yes | admin|super_admin | controller.getPickerDrilldown | analytics.service | NOT_TESTED | analytics.routes.ts |
| 18 | GET | `/api/v1/admin/analytics/pickers` | admin | yes | admin|super_admin | controller.getPickerAnalytics | analytics.service | NOT_TESTED | analytics.routes.ts |
| 19 | GET | `/api/v1/admin/analytics/products` | admin | yes | admin|super_admin | controller.getProductPerformance | analytics.service | NOT_TESTED | analytics.routes.ts |
| 20 | GET | `/api/v1/admin/analytics/realtime` | admin | yes | admin|super_admin | controller.getRealtimeMetrics | analytics.service | NOT_TESTED | analytics.routes.ts |
| 21 | GET | `/api/v1/admin/analytics/regional` | admin | yes | admin|super_admin | controller.getRegionalPerformance | analytics.service | NOT_TESTED | analytics.routes.ts |
| 22 | GET | `/api/v1/admin/analytics/revenue` | admin | yes | admin|super_admin | controller.getRevenueBreakdown | analytics.service | PASS | analytics.routes.ts |
| 23 | GET | `/api/v1/admin/analytics/rider-performance` | admin | yes | admin|super_admin | controller.getRiderPerformance | analytics.service | NOT_TESTED | analytics.routes.ts |
| 24 | GET | `/api/v1/admin/analytics/timeseries` | admin | yes | admin|super_admin | controller.getTimeSeriesData | analytics.service | NOT_TESTED | analytics.routes.ts |
| 25 | GET | `/api/v1/admin/app-settings` | admin | partial | admin|super_admin | PERMISSIONS.ADMIN_CONFIG_READ | app-settings.service | NOT_TESTED | app-settings.routes.ts |
| 26 | PUT | `/api/v1/admin/app-settings` | admin | partial | admin|super_admin | PERMISSIONS.ADMIN_CONFIG_WRITE | app-settings.service | NOT_TESTED | app-settings.routes.ts |
| 27 | GET | `/api/v1/admin/applications` | admin | yes | admin|super_admin | inline-handler | - | PARTIAL | MOCK/stub hardcoded success |
| 28 | PATCH | `/api/v1/admin/applications/:id` | admin | yes | admin|super_admin | inline-handler | - | NOT_TESTED | MOCK/stub hardcoded success |
| 29 | PUT | `/api/v1/admin/applications/:id` | admin | yes | admin|super_admin | inline-handler | - | NOT_TESTED | MOCK/stub hardcoded success |
| 30 | GET | `/api/v1/admin/applications/:id/health` | admin | yes | admin|super_admin | inline-handler | - | PARTIAL | MOCK/stub hardcoded success |
| 31 | POST | `/api/v1/admin/applications/:id/test` | admin | yes | admin|super_admin | inline-handler | - | NOT_TESTED | MOCK/stub hardcoded success |
| 32 | POST | `/api/v1/admin/applications/:id/test-connection` | admin | yes | admin|super_admin | inline-handler | - | NOT_TESTED | MOCK/stub hardcoded success |
| 33 | POST | `/api/v1/admin/auth/login` | admin | no | - | authController.login | admin.service | PARTIAL | admin login/logout — no JWT |
| 34 | POST | `/api/v1/admin/auth/logout` | admin | no | - | authController.logout | admin.service | NOT_TESTED | admin login/logout — no JWT |
| 35 | POST | `/api/v1/admin/cache/clear` | admin | partial | admin|super_admin;permission-gated | inline-handler | - | NOT_TESTED | protectedRouter |
| 36 | GET | `/api/v1/admin/cache/stats` | admin | partial | admin|super_admin;permission-gated | inline-handler | - | NOT_TESTED | protectedRouter |
| 37 | GET | `/api/v1/admin/cities` | admin | yes | admin|super_admin | masterDataController.listCities | master-data.service | NOT_TESTED | master-data.routes.ts |
| 38 | POST | `/api/v1/admin/cities` | admin | yes | admin|super_admin | masterDataController.createCity | master-data.service | NOT_TESTED | master-data.routes.ts |
| 39 | DELETE | `/api/v1/admin/cities/:id` | admin | yes | admin|super_admin | masterDataController.deleteCity | master-data.service | NOT_TESTED | master-data.routes.ts |
| 40 | GET | `/api/v1/admin/cities/:id` | admin | yes | admin|super_admin | masterDataController.getCity | master-data.service | NOT_TESTED | master-data.routes.ts |
| 41 | PUT | `/api/v1/admin/cities/:id` | admin | yes | admin|super_admin | masterDataController.updateCity | master-data.service | NOT_TESTED | master-data.routes.ts |
| 42 | GET | `/api/v1/admin/compliance/audits` | admin | yes | admin|super_admin | controller.listAudits | compliance.service | NOT_TESTED | compliance.routes.ts |
| 43 | POST | `/api/v1/admin/compliance/audits` | admin | yes | admin|super_admin | controller.createAudit | compliance.service | NOT_TESTED | compliance.routes.ts |
| 44 | PATCH | `/api/v1/admin/compliance/audits/:auditId/findings/:findingId` | admin | yes | admin|super_admin | controller.updateFindingStatus | compliance.service | NOT_TESTED | compliance.routes.ts |
| 45 | GET | `/api/v1/admin/compliance/certifications` | admin | yes | admin|super_admin | controller.listCertifications | compliance.service | NOT_TESTED | compliance.routes.ts |
| 46 | GET | `/api/v1/admin/compliance/documents` | admin | yes | admin|super_admin | controller.listDocuments | compliance.service | NOT_TESTED | compliance.routes.ts |
| 47 | POST | `/api/v1/admin/compliance/documents` | admin | yes | admin|super_admin | controller.uploadDocument | compliance.service | NOT_TESTED | compliance.routes.ts |
| 48 | DELETE | `/api/v1/admin/compliance/documents/:id` | admin | yes | admin|super_admin | controller.deleteDocument | compliance.service | NOT_TESTED | compliance.routes.ts |
| 49 | PATCH | `/api/v1/admin/compliance/documents/:id` | admin | yes | admin|super_admin | controller.updateDocument | compliance.service | NOT_TESTED | compliance.routes.ts |
| 50 | GET | `/api/v1/admin/compliance/metrics` | admin | yes | admin|super_admin | controller.getMetrics | compliance.service | NOT_TESTED | compliance.routes.ts |
| 51 | GET | `/api/v1/admin/compliance/policies` | admin | yes | admin|super_admin | controller.listPolicies | compliance.service | NOT_TESTED | compliance.routes.ts |
| 52 | POST | `/api/v1/admin/compliance/policies/:id/acknowledge` | admin | yes | admin|super_admin | controller.acknowledgePolicy | compliance.service | NOT_TESTED | compliance.routes.ts |
| 53 | POST | `/api/v1/admin/compliance/reports/generate` | admin | yes | admin|super_admin | controller.generateReport | compliance.service | NOT_TESTED | compliance.routes.ts |
| 54 | GET | `/api/v1/admin/compliance/violations` | admin | yes | admin|super_admin | controller.listViolations | compliance.service | NOT_TESTED | compliance.routes.ts |
| 55 | GET | `/api/v1/admin/customers` | admin | yes | admin|super_admin | customersCtrl.listCustomers | admin.service | NOT_TESTED | protectedRouter |
| 56 | POST | `/api/v1/admin/customers` | admin | yes | admin|super_admin | customersCtrl.createCustomer | admin.service | NOT_TESTED | protectedRouter |
| 57 | GET | `/api/v1/admin/customers/:id` | admin | yes | admin|super_admin | customersCtrl.getCustomerById | admin.service | NOT_TESTED | protectedRouter |
| 58 | PATCH | `/api/v1/admin/customers/:id` | admin | yes | admin|super_admin | customersCtrl.updateCustomer | admin.service | NOT_TESTED | protectedRouter |
| 59 | GET | `/api/v1/admin/customers/:id/addresses` | admin | yes | admin|super_admin | customersCtrl.getCustomerAddresses | admin.service | NOT_TESTED | protectedRouter |
| 60 | GET | `/api/v1/admin/customers/:id/orders` | admin | yes | admin|super_admin | customersCtrl.getCustomerOrders | admin.service | NOT_TESTED | protectedRouter |
| 61 | GET | `/api/v1/admin/customers/:id/password-info` | admin | yes | admin|super_admin | customersCtrl.getCustomerPasswordInfo | admin.service | NOT_TESTED | protectedRouter |
| 62 | GET | `/api/v1/admin/customers/:id/payment-methods` | admin | yes | admin|super_admin | customersCtrl.getCustomerPaymentMethods | admin.service | NOT_TESTED | protectedRouter |
| 63 | GET | `/api/v1/admin/customers/:id/refunds` | admin | yes | admin|super_admin | customersCtrl.getCustomerRefunds | admin.service | NOT_TESTED | protectedRouter |
| 64 | PUT | `/api/v1/admin/customers/:id/reset-password` | admin | yes | admin|super_admin | customersCtrl.resetCustomerPassword | admin.service | NOT_TESTED | protectedRouter |
| 65 | GET | `/api/v1/admin/customers/:id/risk` | admin | yes | admin|super_admin | customersCtrl.getCustomerRisk | admin.service | NOT_TESTED | protectedRouter |
| 66 | PUT | `/api/v1/admin/customers/:id/set-password` | admin | yes | admin|super_admin | customersCtrl.setCustomerPassword | admin.service | NOT_TESTED | protectedRouter |
| 67 | GET | `/api/v1/admin/customers/:id/tickets` | admin | yes | admin|super_admin | customersCtrl.getCustomerTickets | admin.service | NOT_TESTED | protectedRouter |
| 68 | GET | `/api/v1/admin/customers/:id/wallet` | admin | yes | admin|super_admin | customersCtrl.getCustomerWallet | admin.service | NOT_TESTED | protectedRouter |
| 69 | POST | `/api/v1/admin/customers/:id/wallet/credit` | admin | yes | admin|super_admin | customersCtrl.creditCustomerWallet | admin.service | NOT_TESTED | protectedRouter |
| 70 | GET | `/api/v1/admin/customers/stats` | admin | yes | admin|super_admin | customersCtrl.getCustomerStats | admin.service | NOT_TESTED | protectedRouter |
| 71 | GET | `/api/v1/admin/finance/accounting/accounts` | finance | yes | admin-jwt | ctrl.getAccounts | finance.service | NOT_TESTED | - |
| 72 | POST | `/api/v1/admin/finance/accounting/journal` | finance | yes | admin-jwt | ctrl.createJournalEntry | finance.service | NOT_TESTED | - |
| 73 | GET | `/api/v1/admin/finance/accounting/journal/:id` | finance | yes | admin-jwt | ctrl.getJournalDetails | finance.service | NOT_TESTED | - |
| 74 | GET | `/api/v1/admin/finance/accounting/ledger` | finance | yes | admin-jwt | ctrl.getLedgerEntries | finance.service | NOT_TESTED | - |
| 75 | GET | `/api/v1/admin/finance/accounting/summary` | finance | yes | admin-jwt | ctrl.getAccountingSummary | finance.service | NOT_TESTED | - |
| 76 | POST | `/api/v1/admin/finance/accounting/sync` | finance | yes | admin-jwt | ctrl.syncLedger | finance.service | NOT_TESTED | - |
| 77 | GET | `/api/v1/admin/finance/alerts` | finance | yes | admin-jwt | ctrl.getAlerts | finance.service | NOT_TESTED | - |
| 78 | GET | `/api/v1/admin/finance/alerts/:id` | finance | yes | admin-jwt | ctrl.getAlertDetails | finance.service | NOT_TESTED | - |
| 79 | POST | `/api/v1/admin/finance/alerts/:id/action` | finance | yes | admin-jwt | ctrl.performAlertAction | finance.service | NOT_TESTED | - |
| 80 | POST | `/api/v1/admin/finance/alerts/clear-resolved` | finance | yes | admin-jwt | ctrl.clearResolvedAlerts | finance.service | NOT_TESTED | - |
| 81 | DELETE | `/api/v1/admin/finance/alerts/resolved` | finance | yes | admin-jwt | ctrl.clearResolvedAlerts | finance.service | NOT_TESTED | - |
| 82 | POST | `/api/v1/admin/finance/alerts/resolved/clear` | finance | yes | admin-jwt | ctrl.clearResolvedAlerts | finance.service | NOT_TESTED | - |
| 83 | GET | `/api/v1/admin/finance/analytics/cash-flow` | finance | yes | admin-jwt | ctrl.getCashFlow | finance.service | NOT_TESTED | - |
| 84 | GET | `/api/v1/admin/finance/analytics/expense-breakdown` | finance | yes | admin-jwt | ctrl.getExpenseBreakdown | finance.service | NOT_TESTED | - |
| 85 | POST | `/api/v1/admin/finance/analytics/export` | finance | yes | admin-jwt | ctrl.exportAnalyticsReport | finance.service | NOT_TESTED | - |
| 86 | GET | `/api/v1/admin/finance/analytics/revenue-growth` | finance | yes | admin-jwt | ctrl.getRevenueGrowth | finance.service | NOT_TESTED | - |
| 87 | GET | `/api/v1/admin/finance/approvals` | finance | yes | admin-jwt | ctrl.getApprovalTasks | finance.service | NOT_TESTED | - |
| 88 | GET | `/api/v1/admin/finance/approvals/:id` | finance | yes | admin-jwt | ctrl.getTaskDetails | finance.service | NOT_TESTED | - |
| 89 | POST | `/api/v1/admin/finance/approvals/:id/decision` | finance | yes | admin-jwt | ctrl.submitTaskDecision | finance.service | NOT_TESTED | - |
| 90 | GET | `/api/v1/admin/finance/approvals/summary` | finance | yes | admin-jwt | ctrl.getApprovalSummary | finance.service | NOT_TESTED | - |
| 91 | GET | `/api/v1/admin/finance/approvals/tasks` | finance | yes | admin-jwt | ctrl.getApprovalTasks | finance.service | NOT_TESTED | - |
| 92 | GET | `/api/v1/admin/finance/approvals/tasks/:id` | finance | yes | admin-jwt | ctrl.getTaskDetails | finance.service | NOT_TESTED | - |
| 93 | POST | `/api/v1/admin/finance/approvals/tasks/:id/decision` | finance | yes | admin-jwt | ctrl.submitTaskDecision | finance.service | NOT_TESTED | - |
| 94 | GET | `/api/v1/admin/finance/config/commission-slabs` | finance | yes | admin-jwt | ctrl.getCommissionSlabs | finance.service | NOT_TESTED | - |
| 95 | POST | `/api/v1/admin/finance/config/commission-slabs` | finance | yes | admin-jwt | ctrl.createCommissionSlab | finance.service | NOT_TESTED | - |
| 96 | PUT | `/api/v1/admin/finance/config/commission-slabs/:slabId` | finance | yes | admin-jwt | ctrl.updateCommissionSlab | finance.service | NOT_TESTED | - |
| 97 | GET | `/api/v1/admin/finance/config/financial-limits` | finance | yes | admin-jwt | ctrl.getFinancialLimits | finance.service | NOT_TESTED | - |
| 98 | PUT | `/api/v1/admin/finance/config/financial-limits/:limitId` | finance | yes | admin-jwt | ctrl.updateFinancialLimit | finance.service | NOT_TESTED | - |
| 99 | GET | `/api/v1/admin/finance/config/financial-year` | finance | yes | admin-jwt | ctrl.getFinancialYear | finance.service | NOT_TESTED | - |
| 100 | PUT | `/api/v1/admin/finance/config/financial-year` | finance | yes | admin-jwt | ctrl.updateFinancialYear | finance.service | NOT_TESTED | - |
| 101 | GET | `/api/v1/admin/finance/config/invoice-settings` | finance | yes | admin-jwt | ctrl.getInvoiceSettings | finance.service | NOT_TESTED | - |
| 102 | PUT | `/api/v1/admin/finance/config/invoice-settings` | finance | yes | admin-jwt | ctrl.updateInvoiceSettings | finance.service | NOT_TESTED | - |
| 103 | GET | `/api/v1/admin/finance/config/payment-terms` | finance | yes | admin-jwt | ctrl.getPaymentTerms | finance.service | NOT_TESTED | - |
| 104 | PUT | `/api/v1/admin/finance/config/payment-terms/:termId` | finance | yes | admin-jwt | ctrl.updatePaymentTerm | finance.service | NOT_TESTED | - |
| 105 | GET | `/api/v1/admin/finance/config/payout-schedules` | finance | yes | admin-jwt | ctrl.getPayoutSchedules | finance.service | NOT_TESTED | - |
| 106 | POST | `/api/v1/admin/finance/config/payout-schedules` | finance | yes | admin-jwt | ctrl.createPayoutSchedule | finance.service | NOT_TESTED | - |
| 107 | PUT | `/api/v1/admin/finance/config/payout-schedules/:scheduleId` | finance | yes | admin-jwt | ctrl.updatePayoutSchedule | finance.service | NOT_TESTED | - |
| 108 | GET | `/api/v1/admin/finance/config/reconciliation-rules` | finance | yes | admin-jwt | ctrl.getReconciliationRules | finance.service | NOT_TESTED | - |
| 109 | PUT | `/api/v1/admin/finance/config/reconciliation-rules/:ruleId` | finance | yes | admin-jwt | ctrl.updateReconciliationRule | finance.service | NOT_TESTED | - |
| 110 | GET | `/api/v1/admin/finance/config/refund-policies` | finance | yes | admin-jwt | ctrl.getRefundPolicies | finance.service | NOT_TESTED | - |
| 111 | PUT | `/api/v1/admin/finance/config/refund-policies/:policyId` | finance | yes | admin-jwt | ctrl.updateRefundPolicy | finance.service | NOT_TESTED | - |
| 112 | GET | `/api/v1/admin/finance/config/tax-rules` | finance | yes | admin-jwt | ctrl.getTaxRules | finance.service | NOT_TESTED | - |
| 113 | POST | `/api/v1/admin/finance/config/tax-rules` | finance | yes | admin-jwt | ctrl.createTaxRule | finance.service | NOT_TESTED | - |
| 114 | PUT | `/api/v1/admin/finance/config/tax-rules/:ruleId` | finance | yes | admin-jwt | ctrl.updateTaxRule | finance.service | NOT_TESTED | - |
| 115 | GET | `/api/v1/admin/finance/customer-payments` | finance | yes | admin-jwt | ctrl.getCustomerPayments | finance.service | NOT_TESTED | - |
| 116 | GET | `/api/v1/admin/finance/customer-payments/:id` | finance | yes | admin-jwt | ctrl.getCustomerPaymentDetails | finance.service | NOT_TESTED | - |
| 117 | POST | `/api/v1/admin/finance/customer-payments/:id/retry` | finance | yes | admin-jwt | ctrl.retryCustomerPayment | finance.service | NOT_TESTED | - |
| 118 | GET | `/api/v1/admin/finance/dashboard/daily-metrics` | finance | yes | admin-jwt | ctrl.getDailyMetrics | finance.service | NOT_TESTED | - |
| 119 | POST | `/api/v1/admin/finance/dashboard/export` | finance | yes | admin-jwt | ctrl.exportFinanceReport | finance.service | NOT_TESTED | - |
| 120 | GET | `/api/v1/admin/finance/dashboard/gateway-status` | finance | yes | admin-jwt | ctrl.getGatewayStatus | finance.service | NOT_TESTED | - |
| 121 | GET | `/api/v1/admin/finance/dashboard/hourly-trends` | finance | yes | admin-jwt | ctrl.getHourlyTrends | finance.service | NOT_TESTED | - |
| 122 | GET | `/api/v1/admin/finance/dashboard/live-transactions` | finance | yes | admin-jwt | ctrl.getLiveTransactions | finance.service | NOT_TESTED | - |
| 123 | GET | `/api/v1/admin/finance/dashboard/payment-method-split` | finance | yes | admin-jwt | ctrl.getPaymentMethodSplit | finance.service | NOT_TESTED | - |
| 124 | GET | `/api/v1/admin/finance/dashboard/summary` | finance | yes | admin-jwt | ctrl.getFinanceSummary | finance.service | NOT_TESTED | - |
| 125 | GET | `/api/v1/admin/finance/dashboard/wallet-liability` | finance | yes | admin-jwt | ctrl.getWalletLiability | finance.service | NOT_TESTED | - |
| 126 | GET | `/api/v1/admin/finance/invoices` | finance | yes | admin-jwt | ctrl.getInvoices | finance.service | NOT_TESTED | - |
| 127 | POST | `/api/v1/admin/finance/invoices` | finance | yes | admin-jwt | ctrl.createInvoice | finance.service | NOT_TESTED | - |
| 128 | GET | `/api/v1/admin/finance/invoices/:id` | finance | yes | admin-jwt | ctrl.getInvoiceDetails | finance.service | NOT_TESTED | - |
| 129 | POST | `/api/v1/admin/finance/invoices/:id/mark-paid` | finance | yes | admin-jwt | ctrl.markInvoicePaid | finance.service | NOT_TESTED | - |
| 130 | POST | `/api/v1/admin/finance/invoices/:id/reminder` | finance | yes | admin-jwt | ctrl.sendReminder | finance.service | NOT_TESTED | - |
| 131 | POST | `/api/v1/admin/finance/invoices/:id/send` | finance | yes | admin-jwt | ctrl.sendInvoice | finance.service | NOT_TESTED | - |
| 132 | POST | `/api/v1/admin/finance/invoices/:id/send-reminder` | finance | yes | admin-jwt | ctrl.sendReminder | finance.service | NOT_TESTED | - |
| 133 | PATCH | `/api/v1/admin/finance/invoices/:id/status` | finance | yes | admin-jwt | ctrl.updateInvoiceStatus | finance.service | NOT_TESTED | - |
| 134 | GET | `/api/v1/admin/finance/invoices/summary` | finance | yes | admin-jwt | ctrl.getInvoiceSummary | finance.service | NOT_TESTED | - |
| 135 | GET | `/api/v1/admin/finance/picker-attendance` | finance | yes | admin-jwt | ctrl.getPickerAttendance | finance.service | NOT_TESTED | - |
| 136 | GET | `/api/v1/admin/finance/picker-earnings/:pickerId/breakdown` | finance | yes | admin-jwt | ctrl.getPickerEarningsBreakdown | finance.service | NOT_TESTED | - |
| 137 | GET | `/api/v1/admin/finance/picker-earnings/:pickerId/wallet` | finance | yes | admin-jwt | ctrl.getPickerWalletBalance | finance.service | NOT_TESTED | - |
| 138 | GET | `/api/v1/admin/finance/picker-transactions` | finance | yes | admin-jwt | ctrl.listAllPickerTransactions | finance.service | NOT_TESTED | - |
| 139 | GET | `/api/v1/admin/finance/picker-withdrawals` | finance | yes | admin-jwt | ctrl.list | finance.service | NOT_TESTED | - |
| 140 | GET | `/api/v1/admin/finance/picker-withdrawals/:id` | finance | yes | admin-jwt | ctrl.getDetails | finance.service | NOT_TESTED | - |
| 141 | PATCH | `/api/v1/admin/finance/picker-withdrawals/:id` | finance | yes | admin-jwt | ctrl.updateAction | finance.service | NOT_TESTED | - |
| 142 | GET | `/api/v1/admin/finance/picker-withdrawals/:pickerId/earnings-breakdown` | finance | yes | admin-jwt | ctrl.getPickerEarningsBreakdown | finance.service | NOT_TESTED | - |
| 143 | GET | `/api/v1/admin/finance/picker-withdrawals/:pickerId/wallet-balance` | finance | yes | admin-jwt | ctrl.getPickerWalletBalance | finance.service | NOT_TESTED | - |
| 144 | GET | `/api/v1/admin/finance/reconciliation/exceptions` | finance | yes | admin-jwt | ctrl.getExceptions | finance.service | NOT_TESTED | - |
| 145 | POST | `/api/v1/admin/finance/reconciliation/exceptions/:id/investigate` | finance | yes | admin-jwt | ctrl.investigateException | finance.service | NOT_TESTED | - |
| 146 | POST | `/api/v1/admin/finance/reconciliation/exceptions/:id/resolve` | finance | yes | admin-jwt | ctrl.resolveException | finance.service | NOT_TESTED | - |
| 147 | GET | `/api/v1/admin/finance/reconciliation/gateways` | finance | yes | admin-jwt | ctrl.getAvailableGateways | finance.service | NOT_TESTED | - |
| 148 | GET | `/api/v1/admin/finance/reconciliation/gateways/:id` | finance | yes | admin-jwt | ctrl.getGatewayDetails | finance.service | NOT_TESTED | - |
| 149 | POST | `/api/v1/admin/finance/reconciliation/run` | finance | yes | admin-jwt | ctrl.runReconciliation | finance.service | NOT_TESTED | - |
| 150 | GET | `/api/v1/admin/finance/reconciliation/runs/:id` | finance | yes | admin-jwt | ctrl.getRunStatus | finance.service | NOT_TESTED | - |
| 151 | GET | `/api/v1/admin/finance/reconciliation/summary` | finance | yes | admin-jwt | ctrl.getReconSummary | finance.service | NOT_TESTED | - |
| 152 | GET | `/api/v1/admin/finance/refunds/:id` | finance | yes | admin-jwt | ctrl.getRefundDetails | finance.service | NOT_TESTED | - |
| 153 | POST | `/api/v1/admin/finance/refunds/:id/approve` | finance | yes | admin-jwt | ctrl.approveRefund | finance.service | NOT_TESTED | - |
| 154 | POST | `/api/v1/admin/finance/refunds/:id/complete` | finance | yes | admin-jwt | ctrl.markCompleted | finance.service | NOT_TESTED | - |
| 155 | POST | `/api/v1/admin/finance/refunds/:id/mark-completed` | finance | yes | admin-jwt | ctrl.markCompleted | finance.service | NOT_TESTED | - |
| 156 | POST | `/api/v1/admin/finance/refunds/:id/reject` | finance | yes | admin-jwt | ctrl.rejectRefund | finance.service | NOT_TESTED | - |
| 157 | GET | `/api/v1/admin/finance/refunds/chargebacks` | finance | yes | admin-jwt | ctrl.getChargebacks | finance.service | NOT_TESTED | - |
| 158 | GET | `/api/v1/admin/finance/refunds/queue` | finance | yes | admin-jwt | ctrl.getRefundQueue | finance.service | NOT_TESTED | - |
| 159 | GET | `/api/v1/admin/finance/refunds/summary` | finance | yes | admin-jwt | ctrl.getRefundsSummary | finance.service | NOT_TESTED | - |
| 160 | GET | `/api/v1/admin/finance/refunds/wallet-transactions` | finance | yes | admin-jwt | ctrl.getWalletTransactions | finance.service | NOT_TESTED | - |
| 161 | GET | `/api/v1/admin/finance/rider-cash/:riderId` | finance | yes | admin-jwt | ctrl.getRiderPaymentDetails | finance.service | NOT_TESTED | - |
| 162 | GET | `/api/v1/admin/finance/rider-cash/cod-reconciliation` | finance | yes | admin-jwt | ctrl.getCodReconciliation | finance.service | NOT_TESTED | - |
| 163 | GET | `/api/v1/admin/finance/rider-cash/payouts` | finance | yes | admin-jwt | ctrl.getRiderPayouts | finance.service | NOT_TESTED | - |
| 164 | GET | `/api/v1/admin/finance/rider-cash/riders/:riderId/payment-details` | finance | yes | admin-jwt | ctrl.getRiderPaymentDetails | finance.service | NOT_TESTED | - |
| 165 | GET | `/api/v1/admin/finance/rider-cash/summary` | finance | yes | admin-jwt | ctrl.getRiderCashSummary | finance.service | NOT_TESTED | - |
| 166 | GET | `/api/v1/admin/finance/vendor-payments/invoices` | finance | yes | admin-jwt | ctrl.getVendorInvoices | finance.service | NOT_TESTED | - |
| 167 | POST | `/api/v1/admin/finance/vendor-payments/invoices` | finance | yes | admin-jwt | ctrl.uploadVendorInvoice | finance.service | NOT_TESTED | - |
| 168 | GET | `/api/v1/admin/finance/vendor-payments/invoices/:id` | finance | yes | admin-jwt | ctrl.getVendorInvoiceDetails | finance.service | NOT_TESTED | - |
| 169 | POST | `/api/v1/admin/finance/vendor-payments/invoices/:id/approve` | finance | yes | admin-jwt | ctrl.approveVendorInvoice | finance.service | NOT_TESTED | - |
| 170 | POST | `/api/v1/admin/finance/vendor-payments/invoices/:id/mark-paid` | finance | yes | admin-jwt | ctrl.markVendorInvoicePaid | finance.service | NOT_TESTED | - |
| 171 | POST | `/api/v1/admin/finance/vendor-payments/invoices/:id/reject` | finance | yes | admin-jwt | ctrl.rejectVendorInvoice | finance.service | NOT_TESTED | - |
| 172 | POST | `/api/v1/admin/finance/vendor-payments/invoices/bulk-approve` | finance | yes | admin-jwt | ctrl.bulkApproveVendorInvoices | finance.service | NOT_TESTED | - |
| 173 | GET | `/api/v1/admin/finance/vendor-payments/payments` | finance | yes | admin-jwt | ctrl.listPayments | finance.service | NOT_TESTED | - |
| 174 | POST | `/api/v1/admin/finance/vendor-payments/payments` | finance | yes | admin-jwt | ctrl.createVendorPayment | finance.service | NOT_TESTED | - |
| 175 | GET | `/api/v1/admin/finance/vendor-payments/payments/:paymentId` | finance | yes | admin-jwt | ctrl.getPayment | finance.service | NOT_TESTED | - |
| 176 | POST | `/api/v1/admin/finance/vendor-payments/payments/:paymentId/advance` | finance | yes | admin-jwt | ctrl.advanceWorkflowStep | finance.service | NOT_TESTED | - |
| 177 | POST | `/api/v1/admin/finance/vendor-payments/payments/:paymentId/cancel` | finance | yes | admin-jwt | ctrl.cancelVendorPayment | finance.service | NOT_TESTED | - |
| 178 | POST | `/api/v1/admin/finance/vendor-payments/payments/:paymentId/invoices/:invoiceId/workflow/advance` | finance | yes | admin-jwt | ctrl.advanceWorkflowStep | finance.service | NOT_TESTED | - |
| 179 | GET | `/api/v1/admin/finance/vendor-payments/summary` | finance | yes | admin-jwt | ctrl.getVendorPaymentsSummary | finance.service | NOT_TESTED | - |
| 180 | GET | `/api/v1/admin/finance/vendor-payments/vendors` | finance | yes | admin-jwt | ctrl.getVendors | finance.service | NOT_TESTED | - |
| 181 | GET | `/api/v1/admin/finance/wallet-transactions` | finance | yes | admin-jwt | ctrl.getWalletTransactions | finance.service | NOT_TESTED | - |
| 182 | GET | `/api/v1/admin/fraud/alerts` | admin | yes | admin|super_admin | controller.listAlerts | fraud.service | NOT_TESTED | fraud.routes.ts |
| 183 | GET | `/api/v1/admin/fraud/alerts/:id` | admin | yes | admin|super_admin | controller.getAlert | fraud.service | NOT_TESTED | fraud.routes.ts |
| 184 | PATCH | `/api/v1/admin/fraud/alerts/:id` | admin | yes | admin|super_admin | controller.updateAlert | fraud.service | NOT_TESTED | fraud.routes.ts |
| 185 | GET | `/api/v1/admin/fraud/blocked` | admin | yes | admin|super_admin | controller.listBlockedEntities | fraud.service | NOT_TESTED | fraud.routes.ts |
| 186 | POST | `/api/v1/admin/fraud/blocked` | admin | yes | admin|super_admin | controller.createBlockedEntity | fraud.service | NOT_TESTED | fraud.routes.ts |
| 187 | DELETE | `/api/v1/admin/fraud/blocked/:id` | admin | yes | admin|super_admin | controller.unblockEntity | fraud.service | NOT_TESTED | fraud.routes.ts |
| 188 | GET | `/api/v1/admin/fraud/chargebacks` | admin | yes | admin|super_admin | controller.listChargebacks | fraud.service | NOT_TESTED | fraud.routes.ts |
| 189 | PATCH | `/api/v1/admin/fraud/chargebacks/:id` | admin | yes | admin|super_admin | controller.updateChargeback | fraud.service | NOT_TESTED | fraud.routes.ts |
| 190 | GET | `/api/v1/admin/fraud/investigations` | admin | yes | admin|super_admin | controller.listInvestigations | fraud.service | NOT_TESTED | fraud.routes.ts |
| 191 | GET | `/api/v1/admin/fraud/metrics` | admin | yes | admin|super_admin | controller.getMetrics | fraud.service | NOT_TESTED | fraud.routes.ts |
| 192 | GET | `/api/v1/admin/fraud/patterns` | admin | yes | admin|super_admin | controller.listFraudPatterns | fraud.service | NOT_TESTED | fraud.routes.ts |
| 193 | GET | `/api/v1/admin/fraud/risk-profiles` | admin | yes | admin|super_admin | controller.listRiskProfiles | fraud.service | NOT_TESTED | fraud.routes.ts |
| 194 | GET | `/api/v1/admin/fraud/rules` | admin | yes | admin|super_admin | controller.listFraudRules | fraud.service | NOT_TESTED | fraud.routes.ts |
| 195 | PATCH | `/api/v1/admin/fraud/rules/:id/toggle` | admin | yes | admin|super_admin | controller.toggleFraudRule | fraud.service | NOT_TESTED | fraud.routes.ts |
| 196 | GET | `/api/v1/admin/integrations` | admin | yes | admin|super_admin | integrationController.list | integration.service | NOT_TESTED | integration.routes.ts |
| 197 | PATCH | `/api/v1/admin/integrations/:id` | admin | yes | admin|super_admin | integrationController.toggle | integration.service | NOT_TESTED | integration.routes.ts |
| 198 | PUT | `/api/v1/admin/integrations/:id` | admin | yes | admin|super_admin | integrationController.update | integration.service | NOT_TESTED | integration.routes.ts |
| 199 | POST | `/api/v1/admin/integrations/:id/test` | admin | yes | admin|super_admin | integrationController.test | integration.service | NOT_TESTED | integration.routes.ts |
| 200 | GET | `/api/v1/admin/integrations/api-keys` | admin | yes | admin|super_admin | integrationController.listApiKeys | integration.service | NOT_TESTED | integration.routes.ts |
| 201 | POST | `/api/v1/admin/integrations/api-keys` | admin | yes | admin|super_admin | integrationController.createApiKey | integration.service | NOT_TESTED | integration.routes.ts |
| 202 | DELETE | `/api/v1/admin/integrations/api-keys/:keyId` | admin | yes | admin|super_admin | integrationController.revokeApiKey | integration.service | NOT_TESTED | integration.routes.ts |
| 203 | GET | `/api/v1/admin/integrations/health` | admin | yes | admin|super_admin | integrationController.health | integration.service | NOT_TESTED | integration.routes.ts |
| 204 | GET | `/api/v1/admin/integrations/logs` | admin | yes | admin|super_admin | integrationController.listLogs | integration.service | NOT_TESTED | integration.routes.ts |
| 205 | GET | `/api/v1/admin/integrations/stats` | admin | yes | admin|super_admin | integrationController.stats | integration.service | NOT_TESTED | integration.routes.ts |
| 206 | GET | `/api/v1/admin/integrations/webhooks` | admin | yes | admin|super_admin | integrationController.listWebhooks | integration.service | NOT_TESTED | integration.routes.ts |
| 207 | POST | `/api/v1/admin/integrations/webhooks` | admin | yes | admin|super_admin | integrationController.createWebhook | integration.service | NOT_TESTED | integration.routes.ts |
| 208 | POST | `/api/v1/admin/integrations/webhooks/:webhookId/retry` | admin | yes | admin|super_admin | integrationController.retryWebhook | integration.service | NOT_TESTED | integration.routes.ts |
| 209 | GET | `/api/v1/admin/notifications/analytics` | admin | yes | admin|super_admin | controller.getAnalytics | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 210 | GET | `/api/v1/admin/notifications/automation` | admin | yes | admin|super_admin | controller.listAutomation | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 211 | POST | `/api/v1/admin/notifications/automation` | admin | yes | admin|super_admin | controller.createAutomation | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 212 | PUT | `/api/v1/admin/notifications/automation/:id` | admin | yes | admin|super_admin | controller.updateAutomation | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 213 | GET | `/api/v1/admin/notifications/campaigns` | admin | yes | admin|super_admin | controller.listCampaigns | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 214 | POST | `/api/v1/admin/notifications/campaigns` | admin | yes | admin|super_admin | controller.createCampaign | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 215 | GET | `/api/v1/admin/notifications/campaigns/:id` | admin | yes | admin|super_admin | controller.getCampaignById | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 216 | PUT | `/api/v1/admin/notifications/campaigns/:id` | admin | yes | admin|super_admin | controller.updateCampaignStatus | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 217 | GET | `/api/v1/admin/notifications/channels` | admin | yes | admin|super_admin | controller.getChannels | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 218 | GET | `/api/v1/admin/notifications/history` | admin | yes | admin|super_admin | controller.listHistory | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 219 | POST | `/api/v1/admin/notifications/history/:id/retry` | admin | yes | admin|super_admin | controller.retryHistory | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 220 | POST | `/api/v1/admin/notifications/history/retry-failed` | admin | yes | admin|super_admin | controller.retryFailedBatch | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 221 | GET | `/api/v1/admin/notifications/scheduled` | admin | yes | admin|super_admin | controller.listScheduled | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 222 | GET | `/api/v1/admin/notifications/templates` | admin | yes | admin|super_admin | controller.listTemplates | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 223 | POST | `/api/v1/admin/notifications/templates` | admin | yes | admin|super_admin | controller.createTemplate | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 224 | DELETE | `/api/v1/admin/notifications/templates/:id` | admin | yes | admin|super_admin | controller.deleteTemplate | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 225 | PUT | `/api/v1/admin/notifications/templates/:id` | admin | yes | admin|super_admin | controller.updateTemplate | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 226 | GET | `/api/v1/admin/notifications/timeseries` | admin | yes | admin|super_admin | controller.getTimeSeries | notification-campaign.service | NOT_TESTED | notification-campaign.routes.ts |
| 227 | GET | `/api/v1/admin/orders` | admin | yes | admin|super_admin | adminOrdersCtrl.listAdminOrders | admin.service | PASS | protectedRouter |
| 228 | POST | `/api/v1/admin/orders` | admin | yes | admin|super_admin | adminOrdersCtrl.placeOrderOnBehalf | admin.service | NOT_TESTED | protectedRouter |
| 229 | GET | `/api/v1/admin/orders/:id` | admin | yes | admin|super_admin | adminOrdersCtrl.getAdminOrder | admin.service | PASS | protectedRouter |
| 230 | GET | `/api/v1/admin/orders/:id/logs` | admin | yes | admin|super_admin | adminOrdersCtrl.getAdminOrderLogs | admin.service | PASS | protectedRouter |
| 231 | GET | `/api/v1/admin/permissions` | admin | yes | admin|super_admin;permission-gated | permissionsController.getPermissions | admin.service | NOT_TESTED | protectedRouter |
| 232 | POST | `/api/v1/admin/permissions` | admin | yes | admin|super_admin;permission-gated | permissionsController.createPermission | admin.service | NOT_TESTED | protectedRouter |
| 233 | DELETE | `/api/v1/admin/permissions/:id` | admin | yes | admin|super_admin;permission-gated | permissionsController.deletePermission | admin.service | NOT_TESTED | protectedRouter |
| 234 | GET | `/api/v1/admin/permissions/:id` | admin | yes | admin|super_admin;permission-gated | permissionsController.getPermissionById | admin.service | NOT_TESTED | protectedRouter |
| 235 | PUT | `/api/v1/admin/permissions/:id` | admin | yes | admin|super_admin;permission-gated | permissionsController.updatePermission | admin.service | NOT_TESTED | protectedRouter |
| 236 | GET | `/api/v1/admin/permissions/matrix` | admin | yes | admin|super_admin;permission-gated | permissionsController.getPermissionsMatrix | admin.service | NOT_TESTED | protectedRouter |
| 237 | GET | `/api/v1/admin/picker-action-logs` | admin | yes | admin|super_admin | pickerActionLogsCtrl.listPickerActionLogs | admin.service | NOT_TESTED | protectedRouter |
| 238 | GET | `/api/v1/admin/picker-config` | admin | yes | admin|super_admin | pickerConfigCtrl.getPickerConfig | admin.service | NOT_TESTED | protectedRouter |
| 239 | PUT | `/api/v1/admin/picker-config` | admin | yes | admin|super_admin | pickerConfigCtrl.updatePickerConfig | admin.service | NOT_TESTED | protectedRouter |
| 240 | GET | `/api/v1/admin/picker/agencies` | admin | yes | admin|super_admin | pickerOpsCtrl.listAgencies | admin.service | NOT_TESTED | protectedRouter |
| 241 | GET | `/api/v1/admin/picker/agencies` | picker | yes | admin-jwt | ctrl.adminListAgencies | picker.service | NOT_TESTED | - |
| 242 | POST | `/api/v1/admin/picker/agencies` | admin | yes | admin|super_admin | pickerOpsCtrl.createAgency | admin.service | NOT_TESTED | protectedRouter |
| 243 | POST | `/api/v1/admin/picker/agencies` | picker | yes | admin-jwt | ctrl.adminCreateAgency | picker.service | NOT_TESTED | - |
| 244 | POST | `/api/v1/admin/picker/agencies/:agencyId/activate` | admin | yes | admin|super_admin | pickerOpsCtrl.activateAgency | admin.service | NOT_TESTED | protectedRouter |
| 245 | POST | `/api/v1/admin/picker/agencies/:agencyId/activate` | picker | yes | admin-jwt | ctrl.adminActivateAgency | picker.service | NOT_TESTED | - |
| 246 | POST | `/api/v1/admin/picker/agencies/:agencyId/deactivate` | admin | yes | admin|super_admin | pickerOpsCtrl.deactivateAgency | admin.service | NOT_TESTED | protectedRouter |
| 247 | POST | `/api/v1/admin/picker/agencies/:agencyId/deactivate` | picker | yes | admin-jwt | ctrl.adminDeactivateAgency | picker.service | NOT_TESTED | - |
| 248 | GET | `/api/v1/admin/picker/approvals` | admin | yes | admin|super_admin | pickerOpsCtrl.listPickerApprovals | admin.service | NOT_TESTED | protectedRouter |
| 249 | GET | `/api/v1/admin/picker/approvals` | picker | yes | admin-jwt | ctrl.adminListPickers | picker.service | NOT_TESTED | - |
| 250 | GET | `/api/v1/admin/picker/attendance` | admin | yes | admin|super_admin | pickerOpsCtrl.listAttendance | admin.service | NOT_TESTED | protectedRouter |
| 251 | GET | `/api/v1/admin/picker/attendance` | picker | yes | admin-jwt | ctrl.adminGetAttendanceByMonth | picker.service | NOT_TESTED | - |
| 252 | GET | `/api/v1/admin/picker/attendance/export` | admin | yes | admin|super_admin | pickerOpsCtrl.exportAttendance | admin.service | NOT_TESTED | protectedRouter |
| 253 | GET | `/api/v1/admin/picker/attendance/export` | picker | yes | admin-jwt | ctrl.adminExportAttendance | picker.service | NOT_TESTED | - |
| 254 | GET | `/api/v1/admin/picker/attendance/live` | picker | yes | admin-jwt | ctrl.adminLiveAttendance | picker.service | NOT_TESTED | - |
| 255 | GET | `/api/v1/admin/picker/devices` | picker | yes | admin-jwt | ctrl.adminListDevices | picker.service | NOT_TESTED | - |
| 256 | DELETE | `/api/v1/admin/picker/devices/:deviceId/unassign` | picker | yes | admin-jwt | ctrl.adminUnassignDevice | picker.service | NOT_TESTED | - |
| 257 | POST | `/api/v1/admin/picker/devices/assign` | picker | yes | admin-jwt | ctrl.adminAssignDevice | picker.service | NOT_TESTED | - |
| 258 | PUT | `/api/v1/admin/picker/documents/:documentId/review` | picker | yes | admin-jwt | ctrl.adminReviewDocument | picker.service | NOT_TESTED | - |
| 259 | GET | `/api/v1/admin/picker/ot-requests` | admin | yes | admin|super_admin | pickerOpsCtrl.listOtRequests | admin.service | NOT_TESTED | protectedRouter |
| 260 | GET | `/api/v1/admin/picker/ot-requests` | picker | yes | admin-jwt | ctrl.adminListOtRequests | picker.service | NOT_TESTED | - |
| 261 | POST | `/api/v1/admin/picker/ot-requests/:requestId/decision` | admin | yes | admin|super_admin | pickerOpsCtrl.decideOtRequest | admin.service | NOT_TESTED | protectedRouter |
| 262 | POST | `/api/v1/admin/picker/ot-requests/:requestId/decision` | picker | yes | admin-jwt | ctrl.adminDecideOtRequest | picker.service | NOT_TESTED | - |
| 263 | GET | `/api/v1/admin/picker/pickers` | admin | yes | admin|super_admin | pickerOpsCtrl.listPickers | admin.service | PASS | protectedRouter |
| 264 | GET | `/api/v1/admin/picker/pickers` | picker | yes | admin-jwt | ctrl.adminListPickers | picker.service | PASS | - |
| 265 | GET | `/api/v1/admin/picker/pickers/:id` | admin | yes | admin|super_admin | pickerOpsCtrl.getPickerById | admin.service | PASS | protectedRouter |
| 266 | GET | `/api/v1/admin/picker/pickers/:id` | picker | yes | admin-jwt | ctrl.adminGetPickerById | picker.service | PASS | - |
| 267 | GET | `/api/v1/admin/picker/pickers/:id/action-logs` | admin | yes | admin|super_admin | pickerOpsCtrl.getPickerActionLogs | admin.service | PASS | protectedRouter |
| 268 | GET | `/api/v1/admin/picker/pickers/:id/action-logs` | picker | yes | admin-jwt | ctrl.adminGetPickerActionLogs | picker.service | PASS | - |
| 269 | PATCH | `/api/v1/admin/picker/pickers/:id/bank/:accountId/review` | admin | yes | admin|super_admin | pickerOpsCtrl.reviewPickerBankAccount | admin.service | NOT_TESTED | protectedRouter |
| 270 | PATCH | `/api/v1/admin/picker/pickers/:id/bank/:accountId/review` | picker | yes | admin-jwt | ctrl.adminReviewBankAccount | picker.service | NOT_TESTED | - |
| 271 | PATCH | `/api/v1/admin/picker/pickers/:id/documents/review` | admin | yes | admin|super_admin | pickerOpsCtrl.reviewPickerDocument | admin.service | NOT_TESTED | protectedRouter |
| 272 | PATCH | `/api/v1/admin/picker/pickers/:id/documents/review` | picker | yes | admin-jwt | ctrl.adminReviewDocument | picker.service | NOT_TESTED | - |
| 273 | GET | `/api/v1/admin/picker/pickers/:id/face-verification` | admin | yes | admin|super_admin | pickerOpsCtrl.getPickerFaceVerification | admin.service | PASS | protectedRouter |
| 274 | GET | `/api/v1/admin/picker/pickers/:id/face-verification` | picker | yes | admin-jwt | ctrl.adminGetFaceVerification | picker.service | PASS | - |
| 275 | PATCH | `/api/v1/admin/picker/pickers/:id/face-verification/override` | admin | yes | admin|super_admin | pickerOpsCtrl.overridePickerFaceVerification | admin.service | NOT_TESTED | protectedRouter |
| 276 | PATCH | `/api/v1/admin/picker/pickers/:id/face-verification/override` | picker | yes | admin-jwt | ctrl.adminOverrideFaceVerification | picker.service | NOT_TESTED | - |
| 277 | DELETE | `/api/v1/admin/picker/pickers/:id/link-hhd` | admin | yes | admin|super_admin | pickerOpsCtrl.unlinkPickerHhd | admin.service | NOT_TESTED | protectedRouter |
| 278 | DELETE | `/api/v1/admin/picker/pickers/:id/link-hhd` | picker | yes | admin-jwt | ctrl.adminUnlinkHHD | picker.service | NOT_TESTED | - |
| 279 | POST | `/api/v1/admin/picker/pickers/:id/link-hhd` | admin | yes | admin|super_admin | pickerOpsCtrl.linkPickerHhd | admin.service | NOT_TESTED | protectedRouter |
| 280 | POST | `/api/v1/admin/picker/pickers/:id/link-hhd` | picker | yes | admin-jwt | ctrl.adminLinkHHD | picker.service | NOT_TESTED | - |
| 281 | PATCH | `/api/v1/admin/picker/pickers/:id/status` | admin | yes | admin|super_admin | pickerOpsCtrl.updatePickerStatus | admin.service | NOT_TESTED | protectedRouter |
| 282 | PATCH | `/api/v1/admin/picker/pickers/:id/status` | picker | yes | admin-jwt | ctrl.adminUpdatePickerStatus | picker.service | NOT_TESTED | - |
| 283 | GET | `/api/v1/admin/picker/pickers/:id/training-progress` | admin | yes | admin|super_admin | pickerOpsCtrl.getPickerTrainingProgress | admin.service | PASS | protectedRouter |
| 284 | GET | `/api/v1/admin/picker/pickers/:id/training-progress` | picker | yes | admin-jwt | ctrl.adminGetPickerTrainingProgress | picker.service | PASS | - |
| 285 | PUT | `/api/v1/admin/picker/pickers/:pickerId/approve` | picker | yes | admin-jwt | ctrl.adminApprovePicker | picker.service | NOT_TESTED | - |
| 286 | PATCH | `/api/v1/admin/picker/pickers/:pickerId/assignment` | admin | yes | admin|super_admin | pickerOpsCtrl.updatePickerAssignment | admin.service | NOT_TESTED | protectedRouter |
| 287 | PATCH | `/api/v1/admin/picker/pickers/:pickerId/assignment` | picker | yes | admin-jwt | ctrl.adminUpdateAssignment | picker.service | NOT_TESTED | - |
| 288 | POST | `/api/v1/admin/picker/pickers/:pickerId/push` | admin | yes | admin|super_admin | pickerOpsCtrl.pushPickerNotification | admin.service | NOT_TESTED | protectedRouter |
| 289 | POST | `/api/v1/admin/picker/pickers/:pickerId/push` | picker | yes | admin-jwt | ctrl.adminSendPickerPush | picker.service | NOT_TESTED | - |
| 290 | PUT | `/api/v1/admin/picker/pickers/:pickerId/reject` | picker | yes | admin-jwt | ctrl.adminRejectPicker | picker.service | NOT_TESTED | - |
| 291 | GET | `/api/v1/admin/picker/shift-change-requests` | admin | yes | admin|super_admin | pickerOpsCtrl.listShiftChangeRequests | admin.service | NOT_TESTED | protectedRouter |
| 292 | GET | `/api/v1/admin/picker/shift-change-requests` | picker | yes | admin-jwt | ctrl.adminListShiftChangeRequests | picker.service | NOT_TESTED | - |
| 293 | POST | `/api/v1/admin/picker/shift-change-requests/:requestId/decision` | admin | yes | admin|super_admin | pickerOpsCtrl.decideShiftChangeRequest | admin.service | NOT_TESTED | protectedRouter |
| 294 | POST | `/api/v1/admin/picker/shift-change-requests/:requestId/decision` | picker | yes | admin-jwt | ctrl.adminDecideShiftChangeRequest | picker.service | NOT_TESTED | - |
| 295 | POST | `/api/v1/admin/picker/shifts/:shiftId/reassign` | picker | yes | admin-jwt | ctrl.adminReassignPickerShift | picker.service | NOT_TESTED | - |
| 296 | GET | `/api/v1/admin/picker/stores/:storeId/shift-slots` | admin | yes | admin|super_admin | pickerOpsCtrl.listStoreShiftSlots | admin.service | NOT_TESTED | protectedRouter |
| 297 | GET | `/api/v1/admin/picker/stores/:storeId/shift-slots` | picker | yes | admin-jwt | ctrl.adminListStoreShiftSlots | picker.service | NOT_TESTED | - |
| 298 | POST | `/api/v1/admin/picker/stores/:storeId/shift-slots` | admin | yes | admin|super_admin | pickerOpsCtrl.createStoreShiftSlot | admin.service | NOT_TESTED | protectedRouter |
| 299 | POST | `/api/v1/admin/picker/stores/:storeId/shift-slots` | picker | yes | admin-jwt | ctrl.adminCreateStoreShiftSlot | picker.service | NOT_TESTED | - |
| 300 | GET | `/api/v1/admin/picker/withdrawals` | picker | yes | admin-jwt | ctrl.adminListWithdrawals | picker.service | NOT_TESTED | - |
| 301 | PUT | `/api/v1/admin/picker/withdrawals/:requestId/process` | picker | yes | admin-jwt | ctrl.adminProcessWithdrawal | picker.service | NOT_TESTED | - |
| 302 | GET | `/api/v1/admin/pickers` | admin | yes | admin|super_admin | pickerOpsCtrl.listPickers | admin.service | NOT_TESTED | alias of /admin/picker/pickers/* |
| 303 | GET | `/api/v1/admin/pickers/:id` | admin | yes | admin|super_admin | pickerOpsCtrl.getPickerById | admin.service | NOT_TESTED | alias of /admin/picker/pickers/* |
| 304 | PATCH | `/api/v1/admin/pickers/:id` | admin | yes | admin|super_admin | pickerOpsCtrl.updatePickerStatus | admin.service | NOT_TESTED | alias of /admin/picker/pickers/* |
| 305 | GET | `/api/v1/admin/pickers/:id/action-logs` | admin | yes | admin|super_admin | pickerOpsCtrl.getPickerActionLogs | admin.service | NOT_TESTED | alias of /admin/picker/pickers/* |
| 306 | PATCH | `/api/v1/admin/pickers/:id/bank/:accountId/review` | admin | yes | admin|super_admin | pickerOpsCtrl.reviewPickerBankAccount | admin.service | NOT_TESTED | alias of /admin/picker/pickers/* |
| 307 | PATCH | `/api/v1/admin/pickers/:id/documents/review` | admin | yes | admin|super_admin | pickerOpsCtrl.reviewPickerDocument | admin.service | NOT_TESTED | alias of /admin/picker/pickers/* |
| 308 | GET | `/api/v1/admin/pickers/:id/face-verification` | admin | yes | admin|super_admin | pickerOpsCtrl.getPickerFaceVerification | admin.service | NOT_TESTED | alias of /admin/picker/pickers/* |
| 309 | PATCH | `/api/v1/admin/pickers/:id/face-verification/override` | admin | yes | admin|super_admin | pickerOpsCtrl.overridePickerFaceVerification | admin.service | NOT_TESTED | alias of /admin/picker/pickers/* |
| 310 | DELETE | `/api/v1/admin/pickers/:id/link-hhd` | admin | yes | admin|super_admin | pickerOpsCtrl.unlinkPickerHhd | admin.service | NOT_TESTED | alias of /admin/picker/pickers/* |
| 311 | POST | `/api/v1/admin/pickers/:id/link-hhd` | admin | yes | admin|super_admin | pickerOpsCtrl.linkPickerHhd | admin.service | NOT_TESTED | alias of /admin/picker/pickers/* |
| 312 | GET | `/api/v1/admin/pickers/:id/training-progress` | admin | yes | admin|super_admin | pickerOpsCtrl.getPickerTrainingProgress | admin.service | NOT_TESTED | alias of /admin/picker/pickers/* |
| 313 | GET | `/api/v1/admin/platform-config` | admin | partial | admin|super_admin | platformConfigController.list | platform-config.service | NOT_TESTED | platform-config.routes.ts |
| 314 | DELETE | `/api/v1/admin/platform-config/:key` | admin | partial | admin|super_admin | platformConfigController.remove | platform-config.service | NOT_TESTED | platform-config.routes.ts |
| 315 | GET | `/api/v1/admin/platform-config/:key` | admin | partial | admin|super_admin | platformConfigController.getOne | platform-config.service | NOT_TESTED | platform-config.routes.ts |
| 316 | PUT | `/api/v1/admin/platform-config/:key` | admin | partial | admin|super_admin | platformConfigController.upsert | platform-config.service | NOT_TESTED | platform-config.routes.ts |
| 317 | GET | `/api/v1/admin/products` | products | yes | admin-jwt | adminProductsController.listProducts | products.service | NOT_TESTED | - |
| 318 | POST | `/api/v1/admin/products` | products | yes | admin-jwt | adminProductsController.createProduct | products.service | NOT_TESTED | - |
| 319 | DELETE | `/api/v1/admin/products/:id` | products | yes | admin-jwt | adminProductsController.deleteProduct | products.service | NOT_TESTED | - |
| 320 | GET | `/api/v1/admin/products/:id` | products | yes | admin-jwt | adminProductsController.getProduct | products.service | NOT_TESTED | - |
| 321 | PUT | `/api/v1/admin/products/:id` | products | yes | admin-jwt | adminProductsController.updateProduct | products.service | NOT_TESTED | - |
| 322 | POST | `/api/v1/admin/products/bulk-upload` | products | yes | admin-jwt | adminProductsController.bulkUpload | products.service | NOT_TESTED | - |
| 323 | GET | `/api/v1/admin/products/bulk-upload/template` | products | yes | admin-jwt | adminProductsController.downloadTemplate | products.service | NOT_TESTED | - |
| 324 | GET | `/api/v1/admin/riders` | admin | yes | admin|super_admin | riderCtrl.listRiders | admin.service | NOT_TESTED | protectedRouter |
| 325 | GET | `/api/v1/admin/riders/:id` | admin | yes | admin|super_admin | riderCtrl.getRiderById | admin.service | NOT_TESTED | protectedRouter |
| 326 | PATCH | `/api/v1/admin/riders/:id/status` | admin | yes | admin|super_admin | riderCtrl.updateRiderStatus | admin.service | NOT_TESTED | protectedRouter |
| 327 | GET | `/api/v1/admin/roles` | admin | yes | admin|super_admin;permission-gated | rolesController.getRoles | admin.service | NOT_TESTED | protectedRouter |
| 328 | POST | `/api/v1/admin/roles` | admin | yes | admin|super_admin;permission-gated | rolesController.createRole | admin.service | NOT_TESTED | protectedRouter |
| 329 | DELETE | `/api/v1/admin/roles/:id` | admin | yes | admin|super_admin;permission-gated | rolesController.deleteRole | admin.service | NOT_TESTED | protectedRouter |
| 330 | GET | `/api/v1/admin/roles/:id` | admin | yes | admin|super_admin;permission-gated | rolesController.getRoleById | admin.service | NOT_TESTED | protectedRouter |
| 331 | PUT | `/api/v1/admin/roles/:id` | admin | yes | admin|super_admin;permission-gated | rolesController.updateRole | admin.service | NOT_TESTED | protectedRouter |
| 332 | GET | `/api/v1/admin/roles/:id/export` | admin | yes | admin|super_admin;permission-gated | rolesController.exportRoleConfig | admin.service | NOT_TESTED | protectedRouter |
| 333 | PUT | `/api/v1/admin/roles/:id/matrix` | admin | yes | admin|super_admin;permission-gated | rolesController.updateRoleMatrix | admin.service | NOT_TESTED | protectedRouter |
| 334 | POST | `/api/v1/admin/roles/from-template` | admin | yes | admin|super_admin;permission-gated | rolesController.createRoleFromTemplate | admin.service | NOT_TESTED | protectedRouter |
| 335 | POST | `/api/v1/admin/roles/import` | admin | yes | admin|super_admin;permission-gated | rolesController.importRoleConfig | admin.service | NOT_TESTED | protectedRouter |
| 336 | GET | `/api/v1/admin/roles/templates` | admin | yes | admin|super_admin;permission-gated | rolesController.getRoleTemplates | admin.service | NOT_TESTED | protectedRouter |
| 337 | GET | `/api/v1/admin/sku-units` | admin | yes | admin|super_admin | masterDataController.listSkuUnits | master-data.service | NOT_TESTED | master-data.routes.ts |
| 338 | POST | `/api/v1/admin/sku-units` | admin | yes | admin|super_admin | masterDataController.createSkuUnit | master-data.service | NOT_TESTED | master-data.routes.ts |
| 339 | DELETE | `/api/v1/admin/sku-units/:id` | admin | yes | admin|super_admin | masterDataController.deleteSkuUnit | master-data.service | NOT_TESTED | master-data.routes.ts |
| 340 | GET | `/api/v1/admin/sku-units/:id` | admin | yes | admin|super_admin | masterDataController.getSkuUnit | master-data.service | NOT_TESTED | master-data.routes.ts |
| 341 | PUT | `/api/v1/admin/sku-units/:id` | admin | yes | admin|super_admin | masterDataController.updateSkuUnit | master-data.service | NOT_TESTED | master-data.routes.ts |
| 342 | GET | `/api/v1/admin/staff` | admin | yes | admin|super_admin | storeWarehouseController.listStaff | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 343 | GET | `/api/v1/admin/staff` | staff | yes | admin-jwt | staffController.listRiders | staff.service | NOT_TESTED | - |
| 344 | POST | `/api/v1/admin/staff` | admin | yes | admin|super_admin | storeWarehouseController.createStaff | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 345 | DELETE | `/api/v1/admin/staff/:id` | admin | yes | admin|super_admin | storeWarehouseController.deleteStaff | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 346 | GET | `/api/v1/admin/staff/:id` | admin | yes | admin|super_admin | storeWarehouseController.getStaff | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 347 | PUT | `/api/v1/admin/staff/:id` | admin | yes | admin|super_admin | storeWarehouseController.updateStaff | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 348 | GET | `/api/v1/admin/staff/shifts` | staff | yes | admin-jwt | staffController.listShifts | staff.service | NOT_TESTED | - |
| 349 | POST | `/api/v1/admin/staff/shifts` | staff | yes | admin-jwt | staffController.createShift | staff.service | NOT_TESTED | - |
| 350 | GET | `/api/v1/admin/staff/shifts/:id` | staff | yes | admin-jwt | staffController.getShiftById | staff.service | NOT_TESTED | - |
| 351 | PUT | `/api/v1/admin/staff/shifts/:id` | staff | yes | admin-jwt | staffController.updateShift | staff.service | NOT_TESTED | - |
| 352 | GET | `/api/v1/admin/staff/summary` | staff | yes | admin-jwt | staffController.getSummary | staff.service | NOT_TESTED | - |
| 353 | GET | `/api/v1/admin/store-warehouse/bins` | admin | yes | admin|super_admin | inline-handler | - | NOT_TESTED | store-warehouse-sub.routes.ts |
| 354 | GET | `/api/v1/admin/store-warehouse/bins/:id` | admin | yes | admin|super_admin | inline-handler | - | NOT_TESTED | store-warehouse-sub.routes.ts |
| 355 | GET | `/api/v1/admin/store-warehouse/delivery-zones` | admin | yes | admin|super_admin | inline-handler | - | NOT_TESTED | store-warehouse-sub.routes.ts |
| 356 | GET | `/api/v1/admin/store-warehouse/grns` | admin | yes | admin|super_admin | inline-handler | - | NOT_TESTED | store-warehouse-sub.routes.ts |
| 357 | GET | `/api/v1/admin/store-warehouse/grns/:id` | admin | yes | admin|super_admin | inline-handler | - | NOT_TESTED | store-warehouse-sub.routes.ts |
| 358 | GET | `/api/v1/admin/store-warehouse/inventories` | admin | yes | admin|super_admin | inline-handler | - | NOT_TESTED | store-warehouse-sub.routes.ts |
| 359 | GET | `/api/v1/admin/store-warehouse/inventories/:id` | admin | yes | admin|super_admin | inline-handler | - | NOT_TESTED | store-warehouse-sub.routes.ts |
| 360 | GET | `/api/v1/admin/store-warehouse/putaway` | admin | yes | admin|super_admin | inline-handler | - | NOT_TESTED | store-warehouse-sub.routes.ts |
| 361 | GET | `/api/v1/admin/store-warehouse/stock-movements` | admin | yes | admin|super_admin | inline-handler | - | NOT_TESTED | store-warehouse-sub.routes.ts |
| 362 | GET | `/api/v1/admin/stores` | admin | yes | admin|super_admin | storeWarehouseController.listStores | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 363 | POST | `/api/v1/admin/stores` | admin | yes | admin|super_admin | storeWarehouseController.createStore | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 364 | DELETE | `/api/v1/admin/stores/:id` | admin | yes | admin|super_admin | storeWarehouseController.deleteStore | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 365 | GET | `/api/v1/admin/stores/:id` | admin | yes | admin|super_admin | storeWarehouseController.getStore | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 366 | PUT | `/api/v1/admin/stores/:id` | admin | yes | admin|super_admin | storeWarehouseController.updateStore | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 367 | GET | `/api/v1/admin/stores/performance` | admin | yes | admin|super_admin | storeWarehouseController.getStorePerformance | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 368 | GET | `/api/v1/admin/stores/stats` | admin | yes | admin|super_admin | storeWarehouseController.getStoreStats | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 369 | GET | `/api/v1/admin/support-chat/conversations` | support-chat | yes | admin-jwt | controller.adminListConversations | support-chat.service | NOT_TESTED | - |
| 370 | GET | `/api/v1/admin/support-chat/conversations/:id` | support-chat | yes | admin-jwt | controller.adminGetConversation | support-chat.service | NOT_TESTED | - |
| 371 | GET | `/api/v1/admin/support-chat/conversations/:id/context` | support-chat | yes | admin-jwt | controller.adminGetConversationContext | support-chat.service | NOT_TESTED | - |
| 372 | POST | `/api/v1/admin/support-chat/conversations/:id/messages` | support-chat | yes | admin-jwt | controller.adminSendMessage | support-chat.service | NOT_TESTED | - |
| 373 | POST | `/api/v1/admin/support-chat/conversations/:id/read` | support-chat | yes | admin-jwt | controller.adminMarkRead | support-chat.service | NOT_TESTED | - |
| 374 | PATCH | `/api/v1/admin/support-chat/conversations/:id/status` | support-chat | yes | admin-jwt | controller.adminUpdateStatus | support-chat.service | NOT_TESTED | - |
| 375 | GET | `/api/v1/admin/support/agents` | admin | yes | admin|super_admin | supportCtrl.listAgents | admin.service | NOT_TESTED | protectedRouter |
| 376 | GET | `/api/v1/admin/support/canned-responses` | admin | yes | admin|super_admin | supportCtrl.listCannedResponses | admin.service | NOT_TESTED | protectedRouter |
| 377 | GET | `/api/v1/admin/support/categories` | admin | yes | admin|super_admin | supportCtrl.listCategories | admin.service | NOT_TESTED | protectedRouter |
| 378 | GET | `/api/v1/admin/support/faqs` | admin | yes | admin|super_admin | supportCtrl.listFaqs | admin.service | NOT_TESTED | protectedRouter |
| 379 | POST | `/api/v1/admin/support/faqs` | admin | yes | admin|super_admin | supportCtrl.createFaq | admin.service | NOT_TESTED | protectedRouter |
| 380 | DELETE | `/api/v1/admin/support/faqs/:id` | admin | yes | admin|super_admin | supportCtrl.deleteFaq | admin.service | NOT_TESTED | protectedRouter |
| 381 | PATCH | `/api/v1/admin/support/faqs/:id` | admin | yes | admin|super_admin | supportCtrl.updateFaq | admin.service | NOT_TESTED | protectedRouter |
| 382 | GET | `/api/v1/admin/support/feedback` | admin | yes | admin|super_admin | supportCtrl.listFeedback | admin.service | NOT_TESTED | protectedRouter |
| 383 | GET | `/api/v1/admin/support/live-chats` | admin | yes | admin|super_admin | supportCtrl.listLiveChats | admin.service | NOT_TESTED | protectedRouter |
| 384 | POST | `/api/v1/admin/support/live-chats/:id/accept` | admin | yes | admin|super_admin | supportCtrl.acceptLiveChat | admin.service | NOT_TESTED | protectedRouter |
| 385 | POST | `/api/v1/admin/support/live-chats/:id/messages` | admin | yes | admin|super_admin | supportCtrl.sendLiveChatMessage | admin.service | NOT_TESTED | protectedRouter |
| 386 | GET | `/api/v1/admin/support/sla-metrics` | admin | yes | admin|super_admin | supportCtrl.getSlaMetrics | admin.service | NOT_TESTED | protectedRouter |
| 387 | GET | `/api/v1/admin/support/tickets` | admin | yes | admin|super_admin | supportCtrl.listTickets | admin.service | NOT_TESTED | protectedRouter |
| 388 | POST | `/api/v1/admin/support/tickets` | admin | yes | admin|super_admin | supportCtrl.createTicket | admin.service | NOT_TESTED | protectedRouter |
| 389 | GET | `/api/v1/admin/support/tickets/:id` | admin | yes | admin|super_admin | supportCtrl.getTicketById | admin.service | NOT_TESTED | protectedRouter |
| 390 | PATCH | `/api/v1/admin/support/tickets/:id` | admin | yes | admin|super_admin | supportCtrl.updateTicket | admin.service | NOT_TESTED | protectedRouter |
| 391 | POST | `/api/v1/admin/support/tickets/:id/assign` | admin | yes | admin|super_admin | supportCtrl.assignTicket | admin.service | NOT_TESTED | protectedRouter |
| 392 | POST | `/api/v1/admin/support/tickets/:id/close` | admin | yes | admin|super_admin | supportCtrl.closeTicket | admin.service | NOT_TESTED | protectedRouter |
| 393 | POST | `/api/v1/admin/support/tickets/:id/escalate` | admin | yes | admin|super_admin | supportCtrl.escalateTicket | admin.service | NOT_TESTED | protectedRouter |
| 394 | POST | `/api/v1/admin/support/tickets/:id/notes` | admin | yes | admin|super_admin | supportCtrl.addTicketNote | admin.service | NOT_TESTED | protectedRouter |
| 395 | POST | `/api/v1/admin/support/tickets/:id/redelivery` | admin | yes | admin|super_admin | supportCtrl.redeliveryTicket | admin.service | NOT_TESTED | protectedRouter |
| 396 | POST | `/api/v1/admin/support/tickets/:id/refund` | admin | yes | admin|super_admin | supportCtrl.refundTicket | admin.service | NOT_TESTED | protectedRouter |
| 397 | GET | `/api/v1/admin/system/advanced` | admin | yes | admin|super_admin | controller.getAdvanced | system-config.service | NOT_TESTED | system-config.routes.ts |
| 398 | PUT | `/api/v1/admin/system/advanced` | admin | yes | admin|super_admin | controller.updateAdvanced | system-config.service | NOT_TESTED | system-config.routes.ts |
| 399 | GET | `/api/v1/admin/system/api-endpoints` | admin | partial | admin|super_admin;permission-gated | inline-handler | - | NOT_TESTED | MOCK/stub hardcoded success; inline on protectedRouter |
| 400 | GET | `/api/v1/admin/system/api-keys` | admin | yes | admin|super_admin | controller.listApiKeys | system-config.service | NOT_TESTED | system-config.routes.ts |
| 401 | POST | `/api/v1/admin/system/api-keys` | admin | yes | admin|super_admin | controller.createApiKey | system-config.service | NOT_TESTED | system-config.routes.ts |
| 402 | POST | `/api/v1/admin/system/api-keys/:id/revoke` | admin | yes | admin|super_admin | controller.revokeApiKey | system-config.service | NOT_TESTED | system-config.routes.ts |
| 403 | POST | `/api/v1/admin/system/api-keys/:id/rotate` | admin | yes | admin|super_admin | controller.rotateApiKey | system-config.service | NOT_TESTED | system-config.routes.ts |
| 404 | POST | `/api/v1/admin/system/cache/clear` | admin | partial | admin|super_admin;permission-gated | inline-handler | - | NOT_TESTED | MOCK/stub hardcoded success; inline on protectedRouter |
| 405 | GET | `/api/v1/admin/system/cache/stats` | admin | partial | admin|super_admin;permission-gated | inline-handler | - | PARTIAL | MOCK/stub hardcoded success; inline on protectedRouter |
| 406 | GET | `/api/v1/admin/system/cron-jobs` | admin | yes | admin|super_admin | controller.listCronJobs | system-config.service | NOT_TESTED | system-config.routes.ts |
| 407 | PUT | `/api/v1/admin/system/cron-jobs/:jobId` | admin | yes | admin|super_admin | controller.toggleCronJob | system-config.service | NOT_TESTED | system-config.routes.ts |
| 408 | POST | `/api/v1/admin/system/cron-jobs/:jobId/trigger` | admin | yes | admin|super_admin | controller.triggerCronJob | system-config.service | NOT_TESTED | system-config.routes.ts |
| 409 | GET | `/api/v1/admin/system/delivery` | admin | yes | admin|super_admin | controller.getDelivery | system-config.service | NOT_TESTED | system-config.routes.ts |
| 410 | PUT | `/api/v1/admin/system/delivery` | admin | yes | admin|super_admin | controller.updateDelivery | system-config.service | NOT_TESTED | system-config.routes.ts |
| 411 | GET | `/api/v1/admin/system/env-variables` | admin | yes | admin|super_admin | controller.listEnvVariables | system-config.service | NOT_TESTED | system-config.routes.ts |
| 412 | PUT | `/api/v1/admin/system/env-variables/:key` | admin | yes | admin|super_admin | controller.updateEnvVariable | system-config.service | NOT_TESTED | system-config.routes.ts |
| 413 | GET | `/api/v1/admin/system/feature-flags` | admin | yes | admin|super_admin | controller.listFeatureFlags | system-config.service | NOT_TESTED | system-config.routes.ts |
| 414 | PUT | `/api/v1/admin/system/feature-flags/:id/toggle` | admin | yes | admin|super_admin | controller.toggleFeatureFlag | system-config.service | NOT_TESTED | system-config.routes.ts |
| 415 | GET | `/api/v1/admin/system/general` | admin | yes | admin|super_admin | controller.getGeneral | system-config.service | NOT_TESTED | system-config.routes.ts |
| 416 | PUT | `/api/v1/admin/system/general` | admin | yes | admin|super_admin | controller.updateGeneral | system-config.service | NOT_TESTED | system-config.routes.ts |
| 417 | GET | `/api/v1/admin/system/instances` | admin | partial | admin|super_admin;permission-gated | inline-handler | - | FAIL | MOCK/stub hardcoded success; inline on protectedRouter |
| 418 | POST | `/api/v1/admin/system/instances/:id/restart` | admin | partial | admin|super_admin;permission-gated | inline-handler | - | NOT_TESTED | MOCK/stub hardcoded success; inline on protectedRouter |
| 419 | GET | `/api/v1/admin/system/integrations` | admin | yes | admin|super_admin | controller.listIntegrations | system-config.service | NOT_TESTED | system-config.routes.ts |
| 420 | PUT | `/api/v1/admin/system/integrations/:id` | admin | yes | admin|super_admin | controller.updateIntegration | system-config.service | NOT_TESTED | system-config.routes.ts |
| 421 | POST | `/api/v1/admin/system/integrations/:id/test` | admin | yes | admin|super_admin | controller.testIntegration | system-config.service | NOT_TESTED | system-config.routes.ts |
| 422 | GET | `/api/v1/admin/system/logs` | admin | partial | admin|super_admin;permission-gated | inline-handler | - | NOT_TESTED | MOCK/stub hardcoded success; inline on protectedRouter |
| 423 | GET | `/api/v1/admin/system/maintenance` | admin | yes | admin|super_admin | controller.getMaintenanceMode | system-config.service | NOT_TESTED | system-config.routes.ts |
| 424 | POST | `/api/v1/admin/system/maintenance` | admin | yes | admin|super_admin | controller.toggleMaintenanceMode | system-config.service | NOT_TESTED | system-config.routes.ts |
| 425 | GET | `/api/v1/admin/system/migrations` | admin | partial | admin|super_admin;permission-gated | inline-handler | - | NOT_TESTED | MOCK/stub hardcoded success; inline on protectedRouter |
| 426 | GET | `/api/v1/admin/system/notifications` | admin | yes | admin|super_admin | controller.getNotifications | system-config.service | NOT_TESTED | system-config.routes.ts |
| 427 | PUT | `/api/v1/admin/system/notifications` | admin | yes | admin|super_admin | controller.updateNotifications | system-config.service | NOT_TESTED | system-config.routes.ts |
| 428 | GET | `/api/v1/admin/system/payment-gateways` | admin | yes | admin|super_admin | controller.listPaymentGateways | system-config.service | NOT_TESTED | system-config.routes.ts |
| 429 | PUT | `/api/v1/admin/system/payment-gateways/:id` | admin | yes | admin|super_admin | controller.updatePaymentGateway | system-config.service | NOT_TESTED | system-config.routes.ts |
| 430 | GET | `/api/v1/admin/system/performance` | admin | partial | admin|super_admin;permission-gated | inline-handler | - | NOT_TESTED | inline on protectedRouter |
| 431 | GET | `/api/v1/admin/system/server-status` | admin | partial | admin|super_admin;permission-gated | inline-handler | - | NOT_TESTED | inline on protectedRouter |
| 432 | GET | `/api/v1/admin/system/tax-settings` | admin | yes | admin|super_admin | controller.getTax | system-config.service | NOT_TESTED | system-config.routes.ts |
| 433 | PUT | `/api/v1/admin/system/tax-settings` | admin | yes | admin|super_admin | controller.updateTax | system-config.service | NOT_TESTED | system-config.routes.ts |
| 434 | GET | `/api/v1/admin/training-videos` | admin | yes | admin|super_admin | trainingVideosCtrl.listTrainingVideos | admin.service | NOT_TESTED | protectedRouter |
| 435 | POST | `/api/v1/admin/training-videos` | admin | yes | admin|super_admin | trainingVideosCtrl.createTrainingVideo | admin.service | NOT_TESTED | protectedRouter |
| 436 | DELETE | `/api/v1/admin/training-videos/:id` | admin | yes | admin|super_admin | trainingVideosCtrl.deleteTrainingVideo | admin.service | NOT_TESTED | protectedRouter |
| 437 | GET | `/api/v1/admin/training-videos/:id` | admin | yes | admin|super_admin | trainingVideosCtrl.getTrainingVideoById | admin.service | NOT_TESTED | protectedRouter |
| 438 | PUT | `/api/v1/admin/training-videos/:id` | admin | yes | admin|super_admin | trainingVideosCtrl.updateTrainingVideo | admin.service | NOT_TESTED | protectedRouter |
| 439 | GET | `/api/v1/admin/training-videos/picker-progress` | admin | yes | admin|super_admin | trainingVideosCtrl.getPickerProgress | admin.service | NOT_TESTED | protectedRouter |
| 440 | GET | `/api/v1/admin/users` | admin | yes | admin|super_admin;permission-gated | usersController.getUsers | admin.service | NOT_TESTED | protectedRouter |
| 441 | POST | `/api/v1/admin/users` | admin | yes | admin|super_admin;permission-gated | usersController.createUser | admin.service | NOT_TESTED | protectedRouter |
| 442 | DELETE | `/api/v1/admin/users/:id` | admin | yes | admin|super_admin;permission-gated | usersController.deleteUser | admin.service | NOT_TESTED | protectedRouter |
| 443 | GET | `/api/v1/admin/users/:id` | admin | yes | admin|super_admin;permission-gated | usersController.getUserById | admin.service | PASS | protectedRouter |
| 444 | PUT | `/api/v1/admin/users/:id` | admin | yes | admin|super_admin;permission-gated | usersController.updateUser | admin.service | NOT_TESTED | protectedRouter |
| 445 | PUT | `/api/v1/admin/users/:id/reset-password` | admin | yes | admin|super_admin;permission-gated | usersController.resetPassword | admin.service | NOT_TESTED | protectedRouter |
| 446 | PUT | `/api/v1/admin/users/:id/role` | admin | yes | admin|super_admin;permission-gated | usersController.assignRole | admin.service | NOT_TESTED | protectedRouter |
| 447 | POST | `/api/v1/admin/users/bulk` | admin | yes | admin|super_admin;permission-gated | usersController.bulkUserAction | admin.service | NOT_TESTED | protectedRouter |
| 448 | GET | `/api/v1/admin/users/managers` | admin | yes | admin|super_admin;permission-gated | masterDataController.listManagers | admin.service | NOT_TESTED | protectedRouter |
| 449 | GET | `/api/v1/admin/users/me` | admin | yes | admin|super_admin | usersController.getCurrentUserProfile | admin.service | PASS | protectedRouter |
| 450 | GET | `/api/v1/admin/vehicle-types` | admin | yes | admin|super_admin | masterDataController.listVehicleTypes | master-data.service | NOT_TESTED | master-data.routes.ts |
| 451 | POST | `/api/v1/admin/vehicle-types` | admin | yes | admin|super_admin | masterDataController.createVehicleType | master-data.service | NOT_TESTED | master-data.routes.ts |
| 452 | DELETE | `/api/v1/admin/vehicle-types/:id` | admin | yes | admin|super_admin | masterDataController.deleteVehicleType | master-data.service | NOT_TESTED | master-data.routes.ts |
| 453 | GET | `/api/v1/admin/vehicle-types/:id` | admin | yes | admin|super_admin | masterDataController.getVehicleType | master-data.service | NOT_TESTED | master-data.routes.ts |
| 454 | PUT | `/api/v1/admin/vehicle-types/:id` | admin | yes | admin|super_admin | masterDataController.updateVehicleType | master-data.service | NOT_TESTED | master-data.routes.ts |
| 455 | GET | `/api/v1/admin/vendor/approvals` | vendor | yes | admin-jwt | ctrl.listProcurementApprovals | vendor.service | NOT_TESTED | - |
| 456 | POST | `/api/v1/admin/vendor/approvals/:approvalId/approve` | vendor | yes | admin-jwt | ctrl.approveProcurement | vendor.service | NOT_TESTED | - |
| 457 | POST | `/api/v1/admin/vendor/approvals/:approvalId/reject` | vendor | yes | admin-jwt | ctrl.rejectProcurement | vendor.service | NOT_TESTED | - |
| 458 | GET | `/api/v1/admin/vendor/approvals/summary` | vendor | yes | admin-jwt | ctrl.getProcurementApprovalsSummary | vendor.service | NOT_TESTED | - |
| 459 | GET | `/api/v1/admin/vendor/approvals/tasks` | vendor | yes | admin-jwt | ctrl.listProcurementApprovalTasks | vendor.service | NOT_TESTED | - |
| 460 | GET | `/api/v1/admin/vendor/approvals/tasks/:id` | vendor | yes | admin-jwt | ctrl.getProcurementApprovalTaskById | vendor.service | NOT_TESTED | - |
| 461 | POST | `/api/v1/admin/vendor/approvals/tasks/:id/decision` | vendor | yes | admin-jwt | ctrl.submitProcurementDecision | vendor.service | NOT_TESTED | - |
| 462 | GET | `/api/v1/admin/vendor/certificates` | vendor | yes | admin-jwt | ctrl.listCertificates | vendor.service | NOT_TESTED | - |
| 463 | POST | `/api/v1/admin/vendor/certificates` | vendor | yes | admin-jwt | ctrl.createCertificate | vendor.service | NOT_TESTED | - |
| 464 | DELETE | `/api/v1/admin/vendor/certificates/:certificateId` | vendor | yes | admin-jwt | ctrl.deleteCertificate | vendor.service | NOT_TESTED | - |
| 465 | GET | `/api/v1/admin/vendor/certificates/:certificateId` | vendor | yes | admin-jwt | ctrl.getCertificateById | vendor.service | NOT_TESTED | - |
| 466 | PATCH | `/api/v1/admin/vendor/certificates/:certificateId` | vendor | yes | admin-jwt | ctrl.patchCertificate | vendor.service | NOT_TESTED | - |
| 467 | GET | `/api/v1/admin/vendor/dashboard/summary` | vendor | yes | admin-jwt | ctrl.getDashboardSummary | vendor.service | NOT_TESTED | - |
| 468 | POST | `/api/v1/admin/vendor/inbound/bulk-import` | vendor | yes | admin-jwt | ctrl.createBulkImportJob | vendor.service | NOT_TESTED | - |
| 469 | GET | `/api/v1/admin/vendor/inbound/bulk-import/:jobId` | vendor | yes | admin-jwt | ctrl.getBulkImportJobStatus | vendor.service | NOT_TESTED | - |
| 470 | GET | `/api/v1/admin/vendor/inbound/exceptions` | vendor | yes | admin-jwt | ctrl.listInboundExceptions | vendor.service | NOT_TESTED | - |
| 471 | POST | `/api/v1/admin/vendor/inbound/exceptions` | vendor | yes | admin-jwt | ctrl.createInboundException | vendor.service | NOT_TESTED | - |
| 472 | POST | `/api/v1/admin/vendor/inbound/exceptions/:exceptionId/resolve` | vendor | yes | admin-jwt | ctrl.resolveInboundException | vendor.service | NOT_TESTED | - |
| 473 | GET | `/api/v1/admin/vendor/inbound/grn` | vendor | yes | admin-jwt | ctrl.listGRNs | vendor.service | NOT_TESTED | - |
| 474 | POST | `/api/v1/admin/vendor/inbound/grn` | vendor | yes | admin-jwt | ctrl.createGRN | vendor.service | NOT_TESTED | - |
| 475 | GET | `/api/v1/admin/vendor/inbound/grn/:grnId` | vendor | yes | admin-jwt | ctrl.getGRNById | vendor.service | NOT_TESTED | - |
| 476 | PUT | `/api/v1/admin/vendor/inbound/grn/:grnId` | vendor | yes | admin-jwt | ctrl.updateGRN | vendor.service | NOT_TESTED | - |
| 477 | GET | `/api/v1/admin/vendor/inbound/grns` | vendor | yes | admin-jwt | ctrl.listGRNs | vendor.service | NOT_TESTED | - |
| 478 | POST | `/api/v1/admin/vendor/inbound/grns` | vendor | yes | admin-jwt | ctrl.createGRN | vendor.service | NOT_TESTED | - |
| 479 | GET | `/api/v1/admin/vendor/inbound/grns/:grnId` | vendor | yes | admin-jwt | ctrl.getGRNById | vendor.service | NOT_TESTED | - |
| 480 | PUT | `/api/v1/admin/vendor/inbound/grns/:grnId` | vendor | yes | admin-jwt | ctrl.updateGRN | vendor.service | NOT_TESTED | - |
| 481 | POST | `/api/v1/admin/vendor/inbound/grns/:grnId/approve` | vendor | yes | admin-jwt | ctrl.approveGRN | vendor.service | NOT_TESTED | - |
| 482 | POST | `/api/v1/admin/vendor/inbound/grns/:grnId/archive` | vendor | yes | admin-jwt | ctrl.archiveGRN | vendor.service | NOT_TESTED | - |
| 483 | POST | `/api/v1/admin/vendor/inbound/grns/:grnId/reject` | vendor | yes | admin-jwt | ctrl.rejectGRN | vendor.service | NOT_TESTED | - |
| 484 | PATCH | `/api/v1/admin/vendor/inbound/grns/:grnId/status` | vendor | yes | admin-jwt | ctrl.patchGRNStatus | vendor.service | NOT_TESTED | - |
| 485 | GET | `/api/v1/admin/vendor/inbound/overview` | vendor | yes | admin-jwt | ctrl.getInboundOverview | vendor.service | NOT_TESTED | - |
| 486 | GET | `/api/v1/admin/vendor/inbound/report` | vendor | yes | admin-jwt | ctrl.getInboundReport | vendor.service | NOT_TESTED | - |
| 487 | GET | `/api/v1/admin/vendor/inbound/rtvs` | vendor | yes | admin-jwt | ctrl.listRTVs | vendor.service | NOT_TESTED | - |
| 488 | POST | `/api/v1/admin/vendor/inbound/rtvs` | vendor | yes | admin-jwt | ctrl.createRTV | vendor.service | NOT_TESTED | - |
| 489 | PATCH | `/api/v1/admin/vendor/inbound/rtvs/:rtvId/status` | vendor | yes | admin-jwt | ctrl.patchRTVStatus | vendor.service | NOT_TESTED | - |
| 490 | GET | `/api/v1/admin/vendor/inbound/shipments` | vendor | yes | admin-jwt | ctrl.listShipments | vendor.service | NOT_TESTED | - |
| 491 | POST | `/api/v1/admin/vendor/inbound/shipments` | vendor | yes | admin-jwt | ctrl.createShipment | vendor.service | NOT_TESTED | - |
| 492 | PATCH | `/api/v1/admin/vendor/inbound/shipments/:shipmentId/status` | vendor | yes | admin-jwt | ctrl.patchShipmentStatus | vendor.service | NOT_TESTED | - |
| 493 | GET | `/api/v1/admin/vendor/inventory` | vendor | yes | admin-jwt | ctrl.listVendorInventory | vendor.service | NOT_TESTED | - |
| 494 | GET | `/api/v1/admin/vendor/inventory/:vendorId` | vendor | yes | admin-jwt | ctrl.getVendorInventorySummary | vendor.service | NOT_TESTED | - |
| 495 | GET | `/api/v1/admin/vendor/inventory/:vendorId/aging-alerts` | vendor | yes | admin-jwt | ctrl.listVendorAgingAlerts | vendor.service | NOT_TESTED | - |
| 496 | POST | `/api/v1/admin/vendor/inventory/:vendorId/aging-alerts/:alertId/ack` | vendor | yes | admin-jwt | ctrl.ackVendorAgingAlert | vendor.service | NOT_TESTED | - |
| 497 | GET | `/api/v1/admin/vendor/inventory/:vendorId/aging-inventory` | vendor | yes | admin-jwt | ctrl.getVendorAgingInventory | vendor.service | NOT_TESTED | - |
| 498 | POST | `/api/v1/admin/vendor/inventory/:vendorId/aging-inventory/:itemId/liquidate` | vendor | yes | admin-jwt | ctrl.liquidateAgingItem | vendor.service | NOT_TESTED | - |
| 499 | POST | `/api/v1/admin/vendor/inventory/:vendorId/aging-inventory/:itemId/return` | vendor | yes | admin-jwt | ctrl.returnAgingItem | vendor.service | NOT_TESTED | - |
| 500 | GET | `/api/v1/admin/vendor/inventory/:vendorId/kpis` | vendor | yes | admin-jwt | ctrl.getVendorInventoryKPIs | vendor.service | NOT_TESTED | - |
| 501 | POST | `/api/v1/admin/vendor/inventory/:vendorId/reconcile` | vendor | yes | admin-jwt | ctrl.reconcileVendorInventory | vendor.service | NOT_TESTED | - |
| 502 | GET | `/api/v1/admin/vendor/inventory/:vendorId/stock` | vendor | yes | admin-jwt | ctrl.listVendorStock | vendor.service | NOT_TESTED | - |
| 503 | GET | `/api/v1/admin/vendor/inventory/:vendorId/stockouts` | vendor | yes | admin-jwt | ctrl.getVendorStockouts | vendor.service | NOT_TESTED | - |
| 504 | POST | `/api/v1/admin/vendor/inventory/:vendorId/stockouts/alert-all` | vendor | yes | admin-jwt | ctrl.alertAllVendorsStockout | vendor.service | NOT_TESTED | - |
| 505 | POST | `/api/v1/admin/vendor/inventory/:vendorId/stockouts/bulk-reorder` | vendor | yes | admin-jwt | ctrl.bulkReorderStockouts | vendor.service | NOT_TESTED | - |
| 506 | GET | `/api/v1/admin/vendor/inventory/:vendorId/supply-performance` | vendor | yes | admin-jwt | ctrl.getVendorSupplyPerformance | vendor.service | NOT_TESTED | - |
| 507 | POST | `/api/v1/admin/vendor/inventory/:vendorId/sync` | vendor | yes | admin-jwt | ctrl.syncVendorInventory | vendor.service | NOT_TESTED | - |
| 508 | GET | `/api/v1/admin/vendor/inventory/hub/aging-alerts` | vendor | yes | admin-jwt | ctrl.listHubAgingAlerts | vendor.service | NOT_TESTED | - |
| 509 | GET | `/api/v1/admin/vendor/invoices` | vendor | yes | admin-jwt | ctrl.listVendorInvoices | vendor.service | NOT_TESTED | - |
| 510 | GET | `/api/v1/admin/vendor/invoices/:id` | vendor | yes | admin-jwt | ctrl.getVendorInvoiceById | vendor.service | NOT_TESTED | - |
| 511 | POST | `/api/v1/admin/vendor/invoices/:id/approve` | vendor | yes | admin-jwt | ctrl.approveVendorInvoice | vendor.service | NOT_TESTED | - |
| 512 | POST | `/api/v1/admin/vendor/invoices/:id/mark-paid` | vendor | yes | admin-jwt | ctrl.markVendorInvoicePaid | vendor.service | NOT_TESTED | - |
| 513 | POST | `/api/v1/admin/vendor/invoices/:id/reject` | vendor | yes | admin-jwt | ctrl.rejectVendorInvoice | vendor.service | NOT_TESTED | - |
| 514 | GET | `/api/v1/admin/vendor/notifications` | vendor | yes | admin-jwt | ctrl.listVendorNotifications | vendor.service | NOT_TESTED | - |
| 515 | PATCH | `/api/v1/admin/vendor/notifications/:notifId/read` | vendor | yes | admin-jwt | ctrl.markVendorNotificationRead | vendor.service | NOT_TESTED | - |
| 516 | PUT | `/api/v1/admin/vendor/notifications/:notifId/read` | vendor | yes | admin-jwt | ctrl.markVendorNotificationRead | vendor.service | NOT_TESTED | - |
| 517 | POST | `/api/v1/admin/vendor/notifications/read-all` | vendor | yes | admin-jwt | ctrl.markAllVendorNotificationsRead | vendor.service | NOT_TESTED | - |
| 518 | GET | `/api/v1/admin/vendor/payments` | vendor | yes | admin-jwt | ctrl.listVendorPayments | vendor.service | NOT_TESTED | - |
| 519 | POST | `/api/v1/admin/vendor/payments` | vendor | yes | admin-jwt | ctrl.createVendorPayment | vendor.service | NOT_TESTED | - |
| 520 | POST | `/api/v1/admin/vendor/payments/:paymentId/cancel` | vendor | yes | admin-jwt | ctrl.cancelVendorPayment | vendor.service | NOT_TESTED | - |
| 521 | POST | `/api/v1/admin/vendor/public/complete-profile` | vendor | yes | admin-jwt | ctrl.completeVendorProfile | vendor.service | NOT_TESTED | - |
| 522 | POST | `/api/v1/admin/vendor/public/upload-documents/:vendorId` | vendor | yes | admin-jwt | ctrl.uploadVendorDocuments | vendor.service | NOT_TESTED | - |
| 523 | GET | `/api/v1/admin/vendor/public/verify-token` | vendor | yes | admin-jwt | ctrl.verifyInviteToken | vendor.service | NOT_TESTED | - |
| 524 | GET | `/api/v1/admin/vendor/purchase-orders` | vendor | yes | admin-jwt | ctrl.listPurchaseOrders | vendor.service | NOT_TESTED | - |
| 525 | POST | `/api/v1/admin/vendor/purchase-orders` | vendor | yes | admin-jwt | ctrl.createPurchaseOrder | vendor.service | NOT_TESTED | - |
| 526 | DELETE | `/api/v1/admin/vendor/purchase-orders/:poId` | vendor | yes | admin-jwt | ctrl.deletePurchaseOrder | vendor.service | NOT_TESTED | - |
| 527 | GET | `/api/v1/admin/vendor/purchase-orders/:poId` | vendor | yes | admin-jwt | ctrl.getPurchaseOrderById | vendor.service | NOT_TESTED | - |
| 528 | PATCH | `/api/v1/admin/vendor/purchase-orders/:poId` | vendor | yes | admin-jwt | ctrl.updatePurchaseOrder | vendor.service | NOT_TESTED | - |
| 529 | PUT | `/api/v1/admin/vendor/purchase-orders/:poId` | vendor | yes | admin-jwt | ctrl.updatePurchaseOrder | vendor.service | NOT_TESTED | - |
| 530 | POST | `/api/v1/admin/vendor/purchase-orders/:poId/actions` | vendor | yes | admin-jwt | ctrl.postPurchaseOrderAction | vendor.service | NOT_TESTED | - |
| 531 | POST | `/api/v1/admin/vendor/purchase-orders/:poId/approve` | vendor | yes | admin-jwt | ctrl.approvePurchaseOrder | vendor.service | NOT_TESTED | - |
| 532 | GET | `/api/v1/admin/vendor/purchase-orders/:poId/events` | vendor | yes | admin-jwt | ctrl.getPurchaseOrderEvents | vendor.service | NOT_TESTED | - |
| 533 | POST | `/api/v1/admin/vendor/purchase-orders/:poId/reject` | vendor | yes | admin-jwt | ctrl.rejectPurchaseOrder | vendor.service | NOT_TESTED | - |
| 534 | POST | `/api/v1/admin/vendor/purchase-orders/bulk-upload` | vendor | yes | admin-jwt | ctrl.bulkUploadPurchaseOrders | vendor.service | NOT_TESTED | - |
| 535 | GET | `/api/v1/admin/vendor/purchase-orders/overview` | vendor | yes | admin-jwt | ctrl.getPurchaseOrderOverview | vendor.service | NOT_TESTED | - |
| 536 | GET | `/api/v1/admin/vendor/qc` | vendor | yes | admin-jwt | ctrl.listQCChecks | vendor.service | NOT_TESTED | - |
| 537 | POST | `/api/v1/admin/vendor/qc` | vendor | yes | admin-jwt | ctrl.createQCCheck | vendor.service | NOT_TESTED | - |
| 538 | GET | `/api/v1/admin/vendor/qc-compliance/audits` | vendor | yes | admin-jwt | ctrl.listQCComplianceAudits | vendor.service | NOT_TESTED | - |
| 539 | POST | `/api/v1/admin/vendor/qc-compliance/audits` | vendor | yes | admin-jwt | ctrl.createQCComplianceAudit | vendor.service | NOT_TESTED | - |
| 540 | DELETE | `/api/v1/admin/vendor/qc-compliance/audits/:id` | vendor | yes | admin-jwt | ctrl.deleteQCComplianceAudit | vendor.service | NOT_TESTED | - |
| 541 | GET | `/api/v1/admin/vendor/qc-compliance/audits/:id` | vendor | yes | admin-jwt | ctrl.getQCComplianceAuditById | vendor.service | NOT_TESTED | - |
| 542 | PATCH | `/api/v1/admin/vendor/qc-compliance/audits/:id` | vendor | yes | admin-jwt | ctrl.updateQCComplianceAudit | vendor.service | NOT_TESTED | - |
| 543 | GET | `/api/v1/admin/vendor/qc-compliance/certificates` | vendor | yes | admin-jwt | ctrl.listQCComplianceCertificates | vendor.service | NOT_TESTED | - |
| 544 | POST | `/api/v1/admin/vendor/qc-compliance/certificates` | vendor | yes | admin-jwt | ctrl.createQCComplianceCertificate | vendor.service | NOT_TESTED | - |
| 545 | DELETE | `/api/v1/admin/vendor/qc-compliance/certificates/:certId` | vendor | yes | admin-jwt | ctrl.deleteQCComplianceCertificate | vendor.service | NOT_TESTED | - |
| 546 | PATCH | `/api/v1/admin/vendor/qc-compliance/certificates/:certId` | vendor | yes | admin-jwt | ctrl.updateQCComplianceCertificate | vendor.service | NOT_TESTED | - |
| 547 | GET | `/api/v1/admin/vendor/qc-compliance/ratings` | vendor | yes | admin-jwt | ctrl.listVendorRatings | vendor.service | NOT_TESTED | - |
| 548 | DELETE | `/api/v1/admin/vendor/qc-compliance/ratings/:vendorId` | vendor | yes | admin-jwt | ctrl.deleteVendorRating | vendor.service | NOT_TESTED | - |
| 549 | PATCH | `/api/v1/admin/vendor/qc-compliance/ratings/:vendorId` | vendor | yes | admin-jwt | ctrl.updateVendorRating | vendor.service | NOT_TESTED | - |
| 550 | POST | `/api/v1/admin/vendor/qc-compliance/ratings/:vendorId/recalculate` | vendor | yes | admin-jwt | ctrl.recalculateVendorRating | vendor.service | NOT_TESTED | - |
| 551 | GET | `/api/v1/admin/vendor/qc-compliance/temperature` | vendor | yes | admin-jwt | ctrl.listQCTemperature | vendor.service | NOT_TESTED | - |
| 552 | POST | `/api/v1/admin/vendor/qc-compliance/temperature` | vendor | yes | admin-jwt | ctrl.createQCTemperature | vendor.service | NOT_TESTED | - |
| 553 | DELETE | `/api/v1/admin/vendor/qc-compliance/temperature/:tempId` | vendor | yes | admin-jwt | ctrl.deleteQCTemperature | vendor.service | NOT_TESTED | - |
| 554 | PATCH | `/api/v1/admin/vendor/qc-compliance/temperature/:tempId` | vendor | yes | admin-jwt | ctrl.updateQCTemperature | vendor.service | NOT_TESTED | - |
| 555 | PUT | `/api/v1/admin/vendor/qc/:checkId` | vendor | yes | admin-jwt | ctrl.updateQCCheck | vendor.service | NOT_TESTED | - |
| 556 | DELETE | `/api/v1/admin/vendor/qc/:qcId` | vendor | yes | admin-jwt | ctrl.deleteQCCheck | vendor.service | NOT_TESTED | - |
| 557 | GET | `/api/v1/admin/vendor/qc/:qcId` | vendor | yes | admin-jwt | ctrl.getQCCheck | vendor.service | NOT_TESTED | - |
| 558 | PATCH | `/api/v1/admin/vendor/qc/:qcId` | vendor | yes | admin-jwt | ctrl.patchQCCheck | vendor.service | NOT_TESTED | - |
| 559 | GET | `/api/v1/admin/vendor/qc/overview` | vendor | yes | admin-jwt | ctrl.getQCOverview | vendor.service | NOT_TESTED | - |
| 560 | GET | `/api/v1/admin/vendor/reports` | vendor | yes | admin-jwt | ctrl.getReports | vendor.service | NOT_TESTED | - |
| 561 | GET | `/api/v1/admin/vendor/reports/customers/insights` | vendor | yes | admin-jwt | ctrl.getCustomerInsights | vendor.service | NOT_TESTED | - |
| 562 | GET | `/api/v1/admin/vendor/reports/customers/top` | vendor | yes | admin-jwt | ctrl.getTopCustomers | vendor.service | NOT_TESTED | - |
| 563 | GET | `/api/v1/admin/vendor/reports/financial/summary` | vendor | yes | admin-jwt | ctrl.getFinancialSummary | vendor.service | NOT_TESTED | - |
| 564 | GET | `/api/v1/admin/vendor/reports/orders/analytics` | vendor | yes | admin-jwt | ctrl.getOrderAnalytics | vendor.service | NOT_TESTED | - |
| 565 | GET | `/api/v1/admin/vendor/reports/products/performance` | vendor | yes | admin-jwt | ctrl.getProductPerformance | vendor.service | NOT_TESTED | - |
| 566 | GET | `/api/v1/admin/vendor/reports/revenue/category` | vendor | yes | admin-jwt | ctrl.getRevenueByCategory | vendor.service | NOT_TESTED | - |
| 567 | GET | `/api/v1/admin/vendor/reports/sales/data` | vendor | yes | admin-jwt | ctrl.getSalesData | vendor.service | NOT_TESTED | - |
| 568 | GET | `/api/v1/admin/vendor/reports/sales/hourly` | vendor | yes | admin-jwt | ctrl.getHourlySales | vendor.service | NOT_TESTED | - |
| 569 | GET | `/api/v1/admin/vendor/reports/sales/overview` | vendor | yes | admin-jwt | ctrl.getSalesOverview | vendor.service | NOT_TESTED | - |
| 570 | GET | `/api/v1/admin/vendor/system-gateway/logs` | vendor | yes | admin-jwt | ctrl.getSystemGatewayLogs | vendor.service | NOT_TESTED | - |
| 571 | POST | `/api/v1/admin/vendor/system-gateway/logs` | vendor | yes | admin-jwt | ctrl.createSystemGatewayLog | vendor.service | NOT_TESTED | - |
| 572 | GET | `/api/v1/admin/vendor/system-gateway/services` | vendor | yes | admin-jwt | ctrl.listSystemGatewayServices | vendor.service | NOT_TESTED | - |
| 573 | POST | `/api/v1/admin/vendor/system-gateway/services` | vendor | yes | admin-jwt | ctrl.upsertSystemGatewayService | vendor.service | NOT_TESTED | - |
| 574 | GET | `/api/v1/admin/vendor/system-gateway/services/:id` | vendor | yes | admin-jwt | ctrl.getSystemGatewayServiceById | vendor.service | NOT_TESTED | - |
| 575 | PUT | `/api/v1/admin/vendor/system-gateway/services/:id` | vendor | yes | admin-jwt | ctrl.upsertSystemGatewayService | vendor.service | NOT_TESTED | - |
| 576 | GET | `/api/v1/admin/vendor/utilities/audit-logs` | vendor | yes | admin-jwt | ctrl.getVendorAuditLogs | vendor.service | NOT_TESTED | - |
| 577 | POST | `/api/v1/admin/vendor/utilities/audit-logs/export` | vendor | yes | admin-jwt | ctrl.exportVendorAuditLogs | vendor.service | NOT_TESTED | - |
| 578 | POST | `/api/v1/admin/vendor/utilities/bulk-upload` | vendor | yes | admin-jwt | ctrl.bulkUploadUtility | vendor.service | NOT_TESTED | - |
| 579 | GET | `/api/v1/admin/vendor/utilities/bulk-upload/template` | vendor | yes | admin-jwt | ctrl.getBulkUploadTemplate | vendor.service | NOT_TESTED | - |
| 580 | GET | `/api/v1/admin/vendor/utilities/contracts` | vendor | yes | admin-jwt | ctrl.listUtilityContracts | vendor.service | NOT_TESTED | - |
| 581 | POST | `/api/v1/admin/vendor/utilities/contracts` | vendor | yes | admin-jwt | ctrl.createUtilityContract | vendor.service | NOT_TESTED | - |
| 582 | DELETE | `/api/v1/admin/vendor/utilities/contracts/:contractId` | vendor | yes | admin-jwt | ctrl.deleteUtilityContract | vendor.service | NOT_TESTED | - |
| 583 | GET | `/api/v1/admin/vendor/utilities/upload-history` | vendor | yes | admin-jwt | ctrl.getUploadHistory | vendor.service | NOT_TESTED | - |
| 584 | GET | `/api/v1/admin/vendor/vendors` | vendor | yes | admin-jwt | ctrl.listVendors | vendor.service | NOT_TESTED | - |
| 585 | POST | `/api/v1/admin/vendor/vendors` | vendor | yes | admin-jwt | ctrl.createVendor | vendor.service | NOT_TESTED | - |
| 586 | DELETE | `/api/v1/admin/vendor/vendors/:vendorId` | vendor | yes | admin-jwt | ctrl.archiveVendor | vendor.service | NOT_TESTED | - |
| 587 | GET | `/api/v1/admin/vendor/vendors/:vendorId` | vendor | yes | admin-jwt | ctrl.getVendorById | vendor.service | NOT_TESTED | - |
| 588 | PATCH | `/api/v1/admin/vendor/vendors/:vendorId` | vendor | yes | admin-jwt | ctrl.updateVendor | vendor.service | NOT_TESTED | - |
| 589 | PUT | `/api/v1/admin/vendor/vendors/:vendorId` | vendor | yes | admin-jwt | ctrl.updateVendor | vendor.service | NOT_TESTED | - |
| 590 | POST | `/api/v1/admin/vendor/vendors/:vendorId/actions` | vendor | yes | admin-jwt | ctrl.postVendorAction | vendor.service | NOT_TESTED | - |
| 591 | GET | `/api/v1/admin/vendor/vendors/:vendorId/alerts` | vendor | yes | admin-jwt | ctrl.listVendorAlerts | vendor.service | NOT_TESTED | - |
| 592 | POST | `/api/v1/admin/vendor/vendors/:vendorId/alerts` | vendor | yes | admin-jwt | ctrl.createVendorAlert | vendor.service | NOT_TESTED | - |
| 593 | GET | `/api/v1/admin/vendor/vendors/:vendorId/certificates` | vendor | yes | admin-jwt | ctrl.listCertificates | vendor.service | NOT_TESTED | - |
| 594 | GET | `/api/v1/admin/vendor/vendors/:vendorId/health` | vendor | yes | admin-jwt | ctrl.getVendorHealth | vendor.service | NOT_TESTED | - |
| 595 | GET | `/api/v1/admin/vendor/vendors/:vendorId/inventory` | vendor | yes | admin-jwt | ctrl.listVendorInventory | vendor.service | NOT_TESTED | - |
| 596 | GET | `/api/v1/admin/vendor/vendors/:vendorId/invoices` | vendor | yes | admin-jwt | ctrl.listVendorInvoices | vendor.service | NOT_TESTED | - |
| 597 | GET | `/api/v1/admin/vendor/vendors/:vendorId/notifications` | vendor | yes | admin-jwt | ctrl.listVendorNotifications | vendor.service | NOT_TESTED | - |
| 598 | GET | `/api/v1/admin/vendor/vendors/:vendorId/performance` | vendor | yes | admin-jwt | ctrl.getVendorPerformance | vendor.service | NOT_TESTED | - |
| 599 | GET | `/api/v1/admin/vendor/vendors/:vendorId/purchase-orders` | vendor | yes | admin-jwt | ctrl.listVendorPurchaseOrders | vendor.service | NOT_TESTED | - |
| 600 | GET | `/api/v1/admin/vendor/vendors/:vendorId/qc-checks` | vendor | yes | admin-jwt | ctrl.listVendorQCChecks | vendor.service | NOT_TESTED | - |
| 601 | POST | `/api/v1/admin/vendor/vendors/:vendorId/qc-checks` | vendor | yes | admin-jwt | ctrl.createVendorQCCheck | vendor.service | NOT_TESTED | - |
| 602 | PATCH | `/api/v1/admin/vendor/vendors/:vendorId/stage` | vendor | yes | admin-jwt | ctrl.updateVendorStage | vendor.service | NOT_TESTED | - |
| 603 | GET | `/api/v1/admin/vendor/vendors/email-preview/:templateName` | vendor | yes | admin-jwt | ctrl.getEmailTemplatePreview | vendor.service | NOT_TESTED | - |
| 604 | POST | `/api/v1/admin/vendor/vendors/send-doc-request-email` | vendor | yes | admin-jwt | ctrl.sendDocumentRequestEmail | vendor.service | NOT_TESTED | - |
| 605 | POST | `/api/v1/admin/vendor/vendors/send-invite-email` | vendor | yes | admin-jwt | ctrl.sendInviteEmail | vendor.service | NOT_TESTED | - |
| 606 | POST | `/api/v1/admin/vendor/vendors/send-payment-email` | vendor | yes | admin-jwt | ctrl.sendPaymentEmail | vendor.service | NOT_TESTED | - |
| 607 | POST | `/api/v1/admin/vendor/vendors/send-rejection-email` | vendor | yes | admin-jwt | ctrl.sendRejectionEmail | vendor.service | NOT_TESTED | - |
| 608 | GET | `/api/v1/admin/vendor/vendors/summary` | vendor | yes | admin-jwt | ctrl.getVendorSummary | vendor.service | NOT_TESTED | - |
| 609 | POST | `/api/v1/admin/vendor/webhooks/carrier` | vendor | yes | admin-jwt | ctrl.handleCarrierWebhook | vendor.service | NOT_TESTED | - |
| 610 | POST | `/api/v1/admin/vendor/webhooks/vendor-signed` | vendor | yes | admin-jwt | ctrl.handleVendorSignedWebhook | vendor.service | NOT_TESTED | - |
| 611 | GET | `/api/v1/admin/warehouses` | admin | yes | admin|super_admin | storeWarehouseController.listWarehouses | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 612 | POST | `/api/v1/admin/warehouses` | admin | yes | admin|super_admin | storeWarehouseController.createWarehouse | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 613 | DELETE | `/api/v1/admin/warehouses/:id` | admin | yes | admin|super_admin | storeWarehouseController.deleteWarehouse | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 614 | GET | `/api/v1/admin/warehouses/:id` | admin | yes | admin|super_admin | storeWarehouseController.getWarehouse | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 615 | PUT | `/api/v1/admin/warehouses/:id` | admin | yes | admin|super_admin | storeWarehouseController.updateWarehouse | store-warehouse.service | NOT_TESTED | store-warehouse.routes.ts |
| 616 | GET | `/api/v1/admin/zones` | admin | yes | admin|super_admin | masterDataController.listZones | master-data.service | NOT_TESTED | master-data.routes.ts |
| 617 | POST | `/api/v1/admin/zones` | admin | yes | admin|super_admin | masterDataController.createZone | master-data.service | NOT_TESTED | master-data.routes.ts |
| 618 | DELETE | `/api/v1/admin/zones/:id` | admin | yes | admin|super_admin | masterDataController.deleteZone | master-data.service | NOT_TESTED | master-data.routes.ts |
| 619 | GET | `/api/v1/admin/zones/:id` | admin | yes | admin|super_admin | masterDataController.getZone | master-data.service | NOT_TESTED | master-data.routes.ts |
| 620 | PUT | `/api/v1/admin/zones/:id` | admin | yes | admin|super_admin | masterDataController.updateZone | master-data.service | NOT_TESTED | master-data.routes.ts |
| 621 | GET | `/api/v1/customer/addresses` | addresses | yes | customer-jwt | addressesController.list | addresses.service | NOT_TESTED | - |
| 622 | POST | `/api/v1/customer/addresses` | addresses | yes | customer-jwt | addressesController.create | addresses.service | NOT_TESTED | - |
| 623 | DELETE | `/api/v1/customer/addresses/:id` | addresses | yes | customer-jwt | addressesController.remove | addresses.service | NOT_TESTED | - |
| 624 | PUT | `/api/v1/customer/addresses/:id` | addresses | yes | customer-jwt | addressesController.update | addresses.service | NOT_TESTED | - |
| 625 | POST | `/api/v1/customer/addresses/:id/default` | addresses | yes | customer-jwt | addressesController.setDefault | addresses.service | NOT_TESTED | - |
| 626 | GET | `/api/v1/customer/addresses/default` | addresses | yes | customer-jwt | addressesController.getDefault | addresses.service | NOT_TESTED | - |
| 627 | GET | `/api/v1/customer/admin/app-config` | app-config | yes | admin-jwt | ctrl.adminGetConfig | app-config.service | NOT_TESTED | - |
| 628 | PUT | `/api/v1/customer/admin/app-config` | app-config | yes | admin-jwt | ctrl.adminUpdateConfig | app-config.service | NOT_TESTED | - |
| 629 | GET | `/api/v1/customer/admin/app-config/cancellation-policies` | app-config | yes | admin-jwt | ctrl.listPolicies | app-config.service | NOT_TESTED | - |
| 630 | POST | `/api/v1/customer/admin/app-config/cancellation-policies` | app-config | yes | admin-jwt | ctrl.createPolicy | app-config.service | NOT_TESTED | - |
| 631 | DELETE | `/api/v1/customer/admin/app-config/cancellation-policies/:id` | app-config | yes | admin-jwt | ctrl.deletePolicy | app-config.service | NOT_TESTED | - |
| 632 | GET | `/api/v1/customer/admin/app-config/cancellation-policies/:id` | app-config | yes | admin-jwt | ctrl.getPolicyById | app-config.service | NOT_TESTED | - |
| 633 | PUT | `/api/v1/customer/admin/app-config/cancellation-policies/:id` | app-config | yes | admin-jwt | ctrl.updatePolicy | app-config.service | NOT_TESTED | - |
| 634 | POST | `/api/v1/customer/admin/app-config/reset` | app-config | yes | admin-jwt | ctrl.adminResetConfig | app-config.service | NOT_TESTED | - |
| 635 | PUT | `/api/v1/customer/admin/app-config/section/:section` | app-config | yes | admin-jwt | ctrl.adminUpdateSection | app-config.service | NOT_TESTED | - |
| 636 | GET | `/api/v1/customer/admin/banners` | banners | no | - | bannersController.listBanners | banners.service | NOT_TESTED | - |
| 637 | POST | `/api/v1/customer/admin/banners` | banners | no | - | bannersController.createBanner | banners.service | NOT_TESTED | - |
| 638 | DELETE | `/api/v1/customer/admin/banners/:id` | banners | no | - | bannersController.deleteBanner | banners.service | NOT_TESTED | - |
| 639 | PUT | `/api/v1/customer/admin/banners/:id` | banners | no | - | bannersController.updateBanner | banners.service | NOT_TESTED | - |
| 640 | POST | `/api/v1/customer/admin/banners/reorder` | banners | no | - | bannersController.reorderBanners | banners.service | NOT_TESTED | - |
| 641 | GET | `/api/v1/customer/admin/cancellation-policies` | app-config | yes | admin-jwt | ctrl.listPolicies | app-config.service | NOT_TESTED | - |
| 642 | POST | `/api/v1/customer/admin/cancellation-policies` | app-config | yes | admin-jwt | ctrl.createPolicy | app-config.service | NOT_TESTED | - |
| 643 | DELETE | `/api/v1/customer/admin/cancellation-policies/:id` | app-config | yes | admin-jwt | ctrl.deletePolicy | app-config.service | NOT_TESTED | - |
| 644 | GET | `/api/v1/customer/admin/cancellation-policies/:id` | app-config | yes | admin-jwt | ctrl.getPolicyById | app-config.service | NOT_TESTED | - |
| 645 | PUT | `/api/v1/customer/admin/cancellation-policies/:id` | app-config | yes | admin-jwt | ctrl.updatePolicy | app-config.service | NOT_TESTED | - |
| 646 | GET | `/api/v1/customer/admin/categories` | categories | no | - | categoriesController.listCategories | categories.service | NOT_TESTED | - |
| 647 | POST | `/api/v1/customer/admin/categories` | categories | no | - | categoriesController.createCategory | categories.service | NOT_TESTED | - |
| 648 | DELETE | `/api/v1/customer/admin/categories/:id` | categories | no | - | categoriesController.deleteCategory | categories.service | NOT_TESTED | - |
| 649 | PUT | `/api/v1/customer/admin/categories/:id` | categories | no | - | categoriesController.updateCategory | categories.service | NOT_TESTED | - |
| 650 | GET | `/api/v1/customer/admin/categories/:id/children` | categories | no | - | categoriesController.getSubcategoriesByCategorySlug | categories.service | NOT_TESTED | - |
| 651 | GET | `/api/v1/customer/admin/categories/all` | categories | no | - | categoriesController.listAllCategories | categories.service | NOT_TESTED | - |
| 652 | POST | `/api/v1/customer/admin/categories/reorder` | categories | no | - | categoriesController.reorderCategories | categories.service | NOT_TESTED | - |
| 653 | GET | `/api/v1/customer/admin/cms/banners` | pages | no | - | cmsAdminController.listBanners | cms.service | NOT_TESTED | - |
| 654 | POST | `/api/v1/customer/admin/cms/banners` | pages | no | - | cmsAdminController.createBanner | cms.service | NOT_TESTED | - |
| 655 | DELETE | `/api/v1/customer/admin/cms/banners/:id` | pages | no | - | cmsAdminController.deleteBanner | cms.service | NOT_TESTED | - |
| 656 | PUT | `/api/v1/customer/admin/cms/banners/:id` | pages | no | - | cmsAdminController.updateBanner | cms.service | NOT_TESTED | - |
| 657 | GET | `/api/v1/customer/admin/cms/buttons` | pages | no | - | cmsAdminController.listButtons | cms.service | NOT_TESTED | - |
| 658 | POST | `/api/v1/customer/admin/cms/buttons` | pages | no | - | cmsAdminController.createButton | cms.service | NOT_TESTED | - |
| 659 | DELETE | `/api/v1/customer/admin/cms/buttons/:id` | pages | no | - | cmsAdminController.deleteButton | cms.service | NOT_TESTED | - |
| 660 | PUT | `/api/v1/customer/admin/cms/buttons/:id` | pages | no | - | cmsAdminController.updateButton | cms.service | NOT_TESTED | - |
| 661 | GET | `/api/v1/customer/admin/cms/collections` | pages | no | - | cmsAdminController.listCollections | cms.service | NOT_TESTED | - |
| 662 | POST | `/api/v1/customer/admin/cms/collections` | pages | no | - | cmsAdminController.createCollection | cms.service | NOT_TESTED | - |
| 663 | DELETE | `/api/v1/customer/admin/cms/collections/:id` | pages | no | - | cmsAdminController.deleteCollection | cms.service | NOT_TESTED | - |
| 664 | PUT | `/api/v1/customer/admin/cms/collections/:id` | pages | no | - | cmsAdminController.updateCollection | cms.service | NOT_TESTED | - |
| 665 | POST | `/api/v1/customer/admin/cms/consolidate-catalog-taxonomy` | pages | no | - | cmsAdminController.consolidateCatalogTaxonomy | cms.service | NOT_TESTED | - |
| 666 | GET | `/api/v1/customer/admin/cms/home-sections` | pages | no | - | cmsAdminController.listHomeSections | cms.service | NOT_TESTED | - |
| 667 | POST | `/api/v1/customer/admin/cms/home-sections` | pages | no | - | cmsAdminController.createHomeSection | cms.service | NOT_TESTED | - |
| 668 | DELETE | `/api/v1/customer/admin/cms/home-sections/:id` | pages | no | - | cmsAdminController.deleteHomeSection | cms.service | NOT_TESTED | - |
| 669 | PUT | `/api/v1/customer/admin/cms/home-sections/:id` | pages | no | - | cmsAdminController.updateHomeSection | cms.service | NOT_TESTED | - |
| 670 | GET | `/api/v1/customer/admin/cms/import-history/content-hub` | pages | no | - | cmsAdminController.listContentHubImportRuns | cms.service | NOT_TESTED | - |
| 671 | GET | `/api/v1/customer/admin/cms/import-jobs/content-hub/:jobId` | pages | no | - | cmsAdminController.getContentHubImportJob | cms.service | NOT_TESTED | - |
| 672 | GET | `/api/v1/customer/admin/cms/media` | pages | no | - | cmsAdminController.listMedia | cms.service | NOT_TESTED | - |
| 673 | POST | `/api/v1/customer/admin/cms/media` | pages | no | - | cmsAdminController.createMedia | cms.service | NOT_TESTED | - |
| 674 | DELETE | `/api/v1/customer/admin/cms/media/:id` | pages | no | - | cmsAdminController.deleteMedia | cms.service | NOT_TESTED | - |
| 675 | GET | `/api/v1/customer/admin/cms/overview` | pages | no | - | cmsAdminController.getOverview | cms.service | NOT_TESTED | - |
| 676 | GET | `/api/v1/customer/admin/cms/pages` | pages | no | - | cmsAdminController.listPages | cms.service | NOT_TESTED | - |
| 677 | POST | `/api/v1/customer/admin/cms/pages` | pages | no | - | cmsAdminController.createPage | cms.service | NOT_TESTED | - |
| 678 | DELETE | `/api/v1/customer/admin/cms/pages/:id` | pages | no | - | cmsAdminController.deletePage | cms.service | NOT_TESTED | - |
| 679 | GET | `/api/v1/customer/admin/cms/pages/:id` | pages | no | - | cmsAdminController.getPage | cms.service | NOT_TESTED | - |
| 680 | PUT | `/api/v1/customer/admin/cms/pages/:id` | pages | no | - | cmsAdminController.updatePage | cms.service | NOT_TESTED | - |
| 681 | POST | `/api/v1/customer/admin/cms/upload/cms-pages` | pages | no | - | cmsAdminController.uploadCmsPages | cms.service | NOT_TESTED | - |
| 682 | POST | `/api/v1/customer/admin/cms/upload/content-hub-master` | pages | no | - | cmsAdminController.uploadContentHubMaster | cms.service | NOT_TESTED | - |
| 683 | POST | `/api/v1/customer/admin/cms/upload/sku-master` | pages | no | - | cmsAdminController.uploadSkuMaster | cms.service | NOT_TESTED | - |
| 684 | GET | `/api/v1/customer/admin/collections` | collections | no | - | listCollections | collections.service | NOT_TESTED | - |
| 685 | POST | `/api/v1/customer/admin/collections` | collections | no | - | createCollection | collections.service | NOT_TESTED | - |
| 686 | DELETE | `/api/v1/customer/admin/collections/:id` | collections | no | - | deleteCollection | collections.service | NOT_TESTED | - |
| 687 | PUT | `/api/v1/customer/admin/collections/:id` | collections | no | - | updateCollection | collections.service | NOT_TESTED | - |
| 688 | GET | `/api/v1/customer/admin/coupons` | coupons | no | - | couponsController.adminList | coupons.service | NOT_TESTED | - |
| 689 | POST | `/api/v1/customer/admin/coupons` | coupons | no | - | couponsController.adminCreate | coupons.service | NOT_TESTED | - |
| 690 | DELETE | `/api/v1/customer/admin/coupons/:id` | coupons | no | - | couponsController.adminRemove | coupons.service | NOT_TESTED | - |
| 691 | GET | `/api/v1/customer/admin/coupons/:id` | coupons | no | - | couponsController.adminGetById | coupons.service | NOT_TESTED | - |
| 692 | PUT | `/api/v1/customer/admin/coupons/:id` | coupons | no | - | couponsController.adminUpdate | coupons.service | NOT_TESTED | - |
| 693 | GET | `/api/v1/customer/admin/coupons/stats` | coupons | no | - | couponsController.adminStats | coupons.service | NOT_TESTED | - |
| 694 | GET | `/api/v1/customer/admin/faq` | faq | no | - | faqController.adminList | faq.service | NOT_TESTED | - |
| 695 | POST | `/api/v1/customer/admin/faq` | faq | no | - | faqController.adminCreate | faq.service | NOT_TESTED | - |
| 696 | DELETE | `/api/v1/customer/admin/faq/:id` | faq | no | - | faqController.adminDelete | faq.service | NOT_TESTED | - |
| 697 | GET | `/api/v1/customer/admin/faq/:id` | faq | no | - | faqController.adminGetById | faq.service | NOT_TESTED | - |
| 698 | PUT | `/api/v1/customer/admin/faq/:id` | faq | no | - | faqController.adminUpdate | faq.service | NOT_TESTED | - |
| 699 | GET | `/api/v1/customer/admin/faq/categories` | faq | no | - | faqController.listCategories | faq.service | NOT_TESTED | - |
| 700 | GET | `/api/v1/customer/admin/home/attributes` | home | yes | admin-jwt | homeController.listAttributes | home.service | NOT_TESTED | - |
| 701 | POST | `/api/v1/customer/admin/home/attributes` | home | yes | admin-jwt | homeController.createAttribute | home.service | NOT_TESTED | - |
| 702 | DELETE | `/api/v1/customer/admin/home/attributes/:id` | home | yes | admin-jwt | homeController.deleteAttribute | home.service | NOT_TESTED | - |
| 703 | PUT | `/api/v1/customer/admin/home/attributes/:id` | home | yes | admin-jwt | homeController.updateAttribute | home.service | NOT_TESTED | - |
| 704 | GET | `/api/v1/customer/admin/home/banners` | home | yes | admin-jwt | homeController.listBannersAdmin | home.service | NOT_TESTED | - |
| 705 | POST | `/api/v1/customer/admin/home/banners` | home | yes | admin-jwt | homeController.createBannerAdmin | home.service | NOT_TESTED | - |
| 706 | DELETE | `/api/v1/customer/admin/home/banners/:id` | home | yes | admin-jwt | homeController.deleteBannerAdmin | home.service | NOT_TESTED | - |
| 707 | PUT | `/api/v1/customer/admin/home/banners/:id` | home | yes | admin-jwt | homeController.updateBannerAdmin | home.service | NOT_TESTED | - |
| 708 | POST | `/api/v1/customer/admin/home/banners/reorder` | home | yes | admin-jwt | homeController.reorderBannersAdmin | home.service | NOT_TESTED | - |
| 709 | GET | `/api/v1/customer/admin/home/categories` | home | yes | admin-jwt | homeController.listCategoriesAdmin | home.service | NOT_TESTED | - |
| 710 | POST | `/api/v1/customer/admin/home/categories` | home | yes | admin-jwt | homeController.createCategoryAdmin | home.service | NOT_TESTED | - |
| 711 | DELETE | `/api/v1/customer/admin/home/categories/:id` | home | yes | admin-jwt | homeController.deleteCategoryAdmin | home.service | NOT_TESTED | - |
| 712 | PUT | `/api/v1/customer/admin/home/categories/:id` | home | yes | admin-jwt | homeController.updateCategoryAdmin | home.service | NOT_TESTED | - |
| 713 | GET | `/api/v1/customer/admin/home/categories/:id/children` | home | yes | admin-jwt | homeController.listCategoryChildren | home.service | NOT_TESTED | - |
| 714 | POST | `/api/v1/customer/admin/home/categories/reorder` | home | yes | admin-jwt | homeController.reorderCategoriesAdmin | home.service | NOT_TESTED | - |
| 715 | DELETE | `/api/v1/customer/admin/home/config` | home | yes | admin-jwt | homeController.deleteHomeConfig | home.service | NOT_TESTED | - |
| 716 | GET | `/api/v1/customer/admin/home/config` | home | yes | admin-jwt | homeController.getConfig | home.service | NOT_TESTED | - |
| 717 | POST | `/api/v1/customer/admin/home/config` | home | yes | admin-jwt | homeController.upsertHomeConfig | home.service | NOT_TESTED | - |
| 718 | PUT | `/api/v1/customer/admin/home/config` | home | yes | admin-jwt | homeController.updateConfig | home.service | NOT_TESTED | - |
| 719 | GET | `/api/v1/customer/admin/home/config/list` | home | yes | admin-jwt | homeController.listHomeConfigs | home.service | NOT_TESTED | - |
| 720 | POST | `/api/v1/customer/admin/home/config/reset` | home | yes | admin-jwt | homeController.resetConfig | home.service | NOT_TESTED | - |
| 721 | GET | `/api/v1/customer/admin/home/lifestyle` | home | yes | admin-jwt | homeController.listLifestyle | home.service | NOT_TESTED | - |
| 722 | POST | `/api/v1/customer/admin/home/lifestyle` | home | yes | admin-jwt | homeController.createLifestyle | home.service | NOT_TESTED | - |
| 723 | DELETE | `/api/v1/customer/admin/home/lifestyle/:id` | home | yes | admin-jwt | homeController.deleteLifestyle | home.service | NOT_TESTED | - |
| 724 | PUT | `/api/v1/customer/admin/home/lifestyle/:id` | home | yes | admin-jwt | homeController.updateLifestyle | home.service | NOT_TESTED | - |
| 725 | POST | `/api/v1/customer/admin/home/lifestyle/reorder` | home | yes | admin-jwt | homeController.reorderLifestyle | home.service | NOT_TESTED | - |
| 726 | GET | `/api/v1/customer/admin/home/preview` | home | yes | admin-jwt | homeController.getBootstrapPreview | home.service | NOT_TESTED | - |
| 727 | GET | `/api/v1/customer/admin/home/products` | home | yes | admin-jwt | homeController.listProductsAdmin | home.service | NOT_TESTED | - |
| 728 | POST | `/api/v1/customer/admin/home/products` | home | yes | admin-jwt | homeController.createProductAdmin | home.service | NOT_TESTED | - |
| 729 | DELETE | `/api/v1/customer/admin/home/products/:id` | home | yes | admin-jwt | homeController.deleteProductAdmin | home.service | NOT_TESTED | - |
| 730 | GET | `/api/v1/customer/admin/home/products/:id` | home | yes | admin-jwt | homeController.getProductByIdAdmin | home.service | NOT_TESTED | - |
| 731 | PUT | `/api/v1/customer/admin/home/products/:id` | home | yes | admin-jwt | homeController.updateProductAdmin | home.service | NOT_TESTED | - |
| 732 | POST | `/api/v1/customer/admin/home/products/:id/publish` | home | yes | admin-jwt | homeController.publishProductAdmin | home.service | NOT_TESTED | - |
| 733 | PATCH | `/api/v1/customer/admin/home/products/:id/status` | home | yes | admin-jwt | homeController.patchProductStatusAdmin | home.service | NOT_TESTED | - |
| 734 | GET | `/api/v1/customer/admin/home/products/:id/variants` | home | yes | admin-jwt | homeController.getProductVariantsAdmin | home.service | NOT_TESTED | - |
| 735 | PATCH | `/api/v1/customer/admin/home/products/bulk` | home | yes | admin-jwt | homeController.bulkUpdateProductsAdmin | home.service | NOT_TESTED | - |
| 736 | PATCH | `/api/v1/customer/admin/home/products/bulk-status` | home | yes | admin-jwt | homeController.bulkUpdateProductStatusAdmin | home.service | NOT_TESTED | - |
| 737 | GET | `/api/v1/customer/admin/home/promoblocks` | home | yes | admin-jwt | homeController.listPromoBlocks | home.service | NOT_TESTED | - |
| 738 | POST | `/api/v1/customer/admin/home/promoblocks` | home | yes | admin-jwt | homeController.createPromoBlock | home.service | NOT_TESTED | - |
| 739 | DELETE | `/api/v1/customer/admin/home/promoblocks/:id` | home | yes | admin-jwt | homeController.deletePromoBlock | home.service | NOT_TESTED | - |
| 740 | PUT | `/api/v1/customer/admin/home/promoblocks/:id` | home | yes | admin-jwt | homeController.updatePromoBlock | home.service | NOT_TESTED | - |
| 741 | POST | `/api/v1/customer/admin/home/promoblocks/reorder` | home | yes | admin-jwt | homeController.reorderPromoBlocks | home.service | NOT_TESTED | - |
| 742 | GET | `/api/v1/customer/admin/home/section-definitions` | home | yes | admin-jwt | homeController.listSectionDefinitions | home.service | NOT_TESTED | - |
| 743 | POST | `/api/v1/customer/admin/home/section-definitions` | home | yes | admin-jwt | homeController.createSectionDefinition | home.service | NOT_TESTED | - |
| 744 | DELETE | `/api/v1/customer/admin/home/section-definitions/:id` | home | yes | admin-jwt | homeController.deleteSectionDefinition | home.service | NOT_TESTED | - |
| 745 | PUT | `/api/v1/customer/admin/home/section-definitions/:id` | home | yes | admin-jwt | homeController.updateSectionDefinition | home.service | NOT_TESTED | - |
| 746 | POST | `/api/v1/customer/admin/home/section-definitions/reorder` | home | yes | admin-jwt | homeController.reorderSectionDefinitions | home.service | NOT_TESTED | - |
| 747 | GET | `/api/v1/customer/admin/home/sections` | home | yes | admin-jwt | homeController.listSections | home.service | NOT_TESTED | - |
| 748 | POST | `/api/v1/customer/admin/home/sections` | home | yes | admin-jwt | homeController.createSection | home.service | NOT_TESTED | - |
| 749 | DELETE | `/api/v1/customer/admin/home/sections/:id` | home | yes | admin-jwt | homeController.deleteSection | home.service | NOT_TESTED | - |
| 750 | PUT | `/api/v1/customer/admin/home/sections/:id` | home | yes | admin-jwt | homeController.updateSection | home.service | NOT_TESTED | - |
| 751 | PATCH | `/api/v1/customer/admin/home/sections/:id/products` | home | yes | admin-jwt | homeController.updateSectionProducts | home.service | NOT_TESTED | - |
| 752 | POST | `/api/v1/customer/admin/home/sections/reorder` | home | yes | admin-jwt | homeController.reorderSections | home.service | NOT_TESTED | - |
| 753 | POST | `/api/v1/customer/admin/home/upload-product-image` | home | yes | admin-jwt | homeController.uploadProductImage | home.service | NOT_TESTED | - |
| 754 | GET | `/api/v1/customer/admin/legal/config` | legal | no | - | legalController.getAdminConfig | legal.service | NOT_TESTED | - |
| 755 | PUT | `/api/v1/customer/admin/legal/config` | legal | no | - | legalController.updateAdminConfig | legal.service | NOT_TESTED | - |
| 756 | GET | `/api/v1/customer/admin/legal/documents` | legal | no | - | legalController.listDocuments | legal.service | NOT_TESTED | - |
| 757 | POST | `/api/v1/customer/admin/legal/documents` | legal | no | - | legalController.createDocument | legal.service | NOT_TESTED | - |
| 758 | DELETE | `/api/v1/customer/admin/legal/documents/:id` | legal | no | - | legalController.deleteDocument | legal.service | NOT_TESTED | - |
| 759 | GET | `/api/v1/customer/admin/legal/documents/:id` | legal | no | - | legalController.getDocument | legal.service | NOT_TESTED | - |
| 760 | PUT | `/api/v1/customer/admin/legal/documents/:id` | legal | no | - | legalController.updateDocument | legal.service | NOT_TESTED | - |
| 761 | POST | `/api/v1/customer/admin/legal/documents/:id/set-current` | legal | no | - | legalController.setCurrentDocument | legal.service | NOT_TESTED | - |
| 762 | PUT | `/api/v1/customer/admin/merch/inventory/:storeId` | store | no | - | updateStoreInventoryAdmin | store.service | NOT_TESTED | - |
| 763 | GET | `/api/v1/customer/admin/merch/inventory/:storeId/history` | store | no | - | getStoreInventoryHistoryAdmin | store.service | NOT_TESTED | - |
| 764 | POST | `/api/v1/customer/admin/merch/inventory/:storeId/replenish` | store | no | - | triggerStoreReplenishmentAdmin | store.service | NOT_TESTED | - |
| 765 | POST | `/api/v1/customer/admin/merch/inventory/:storeId/sync` | store | no | - | syncStoreInventoryAdmin | store.service | NOT_TESTED | - |
| 766 | GET | `/api/v1/customer/admin/merch/stores` | store | no | - | listStoresAdmin | store.service | NOT_TESTED | - |
| 767 | POST | `/api/v1/customer/admin/merch/stores` | store | no | - | createStoreAdmin | store.service | NOT_TESTED | - |
| 768 | DELETE | `/api/v1/customer/admin/merch/stores/:id` | store | no | - | deleteStoreAdmin | store.service | NOT_TESTED | - |
| 769 | PUT | `/api/v1/customer/admin/merch/stores/:id` | store | no | - | updateStoreAdmin | store.service | NOT_TESTED | - |
| 770 | GET | `/api/v1/customer/admin/notifications` | notifications | no | - | notificationsController.adminList | notifications.service | NOT_TESTED | - |
| 771 | DELETE | `/api/v1/customer/admin/notifications/:id` | notifications | no | - | notificationsController.adminRemove | notifications.service | NOT_TESTED | - |
| 772 | POST | `/api/v1/customer/admin/notifications/send` | notifications | no | - | notificationsController.adminSend | notifications.service | NOT_TESTED | - |
| 773 | GET | `/api/v1/customer/admin/notifications/stats` | notifications | no | - | notificationsController.adminStats | notifications.service | NOT_TESTED | - |
| 774 | GET | `/api/v1/customer/admin/onboarding-pages` | onboarding | no | - | onboardingController.adminList | onboarding.service | NOT_TESTED | - |
| 775 | POST | `/api/v1/customer/admin/onboarding-pages` | onboarding | no | - | onboardingController.adminCreate | onboarding.service | NOT_TESTED | - |
| 776 | DELETE | `/api/v1/customer/admin/onboarding-pages/:id` | onboarding | no | - | onboardingController.adminRemove | onboarding.service | NOT_TESTED | - |
| 777 | PUT | `/api/v1/customer/admin/onboarding-pages/:id` | onboarding | no | - | onboardingController.adminUpdate | onboarding.service | NOT_TESTED | - |
| 778 | POST | `/api/v1/customer/admin/onboarding-pages/:id/image` | onboarding | no | - | onboardingController.adminUploadImage | onboarding.service | NOT_TESTED | - |
| 779 | PUT | `/api/v1/customer/admin/onboarding-pages/reorder` | onboarding | no | - | onboardingController.adminReorder | onboarding.service | NOT_TESTED | - |
| 780 | GET | `/api/v1/customer/admin/pages` | pages | no | - | listPages | pages.service | NOT_TESTED | - |
| 781 | POST | `/api/v1/customer/admin/pages` | pages | no | - | createPage | pages.service | NOT_TESTED | - |
| 782 | DELETE | `/api/v1/customer/admin/pages/:id` | pages | no | - | deletePage | pages.service | NOT_TESTED | - |
| 783 | GET | `/api/v1/customer/admin/pages/:id` | pages | no | - | getPageAdmin | pages.service | NOT_TESTED | - |
| 784 | PUT | `/api/v1/customer/admin/pages/:id` | pages | no | - | updatePage | pages.service | NOT_TESTED | - |
| 785 | GET | `/api/v1/customer/app-config` | app-config | no | - | ctrl.getPublicConfig | app-config.service | PASS | - |
| 786 | POST | `/api/v1/customer/auth/link-phone/send-otp` | auth | yes | customer-jwt | authController.sendLinkPhoneOtp | auth.service | NOT_TESTED | - |
| 787 | POST | `/api/v1/customer/auth/link-phone/verify-otp` | auth | yes | customer-jwt | authController.verifyLinkPhoneOtp | auth.service | NOT_TESTED | - |
| 788 | POST | `/api/v1/customer/auth/logout` | auth | no | - | authController.logout | auth.service | NOT_TESTED | - |
| 789 | POST | `/api/v1/customer/auth/resend-otp` | auth | no | - | authController.resendOtp | auth.service | NOT_TESTED | - |
| 790 | POST | `/api/v1/customer/auth/send-otp` | auth | no | - | authController.sendOtp | auth.service | FAIL | - |
| 791 | POST | `/api/v1/customer/auth/verify-otp` | auth | no | - | authController.verifyOtpController | auth.service | PARTIAL | - |
| 792 | GET | `/api/v1/customer/banners/:id` | banners | no | - | bannersController.getBannerById | banners.service | FAIL | - |
| 793 | GET | `/api/v1/customer/bootstrap` | bootstrap | no | - | getBootstrap | bootstrap.service | PASS | - |
| 794 | GET | `/api/v1/customer/cart` | cart | yes | customer-jwt | cartController.getCart | cart.service | PASS | - |
| 795 | DELETE | `/api/v1/customer/cart/clear` | cart | yes | customer-jwt | cartController.clear | cart.service | NOT_TESTED | - |
| 796 | POST | `/api/v1/customer/cart/items` | cart | yes | customer-jwt | cartController.addCartItem | cart.service | PASS | - |
| 797 | PUT | `/api/v1/customer/cart/items` | cart | yes | customer-jwt | cartController.updateCartItemByProductVariant | cart.service | NOT_TESTED | - |
| 798 | DELETE | `/api/v1/customer/cart/items/:itemId` | cart | yes | customer-jwt | cartController.removeCartItem | cart.service | NOT_TESTED | - |
| 799 | PUT | `/api/v1/customer/cart/items/:itemId` | cart | yes | customer-jwt | cartController.updateCartItem | cart.service | NOT_TESTED | - |
| 800 | POST | `/api/v1/customer/cart/merge` | cart | yes | customer-jwt | cartController.mergeCart | cart.service | NOT_TESTED | - |
| 801 | GET | `/api/v1/customer/categories` | categories | no | - | categoriesController.listCategories | categories.service | PASS | - |
| 802 | GET | `/api/v1/customer/categories/:id` | categories | no | - | categoriesController.getCategoryDetail | categories.service | PASS | - |
| 803 | GET | `/api/v1/customer/categories/:slug/products` | categories | no | - | categoriesController.getCategoryProductsBySlug | categories.service | PASS | - |
| 804 | GET | `/api/v1/customer/categories/:slug/subcategories` | categories | no | - | categoriesController.getSubcategoriesByCategorySlug | categories.service | PASS | - |
| 805 | GET | `/api/v1/customer/collections/:slug` | collections | no | - | getCollection | collections.service | PARTIAL | - |
| 806 | GET | `/api/v1/customer/coupons` | coupons | no | - | couponsController.list | coupons.service | NOT_TESTED | - |
| 807 | POST | `/api/v1/customer/coupons/redeem` | coupons | yes | customer-jwt | couponsController.redeem | coupons.service | NOT_TESTED | - |
| 808 | POST | `/api/v1/customer/coupons/validate` | coupons | no | - | couponsController.validate | coupons.service | NOT_TESTED | - |
| 809 | GET | `/api/v1/customer/delivery/estimate` | delivery | no | - | getDeliveryEstimate | delivery.service | PARTIAL | - |
| 810 | GET | `/api/v1/customer/delivery/fee` | delivery | no | - | getDeliveryFee | delivery.service | NOT_TESTED | - |
| 811 | GET | `/api/v1/customer/faq` | faq | no | - | faqController.list | faq.service | PASS | - |
| 812 | POST | `/api/v1/customer/faq/:id/feedback` | faq | yes | customer-jwt | faqController.submitFeedback | faq.service | NOT_TESTED | - |
| 813 | GET | `/api/v1/customer/faq/categories` | faq | no | - | faqController.listCategories | faq.service | NOT_TESTED | - |
| 814 | GET | `/api/v1/customer/home` | home | no | - | homeController.getHome | home.service | PASS | - |
| 815 | POST | `/api/v1/customer/legal/accept` | legal | yes | customer-jwt | legalController.accept | legal.service | NOT_TESTED | - |
| 816 | GET | `/api/v1/customer/legal/config` | legal | no | - | legalController.getConfig | legal.service | NOT_TESTED | - |
| 817 | GET | `/api/v1/customer/legal/license` | legal | no | - | legalController.getLicense | legal.service | NOT_TESTED | - |
| 818 | GET | `/api/v1/customer/legal/privacy` | legal | no | - | legalController.getPrivacy | legal.service | NOT_TESTED | - |
| 819 | GET | `/api/v1/customer/legal/terms` | legal | no | - | legalController.getTerms | legal.service | PASS | - |
| 820 | GET | `/api/v1/customer/locations/approximate` | locations | no | - | approximate | locations.service | NOT_TESTED | - |
| 821 | GET | `/api/v1/customer/locations/suggestions` | locations | no | - | suggestions | locations.service | NOT_TESTED | - |
| 822 | GET | `/api/v1/customer/notifications` | notifications | yes | customer-jwt | notificationsController.list | notifications.service | NOT_TESTED | - |
| 823 | DELETE | `/api/v1/customer/notifications/:id` | notifications | yes | customer-jwt | notificationsController.deleteOne | notifications.service | NOT_TESTED | - |
| 824 | PUT | `/api/v1/customer/notifications/:id/read` | notifications | yes | customer-jwt | notificationsController.markOneRead | notifications.service | NOT_TESTED | - |
| 825 | PUT | `/api/v1/customer/notifications/:id/unread` | notifications | yes | customer-jwt | notificationsController.markOneUnread | notifications.service | NOT_TESTED | - |
| 826 | GET | `/api/v1/customer/notifications/preferences` | notifications | yes | customer-jwt | notificationsController.getPreferencesHandler | notifications.service | NOT_TESTED | - |
| 827 | PUT | `/api/v1/customer/notifications/preferences` | notifications | yes | customer-jwt | notificationsController.updatePreferencesHandler | notifications.service | NOT_TESTED | - |
| 828 | PUT | `/api/v1/customer/notifications/read-all` | notifications | yes | customer-jwt | notificationsController.markAllReadHandler | notifications.service | NOT_TESTED | - |
| 829 | POST | `/api/v1/customer/notifications/register-token` | notifications | yes | customer-jwt | notificationsController.registerToken | notifications.service | NOT_TESTED | - |
| 830 | POST | `/api/v1/customer/notifications/register-web-push` | notifications | yes | customer-jwt | notificationsController.registerWebPush | notifications.service | NOT_TESTED | - |
| 831 | POST | `/api/v1/customer/notifications/remove-all-tokens` | notifications | yes | customer-jwt | notificationsController.removeAllTokens | notifications.service | NOT_TESTED | - |
| 832 | POST | `/api/v1/customer/notifications/remove-token` | notifications | yes | customer-jwt | notificationsController.removeToken | notifications.service | NOT_TESTED | - |
| 833 | GET | `/api/v1/customer/notifications/unread-count` | notifications | yes | customer-jwt | notificationsController.unreadCount | notifications.service | NOT_TESTED | - |
| 834 | GET | `/api/v1/customer/notifications/vapid-public-key` | notifications | no | - | notificationsController.vapidPublicKey | notifications.service | NOT_TESTED | - |
| 835 | POST | `/api/v1/customer/onboarding/complete` | onboarding | no | - | onboardingController.completeOnboarding | onboarding.service | NOT_TESTED | - |
| 836 | GET | `/api/v1/customer/onboarding/pages` | onboarding | no | - | onboardingController.getPages | onboarding.service | NOT_TESTED | - |
| 837 | GET | `/api/v1/customer/onboarding/pages/:pageNumber` | onboarding | no | - | onboardingController.getPageByNumber | onboarding.service | NOT_TESTED | - |
| 838 | GET | `/api/v1/customer/onboarding/status` | onboarding | no | - | onboardingController.getStatus | onboarding.service | NOT_TESTED | - |
| 839 | GET | `/api/v1/customer/orders` | orders | yes | customer-jwt | orderController.list | order.service | PASS | - |
| 840 | POST | `/api/v1/customer/orders` | orders | yes | customer-jwt | orderController.create | order.service | PASS | - |
| 841 | GET | `/api/v1/customer/orders/:id` | orders | yes | customer-jwt | orderController.getDetail | order.service | PASS | - |
| 842 | GET | `/api/v1/customer/orders/:id/can-cancel` | orders | yes | customer-jwt | orderController.canCancel | order.service | PASS | - |
| 843 | POST | `/api/v1/customer/orders/:id/cancel` | orders | yes | customer-jwt | orderController.cancel | order.service | PASS | - |
| 844 | GET | `/api/v1/customer/orders/:id/invoice` | invoice | yes | customer-jwt | invoice | invoice.service | PASS | - |
| 845 | POST | `/api/v1/customer/orders/:id/rate` | orders | yes | customer-jwt | orderController.rate | order.service | PASS | - |
| 846 | POST | `/api/v1/customer/orders/:id/reorder` | orders | yes | customer-jwt | orderController.reorder | order.service | PASS | - |
| 847 | GET | `/api/v1/customer/orders/:id/status` | orders | yes | customer-jwt | orderController.status | order.service | PASS | - |
| 848 | GET | `/api/v1/customer/orders/:id/tracking` | orders | yes | customer-jwt | orderController.tracking | order.service | PASS | - |
| 849 | PUT | `/api/v1/customer/orders/:id/update-status` | orders | yes | admin-jwt | orderController.updateStatus | order.service | NOT_TESTED | - |
| 850 | POST | `/api/v1/customer/orders/:id/verify-otp` | orders | yes | customer-jwt | orderController.verifyOtp | order.service | PASS | - |
| 851 | GET | `/api/v1/customer/orders/active` | orders | yes | customer-jwt | orderController.active | order.service | NOT_TESTED | - |
| 852 | GET | `/api/v1/customer/pages/:slug` | pages | no | - | getPage | pages.service | PARTIAL | - |
| 853 | GET | `/api/v1/customer/payments/methods` | payments | yes | customer-jwt | controller.getMethods | payments.service | NOT_TESTED | - |
| 854 | POST | `/api/v1/customer/payments/methods` | payments | yes | customer-jwt | controller.addPaymentMethod | payments.service | NOT_TESTED | - |
| 855 | DELETE | `/api/v1/customer/payments/methods/:id` | payments | yes | customer-jwt | controller.removePaymentMethod | payments.service | NOT_TESTED | - |
| 856 | PUT | `/api/v1/customer/payments/methods/:id` | payments | yes | customer-jwt | controller.updatePaymentMethod | payments.service | NOT_TESTED | - |
| 857 | POST | `/api/v1/customer/payments/methods/:id/default` | payments | yes | customer-jwt | controller.setDefaultMethod | payments.service | NOT_TESTED | - |
| 858 | POST | `/api/v1/customer/payments/worldline/abort` | payments | yes | customer-jwt | controller.abortWorldlinePayment | payments.service | NOT_TESTED | - |
| 859 | POST | `/api/v1/customer/payments/worldline/complete` | payments | yes | customer-jwt | controller.completeWorldlinePayment | payments.service | NOT_TESTED | - |
| 860 | POST | `/api/v1/customer/payments/worldline/session` | payments | yes | customer-jwt | controller.createWorldlineSession | payments.service | NOT_TESTED | - |
| 861 | GET | `/api/v1/customer/payments/worldline/status` | payments | yes | customer-jwt | controller.getWorldlineStatus | payments.service | NOT_TESTED | - |
| 862 | GET | `/api/v1/customer/products/:id` | products | no | - | productsController.getProductDetail | products.service | FAIL | - |
| 863 | GET | `/api/v1/customer/products/search` | products | no | - | productsController.searchProducts | products.service | PASS | - |
| 864 | GET | `/api/v1/customer/products/search/suggestions` | products | no | - | productsController.searchSuggestions | products.service | NOT_TESTED | - |
| 865 | GET | `/api/v1/customer/products/search/trending` | products | no | - | productsController.getTrendingSearches | products.service | NOT_TESTED | - |
| 866 | GET | `/api/v1/customer/refunds` | refunds | yes | customer-jwt | controller.list | refunds.service | NOT_TESTED | - |
| 867 | GET | `/api/v1/customer/refunds/:id` | refunds | yes | customer-jwt | controller.getById | refunds.service | NOT_TESTED | - |
| 868 | GET | `/api/v1/customer/refunds/:id/details` | refunds | yes | customer-jwt | controller.getDetails | refunds.service | NOT_TESTED | - |
| 869 | POST | `/api/v1/customer/refunds/request` | refunds | yes | customer-jwt | controller.createRequest | refunds.service | NOT_TESTED | - |
| 870 | GET | `/api/v1/customer/search` | products | no | - | searchProducts | search.service | PASS | - |
| 871 | GET | `/api/v1/customer/search/suggestions` | products | no | - | searchSuggestions | search.service | NOT_TESTED | - |
| 872 | GET | `/api/v1/customer/search/trending` | products | no | - | getTrendingSearches | search.service | NOT_TESTED | - |
| 873 | GET | `/api/v1/customer/sections/:key/products` | home | no | - | homeController.getSectionProducts | sections.service | NOT_TESTED | - |
| 874 | GET | `/api/v1/customer/store/:storeId/inventory` | store | no | - | getStoreInventory | store.service | NOT_TESTED | - |
| 875 | POST | `/api/v1/customer/store/assign` | store | no | - | assignStore | store.service | NOT_TESTED | - |
| 876 | GET | `/api/v1/customer/support/tickets` | support | yes | customer-jwt | supportController.listMyTickets | support.service | NOT_TESTED | - |
| 877 | POST | `/api/v1/customer/support/tickets` | support | yes | customer-jwt | supportController.createTicket | support.service | NOT_TESTED | - |
| 878 | GET | `/api/v1/customer/support/tickets/:ticketId/messages` | support | yes | customer-jwt | supportController.getTicketMessages | support.service | NOT_TESTED | - |
| 879 | POST | `/api/v1/customer/support/tickets/:ticketId/reopen` | support | yes | customer-jwt | supportController.reopenTicket | support.service | NOT_TESTED | - |
| 880 | GET | `/api/v1/customer/support/tickets/active` | support | yes | customer-jwt | supportController.getActiveChatTicket | support.service | NOT_TESTED | - |
| 881 | PUT | `/api/v1/customer/user/change-password` | user | yes | customer-jwt | userController.changePassword | user.service | NOT_TESTED | - |
| 882 | POST | `/api/v1/customer/user/phone/resend-otp` | user | yes | customer-jwt | authController.resendOtp | user.service | NOT_TESTED | - |
| 883 | POST | `/api/v1/customer/user/phone/send-otp` | user | yes | customer-jwt | authController.sendLinkPhoneOtp | user.service | NOT_TESTED | - |
| 884 | POST | `/api/v1/customer/user/phone/verify-otp` | user | yes | customer-jwt | authController.verifyLinkPhoneOtp | user.service | NOT_TESTED | - |
| 885 | GET | `/api/v1/customer/user/profile` | user | yes | customer-jwt | userController.getProfile | user.service | PASS | - |
| 886 | PUT | `/api/v1/customer/user/profile` | user | yes | customer-jwt | userController.updateProfile | user.service | NOT_TESTED | - |
| 887 | POST | `/api/v1/customer/user/profile/avatar` | user | yes | customer-jwt | userController.uploadAvatar | user.service | NOT_TESTED | - |
| 888 | GET | `/api/v1/customer/wallet/balance` | wallet | yes | customer-jwt | controller.getBalance | wallet.service | PASS | - |
| 889 | POST | `/api/v1/customer/wallet/credit` | wallet | yes | customer-jwt | controller.creditForTopUp | wallet.service | NOT_TESTED | - |
| 890 | POST | `/api/v1/customer/wallet/debit` | wallet | yes | customer-jwt | controller.debitForCheckout | wallet.service | NOT_TESTED | - |
| 891 | POST | `/api/v1/customer/wallet/top-up/session` | wallet | yes | customer-jwt | controller.initiateTopUp | wallet.service | NOT_TESTED | - |
| 892 | GET | `/api/v1/customer/wallet/transactions` | wallet | yes | customer-jwt | controller.getTransactions | wallet.service | NOT_TESTED | - |
| 893 | GET | `/api/v1/darkstore/alerts` | darkstore | yes | admin-jwt | ctrl.getAlerts | darkstore.service | NOT_TESTED | - |
| 894 | GET | `/api/v1/darkstore/alerts/:alertId` | darkstore | yes | admin-jwt | ctrl.getAlertById | darkstore.service | NOT_TESTED | - |
| 895 | POST | `/api/v1/darkstore/alerts/:alertId/action` | darkstore | yes | admin-jwt | ctrl.performAlertAction | darkstore.service | NOT_TESTED | - |
| 896 | GET | `/api/v1/darkstore/alerts/debug/ids` | darkstore | yes | admin-jwt | ctrl.getAlertsDebugIds | darkstore.service | NOT_TESTED | - |
| 897 | DELETE | `/api/v1/darkstore/alerts/resolved` | darkstore | yes | admin-jwt | ctrl.clearResolvedAlerts | darkstore.service | NOT_TESTED | - |
| 898 | POST | `/api/v1/darkstore/alerts/resolved/clear` | darkstore | yes | admin-jwt | ctrl.clearResolvedAlerts | darkstore.service | NOT_TESTED | - |
| 899 | POST | `/api/v1/darkstore/analytics/export` | darkstore | yes | admin-jwt | ctrl.exportReport | darkstore.service | NOT_TESTED | - |
| 900 | GET | `/api/v1/darkstore/analytics/fleet-utilization` | darkstore | yes | admin-jwt | ctrl.getRiderPerformance | darkstore.service | NOT_TESTED | - |
| 901 | GET | `/api/v1/darkstore/analytics/rider-performance` | darkstore | yes | admin-jwt | ctrl.getRiderPerformance | darkstore.service | NOT_TESTED | - |
| 902 | GET | `/api/v1/darkstore/analytics/sla-adherence` | darkstore | yes | admin-jwt | ctrl.getSlaAdherence | darkstore.service | NOT_TESTED | - |
| 903 | GET | `/api/v1/darkstore/dashboard/alert-history` | darkstore | yes | admin-jwt | ctrl.getAlertHistory | darkstore.service | NOT_TESTED | - |
| 904 | GET | `/api/v1/darkstore/dashboard/live-orders` | darkstore | yes | admin-jwt | ctrl.getLiveOrders | darkstore.service | NOT_TESTED | - |
| 905 | GET | `/api/v1/darkstore/dashboard/refresh` | darkstore | yes | admin-jwt | res.json | darkstore.service | NOT_TESTED | - |
| 906 | POST | `/api/v1/darkstore/dashboard/refresh` | darkstore | yes | admin-jwt | res.json | darkstore.service | NOT_TESTED | - |
| 907 | GET | `/api/v1/darkstore/dashboard/rto-alerts` | darkstore | yes | admin-jwt | ctrl.getRTOAlerts | darkstore.service | NOT_TESTED | - |
| 908 | GET | `/api/v1/darkstore/dashboard/staff-load` | darkstore | yes | admin-jwt | ctrl.getStaffLoad | darkstore.service | NOT_TESTED | - |
| 909 | GET | `/api/v1/darkstore/dashboard/stock-alerts` | darkstore | yes | admin-jwt | ctrl.getStockAlerts | darkstore.service | NOT_TESTED | - |
| 910 | GET | `/api/v1/darkstore/dashboard/store-profile` | darkstore | yes | admin-jwt | ctrl.getStoreProfile | darkstore.service | NOT_TESTED | - |
| 911 | GET | `/api/v1/darkstore/dashboard/summary` | darkstore | yes | admin-jwt | ctrl.getDashboardSummary | darkstore.service | NOT_TESTED | - |
| 912 | GET | `/api/v1/darkstore/dashboard/warehouse-profile` | darkstore | yes | admin-jwt | ctrl.getWarehouseProfile | darkstore.service | NOT_TESTED | - |
| 913 | GET | `/api/v1/darkstore/health/checklists` | darkstore | yes | admin-jwt | ctrl.getChecklists | darkstore.service | NOT_TESTED | - |
| 914 | PUT | `/api/v1/darkstore/health/checklists/:checklistId/items/:itemId` | darkstore | yes | admin-jwt | ctrl.updateChecklistItem | darkstore.service | NOT_TESTED | - |
| 915 | POST | `/api/v1/darkstore/health/checklists/:checklistId/submit` | darkstore | yes | admin-jwt | ctrl.submitChecklist | darkstore.service | NOT_TESTED | - |
| 916 | GET | `/api/v1/darkstore/health/equipment` | darkstore | yes | admin-jwt | ctrl.getEquipment | darkstore.service | NOT_TESTED | - |
| 917 | GET | `/api/v1/darkstore/health/incidents` | darkstore | yes | admin-jwt | ctrl.getIncidents | darkstore.service | NOT_TESTED | - |
| 918 | POST | `/api/v1/darkstore/health/incidents` | darkstore | yes | admin-jwt | ctrl.reportIncident | darkstore.service | NOT_TESTED | - |
| 919 | PUT | `/api/v1/darkstore/health/incidents/:incidentId/resolve` | darkstore | yes | admin-jwt | ctrl.resolveIncident | darkstore.service | NOT_TESTED | - |
| 920 | GET | `/api/v1/darkstore/health/summary` | darkstore | yes | admin-jwt | ctrl.getHealthSummary | darkstore.service | NOT_TESTED | - |
| 921 | GET | `/api/v1/darkstore/hsd/devices/:deviceId/actions` | darkstore | yes | admin-jwt | ctrl.getDeviceHistory | darkstore.service | NOT_TESTED | - |
| 922 | POST | `/api/v1/darkstore/hsd/devices/:deviceId/assign` | darkstore | yes | admin-jwt | ctrl.assignHSDDevice | darkstore.service | NOT_TESTED | - |
| 923 | POST | `/api/v1/darkstore/hsd/devices/:deviceId/control` | darkstore | yes | admin-jwt | ctrl.deviceControl | darkstore.service | NOT_TESTED | - |
| 924 | GET | `/api/v1/darkstore/hsd/devices/:deviceId/history` | darkstore | yes | admin-jwt | ctrl.getDeviceHistory | darkstore.service | NOT_TESTED | - |
| 925 | POST | `/api/v1/darkstore/hsd/devices/:deviceId/unassign` | darkstore | yes | admin-jwt | ctrl.unassignHSDDevice | darkstore.service | NOT_TESTED | - |
| 926 | POST | `/api/v1/darkstore/hsd/devices/bulk-reset` | darkstore | yes | admin-jwt | res.json | darkstore.service | NOT_TESTED | - |
| 927 | POST | `/api/v1/darkstore/hsd/devices/register` | darkstore | yes | admin-jwt | ctrl.registerHSDDevice | darkstore.service | NOT_TESTED | - |
| 928 | GET | `/api/v1/darkstore/hsd/fleet` | darkstore | yes | admin-jwt | ctrl.getHSDFleetOverview | darkstore.service | NOT_TESTED | - |
| 929 | GET | `/api/v1/darkstore/hsd/issues` | darkstore | yes | admin-jwt | ctrl.getHSDIssues | darkstore.service | NOT_TESTED | - |
| 930 | POST | `/api/v1/darkstore/hsd/issues/report` | darkstore | yes | admin-jwt | ctrl.reportHSDIssue | darkstore.service | NOT_TESTED | - |
| 931 | GET | `/api/v1/darkstore/hsd/logs` | darkstore | yes | admin-jwt | ctrl.getAuditLogs | darkstore.service | NOT_TESTED | - |
| 932 | GET | `/api/v1/darkstore/hsd/picker-users` | darkstore | yes | admin-jwt | ctrl.getHSDPickerUsers | darkstore.service | NOT_TESTED | - |
| 933 | POST | `/api/v1/darkstore/hsd/requisitions` | darkstore | yes | admin-jwt | ctrl.createHSDRequisition | darkstore.service | NOT_TESTED | - |
| 934 | POST | `/api/v1/darkstore/hsd/sessions/:deviceId/action` | darkstore | yes | admin-jwt | ctrl.sessionAction | darkstore.service | NOT_TESTED | - |
| 935 | GET | `/api/v1/darkstore/hsd/sessions/live` | darkstore | yes | admin-jwt | ctrl.getLiveSessions | darkstore.service | NOT_TESTED | - |
| 936 | GET | `/api/v1/darkstore/hsd/users` | darkstore | yes | admin-jwt | ctrl.getHSDUserList | darkstore.service | NOT_TESTED | - |
| 937 | GET | `/api/v1/darkstore/hsd/users/:userId/device-request-otp` | darkstore | yes | admin-jwt | ctrl.getHSDUserOtp | darkstore.service | NOT_TESTED | - |
| 938 | POST | `/api/v1/darkstore/hsd/users/:userId/generate-device-otp` | darkstore | yes | admin-jwt | ctrl.generateHSDUserOtp | darkstore.service | NOT_TESTED | - |
| 939 | GET | `/api/v1/darkstore/inbound/grn` | darkstore | yes | admin-jwt | ctrl.getGRNList | darkstore.service | NOT_TESTED | - |
| 940 | GET | `/api/v1/darkstore/inbound/grn/:grnId` | darkstore | yes | admin-jwt | ctrl.getGRNDetails | darkstore.service | NOT_TESTED | - |
| 941 | POST | `/api/v1/darkstore/inbound/grn/:grnId/complete` | darkstore | yes | admin-jwt | ctrl.completeGRNProcessing | darkstore.service | NOT_TESTED | - |
| 942 | PUT | `/api/v1/darkstore/inbound/grn/:grnId/items/:sku` | darkstore | yes | admin-jwt | ctrl.updateGRNItemQuantity | darkstore.service | NOT_TESTED | - |
| 943 | POST | `/api/v1/darkstore/inbound/grn/:grnId/start` | darkstore | yes | admin-jwt | ctrl.startGRNProcessing | darkstore.service | NOT_TESTED | - |
| 944 | GET | `/api/v1/darkstore/inbound/putaway` | darkstore | yes | admin-jwt | ctrl.getPutawayTasks | darkstore.service | NOT_TESTED | - |
| 945 | POST | `/api/v1/darkstore/inbound/putaway/:taskId/assign` | darkstore | yes | admin-jwt | ctrl.assignPutawayTask | darkstore.service | NOT_TESTED | - |
| 946 | POST | `/api/v1/darkstore/inbound/putaway/:taskId/complete` | darkstore | yes | admin-jwt | ctrl.completePutawayTask | darkstore.service | NOT_TESTED | - |
| 947 | GET | `/api/v1/darkstore/inbound/summary` | darkstore | yes | admin-jwt | ctrl.getInboundSummary | darkstore.service | NOT_TESTED | - |
| 948 | GET | `/api/v1/darkstore/inbound/transfers` | darkstore | yes | admin-jwt | ctrl.getInterStoreTransfers | darkstore.service | NOT_TESTED | - |
| 949 | GET | `/api/v1/darkstore/inbound/transfers/:transferId` | darkstore | yes | admin-jwt | ctrl.getInterStoreTransfers | darkstore.service | NOT_TESTED | - |
| 950 | POST | `/api/v1/darkstore/inbound/transfers/:transferId/receive` | darkstore | yes | admin-jwt | ctrl.receiveInterStoreTransfer | darkstore.service | NOT_TESTED | - |
| 951 | POST | `/api/v1/darkstore/inbound/transfers/sync` | darkstore | yes | admin-jwt | ctrl.syncInterStoreTransfers | darkstore.service | NOT_TESTED | - |
| 952 | GET | `/api/v1/darkstore/inventory/adjustments` | darkstore | yes | admin-jwt | ctrl.getAdjustments | darkstore.service | NOT_TESTED | - |
| 953 | POST | `/api/v1/darkstore/inventory/adjustments` | darkstore | yes | admin-jwt | ctrl.createAdjustment | darkstore.service | NOT_TESTED | - |
| 954 | GET | `/api/v1/darkstore/inventory/audit-log` | darkstore | yes | admin-jwt | ctrl.getAuditLog | darkstore.service | NOT_TESTED | - |
| 955 | POST | `/api/v1/darkstore/inventory/bulk-import` | darkstore | yes | admin-jwt | ctrl.bulkImportInventory | darkstore.service | NOT_TESTED | - |
| 956 | GET | `/api/v1/darkstore/inventory/cycle-count` | darkstore | yes | admin-jwt | ctrl.getCycleCount | darkstore.service | NOT_TESTED | - |
| 957 | GET | `/api/v1/darkstore/inventory/cycle-count/report` | darkstore | yes | admin-jwt | ctrl.downloadCycleCountReport | darkstore.service | NOT_TESTED | - |
| 958 | GET | `/api/v1/darkstore/inventory/import-template` | darkstore | yes | admin-jwt | ctrl.downloadInventoryImportTemplate | darkstore.service | NOT_TESTED | - |
| 959 | PUT | `/api/v1/darkstore/inventory/items/:sku` | darkstore | yes | admin-jwt | ctrl.updateInventoryItem | darkstore.service | NOT_TESTED | - |
| 960 | GET | `/api/v1/darkstore/inventory/product-location/:sku` | darkstore | yes | admin-jwt | ctrl.getProductLocation | darkstore.service | NOT_TESTED | - |
| 961 | GET | `/api/v1/darkstore/inventory/restock` | darkstore | yes | admin-jwt | ctrl.listRestocks | darkstore.service | NOT_TESTED | - |
| 962 | POST | `/api/v1/darkstore/inventory/restock` | darkstore | yes | admin-jwt | ctrl.createRestock | darkstore.service | NOT_TESTED | - |
| 963 | POST | `/api/v1/darkstore/inventory/restock-task` | darkstore | yes | admin-jwt | ctrl.createRestockTask | darkstore.service | NOT_TESTED | - |
| 964 | POST | `/api/v1/darkstore/inventory/scan` | darkstore | yes | admin-jwt | ctrl.scanItem | darkstore.service | NOT_TESTED | - |
| 965 | GET | `/api/v1/darkstore/inventory/shelf-view` | darkstore | yes | admin-jwt | ctrl.getShelfView | darkstore.service | NOT_TESTED | - |
| 966 | GET | `/api/v1/darkstore/inventory/shelves` | darkstore | yes | admin-jwt | ctrl.listShelves | darkstore.service | NOT_TESTED | - |
| 967 | POST | `/api/v1/darkstore/inventory/shelves` | darkstore | yes | admin-jwt | ctrl.createShelf | darkstore.service | NOT_TESTED | - |
| 968 | DELETE | `/api/v1/darkstore/inventory/shelves/:shelfId` | darkstore | yes | admin-jwt | ctrl.deleteShelf | darkstore.service | NOT_TESTED | - |
| 969 | PUT | `/api/v1/darkstore/inventory/shelves/:shelfId` | darkstore | yes | admin-jwt | ctrl.updateShelf | darkstore.service | NOT_TESTED | - |
| 970 | GET | `/api/v1/darkstore/inventory/stock-levels` | darkstore | yes | admin-jwt | ctrl.getStockLevels | darkstore.service | NOT_TESTED | - |
| 971 | DELETE | `/api/v1/darkstore/inventory/stock-levels/:sku` | darkstore | yes | admin-jwt | ctrl.deleteInventoryItem | darkstore.service | NOT_TESTED | - |
| 972 | PUT | `/api/v1/darkstore/inventory/stock-levels/:sku` | darkstore | yes | admin-jwt | ctrl.updateStockLevel | darkstore.service | NOT_TESTED | - |
| 973 | PUT | `/api/v1/darkstore/inventory/stock-levels/:sku/status` | darkstore | yes | admin-jwt | ctrl.changeItemStatus | darkstore.service | NOT_TESTED | - |
| 974 | GET | `/api/v1/darkstore/issues` | darkstore | yes | admin-jwt | ctrl.listIssues | darkstore.service | NOT_TESTED | - |
| 975 | GET | `/api/v1/darkstore/issues/:id` | darkstore | yes | admin-jwt | ctrl.getIssueById | darkstore.service | NOT_TESTED | - |
| 976 | PATCH | `/api/v1/darkstore/issues/:id` | darkstore | yes | admin-jwt | ctrl.updateIssue | darkstore.service | NOT_TESTED | - |
| 977 | GET | `/api/v1/darkstore/issues/ops-users` | darkstore | yes | admin-jwt | ctrl.getOpsUsers | darkstore.service | NOT_TESTED | - |
| 978 | POST | `/api/v1/darkstore/logistics/estimate` | darkstore | yes | admin-jwt | ctrl.getLogisticsEstimate | darkstore.service | NOT_TESTED | - |
| 979 | GET | `/api/v1/darkstore/logistics/orders` | darkstore | yes | admin-jwt | ctrl.listLogisticsOrders | darkstore.service | NOT_TESTED | - |
| 980 | POST | `/api/v1/darkstore/logistics/orders` | darkstore | yes | admin-jwt | ctrl.createLogisticsOrder | darkstore.service | NOT_TESTED | - |
| 981 | GET | `/api/v1/darkstore/logistics/orders/:id` | darkstore | yes | admin-jwt | ctrl.getLogisticsOrder | darkstore.service | NOT_TESTED | - |
| 982 | POST | `/api/v1/darkstore/logistics/orders/:id/cancel` | darkstore | yes | admin-jwt | ctrl.cancelLogisticsOrder | darkstore.service | NOT_TESTED | - |
| 983 | GET | `/api/v1/darkstore/logistics/orders/:id/tracking` | darkstore | yes | admin-jwt | ctrl.getLogisticsOrderTracking | darkstore.service | NOT_TESTED | - |
| 984 | GET | `/api/v1/darkstore/operations/activity-feed` | darkstore | yes | admin-jwt | ctrl.getActivityFeed | darkstore.service | NOT_TESTED | - |
| 985 | GET | `/api/v1/darkstore/operations/alerts` | darkstore | yes | admin-jwt | ctrl.getOperationalAlerts | darkstore.service | NOT_TESTED | - |
| 986 | GET | `/api/v1/darkstore/operations/escalation-suggestions` | darkstore | yes | admin-jwt | ctrl.getEscalationSuggestions | darkstore.service | NOT_TESTED | - |
| 987 | GET | `/api/v1/darkstore/operations/exception-queue` | darkstore | yes | admin-jwt | ctrl.getExceptionQueue | darkstore.service | NOT_TESTED | - |
| 988 | GET | `/api/v1/darkstore/operations/live-picking` | darkstore | yes | admin-jwt | ctrl.getLivePickingMonitor | darkstore.service | NOT_TESTED | - |
| 989 | GET | `/api/v1/darkstore/operations/missing-items` | darkstore | yes | admin-jwt | ctrl.getMissingItems | darkstore.service | NOT_TESTED | - |
| 990 | GET | `/api/v1/darkstore/operations/order-workflow/:orderId` | darkstore | yes | admin-jwt | ctrl.getOrderWorkflow | darkstore.service | NOT_TESTED | - |
| 991 | GET | `/api/v1/darkstore/operations/pipeline` | darkstore | yes | admin-jwt | ctrl.getPipelineStats | darkstore.service | NOT_TESTED | - |
| 992 | GET | `/api/v1/darkstore/operations/regional-pipeline` | darkstore | yes | admin-jwt | ctrl.getRegionalPipeline | darkstore.service | NOT_TESTED | - |
| 993 | GET | `/api/v1/darkstore/operations/sla-monitor` | darkstore | yes | admin-jwt | ctrl.getSlaMonitor | darkstore.service | NOT_TESTED | - |
| 994 | GET | `/api/v1/darkstore/operations/workflow-sla-metrics` | darkstore | yes | admin-jwt | ctrl.getWorkflowSlaMetrics | darkstore.service | NOT_TESTED | - |
| 995 | GET | `/api/v1/darkstore/orders` | darkstore | yes | admin-jwt | ctrl.getOrders | darkstore.service | NOT_TESTED | - |
| 996 | GET | `/api/v1/darkstore/orders/:orderId` | darkstore | yes | admin-jwt | ctrl.getOrderById | darkstore.service | NOT_TESTED | - |
| 997 | PATCH | `/api/v1/darkstore/orders/:orderId` | darkstore | yes | admin-jwt | ctrl.updateOrder | darkstore.service | NOT_TESTED | - |
| 998 | GET | `/api/v1/darkstore/orders/:orderId/action-logs` | darkstore | yes | admin-jwt | ctrl.getAlertHistory | darkstore.service | NOT_TESTED | - |
| 999 | PATCH | `/api/v1/darkstore/orders/:orderId/assign` | darkstore | yes | admin-jwt | ctrl.assignOrder | darkstore.service | NOT_TESTED | - |
| 1000 | PATCH | `/api/v1/darkstore/orders/:orderId/bag-rack` | darkstore | yes | admin-jwt | ctrl.updateBagRack | darkstore.service | NOT_TESTED | - |
| 1001 | GET | `/api/v1/darkstore/orders/:orderId/call-customer` | darkstore | yes | admin-jwt | ctrl.getCallCustomerLog | darkstore.service | NOT_TESTED | - |
| 1002 | POST | `/api/v1/darkstore/orders/:orderId/call-customer` | darkstore | yes | admin-jwt | ctrl.callCustomer | darkstore.service | NOT_TESTED | - |
| 1003 | POST | `/api/v1/darkstore/orders/:orderId/cancel` | darkstore | yes | admin-jwt | ctrl.cancelOrder | darkstore.service | NOT_TESTED | - |
| 1004 | PATCH | `/api/v1/darkstore/orders/:orderId/complete-picking` | darkstore | yes | admin-jwt | ctrl.completePicking | darkstore.service | NOT_TESTED | - |
| 1005 | GET | `/api/v1/darkstore/orders/:orderId/mark-rto` | darkstore | yes | admin-jwt | ctrl.getMarkRTOStatus | darkstore.service | NOT_TESTED | - |
| 1006 | POST | `/api/v1/darkstore/orders/:orderId/mark-rto` | darkstore | yes | admin-jwt | ctrl.markRTO | darkstore.service | NOT_TESTED | - |
| 1007 | PATCH | `/api/v1/darkstore/orders/:orderId/start-picking` | darkstore | yes | admin-jwt | ctrl.startPicking | darkstore.service | NOT_TESTED | - |
| 1008 | GET | `/api/v1/darkstore/outbound/dispatch` | darkstore | yes | admin-jwt | ctrl.getReadyForDispatchOrders | darkstore.service | NOT_TESTED | - |
| 1009 | POST | `/api/v1/darkstore/outbound/dispatch/assign` | darkstore | yes | admin-jwt | ctrl.manuallyAssignRider | darkstore.service | NOT_TESTED | - |
| 1010 | POST | `/api/v1/darkstore/outbound/dispatch/batch` | darkstore | yes | admin-jwt | ctrl.batchDispatchOrders | darkstore.service | NOT_TESTED | - |
| 1011 | GET | `/api/v1/darkstore/outbound/ready-orders` | darkstore | yes | admin-jwt | ctrl.getReadyForDispatchOrders | darkstore.service | NOT_TESTED | - |
| 1012 | GET | `/api/v1/darkstore/outbound/riders` | darkstore | yes | admin-jwt | ctrl.getActiveRiders | darkstore.service | NOT_TESTED | - |
| 1013 | GET | `/api/v1/darkstore/outbound/summary` | darkstore | yes | admin-jwt | ctrl.getOutboundSummary | darkstore.service | NOT_TESTED | - |
| 1014 | GET | `/api/v1/darkstore/outbound/transfers` | darkstore | yes | admin-jwt | ctrl.getOutboundTransferRequests | darkstore.service | NOT_TESTED | - |
| 1015 | POST | `/api/v1/darkstore/outbound/transfers/:requestId/approve` | darkstore | yes | admin-jwt | ctrl.approveTransferRequest | darkstore.service | NOT_TESTED | - |
| 1016 | GET | `/api/v1/darkstore/outbound/transfers/:requestId/fulfillment` | darkstore | yes | admin-jwt | ctrl.getTransferFulfillmentStatus | darkstore.service | NOT_TESTED | - |
| 1017 | POST | `/api/v1/darkstore/outbound/transfers/:requestId/reject` | darkstore | yes | admin-jwt | ctrl.rejectTransferRequest | darkstore.service | NOT_TESTED | - |
| 1018 | GET | `/api/v1/darkstore/outbound/transfers/sla-summary` | darkstore | yes | admin-jwt | ctrl.getTransferSLASummary | darkstore.service | NOT_TESTED | - |
| 1019 | GET | `/api/v1/darkstore/packing/orders/:orderId` | darkstore | yes | admin-jwt | ctrl.getPackingOrderDetails | darkstore.service | NOT_TESTED | - |
| 1020 | POST | `/api/v1/darkstore/packing/orders/:orderId/complete` | darkstore | yes | admin-jwt | ctrl.completePackingOrder | darkstore.service | NOT_TESTED | - |
| 1021 | POST | `/api/v1/darkstore/packing/orders/:orderId/report-damaged` | darkstore | yes | admin-jwt | ctrl.reportDamagedItem | darkstore.service | NOT_TESTED | - |
| 1022 | POST | `/api/v1/darkstore/packing/orders/:orderId/report-missing` | darkstore | yes | admin-jwt | ctrl.reportMissingItem | darkstore.service | NOT_TESTED | - |
| 1023 | POST | `/api/v1/darkstore/packing/orders/:orderId/scan` | darkstore | yes | admin-jwt | ctrl.scanPackingItem | darkstore.service | NOT_TESTED | - |
| 1024 | GET | `/api/v1/darkstore/packing/queue` | darkstore | yes | admin-jwt | ctrl.getPackQueue | darkstore.service | NOT_TESTED | - |
| 1025 | GET | `/api/v1/darkstore/pick-ops` | darkstore | yes | admin-jwt | ctrl.getPicklists | darkstore.service | NOT_TESTED | - |
| 1026 | GET | `/api/v1/darkstore/pickers` | darkstore | yes | admin-jwt | ctrl.getStaffRoster | darkstore.service | NOT_TESTED | - |
| 1027 | GET | `/api/v1/darkstore/pickers/:id/performance` | darkstore | yes | admin-jwt | ctrl.getPickerPerformance | darkstore.service | NOT_TESTED | - |
| 1028 | GET | `/api/v1/darkstore/pickers/available` | darkstore | yes | admin-jwt | ctrl.getStaffRoster | darkstore.service | NOT_TESTED | - |
| 1029 | GET | `/api/v1/darkstore/pickers/live` | darkstore | yes | admin-jwt | ctrl.getStaffRoster | darkstore.service | NOT_TESTED | - |
| 1030 | GET | `/api/v1/darkstore/pickers/performance/summary` | darkstore | yes | admin-jwt | ctrl.getPickerPerformanceSummary | darkstore.service | NOT_TESTED | - |
| 1031 | GET | `/api/v1/darkstore/pickers/registry` | darkstore | yes | admin-jwt | ctrl.getPickerRegistry | darkstore.service | NOT_TESTED | - |
| 1032 | GET | `/api/v1/darkstore/picklists` | darkstore | yes | admin-jwt | ctrl.getPicklists | darkstore.service | NOT_TESTED | - |
| 1033 | POST | `/api/v1/darkstore/picklists` | darkstore | yes | admin-jwt | ctrl.createPicklist | darkstore.service | NOT_TESTED | - |
| 1034 | GET | `/api/v1/darkstore/picklists/:picklistId` | darkstore | yes | admin-jwt | ctrl.getPicklistDetails | darkstore.service | NOT_TESTED | - |
| 1035 | POST | `/api/v1/darkstore/picklists/:picklistId/assign` | darkstore | yes | admin-jwt | ctrl.assignPickerToPicklist | darkstore.service | NOT_TESTED | - |
| 1036 | POST | `/api/v1/darkstore/picklists/:picklistId/complete` | darkstore | yes | admin-jwt | ctrl.completePicklist | darkstore.service | NOT_TESTED | - |
| 1037 | POST | `/api/v1/darkstore/picklists/:picklistId/move-to-packing` | darkstore | yes | admin-jwt | ctrl.movePicklistToPacking | darkstore.service | NOT_TESTED | - |
| 1038 | POST | `/api/v1/darkstore/picklists/:picklistId/pause` | darkstore | yes | admin-jwt | ctrl.pausePicklist | darkstore.service | NOT_TESTED | - |
| 1039 | POST | `/api/v1/darkstore/picklists/:picklistId/progress` | darkstore | yes | admin-jwt | ctrl.updatePicklistProgress | darkstore.service | NOT_TESTED | - |
| 1040 | POST | `/api/v1/darkstore/picklists/:picklistId/start` | darkstore | yes | admin-jwt | ctrl.startPicklistPicking | darkstore.service | NOT_TESTED | - |
| 1041 | GET | `/api/v1/darkstore/qc/checks` | darkstore | yes | admin-jwt | ctrl.getComplianceChecks | darkstore.service | NOT_TESTED | - |
| 1042 | PUT | `/api/v1/darkstore/qc/checks/:itemId` | darkstore | yes | admin-jwt | ctrl.toggleComplianceCheck | darkstore.service | NOT_TESTED | - |
| 1043 | GET | `/api/v1/darkstore/qc/compliance/audit-status` | darkstore | yes | admin-jwt | ctrl.getAuditStatus | darkstore.service | NOT_TESTED | - |
| 1044 | GET | `/api/v1/darkstore/qc/compliance/logs` | darkstore | yes | admin-jwt | ctrl.getComplianceLogs | darkstore.service | NOT_TESTED | - |
| 1045 | POST | `/api/v1/darkstore/qc/compliance/logs` | darkstore | yes | admin-jwt | ctrl.addComplianceLog | darkstore.service | NOT_TESTED | - |
| 1046 | GET | `/api/v1/darkstore/qc/docs` | darkstore | yes | admin-jwt | ctrl.getComplianceDocs | darkstore.service | NOT_TESTED | - |
| 1047 | GET | `/api/v1/darkstore/qc/failures` | darkstore | yes | admin-jwt | ctrl.getQCFailures | darkstore.service | NOT_TESTED | - |
| 1048 | POST | `/api/v1/darkstore/qc/failures/:failureId/resolve` | darkstore | yes | admin-jwt | ctrl.resolveQCFailure | darkstore.service | NOT_TESTED | - |
| 1049 | GET | `/api/v1/darkstore/qc/history` | darkstore | yes | admin-jwt | ctrl.getAlertHistory | darkstore.service | NOT_TESTED | - |
| 1050 | GET | `/api/v1/darkstore/qc/inspections` | darkstore | yes | admin-jwt | ctrl.getQCInspections | darkstore.service | NOT_TESTED | - |
| 1051 | POST | `/api/v1/darkstore/qc/inspections` | darkstore | yes | admin-jwt | ctrl.createQCInspection | darkstore.service | NOT_TESTED | - |
| 1052 | GET | `/api/v1/darkstore/qc/recent-failures` | darkstore | yes | admin-jwt | ctrl.getQCFailures | darkstore.service | NOT_TESTED | - |
| 1053 | GET | `/api/v1/darkstore/qc/rejections` | darkstore | yes | admin-jwt | ctrl.getRejections | darkstore.service | NOT_TESTED | - |
| 1054 | POST | `/api/v1/darkstore/qc/rejections` | darkstore | yes | admin-jwt | ctrl.createRejection | darkstore.service | NOT_TESTED | - |
| 1055 | GET | `/api/v1/darkstore/qc/samples` | darkstore | yes | admin-jwt | ctrl.getSampleTests | darkstore.service | NOT_TESTED | - |
| 1056 | POST | `/api/v1/darkstore/qc/samples` | darkstore | yes | admin-jwt | ctrl.createSampleTest | darkstore.service | NOT_TESTED | - |
| 1057 | PUT | `/api/v1/darkstore/qc/samples/:sampleId` | darkstore | yes | admin-jwt | ctrl.updateSampleResult | darkstore.service | NOT_TESTED | - |
| 1058 | GET | `/api/v1/darkstore/qc/summary` | darkstore | yes | admin-jwt | ctrl.getQCSummary | darkstore.service | NOT_TESTED | - |
| 1059 | GET | `/api/v1/darkstore/qc/temperature` | darkstore | yes | admin-jwt | ctrl.getTemperatureLogs | darkstore.service | NOT_TESTED | - |
| 1060 | POST | `/api/v1/darkstore/qc/temperature` | darkstore | yes | admin-jwt | ctrl.createTemperatureLog | darkstore.service | NOT_TESTED | - |
| 1061 | GET | `/api/v1/darkstore/qc/watchlist` | darkstore | yes | admin-jwt | ctrl.getWatchlist | darkstore.service | NOT_TESTED | - |
| 1062 | POST | `/api/v1/darkstore/qc/watchlist` | darkstore | yes | admin-jwt | ctrl.addWatchlistItem | darkstore.service | NOT_TESTED | - |
| 1063 | POST | `/api/v1/darkstore/qc/watchlist/:sku/log-check` | darkstore | yes | admin-jwt | ctrl.logQCCheck | darkstore.service | NOT_TESTED | - |
| 1064 | GET | `/api/v1/darkstore/reports/compliance` | darkstore | yes | admin-jwt | ctrl.getComplianceReport | darkstore.service | NOT_TESTED | - |
| 1065 | GET | `/api/v1/darkstore/reports/export` | darkstore | yes | admin-jwt | ctrl.exportReport | darkstore.service | NOT_TESTED | - |
| 1066 | GET | `/api/v1/darkstore/reports/inventory` | darkstore | yes | admin-jwt | ctrl.getInventoryReport | darkstore.service | NOT_TESTED | - |
| 1067 | GET | `/api/v1/darkstore/reports/staff` | darkstore | yes | admin-jwt | ctrl.getStaffReport | darkstore.service | NOT_TESTED | - |
| 1068 | GET | `/api/v1/darkstore/settings` | darkstore | yes | admin-jwt | ctrl.getSettings | darkstore.service | NOT_TESTED | - |
| 1069 | PUT | `/api/v1/darkstore/settings` | darkstore | yes | admin-jwt | ctrl.updateSettings | darkstore.service | NOT_TESTED | - |
| 1070 | GET | `/api/v1/darkstore/staff/absences` | darkstore | yes | admin-jwt | ctrl.getAbsences | darkstore.service | NOT_TESTED | - |
| 1071 | POST | `/api/v1/darkstore/staff/absences` | darkstore | yes | admin-jwt | ctrl.logAbsence | darkstore.service | NOT_TESTED | - |
| 1072 | GET | `/api/v1/darkstore/staff/performance` | darkstore | yes | admin-jwt | ctrl.getStaffPerformance | darkstore.service | NOT_TESTED | - |
| 1073 | GET | `/api/v1/darkstore/staff/performance/download` | darkstore | yes | admin-jwt | ctrl.downloadStaffPerformance | darkstore.service | NOT_TESTED | - |
| 1074 | GET | `/api/v1/darkstore/staff/roster` | darkstore | yes | admin-jwt | ctrl.getStaffRoster | darkstore.service | NOT_TESTED | - |
| 1075 | GET | `/api/v1/darkstore/staff/shift-coverage` | darkstore | yes | admin-jwt | ctrl.getShiftCoverage | darkstore.service | NOT_TESTED | - |
| 1076 | POST | `/api/v1/darkstore/staff/shifts/auto-assign-ot` | darkstore | yes | admin-jwt | ctrl.autoAssignOT | darkstore.service | NOT_TESTED | - |
| 1077 | GET | `/api/v1/darkstore/staff/summary` | darkstore | yes | admin-jwt | ctrl.getStaffSummary | darkstore.service | NOT_TESTED | - |
| 1078 | GET | `/api/v1/darkstore/staff/weekly-roster` | darkstore | yes | admin-jwt | ctrl.getWeeklyRoster | darkstore.service | NOT_TESTED | - |
| 1079 | POST | `/api/v1/darkstore/staff/weekly-roster/publish` | darkstore | yes | admin-jwt | ctrl.publishRoster | darkstore.service | NOT_TESTED | - |
| 1080 | GET | `/api/v1/darkstore/utilities/audit-logs` | darkstore | yes | admin-jwt | ctrl.getAuditLogs | darkstore.service | NOT_TESTED | - |
| 1081 | POST | `/api/v1/darkstore/utilities/audit-logs/export` | darkstore | yes | admin-jwt | ctrl.exportAuditLogs | darkstore.service | NOT_TESTED | - |
| 1082 | POST | `/api/v1/darkstore/utilities/inventory/bulk-upload` | darkstore | yes | admin-jwt | ctrl.bulkUploadInventory | darkstore.service | NOT_TESTED | - |
| 1083 | GET | `/api/v1/darkstore/utilities/inventory/upload-template` | darkstore | yes | admin-jwt | ctrl.downloadInventoryTemplate | darkstore.service | NOT_TESTED | - |
| 1084 | POST | `/api/v1/darkstore/utilities/labels/generate` | darkstore | yes | admin-jwt | ctrl.generateLabel | darkstore.service | NOT_TESTED | - |
| 1085 | POST | `/api/v1/darkstore/utilities/system/diagnostics` | darkstore | yes | admin-jwt | ctrl.runSystemDiagnostics | darkstore.service | NOT_TESTED | - |
| 1086 | GET | `/api/v1/darkstore/utilities/system/status` | darkstore | yes | admin-jwt | ctrl.getSystemStatus | darkstore.service | NOT_TESTED | - |
| 1087 | POST | `/api/v1/darkstore/utilities/system/sync` | darkstore | yes | admin-jwt | ctrl.forceGlobalSync | darkstore.service | NOT_TESTED | - |
| 1088 | GET | `/api/v1/diag/hubs` | diag-hubs.ts | no | - | inline-handler | - | PASS | non-production only |
| 1089 | POST | `/api/v1/diag/normalize-rider-hub` | diag-hubs.ts | no | - | inline-handler | - | NOT_TESTED | non-production only |
| 1090 | GET | `/api/v1/diag/order-flow` | diag-order-flow.ts | no | - | inline-handler | - | PASS | non-production only |
| 1091 | GET | `/api/v1/diag/resolve-hub` | diag-hubs.ts | no | - | inline-handler | - | NOT_TESTED | non-production only |
| 1092 | PUT | `/api/v1/hhd/admin/picker-users/:pickerUserId/link` | hhd | partial | ADMIN;hhd-jwt | USER_ROLE.ADMIN | hhd.service | NOT_TESTED | - |
| 1093 | POST | `/api/v1/hhd/auth/logout` | hhd | yes | hhd-jwt | logout | hhd.service | NOT_TESTED | - |
| 1094 | GET | `/api/v1/hhd/auth/me` | hhd | yes | hhd-jwt | getMe | hhd.service | NOT_TESTED | - |
| 1095 | POST | `/api/v1/hhd/auth/refresh` | hhd | no | - | refreshSession | hhd.service | NOT_TESTED | - |
| 1096 | POST | `/api/v1/hhd/auth/resend-otp` | hhd | no | - | resendOTP | hhd.service | NOT_TESTED | - |
| 1097 | POST | `/api/v1/hhd/auth/send-otp` | hhd | no | - | sendOTP | hhd.service | PASS | - |
| 1098 | POST | `/api/v1/hhd/auth/verify-otp` | hhd | no | - | verifyOTPHandler | hhd.service | PARTIAL | - |
| 1099 | GET | `/api/v1/hhd/bags/:bagId` | hhd | yes | hhd-jwt | getBag | hhd.service | NOT_TESTED | - |
| 1100 | PUT | `/api/v1/hhd/bags/:bagId` | hhd | yes | hhd-jwt | updateBag | hhd.service | NOT_TESTED | - |
| 1101 | POST | `/api/v1/hhd/bags/scan` | hhd | yes | hhd-jwt | scanBag | hhd.service | NOT_TESTED | - |
| 1102 | GET | `/api/v1/hhd/dashboard` | hhd | yes | hhd-jwt | getDashboard | hhd.service | NOT_TESTED | - |
| 1103 | GET | `/api/v1/hhd/devices/current` | hhd | yes | hhd-jwt | getCurrentDevice | hhd.service | NOT_TESTED | - |
| 1104 | PUT | `/api/v1/hhd/items/:itemId` | hhd | yes | hhd-jwt | updateItem | hhd.service | NOT_TESTED | - |
| 1105 | PUT | `/api/v1/hhd/items/:itemId/not-found` | hhd | yes | hhd-jwt | markItemNotFound | hhd.service | NOT_TESTED | - |
| 1106 | GET | `/api/v1/hhd/items/order/:orderId` | hhd | yes | hhd-jwt | getOrderItems | hhd.service | NOT_TESTED | - |
| 1107 | POST | `/api/v1/hhd/items/scan` | hhd | yes | hhd-jwt | scanItem | hhd.service | NOT_TESTED | - |
| 1108 | GET | `/api/v1/hhd/items/substitutes` | hhd | yes | hhd-jwt | getSubstitutes | hhd.service | NOT_TESTED | - |
| 1109 | GET | `/api/v1/hhd/orders` | hhd | yes | hhd-jwt | getOrders | hhd.service | PASS | - |
| 1110 | POST | `/api/v1/hhd/orders` | hhd | yes | hhd-jwt | createOrder | hhd.service | NOT_TESTED | - |
| 1111 | GET | `/api/v1/hhd/orders/:orderId` | hhd | yes | hhd-jwt | getOrder | hhd.service | PASS | - |
| 1112 | PUT | `/api/v1/hhd/orders/:orderId/accept` | hhd | yes | hhd-jwt | acceptAvailableOrder | hhd.service | NOT_TESTED | - |
| 1113 | GET | `/api/v1/hhd/orders/:orderId/summary` | hhd | yes | hhd-jwt | getOrderSummary | hhd.service | PASS | - |
| 1114 | GET | `/api/v1/hhd/orders/assignorders/status/:status` | hhd | yes | hhd-jwt | getAssignOrdersByStatus | hhd.service | NOT_TESTED | - |
| 1115 | GET | `/api/v1/hhd/orders/available` | hhd | yes | hhd-jwt | getAvailableOrders | hhd.service | NOT_TESTED | - |
| 1116 | GET | `/api/v1/hhd/orders/completed` | hhd | yes | hhd-jwt | getCompletedOrders | hhd.service | NOT_TESTED | - |
| 1117 | GET | `/api/v1/hhd/orders/current` | hhd | yes | hhd-jwt | getCurrentOrder | hhd.service | NOT_TESTED | - |
| 1118 | POST | `/api/v1/hhd/photos` | hhd | yes | hhd-jwt | inline-handler | - | NOT_TESTED | - |
| 1119 | PUT | `/api/v1/hhd/photos/:photoId/verify` | hhd | yes | hhd-jwt | verifyPhoto | hhd.service | NOT_TESTED | - |
| 1120 | GET | `/api/v1/hhd/photos/order/:orderId/bag/:bagId` | hhd | yes | hhd-jwt | getPhoto | hhd.service | NOT_TESTED | - |
| 1121 | POST | `/api/v1/hhd/pick/report-issue` | hhd | yes | hhd-jwt | reportIssue | hhd.service | NOT_TESTED | - |
| 1122 | GET | `/api/v1/hhd/racks/:rackCode` | hhd | yes | hhd-jwt | getRack | hhd.service | NOT_TESTED | - |
| 1123 | GET | `/api/v1/hhd/racks/available` | hhd | yes | hhd-jwt | getAvailableRacks | hhd.service | NOT_TESTED | - |
| 1124 | POST | `/api/v1/hhd/racks/scan` | hhd | yes | hhd-jwt | scanRack | hhd.service | NOT_TESTED | - |
| 1125 | GET | `/api/v1/hhd/scanned-items/:id` | hhd | yes | hhd-jwt | getScannedItem | hhd.service | NOT_TESTED | - |
| 1126 | GET | `/api/v1/hhd/tasks` | hhd | yes | hhd-jwt | listTasks | hhd.service | NOT_TESTED | - |
| 1127 | PUT | `/api/v1/hhd/tasks/:taskId` | hhd | yes | hhd-jwt | updateTask | hhd.service | NOT_TESTED | - |
| 1128 | GET | `/api/v1/hhd/users/contract` | hhd | yes | hhd-jwt | getContract | hhd.service | NOT_TESTED | - |
| 1129 | GET | `/api/v1/hhd/users/employment` | hhd | yes | hhd-jwt | getEmployment | hhd.service | NOT_TESTED | - |
| 1130 | POST | `/api/v1/hhd/users/heartbeat` | hhd | yes | hhd-jwt | postHeartbeat | hhd.service | NOT_TESTED | - |
| 1131 | GET | `/api/v1/hhd/users/linked-picker-profile` | hhd | yes | hhd-jwt | getLinkedPickerProfile | hhd.service | NOT_TESTED | - |
| 1132 | GET | `/api/v1/hhd/users/profile` | hhd | yes | hhd-jwt | getProfile | hhd.service | NOT_TESTED | - |
| 1133 | PUT | `/api/v1/hhd/users/profile` | hhd | yes | hhd-jwt | updateProfile | hhd.service | NOT_TESTED | - |
| 1134 | GET | `/api/v1/logistics/health` | logistics | no | - | inline-handler | - | NOT_TESTED | - |
| 1135 | POST | `/api/v1/logistics/webhooks/porter` | logistics | no | - | ingestPorter | logistics.service | NOT_TESTED | - |
| 1136 | GET | `/api/v1/merch/health` | merch | yes | hhd-jwt | inline-handler | - | NOT_TESTED | - |
| 1137 | POST | `/api/v1/picker/account/delete-request` | picker | yes | picker-jwt | ctrl.requestAccountDeletion | picker.service | NOT_TESTED | - |
| 1138 | POST | `/api/v1/picker/approval/verify-location-otp` | picker | yes | picker-jwt | ctrl.verifyLocationOtp | picker.service | NOT_TESTED | - |
| 1139 | GET | `/api/v1/picker/attendance` | picker | yes | picker-jwt | ctrl.getAttendance | picker.service | NOT_TESTED | - |
| 1140 | POST | `/api/v1/picker/attendance/punch-in` | picker | partial | picker-jwt;active-picker | ctrl.punchIn | picker.service | NOT_TESTED | - |
| 1141 | POST | `/api/v1/picker/attendance/punch-out` | picker | partial | picker-jwt;active-picker | ctrl.punchOut | picker.service | NOT_TESTED | - |
| 1142 | GET | `/api/v1/picker/attendance/stats` | picker | yes | picker-jwt | ctrl.getAttendanceStats | picker.service | NOT_TESTED | - |
| 1143 | GET | `/api/v1/picker/attendance/summary` | picker | yes | picker-jwt | ctrl.getAttendanceSummary | picker.service | NOT_TESTED | - |
| 1144 | POST | `/api/v1/picker/auth/logout` | picker | yes | picker-jwt | ctrl.logout | picker.service | NOT_TESTED | - |
| 1145 | POST | `/api/v1/picker/auth/refresh` | picker | yes | picker-jwt | ctrl.refreshToken | picker.service | NOT_TESTED | - |
| 1146 | POST | `/api/v1/picker/auth/resend-otp` | picker | no | - | ctrl.resendOtp | picker.service | NOT_TESTED | - |
| 1147 | POST | `/api/v1/picker/auth/resend-otp-email` | picker | no | - | ctrl.resendOtpEmail | picker.service | NOT_TESTED | - |
| 1148 | POST | `/api/v1/picker/auth/send-otp` | picker | no | - | ctrl.sendOtp | picker.service | PASS | - |
| 1149 | POST | `/api/v1/picker/auth/send-otp-email` | picker | no | - | ctrl.sendOtpEmail | picker.service | NOT_TESTED | - |
| 1150 | POST | `/api/v1/picker/auth/verify-otp` | picker | no | - | ctrl.verifyOtp | picker.service | PARTIAL | - |
| 1151 | POST | `/api/v1/picker/auth/verify-otp-email` | picker | no | - | ctrl.verifyOtpEmail | picker.service | NOT_TESTED | - |
| 1152 | GET | `/api/v1/picker/bank-accounts` | picker | yes | picker-jwt | ctrl.listBankAccounts | picker.service | NOT_TESTED | - |
| 1153 | POST | `/api/v1/picker/bank-accounts` | picker | yes | picker-jwt | ctrl.addBankAccount | picker.service | NOT_TESTED | - |
| 1154 | GET | `/api/v1/picker/bank/accounts` | picker | yes | picker-jwt | ctrl.listBankAccounts | picker.service | NOT_TESTED | - |
| 1155 | POST | `/api/v1/picker/bank/accounts` | picker | yes | picker-jwt | ctrl.addBankAccount | picker.service | NOT_TESTED | - |
| 1156 | PUT | `/api/v1/picker/bank/accounts/:accountId` | picker | yes | picker-jwt | ctrl.updateBankAccount | picker.service | NOT_TESTED | - |
| 1157 | POST | `/api/v1/picker/bank/accounts/:accountId/delete` | picker | yes | picker-jwt | ctrl.deleteBankAccount | picker.service | NOT_TESTED | - |
| 1158 | PUT | `/api/v1/picker/bank/accounts/:accountId/set-default` | picker | yes | picker-jwt | ctrl.setBankAccountDefault | picker.service | NOT_TESTED | - |
| 1159 | POST | `/api/v1/picker/bank/verify` | picker | yes | picker-jwt | ctrl.verifyBankAccount | picker.service | NOT_TESTED | - |
| 1160 | POST | `/api/v1/picker/bulk/bag/load` | picker | yes | picker-jwt | ctrl.loadBulkBag | picker.service | NOT_TESTED | - |
| 1161 | POST | `/api/v1/picker/bulk/bag/load` | picker | partial | picker-jwt;active-picker | ctrl.loadBulkBag | picker.service | NOT_TESTED | - |
| 1162 | GET | `/api/v1/picker/bulk/batch` | picker | yes | picker-jwt | ctrl.getBulkBatch | picker.service | NOT_TESTED | - |
| 1163 | GET | `/api/v1/picker/bulk/batch` | picker | partial | picker-jwt;active-picker | ctrl.getBulkBatch | picker.service | NOT_TESTED | - |
| 1164 | GET | `/api/v1/picker/bulk/batches` | picker | partial | picker-jwt;active-picker | ctrl.listBulkBatches | picker.service | NOT_TESTED | - |
| 1165 | GET | `/api/v1/picker/bulk/batches/:batchId` | picker | partial | picker-jwt;active-picker | ctrl.getBulkBatchDetail | picker.service | NOT_TESTED | - |
| 1166 | POST | `/api/v1/picker/bulk/start` | picker | yes | picker-jwt | ctrl.startBulkDelivery | picker.service | NOT_TESTED | - |
| 1167 | POST | `/api/v1/picker/bulk/start` | picker | partial | picker-jwt;active-picker | ctrl.startBulkBatch | picker.service | NOT_TESTED | - |
| 1168 | POST | `/api/v1/picker/bulk/stops/:stopId/arrive` | picker | partial | picker-jwt;active-picker | ctrl.arriveBulkStop | picker.service | NOT_TESTED | - |
| 1169 | POST | `/api/v1/picker/bulk/stops/:stopId/deliver` | picker | partial | picker-jwt;active-picker | ctrl.deliverBulkStop | picker.service | NOT_TESTED | - |
| 1170 | POST | `/api/v1/picker/bulk/stops/:stopId/fail` | picker | partial | picker-jwt;active-picker | ctrl.failBulkStop | picker.service | NOT_TESTED | - |
| 1171 | POST | `/api/v1/picker/bulk/stops/:stopId/proof-photo` | picker | partial | picker-jwt;active-picker | ctrl.uploadBulkStopPhoto | picker.service | NOT_TESTED | - |
| 1172 | POST | `/api/v1/picker/bulk/stops/:stopIdx/deliver` | picker | yes | picker-jwt | ctrl.markBulkStopDelivered | picker.service | NOT_TESTED | - |
| 1173 | POST | `/api/v1/picker/bulk/stops/:stopIdx/fail` | picker | yes | picker-jwt | ctrl.markBulkStopFailed | picker.service | NOT_TESTED | - |
| 1174 | POST | `/api/v1/picker/cash/deposits` | picker | partial | picker-jwt;active-picker | ctrl.recordCashDeposit | picker.service | NOT_TESTED | - |
| 1175 | GET | `/api/v1/picker/cash/summary` | picker | partial | picker-jwt;active-picker | ctrl.getCashSummary | picker.service | NOT_TESTED | - |
| 1176 | GET | `/api/v1/picker/cash/transactions` | picker | partial | picker-jwt;active-picker | ctrl.listCashTransactions | picker.service | NOT_TESTED | - |
| 1177 | GET | `/api/v1/picker/config` | picker | no | - | ctrl.getPublicConfig | picker.service | PASS | - |
| 1178 | GET | `/api/v1/picker/config/cancel-reasons` | picker | yes | picker-jwt | ctrl.getCancelReasons | picker.service | NOT_TESTED | - |
| 1179 | POST | `/api/v1/picker/dark-store-login` | picker | yes | picker-jwt | ctrl.registerAtDarkStore | picker.service | NOT_TESTED | - |
| 1180 | GET | `/api/v1/picker/dashboard/today` | picker | partial | picker-jwt;active-picker | ctrl.getDashboardToday | picker.service | NOT_TESTED | - |
| 1181 | GET | `/api/v1/picker/devices/assigned` | picker | yes | picker-jwt | ctrl.getAssignedDevice | picker.service | NOT_TESTED | - |
| 1182 | POST | `/api/v1/picker/devices/collection-complete` | picker | yes | picker-jwt | ctrl.acknowledgeDeviceCollection | picker.service | NOT_TESTED | - |
| 1183 | POST | `/api/v1/picker/devices/return` | picker | yes | picker-jwt | ctrl.returnDevice | picker.service | NOT_TESTED | - |
| 1184 | POST | `/api/v1/picker/devices/upload-condition-photo` | picker | yes | picker-jwt | ctrl.uploadDeviceConditionPhoto | picker.service | NOT_TESTED | - |
| 1185 | POST | `/api/v1/picker/didit/session` | picker | yes | picker-jwt | ctrl.createDiditSession | picker.service | NOT_TESTED | - |
| 1186 | GET | `/api/v1/picker/didit/status` | picker | yes | picker-jwt | ctrl.getDiditStatus | picker.service | NOT_TESTED | - |
| 1187 | POST | `/api/v1/picker/didit/webhook` | picker | no | - | ctrl.handleDiditWebhook | picker.service | PARTIAL | - |
| 1188 | GET | `/api/v1/picker/documents` | picker | yes | picker-jwt | ctrl.listDocuments | picker.service | NOT_TESTED | - |
| 1189 | POST | `/api/v1/picker/documents` | picker | yes | picker-jwt | ctrl.uploadDocument | picker.service | NOT_TESTED | - |
| 1190 | POST | `/api/v1/picker/documents/upload` | picker | yes | picker-jwt | ctrl.uploadDocument | picker.service | NOT_TESTED | - |
| 1191 | GET | `/api/v1/picker/faq` | picker | no | - | ctrl.listFAQ | picker.service | PASS | - |
| 1192 | POST | `/api/v1/picker/heartbeat` | picker | yes | picker-jwt | ctrl.postHeartbeat | picker.service | NOT_TESTED | - |
| 1193 | GET | `/api/v1/picker/home/summary` | picker | yes | picker-jwt | ctrl.getHomeSummary | picker.service | NOT_TESTED | - |
| 1194 | GET | `/api/v1/picker/incentives/today` | picker | partial | picker-jwt;active-picker | ctrl.getIncentivesToday | picker.service | NOT_TESTED | - |
| 1195 | POST | `/api/v1/picker/issues` | picker | yes | picker-jwt | ctrl.reportIssue | picker.service | NOT_TESTED | - |
| 1196 | GET | `/api/v1/picker/legal/config` | picker | no | - | ctrl.getLegalConfig | picker.service | NOT_TESTED | - |
| 1197 | GET | `/api/v1/picker/legal/privacy` | picker | no | - | ctrl.getLegalPrivacy | picker.service | NOT_TESTED | - |
| 1198 | GET | `/api/v1/picker/legal/terms` | picker | no | - | ctrl.getLegalTerms | picker.service | PASS | - |
| 1199 | GET | `/api/v1/picker/locations` | picker | yes | picker-jwt | ctrl.getLocations | picker.service | NOT_TESTED | - |
| 1200 | GET | `/api/v1/picker/locations/:locationId` | picker | yes | picker-jwt | ctrl.getLocationById | picker.service | NOT_TESTED | - |
| 1201 | GET | `/api/v1/picker/locations/current` | picker | yes | picker-jwt | ctrl.getCurrentLocation | picker.service | NOT_TESTED | - |
| 1202 | POST | `/api/v1/picker/locations/ensure-darkstore-verification` | picker | yes | picker-jwt | ctrl.ensureDarkstoreVerification | picker.service | NOT_TESTED | - |
| 1203 | POST | `/api/v1/picker/locations/nearest` | picker | yes | picker-jwt | ctrl.getNearestLocation | picker.service | NOT_TESTED | - |
| 1204 | POST | `/api/v1/picker/locations/save-darkstore-gps` | picker | yes | picker-jwt | ctrl.saveDarkstoreGps | picker.service | NOT_TESTED | - |
| 1205 | POST | `/api/v1/picker/locations/set` | picker | yes | picker-jwt | ctrl.setUserLocation | picker.service | NOT_TESTED | - |
| 1206 | POST | `/api/v1/picker/locations/set-darkstore-from-current` | picker | yes | picker-jwt | ctrl.setDarkstoreFromCurrentLocation | picker.service | NOT_TESTED | - |
| 1207 | POST | `/api/v1/picker/locations/track` | picker | yes | picker-jwt | ctrl.trackUserLocation | picker.service | NOT_TESTED | - |
| 1208 | POST | `/api/v1/picker/locations/validate` | picker | yes | picker-jwt | ctrl.validateLocation | picker.service | NOT_TESTED | - |
| 1209 | POST | `/api/v1/picker/manager/request-otp` | picker | yes | picker-jwt | ctrl.requestManagerOtp | picker.service | NOT_TESTED | - |
| 1210 | POST | `/api/v1/picker/manager/verify-otp` | picker | yes | picker-jwt | ctrl.verifyManagerOtp | picker.service | NOT_TESTED | - |
| 1211 | GET | `/api/v1/picker/notifications` | picker | yes | picker-jwt | ctrl.getNotifications | picker.service | NOT_TESTED | - |
| 1212 | PUT | `/api/v1/picker/notifications/:notificationId/read` | picker | yes | picker-jwt | ctrl.markNotificationRead | picker.service | NOT_TESTED | - |
| 1213 | PUT | `/api/v1/picker/notifications/read-all` | picker | yes | picker-jwt | ctrl.markAllNotificationsRead | picker.service | NOT_TESTED | - |
| 1214 | POST | `/api/v1/picker/onboarding/kit-ack` | picker | yes | picker-jwt | ctrl.acknowledgeKit | picker.service | NOT_TESTED | - |
| 1215 | GET | `/api/v1/picker/onboarding/state` | picker | yes | picker-jwt | ctrl.getOnboardingState | picker.service | NOT_TESTED | - |
| 1216 | POST | `/api/v1/picker/onboarding/submit` | picker | yes | picker-jwt | ctrl.submitOnboarding | picker.service | NOT_TESTED | - |
| 1217 | GET | `/api/v1/picker/performance` | picker | yes | picker-jwt | ctrl.getPerformance | picker.service | NOT_TESTED | - |
| 1218 | GET | `/api/v1/picker/performance/history` | picker | yes | picker-jwt | ctrl.getPerformanceHistory | picker.service | NOT_TESTED | - |
| 1219 | GET | `/api/v1/picker/performance/summary` | picker | yes | picker-jwt | ctrl.getPerformanceSummary | picker.service | NOT_TESTED | - |
| 1220 | POST | `/api/v1/picker/presence/ping` | picker | yes | picker-jwt | ctrl.postPresencePing | picker.service | NOT_TESTED | - |
| 1221 | GET | `/api/v1/picker/profile` | picker | yes | picker-jwt | ctrl.getRiderProfile | picker.service | NOT_TESTED | - |
| 1222 | PUT | `/api/v1/picker/profile` | picker | yes | picker-jwt | ctrl.updateRiderProfile | picker.service | NOT_TESTED | - |
| 1223 | POST | `/api/v1/picker/push-token` | picker | yes | picker-jwt | ctrl.registerPushToken | picker.service | NOT_TESTED | - |
| 1224 | GET | `/api/v1/picker/samples` | picker | no | - | ctrl.listSamples | picker.service | PARTIAL | - |
| 1225 | POST | `/api/v1/picker/samples` | picker | no | - | ctrl.createSample | picker.service | NOT_TESTED | - |
| 1226 | GET | `/api/v1/picker/samples/:id` | picker | no | - | ctrl.getSampleById | picker.service | PARTIAL | - |
| 1227 | GET | `/api/v1/picker/settings/preferences` | picker | yes | picker-jwt | ctrl.getPreferences | picker.service | NOT_TESTED | - |
| 1228 | PUT | `/api/v1/picker/settings/preferences` | picker | yes | picker-jwt | ctrl.updatePreferences | picker.service | NOT_TESTED | - |
| 1229 | GET | `/api/v1/picker/shared-orders` | picker | partial | picker-jwt;active-picker | ctrl.getSharedOrders | picker.service | PASS | - |
| 1230 | GET | `/api/v1/picker/shared-orders/:orderId` | picker | partial | picker-jwt;active-picker | ctrl.getSharedOrder | picker.service | PASS | - |
| 1231 | POST | `/api/v1/picker/shared-orders/:orderId/complete` | picker | partial | picker-jwt;active-picker | ctrl.completeSharedOrder | picker.service | NOT_TESTED | - |
| 1232 | POST | `/api/v1/picker/shared-orders/:orderId/proof-photo` | picker | partial | picker-jwt;active-picker | ctrl.uploadOrderProofPhoto | picker.service | NOT_TESTED | - |
| 1233 | PUT | `/api/v1/picker/shared-orders/:orderId/status` | picker | partial | picker-jwt;active-picker | ctrl.updateSharedOrderStatus | picker.service | NOT_TESTED | - |
| 1234 | GET | `/api/v1/picker/shared-orders/assignorders` | picker | partial | picker-jwt;active-picker | ctrl.getAssignOrders | picker.service | NOT_TESTED | - |
| 1235 | GET | `/api/v1/picker/shared-orders/completed` | picker | partial | picker-jwt;active-picker | ctrl.getCompletedSharedOrders | picker.service | NOT_TESTED | - |
| 1236 | POST | `/api/v1/picker/shifts/:shiftId/end` | picker | partial | picker-jwt;active-picker | ctrl.endShift | picker.service | NOT_TESTED | - |
| 1237 | POST | `/api/v1/picker/shifts/:shiftId/start` | picker | partial | picker-jwt;active-picker | ctrl.startShift | picker.service | NOT_TESTED | - |
| 1238 | GET | `/api/v1/picker/shifts/available` | picker | yes | picker-jwt | ctrl.listAvailableShifts | picker.service | NOT_TESTED | - |
| 1239 | POST | `/api/v1/picker/shifts/break/end` | picker | partial | picker-jwt;active-picker | ctrl.endBreak | picker.service | NOT_TESTED | - |
| 1240 | POST | `/api/v1/picker/shifts/break/start` | picker | partial | picker-jwt;active-picker | ctrl.startBreak | picker.service | NOT_TESTED | - |
| 1241 | POST | `/api/v1/picker/shifts/deselect` | picker | yes | picker-jwt | ctrl.deselectShift | picker.service | NOT_TESTED | - |
| 1242 | POST | `/api/v1/picker/shifts/end` | picker | partial | picker-jwt;active-picker | ctrl.endShift | picker.service | NOT_TESTED | - |
| 1243 | GET | `/api/v1/picker/shifts/my` | picker | yes | picker-jwt | ctrl.getMyShifts | picker.service | NOT_TESTED | - |
| 1244 | GET | `/api/v1/picker/shifts/readiness` | picker | yes | picker-jwt | ctrl.getShiftReadiness | picker.service | NOT_TESTED | - |
| 1245 | POST | `/api/v1/picker/shifts/select` | picker | yes | picker-jwt | ctrl.selectShift | picker.service | NOT_TESTED | - |
| 1246 | POST | `/api/v1/picker/shifts/start` | picker | partial | picker-jwt;active-picker | ctrl.startShift | picker.service | NOT_TESTED | - |
| 1247 | GET | `/api/v1/picker/store-otp` | picker | yes | picker-jwt | ctrl.getStoreOtp | picker.service | NOT_TESTED | - |
| 1248 | GET | `/api/v1/picker/stores/nearby` | picker | yes | picker-jwt | ctrl.getStoresNearby | picker.service | NOT_TESTED | - |
| 1249 | GET | `/api/v1/picker/support/chat/messages` | picker | yes | picker-jwt | ctrl.getChatMessages | picker.service | NOT_TESTED | - |
| 1250 | POST | `/api/v1/picker/support/chat/messages` | picker | yes | picker-jwt | ctrl.sendChatMessage | picker.service | NOT_TESTED | - |
| 1251 | GET | `/api/v1/picker/support/tickets` | picker | yes | picker-jwt | ctrl.listSupportTickets | picker.service | NOT_TESTED | - |
| 1252 | POST | `/api/v1/picker/support/tickets` | picker | yes | picker-jwt | ctrl.createSupportTicket | picker.service | NOT_TESTED | - |
| 1253 | POST | `/api/v1/picker/training/assessment` | picker | yes | picker-jwt | ctrl.submitTrainingAssessment | picker.service | NOT_TESTED | - |
| 1254 | POST | `/api/v1/picker/training/complete/:videoId` | picker | yes | picker-jwt | ctrl.completeTrainingVideo | picker.service | NOT_TESTED | - |
| 1255 | POST | `/api/v1/picker/training/modules/:moduleId/complete` | picker | yes | picker-jwt | ctrl.completeTrainingModule | picker.service | NOT_TESTED | - |
| 1256 | GET | `/api/v1/picker/training/progress` | picker | yes | picker-jwt | ctrl.getTrainingProgress | picker.service | NOT_TESTED | - |
| 1257 | PUT | `/api/v1/picker/training/progress` | picker | yes | picker-jwt | ctrl.updateTrainingProgress | picker.service | NOT_TESTED | - |
| 1258 | GET | `/api/v1/picker/training/user-progress` | picker | yes | picker-jwt | ctrl.getTrainingUserProgress | picker.service | NOT_TESTED | - |
| 1259 | GET | `/api/v1/picker/training/videos` | picker | no | - | ctrl.listTrainingVideos | picker.service | NOT_TESTED | - |
| 1260 | GET | `/api/v1/picker/training/videos/:videoId` | picker | yes | picker-jwt | ctrl.getTrainingVideoById | picker.service | NOT_TESTED | - |
| 1261 | PUT | `/api/v1/picker/training/watch-progress` | picker | yes | picker-jwt | ctrl.trackWatchProgress | picker.service | NOT_TESTED | - |
| 1262 | POST | `/api/v1/picker/uploads` | picker | yes | picker-jwt | ctrl.uploadFile | picker.service | NOT_TESTED | - |
| 1263 | PUT | `/api/v1/picker/user/location-type` | picker | yes | picker-jwt | ctrl.setLocationType | picker.service | NOT_TESTED | - |
| 1264 | GET | `/api/v1/picker/user/profile` | picker | yes | picker-jwt | ctrl.getProfile | picker.service | PASS | - |
| 1265 | PUT | `/api/v1/picker/user/profile` | picker | yes | picker-jwt | ctrl.updateProfile | picker.service | NOT_TESTED | - |
| 1266 | GET | `/api/v1/picker/user/profile/contract` | picker | yes | picker-jwt | ctrl.getUserContract | picker.service | NOT_TESTED | - |
| 1267 | PUT | `/api/v1/picker/user/profile/contract` | picker | yes | picker-jwt | ctrl.updateUserContract | picker.service | NOT_TESTED | - |
| 1268 | GET | `/api/v1/picker/user/profile/employment` | picker | yes | picker-jwt | ctrl.getEmployment | picker.service | NOT_TESTED | - |
| 1269 | PUT | `/api/v1/picker/user/profile/employment` | picker | yes | picker-jwt | ctrl.updateEmployment | picker.service | NOT_TESTED | - |
| 1270 | GET | `/api/v1/picker/user/profile/link-status` | picker | yes | picker-jwt | ctrl.getLinkStatus | picker.service | NOT_TESTED | - |
| 1271 | GET | `/api/v1/picker/user/profile/overview` | picker | yes | picker-jwt | ctrl.getProfileOverview | picker.service | NOT_TESTED | - |
| 1272 | PUT | `/api/v1/picker/user/upi` | picker | yes | picker-jwt | ctrl.setUpi | picker.service | NOT_TESTED | - |
| 1273 | POST | `/api/v1/picker/verify/face` | picker | yes | picker-jwt | ctrl.verifyFace | picker.service | NOT_TESTED | - |
| 1274 | GET | `/api/v1/picker/wallet` | picker | yes | picker-jwt | ctrl.getWallet | picker.service | NOT_TESTED | - |
| 1275 | GET | `/api/v1/picker/wallet/balance` | picker | yes | picker-jwt | ctrl.getWalletBalance | picker.service | NOT_TESTED | - |
| 1276 | POST | `/api/v1/picker/wallet/deposit` | picker | partial | picker-jwt;active-picker | ctrl.recordCashDeposit | picker.service | NOT_TESTED | - |
| 1277 | POST | `/api/v1/picker/wallet/deposit` | picker | yes | picker-jwt | ctrl.depositCash | picker.service | NOT_TESTED | - |
| 1278 | GET | `/api/v1/picker/wallet/earnings-breakdown` | picker | yes | picker-jwt | ctrl.getEarningsBreakdown | picker.service | NOT_TESTED | - |
| 1279 | GET | `/api/v1/picker/wallet/history` | picker | yes | picker-jwt | ctrl.getWalletHistory | picker.service | NOT_TESTED | - |
| 1280 | GET | `/api/v1/picker/wallet/transactions` | picker | yes | picker-jwt | ctrl.getTransactions | picker.service | NOT_TESTED | - |
| 1281 | GET | `/api/v1/picker/wallet/transactions/:transactionId` | picker | yes | picker-jwt | ctrl.getTransactionById | picker.service | NOT_TESTED | - |
| 1282 | POST | `/api/v1/picker/wallet/withdraw` | picker | yes | picker-jwt | ctrl.requestWithdrawal | picker.service | NOT_TESTED | - |
| 1283 | GET | `/api/v1/picker/wallet/withdrawal-requests/:requestId` | picker | yes | picker-jwt | ctrl.getWithdrawalRequest | picker.service | NOT_TESTED | - |
| 1284 | GET | `/api/v1/picker/work-locations` | picker | no | - | ctrl.listWorkLocations | picker.service | NOT_TESTED | - |
| 1285 | GET | `/api/v1/production/health` | production | yes | hhd-jwt | inline-handler | - | NOT_TESTED | - |
| 1286 | GET | `/api/v1/rider` | rider | yes | admin-jwt | ctrl.listRiders | rider.service | NOT_TESTED | - |
| 1287 | POST | `/api/v1/rider` | rider | yes | admin-jwt | ctrl.createRider | rider.service | NOT_TESTED | - |
| 1288 | GET | `/api/v1/rider/:riderId` | rider | yes | admin-jwt | ctrl.getRiderById | rider.service | FAIL | - |
| 1289 | PUT | `/api/v1/rider/:riderId` | rider | yes | admin-jwt | ctrl.updateRider | rider.service | NOT_TESTED | - |
| 1290 | GET | `/api/v1/rider/:riderId/compliance` | rider | yes | admin-jwt | ctrl.getRiderCompliance | rider.service | FAIL | - |
| 1291 | GET | `/api/v1/rider/:riderId/contract` | rider | yes | admin-jwt | ctrl.getRiderContract | rider.service | FAIL | - |
| 1292 | GET | `/api/v1/rider/:riderId/location` | rider | yes | admin-jwt | ctrl.getRiderLocation | rider.service | FAIL | - |
| 1293 | GET | `/api/v1/rider/:riderId/shifts` | rider | yes | admin-jwt | ctrl.listRiderShifts | rider.service | FAIL | - |
| 1294 | GET | `/api/v1/rider/:riderId/training` | rider | yes | admin-jwt | ctrl.getRiderTraining | rider.service | FAIL | - |
| 1295 | GET | `/api/v1/rider/audit/logs` | rider | yes | admin-jwt | ctrl.listAuditLogs | rider.service | NOT_TESTED | - |
| 1296 | GET | `/api/v1/rider/compliance` | rider | yes | admin-jwt | ctrl.listCompliance | rider.service | NOT_TESTED | - |
| 1297 | GET | `/api/v1/rider/compliance/:riderId` | rider | yes | admin-jwt | ctrl.getRiderCompliance | rider.service | NOT_TESTED | - |
| 1298 | POST | `/api/v1/rider/compliance/:riderId/suspend` | rider | yes | admin-jwt | ctrl.suspendRider | rider.service | NOT_TESTED | - |
| 1299 | POST | `/api/v1/rider/compliance/:riderId/unsuspend` | rider | yes | admin-jwt | ctrl.unsuspendRider | rider.service | NOT_TESTED | - |
| 1300 | GET | `/api/v1/rider/contracts` | rider | yes | admin-jwt | ctrl.listContracts | rider.service | NOT_TESTED | - |
| 1301 | GET | `/api/v1/rider/contracts/:riderId` | rider | yes | admin-jwt | ctrl.getRiderContract | rider.service | NOT_TESTED | - |
| 1302 | POST | `/api/v1/rider/contracts/:riderId/renew` | rider | yes | admin-jwt | ctrl.renewContract | rider.service | NOT_TESTED | - |
| 1303 | POST | `/api/v1/rider/contracts/:riderId/terminate` | rider | yes | admin-jwt | ctrl.terminateContract | rider.service | NOT_TESTED | - |
| 1304 | GET | `/api/v1/rider/dashboard/counts` | rider | yes | admin-jwt | ctrl.getDashboardCounts | rider.service | NOT_TESTED | - |
| 1305 | POST | `/api/v1/rider/dispatch/assign` | rider | yes | admin-jwt | ctrl.assignOrder | rider.service | NOT_TESTED | - |
| 1306 | POST | `/api/v1/rider/dispatch/auto-assign` | rider | yes | admin-jwt | ctrl.autoAssignOrders | rider.service | NOT_TESTED | - |
| 1307 | GET | `/api/v1/rider/dispatch/auto-assign/rules` | rider | yes | admin-jwt | ctrl.getAutoAssignRules | rider.service | NOT_TESTED | - |
| 1308 | PUT | `/api/v1/rider/dispatch/auto-assign/rules` | rider | yes | admin-jwt | ctrl.updateAutoAssignRule | rider.service | NOT_TESTED | - |
| 1309 | POST | `/api/v1/rider/dispatch/batch-assign` | rider | yes | admin-jwt | ctrl.batchAssignOrders | rider.service | NOT_TESTED | - |
| 1310 | POST | `/api/v1/rider/dispatch/cluster-metrics` | rider | yes | admin-jwt | ctrl.computeClusterMetrics | rider.service | NOT_TESTED | - |
| 1311 | GET | `/api/v1/rider/dispatch/clusters` | rider | yes | admin-jwt | ctrl.listClusters | rider.service | NOT_TESTED | - |
| 1312 | POST | `/api/v1/rider/dispatch/clusters` | rider | yes | admin-jwt | ctrl.saveClusters | rider.service | NOT_TESTED | - |
| 1313 | DELETE | `/api/v1/rider/dispatch/clusters/:clusterId` | rider | yes | admin-jwt | ctrl.deleteCluster | rider.service | NOT_TESTED | - |
| 1314 | POST | `/api/v1/rider/dispatch/clusters/:clusterId/assign` | rider | yes | admin-jwt | ctrl.assignCluster | rider.service | NOT_TESTED | - |
| 1315 | PUT | `/api/v1/rider/dispatch/clusters/:clusterId/orders` | rider | yes | admin-jwt | ctrl.updateClusterOrders | rider.service | NOT_TESTED | - |
| 1316 | GET | `/api/v1/rider/dispatch/group-delivery` | rider | yes | admin-jwt | ctrl.listGroupDeliveryOrders | rider.service | NOT_TESTED | - |
| 1317 | GET | `/api/v1/rider/dispatch/group-delivery/filter-options` | rider | yes | admin-jwt | ctrl.getGroupDeliveryFilterOptions | rider.service | NOT_TESTED | - |
| 1318 | GET | `/api/v1/rider/dispatch/group-orders` | rider | yes | admin-jwt | ctrl.groupOrders | rider.service | NOT_TESTED | - |
| 1319 | POST | `/api/v1/rider/dispatch/manual-order` | rider | yes | admin-jwt | ctrl.createManualOrder | rider.service | NOT_TESTED | - |
| 1320 | GET | `/api/v1/rider/dispatch/map` | rider | yes | admin-jwt | ctrl.getMapData | rider.service | NOT_TESTED | - |
| 1321 | GET | `/api/v1/rider/dispatch/map/orders` | rider | yes | admin-jwt | ctrl.getMapOrders | rider.service | NOT_TESTED | - |
| 1322 | GET | `/api/v1/rider/dispatch/map/riders` | rider | yes | admin-jwt | ctrl.getMapRiders | rider.service | NOT_TESTED | - |
| 1323 | GET | `/api/v1/rider/dispatch/orders/:orderId/assignment` | rider | yes | admin-jwt | ctrl.getOrderAssignmentDetails | rider.service | NOT_TESTED | - |
| 1324 | GET | `/api/v1/rider/dispatch/orders/:orderId/recommendations` | rider | yes | admin-jwt | ctrl.getRecommendedRiders | rider.service | NOT_TESTED | - |
| 1325 | POST | `/api/v1/rider/dispatch/simulate` | rider | yes | admin-jwt | ctrl.simulateAutoAssign | rider.service | NOT_TESTED | - |
| 1326 | GET | `/api/v1/rider/dispatch/unassigned` | rider | yes | admin-jwt | ctrl.listUnassignedOrders | rider.service | FAIL | - |
| 1327 | GET | `/api/v1/rider/dispatch/unassigned/count` | rider | yes | admin-jwt | ctrl.getUnassignedOrdersCount | rider.service | NOT_TESTED | - |
| 1328 | GET | `/api/v1/rider/distribution` | rider | yes | admin-jwt | ctrl.getRiderDistribution | rider.service | NOT_TESTED | - |
| 1329 | GET | `/api/v1/rider/fleet` | rider | yes | admin-jwt | ctrl.listVehicles | rider.service | NOT_TESTED | - |
| 1330 | POST | `/api/v1/rider/fleet` | rider | yes | admin-jwt | ctrl.createVehicle | rider.service | NOT_TESTED | - |
| 1331 | DELETE | `/api/v1/rider/fleet/:vehicleId` | rider | yes | admin-jwt | ctrl.deleteVehicle | rider.service | NOT_TESTED | - |
| 1332 | PUT | `/api/v1/rider/fleet/:vehicleId` | rider | yes | admin-jwt | ctrl.updateVehicle | rider.service | NOT_TESTED | - |
| 1333 | GET | `/api/v1/rider/fleet/maintenance` | rider | yes | admin-jwt | ctrl.listMaintenanceTasks | rider.service | NOT_TESTED | - |
| 1334 | POST | `/api/v1/rider/fleet/maintenance` | rider | yes | admin-jwt | ctrl.createMaintenanceTask | rider.service | NOT_TESTED | - |
| 1335 | GET | `/api/v1/rider/fleet/maintenance/:taskId` | rider | yes | admin-jwt | ctrl.getMaintenanceTaskById | rider.service | NOT_TESTED | - |
| 1336 | PUT | `/api/v1/rider/fleet/maintenance/:taskId` | rider | yes | admin-jwt | ctrl.updateMaintenanceTask | rider.service | NOT_TESTED | - |
| 1337 | GET | `/api/v1/rider/fleet/summary` | rider | yes | admin-jwt | ctrl.getFleetSummary | rider.service | NOT_TESTED | - |
| 1338 | GET | `/api/v1/rider/fleet/vehicles` | rider | yes | admin-jwt | ctrl.listVehicles | rider.service | NOT_TESTED | - |
| 1339 | POST | `/api/v1/rider/fleet/vehicles` | rider | yes | admin-jwt | ctrl.createVehicle | rider.service | NOT_TESTED | - |
| 1340 | GET | `/api/v1/rider/fleet/vehicles/:vehicleId` | rider | yes | admin-jwt | ctrl.getVehicleById | rider.service | NOT_TESTED | - |
| 1341 | PUT | `/api/v1/rider/fleet/vehicles/:vehicleId` | rider | yes | admin-jwt | ctrl.updateVehicle | rider.service | NOT_TESTED | - |
| 1342 | GET | `/api/v1/rider/health` | rider | no | - | res.status | rider.service | NOT_TESTED | - |
| 1343 | GET | `/api/v1/rider/hr/access` | rider | yes | admin-jwt | ctrl.listRiderAccess | rider.service | NOT_TESTED | - |
| 1344 | PUT | `/api/v1/rider/hr/access/:riderId` | rider | yes | admin-jwt | ctrl.updateRiderAccess | rider.service | NOT_TESTED | - |
| 1345 | GET | `/api/v1/rider/hr/compliance/:riderId/suspension` | rider | yes | admin-jwt | ctrl.getRiderSuspension | rider.service | NOT_TESTED | - |
| 1346 | PUT | `/api/v1/rider/hr/compliance/:riderId/suspension` | rider | yes | admin-jwt | ctrl.manageSuspension | rider.service | NOT_TESTED | - |
| 1347 | GET | `/api/v1/rider/hr/compliance/:riderId/violations` | rider | yes | admin-jwt | ctrl.getRiderViolations | rider.service | NOT_TESTED | - |
| 1348 | GET | `/api/v1/rider/hr/compliance/alerts` | rider | yes | admin-jwt | ctrl.listComplianceAlerts | rider.service | NOT_TESTED | - |
| 1349 | GET | `/api/v1/rider/hr/contracts` | rider | yes | admin-jwt | ctrl.listContracts | rider.service | NOT_TESTED | - |
| 1350 | GET | `/api/v1/rider/hr/contracts/:riderId` | rider | yes | admin-jwt | ctrl.getRiderContract | rider.service | NOT_TESTED | - |
| 1351 | PUT | `/api/v1/rider/hr/contracts/:riderId` | rider | yes | admin-jwt | ctrl.updateContract | rider.service | NOT_TESTED | - |
| 1352 | POST | `/api/v1/rider/hr/contracts/:riderId/renew` | rider | yes | admin-jwt | ctrl.renewContract | rider.service | NOT_TESTED | - |
| 1353 | POST | `/api/v1/rider/hr/contracts/:riderId/terminate` | rider | yes | admin-jwt | ctrl.terminateContract | rider.service | NOT_TESTED | - |
| 1354 | GET | `/api/v1/rider/hr/dashboard/summary` | rider | yes | admin-jwt | ctrl.getHRDashboardSummary | rider.service | NOT_TESTED | - |
| 1355 | DELETE | `/api/v1/rider/hr/devices/:riderId` | rider | yes | admin-jwt | ctrl.unassignDevice | rider.service | NOT_TESTED | - |
| 1356 | POST | `/api/v1/rider/hr/devices/:riderId` | rider | yes | admin-jwt | ctrl.assignDevice | rider.service | NOT_TESTED | - |
| 1357 | GET | `/api/v1/rider/hr/documents` | rider | yes | admin-jwt | ctrl.listDocuments | rider.service | NOT_TESTED | - |
| 1358 | GET | `/api/v1/rider/hr/documents/:documentId` | rider | yes | admin-jwt | ctrl.getDocumentById | rider.service | NOT_TESTED | - |
| 1359 | PUT | `/api/v1/rider/hr/documents/:documentId` | rider | yes | admin-jwt | ctrl.reviewDocument | rider.service | NOT_TESTED | - |
| 1360 | GET | `/api/v1/rider/hr/documents/:documentId/download` | rider | yes | admin-jwt | ctrl.downloadDocument | rider.service | NOT_TESTED | - |
| 1361 | GET | `/api/v1/rider/hr/documents/:documentId/history` | rider | yes | admin-jwt | ctrl.getDocumentHistory | rider.service | NOT_TESTED | - |
| 1362 | GET | `/api/v1/rider/hr/documents/:documentId/rejection-reason` | rider | yes | admin-jwt | ctrl.getDocumentRejectionReason | rider.service | NOT_TESTED | - |
| 1363 | GET | `/api/v1/rider/hr/riders` | rider | yes | admin-jwt | ctrl.listHRRiders | rider.service | NOT_TESTED | - |
| 1364 | POST | `/api/v1/rider/hr/riders` | rider | yes | admin-jwt | ctrl.onboardRider | rider.service | NOT_TESTED | - |
| 1365 | GET | `/api/v1/rider/hr/riders/:riderId` | rider | yes | admin-jwt | ctrl.getRiderHR | rider.service | NOT_TESTED | - |
| 1366 | PUT | `/api/v1/rider/hr/riders/:riderId` | rider | yes | admin-jwt | ctrl.updateRiderHR | rider.service | NOT_TESTED | - |
| 1367 | POST | `/api/v1/rider/hr/riders/:riderId/approve` | rider | yes | admin-jwt | ctrl.approveOnboarding | rider.service | NOT_TESTED | - |
| 1368 | POST | `/api/v1/rider/hr/riders/:riderId/remind` | rider | yes | admin-jwt | ctrl.sendRiderReminder | rider.service | NOT_TESTED | - |
| 1369 | GET | `/api/v1/rider/hr/training` | rider | yes | admin-jwt | ctrl.listTraining | rider.service | NOT_TESTED | - |
| 1370 | PUT | `/api/v1/rider/hr/training/:riderId` | rider | yes | admin-jwt | ctrl.markTrainingCompleted | rider.service | NOT_TESTED | - |
| 1371 | GET | `/api/v1/rider/kit/config` | rider | no | - | ctrl.getKitConfig | rider.service | NOT_TESTED | - |
| 1372 | POST | `/api/v1/rider/kit/config` | rider | yes | admin-jwt | ctrl.updateKitConfig | rider.service | NOT_TESTED | - |
| 1373 | GET | `/api/v1/rider/kit/training-videos` | rider | no | - | ctrl.getKitTrainingVideos | rider.service | NOT_TESTED | - |
| 1374 | POST | `/api/v1/rider/kit/training-videos` | rider | yes | admin-jwt | ctrl.createKitTrainingVideo | rider.service | NOT_TESTED | - |
| 1375 | DELETE | `/api/v1/rider/kit/training-videos/:id` | rider | yes | admin-jwt | ctrl.deleteKitTrainingVideo | rider.service | NOT_TESTED | - |
| 1376 | PUT | `/api/v1/rider/kit/training-videos/:id` | rider | yes | admin-jwt | ctrl.updateKitTrainingVideo | rider.service | NOT_TESTED | - |
| 1377 | GET | `/api/v1/rider/legal/config` | rider | no | - | ctrl.getLegalConfig | rider.service | NOT_TESTED | - |
| 1378 | GET | `/api/v1/rider/legal/privacy` | rider | no | - | ctrl.getLegalPrivacy | rider.service | NOT_TESTED | - |
| 1379 | GET | `/api/v1/rider/legal/terms` | rider | no | - | ctrl.getLegalTerms | rider.service | NOT_TESTED | - |
| 1380 | GET | `/api/v1/rider/notifications` | rider | yes | admin-jwt | ctrl.listDashboardNotifications | rider.service | NOT_TESTED | - |
| 1381 | PUT | `/api/v1/rider/notifications/:notificationId/read` | rider | yes | admin-jwt | ctrl.markNotificationRead | rider.service | NOT_TESTED | - |
| 1382 | POST | `/api/v1/rider/notifications/read-all` | rider | yes | admin-jwt | ctrl.markAllNotificationsRead | rider.service | NOT_TESTED | - |
| 1383 | GET | `/api/v1/rider/orders` | rider | yes | admin-jwt | ctrl.listRiderOrders | rider.service | NOT_TESTED | - |
| 1384 | POST | `/api/v1/rider/orders/:orderId/alert` | rider | yes | admin-jwt | ctrl.alertRiderOrder | rider.service | NOT_TESTED | - |
| 1385 | POST | `/api/v1/rider/orders/:orderId/assign` | rider | yes | admin-jwt | ctrl.assignRiderOrder | rider.service | NOT_TESTED | - |
| 1386 | GET | `/api/v1/rider/search` | rider | yes | admin-jwt | ctrl.search | rider.service | NOT_TESTED | - |
| 1387 | GET | `/api/v1/rider/shifts` | rider | yes | admin-jwt | ctrl.listShifts | rider.service | NOT_TESTED | - |
| 1388 | POST | `/api/v1/rider/shifts` | rider | yes | admin-jwt | ctrl.createShift | rider.service | NOT_TESTED | - |
| 1389 | DELETE | `/api/v1/rider/shifts/:shiftId` | rider | yes | admin-jwt | ctrl.deleteShift | rider.service | NOT_TESTED | - |
| 1390 | GET | `/api/v1/rider/shifts/:shiftId` | rider | yes | admin-jwt | ctrl.getShiftById | rider.service | NOT_TESTED | - |
| 1391 | PUT | `/api/v1/rider/shifts/:shiftId` | rider | yes | admin-jwt | ctrl.updateShift | rider.service | NOT_TESTED | - |
| 1392 | POST | `/api/v1/rider/shifts/:shiftId/assign` | rider | yes | admin-jwt | ctrl.adminAssignRiderToShift | rider.service | NOT_TESTED | - |
| 1393 | GET | `/api/v1/rider/shifts/:shiftId/assignments` | rider | yes | admin-jwt | ctrl.getShiftAssignments | rider.service | NOT_TESTED | - |
| 1394 | DELETE | `/api/v1/rider/shifts/:shiftId/assignments/:riderId` | rider | yes | admin-jwt | ctrl.adminUnassignRiderFromShift | rider.service | NOT_TESTED | - |
| 1395 | POST | `/api/v1/rider/shifts/:shiftId/unassign` | rider | yes | admin-jwt | ctrl.adminUnassignRiderFromShift | rider.service | NOT_TESTED | - |
| 1396 | GET | `/api/v1/rider/shifts/available/list` | rider | yes | admin-jwt | ctrl.listAvailableShiftsForRider | rider.service | NOT_TESTED | - |
| 1397 | POST | `/api/v1/rider/shifts/cancel` | rider | yes | admin-jwt | ctrl.cancelShiftForRider | rider.service | NOT_TESTED | - |
| 1398 | POST | `/api/v1/rider/shifts/end` | rider | yes | admin-jwt | ctrl.endShiftForRider | rider.service | NOT_TESTED | - |
| 1399 | GET | `/api/v1/rider/shifts/filter-options` | rider | yes | admin-jwt | ctrl.getShiftFilterOptions | rider.service | NOT_TESTED | - |
| 1400 | GET | `/api/v1/rider/shifts/my` | rider | yes | admin-jwt | ctrl.getMyShiftsForRider | rider.service | NOT_TESTED | - |
| 1401 | POST | `/api/v1/rider/shifts/select` | rider | yes | admin-jwt | ctrl.selectShiftForRider | rider.service | NOT_TESTED | - |
| 1402 | POST | `/api/v1/rider/shifts/start` | rider | yes | admin-jwt | ctrl.startShiftForRider | rider.service | NOT_TESTED | - |
| 1403 | GET | `/api/v1/rider/summary` | rider | yes | admin-jwt | ctrl.getSummary | rider.service | NOT_TESTED | - |
| 1404 | GET | `/api/v1/rider/support-chat/conversation` | support-chat | yes | customer-jwt | controller.riderGetConversation | support-chat.service | NOT_TESTED | - |
| 1405 | GET | `/api/v1/rider/support-chat/conversation/messages` | support-chat | yes | customer-jwt | controller.riderGetMessages | support-chat.service | NOT_TESTED | - |
| 1406 | POST | `/api/v1/rider/support-chat/conversation/messages` | support-chat | yes | customer-jwt | controller.riderSendMessage | support-chat.service | NOT_TESTED | - |
| 1407 | POST | `/api/v1/rider/support-chat/conversation/read` | support-chat | yes | customer-jwt | controller.riderMarkRead | support-chat.service | NOT_TESTED | - |
| 1408 | GET | `/api/v1/rider/training/:riderId` | rider | yes | admin-jwt | ctrl.getRiderTraining | rider.service | NOT_TESTED | - |
| 1409 | POST | `/api/v1/rider/training/:riderId/modules/:moduleId/complete` | rider | yes | admin-jwt | ctrl.markModuleComplete | rider.service | NOT_TESTED | - |
| 1410 | DELETE | `/api/v1/shared/alerts` | shared | yes | admin-jwt | ctrl.clearResolvedAlerts | shared.service | NOT_TESTED | - |
| 1411 | GET | `/api/v1/shared/alerts` | shared | yes | admin-jwt | ctrl.listAlerts | shared.service | NOT_TESTED | - |
| 1412 | GET | `/api/v1/shared/alerts/:id` | shared | yes | admin-jwt | ctrl.getAlertById | shared.service | NOT_TESTED | - |
| 1413 | POST | `/api/v1/shared/alerts/:id/action` | shared | yes | admin-jwt | ctrl.performAlertAction | shared.service | NOT_TESTED | - |
| 1414 | PUT | `/api/v1/shared/alerts/read-all` | shared | yes | admin-jwt | ctrl.markAllAlertsRead | shared.service | NOT_TESTED | - |
| 1415 | GET | `/api/v1/shared/analytics/dispatch-efficiency` | shared | yes | admin-jwt | ctrl.getDispatchEfficiency | shared.service | NOT_TESTED | - |
| 1416 | GET | `/api/v1/shared/analytics/drill-down` | shared | yes | admin-jwt | ctrl.getDrillDown | shared.service | NOT_TESTED | - |
| 1417 | GET | `/api/v1/shared/analytics/fleet-utilization` | shared | yes | admin-jwt | ctrl.getFleetUtilization | shared.service | NOT_TESTED | - |
| 1418 | GET | `/api/v1/shared/analytics/hub-comparison` | shared | yes | admin-jwt | ctrl.getHubComparison | shared.service | NOT_TESTED | - |
| 1419 | POST | `/api/v1/shared/analytics/reports/export` | shared | yes | admin-jwt | ctrl.exportReport | shared.service | NOT_TESTED | - |
| 1420 | GET | `/api/v1/shared/analytics/reports/schedules` | shared | yes | admin-jwt | ctrl.getReportSchedules | shared.service | NOT_TESTED | - |
| 1421 | POST | `/api/v1/shared/analytics/reports/schedules` | shared | yes | admin-jwt | ctrl.createReportSchedule | shared.service | NOT_TESTED | - |
| 1422 | GET | `/api/v1/shared/analytics/rider-leaderboard` | shared | yes | admin-jwt | ctrl.getRiderLeaderboard | shared.service | NOT_TESTED | - |
| 1423 | GET | `/api/v1/shared/analytics/rider-performance` | shared | yes | admin-jwt | ctrl.getRiderPerformance | shared.service | NOT_TESTED | - |
| 1424 | GET | `/api/v1/shared/analytics/sla-adherence` | shared | yes | admin-jwt | ctrl.getSlaAdherence | shared.service | NOT_TESTED | - |
| 1425 | POST | `/api/v1/shared/approvals/batch-approve` | shared | yes | admin-jwt | ctrl.batchApprove | shared.service | NOT_TESTED | - |
| 1426 | GET | `/api/v1/shared/approvals/queue` | shared | yes | admin-jwt | ctrl.listApprovals | shared.service | NOT_TESTED | - |
| 1427 | POST | `/api/v1/shared/approvals/queue` | shared | yes | admin-jwt | ctrl.createApprovalRequest | shared.service | NOT_TESTED | - |
| 1428 | GET | `/api/v1/shared/approvals/queue/:id` | shared | yes | admin-jwt | ctrl.getApprovalById | shared.service | NOT_TESTED | - |
| 1429 | POST | `/api/v1/shared/approvals/queue/:id/approve` | shared | yes | admin-jwt | ctrl.approveRequest | shared.service | NOT_TESTED | - |
| 1430 | POST | `/api/v1/shared/approvals/queue/:id/reject` | shared | yes | admin-jwt | ctrl.rejectRequest | shared.service | NOT_TESTED | - |
| 1431 | GET | `/api/v1/shared/approvals/summary` | shared | yes | admin-jwt | ctrl.getApprovalSummary | shared.service | NOT_TESTED | - |
| 1432 | DELETE | `/api/v1/shared/bulk-ops/:type` | shared | yes | admin-jwt | ctrl.deleteByType | shared.service | NOT_TESTED | - |
| 1433 | GET | `/api/v1/shared/bulk-ops/export/:type` | shared | yes | admin-jwt | ctrl.exportByType | shared.service | NOT_TESTED | - |
| 1434 | POST | `/api/v1/shared/bulk-ops/import/products` | shared | yes | admin-jwt | ctrl.importProducts | shared.service | NOT_TESTED | - |
| 1435 | POST | `/api/v1/shared/bulk-ops/inventory` | shared | yes | admin-jwt | ctrl.bulkInventory | shared.service | NOT_TESTED | - |
| 1436 | POST | `/api/v1/shared/bulk-ops/orders` | shared | yes | admin-jwt | ctrl.bulkOrders | shared.service | NOT_TESTED | - |
| 1437 | POST | `/api/v1/shared/bulk-ops/products` | shared | yes | admin-jwt | ctrl.bulkProducts | shared.service | NOT_TESTED | - |
| 1438 | POST | `/api/v1/shared/call-logs` | shared | yes | admin-jwt | ctrl.createCallLog | shared.service | NOT_TESTED | - |
| 1439 | GET | `/api/v1/shared/call-logs/by-customer/:customerId` | shared | yes | admin-jwt | ctrl.getCallLogsByCustomer | shared.service | NOT_TESTED | - |
| 1440 | GET | `/api/v1/shared/call-logs/by-order/:orderId` | shared | yes | admin-jwt | ctrl.getCallLogsByOrder | shared.service | NOT_TESTED | - |
| 1441 | GET | `/api/v1/shared/call-logs/by-ticket/:ticketId` | shared | yes | admin-jwt | ctrl.getCallLogsByTicket | shared.service | NOT_TESTED | - |
| 1442 | POST | `/api/v1/shared/communication/broadcasts` | shared | yes | admin-jwt | ctrl.createBroadcast | shared.service | NOT_TESTED | - |
| 1443 | GET | `/api/v1/shared/communication/chats` | shared | yes | admin-jwt | ctrl.listChats | shared.service | NOT_TESTED | - |
| 1444 | GET | `/api/v1/shared/communication/chats/:id` | shared | yes | admin-jwt | ctrl.getChatById | shared.service | NOT_TESTED | - |
| 1445 | POST | `/api/v1/shared/communication/chats/:id/flag` | shared | yes | admin-jwt | ctrl.flagChat | shared.service | NOT_TESTED | - |
| 1446 | POST | `/api/v1/shared/communication/chats/:id/messages` | shared | yes | admin-jwt | ctrl.sendChatMessage | shared.service | NOT_TESTED | - |
| 1447 | PUT | `/api/v1/shared/communication/chats/:id/read` | shared | yes | admin-jwt | ctrl.markChatRead | shared.service | NOT_TESTED | - |
| 1448 | GET | `/api/v1/shared/dashboard/summary` | shared | yes | admin-jwt | ctrl.getDashboardSummary | shared.service | NOT_TESTED | - |
| 1449 | POST | `/api/v1/shared/escalations` | shared | yes | admin-jwt | ctrl.createEscalation | shared.service | NOT_TESTED | - |
| 1450 | GET | `/api/v1/shared/escalations/:id` | shared | yes | admin-jwt | ctrl.getEscalationById | shared.service | NOT_TESTED | - |
| 1451 | PATCH | `/api/v1/shared/escalations/:id` | shared | yes | admin-jwt | ctrl.updateEscalation | shared.service | NOT_TESTED | - |
| 1452 | PATCH | `/api/v1/shared/escalations/:id/assign` | shared | yes | admin-jwt | ctrl.assignEscalation | shared.service | NOT_TESTED | - |
| 1453 | PATCH | `/api/v1/shared/escalations/:id/resolve` | shared | yes | admin-jwt | ctrl.resolveEscalation | shared.service | NOT_TESTED | - |
| 1454 | GET | `/api/v1/shared/escalations/by-team/:team` | shared | yes | admin-jwt | ctrl.getEscalationsByTeam | shared.service | NOT_TESTED | - |
| 1455 | POST | `/api/v1/shared/inventory-sync/bulk` | shared | yes | admin-jwt | ctrl.bulkInventorySync | shared.service | NOT_TESTED | - |
| 1456 | GET | `/api/v1/shared/inventory-sync/status` | shared | yes | admin-jwt | ctrl.getInventorySyncStatus | shared.service | NOT_TESTED | - |
| 1457 | POST | `/api/v1/shared/inventory-sync/store-to-warehouse` | shared | yes | admin-jwt | ctrl.syncStoreToWarehouse | shared.service | NOT_TESTED | - |
| 1458 | POST | `/api/v1/shared/inventory-sync/warehouse-to-store` | shared | yes | admin-jwt | ctrl.syncWarehouseToStore | shared.service | NOT_TESTED | - |
| 1459 | GET | `/api/v1/shared/search` | shared | yes | admin-jwt | ctrl.globalSearch | shared.service | NOT_TESTED | - |
| 1460 | GET | `/api/v1/shared/search/recent` | shared | yes | admin-jwt | ctrl.getRecentSearches | shared.service | NOT_TESTED | - |
| 1461 | GET | `/api/v1/shared/search/suggestions` | shared | yes | admin-jwt | ctrl.getSearchSuggestions | shared.service | NOT_TESTED | - |
| 1462 | GET | `/api/v1/shared/system-health` | shared | yes | admin-jwt | ctrl.getSystemHealthSummary | shared.service | NOT_TESTED | - |
| 1463 | GET | `/api/v1/shared/system-health/devices` | shared | yes | admin-jwt | ctrl.listSystemDevices | shared.service | NOT_TESTED | - |
| 1464 | GET | `/api/v1/shared/system-health/devices/:id` | shared | yes | admin-jwt | ctrl.getSystemDeviceById | shared.service | NOT_TESTED | - |
| 1465 | GET | `/api/v1/shared/system-health/diagnostics/reports/:reportId` | shared | yes | admin-jwt | ctrl.getDiagnosticsReport | shared.service | NOT_TESTED | - |
| 1466 | POST | `/api/v1/shared/system-health/diagnostics/run` | shared | yes | admin-jwt | ctrl.runDiagnostics | shared.service | NOT_TESTED | - |
| 1467 | GET | `/api/v1/shared/workflow/rules` | shared | yes | admin-jwt | ctrl.listWorkflowRules | shared.service | NOT_TESTED | - |
| 1468 | POST | `/api/v1/shared/workflow/rules` | shared | yes | admin-jwt | ctrl.createWorkflowRule | shared.service | NOT_TESTED | - |
| 1469 | POST | `/api/v1/shared/workflow/schedule` | shared | yes | admin-jwt | ctrl.scheduleWorkflow | shared.service | NOT_TESTED | - |
| 1470 | POST | `/api/v1/shared/workflow/trigger` | shared | yes | admin-jwt | ctrl.triggerWorkflow | shared.service | NOT_TESTED | - |
| 1471 | POST | `/api/v1/support/tickets` | support | no | - | supportController.createPublicTicket | support.service | NOT_TESTED | - |
| 1472 | GET | `/api/v1/warehouse/analytics` | warehouse | yes | admin-jwt | getAnalytics | warehouse.service | NOT_TESTED | - |
| 1473 | GET | `/api/v1/warehouse/attendance/live` | warehouse | yes | admin-jwt | getLiveAttendance | warehouse.service | NOT_TESTED | - |
| 1474 | GET | `/api/v1/warehouse/daily-report` | warehouse | yes | admin-jwt | getDailyReport | warehouse.service | NOT_TESTED | - |
| 1475 | GET | `/api/v1/warehouse/devices` | warehouse | yes | admin-jwt | listDevices | warehouse.service | NOT_TESTED | - |
| 1476 | POST | `/api/v1/warehouse/devices` | warehouse | yes | admin-jwt | createDevice | warehouse.service | NOT_TESTED | - |
| 1477 | PATCH | `/api/v1/warehouse/devices/:id` | warehouse | yes | admin-jwt | patchDevice | warehouse.service | NOT_TESTED | - |
| 1478 | GET | `/api/v1/warehouse/equipment/devices` | warehouse | yes | admin-jwt | getEquipmentDevices | warehouse.service | NOT_TESTED | - |
| 1479 | GET | `/api/v1/warehouse/equipment/devices/:id` | warehouse | yes | admin-jwt | getEquipmentDeviceDetails | warehouse.service | NOT_TESTED | - |
| 1480 | GET | `/api/v1/warehouse/equipment/export` | warehouse | yes | admin-jwt | exportEquipment | warehouse.service | NOT_TESTED | - |
| 1481 | GET | `/api/v1/warehouse/equipment/machinery` | warehouse | yes | admin-jwt | getMachinery | warehouse.service | NOT_TESTED | - |
| 1482 | POST | `/api/v1/warehouse/equipment/machinery` | warehouse | yes | admin-jwt | addMachinery | warehouse.service | NOT_TESTED | - |
| 1483 | GET | `/api/v1/warehouse/equipment/machinery/:id` | warehouse | yes | admin-jwt | getMachineryDetails | warehouse.service | NOT_TESTED | - |
| 1484 | POST | `/api/v1/warehouse/equipment/machinery/:id/issue` | warehouse | yes | admin-jwt | reportEquipmentIssue | warehouse.service | NOT_TESTED | - |
| 1485 | POST | `/api/v1/warehouse/equipment/machinery/:id/resolve` | warehouse | yes | admin-jwt | resolveEquipmentIssue | warehouse.service | NOT_TESTED | - |
| 1486 | GET | `/api/v1/warehouse/exceptions` | warehouse | yes | admin-jwt | getExceptions | warehouse.service | NOT_TESTED | - |
| 1487 | POST | `/api/v1/warehouse/exceptions` | warehouse | yes | admin-jwt | reportException | warehouse.service | NOT_TESTED | - |
| 1488 | GET | `/api/v1/warehouse/exceptions/:id` | warehouse | yes | admin-jwt | getExceptionDetails | warehouse.service | NOT_TESTED | - |
| 1489 | POST | `/api/v1/warehouse/exceptions/:id/accept-partial` | warehouse | yes | admin-jwt | acceptPartial | warehouse.service | NOT_TESTED | - |
| 1490 | POST | `/api/v1/warehouse/exceptions/:id/reject-shipment` | warehouse | yes | admin-jwt | rejectShipment | warehouse.service | NOT_TESTED | - |
| 1491 | PUT | `/api/v1/warehouse/exceptions/:id/status` | warehouse | yes | admin-jwt | updateExceptionStatus | warehouse.service | NOT_TESTED | - |
| 1492 | GET | `/api/v1/warehouse/exceptions/export` | warehouse | yes | admin-jwt | exportExceptions | warehouse.service | NOT_TESTED | - |
| 1493 | GET | `/api/v1/warehouse/health` | warehouse | yes | admin-jwt | inline-handler | - | NOT_TESTED | - |
| 1494 | GET | `/api/v1/warehouse/inbound/docks` | warehouse | yes | admin-jwt | getDocks | warehouse.service | NOT_TESTED | - |
| 1495 | PUT | `/api/v1/warehouse/inbound/docks/:id` | warehouse | yes | admin-jwt | updateDock | warehouse.service | NOT_TESTED | - |
| 1496 | GET | `/api/v1/warehouse/inbound/grns` | warehouse | yes | admin-jwt | getGRNs | warehouse.service | NOT_TESTED | - |
| 1497 | POST | `/api/v1/warehouse/inbound/grns` | warehouse | yes | admin-jwt | createGRN | warehouse.service | NOT_TESTED | - |
| 1498 | GET | `/api/v1/warehouse/inbound/grns/:id` | warehouse | yes | admin-jwt | getGRNDetails | warehouse.service | NOT_TESTED | - |
| 1499 | POST | `/api/v1/warehouse/inbound/grns/:id/complete` | warehouse | yes | admin-jwt | completeGRN | warehouse.service | NOT_TESTED | - |
| 1500 | POST | `/api/v1/warehouse/inbound/grns/:id/discrepancy` | warehouse | yes | admin-jwt | logGRNDiscrepancy | warehouse.service | NOT_TESTED | - |
| 1501 | POST | `/api/v1/warehouse/inbound/grns/:id/start` | warehouse | yes | admin-jwt | startGRN | warehouse.service | NOT_TESTED | - |
| 1502 | GET | `/api/v1/warehouse/inbound/grns/export` | warehouse | yes | admin-jwt | exportGRNs | warehouse.service | NOT_TESTED | - |
| 1503 | GET | `/api/v1/warehouse/inbound/summary` | warehouse | yes | admin-jwt | getInboundSummary | warehouse.service | NOT_TESTED | - |
| 1504 | GET | `/api/v1/warehouse/inventory/adjustments` | warehouse | yes | admin-jwt | listAdjustments | warehouse.service | NOT_TESTED | - |
| 1505 | POST | `/api/v1/warehouse/inventory/adjustments` | warehouse | yes | admin-jwt | createAdjustment | warehouse.service | NOT_TESTED | - |
| 1506 | GET | `/api/v1/warehouse/inventory/alerts` | warehouse | yes | admin-jwt | listStockAlerts | warehouse.service | NOT_TESTED | - |
| 1507 | POST | `/api/v1/warehouse/inventory/alerts/:id/reorder` | warehouse | yes | admin-jwt | createReorderRequest | warehouse.service | NOT_TESTED | - |
| 1508 | POST | `/api/v1/warehouse/inventory/alerts/generate` | warehouse | yes | admin-jwt | generateStockAlerts | warehouse.service | NOT_TESTED | - |
| 1509 | GET | `/api/v1/warehouse/inventory/cycle-counts` | warehouse | yes | admin-jwt | listCycleCounts | warehouse.service | NOT_TESTED | - |
| 1510 | POST | `/api/v1/warehouse/inventory/cycle-counts` | warehouse | yes | admin-jwt | createCycleCount | warehouse.service | NOT_TESTED | - |
| 1511 | GET | `/api/v1/warehouse/inventory/cycle-counts/:id` | warehouse | yes | admin-jwt | getCycleCountById | warehouse.service | NOT_TESTED | - |
| 1512 | PUT | `/api/v1/warehouse/inventory/cycle-counts/:id` | warehouse | yes | admin-jwt | updateCycleCount | warehouse.service | NOT_TESTED | - |
| 1513 | POST | `/api/v1/warehouse/inventory/cycle-counts/:id/complete` | warehouse | yes | admin-jwt | completeCycleCount | warehouse.service | NOT_TESTED | - |
| 1514 | PUT | `/api/v1/warehouse/inventory/cycle-counts/:id/complete` | warehouse | yes | admin-jwt | completeCycleCount | warehouse.service | NOT_TESTED | - |
| 1515 | POST | `/api/v1/warehouse/inventory/cycle-counts/:id/start` | warehouse | yes | admin-jwt | startCycleCount | warehouse.service | NOT_TESTED | - |
| 1516 | PUT | `/api/v1/warehouse/inventory/cycle-counts/:id/start` | warehouse | yes | admin-jwt | startCycleCount | warehouse.service | NOT_TESTED | - |
| 1517 | GET | `/api/v1/warehouse/inventory/export` | warehouse | yes | admin-jwt | exportInventory | warehouse.service | NOT_TESTED | - |
| 1518 | GET | `/api/v1/warehouse/inventory/items` | warehouse | yes | admin-jwt | listInventoryItems | warehouse.service | NOT_TESTED | - |
| 1519 | GET | `/api/v1/warehouse/inventory/items/:id` | warehouse | yes | admin-jwt | getInventoryItemById | warehouse.service | NOT_TESTED | - |
| 1520 | PUT | `/api/v1/warehouse/inventory/items/:id` | warehouse | yes | admin-jwt | updateInventoryItem | warehouse.service | NOT_TESTED | - |
| 1521 | GET | `/api/v1/warehouse/inventory/locations` | warehouse | yes | admin-jwt | listStorageLocations | warehouse.service | NOT_TESTED | - |
| 1522 | GET | `/api/v1/warehouse/inventory/locations/:id` | warehouse | yes | admin-jwt | getStorageLocationById | warehouse.service | NOT_TESTED | - |
| 1523 | GET | `/api/v1/warehouse/inventory/meta` | warehouse | yes | admin-jwt | getInventoryMeta | warehouse.service | NOT_TESTED | - |
| 1524 | POST | `/api/v1/warehouse/inventory/reorder` | warehouse | yes | admin-jwt | createReorderRequest | warehouse.service | NOT_TESTED | - |
| 1525 | POST | `/api/v1/warehouse/inventory/stock/:sku/adjust` | warehouse | yes | admin-jwt | createAdjustment | warehouse.service | NOT_TESTED | - |
| 1526 | GET | `/api/v1/warehouse/inventory/summary` | warehouse | yes | admin-jwt | getInventorySummary | warehouse.service | NOT_TESTED | - |
| 1527 | GET | `/api/v1/warehouse/inventory/transfers` | warehouse | yes | admin-jwt | listInternalTransfers | warehouse.service | NOT_TESTED | - |
| 1528 | POST | `/api/v1/warehouse/inventory/transfers` | warehouse | yes | admin-jwt | createInternalTransfer | warehouse.service | NOT_TESTED | - |
| 1529 | GET | `/api/v1/warehouse/inventory/transfers/:id` | warehouse | yes | admin-jwt | getInternalTransferById | warehouse.service | NOT_TESTED | - |
| 1530 | POST | `/api/v1/warehouse/inventory/transfers/:id/complete` | warehouse | yes | admin-jwt | updateTransferStatus | warehouse.service | NOT_TESTED | - |
| 1531 | PUT | `/api/v1/warehouse/inventory/transfers/:id/status` | warehouse | yes | admin-jwt | updateTransferStatus | warehouse.service | NOT_TESTED | - |
| 1532 | GET | `/api/v1/warehouse/metrics` | warehouse | yes | admin-jwt | getWarehouseMetrics | warehouse.service | NOT_TESTED | - |
| 1533 | GET | `/api/v1/warehouse/notifications` | warehouse | yes | admin-jwt | listNotifications | warehouse.service | NOT_TESTED | - |
| 1534 | PATCH | `/api/v1/warehouse/notifications/:id/read` | warehouse | yes | admin-jwt | markNotificationRead | warehouse.service | NOT_TESTED | - |
| 1535 | POST | `/api/v1/warehouse/notifications/read-all` | warehouse | yes | admin-jwt | markAllNotificationsRead | warehouse.service | NOT_TESTED | - |
| 1536 | GET | `/api/v1/warehouse/operations` | warehouse | yes | admin-jwt | getOperationsView | warehouse.service | NOT_TESTED | - |
| 1537 | GET | `/api/v1/warehouse/order-flow` | warehouse | yes | admin-jwt | getOrderFlow | warehouse.service | NOT_TESTED | - |
| 1538 | GET | `/api/v1/warehouse/orders` | warehouse | yes | admin-jwt | listOrders | warehouse.service | NOT_TESTED | - |
| 1539 | POST | `/api/v1/warehouse/orders/:orderId/alert` | warehouse | yes | admin-jwt | alertOrder | warehouse.service | NOT_TESTED | - |
| 1540 | POST | `/api/v1/warehouse/orders/:orderId/assign` | warehouse | yes | admin-jwt | assignOrder | warehouse.service | NOT_TESTED | - |
| 1541 | GET | `/api/v1/warehouse/outbound/batches` | warehouse | yes | admin-jwt | listBatches | warehouse.service | NOT_TESTED | - |
| 1542 | POST | `/api/v1/warehouse/outbound/batches` | warehouse | yes | admin-jwt | createBatch | warehouse.service | NOT_TESTED | - |
| 1543 | GET | `/api/v1/warehouse/outbound/batches/:id` | warehouse | yes | admin-jwt | getBatchDetails | warehouse.service | NOT_TESTED | - |
| 1544 | GET | `/api/v1/warehouse/outbound/consolidated-picks` | warehouse | yes | admin-jwt | getConsolidatedPicks | warehouse.service | NOT_TESTED | - |
| 1545 | GET | `/api/v1/warehouse/outbound/pickers` | warehouse | yes | admin-jwt | getPickers | warehouse.service | NOT_TESTED | - |
| 1546 | GET | `/api/v1/warehouse/outbound/pickers/:id/orders` | warehouse | yes | admin-jwt | getPickerOrders | warehouse.service | NOT_TESTED | - |
| 1547 | GET | `/api/v1/warehouse/outbound/picklists` | warehouse | yes | admin-jwt | getPicklists | warehouse.service | NOT_TESTED | - |
| 1548 | GET | `/api/v1/warehouse/outbound/picklists/:id` | warehouse | yes | admin-jwt | getPicklistDetails | warehouse.service | NOT_TESTED | - |
| 1549 | POST | `/api/v1/warehouse/outbound/picklists/:id/assign` | warehouse | yes | admin-jwt | assignPicker | warehouse.service | NOT_TESTED | - |
| 1550 | GET | `/api/v1/warehouse/outbound/routes/:id/map` | warehouse | yes | admin-jwt | getRouteMap | warehouse.service | NOT_TESTED | - |
| 1551 | GET | `/api/v1/warehouse/outbound/routes/active/map` | warehouse | yes | admin-jwt | getActiveRoutes | warehouse.service | NOT_TESTED | - |
| 1552 | GET | `/api/v1/warehouse/qc/checks` | warehouse | yes | admin-jwt | getComplianceChecks | warehouse.service | NOT_TESTED | - |
| 1553 | PUT | `/api/v1/warehouse/qc/checks/:id` | warehouse | yes | admin-jwt | toggleComplianceCheck | warehouse.service | NOT_TESTED | - |
| 1554 | GET | `/api/v1/warehouse/qc/compliance-docs` | warehouse | yes | admin-jwt | getComplianceDocs | warehouse.service | NOT_TESTED | - |
| 1555 | GET | `/api/v1/warehouse/qc/compliance-docs/:id` | warehouse | yes | admin-jwt | getComplianceDoc | warehouse.service | NOT_TESTED | - |
| 1556 | GET | `/api/v1/warehouse/qc/compliance-docs/:id/download` | warehouse | yes | admin-jwt | getComplianceDoc | warehouse.service | NOT_TESTED | - |
| 1557 | GET | `/api/v1/warehouse/qc/compliance-docs/:id/view` | warehouse | yes | admin-jwt | getComplianceDoc | warehouse.service | NOT_TESTED | - |
| 1558 | GET | `/api/v1/warehouse/qc/inspections` | warehouse | yes | admin-jwt | getInspections | warehouse.service | NOT_TESTED | - |
| 1559 | POST | `/api/v1/warehouse/qc/inspections` | warehouse | yes | admin-jwt | createInspection | warehouse.service | NOT_TESTED | - |
| 1560 | GET | `/api/v1/warehouse/qc/inspections/:id` | warehouse | yes | admin-jwt | getInspectionDetails | warehouse.service | NOT_TESTED | - |
| 1561 | GET | `/api/v1/warehouse/qc/inspections/:id/report` | warehouse | yes | admin-jwt | getInspectionDetails | warehouse.service | NOT_TESTED | - |
| 1562 | PUT | `/api/v1/warehouse/qc/inspections/:id/update` | warehouse | yes | admin-jwt | updateInspection | warehouse.service | NOT_TESTED | - |
| 1563 | GET | `/api/v1/warehouse/qc/rejections` | warehouse | yes | admin-jwt | getRejections | warehouse.service | NOT_TESTED | - |
| 1564 | POST | `/api/v1/warehouse/qc/rejections` | warehouse | yes | admin-jwt | logRejection | warehouse.service | NOT_TESTED | - |
| 1565 | GET | `/api/v1/warehouse/qc/samples` | warehouse | yes | admin-jwt | getSamples | warehouse.service | NOT_TESTED | - |
| 1566 | POST | `/api/v1/warehouse/qc/samples` | warehouse | yes | admin-jwt | createSample | warehouse.service | NOT_TESTED | - |
| 1567 | GET | `/api/v1/warehouse/qc/samples/:id/report` | warehouse | yes | admin-jwt | updateSample | warehouse.service | NOT_TESTED | - |
| 1568 | PUT | `/api/v1/warehouse/qc/samples/:id/update` | warehouse | yes | admin-jwt | updateSample | warehouse.service | NOT_TESTED | - |
| 1569 | GET | `/api/v1/warehouse/qc/temperature-logs` | warehouse | yes | admin-jwt | getTemperatureLogs | warehouse.service | NOT_TESTED | - |
| 1570 | POST | `/api/v1/warehouse/qc/temperature-logs` | warehouse | yes | admin-jwt | createTemperatureLog | warehouse.service | NOT_TESTED | - |
| 1571 | GET | `/api/v1/warehouse/qc/temperature-logs/:id/chart` | warehouse | yes | admin-jwt | getTempChart | warehouse.service | NOT_TESTED | - |
| 1572 | GET | `/api/v1/warehouse/reports/daily` | warehouse | yes | admin-jwt | getReportsDaily | warehouse.service | NOT_TESTED | - |
| 1573 | GET | `/api/v1/warehouse/reports/inventory-by-category` | warehouse | yes | admin-jwt | getInventoryByCategory | warehouse.service | NOT_TESTED | - |
| 1574 | GET | `/api/v1/warehouse/reports/inventory-health` | warehouse | yes | admin-jwt | getInventoryHealth | warehouse.service | NOT_TESTED | - |
| 1575 | GET | `/api/v1/warehouse/reports/inventory-health/export` | warehouse | yes | admin-jwt | exportInventoryHealth | warehouse.service | NOT_TESTED | - |
| 1576 | GET | `/api/v1/warehouse/reports/operational-slas` | warehouse | yes | admin-jwt | getOperationalSLAs | warehouse.service | NOT_TESTED | - |
| 1577 | GET | `/api/v1/warehouse/reports/operational-slas/export` | warehouse | yes | admin-jwt | exportSLAMetrics | warehouse.service | NOT_TESTED | - |
| 1578 | GET | `/api/v1/warehouse/reports/operations-view` | warehouse | yes | admin-jwt | getReportsOperationsView | warehouse.service | NOT_TESTED | - |
| 1579 | GET | `/api/v1/warehouse/reports/output-trends` | warehouse | yes | admin-jwt | getOutputTrends | warehouse.service | NOT_TESTED | - |
| 1580 | GET | `/api/v1/warehouse/reports/productivity` | warehouse | yes | admin-jwt | getProductivity | warehouse.service | NOT_TESTED | - |
| 1581 | GET | `/api/v1/warehouse/reports/productivity/export` | warehouse | yes | admin-jwt | exportProductivity | warehouse.service | NOT_TESTED | - |
| 1582 | GET | `/api/v1/warehouse/reports/storage-utilization` | warehouse | yes | admin-jwt | getStorageUtilization | warehouse.service | NOT_TESTED | - |
| 1583 | GET | `/api/v1/warehouse/staff` | warehouse | yes | admin-jwt | listStaff | warehouse.service | NOT_TESTED | - |
| 1584 | GET | `/api/v1/warehouse/staff/absences` | warehouse | yes | admin-jwt | listAbsences | warehouse.service | NOT_TESTED | - |
| 1585 | POST | `/api/v1/warehouse/staff/absences` | warehouse | yes | admin-jwt | logAbsence | warehouse.service | NOT_TESTED | - |
| 1586 | GET | `/api/v1/warehouse/staff/incentive-criteria` | warehouse | yes | admin-jwt | getIncentiveCriteria | warehouse.service | NOT_TESTED | - |
| 1587 | GET | `/api/v1/warehouse/staff/performance` | warehouse | yes | admin-jwt | getStaffPerformance | warehouse.service | NOT_TESTED | - |
| 1588 | GET | `/api/v1/warehouse/staff/roster/weekly` | warehouse | yes | admin-jwt | getWeeklyRoster | warehouse.service | NOT_TESTED | - |
| 1589 | POST | `/api/v1/warehouse/staff/roster/weekly/publish` | warehouse | yes | admin-jwt | publishWeeklyRoster | warehouse.service | NOT_TESTED | - |
| 1590 | GET | `/api/v1/warehouse/staff/shifts` | warehouse | yes | admin-jwt | listShifts | warehouse.service | NOT_TESTED | - |
| 1591 | POST | `/api/v1/warehouse/staff/shifts` | warehouse | yes | admin-jwt | createShift | warehouse.service | NOT_TESTED | - |
| 1592 | GET | `/api/v1/warehouse/staff/shifts/:id` | warehouse | yes | admin-jwt | getShiftById | warehouse.service | NOT_TESTED | - |
| 1593 | PUT | `/api/v1/warehouse/staff/shifts/:id` | warehouse | yes | admin-jwt | updateShift | warehouse.service | NOT_TESTED | - |
| 1594 | POST | `/api/v1/warehouse/staff/shifts/auto-assign` | warehouse | yes | admin-jwt | autoAssignShifts | warehouse.service | NOT_TESTED | - |
| 1595 | GET | `/api/v1/warehouse/staff/shifts/coverage` | warehouse | yes | admin-jwt | getShiftCoverage | warehouse.service | NOT_TESTED | - |
| 1596 | GET | `/api/v1/warehouse/staff/summary` | warehouse | yes | admin-jwt | getStaffSummary | warehouse.service | NOT_TESTED | - |
| 1597 | GET | `/api/v1/warehouse/transfers` | warehouse | yes | admin-jwt | listInterWarehouseTransfers | warehouse.service | NOT_TESTED | - |
| 1598 | POST | `/api/v1/warehouse/transfers` | warehouse | yes | admin-jwt | requestInterWarehouseTransfer | warehouse.service | NOT_TESTED | - |
| 1599 | GET | `/api/v1/warehouse/transfers/:id` | warehouse | yes | admin-jwt | getInterWarehouseTransferDetails | warehouse.service | NOT_TESTED | - |
| 1600 | GET | `/api/v1/warehouse/transfers/:id/items` | warehouse | yes | admin-jwt | getInterWarehouseTransferItems | warehouse.service | NOT_TESTED | - |
| 1601 | PUT | `/api/v1/warehouse/transfers/:id/status` | warehouse | yes | admin-jwt | updateInterWarehouseTransferStatus | warehouse.service | NOT_TESTED | - |
| 1602 | GET | `/api/v1/warehouse/transfers/export` | warehouse | yes | admin-jwt | exportInterWarehouseTransfers | warehouse.service | NOT_TESTED | - |
| 1603 | POST | `/api/v1/warehouse/utilities/bin-reassignment` | warehouse | yes | admin-jwt | reassignBins | warehouse.service | NOT_TESTED | - |
| 1604 | POST | `/api/v1/warehouse/utilities/generate-labels` | warehouse | yes | admin-jwt | generateLabels | warehouse.service | NOT_TESTED | - |
| 1605 | GET | `/api/v1/warehouse/utilities/logs` | warehouse | yes | admin-jwt | getLogs | warehouse.service | NOT_TESTED | - |
| 1606 | POST | `/api/v1/warehouse/utilities/print-barcodes` | warehouse | yes | admin-jwt | printBarcodes | warehouse.service | NOT_TESTED | - |
| 1607 | POST | `/api/v1/warehouse/utilities/reassign-bins` | warehouse | yes | admin-jwt | reassignBins | warehouse.service | NOT_TESTED | - |
| 1608 | POST | `/api/v1/warehouse/utilities/upload-skus` | warehouse | yes | admin-jwt | uploadSKUs | warehouse.service | NOT_TESTED | - |
| 1609 | GET | `/api/v1/warehouse/utilities/zones` | warehouse | yes | admin-jwt | getZones | warehouse.service | NOT_TESTED | - |
| 1610 | GET | `/api/v1/warehouse/workforce/attendance` | warehouse | yes | admin-jwt | getWorkforceAttendance | warehouse.service | NOT_TESTED | - |
| 1611 | POST | `/api/v1/warehouse/workforce/attendance` | warehouse | yes | admin-jwt | logWorkforceAttendance | warehouse.service | NOT_TESTED | - |
| 1612 | GET | `/api/v1/warehouse/workforce/leave-requests` | warehouse | yes | admin-jwt | getLeaveRequests | warehouse.service | NOT_TESTED | - |
| 1613 | POST | `/api/v1/warehouse/workforce/leave-requests` | warehouse | yes | admin-jwt | createLeaveRequest | warehouse.service | NOT_TESTED | - |
| 1614 | PUT | `/api/v1/warehouse/workforce/leave-requests/:id/status` | warehouse | yes | admin-jwt | updateLeaveStatus | warehouse.service | NOT_TESTED | - |
| 1615 | GET | `/api/v1/warehouse/workforce/performance` | warehouse | yes | admin-jwt | getWorkforcePerformance | warehouse.service | NOT_TESTED | - |
| 1616 | GET | `/api/v1/warehouse/workforce/schedule` | warehouse | yes | admin-jwt | getWorkforceSchedule | warehouse.service | NOT_TESTED | - |
| 1617 | POST | `/api/v1/warehouse/workforce/schedule` | warehouse | yes | admin-jwt | createWorkforceSchedule | warehouse.service | NOT_TESTED | - |
| 1618 | GET | `/api/v1/warehouse/workforce/schedule/:id` | warehouse | yes | admin-jwt | getWorkforceSchedule | warehouse.service | NOT_TESTED | - |
| 1619 | POST | `/api/v1/warehouse/workforce/schedule/:id/assign` | warehouse | yes | admin-jwt | assignWorkforceStaff | warehouse.service | NOT_TESTED | - |
| 1620 | GET | `/api/v1/warehouse/workforce/staff` | warehouse | yes | admin-jwt | getWorkforceStaff | warehouse.service | NOT_TESTED | - |
| 1621 | POST | `/api/v1/warehouse/workforce/staff` | warehouse | yes | admin-jwt | addWorkforceStaff | warehouse.service | NOT_TESTED | - |
| 1622 | GET | `/api/v1/warehouse/workforce/staff/:id` | warehouse | yes | admin-jwt | getWorkforceStaffDetails | warehouse.service | NOT_TESTED | - |
| 1623 | GET | `/api/v1/warehouse/workforce/staff/:id/details` | warehouse | yes | admin-jwt | getWorkforceStaffDetails | warehouse.service | NOT_TESTED | - |
| 1624 | GET | `/api/v1/warehouse/workforce/training` | warehouse | yes | admin-jwt | getTrainings | warehouse.service | NOT_TESTED | - |
| 1625 | POST | `/api/v1/warehouse/workforce/training` | warehouse | yes | admin-jwt | createTraining | warehouse.service | NOT_TESTED | - |
| 1626 | GET | `/api/v1/warehouse/workforce/training/:id` | warehouse | yes | admin-jwt | getTrainingDetails | warehouse.service | NOT_TESTED | - |
| 1627 | GET | `/api/v1/warehouse/workforce/training/:id/details` | warehouse | yes | admin-jwt | getTrainingDetails | warehouse.service | NOT_TESTED | - |
| 1628 | POST | `/api/v1/warehouse/workforce/training/:id/enroll` | warehouse | yes | admin-jwt | enrollStaff | warehouse.service | NOT_TESTED | - |
| 1629 | GET | `/health` | health | no | - | inline-handler | - | PASS | app.ts |
| 1630 | GET | `/health/db` | health | no | - | inline-handler | - | PASS | app.ts |
| 1631 | GET | `/health/ready` | health | no | - | inline-handler | - | PASS | app.ts |
| 1632 | GET | `/healthz` | health | no | - | inline-handler | - | PASS | app.ts |

## 7. Postman/API Test Results

Postman MCP server was unavailable; tests used direct HTTP against the running backend (equivalent to Postman).

| # | Method | Endpoint | Test | Expected | Actual | HTTP | Status | Notes |
|---|--------|----------|------|----------|--------|------|--------|-------|
| 1 | GET | `/health` | health | 200 healthy | 200 {"status":"healthy","service":"selorg-service"} | 200 | PASS | Live |
| 2 | GET | `/health/db` | db | 200 healthy | 200 status=healthy pool present | 200 | PASS | Mongo connected |
| 3 | GET | `/health/ready` | ready | 200 ready | 200 ready | 200 | PASS |  |
| 4 | POST | `/api/v1/customer/auth/send-otp` | send-otp | 200 + sessionId | 200 deliveryStatus=sent sessionId issued | 200 | PASS | Real provider path (non-prod) |
| 5 | POST | `/api/v1/customer/auth/verify-otp` | verify-with-sessionId+testOtp | 200 + JWT | 200 token issued for test mobile | 200 | PASS | Requires sessionId (not phoneNumber) |
| 6 | POST | `/api/v1/customer/auth/verify-otp` | verify-without-sessionId | 422 | 422 validation | 422 | PASS | Negative validation |
| 7 | GET | `/api/v1/customer/user/profile` | authed-profile | 200 profile | 200 phoneNumber masked customer exists | 200 | PASS | Real DB customer |
| 8 | GET | `/api/v1/customer/user/profile` | missing-auth | 401 | 401 | 401 | PASS |  |
| 9 | GET | `/api/v1/customer/cart` | get-cart | 200 | 200 empty then 1 item after add | 200 | PASS |  |
| 10 | POST | `/api/v1/customer/cart/items` | add-known-product | 200 cart item | 200 product Banganapalli Jackfruit qty=1 total=69 | 200 | PASS | productId from prior order |
| 11 | POST | `/api/v1/customer/cart/items` | empty-body | 4xx | 422 | 422 | PASS |  |
| 12 | POST | `/api/v1/customer/cart/items` | bad-product | 4xx | 400 | 400 | PASS |  |
| 13 | GET | `/api/v1/customer/orders` | list | 200 orders | 200 includes ORD-20260909-00441 | 200 | PASS | customer_orders |
| 14 | GET | `/api/v1/customer/orders/:id` | detail | 200 | 200 orderNumber ORD-20260909-00441 | 200 | PASS |  |
| 15 | GET | `/api/v1/customer/orders/000000000000000000000000` | missing | 404 | 404 | 404 | PASS |  |
| 16 | POST | `/api/v1/customer/orders` | create-without-items | 422 items required | 422 (schema requires items[]) | 422 | PASS | Does not auto-checkout cart alone |
| 17 | POST | `/api/v1/customer/orders` | create-with-items | 201 order created | 201 ORD-20260911-00470 id=6aa3ae59… product Jackfruit total path real DB | 201 | PASS | Requires items[] + addressId |
| 18 | GET | `/api/v1/customer/products` | list | catalog list OR documented absence | 404 — no GET / route; only /search and /:id | 404 | FAIL | Missing list endpoint on products.routes.ts |
| 19 | GET | `/api/v1/customer/banners` | list | banner list | 404 — only GET /:id mounted | 404 | FAIL | Customer banner list missing |
| 20 | GET | `/api/v1/customer/products/search?q=tomato` | search | 200 results | 200 ~9 products | 200 | PASS |  |
| 21 | GET | `/api/v1/customer/wallet` | root | balance or 404 documented | 404; balance at /wallet/balance | 404 | PARTIAL | Path mismatch vs naive clients |
| 22 | GET | `/api/v1/customer/wallet/balance` | balance | 200 | 200 balance=500 INR | 200 | PASS | Real wallet doc |
| 23 | GET | `/api/v1/customer/home` | home | 200 | 200 sectionDefinitions present | 200 | PASS |  |
| 24 | GET | `/api/v1/customer/bootstrap` | bootstrap | 200 | 200 | 200 | PASS |  |
| 25 | POST | `/api/v1/admin/auth/login` | bad-creds | 401 | 401 | 401 | PASS |  |
| 26 | POST | `/api/v1/admin/auth/login` | valid-login | 200 token | 200 token issued | 200 | PASS | Seeded dashboard login user; token masked |
| 27 | GET | `/api/v1/admin/users/me` | me | 200 | 200 | 200 | PASS |  |
| 28 | GET | `/api/v1/admin/users/me` | customer-token | 401/403 | 403 | 403 | PASS | Foreign token rejected |
| 29 | GET | `/api/v1/admin/orders` | list | 200 customer_orders | 200 ORD-20260910-00469 status=pending | 200 | PASS |  |
| 30 | GET | `/api/v1/rider/dispatch/unassigned` | dispatch | live customer_orders ready-for-rider | 200 but ORD-20260331-00001 status=new from legacy orders collection | 200 | FAIL | Split-brain: dispatch ≠ customer_orders spine |
| 31 | GET | `/api/v1/admin/system/instances` | stub | real instances or 501 | 200 hardcoded [{id:1,status:running,host:localhost}] | 200 | FAIL | Hardcoded stub success |
| 32 | GET | `/api/v1/admin/system/cache/stats` | stub | redis stats or honest empty | 200 hits:0 misses:0 keys:0 | 200 | PARTIAL | Stub/placeholder stats |
| 33 | GET | `/api/v1/admin/applications` | stub | real integrations | 200 data:[] | 200 | PARTIAL | Empty stub list |
| 34 | GET | `/api/v1/admin/analytics/revenue` | analytics | 200 | 200 category breakdown Fruits etc | 200 | PASS | Returns numeric data |
| 35 | GET | `/api/v1/admin/picker/pickers` | list | 200 | 200 data=[] total=0 | 200 | PASS | Empty but real query |
| 36 | GET | `/api/v1/picker/user/profile` | admin-token | 401 | 401 | 401 | PASS | Audience isolation works admin→picker |
| 37 | POST | `/api/v1/picker/auth/send-otp` | send | 200 | 200 deliveryStatus=sent | 200 | PASS | phone field required |
| 38 | POST | `/api/v1/picker/auth/verify-otp` | fixed-test-otp | token or 4xx | 400 invalid OTP (no fixed test OTP for picker) | 400 | BLOCKED | Requires real SMS OTP |
| 39 | POST | `/api/v1/hhd/auth/send-otp` | send-mobile | 200 | 200 deliveryStatus=sent | 200 | PASS | mobile field |
| 40 | POST | `/api/v1/hhd/auth/verify-otp` | fixed-test-otp | token or 4xx | blocked without real OTP / HHD user | 400 | BLOCKED | No customer-style fixed OTP |
| 41 | GET | `/api/v1/picker/samples` | public-stub | auth or removed | 200 unauthenticated stub samples | 200 | PARTIAL | Public mock surface |
| 42 | POST | `/api/v1/picker/didit/webhook` | stub | verified signature | 200 received:true no verification | 200 | PARTIAL | Unauthenticated stub |
| 43 | GET | `/api/v1/diag/order-flow` | diag | 200 debug | 200 customerOrder pending riderStage=null | 200 | PASS | Non-prod only |
| 44 | POST | `/api/v1/customer/auth/send-otp` | malformed-json | 4xx | 500 | 500 | FAIL | Malformed JSON not mapped to 400 |
| 45 | SERVICE | `e2e-order-spine.ts` | order-lifecycle | TC1-TC5 pass | PASS HHD-RACE, TC1 delivered, TC2-TC5 pass | 0 | PASS | Service-level spine against live Mongo; FCM notify-handover warn |
| 46 | GET | `/healthz` | healthz | 2xx success / valid business response | {"ok":true} | 200 | PASS |  |
| 47 | GET | `/health/db` | health-db | 2xx success / valid business response | {"success":true,"message":"Success","data":{"status":"healthy","pool":{"activeConnections":0,"availableConnections":0,"waitingRequests":0,"maxPoolSize":50,"utilization":0,"status": | 200 | PASS |  |
| 48 | GET | `/health/ready` | health-ready | 2xx success / valid business response | {"success":true,"message":"Success","data":{"status":"ready","checks":{"database":{"status":"healthy"}}},"error":null,"pagination":null,"timestamp":"2026-09-11T07:17:41.504Z"} | 200 | PASS |  |
| 49 | GET | `/api/v1/customer/orders` | missing-auth | auth_check | {"success":false,"message":"Authentication required. Please sign in.","data":null,"error":{"code":401,"appCode":"AUTH_TOKEN_REQUIRED","title":"Unauthorized","message":"Authenticati | 401 | PASS |  |
| 50 | GET | `/api/v1/customer/cart` | missing-auth | auth_check | {"success":false,"message":"Authentication required. Please sign in.","data":null,"error":{"code":401,"appCode":"AUTH_TOKEN_REQUIRED","title":"Unauthorized","message":"Authenticati | 401 | PASS |  |
| 51 | GET | `/api/v1/picker/user/profile` | missing-auth | auth_check | {"success":false,"message":"Access token required.","data":null,"error":{"code":401,"appCode":"AUTH_TOKEN_REQUIRED","title":"Unauthorized","message":"Access token required.","detai | 401 | PASS |  |
| 52 | GET | `/api/v1/picker/shared-orders` | missing-auth | auth_check | {"success":false,"message":"Access token required.","data":null,"error":{"code":401,"appCode":"AUTH_TOKEN_REQUIRED","title":"Unauthorized","message":"Access token required.","detai | 401 | PASS |  |
| 53 | GET | `/api/v1/hhd/orders` | missing-auth | auth_check | {"success":false,"message":"Not authorized to access this route","data":null,"error":{"code":401,"appCode":"AUTH_REQUIRED","title":"Unauthorized","message":"Not authorized to acces | 401 | PASS |  |
| 54 | GET | `/api/v1/admin/users/me` | missing-auth | auth_check | {"success":false,"message":"Access token required. Please provide a valid Bearer ***","data":null,"error":{"code":401,"appCode":"AUTH_TOKEN_REQUIRED","title":"Unauthorized","messag | 401 | PASS |  |
| 55 | GET | `/api/v1/rider/dispatch/unassigned` | missing-auth | auth_check | {"success":false,"message":"Access token required. Please provide a valid Bearer ***","data":null,"error":{"code":401,"appCode":"AUTH_TOKEN_REQUIRED","title":"Unauthorized","messag | 401 | PASS |  |
| 56 | GET | `/api/v1/customer/user/profile` | invalid-token | auth_check | {"success":false,"message":"Invalid authentication token.","data":null,"error":{"code":401,"appCode":"AUTH_TOKEN_INVALID","title":"Unauthorized","message":"Invalid authentication t | 401 | PASS |  |
| 57 | GET | `/api/v1/admin/users/me` | invalid-token | auth_check | {"success":false,"message":"Invalid or malformed token. Please provide a valid token.","data":null,"error":{"code":403,"appCode":"AUTH_TOKEN_INVALID","title":"Forbidden","message": | 403 | PASS |  |
| 58 | GET | `/api/v1/picker/user/profile` | invalid-token | auth_check | {"success":false,"message":"Invalid token.","data":null,"error":{"code":401,"appCode":"AUTH_TOKEN_INVALID","title":"Unauthorized","message":"Invalid token.","detail":"Invalid token | 401 | PASS |  |
| 59 | POST | `/api/v1/customer/auth/send-otp` | empty-payload | 4xx client error | {"success":false,"message":"phoneNumber or email required","data":null,"error":{"code":422,"appCode":"VALIDATION_ERROR","title":"Validation Error","message":"phoneNumber or email r | 422 | PASS |  |
| 60 | POST | `/api/v1/customer/auth/send-otp` | invalid-phone | 4xx client error | {"success":false,"message":"phoneNumber must be exactly 10 digits","data":null,"error":{"code":400,"appCode":"BAD_REQUEST","title":"Bad Request","message":"phoneNumber must be exac | 400 | PASS |  |
| 61 | POST | `/api/v1/customer/auth/verify-otp` | empty-verify | 4xx client error | {"success":false,"message":"Required","data":null,"error":{"code":422,"appCode":"VALIDATION_ERROR","title":"Validation Error","message":"Required","detail":"Required","details":[{" | 422 | PASS |  |
| 62 | POST | `/api/v1/admin/auth/login` | empty-login | 4xx client error | {"success":false,"message":"Required","data":null,"error":{"code":422,"appCode":"VALIDATION_ERROR","title":"Validation Error","message":"Required","detail":"Required","details":[{" | 422 | PASS |  |
| 63 | POST | `/api/v1/admin/auth/login` | bad-credentials | 4xx client error | {"success":false,"message":"Invalid credentials. Please check your email and password.","data":null,"error":{"code":401,"title":"Unauthorized","message":"Invalid credentials. Pleas | 401 | PASS |  |
| 64 | GET | `/api/v1/customer/categories` | list | 2xx success / valid business response | {"success":true,"message":"Success","data":[{"id":"6a02ecc0c6755a49b4218f45","name":"Fruits","slug":"fruits","imageUrl":"https://d28izrv1rzt34w.cloudfront.net/prod/Category+%26+Sub | 200 | PASS |  |
| 65 | GET | `/api/v1/customer/products?page=1&limit=5` | list | 2xx success / valid business response | {"success":false,"message":"Route #/api/v1/customer/products?page=1&limit=5 not found","data":null,"error":{"code":404,"title":"Not Found","message":"Route #/api/v1/customer/produc | 404 | PARTIAL |  |
| 66 | GET | `/api/v1/customer/faq` | list | 2xx success / valid business response | {"success":true,"data":[{"id":"6a560e593f9f05d0ddcfd652","_id":"6a560e593f9f05d0ddcfd652","question":"How do I track my order?","answer":"Go to My Account → Orders and open your or | 200 | PASS |  |
| 67 | GET | `/api/v1/customer/app-config` | config | 2xx success / valid business response | {"success":true,"data":{"_id":"69e32269fcbfdcfdfbfcd619","key":"default","branding":{"splashTitle":"Avoid poison on your plate","splashSubtitle":"India's first lab-tested organic g | 200 | PASS |  |
| 68 | GET | `/api/v1/customer/legal/terms` | terms | 2xx success / valid business response | {"success":true,"message":"Success","data":{"id":"6a140d9910e980561fb34a34","version":"1","title":"Terms of Use","effectiveDate":"2024-01-15","lastUpdated":"2026-07-01","contentFor | 200 | PASS |  |
| 69 | GET | `/api/v1/customer/delivery/estimate?lat=13.0067&lng=80.257` | estimate | 2xx success / valid business response | {"success":false,"message":"storeId, latitude, and longitude are required","data":null,"error":{"code":400,"appCode":"BAD_REQUEST","title":"Bad Request","message":"storeId, latitud | 400 | PARTIAL |  |
| 70 | GET | `/api/v1/customer/locations?lat=13.0067&lng=80.257` | nearby | 2xx success / valid business response | {"success":false,"message":"Route #/api/v1/customer/locations?lat=13.0067&lng=80.257 not found","data":null,"error":{"code":404,"title":"Not Found","message":"Route #/api/v1/custom | 404 | PARTIAL |  |
| 71 | GET | `/api/v1/customer/search?q=tomato` | search | 2xx success / valid business response | {"success":true,"data":[{"_id":"6a1d5a17a6bed688b9c7aa8e","name":"Green Tomato - 2 pcs","sku":"S889","tag":"","hierarchyCode":"A504","images":["https://d28izrv1rzt34w.cloudfront.ne | 200 | PASS |  |
| 72 | GET | `/api/v1/customer/collections` | list | 2xx success / valid business response | {"success":false,"message":"Route #/api/v1/customer/collections not found","data":null,"error":{"code":404,"title":"Not Found","message":"Route #/api/v1/customer/collections not fo | 404 | PARTIAL |  |
| 73 | GET | `/api/v1/customer/onboarding` | list | 2xx success / valid business response | {"success":false,"message":"Route #/api/v1/customer/onboarding not found","data":null,"error":{"code":404,"title":"Not Found","message":"Route #/api/v1/customer/onboarding not foun | 404 | PARTIAL |  |
| 74 | GET | `/api/v1/customer/pages` | list | 2xx success / valid business response | {"success":false,"message":"Route #/api/v1/customer/pages not found","data":null,"error":{"code":404,"title":"Not Found","message":"Route #/api/v1/customer/pages not found","detail | 404 | PARTIAL |  |
| 75 | GET | `/api/v1/shared/health` | shared-health | 2xx success / valid business response | {"success":false,"message":"Access token required. Please provide a valid Bearer ***","data":null,"error":{"code":401,"appCode":"AUTH_TOKEN_REQUIRED","title":"Unauthorized","messag | 401 | PARTIAL |  |
| 76 | GET | `/api/v1/picker/config` | public-config | 2xx success / valid business response | {"success":true,"message":"Success","data":{"otpLength":4,"otpResendSeconds":24,"codDepositLimit":2000,"support":{"phone":"+91 1800 266 0800","email":"support@selorg.in","hours":"2 | 200 | PASS |  |
| 77 | GET | `/api/v1/picker/faq` | faq | 2xx success / valid business response | {"success":true,"message":"Success","data":[{"q":"How do I track my order?","a":"Go to My Account → Orders and open your order to see live tracking status and estimated delivery ti | 200 | PASS |  |
| 78 | GET | `/api/v1/picker/legal/terms` | terms | 2xx success / valid business response | {"success":true,"message":"Success","data":{"version":"22.0","title":"heloo","effectiveDate":"2026-05-20","lastUpdated":"2026-05-25T07:24:50.737Z","effectiveDateDisplay":"Effective | 200 | PASS |  |
| 79 | GET | `/api/v1/picker/samples` | samples-public-stub | 2xx success / valid business response | {"success":true,"message":"Success","data":{"samples":[]},"error":null,"pagination":null,"timestamp":"2026-09-11T07:17:43.881Z"} | 200 | PASS |  |
| 80 | GET | `/api/v1/admin/system/instances` | stub-requires-auth | auth_check | {"success":false,"message":"Invalid or malformed token. Please provide a valid token.","data":null,"error":{"code":403,"appCode":"AUTH_TOKEN_INVALID","title":"Forbidden","message": | 403 | PASS |  |
| 81 | POST | `/api/v1/customer/auth/verify-otp` | verify-otp | 2xx success / valid business response | {"success":false,"message":"Required","data":null,"error":{"code":422,"appCode":"VALIDATION_ERROR","title":"Validation Error","message":"Required","detail":"Required","details":[{" | 422 | PARTIAL |  |
| 82 | POST | `/api/v1/customer/auth/send-otp` | send-otp-signup | 2xx success / valid business response | {"success":false,"message":"An account with this phone number already exists. Please log in.","data":null,"error":{"code":409,"appCode":"PHONE_EXISTS","title":"Conflict","message": | 409 | PARTIAL |  |
| 83 | POST | `/api/v1/customer/auth/verify-otp` | verify-otp-signup | 2xx success / valid business response | {"success":false,"message":"Required","data":null,"error":{"code":422,"appCode":"VALIDATION_ERROR","title":"Validation Error","message":"Required","detail":"Required","details":[{" | 422 | PARTIAL |  |
| 84 | POST | `/api/v1/customer/auth/verify-otp` | customer-customer-token | token issued | send=200 verify=422 | 422 | BLOCKED | Could not obtain customer JWT via test OTP flow |
| 85 | POST | `/api/v1/admin/auth/login` | login | 2xx success / valid business response | {"success":false,"message":"Invalid credentials. Please check your email and password.","data":null,"error":{"code":401,"title":"Unauthorized","message":"Invalid credentials. Pleas | 401 | PARTIAL |  |
| 86 | POST | `/api/v1/admin/auth/login` | obtain-admin-token | token | http=401 | 401 | BLOCKED | Admin login failed — check seed-superadmin credentials |
| 87 | POST | `/api/v1/picker/auth/send-otp` | send-otp | 2xx success / valid business response | {"success":true,"message":"Success","data":{"success":true,"message":"OTP sent successfully","channel":"sms","deliveryStatus":"sent"},"error":null,"pagination":null,"timestamp":"20 | 200 | PASS |  |
| 88 | POST | `/api/v1/picker/auth/verify-otp` | verify-otp | 2xx success / valid business response | {"success":false,"message":"Invalid OTP. Please try again.","data":null,"error":{"code":400,"appCode":"INCORRECT_OTP","title":"Bad Request","message":"Invalid OTP. Please try again | 400 | PARTIAL |  |
| 89 | POST | `/api/v1/picker/auth/verify-otp` | obtain-picker-token | picker JWT | send=200 verify=400 | 400 | BLOCKED | Picker/rider OTP requires real SMS delivery (no fixed test OTP). sendHttp=200 |
| 90 | POST | `/api/v1/hhd/auth/send-otp` | send-otp | 2xx success / valid business response | {"success":true,"message":"OTP sent successfully","data":{"mobile":"9698790921","phone":"9698790921","channel":"sms","deliveryStatus":"sent","expiresInSeconds":300},"error":null,"p | 200 | PASS |  |
| 91 | POST | `/api/v1/hhd/auth/verify-otp` | verify-otp | 2xx success / valid business response | {"success":false,"message":"Invalid or expired OTP. Please try again.","data":null,"error":{"code":400,"appCode":"OTP_INVALID","title":"Bad Request","message":"Invalid or expired O | 400 | PARTIAL |  |
| 92 | POST | `/api/v1/hhd/auth/verify-otp` | obtain-hhd-token | hhd JWT | send=200 verify=400 | 400 | BLOCKED | HHD OTP requires real SMS / seeded HHD user |
| 93 | GET | `/api/v1/diag/order-flow` | order-flow | 2xx success / valid business response | {"success":true,"message":"Success","data":{"customerOrder":{"id":"6aa2c5589521cf3e34c180ef","orderNumber":"ORD-20260910-00467","status":"pending","riderStage":null,"pickerId":null | 200 | PASS |  |
| 94 | GET | `/api/v1/diag/hubs` | hubs | 2xx success / valid business response | {"success":true,"message":"Success","data":{"hubs":[{"id":"6a9e6088adc0cb031a3dd613","warehouseKey":"kor","name":"Koramangala Darkstore"},{"id":"6a9e6088adc0cb031a3dd615","warehous | 200 | PASS |  |
| 95 | POST | `/api/v1/picker/didit/webhook` | didit-webhook-stub | 2xx success / valid business response | {"success":true,"message":"Success","data":{"received":true},"error":null,"pagination":null,"timestamp":"2026-09-11T07:17:45.706Z"} | 200 | PASS |  |

## 8. Negative Test Results

| Case | Endpoint | Expected | Actual | Status |
|------|----------|----------|--------|--------|
| Missing auth | GET `/customer/user/profile` | 401 | 401 | PASS |
| Missing auth | GET `/customer/orders` | 401 | 401 | PASS |
| Missing auth | GET `/picker/shared-orders` | 401 | 401 | PASS |
| Missing auth | GET `/hhd/orders` | 401 | 401 | PASS |
| Missing auth | GET `/admin/users/me` | 401 | 401 | PASS |
| Missing auth | GET `/rider/dispatch/unassigned` | 401 | 401 | PASS |
| Invalid token | GET `/customer/user/profile` | 401 | 401 | PASS |
| Invalid token | GET `/admin/users/me` | 401/403 | 403 | PASS |
| Customer token on admin | GET `/admin/users/me` | 401/403 | 403 | PASS |
| Admin token on picker | GET `/picker/user/profile` | 401 | 401 | PASS |
| Empty OTP payload | POST `/customer/auth/send-otp` `{}` | 4xx | 422 | PASS |
| Invalid phone | POST `/customer/auth/send-otp` | 4xx | 400 | PASS |
| Empty verify | POST `/customer/auth/verify-otp` | 4xx | 422 | PASS |
| Empty admin login | POST `/admin/auth/login` | 4xx | 422 | PASS |
| Bad admin credentials | POST `/admin/auth/login` | 401 | 401 | PASS |
| Empty cart add | POST `/customer/cart/items` | 4xx | 422 | PASS |
| Bad product id | POST `/customer/cart/items` | 4xx | 400 | PASS |
| Missing order | GET `/customer/orders/000…000` | 404 | 404 | PASS |
| Invalid order id | GET `/customer/orders/bad-id` | 4xx/404 | 404 | PASS |
| Create order without items | POST `/customer/orders` | 422 | 422 | PASS |
| Malformed JSON body | POST `/customer/auth/send-otp` | 4xx | **500** | **FAIL** |

## 9. Order Lifecycle Verification

### Service-level spine (`src/scripts/e2e-order-spine.ts`) — live Mongo

| Case | Result | Evidence |
|------|--------|----------|
| HHD-RACE | PASS | 3 accepts → 1 success, 2 `ORDER_ALREADY_ASSIGNED` |
| TC1 deliver | PASS | Order delivered after handover → rider accept → complete |
| TC2 invalid bag / wrong status | PASS | `INVALID_BAG_QR` + `WRONG_STATUS`, order unchanged |
| TC3 double handover | PASS | 409 `ALREADY_HANDED_OVER` |
| TC4 rider race | PASS | 3 riders → 1 success, 2 `ORDER_ALREADY_ASSIGNED` |
| TC5 cancel paths | PASS | cancel at confirmed / picking / offered |

Observed transition evidence (logs): `completeHandover` sets `riderStage: offered`, `offerHubKey: DS-Adyar-01`, customer status `getting-packed`.

### HTTP API path (partial)
1. Customer auth → JWT — **PASS**
2. Cart add product — **PASS** (HTTP 200, total 69)
3. Customer create order via HTTP — **PASS**: `items[]` + `addressId` → **201** `ORD-20260911-00470`; payment-only body correctly **422**
4. Admin orders list shows live `customer_orders` — **PASS**
5. Admin rider dispatch unassigned — **FAIL** for spine correctness: returns legacy `ORD-20260331-00001` / `status=new` while admin customer orders show `ORD-20260910-00469` / `pending`
6. Picker/HHD HTTP accept/complete — **BLOCKED** (no fixed OTP; SMS required)

### Propagation map
```
customer_orders (Order) → fulfillment.createHhdPickTicket → HHDOrder/HHDItem
  → HHD rack scan → fulfillment.completeHandover (riderStage=offered)
  → GET /api/v1/picker/shared-orders → accept/complete → delivered
```
Parallel broken path: `GET /api/v1/rider/dispatch/unassigned` → `dispatch.service.ts` → collection `orders` (legacy).

## 10. Database / Data Integrity Findings

| Finding | Severity | Evidence |
|---------|----------|----------|
| Dual order collections | P0 | Dispatch uses `orders`; spine uses `customer_orders` (`order.model.ts` collection name) |
| Dispatch synthetic coordinates | P0 | `dispatch.service.ts` hashes address into fake lat/lng when missing |
| Inventory reserve not fully transactional with all side effects | P2 | `fulfillment.service.ts` loops |
| Hardcoded hub `DS-Adyar-01` | P2 | `orders.service.ts` / `fulfillment.service.ts` |
| Indexes present on spine | OK | `customer_orders` pickerId+riderStage, offerHubKey indexes |
| E2E cleanup race warning | P3 | `notify-handover failed: Client must be connected...` after tests |

## 11. Authentication & Authorization Findings

| Finding | Severity | Evidence |
|---------|----------|----------|
| Customer JWT works | OK | verify-otp → profile/orders 200 |
| Admin JWT works | OK | login → users/me 200 |
| Admin rejects picker aud | OK | source `FOREIGN_TOKEN_AUDIENCES` |
| Admin rejects customer token | OK | live 403 |
| Picker rejects admin token | OK | live 401 |
| HHD JWT no audience; same JWT_SECRET | P0 | `hhd.models.ts` signs `{id}`; admin accepts `decoded.id` |
| Customer fixed test OTP in non-prod | P1 | `ALLOW_CUSTOMER_TEST_OTP` or non-production default |
| Picker/HHD no fixed test OTP | OK/BLOCKED for tests | verify returns 400 with 8790 |
| In-memory token blocklist | P1 | `utils/auth.ts` |
| In-memory admin login lockout | P3 | `admin-login-lockout.ts` |

## 12. Security Findings

| Finding | Severity | Evidence |
|---------|----------|----------|
| Rate limit on `/api/v1` | OK | `app.ts` express-rate-limit |
| Helmet/sanitize/HPP/xss | OK | `app.ts` |
| Non-prod CORS allows any origin | P1 | `config/cors.ts` |
| Delivery OTP via Math.random | P1 | `fulfillment.service.ts` |
| HHD OTP via Math.random | P1 | `hhd.models.ts` |
| Unauthenticated `/picker/samples` | P1 | live 200 |
| Unauthenticated Didit webhook stub | P1 | live 200 `{received:true}` |
| Malformed JSON → 500 | P2 | live POST send-otp with `{not-json` |
| Diag routes non-prod only | OK | `app.ts` `!isProduction` |
| Secrets in report | N/A | Masked; do not commit `.env` |

## 13. Mock/Dummy/Hardcoded Data Findings

| Location | Behavior | Live evidence |
|----------|----------|---------------|
| `GET /api/v1/admin/system/instances` | Hardcoded running localhost instance | HTTP 200 `[{id:"1",status:"running",host:"localhost"}]` |
| `GET /api/v1/admin/system/cache/stats` | Stub zeros | HTTP 200 hits/misses/keys 0 |
| `GET /api/v1/admin/applications` | Empty stub | HTTP 200 `data:[]` |
| `GET/POST /api/v1/picker/samples` | Sample CRUD stub | HTTP 200 unauthenticated |
| `POST /api/v1/picker/didit/webhook` | Ack-only stub | HTTP 200 |
| `dispatch.service.ts` | Fake coords/distance | Code evidence |
| `store-warehouse.service.ts` performance | Hardcoded zeros | Code evidence |
| `logistics.admin.controller.ts` | Analytics placeholders | Code evidence |
| `pricing.service.ts` | Flash/bundle/tax placeholders | Code evidence |

## 14. Critical Issues

### P0 — Critical

1. **Server failed to boot (fixed)** — `picker.routes.ts` referenced undefined handlers → `Route.post() requires a callback function but got a [object Undefined]`. **Fix applied:** removed duplicate broken registrations. Architecture change? No.
2. **Admin rider dispatch split-brain** — `src/modules/rider/dispatch.service.ts` reads legacy `orders`; live spine is `customer_orders`. Live: dispatch `ORD-20260331-00001` vs admin orders `ORD-20260910-00469`. Architecture change? Yes (unify model).
3. **HHD JWT / admin JWT crossover risk** — shared secret, no `aud` on HHD tokens. Architecture change? Small (secrets + audience).
4. **Synthetic dispatch coordinates** — fake lat/lng from address hash. Architecture change? No (fix logic).

### P1 — High

1. Delivery/HHD OTP `Math.random()` — `fulfillment.service.ts`, `hhd.models.ts`.
2. Customer test OTP enabled outside production by default.
3. In-memory token blocklist / multi-instance logout broken.
4. Non-prod CORS allow-all.
5. Public picker samples + Didit webhook stubs.
6. Missing customer `GET /products` list and `GET /banners` list routes (404).
7. FCM not dispatched on fulfillment notify.

### P2 — Medium

1. Malformed JSON returns 500 instead of 400.
2. Hardcoded Adyar hub for all orders.
3. Logistics/admin analytics placeholders.
4. Duplicate `/api/v1/admin/picker` mounts (31 path pairs).
5. Typecheck failures (auth.controller, exceljs/xlsx types, firebase-admin paths).
6. No ESLint config file.

### P3 — Low

1. HHD photo base URL default port mismatch.
2. Empty domain event listeners.
3. Admin lockout in-memory.
4. Picker/rider naming confusion in docs/API paths.

## 15. Failed Endpoints

| Method | Endpoint | Why FAIL |
|--------|----------|----------|
| GET | `/api/v1/customer/products` | No list route mounted (404) |
| GET | `/api/v1/customer/banners` | No list route mounted (404) |
| GET | `/api/v1/rider/dispatch/unassigned` | Returns legacy collection data, not live spine |
| GET | `/api/v1/admin/system/instances` | Hardcoded stub success |
| POST | `/api/v1/customer/auth/send-otp` (malformed JSON) | Returns 500 instead of 4xx |
| BOOT | `/api/v1/picker/*` router load | Was FAIL pre-fix (undefined handlers); fixed |

## 16. Blocked Endpoints

| Area | Reason |
|------|--------|
| Picker auth verify + all active picker operational routes | Real SMS OTP required (no fixed test OTP) |
| HHD auth verify + protected HHD ops | Real SMS OTP / seeded HHD user required |
| Payment capture / Worldline full flow | Gateway credentials + redirect environment |
| Most warehouse/vendor/finance/darkstore write paths | Admin path discovery + fixture data; not fully exercised this run |
| ~1549 inventory endpoints | Volume — not all 1600+ routes HTTP-tested; classified NOT_TESTED honestly |

## 17. Recommended Fixes

### Safe fixes (no architecture redesign)
- Keep the picker route undefined-handler cleanup (already applied).
- Map malformed JSON to 400 in error middleware.
- Replace `Math.random()` OTP with `crypto`/`generateOtp()`.
- Auth-gate or remove `/picker/samples` and verify Didit webhook signatures.
- Add customer `GET /banners` list and product list/search contract docs alignment.
- Stop returning hardcoded system instances; return 501 or real data.

### Architecture changes
- Point `dispatch.service.ts` at `CustomerOrder` / `customer_orders` (`riderStage`, `offerHubKey`).
- Introduce `HHD_JWT_SECRET` + `aud: "hhd"`; reject unknown audiences in admin auth.
- Move token blocklist + login lockout to Redis when enabled.
- Resolve dual `/admin/picker` mount handlers to a single router.

### Environment/configuration changes
- Set `ALLOW_CUSTOMER_TEST_OTP=false` outside controlled test envs.
- Configure Redis for multi-instance deployments.
- Add `.eslintrc` or remove broken lint script.
- Fix typecheck deps (`exceljs`/`xlsx` types, firebase-admin import paths).
- Ensure SMS DLT providers configured for picker/HHD OTP in staging.

## 18. Final Verdict

| Question | Answer |
|----------|--------|
| Is backend architecture correct? | **Mostly — NEEDS IMPROVEMENT** with critical dispatch/JWT issues |
| Is API architecture correct? | **Partially** — versioning/modules OK; catalog gaps + stubs + dual mounts |
| Endpoints discovered | **1632** |
| Endpoints / cases tested | **56 unique endpoints / 95 test cases** |
| PASS | **66** (test cases) |
| FAIL | **5** |
| PARTIAL | **18** |
| BLOCKED | **6** |
| NOT_TESTED | **0** test cases; **1549** inventory rows |
| Overall score | **64/100** |
| Production readiness | **Not ready** until P0 dispatch unification + JWT isolation + stub removal |

### Top 5 issues
1. Rider admin dispatch reads legacy `orders` (not `customer_orders`).
2. HHD/admin JWT secret/audience isolation missing.
3. Hardcoded/stub admin system endpoints returning fake success.
4. Boot-breaking undefined route handlers (fixed) — indicates weak route/controller contract checks.
5. Weak OTP entropy (`Math.random`) + public stub surfaces (`samples`, Didit).

### Build / lint / test results
| Check | Result |
|-------|--------|
| `npm run typecheck` | **FAIL** — errors in `auth.controller.ts`, `products.admin.controller.ts` (exceljs/xlsx), `fcm.service.ts` (firebase-admin paths) |
| `npm run lint` | **FAIL** — no ESLint config file in repo |
| `npm test` | **PASS (vacuous)** — Jest: “No tests found”, exit 0 |
| `e2e-order-spine.ts` | **PASS** TC1–TC5 + HHD-RACE |

---

*End of audit. Secrets, JWTs, OTPs, and credentials intentionally masked.*