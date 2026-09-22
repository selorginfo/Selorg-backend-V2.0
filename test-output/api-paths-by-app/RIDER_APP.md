# Rider App (rider-only routes) — 19 endpoints

| # | Method | Path | Auth | Result | HTTP | Note |
|---|--------|------|------|--------|------|------|
| 1 | POST | `/api/v1/picker/bulk/bag/load` | PICKER | PASS | 401 | 401 authorization enforced |
| 2 | GET | `/api/v1/picker/bulk/batch` | PICKER | PASS | 403 | 403 authorization enforced |
| 3 | GET | `/api/v1/picker/bulk/batches` | PICKER | PASS | 403 | 403 authorization enforced |
| 4 | GET | `/api/v1/picker/bulk/batches/:batchId` | PICKER | PASS | 403 | 403 authorization enforced |
| 5 | POST | `/api/v1/picker/bulk/start` | PICKER | PASS | 401 | 401 authorization enforced |
| 6 | POST | `/api/v1/picker/bulk/stops/:stopId/arrive` | PICKER | PASS | 401 | 401 authorization enforced |
| 7 | POST | `/api/v1/picker/bulk/stops/:stopId/deliver` | PICKER | PASS | 401 | 401 authorization enforced |
| 8 | POST | `/api/v1/picker/bulk/stops/:stopId/fail` | PICKER | PASS | 401 | 401 authorization enforced |
| 9 | POST | `/api/v1/picker/bulk/stops/:stopId/proof-photo` | PICKER | PASS | 401 | 401 authorization enforced |
| 10 | POST | `/api/v1/picker/cash/deposits` | PICKER | PASS | 401 | 401 authorization enforced |
| 11 | GET | `/api/v1/picker/cash/summary` | PICKER | PASS | 403 | 403 authorization enforced |
| 12 | GET | `/api/v1/picker/cash/transactions` | PICKER | PASS | 403 | 403 authorization enforced |
| 13 | GET | `/api/v1/picker/shared-orders` | PICKER | PASS | 403 | 403 authorization enforced |
| 14 | GET | `/api/v1/picker/shared-orders/:orderId` | PICKER | PASS | 403 | 403 authorization enforced |
| 15 | POST | `/api/v1/picker/shared-orders/:orderId/complete` | PICKER | PASS | 401 | 401 authorization enforced |
| 16 | POST | `/api/v1/picker/shared-orders/:orderId/proof-photo` | PICKER | PASS | 401 | 401 authorization enforced |
| 17 | PUT | `/api/v1/picker/shared-orders/:orderId/status` | PICKER | PASS | 401 | 401 authorization enforced |
| 18 | GET | `/api/v1/picker/shared-orders/assignorders` | PICKER | PASS | 403 | 403 authorization enforced |
| 19 | GET | `/api/v1/picker/shared-orders/completed` | PICKER | PASS | 403 | 403 authorization enforced |