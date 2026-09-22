# Selorg Backend Full Endpoint & Postman Audit

**Generated:** 2026-09-11T09:04:38.636Z
**Repository:** `selorg-service`
**Base URL tested:** `http://127.0.0.1:3333`
**API prefix:** `/api/v1` (+ `/api/payment`, `/health*`)
**Postman collection:** `postman/Selorg-Backend-Full-Endpoints.postman_collection.json`
**Mass results JSON:** `docs/full-endpoint-mass-results.json`
**Unique list:** `docs/UNIQUE_ENDPOINTS_FULL_LIST.md`
**Usage scan:** `docs/endpoint-usage-by-app.json` (308 frontend paths)

## 1. Executive Summary

Every mounted endpoint from the Express route scan was issued at least one live HTTP request against `http://127.0.0.1:3333`.

| Metric | Count |
|--------|------:|
| TOTAL ROUTES FOUND IN SOURCE (mounted) | 1626 |
| TOTAL MOUNTED ENDPOINTS | 1626 |
| TOTAL UNIQUE METHOD+PATH | 1599 |
| TOTAL UNMOUNTED ROUTE FILES | 0 |
| TOTAL DUPLICATE METHOD+PATH PAIRS | 27 |
| TOTAL ENDPOINTS HTTP-TESTED | 1626 |
| PASS | 1527 |
| FAIL | 19 |
| PARTIAL | 80 |
| BLOCKED | 0 |
| NOT_TESTED | 0 |
| USED (exact frontend path match) | 359 |
| UNKNOWN (no frontend match) | 1178 |
| INTERNAL | 18 |
| LEGACY | 14 |
| OBSOLETE | 13 |
| DUPLICATE (classification) | 44 |
| BROKEN (FAIL tests) | 19 |

Auth tokens: customer=true admin=true picker=false hhd=false.

**PASS meaning:** For GETs with auth, business read succeeded or validation/auth behaved correctly. For many POST/PUT/PATCH/DELETE without full domain fixtures, PASS means the route is mounted and returned validation/auth/not-found (4xx) rather than crashing — not always a full happy-path business success. Picker/HHD authorized happy-paths were not available (no SMS OTP); those routes still returned correct **401** without token (counted PASS = auth gate verified).

## 2. Backend Environment

| Item | Value |
|------|-------|
| Base URL | http://127.0.0.1:3333 |
| Port | 3333 |
| NODE_ENV | development |
| API_BASE_URL | http://localhost:3333 |
| Primary prefix | /api/v1 |
| Legacy payment | /api/payment |
| Rate limit during audit | elevated via RATE_LIMIT_MAX_REQUESTS=100000 |

## 3. Total Endpoint Count

| Category | Count |
|----------|------:|
| TOTAL ROUTES FOUND IN SOURCE | 1626 |
| TOTAL MOUNTED ENDPOINTS | 1626 |
| TOTAL UNIQUE METHOD+PATH | 1599 |
| TOTAL UNMOUNTED ROUTES | 0 |
| TOTAL DUPLICATE ROUTES | 27 pairs |
| TOTAL LEGACY/STUB (notes/classification) | 27 |
| Frontend unique paths referenced | 308 |

## 4. Complete Endpoint Inventory

