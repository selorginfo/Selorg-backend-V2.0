# HHD App (handheld device) — 47 endpoints

| # | Method | Path | Auth | Result | HTTP | Note |
|---|--------|------|------|--------|------|------|
| 1 | PUT | `/api/v1/hhd/admin/orders/:orderId/assign` | HHD | PASS | 403 | 403 authorization enforced |
| 2 | PUT | `/api/v1/hhd/admin/picker-users/:pickerUserId/link` | HHD | PASS | 403 | 403 authorization enforced |
| 3 | POST | `/api/v1/hhd/auth/logout` | HHD | PASS | 200 | 200 OK |
| 4 | GET | `/api/v1/hhd/auth/me` | HHD | PASS | 200 | 200 OK |
| 5 | POST | `/api/v1/hhd/auth/refresh` | PUBLIC | PASS | 422 | 422 validated/rejected as expected |
| 6 | POST | `/api/v1/hhd/auth/resend-otp` | PUBLIC | PASS | 422 | 422 validated/rejected as expected |
| 7 | POST | `/api/v1/hhd/auth/send-otp` | PUBLIC | PASS | 422 | 422 validated/rejected as expected |
| 8 | POST | `/api/v1/hhd/auth/verify-otp` | PUBLIC | PASS | 422 | 422 validated/rejected as expected |
| 9 | GET | `/api/v1/hhd/bags/:bagId` | HHD | PASS | 404 | 404 validated/rejected as expected |
| 10 | PUT | `/api/v1/hhd/bags/:bagId` | HHD | PASS | 404 | 404 validated/rejected as expected |
| 11 | POST | `/api/v1/hhd/bags/scan` | HHD | PASS | 422 | 422 validated/rejected as expected |
| 12 | GET | `/api/v1/hhd/dashboard` | HHD | PASS | 200 | 200 OK |
| 13 | GET | `/api/v1/hhd/devices/current` | HHD | PASS | 200 | 200 OK |
| 14 | PUT | `/api/v1/hhd/items/:itemId` | HHD | PASS | 404 | 404 validated/rejected as expected |
| 15 | PUT | `/api/v1/hhd/items/:itemId/not-found` | HHD | PASS | 404 | 404 validated/rejected as expected |
| 16 | GET | `/api/v1/hhd/items/order/:orderId` | HHD | PASS | 404 | 404 validated/rejected as expected |
| 17 | POST | `/api/v1/hhd/items/scan` | HHD | PASS | 422 | 422 validated/rejected as expected |
| 18 | GET | `/api/v1/hhd/items/substitutes` | HHD | PASS | 422 | 422 validated/rejected as expected |
| 19 | GET | `/api/v1/hhd/orders` | HHD | PASS | 200 | 200 OK |
| 20 | POST | `/api/v1/hhd/orders` | HHD | PASS | 400 | 400 validated/rejected as expected |
| 21 | GET | `/api/v1/hhd/orders/:orderId` | HHD | PASS | 404 | 404 validated/rejected as expected |
| 22 | PUT | `/api/v1/hhd/orders/:orderId/accept` | HHD | PASS | 404 | 404 validated/rejected as expected |
| 23 | PUT | `/api/v1/hhd/orders/:orderId/assign` | HHD | PASS | 403 | 403 authorization enforced |
| 24 | PUT | `/api/v1/hhd/orders/:orderId/status` | HHD | PASS | 422 | 422 validated/rejected as expected |
| 25 | GET | `/api/v1/hhd/orders/:orderId/summary` | HHD | PASS | 404 | 404 validated/rejected as expected |
| 26 | PUT | `/api/v1/hhd/orders/assignorders/:orderId/status` | HHD | PASS | 422 | 422 validated/rejected as expected |
| 27 | GET | `/api/v1/hhd/orders/assignorders/status/:status` | HHD | PASS | 200 | 200 OK |
| 28 | GET | `/api/v1/hhd/orders/available` | HHD | PASS | 200 | 200 OK |
| 29 | GET | `/api/v1/hhd/orders/completed` | HHD | PASS | 200 | 200 OK |
| 30 | GET | `/api/v1/hhd/orders/current` | HHD | PASS | 200 | 200 OK |
| 31 | GET | `/api/v1/hhd/orders/status/:status` | HHD | PASS | 200 | 200 OK |
| 32 | POST | `/api/v1/hhd/photos` | HHD | PASS | 400 | 400 validated/rejected as expected |
| 33 | PUT | `/api/v1/hhd/photos/:photoId/verify` | HHD | PASS | 404 | 404 validated/rejected as expected |
| 34 | GET | `/api/v1/hhd/photos/order/:orderId/bag/:bagId` | HHD | PASS | 404 | 404 validated/rejected as expected |
| 35 | POST | `/api/v1/hhd/pick/report-issue` | HHD | PASS | 400 | 400 validated/rejected as expected |
| 36 | GET | `/api/v1/hhd/racks/:rackCode` | HHD | PASS | 404 | 404 validated/rejected as expected |
| 37 | GET | `/api/v1/hhd/racks/available` | HHD | PASS | 200 | 200 OK |
| 38 | POST | `/api/v1/hhd/racks/scan` | HHD | PASS | 422 | 422 validated/rejected as expected |
| 39 | GET | `/api/v1/hhd/scanned-items/:id` | HHD | PASS | 404 | 404 validated/rejected as expected |
| 40 | GET | `/api/v1/hhd/tasks` | HHD | PASS | 200 | 200 OK |
| 41 | PUT | `/api/v1/hhd/tasks/:taskId` | HHD | PASS | 422 | 422 validated/rejected as expected |
| 42 | GET | `/api/v1/hhd/users/contract` | HHD | PASS | 200 | 200 OK |
| 43 | GET | `/api/v1/hhd/users/employment` | HHD | PASS | 200 | 200 OK |
| 44 | POST | `/api/v1/hhd/users/heartbeat` | HHD | PASS | 200 | 200 OK |
| 45 | GET | `/api/v1/hhd/users/linked-picker-profile` | HHD | PASS | 200 | 200 OK |
| 46 | GET | `/api/v1/hhd/users/profile` | HHD | PASS | 200 | 200 OK |
| 47 | PUT | `/api/v1/hhd/users/profile` | HHD | PASS | 200 | 200 OK |