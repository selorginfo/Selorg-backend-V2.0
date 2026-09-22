# Picker + Rider shared workforce routes — 116 endpoints

| # | Method | Path | Auth | Result | HTTP | Note |
|---|--------|------|------|--------|------|------|
| 1 | POST | `/api/v1/picker/account/delete-request` | PICKER | PASS | 200 | 200 OK |
| 2 | GET | `/api/v1/picker/attendance` | PICKER | PASS | 200 | 200 OK |
| 3 | POST | `/api/v1/picker/attendance/punch-in` | PICKER | PASS | 403 | 403 authorization enforced |
| 4 | POST | `/api/v1/picker/attendance/punch-out` | PICKER | PASS | 403 | 403 authorization enforced |
| 5 | GET | `/api/v1/picker/attendance/stats` | PICKER | PASS | 200 | 200 OK |
| 6 | GET | `/api/v1/picker/attendance/summary` | PICKER | PASS | 200 | 200 OK |
| 7 | POST | `/api/v1/picker/auth/logout` | PICKER | PASS | 401 | 401 authorization enforced |
| 8 | POST | `/api/v1/picker/auth/refresh` | PICKER | PASS | 200 | 200 OK |
| 9 | POST | `/api/v1/picker/auth/resend-otp` | PUBLIC | PASS | 422 | 422 validated/rejected as expected |
| 10 | POST | `/api/v1/picker/auth/resend-otp-email` | PUBLIC | PASS | 422 | 422 validated/rejected as expected |
| 11 | POST | `/api/v1/picker/auth/send-otp` | PUBLIC | PASS | 422 | 422 validated/rejected as expected |
| 12 | POST | `/api/v1/picker/auth/send-otp-email` | PUBLIC | PASS | 422 | 422 validated/rejected as expected |
| 13 | POST | `/api/v1/picker/auth/verify-otp` | PUBLIC | PASS | 422 | 422 validated/rejected as expected |
| 14 | POST | `/api/v1/picker/auth/verify-otp-email` | PUBLIC | PASS | 422 | 422 validated/rejected as expected |
| 15 | GET | `/api/v1/picker/bank-accounts` | PICKER | PASS | 200 | 200 OK |
| 16 | POST | `/api/v1/picker/bank-accounts` | PICKER | PASS | 401 | 401 authorization enforced |
| 17 | GET | `/api/v1/picker/bank/accounts` | PICKER | PASS | 200 | 200 OK |
| 18 | POST | `/api/v1/picker/bank/accounts` | PICKER | PASS | 401 | 401 authorization enforced |
| 19 | PUT | `/api/v1/picker/bank/accounts/:accountId` | PICKER | PASS | 401 | 401 authorization enforced |
| 20 | POST | `/api/v1/picker/bank/accounts/:accountId/delete` | PICKER | PASS | 401 | 401 authorization enforced |
| 21 | PUT | `/api/v1/picker/bank/accounts/:accountId/set-default` | PICKER | PASS | 401 | 401 authorization enforced |
| 22 | POST | `/api/v1/picker/bank/verify` | PICKER | PASS | 401 | 401 authorization enforced |
| 23 | GET | `/api/v1/picker/config` | PUBLIC | PASS | 200 | 200 OK |
| 24 | GET | `/api/v1/picker/config/cancel-reasons` | PICKER | PASS | 422 | 422 validated/rejected as expected |
| 25 | GET | `/api/v1/picker/dashboard/today` | PICKER | PASS | 403 | 403 authorization enforced |
| 26 | POST | `/api/v1/picker/didit/session` | PICKER | PASS | 401 | 401 authorization enforced |
| 27 | GET | `/api/v1/picker/didit/status` | PICKER | PASS | 200 | 200 OK |
| 28 | POST | `/api/v1/picker/didit/webhook` | PUBLIC | PASS | 200 | 200 OK |
| 29 | GET | `/api/v1/picker/documents` | PICKER | PASS | 200 | 200 OK |
| 30 | POST | `/api/v1/picker/documents` | PICKER | PASS | 401 | 401 authorization enforced |
| 31 | POST | `/api/v1/picker/documents/upload` | PICKER | PASS | 401 | 401 authorization enforced |
| 32 | GET | `/api/v1/picker/faq` | PUBLIC | PASS | 200 | 200 OK |
| 33 | POST | `/api/v1/picker/heartbeat` | PICKER | PASS | 401 | 401 authorization enforced |
| 34 | GET | `/api/v1/picker/home/summary` | PICKER | PASS | 200 | 200 OK |
| 35 | GET | `/api/v1/picker/incentives/today` | PICKER | PASS | 403 | 403 authorization enforced |
| 36 | POST | `/api/v1/picker/issues` | PICKER | PASS | 401 | 401 authorization enforced |
| 37 | GET | `/api/v1/picker/legal/config` | PUBLIC | PASS | 200 | 200 OK |
| 38 | GET | `/api/v1/picker/legal/privacy` | PUBLIC | PASS | 404 | 404 validated/rejected as expected |
| 39 | GET | `/api/v1/picker/legal/terms` | PUBLIC | PASS | 404 | 404 validated/rejected as expected |
| 40 | GET | `/api/v1/picker/locations` | PICKER | PASS | 200 | 200 OK |
| 41 | GET | `/api/v1/picker/locations/:locationId` | PICKER | PASS | 404 | 404 validated/rejected as expected |
| 42 | GET | `/api/v1/picker/locations/current` | PICKER | PASS | 200 | 200 OK |
| 43 | POST | `/api/v1/picker/locations/ensure-darkstore-verification` | PICKER | PASS | 401 | 401 authorization enforced |
| 44 | POST | `/api/v1/picker/locations/nearest` | PICKER | PASS | 401 | 401 authorization enforced |
| 45 | POST | `/api/v1/picker/locations/save-darkstore-gps` | PICKER | PASS | 401 | 401 authorization enforced |
| 46 | POST | `/api/v1/picker/locations/set` | PICKER | PASS | 401 | 401 authorization enforced |
| 47 | POST | `/api/v1/picker/locations/set-darkstore-from-current` | PICKER | PASS | 401 | 401 authorization enforced |
| 48 | POST | `/api/v1/picker/locations/track` | PICKER | PASS | 401 | 401 authorization enforced |
| 49 | POST | `/api/v1/picker/locations/validate` | PICKER | PASS | 401 | 401 authorization enforced |
| 50 | GET | `/api/v1/picker/notifications` | PICKER | PASS | 200 | 200 OK |
| 51 | PUT | `/api/v1/picker/notifications/:notificationId/read` | PICKER | PASS | 401 | 401 authorization enforced |
| 52 | PUT | `/api/v1/picker/notifications/read-all` | PICKER | PASS | 401 | 401 authorization enforced |
| 53 | POST | `/api/v1/picker/onboarding/kit-ack` | PICKER | PASS | 401 | 401 authorization enforced |
| 54 | GET | `/api/v1/picker/onboarding/state` | PICKER | PASS | 200 | 200 OK |
| 55 | POST | `/api/v1/picker/onboarding/submit` | PICKER | PASS | 401 | 401 authorization enforced |
| 56 | GET | `/api/v1/picker/performance` | PICKER | PASS | 200 | 200 OK |
| 57 | GET | `/api/v1/picker/performance/history` | PICKER | PASS | 200 | 200 OK |
| 58 | GET | `/api/v1/picker/performance/summary` | PICKER | PASS | 200 | 200 OK |
| 59 | POST | `/api/v1/picker/presence/ping` | PICKER | PASS | 401 | 401 authorization enforced |
| 60 | GET | `/api/v1/picker/profile` | PICKER | PASS | 200 | 200 OK |
| 61 | PUT | `/api/v1/picker/profile` | PICKER | PASS | 401 | 401 authorization enforced |
| 62 | POST | `/api/v1/picker/push-token` | PICKER | PASS | 401 | 401 authorization enforced |
| 63 | GET | `/api/v1/picker/samples` | PUBLIC | PASS | 200 | 200 OK |
| 64 | POST | `/api/v1/picker/samples` | PUBLIC | PASS | 201 | 201 OK |
| 65 | GET | `/api/v1/picker/samples/:id` | PUBLIC | PASS | 200 | 200 OK |
| 66 | GET | `/api/v1/picker/settings/preferences` | PICKER | PASS | 200 | 200 OK |
| 67 | PUT | `/api/v1/picker/settings/preferences` | PICKER | PASS | 401 | 401 authorization enforced |
| 68 | POST | `/api/v1/picker/shifts/:shiftId/end` | PICKER | PASS | 401 | 401 authorization enforced |
| 69 | POST | `/api/v1/picker/shifts/:shiftId/start` | PICKER | PASS | 401 | 401 authorization enforced |
| 70 | GET | `/api/v1/picker/shifts/available` | PICKER | PASS | 200 | 200 OK |
| 71 | POST | `/api/v1/picker/shifts/break/end` | PICKER | PASS | 401 | 401 authorization enforced |
| 72 | POST | `/api/v1/picker/shifts/break/start` | PICKER | PASS | 401 | 401 authorization enforced |
| 73 | POST | `/api/v1/picker/shifts/deselect` | PICKER | PASS | 401 | 401 authorization enforced |
| 74 | POST | `/api/v1/picker/shifts/end` | PICKER | PASS | 401 | 401 authorization enforced |
| 75 | POST | `/api/v1/picker/shifts/go-offline` | PICKER | PASS | 401 | 401 authorization enforced |
| 76 | POST | `/api/v1/picker/shifts/go-online` | PICKER | PASS | 401 | 401 authorization enforced |
| 77 | GET | `/api/v1/picker/shifts/my` | PICKER | PASS | 200 | 200 OK |
| 78 | GET | `/api/v1/picker/shifts/readiness` | PICKER | PASS | 200 | 200 OK |
| 79 | POST | `/api/v1/picker/shifts/select` | PICKER | PASS | 401 | 401 authorization enforced |
| 80 | POST | `/api/v1/picker/shifts/start` | PICKER | PASS | 401 | 401 authorization enforced |
| 81 | GET | `/api/v1/picker/stores/nearby` | PICKER | PASS | 200 | 200 OK |
| 82 | GET | `/api/v1/picker/support/chat/messages` | PICKER | PASS | 200 | 200 OK |
| 83 | POST | `/api/v1/picker/support/chat/messages` | PICKER | PASS | 401 | 401 authorization enforced |
| 84 | GET | `/api/v1/picker/support/tickets` | PICKER | PASS | 200 | 200 OK |
| 85 | POST | `/api/v1/picker/support/tickets` | PICKER | PASS | 401 | 401 authorization enforced |
| 86 | POST | `/api/v1/picker/training/assessment` | PICKER | PASS | 401 | 401 authorization enforced |
| 87 | POST | `/api/v1/picker/training/complete/:videoId` | PICKER | PASS | 401 | 401 authorization enforced |
| 88 | POST | `/api/v1/picker/training/modules/:moduleId/complete` | PICKER | PASS | 401 | 401 authorization enforced |
| 89 | GET | `/api/v1/picker/training/progress` | PICKER | PASS | 200 | 200 OK |
| 90 | PUT | `/api/v1/picker/training/progress` | PICKER | PASS | 401 | 401 authorization enforced |
| 91 | GET | `/api/v1/picker/training/user-progress` | PICKER | PASS | 200 | 200 OK |
| 92 | GET | `/api/v1/picker/training/videos` | PUBLIC | PASS | 200 | 200 OK |
| 93 | GET | `/api/v1/picker/training/videos/:videoId` | PICKER | PASS | 404 | 404 validated/rejected as expected |
| 94 | PUT | `/api/v1/picker/training/watch-progress` | PICKER | PASS | 401 | 401 authorization enforced |
| 95 | POST | `/api/v1/picker/uploads` | PICKER | PASS | 401 | 401 authorization enforced |
| 96 | PUT | `/api/v1/picker/user/location-type` | PICKER | PASS | 401 | 401 authorization enforced |
| 97 | GET | `/api/v1/picker/user/profile` | PICKER | PASS | 200 | 200 OK |
| 98 | PUT | `/api/v1/picker/user/profile` | PICKER | PASS | 401 | 401 authorization enforced |
| 99 | GET | `/api/v1/picker/user/profile/contract` | PICKER | PASS | 200 | 200 OK |
| 100 | PUT | `/api/v1/picker/user/profile/contract` | PICKER | PASS | 401 | 401 authorization enforced |
| 101 | GET | `/api/v1/picker/user/profile/employment` | PICKER | PASS | 200 | 200 OK |
| 102 | PUT | `/api/v1/picker/user/profile/employment` | PICKER | PASS | 401 | 401 authorization enforced |
| 103 | GET | `/api/v1/picker/user/profile/link-status` | PICKER | PASS | 200 | 200 OK |
| 104 | GET | `/api/v1/picker/user/profile/overview` | PICKER | PASS | 200 | 200 OK |
| 105 | PUT | `/api/v1/picker/user/upi` | PICKER | PASS | 401 | 401 authorization enforced |
| 106 | POST | `/api/v1/picker/verify/face` | PICKER | PASS | 401 | 401 authorization enforced |
| 107 | GET | `/api/v1/picker/wallet` | PICKER | PASS | 200 | 200 OK |
| 108 | GET | `/api/v1/picker/wallet/balance` | PICKER | PASS | 200 | 200 OK |
| 109 | POST | `/api/v1/picker/wallet/deposit` | PICKER | PASS | 401 | 401 authorization enforced |
| 110 | GET | `/api/v1/picker/wallet/earnings-breakdown` | PICKER | PASS | 200 | 200 OK |
| 111 | GET | `/api/v1/picker/wallet/history` | PICKER | PASS | 200 | 200 OK |
| 112 | GET | `/api/v1/picker/wallet/transactions` | PICKER | PASS | 200 | 200 OK |
| 113 | GET | `/api/v1/picker/wallet/transactions/:transactionId` | PICKER | PASS | 404 | 404 validated/rejected as expected |
| 114 | POST | `/api/v1/picker/wallet/withdraw` | PICKER | PASS | 401 | 401 authorization enforced |
| 115 | GET | `/api/v1/picker/wallet/withdrawal-requests/:requestId` | PICKER | PASS | 404 | 404 validated/rejected as expected |
| 116 | GET | `/api/v1/picker/work-locations` | PUBLIC | PASS | 200 | 200 OK |