| # | Method | Endpoint | Module | Auth | Role | Used By | Required? | Test Status | HTTP | DB Verified | Classification | Notes |
|---|--------|----------|--------|------|------|---------|-----------|-------------|------|-------------|----------------|-------|
| 1 | POST | `/api/payment/callback` | payments | yes | customer-jwt | - | LEGACY | PASS | 400 | n/a | LEGACY | validation rejected (route alive) |
| 2 | POST | `/api/payment/initiate` | payments | yes | customer-jwt | - | LEGACY | PASS | 400 | n/a | LEGACY | validation rejected (route alive) |
| 3 | GET | `/api/payment/status/:orderId` | payments | yes | customer-jwt | - | LEGACY | PASS | 200 | read-ok | LEGACY | ok |
| 4 | POST | `/api/payment/transaction-status` | payments | no | - | - | LEGACY | PASS | 400 | n/a | LEGACY | validation rejected (route alive) |
| 5 | GET | `/api/v1/admin/analytics/categories` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 6 | POST | `/api/v1/admin/analytics/custom-report` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 7 | GET | `/api/v1/admin/analytics/customers` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 8 | GET | `/api/v1/admin/analytics/export` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 9 | GET | `/api/v1/admin/analytics/financial-summary` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 10 | GET | `/api/v1/admin/analytics/funnel` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 11 | GET | `/api/v1/admin/analytics/growth` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 12 | GET | `/api/v1/admin/analytics/inventory-health` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 13 | GET | `/api/v1/admin/analytics/operational` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 14 | GET | `/api/v1/admin/analytics/orders-by-hour` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 15 | GET | `/api/v1/admin/analytics/payment-methods` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 16 | GET | `/api/v1/admin/analytics/peak-hours` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 17 | GET | `/api/v1/admin/analytics/picker-drilldown/:pickerId` | admin | yes | admin/super_admin | - | OPTIONAL | FAIL | 501 | n/a | UNKNOWN | server error 501 |
| 18 | GET | `/api/v1/admin/analytics/pickers` | admin | yes | admin/super_admin | - | OPTIONAL | FAIL | 501 | n/a | UNKNOWN | server error 501 |
| 19 | GET | `/api/v1/admin/analytics/products` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 20 | GET | `/api/v1/admin/analytics/realtime` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 21 | GET | `/api/v1/admin/analytics/regional` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 22 | GET | `/api/v1/admin/analytics/revenue` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 23 | GET | `/api/v1/admin/analytics/rider-performance` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 24 | GET | `/api/v1/admin/analytics/timeseries` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 25 | GET | `/api/v1/admin/app-settings` | admin | partial | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | n/a | USED | ok |
| 26 | PUT | `/api/v1/admin/app-settings` | admin | partial | admin/super_admin | admin-dashboard | REQUIRED | PASS | 400 | n/a | USED | validation rejected (route alive) |
| 27 | GET | `/api/v1/admin/applications` | admin | yes | admin/super_admin | - | OPTIONAL | PARTIAL | 200 | read-ok | OBSOLETE | stub/mock hardcoded success |
| 28 | PATCH | `/api/v1/admin/applications/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PARTIAL | 200 | n/a | OBSOLETE | stub/mock hardcoded success |
| 29 | PUT | `/api/v1/admin/applications/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PARTIAL | 200 | n/a | OBSOLETE | stub/mock hardcoded success |
| 30 | GET | `/api/v1/admin/applications/:id/health` | admin | yes | admin/super_admin | - | OPTIONAL | PARTIAL | 200 | read-ok | OBSOLETE | stub/mock hardcoded success |
| 31 | POST | `/api/v1/admin/applications/:id/test` | admin | yes | admin/super_admin | - | OPTIONAL | PARTIAL | 200 | n/a | OBSOLETE | stub/mock hardcoded success |
| 32 | POST | `/api/v1/admin/applications/:id/test-connection` | admin | yes | admin/super_admin | - | OPTIONAL | PARTIAL | 200 | n/a | OBSOLETE | stub/mock hardcoded success |
| 33 | POST | `/api/v1/admin/auth/login` | admin | no | - | admin-dashboard | REQUIRED | PARTIAL | 401 | n/a | USED | auth rejected with provided token |
| 34 | POST | `/api/v1/admin/auth/logout` | admin | no | - | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 35 | POST | `/api/v1/admin/cache/clear` | admin | partial | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 36 | GET | `/api/v1/admin/cache/stats` | admin | partial | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 37 | GET | `/api/v1/admin/cities` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 38 | POST | `/api/v1/admin/cities` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 39 | DELETE | `/api/v1/admin/cities/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | delete handled 404 |
| 40 | GET | `/api/v1/admin/cities/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 41 | PUT | `/api/v1/admin/cities/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 42 | GET | `/api/v1/admin/compliance/audits` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 43 | POST | `/api/v1/admin/compliance/audits` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 44 | PATCH | `/api/v1/admin/compliance/audits/:auditId/findings/:findingId` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 45 | GET | `/api/v1/admin/compliance/certifications` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 46 | GET | `/api/v1/admin/compliance/documents` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 47 | POST | `/api/v1/admin/compliance/documents` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 48 | DELETE | `/api/v1/admin/compliance/documents/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | delete handled 404 |
| 49 | PATCH | `/api/v1/admin/compliance/documents/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 50 | GET | `/api/v1/admin/compliance/metrics` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 51 | GET | `/api/v1/admin/compliance/policies` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 52 | POST | `/api/v1/admin/compliance/policies/:id/acknowledge` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 53 | POST | `/api/v1/admin/compliance/reports/generate` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 54 | GET | `/api/v1/admin/compliance/violations` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 55 | GET | `/api/v1/admin/customers` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 56 | POST | `/api/v1/admin/customers` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 400 | n/a | USED | validation rejected (route alive) |
| 57 | GET | `/api/v1/admin/customers/:id` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 58 | PATCH | `/api/v1/admin/customers/:id` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 59 | GET | `/api/v1/admin/customers/:id/addresses` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 60 | GET | `/api/v1/admin/customers/:id/orders` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 61 | GET | `/api/v1/admin/customers/:id/password-info` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 62 | GET | `/api/v1/admin/customers/:id/payment-methods` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 63 | GET | `/api/v1/admin/customers/:id/refunds` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 64 | PUT | `/api/v1/admin/customers/:id/reset-password` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 65 | GET | `/api/v1/admin/customers/:id/risk` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 66 | PUT | `/api/v1/admin/customers/:id/set-password` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 67 | GET | `/api/v1/admin/customers/:id/tickets` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 68 | GET | `/api/v1/admin/customers/:id/wallet` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 69 | POST | `/api/v1/admin/customers/:id/wallet/credit` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 70 | GET | `/api/v1/admin/customers/stats` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 71 | GET | `/api/v1/admin/finance/accounting/accounts` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 72 | POST | `/api/v1/admin/finance/accounting/journal` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 73 | GET | `/api/v1/admin/finance/accounting/journal/:id` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 74 | GET | `/api/v1/admin/finance/accounting/ledger` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 75 | GET | `/api/v1/admin/finance/accounting/summary` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 76 | POST | `/api/v1/admin/finance/accounting/sync` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 77 | GET | `/api/v1/admin/finance/alerts` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 78 | GET | `/api/v1/admin/finance/alerts/:id` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 79 | POST | `/api/v1/admin/finance/alerts/:id/action` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 80 | POST | `/api/v1/admin/finance/alerts/clear-resolved` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 81 | DELETE | `/api/v1/admin/finance/alerts/resolved` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 82 | POST | `/api/v1/admin/finance/alerts/resolved/clear` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 83 | GET | `/api/v1/admin/finance/analytics/cash-flow` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 84 | GET | `/api/v1/admin/finance/analytics/expense-breakdown` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 85 | POST | `/api/v1/admin/finance/analytics/export` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 86 | GET | `/api/v1/admin/finance/analytics/revenue-growth` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 87 | GET | `/api/v1/admin/finance/approvals` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 88 | GET | `/api/v1/admin/finance/approvals/:id` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 89 | POST | `/api/v1/admin/finance/approvals/:id/decision` | finance | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 90 | GET | `/api/v1/admin/finance/approvals/summary` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 91 | GET | `/api/v1/admin/finance/approvals/tasks` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 92 | GET | `/api/v1/admin/finance/approvals/tasks/:id` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 93 | POST | `/api/v1/admin/finance/approvals/tasks/:id/decision` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 94 | GET | `/api/v1/admin/finance/config/commission-slabs` | finance | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 95 | POST | `/api/v1/admin/finance/config/commission-slabs` | finance | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 201 | n/a | USED | mutation accepted |
| 96 | PUT | `/api/v1/admin/finance/config/commission-slabs/:slabId` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 97 | GET | `/api/v1/admin/finance/config/financial-limits` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 98 | PUT | `/api/v1/admin/finance/config/financial-limits/:limitId` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 99 | GET | `/api/v1/admin/finance/config/financial-year` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | ok |
| 100 | PUT | `/api/v1/admin/finance/config/financial-year` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 101 | GET | `/api/v1/admin/finance/config/invoice-settings` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 102 | PUT | `/api/v1/admin/finance/config/invoice-settings` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 103 | GET | `/api/v1/admin/finance/config/payment-terms` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 104 | PUT | `/api/v1/admin/finance/config/payment-terms/:termId` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 105 | GET | `/api/v1/admin/finance/config/payout-schedules` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 106 | POST | `/api/v1/admin/finance/config/payout-schedules` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 107 | PUT | `/api/v1/admin/finance/config/payout-schedules/:scheduleId` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 108 | GET | `/api/v1/admin/finance/config/reconciliation-rules` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 109 | PUT | `/api/v1/admin/finance/config/reconciliation-rules/:ruleId` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 110 | GET | `/api/v1/admin/finance/config/refund-policies` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 111 | PUT | `/api/v1/admin/finance/config/refund-policies/:policyId` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 112 | GET | `/api/v1/admin/finance/config/tax-rules` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 113 | POST | `/api/v1/admin/finance/config/tax-rules` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 114 | PUT | `/api/v1/admin/finance/config/tax-rules/:ruleId` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 115 | GET | `/api/v1/admin/finance/customer-payments` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 116 | GET | `/api/v1/admin/finance/customer-payments/:id` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 117 | POST | `/api/v1/admin/finance/customer-payments/:id/retry` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 118 | GET | `/api/v1/admin/finance/dashboard/daily-metrics` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 119 | POST | `/api/v1/admin/finance/dashboard/export` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 120 | GET | `/api/v1/admin/finance/dashboard/gateway-status` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 121 | GET | `/api/v1/admin/finance/dashboard/hourly-trends` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 122 | GET | `/api/v1/admin/finance/dashboard/live-transactions` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 123 | GET | `/api/v1/admin/finance/dashboard/payment-method-split` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 124 | GET | `/api/v1/admin/finance/dashboard/summary` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 125 | GET | `/api/v1/admin/finance/dashboard/wallet-liability` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 126 | GET | `/api/v1/admin/finance/invoices` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 127 | POST | `/api/v1/admin/finance/invoices` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 128 | GET | `/api/v1/admin/finance/invoices/:id` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 129 | POST | `/api/v1/admin/finance/invoices/:id/mark-paid` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 130 | POST | `/api/v1/admin/finance/invoices/:id/reminder` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 131 | POST | `/api/v1/admin/finance/invoices/:id/send` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 132 | POST | `/api/v1/admin/finance/invoices/:id/send-reminder` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 133 | PATCH | `/api/v1/admin/finance/invoices/:id/status` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 134 | GET | `/api/v1/admin/finance/invoices/summary` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 135 | GET | `/api/v1/admin/finance/picker-attendance` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 136 | GET | `/api/v1/admin/finance/picker-earnings/:pickerId/breakdown` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 137 | GET | `/api/v1/admin/finance/picker-earnings/:pickerId/wallet` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 138 | GET | `/api/v1/admin/finance/picker-transactions` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 139 | GET | `/api/v1/admin/finance/picker-withdrawals` | finance | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 140 | GET | `/api/v1/admin/finance/picker-withdrawals/:id` | finance | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | not found for placeholder id (route mounted) |
| 141 | PATCH | `/api/v1/admin/finance/picker-withdrawals/:id` | finance | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 142 | GET | `/api/v1/admin/finance/picker-withdrawals/:pickerId/earnings-breakdown` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 143 | GET | `/api/v1/admin/finance/picker-withdrawals/:pickerId/wallet-balance` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 144 | GET | `/api/v1/admin/finance/reconciliation/exceptions` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 145 | POST | `/api/v1/admin/finance/reconciliation/exceptions/:id/investigate` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 146 | POST | `/api/v1/admin/finance/reconciliation/exceptions/:id/resolve` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 147 | GET | `/api/v1/admin/finance/reconciliation/gateways` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 148 | GET | `/api/v1/admin/finance/reconciliation/gateways/:id` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 149 | POST | `/api/v1/admin/finance/reconciliation/run` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 150 | GET | `/api/v1/admin/finance/reconciliation/runs/:id` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 151 | GET | `/api/v1/admin/finance/reconciliation/summary` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 152 | GET | `/api/v1/admin/finance/refunds/:id` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 153 | POST | `/api/v1/admin/finance/refunds/:id/approve` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 154 | POST | `/api/v1/admin/finance/refunds/:id/complete` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 155 | POST | `/api/v1/admin/finance/refunds/:id/mark-completed` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 156 | POST | `/api/v1/admin/finance/refunds/:id/reject` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 157 | GET | `/api/v1/admin/finance/refunds/chargebacks` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 158 | GET | `/api/v1/admin/finance/refunds/queue` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 159 | GET | `/api/v1/admin/finance/refunds/summary` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 160 | GET | `/api/v1/admin/finance/refunds/wallet-transactions` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 161 | GET | `/api/v1/admin/finance/rider-cash/:riderId` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 162 | GET | `/api/v1/admin/finance/rider-cash/cod-reconciliation` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 163 | GET | `/api/v1/admin/finance/rider-cash/payouts` | finance | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 164 | GET | `/api/v1/admin/finance/rider-cash/riders/:riderId/payment-details` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 165 | GET | `/api/v1/admin/finance/rider-cash/summary` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 166 | GET | `/api/v1/admin/finance/vendor-payments/invoices` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 167 | POST | `/api/v1/admin/finance/vendor-payments/invoices` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 168 | GET | `/api/v1/admin/finance/vendor-payments/invoices/:id` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 169 | POST | `/api/v1/admin/finance/vendor-payments/invoices/:id/approve` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 170 | POST | `/api/v1/admin/finance/vendor-payments/invoices/:id/mark-paid` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 171 | POST | `/api/v1/admin/finance/vendor-payments/invoices/:id/reject` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 172 | POST | `/api/v1/admin/finance/vendor-payments/invoices/bulk-approve` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 173 | GET | `/api/v1/admin/finance/vendor-payments/payments` | finance | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 174 | POST | `/api/v1/admin/finance/vendor-payments/payments` | finance | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 175 | GET | `/api/v1/admin/finance/vendor-payments/payments/:paymentId` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 176 | POST | `/api/v1/admin/finance/vendor-payments/payments/:paymentId/advance` | finance | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 177 | POST | `/api/v1/admin/finance/vendor-payments/payments/:paymentId/cancel` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 178 | POST | `/api/v1/admin/finance/vendor-payments/payments/:paymentId/invoices/:invoiceId/workflow/advance` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 179 | GET | `/api/v1/admin/finance/vendor-payments/summary` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 180 | GET | `/api/v1/admin/finance/vendor-payments/vendors` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 181 | GET | `/api/v1/admin/finance/wallet-transactions` | finance | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 182 | GET | `/api/v1/admin/fraud/alerts` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 183 | GET | `/api/v1/admin/fraud/alerts/:id` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | not found for placeholder id (route mounted) |
| 184 | PATCH | `/api/v1/admin/fraud/alerts/:id` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 185 | GET | `/api/v1/admin/fraud/blocked` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 186 | POST | `/api/v1/admin/fraud/blocked` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 187 | DELETE | `/api/v1/admin/fraud/blocked/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | delete handled 404 |
| 188 | GET | `/api/v1/admin/fraud/chargebacks` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 189 | PATCH | `/api/v1/admin/fraud/chargebacks/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 190 | GET | `/api/v1/admin/fraud/investigations` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 191 | GET | `/api/v1/admin/fraud/metrics` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 192 | GET | `/api/v1/admin/fraud/patterns` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 193 | GET | `/api/v1/admin/fraud/risk-profiles` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 194 | GET | `/api/v1/admin/fraud/rules` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 195 | PATCH | `/api/v1/admin/fraud/rules/:id/toggle` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 196 | GET | `/api/v1/admin/integrations` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 197 | PATCH | `/api/v1/admin/integrations/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 198 | PUT | `/api/v1/admin/integrations/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 199 | POST | `/api/v1/admin/integrations/:id/test` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 200 | GET | `/api/v1/admin/integrations/api-keys` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 201 | POST | `/api/v1/admin/integrations/api-keys` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 202 | DELETE | `/api/v1/admin/integrations/api-keys/:keyId` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | delete handled 404 |
| 203 | GET | `/api/v1/admin/integrations/health` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | n/a | USED | ok |
| 204 | GET | `/api/v1/admin/integrations/logs` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 205 | GET | `/api/v1/admin/integrations/stats` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 206 | GET | `/api/v1/admin/integrations/webhooks` | admin | yes | admin/super_admin | - | REQUIRED | PASS | 200 | read-ok | INTERNAL | ok |
| 207 | POST | `/api/v1/admin/integrations/webhooks` | admin | yes | admin/super_admin | - | REQUIRED | PASS | 422 | n/a | INTERNAL | validation rejected (route alive) |
| 208 | POST | `/api/v1/admin/integrations/webhooks/:webhookId/retry` | admin | yes | admin/super_admin | - | REQUIRED | PASS | 404 | n/a | INTERNAL | resource not found for test id (route alive) |
| 209 | GET | `/api/v1/admin/notifications/analytics` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 210 | GET | `/api/v1/admin/notifications/automation` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 211 | POST | `/api/v1/admin/notifications/automation` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 212 | PUT | `/api/v1/admin/notifications/automation/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 213 | GET | `/api/v1/admin/notifications/campaigns` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 214 | POST | `/api/v1/admin/notifications/campaigns` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 215 | GET | `/api/v1/admin/notifications/campaigns/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 216 | PUT | `/api/v1/admin/notifications/campaigns/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 217 | GET | `/api/v1/admin/notifications/channels` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 218 | GET | `/api/v1/admin/notifications/history` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 219 | POST | `/api/v1/admin/notifications/history/:id/retry` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | FAIL | 501 | n/a | USED | server error 501 |
| 220 | POST | `/api/v1/admin/notifications/history/retry-failed` | admin | yes | admin/super_admin | - | OPTIONAL | FAIL | 501 | n/a | UNKNOWN | server error 501 |
| 221 | GET | `/api/v1/admin/notifications/scheduled` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 222 | GET | `/api/v1/admin/notifications/templates` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 223 | POST | `/api/v1/admin/notifications/templates` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 224 | DELETE | `/api/v1/admin/notifications/templates/:id` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | delete handled 404 |
| 225 | PUT | `/api/v1/admin/notifications/templates/:id` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 226 | GET | `/api/v1/admin/notifications/timeseries` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 227 | GET | `/api/v1/admin/orders` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 228 | POST | `/api/v1/admin/orders` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 400 | n/a | USED | validation rejected (route alive) |
| 229 | GET | `/api/v1/admin/orders/:id` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 230 | GET | `/api/v1/admin/orders/:id/logs` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 231 | GET | `/api/v1/admin/permissions` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 232 | POST | `/api/v1/admin/permissions` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 233 | DELETE | `/api/v1/admin/permissions/:id` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | delete handled 404 |
| 234 | GET | `/api/v1/admin/permissions/:id` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 235 | PUT | `/api/v1/admin/permissions/:id` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 236 | GET | `/api/v1/admin/permissions/matrix` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 237 | GET | `/api/v1/admin/picker-action-logs` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 238 | GET | `/api/v1/admin/picker-config` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 239 | PUT | `/api/v1/admin/picker-config` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 240 | GET | `/api/v1/admin/picker/agencies` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 241 | GET | `/api/v1/admin/picker/agencies` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 242 | POST | `/api/v1/admin/picker/agencies` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 201 | n/a | DUPLICATE | mutation accepted |
| 243 | POST | `/api/v1/admin/picker/agencies` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 201 | n/a | DUPLICATE | mutation accepted |
| 244 | POST | `/api/v1/admin/picker/agencies/:agencyId/activate` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 245 | POST | `/api/v1/admin/picker/agencies/:agencyId/activate` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 246 | POST | `/api/v1/admin/picker/agencies/:agencyId/deactivate` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 247 | POST | `/api/v1/admin/picker/agencies/:agencyId/deactivate` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 248 | GET | `/api/v1/admin/picker/approvals` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 249 | GET | `/api/v1/admin/picker/approvals` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 250 | GET | `/api/v1/admin/picker/attendance` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 251 | GET | `/api/v1/admin/picker/attendance` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 252 | GET | `/api/v1/admin/picker/attendance/export` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 253 | GET | `/api/v1/admin/picker/attendance/export` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 254 | GET | `/api/v1/admin/picker/attendance/live` | picker | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 255 | GET | `/api/v1/admin/picker/devices` | picker | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 256 | DELETE | `/api/v1/admin/picker/devices/:deviceId/unassign` | picker | yes | admin-jwt | - | OPTIONAL | FAIL | 500 | n/a | UNKNOWN | server error 500 |
| 257 | POST | `/api/v1/admin/picker/devices/assign` | picker | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 258 | PUT | `/api/v1/admin/picker/documents/:documentId/review` | picker | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 259 | GET | `/api/v1/admin/picker/ot-requests` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 260 | GET | `/api/v1/admin/picker/ot-requests` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 261 | POST | `/api/v1/admin/picker/ot-requests/:requestId/decision` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 262 | POST | `/api/v1/admin/picker/ot-requests/:requestId/decision` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 263 | GET | `/api/v1/admin/picker/pickers` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 264 | GET | `/api/v1/admin/picker/pickers` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 265 | GET | `/api/v1/admin/picker/pickers/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 266 | GET | `/api/v1/admin/picker/pickers/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 267 | GET | `/api/v1/admin/picker/pickers/:id/action-logs` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 268 | GET | `/api/v1/admin/picker/pickers/:id/action-logs` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 269 | PATCH | `/api/v1/admin/picker/pickers/:id/bank/:accountId/review` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 270 | PATCH | `/api/v1/admin/picker/pickers/:id/bank/:accountId/review` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 271 | PATCH | `/api/v1/admin/picker/pickers/:id/documents/review` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 272 | PATCH | `/api/v1/admin/picker/pickers/:id/documents/review` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 273 | GET | `/api/v1/admin/picker/pickers/:id/face-verification` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 274 | GET | `/api/v1/admin/picker/pickers/:id/face-verification` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 275 | PATCH | `/api/v1/admin/picker/pickers/:id/face-verification/override` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 276 | PATCH | `/api/v1/admin/picker/pickers/:id/face-verification/override` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 277 | DELETE | `/api/v1/admin/picker/pickers/:id/link-hhd` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | delete handled 200 |
| 278 | DELETE | `/api/v1/admin/picker/pickers/:id/link-hhd` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | delete handled 200 |
| 279 | POST | `/api/v1/admin/picker/pickers/:id/link-hhd` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 280 | POST | `/api/v1/admin/picker/pickers/:id/link-hhd` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 281 | PATCH | `/api/v1/admin/picker/pickers/:id/status` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 282 | PATCH | `/api/v1/admin/picker/pickers/:id/status` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 283 | GET | `/api/v1/admin/picker/pickers/:id/training-progress` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 284 | GET | `/api/v1/admin/picker/pickers/:id/training-progress` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 285 | PUT | `/api/v1/admin/picker/pickers/:pickerId/approve` | picker | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 286 | PATCH | `/api/v1/admin/picker/pickers/:pickerId/assignment` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 287 | PATCH | `/api/v1/admin/picker/pickers/:pickerId/assignment` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 288 | POST | `/api/v1/admin/picker/pickers/:pickerId/push` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 289 | POST | `/api/v1/admin/picker/pickers/:pickerId/push` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | DUPLICATE | mutation accepted |
| 290 | PUT | `/api/v1/admin/picker/pickers/:pickerId/reject` | picker | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 291 | GET | `/api/v1/admin/picker/shift-change-requests` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 292 | GET | `/api/v1/admin/picker/shift-change-requests` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 293 | POST | `/api/v1/admin/picker/shift-change-requests/:requestId/decision` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 294 | POST | `/api/v1/admin/picker/shift-change-requests/:requestId/decision` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 295 | POST | `/api/v1/admin/picker/shifts/:shiftId/reassign` | picker | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 296 | GET | `/api/v1/admin/picker/stores/:storeId/shift-slots` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 297 | GET | `/api/v1/admin/picker/stores/:storeId/shift-slots` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 298 | POST | `/api/v1/admin/picker/stores/:storeId/shift-slots` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 201 | n/a | DUPLICATE | mutation accepted |
| 299 | POST | `/api/v1/admin/picker/stores/:storeId/shift-slots` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 201 | n/a | DUPLICATE | mutation accepted |
| 300 | GET | `/api/v1/admin/picker/withdrawals` | picker | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 301 | PUT | `/api/v1/admin/picker/withdrawals/:requestId/process` | picker | yes | admin-jwt | - | OPTIONAL | FAIL | 500 | n/a | UNKNOWN | server error 500 |
| 302 | GET | `/api/v1/admin/pickers` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 303 | GET | `/api/v1/admin/pickers/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 304 | PATCH | `/api/v1/admin/pickers/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 305 | GET | `/api/v1/admin/pickers/:id/action-logs` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 306 | PATCH | `/api/v1/admin/pickers/:id/bank/:accountId/review` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 307 | PATCH | `/api/v1/admin/pickers/:id/documents/review` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 308 | GET | `/api/v1/admin/pickers/:id/face-verification` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 309 | PATCH | `/api/v1/admin/pickers/:id/face-verification/override` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 310 | DELETE | `/api/v1/admin/pickers/:id/link-hhd` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 311 | POST | `/api/v1/admin/pickers/:id/link-hhd` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 312 | GET | `/api/v1/admin/pickers/:id/training-progress` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 313 | GET | `/api/v1/admin/platform-config` | admin | partial | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 314 | DELETE | `/api/v1/admin/platform-config/:key` | admin | partial | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | n/a | USED | delete handled 200 |
| 315 | GET | `/api/v1/admin/platform-config/:key` | admin | partial | admin/super_admin | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | not found for placeholder id (route mounted) |
| 316 | PUT | `/api/v1/admin/platform-config/:key` | admin | partial | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 317 | GET | `/api/v1/admin/products` | products | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 318 | POST | `/api/v1/admin/products` | products | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 400 | n/a | USED | validation rejected (route alive) |
| 319 | DELETE | `/api/v1/admin/products/:id` | products | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | delete handled 404 |
| 320 | GET | `/api/v1/admin/products/:id` | products | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | not found for placeholder id (route mounted) |
| 321 | PUT | `/api/v1/admin/products/:id` | products | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 322 | POST | `/api/v1/admin/products/bulk-upload` | products | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 400 | n/a | USED | validation rejected (route alive) |
| 323 | GET | `/api/v1/admin/products/bulk-upload/template` | products | yes | admin-jwt | admin-dashboard | REQUIRED | FAIL | 500 | n/a | USED | server error 500 |
| 324 | GET | `/api/v1/admin/riders` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 325 | GET | `/api/v1/admin/riders/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 326 | PATCH | `/api/v1/admin/riders/:id/status` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 327 | GET | `/api/v1/admin/roles` | admin | yes | admin/super_admin;permission-gated | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 328 | POST | `/api/v1/admin/roles` | admin | yes | admin/super_admin;permission-gated | admin-dashboard | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 329 | DELETE | `/api/v1/admin/roles/:id` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | delete handled 404 |
| 330 | GET | `/api/v1/admin/roles/:id` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 331 | PUT | `/api/v1/admin/roles/:id` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 332 | GET | `/api/v1/admin/roles/:id/export` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 333 | PUT | `/api/v1/admin/roles/:id/matrix` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 334 | POST | `/api/v1/admin/roles/from-template` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 335 | POST | `/api/v1/admin/roles/import` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 336 | GET | `/api/v1/admin/roles/templates` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 337 | GET | `/api/v1/admin/sku-units` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 338 | POST | `/api/v1/admin/sku-units` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 339 | DELETE | `/api/v1/admin/sku-units/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | delete handled 404 |
| 340 | GET | `/api/v1/admin/sku-units/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 341 | PUT | `/api/v1/admin/sku-units/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 342 | GET | `/api/v1/admin/staff` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 343 | GET | `/api/v1/admin/staff` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | DUPLICATE | ok |
| 344 | POST | `/api/v1/admin/staff` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 345 | DELETE | `/api/v1/admin/staff/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 346 | GET | `/api/v1/admin/staff/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 347 | PUT | `/api/v1/admin/staff/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 348 | GET | `/api/v1/admin/staff/shifts` | staff | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | query validation (route alive) |
| 349 | POST | `/api/v1/admin/staff/shifts` | staff | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 350 | GET | `/api/v1/admin/staff/shifts/:id` | staff | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 351 | PUT | `/api/v1/admin/staff/shifts/:id` | staff | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 352 | GET | `/api/v1/admin/staff/summary` | staff | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | query validation (route alive) |
| 353 | GET | `/api/v1/admin/store-warehouse/bins` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 354 | GET | `/api/v1/admin/store-warehouse/bins/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 355 | GET | `/api/v1/admin/store-warehouse/delivery-zones` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 356 | GET | `/api/v1/admin/store-warehouse/grns` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 357 | GET | `/api/v1/admin/store-warehouse/grns/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 358 | GET | `/api/v1/admin/store-warehouse/inventories` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 359 | GET | `/api/v1/admin/store-warehouse/inventories/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 360 | GET | `/api/v1/admin/store-warehouse/putaway` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 361 | GET | `/api/v1/admin/store-warehouse/stock-movements` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 362 | GET | `/api/v1/admin/stores` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 363 | POST | `/api/v1/admin/stores` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 364 | DELETE | `/api/v1/admin/stores/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | delete handled 404 |
| 365 | GET | `/api/v1/admin/stores/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 366 | PUT | `/api/v1/admin/stores/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 367 | GET | `/api/v1/admin/stores/performance` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 368 | GET | `/api/v1/admin/stores/stats` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 369 | GET | `/api/v1/admin/support-chat/conversations` | support-chat | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 370 | GET | `/api/v1/admin/support-chat/conversations/:id` | support-chat | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 371 | GET | `/api/v1/admin/support-chat/conversations/:id/context` | support-chat | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 372 | POST | `/api/v1/admin/support-chat/conversations/:id/messages` | support-chat | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 373 | POST | `/api/v1/admin/support-chat/conversations/:id/read` | support-chat | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 374 | PATCH | `/api/v1/admin/support-chat/conversations/:id/status` | support-chat | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 375 | GET | `/api/v1/admin/support/agents` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 376 | GET | `/api/v1/admin/support/canned-responses` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 377 | GET | `/api/v1/admin/support/categories` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 378 | GET | `/api/v1/admin/support/faqs` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 379 | POST | `/api/v1/admin/support/faqs` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 380 | DELETE | `/api/v1/admin/support/faqs/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 381 | PATCH | `/api/v1/admin/support/faqs/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 382 | GET | `/api/v1/admin/support/feedback` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 383 | GET | `/api/v1/admin/support/live-chats` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 384 | POST | `/api/v1/admin/support/live-chats/:id/accept` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 385 | POST | `/api/v1/admin/support/live-chats/:id/messages` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 386 | GET | `/api/v1/admin/support/sla-metrics` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 387 | GET | `/api/v1/admin/support/tickets` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 388 | POST | `/api/v1/admin/support/tickets` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 400 | n/a | USED | validation rejected (route alive) |
| 389 | GET | `/api/v1/admin/support/tickets/:id` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | not found for placeholder id (route mounted) |
| 390 | PATCH | `/api/v1/admin/support/tickets/:id` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 391 | POST | `/api/v1/admin/support/tickets/:id/assign` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 400 | n/a | USED | validation rejected (route alive) |
| 392 | POST | `/api/v1/admin/support/tickets/:id/close` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 393 | POST | `/api/v1/admin/support/tickets/:id/escalate` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 394 | POST | `/api/v1/admin/support/tickets/:id/notes` | admin | yes | admin/super_admin | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 395 | POST | `/api/v1/admin/support/tickets/:id/redelivery` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 396 | POST | `/api/v1/admin/support/tickets/:id/refund` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 397 | GET | `/api/v1/admin/system/advanced` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 398 | PUT | `/api/v1/admin/system/advanced` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 399 | GET | `/api/v1/admin/system/api-endpoints` | admin | partial | admin/super_admin;permission-gated | - | OPTIONAL | PARTIAL | 200 | read-ok | OBSOLETE | stub/mock hardcoded success |
| 400 | GET | `/api/v1/admin/system/api-keys` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 401 | POST | `/api/v1/admin/system/api-keys` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 402 | POST | `/api/v1/admin/system/api-keys/:id/revoke` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 403 | POST | `/api/v1/admin/system/api-keys/:id/rotate` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 404 | POST | `/api/v1/admin/system/cache/clear` | admin | partial | admin/super_admin;permission-gated | - | OPTIONAL | PARTIAL | 200 | n/a | OBSOLETE | stub/mock hardcoded success |
| 405 | GET | `/api/v1/admin/system/cache/stats` | admin | partial | admin/super_admin;permission-gated | - | OPTIONAL | PARTIAL | 200 | read-ok | OBSOLETE | stub/mock hardcoded success |
| 406 | GET | `/api/v1/admin/system/cron-jobs` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 407 | PUT | `/api/v1/admin/system/cron-jobs/:jobId` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 408 | POST | `/api/v1/admin/system/cron-jobs/:jobId/trigger` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 409 | GET | `/api/v1/admin/system/delivery` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 410 | PUT | `/api/v1/admin/system/delivery` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 411 | GET | `/api/v1/admin/system/env-variables` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 412 | PUT | `/api/v1/admin/system/env-variables/:key` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 413 | GET | `/api/v1/admin/system/feature-flags` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 414 | PUT | `/api/v1/admin/system/feature-flags/:id/toggle` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 415 | GET | `/api/v1/admin/system/general` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 416 | PUT | `/api/v1/admin/system/general` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 417 | GET | `/api/v1/admin/system/instances` | admin | partial | admin/super_admin;permission-gated | - | OPTIONAL | PARTIAL | 200 | read-ok | OBSOLETE | stub/mock hardcoded success |
| 418 | POST | `/api/v1/admin/system/instances/:id/restart` | admin | partial | admin/super_admin;permission-gated | - | OPTIONAL | PARTIAL | 200 | n/a | OBSOLETE | stub/mock hardcoded success |
| 419 | GET | `/api/v1/admin/system/integrations` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 420 | PUT | `/api/v1/admin/system/integrations/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 421 | POST | `/api/v1/admin/system/integrations/:id/test` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 422 | GET | `/api/v1/admin/system/logs` | admin | partial | admin/super_admin;permission-gated | - | OPTIONAL | PARTIAL | 200 | read-ok | OBSOLETE | stub/mock hardcoded success |
| 423 | GET | `/api/v1/admin/system/maintenance` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | ok |
| 424 | POST | `/api/v1/admin/system/maintenance` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 425 | GET | `/api/v1/admin/system/migrations` | admin | partial | admin/super_admin;permission-gated | - | OPTIONAL | PARTIAL | 200 | read-ok | OBSOLETE | stub/mock hardcoded success |
| 426 | GET | `/api/v1/admin/system/notifications` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 427 | PUT | `/api/v1/admin/system/notifications` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 428 | GET | `/api/v1/admin/system/payment-gateways` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 429 | PUT | `/api/v1/admin/system/payment-gateways/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 430 | GET | `/api/v1/admin/system/performance` | admin | partial | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 431 | GET | `/api/v1/admin/system/server-status` | admin | partial | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 432 | GET | `/api/v1/admin/system/tax-settings` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 433 | PUT | `/api/v1/admin/system/tax-settings` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 434 | GET | `/api/v1/admin/training-videos` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 435 | POST | `/api/v1/admin/training-videos` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 436 | DELETE | `/api/v1/admin/training-videos/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 437 | GET | `/api/v1/admin/training-videos/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 438 | PUT | `/api/v1/admin/training-videos/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 439 | GET | `/api/v1/admin/training-videos/picker-progress` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 440 | GET | `/api/v1/admin/users` | admin | yes | admin/super_admin;permission-gated | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 441 | POST | `/api/v1/admin/users` | admin | yes | admin/super_admin;permission-gated | admin-dashboard | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 442 | DELETE | `/api/v1/admin/users/:id` | admin | yes | admin/super_admin;permission-gated | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | delete handled 404 |
| 443 | GET | `/api/v1/admin/users/:id` | admin | yes | admin/super_admin;permission-gated | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | not found for placeholder id (route mounted) |
| 444 | PUT | `/api/v1/admin/users/:id` | admin | yes | admin/super_admin;permission-gated | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 445 | PUT | `/api/v1/admin/users/:id/reset-password` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 446 | PUT | `/api/v1/admin/users/:id/role` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 447 | POST | `/api/v1/admin/users/bulk` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 448 | GET | `/api/v1/admin/users/managers` | admin | yes | admin/super_admin;permission-gated | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 449 | GET | `/api/v1/admin/users/me` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 450 | GET | `/api/v1/admin/vehicle-types` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 451 | POST | `/api/v1/admin/vehicle-types` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 452 | DELETE | `/api/v1/admin/vehicle-types/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | delete handled 404 |
| 453 | GET | `/api/v1/admin/vehicle-types/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 454 | PUT | `/api/v1/admin/vehicle-types/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 455 | GET | `/api/v1/admin/vendor/approvals` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 456 | POST | `/api/v1/admin/vendor/approvals/:approvalId/approve` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 457 | POST | `/api/v1/admin/vendor/approvals/:approvalId/reject` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 458 | GET | `/api/v1/admin/vendor/approvals/summary` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 459 | GET | `/api/v1/admin/vendor/approvals/tasks` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 460 | GET | `/api/v1/admin/vendor/approvals/tasks/:id` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 461 | POST | `/api/v1/admin/vendor/approvals/tasks/:id/decision` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 462 | GET | `/api/v1/admin/vendor/certificates` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 463 | POST | `/api/v1/admin/vendor/certificates` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 464 | DELETE | `/api/v1/admin/vendor/certificates/:certificateId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 465 | GET | `/api/v1/admin/vendor/certificates/:certificateId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 466 | PATCH | `/api/v1/admin/vendor/certificates/:certificateId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 467 | GET | `/api/v1/admin/vendor/dashboard/summary` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 468 | POST | `/api/v1/admin/vendor/inbound/bulk-import` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 469 | GET | `/api/v1/admin/vendor/inbound/bulk-import/:jobId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 470 | GET | `/api/v1/admin/vendor/inbound/exceptions` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 471 | POST | `/api/v1/admin/vendor/inbound/exceptions` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 472 | POST | `/api/v1/admin/vendor/inbound/exceptions/:exceptionId/resolve` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 473 | GET | `/api/v1/admin/vendor/inbound/grn` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 474 | POST | `/api/v1/admin/vendor/inbound/grn` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 475 | GET | `/api/v1/admin/vendor/inbound/grn/:grnId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 476 | PUT | `/api/v1/admin/vendor/inbound/grn/:grnId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 477 | GET | `/api/v1/admin/vendor/inbound/grns` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 478 | POST | `/api/v1/admin/vendor/inbound/grns` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 479 | GET | `/api/v1/admin/vendor/inbound/grns/:grnId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 480 | PUT | `/api/v1/admin/vendor/inbound/grns/:grnId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 481 | POST | `/api/v1/admin/vendor/inbound/grns/:grnId/approve` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 482 | POST | `/api/v1/admin/vendor/inbound/grns/:grnId/archive` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 483 | POST | `/api/v1/admin/vendor/inbound/grns/:grnId/reject` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 484 | PATCH | `/api/v1/admin/vendor/inbound/grns/:grnId/status` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 485 | GET | `/api/v1/admin/vendor/inbound/overview` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 486 | GET | `/api/v1/admin/vendor/inbound/report` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 487 | GET | `/api/v1/admin/vendor/inbound/rtvs` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 488 | POST | `/api/v1/admin/vendor/inbound/rtvs` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 489 | PATCH | `/api/v1/admin/vendor/inbound/rtvs/:rtvId/status` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 490 | GET | `/api/v1/admin/vendor/inbound/shipments` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 491 | POST | `/api/v1/admin/vendor/inbound/shipments` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 492 | PATCH | `/api/v1/admin/vendor/inbound/shipments/:shipmentId/status` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 493 | GET | `/api/v1/admin/vendor/inventory` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 494 | GET | `/api/v1/admin/vendor/inventory/:vendorId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 495 | GET | `/api/v1/admin/vendor/inventory/:vendorId/aging-alerts` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 496 | POST | `/api/v1/admin/vendor/inventory/:vendorId/aging-alerts/:alertId/ack` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 497 | GET | `/api/v1/admin/vendor/inventory/:vendorId/aging-inventory` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 498 | POST | `/api/v1/admin/vendor/inventory/:vendorId/aging-inventory/:itemId/liquidate` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 499 | POST | `/api/v1/admin/vendor/inventory/:vendorId/aging-inventory/:itemId/return` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 500 | GET | `/api/v1/admin/vendor/inventory/:vendorId/kpis` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 501 | POST | `/api/v1/admin/vendor/inventory/:vendorId/reconcile` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 502 | GET | `/api/v1/admin/vendor/inventory/:vendorId/stock` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 503 | GET | `/api/v1/admin/vendor/inventory/:vendorId/stockouts` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 504 | POST | `/api/v1/admin/vendor/inventory/:vendorId/stockouts/alert-all` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 505 | POST | `/api/v1/admin/vendor/inventory/:vendorId/stockouts/bulk-reorder` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 506 | GET | `/api/v1/admin/vendor/inventory/:vendorId/supply-performance` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 507 | POST | `/api/v1/admin/vendor/inventory/:vendorId/sync` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 508 | GET | `/api/v1/admin/vendor/inventory/hub/aging-alerts` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 509 | GET | `/api/v1/admin/vendor/invoices` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 510 | GET | `/api/v1/admin/vendor/invoices/:id` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 511 | POST | `/api/v1/admin/vendor/invoices/:id/approve` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 512 | POST | `/api/v1/admin/vendor/invoices/:id/mark-paid` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 513 | POST | `/api/v1/admin/vendor/invoices/:id/reject` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 514 | GET | `/api/v1/admin/vendor/notifications` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 515 | PATCH | `/api/v1/admin/vendor/notifications/:notifId/read` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 516 | PUT | `/api/v1/admin/vendor/notifications/:notifId/read` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 517 | POST | `/api/v1/admin/vendor/notifications/read-all` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 518 | GET | `/api/v1/admin/vendor/payments` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 519 | POST | `/api/v1/admin/vendor/payments` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 520 | POST | `/api/v1/admin/vendor/payments/:paymentId/cancel` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 521 | POST | `/api/v1/admin/vendor/public/complete-profile` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 522 | POST | `/api/v1/admin/vendor/public/upload-documents/:vendorId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 523 | GET | `/api/v1/admin/vendor/public/verify-token` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | query validation (route alive) |
| 524 | GET | `/api/v1/admin/vendor/purchase-orders` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 525 | POST | `/api/v1/admin/vendor/purchase-orders` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 526 | DELETE | `/api/v1/admin/vendor/purchase-orders/:poId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 527 | GET | `/api/v1/admin/vendor/purchase-orders/:poId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 528 | PATCH | `/api/v1/admin/vendor/purchase-orders/:poId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 529 | PUT | `/api/v1/admin/vendor/purchase-orders/:poId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 530 | POST | `/api/v1/admin/vendor/purchase-orders/:poId/actions` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 531 | POST | `/api/v1/admin/vendor/purchase-orders/:poId/approve` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 532 | GET | `/api/v1/admin/vendor/purchase-orders/:poId/events` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 533 | POST | `/api/v1/admin/vendor/purchase-orders/:poId/reject` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 534 | POST | `/api/v1/admin/vendor/purchase-orders/bulk-upload` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 535 | GET | `/api/v1/admin/vendor/purchase-orders/overview` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 536 | GET | `/api/v1/admin/vendor/qc` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 537 | POST | `/api/v1/admin/vendor/qc` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 538 | GET | `/api/v1/admin/vendor/qc-compliance/audits` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 539 | POST | `/api/v1/admin/vendor/qc-compliance/audits` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 540 | DELETE | `/api/v1/admin/vendor/qc-compliance/audits/:id` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 541 | GET | `/api/v1/admin/vendor/qc-compliance/audits/:id` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 542 | PATCH | `/api/v1/admin/vendor/qc-compliance/audits/:id` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 543 | GET | `/api/v1/admin/vendor/qc-compliance/certificates` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 544 | POST | `/api/v1/admin/vendor/qc-compliance/certificates` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 545 | DELETE | `/api/v1/admin/vendor/qc-compliance/certificates/:certId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 546 | PATCH | `/api/v1/admin/vendor/qc-compliance/certificates/:certId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 547 | GET | `/api/v1/admin/vendor/qc-compliance/ratings` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 548 | DELETE | `/api/v1/admin/vendor/qc-compliance/ratings/:vendorId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 549 | PATCH | `/api/v1/admin/vendor/qc-compliance/ratings/:vendorId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 550 | POST | `/api/v1/admin/vendor/qc-compliance/ratings/:vendorId/recalculate` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 551 | GET | `/api/v1/admin/vendor/qc-compliance/temperature` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 552 | POST | `/api/v1/admin/vendor/qc-compliance/temperature` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 553 | DELETE | `/api/v1/admin/vendor/qc-compliance/temperature/:tempId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 554 | PATCH | `/api/v1/admin/vendor/qc-compliance/temperature/:tempId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 555 | PUT | `/api/v1/admin/vendor/qc/:checkId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 556 | DELETE | `/api/v1/admin/vendor/qc/:qcId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 557 | GET | `/api/v1/admin/vendor/qc/:qcId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 558 | PATCH | `/api/v1/admin/vendor/qc/:qcId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 559 | GET | `/api/v1/admin/vendor/qc/overview` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 560 | GET | `/api/v1/admin/vendor/reports` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 561 | GET | `/api/v1/admin/vendor/reports/customers/insights` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 562 | GET | `/api/v1/admin/vendor/reports/customers/top` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 563 | GET | `/api/v1/admin/vendor/reports/financial/summary` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 564 | GET | `/api/v1/admin/vendor/reports/orders/analytics` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 565 | GET | `/api/v1/admin/vendor/reports/products/performance` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 566 | GET | `/api/v1/admin/vendor/reports/revenue/category` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 567 | GET | `/api/v1/admin/vendor/reports/sales/data` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 568 | GET | `/api/v1/admin/vendor/reports/sales/hourly` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 569 | GET | `/api/v1/admin/vendor/reports/sales/overview` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 570 | GET | `/api/v1/admin/vendor/system-gateway/logs` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 571 | POST | `/api/v1/admin/vendor/system-gateway/logs` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 572 | GET | `/api/v1/admin/vendor/system-gateway/services` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 573 | POST | `/api/v1/admin/vendor/system-gateway/services` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 574 | GET | `/api/v1/admin/vendor/system-gateway/services/:id` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 575 | PUT | `/api/v1/admin/vendor/system-gateway/services/:id` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 576 | GET | `/api/v1/admin/vendor/utilities/audit-logs` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 577 | POST | `/api/v1/admin/vendor/utilities/audit-logs/export` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 578 | POST | `/api/v1/admin/vendor/utilities/bulk-upload` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 579 | GET | `/api/v1/admin/vendor/utilities/bulk-upload/template` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 580 | GET | `/api/v1/admin/vendor/utilities/contracts` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 581 | POST | `/api/v1/admin/vendor/utilities/contracts` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 582 | DELETE | `/api/v1/admin/vendor/utilities/contracts/:contractId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 583 | GET | `/api/v1/admin/vendor/utilities/upload-history` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 584 | GET | `/api/v1/admin/vendor/vendors` | vendor | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 585 | POST | `/api/v1/admin/vendor/vendors` | vendor | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 201 | n/a | USED | mutation accepted |
| 586 | DELETE | `/api/v1/admin/vendor/vendors/:vendorId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 587 | GET | `/api/v1/admin/vendor/vendors/:vendorId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 588 | PATCH | `/api/v1/admin/vendor/vendors/:vendorId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 589 | PUT | `/api/v1/admin/vendor/vendors/:vendorId` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 590 | POST | `/api/v1/admin/vendor/vendors/:vendorId/actions` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 591 | GET | `/api/v1/admin/vendor/vendors/:vendorId/alerts` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 592 | POST | `/api/v1/admin/vendor/vendors/:vendorId/alerts` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 593 | GET | `/api/v1/admin/vendor/vendors/:vendorId/certificates` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 594 | GET | `/api/v1/admin/vendor/vendors/:vendorId/health` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 595 | GET | `/api/v1/admin/vendor/vendors/:vendorId/inventory` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 596 | GET | `/api/v1/admin/vendor/vendors/:vendorId/invoices` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 597 | GET | `/api/v1/admin/vendor/vendors/:vendorId/notifications` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 598 | GET | `/api/v1/admin/vendor/vendors/:vendorId/performance` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 599 | GET | `/api/v1/admin/vendor/vendors/:vendorId/purchase-orders` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 600 | GET | `/api/v1/admin/vendor/vendors/:vendorId/qc-checks` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 601 | POST | `/api/v1/admin/vendor/vendors/:vendorId/qc-checks` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 602 | PATCH | `/api/v1/admin/vendor/vendors/:vendorId/stage` | vendor | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 603 | GET | `/api/v1/admin/vendor/vendors/email-preview/:templateName` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 604 | POST | `/api/v1/admin/vendor/vendors/send-doc-request-email` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 605 | POST | `/api/v1/admin/vendor/vendors/send-invite-email` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 606 | POST | `/api/v1/admin/vendor/vendors/send-payment-email` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 607 | POST | `/api/v1/admin/vendor/vendors/send-rejection-email` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 608 | GET | `/api/v1/admin/vendor/vendors/summary` | vendor | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 609 | POST | `/api/v1/admin/vendor/webhooks/carrier` | vendor | yes | admin-jwt | - | REQUIRED | PASS | 200 | n/a | INTERNAL | mutation accepted |
| 610 | POST | `/api/v1/admin/vendor/webhooks/vendor-signed` | vendor | yes | admin-jwt | - | REQUIRED | PASS | 200 | n/a | INTERNAL | mutation accepted |
| 611 | GET | `/api/v1/admin/warehouses` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 612 | POST | `/api/v1/admin/warehouses` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 613 | DELETE | `/api/v1/admin/warehouses/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | delete handled 404 |
| 614 | GET | `/api/v1/admin/warehouses/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 615 | PUT | `/api/v1/admin/warehouses/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 616 | GET | `/api/v1/admin/zones` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 617 | POST | `/api/v1/admin/zones` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 618 | DELETE | `/api/v1/admin/zones/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | delete handled 404 |
| 619 | GET | `/api/v1/admin/zones/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 620 | PUT | `/api/v1/admin/zones/:id` | admin | yes | admin/super_admin | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 621 | GET | `/api/v1/customer/addresses` | addresses | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 622 | POST | `/api/v1/customer/addresses` | addresses | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 623 | DELETE | `/api/v1/customer/addresses/:id` | addresses | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 404 | n/a | USED | delete handled 404 |
| 624 | PUT | `/api/v1/customer/addresses/:id` | addresses | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 625 | POST | `/api/v1/customer/addresses/:id/default` | addresses | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 626 | GET | `/api/v1/customer/addresses/default` | addresses | yes | customer-jwt | customer-app | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 627 | GET | `/api/v1/customer/admin/app-config` | app-config | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 628 | PUT | `/api/v1/customer/admin/app-config` | app-config | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 629 | GET | `/api/v1/customer/admin/app-config/cancellation-policies` | app-config | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 630 | POST | `/api/v1/customer/admin/app-config/cancellation-policies` | app-config | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 631 | DELETE | `/api/v1/customer/admin/app-config/cancellation-policies/:id` | app-config | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | delete handled 404 |
| 632 | GET | `/api/v1/customer/admin/app-config/cancellation-policies/:id` | app-config | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 633 | PUT | `/api/v1/customer/admin/app-config/cancellation-policies/:id` | app-config | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 634 | POST | `/api/v1/customer/admin/app-config/reset` | app-config | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 635 | PUT | `/api/v1/customer/admin/app-config/section/:section` | app-config | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 636 | GET | `/api/v1/customer/admin/banners` | banners | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 637 | POST | `/api/v1/customer/admin/banners` | banners | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 638 | DELETE | `/api/v1/customer/admin/banners/:id` | banners | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected |
| 639 | PUT | `/api/v1/customer/admin/banners/:id` | banners | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 640 | POST | `/api/v1/customer/admin/banners/reorder` | banners | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 641 | GET | `/api/v1/customer/admin/cancellation-policies` | app-config | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 642 | POST | `/api/v1/customer/admin/cancellation-policies` | app-config | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 643 | DELETE | `/api/v1/customer/admin/cancellation-policies/:id` | app-config | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | delete handled 404 |
| 644 | GET | `/api/v1/customer/admin/cancellation-policies/:id` | app-config | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 645 | PUT | `/api/v1/customer/admin/cancellation-policies/:id` | app-config | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 646 | GET | `/api/v1/customer/admin/categories` | categories | no | - | admin-dashboard | REQUIRED | PASS | 401 | n/a | USED | auth gate |
| 647 | POST | `/api/v1/customer/admin/categories` | categories | no | - | admin-dashboard | REQUIRED | PARTIAL | 401 | n/a | USED | auth rejected with provided token |
| 648 | DELETE | `/api/v1/customer/admin/categories/:id` | categories | no | - | admin-dashboard | REQUIRED | PARTIAL | 401 | n/a | USED | auth rejected |
| 649 | PUT | `/api/v1/customer/admin/categories/:id` | categories | no | - | admin-dashboard | REQUIRED | PARTIAL | 401 | n/a | USED | auth rejected with provided token |
| 650 | GET | `/api/v1/customer/admin/categories/:id/children` | categories | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 651 | GET | `/api/v1/customer/admin/categories/all` | categories | no | - | admin-dashboard | REQUIRED | PASS | 401 | n/a | USED | auth gate |
| 652 | POST | `/api/v1/customer/admin/categories/reorder` | categories | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 653 | GET | `/api/v1/customer/admin/cms/banners` | pages | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 654 | POST | `/api/v1/customer/admin/cms/banners` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 655 | DELETE | `/api/v1/customer/admin/cms/banners/:id` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected |
| 656 | PUT | `/api/v1/customer/admin/cms/banners/:id` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 657 | GET | `/api/v1/customer/admin/cms/buttons` | pages | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 658 | POST | `/api/v1/customer/admin/cms/buttons` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 659 | DELETE | `/api/v1/customer/admin/cms/buttons/:id` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected |
| 660 | PUT | `/api/v1/customer/admin/cms/buttons/:id` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 661 | GET | `/api/v1/customer/admin/cms/collections` | pages | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 662 | POST | `/api/v1/customer/admin/cms/collections` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 663 | DELETE | `/api/v1/customer/admin/cms/collections/:id` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected |
| 664 | PUT | `/api/v1/customer/admin/cms/collections/:id` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 665 | POST | `/api/v1/customer/admin/cms/consolidate-catalog-taxonomy` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 666 | GET | `/api/v1/customer/admin/cms/home-sections` | pages | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 667 | POST | `/api/v1/customer/admin/cms/home-sections` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 668 | DELETE | `/api/v1/customer/admin/cms/home-sections/:id` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected |
| 669 | PUT | `/api/v1/customer/admin/cms/home-sections/:id` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 670 | GET | `/api/v1/customer/admin/cms/import-history/content-hub` | pages | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 671 | GET | `/api/v1/customer/admin/cms/import-jobs/content-hub/:jobId` | pages | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 672 | GET | `/api/v1/customer/admin/cms/media` | pages | no | - | admin-dashboard | REQUIRED | PASS | 401 | n/a | USED | auth gate |
| 673 | POST | `/api/v1/customer/admin/cms/media` | pages | no | - | admin-dashboard | REQUIRED | PARTIAL | 401 | n/a | USED | auth rejected with provided token |
| 674 | DELETE | `/api/v1/customer/admin/cms/media/:id` | pages | no | - | admin-dashboard | REQUIRED | PARTIAL | 401 | n/a | USED | auth rejected |
| 675 | GET | `/api/v1/customer/admin/cms/overview` | pages | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 676 | GET | `/api/v1/customer/admin/cms/pages` | pages | no | - | admin-dashboard | REQUIRED | PASS | 401 | n/a | USED | auth gate |
| 677 | POST | `/api/v1/customer/admin/cms/pages` | pages | no | - | admin-dashboard | REQUIRED | PARTIAL | 401 | n/a | USED | auth rejected with provided token |
| 678 | DELETE | `/api/v1/customer/admin/cms/pages/:id` | pages | no | - | admin-dashboard | REQUIRED | PARTIAL | 401 | n/a | USED | auth rejected |
| 679 | GET | `/api/v1/customer/admin/cms/pages/:id` | pages | no | - | admin-dashboard | REQUIRED | PASS | 401 | n/a | USED | auth gate |
| 680 | PUT | `/api/v1/customer/admin/cms/pages/:id` | pages | no | - | admin-dashboard | REQUIRED | PARTIAL | 401 | n/a | USED | auth rejected with provided token |
| 681 | POST | `/api/v1/customer/admin/cms/upload/cms-pages` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 682 | POST | `/api/v1/customer/admin/cms/upload/content-hub-master` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 683 | POST | `/api/v1/customer/admin/cms/upload/sku-master` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 684 | GET | `/api/v1/customer/admin/collections` | collections | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 685 | POST | `/api/v1/customer/admin/collections` | collections | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 686 | DELETE | `/api/v1/customer/admin/collections/:id` | collections | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected |
| 687 | PUT | `/api/v1/customer/admin/collections/:id` | collections | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 688 | GET | `/api/v1/customer/admin/coupons` | coupons | no | - | admin-dashboard | REQUIRED | PASS | 401 | n/a | USED | auth gate |
| 689 | POST | `/api/v1/customer/admin/coupons` | coupons | no | - | admin-dashboard | REQUIRED | PARTIAL | 401 | n/a | USED | auth rejected with provided token |
| 690 | DELETE | `/api/v1/customer/admin/coupons/:id` | coupons | no | - | admin-dashboard | REQUIRED | PARTIAL | 401 | n/a | USED | auth rejected |
| 691 | GET | `/api/v1/customer/admin/coupons/:id` | coupons | no | - | admin-dashboard | REQUIRED | PASS | 401 | n/a | USED | auth gate |
| 692 | PUT | `/api/v1/customer/admin/coupons/:id` | coupons | no | - | admin-dashboard | REQUIRED | PARTIAL | 401 | n/a | USED | auth rejected with provided token |
| 693 | GET | `/api/v1/customer/admin/coupons/stats` | coupons | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 694 | GET | `/api/v1/customer/admin/faq` | faq | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 695 | POST | `/api/v1/customer/admin/faq` | faq | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 696 | DELETE | `/api/v1/customer/admin/faq/:id` | faq | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected |
| 697 | GET | `/api/v1/customer/admin/faq/:id` | faq | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 698 | PUT | `/api/v1/customer/admin/faq/:id` | faq | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 699 | GET | `/api/v1/customer/admin/faq/categories` | faq | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 700 | GET | `/api/v1/customer/admin/home/attributes` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 701 | POST | `/api/v1/customer/admin/home/attributes` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 702 | DELETE | `/api/v1/customer/admin/home/attributes/:id` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 703 | PUT | `/api/v1/customer/admin/home/attributes/:id` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 704 | GET | `/api/v1/customer/admin/home/banners` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 705 | POST | `/api/v1/customer/admin/home/banners` | home | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 706 | DELETE | `/api/v1/customer/admin/home/banners/:id` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 707 | PUT | `/api/v1/customer/admin/home/banners/:id` | home | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 708 | POST | `/api/v1/customer/admin/home/banners/reorder` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 709 | GET | `/api/v1/customer/admin/home/categories` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 710 | POST | `/api/v1/customer/admin/home/categories` | home | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 711 | DELETE | `/api/v1/customer/admin/home/categories/:id` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 712 | PUT | `/api/v1/customer/admin/home/categories/:id` | home | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 713 | GET | `/api/v1/customer/admin/home/categories/:id/children` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 714 | POST | `/api/v1/customer/admin/home/categories/reorder` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 715 | DELETE | `/api/v1/customer/admin/home/config` | home | yes | admin-jwt | - | OPTIONAL | PARTIAL | 409 | n/a | UNKNOWN | delete http=409 |
| 716 | GET | `/api/v1/customer/admin/home/config` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 717 | POST | `/api/v1/customer/admin/home/config` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 718 | PUT | `/api/v1/customer/admin/home/config` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 719 | GET | `/api/v1/customer/admin/home/config/list` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 720 | POST | `/api/v1/customer/admin/home/config/reset` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 721 | GET | `/api/v1/customer/admin/home/lifestyle` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 722 | POST | `/api/v1/customer/admin/home/lifestyle` | home | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 723 | DELETE | `/api/v1/customer/admin/home/lifestyle/:id` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 724 | PUT | `/api/v1/customer/admin/home/lifestyle/:id` | home | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 725 | POST | `/api/v1/customer/admin/home/lifestyle/reorder` | home | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 726 | GET | `/api/v1/customer/admin/home/preview` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 727 | GET | `/api/v1/customer/admin/home/products` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 728 | POST | `/api/v1/customer/admin/home/products` | home | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 729 | DELETE | `/api/v1/customer/admin/home/products/:id` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 730 | GET | `/api/v1/customer/admin/home/products/:id` | home | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 731 | PUT | `/api/v1/customer/admin/home/products/:id` | home | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 732 | POST | `/api/v1/customer/admin/home/products/:id/publish` | home | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 733 | PATCH | `/api/v1/customer/admin/home/products/:id/status` | home | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 734 | GET | `/api/v1/customer/admin/home/products/:id/variants` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 735 | PATCH | `/api/v1/customer/admin/home/products/bulk` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 736 | PATCH | `/api/v1/customer/admin/home/products/bulk-status` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 737 | GET | `/api/v1/customer/admin/home/promoblocks` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 738 | POST | `/api/v1/customer/admin/home/promoblocks` | home | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 739 | DELETE | `/api/v1/customer/admin/home/promoblocks/:id` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 740 | PUT | `/api/v1/customer/admin/home/promoblocks/:id` | home | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 741 | POST | `/api/v1/customer/admin/home/promoblocks/reorder` | home | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 742 | GET | `/api/v1/customer/admin/home/section-definitions` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 743 | POST | `/api/v1/customer/admin/home/section-definitions` | home | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 744 | DELETE | `/api/v1/customer/admin/home/section-definitions/:id` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 745 | PUT | `/api/v1/customer/admin/home/section-definitions/:id` | home | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 746 | POST | `/api/v1/customer/admin/home/section-definitions/reorder` | home | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 747 | GET | `/api/v1/customer/admin/home/sections` | home | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 748 | POST | `/api/v1/customer/admin/home/sections` | home | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 749 | DELETE | `/api/v1/customer/admin/home/sections/:id` | home | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | n/a | USED | delete handled 200 |
| 750 | PUT | `/api/v1/customer/admin/home/sections/:id` | home | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 751 | PATCH | `/api/v1/customer/admin/home/sections/:id/products` | home | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 752 | POST | `/api/v1/customer/admin/home/sections/reorder` | home | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 400 | n/a | USED | validation rejected (route alive) |
| 753 | POST | `/api/v1/customer/admin/home/upload-product-image` | home | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 754 | GET | `/api/v1/customer/admin/legal/config` | legal | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 755 | PUT | `/api/v1/customer/admin/legal/config` | legal | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 756 | GET | `/api/v1/customer/admin/legal/documents` | legal | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 757 | POST | `/api/v1/customer/admin/legal/documents` | legal | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 758 | DELETE | `/api/v1/customer/admin/legal/documents/:id` | legal | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected |
| 759 | GET | `/api/v1/customer/admin/legal/documents/:id` | legal | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 760 | PUT | `/api/v1/customer/admin/legal/documents/:id` | legal | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 761 | POST | `/api/v1/customer/admin/legal/documents/:id/set-current` | legal | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 762 | PUT | `/api/v1/customer/admin/merch/inventory/:storeId` | store | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 763 | GET | `/api/v1/customer/admin/merch/inventory/:storeId/history` | store | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 764 | POST | `/api/v1/customer/admin/merch/inventory/:storeId/replenish` | store | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 765 | POST | `/api/v1/customer/admin/merch/inventory/:storeId/sync` | store | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 766 | GET | `/api/v1/customer/admin/merch/stores` | store | no | - | admin-dashboard | REQUIRED | PASS | 401 | n/a | USED | auth gate |
| 767 | POST | `/api/v1/customer/admin/merch/stores` | store | no | - | admin-dashboard | REQUIRED | PARTIAL | 401 | n/a | USED | auth rejected with provided token |
| 768 | DELETE | `/api/v1/customer/admin/merch/stores/:id` | store | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected |
| 769 | PUT | `/api/v1/customer/admin/merch/stores/:id` | store | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 770 | GET | `/api/v1/customer/admin/notifications` | notifications | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 771 | DELETE | `/api/v1/customer/admin/notifications/:id` | notifications | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected |
| 772 | POST | `/api/v1/customer/admin/notifications/send` | notifications | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 773 | GET | `/api/v1/customer/admin/notifications/stats` | notifications | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 774 | GET | `/api/v1/customer/admin/onboarding-pages` | onboarding | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 775 | POST | `/api/v1/customer/admin/onboarding-pages` | onboarding | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 776 | DELETE | `/api/v1/customer/admin/onboarding-pages/:id` | onboarding | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected |
| 777 | PUT | `/api/v1/customer/admin/onboarding-pages/:id` | onboarding | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 778 | POST | `/api/v1/customer/admin/onboarding-pages/:id/image` | onboarding | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 779 | PUT | `/api/v1/customer/admin/onboarding-pages/reorder` | onboarding | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 780 | GET | `/api/v1/customer/admin/pages` | pages | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 781 | POST | `/api/v1/customer/admin/pages` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 782 | DELETE | `/api/v1/customer/admin/pages/:id` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected |
| 783 | GET | `/api/v1/customer/admin/pages/:id` | pages | no | - | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate |
| 784 | PUT | `/api/v1/customer/admin/pages/:id` | pages | no | - | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 785 | GET | `/api/v1/customer/app-config` | app-config | no | - | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 786 | POST | `/api/v1/customer/auth/link-phone/send-otp` | auth | yes | customer-jwt | customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 787 | POST | `/api/v1/customer/auth/link-phone/verify-otp` | auth | yes | customer-jwt | customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 788 | POST | `/api/v1/customer/auth/logout` | auth | no | - | customer-app,customer-web | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 789 | POST | `/api/v1/customer/auth/resend-otp` | auth | no | - | customer-app,customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 790 | POST | `/api/v1/customer/auth/send-otp` | auth | no | - | customer-app,customer-web | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 791 | POST | `/api/v1/customer/auth/verify-otp` | auth | no | - | customer-app,customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 792 | GET | `/api/v1/customer/banners/:id` | banners | no | - | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 793 | GET | `/api/v1/customer/bootstrap` | bootstrap | no | - | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 794 | GET | `/api/v1/customer/cart` | cart | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 795 | DELETE | `/api/v1/customer/cart/clear` | cart | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | n/a | USED | delete handled 200 |
| 796 | POST | `/api/v1/customer/cart/items` | cart | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 797 | PUT | `/api/v1/customer/cart/items` | cart | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 798 | DELETE | `/api/v1/customer/cart/items/:itemId` | cart | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | n/a | USED | delete handled 200 |
| 799 | PUT | `/api/v1/customer/cart/items/:itemId` | cart | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 800 | POST | `/api/v1/customer/cart/merge` | cart | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 801 | GET | `/api/v1/customer/categories` | categories | no | - | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 802 | GET | `/api/v1/customer/categories/:id` | categories | no | - | customer-app,customer-web | REQUIRED | PASS | 404 | n/a | USED | not found for placeholder id (route mounted) |
| 803 | GET | `/api/v1/customer/categories/:slug/products` | categories | no | - | customer-app,customer-web | REQUIRED | PASS | 404 | n/a | USED | not found for placeholder id (route mounted) |
| 804 | GET | `/api/v1/customer/categories/:slug/subcategories` | categories | no | - | customer-app | REQUIRED | PASS | 404 | n/a | USED | not found for placeholder id (route mounted) |
| 805 | GET | `/api/v1/customer/collections/:slug` | collections | no | - | customer-app,customer-web | REQUIRED | PASS | 404 | n/a | USED | not found for placeholder id (route mounted) |
| 806 | GET | `/api/v1/customer/coupons` | coupons | no | - | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 807 | POST | `/api/v1/customer/coupons/redeem` | coupons | yes | customer-jwt | customer-app | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 808 | POST | `/api/v1/customer/coupons/validate` | coupons | no | - | customer-app,customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 809 | GET | `/api/v1/customer/delivery/estimate` | delivery | no | - | customer-app,customer-web | REQUIRED | PASS | 400 | n/a | USED | query validation (route alive) |
| 810 | GET | `/api/v1/customer/delivery/fee` | delivery | no | - | customer-app,customer-web | REQUIRED | PASS | 400 | n/a | USED | query validation (route alive) |
| 811 | GET | `/api/v1/customer/faq` | faq | no | - | customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 812 | POST | `/api/v1/customer/faq/:id/feedback` | faq | yes | customer-jwt | customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 813 | GET | `/api/v1/customer/faq/categories` | faq | no | - | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 814 | GET | `/api/v1/customer/home` | home | no | - | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 815 | POST | `/api/v1/customer/legal/accept` | legal | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 816 | GET | `/api/v1/customer/legal/config` | legal | no | - | customer-app | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 817 | GET | `/api/v1/customer/legal/license` | legal | no | - | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 818 | GET | `/api/v1/customer/legal/privacy` | legal | no | - | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 819 | GET | `/api/v1/customer/legal/terms` | legal | no | - | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 820 | GET | `/api/v1/customer/locations/approximate` | locations | no | - | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 821 | GET | `/api/v1/customer/locations/suggestions` | locations | no | - | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 822 | GET | `/api/v1/customer/notifications` | notifications | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 823 | DELETE | `/api/v1/customer/notifications/:id` | notifications | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 404 | n/a | USED | delete handled 404 |
| 824 | PUT | `/api/v1/customer/notifications/:id/read` | notifications | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 825 | PUT | `/api/v1/customer/notifications/:id/unread` | notifications | yes | customer-jwt | customer-web | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 826 | GET | `/api/v1/customer/notifications/preferences` | notifications | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 827 | PUT | `/api/v1/customer/notifications/preferences` | notifications | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 400 | n/a | USED | validation rejected (route alive) |
| 828 | PUT | `/api/v1/customer/notifications/read-all` | notifications | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 829 | POST | `/api/v1/customer/notifications/register-token` | notifications | yes | customer-jwt | customer-app | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 830 | POST | `/api/v1/customer/notifications/register-web-push` | notifications | yes | customer-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 831 | POST | `/api/v1/customer/notifications/remove-all-tokens` | notifications | yes | customer-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 832 | POST | `/api/v1/customer/notifications/remove-token` | notifications | yes | customer-jwt | customer-app | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 833 | GET | `/api/v1/customer/notifications/unread-count` | notifications | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 834 | GET | `/api/v1/customer/notifications/vapid-public-key` | notifications | no | - | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 835 | POST | `/api/v1/customer/onboarding/complete` | onboarding | no | - | customer-web | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 836 | GET | `/api/v1/customer/onboarding/pages` | onboarding | no | - | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 837 | GET | `/api/v1/customer/onboarding/pages/:pageNumber` | onboarding | no | - | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | query validation (route alive) |
| 838 | GET | `/api/v1/customer/onboarding/status` | onboarding | no | - | customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 839 | GET | `/api/v1/customer/orders` | orders | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 840 | POST | `/api/v1/customer/orders` | orders | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 841 | GET | `/api/v1/customer/orders/:id` | orders | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 842 | GET | `/api/v1/customer/orders/:id/can-cancel` | orders | yes | customer-jwt | customer-app | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 843 | POST | `/api/v1/customer/orders/:id/cancel` | orders | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 844 | GET | `/api/v1/customer/orders/:id/invoice` | invoice | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 845 | POST | `/api/v1/customer/orders/:id/rate` | orders | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 846 | POST | `/api/v1/customer/orders/:id/reorder` | orders | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 847 | GET | `/api/v1/customer/orders/:id/status` | orders | yes | customer-jwt | customer-app | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 848 | GET | `/api/v1/customer/orders/:id/tracking` | orders | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 849 | PUT | `/api/v1/customer/orders/:id/update-status` | orders | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 850 | POST | `/api/v1/customer/orders/:id/verify-otp` | orders | yes | customer-jwt | customer-app | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 851 | GET | `/api/v1/customer/orders/active` | orders | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 852 | GET | `/api/v1/customer/pages/:slug` | pages | no | - | customer-web | REQUIRED | PASS | 404 | n/a | USED | not found for placeholder id (route mounted) |
| 853 | GET | `/api/v1/customer/payments/methods` | payments | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 854 | POST | `/api/v1/customer/payments/methods` | payments | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 201 | n/a | USED | mutation accepted |
| 855 | DELETE | `/api/v1/customer/payments/methods/:id` | payments | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 404 | n/a | USED | delete handled 404 |
| 856 | PUT | `/api/v1/customer/payments/methods/:id` | payments | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 857 | POST | `/api/v1/customer/payments/methods/:id/default` | payments | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 858 | POST | `/api/v1/customer/payments/worldline/abort` | payments | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 859 | POST | `/api/v1/customer/payments/worldline/complete` | payments | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 860 | POST | `/api/v1/customer/payments/worldline/session` | payments | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 861 | GET | `/api/v1/customer/payments/worldline/status` | payments | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 400 | n/a | USED | query validation (route alive) |
| 862 | GET | `/api/v1/customer/products/:id` | products | no | - | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 863 | GET | `/api/v1/customer/products/search` | products | no | - | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 864 | GET | `/api/v1/customer/products/search/suggestions` | products | no | - | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 865 | GET | `/api/v1/customer/products/search/trending` | products | no | - | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 866 | GET | `/api/v1/customer/refunds` | refunds | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 867 | GET | `/api/v1/customer/refunds/:id` | refunds | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 404 | n/a | USED | not found for placeholder id (route mounted) |
| 868 | GET | `/api/v1/customer/refunds/:id/details` | refunds | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 404 | n/a | USED | not found for placeholder id (route mounted) |
| 869 | POST | `/api/v1/customer/refunds/request` | refunds | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 870 | GET | `/api/v1/customer/search` | products | no | - | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 871 | GET | `/api/v1/customer/search/suggestions` | products | no | - | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 872 | GET | `/api/v1/customer/search/trending` | products | no | - | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 873 | GET | `/api/v1/customer/sections/:key/products` | home | no | - | customer-app,customer-web | REQUIRED | PASS | 404 | n/a | USED | not found for placeholder id (route mounted) |
| 874 | GET | `/api/v1/customer/store/:storeId/inventory` | store | no | - | customer-app,customer-web | REQUIRED | PASS | 400 | n/a | USED | query validation (route alive) |
| 875 | POST | `/api/v1/customer/store/assign` | store | no | - | customer-app,customer-web | REQUIRED | PASS | 400 | n/a | USED | validation rejected (route alive) |
| 876 | GET | `/api/v1/customer/support/tickets` | support | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 877 | POST | `/api/v1/customer/support/tickets` | support | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 400 | n/a | USED | validation rejected (route alive) |
| 878 | GET | `/api/v1/customer/support/tickets/:ticketId/messages` | support | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 404 | n/a | USED | not found for placeholder id (route mounted) |
| 879 | POST | `/api/v1/customer/support/tickets/:ticketId/reopen` | support | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 880 | GET | `/api/v1/customer/support/tickets/active` | support | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | n/a | USED | ok |
| 881 | PUT | `/api/v1/customer/user/change-password` | user | yes | customer-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 882 | POST | `/api/v1/customer/user/phone/resend-otp` | user | yes | customer-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 883 | POST | `/api/v1/customer/user/phone/send-otp` | user | yes | customer-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 884 | POST | `/api/v1/customer/user/phone/verify-otp` | user | yes | customer-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 885 | GET | `/api/v1/customer/user/profile` | user | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 886 | PUT | `/api/v1/customer/user/profile` | user | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 887 | POST | `/api/v1/customer/user/profile/avatar` | user | yes | customer-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 888 | GET | `/api/v1/customer/wallet/balance` | wallet | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 889 | POST | `/api/v1/customer/wallet/credit` | wallet | yes | customer-jwt | - | OPTIONAL | PARTIAL | 403 | n/a | UNKNOWN | auth rejected with provided token |
| 890 | POST | `/api/v1/customer/wallet/debit` | wallet | yes | customer-jwt | customer-app | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 891 | POST | `/api/v1/customer/wallet/top-up/session` | wallet | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 892 | GET | `/api/v1/customer/wallet/transactions` | wallet | yes | customer-jwt | customer-app,customer-web | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 893 | GET | `/api/v1/darkstore/alerts` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 894 | GET | `/api/v1/darkstore/alerts/:alertId` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 895 | POST | `/api/v1/darkstore/alerts/:alertId/action` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 896 | GET | `/api/v1/darkstore/alerts/debug/ids` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 897 | DELETE | `/api/v1/darkstore/alerts/resolved` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 898 | POST | `/api/v1/darkstore/alerts/resolved/clear` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 899 | POST | `/api/v1/darkstore/analytics/export` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 900 | GET | `/api/v1/darkstore/analytics/fleet-utilization` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 901 | GET | `/api/v1/darkstore/analytics/rider-performance` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 902 | GET | `/api/v1/darkstore/analytics/sla-adherence` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 903 | GET | `/api/v1/darkstore/dashboard/alert-history` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 904 | GET | `/api/v1/darkstore/dashboard/live-orders` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 905 | GET | `/api/v1/darkstore/dashboard/refresh` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | ok |
| 906 | POST | `/api/v1/darkstore/dashboard/refresh` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 907 | GET | `/api/v1/darkstore/dashboard/rto-alerts` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 908 | GET | `/api/v1/darkstore/dashboard/staff-load` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 909 | GET | `/api/v1/darkstore/dashboard/stock-alerts` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 910 | GET | `/api/v1/darkstore/dashboard/store-profile` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 911 | GET | `/api/v1/darkstore/dashboard/summary` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 912 | GET | `/api/v1/darkstore/dashboard/warehouse-profile` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 913 | GET | `/api/v1/darkstore/health/checklists` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 914 | PUT | `/api/v1/darkstore/health/checklists/:checklistId/items/:itemId` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 915 | POST | `/api/v1/darkstore/health/checklists/:checklistId/submit` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 916 | GET | `/api/v1/darkstore/health/equipment` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 917 | GET | `/api/v1/darkstore/health/incidents` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 918 | POST | `/api/v1/darkstore/health/incidents` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 919 | PUT | `/api/v1/darkstore/health/incidents/:incidentId/resolve` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 920 | GET | `/api/v1/darkstore/health/summary` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 921 | GET | `/api/v1/darkstore/hsd/devices/:deviceId/actions` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 922 | POST | `/api/v1/darkstore/hsd/devices/:deviceId/assign` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 923 | POST | `/api/v1/darkstore/hsd/devices/:deviceId/control` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 924 | GET | `/api/v1/darkstore/hsd/devices/:deviceId/history` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 925 | POST | `/api/v1/darkstore/hsd/devices/:deviceId/unassign` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 926 | POST | `/api/v1/darkstore/hsd/devices/bulk-reset` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 927 | POST | `/api/v1/darkstore/hsd/devices/register` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 928 | GET | `/api/v1/darkstore/hsd/fleet` | darkstore | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 929 | GET | `/api/v1/darkstore/hsd/issues` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 930 | POST | `/api/v1/darkstore/hsd/issues/report` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 931 | GET | `/api/v1/darkstore/hsd/logs` | darkstore | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 932 | GET | `/api/v1/darkstore/hsd/picker-users` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 933 | POST | `/api/v1/darkstore/hsd/requisitions` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 934 | POST | `/api/v1/darkstore/hsd/sessions/:deviceId/action` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 935 | GET | `/api/v1/darkstore/hsd/sessions/live` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 936 | GET | `/api/v1/darkstore/hsd/users` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 937 | GET | `/api/v1/darkstore/hsd/users/:userId/device-request-otp` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 938 | POST | `/api/v1/darkstore/hsd/users/:userId/generate-device-otp` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 939 | GET | `/api/v1/darkstore/inbound/grn` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 940 | GET | `/api/v1/darkstore/inbound/grn/:grnId` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 941 | POST | `/api/v1/darkstore/inbound/grn/:grnId/complete` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 942 | PUT | `/api/v1/darkstore/inbound/grn/:grnId/items/:sku` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 943 | POST | `/api/v1/darkstore/inbound/grn/:grnId/start` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 944 | GET | `/api/v1/darkstore/inbound/putaway` | darkstore | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 945 | POST | `/api/v1/darkstore/inbound/putaway/:taskId/assign` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 946 | POST | `/api/v1/darkstore/inbound/putaway/:taskId/complete` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 947 | GET | `/api/v1/darkstore/inbound/summary` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 948 | GET | `/api/v1/darkstore/inbound/transfers` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 949 | GET | `/api/v1/darkstore/inbound/transfers/:transferId` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 950 | POST | `/api/v1/darkstore/inbound/transfers/:transferId/receive` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 951 | POST | `/api/v1/darkstore/inbound/transfers/sync` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 952 | GET | `/api/v1/darkstore/inventory/adjustments` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 953 | POST | `/api/v1/darkstore/inventory/adjustments` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 954 | GET | `/api/v1/darkstore/inventory/audit-log` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 955 | POST | `/api/v1/darkstore/inventory/bulk-import` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 202 | n/a | UNKNOWN | mutation accepted |
| 956 | GET | `/api/v1/darkstore/inventory/cycle-count` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 957 | GET | `/api/v1/darkstore/inventory/cycle-count/report` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 958 | GET | `/api/v1/darkstore/inventory/import-template` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 959 | PUT | `/api/v1/darkstore/inventory/items/:sku` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 960 | GET | `/api/v1/darkstore/inventory/product-location/:sku` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 961 | GET | `/api/v1/darkstore/inventory/restock` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 962 | POST | `/api/v1/darkstore/inventory/restock` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 963 | POST | `/api/v1/darkstore/inventory/restock-task` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 409 | n/a | UNKNOWN | expected conflict/rate 409 |
| 964 | POST | `/api/v1/darkstore/inventory/scan` | darkstore | yes | admin-jwt | - | OPTIONAL | PARTIAL | 404 | n/a | UNKNOWN | mutation http=404 |
| 965 | GET | `/api/v1/darkstore/inventory/shelf-view` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 966 | GET | `/api/v1/darkstore/inventory/shelves` | darkstore | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 967 | POST | `/api/v1/darkstore/inventory/shelves` | darkstore | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 968 | DELETE | `/api/v1/darkstore/inventory/shelves/:shelfId` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 969 | PUT | `/api/v1/darkstore/inventory/shelves/:shelfId` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 970 | GET | `/api/v1/darkstore/inventory/stock-levels` | darkstore | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 971 | DELETE | `/api/v1/darkstore/inventory/stock-levels/:sku` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 972 | PUT | `/api/v1/darkstore/inventory/stock-levels/:sku` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 973 | PUT | `/api/v1/darkstore/inventory/stock-levels/:sku/status` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 974 | GET | `/api/v1/darkstore/issues` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 975 | GET | `/api/v1/darkstore/issues/:id` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 976 | PATCH | `/api/v1/darkstore/issues/:id` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 977 | GET | `/api/v1/darkstore/issues/ops-users` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 978 | POST | `/api/v1/darkstore/logistics/estimate` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 979 | GET | `/api/v1/darkstore/logistics/orders` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 980 | POST | `/api/v1/darkstore/logistics/orders` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 981 | GET | `/api/v1/darkstore/logistics/orders/:id` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 982 | POST | `/api/v1/darkstore/logistics/orders/:id/cancel` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 983 | GET | `/api/v1/darkstore/logistics/orders/:id/tracking` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 984 | GET | `/api/v1/darkstore/operations/activity-feed` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 985 | GET | `/api/v1/darkstore/operations/alerts` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 986 | GET | `/api/v1/darkstore/operations/escalation-suggestions` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 987 | GET | `/api/v1/darkstore/operations/exception-queue` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 988 | GET | `/api/v1/darkstore/operations/live-picking` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 989 | GET | `/api/v1/darkstore/operations/missing-items` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 990 | GET | `/api/v1/darkstore/operations/order-workflow/:orderId` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 991 | GET | `/api/v1/darkstore/operations/pipeline` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 992 | GET | `/api/v1/darkstore/operations/regional-pipeline` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 993 | GET | `/api/v1/darkstore/operations/sla-monitor` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 994 | GET | `/api/v1/darkstore/operations/workflow-sla-metrics` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 995 | GET | `/api/v1/darkstore/orders` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 996 | GET | `/api/v1/darkstore/orders/:orderId` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 997 | PATCH | `/api/v1/darkstore/orders/:orderId` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 998 | GET | `/api/v1/darkstore/orders/:orderId/action-logs` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 999 | PATCH | `/api/v1/darkstore/orders/:orderId/assign` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1000 | PATCH | `/api/v1/darkstore/orders/:orderId/bag-rack` | darkstore | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 1001 | GET | `/api/v1/darkstore/orders/:orderId/call-customer` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1002 | POST | `/api/v1/darkstore/orders/:orderId/call-customer` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1003 | POST | `/api/v1/darkstore/orders/:orderId/cancel` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1004 | PATCH | `/api/v1/darkstore/orders/:orderId/complete-picking` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1005 | GET | `/api/v1/darkstore/orders/:orderId/mark-rto` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1006 | POST | `/api/v1/darkstore/orders/:orderId/mark-rto` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1007 | PATCH | `/api/v1/darkstore/orders/:orderId/start-picking` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1008 | GET | `/api/v1/darkstore/outbound/dispatch` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1009 | POST | `/api/v1/darkstore/outbound/dispatch/assign` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1010 | POST | `/api/v1/darkstore/outbound/dispatch/batch` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 1011 | GET | `/api/v1/darkstore/outbound/ready-orders` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1012 | GET | `/api/v1/darkstore/outbound/riders` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1013 | GET | `/api/v1/darkstore/outbound/summary` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1014 | GET | `/api/v1/darkstore/outbound/transfers` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1015 | POST | `/api/v1/darkstore/outbound/transfers/:requestId/approve` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1016 | GET | `/api/v1/darkstore/outbound/transfers/:requestId/fulfillment` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1017 | POST | `/api/v1/darkstore/outbound/transfers/:requestId/reject` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1018 | GET | `/api/v1/darkstore/outbound/transfers/sla-summary` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1019 | GET | `/api/v1/darkstore/packing/orders/:orderId` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | ok |
| 1020 | POST | `/api/v1/darkstore/packing/orders/:orderId/complete` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1021 | POST | `/api/v1/darkstore/packing/orders/:orderId/report-damaged` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 1022 | POST | `/api/v1/darkstore/packing/orders/:orderId/report-missing` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 1023 | POST | `/api/v1/darkstore/packing/orders/:orderId/scan` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1024 | GET | `/api/v1/darkstore/packing/queue` | darkstore | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1025 | GET | `/api/v1/darkstore/pick-ops` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1026 | GET | `/api/v1/darkstore/pickers` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1027 | GET | `/api/v1/darkstore/pickers/:id/performance` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1028 | GET | `/api/v1/darkstore/pickers/available` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1029 | GET | `/api/v1/darkstore/pickers/live` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1030 | GET | `/api/v1/darkstore/pickers/performance/summary` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1031 | GET | `/api/v1/darkstore/pickers/registry` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1032 | GET | `/api/v1/darkstore/picklists` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1033 | POST | `/api/v1/darkstore/picklists` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1034 | GET | `/api/v1/darkstore/picklists/:picklistId` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1035 | POST | `/api/v1/darkstore/picklists/:picklistId/assign` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1036 | POST | `/api/v1/darkstore/picklists/:picklistId/complete` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1037 | POST | `/api/v1/darkstore/picklists/:picklistId/move-to-packing` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1038 | POST | `/api/v1/darkstore/picklists/:picklistId/pause` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1039 | POST | `/api/v1/darkstore/picklists/:picklistId/progress` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1040 | POST | `/api/v1/darkstore/picklists/:picklistId/start` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1041 | GET | `/api/v1/darkstore/qc/checks` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1042 | PUT | `/api/v1/darkstore/qc/checks/:itemId` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1043 | GET | `/api/v1/darkstore/qc/compliance/audit-status` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1044 | GET | `/api/v1/darkstore/qc/compliance/logs` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1045 | POST | `/api/v1/darkstore/qc/compliance/logs` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 1046 | GET | `/api/v1/darkstore/qc/docs` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1047 | GET | `/api/v1/darkstore/qc/failures` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1048 | POST | `/api/v1/darkstore/qc/failures/:failureId/resolve` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1049 | GET | `/api/v1/darkstore/qc/history` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1050 | GET | `/api/v1/darkstore/qc/inspections` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1051 | POST | `/api/v1/darkstore/qc/inspections` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1052 | GET | `/api/v1/darkstore/qc/recent-failures` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1053 | GET | `/api/v1/darkstore/qc/rejections` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1054 | POST | `/api/v1/darkstore/qc/rejections` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 1055 | GET | `/api/v1/darkstore/qc/samples` | darkstore | yes | admin-jwt | - | LEGACY | PASS | 200 | read-ok | LEGACY | ok |
| 1056 | POST | `/api/v1/darkstore/qc/samples` | darkstore | yes | admin-jwt | - | LEGACY | PASS | 201 | n/a | LEGACY | mutation accepted |
| 1057 | PUT | `/api/v1/darkstore/qc/samples/:sampleId` | darkstore | yes | admin-jwt | - | LEGACY | PASS | 200 | n/a | LEGACY | mutation accepted |
| 1058 | GET | `/api/v1/darkstore/qc/summary` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1059 | GET | `/api/v1/darkstore/qc/temperature` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1060 | POST | `/api/v1/darkstore/qc/temperature` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 1061 | GET | `/api/v1/darkstore/qc/watchlist` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1062 | POST | `/api/v1/darkstore/qc/watchlist` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 1063 | POST | `/api/v1/darkstore/qc/watchlist/:sku/log-check` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 1064 | GET | `/api/v1/darkstore/reports/compliance` | darkstore | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1065 | GET | `/api/v1/darkstore/reports/export` | darkstore | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1066 | GET | `/api/v1/darkstore/reports/inventory` | darkstore | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1067 | GET | `/api/v1/darkstore/reports/staff` | darkstore | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1068 | GET | `/api/v1/darkstore/settings` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1069 | PUT | `/api/v1/darkstore/settings` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1070 | GET | `/api/v1/darkstore/staff/absences` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1071 | POST | `/api/v1/darkstore/staff/absences` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 1072 | GET | `/api/v1/darkstore/staff/performance` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1073 | GET | `/api/v1/darkstore/staff/performance/download` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1074 | GET | `/api/v1/darkstore/staff/roster` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1075 | GET | `/api/v1/darkstore/staff/shift-coverage` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1076 | POST | `/api/v1/darkstore/staff/shifts/auto-assign-ot` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1077 | GET | `/api/v1/darkstore/staff/summary` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1078 | GET | `/api/v1/darkstore/staff/weekly-roster` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | ok |
| 1079 | POST | `/api/v1/darkstore/staff/weekly-roster/publish` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1080 | GET | `/api/v1/darkstore/utilities/audit-logs` | darkstore | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1081 | POST | `/api/v1/darkstore/utilities/audit-logs/export` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1082 | POST | `/api/v1/darkstore/utilities/inventory/bulk-upload` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 202 | n/a | UNKNOWN | mutation accepted |
| 1083 | GET | `/api/v1/darkstore/utilities/inventory/upload-template` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1084 | POST | `/api/v1/darkstore/utilities/labels/generate` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 1085 | POST | `/api/v1/darkstore/utilities/system/diagnostics` | darkstore | yes | admin-jwt | - | INTERNAL | PASS | 200 | n/a | INTERNAL | mutation accepted |
| 1086 | GET | `/api/v1/darkstore/utilities/system/status` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1087 | POST | `/api/v1/darkstore/utilities/system/sync` | darkstore | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1088 | GET | `/api/v1/diag/hubs` | diag-hubs.ts | no | - | - | INTERNAL | PASS | 200 | read-ok | INTERNAL | ok |
| 1089 | POST | `/api/v1/diag/normalize-rider-hub` | diag-hubs.ts | no | - | - | INTERNAL | PASS | 400 | n/a | INTERNAL | validation rejected (route alive) |
| 1090 | GET | `/api/v1/diag/order-flow` | diag-order-flow.ts | no | - | - | INTERNAL | PASS | 200 | read-ok | INTERNAL | ok |
| 1091 | GET | `/api/v1/diag/resolve-hub` | diag-hubs.ts | no | - | - | INTERNAL | PASS | 200 | read-ok | INTERNAL | ok |
| 1092 | PUT | `/api/v1/hhd/admin/picker-users/:pickerUserId/link` | hhd | partial | ADMIN;hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1093 | POST | `/api/v1/hhd/auth/logout` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1094 | GET | `/api/v1/hhd/auth/me` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1095 | POST | `/api/v1/hhd/auth/refresh` | hhd | no | - | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1096 | POST | `/api/v1/hhd/auth/resend-otp` | hhd | no | - | hhd-app | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 1097 | POST | `/api/v1/hhd/auth/send-otp` | hhd | no | - | hhd-app | REQUIRED | PASS | 429 | n/a | USED | expected conflict/rate 429 |
| 1098 | POST | `/api/v1/hhd/auth/verify-otp` | hhd | no | - | hhd-app | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 1099 | GET | `/api/v1/hhd/bags/:bagId` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1100 | PUT | `/api/v1/hhd/bags/:bagId` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1101 | POST | `/api/v1/hhd/bags/scan` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1102 | GET | `/api/v1/hhd/dashboard` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1103 | GET | `/api/v1/hhd/devices/current` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1104 | PUT | `/api/v1/hhd/items/:itemId` | hhd | yes | hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1105 | PUT | `/api/v1/hhd/items/:itemId/not-found` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1106 | GET | `/api/v1/hhd/items/order/:orderId` | hhd | yes | hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1107 | POST | `/api/v1/hhd/items/scan` | hhd | yes | hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1108 | GET | `/api/v1/hhd/items/substitutes` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1109 | GET | `/api/v1/hhd/orders` | hhd | yes | hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1110 | POST | `/api/v1/hhd/orders` | hhd | yes | hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1111 | GET | `/api/v1/hhd/orders/:orderId` | hhd | yes | hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1112 | PUT | `/api/v1/hhd/orders/:orderId/accept` | hhd | yes | hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1113 | GET | `/api/v1/hhd/orders/:orderId/summary` | hhd | yes | hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1114 | GET | `/api/v1/hhd/orders/assignorders/status/:status` | hhd | yes | hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1115 | GET | `/api/v1/hhd/orders/available` | hhd | yes | hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1116 | GET | `/api/v1/hhd/orders/completed` | hhd | yes | hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1117 | GET | `/api/v1/hhd/orders/current` | hhd | yes | hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1118 | POST | `/api/v1/hhd/photos` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1119 | PUT | `/api/v1/hhd/photos/:photoId/verify` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1120 | GET | `/api/v1/hhd/photos/order/:orderId/bag/:bagId` | hhd | yes | hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1121 | POST | `/api/v1/hhd/pick/report-issue` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1122 | GET | `/api/v1/hhd/racks/:rackCode` | hhd | yes | hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1123 | GET | `/api/v1/hhd/racks/available` | hhd | yes | hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1124 | POST | `/api/v1/hhd/racks/scan` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1125 | GET | `/api/v1/hhd/scanned-items/:id` | hhd | yes | hhd-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1126 | GET | `/api/v1/hhd/tasks` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1127 | PUT | `/api/v1/hhd/tasks/:taskId` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1128 | GET | `/api/v1/hhd/users/contract` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1129 | GET | `/api/v1/hhd/users/employment` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1130 | POST | `/api/v1/hhd/users/heartbeat` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1131 | GET | `/api/v1/hhd/users/linked-picker-profile` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1132 | GET | `/api/v1/hhd/users/profile` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1133 | PUT | `/api/v1/hhd/users/profile` | hhd | yes | hhd-jwt | hhd-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (hhd OTP/SMS required) |
| 1134 | GET | `/api/v1/logistics/health` | logistics | no | - | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | ok |
| 1135 | POST | `/api/v1/logistics/webhooks/porter` | logistics | no | - | - | REQUIRED | PASS | 200 | n/a | INTERNAL | mutation accepted |
| 1136 | GET | `/api/v1/merch/health` | merch | yes | hhd-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | ok |
| 1137 | POST | `/api/v1/picker/account/delete-request` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1138 | POST | `/api/v1/picker/approval/verify-location-otp` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1139 | GET | `/api/v1/picker/attendance` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1140 | POST | `/api/v1/picker/attendance/punch-in` | picker | partial | picker-jwt;active-picker | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1141 | POST | `/api/v1/picker/attendance/punch-out` | picker | partial | picker-jwt;active-picker | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1142 | GET | `/api/v1/picker/attendance/stats` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1143 | GET | `/api/v1/picker/attendance/summary` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1144 | POST | `/api/v1/picker/auth/logout` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1145 | POST | `/api/v1/picker/auth/refresh` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1146 | POST | `/api/v1/picker/auth/resend-otp` | picker | no | - | picker-app,rider-app | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 1147 | POST | `/api/v1/picker/auth/resend-otp-email` | picker | no | - | picker-app,rider-app | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 1148 | POST | `/api/v1/picker/auth/send-otp` | picker | no | - | picker-app,rider-app | REQUIRED | PASS | 200 | n/a | USED | mutation accepted |
| 1149 | POST | `/api/v1/picker/auth/send-otp-email` | picker | no | - | picker-app,rider-app | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 1150 | POST | `/api/v1/picker/auth/verify-otp` | picker | no | - | picker-app | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 1151 | POST | `/api/v1/picker/auth/verify-otp-email` | picker | no | - | picker-app | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 1152 | GET | `/api/v1/picker/bank-accounts` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1153 | POST | `/api/v1/picker/bank-accounts` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1154 | GET | `/api/v1/picker/bank/accounts` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1155 | POST | `/api/v1/picker/bank/accounts` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1156 | PUT | `/api/v1/picker/bank/accounts/:accountId` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1157 | POST | `/api/v1/picker/bank/accounts/:accountId/delete` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1158 | PUT | `/api/v1/picker/bank/accounts/:accountId/set-default` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1159 | POST | `/api/v1/picker/bank/verify` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1160 | POST | `/api/v1/picker/bulk/bag/load` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1161 | GET | `/api/v1/picker/bulk/batch` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1162 | GET | `/api/v1/picker/bulk/batches` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1163 | GET | `/api/v1/picker/bulk/batches/:batchId` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1164 | POST | `/api/v1/picker/bulk/start` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1165 | POST | `/api/v1/picker/bulk/stops/:stopId/arrive` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1166 | POST | `/api/v1/picker/bulk/stops/:stopId/deliver` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1167 | POST | `/api/v1/picker/bulk/stops/:stopId/fail` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1168 | POST | `/api/v1/picker/bulk/stops/:stopId/proof-photo` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1169 | POST | `/api/v1/picker/cash/deposits` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1170 | GET | `/api/v1/picker/cash/summary` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1171 | GET | `/api/v1/picker/cash/transactions` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1172 | GET | `/api/v1/picker/config` | picker | no | - | rider-app | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1173 | GET | `/api/v1/picker/config/cancel-reasons` | picker | yes | picker-jwt | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1174 | POST | `/api/v1/picker/dark-store-login` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1175 | GET | `/api/v1/picker/dashboard/today` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1176 | GET | `/api/v1/picker/devices/assigned` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1177 | POST | `/api/v1/picker/devices/collection-complete` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1178 | POST | `/api/v1/picker/devices/return` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1179 | POST | `/api/v1/picker/devices/upload-condition-photo` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1180 | POST | `/api/v1/picker/didit/session` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1181 | GET | `/api/v1/picker/didit/status` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1182 | POST | `/api/v1/picker/didit/webhook` | picker | no | - | - | REQUIRED | PASS | 200 | n/a | INTERNAL | mutation accepted |
| 1183 | GET | `/api/v1/picker/documents` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1184 | POST | `/api/v1/picker/documents` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1185 | POST | `/api/v1/picker/documents/upload` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1186 | GET | `/api/v1/picker/faq` | picker | no | - | picker-app,rider-app | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1187 | POST | `/api/v1/picker/heartbeat` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1188 | GET | `/api/v1/picker/home/summary` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1189 | GET | `/api/v1/picker/incentives/today` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1190 | POST | `/api/v1/picker/issues` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1191 | GET | `/api/v1/picker/legal/config` | picker | no | - | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1192 | GET | `/api/v1/picker/legal/privacy` | picker | no | - | rider-app | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1193 | GET | `/api/v1/picker/legal/terms` | picker | no | - | rider-app | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1194 | GET | `/api/v1/picker/locations` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1195 | GET | `/api/v1/picker/locations/:locationId` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1196 | GET | `/api/v1/picker/locations/current` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1197 | POST | `/api/v1/picker/locations/ensure-darkstore-verification` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1198 | POST | `/api/v1/picker/locations/nearest` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1199 | POST | `/api/v1/picker/locations/save-darkstore-gps` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1200 | POST | `/api/v1/picker/locations/set` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1201 | POST | `/api/v1/picker/locations/set-darkstore-from-current` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1202 | POST | `/api/v1/picker/locations/track` | picker | yes | picker-jwt | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1203 | POST | `/api/v1/picker/locations/validate` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1204 | POST | `/api/v1/picker/manager/request-otp` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1205 | POST | `/api/v1/picker/manager/verify-otp` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1206 | GET | `/api/v1/picker/notifications` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1207 | PUT | `/api/v1/picker/notifications/:notificationId/read` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1208 | PUT | `/api/v1/picker/notifications/read-all` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1209 | POST | `/api/v1/picker/onboarding/kit-ack` | picker | yes | picker-jwt | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1210 | GET | `/api/v1/picker/onboarding/state` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1211 | POST | `/api/v1/picker/onboarding/submit` | picker | yes | picker-jwt | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1212 | GET | `/api/v1/picker/performance` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1213 | GET | `/api/v1/picker/performance/history` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1214 | GET | `/api/v1/picker/performance/summary` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1215 | POST | `/api/v1/picker/presence/ping` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1216 | GET | `/api/v1/picker/profile` | picker | yes | picker-jwt | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1217 | PUT | `/api/v1/picker/profile` | picker | yes | picker-jwt | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1218 | POST | `/api/v1/picker/push-token` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1219 | GET | `/api/v1/picker/samples` | picker | no | - | - | LEGACY | PASS | 200 | read-ok | LEGACY | ok |
| 1220 | POST | `/api/v1/picker/samples` | picker | no | - | - | LEGACY | PASS | 201 | n/a | LEGACY | mutation accepted |
| 1221 | GET | `/api/v1/picker/samples/:id` | picker | no | - | - | LEGACY | PASS | 200 | read-ok | LEGACY | ok |
| 1222 | GET | `/api/v1/picker/settings/preferences` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1223 | PUT | `/api/v1/picker/settings/preferences` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1224 | GET | `/api/v1/picker/shared-orders` | picker | partial | picker-jwt;active-picker | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1225 | GET | `/api/v1/picker/shared-orders/:orderId` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1226 | POST | `/api/v1/picker/shared-orders/:orderId/complete` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1227 | POST | `/api/v1/picker/shared-orders/:orderId/proof-photo` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1228 | PUT | `/api/v1/picker/shared-orders/:orderId/status` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1229 | GET | `/api/v1/picker/shared-orders/assignorders` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1230 | GET | `/api/v1/picker/shared-orders/completed` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1231 | POST | `/api/v1/picker/shifts/:shiftId/end` | picker | partial | picker-jwt;active-picker | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1232 | POST | `/api/v1/picker/shifts/:shiftId/start` | picker | partial | picker-jwt;active-picker | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1233 | GET | `/api/v1/picker/shifts/available` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1234 | POST | `/api/v1/picker/shifts/break/end` | picker | partial | picker-jwt;active-picker | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1235 | POST | `/api/v1/picker/shifts/break/start` | picker | partial | picker-jwt;active-picker | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1236 | POST | `/api/v1/picker/shifts/deselect` | picker | yes | picker-jwt | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1237 | POST | `/api/v1/picker/shifts/end` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1238 | GET | `/api/v1/picker/shifts/my` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1239 | GET | `/api/v1/picker/shifts/readiness` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1240 | POST | `/api/v1/picker/shifts/select` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1241 | POST | `/api/v1/picker/shifts/start` | picker | partial | picker-jwt;active-picker | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1242 | GET | `/api/v1/picker/store-otp` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1243 | GET | `/api/v1/picker/stores/nearby` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1244 | GET | `/api/v1/picker/support/chat/messages` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1245 | POST | `/api/v1/picker/support/chat/messages` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1246 | GET | `/api/v1/picker/support/tickets` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1247 | POST | `/api/v1/picker/support/tickets` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1248 | POST | `/api/v1/picker/training/assessment` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1249 | POST | `/api/v1/picker/training/complete/:videoId` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1250 | POST | `/api/v1/picker/training/modules/:moduleId/complete` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1251 | GET | `/api/v1/picker/training/progress` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1252 | PUT | `/api/v1/picker/training/progress` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1253 | GET | `/api/v1/picker/training/user-progress` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1254 | GET | `/api/v1/picker/training/videos` | picker | no | - | picker-app,rider-app | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1255 | GET | `/api/v1/picker/training/videos/:videoId` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1256 | PUT | `/api/v1/picker/training/watch-progress` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1257 | POST | `/api/v1/picker/uploads` | picker | yes | picker-jwt | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1258 | PUT | `/api/v1/picker/user/location-type` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1259 | GET | `/api/v1/picker/user/profile` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1260 | PUT | `/api/v1/picker/user/profile` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1261 | GET | `/api/v1/picker/user/profile/contract` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1262 | PUT | `/api/v1/picker/user/profile/contract` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1263 | GET | `/api/v1/picker/user/profile/employment` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1264 | PUT | `/api/v1/picker/user/profile/employment` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1265 | GET | `/api/v1/picker/user/profile/link-status` | picker | yes | picker-jwt | - | OPTIONAL | PASS | 401 | n/a | UNKNOWN | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1266 | GET | `/api/v1/picker/user/profile/overview` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1267 | PUT | `/api/v1/picker/user/upi` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1268 | POST | `/api/v1/picker/verify/face` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1269 | GET | `/api/v1/picker/wallet` | picker | yes | picker-jwt | rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1270 | GET | `/api/v1/picker/wallet/balance` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1271 | POST | `/api/v1/picker/wallet/deposit` | picker | partial | picker-jwt;active-picker | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1272 | GET | `/api/v1/picker/wallet/earnings-breakdown` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1273 | GET | `/api/v1/picker/wallet/history` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1274 | GET | `/api/v1/picker/wallet/transactions` | picker | yes | picker-jwt | picker-app,rider-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1275 | GET | `/api/v1/picker/wallet/transactions/:transactionId` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1276 | POST | `/api/v1/picker/wallet/withdraw` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1277 | GET | `/api/v1/picker/wallet/withdrawal-requests/:requestId` | picker | yes | picker-jwt | picker-app | REQUIRED | PASS | 401 | n/a | USED | auth gate OK; authorized happy-path BLOCKED (picker OTP/SMS required) |
| 1278 | GET | `/api/v1/picker/work-locations` | picker | no | - | picker-app,rider-app | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1279 | GET | `/api/v1/production/health` | production | yes | hhd-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | ok |
| 1280 | GET | `/api/v1/rider` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1281 | POST | `/api/v1/rider` | rider | yes | admin-jwt | - | OPTIONAL | FAIL | 500 | n/a | UNKNOWN | server error 500 |
| 1282 | GET | `/api/v1/rider/:riderId` | rider | yes | admin-jwt | - | OPTIONAL | FAIL | 500 | n/a | UNKNOWN | server error 500 |
| 1283 | PUT | `/api/v1/rider/:riderId` | rider | yes | admin-jwt | - | OPTIONAL | FAIL | 500 | n/a | UNKNOWN | server error 500 |
| 1284 | GET | `/api/v1/rider/:riderId/compliance` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1285 | GET | `/api/v1/rider/:riderId/contract` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1286 | GET | `/api/v1/rider/:riderId/location` | rider | yes | admin-jwt | - | OPTIONAL | FAIL | 500 | n/a | UNKNOWN | server error 500 |
| 1287 | GET | `/api/v1/rider/:riderId/shifts` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1288 | GET | `/api/v1/rider/:riderId/training` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1289 | GET | `/api/v1/rider/audit/logs` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1290 | GET | `/api/v1/rider/compliance` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1291 | GET | `/api/v1/rider/compliance/:riderId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1292 | POST | `/api/v1/rider/compliance/:riderId/suspend` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1293 | POST | `/api/v1/rider/compliance/:riderId/unsuspend` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1294 | GET | `/api/v1/rider/contracts` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1295 | GET | `/api/v1/rider/contracts/:riderId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1296 | POST | `/api/v1/rider/contracts/:riderId/renew` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 1297 | POST | `/api/v1/rider/contracts/:riderId/terminate` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1298 | GET | `/api/v1/rider/dashboard/counts` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1299 | POST | `/api/v1/rider/dispatch/assign` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 1300 | POST | `/api/v1/rider/dispatch/auto-assign` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1301 | GET | `/api/v1/rider/dispatch/auto-assign/rules` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1302 | PUT | `/api/v1/rider/dispatch/auto-assign/rules` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1303 | POST | `/api/v1/rider/dispatch/batch-assign` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 1304 | POST | `/api/v1/rider/dispatch/cluster-metrics` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 1305 | GET | `/api/v1/rider/dispatch/clusters` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1306 | POST | `/api/v1/rider/dispatch/clusters` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 1307 | DELETE | `/api/v1/rider/dispatch/clusters/:clusterId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | delete handled 404 |
| 1308 | POST | `/api/v1/rider/dispatch/clusters/:clusterId/assign` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 1309 | PUT | `/api/v1/rider/dispatch/clusters/:clusterId/orders` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 1310 | GET | `/api/v1/rider/dispatch/group-delivery` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1311 | GET | `/api/v1/rider/dispatch/group-delivery/filter-options` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1312 | GET | `/api/v1/rider/dispatch/group-orders` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1313 | POST | `/api/v1/rider/dispatch/manual-order` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 1314 | GET | `/api/v1/rider/dispatch/map` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1315 | GET | `/api/v1/rider/dispatch/map/orders` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1316 | GET | `/api/v1/rider/dispatch/map/riders` | rider | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1317 | GET | `/api/v1/rider/dispatch/orders/:orderId/assignment` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1318 | GET | `/api/v1/rider/dispatch/orders/:orderId/recommendations` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1319 | POST | `/api/v1/rider/dispatch/simulate` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1320 | GET | `/api/v1/rider/dispatch/unassigned` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1321 | GET | `/api/v1/rider/dispatch/unassigned/count` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1322 | GET | `/api/v1/rider/distribution` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1323 | GET | `/api/v1/rider/fleet` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1324 | POST | `/api/v1/rider/fleet` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1325 | DELETE | `/api/v1/rider/fleet/:vehicleId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | delete handled 404 |
| 1326 | PUT | `/api/v1/rider/fleet/:vehicleId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1327 | GET | `/api/v1/rider/fleet/maintenance` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1328 | POST | `/api/v1/rider/fleet/maintenance` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1329 | GET | `/api/v1/rider/fleet/maintenance/:taskId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1330 | PUT | `/api/v1/rider/fleet/maintenance/:taskId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1331 | GET | `/api/v1/rider/fleet/summary` | rider | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1332 | GET | `/api/v1/rider/fleet/vehicles` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1333 | POST | `/api/v1/rider/fleet/vehicles` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1334 | GET | `/api/v1/rider/fleet/vehicles/:vehicleId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1335 | PUT | `/api/v1/rider/fleet/vehicles/:vehicleId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1336 | GET | `/api/v1/rider/health` | rider | no | - | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1337 | GET | `/api/v1/rider/hr/access` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1338 | PUT | `/api/v1/rider/hr/access/:riderId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1339 | GET | `/api/v1/rider/hr/compliance/:riderId/suspension` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1340 | PUT | `/api/v1/rider/hr/compliance/:riderId/suspension` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1341 | GET | `/api/v1/rider/hr/compliance/:riderId/violations` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1342 | GET | `/api/v1/rider/hr/compliance/alerts` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1343 | GET | `/api/v1/rider/hr/contracts` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1344 | GET | `/api/v1/rider/hr/contracts/:riderId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1345 | PUT | `/api/v1/rider/hr/contracts/:riderId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1346 | POST | `/api/v1/rider/hr/contracts/:riderId/renew` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 1347 | POST | `/api/v1/rider/hr/contracts/:riderId/terminate` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1348 | GET | `/api/v1/rider/hr/dashboard/summary` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1349 | DELETE | `/api/v1/rider/hr/devices/:riderId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 1350 | POST | `/api/v1/rider/hr/devices/:riderId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1351 | GET | `/api/v1/rider/hr/documents` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1352 | GET | `/api/v1/rider/hr/documents/:documentId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1353 | PUT | `/api/v1/rider/hr/documents/:documentId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1354 | GET | `/api/v1/rider/hr/documents/:documentId/download` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1355 | GET | `/api/v1/rider/hr/documents/:documentId/history` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1356 | GET | `/api/v1/rider/hr/documents/:documentId/rejection-reason` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1357 | GET | `/api/v1/rider/hr/riders` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1358 | POST | `/api/v1/rider/hr/riders` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1359 | GET | `/api/v1/rider/hr/riders/:riderId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1360 | PUT | `/api/v1/rider/hr/riders/:riderId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1361 | POST | `/api/v1/rider/hr/riders/:riderId/approve` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1362 | POST | `/api/v1/rider/hr/riders/:riderId/remind` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1363 | GET | `/api/v1/rider/hr/training` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1364 | PUT | `/api/v1/rider/hr/training/:riderId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1365 | GET | `/api/v1/rider/kit/config` | rider | no | - | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1366 | POST | `/api/v1/rider/kit/config` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1367 | GET | `/api/v1/rider/kit/training-videos` | rider | no | - | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1368 | POST | `/api/v1/rider/kit/training-videos` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 1369 | DELETE | `/api/v1/rider/kit/training-videos/:id` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 1370 | PUT | `/api/v1/rider/kit/training-videos/:id` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1371 | GET | `/api/v1/rider/legal/config` | rider | no | - | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1372 | GET | `/api/v1/rider/legal/privacy` | rider | no | - | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1373 | GET | `/api/v1/rider/legal/terms` | rider | no | - | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1374 | GET | `/api/v1/rider/notifications` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1375 | PUT | `/api/v1/rider/notifications/:notificationId/read` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1376 | POST | `/api/v1/rider/notifications/read-all` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1377 | GET | `/api/v1/rider/orders` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1378 | POST | `/api/v1/rider/orders/:orderId/alert` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1379 | POST | `/api/v1/rider/orders/:orderId/assign` | rider | yes | admin-jwt | - | OPTIONAL | FAIL | 500 | n/a | UNKNOWN | server error 500 |
| 1380 | GET | `/api/v1/rider/search` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1381 | GET | `/api/v1/rider/shifts` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1382 | POST | `/api/v1/rider/shifts` | rider | yes | admin-jwt | - | OPTIONAL | FAIL | 500 | n/a | UNKNOWN | server error 500 |
| 1383 | DELETE | `/api/v1/rider/shifts/:shiftId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | delete handled 404 |
| 1384 | GET | `/api/v1/rider/shifts/:shiftId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1385 | PUT | `/api/v1/rider/shifts/:shiftId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1386 | POST | `/api/v1/rider/shifts/:shiftId/assign` | rider | yes | admin-jwt | - | OPTIONAL | FAIL | 500 | n/a | UNKNOWN | server error 500 |
| 1387 | GET | `/api/v1/rider/shifts/:shiftId/assignments` | rider | yes | admin-jwt | - | OPTIONAL | FAIL | 500 | n/a | UNKNOWN | server error 500 |
| 1388 | DELETE | `/api/v1/rider/shifts/:shiftId/assignments/:riderId` | rider | yes | admin-jwt | - | OPTIONAL | FAIL | 500 | n/a | UNKNOWN | server error 500 |
| 1389 | POST | `/api/v1/rider/shifts/:shiftId/unassign` | rider | yes | admin-jwt | - | OPTIONAL | FAIL | 500 | n/a | UNKNOWN | server error 500 |
| 1390 | GET | `/api/v1/rider/shifts/available/list` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1391 | POST | `/api/v1/rider/shifts/cancel` | rider | yes | admin-jwt | - | OPTIONAL | FAIL | 500 | n/a | UNKNOWN | server error 500 |
| 1392 | POST | `/api/v1/rider/shifts/end` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1393 | GET | `/api/v1/rider/shifts/filter-options` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1394 | GET | `/api/v1/rider/shifts/my` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1395 | POST | `/api/v1/rider/shifts/select` | rider | yes | admin-jwt | - | OPTIONAL | FAIL | 500 | n/a | UNKNOWN | server error 500 |
| 1396 | POST | `/api/v1/rider/shifts/start` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1397 | GET | `/api/v1/rider/summary` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1398 | GET | `/api/v1/rider/support-chat/conversation` | support-chat | yes | customer-jwt | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | token rejected |
| 1399 | GET | `/api/v1/rider/support-chat/conversation/messages` | support-chat | yes | customer-jwt | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | token rejected |
| 1400 | POST | `/api/v1/rider/support-chat/conversation/messages` | support-chat | yes | customer-jwt | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 1401 | POST | `/api/v1/rider/support-chat/conversation/read` | support-chat | yes | customer-jwt | - | OPTIONAL | PARTIAL | 401 | n/a | UNKNOWN | auth rejected with provided token |
| 1402 | GET | `/api/v1/rider/training/:riderId` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1403 | POST | `/api/v1/rider/training/:riderId/modules/:moduleId/complete` | rider | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1404 | DELETE | `/api/v1/shared/alerts` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 1405 | GET | `/api/v1/shared/alerts` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1406 | GET | `/api/v1/shared/alerts/:id` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1407 | POST | `/api/v1/shared/alerts/:id/action` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 1408 | PUT | `/api/v1/shared/alerts/read-all` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1409 | GET | `/api/v1/shared/analytics/dispatch-efficiency` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1410 | GET | `/api/v1/shared/analytics/drill-down` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1411 | GET | `/api/v1/shared/analytics/fleet-utilization` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1412 | GET | `/api/v1/shared/analytics/hub-comparison` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1413 | POST | `/api/v1/shared/analytics/reports/export` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1414 | GET | `/api/v1/shared/analytics/reports/schedules` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1415 | POST | `/api/v1/shared/analytics/reports/schedules` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 1416 | GET | `/api/v1/shared/analytics/rider-leaderboard` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1417 | GET | `/api/v1/shared/analytics/rider-performance` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1418 | GET | `/api/v1/shared/analytics/sla-adherence` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1419 | POST | `/api/v1/shared/approvals/batch-approve` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 1420 | GET | `/api/v1/shared/approvals/queue` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1421 | POST | `/api/v1/shared/approvals/queue` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 1422 | GET | `/api/v1/shared/approvals/queue/:id` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1423 | POST | `/api/v1/shared/approvals/queue/:id/approve` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1424 | POST | `/api/v1/shared/approvals/queue/:id/reject` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1425 | GET | `/api/v1/shared/approvals/summary` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1426 | DELETE | `/api/v1/shared/bulk-ops/:type` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | delete handled 200 |
| 1427 | GET | `/api/v1/shared/bulk-ops/export/:type` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1428 | POST | `/api/v1/shared/bulk-ops/import/products` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1429 | POST | `/api/v1/shared/bulk-ops/inventory` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1430 | POST | `/api/v1/shared/bulk-ops/orders` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1431 | POST | `/api/v1/shared/bulk-ops/products` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1432 | POST | `/api/v1/shared/call-logs` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1433 | GET | `/api/v1/shared/call-logs/by-customer/:customerId` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1434 | GET | `/api/v1/shared/call-logs/by-order/:orderId` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1435 | GET | `/api/v1/shared/call-logs/by-ticket/:ticketId` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1436 | POST | `/api/v1/shared/communication/broadcasts` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 1437 | GET | `/api/v1/shared/communication/chats` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1438 | GET | `/api/v1/shared/communication/chats/:id` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1439 | POST | `/api/v1/shared/communication/chats/:id/flag` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1440 | POST | `/api/v1/shared/communication/chats/:id/messages` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 1441 | PUT | `/api/v1/shared/communication/chats/:id/read` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1442 | GET | `/api/v1/shared/dashboard/summary` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1443 | POST | `/api/v1/shared/escalations` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1444 | GET | `/api/v1/shared/escalations/:id` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1445 | PATCH | `/api/v1/shared/escalations/:id` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 1446 | PATCH | `/api/v1/shared/escalations/:id/assign` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1447 | PATCH | `/api/v1/shared/escalations/:id/resolve` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1448 | GET | `/api/v1/shared/escalations/by-team/:team` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1449 | POST | `/api/v1/shared/inventory-sync/bulk` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1450 | GET | `/api/v1/shared/inventory-sync/status` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1451 | POST | `/api/v1/shared/inventory-sync/store-to-warehouse` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1452 | POST | `/api/v1/shared/inventory-sync/warehouse-to-store` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1453 | GET | `/api/v1/shared/search` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1454 | GET | `/api/v1/shared/search/recent` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1455 | GET | `/api/v1/shared/search/suggestions` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1456 | GET | `/api/v1/shared/system-health` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1457 | GET | `/api/v1/shared/system-health/devices` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1458 | GET | `/api/v1/shared/system-health/devices/:id` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1459 | GET | `/api/v1/shared/system-health/diagnostics/reports/:reportId` | shared | yes | admin-jwt | - | INTERNAL | PASS | 200 | read-ok | INTERNAL | ok |
| 1460 | POST | `/api/v1/shared/system-health/diagnostics/run` | shared | yes | admin-jwt | - | INTERNAL | PASS | 200 | n/a | INTERNAL | mutation accepted |
| 1461 | GET | `/api/v1/shared/workflow/rules` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1462 | POST | `/api/v1/shared/workflow/rules` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 201 | n/a | UNKNOWN | mutation accepted |
| 1463 | POST | `/api/v1/shared/workflow/schedule` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1464 | POST | `/api/v1/shared/workflow/trigger` | shared | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1465 | POST | `/api/v1/support/tickets` | support | no | - | - | OPTIONAL | PASS | 400 | n/a | UNKNOWN | validation rejected (route alive) |
| 1466 | GET | `/api/v1/warehouse/analytics` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1467 | GET | `/api/v1/warehouse/attendance/live` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1468 | GET | `/api/v1/warehouse/daily-report` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1469 | GET | `/api/v1/warehouse/devices` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1470 | POST | `/api/v1/warehouse/devices` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1471 | PATCH | `/api/v1/warehouse/devices/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1472 | GET | `/api/v1/warehouse/equipment/devices` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1473 | GET | `/api/v1/warehouse/equipment/devices/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1474 | GET | `/api/v1/warehouse/equipment/export` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1475 | GET | `/api/v1/warehouse/equipment/machinery` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1476 | POST | `/api/v1/warehouse/equipment/machinery` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1477 | GET | `/api/v1/warehouse/equipment/machinery/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1478 | POST | `/api/v1/warehouse/equipment/machinery/:id/issue` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1479 | POST | `/api/v1/warehouse/equipment/machinery/:id/resolve` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1480 | GET | `/api/v1/warehouse/exceptions` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1481 | POST | `/api/v1/warehouse/exceptions` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1482 | GET | `/api/v1/warehouse/exceptions/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1483 | POST | `/api/v1/warehouse/exceptions/:id/accept-partial` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1484 | POST | `/api/v1/warehouse/exceptions/:id/reject-shipment` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1485 | PUT | `/api/v1/warehouse/exceptions/:id/status` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1486 | GET | `/api/v1/warehouse/exceptions/export` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1487 | GET | `/api/v1/warehouse/health` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | ok |
| 1488 | GET | `/api/v1/warehouse/inbound/docks` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1489 | PUT | `/api/v1/warehouse/inbound/docks/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1490 | GET | `/api/v1/warehouse/inbound/grns` | warehouse | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1491 | POST | `/api/v1/warehouse/inbound/grns` | warehouse | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 1492 | GET | `/api/v1/warehouse/inbound/grns/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1493 | POST | `/api/v1/warehouse/inbound/grns/:id/complete` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1494 | POST | `/api/v1/warehouse/inbound/grns/:id/discrepancy` | warehouse | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 1495 | POST | `/api/v1/warehouse/inbound/grns/:id/start` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1496 | GET | `/api/v1/warehouse/inbound/grns/export` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1497 | GET | `/api/v1/warehouse/inbound/summary` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1498 | GET | `/api/v1/warehouse/inventory/adjustments` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1499 | POST | `/api/v1/warehouse/inventory/adjustments` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1500 | GET | `/api/v1/warehouse/inventory/alerts` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1501 | POST | `/api/v1/warehouse/inventory/alerts/:id/reorder` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1502 | POST | `/api/v1/warehouse/inventory/alerts/generate` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1503 | GET | `/api/v1/warehouse/inventory/cycle-counts` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1504 | POST | `/api/v1/warehouse/inventory/cycle-counts` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1505 | GET | `/api/v1/warehouse/inventory/cycle-counts/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1506 | PUT | `/api/v1/warehouse/inventory/cycle-counts/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1507 | POST | `/api/v1/warehouse/inventory/cycle-counts/:id/complete` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1508 | PUT | `/api/v1/warehouse/inventory/cycle-counts/:id/complete` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1509 | POST | `/api/v1/warehouse/inventory/cycle-counts/:id/start` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1510 | PUT | `/api/v1/warehouse/inventory/cycle-counts/:id/start` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1511 | GET | `/api/v1/warehouse/inventory/export` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1512 | GET | `/api/v1/warehouse/inventory/items` | warehouse | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1513 | GET | `/api/v1/warehouse/inventory/items/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1514 | PUT | `/api/v1/warehouse/inventory/items/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1515 | GET | `/api/v1/warehouse/inventory/locations` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1516 | GET | `/api/v1/warehouse/inventory/locations/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1517 | GET | `/api/v1/warehouse/inventory/meta` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1518 | POST | `/api/v1/warehouse/inventory/reorder` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1519 | POST | `/api/v1/warehouse/inventory/stock/:sku/adjust` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1520 | GET | `/api/v1/warehouse/inventory/summary` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1521 | GET | `/api/v1/warehouse/inventory/transfers` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1522 | POST | `/api/v1/warehouse/inventory/transfers` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1523 | GET | `/api/v1/warehouse/inventory/transfers/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1524 | POST | `/api/v1/warehouse/inventory/transfers/:id/complete` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1525 | PUT | `/api/v1/warehouse/inventory/transfers/:id/status` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1526 | GET | `/api/v1/warehouse/metrics` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1527 | GET | `/api/v1/warehouse/notifications` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1528 | PATCH | `/api/v1/warehouse/notifications/:id/read` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1529 | POST | `/api/v1/warehouse/notifications/read-all` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1530 | GET | `/api/v1/warehouse/operations` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1531 | GET | `/api/v1/warehouse/order-flow` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1532 | GET | `/api/v1/warehouse/orders` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1533 | POST | `/api/v1/warehouse/orders/:orderId/alert` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1534 | POST | `/api/v1/warehouse/orders/:orderId/assign` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1535 | GET | `/api/v1/warehouse/outbound/batches` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1536 | POST | `/api/v1/warehouse/outbound/batches` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1537 | GET | `/api/v1/warehouse/outbound/batches/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1538 | GET | `/api/v1/warehouse/outbound/consolidated-picks` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1539 | GET | `/api/v1/warehouse/outbound/pickers` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1540 | GET | `/api/v1/warehouse/outbound/pickers/:id/orders` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1541 | GET | `/api/v1/warehouse/outbound/picklists` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1542 | GET | `/api/v1/warehouse/outbound/picklists/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1543 | POST | `/api/v1/warehouse/outbound/picklists/:id/assign` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1544 | GET | `/api/v1/warehouse/outbound/routes/:id/map` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1545 | GET | `/api/v1/warehouse/outbound/routes/active/map` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1546 | GET | `/api/v1/warehouse/qc/checks` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1547 | PUT | `/api/v1/warehouse/qc/checks/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1548 | GET | `/api/v1/warehouse/qc/compliance-docs` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1549 | GET | `/api/v1/warehouse/qc/compliance-docs/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1550 | GET | `/api/v1/warehouse/qc/compliance-docs/:id/download` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1551 | GET | `/api/v1/warehouse/qc/compliance-docs/:id/view` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1552 | GET | `/api/v1/warehouse/qc/inspections` | warehouse | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1553 | POST | `/api/v1/warehouse/qc/inspections` | warehouse | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 1554 | GET | `/api/v1/warehouse/qc/inspections/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1555 | GET | `/api/v1/warehouse/qc/inspections/:id/report` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1556 | PUT | `/api/v1/warehouse/qc/inspections/:id/update` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1557 | GET | `/api/v1/warehouse/qc/rejections` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1558 | POST | `/api/v1/warehouse/qc/rejections` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1559 | GET | `/api/v1/warehouse/qc/samples` | warehouse | yes | admin-jwt | - | LEGACY | PASS | 200 | read-ok | LEGACY | ok |
| 1560 | POST | `/api/v1/warehouse/qc/samples` | warehouse | yes | admin-jwt | - | LEGACY | PASS | 422 | n/a | LEGACY | validation rejected (route alive) |
| 1561 | GET | `/api/v1/warehouse/qc/samples/:id/report` | warehouse | yes | admin-jwt | - | LEGACY | PASS | 404 | n/a | LEGACY | not found for placeholder id (route mounted) |
| 1562 | PUT | `/api/v1/warehouse/qc/samples/:id/update` | warehouse | yes | admin-jwt | - | LEGACY | PASS | 404 | n/a | LEGACY | resource not found for test id (route alive) |
| 1563 | GET | `/api/v1/warehouse/qc/temperature-logs` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1564 | POST | `/api/v1/warehouse/qc/temperature-logs` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1565 | GET | `/api/v1/warehouse/qc/temperature-logs/:id/chart` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1566 | GET | `/api/v1/warehouse/reports/daily` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1567 | GET | `/api/v1/warehouse/reports/inventory-by-category` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1568 | GET | `/api/v1/warehouse/reports/inventory-health` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1569 | GET | `/api/v1/warehouse/reports/inventory-health/export` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1570 | GET | `/api/v1/warehouse/reports/operational-slas` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1571 | GET | `/api/v1/warehouse/reports/operational-slas/export` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1572 | GET | `/api/v1/warehouse/reports/operations-view` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1573 | GET | `/api/v1/warehouse/reports/output-trends` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1574 | GET | `/api/v1/warehouse/reports/productivity` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1575 | GET | `/api/v1/warehouse/reports/productivity/export` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1576 | GET | `/api/v1/warehouse/reports/storage-utilization` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1577 | GET | `/api/v1/warehouse/staff` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1578 | GET | `/api/v1/warehouse/staff/absences` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1579 | POST | `/api/v1/warehouse/staff/absences` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1580 | GET | `/api/v1/warehouse/staff/incentive-criteria` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1581 | GET | `/api/v1/warehouse/staff/performance` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1582 | GET | `/api/v1/warehouse/staff/roster/weekly` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1583 | POST | `/api/v1/warehouse/staff/roster/weekly/publish` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1584 | GET | `/api/v1/warehouse/staff/shifts` | warehouse | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1585 | POST | `/api/v1/warehouse/staff/shifts` | warehouse | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 1586 | GET | `/api/v1/warehouse/staff/shifts/:id` | warehouse | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | not found for placeholder id (route mounted) |
| 1587 | PUT | `/api/v1/warehouse/staff/shifts/:id` | warehouse | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 404 | n/a | USED | resource not found for test id (route alive) |
| 1588 | POST | `/api/v1/warehouse/staff/shifts/auto-assign` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1589 | GET | `/api/v1/warehouse/staff/shifts/coverage` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1590 | GET | `/api/v1/warehouse/staff/summary` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1591 | GET | `/api/v1/warehouse/transfers` | warehouse | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1592 | POST | `/api/v1/warehouse/transfers` | warehouse | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 422 | n/a | USED | validation rejected (route alive) |
| 1593 | GET | `/api/v1/warehouse/transfers/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1594 | GET | `/api/v1/warehouse/transfers/:id/items` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1595 | PUT | `/api/v1/warehouse/transfers/:id/status` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1596 | GET | `/api/v1/warehouse/transfers/export` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1597 | POST | `/api/v1/warehouse/utilities/bin-reassignment` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1598 | POST | `/api/v1/warehouse/utilities/generate-labels` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1599 | GET | `/api/v1/warehouse/utilities/logs` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1600 | POST | `/api/v1/warehouse/utilities/print-barcodes` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1601 | POST | `/api/v1/warehouse/utilities/reassign-bins` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1602 | POST | `/api/v1/warehouse/utilities/upload-skus` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | n/a | UNKNOWN | mutation accepted |
| 1603 | GET | `/api/v1/warehouse/utilities/zones` | warehouse | yes | admin-jwt | admin-dashboard | REQUIRED | PASS | 200 | read-ok | USED | ok |
| 1604 | GET | `/api/v1/warehouse/workforce/attendance` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1605 | POST | `/api/v1/warehouse/workforce/attendance` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1606 | GET | `/api/v1/warehouse/workforce/leave-requests` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1607 | POST | `/api/v1/warehouse/workforce/leave-requests` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1608 | PUT | `/api/v1/warehouse/workforce/leave-requests/:id/status` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1609 | GET | `/api/v1/warehouse/workforce/performance` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1610 | GET | `/api/v1/warehouse/workforce/schedule` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1611 | POST | `/api/v1/warehouse/workforce/schedule` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1612 | GET | `/api/v1/warehouse/workforce/schedule/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1613 | POST | `/api/v1/warehouse/workforce/schedule/:id/assign` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1614 | GET | `/api/v1/warehouse/workforce/staff` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1615 | POST | `/api/v1/warehouse/workforce/staff` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1616 | GET | `/api/v1/warehouse/workforce/staff/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1617 | GET | `/api/v1/warehouse/workforce/staff/:id/details` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1618 | GET | `/api/v1/warehouse/workforce/training` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 200 | read-ok | UNKNOWN | ok |
| 1619 | POST | `/api/v1/warehouse/workforce/training` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 422 | n/a | UNKNOWN | validation rejected (route alive) |
| 1620 | GET | `/api/v1/warehouse/workforce/training/:id` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1621 | GET | `/api/v1/warehouse/workforce/training/:id/details` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | not found for placeholder id (route mounted) |
| 1622 | POST | `/api/v1/warehouse/workforce/training/:id/enroll` | warehouse | yes | admin-jwt | - | OPTIONAL | PASS | 404 | n/a | UNKNOWN | resource not found for test id (route alive) |
| 1623 | GET | `/health` | health | no | - | - | REQUIRED | PASS | 200 | read-ok | INTERNAL | ok |
| 1624 | GET | `/health/db` | health | no | - | - | REQUIRED | PASS | 200 | read-ok | INTERNAL | ok |
| 1625 | GET | `/health/ready` | health | no | - | - | REQUIRED | PASS | 200 | read-ok | INTERNAL | ok |
| 1626 | GET | `/healthz` | health | no | - | - | REQUIRED | PASS | 200 | n/a | INTERNAL | ok |

