# Admin Dashboard (all admin-facing namespaces) — 1696 endpoints

| # | Method | Path | Auth | Result | HTTP | Note |
|---|--------|------|------|--------|------|------|
| 1 | GET | `/api/v1/admin/access-logs` | ADMIN | PASS | 200 | 200 OK |
| 2 | GET | `/api/v1/admin/analytics/categories` | ADMIN | PASS | 200 | 200 OK |
| 3 | POST | `/api/v1/admin/analytics/custom-report` | ADMIN | PASS | 200 | 200 OK |
| 4 | GET | `/api/v1/admin/analytics/customers` | ADMIN | PASS | 200 | 200 OK |
| 5 | GET | `/api/v1/admin/analytics/export` | ADMIN | PASS | 200 | 200 OK |
| 6 | GET | `/api/v1/admin/analytics/financial-summary` | ADMIN | PASS | 200 | 200 OK |
| 7 | GET | `/api/v1/admin/analytics/funnel` | ADMIN | PASS | 200 | 200 OK |
| 8 | GET | `/api/v1/admin/analytics/growth` | ADMIN | PASS | 200 | 200 OK |
| 9 | GET | `/api/v1/admin/analytics/inventory-health` | ADMIN | PASS | 200 | 200 OK |
| 10 | GET | `/api/v1/admin/analytics/operational` | ADMIN | PASS | 200 | 200 OK |
| 11 | GET | `/api/v1/admin/analytics/orders-by-hour` | ADMIN | PASS | 200 | 200 OK |
| 12 | GET | `/api/v1/admin/analytics/payment-methods` | ADMIN | PASS | 200 | 200 OK |
| 13 | GET | `/api/v1/admin/analytics/peak-hours` | ADMIN | PASS | 200 | 200 OK |
| 14 | GET | `/api/v1/admin/analytics/picker-drilldown/:pickerId` | ADMIN | PASS | 200 | 200 OK |
| 15 | GET | `/api/v1/admin/analytics/pickers` | ADMIN | PASS | 200 | 200 OK |
| 16 | GET | `/api/v1/admin/analytics/products` | ADMIN | PASS | 200 | 200 OK |
| 17 | GET | `/api/v1/admin/analytics/realtime` | ADMIN | PASS | 200 | 200 OK |
| 18 | GET | `/api/v1/admin/analytics/regional` | ADMIN | PASS | 200 | 200 OK |
| 19 | GET | `/api/v1/admin/analytics/revenue` | ADMIN | PASS | 200 | 200 OK |
| 20 | GET | `/api/v1/admin/analytics/rider-performance` | ADMIN | PASS | 200 | 200 OK |
| 21 | GET | `/api/v1/admin/analytics/timeseries` | ADMIN | PASS | 200 | 200 OK |
| 22 | GET | `/api/v1/admin/app-settings` | ADMIN | PASS | 200 | 200 OK |
| 23 | PUT | `/api/v1/admin/app-settings` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 24 | GET | `/api/v1/admin/applications` | ADMIN | PASS | 200 | 200 OK |
| 25 | PATCH | `/api/v1/admin/applications/:id` | ADMIN | PASS | 200 | 200 OK |
| 26 | PUT | `/api/v1/admin/applications/:id` | ADMIN | PASS | 200 | 200 OK |
| 27 | GET | `/api/v1/admin/applications/:id/health` | ADMIN | PASS | 200 | 200 OK |
| 28 | POST | `/api/v1/admin/applications/:id/test` | ADMIN | PASS | 200 | 200 OK |
| 29 | POST | `/api/v1/admin/applications/:id/test-connection` | ADMIN | PASS | 200 | 200 OK |
| 30 | GET | `/api/v1/admin/audit/logs` | ADMIN | PASS | 200 | 200 OK |
| 31 | GET | `/api/v1/admin/audit/logs/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 32 | GET | `/api/v1/admin/audit/logs/stats` | ADMIN | PASS | 200 | 200 OK |
| 33 | POST | `/api/v1/admin/auth/login` | PUBLIC | PASS | 422 | 422 validated/rejected as expected |
| 34 | POST | `/api/v1/admin/auth/logout` | PUBLIC | PASS | 200 | 200 OK |
| 35 | POST | `/api/v1/admin/cache/clear` | ADMIN | PASS | 200 | 200 OK |
| 36 | GET | `/api/v1/admin/cache/stats` | ADMIN | PASS | 200 | 200 OK |
| 37 | GET | `/api/v1/admin/cities` | ADMIN | PASS | 200 | 200 OK |
| 38 | POST | `/api/v1/admin/cities` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 39 | DELETE | `/api/v1/admin/cities/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 40 | GET | `/api/v1/admin/cities/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 41 | PUT | `/api/v1/admin/cities/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 42 | GET | `/api/v1/admin/compliance/audits` | ADMIN | PASS | 200 | 200 OK |
| 43 | POST | `/api/v1/admin/compliance/audits` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 44 | PATCH | `/api/v1/admin/compliance/audits/:auditId/findings/:findingId` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 45 | GET | `/api/v1/admin/compliance/certifications` | ADMIN | PASS | 200 | 200 OK |
| 46 | GET | `/api/v1/admin/compliance/documents` | ADMIN | PASS | 200 | 200 OK |
| 47 | POST | `/api/v1/admin/compliance/documents` | ADMIN | PASS | 201 | 201 OK |
| 48 | DELETE | `/api/v1/admin/compliance/documents/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 49 | PATCH | `/api/v1/admin/compliance/documents/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 50 | GET | `/api/v1/admin/compliance/metrics` | ADMIN | PASS | 200 | 200 OK |
| 51 | GET | `/api/v1/admin/compliance/policies` | ADMIN | PASS | 200 | 200 OK |
| 52 | POST | `/api/v1/admin/compliance/policies/:id/acknowledge` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 53 | POST | `/api/v1/admin/compliance/reports/generate` | ADMIN | PASS | 200 | 200 OK |
| 54 | GET | `/api/v1/admin/compliance/violations` | ADMIN | PASS | 200 | 200 OK |
| 55 | GET | `/api/v1/admin/customers` | ADMIN | PASS | 200 | 200 OK |
| 56 | POST | `/api/v1/admin/customers` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 57 | GET | `/api/v1/admin/customers/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 58 | PATCH | `/api/v1/admin/customers/:id` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 59 | GET | `/api/v1/admin/customers/:id/addresses` | ADMIN | PASS | 200 | 200 OK |
| 60 | GET | `/api/v1/admin/customers/:id/orders` | ADMIN | PASS | 200 | 200 OK |
| 61 | GET | `/api/v1/admin/customers/:id/password-info` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 62 | GET | `/api/v1/admin/customers/:id/payment-methods` | ADMIN | PASS | 200 | 200 OK |
| 63 | GET | `/api/v1/admin/customers/:id/refunds` | ADMIN | PASS | 200 | 200 OK |
| 64 | PUT | `/api/v1/admin/customers/:id/reset-password` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 65 | GET | `/api/v1/admin/customers/:id/risk` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 66 | PUT | `/api/v1/admin/customers/:id/set-password` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 67 | GET | `/api/v1/admin/customers/:id/tickets` | ADMIN | PASS | 200 | 200 OK |
| 68 | GET | `/api/v1/admin/customers/:id/wallet` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 69 | POST | `/api/v1/admin/customers/:id/wallet/credit` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 70 | GET | `/api/v1/admin/customers/stats` | ADMIN | PASS | 200 | 200 OK |
| 71 | GET | `/api/v1/admin/darkstore-users` | ADMIN | PASS | 200 | 200 OK |
| 72 | POST | `/api/v1/admin/darkstore-users` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 73 | DELETE | `/api/v1/admin/darkstore-users/:id` | ADMIN | PASS | 200 | 200 OK |
| 74 | PUT | `/api/v1/admin/darkstore-users/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 75 | GET | `/api/v1/admin/darkstores` | ADMIN | PASS | 200 | 200 OK |
| 76 | POST | `/api/v1/admin/darkstores` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 77 | DELETE | `/api/v1/admin/darkstores/:id` | ADMIN | PASS | 200 | 200 OK |
| 78 | PUT | `/api/v1/admin/darkstores/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 79 | GET | `/api/v1/admin/darkstores/:storeId/inventory` | ADMIN | PASS | 200 | 200 OK |
| 80 | PUT | `/api/v1/admin/darkstores/:storeId/inventory` | ADMIN | PASS | 200 | 200 OK |
| 81 | POST | `/api/v1/admin/darkstores/:storeId/inventory/sync` | ADMIN | PASS | 201 | 201 OK |
| 82 | POST | `/api/v1/admin/darkstores/:storeId/replenish` | ADMIN | PASS | 201 | 201 OK |
| 83 | GET | `/api/v1/admin/finance/accounting/accounts` | ADMIN | PASS | 200 | 200 OK |
| 84 | POST | `/api/v1/admin/finance/accounting/journal` | ADMIN | PASS | 201 | 201 OK |
| 85 | GET | `/api/v1/admin/finance/accounting/journal/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 86 | GET | `/api/v1/admin/finance/accounting/ledger` | ADMIN | PASS | 200 | 200 OK |
| 87 | GET | `/api/v1/admin/finance/accounting/summary` | ADMIN | PASS | 200 | 200 OK |
| 88 | POST | `/api/v1/admin/finance/accounting/sync` | ADMIN | PASS | 200 | 200 OK |
| 89 | GET | `/api/v1/admin/finance/alerts` | ADMIN | PASS | 200 | 200 OK |
| 90 | GET | `/api/v1/admin/finance/alerts/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 91 | POST | `/api/v1/admin/finance/alerts/:id/action` | ADMIN | PASS | 200 | 200 OK |
| 92 | POST | `/api/v1/admin/finance/alerts/clear-resolved` | ADMIN | PASS | 200 | 200 OK |
| 93 | DELETE | `/api/v1/admin/finance/alerts/resolved` | ADMIN | PASS | 200 | 200 OK |
| 94 | POST | `/api/v1/admin/finance/alerts/resolved/clear` | ADMIN | PASS | 200 | 200 OK |
| 95 | GET | `/api/v1/admin/finance/analytics/cash-flow` | ADMIN | PASS | 200 | 200 OK |
| 96 | GET | `/api/v1/admin/finance/analytics/expense-breakdown` | ADMIN | PASS | 200 | 200 OK |
| 97 | POST | `/api/v1/admin/finance/analytics/export` | ADMIN | PASS | 200 | 200 OK |
| 98 | GET | `/api/v1/admin/finance/analytics/revenue-growth` | ADMIN | PASS | 200 | 200 OK |
| 99 | GET | `/api/v1/admin/finance/approvals` | ADMIN | PASS | 200 | 200 OK |
| 100 | GET | `/api/v1/admin/finance/approvals/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 101 | POST | `/api/v1/admin/finance/approvals/:id/decision` | ADMIN | PASS | 200 | 200 OK |
| 102 | GET | `/api/v1/admin/finance/approvals/summary` | ADMIN | PASS | 200 | 200 OK |
| 103 | GET | `/api/v1/admin/finance/approvals/tasks` | ADMIN | PASS | 200 | 200 OK |
| 104 | GET | `/api/v1/admin/finance/approvals/tasks/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 105 | POST | `/api/v1/admin/finance/approvals/tasks/:id/decision` | ADMIN | PASS | 200 | 200 OK |
| 106 | GET | `/api/v1/admin/finance/config/commission-slabs` | ADMIN | PASS | 200 | 200 OK |
| 107 | POST | `/api/v1/admin/finance/config/commission-slabs` | ADMIN | PASS | 201 | 201 OK |
| 108 | PUT | `/api/v1/admin/finance/config/commission-slabs/:slabId` | ADMIN | PASS | 200 | 200 OK |
| 109 | GET | `/api/v1/admin/finance/config/financial-limits` | ADMIN | PASS | 200 | 200 OK |
| 110 | PUT | `/api/v1/admin/finance/config/financial-limits/:limitId` | ADMIN | PASS | 200 | 200 OK |
| 111 | GET | `/api/v1/admin/finance/config/financial-year` | ADMIN | PASS | 200 | 200 OK |
| 112 | PUT | `/api/v1/admin/finance/config/financial-year` | ADMIN | PASS | 200 | 200 OK |
| 113 | GET | `/api/v1/admin/finance/config/invoice-settings` | ADMIN | PASS | 200 | 200 OK |
| 114 | PUT | `/api/v1/admin/finance/config/invoice-settings` | ADMIN | PASS | 200 | 200 OK |
| 115 | GET | `/api/v1/admin/finance/config/payment-terms` | ADMIN | PASS | 200 | 200 OK |
| 116 | PUT | `/api/v1/admin/finance/config/payment-terms/:termId` | ADMIN | PASS | 200 | 200 OK |
| 117 | GET | `/api/v1/admin/finance/config/payout-schedules` | ADMIN | PASS | 200 | 200 OK |
| 118 | POST | `/api/v1/admin/finance/config/payout-schedules` | ADMIN | PASS | 201 | 201 OK |
| 119 | PUT | `/api/v1/admin/finance/config/payout-schedules/:scheduleId` | ADMIN | PASS | 200 | 200 OK |
| 120 | GET | `/api/v1/admin/finance/config/reconciliation-rules` | ADMIN | PASS | 200 | 200 OK |
| 121 | PUT | `/api/v1/admin/finance/config/reconciliation-rules/:ruleId` | ADMIN | PASS | 200 | 200 OK |
| 122 | GET | `/api/v1/admin/finance/config/refund-policies` | ADMIN | PASS | 200 | 200 OK |
| 123 | PUT | `/api/v1/admin/finance/config/refund-policies/:policyId` | ADMIN | PASS | 200 | 200 OK |
| 124 | GET | `/api/v1/admin/finance/config/tax-rules` | ADMIN | PASS | 200 | 200 OK |
| 125 | POST | `/api/v1/admin/finance/config/tax-rules` | ADMIN | PASS | 201 | 201 OK |
| 126 | PUT | `/api/v1/admin/finance/config/tax-rules/:ruleId` | ADMIN | PASS | 200 | 200 OK |
| 127 | GET | `/api/v1/admin/finance/customer-payments` | ADMIN | PASS | 200 | 200 OK |
| 128 | GET | `/api/v1/admin/finance/customer-payments/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 129 | POST | `/api/v1/admin/finance/customer-payments/:id/retry` | ADMIN | PASS | 200 | 200 OK |
| 130 | GET | `/api/v1/admin/finance/dashboard/daily-metrics` | ADMIN | PASS | 200 | 200 OK |
| 131 | POST | `/api/v1/admin/finance/dashboard/export` | ADMIN | PASS | 200 | 200 OK |
| 132 | GET | `/api/v1/admin/finance/dashboard/gateway-status` | ADMIN | PASS | 200 | 200 OK |
| 133 | GET | `/api/v1/admin/finance/dashboard/hourly-trends` | ADMIN | PASS | 200 | 200 OK |
| 134 | GET | `/api/v1/admin/finance/dashboard/live-transactions` | ADMIN | PASS | 200 | 200 OK |
| 135 | GET | `/api/v1/admin/finance/dashboard/payment-method-split` | ADMIN | PASS | 200 | 200 OK |
| 136 | GET | `/api/v1/admin/finance/dashboard/summary` | ADMIN | PASS | 200 | 200 OK |
| 137 | GET | `/api/v1/admin/finance/dashboard/wallet-liability` | ADMIN | PASS | 200 | 200 OK |
| 138 | GET | `/api/v1/admin/finance/invoices` | ADMIN | PASS | 200 | 200 OK |
| 139 | POST | `/api/v1/admin/finance/invoices` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 140 | GET | `/api/v1/admin/finance/invoices/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 141 | POST | `/api/v1/admin/finance/invoices/:id/mark-paid` | ADMIN | PASS | 200 | 200 OK |
| 142 | POST | `/api/v1/admin/finance/invoices/:id/reminder` | ADMIN | PASS | 200 | 200 OK |
| 143 | POST | `/api/v1/admin/finance/invoices/:id/send` | ADMIN | PASS | 200 | 200 OK |
| 144 | POST | `/api/v1/admin/finance/invoices/:id/send-reminder` | ADMIN | PASS | 200 | 200 OK |
| 145 | PATCH | `/api/v1/admin/finance/invoices/:id/status` | ADMIN | PASS | 200 | 200 OK |
| 146 | GET | `/api/v1/admin/finance/invoices/summary` | ADMIN | PASS | 200 | 200 OK |
| 147 | GET | `/api/v1/admin/finance/picker-attendance` | ADMIN | PASS | 200 | 200 OK |
| 148 | GET | `/api/v1/admin/finance/picker-earnings/:pickerId/breakdown` | ADMIN | PASS | 200 | 200 OK |
| 149 | GET | `/api/v1/admin/finance/picker-earnings/:pickerId/wallet` | ADMIN | PASS | 200 | 200 OK |
| 150 | GET | `/api/v1/admin/finance/picker-transactions` | ADMIN | PASS | 200 | 200 OK |
| 151 | GET | `/api/v1/admin/finance/picker-withdrawals` | ADMIN | PASS | 200 | 200 OK |
| 152 | GET | `/api/v1/admin/finance/picker-withdrawals/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 153 | PATCH | `/api/v1/admin/finance/picker-withdrawals/:id` | ADMIN | PASS | 200 | 200 OK |
| 154 | GET | `/api/v1/admin/finance/picker-withdrawals/:pickerId/earnings-breakdown` | ADMIN | PASS | 200 | 200 OK |
| 155 | GET | `/api/v1/admin/finance/picker-withdrawals/:pickerId/wallet-balance` | ADMIN | PASS | 200 | 200 OK |
| 156 | GET | `/api/v1/admin/finance/reconciliation/exceptions` | ADMIN | PASS | 200 | 200 OK |
| 157 | POST | `/api/v1/admin/finance/reconciliation/exceptions/:id/investigate` | ADMIN | PASS | 200 | 200 OK |
| 158 | POST | `/api/v1/admin/finance/reconciliation/exceptions/:id/resolve` | ADMIN | PASS | 200 | 200 OK |
| 159 | GET | `/api/v1/admin/finance/reconciliation/gateways` | ADMIN | PASS | 200 | 200 OK |
| 160 | GET | `/api/v1/admin/finance/reconciliation/gateways/:id` | ADMIN | PASS | 200 | 200 OK |
| 161 | POST | `/api/v1/admin/finance/reconciliation/run` | ADMIN | PASS | 200 | 200 OK |
| 162 | GET | `/api/v1/admin/finance/reconciliation/runs/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 163 | GET | `/api/v1/admin/finance/reconciliation/summary` | ADMIN | PASS | 200 | 200 OK |
| 164 | GET | `/api/v1/admin/finance/refunds/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 165 | POST | `/api/v1/admin/finance/refunds/:id/approve` | ADMIN | PASS | 200 | 200 OK |
| 166 | POST | `/api/v1/admin/finance/refunds/:id/complete` | ADMIN | PASS | 200 | 200 OK |
| 167 | POST | `/api/v1/admin/finance/refunds/:id/mark-completed` | ADMIN | PASS | 200 | 200 OK |
| 168 | POST | `/api/v1/admin/finance/refunds/:id/reject` | ADMIN | PASS | 200 | 200 OK |
| 169 | GET | `/api/v1/admin/finance/refunds/chargebacks` | ADMIN | PASS | 200 | 200 OK |
| 170 | GET | `/api/v1/admin/finance/refunds/queue` | ADMIN | PASS | 200 | 200 OK |
| 171 | GET | `/api/v1/admin/finance/refunds/summary` | ADMIN | PASS | 200 | 200 OK |
| 172 | GET | `/api/v1/admin/finance/refunds/wallet-transactions` | ADMIN | PASS | 200 | 200 OK |
| 173 | GET | `/api/v1/admin/finance/rider-cash/:riderId` | ADMIN | PASS | 200 | 200 OK |
| 174 | GET | `/api/v1/admin/finance/rider-cash/cod-reconciliation` | ADMIN | PASS | 200 | 200 OK |
| 175 | GET | `/api/v1/admin/finance/rider-cash/payouts` | ADMIN | PASS | 200 | 200 OK |
| 176 | GET | `/api/v1/admin/finance/rider-cash/riders/:riderId/payment-details` | ADMIN | PASS | 200 | 200 OK |
| 177 | GET | `/api/v1/admin/finance/rider-cash/summary` | ADMIN | PASS | 200 | 200 OK |
| 178 | GET | `/api/v1/admin/finance/vendor-payments/invoices` | ADMIN | PASS | 200 | 200 OK |
| 179 | POST | `/api/v1/admin/finance/vendor-payments/invoices` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 180 | GET | `/api/v1/admin/finance/vendor-payments/invoices/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 181 | POST | `/api/v1/admin/finance/vendor-payments/invoices/:id/approve` | ADMIN | PASS | 200 | 200 OK |
| 182 | POST | `/api/v1/admin/finance/vendor-payments/invoices/:id/mark-paid` | ADMIN | PASS | 200 | 200 OK |
| 183 | POST | `/api/v1/admin/finance/vendor-payments/invoices/:id/reject` | ADMIN | PASS | 200 | 200 OK |
| 184 | POST | `/api/v1/admin/finance/vendor-payments/invoices/bulk-approve` | ADMIN | PASS | 200 | 200 OK |
| 185 | GET | `/api/v1/admin/finance/vendor-payments/payments` | ADMIN | PASS | 200 | 200 OK |
| 186 | POST | `/api/v1/admin/finance/vendor-payments/payments` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 187 | GET | `/api/v1/admin/finance/vendor-payments/payments/:paymentId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 188 | POST | `/api/v1/admin/finance/vendor-payments/payments/:paymentId/advance` | ADMIN | PASS | 200 | 200 OK |
| 189 | POST | `/api/v1/admin/finance/vendor-payments/payments/:paymentId/cancel` | ADMIN | PASS | 200 | 200 OK |
| 190 | POST | `/api/v1/admin/finance/vendor-payments/payments/:paymentId/invoices/:invoiceId/workflow/advance` | ADMIN | PASS | 200 | 200 OK |
| 191 | GET | `/api/v1/admin/finance/vendor-payments/summary` | ADMIN | PASS | 200 | 200 OK |
| 192 | GET | `/api/v1/admin/finance/vendor-payments/vendors` | ADMIN | PASS | 200 | 200 OK |
| 193 | GET | `/api/v1/admin/finance/wallet-transactions` | ADMIN | PASS | 200 | 200 OK |
| 194 | GET | `/api/v1/admin/fraud/alerts` | ADMIN | PASS | 200 | 200 OK |
| 195 | GET | `/api/v1/admin/fraud/alerts/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 196 | PATCH | `/api/v1/admin/fraud/alerts/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 197 | GET | `/api/v1/admin/fraud/blocked` | ADMIN | PASS | 200 | 200 OK |
| 198 | POST | `/api/v1/admin/fraud/blocked` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 199 | DELETE | `/api/v1/admin/fraud/blocked/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 200 | GET | `/api/v1/admin/fraud/chargebacks` | ADMIN | PASS | 200 | 200 OK |
| 201 | PATCH | `/api/v1/admin/fraud/chargebacks/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 202 | GET | `/api/v1/admin/fraud/investigations` | ADMIN | PASS | 200 | 200 OK |
| 203 | GET | `/api/v1/admin/fraud/metrics` | ADMIN | PASS | 200 | 200 OK |
| 204 | GET | `/api/v1/admin/fraud/patterns` | ADMIN | PASS | 200 | 200 OK |
| 205 | GET | `/api/v1/admin/fraud/risk-profiles` | ADMIN | PASS | 200 | 200 OK |
| 206 | GET | `/api/v1/admin/fraud/rules` | ADMIN | PASS | 200 | 200 OK |
| 207 | PATCH | `/api/v1/admin/fraud/rules/:id/toggle` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 208 | GET | `/api/v1/admin/integrations` | ADMIN | PASS | 200 | 200 OK |
| 209 | PATCH | `/api/v1/admin/integrations/:id` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 210 | PUT | `/api/v1/admin/integrations/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 211 | POST | `/api/v1/admin/integrations/:id/test` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 212 | GET | `/api/v1/admin/integrations/api-keys` | ADMIN | PASS | 200 | 200 OK |
| 213 | POST | `/api/v1/admin/integrations/api-keys` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 214 | DELETE | `/api/v1/admin/integrations/api-keys/:keyId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 215 | GET | `/api/v1/admin/integrations/health` | ADMIN | PASS | 200 | 200 OK |
| 216 | GET | `/api/v1/admin/integrations/logs` | ADMIN | PASS | 200 | 200 OK |
| 217 | GET | `/api/v1/admin/integrations/stats` | ADMIN | PASS | 200 | 200 OK |
| 218 | GET | `/api/v1/admin/integrations/webhooks` | ADMIN | PASS | 200 | 200 OK |
| 219 | POST | `/api/v1/admin/integrations/webhooks` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 220 | POST | `/api/v1/admin/integrations/webhooks/:webhookId/retry` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 221 | GET | `/api/v1/admin/mastersheet/active` | ADMIN | PASS | 200 | 200 OK |
| 222 | POST | `/api/v1/admin/mastersheet/finalize` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 223 | GET | `/api/v1/admin/mastersheet/history` | ADMIN | PASS | 200 | 200 OK |
| 224 | POST | `/api/v1/admin/mastersheet/history` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 225 | POST | `/api/v1/admin/mastersheet/prepare` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 226 | POST | `/api/v1/admin/mastersheet/process/:sheet` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 227 | GET | `/api/v1/admin/mastersheet/template` | ADMIN | PASS | 200 | 200 OK |
| 228 | GET | `/api/v1/admin/notifications/analytics` | ADMIN | PASS | 200 | 200 OK |
| 229 | GET | `/api/v1/admin/notifications/automation` | ADMIN | PASS | 200 | 200 OK |
| 230 | POST | `/api/v1/admin/notifications/automation` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 231 | PUT | `/api/v1/admin/notifications/automation/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 232 | GET | `/api/v1/admin/notifications/campaigns` | ADMIN | PASS | 200 | 200 OK |
| 233 | POST | `/api/v1/admin/notifications/campaigns` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 234 | GET | `/api/v1/admin/notifications/campaigns/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 235 | PUT | `/api/v1/admin/notifications/campaigns/:id` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 236 | GET | `/api/v1/admin/notifications/channels` | ADMIN | PASS | 200 | 200 OK |
| 237 | GET | `/api/v1/admin/notifications/history` | ADMIN | PASS | 200 | 200 OK |
| 238 | POST | `/api/v1/admin/notifications/history/:id/retry` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 239 | POST | `/api/v1/admin/notifications/history/retry-failed` | ADMIN | PASS | 200 | 200 OK |
| 240 | GET | `/api/v1/admin/notifications/scheduled` | ADMIN | PASS | 200 | 200 OK |
| 241 | GET | `/api/v1/admin/notifications/templates` | ADMIN | PASS | 200 | 200 OK |
| 242 | POST | `/api/v1/admin/notifications/templates` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 243 | DELETE | `/api/v1/admin/notifications/templates/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 244 | PUT | `/api/v1/admin/notifications/templates/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 245 | GET | `/api/v1/admin/notifications/timeseries` | ADMIN | PASS | 200 | 200 OK |
| 246 | GET | `/api/v1/admin/orders` | ADMIN | PASS | 200 | 200 OK |
| 247 | GET | `/api/v1/admin/orders` | ADMIN | PASS | 200 | 200 OK |
| 248 | POST | `/api/v1/admin/orders` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 249 | GET | `/api/v1/admin/orders/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 250 | GET | `/api/v1/admin/orders/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 251 | GET | `/api/v1/admin/orders/:id/logs` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 252 | GET | `/api/v1/admin/orders/:id/logs` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 253 | PUT | `/api/v1/admin/orders/:id/update-status` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 254 | GET | `/api/v1/admin/permissions` | ADMIN | PASS | 200 | 200 OK |
| 255 | POST | `/api/v1/admin/permissions` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 256 | DELETE | `/api/v1/admin/permissions/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 257 | GET | `/api/v1/admin/permissions/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 258 | PUT | `/api/v1/admin/permissions/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 259 | GET | `/api/v1/admin/permissions/matrix` | ADMIN | PASS | 200 | 200 OK |
| 260 | GET | `/api/v1/admin/picker-action-logs` | ADMIN | PASS | 200 | 200 OK |
| 261 | GET | `/api/v1/admin/picker-config` | ADMIN | PASS | 200 | 200 OK |
| 262 | PUT | `/api/v1/admin/picker-config` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 263 | GET | `/api/v1/admin/picker/agencies` | ADMIN | PASS | 200 | 200 OK |
| 264 | GET | `/api/v1/admin/picker/agencies` | ADMIN | PASS | 200 | 200 OK |
| 265 | POST | `/api/v1/admin/picker/agencies` | ADMIN | PASS | 201 | 201 OK |
| 266 | POST | `/api/v1/admin/picker/agencies` | ADMIN | PASS | 201 | 201 OK |
| 267 | POST | `/api/v1/admin/picker/agencies/:agencyId/activate` | ADMIN | PASS | 200 | 200 OK |
| 268 | POST | `/api/v1/admin/picker/agencies/:agencyId/activate` | ADMIN | PASS | 200 | 200 OK |
| 269 | POST | `/api/v1/admin/picker/agencies/:agencyId/deactivate` | ADMIN | PASS | 200 | 200 OK |
| 270 | POST | `/api/v1/admin/picker/agencies/:agencyId/deactivate` | ADMIN | PASS | 200 | 200 OK |
| 271 | GET | `/api/v1/admin/picker/approvals` | ADMIN | PASS | 200 | 200 OK |
| 272 | GET | `/api/v1/admin/picker/approvals` | ADMIN | PASS | 200 | 200 OK |
| 273 | GET | `/api/v1/admin/picker/attendance` | ADMIN | PASS | 200 | 200 OK |
| 274 | GET | `/api/v1/admin/picker/attendance` | ADMIN | PASS | 200 | 200 OK |
| 275 | GET | `/api/v1/admin/picker/attendance/export` | ADMIN | PASS | 200 | 200 OK |
| 276 | GET | `/api/v1/admin/picker/attendance/export` | ADMIN | PASS | 200 | 200 OK |
| 277 | GET | `/api/v1/admin/picker/attendance/live` | ADMIN | PASS | 200 | 200 OK |
| 278 | GET | `/api/v1/admin/picker/devices` | ADMIN | PASS | 200 | 200 OK |
| 279 | DELETE | `/api/v1/admin/picker/devices/:deviceId/unassign` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 280 | POST | `/api/v1/admin/picker/devices/assign` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 281 | PUT | `/api/v1/admin/picker/documents/:documentId/review` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 282 | GET | `/api/v1/admin/picker/ot-requests` | ADMIN | PASS | 200 | 200 OK |
| 283 | GET | `/api/v1/admin/picker/ot-requests` | ADMIN | PASS | 200 | 200 OK |
| 284 | POST | `/api/v1/admin/picker/ot-requests/:requestId/decision` | ADMIN | PASS | 200 | 200 OK |
| 285 | POST | `/api/v1/admin/picker/ot-requests/:requestId/decision` | ADMIN | PASS | 200 | 200 OK |
| 286 | GET | `/api/v1/admin/picker/payout-verifications` | ADMIN | PASS | 200 | 200 OK |
| 287 | GET | `/api/v1/admin/picker/pickers` | ADMIN | PASS | 200 | 200 OK |
| 288 | GET | `/api/v1/admin/picker/pickers` | ADMIN | PASS | 200 | 200 OK |
| 289 | GET | `/api/v1/admin/picker/pickers/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 290 | GET | `/api/v1/admin/picker/pickers/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 291 | GET | `/api/v1/admin/picker/pickers/:id/action-logs` | ADMIN | PASS | 200 | 200 OK |
| 292 | GET | `/api/v1/admin/picker/pickers/:id/action-logs` | ADMIN | PASS | 200 | 200 OK |
| 293 | PATCH | `/api/v1/admin/picker/pickers/:id/bank/:accountId/review` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 294 | PATCH | `/api/v1/admin/picker/pickers/:id/bank/:accountId/review` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 295 | PATCH | `/api/v1/admin/picker/pickers/:id/documents/review` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 296 | PATCH | `/api/v1/admin/picker/pickers/:id/documents/review` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 297 | GET | `/api/v1/admin/picker/pickers/:id/face-verification` | ADMIN | PASS | 200 | 200 OK |
| 298 | GET | `/api/v1/admin/picker/pickers/:id/face-verification` | ADMIN | PASS | 200 | 200 OK |
| 299 | PATCH | `/api/v1/admin/picker/pickers/:id/face-verification/override` | ADMIN | PASS | 200 | 200 OK |
| 300 | PATCH | `/api/v1/admin/picker/pickers/:id/face-verification/override` | ADMIN | PASS | 200 | 200 OK |
| 301 | DELETE | `/api/v1/admin/picker/pickers/:id/link-hhd` | ADMIN | PASS | 200 | 200 OK |
| 302 | DELETE | `/api/v1/admin/picker/pickers/:id/link-hhd` | ADMIN | PASS | 200 | 200 OK |
| 303 | POST | `/api/v1/admin/picker/pickers/:id/link-hhd` | ADMIN | PASS | 200 | 200 OK |
| 304 | POST | `/api/v1/admin/picker/pickers/:id/link-hhd` | ADMIN | PASS | 200 | 200 OK |
| 305 | PATCH | `/api/v1/admin/picker/pickers/:id/status` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 306 | PATCH | `/api/v1/admin/picker/pickers/:id/status` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 307 | GET | `/api/v1/admin/picker/pickers/:id/training-progress` | ADMIN | PASS | 200 | 200 OK |
| 308 | GET | `/api/v1/admin/picker/pickers/:id/training-progress` | ADMIN | PASS | 200 | 200 OK |
| 309 | PATCH | `/api/v1/admin/picker/pickers/:id/upi/review` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 310 | PUT | `/api/v1/admin/picker/pickers/:pickerId/approve` | ADMIN | PASS | 200 | 200 OK |
| 311 | PATCH | `/api/v1/admin/picker/pickers/:pickerId/assignment` | ADMIN | PASS | 200 | 200 OK |
| 312 | PATCH | `/api/v1/admin/picker/pickers/:pickerId/assignment` | ADMIN | PASS | 200 | 200 OK |
| 313 | POST | `/api/v1/admin/picker/pickers/:pickerId/push` | ADMIN | PASS | 200 | 200 OK |
| 314 | POST | `/api/v1/admin/picker/pickers/:pickerId/push` | ADMIN | PASS | 200 | 200 OK |
| 315 | PUT | `/api/v1/admin/picker/pickers/:pickerId/reject` | ADMIN | PASS | 200 | 200 OK |
| 316 | GET | `/api/v1/admin/picker/shift-change-requests` | ADMIN | PASS | 200 | 200 OK |
| 317 | GET | `/api/v1/admin/picker/shift-change-requests` | ADMIN | PASS | 200 | 200 OK |
| 318 | POST | `/api/v1/admin/picker/shift-change-requests/:requestId/decision` | ADMIN | PASS | 200 | 200 OK |
| 319 | POST | `/api/v1/admin/picker/shift-change-requests/:requestId/decision` | ADMIN | PASS | 200 | 200 OK |
| 320 | POST | `/api/v1/admin/picker/shifts/:shiftId/reassign` | ADMIN | PASS | 200 | 200 OK |
| 321 | GET | `/api/v1/admin/picker/stores/:storeId/shift-slots` | ADMIN | PASS | 200 | 200 OK |
| 322 | GET | `/api/v1/admin/picker/stores/:storeId/shift-slots` | ADMIN | PASS | 200 | 200 OK |
| 323 | POST | `/api/v1/admin/picker/stores/:storeId/shift-slots` | ADMIN | PASS | 201 | 201 OK |
| 324 | POST | `/api/v1/admin/picker/stores/:storeId/shift-slots` | ADMIN | PASS | 201 | 201 OK |
| 325 | GET | `/api/v1/admin/picker/withdrawals` | ADMIN | PASS | 200 | 200 OK |
| 326 | PUT | `/api/v1/admin/picker/withdrawals/:requestId/process` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 327 | GET | `/api/v1/admin/pickers` | ADMIN | PASS | 200 | 200 OK |
| 328 | GET | `/api/v1/admin/pickers/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 329 | PATCH | `/api/v1/admin/pickers/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 330 | GET | `/api/v1/admin/pickers/:id/action-logs` | ADMIN | PASS | 200 | 200 OK |
| 331 | PATCH | `/api/v1/admin/pickers/:id/bank/:accountId/review` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 332 | PATCH | `/api/v1/admin/pickers/:id/documents/review` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 333 | GET | `/api/v1/admin/pickers/:id/face-verification` | ADMIN | PASS | 200 | 200 OK |
| 334 | PATCH | `/api/v1/admin/pickers/:id/face-verification/override` | ADMIN | PASS | 200 | 200 OK |
| 335 | DELETE | `/api/v1/admin/pickers/:id/link-hhd` | ADMIN | PASS | 200 | 200 OK |
| 336 | POST | `/api/v1/admin/pickers/:id/link-hhd` | ADMIN | PASS | 200 | 200 OK |
| 337 | GET | `/api/v1/admin/pickers/:id/training-progress` | ADMIN | PASS | 200 | 200 OK |
| 338 | GET | `/api/v1/admin/platform-config` | ADMIN | PASS | 200 | 200 OK |
| 339 | DELETE | `/api/v1/admin/platform-config/:key` | ADMIN | PASS | 200 | 200 OK |
| 340 | GET | `/api/v1/admin/platform-config/:key` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 341 | PUT | `/api/v1/admin/platform-config/:key` | ADMIN | PASS | 200 | 200 OK |
| 342 | GET | `/api/v1/admin/products` | ADMIN | PASS | 200 | 200 OK |
| 343 | POST | `/api/v1/admin/products` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 344 | DELETE | `/api/v1/admin/products/:id` | ADMIN | PASS | 200 | 200 OK |
| 345 | GET | `/api/v1/admin/products/:id` | ADMIN | PASS | 200 | 200 OK |
| 346 | PUT | `/api/v1/admin/products/:id` | ADMIN | PASS | 200 | 200 OK |
| 347 | POST | `/api/v1/admin/products/bulk-upload` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 348 | GET | `/api/v1/admin/products/bulk-upload/template` | ADMIN | PASS | 200 | 200 OK |
| 349 | POST | `/api/v1/admin/products/upload-image` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 350 | GET | `/api/v1/admin/riders` | ADMIN | PASS | 200 | 200 OK |
| 351 | GET | `/api/v1/admin/riders/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 352 | PATCH | `/api/v1/admin/riders/:id/status` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 353 | GET | `/api/v1/admin/roles` | ADMIN | PASS | 200 | 200 OK |
| 354 | POST | `/api/v1/admin/roles` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 355 | DELETE | `/api/v1/admin/roles/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 356 | GET | `/api/v1/admin/roles/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 357 | PUT | `/api/v1/admin/roles/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 358 | GET | `/api/v1/admin/roles/:id/export` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 359 | PUT | `/api/v1/admin/roles/:id/matrix` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 360 | POST | `/api/v1/admin/roles/from-template` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 361 | POST | `/api/v1/admin/roles/import` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 362 | GET | `/api/v1/admin/roles/templates` | ADMIN | PASS | 200 | 200 OK |
| 363 | GET | `/api/v1/admin/sessions` | ADMIN | PASS | 200 | 200 OK |
| 364 | DELETE | `/api/v1/admin/sessions/:id` | ADMIN | PASS | 200 | 200 OK |
| 365 | GET | `/api/v1/admin/sku-units` | ADMIN | PASS | 200 | 200 OK |
| 366 | POST | `/api/v1/admin/sku-units` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 367 | DELETE | `/api/v1/admin/sku-units/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 368 | GET | `/api/v1/admin/sku-units/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 369 | PUT | `/api/v1/admin/sku-units/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 370 | GET | `/api/v1/admin/staff` | ADMIN | PASS | 200 | 200 OK |
| 371 | GET | `/api/v1/admin/staff` | ADMIN | PASS | 200 | 200 OK |
| 372 | POST | `/api/v1/admin/staff` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 373 | DELETE | `/api/v1/admin/staff/:id` | ADMIN | PASS | 200 | 200 OK |
| 374 | GET | `/api/v1/admin/staff/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 375 | PUT | `/api/v1/admin/staff/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 376 | GET | `/api/v1/admin/staff/shifts` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 377 | POST | `/api/v1/admin/staff/shifts` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 378 | GET | `/api/v1/admin/staff/shifts/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 379 | PUT | `/api/v1/admin/staff/shifts/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 380 | GET | `/api/v1/admin/staff/summary` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 381 | GET | `/api/v1/admin/store-warehouse/bins` | ADMIN | PASS | 200 | 200 OK |
| 382 | GET | `/api/v1/admin/store-warehouse/bins/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 383 | GET | `/api/v1/admin/store-warehouse/delivery-zones` | ADMIN | PASS | 200 | 200 OK |
| 384 | GET | `/api/v1/admin/store-warehouse/grns` | ADMIN | PASS | 200 | 200 OK |
| 385 | GET | `/api/v1/admin/store-warehouse/grns/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 386 | GET | `/api/v1/admin/store-warehouse/inventories` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 387 | POST | `/api/v1/admin/store-warehouse/inventories` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 388 | DELETE | `/api/v1/admin/store-warehouse/inventories/:id` | ADMIN | PASS | 200 | 200 OK |
| 389 | GET | `/api/v1/admin/store-warehouse/inventories/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 390 | PUT | `/api/v1/admin/store-warehouse/inventories/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 391 | GET | `/api/v1/admin/store-warehouse/putaway` | ADMIN | PASS | 200 | 200 OK |
| 392 | GET | `/api/v1/admin/store-warehouse/stock-movements` | ADMIN | PASS | 200 | 200 OK |
| 393 | GET | `/api/v1/admin/store-warehouse/warehouse-inventory` | ADMIN | PASS | 200 | 200 OK |
| 394 | POST | `/api/v1/admin/store-warehouse/warehouse-inventory` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 395 | DELETE | `/api/v1/admin/store-warehouse/warehouse-inventory/:id` | ADMIN | PASS | 200 | 200 OK |
| 396 | PUT | `/api/v1/admin/store-warehouse/warehouse-inventory/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 397 | GET | `/api/v1/admin/stores` | ADMIN | PASS | 200 | 200 OK |
| 398 | POST | `/api/v1/admin/stores` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 399 | DELETE | `/api/v1/admin/stores/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 400 | GET | `/api/v1/admin/stores/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 401 | PUT | `/api/v1/admin/stores/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 402 | GET | `/api/v1/admin/stores/performance` | ADMIN | PASS | 200 | 200 OK |
| 403 | GET | `/api/v1/admin/stores/stats` | ADMIN | PASS | 200 | 200 OK |
| 404 | GET | `/api/v1/admin/support-chat/conversations` | ADMIN | PASS | 200 | 200 OK |
| 405 | GET | `/api/v1/admin/support-chat/conversations/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 406 | GET | `/api/v1/admin/support-chat/conversations/:id/context` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 407 | POST | `/api/v1/admin/support-chat/conversations/:id/messages` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 408 | POST | `/api/v1/admin/support-chat/conversations/:id/read` | ADMIN | PASS | 200 | 200 OK |
| 409 | PATCH | `/api/v1/admin/support-chat/conversations/:id/status` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 410 | GET | `/api/v1/admin/support/agents` | ADMIN | PASS | 200 | 200 OK |
| 411 | GET | `/api/v1/admin/support/canned-responses` | ADMIN | PASS | 200 | 200 OK |
| 412 | GET | `/api/v1/admin/support/categories` | ADMIN | PASS | 200 | 200 OK |
| 413 | GET | `/api/v1/admin/support/faqs` | ADMIN | PASS | 200 | 200 OK |
| 414 | POST | `/api/v1/admin/support/faqs` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 415 | DELETE | `/api/v1/admin/support/faqs/:id` | ADMIN | PASS | 200 | 200 OK |
| 416 | PATCH | `/api/v1/admin/support/faqs/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 417 | GET | `/api/v1/admin/support/feedback` | ADMIN | PASS | 200 | 200 OK |
| 418 | GET | `/api/v1/admin/support/live-chats` | ADMIN | PASS | 200 | 200 OK |
| 419 | POST | `/api/v1/admin/support/live-chats/:id/accept` | ADMIN | PASS | 200 | 200 OK |
| 420 | POST | `/api/v1/admin/support/live-chats/:id/messages` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 421 | GET | `/api/v1/admin/support/sla-metrics` | ADMIN | PASS | 200 | 200 OK |
| 422 | GET | `/api/v1/admin/support/tickets` | ADMIN | PASS | 200 | 200 OK |
| 423 | POST | `/api/v1/admin/support/tickets` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 424 | GET | `/api/v1/admin/support/tickets/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 425 | PATCH | `/api/v1/admin/support/tickets/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 426 | POST | `/api/v1/admin/support/tickets/:id/assign` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 427 | POST | `/api/v1/admin/support/tickets/:id/close` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 428 | POST | `/api/v1/admin/support/tickets/:id/escalate` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 429 | POST | `/api/v1/admin/support/tickets/:id/notes` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 430 | POST | `/api/v1/admin/support/tickets/:id/redelivery` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 431 | POST | `/api/v1/admin/support/tickets/:id/refund` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 432 | GET | `/api/v1/admin/system/advanced` | ADMIN | PASS | 200 | 200 OK |
| 433 | PUT | `/api/v1/admin/system/advanced` | ADMIN | PASS | 200 | 200 OK |
| 434 | GET | `/api/v1/admin/system/api-endpoints` | ADMIN | PASS | 200 | 200 OK |
| 435 | GET | `/api/v1/admin/system/api-keys` | ADMIN | PASS | 200 | 200 OK |
| 436 | POST | `/api/v1/admin/system/api-keys` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 437 | POST | `/api/v1/admin/system/api-keys/:id/revoke` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 438 | POST | `/api/v1/admin/system/api-keys/:id/rotate` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 439 | POST | `/api/v1/admin/system/cache/clear` | ADMIN | PASS | 200 | 200 OK |
| 440 | GET | `/api/v1/admin/system/cache/stats` | ADMIN | PASS | 200 | 200 OK |
| 441 | GET | `/api/v1/admin/system/cron-jobs` | ADMIN | PASS | 200 | 200 OK |
| 442 | PUT | `/api/v1/admin/system/cron-jobs/:jobId` | ADMIN | PASS | 200 | 200 OK |
| 443 | POST | `/api/v1/admin/system/cron-jobs/:jobId/trigger` | ADMIN | PASS | 200 | 200 OK |
| 444 | GET | `/api/v1/admin/system/delivery` | ADMIN | PASS | 200 | 200 OK |
| 445 | PUT | `/api/v1/admin/system/delivery` | ADMIN | PASS | 200 | 200 OK |
| 446 | GET | `/api/v1/admin/system/env-variables` | ADMIN | PASS | 200 | 200 OK |
| 447 | PUT | `/api/v1/admin/system/env-variables/:key` | ADMIN | PASS | 200 | 200 OK |
| 448 | GET | `/api/v1/admin/system/feature-flags` | ADMIN | PASS | 200 | 200 OK |
| 449 | PUT | `/api/v1/admin/system/feature-flags/:id/toggle` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 450 | GET | `/api/v1/admin/system/general` | ADMIN | PASS | 200 | 200 OK |
| 451 | PUT | `/api/v1/admin/system/general` | ADMIN | PASS | 200 | 200 OK |
| 452 | GET | `/api/v1/admin/system/instances` | ADMIN | PASS | 200 | 200 OK |
| 453 | POST | `/api/v1/admin/system/instances/:id/restart` | ADMIN | PASS | 201 | 201 OK |
| 454 | GET | `/api/v1/admin/system/integrations` | ADMIN | PASS | 200 | 200 OK |
| 455 | PUT | `/api/v1/admin/system/integrations/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 456 | POST | `/api/v1/admin/system/integrations/:id/test` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 457 | GET | `/api/v1/admin/system/logs` | ADMIN | PASS | 200 | 200 OK |
| 458 | GET | `/api/v1/admin/system/maintenance` | ADMIN | PASS | 200 | 200 OK |
| 459 | POST | `/api/v1/admin/system/maintenance` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 460 | GET | `/api/v1/admin/system/migrations` | ADMIN | PASS | 200 | 200 OK |
| 461 | GET | `/api/v1/admin/system/notifications` | ADMIN | PASS | 200 | 200 OK |
| 462 | PUT | `/api/v1/admin/system/notifications` | ADMIN | PASS | 200 | 200 OK |
| 463 | GET | `/api/v1/admin/system/payment-gateways` | ADMIN | PASS | 200 | 200 OK |
| 464 | PUT | `/api/v1/admin/system/payment-gateways/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 465 | GET | `/api/v1/admin/system/performance` | ADMIN | PASS | 200 | 200 OK |
| 466 | GET | `/api/v1/admin/system/server-status` | ADMIN | PASS | 200 | 200 OK |
| 467 | GET | `/api/v1/admin/system/tax-settings` | ADMIN | PASS | 200 | 200 OK |
| 468 | PUT | `/api/v1/admin/system/tax-settings` | ADMIN | PASS | 200 | 200 OK |
| 469 | GET | `/api/v1/admin/training-videos` | ADMIN | PASS | 200 | 200 OK |
| 470 | POST | `/api/v1/admin/training-videos` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 471 | DELETE | `/api/v1/admin/training-videos/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 472 | GET | `/api/v1/admin/training-videos/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 473 | PUT | `/api/v1/admin/training-videos/:id` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 474 | GET | `/api/v1/admin/training-videos/picker-progress` | ADMIN | PASS | 200 | 200 OK |
| 475 | GET | `/api/v1/admin/users` | ADMIN | PASS | 200 | 200 OK |
| 476 | POST | `/api/v1/admin/users` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 477 | DELETE | `/api/v1/admin/users/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 478 | GET | `/api/v1/admin/users/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 479 | PUT | `/api/v1/admin/users/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 480 | PUT | `/api/v1/admin/users/:id/reset-password` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 481 | PUT | `/api/v1/admin/users/:id/role` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 482 | POST | `/api/v1/admin/users/bulk` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 483 | GET | `/api/v1/admin/users/managers` | ADMIN | PASS | 200 | 200 OK |
| 484 | GET | `/api/v1/admin/users/me` | ADMIN | PASS | 200 | 200 OK |
| 485 | POST | `/api/v1/admin/users/verification/send-otp` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 486 | POST | `/api/v1/admin/users/verification/verify-otp` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 487 | GET | `/api/v1/admin/vehicle-types` | ADMIN | PASS | 200 | 200 OK |
| 488 | POST | `/api/v1/admin/vehicle-types` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 489 | DELETE | `/api/v1/admin/vehicle-types/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 490 | GET | `/api/v1/admin/vehicle-types/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 491 | PUT | `/api/v1/admin/vehicle-types/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 492 | GET | `/api/v1/admin/vendor/approvals` | ADMIN | PASS | 200 | 200 OK |
| 493 | POST | `/api/v1/admin/vendor/approvals/:approvalId/approve` | ADMIN | PASS | 200 | 200 OK |
| 494 | POST | `/api/v1/admin/vendor/approvals/:approvalId/reject` | ADMIN | PASS | 200 | 200 OK |
| 495 | GET | `/api/v1/admin/vendor/approvals/summary` | ADMIN | PASS | 200 | 200 OK |
| 496 | GET | `/api/v1/admin/vendor/approvals/tasks` | ADMIN | PASS | 200 | 200 OK |
| 497 | GET | `/api/v1/admin/vendor/approvals/tasks/:id` | ADMIN | PASS | 200 | 200 OK |
| 498 | POST | `/api/v1/admin/vendor/approvals/tasks/:id/decision` | ADMIN | PASS | 200 | 200 OK |
| 499 | GET | `/api/v1/admin/vendor/certificates` | ADMIN | PASS | 200 | 200 OK |
| 500 | POST | `/api/v1/admin/vendor/certificates` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 501 | DELETE | `/api/v1/admin/vendor/certificates/:certificateId` | ADMIN | PASS | 200 | 200 OK |
| 502 | GET | `/api/v1/admin/vendor/certificates/:certificateId` | ADMIN | PASS | 200 | 200 OK |
| 503 | PATCH | `/api/v1/admin/vendor/certificates/:certificateId` | ADMIN | PASS | 200 | 200 OK |
| 504 | GET | `/api/v1/admin/vendor/dashboard/summary` | ADMIN | PASS | 200 | 200 OK |
| 505 | POST | `/api/v1/admin/vendor/inbound/bulk-import` | ADMIN | PASS | 201 | 201 OK |
| 506 | GET | `/api/v1/admin/vendor/inbound/bulk-import/:jobId` | ADMIN | PASS | 200 | 200 OK |
| 507 | GET | `/api/v1/admin/vendor/inbound/exceptions` | ADMIN | PASS | 200 | 200 OK |
| 508 | POST | `/api/v1/admin/vendor/inbound/exceptions` | ADMIN | PASS | 201 | 201 OK |
| 509 | POST | `/api/v1/admin/vendor/inbound/exceptions/:exceptionId/resolve` | ADMIN | PASS | 200 | 200 OK |
| 510 | GET | `/api/v1/admin/vendor/inbound/grn` | ADMIN | PASS | 200 | 200 OK |
| 511 | POST | `/api/v1/admin/vendor/inbound/grn` | ADMIN | PASS | 201 | 201 OK |
| 512 | GET | `/api/v1/admin/vendor/inbound/grn/:grnId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 513 | PUT | `/api/v1/admin/vendor/inbound/grn/:grnId` | ADMIN | PASS | 200 | 200 OK |
| 514 | GET | `/api/v1/admin/vendor/inbound/grns` | ADMIN | PASS | 200 | 200 OK |
| 515 | POST | `/api/v1/admin/vendor/inbound/grns` | ADMIN | PASS | 201 | 201 OK |
| 516 | GET | `/api/v1/admin/vendor/inbound/grns/:grnId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 517 | PUT | `/api/v1/admin/vendor/inbound/grns/:grnId` | ADMIN | PASS | 200 | 200 OK |
| 518 | POST | `/api/v1/admin/vendor/inbound/grns/:grnId/approve` | ADMIN | PASS | 200 | 200 OK |
| 519 | POST | `/api/v1/admin/vendor/inbound/grns/:grnId/archive` | ADMIN | PASS | 200 | 200 OK |
| 520 | POST | `/api/v1/admin/vendor/inbound/grns/:grnId/reject` | ADMIN | PASS | 200 | 200 OK |
| 521 | PATCH | `/api/v1/admin/vendor/inbound/grns/:grnId/status` | ADMIN | PASS | 200 | 200 OK |
| 522 | GET | `/api/v1/admin/vendor/inbound/overview` | ADMIN | PASS | 200 | 200 OK |
| 523 | GET | `/api/v1/admin/vendor/inbound/report` | ADMIN | PASS | 200 | 200 OK |
| 524 | GET | `/api/v1/admin/vendor/inbound/rtvs` | ADMIN | PASS | 200 | 200 OK |
| 525 | POST | `/api/v1/admin/vendor/inbound/rtvs` | ADMIN | PASS | 201 | 201 OK |
| 526 | PATCH | `/api/v1/admin/vendor/inbound/rtvs/:rtvId/status` | ADMIN | PASS | 200 | 200 OK |
| 527 | GET | `/api/v1/admin/vendor/inbound/shipments` | ADMIN | PASS | 200 | 200 OK |
| 528 | POST | `/api/v1/admin/vendor/inbound/shipments` | ADMIN | PASS | 201 | 201 OK |
| 529 | PATCH | `/api/v1/admin/vendor/inbound/shipments/:shipmentId/status` | ADMIN | PASS | 200 | 200 OK |
| 530 | GET | `/api/v1/admin/vendor/inventory` | ADMIN | PASS | 200 | 200 OK |
| 531 | GET | `/api/v1/admin/vendor/inventory/:vendorId` | ADMIN | PASS | 200 | 200 OK |
| 532 | GET | `/api/v1/admin/vendor/inventory/:vendorId/aging-alerts` | ADMIN | PASS | 200 | 200 OK |
| 533 | POST | `/api/v1/admin/vendor/inventory/:vendorId/aging-alerts/:alertId/ack` | ADMIN | PASS | 200 | 200 OK |
| 534 | GET | `/api/v1/admin/vendor/inventory/:vendorId/aging-inventory` | ADMIN | PASS | 200 | 200 OK |
| 535 | POST | `/api/v1/admin/vendor/inventory/:vendorId/aging-inventory/:itemId/liquidate` | ADMIN | PASS | 200 | 200 OK |
| 536 | POST | `/api/v1/admin/vendor/inventory/:vendorId/aging-inventory/:itemId/return` | ADMIN | PASS | 200 | 200 OK |
| 537 | GET | `/api/v1/admin/vendor/inventory/:vendorId/kpis` | ADMIN | PASS | 200 | 200 OK |
| 538 | POST | `/api/v1/admin/vendor/inventory/:vendorId/reconcile` | ADMIN | PASS | 200 | 200 OK |
| 539 | GET | `/api/v1/admin/vendor/inventory/:vendorId/stock` | ADMIN | PASS | 200 | 200 OK |
| 540 | GET | `/api/v1/admin/vendor/inventory/:vendorId/stockouts` | ADMIN | PASS | 200 | 200 OK |
| 541 | POST | `/api/v1/admin/vendor/inventory/:vendorId/stockouts/alert-all` | ADMIN | PASS | 200 | 200 OK |
| 542 | POST | `/api/v1/admin/vendor/inventory/:vendorId/stockouts/bulk-reorder` | ADMIN | PASS | 200 | 200 OK |
| 543 | GET | `/api/v1/admin/vendor/inventory/:vendorId/supply-performance` | ADMIN | PASS | 200 | 200 OK |
| 544 | POST | `/api/v1/admin/vendor/inventory/:vendorId/sync` | ADMIN | PASS | 200 | 200 OK |
| 545 | GET | `/api/v1/admin/vendor/inventory/hub/aging-alerts` | ADMIN | PASS | 200 | 200 OK |
| 546 | GET | `/api/v1/admin/vendor/invoices` | ADMIN | PASS | 200 | 200 OK |
| 547 | GET | `/api/v1/admin/vendor/invoices/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 548 | POST | `/api/v1/admin/vendor/invoices/:id/approve` | ADMIN | PASS | 200 | 200 OK |
| 549 | POST | `/api/v1/admin/vendor/invoices/:id/mark-paid` | ADMIN | PASS | 200 | 200 OK |
| 550 | POST | `/api/v1/admin/vendor/invoices/:id/reject` | ADMIN | PASS | 200 | 200 OK |
| 551 | GET | `/api/v1/admin/vendor/notifications` | ADMIN | PASS | 200 | 200 OK |
| 552 | PATCH | `/api/v1/admin/vendor/notifications/:notifId/read` | ADMIN | PASS | 200 | 200 OK |
| 553 | PUT | `/api/v1/admin/vendor/notifications/:notifId/read` | ADMIN | PASS | 200 | 200 OK |
| 554 | POST | `/api/v1/admin/vendor/notifications/read-all` | ADMIN | PASS | 200 | 200 OK |
| 555 | GET | `/api/v1/admin/vendor/payments` | ADMIN | PASS | 200 | 200 OK |
| 556 | POST | `/api/v1/admin/vendor/payments` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 557 | POST | `/api/v1/admin/vendor/payments/:paymentId/cancel` | ADMIN | PASS | 200 | 200 OK |
| 558 | POST | `/api/v1/admin/vendor/public/complete-profile` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 559 | POST | `/api/v1/admin/vendor/public/upload-documents/:vendorId` | ADMIN | PASS | 200 | 200 OK |
| 560 | GET | `/api/v1/admin/vendor/public/verify-token` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 561 | GET | `/api/v1/admin/vendor/purchase-orders` | ADMIN | PASS | 200 | 200 OK |
| 562 | POST | `/api/v1/admin/vendor/purchase-orders` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 563 | DELETE | `/api/v1/admin/vendor/purchase-orders/:poId` | ADMIN | PASS | 200 | 200 OK |
| 564 | GET | `/api/v1/admin/vendor/purchase-orders/:poId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 565 | PATCH | `/api/v1/admin/vendor/purchase-orders/:poId` | ADMIN | PASS | 200 | 200 OK |
| 566 | PUT | `/api/v1/admin/vendor/purchase-orders/:poId` | ADMIN | PASS | 200 | 200 OK |
| 567 | POST | `/api/v1/admin/vendor/purchase-orders/:poId/actions` | ADMIN | PASS | 200 | 200 OK |
| 568 | POST | `/api/v1/admin/vendor/purchase-orders/:poId/approve` | ADMIN | PASS | 200 | 200 OK |
| 569 | GET | `/api/v1/admin/vendor/purchase-orders/:poId/events` | ADMIN | PASS | 200 | 200 OK |
| 570 | POST | `/api/v1/admin/vendor/purchase-orders/:poId/reject` | ADMIN | PASS | 200 | 200 OK |
| 571 | POST | `/api/v1/admin/vendor/purchase-orders/bulk-upload` | ADMIN | PASS | 201 | 201 OK |
| 572 | GET | `/api/v1/admin/vendor/purchase-orders/overview` | ADMIN | PASS | 200 | 200 OK |
| 573 | GET | `/api/v1/admin/vendor/qc` | ADMIN | PASS | 200 | 200 OK |
| 574 | POST | `/api/v1/admin/vendor/qc` | ADMIN | PASS | 201 | 201 OK |
| 575 | GET | `/api/v1/admin/vendor/qc-compliance/audits` | ADMIN | PASS | 200 | 200 OK |
| 576 | POST | `/api/v1/admin/vendor/qc-compliance/audits` | ADMIN | PASS | 201 | 201 OK |
| 577 | DELETE | `/api/v1/admin/vendor/qc-compliance/audits/:id` | ADMIN | PASS | 200 | 200 OK |
| 578 | GET | `/api/v1/admin/vendor/qc-compliance/audits/:id` | ADMIN | PASS | 200 | 200 OK |
| 579 | PATCH | `/api/v1/admin/vendor/qc-compliance/audits/:id` | ADMIN | PASS | 200 | 200 OK |
| 580 | GET | `/api/v1/admin/vendor/qc-compliance/certificates` | ADMIN | PASS | 200 | 200 OK |
| 581 | POST | `/api/v1/admin/vendor/qc-compliance/certificates` | ADMIN | PASS | 201 | 201 OK |
| 582 | DELETE | `/api/v1/admin/vendor/qc-compliance/certificates/:certId` | ADMIN | PASS | 200 | 200 OK |
| 583 | PATCH | `/api/v1/admin/vendor/qc-compliance/certificates/:certId` | ADMIN | PASS | 200 | 200 OK |
| 584 | GET | `/api/v1/admin/vendor/qc-compliance/ratings` | ADMIN | PASS | 200 | 200 OK |
| 585 | DELETE | `/api/v1/admin/vendor/qc-compliance/ratings/:vendorId` | ADMIN | PASS | 200 | 200 OK |
| 586 | PATCH | `/api/v1/admin/vendor/qc-compliance/ratings/:vendorId` | ADMIN | PASS | 200 | 200 OK |
| 587 | POST | `/api/v1/admin/vendor/qc-compliance/ratings/:vendorId/recalculate` | ADMIN | PASS | 200 | 200 OK |
| 588 | GET | `/api/v1/admin/vendor/qc-compliance/temperature` | ADMIN | PASS | 200 | 200 OK |
| 589 | POST | `/api/v1/admin/vendor/qc-compliance/temperature` | ADMIN | PASS | 201 | 201 OK |
| 590 | DELETE | `/api/v1/admin/vendor/qc-compliance/temperature/:tempId` | ADMIN | PASS | 200 | 200 OK |
| 591 | PATCH | `/api/v1/admin/vendor/qc-compliance/temperature/:tempId` | ADMIN | PASS | 200 | 200 OK |
| 592 | PUT | `/api/v1/admin/vendor/qc/:checkId` | ADMIN | PASS | 200 | 200 OK |
| 593 | DELETE | `/api/v1/admin/vendor/qc/:qcId` | ADMIN | PASS | 200 | 200 OK |
| 594 | GET | `/api/v1/admin/vendor/qc/:qcId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 595 | PATCH | `/api/v1/admin/vendor/qc/:qcId` | ADMIN | PASS | 200 | 200 OK |
| 596 | GET | `/api/v1/admin/vendor/qc/overview` | ADMIN | PASS | 200 | 200 OK |
| 597 | GET | `/api/v1/admin/vendor/reports` | ADMIN | PASS | 200 | 200 OK |
| 598 | GET | `/api/v1/admin/vendor/reports/customers/insights` | ADMIN | PASS | 200 | 200 OK |
| 599 | GET | `/api/v1/admin/vendor/reports/customers/top` | ADMIN | PASS | 200 | 200 OK |
| 600 | GET | `/api/v1/admin/vendor/reports/financial/summary` | ADMIN | PASS | 200 | 200 OK |
| 601 | GET | `/api/v1/admin/vendor/reports/orders/analytics` | ADMIN | PASS | 200 | 200 OK |
| 602 | GET | `/api/v1/admin/vendor/reports/products/performance` | ADMIN | PASS | 200 | 200 OK |
| 603 | GET | `/api/v1/admin/vendor/reports/revenue/category` | ADMIN | PASS | 200 | 200 OK |
| 604 | GET | `/api/v1/admin/vendor/reports/sales/data` | ADMIN | PASS | 200 | 200 OK |
| 605 | GET | `/api/v1/admin/vendor/reports/sales/hourly` | ADMIN | PASS | 200 | 200 OK |
| 606 | GET | `/api/v1/admin/vendor/reports/sales/overview` | ADMIN | PASS | 200 | 200 OK |
| 607 | GET | `/api/v1/admin/vendor/system-gateway/logs` | ADMIN | PASS | 200 | 200 OK |
| 608 | POST | `/api/v1/admin/vendor/system-gateway/logs` | ADMIN | PASS | 201 | 201 OK |
| 609 | GET | `/api/v1/admin/vendor/system-gateway/services` | ADMIN | PASS | 200 | 200 OK |
| 610 | POST | `/api/v1/admin/vendor/system-gateway/services` | ADMIN | PASS | 200 | 200 OK |
| 611 | GET | `/api/v1/admin/vendor/system-gateway/services/:id` | ADMIN | PASS | 200 | 200 OK |
| 612 | PUT | `/api/v1/admin/vendor/system-gateway/services/:id` | ADMIN | PASS | 200 | 200 OK |
| 613 | GET | `/api/v1/admin/vendor/utilities/audit-logs` | ADMIN | PASS | 200 | 200 OK |
| 614 | POST | `/api/v1/admin/vendor/utilities/audit-logs/export` | ADMIN | PASS | 200 | 200 OK |
| 615 | POST | `/api/v1/admin/vendor/utilities/bulk-upload` | ADMIN | PASS | 201 | 201 OK |
| 616 | GET | `/api/v1/admin/vendor/utilities/bulk-upload/template` | ADMIN | PASS | 200 | 200 OK |
| 617 | GET | `/api/v1/admin/vendor/utilities/contracts` | ADMIN | PASS | 200 | 200 OK |
| 618 | POST | `/api/v1/admin/vendor/utilities/contracts` | ADMIN | PASS | 201 | 201 OK |
| 619 | DELETE | `/api/v1/admin/vendor/utilities/contracts/:contractId` | ADMIN | PASS | 200 | 200 OK |
| 620 | GET | `/api/v1/admin/vendor/utilities/upload-history` | ADMIN | PASS | 200 | 200 OK |
| 621 | GET | `/api/v1/admin/vendor/vendors` | ADMIN | PASS | 200 | 200 OK |
| 622 | POST | `/api/v1/admin/vendor/vendors` | ADMIN | PASS | 201 | 201 OK |
| 623 | DELETE | `/api/v1/admin/vendor/vendors/:vendorId` | ADMIN | PASS | 200 | 200 OK |
| 624 | GET | `/api/v1/admin/vendor/vendors/:vendorId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 625 | PATCH | `/api/v1/admin/vendor/vendors/:vendorId` | ADMIN | PASS | 200 | 200 OK |
| 626 | PUT | `/api/v1/admin/vendor/vendors/:vendorId` | ADMIN | PASS | 200 | 200 OK |
| 627 | POST | `/api/v1/admin/vendor/vendors/:vendorId/actions` | ADMIN | PASS | 200 | 200 OK |
| 628 | GET | `/api/v1/admin/vendor/vendors/:vendorId/alerts` | ADMIN | PASS | 200 | 200 OK |
| 629 | POST | `/api/v1/admin/vendor/vendors/:vendorId/alerts` | ADMIN | PASS | 201 | 201 OK |
| 630 | GET | `/api/v1/admin/vendor/vendors/:vendorId/certificates` | ADMIN | PASS | 200 | 200 OK |
| 631 | GET | `/api/v1/admin/vendor/vendors/:vendorId/health` | ADMIN | PASS | 200 | 200 OK |
| 632 | GET | `/api/v1/admin/vendor/vendors/:vendorId/inventory` | ADMIN | PASS | 200 | 200 OK |
| 633 | GET | `/api/v1/admin/vendor/vendors/:vendorId/invoices` | ADMIN | PASS | 200 | 200 OK |
| 634 | GET | `/api/v1/admin/vendor/vendors/:vendorId/notifications` | ADMIN | PASS | 200 | 200 OK |
| 635 | GET | `/api/v1/admin/vendor/vendors/:vendorId/performance` | ADMIN | PASS | 200 | 200 OK |
| 636 | GET | `/api/v1/admin/vendor/vendors/:vendorId/purchase-orders` | ADMIN | PASS | 200 | 200 OK |
| 637 | GET | `/api/v1/admin/vendor/vendors/:vendorId/qc-checks` | ADMIN | PASS | 200 | 200 OK |
| 638 | POST | `/api/v1/admin/vendor/vendors/:vendorId/qc-checks` | ADMIN | PASS | 201 | 201 OK |
| 639 | PATCH | `/api/v1/admin/vendor/vendors/:vendorId/stage` | ADMIN | PASS | 200 | 200 OK |
| 640 | GET | `/api/v1/admin/vendor/vendors/email-preview/:templateName` | ADMIN | PASS | 200 | 200 OK |
| 641 | POST | `/api/v1/admin/vendor/vendors/send-doc-request-email` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 642 | POST | `/api/v1/admin/vendor/vendors/send-invite-email` | ADMIN | PASS | 201 | 201 OK |
| 643 | POST | `/api/v1/admin/vendor/vendors/send-payment-email` | ADMIN | PASS | 201 | 201 OK |
| 644 | POST | `/api/v1/admin/vendor/vendors/send-rejection-email` | ADMIN | PASS | 201 | 201 OK |
| 645 | GET | `/api/v1/admin/vendor/vendors/summary` | ADMIN | PASS | 200 | 200 OK |
| 646 | POST | `/api/v1/admin/vendor/webhooks/carrier` | ADMIN | PASS | 200 | 200 OK |
| 647 | POST | `/api/v1/admin/vendor/webhooks/vendor-signed` | ADMIN | PASS | 200 | 200 OK |
| 648 | GET | `/api/v1/admin/warehouse-users` | ADMIN | PASS | 200 | 200 OK |
| 649 | POST | `/api/v1/admin/warehouse-users` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 650 | DELETE | `/api/v1/admin/warehouse-users/:id` | ADMIN | PASS | 200 | 200 OK |
| 651 | GET | `/api/v1/admin/warehouse-users/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 652 | PUT | `/api/v1/admin/warehouse-users/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 653 | GET | `/api/v1/admin/warehouses` | ADMIN | PASS | 200 | 200 OK |
| 654 | POST | `/api/v1/admin/warehouses` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 655 | GET | `/api/v1/admin/warehouses-legacy` | ADMIN | PASS | 200 | 200 OK |
| 656 | GET | `/api/v1/admin/warehouses-legacy/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 657 | DELETE | `/api/v1/admin/warehouses/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 658 | GET | `/api/v1/admin/warehouses/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 659 | PUT | `/api/v1/admin/warehouses/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 660 | GET | `/api/v1/admin/zones` | ADMIN | PASS | 200 | 200 OK |
| 661 | POST | `/api/v1/admin/zones` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 662 | DELETE | `/api/v1/admin/zones/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 663 | GET | `/api/v1/admin/zones/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 664 | PUT | `/api/v1/admin/zones/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 665 | GET | `/api/v1/customer/admin/app-config` | ADMIN | PASS | 200 | 200 OK |
| 666 | PUT | `/api/v1/customer/admin/app-config` | ADMIN | PASS | 200 | 200 OK |
| 667 | GET | `/api/v1/customer/admin/app-config/cancellation-policies` | ADMIN | PASS | 200 | 200 OK |
| 668 | POST | `/api/v1/customer/admin/app-config/cancellation-policies` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 669 | DELETE | `/api/v1/customer/admin/app-config/cancellation-policies/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 670 | GET | `/api/v1/customer/admin/app-config/cancellation-policies/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 671 | PUT | `/api/v1/customer/admin/app-config/cancellation-policies/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 672 | POST | `/api/v1/customer/admin/app-config/reset` | ADMIN | PASS | 200 | 200 OK |
| 673 | PUT | `/api/v1/customer/admin/app-config/section/:section` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 674 | GET | `/api/v1/customer/admin/banners` | ADMIN | PASS | 200 | 200 OK |
| 675 | POST | `/api/v1/customer/admin/banners` | ADMIN | PASS | 201 | 201 OK |
| 676 | DELETE | `/api/v1/customer/admin/banners/:id` | ADMIN | PASS | 200 | 200 OK |
| 677 | PUT | `/api/v1/customer/admin/banners/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 678 | POST | `/api/v1/customer/admin/banners/reorder` | ADMIN | PASS | 200 | 200 OK |
| 679 | GET | `/api/v1/customer/admin/cancellation-policies` | ADMIN | PASS | 200 | 200 OK |
| 680 | POST | `/api/v1/customer/admin/cancellation-policies` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 681 | DELETE | `/api/v1/customer/admin/cancellation-policies/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 682 | GET | `/api/v1/customer/admin/cancellation-policies/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 683 | PUT | `/api/v1/customer/admin/cancellation-policies/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 684 | GET | `/api/v1/customer/admin/categories` | ADMIN | PASS | 200 | 200 OK |
| 685 | POST | `/api/v1/customer/admin/categories` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 686 | DELETE | `/api/v1/customer/admin/categories/:id` | ADMIN | PASS | 200 | 200 OK |
| 687 | PUT | `/api/v1/customer/admin/categories/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 688 | GET | `/api/v1/customer/admin/categories/:id/children` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 689 | GET | `/api/v1/customer/admin/categories/all` | ADMIN | PASS | 200 | 200 OK |
| 690 | POST | `/api/v1/customer/admin/categories/reorder` | ADMIN | PASS | 200 | 200 OK |
| 691 | GET | `/api/v1/customer/admin/cms/banners` | ADMIN | PASS | 200 | 200 OK |
| 692 | POST | `/api/v1/customer/admin/cms/banners` | ADMIN | PASS | 201 | 201 OK |
| 693 | DELETE | `/api/v1/customer/admin/cms/banners/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 694 | PUT | `/api/v1/customer/admin/cms/banners/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 695 | GET | `/api/v1/customer/admin/cms/buttons` | ADMIN | PASS | 200 | 200 OK |
| 696 | POST | `/api/v1/customer/admin/cms/buttons` | ADMIN | PASS | 201 | 201 OK |
| 697 | DELETE | `/api/v1/customer/admin/cms/buttons/:id` | ADMIN | PASS | 200 | 200 OK |
| 698 | PUT | `/api/v1/customer/admin/cms/buttons/:id` | ADMIN | PASS | 200 | 200 OK |
| 699 | GET | `/api/v1/customer/admin/cms/collections` | ADMIN | PASS | 200 | 200 OK |
| 700 | POST | `/api/v1/customer/admin/cms/collections` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 701 | DELETE | `/api/v1/customer/admin/cms/collections/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 702 | PUT | `/api/v1/customer/admin/cms/collections/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 703 | POST | `/api/v1/customer/admin/cms/consolidate-catalog-taxonomy` | ADMIN | PASS | 201 | 201 OK |
| 704 | GET | `/api/v1/customer/admin/cms/home-sections` | ADMIN | PASS | 200 | 200 OK |
| 705 | POST | `/api/v1/customer/admin/cms/home-sections` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 706 | DELETE | `/api/v1/customer/admin/cms/home-sections/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 707 | PUT | `/api/v1/customer/admin/cms/home-sections/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 708 | GET | `/api/v1/customer/admin/cms/import-history/content-hub` | ADMIN | PASS | 200 | 200 OK |
| 709 | GET | `/api/v1/customer/admin/cms/import-jobs/content-hub/:jobId` | ADMIN | PASS | 200 | 200 OK |
| 710 | GET | `/api/v1/customer/admin/cms/media` | ADMIN | PASS | 200 | 200 OK |
| 711 | POST | `/api/v1/customer/admin/cms/media` | ADMIN | PASS | 201 | 201 OK |
| 712 | DELETE | `/api/v1/customer/admin/cms/media/:id` | ADMIN | PASS | 200 | 200 OK |
| 713 | GET | `/api/v1/customer/admin/cms/overview` | ADMIN | PASS | 200 | 200 OK |
| 714 | GET | `/api/v1/customer/admin/cms/pages` | ADMIN | PASS | 200 | 200 OK |
| 715 | POST | `/api/v1/customer/admin/cms/pages` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 716 | DELETE | `/api/v1/customer/admin/cms/pages/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 717 | GET | `/api/v1/customer/admin/cms/pages/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 718 | PUT | `/api/v1/customer/admin/cms/pages/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 719 | POST | `/api/v1/customer/admin/cms/upload/cms-pages` | ADMIN | PASS | 201 | 201 OK |
| 720 | POST | `/api/v1/customer/admin/cms/upload/content-hub-master` | ADMIN | PASS | 201 | 201 OK |
| 721 | POST | `/api/v1/customer/admin/cms/upload/sku-master` | ADMIN | PASS | 201 | 201 OK |
| 722 | GET | `/api/v1/customer/admin/collections` | ADMIN | PASS | 200 | 200 OK |
| 723 | POST | `/api/v1/customer/admin/collections` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 724 | DELETE | `/api/v1/customer/admin/collections/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 725 | PUT | `/api/v1/customer/admin/collections/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 726 | GET | `/api/v1/customer/admin/coupons` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 727 | POST | `/api/v1/customer/admin/coupons` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 728 | DELETE | `/api/v1/customer/admin/coupons/:id` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 729 | GET | `/api/v1/customer/admin/coupons/:id` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 730 | PUT | `/api/v1/customer/admin/coupons/:id` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 731 | GET | `/api/v1/customer/admin/coupons/stats` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 732 | GET | `/api/v1/customer/admin/faq` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 733 | POST | `/api/v1/customer/admin/faq` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 734 | DELETE | `/api/v1/customer/admin/faq/:id` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 735 | GET | `/api/v1/customer/admin/faq/:id` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 736 | PUT | `/api/v1/customer/admin/faq/:id` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 737 | GET | `/api/v1/customer/admin/faq/categories` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 738 | GET | `/api/v1/customer/admin/home/attributes` | ADMIN | PASS | 200 | 200 OK |
| 739 | POST | `/api/v1/customer/admin/home/attributes` | ADMIN | PASS | 201 | 201 OK |
| 740 | DELETE | `/api/v1/customer/admin/home/attributes/:id` | ADMIN | PASS | 200 | 200 OK |
| 741 | PUT | `/api/v1/customer/admin/home/attributes/:id` | ADMIN | PASS | 200 | 200 OK |
| 742 | GET | `/api/v1/customer/admin/home/banners` | ADMIN | PASS | 200 | 200 OK |
| 743 | POST | `/api/v1/customer/admin/home/banners` | ADMIN | PASS | 201 | 201 OK |
| 744 | DELETE | `/api/v1/customer/admin/home/banners/:id` | ADMIN | PASS | 200 | 200 OK |
| 745 | PUT | `/api/v1/customer/admin/home/banners/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 746 | POST | `/api/v1/customer/admin/home/banners/reorder` | ADMIN | PASS | 200 | 200 OK |
| 747 | GET | `/api/v1/customer/admin/home/categories` | ADMIN | PASS | 200 | 200 OK |
| 748 | POST | `/api/v1/customer/admin/home/categories` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 749 | DELETE | `/api/v1/customer/admin/home/categories/:id` | ADMIN | PASS | 200 | 200 OK |
| 750 | PUT | `/api/v1/customer/admin/home/categories/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 751 | GET | `/api/v1/customer/admin/home/categories/:id/children` | ADMIN | PASS | 200 | 200 OK |
| 752 | POST | `/api/v1/customer/admin/home/categories/reorder` | ADMIN | PASS | 200 | 200 OK |
| 753 | DELETE | `/api/v1/customer/admin/home/config` | ADMIN | PASS | 200 | 200 OK |
| 754 | GET | `/api/v1/customer/admin/home/config` | ADMIN | PASS | 200 | 200 OK |
| 755 | POST | `/api/v1/customer/admin/home/config` | ADMIN | PASS | 200 | 200 OK |
| 756 | PUT | `/api/v1/customer/admin/home/config` | ADMIN | PASS | 200 | 200 OK |
| 757 | GET | `/api/v1/customer/admin/home/config/list` | ADMIN | PASS | 200 | 200 OK |
| 758 | POST | `/api/v1/customer/admin/home/config/reset` | ADMIN | PASS | 200 | 200 OK |
| 759 | GET | `/api/v1/customer/admin/home/lifestyle` | ADMIN | PASS | 200 | 200 OK |
| 760 | POST | `/api/v1/customer/admin/home/lifestyle` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 761 | DELETE | `/api/v1/customer/admin/home/lifestyle/:id` | ADMIN | PASS | 200 | 200 OK |
| 762 | PUT | `/api/v1/customer/admin/home/lifestyle/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 763 | POST | `/api/v1/customer/admin/home/lifestyle/reorder` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 764 | GET | `/api/v1/customer/admin/home/preview` | ADMIN | PASS | 200 | 200 OK |
| 765 | GET | `/api/v1/customer/admin/home/products` | ADMIN | PASS | 200 | 200 OK |
| 766 | POST | `/api/v1/customer/admin/home/products` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 767 | DELETE | `/api/v1/customer/admin/home/products/:id` | ADMIN | PASS | 200 | 200 OK |
| 768 | GET | `/api/v1/customer/admin/home/products/:id` | ADMIN | PASS | 200 | 200 OK |
| 769 | PUT | `/api/v1/customer/admin/home/products/:id` | ADMIN | PASS | 200 | 200 OK |
| 770 | POST | `/api/v1/customer/admin/home/products/:id/publish` | ADMIN | PASS | 200 | 200 OK |
| 771 | PATCH | `/api/v1/customer/admin/home/products/:id/status` | ADMIN | PASS | 200 | 200 OK |
| 772 | GET | `/api/v1/customer/admin/home/products/:id/variants` | ADMIN | PASS | 200 | 200 OK |
| 773 | PATCH | `/api/v1/customer/admin/home/products/bulk` | ADMIN | PASS | 200 | 200 OK |
| 774 | PATCH | `/api/v1/customer/admin/home/products/bulk-status` | ADMIN | PASS | 200 | 200 OK |
| 775 | GET | `/api/v1/customer/admin/home/promoblocks` | ADMIN | PASS | 200 | 200 OK |
| 776 | POST | `/api/v1/customer/admin/home/promoblocks` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 777 | DELETE | `/api/v1/customer/admin/home/promoblocks/:id` | ADMIN | PASS | 200 | 200 OK |
| 778 | PUT | `/api/v1/customer/admin/home/promoblocks/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 779 | POST | `/api/v1/customer/admin/home/promoblocks/reorder` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 780 | GET | `/api/v1/customer/admin/home/section-definitions` | ADMIN | PASS | 200 | 200 OK |
| 781 | POST | `/api/v1/customer/admin/home/section-definitions` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 782 | DELETE | `/api/v1/customer/admin/home/section-definitions/:id` | ADMIN | PASS | 200 | 200 OK |
| 783 | PUT | `/api/v1/customer/admin/home/section-definitions/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 784 | POST | `/api/v1/customer/admin/home/section-definitions/reorder` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 785 | GET | `/api/v1/customer/admin/home/sections` | ADMIN | PASS | 200 | 200 OK |
| 786 | POST | `/api/v1/customer/admin/home/sections` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 787 | DELETE | `/api/v1/customer/admin/home/sections/:id` | ADMIN | PASS | 200 | 200 OK |
| 788 | PUT | `/api/v1/customer/admin/home/sections/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 789 | PATCH | `/api/v1/customer/admin/home/sections/:id/products` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 790 | POST | `/api/v1/customer/admin/home/sections/reorder` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 791 | POST | `/api/v1/customer/admin/home/upload-product-image` | ADMIN | PASS | 201 | 201 OK |
| 792 | GET | `/api/v1/customer/admin/legal/config` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 793 | PUT | `/api/v1/customer/admin/legal/config` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 794 | GET | `/api/v1/customer/admin/legal/documents` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 795 | POST | `/api/v1/customer/admin/legal/documents` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 796 | DELETE | `/api/v1/customer/admin/legal/documents/:id` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 797 | GET | `/api/v1/customer/admin/legal/documents/:id` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 798 | PUT | `/api/v1/customer/admin/legal/documents/:id` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 799 | POST | `/api/v1/customer/admin/legal/documents/:id/set-current` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 800 | PUT | `/api/v1/customer/admin/merch/inventory/:storeId` | ADMIN | PASS | 200 | 200 OK |
| 801 | GET | `/api/v1/customer/admin/merch/inventory/:storeId/history` | ADMIN | PASS | 200 | 200 OK |
| 802 | POST | `/api/v1/customer/admin/merch/inventory/:storeId/replenish` | ADMIN | PASS | 201 | 201 OK |
| 803 | POST | `/api/v1/customer/admin/merch/inventory/:storeId/sync` | ADMIN | PASS | 201 | 201 OK |
| 804 | GET | `/api/v1/customer/admin/merch/stores` | ADMIN | PASS | 200 | 200 OK |
| 805 | POST | `/api/v1/customer/admin/merch/stores` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 806 | DELETE | `/api/v1/customer/admin/merch/stores/:id` | ADMIN | PASS | 200 | 200 OK |
| 807 | PUT | `/api/v1/customer/admin/merch/stores/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 808 | GET | `/api/v1/customer/admin/notifications` | ADMIN | PASS | 200 | 200 OK |
| 809 | DELETE | `/api/v1/customer/admin/notifications/:id` | ADMIN | PASS | 200 | 200 OK |
| 810 | POST | `/api/v1/customer/admin/notifications/send` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 811 | GET | `/api/v1/customer/admin/notifications/stats` | ADMIN | PASS | 200 | 200 OK |
| 812 | GET | `/api/v1/customer/admin/onboarding-pages` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 813 | POST | `/api/v1/customer/admin/onboarding-pages` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 814 | DELETE | `/api/v1/customer/admin/onboarding-pages/:id` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 815 | PUT | `/api/v1/customer/admin/onboarding-pages/:id` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 816 | POST | `/api/v1/customer/admin/onboarding-pages/:id/image` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 817 | PUT | `/api/v1/customer/admin/onboarding-pages/reorder` | PUBLIC | PASS | 401 | 401 auth required (enforced) |
| 818 | GET | `/api/v1/customer/admin/pages` | ADMIN | PASS | 200 | 200 OK |
| 819 | POST | `/api/v1/customer/admin/pages` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 820 | DELETE | `/api/v1/customer/admin/pages/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 821 | GET | `/api/v1/customer/admin/pages/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 822 | PUT | `/api/v1/customer/admin/pages/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 823 | GET | `/api/v1/darkstore/alerts` | ADMIN | PASS | 200 | 200 OK |
| 824 | GET | `/api/v1/darkstore/alerts/:alertId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 825 | POST | `/api/v1/darkstore/alerts/:alertId/action` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 826 | GET | `/api/v1/darkstore/alerts/debug/ids` | ADMIN | PASS | 200 | 200 OK |
| 827 | DELETE | `/api/v1/darkstore/alerts/resolved` | ADMIN | PASS | 200 | 200 OK |
| 828 | POST | `/api/v1/darkstore/alerts/resolved/clear` | ADMIN | PASS | 200 | 200 OK |
| 829 | POST | `/api/v1/darkstore/analytics/export` | ADMIN | PASS | 201 | 201 OK |
| 830 | GET | `/api/v1/darkstore/analytics/fleet-utilization` | ADMIN | PASS | 200 | 200 OK |
| 831 | GET | `/api/v1/darkstore/analytics/rider-performance` | ADMIN | PASS | 200 | 200 OK |
| 832 | GET | `/api/v1/darkstore/analytics/sla-adherence` | ADMIN | PASS | 200 | 200 OK |
| 833 | GET | `/api/v1/darkstore/dashboard/alert-history` | ADMIN | PASS | 200 | 200 OK |
| 834 | GET | `/api/v1/darkstore/dashboard/live-orders` | ADMIN | PASS | 200 | 200 OK |
| 835 | GET | `/api/v1/darkstore/dashboard/refresh` | ADMIN | PASS | 200 | 200 OK |
| 836 | POST | `/api/v1/darkstore/dashboard/refresh` | ADMIN | PASS | 200 | 200 OK |
| 837 | GET | `/api/v1/darkstore/dashboard/rto-alerts` | ADMIN | PASS | 200 | 200 OK |
| 838 | GET | `/api/v1/darkstore/dashboard/staff-load` | ADMIN | PASS | 200 | 200 OK |
| 839 | GET | `/api/v1/darkstore/dashboard/stock-alerts` | ADMIN | PASS | 200 | 200 OK |
| 840 | GET | `/api/v1/darkstore/dashboard/store-profile` | ADMIN | PASS | 200 | 200 OK |
| 841 | GET | `/api/v1/darkstore/dashboard/summary` | ADMIN | PASS | 200 | 200 OK |
| 842 | GET | `/api/v1/darkstore/dashboard/warehouse-profile` | ADMIN | PASS | 200 | 200 OK |
| 843 | GET | `/api/v1/darkstore/health/checklists` | ADMIN | PASS | 200 | 200 OK |
| 844 | PUT | `/api/v1/darkstore/health/checklists/:checklistId/items/:itemId` | ADMIN | PASS | 200 | 200 OK |
| 845 | POST | `/api/v1/darkstore/health/checklists/:checklistId/submit` | ADMIN | PASS | 200 | 200 OK |
| 846 | GET | `/api/v1/darkstore/health/equipment` | ADMIN | PASS | 200 | 200 OK |
| 847 | GET | `/api/v1/darkstore/health/incidents` | ADMIN | PASS | 200 | 200 OK |
| 848 | POST | `/api/v1/darkstore/health/incidents` | ADMIN | PASS | 201 | 201 OK |
| 849 | PUT | `/api/v1/darkstore/health/incidents/:incidentId/resolve` | ADMIN | PASS | 200 | 200 OK |
| 850 | GET | `/api/v1/darkstore/health/summary` | ADMIN | PASS | 200 | 200 OK |
| 851 | GET | `/api/v1/darkstore/hsd/devices/:deviceId/actions` | ADMIN | PASS | 200 | 200 OK |
| 852 | POST | `/api/v1/darkstore/hsd/devices/:deviceId/assign` | ADMIN | PASS | 200 | 200 OK |
| 853 | POST | `/api/v1/darkstore/hsd/devices/:deviceId/control` | ADMIN | PASS | 200 | 200 OK |
| 854 | GET | `/api/v1/darkstore/hsd/devices/:deviceId/history` | ADMIN | PASS | 200 | 200 OK |
| 855 | POST | `/api/v1/darkstore/hsd/devices/:deviceId/unassign` | ADMIN | PASS | 200 | 200 OK |
| 856 | POST | `/api/v1/darkstore/hsd/devices/bulk-reset` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 857 | POST | `/api/v1/darkstore/hsd/devices/register` | ADMIN | PASS | 201 | 201 OK |
| 858 | GET | `/api/v1/darkstore/hsd/fleet` | ADMIN | PASS | 200 | 200 OK |
| 859 | GET | `/api/v1/darkstore/hsd/issues` | ADMIN | PASS | 200 | 200 OK |
| 860 | POST | `/api/v1/darkstore/hsd/issues/report` | ADMIN | PASS | 201 | 201 OK |
| 861 | GET | `/api/v1/darkstore/hsd/logs` | ADMIN | PASS | 200 | 200 OK |
| 862 | GET | `/api/v1/darkstore/hsd/picker-users` | ADMIN | PASS | 200 | 200 OK |
| 863 | POST | `/api/v1/darkstore/hsd/requisitions` | ADMIN | PASS | 201 | 201 OK |
| 864 | POST | `/api/v1/darkstore/hsd/sessions/:deviceId/action` | ADMIN | PASS | 200 | 200 OK |
| 865 | GET | `/api/v1/darkstore/hsd/sessions/live` | ADMIN | PASS | 200 | 200 OK |
| 866 | GET | `/api/v1/darkstore/hsd/users` | ADMIN | PASS | 200 | 200 OK |
| 867 | GET | `/api/v1/darkstore/hsd/users/:userId/device-request-otp` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 868 | POST | `/api/v1/darkstore/hsd/users/:userId/generate-device-otp` | ADMIN | PASS | 200 | 200 OK |
| 869 | GET | `/api/v1/darkstore/inbound/grn` | ADMIN | PASS | 200 | 200 OK |
| 870 | GET | `/api/v1/darkstore/inbound/grn/:grnId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 871 | POST | `/api/v1/darkstore/inbound/grn/:grnId/complete` | ADMIN | PASS | 200 | 200 OK |
| 872 | PUT | `/api/v1/darkstore/inbound/grn/:grnId/items/:sku` | ADMIN | PASS | 200 | 200 OK |
| 873 | POST | `/api/v1/darkstore/inbound/grn/:grnId/start` | ADMIN | PASS | 200 | 200 OK |
| 874 | GET | `/api/v1/darkstore/inbound/putaway` | ADMIN | PASS | 200 | 200 OK |
| 875 | POST | `/api/v1/darkstore/inbound/putaway/:taskId/assign` | ADMIN | PASS | 200 | 200 OK |
| 876 | POST | `/api/v1/darkstore/inbound/putaway/:taskId/complete` | ADMIN | PASS | 200 | 200 OK |
| 877 | GET | `/api/v1/darkstore/inbound/summary` | ADMIN | PASS | 200 | 200 OK |
| 878 | GET | `/api/v1/darkstore/inbound/transfers` | ADMIN | PASS | 200 | 200 OK |
| 879 | GET | `/api/v1/darkstore/inbound/transfers/:transferId` | ADMIN | PASS | 200 | 200 OK |
| 880 | POST | `/api/v1/darkstore/inbound/transfers/:transferId/receive` | ADMIN | PASS | 200 | 200 OK |
| 881 | POST | `/api/v1/darkstore/inbound/transfers/sync` | ADMIN | PASS | 200 | 200 OK |
| 882 | GET | `/api/v1/darkstore/inventory/adjustments` | ADMIN | PASS | 200 | 200 OK |
| 883 | POST | `/api/v1/darkstore/inventory/adjustments` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 884 | GET | `/api/v1/darkstore/inventory/audit-log` | ADMIN | PASS | 200 | 200 OK |
| 885 | POST | `/api/v1/darkstore/inventory/bulk-import` | ADMIN | PASS | 201 | 201 OK |
| 886 | GET | `/api/v1/darkstore/inventory/cycle-count` | ADMIN | PASS | 200 | 200 OK |
| 887 | GET | `/api/v1/darkstore/inventory/cycle-count/report` | ADMIN | PASS | 200 | 200 OK |
| 888 | GET | `/api/v1/darkstore/inventory/import-template` | ADMIN | PASS | 200 | 200 OK |
| 889 | PUT | `/api/v1/darkstore/inventory/items/:sku` | ADMIN | PASS | 200 | 200 OK |
| 890 | GET | `/api/v1/darkstore/inventory/product-location/:sku` | ADMIN | PASS | 200 | 200 OK |
| 891 | GET | `/api/v1/darkstore/inventory/restock` | ADMIN | PASS | 200 | 200 OK |
| 892 | POST | `/api/v1/darkstore/inventory/restock` | ADMIN | PASS | 201 | 201 OK |
| 893 | POST | `/api/v1/darkstore/inventory/restock-task` | ADMIN | PASS | 201 | 201 OK |
| 894 | POST | `/api/v1/darkstore/inventory/scan` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 895 | GET | `/api/v1/darkstore/inventory/shelf-view` | ADMIN | PASS | 200 | 200 OK |
| 896 | GET | `/api/v1/darkstore/inventory/shelves` | ADMIN | PASS | 200 | 200 OK |
| 897 | POST | `/api/v1/darkstore/inventory/shelves` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 898 | DELETE | `/api/v1/darkstore/inventory/shelves/:shelfId` | ADMIN | PASS | 200 | 200 OK |
| 899 | PUT | `/api/v1/darkstore/inventory/shelves/:shelfId` | ADMIN | PASS | 200 | 200 OK |
| 900 | GET | `/api/v1/darkstore/inventory/stock-levels` | ADMIN | PASS | 200 | 200 OK |
| 901 | DELETE | `/api/v1/darkstore/inventory/stock-levels/:sku` | ADMIN | PASS | 200 | 200 OK |
| 902 | PUT | `/api/v1/darkstore/inventory/stock-levels/:sku` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 903 | PUT | `/api/v1/darkstore/inventory/stock-levels/:sku/status` | ADMIN | PASS | 200 | 200 OK |
| 904 | GET | `/api/v1/darkstore/issues` | ADMIN | PASS | 200 | 200 OK |
| 905 | GET | `/api/v1/darkstore/issues/:id` | ADMIN | PASS | 200 | 200 OK |
| 906 | PATCH | `/api/v1/darkstore/issues/:id` | ADMIN | PASS | 200 | 200 OK |
| 907 | GET | `/api/v1/darkstore/issues/ops-users` | ADMIN | PASS | 200 | 200 OK |
| 908 | POST | `/api/v1/darkstore/logistics/estimate` | ADMIN | PASS | 200 | 200 OK |
| 909 | GET | `/api/v1/darkstore/logistics/orders` | ADMIN | PASS | 200 | 200 OK |
| 910 | POST | `/api/v1/darkstore/logistics/orders` | ADMIN | PASS | 201 | 201 OK |
| 911 | GET | `/api/v1/darkstore/logistics/orders/:id` | ADMIN | PASS | 200 | 200 OK |
| 912 | POST | `/api/v1/darkstore/logistics/orders/:id/cancel` | ADMIN | PASS | 200 | 200 OK |
| 913 | GET | `/api/v1/darkstore/logistics/orders/:id/tracking` | ADMIN | PASS | 200 | 200 OK |
| 914 | GET | `/api/v1/darkstore/operations/activity-feed` | ADMIN | PASS | 200 | 200 OK |
| 915 | GET | `/api/v1/darkstore/operations/alerts` | ADMIN | PASS | 200 | 200 OK |
| 916 | GET | `/api/v1/darkstore/operations/escalation-suggestions` | ADMIN | PASS | 200 | 200 OK |
| 917 | GET | `/api/v1/darkstore/operations/exception-queue` | ADMIN | PASS | 200 | 200 OK |
| 918 | GET | `/api/v1/darkstore/operations/live-picking` | ADMIN | PASS | 200 | 200 OK |
| 919 | GET | `/api/v1/darkstore/operations/missing-items` | ADMIN | PASS | 200 | 200 OK |
| 920 | GET | `/api/v1/darkstore/operations/order-workflow/:orderId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 921 | GET | `/api/v1/darkstore/operations/pipeline` | ADMIN | PASS | 200 | 200 OK |
| 922 | GET | `/api/v1/darkstore/operations/regional-pipeline` | ADMIN | PASS | 200 | 200 OK |
| 923 | GET | `/api/v1/darkstore/operations/sla-monitor` | ADMIN | PASS | 200 | 200 OK |
| 924 | GET | `/api/v1/darkstore/operations/workflow-sla-metrics` | ADMIN | PASS | 200 | 200 OK |
| 925 | GET | `/api/v1/darkstore/orders` | ADMIN | PASS | 200 | 200 OK |
| 926 | GET | `/api/v1/darkstore/orders/:orderId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 927 | PATCH | `/api/v1/darkstore/orders/:orderId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 928 | GET | `/api/v1/darkstore/orders/:orderId/action-logs` | ADMIN | PASS | 200 | 200 OK |
| 929 | PATCH | `/api/v1/darkstore/orders/:orderId/assign` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 930 | PATCH | `/api/v1/darkstore/orders/:orderId/bag-rack` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 931 | GET | `/api/v1/darkstore/orders/:orderId/call-customer` | ADMIN | PASS | 200 | 200 OK |
| 932 | POST | `/api/v1/darkstore/orders/:orderId/call-customer` | ADMIN | PASS | 200 | 200 OK |
| 933 | POST | `/api/v1/darkstore/orders/:orderId/cancel` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 934 | PATCH | `/api/v1/darkstore/orders/:orderId/complete-picking` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 935 | GET | `/api/v1/darkstore/orders/:orderId/mark-rto` | ADMIN | PASS | 200 | 200 OK |
| 936 | POST | `/api/v1/darkstore/orders/:orderId/mark-rto` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 937 | PATCH | `/api/v1/darkstore/orders/:orderId/start-picking` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 938 | GET | `/api/v1/darkstore/outbound/dispatch` | ADMIN | PASS | 200 | 200 OK |
| 939 | POST | `/api/v1/darkstore/outbound/dispatch/assign` | ADMIN | PASS | 200 | 200 OK |
| 940 | POST | `/api/v1/darkstore/outbound/dispatch/batch` | ADMIN | PASS | 201 | 201 OK |
| 941 | GET | `/api/v1/darkstore/outbound/ready-orders` | ADMIN | PASS | 200 | 200 OK |
| 942 | GET | `/api/v1/darkstore/outbound/riders` | ADMIN | PASS | 200 | 200 OK |
| 943 | GET | `/api/v1/darkstore/outbound/summary` | ADMIN | PASS | 200 | 200 OK |
| 944 | GET | `/api/v1/darkstore/outbound/transfers` | ADMIN | PASS | 200 | 200 OK |
| 945 | POST | `/api/v1/darkstore/outbound/transfers/:requestId/approve` | ADMIN | PASS | 200 | 200 OK |
| 946 | GET | `/api/v1/darkstore/outbound/transfers/:requestId/fulfillment` | ADMIN | PASS | 200 | 200 OK |
| 947 | POST | `/api/v1/darkstore/outbound/transfers/:requestId/reject` | ADMIN | PASS | 200 | 200 OK |
| 948 | GET | `/api/v1/darkstore/outbound/transfers/sla-summary` | ADMIN | PASS | 200 | 200 OK |
| 949 | GET | `/api/v1/darkstore/packing/orders/:orderId` | ADMIN | PASS | 200 | 200 OK |
| 950 | POST | `/api/v1/darkstore/packing/orders/:orderId/complete` | ADMIN | PASS | 200 | 200 OK |
| 951 | POST | `/api/v1/darkstore/packing/orders/:orderId/report-damaged` | ADMIN | PASS | 201 | 201 OK |
| 952 | POST | `/api/v1/darkstore/packing/orders/:orderId/report-missing` | ADMIN | PASS | 201 | 201 OK |
| 953 | POST | `/api/v1/darkstore/packing/orders/:orderId/scan` | ADMIN | PASS | 200 | 200 OK |
| 954 | GET | `/api/v1/darkstore/packing/queue` | ADMIN | PASS | 200 | 200 OK |
| 955 | GET | `/api/v1/darkstore/pick-ops` | ADMIN | PASS | 200 | 200 OK |
| 956 | GET | `/api/v1/darkstore/pickers` | ADMIN | PASS | 200 | 200 OK |
| 957 | GET | `/api/v1/darkstore/pickers/:id/performance` | ADMIN | PASS | 200 | 200 OK |
| 958 | GET | `/api/v1/darkstore/pickers/available` | ADMIN | PASS | 200 | 200 OK |
| 959 | GET | `/api/v1/darkstore/pickers/live` | ADMIN | PASS | 200 | 200 OK |
| 960 | GET | `/api/v1/darkstore/pickers/performance/summary` | ADMIN | PASS | 200 | 200 OK |
| 961 | GET | `/api/v1/darkstore/pickers/registry` | ADMIN | PASS | 200 | 200 OK |
| 962 | GET | `/api/v1/darkstore/picklists` | ADMIN | PASS | 200 | 200 OK |
| 963 | POST | `/api/v1/darkstore/picklists` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 964 | GET | `/api/v1/darkstore/picklists/:picklistId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 965 | POST | `/api/v1/darkstore/picklists/:picklistId/assign` | ADMIN | PASS | 200 | 200 OK |
| 966 | POST | `/api/v1/darkstore/picklists/:picklistId/complete` | ADMIN | PASS | 200 | 200 OK |
| 967 | POST | `/api/v1/darkstore/picklists/:picklistId/move-to-packing` | ADMIN | PASS | 200 | 200 OK |
| 968 | POST | `/api/v1/darkstore/picklists/:picklistId/pause` | ADMIN | PASS | 200 | 200 OK |
| 969 | POST | `/api/v1/darkstore/picklists/:picklistId/progress` | ADMIN | PASS | 200 | 200 OK |
| 970 | POST | `/api/v1/darkstore/picklists/:picklistId/start` | ADMIN | PASS | 200 | 200 OK |
| 971 | GET | `/api/v1/darkstore/qc/checks` | ADMIN | PASS | 200 | 200 OK |
| 972 | PUT | `/api/v1/darkstore/qc/checks/:itemId` | ADMIN | PASS | 200 | 200 OK |
| 973 | GET | `/api/v1/darkstore/qc/compliance/audit-status` | ADMIN | PASS | 200 | 200 OK |
| 974 | GET | `/api/v1/darkstore/qc/compliance/logs` | ADMIN | PASS | 200 | 200 OK |
| 975 | POST | `/api/v1/darkstore/qc/compliance/logs` | ADMIN | PASS | 201 | 201 OK |
| 976 | GET | `/api/v1/darkstore/qc/docs` | ADMIN | PASS | 200 | 200 OK |
| 977 | GET | `/api/v1/darkstore/qc/failures` | ADMIN | PASS | 200 | 200 OK |
| 978 | POST | `/api/v1/darkstore/qc/failures/:failureId/resolve` | ADMIN | PASS | 200 | 200 OK |
| 979 | GET | `/api/v1/darkstore/qc/history` | ADMIN | PASS | 200 | 200 OK |
| 980 | GET | `/api/v1/darkstore/qc/inspections` | ADMIN | PASS | 200 | 200 OK |
| 981 | POST | `/api/v1/darkstore/qc/inspections` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 982 | GET | `/api/v1/darkstore/qc/recent-failures` | ADMIN | PASS | 200 | 200 OK |
| 983 | GET | `/api/v1/darkstore/qc/rejections` | ADMIN | PASS | 200 | 200 OK |
| 984 | POST | `/api/v1/darkstore/qc/rejections` | ADMIN | PASS | 201 | 201 OK |
| 985 | GET | `/api/v1/darkstore/qc/samples` | ADMIN | PASS | 200 | 200 OK |
| 986 | POST | `/api/v1/darkstore/qc/samples` | ADMIN | PASS | 201 | 201 OK |
| 987 | PUT | `/api/v1/darkstore/qc/samples/:sampleId` | ADMIN | PASS | 200 | 200 OK |
| 988 | GET | `/api/v1/darkstore/qc/summary` | ADMIN | PASS | 200 | 200 OK |
| 989 | GET | `/api/v1/darkstore/qc/temperature` | ADMIN | PASS | 200 | 200 OK |
| 990 | POST | `/api/v1/darkstore/qc/temperature` | ADMIN | PASS | 201 | 201 OK |
| 991 | GET | `/api/v1/darkstore/qc/watchlist` | ADMIN | PASS | 200 | 200 OK |
| 992 | POST | `/api/v1/darkstore/qc/watchlist` | ADMIN | PASS | 201 | 201 OK |
| 993 | POST | `/api/v1/darkstore/qc/watchlist/:sku/log-check` | ADMIN | PASS | 201 | 201 OK |
| 994 | GET | `/api/v1/darkstore/reports/compliance` | ADMIN | PASS | 200 | 200 OK |
| 995 | GET | `/api/v1/darkstore/reports/export` | ADMIN | PASS | 200 | 200 OK |
| 996 | GET | `/api/v1/darkstore/reports/inventory` | ADMIN | PASS | 200 | 200 OK |
| 997 | GET | `/api/v1/darkstore/reports/staff` | ADMIN | PASS | 200 | 200 OK |
| 998 | GET | `/api/v1/darkstore/settings` | ADMIN | PASS | 200 | 200 OK |
| 999 | PUT | `/api/v1/darkstore/settings` | ADMIN | PASS | 200 | 200 OK |
| 1000 | GET | `/api/v1/darkstore/staff/absences` | ADMIN | PASS | 200 | 200 OK |
| 1001 | POST | `/api/v1/darkstore/staff/absences` | ADMIN | PASS | 201 | 201 OK |
| 1002 | GET | `/api/v1/darkstore/staff/performance` | ADMIN | PASS | 200 | 200 OK |
| 1003 | GET | `/api/v1/darkstore/staff/performance/download` | ADMIN | PASS | 200 | 200 OK |
| 1004 | GET | `/api/v1/darkstore/staff/roster` | ADMIN | PASS | 200 | 200 OK |
| 1005 | GET | `/api/v1/darkstore/staff/shift-coverage` | ADMIN | PASS | 200 | 200 OK |
| 1006 | POST | `/api/v1/darkstore/staff/shifts/auto-assign-ot` | ADMIN | PASS | 201 | 201 OK |
| 1007 | GET | `/api/v1/darkstore/staff/summary` | ADMIN | PASS | 200 | 200 OK |
| 1008 | GET | `/api/v1/darkstore/staff/weekly-roster` | ADMIN | PASS | 200 | 200 OK |
| 1009 | POST | `/api/v1/darkstore/staff/weekly-roster/publish` | ADMIN | PASS | 200 | 200 OK |
| 1010 | GET | `/api/v1/darkstore/transfer-requests` | ADMIN | PASS | 200 | 200 OK |
| 1011 | POST | `/api/v1/darkstore/transfer-requests` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1012 | GET | `/api/v1/darkstore/transfer-requests/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1013 | GET | `/api/v1/darkstore/transfer-requests/:id/logs` | ADMIN | PASS | 200 | 200 OK |
| 1014 | POST | `/api/v1/darkstore/transfer-requests/:id/receive` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1015 | GET | `/api/v1/darkstore/utilities/audit-logs` | ADMIN | PASS | 200 | 200 OK |
| 1016 | POST | `/api/v1/darkstore/utilities/audit-logs/export` | ADMIN | PASS | 201 | 201 OK |
| 1017 | POST | `/api/v1/darkstore/utilities/inventory/bulk-upload` | ADMIN | PASS | 201 | 201 OK |
| 1018 | GET | `/api/v1/darkstore/utilities/inventory/upload-template` | ADMIN | PASS | 200 | 200 OK |
| 1019 | POST | `/api/v1/darkstore/utilities/labels/generate` | ADMIN | PASS | 201 | 201 OK |
| 1020 | POST | `/api/v1/darkstore/utilities/system/diagnostics` | ADMIN | PASS | 200 | 200 OK |
| 1021 | GET | `/api/v1/darkstore/utilities/system/status` | ADMIN | PASS | 200 | 200 OK |
| 1022 | POST | `/api/v1/darkstore/utilities/system/sync` | ADMIN | PASS | 201 | 201 OK |
| 1023 | GET | `/api/v1/logistics/admin/analytics/cost-per-route` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1024 | GET | `/api/v1/logistics/admin/analytics/kpis` | ADMIN | PASS | 200 | 200 OK |
| 1025 | GET | `/api/v1/logistics/admin/analytics/sla-breaches` | ADMIN | PASS | 200 | 200 OK |
| 1026 | GET | `/api/v1/logistics/admin/providers` | ADMIN | PASS | 200 | 200 OK |
| 1027 | PATCH | `/api/v1/logistics/admin/providers/:id` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1028 | POST | `/api/v1/logistics/admin/providers/:id/reorder` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1029 | POST | `/api/v1/logistics/estimate` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1030 | GET | `/api/v1/logistics/health` | PUBLIC | PASS | 200 | 200 OK |
| 1031 | GET | `/api/v1/logistics/orders` | ADMIN | PASS | 200 | 200 OK |
| 1032 | POST | `/api/v1/logistics/orders` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1033 | GET | `/api/v1/logistics/orders/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1034 | POST | `/api/v1/logistics/orders/:id/cancel` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1035 | PATCH | `/api/v1/logistics/orders/:id/status` | ADMIN | PASS | 200 | 200 OK |
| 1036 | GET | `/api/v1/logistics/orders/:id/tracking` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1037 | POST | `/api/v1/logistics/webhooks/porter` | PUBLIC | PASS | 200 | 200 OK |
| 1038 | GET | `/api/v1/merch/alerts` | ADMIN | PASS | 200 | 200 OK |
| 1039 | PUT | `/api/v1/merch/alerts/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1040 | PUT | `/api/v1/merch/alerts/bulk-update` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1041 | POST | `/api/v1/merch/alerts/clear-resolved` | ADMIN | PASS | 200 | 200 OK |
| 1042 | GET | `/api/v1/merch/allocation` | ADMIN | PASS | 200 | 200 OK |
| 1043 | GET | `/api/v1/merch/allocation/alerts` | ADMIN | PASS | 200 | 200 OK |
| 1044 | POST | `/api/v1/merch/allocation/alerts` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1045 | PUT | `/api/v1/merch/allocation/alerts/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1046 | GET | `/api/v1/merch/allocation/references/locations` | ADMIN | PASS | 200 | 200 OK |
| 1047 | GET | `/api/v1/merch/allocation/sku/:skuId/history` | ADMIN | PASS | 200 | 200 OK |
| 1048 | GET | `/api/v1/merch/analytics/campaign/:entityId` | ADMIN | PASS | 200 | 200 OK |
| 1049 | POST | `/api/v1/merch/analytics/records` | ADMIN | PASS | 201 | 201 OK |
| 1050 | GET | `/api/v1/merch/analytics/summary` | ADMIN | PASS | 200 | 200 OK |
| 1051 | GET | `/api/v1/merch/campaigns` | ADMIN | PASS | 200 | 200 OK |
| 1052 | POST | `/api/v1/merch/campaigns` | ADMIN | PASS | 201 | 201 OK |
| 1053 | DELETE | `/api/v1/merch/campaigns/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1054 | GET | `/api/v1/merch/campaigns/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1055 | PUT | `/api/v1/merch/campaigns/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1056 | GET | `/api/v1/merch/catalog/collections` | ADMIN | PASS | 200 | 200 OK |
| 1057 | POST | `/api/v1/merch/catalog/collections` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1058 | DELETE | `/api/v1/merch/catalog/collections/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1059 | PUT | `/api/v1/merch/catalog/collections/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1060 | GET | `/api/v1/merch/catalog/skus` | ADMIN | PASS | 200 | 200 OK |
| 1061 | POST | `/api/v1/merch/catalog/skus` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1062 | DELETE | `/api/v1/merch/catalog/skus/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1063 | PUT | `/api/v1/merch/catalog/skus/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1064 | PATCH | `/api/v1/merch/catalog/skus/:id/visibility` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1065 | GET | `/api/v1/merch/citywide/dispatch` | ADMIN | PASS | 200 | 200 OK |
| 1066 | PATCH | `/api/v1/merch/citywide/dispatch` | ADMIN | PASS | 200 | 200 OK |
| 1067 | GET | `/api/v1/merch/citywide/dispatch/logs` | ADMIN | PASS | 200 | 200 OK |
| 1068 | POST | `/api/v1/merch/citywide/dispatch/manual-override` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1069 | POST | `/api/v1/merch/citywide/dispatch/restart` | ADMIN | PASS | 200 | 200 OK |
| 1070 | GET | `/api/v1/merch/citywide/exceptions` | ADMIN | PASS | 200 | 200 OK |
| 1071 | POST | `/api/v1/merch/citywide/exceptions/:id/resolve` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1072 | GET | `/api/v1/merch/citywide/incidents` | ADMIN | PASS | 200 | 200 OK |
| 1073 | GET | `/api/v1/merch/citywide/incidents/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1074 | PATCH | `/api/v1/merch/citywide/incidents/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1075 | GET | `/api/v1/merch/citywide/integration-health` | ADMIN | PASS | 200 | 200 OK |
| 1076 | GET | `/api/v1/merch/citywide/live-metrics` | ADMIN | PASS | 200 | 200 OK |
| 1077 | GET | `/api/v1/merch/citywide/sla` | ADMIN | PASS | 200 | 200 OK |
| 1078 | DELETE | `/api/v1/merch/citywide/surge` | ADMIN | PASS | 200 | 200 OK |
| 1079 | GET | `/api/v1/merch/citywide/surge` | ADMIN | PASS | 200 | 200 OK |
| 1080 | PUT | `/api/v1/merch/citywide/surge` | ADMIN | PASS | 200 | 200 OK |
| 1081 | POST | `/api/v1/merch/citywide/surge/actions` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1082 | GET | `/api/v1/merch/citywide/zones` | ADMIN | PASS | 200 | 200 OK |
| 1083 | GET | `/api/v1/merch/citywide/zones/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1084 | POST | `/api/v1/merch/citywide/zones/:id/request-riders` | ADMIN | PASS | 201 | 201 OK |
| 1085 | GET | `/api/v1/merch/citywide/zones/:id/trend` | ADMIN | PASS | 200 | 200 OK |
| 1086 | GET | `/api/v1/merch/compliance/approvals` | ADMIN | PASS | 200 | 200 OK |
| 1087 | PUT | `/api/v1/merch/compliance/approvals/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1088 | POST | `/api/v1/merch/compliance/approvals/bulk` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1089 | GET | `/api/v1/merch/compliance/audits` | ADMIN | PASS | 200 | 200 OK |
| 1090 | GET | `/api/v1/merch/compliance/summary` | ADMIN | PASS | 200 | 200 OK |
| 1091 | GET | `/api/v1/merch/geofence/history` | ADMIN | PASS | 200 | 200 OK |
| 1092 | GET | `/api/v1/merch/geofence/overlaps` | ADMIN | PASS | 200 | 200 OK |
| 1093 | GET | `/api/v1/merch/geofence/promo-heatmap` | ADMIN | PASS | 200 | 200 OK |
| 1094 | GET | `/api/v1/merch/geofence/stats` | ADMIN | PASS | 200 | 200 OK |
| 1095 | GET | `/api/v1/merch/geofence/stores` | ADMIN | PASS | 200 | 200 OK |
| 1096 | PUT | `/api/v1/merch/geofence/stores/:id` | ADMIN | PASS | 200 | 200 OK |
| 1097 | GET | `/api/v1/merch/geofence/zones` | ADMIN | PASS | 200 | 200 OK |
| 1098 | POST | `/api/v1/merch/geofence/zones` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1099 | DELETE | `/api/v1/merch/geofence/zones/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1100 | GET | `/api/v1/merch/geofence/zones/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1101 | PATCH | `/api/v1/merch/geofence/zones/:id` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1102 | PUT | `/api/v1/merch/geofence/zones/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1103 | GET | `/api/v1/merch/health` | PUBLIC | PASS | 200 | 200 OK |
| 1104 | GET | `/api/v1/merch/overview/conflicts` | ADMIN | PASS | 200 | 200 OK |
| 1105 | POST | `/api/v1/merch/overview/conflicts` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1106 | GET | `/api/v1/merch/overview/performance-report` | ADMIN | PASS | 200 | 200 OK |
| 1107 | GET | `/api/v1/merch/overview/price-changes` | ADMIN | PASS | 200 | 200 OK |
| 1108 | POST | `/api/v1/merch/overview/price-changes` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1109 | GET | `/api/v1/merch/overview/stats` | ADMIN | PASS | 200 | 200 OK |
| 1110 | GET | `/api/v1/merch/overview/uplift` | ADMIN | PASS | 200 | 200 OK |
| 1111 | POST | `/api/v1/merch/overview/uplift` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1112 | GET | `/api/v1/merch/pricing/bundles` | ADMIN | PASS | 200 | 200 OK |
| 1113 | POST | `/api/v1/merch/pricing/bundles` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1114 | DELETE | `/api/v1/merch/pricing/bundles/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1115 | PUT | `/api/v1/merch/pricing/bundles/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1116 | GET | `/api/v1/merch/pricing/coupons` | ADMIN | PASS | 200 | 200 OK |
| 1117 | POST | `/api/v1/merch/pricing/coupons` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1118 | DELETE | `/api/v1/merch/pricing/coupons/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1119 | PUT | `/api/v1/merch/pricing/coupons/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1120 | POST | `/api/v1/merch/pricing/coupons/generate-code` | ADMIN | PASS | 200 | 200 OK |
| 1121 | GET | `/api/v1/merch/pricing/discount-campaigns` | ADMIN | PASS | 200 | 200 OK |
| 1122 | POST | `/api/v1/merch/pricing/discount-campaigns` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1123 | DELETE | `/api/v1/merch/pricing/discount-campaigns/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1124 | PUT | `/api/v1/merch/pricing/discount-campaigns/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1125 | GET | `/api/v1/merch/pricing/flash-sales` | ADMIN | PASS | 200 | 200 OK |
| 1126 | POST | `/api/v1/merch/pricing/flash-sales` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1127 | DELETE | `/api/v1/merch/pricing/flash-sales/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1128 | PUT | `/api/v1/merch/pricing/flash-sales/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1129 | GET | `/api/v1/merch/pricing/pending-updates` | ADMIN | PASS | 200 | 200 OK |
| 1130 | POST | `/api/v1/merch/pricing/pending-updates/:id/handle` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1131 | GET | `/api/v1/merch/pricing/price-rules` | ADMIN | PASS | 200 | 200 OK |
| 1132 | POST | `/api/v1/merch/pricing/price-rules` | ADMIN | PASS | 201 | 201 OK |
| 1133 | GET | `/api/v1/merch/pricing/skus` | ADMIN | PASS | 200 | 200 OK |
| 1134 | PATCH | `/api/v1/merch/pricing/skus/:id/price` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1135 | PATCH | `/api/v1/merch/pricing/skus/bulk-price` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1136 | GET | `/api/v1/merch/pricing/stats` | ADMIN | PASS | 200 | 200 OK |
| 1137 | GET | `/api/v1/merch/pricing/surge-config` | ADMIN | PASS | 200 | 200 OK |
| 1138 | PUT | `/api/v1/merch/pricing/surge-config` | ADMIN | PASS | 200 | 200 OK |
| 1139 | GET | `/api/v1/merch/pricing/surge-rules` | ADMIN | PASS | 200 | 200 OK |
| 1140 | POST | `/api/v1/merch/pricing/surge-rules` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1141 | DELETE | `/api/v1/merch/pricing/surge-rules/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1142 | PUT | `/api/v1/merch/pricing/surge-rules/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1143 | POST | `/api/v1/production/alerts/:alertId/action` | ADMIN | PASS | 201 | 201 OK |
| 1144 | GET | `/api/v1/production/alerts/debug/ids` | ADMIN | PASS | 200 | 200 OK |
| 1145 | GET | `/api/v1/production/analytics` | ADMIN | PASS | 200 | 200 OK |
| 1146 | POST | `/api/v1/production/analytics/export` | ADMIN | PASS | 201 | 201 OK |
| 1147 | GET | `/api/v1/production/analytics/fleet-utilization` | ADMIN | PASS | 200 | 200 OK |
| 1148 | GET | `/api/v1/production/analytics/rider-performance` | ADMIN | PASS | 200 | 200 OK |
| 1149 | GET | `/api/v1/production/analytics/sla-adherence` | ADMIN | PASS | 200 | 200 OK |
| 1150 | GET | `/api/v1/production/dashboard/alert-history` | ADMIN | PASS | 200 | 200 OK |
| 1151 | GET | `/api/v1/production/dashboard/alerts` | ADMIN | PASS | 200 | 200 OK |
| 1152 | GET | `/api/v1/production/dashboard/alerts/:alertId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1153 | PUT | `/api/v1/production/dashboard/alerts/:alertId/status` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1154 | DELETE | `/api/v1/production/dashboard/alerts/resolved` | ADMIN | PASS | 200 | 200 OK |
| 1155 | GET | `/api/v1/production/dashboard/incidents` | ADMIN | PASS | 200 | 200 OK |
| 1156 | POST | `/api/v1/production/dashboard/incidents` | ADMIN | PASS | 201 | 201 OK |
| 1157 | PUT | `/api/v1/production/dashboard/incidents/:incidentId/status` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1158 | GET | `/api/v1/production/dashboard/live-orders` | ADMIN | PASS | 200 | 200 OK |
| 1159 | GET | `/api/v1/production/dashboard/refresh` | ADMIN | PASS | 200 | 200 OK |
| 1160 | POST | `/api/v1/production/dashboard/refresh` | ADMIN | PASS | 201 | 201 OK |
| 1161 | GET | `/api/v1/production/dashboard/reports` | ADMIN | PASS | 200 | 200 OK |
| 1162 | GET | `/api/v1/production/dashboard/reports/export` | ADMIN | PASS | 200 | 200 OK |
| 1163 | GET | `/api/v1/production/dashboard/rto-alerts` | ADMIN | PASS | 200 | 200 OK |
| 1164 | GET | `/api/v1/production/dashboard/staff-load` | ADMIN | PASS | 200 | 200 OK |
| 1165 | GET | `/api/v1/production/dashboard/stock-alerts` | ADMIN | PASS | 200 | 200 OK |
| 1166 | GET | `/api/v1/production/dashboard/summary` | ADMIN | PASS | 200 | 200 OK |
| 1167 | POST | `/api/v1/production/dashboard/utilities/hsd-sync` | ADMIN | PASS | 201 | 201 OK |
| 1168 | GET | `/api/v1/production/dashboard/utilities/settings` | ADMIN | PASS | 200 | 200 OK |
| 1169 | PUT | `/api/v1/production/dashboard/utilities/settings` | ADMIN | PASS | 200 | 200 OK |
| 1170 | GET | `/api/v1/production/dashboard/utilities/sync-history` | ADMIN | PASS | 200 | 200 OK |
| 1171 | GET | `/api/v1/production/dashboard/utilities/upload-history` | ADMIN | PASS | 200 | 200 OK |
| 1172 | GET | `/api/v1/production/factories` | ADMIN | PASS | 200 | 200 OK |
| 1173 | GET | `/api/v1/production/health` | PUBLIC | PASS | 200 | 200 OK |
| 1174 | GET | `/api/v1/production/health-status/checklists` | ADMIN | PASS | 200 | 200 OK |
| 1175 | PUT | `/api/v1/production/health-status/checklists/:checklistId/items/:itemId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1176 | POST | `/api/v1/production/health-status/checklists/:checklistId/submit` | ADMIN | PASS | 200 | 200 OK |
| 1177 | GET | `/api/v1/production/health-status/equipment` | ADMIN | PASS | 200 | 200 OK |
| 1178 | GET | `/api/v1/production/health-status/incidents` | ADMIN | PASS | 200 | 200 OK |
| 1179 | POST | `/api/v1/production/health-status/incidents` | ADMIN | PASS | 201 | 201 OK |
| 1180 | PUT | `/api/v1/production/health-status/incidents/:incidentId/resolve` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1181 | GET | `/api/v1/production/health-status/summary` | ADMIN | PASS | 200 | 200 OK |
| 1182 | GET | `/api/v1/production/hsd/devices/:deviceId/actions` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1183 | POST | `/api/v1/production/hsd/devices/:deviceId/assign` | ADMIN | PASS | 200 | 200 OK |
| 1184 | POST | `/api/v1/production/hsd/devices/:deviceId/control` | ADMIN | PASS | 200 | 200 OK |
| 1185 | GET | `/api/v1/production/hsd/devices/:deviceId/history` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1186 | POST | `/api/v1/production/hsd/devices/:deviceId/unassign` | ADMIN | PASS | 200 | 200 OK |
| 1187 | POST | `/api/v1/production/hsd/devices/bulk-reset` | ADMIN | PASS | 200 | 200 OK |
| 1188 | POST | `/api/v1/production/hsd/devices/register` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1189 | GET | `/api/v1/production/hsd/fleet` | ADMIN | PASS | 200 | 200 OK |
| 1190 | GET | `/api/v1/production/hsd/issues` | ADMIN | PASS | 200 | 200 OK |
| 1191 | POST | `/api/v1/production/hsd/issues/report` | ADMIN | PASS | 200 | 200 OK |
| 1192 | GET | `/api/v1/production/hsd/logs` | ADMIN | PASS | 200 | 200 OK |
| 1193 | GET | `/api/v1/production/hsd/picker-users` | ADMIN | PASS | 200 | 200 OK |
| 1194 | POST | `/api/v1/production/hsd/requisitions` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1195 | POST | `/api/v1/production/hsd/sessions/:deviceId/action` | ADMIN | PASS | 200 | 200 OK |
| 1196 | GET | `/api/v1/production/hsd/sessions/live` | ADMIN | PASS | 200 | 200 OK |
| 1197 | GET | `/api/v1/production/inbound/grns` | ADMIN | PASS | 200 | 200 OK |
| 1198 | POST | `/api/v1/production/inbound/grns` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1199 | GET | `/api/v1/production/inbound/grns/:grnId` | ADMIN | PASS | 200 | 200 OK |
| 1200 | POST | `/api/v1/production/inbound/grns/:grnId/complete` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1201 | PUT | `/api/v1/production/inbound/grns/:grnId/items/:sku` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1202 | POST | `/api/v1/production/inbound/grns/:grnId/start` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1203 | PATCH | `/api/v1/production/inbound/grns/:id/status` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1204 | GET | `/api/v1/production/inbound/putaway` | ADMIN | PASS | 200 | 200 OK |
| 1205 | POST | `/api/v1/production/inbound/putaway/:taskId/assign` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1206 | POST | `/api/v1/production/inbound/putaway/:taskId/complete` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1207 | GET | `/api/v1/production/inbound/summary` | ADMIN | PASS | 200 | 200 OK |
| 1208 | GET | `/api/v1/production/inbound/transfers` | ADMIN | PASS | 200 | 200 OK |
| 1209 | POST | `/api/v1/production/inbound/transfers/:transferId/receive` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1210 | POST | `/api/v1/production/inbound/transfers/sync` | ADMIN | PASS | 201 | 201 OK |
| 1211 | GET | `/api/v1/production/inventory` | ADMIN | PASS | 200 | 200 OK |
| 1212 | PATCH | `/api/v1/production/inventory/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1213 | GET | `/api/v1/production/inventory/adjustments` | ADMIN | PASS | 200 | 200 OK |
| 1214 | POST | `/api/v1/production/inventory/adjustments` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1215 | GET | `/api/v1/production/inventory/audit-log` | ADMIN | PASS | 200 | 200 OK |
| 1216 | GET | `/api/v1/production/inventory/cycle-count` | ADMIN | PASS | 200 | 200 OK |
| 1217 | GET | `/api/v1/production/inventory/cycle-count/report` | ADMIN | PASS | 200 | 200 OK |
| 1218 | PUT | `/api/v1/production/inventory/items/:sku` | ADMIN | PASS | 200 | 200 OK |
| 1219 | GET | `/api/v1/production/inventory/restock` | ADMIN | PASS | 200 | 200 OK |
| 1220 | POST | `/api/v1/production/inventory/restock` | ADMIN | PASS | 201 | 201 OK |
| 1221 | POST | `/api/v1/production/inventory/restock-task` | ADMIN | PASS | 201 | 201 OK |
| 1222 | POST | `/api/v1/production/inventory/scan` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1223 | GET | `/api/v1/production/inventory/shelf-view` | ADMIN | PASS | 200 | 200 OK |
| 1224 | GET | `/api/v1/production/inventory/stock-levels` | ADMIN | PASS | 200 | 200 OK |
| 1225 | DELETE | `/api/v1/production/inventory/stock-levels/:sku` | ADMIN | PASS | 200 | 200 OK |
| 1226 | PUT | `/api/v1/production/inventory/stock-levels/:sku` | ADMIN | PASS | 200 | 200 OK |
| 1227 | PUT | `/api/v1/production/inventory/stock-levels/:sku/status` | ADMIN | PASS | 200 | 200 OK |
| 1228 | GET | `/api/v1/production/maintenance/equipment` | ADMIN | PASS | 200 | 200 OK |
| 1229 | POST | `/api/v1/production/maintenance/equipment` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1230 | DELETE | `/api/v1/production/maintenance/equipment/:equipmentId` | ADMIN | PASS | 200 | 200 OK |
| 1231 | PUT | `/api/v1/production/maintenance/equipment/:equipmentId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1232 | GET | `/api/v1/production/maintenance/iot` | ADMIN | PASS | 200 | 200 OK |
| 1233 | GET | `/api/v1/production/maintenance/tasks` | ADMIN | PASS | 200 | 200 OK |
| 1234 | POST | `/api/v1/production/maintenance/tasks` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1235 | DELETE | `/api/v1/production/maintenance/tasks/:taskId` | ADMIN | PASS | 200 | 200 OK |
| 1236 | PUT | `/api/v1/production/maintenance/tasks/:taskId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1237 | PATCH | `/api/v1/production/maintenance/tasks/:taskId/status` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1238 | GET | `/api/v1/production/orders` | ADMIN | PASS | 200 | 200 OK |
| 1239 | GET | `/api/v1/production/orders/:orderId/call-customer` | ADMIN | PASS | 200 | 200 OK |
| 1240 | POST | `/api/v1/production/orders/:orderId/call-customer` | ADMIN | PASS | 201 | 201 OK |
| 1241 | GET | `/api/v1/production/orders/:orderId/mark-rto` | ADMIN | PASS | 200 | 200 OK |
| 1242 | POST | `/api/v1/production/orders/:orderId/mark-rto` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1243 | GET | `/api/v1/production/outbound/dispatch` | ADMIN | PASS | 200 | 200 OK |
| 1244 | POST | `/api/v1/production/outbound/dispatch/assign` | ADMIN | PASS | 200 | 200 OK |
| 1245 | POST | `/api/v1/production/outbound/dispatch/batch` | ADMIN | PASS | 200 | 200 OK |
| 1246 | GET | `/api/v1/production/outbound/riders` | ADMIN | PASS | 200 | 200 OK |
| 1247 | GET | `/api/v1/production/outbound/summary` | ADMIN | PASS | 200 | 200 OK |
| 1248 | GET | `/api/v1/production/outbound/transfers` | ADMIN | PASS | 200 | 200 OK |
| 1249 | POST | `/api/v1/production/outbound/transfers/:requestId/approve` | ADMIN | PASS | 200 | 200 OK |
| 1250 | GET | `/api/v1/production/outbound/transfers/:requestId/fulfillment` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1251 | POST | `/api/v1/production/outbound/transfers/:requestId/reject` | ADMIN | PASS | 200 | 200 OK |
| 1252 | GET | `/api/v1/production/outbound/transfers/sla-summary` | ADMIN | PASS | 200 | 200 OK |
| 1253 | GET | `/api/v1/production/overview` | ADMIN | PASS | 200 | 200 OK |
| 1254 | POST | `/api/v1/production/overview/batch` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1255 | POST | `/api/v1/production/overview/lines` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1256 | DELETE | `/api/v1/production/overview/lines/:lineId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1257 | PATCH | `/api/v1/production/overview/lines/:lineId` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1258 | PUT | `/api/v1/production/overview/lines/:lineId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1259 | GET | `/api/v1/production/packing/orders/:orderId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1260 | POST | `/api/v1/production/packing/orders/:orderId/complete` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1261 | POST | `/api/v1/production/packing/orders/:orderId/report-damaged` | ADMIN | PASS | 201 | 201 OK |
| 1262 | POST | `/api/v1/production/packing/orders/:orderId/report-missing` | ADMIN | PASS | 201 | 201 OK |
| 1263 | POST | `/api/v1/production/packing/orders/:orderId/scan` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1264 | GET | `/api/v1/production/packing/queue` | ADMIN | PASS | 200 | 200 OK |
| 1265 | GET | `/api/v1/production/picker/available` | ADMIN | PASS | 200 | 200 OK |
| 1266 | GET | `/api/v1/production/picklist` | ADMIN | PASS | 200 | 200 OK |
| 1267 | POST | `/api/v1/production/picklist` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1268 | GET | `/api/v1/production/picklist/:picklistId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1269 | POST | `/api/v1/production/picklist/:picklistId/assign` | ADMIN | PASS | 200 | 200 OK |
| 1270 | POST | `/api/v1/production/picklist/:picklistId/complete` | ADMIN | PASS | 200 | 200 OK |
| 1271 | POST | `/api/v1/production/picklist/:picklistId/move-to-packing` | ADMIN | PASS | 200 | 200 OK |
| 1272 | POST | `/api/v1/production/picklist/:picklistId/pause` | ADMIN | PASS | 200 | 200 OK |
| 1273 | POST | `/api/v1/production/picklist/:picklistId/start` | ADMIN | PASS | 200 | 200 OK |
| 1274 | GET | `/api/v1/production/planning` | ADMIN | PASS | 200 | 200 OK |
| 1275 | POST | `/api/v1/production/planning` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1276 | DELETE | `/api/v1/production/planning/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1277 | PUT | `/api/v1/production/planning/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1278 | GET | `/api/v1/production/qc/checks` | ADMIN | PASS | 200 | 200 OK |
| 1279 | PUT | `/api/v1/production/qc/checks/:itemId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1280 | GET | `/api/v1/production/qc/compliance/audit-status` | ADMIN | PASS | 200 | 200 OK |
| 1281 | GET | `/api/v1/production/qc/compliance/logs` | ADMIN | PASS | 200 | 200 OK |
| 1282 | POST | `/api/v1/production/qc/compliance/logs` | ADMIN | PASS | 201 | 201 OK |
| 1283 | GET | `/api/v1/production/qc/docs` | ADMIN | PASS | 200 | 200 OK |
| 1284 | GET | `/api/v1/production/qc/failures` | ADMIN | PASS | 200 | 200 OK |
| 1285 | POST | `/api/v1/production/qc/failures/:failureId/resolve` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1286 | GET | `/api/v1/production/qc/history` | ADMIN | PASS | 200 | 200 OK |
| 1287 | GET | `/api/v1/production/qc/inspections` | ADMIN | PASS | 200 | 200 OK |
| 1288 | POST | `/api/v1/production/qc/inspections` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1289 | DELETE | `/api/v1/production/qc/inspections/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1290 | PUT | `/api/v1/production/qc/inspections/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1291 | GET | `/api/v1/production/qc/recent-failures` | ADMIN | PASS | 200 | 200 OK |
| 1292 | GET | `/api/v1/production/qc/rejections` | ADMIN | PASS | 200 | 200 OK |
| 1293 | POST | `/api/v1/production/qc/rejections` | ADMIN | PASS | 201 | 201 OK |
| 1294 | GET | `/api/v1/production/qc/samples` | ADMIN | PASS | 200 | 200 OK |
| 1295 | POST | `/api/v1/production/qc/samples` | ADMIN | PASS | 201 | 201 OK |
| 1296 | DELETE | `/api/v1/production/qc/samples/:sampleId` | ADMIN | PASS | 200 | 200 OK |
| 1297 | PUT | `/api/v1/production/qc/samples/:sampleId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1298 | GET | `/api/v1/production/qc/summary` | ADMIN | PASS | 200 | 200 OK |
| 1299 | GET | `/api/v1/production/qc/temperature` | ADMIN | PASS | 200 | 200 OK |
| 1300 | POST | `/api/v1/production/qc/temperature` | ADMIN | PASS | 201 | 201 OK |
| 1301 | GET | `/api/v1/production/qc/watchlist` | ADMIN | PASS | 200 | 200 OK |
| 1302 | POST | `/api/v1/production/qc/watchlist` | ADMIN | PASS | 201 | 201 OK |
| 1303 | POST | `/api/v1/production/qc/watchlist/:sku/log-check` | ADMIN | PASS | 201 | 201 OK |
| 1304 | GET | `/api/v1/production/raw-materials/materials` | ADMIN | PASS | 200 | 200 OK |
| 1305 | POST | `/api/v1/production/raw-materials/materials` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1306 | DELETE | `/api/v1/production/raw-materials/materials/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1307 | PUT | `/api/v1/production/raw-materials/materials/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1308 | POST | `/api/v1/production/raw-materials/materials/:id/order` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1309 | GET | `/api/v1/production/raw-materials/receipts` | ADMIN | PASS | 200 | 200 OK |
| 1310 | POST | `/api/v1/production/raw-materials/receipts/:id/receive` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1311 | GET | `/api/v1/production/raw-materials/requisitions` | ADMIN | PASS | 200 | 200 OK |
| 1312 | POST | `/api/v1/production/raw-materials/requisitions` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1313 | PATCH | `/api/v1/production/raw-materials/requisitions/:id/status` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1314 | GET | `/api/v1/production/settings` | ADMIN | PASS | 200 | 200 OK |
| 1315 | PUT | `/api/v1/production/settings` | ADMIN | PASS | 200 | 200 OK |
| 1316 | POST | `/api/v1/production/staff` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1317 | PATCH | `/api/v1/production/staff/:staffId/status` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1318 | GET | `/api/v1/production/staff/absences` | ADMIN | PASS | 200 | 200 OK |
| 1319 | POST | `/api/v1/production/staff/absences` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1320 | GET | `/api/v1/production/staff/attendance` | ADMIN | PASS | 200 | 200 OK |
| 1321 | PATCH | `/api/v1/production/staff/attendance/:recordId/mark-present` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1322 | GET | `/api/v1/production/staff/performance` | ADMIN | PASS | 200 | 200 OK |
| 1323 | GET | `/api/v1/production/staff/performance/download` | ADMIN | PASS | 200 | 200 OK |
| 1324 | GET | `/api/v1/production/staff/roster` | ADMIN | PASS | 200 | 200 OK |
| 1325 | GET | `/api/v1/production/staff/shift-coverage` | ADMIN | PASS | 200 | 200 OK |
| 1326 | POST | `/api/v1/production/staff/shift-coverage` | ADMIN | PASS | 201 | 201 OK |
| 1327 | POST | `/api/v1/production/staff/shifts/auto-assign-ot` | ADMIN | PASS | 201 | 201 OK |
| 1328 | GET | `/api/v1/production/staff/summary` | ADMIN | PASS | 200 | 200 OK |
| 1329 | GET | `/api/v1/production/staff/weekly-roster` | ADMIN | PASS | 200 | 200 OK |
| 1330 | POST | `/api/v1/production/staff/weekly-roster/publish` | ADMIN | PASS | 201 | 201 OK |
| 1331 | GET | `/api/v1/production/utilities/audit-logs` | ADMIN | PASS | 200 | 200 OK |
| 1332 | POST | `/api/v1/production/utilities/audit-logs/export` | ADMIN | PASS | 200 | 200 OK |
| 1333 | POST | `/api/v1/production/utilities/inventory/bulk-upload` | ADMIN | PASS | 201 | 201 OK |
| 1334 | GET | `/api/v1/production/utilities/inventory/upload-template` | ADMIN | PASS | 200 | 200 OK |
| 1335 | POST | `/api/v1/production/utilities/labels/generate` | ADMIN | PASS | 201 | 201 OK |
| 1336 | POST | `/api/v1/production/utilities/system/diagnostics` | ADMIN | PASS | 201 | 201 OK |
| 1337 | GET | `/api/v1/production/utilities/system/status` | ADMIN | PASS | 200 | 200 OK |
| 1338 | POST | `/api/v1/production/utilities/system/sync` | ADMIN | PASS | 201 | 201 OK |
| 1339 | GET | `/api/v1/production/work-orders` | ADMIN | PASS | 200 | 200 OK |
| 1340 | POST | `/api/v1/production/work-orders` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1341 | DELETE | `/api/v1/production/work-orders/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1342 | GET | `/api/v1/production/work-orders/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1343 | PUT | `/api/v1/production/work-orders/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1344 | POST | `/api/v1/production/work-orders/:id/assign` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1345 | PATCH | `/api/v1/production/work-orders/:id/status` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1346 | GET | `/api/v1/rider` | ADMIN | PASS | 200 | 200 OK |
| 1347 | POST | `/api/v1/rider` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1348 | GET | `/api/v1/rider/:riderId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1349 | PUT | `/api/v1/rider/:riderId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1350 | GET | `/api/v1/rider/:riderId/compliance` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1351 | GET | `/api/v1/rider/:riderId/contract` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1352 | GET | `/api/v1/rider/:riderId/location` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1353 | GET | `/api/v1/rider/:riderId/shifts` | ADMIN | PASS | 200 | 200 OK |
| 1354 | GET | `/api/v1/rider/:riderId/training` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1355 | GET | `/api/v1/rider/audit/logs` | ADMIN | PASS | 200 | 200 OK |
| 1356 | GET | `/api/v1/rider/compliance` | ADMIN | PASS | 200 | 200 OK |
| 1357 | GET | `/api/v1/rider/compliance/:riderId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1358 | POST | `/api/v1/rider/compliance/:riderId/suspend` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1359 | POST | `/api/v1/rider/compliance/:riderId/unsuspend` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1360 | GET | `/api/v1/rider/contracts` | ADMIN | PASS | 200 | 200 OK |
| 1361 | GET | `/api/v1/rider/contracts/:riderId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1362 | POST | `/api/v1/rider/contracts/:riderId/renew` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1363 | POST | `/api/v1/rider/contracts/:riderId/terminate` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1364 | GET | `/api/v1/rider/dashboard/counts` | ADMIN | PASS | 200 | 200 OK |
| 1365 | POST | `/api/v1/rider/dispatch/assign` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1366 | POST | `/api/v1/rider/dispatch/auto-assign` | ADMIN | PASS | 200 | 200 OK |
| 1367 | GET | `/api/v1/rider/dispatch/auto-assign/rules` | ADMIN | PASS | 200 | 200 OK |
| 1368 | PUT | `/api/v1/rider/dispatch/auto-assign/rules` | ADMIN | PASS | 200 | 200 OK |
| 1369 | POST | `/api/v1/rider/dispatch/batch-assign` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1370 | POST | `/api/v1/rider/dispatch/batch-assign-by-store` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1371 | POST | `/api/v1/rider/dispatch/cluster-metrics` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1372 | GET | `/api/v1/rider/dispatch/clusters` | ADMIN | PASS | 200 | 200 OK |
| 1373 | POST | `/api/v1/rider/dispatch/clusters` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1374 | DELETE | `/api/v1/rider/dispatch/clusters/:clusterId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1375 | POST | `/api/v1/rider/dispatch/clusters/:clusterId/assign` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1376 | PUT | `/api/v1/rider/dispatch/clusters/:clusterId/orders` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1377 | GET | `/api/v1/rider/dispatch/group-delivery` | ADMIN | PASS | 200 | 200 OK |
| 1378 | GET | `/api/v1/rider/dispatch/group-delivery/filter-options` | ADMIN | PASS | 200 | 200 OK |
| 1379 | GET | `/api/v1/rider/dispatch/group-orders` | ADMIN | PASS | 200 | 200 OK |
| 1380 | POST | `/api/v1/rider/dispatch/manual-order` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1381 | GET | `/api/v1/rider/dispatch/map` | ADMIN | PASS | 200 | 200 OK |
| 1382 | GET | `/api/v1/rider/dispatch/map/orders` | ADMIN | PASS | 200 | 200 OK |
| 1383 | GET | `/api/v1/rider/dispatch/map/riders` | ADMIN | PASS | 200 | 200 OK |
| 1384 | GET | `/api/v1/rider/dispatch/orders/:orderId/assignment` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1385 | GET | `/api/v1/rider/dispatch/orders/:orderId/recommendations` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1386 | POST | `/api/v1/rider/dispatch/simulate` | ADMIN | PASS | 200 | 200 OK |
| 1387 | GET | `/api/v1/rider/dispatch/unassigned` | ADMIN | PASS | 200 | 200 OK |
| 1388 | GET | `/api/v1/rider/dispatch/unassigned/count` | ADMIN | PASS | 200 | 200 OK |
| 1389 | GET | `/api/v1/rider/distribution` | ADMIN | PASS | 200 | 200 OK |
| 1390 | GET | `/api/v1/rider/fleet` | ADMIN | PASS | 200 | 200 OK |
| 1391 | POST | `/api/v1/rider/fleet` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1392 | DELETE | `/api/v1/rider/fleet/:vehicleId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1393 | PUT | `/api/v1/rider/fleet/:vehicleId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1394 | GET | `/api/v1/rider/fleet/maintenance` | ADMIN | PASS | 200 | 200 OK |
| 1395 | POST | `/api/v1/rider/fleet/maintenance` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1396 | GET | `/api/v1/rider/fleet/maintenance/:taskId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1397 | PUT | `/api/v1/rider/fleet/maintenance/:taskId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1398 | GET | `/api/v1/rider/fleet/summary` | ADMIN | PASS | 200 | 200 OK |
| 1399 | GET | `/api/v1/rider/fleet/vehicles` | ADMIN | PASS | 200 | 200 OK |
| 1400 | POST | `/api/v1/rider/fleet/vehicles` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1401 | GET | `/api/v1/rider/fleet/vehicles/:vehicleId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1402 | PUT | `/api/v1/rider/fleet/vehicles/:vehicleId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1403 | GET | `/api/v1/rider/health` | PUBLIC | PASS | 200 | 200 OK |
| 1404 | GET | `/api/v1/rider/hr/access` | ADMIN | PASS | 200 | 200 OK |
| 1405 | PUT | `/api/v1/rider/hr/access/:riderId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1406 | GET | `/api/v1/rider/hr/compliance/:riderId/suspension` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1407 | PUT | `/api/v1/rider/hr/compliance/:riderId/suspension` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1408 | GET | `/api/v1/rider/hr/compliance/:riderId/violations` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1409 | GET | `/api/v1/rider/hr/compliance/alerts` | ADMIN | PASS | 200 | 200 OK |
| 1410 | GET | `/api/v1/rider/hr/contracts` | ADMIN | PASS | 200 | 200 OK |
| 1411 | GET | `/api/v1/rider/hr/contracts/:riderId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1412 | PUT | `/api/v1/rider/hr/contracts/:riderId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1413 | POST | `/api/v1/rider/hr/contracts/:riderId/renew` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1414 | POST | `/api/v1/rider/hr/contracts/:riderId/terminate` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1415 | GET | `/api/v1/rider/hr/dashboard/summary` | ADMIN | PASS | 200 | 200 OK |
| 1416 | DELETE | `/api/v1/rider/hr/devices/:riderId` | ADMIN | PASS | 200 | 200 OK |
| 1417 | POST | `/api/v1/rider/hr/devices/:riderId` | ADMIN | PASS | 200 | 200 OK |
| 1418 | GET | `/api/v1/rider/hr/documents` | ADMIN | PASS | 200 | 200 OK |
| 1419 | GET | `/api/v1/rider/hr/documents/:documentId` | ADMIN | PASS | 200 | 200 OK |
| 1420 | PUT | `/api/v1/rider/hr/documents/:documentId` | ADMIN | PASS | 200 | 200 OK |
| 1421 | GET | `/api/v1/rider/hr/documents/:documentId/download` | ADMIN | PASS | 200 | 200 OK |
| 1422 | GET | `/api/v1/rider/hr/documents/:documentId/history` | ADMIN | PASS | 200 | 200 OK |
| 1423 | GET | `/api/v1/rider/hr/documents/:documentId/rejection-reason` | ADMIN | PASS | 200 | 200 OK |
| 1424 | GET | `/api/v1/rider/hr/riders` | ADMIN | PASS | 200 | 200 OK |
| 1425 | POST | `/api/v1/rider/hr/riders` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1426 | GET | `/api/v1/rider/hr/riders/:riderId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1427 | PUT | `/api/v1/rider/hr/riders/:riderId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1428 | POST | `/api/v1/rider/hr/riders/:riderId/approve` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1429 | POST | `/api/v1/rider/hr/riders/:riderId/remind` | ADMIN | PASS | 200 | 200 OK |
| 1430 | GET | `/api/v1/rider/hr/training` | ADMIN | PASS | 200 | 200 OK |
| 1431 | PUT | `/api/v1/rider/hr/training/:riderId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1432 | GET | `/api/v1/rider/kit/config` | PUBLIC | PASS | 200 | 200 OK |
| 1433 | POST | `/api/v1/rider/kit/config` | ADMIN | PASS | 200 | 200 OK |
| 1434 | GET | `/api/v1/rider/kit/training-videos` | PUBLIC | PASS | 200 | 200 OK |
| 1435 | POST | `/api/v1/rider/kit/training-videos` | ADMIN | PASS | 201 | 201 OK |
| 1436 | DELETE | `/api/v1/rider/kit/training-videos/:id` | ADMIN | PASS | 200 | 200 OK |
| 1437 | PUT | `/api/v1/rider/kit/training-videos/:id` | ADMIN | PASS | 200 | 200 OK |
| 1438 | GET | `/api/v1/rider/legal/config` | PUBLIC | PASS | 200 | 200 OK |
| 1439 | GET | `/api/v1/rider/legal/privacy` | PUBLIC | PASS | 200 | 200 OK |
| 1440 | GET | `/api/v1/rider/legal/terms` | PUBLIC | PASS | 200 | 200 OK |
| 1441 | GET | `/api/v1/rider/live-positions` | ADMIN | PASS | 200 | 200 OK |
| 1442 | GET | `/api/v1/rider/notifications` | ADMIN | PASS | 200 | 200 OK |
| 1443 | PUT | `/api/v1/rider/notifications/:notificationId/read` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1444 | POST | `/api/v1/rider/notifications/read-all` | ADMIN | PASS | 200 | 200 OK |
| 1445 | GET | `/api/v1/rider/orders` | ADMIN | PASS | 200 | 200 OK |
| 1446 | POST | `/api/v1/rider/orders/:orderId/alert` | ADMIN | PASS | 200 | 200 OK |
| 1447 | POST | `/api/v1/rider/orders/:orderId/assign` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1448 | GET | `/api/v1/rider/search` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1449 | GET | `/api/v1/rider/shifts` | ADMIN | PASS | 200 | 200 OK |
| 1450 | POST | `/api/v1/rider/shifts` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1451 | DELETE | `/api/v1/rider/shifts/:shiftId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1452 | GET | `/api/v1/rider/shifts/:shiftId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1453 | PUT | `/api/v1/rider/shifts/:shiftId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1454 | POST | `/api/v1/rider/shifts/:shiftId/assign` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1455 | GET | `/api/v1/rider/shifts/:shiftId/assignments` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1456 | DELETE | `/api/v1/rider/shifts/:shiftId/assignments/:riderId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1457 | POST | `/api/v1/rider/shifts/:shiftId/unassign` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1458 | GET | `/api/v1/rider/shifts/available/list` | ADMIN | PASS | 200 | 200 OK |
| 1459 | POST | `/api/v1/rider/shifts/cancel` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1460 | POST | `/api/v1/rider/shifts/end` | ADMIN | PASS | 200 | 200 OK |
| 1461 | GET | `/api/v1/rider/shifts/filter-options` | ADMIN | PASS | 200 | 200 OK |
| 1462 | GET | `/api/v1/rider/shifts/my` | ADMIN | PASS | 200 | 200 OK |
| 1463 | POST | `/api/v1/rider/shifts/select` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1464 | POST | `/api/v1/rider/shifts/start` | ADMIN | PASS | 200 | 200 OK |
| 1465 | GET | `/api/v1/rider/summary` | ADMIN | PASS | 200 | 200 OK |
| 1466 | GET | `/api/v1/rider/support-chat/conversation` | CUSTOMER | PASS | 200 | 200 OK |
| 1467 | GET | `/api/v1/rider/support-chat/conversation/messages` | CUSTOMER | PASS | 200 | 200 OK |
| 1468 | POST | `/api/v1/rider/support-chat/conversation/messages` | CUSTOMER | PASS | 400 | 400 validated/rejected as expected |
| 1469 | POST | `/api/v1/rider/support-chat/conversation/read` | CUSTOMER | PASS | 200 | 200 OK |
| 1470 | GET | `/api/v1/rider/training/:riderId` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1471 | POST | `/api/v1/rider/training/:riderId/modules/:moduleId/complete` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1472 | DELETE | `/api/v1/shared/alerts` | ADMIN | PASS | 200 | 200 OK |
| 1473 | GET | `/api/v1/shared/alerts` | ADMIN | PASS | 200 | 200 OK |
| 1474 | GET | `/api/v1/shared/alerts/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1475 | POST | `/api/v1/shared/alerts/:id/action` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1476 | PUT | `/api/v1/shared/alerts/read-all` | ADMIN | PASS | 200 | 200 OK |
| 1477 | GET | `/api/v1/shared/analytics/dispatch-efficiency` | ADMIN | PASS | 200 | 200 OK |
| 1478 | GET | `/api/v1/shared/analytics/drill-down` | ADMIN | PASS | 200 | 200 OK |
| 1479 | GET | `/api/v1/shared/analytics/fleet-utilization` | ADMIN | PASS | 200 | 200 OK |
| 1480 | GET | `/api/v1/shared/analytics/hub-comparison` | ADMIN | PASS | 200 | 200 OK |
| 1481 | POST | `/api/v1/shared/analytics/reports/export` | ADMIN | PASS | 201 | 201 OK |
| 1482 | GET | `/api/v1/shared/analytics/reports/schedules` | ADMIN | PASS | 200 | 200 OK |
| 1483 | POST | `/api/v1/shared/analytics/reports/schedules` | ADMIN | PASS | 201 | 201 OK |
| 1484 | GET | `/api/v1/shared/analytics/rider-leaderboard` | ADMIN | PASS | 200 | 200 OK |
| 1485 | GET | `/api/v1/shared/analytics/rider-performance` | ADMIN | PASS | 200 | 200 OK |
| 1486 | GET | `/api/v1/shared/analytics/sla-adherence` | ADMIN | PASS | 200 | 200 OK |
| 1487 | POST | `/api/v1/shared/approvals/batch-approve` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1488 | GET | `/api/v1/shared/approvals/queue` | ADMIN | PASS | 200 | 200 OK |
| 1489 | POST | `/api/v1/shared/approvals/queue` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1490 | GET | `/api/v1/shared/approvals/queue/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1491 | POST | `/api/v1/shared/approvals/queue/:id/approve` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1492 | POST | `/api/v1/shared/approvals/queue/:id/reject` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1493 | GET | `/api/v1/shared/approvals/summary` | ADMIN | PASS | 200 | 200 OK |
| 1494 | DELETE | `/api/v1/shared/bulk-ops/:type` | ADMIN | PASS | 200 | 200 OK |
| 1495 | GET | `/api/v1/shared/bulk-ops/export/:type` | ADMIN | PASS | 200 | 200 OK |
| 1496 | POST | `/api/v1/shared/bulk-ops/import/products` | ADMIN | PASS | 201 | 201 OK |
| 1497 | POST | `/api/v1/shared/bulk-ops/inventory` | ADMIN | PASS | 201 | 201 OK |
| 1498 | POST | `/api/v1/shared/bulk-ops/orders` | ADMIN | PASS | 201 | 201 OK |
| 1499 | POST | `/api/v1/shared/bulk-ops/products` | ADMIN | PASS | 201 | 201 OK |
| 1500 | POST | `/api/v1/shared/call-logs` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1501 | GET | `/api/v1/shared/call-logs/by-customer/:customerId` | ADMIN | PASS | 200 | 200 OK |
| 1502 | GET | `/api/v1/shared/call-logs/by-order/:orderId` | ADMIN | PASS | 200 | 200 OK |
| 1503 | GET | `/api/v1/shared/call-logs/by-ticket/:ticketId` | ADMIN | PASS | 200 | 200 OK |
| 1504 | POST | `/api/v1/shared/communication/broadcasts` | ADMIN | PASS | 201 | 201 OK |
| 1505 | GET | `/api/v1/shared/communication/chats` | ADMIN | PASS | 200 | 200 OK |
| 1506 | GET | `/api/v1/shared/communication/chats/:id` | ADMIN | PASS | 200 | 200 OK |
| 1507 | POST | `/api/v1/shared/communication/chats/:id/flag` | ADMIN | PASS | 201 | 201 OK |
| 1508 | POST | `/api/v1/shared/communication/chats/:id/messages` | ADMIN | PASS | 201 | 201 OK |
| 1509 | PUT | `/api/v1/shared/communication/chats/:id/read` | ADMIN | PASS | 200 | 200 OK |
| 1510 | GET | `/api/v1/shared/dashboard/summary` | ADMIN | PASS | 200 | 200 OK |
| 1511 | POST | `/api/v1/shared/escalations` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1512 | GET | `/api/v1/shared/escalations/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1513 | PATCH | `/api/v1/shared/escalations/:id` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1514 | PATCH | `/api/v1/shared/escalations/:id/assign` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1515 | PATCH | `/api/v1/shared/escalations/:id/resolve` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1516 | GET | `/api/v1/shared/escalations/by-team/:team` | ADMIN | PASS | 200 | 200 OK |
| 1517 | POST | `/api/v1/shared/inventory-sync/bulk` | ADMIN | PASS | 201 | 201 OK |
| 1518 | GET | `/api/v1/shared/inventory-sync/status` | ADMIN | PASS | 200 | 200 OK |
| 1519 | POST | `/api/v1/shared/inventory-sync/store-to-warehouse` | ADMIN | PASS | 201 | 201 OK |
| 1520 | POST | `/api/v1/shared/inventory-sync/warehouse-to-store` | ADMIN | PASS | 201 | 201 OK |
| 1521 | GET | `/api/v1/shared/search` | ADMIN | PASS | 200 | 200 OK |
| 1522 | GET | `/api/v1/shared/search/recent` | ADMIN | PASS | 200 | 200 OK |
| 1523 | GET | `/api/v1/shared/search/suggestions` | ADMIN | PASS | 200 | 200 OK |
| 1524 | GET | `/api/v1/shared/system-health` | ADMIN | PASS | 200 | 200 OK |
| 1525 | GET | `/api/v1/shared/system-health/devices` | ADMIN | PASS | 200 | 200 OK |
| 1526 | GET | `/api/v1/shared/system-health/devices/:id` | ADMIN | PASS | 200 | 200 OK |
| 1527 | GET | `/api/v1/shared/system-health/diagnostics/reports/:reportId` | ADMIN | PASS | 200 | 200 OK |
| 1528 | POST | `/api/v1/shared/system-health/diagnostics/run` | ADMIN | PASS | 201 | 201 OK |
| 1529 | GET | `/api/v1/shared/workflow/rules` | ADMIN | PASS | 200 | 200 OK |
| 1530 | POST | `/api/v1/shared/workflow/rules` | ADMIN | PASS | 201 | 201 OK |
| 1531 | POST | `/api/v1/shared/workflow/schedule` | ADMIN | PASS | 201 | 201 OK |
| 1532 | POST | `/api/v1/shared/workflow/trigger` | ADMIN | PASS | 201 | 201 OK |
| 1533 | GET | `/api/v1/warehouse/analytics` | ADMIN | PASS | 200 | 200 OK |
| 1534 | GET | `/api/v1/warehouse/attendance/live` | ADMIN | PASS | 200 | 200 OK |
| 1535 | GET | `/api/v1/warehouse/daily-report` | ADMIN | PASS | 200 | 200 OK |
| 1536 | GET | `/api/v1/warehouse/darkstore-requests` | ADMIN | PASS | 200 | 200 OK |
| 1537 | GET | `/api/v1/warehouse/darkstore-requests/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1538 | POST | `/api/v1/warehouse/darkstore-requests/:id/accept` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1539 | POST | `/api/v1/warehouse/darkstore-requests/:id/dispatch` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1540 | GET | `/api/v1/warehouse/darkstore-requests/:id/logs` | ADMIN | PASS | 200 | 200 OK |
| 1541 | POST | `/api/v1/warehouse/darkstore-requests/:id/pack` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1542 | POST | `/api/v1/warehouse/darkstore-requests/:id/reject` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1543 | GET | `/api/v1/warehouse/devices` | ADMIN | PASS | 200 | 200 OK |
| 1544 | POST | `/api/v1/warehouse/devices` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1545 | PATCH | `/api/v1/warehouse/devices/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1546 | GET | `/api/v1/warehouse/equipment/devices` | ADMIN | PASS | 200 | 200 OK |
| 1547 | GET | `/api/v1/warehouse/equipment/devices/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1548 | GET | `/api/v1/warehouse/equipment/export` | ADMIN | PASS | 200 | 200 OK |
| 1549 | GET | `/api/v1/warehouse/equipment/machinery` | ADMIN | PASS | 200 | 200 OK |
| 1550 | POST | `/api/v1/warehouse/equipment/machinery` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1551 | GET | `/api/v1/warehouse/equipment/machinery/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1552 | POST | `/api/v1/warehouse/equipment/machinery/:id/issue` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1553 | POST | `/api/v1/warehouse/equipment/machinery/:id/resolve` | ADMIN | PASS | 200 | 200 OK |
| 1554 | GET | `/api/v1/warehouse/exceptions` | ADMIN | PASS | 200 | 200 OK |
| 1555 | POST | `/api/v1/warehouse/exceptions` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1556 | GET | `/api/v1/warehouse/exceptions/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1557 | POST | `/api/v1/warehouse/exceptions/:id/accept-partial` | ADMIN | PASS | 200 | 200 OK |
| 1558 | POST | `/api/v1/warehouse/exceptions/:id/reject-shipment` | ADMIN | PASS | 200 | 200 OK |
| 1559 | PUT | `/api/v1/warehouse/exceptions/:id/status` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1560 | GET | `/api/v1/warehouse/exceptions/export` | ADMIN | PASS | 200 | 200 OK |
| 1561 | GET | `/api/v1/warehouse/health` | ADMIN | PASS | 200 | 200 OK |
| 1562 | GET | `/api/v1/warehouse/inbound/docks` | ADMIN | PASS | 200 | 200 OK |
| 1563 | PUT | `/api/v1/warehouse/inbound/docks/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1564 | GET | `/api/v1/warehouse/inbound/grns` | ADMIN | PASS | 200 | 200 OK |
| 1565 | POST | `/api/v1/warehouse/inbound/grns` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1566 | GET | `/api/v1/warehouse/inbound/grns/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1567 | POST | `/api/v1/warehouse/inbound/grns/:id/complete` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1568 | POST | `/api/v1/warehouse/inbound/grns/:id/discrepancy` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1569 | POST | `/api/v1/warehouse/inbound/grns/:id/start` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1570 | GET | `/api/v1/warehouse/inbound/grns/export` | ADMIN | PASS | 200 | 200 OK |
| 1571 | GET | `/api/v1/warehouse/inbound/summary` | ADMIN | PASS | 200 | 200 OK |
| 1572 | GET | `/api/v1/warehouse/inventory/adjustments` | ADMIN | PASS | 200 | 200 OK |
| 1573 | POST | `/api/v1/warehouse/inventory/adjustments` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1574 | GET | `/api/v1/warehouse/inventory/alerts` | ADMIN | PASS | 200 | 200 OK |
| 1575 | POST | `/api/v1/warehouse/inventory/alerts/:id/reorder` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1576 | POST | `/api/v1/warehouse/inventory/alerts/generate` | ADMIN | PASS | 200 | 200 OK |
| 1577 | GET | `/api/v1/warehouse/inventory/cycle-counts` | ADMIN | PASS | 200 | 200 OK |
| 1578 | POST | `/api/v1/warehouse/inventory/cycle-counts` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1579 | GET | `/api/v1/warehouse/inventory/cycle-counts/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1580 | PUT | `/api/v1/warehouse/inventory/cycle-counts/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1581 | POST | `/api/v1/warehouse/inventory/cycle-counts/:id/complete` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1582 | PUT | `/api/v1/warehouse/inventory/cycle-counts/:id/complete` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1583 | POST | `/api/v1/warehouse/inventory/cycle-counts/:id/start` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1584 | PUT | `/api/v1/warehouse/inventory/cycle-counts/:id/start` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1585 | GET | `/api/v1/warehouse/inventory/export` | ADMIN | PASS | 200 | 200 OK |
| 1586 | GET | `/api/v1/warehouse/inventory/items` | ADMIN | PASS | 200 | 200 OK |
| 1587 | GET | `/api/v1/warehouse/inventory/items/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1588 | PUT | `/api/v1/warehouse/inventory/items/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1589 | GET | `/api/v1/warehouse/inventory/locations` | ADMIN | PASS | 200 | 200 OK |
| 1590 | GET | `/api/v1/warehouse/inventory/locations/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1591 | GET | `/api/v1/warehouse/inventory/meta` | ADMIN | PASS | 200 | 200 OK |
| 1592 | POST | `/api/v1/warehouse/inventory/reorder` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1593 | POST | `/api/v1/warehouse/inventory/stock/:sku/adjust` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1594 | GET | `/api/v1/warehouse/inventory/summary` | ADMIN | PASS | 200 | 200 OK |
| 1595 | GET | `/api/v1/warehouse/inventory/transfers` | ADMIN | PASS | 200 | 200 OK |
| 1596 | POST | `/api/v1/warehouse/inventory/transfers` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1597 | GET | `/api/v1/warehouse/inventory/transfers/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1598 | POST | `/api/v1/warehouse/inventory/transfers/:id/complete` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1599 | PUT | `/api/v1/warehouse/inventory/transfers/:id/status` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1600 | GET | `/api/v1/warehouse/metrics` | ADMIN | PASS | 200 | 200 OK |
| 1601 | GET | `/api/v1/warehouse/notifications` | ADMIN | PASS | 200 | 200 OK |
| 1602 | PATCH | `/api/v1/warehouse/notifications/:id/read` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1603 | POST | `/api/v1/warehouse/notifications/read-all` | ADMIN | PASS | 200 | 200 OK |
| 1604 | GET | `/api/v1/warehouse/operations` | ADMIN | PASS | 200 | 200 OK |
| 1605 | GET | `/api/v1/warehouse/order-flow` | ADMIN | PASS | 200 | 200 OK |
| 1606 | GET | `/api/v1/warehouse/orders` | ADMIN | PASS | 200 | 200 OK |
| 1607 | POST | `/api/v1/warehouse/orders/:orderId/alert` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1608 | POST | `/api/v1/warehouse/orders/:orderId/assign` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1609 | GET | `/api/v1/warehouse/outbound/batches` | ADMIN | PASS | 200 | 200 OK |
| 1610 | POST | `/api/v1/warehouse/outbound/batches` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1611 | GET | `/api/v1/warehouse/outbound/batches/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1612 | GET | `/api/v1/warehouse/outbound/consolidated-picks` | ADMIN | PASS | 200 | 200 OK |
| 1613 | GET | `/api/v1/warehouse/outbound/pickers` | ADMIN | PASS | 200 | 200 OK |
| 1614 | GET | `/api/v1/warehouse/outbound/pickers/:id/orders` | ADMIN | PASS | 200 | 200 OK |
| 1615 | GET | `/api/v1/warehouse/outbound/picklists` | ADMIN | PASS | 200 | 200 OK |
| 1616 | GET | `/api/v1/warehouse/outbound/picklists/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1617 | POST | `/api/v1/warehouse/outbound/picklists/:id/assign` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1618 | GET | `/api/v1/warehouse/outbound/routes/:id/map` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1619 | GET | `/api/v1/warehouse/outbound/routes/active/map` | ADMIN | PASS | 200 | 200 OK |
| 1620 | GET | `/api/v1/warehouse/qc/checks` | ADMIN | PASS | 200 | 200 OK |
| 1621 | PUT | `/api/v1/warehouse/qc/checks/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1622 | GET | `/api/v1/warehouse/qc/compliance-docs` | ADMIN | PASS | 200 | 200 OK |
| 1623 | GET | `/api/v1/warehouse/qc/compliance-docs/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1624 | GET | `/api/v1/warehouse/qc/compliance-docs/:id/download` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1625 | GET | `/api/v1/warehouse/qc/compliance-docs/:id/view` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1626 | GET | `/api/v1/warehouse/qc/inspections` | ADMIN | PASS | 200 | 200 OK |
| 1627 | POST | `/api/v1/warehouse/qc/inspections` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1628 | GET | `/api/v1/warehouse/qc/inspections/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1629 | GET | `/api/v1/warehouse/qc/inspections/:id/report` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1630 | PUT | `/api/v1/warehouse/qc/inspections/:id/update` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1631 | GET | `/api/v1/warehouse/qc/rejections` | ADMIN | PASS | 200 | 200 OK |
| 1632 | POST | `/api/v1/warehouse/qc/rejections` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1633 | GET | `/api/v1/warehouse/qc/samples` | ADMIN | PASS | 200 | 200 OK |
| 1634 | POST | `/api/v1/warehouse/qc/samples` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1635 | GET | `/api/v1/warehouse/qc/samples/:id/report` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1636 | PUT | `/api/v1/warehouse/qc/samples/:id/update` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1637 | GET | `/api/v1/warehouse/qc/temperature-logs` | ADMIN | PASS | 200 | 200 OK |
| 1638 | POST | `/api/v1/warehouse/qc/temperature-logs` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1639 | GET | `/api/v1/warehouse/qc/temperature-logs/:id/chart` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1640 | GET | `/api/v1/warehouse/reports/daily` | ADMIN | PASS | 200 | 200 OK |
| 1641 | GET | `/api/v1/warehouse/reports/inventory-by-category` | ADMIN | PASS | 200 | 200 OK |
| 1642 | GET | `/api/v1/warehouse/reports/inventory-health` | ADMIN | PASS | 200 | 200 OK |
| 1643 | GET | `/api/v1/warehouse/reports/inventory-health/export` | ADMIN | PASS | 200 | 200 OK |
| 1644 | GET | `/api/v1/warehouse/reports/operational-slas` | ADMIN | PASS | 200 | 200 OK |
| 1645 | GET | `/api/v1/warehouse/reports/operational-slas/export` | ADMIN | PASS | 200 | 200 OK |
| 1646 | GET | `/api/v1/warehouse/reports/operations-view` | ADMIN | PASS | 200 | 200 OK |
| 1647 | GET | `/api/v1/warehouse/reports/output-trends` | ADMIN | PASS | 200 | 200 OK |
| 1648 | GET | `/api/v1/warehouse/reports/productivity` | ADMIN | PASS | 200 | 200 OK |
| 1649 | GET | `/api/v1/warehouse/reports/productivity/export` | ADMIN | PASS | 200 | 200 OK |
| 1650 | GET | `/api/v1/warehouse/reports/storage-utilization` | ADMIN | PASS | 200 | 200 OK |
| 1651 | GET | `/api/v1/warehouse/staff` | ADMIN | PASS | 200 | 200 OK |
| 1652 | GET | `/api/v1/warehouse/staff/absences` | ADMIN | PASS | 200 | 200 OK |
| 1653 | POST | `/api/v1/warehouse/staff/absences` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1654 | GET | `/api/v1/warehouse/staff/incentive-criteria` | ADMIN | PASS | 200 | 200 OK |
| 1655 | GET | `/api/v1/warehouse/staff/performance` | ADMIN | PASS | 200 | 200 OK |
| 1656 | GET | `/api/v1/warehouse/staff/roster/weekly` | ADMIN | PASS | 200 | 200 OK |
| 1657 | POST | `/api/v1/warehouse/staff/roster/weekly/publish` | ADMIN | PASS | 200 | 200 OK |
| 1658 | GET | `/api/v1/warehouse/staff/shifts` | ADMIN | PASS | 200 | 200 OK |
| 1659 | POST | `/api/v1/warehouse/staff/shifts` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1660 | GET | `/api/v1/warehouse/staff/shifts/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1661 | PUT | `/api/v1/warehouse/staff/shifts/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1662 | POST | `/api/v1/warehouse/staff/shifts/auto-assign` | ADMIN | PASS | 201 | 201 OK |
| 1663 | GET | `/api/v1/warehouse/staff/shifts/coverage` | ADMIN | PASS | 200 | 200 OK |
| 1664 | GET | `/api/v1/warehouse/staff/summary` | ADMIN | PASS | 200 | 200 OK |
| 1665 | GET | `/api/v1/warehouse/transfers` | ADMIN | PASS | 200 | 200 OK |
| 1666 | POST | `/api/v1/warehouse/transfers` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1667 | GET | `/api/v1/warehouse/transfers/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1668 | GET | `/api/v1/warehouse/transfers/:id/items` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1669 | PUT | `/api/v1/warehouse/transfers/:id/status` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1670 | GET | `/api/v1/warehouse/transfers/export` | ADMIN | PASS | 200 | 200 OK |
| 1671 | POST | `/api/v1/warehouse/utilities/bin-reassignment` | ADMIN | PASS | 201 | 201 OK |
| 1672 | POST | `/api/v1/warehouse/utilities/generate-labels` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1673 | GET | `/api/v1/warehouse/utilities/logs` | ADMIN | PASS | 200 | 200 OK |
| 1674 | POST | `/api/v1/warehouse/utilities/print-barcodes` | ADMIN | PASS | 400 | 400 validated/rejected as expected |
| 1675 | POST | `/api/v1/warehouse/utilities/reassign-bins` | ADMIN | PASS | 201 | 201 OK |
| 1676 | POST | `/api/v1/warehouse/utilities/upload-skus` | ADMIN | PASS | 201 | 201 OK |
| 1677 | GET | `/api/v1/warehouse/utilities/zones` | ADMIN | PASS | 200 | 200 OK |
| 1678 | GET | `/api/v1/warehouse/workforce/attendance` | ADMIN | PASS | 200 | 200 OK |
| 1679 | POST | `/api/v1/warehouse/workforce/attendance` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1680 | GET | `/api/v1/warehouse/workforce/leave-requests` | ADMIN | PASS | 200 | 200 OK |
| 1681 | POST | `/api/v1/warehouse/workforce/leave-requests` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1682 | PUT | `/api/v1/warehouse/workforce/leave-requests/:id/status` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1683 | GET | `/api/v1/warehouse/workforce/performance` | ADMIN | PASS | 200 | 200 OK |
| 1684 | GET | `/api/v1/warehouse/workforce/schedule` | ADMIN | PASS | 200 | 200 OK |
| 1685 | POST | `/api/v1/warehouse/workforce/schedule` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1686 | GET | `/api/v1/warehouse/workforce/schedule/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1687 | POST | `/api/v1/warehouse/workforce/schedule/:id/assign` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1688 | GET | `/api/v1/warehouse/workforce/staff` | ADMIN | PASS | 200 | 200 OK |
| 1689 | POST | `/api/v1/warehouse/workforce/staff` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1690 | GET | `/api/v1/warehouse/workforce/staff/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1691 | GET | `/api/v1/warehouse/workforce/staff/:id/details` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1692 | GET | `/api/v1/warehouse/workforce/training` | ADMIN | PASS | 200 | 200 OK |
| 1693 | POST | `/api/v1/warehouse/workforce/training` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 1694 | GET | `/api/v1/warehouse/workforce/training/:id` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1695 | GET | `/api/v1/warehouse/workforce/training/:id/details` | ADMIN | PASS | 404 | 404 validated/rejected as expected |
| 1696 | POST | `/api/v1/warehouse/workforce/training/:id/enroll` | ADMIN | PASS | 404 | 404 validated/rejected as expected |