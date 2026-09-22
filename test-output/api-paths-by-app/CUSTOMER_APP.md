# Customer App — 123 endpoints

| # | Method | Path | Auth | Result | HTTP | Note |
|---|--------|------|------|--------|------|------|
| 1 | POST | `/api/payment/callback` | CUSTOMER | PASS | 400 | 400 validated/rejected as expected |
| 2 | POST | `/api/payment/initiate` | CUSTOMER | PASS | 400 | 400 validated/rejected as expected |
| 3 | GET | `/api/payment/status/:orderId` | CUSTOMER | PASS | 200 | 200 OK |
| 4 | POST | `/api/payment/transaction-status` | PUBLIC | PASS | 400 | 400 validated/rejected as expected |
| 5 | GET | `/api/v1/customer/addresses` | CUSTOMER | PASS | 200 | 200 OK |
| 6 | POST | `/api/v1/customer/addresses` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 7 | DELETE | `/api/v1/customer/addresses/:id` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 8 | PUT | `/api/v1/customer/addresses/:id` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 9 | POST | `/api/v1/customer/addresses/:id/default` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 10 | GET | `/api/v1/customer/addresses/default` | CUSTOMER | PASS | 200 | 200 OK |
| 11 | GET | `/api/v1/customer/app-config` | CUSTOMER | PASS | 200 | 200 OK |
| 12 | POST | `/api/v1/customer/auth/link-phone/send-otp` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 13 | POST | `/api/v1/customer/auth/link-phone/verify-otp` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 14 | POST | `/api/v1/customer/auth/logout` | PUBLIC | PASS | 200 | 200 OK |
| 15 | POST | `/api/v1/customer/auth/resend-otp` | PUBLIC | PASS | 422 | 422 validated/rejected as expected |
| 16 | POST | `/api/v1/customer/auth/send-otp` | PUBLIC | PASS | 422 | 422 validated/rejected as expected |
| 17 | POST | `/api/v1/customer/auth/verify-otp` | PUBLIC | PASS | 422 | 422 validated/rejected as expected |
| 18 | GET | `/api/v1/customer/banners` | PUBLIC | PASS | 200 | 200 OK |
| 19 | GET | `/api/v1/customer/banners/:id` | PUBLIC | PASS | 404 | 404 validated/rejected as expected |
| 20 | GET | `/api/v1/customer/bootstrap` | CUSTOMER | PASS | 200 | 200 OK |
| 21 | GET | `/api/v1/customer/cart` | CUSTOMER | PASS | 200 | 200 OK |
| 22 | DELETE | `/api/v1/customer/cart/clear` | CUSTOMER | PASS | 200 | 200 OK |
| 23 | POST | `/api/v1/customer/cart/items` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 24 | PUT | `/api/v1/customer/cart/items` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 25 | DELETE | `/api/v1/customer/cart/items/:itemId` | CUSTOMER | PASS | 200 | 200 OK |
| 26 | PUT | `/api/v1/customer/cart/items/:itemId` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 27 | POST | `/api/v1/customer/cart/merge` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 28 | GET | `/api/v1/customer/categories` | PUBLIC | PASS | 200 | 200 OK |
| 29 | GET | `/api/v1/customer/categories/:id` | PUBLIC | PASS | 404 | 404 validated/rejected as expected |
| 30 | GET | `/api/v1/customer/categories/:slug/products` | PUBLIC | PASS | 200 | 200 OK |
| 31 | GET | `/api/v1/customer/categories/:slug/subcategories` | PUBLIC | PASS | 200 | 200 OK |
| 32 | GET | `/api/v1/customer/collections/:slug` | PUBLIC | PASS | 404 | 404 validated/rejected as expected |
| 33 | GET | `/api/v1/customer/coupons` | CUSTOMER | PASS | 200 | 200 OK |
| 34 | POST | `/api/v1/customer/coupons/redeem` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 35 | POST | `/api/v1/customer/coupons/validate` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 36 | GET | `/api/v1/customer/delivery/estimate` | CUSTOMER | PASS | 400 | 400 validated/rejected as expected |
| 37 | GET | `/api/v1/customer/delivery/fee` | CUSTOMER | PASS | 400 | 400 validated/rejected as expected |
| 38 | GET | `/api/v1/customer/faq` | PUBLIC | PASS | 200 | 200 OK |
| 39 | POST | `/api/v1/customer/faq/:id/feedback` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 40 | GET | `/api/v1/customer/faq/categories` | PUBLIC | PASS | 200 | 200 OK |
| 41 | GET | `/api/v1/customer/home` | CUSTOMER | PASS | 200 | 200 OK |
| 42 | POST | `/api/v1/customer/legal/accept` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 43 | GET | `/api/v1/customer/legal/config` | PUBLIC | PASS | 200 | 200 OK |
| 44 | GET | `/api/v1/customer/legal/license` | PUBLIC | PASS | 404 | 404 validated/rejected as expected |
| 45 | GET | `/api/v1/customer/legal/privacy` | PUBLIC | PASS | 404 | 404 validated/rejected as expected |
| 46 | GET | `/api/v1/customer/legal/terms` | PUBLIC | PASS | 404 | 404 validated/rejected as expected |
| 47 | GET | `/api/v1/customer/locations/approximate` | CUSTOMER | PASS | 200 | 200 OK |
| 48 | GET | `/api/v1/customer/locations/place-details` | CUSTOMER | PASS | 400 | 400 validated/rejected as expected |
| 49 | GET | `/api/v1/customer/locations/reverse` | CUSTOMER | PASS | 400 | 400 validated/rejected as expected |
| 50 | GET | `/api/v1/customer/locations/suggestions` | CUSTOMER | PASS | 200 | 200 OK |
| 51 | GET | `/api/v1/customer/notifications` | CUSTOMER | PASS | 200 | 200 OK |
| 52 | DELETE | `/api/v1/customer/notifications/:id` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 53 | PUT | `/api/v1/customer/notifications/:id/read` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 54 | PUT | `/api/v1/customer/notifications/:id/unread` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 55 | GET | `/api/v1/customer/notifications/preferences` | CUSTOMER | PASS | 200 | 200 OK |
| 56 | PUT | `/api/v1/customer/notifications/preferences` | CUSTOMER | PASS | 400 | 400 validated/rejected as expected |
| 57 | PUT | `/api/v1/customer/notifications/read-all` | CUSTOMER | PASS | 200 | 200 OK |
| 58 | POST | `/api/v1/customer/notifications/register-token` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 59 | POST | `/api/v1/customer/notifications/register-web-push` | CUSTOMER | PASS | 400 | 400 validated/rejected as expected |
| 60 | POST | `/api/v1/customer/notifications/remove-all-tokens` | CUSTOMER | PASS | 200 | 200 OK |
| 61 | POST | `/api/v1/customer/notifications/remove-token` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 62 | GET | `/api/v1/customer/notifications/unread-count` | CUSTOMER | PASS | 200 | 200 OK |
| 63 | GET | `/api/v1/customer/notifications/vapid-public-key` | PUBLIC | PASS | 200 | 200 OK |
| 64 | POST | `/api/v1/customer/onboarding/complete` | CUSTOMER | PASS | 200 | 200 OK |
| 65 | GET | `/api/v1/customer/onboarding/pages` | PUBLIC | PASS | 200 | 200 OK |
| 66 | GET | `/api/v1/customer/onboarding/pages/:pageNumber` | PUBLIC | PASS | 404 | 404 validated/rejected as expected |
| 67 | GET | `/api/v1/customer/onboarding/status` | CUSTOMER | PASS | 200 | 200 OK |
| 68 | GET | `/api/v1/customer/orders` | CUSTOMER | PASS | 200 | 200 OK |
| 69 | POST | `/api/v1/customer/orders` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 70 | GET | `/api/v1/customer/orders/:id` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 71 | GET | `/api/v1/customer/orders/:id/can-cancel` | CUSTOMER | PASS | 200 | 200 OK |
| 72 | POST | `/api/v1/customer/orders/:id/cancel` | CUSTOMER | PASS | 400 | 400 validated/rejected as expected |
| 73 | GET | `/api/v1/customer/orders/:id/invoice` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 74 | POST | `/api/v1/customer/orders/:id/rate` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 75 | POST | `/api/v1/customer/orders/:id/reorder` | CUSTOMER | PASS | 400 | 400 validated/rejected as expected |
| 76 | GET | `/api/v1/customer/orders/:id/status` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 77 | GET | `/api/v1/customer/orders/:id/tracking` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 78 | PUT | `/api/v1/customer/orders/:id/update-status` | ADMIN | PASS | 422 | 422 validated/rejected as expected |
| 79 | POST | `/api/v1/customer/orders/:id/verify-otp` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 80 | GET | `/api/v1/customer/orders/active` | CUSTOMER | PASS | 200 | 200 OK |
| 81 | GET | `/api/v1/customer/pages/:slug` | PUBLIC | PASS | 404 | 404 validated/rejected as expected |
| 82 | GET | `/api/v1/customer/payments/methods` | CUSTOMER | PASS | 200 | 200 OK |
| 83 | POST | `/api/v1/customer/payments/methods` | CUSTOMER | PASS | 201 | 201 OK |
| 84 | DELETE | `/api/v1/customer/payments/methods/:id` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 85 | PUT | `/api/v1/customer/payments/methods/:id` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 86 | POST | `/api/v1/customer/payments/methods/:id/default` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 87 | POST | `/api/v1/customer/payments/worldline/abort` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 88 | POST | `/api/v1/customer/payments/worldline/complete` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 89 | POST | `/api/v1/customer/payments/worldline/session` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 90 | GET | `/api/v1/customer/payments/worldline/status` | CUSTOMER | PASS | 400 | 400 validated/rejected as expected |
| 91 | GET | `/api/v1/customer/products/:id` | PUBLIC | PASS | 200 | 200 OK |
| 92 | GET | `/api/v1/customer/products/search` | PUBLIC | PASS | 400 | 400 validated/rejected as expected |
| 93 | GET | `/api/v1/customer/products/search/suggestions` | PUBLIC | PASS | 200 | 200 OK |
| 94 | GET | `/api/v1/customer/products/search/trending` | PUBLIC | PASS | 200 | 200 OK |
| 95 | GET | `/api/v1/customer/refunds` | CUSTOMER | PASS | 200 | 200 OK |
| 96 | GET | `/api/v1/customer/refunds/:id` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 97 | GET | `/api/v1/customer/refunds/:id/details` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 98 | POST | `/api/v1/customer/refunds/request` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 99 | GET | `/api/v1/customer/search` | PUBLIC | PASS | 400 | 400 validated/rejected as expected |
| 100 | GET | `/api/v1/customer/search/suggestions` | PUBLIC | PASS | 200 | 200 OK |
| 101 | GET | `/api/v1/customer/search/trending` | PUBLIC | PASS | 200 | 200 OK |
| 102 | GET | `/api/v1/customer/sections/:key/products` | PUBLIC | PASS | 200 | 200 OK |
| 103 | GET | `/api/v1/customer/store/:storeId/inventory` | CUSTOMER | PASS | 200 | 200 OK |
| 104 | POST | `/api/v1/customer/store/assign` | CUSTOMER | PASS | 400 | 400 validated/rejected as expected |
| 105 | GET | `/api/v1/customer/support/tickets` | CUSTOMER | PASS | 200 | 200 OK |
| 106 | POST | `/api/v1/customer/support/tickets` | CUSTOMER | PASS | 400 | 400 validated/rejected as expected |
| 107 | GET | `/api/v1/customer/support/tickets/:ticketId/messages` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 108 | POST | `/api/v1/customer/support/tickets/:ticketId/messages` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 109 | POST | `/api/v1/customer/support/tickets/:ticketId/reopen` | CUSTOMER | PASS | 404 | 404 validated/rejected as expected |
| 110 | GET | `/api/v1/customer/support/tickets/active` | CUSTOMER | PASS | 200 | 200 OK |
| 111 | PUT | `/api/v1/customer/user/change-password` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 112 | POST | `/api/v1/customer/user/phone/resend-otp` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 113 | POST | `/api/v1/customer/user/phone/send-otp` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 114 | POST | `/api/v1/customer/user/phone/verify-otp` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 115 | GET | `/api/v1/customer/user/profile` | CUSTOMER | PASS | 200 | 200 OK |
| 116 | PUT | `/api/v1/customer/user/profile` | CUSTOMER | PASS | 200 | 200 OK |
| 117 | POST | `/api/v1/customer/user/profile/avatar` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 118 | GET | `/api/v1/customer/wallet/balance` | CUSTOMER | PASS | 200 | 200 OK |
| 119 | POST | `/api/v1/customer/wallet/credit` | CUSTOMER | PASS | 403 | 403 authorization enforced |
| 120 | POST | `/api/v1/customer/wallet/debit` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 121 | POST | `/api/v1/customer/wallet/top-up/session` | CUSTOMER | PASS | 422 | 422 validated/rejected as expected |
| 122 | GET | `/api/v1/customer/wallet/transactions` | CUSTOMER | PASS | 200 | 200 OK |
| 123 | POST | `/api/v1/support/tickets` | PUBLIC | PASS | 400 | 400 validated/rejected as expected |