## 5. Postman Test Results

- Collection: `postman/Selorg-Backend-Full-Endpoints.postman_collection.json` (**1626** requests)
- Environment: `postman/Selorg-Backend-Local.postman_environment.json`
- Live mass audit coverage: **1626/1626 (100%)** of mounted endpoints

| Status | Count | % |
|--------|------:|--:|
| PASS | 1527 | 93.91% |
| FAIL | 19 | 1.17% |
| PARTIAL | 80 | 4.92% |
| BLOCKED | 0 | 0.00% |
| NOT_TESTED | 0 | 0.00% |

## 6. Customer APIs

| Metric | Count |
|--------|------:|
| Total mounted | 112 |
| PASS | 111 |
| FAIL | 0 |
| PARTIAL | 1 |
| USED (frontend exact match) | 96 |
| UNKNOWN | 16 |

## 7. Picker APIs

| Metric | Count |
|--------|------:|
| Total mounted | 142 |
| PASS | 142 |
| FAIL | 0 |
| PARTIAL | 0 |
| USED (frontend exact match) | 110 |
| UNKNOWN | 28 |

## 8. HHD APIs

| Metric | Count |
|--------|------:|
| Total mounted | 42 |
| PASS | 42 |
| FAIL | 0 |
| PARTIAL | 0 |
| USED (frontend exact match) | 24 |
| UNKNOWN | 18 |

