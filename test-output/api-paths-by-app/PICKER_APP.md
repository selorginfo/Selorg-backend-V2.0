# Picker App (picker-only routes) — 9 endpoints

| # | Method | Path | Auth | Result | HTTP | Note |
|---|--------|------|------|--------|------|------|
| 1 | POST | `/api/v1/picker/approval/verify-location-otp` | PICKER | PASS | 400 | 400 validated/rejected as expected |
| 2 | POST | `/api/v1/picker/dark-store-login` | PICKER | PASS | 401 | 401 authorization enforced |
| 3 | GET | `/api/v1/picker/devices/assigned` | PICKER | PASS | 200 | 200 OK |
| 4 | POST | `/api/v1/picker/devices/collection-complete` | PICKER | PASS | 401 | 401 authorization enforced |
| 5 | POST | `/api/v1/picker/devices/return` | PICKER | PASS | 401 | 401 authorization enforced |
| 6 | POST | `/api/v1/picker/devices/upload-condition-photo` | PICKER | PASS | 401 | 401 authorization enforced |
| 7 | POST | `/api/v1/picker/manager/request-otp` | PICKER | PASS | 401 | 401 authorization enforced |
| 8 | POST | `/api/v1/picker/manager/verify-otp` | PICKER | PASS | 401 | 401 authorization enforced |
| 9 | GET | `/api/v1/picker/store-otp` | PICKER | PASS | 200 | 200 OK |