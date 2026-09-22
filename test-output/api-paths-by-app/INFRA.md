# Infrastructure / health / diagnostics — 10 endpoints

| # | Method | Path | Auth | Result | HTTP | Note |
|---|--------|------|------|--------|------|------|
| 1 | GET | `/api-docs` | PUBLIC | SKIPPED | - | swagger UI (HTML asset, not a JSON API) |
| 2 | GET | `/api-docs/` | PUBLIC | SKIPPED | - | swagger UI (HTML asset, not a JSON API) |
| 3 | GET | `/api/v1/diag/hubs` | PUBLIC | PASS | 200 | 200 OK |
| 4 | POST | `/api/v1/diag/normalize-rider-hub` | PUBLIC | PASS | 400 | 400 validated/rejected as expected |
| 5 | GET | `/api/v1/diag/order-flow` | PUBLIC | PASS | 200 | 200 OK |
| 6 | GET | `/api/v1/diag/resolve-hub` | PUBLIC | PASS | 200 | 200 OK |
| 7 | GET | `/health` | PUBLIC | PASS | 200 | 200 OK |
| 8 | GET | `/health/db` | PUBLIC | PASS | 200 | 200 OK |
| 9 | GET | `/health/ready` | PUBLIC | PASS | 200 | 200 OK |
| 10 | GET | `/healthz` | PUBLIC | PASS | 200 | 200 OK |