## 9. Rider APIs

| Metric | Count |
|--------|------:|
| Total mounted | 124 |
| PASS | 108 |
| FAIL | 12 |
| PARTIAL | 4 |
| USED (frontend exact match) | 2 |
| UNKNOWN | 122 |

Failures:
- `POST /api/v1/rider` HTTP 500 — server error 500
- `GET /api/v1/rider/:riderId` HTTP 500 — server error 500
- `PUT /api/v1/rider/:riderId` HTTP 500 — server error 500
- `GET /api/v1/rider/:riderId/location` HTTP 500 — server error 500
- `POST /api/v1/rider/orders/:orderId/assign` HTTP 500 — server error 500
- `POST /api/v1/rider/shifts` HTTP 500 — server error 500
- `POST /api/v1/rider/shifts/:shiftId/assign` HTTP 500 — server error 500
- `GET /api/v1/rider/shifts/:shiftId/assignments` HTTP 500 — server error 500
- `DELETE /api/v1/rider/shifts/:shiftId/assignments/:riderId` HTTP 500 — server error 500
- `POST /api/v1/rider/shifts/:shiftId/unassign` HTTP 500 — server error 500
- `POST /api/v1/rider/shifts/cancel` HTTP 500 — server error 500
- `POST /api/v1/rider/shifts/select` HTTP 500 — server error 500

## 10. Delivery APIs

| Metric | Count |
|--------|------:|
| Total mounted | 2 |
| PASS | 2 |
| FAIL | 0 |
| PARTIAL | 0 |
| USED (frontend exact match) | 2 |
| UNKNOWN | 0 |

## 11. Admin APIs

| Metric | Count |
|--------|------:|
| Total mounted | 1130 |
| PASS | 1048 |
| FAIL | 7 |
| PARTIAL | 75 |
| USED (frontend exact match) | 125 |
| UNKNOWN | 934 |

Failures:
- `GET /api/v1/admin/analytics/picker-drilldown/:pickerId` HTTP 501 — server error 501
- `GET /api/v1/admin/analytics/pickers` HTTP 501 — server error 501
- `POST /api/v1/admin/notifications/history/:id/retry` HTTP 501 — server error 501
- `POST /api/v1/admin/notifications/history/retry-failed` HTTP 501 — server error 501
- `DELETE /api/v1/admin/picker/devices/:deviceId/unassign` HTTP 500 — server error 500
- `PUT /api/v1/admin/picker/withdrawals/:requestId/process` HTTP 500 — server error 500
- `GET /api/v1/admin/products/bulk-upload/template` HTTP 500 — server error 500

## 12. Auth APIs

| Metric | Count |
|--------|------:|
| Total mounted | 0 |
| PASS | 0 |
| FAIL | 0 |
| PARTIAL | 0 |
| USED (frontend exact match) | 0 |
| UNKNOWN | 0 |

## 13. Integration/Webhook APIs

| Metric | Count |
|--------|------:|
| Total mounted | 4 |
| PASS | 4 |
| FAIL | 0 |
| PARTIAL | 0 |
| USED (frontend exact match) | 0 |
| UNKNOWN | 0 |

## 14. Health/Internal APIs

| Metric | Count |
|--------|------:|
| Total mounted | 69 |
| PASS | 69 |
| FAIL | 0 |
| PARTIAL | 0 |
| USED (frontend exact match) | 0 |
| UNKNOWN | 59 |

## 15. Complete Order Lifecycle Test

| Stage | Status | Evidence |
|-------|--------|----------|
| Customer login/OTP | PASS | live JWT |
| Create order | PASS | prior 201 ORD-20260911-00470; mass POST validation also exercised |
| Picker HTTP ops | PARTIAL | auth gate 401 without token; SMS OTP blocked happy-path |
| HHD HTTP ops | PARTIAL | auth gate 401; SMS OTP blocked happy-path |
| Service spine e2e | PASS | e2e-order-spine TC1–TC5 |
| Admin dispatch | FAIL correctness | legacy `orders` collection vs `customer_orders` |
| Rider mobile | uses `/api/v1/picker/*` | frontend evidence 58 picker paths |

## 16. Used Endpoints

Exact path matches against frontend scan: **359** inventory rows.

| App | Paths in scan |
|-----|--------------:|
| customer-app | 80 |
| customer-web | 77 |
| picker-app | 70 |
| rider-app | 59 |
| hhd-app | 26 |
| admin-dashboard | 90 |

Rider → Picker shared infrastructure confirmed: rider-app calls `/api/v1/picker/*`, not `/api/v1/rider/*`.

## 17. Unused Endpoints

# Unused / Possibly Unused Endpoints

No frontend exact match. **UNKNOWN ≠ proven unused** (admin/warehouse may be dashboard-dynamic).

| Endpoint | Method | Evidence | Replacement | Required? | Safe to Remove? | Reason |
|----------|--------|----------|-------------|-----------|-----------------|--------|
| `/api/v1/admin/analytics/categories` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/custom-report` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/customers` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/export` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/financial-summary` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/funnel` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/growth` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/inventory-health` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/operational` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/orders-by-hour` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/payment-methods` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/peak-hours` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/picker-drilldown/:pickerId` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/pickers` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/products` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/regional` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/rider-performance` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/analytics/timeseries` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/applications` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | OBSOLETE |
| `/api/v1/admin/applications/:id` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | OBSOLETE |
| `/api/v1/admin/applications/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | OBSOLETE |
| `/api/v1/admin/applications/:id/health` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | OBSOLETE |
| `/api/v1/admin/applications/:id/test` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | OBSOLETE |
| `/api/v1/admin/applications/:id/test-connection` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | OBSOLETE |
| `/api/v1/admin/auth/logout` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/cache/clear` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/cache/stats` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/cities` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/cities` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/cities/:id` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/cities/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/cities/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/compliance/audits` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/compliance/audits` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/compliance/audits/:auditId/findings/:findingId` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/compliance/certifications` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/compliance/documents` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/compliance/documents` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/compliance/documents/:id` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/compliance/documents/:id` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/compliance/metrics` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/compliance/policies` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/compliance/policies/:id/acknowledge` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/compliance/reports/generate` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/compliance/violations` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/customers/:id/addresses` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/customers/:id/orders` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/customers/:id/password-info` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/customers/:id/payment-methods` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/customers/:id/refunds` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/customers/:id/reset-password` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/customers/:id/risk` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/customers/:id/set-password` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/customers/:id/tickets` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/customers/:id/wallet` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/customers/stats` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/accounting/accounts` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/accounting/journal` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/accounting/journal/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/accounting/ledger` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/accounting/summary` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/accounting/sync` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/alerts` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/alerts/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/alerts/:id/action` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/alerts/clear-resolved` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/alerts/resolved` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/alerts/resolved/clear` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/analytics/cash-flow` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/analytics/expense-breakdown` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/analytics/export` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/analytics/revenue-growth` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/approvals` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/approvals/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/approvals/summary` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/approvals/tasks` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/approvals/tasks/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/approvals/tasks/:id/decision` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/commission-slabs/:slabId` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/financial-limits` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/financial-limits/:limitId` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/financial-year` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/financial-year` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/invoice-settings` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/invoice-settings` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/payment-terms` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/payment-terms/:termId` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/payout-schedules` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/payout-schedules` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/payout-schedules/:scheduleId` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/reconciliation-rules` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/reconciliation-rules/:ruleId` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/refund-policies` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/refund-policies/:policyId` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/tax-rules` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/tax-rules` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/config/tax-rules/:ruleId` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/customer-payments` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/customer-payments/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/customer-payments/:id/retry` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/dashboard/daily-metrics` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/dashboard/export` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/dashboard/gateway-status` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/dashboard/hourly-trends` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/dashboard/live-transactions` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/dashboard/payment-method-split` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/dashboard/summary` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/dashboard/wallet-liability` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/invoices` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/invoices` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/invoices/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/invoices/:id/mark-paid` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/invoices/:id/reminder` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/invoices/:id/send` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/invoices/:id/send-reminder` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/invoices/:id/status` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/invoices/summary` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/picker-attendance` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/picker-earnings/:pickerId/breakdown` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/picker-earnings/:pickerId/wallet` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/picker-transactions` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/picker-withdrawals/:pickerId/earnings-breakdown` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/picker-withdrawals/:pickerId/wallet-balance` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/reconciliation/exceptions` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/reconciliation/exceptions/:id/investigate` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/reconciliation/exceptions/:id/resolve` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/reconciliation/gateways` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/reconciliation/gateways/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/reconciliation/run` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/reconciliation/runs/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/reconciliation/summary` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/refunds/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/refunds/:id/approve` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/refunds/:id/complete` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/refunds/:id/mark-completed` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/refunds/:id/reject` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/refunds/chargebacks` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/refunds/queue` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/refunds/summary` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/refunds/wallet-transactions` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/rider-cash/:riderId` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/rider-cash/cod-reconciliation` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/rider-cash/riders/:riderId/payment-details` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/rider-cash/summary` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/vendor-payments/invoices` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/vendor-payments/invoices` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/vendor-payments/invoices/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/vendor-payments/invoices/:id/approve` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/vendor-payments/invoices/:id/mark-paid` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/vendor-payments/invoices/:id/reject` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/vendor-payments/invoices/bulk-approve` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/vendor-payments/payments/:paymentId` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/vendor-payments/payments/:paymentId/cancel` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/vendor-payments/payments/:paymentId/invoices/:invoiceId/workflow/advance` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/vendor-payments/summary` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/vendor-payments/vendors` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/finance/wallet-transactions` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/fraud/blocked` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/fraud/blocked` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/fraud/blocked/:id` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/fraud/chargebacks` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/fraud/chargebacks/:id` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/fraud/investigations` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/fraud/metrics` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/fraud/patterns` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/fraud/risk-profiles` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/fraud/rules` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/fraud/rules/:id/toggle` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/integrations` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/integrations/:id` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/integrations/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/integrations/api-keys` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/integrations/api-keys` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/integrations/api-keys/:keyId` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/integrations/logs` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/integrations/stats` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/notifications/analytics` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/notifications/automation` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/notifications/automation` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/notifications/automation/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/notifications/campaigns` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/notifications/campaigns` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/notifications/campaigns/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/notifications/campaigns/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/notifications/channels` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/notifications/history/retry-failed` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/notifications/scheduled` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/notifications/timeseries` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/permissions` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/permissions` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/permissions/:id` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/permissions/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/permissions/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/permissions/matrix` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/picker-action-logs` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/picker-config` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/picker-config` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/picker/attendance/live` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/picker/devices` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/picker/devices/:deviceId/unassign` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/picker/devices/assign` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/picker/documents/:documentId/review` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/picker/pickers/:pickerId/approve` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/picker/pickers/:pickerId/reject` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/picker/shifts/:shiftId/reassign` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/picker/withdrawals` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/picker/withdrawals/:requestId/process` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/pickers` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/pickers/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/pickers/:id` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/pickers/:id/action-logs` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/pickers/:id/bank/:accountId/review` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/pickers/:id/documents/review` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/pickers/:id/face-verification` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/pickers/:id/face-verification/override` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/pickers/:id/link-hhd` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/pickers/:id/link-hhd` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/pickers/:id/training-progress` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/riders/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/roles/:id` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/roles/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/roles/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/roles/:id/export` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/roles/:id/matrix` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/roles/from-template` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/roles/import` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/roles/templates` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/sku-units` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/sku-units` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/sku-units/:id` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/sku-units/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/sku-units/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/staff` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/staff/:id` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/staff/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/staff/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/staff/shifts` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/staff/shifts` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/staff/shifts/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/staff/shifts/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/staff/summary` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/store-warehouse/bins` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/store-warehouse/bins/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/store-warehouse/delivery-zones` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/store-warehouse/grns` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/store-warehouse/grns/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/store-warehouse/inventories` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/store-warehouse/inventories/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/store-warehouse/putaway` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/store-warehouse/stock-movements` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/stores` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/stores` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/stores/:id` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/stores/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/stores/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/stores/performance` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/stores/stats` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support-chat/conversations` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support-chat/conversations/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support-chat/conversations/:id/context` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support-chat/conversations/:id/messages` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support-chat/conversations/:id/read` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support-chat/conversations/:id/status` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support/agents` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support/canned-responses` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support/categories` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support/faqs` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support/faqs` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support/faqs/:id` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support/faqs/:id` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support/feedback` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support/live-chats` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support/live-chats/:id/accept` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support/live-chats/:id/messages` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support/sla-metrics` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support/tickets/:id/close` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support/tickets/:id/escalate` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support/tickets/:id/redelivery` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/support/tickets/:id/refund` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/advanced` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/advanced` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/api-endpoints` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | OBSOLETE |
| `/api/v1/admin/system/api-keys` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/api-keys` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/api-keys/:id/revoke` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/api-keys/:id/rotate` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/cache/clear` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | OBSOLETE |
| `/api/v1/admin/system/cache/stats` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | OBSOLETE |
| `/api/v1/admin/system/cron-jobs` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/cron-jobs/:jobId` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/cron-jobs/:jobId/trigger` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/delivery` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/delivery` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/env-variables` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/env-variables/:key` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/feature-flags` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/feature-flags/:id/toggle` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/general` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/general` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/instances` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | OBSOLETE |
| `/api/v1/admin/system/instances/:id/restart` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | OBSOLETE |
| `/api/v1/admin/system/integrations` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/integrations/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/integrations/:id/test` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/logs` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | OBSOLETE |
| `/api/v1/admin/system/maintenance` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/maintenance` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/migrations` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | OBSOLETE |
| `/api/v1/admin/system/notifications` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/notifications` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/payment-gateways` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/payment-gateways/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/performance` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/server-status` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/tax-settings` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/system/tax-settings` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/training-videos` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/training-videos` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/training-videos/:id` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/training-videos/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/training-videos/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/training-videos/picker-progress` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/users/:id/reset-password` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/users/:id/role` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/users/bulk` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/users/managers` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/users/me` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vehicle-types` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vehicle-types` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vehicle-types/:id` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vehicle-types/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vehicle-types/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/approvals` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/approvals/:approvalId/approve` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/approvals/:approvalId/reject` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/approvals/summary` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/approvals/tasks` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/approvals/tasks/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/approvals/tasks/:id/decision` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/certificates` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/certificates` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/certificates/:certificateId` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/certificates/:certificateId` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/certificates/:certificateId` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/dashboard/summary` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/bulk-import` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/bulk-import/:jobId` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/exceptions` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/exceptions` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/exceptions/:exceptionId/resolve` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/grn` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/grn` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/grn/:grnId` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/grn/:grnId` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/grns` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/grns` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/grns/:grnId` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/grns/:grnId` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/grns/:grnId/approve` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/grns/:grnId/archive` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/grns/:grnId/reject` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/grns/:grnId/status` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/overview` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/report` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/rtvs` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/rtvs` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/rtvs/:rtvId/status` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/shipments` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/shipments` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inbound/shipments/:shipmentId/status` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inventory` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inventory/:vendorId` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inventory/:vendorId/aging-alerts` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inventory/:vendorId/aging-alerts/:alertId/ack` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inventory/:vendorId/aging-inventory` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inventory/:vendorId/aging-inventory/:itemId/liquidate` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inventory/:vendorId/aging-inventory/:itemId/return` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inventory/:vendorId/kpis` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inventory/:vendorId/reconcile` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inventory/:vendorId/stock` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inventory/:vendorId/stockouts` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inventory/:vendorId/stockouts/alert-all` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inventory/:vendorId/stockouts/bulk-reorder` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inventory/:vendorId/supply-performance` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inventory/:vendorId/sync` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/inventory/hub/aging-alerts` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/invoices` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/invoices/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/invoices/:id/approve` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/invoices/:id/mark-paid` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/invoices/:id/reject` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/notifications` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/notifications/:notifId/read` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/notifications/:notifId/read` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/notifications/read-all` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/payments` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/payments` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/payments/:paymentId/cancel` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/public/complete-profile` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/public/upload-documents/:vendorId` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/public/verify-token` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/purchase-orders` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/purchase-orders` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/purchase-orders/:poId` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/purchase-orders/:poId` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/purchase-orders/:poId` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/purchase-orders/:poId` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/purchase-orders/:poId/actions` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/purchase-orders/:poId/approve` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/purchase-orders/:poId/events` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/purchase-orders/:poId/reject` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/purchase-orders/bulk-upload` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/purchase-orders/overview` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/audits` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/audits` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/audits/:id` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/audits/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/audits/:id` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/certificates` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/certificates` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/certificates/:certId` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/certificates/:certId` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/ratings` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/ratings/:vendorId` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/ratings/:vendorId` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/ratings/:vendorId/recalculate` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/temperature` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/temperature` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/temperature/:tempId` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc-compliance/temperature/:tempId` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc/:checkId` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc/:qcId` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc/:qcId` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc/:qcId` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/qc/overview` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/reports` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/reports/customers/insights` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/reports/customers/top` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/reports/financial/summary` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/reports/orders/analytics` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/reports/products/performance` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/reports/revenue/category` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/reports/sales/data` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/reports/sales/hourly` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/reports/sales/overview` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/system-gateway/logs` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/system-gateway/logs` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/system-gateway/services` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/system-gateway/services` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/system-gateway/services/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/system-gateway/services/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/utilities/audit-logs` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/utilities/audit-logs/export` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/utilities/bulk-upload` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/utilities/bulk-upload/template` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/utilities/contracts` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/utilities/contracts` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/utilities/contracts/:contractId` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/utilities/upload-history` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/:vendorId` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/:vendorId` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/:vendorId` | PATCH | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/:vendorId` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/:vendorId/actions` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/:vendorId/alerts` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/:vendorId/alerts` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/:vendorId/certificates` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/:vendorId/health` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/:vendorId/inventory` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/:vendorId/invoices` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/:vendorId/notifications` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/:vendorId/performance` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/:vendorId/purchase-orders` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/:vendorId/qc-checks` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/:vendorId/qc-checks` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/email-preview/:templateName` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/send-doc-request-email` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/send-invite-email` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/send-payment-email` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/send-rejection-email` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/vendor/vendors/summary` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/warehouses` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/warehouses` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/warehouses/:id` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/warehouses/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/warehouses/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/zones` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/zones` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/zones/:id` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/zones/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/admin/zones/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/customer/admin/app-config` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/customer/admin/app-config` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/customer/admin/app-config/cancellation-policies` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/customer/admin/app-config/cancellation-policies` | POST | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/customer/admin/app-config/cancellation-policies/:id` | DELETE | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/customer/admin/app-config/cancellation-policies/:id` | GET | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| `/api/v1/customer/admin/app-config/cancellation-policies/:id` | PUT | no exact frontend match | - | OPTIONAL | **No** (audit only) | UNKNOWN |
| … | … | 691 more in JSON | | | No | |

## 18. Duplicate Endpoints

# Duplicate Endpoints

**27** METHOD+PATH pairs registered more than once.

| Path | Count | Recommended canonical | Removal risk |
|------|------:|----------------------|--------------|
| `DELETE /api/v1/admin/picker/pickers/:id/link-hhd` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `GET /api/v1/admin/picker/agencies` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `GET /api/v1/admin/picker/approvals` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `GET /api/v1/admin/picker/attendance` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `GET /api/v1/admin/picker/attendance/export` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `GET /api/v1/admin/picker/ot-requests` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `GET /api/v1/admin/picker/pickers` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `GET /api/v1/admin/picker/pickers/:id` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `GET /api/v1/admin/picker/pickers/:id/action-logs` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `GET /api/v1/admin/picker/pickers/:id/face-verification` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `GET /api/v1/admin/picker/pickers/:id/training-progress` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `GET /api/v1/admin/picker/shift-change-requests` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `GET /api/v1/admin/picker/stores/:storeId/shift-slots` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `GET /api/v1/admin/staff` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `PATCH /api/v1/admin/picker/pickers/:id/bank/:accountId/review` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `PATCH /api/v1/admin/picker/pickers/:id/documents/review` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `PATCH /api/v1/admin/picker/pickers/:id/face-verification/override` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `PATCH /api/v1/admin/picker/pickers/:id/status` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `PATCH /api/v1/admin/picker/pickers/:pickerId/assignment` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `POST /api/v1/admin/picker/agencies` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `POST /api/v1/admin/picker/agencies/:agencyId/activate` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `POST /api/v1/admin/picker/agencies/:agencyId/deactivate` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `POST /api/v1/admin/picker/ot-requests/:requestId/decision` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `POST /api/v1/admin/picker/pickers/:id/link-hhd` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `POST /api/v1/admin/picker/pickers/:pickerId/push` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `POST /api/v1/admin/picker/shift-change-requests/:requestId/decision` | 2 | Prefer validated/active handler | Medium — confirm clients |
| `POST /api/v1/admin/picker/stores/:storeId/shift-slots` | 2 | Prefer validated/active handler | Medium — confirm clients |

## 19. Legacy Endpoints

# Legacy Endpoints

| Endpoint | Replacement | Usage | Removal recommendation |
|----------|-------------|-------|------------------------|
| `/api/payment/*` | `/api/v1/customer/payments/worldline/*` | no frontend refs | Keep until cutover confirmed |
| `/api/v1/picker/samples*` | none | stub | Deprecate after confirm |
| `POST /api/payment/callback` | see notes | - | Do not delete in audit |
| `POST /api/payment/initiate` | see notes | - | Do not delete in audit |
| `GET /api/payment/status/:orderId` | see notes | - | Do not delete in audit |
| `POST /api/payment/transaction-status` | see notes | - | Do not delete in audit |
| `GET /api/v1/darkstore/qc/samples` | see notes | - | Do not delete in audit |
| `POST /api/v1/darkstore/qc/samples` | see notes | - | Do not delete in audit |
| `PUT /api/v1/darkstore/qc/samples/:sampleId` | see notes | - | Do not delete in audit |
| `GET /api/v1/picker/samples` | see notes | - | Do not delete in audit |
| `POST /api/v1/picker/samples` | see notes | - | Do not delete in audit |
| `GET /api/v1/picker/samples/:id` | see notes | - | Do not delete in audit |
| `GET /api/v1/warehouse/qc/samples` | see notes | - | Do not delete in audit |
| `POST /api/v1/warehouse/qc/samples` | see notes | - | Do not delete in audit |
| `GET /api/v1/warehouse/qc/samples/:id/report` | see notes | - | Do not delete in audit |
| `PUT /api/v1/warehouse/qc/samples/:id/update` | see notes | - | Do not delete in audit |

## 20. Obsolete Endpoints

| Endpoint | Method | Why |
|----------|--------|-----|
| `/api/v1/admin/applications` | GET | MOCK/stub hardcoded success |
| `/api/v1/admin/applications/:id` | PATCH | MOCK/stub hardcoded success |
| `/api/v1/admin/applications/:id` | PUT | MOCK/stub hardcoded success |
| `/api/v1/admin/applications/:id/health` | GET | MOCK/stub hardcoded success |
| `/api/v1/admin/applications/:id/test` | POST | MOCK/stub hardcoded success |
| `/api/v1/admin/applications/:id/test-connection` | POST | MOCK/stub hardcoded success |
| `/api/v1/admin/system/api-endpoints` | GET | MOCK/stub hardcoded success; inline on protectedRouter |
| `/api/v1/admin/system/cache/clear` | POST | MOCK/stub hardcoded success; inline on protectedRouter |
| `/api/v1/admin/system/cache/stats` | GET | MOCK/stub hardcoded success; inline on protectedRouter |
| `/api/v1/admin/system/instances` | GET | MOCK/stub hardcoded success; inline on protectedRouter |
| `/api/v1/admin/system/instances/:id/restart` | POST | MOCK/stub hardcoded success; inline on protectedRouter |
| `/api/v1/admin/system/logs` | GET | MOCK/stub hardcoded success; inline on protectedRouter |
| `/api/v1/admin/system/migrations` | GET | MOCK/stub hardcoded success; inline on protectedRouter |

## 21. Broken Endpoints

# Broken Endpoints

| Endpoint | Expected | Actual | HTTP | Root cause hint |
|----------|----------|--------|------|-----------------|
| `GET /api/v1/admin/analytics/picker-drilldown/:pickerId` | success/handled | {"success":false,"message":"Picker analytics are not available until the picker sub-app is ported","data":null,"error":{ | 501 | server error 501 |
| `GET /api/v1/admin/analytics/pickers` | success/handled | {"success":false,"message":"Picker analytics are not available until the picker sub-app is ported","data":null,"error":{ | 501 | server error 501 |
| `POST /api/v1/admin/notifications/history/:id/retry` | success/handled | {"success":false,"message":"Notification delivery pipeline not yet available","data":null,"error":{"code":501,"appCode": | 501 | server error 501 |
| `POST /api/v1/admin/notifications/history/retry-failed` | success/handled | {"success":false,"message":"Notification delivery pipeline not yet available","data":null,"error":{"code":501,"appCode": | 501 | server error 501 |
| `DELETE /api/v1/admin/picker/devices/:deviceId/unassign` | success/handled | {"success":false,"message":"Device not found","data":null,"error":{"code":500,"title":"An unexpected error occurred","me | 500 | server error 500 |
| `PUT /api/v1/admin/picker/withdrawals/:requestId/process` | success/handled | {"success":false,"message":"Withdrawal request not found","data":null,"error":{"code":500,"title":"An unexpected error o | 500 | server error 500 |
| `GET /api/v1/admin/products/bulk-upload/template` | success/handled | {"success":false,"message":"Cannot find module 'exceljs'\nRequire stack:\n- C:\\Users\\lmbac\\Desktop\\Selorg V1.3\\selo | 500 | server error 500 |
| `POST /api/v1/rider` | success/handled | {"success":false,"message":"Cannot read properties of undefined (reading 'trim')","data":null,"error":{"code":500,"title | 500 | server error 500 |
| `GET /api/v1/rider/:riderId` | success/handled | {"success":false,"message":"Rider not found","data":null,"error":{"code":500,"title":"An unexpected error occurred","mes | 500 | server error 500 |
| `PUT /api/v1/rider/:riderId` | success/handled | {"success":false,"message":"Rider not found","data":null,"error":{"code":500,"title":"An unexpected error occurred","mes | 500 | server error 500 |
| `GET /api/v1/rider/:riderId/location` | success/handled | {"success":false,"message":"Rider not found","data":null,"error":{"code":500,"title":"An unexpected error occurred","mes | 500 | server error 500 |
| `POST /api/v1/rider/orders/:orderId/assign` | success/handled | {"success":false,"message":"Order not found","data":null,"error":{"code":500,"title":"An unexpected error occurred","mes | 500 | server error 500 |
| `POST /api/v1/rider/shifts` | success/handled | {"success":false,"message":"Invalid shift time window","data":null,"error":{"code":500,"title":"An unexpected error occu | 500 | server error 500 |
| `POST /api/v1/rider/shifts/:shiftId/assign` | success/handled | {"success":false,"message":"Missing riderId","data":null,"error":{"code":500,"title":"An unexpected error occurred","mes | 500 | server error 500 |
| `GET /api/v1/rider/shifts/:shiftId/assignments` | success/handled | {"success":false,"message":"Shift not found","data":null,"error":{"code":500,"title":"An unexpected error occurred","mes | 500 | server error 500 |
| `DELETE /api/v1/rider/shifts/:shiftId/assignments/:riderId` | success/handled | {"success":false,"message":"Shift not found","data":null,"error":{"code":500,"title":"An unexpected error occurred","mes | 500 | server error 500 |
| `POST /api/v1/rider/shifts/:shiftId/unassign` | success/handled | {"success":false,"message":"Shift not found","data":null,"error":{"code":500,"title":"An unexpected error occurred","mes | 500 | server error 500 |
| `POST /api/v1/rider/shifts/cancel` | success/handled | {"success":false,"message":"Shift not found","data":null,"error":{"code":500,"title":"An unexpected error occurred","mes | 500 | server error 500 |
| `POST /api/v1/rider/shifts/select` | success/handled | {"success":false,"message":"Missing riderId","data":null,"error":{"code":500,"title":"An unexpected error occurred","mes | 500 | server error 500 |

## 22. Blocked Endpoints

# Blocked Endpoints

Authorized happy-path for **picker** and **hhd** modules blocked (SMS OTP). Routes were still HTTP-tested (401 auth gate → PASS).

| Area | Why blocked | Required |
|------|-------------|----------|
| Picker authorized flows | No picker JWT (fixed test OTP rejected) | Real SMS / staging test OTP |
| HHD authorized flows | No HHD JWT | Real SMS / seeded HHD user |
| Payment capture webhooks | Gateway credentials | Worldline sandbox |

## 23. Security/Auth Findings

- Customer + admin tokens obtained and used for mass tests.
- Picker/HHD protected routes correctly return 401 without token.
- Several admin/rider endpoints return **500** on placeholder IDs (listed in Broken).
- Stub/mock admin system endpoints still return fake 200 success (PARTIAL).

## 24. Validation Findings

- Empty POST/PUT/PATCH bodies commonly return 400/422 (route alive).
- Analytics picker endpoints return **501** (not implemented).

## 25. Database/Data Integrity Findings

- Customer order create previously verified in DB (`customer_orders`).
- Admin dispatch vs customer orders split-brain remains a P0 integrity issue.
- Mass DELETE/PATCH used placeholder IDs — avoided destroying production-critical rows; DB Verified mostly `n/a`/`read-ok`.

## 26. Recommended Changes

1. Fix rider admin 500s and analytics 501s.
2. Unify dispatch onto `customer_orders`.
3. Resolve duplicate `/admin/picker` mounts.
4. Auth-gate/remove stubs.
5. Staging OTP strategy for picker/HHD QA.

## 27. Endpoints Safe to Consider for Removal

**Recommend only — DO NOT DELETE:**
- `/api/v1/picker/samples*`
- Admin hardcoded `system/instances` / empty `applications` stubs (replace with real or 501)
- `/api/payment/*` after Worldline v1 cutover confirmed

**Must NOT remove:** auth, cart, orders, picker shared-orders, hhd order/rack, wallet, worldline payments, health, admin orders.

## 28. Final Statistics

| Metric | Value | % of mounted |
|--------|------:|-------------:|
| Mounted / tested | 1626 | 100% |
| Unique | 1599 | |
| PASS | 1527 | 93.91% |
| FAIL | 19 | 1.17% |
| PARTIAL | 80 | 4.92% |
| BLOCKED | 0 | 0.00% |
| USED | 359 | 22.08% |
| UNKNOWN | 1178 | 72.45% |
| INTERNAL | 18 | |
| LEGACY | 14 | |
| OBSOLETE | 13 | |
| DUPLICATE rows | 44 | |
| Duplicate pairs | 27 | |

## 29. Final Verdict

| # | Question | Answer |
|---|----------|--------|
| 1 | Endpoints in backend? | **1626** mounted |
| 2 | Mounted? | **1626** |
| 3 | Actually tested? | **1626** (100%) |
| 4 | Passed? | **1527** |
| 5 | Failed? | **19** |
| 6 | Used by Customer? | **96** exact matches in customer module (+ web/app scan 80/77 paths) |
| 7 | Used by Picker? | **110** exact; picker-app scan 70 paths |
| 8 | Used by HHD? | **24** exact; hhd-app scan 26 paths |
| 9 | Used by Rider? | Rider uses **picker** APIs (scan 59 paths, 58 under /picker) |
| 10 | Used by Admin? | **125** exact; dashboard scan 90 paths; many UNKNOWN |
| 11 | Appear unused? | **1178** UNKNOWN (not proven dead) |
| 12 | Duplicates? | **27** pairs |
| 13 | Legacy? | **14** |
| 14 | Obsolete? | **13** |
| 15 | Required for production flow? | Customer auth/cart/orders, picker shared-orders, HHD orders/racks, payments, health, admin orders |
| 16 | Potentially removable? | samples stubs, fake system instances (after confirm) |
| 17 | Must NOT remove? | Order spine + auth + payments + health |
| 18 | Architecture healthy? | **NEEDS IMPROVEMENT** |
| 19 | API contract consistent? | **Partial** (rider→picker path sharing; catalog gaps) |
| 20 | Full C→P→HHD→R flow? | **Service YES / HTTP picker+HHD auth happy-path BLOCKED / admin dispatch incorrect** |

---
*Audit only. No routes deleted. Secrets masked.*