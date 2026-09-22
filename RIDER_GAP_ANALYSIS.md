# Frontend ↔ Backend Gap Analysis

**New frontend:** `Selorg-RiderApp-v1.3` (React Native, TypeScript, React Navigation, Context + useReducer)
**Existing backend:** `selorg-service` (Express + TypeScript + Mongoose, mounted under `/api/v1`)
**Frontend API base URL:** `http://localhost:3000/api/v1` (`src/config/environment.ts`)
**Backend default port:** `3333` (`.env.example`) — base-URL mismatch, see the cross-cutting checklist
**Analysis date:** 2026-09-04

---

## Executive Summary

The rider app is a **complete 41-screen UI** covering authentication, a 5-step onboarding/KYC flow,
shift booking, a standard single-order delivery flow, a 10-stop **bulk (multi-drop) delivery flow**,
earnings, delivery history, floating-cash/COD deposits, support chat, settings and legal pages.

The backend has a `picker` module (`/api/v1/picker/*`) whose **route surface already matches most of
what the app calls**, plus a `rider` module (`/api/v1/rider/*`) that is almost entirely
admin/dashboard-facing. The decisive finding is this:

> **The routes exist, but most of the rider-app-facing handlers are hard-coded stubs that return
> empty or echoed payloads.** They are wired into Express and return HTTP 200 inside the standard
> envelope, so they will *look* healthy in a smoke test while returning no data.

Verified stub handlers (`src/modules/picker/picker.controller.ts`) that the new frontend depends on:

| Handler | Returns today |
| --- | --- |
| `getAssignOrders` | `{ orders: [], total: 0 }` |
| `getSharedOrder` | `{ orderId }` — no items, no customer, no address |
| `updateSharedOrderStatus` | `{ orderId, status }` — echo, no persistence, no state machine |
| `completeSharedOrder` | `{ orderId, completed: true }` — **no OTP check** |
| `getCompletedSharedOrders` | `{ orders: [], total: 0 }` |
| `getEarningsBreakdown` | `{ userId, breakdown: [] }` |
| `getWalletHistory` | `{ userId, history: [], total: 0 }` |
| `getWalletBalance` | `{ userId, balance: 0, currency: 'INR' }` |
| `getOnboardingState` | `{ userId, state: 'pending', steps: [] }` |
| `getPerformanceSummary` / `getPerformanceHistory` | `{ summary: {} }` / empty |
| `getStoresNearby`, `getNearestLocation`, `getLocations` | empty |
| `trackUserLocation`, `setUserLocation`, `validateLocation` | `{ tracked: true }`, `{ set: true }`, `{ valid: true }` |
| `listFAQ`, `getLegalTerms`, `getLegalPrivacy`, `getPublicConfig` | `{ faqs: [] }`, `{ terms: '' }`, `{ privacy: '' }`, `{ config: {} }` |
| `listSupportTickets`, `createSupportTicket` | empty / echo |
| `registerPushToken`, `postHeartbeat`, `postPresencePing` | echo objects |
| `finance.service.getPickerEarningsBreakdown` | `{ totalEarned: 0, totalWithdrawn: 0, pending: 0, breakdown: [] }` |

Genuinely implemented picker logic (`picker.service.ts` + `picker.models.ts`) covers: profile
get/update, available shifts, my shifts, select/start/end shift, breaks, punch in/out, attendance
list, wallet record + transactions + withdrawal request, documents list/create, notifications, bank
accounts, work locations, training videos + watch progress, and performance aggregation.

Second decisive finding, on the frontend side:

> **The frontend is not actually wired to the API.** `src/services/api/*` defines four API clients
> (`authApi`, `orderApi`, `bulkApi`, `riderApi`), but a repository-wide search finds exactly **one**
> call site: `PhotoScreen.tsx:30` → `orderApi.confirmDelivery(...)`. Every other screen reads from
> `src/mock/*` and mutates local reducer state. Login and OTP never call `authApi`; shifts, orders,
> earnings, history, bulk and float cash all run on mock constants.

So delivery has two independent workstreams: (a) implement the backend contracts below, and
(b) replace mock reads with the API clients. This document specifies (a) and records (b) at the end.

Third finding — **bulk delivery has no backend at all**. `bulkApi` calls `/picker/bulk/batch`,
`/picker/bulk/bag/load`, `/picker/bulk/start`, `/picker/bulk/stops/:idx/deliver` and
`/picker/bulk/stops/:idx/fail`. None of these paths exist in `picker.routes.ts`; they 404 through
`notFoundMiddleware`. The `Cluster` model (`rider.models.ts`) and the admin cluster/dispatch
endpoints are the closest existing concept and should back the new batch APIs, but there is no
rider-facing surface, no per-stop status and no bag-load tracking today.

Fourth finding — **floating cash / COD deposit has no model and no endpoints anywhere in the
service.** Greps for `floatingCash`, `cashInHand`, `codCollect` and `/deposit` return nothing. The
`FloatCashScreen` + `DepositSheet` flow (₹2,000 limit, deposit by UPI/bank/card, running ledger,
deposit reference number) is a greenfield vertical: model, service, endpoints and reconciliation
against `paymentStatus: 'cod_pending'` on `Order`.

### Counts

| Classification | Count |
| --- | --- |
| `OK` — reusable as-is | 9 |
| `MODIFY` — endpoint exists, contract/logic must change | 24 |
| `NEW API` — no suitable endpoint | 22 |
| `BACKEND LOGIC` — route exists, business logic missing | 19 (overlaps `MODIFY`) |
| `DATA GAP` — model/collection missing | 11 |

### Top blockers (P0)

1. The rider order lifecycle is a stub — accept / pickup / deliver / cancel do not persist.
2. Delivery-OTP verification is missing on the rider path (`completeSharedOrder` always succeeds).
3. Bulk delivery has zero backend.
4. Floating cash / COD deposit has zero backend and no data model.
5. Picker JWTs are signed with the same `JWT_SECRET` the admin middleware verifies with (§ Auth A1).
6. The frontend token lives in a module-level variable, is lost on restart, and 401s are not handled.

---

## Existing APIs That Can Be Reused

Real implementations whose contracts already fit, or fit with only a frontend-side mapping.

| # | Endpoint | Backend implementation | Frontend consumer | Notes |
| --- | --- | --- | --- | --- |
| 1 | `POST /api/v1/picker/auth/send-otp` | `picker.auth.service.sendOtp` | `authApi.sendOtp` (mobile/WhatsApp) | Accepts `{ phone, preferredChannel }`; normalises to 10 digits, 4-digit OTP, 5-minute TTL, `preferredChannel: 'whatsapp' \| 'sms'`. Matches the login `SegmentedControl` exactly. `OK` |
| 2 | `POST /api/v1/picker/auth/resend-otp` | `resendOtp` | OtpScreen "Resend in 0:24" | Not yet called by the UI, but the contract is correct. `OK` |
| 3 | `POST /api/v1/picker/auth/send-otp-email` | `sendOtpEmail` | `authApi.sendOtp` (email) | Same 4-digit / 5-minute semantics, identifier `email\|<addr>`. `OK` for storage; delivery is unimplemented (see A10). |
| 4 | `GET /api/v1/picker/shifts/my` | `pickerService.getMyShifts` | ShiftsScreen "slots booked" count | Returns `PickerShiftAssignment[]` with a populated `shiftId`, filtered to `ASSIGNED`/`STARTED`. `OK` |
| 5 | `GET /api/v1/picker/documents` | `pickerService.listDocuments` | DocsScreen | Returns `PickerDocument[]` with `type`, `status`, `rejectionReason` — enough for the Verified / Pending / Rejected badges. `OK` |
| 6 | `GET /api/v1/picker/training/videos` | `pickerService.listTrainingVideos` | ObTrainingScreen | Active videos ordered by `order`, optional `warehouseKey` filter. `OK` |
| 7 | `PUT /api/v1/picker/training/watch-progress` | `pickerService.updateTrainingProgress` | ObTrainingScreen `playVideo()` | Persists per-video progress and auto-sets `trainingCompleted` when every active video reaches 100. `OK` |
| 8 | `GET /api/v1/picker/notifications` + `PUT /:id/read` | `getNotifications` / `markNotificationRead` | Not yet surfaced in the UI | Real, paginated, returns `unread`. Reusable when a notification centre is added. `OK` |
| 9 | `GET /api/v1/picker/wallet/transactions` | `pickerService.getTransactions` | `riderApi.getHistory` | Real and paginated. **But the frontend uses it for *delivery* history**, which it is not — see M10. Reusable as-is for a wallet-transactions screen. `OK` |

Also real and reusable, though not currently targeted by the frontend:

- `GET /api/v1/customer/faq` — public, paginated, has categories. A better source than the stubbed `/picker/faq`.
- `GET /api/v1/customer/legal/terms` and `/privacy` — public, version-aware. A better source than the stubbed `/picker/legal/*`.
- `GET /api/v1/picker/work-locations` — backs the onboarding hub list once distance sorting is added.
- `GET /api/v1/picker/bank/accounts` and `POST` — needed when real payout setup replaces the demo UPI copy.
- `POST /api/v1/picker/wallet/withdraw` — validates against `availableBalance` and creates a withdrawal request.

---

## APIs That Need Modification

### M1 — `POST /picker/auth/verify-otp` and `/verify-otp-email` — `MODIFY`

Backend returns `{ success, message, token, isNewUser, user: { id, phone, email, loginMethod } }`.
The frontend must decide, immediately after verification, between four destinations: `Main`,
`ObWelcome`, `Pending` and `Rejected` (`OtpScreen.tsx`, `RootNavigator`). `isNewUser` alone cannot
distinguish "signed up but still under review" from "approved". `PickerUser.status`
(`PENDING | ACTIVE | INACTIVE | REJECTED | SUSPENDED`) holds the answer but is not returned.

**Required change:** add `user.status`, `user.onboardingCompleted` and `user.rejectedReason`, plus a
derived `nextScreen` hint, to both verify responses.

Secondary: the landing screen offers "Log In" vs "Create Rider Account" (`authIntent`), and the login
screen has a `loginNotFound` banner ("We couldn't find an account for this number"). The backend
**auto-creates** a `PickerUser` on first successful verify, so the login path can never produce that
error. Either the frontend drops the banner, or verify accepts an `intent` flag and returns
`404 ACCOUNT_NOT_FOUND` for `intent: 'login'` against an unknown phone.

### M2 — `GET /picker/shifts/available` — `MODIFY`

Returns raw `PickerShift` documents: `{ _id, id?, name, warehouseKey, startTime, endTime, time,
duration, capacity, breakDuration, status, orders, basePay, color, locationType }`.
The frontend `ShiftSlot` needs `{ id, time, label, pay, booked }`, where `time` is a display range
("6:00 AM – 10:00 AM"), `label` is the slot name ("Morning"), `pay` is a display string
("₹120/hr + incentives") and **`booked` is per-rider state**.

Mismatches: no `booked` flag (needs a join against `PickerShiftAssignment` for the caller); no
formatted pay string (`basePay` is a bare number with no currency or incentive text); no remaining
capacity, so a full slot cannot be greyed out; and the `status: 'SCHEDULED'` filter has no date
window, so past shifts are returned indefinitely.

### M3 — `POST /picker/shifts/select` — `MODIFY`

`pickerService.selectShift` creates a `PickerShiftAssignment` with **no guards**: no capacity check
against `PickerShift.capacity`, no duplicate check (booking the same shift twice creates two
assignments), no overlap check against other bookings, and `date: new Date()` always — so selecting
tomorrow's shift records today. It returns the raw assignment; the frontend needs the updated slot so
`SlotCard` can flip to "Booked".

### M4 — Unbooking a shift — `MODIFY` / `NEW API`

`ShiftsScreen` toggles booking both ways (`actions.toggleBooked`). `riderApi.bookShift` states in a
comment that *"the service has no picker-facing 'unbook' endpoint"*. `POST /api/v1/rider/shifts/cancel`
exists but is unauthenticated, takes `riderId` from the body, and operates on
`RiderShiftAssignment` — a **different collection** from `PickerShiftAssignment`. A picker-scoped
`POST /picker/shifts/deselect` is required.

### M5 — `POST /picker/shifts/start` and `/end` — `MODIFY`

The Home online/offline toggle (`ShiftSelectSheet` → `startShift`) is the app's go-online action.
`pickerService.startShift(userId, req.params.shiftId)` reads `shiftId` from the **path**, but the
body-form route `POST /shifts/start` passes `undefined`, so `findOne({ shiftId: undefined })` fails
with 404. The body variant must accept `{ shiftId }`. Going online should also set presence
(`lastSeenAt`, plus an `isOnline` field that does not exist) and gate order dispatch.

### M6 — `GET /picker/shared-orders/assignorders` — `MODIFY` + `BACKEND LOGIC`

Stub. The frontend `Order` shape is `{ id, num, raw, payout, pickup, bay, deliver, distance, time,
items, priority }`. Nothing in the customer `Order` model provides `payout`, `bay` (dispatch
bay/rack), `distance`, `time` (ETA) or `priority`. `Order.riderId` exists (`string | null`) but is
unindexed, and there is no `assignedAt` / `acceptedAt`. No pagination, no store filter, and no
"available vs mine" split — the frontend needs both (`availableOrders` and `activeOrder`).

### M7 — `GET /picker/shared-orders/:orderId` — `MODIFY` + `BACKEND LOGIC`

Stub returning `{ orderId }`. `BagScreen` needs the bag manifest — `OrderItem[] { name, qty }` — plus
the bag label (`Bag SG-<raw>-A`) and the bay/rack. `Order.items[]` has `productName`, `quantity`,
`variantSize` and `itemStatus`, which map cleanly, but the endpoint returns none of it and performs
no check that the caller is the assigned rider.

### M8 — `PUT /picker/shared-orders/:orderId/status` — `MODIFY` + `BACKEND LOGIC`

Stub echo. The frontend sends `accepted`, `picked_up` and `cancelled` (plus `reason` and `note` on
cancel). `Order.status` is `pending | confirmed | getting-packed | on-the-way | arrived | delivered |
cancelled` — **no overlap for `accepted` or `picked_up`**. A real transition path exists at
`PUT /api/v1/customer/orders/:id/update-status` (`ordersService.updateCustomerOrderStatus`), but it is
`authenticateAdmin`-guarded and its Zod enum excludes the rider states.

Also missing: an assignment ownership check, idempotency, a state machine (nothing prevents
`picked_up` → `accepted`), and persistence of the cancel reason from the frontend's six-value list
(`unreachable | refused | address | asked | vehicle | other`) — `Order.cancellationReason` is a free
string with no enum.

### M9 — `POST /picker/shared-orders/:orderId/complete` — `MODIFY` + `BACKEND LOGIC` (P0, security)

Stub returning `{ completed: true }` **unconditionally**. The frontend posts `{ otp, photo }` and
branches on `result.ok` to show "Incorrect OTP" (`PhotoScreen.tsx:30-40`). Today every wrong OTP
succeeds, and any authenticated picker can mark any order delivered.

Real OTP logic already exists at `POST /api/v1/customer/orders/:id/verify-otp`
(`order.controller.verifyOtp`): it compares `order.deliveryOtp`, caps `otpAttempts` at 5 → HTTP 429,
sets `status: 'delivered'` and `deliveredAt`, flips `paymentStatus` from `cod_pending` to `paid`, and
appends a timeline entry with `actor: 'rider'`. It is gated by `authenticateCustomer` **and scoped to
the customer's own order** (`Order.findOne({ _id, userId })`), so a rider token can never reach it.
The same logic must be re-exposed on the picker path with rider ownership instead.

`photo: boolean` is not proof of delivery — see D5 / N16.

### M10 — `GET /picker/shared-orders/completed` — `MODIFY` + `BACKEND LOGIC`

Stub. `HistoryScreen` needs `HistoryEntry { time, addr, num, items, dist, payout }` and a filter over
`all | standard | bulk`. There is no date grouping ("Today, 11:42 AM"), no pagination and no payout
field. Note that `riderApi.getHistory` currently points at `/picker/wallet/transactions`, which
returns wallet ledger rows, not deliveries — a semantic mismatch, not just a shape mismatch.

### M11 — `GET /picker/wallet/earnings-breakdown` — `MODIFY` + `BACKEND LOGIC`

Stub `{ breakdown: [] }`. `EarningsScreen` needs `{ weekTotal, deliveries, avgPerOrder, onlineHours,
nextPayout, nextPayoutWhen, nextPayoutSchedule, breakdown: [{ label, value, purple }] }`, where the
three breakdown rows are **Standard Deliveries / Bulk Delivery / Incentives**. The declared
`EarningsSummary` type in `riderApi.ts` (`{ total, orders, hours, breakdown: [{ label, amount }] }`)
is a third, different shape — frontend service and frontend screen disagree with each other as well
as with the backend. There is also no period parameter (`?period=week|month`).

### M12 — `GET /picker/wallet/history` — `MODIFY` + `BACKEND LOGIC`

Stub `{ history: [] }`. The frontend `EarningsDay { day, date, orders, hours, amount }` is a per-day
rollup of orders, online hours and earnings. Nothing computes this. `PickerAttendance` carries
`totalWorkedMinutes` and `ordersCompleted`, so the aggregation is feasible but unwritten.

### M13 — `GET /picker/wallet/balance` — `MODIFY`

Stub returning `{ balance: 0 }`, while a **real** `getWallet` (`GET /picker/wallet`) returns the full
`PickerWallet` (`availableBalance`, `pendingBalance`, `reservedBalance`, `totalEarnings`). Two
endpoints for one concept, one of them fake. Consolidate onto the real one.

### M14 — `GET /picker/onboarding/state` — `MODIFY` + `BACKEND LOGIC`

Stub `{ state: 'pending', steps: [] }`. The frontend `accountStatus` is `none | pending | approved`,
plus a separate `Rejected` screen with a per-document reason. Backend truth lives in
`PickerUser.status`, `PickerUser.rejectedReason` and `PickerDocument.status`/`rejectionReason`, none
of which is exposed to the app. The endpoint needs per-step completion, an overall status and
rejection reasons.

**Enum mapping required:**

| Frontend | Backend `PickerUser.status` |
| --- | --- |
| `none` (not submitted) | `PENDING` with no submission record |
| `pending` (under review) | `PENDING` after submit |
| `approved` | `ACTIVE` |
| Rejected screen | `REJECTED` (+ `rejectedReason`) |
| — (no frontend state) | `INACTIVE`, `SUSPENDED` — the app has no screen for these |

`SUSPENDED` is enforced in `authenticatePicker` (403 `ACCOUNT_SUSPENDED`) but the app has no handler,
so a suspended rider sees a generic failure.

### M15 — `POST /picker/documents` (upload) — `MODIFY` + `BACKEND LOGIC`

Requires `{ type, url, fileName }` — the client must already have a hosted URL. The onboarding KYC
screen captures files on-device. There is **no picker-facing file upload**: multer exists only in
`hhd.routes.ts` (`/photos`, image-only, 10 MB) and in the admin compliance / support upload
middleware. Additionally, `type` is an unconstrained `String` — the frontend's
`aadhar | pan | dl | rc | ins` codes are neither validated nor enumerated — and there is no
front/back side concept for Aadhaar even though the UI copy says "Front & back photo".

### M16 — `GET /picker/stores/nearby`, `/locations/nearest`, `/locations` — `MODIFY`

All stubs. `ObHubScreen` requests location permission and then shows hubs **sorted by distance** with
a `dist` label. `PickerWorkLocation` has `coordinates` and `geofenceRadius`, so a geo query is
implementable, but there is no `2dsphere` index and nothing computes distance.

### M17 — `POST /picker/locations/track` — `MODIFY` + `BACKEND LOGIC`

Stub `{ tracked: true }`. Both `NavScreen` and `TravelScreen` are live-navigation screens, and the
Settings screen has a "Location sharing" toggle whose privacy copy states that location is tracked
while the rider is online. `PickerUser.gpsLocation` exists as a single point (no history collection).
Nothing is persisted today.

### M18 — `POST /picker/push-token` — `MODIFY` + `BACKEND LOGIC`

Stub. Settings has a "Push notifications" toggle. Real token storage exists only on the customer side
(`POST /customer/notifications/register-token`, `authenticateCustomer`).

### M19 — `GET /picker/config` — `MODIFY` + `BACKEND LOGIC`

Returns `{ config: {} }`. `environment.ts` hard-codes `otpLength: 4`, `codDepositLimit: 2000`,
`supportPhone`, `supportEmail` and `appVersion` — all of which belong in remote config so they can
change without a store release. `GET /customer/app-config` is a working template.

### M20 — `GET /picker/legal/terms` and `/privacy` — `MODIFY`

Return `{ terms: '' }` and `{ privacy: '' }`. Real content is at `/customer/legal/terms|privacy`
(public, version-aware). The frontend renders `LegalSection[] { h, b }` — a section array, not a blob
— plus a "Last updated" / "Effective" date line. Either the picker routes proxy the legal service and
the frontend renders the document body, or the legal service gains a sectioned representation.

### M21 — `GET /picker/faq` — `MODIFY`

Stub `{ faqs: [] }`. A real FAQ module exists at `/customer/faq` with categories and pagination. The
`SupportScreen` "Quick help" list needs `{ q, a }` pairs mapped from the FAQ model.

### M22 — `GET /picker/support/tickets` and `POST` — `MODIFY` + `BACKEND LOGIC`

Both stubs. A real support module exists (`/customer/support/tickets` with attachments, messages and
reopen), plus a public `POST /api/v1/support/tickets`. Neither is picker-authenticated.

### M23 — `GET /picker/performance` and `/performance/summary` — `MODIFY`

`/performance` is real (`getPerformance`) and returns `{ totalShifts, present, absent,
totalWorkedMinutes, totalOrdersCompleted, averageOrdersPerShift }`; `/performance/summary` is a stub.
`ProfileScreen` shows **rating (★ 4.9), total trips (1,284) and on-time % (98%)**, none of which the
aggregate provides. `Rider.rating` exists on the *operational rider* model — a different collection,
keyed `RIDER-\d+` — not on `PickerUser`.

### M24 — `GET /picker/user/profile` and `PUT` — `MODIFY` + `DATA GAP`

`getProfile` returns the raw `PickerUser`. `updateProfile` whitelists
`name, email, age, gender, photoUri, locationType, upiId, upiName, gpsLocation`.
Onboarding collects **vehicle type** (`bike | scooter | ev | cycle`) and **registration number**
(`KA 01 AB 1234`), and `ProfileScreen` displays both plus a delivery mode (`standard | bulk`) derived
from the vehicle class. None of these fields exist on `PickerUser`, and none are in the whitelist.

---

## New APIs Required

### Bulk delivery (P0 — the entire vertical is missing)

| # | Endpoint the frontend calls | Purpose | Screens |
| --- | --- | --- | --- |
| N1 | `GET /picker/bulk/batch` | Current assigned batch: id, vehicle, stops in route order, per-stop status, distance/duration estimates | BulkOverview, BulkActive, BulkAllStops, Home card |
| N2 | `POST /picker/bulk/bag/load` | Mark one bag scanned/loaded at the darkstore | BulkLoading |
| N3 | `POST /picker/bulk/start` | Dispatch the batch once every bag is loaded | BulkLoading → BulkActive |
| N4 | `POST /picker/bulk/stops/:stopIdx/deliver` | Mark a stop delivered (with POD photo) | BulkVerify |
| N5 | `POST /picker/bulk/stops/:stopIdx/fail` | Mark a stop failed with an exception reason | BulkExceptionSheet |
| N6 | `GET /picker/bulk/batches` | Completed batch history | HistoryScreen (Bulk tab) |
| N7 | `GET /picker/bulk/batches/:batchId` | Batch summary: orders / delivered / failed / vehicle / distance / duration / earnings | BulkHistoryDetail |

Not called by the current frontend but required for the flow to be correct:

| # | Endpoint | Purpose |
| --- | --- | --- |
| N8 | `POST /picker/bulk/stops/:stopIdx/arrive` | Persist the `toNav → navigating → arrived` phase machine, which is currently pure client state (`bulkStopPhase`) and is lost on app restart |

**Note on stop addressing:** the frontend addresses stops by **array index** (`stopIdx`), not by a
stable id. Two clients — or one client after a batch reorder — would disagree. The contract should
use a server-issued `stopId`; if index addressing is kept, the stop ordering must be immutable once
the batch is dispatched.

### Floating cash / COD (P0 — the entire vertical is missing)

| # | Endpoint | Purpose | Screens |
| --- | --- | --- | --- |
| N9 | `GET /picker/cash/summary` | Cash in hand, deposit limit, shift-end deadline | FloatCashScreen, ProfileScreen tile, Home |
| N10 | `GET /picker/cash/transactions` | COD ledger: collections and deposits with timestamps | FloatCashScreen |
| N11 | `POST /picker/cash/deposits` | Record a deposit (`amount`, `method: upi \| bank \| card`) and return a `ref` | DepositSheet — the frontend currently calls `POST /picker/wallet/deposit`, which does not exist |

### Dashboard / earnings

| # | Endpoint | Purpose | Screens |
| --- | --- | --- | --- |
| N12 | `GET /picker/dashboard/today` | COD collected, orders delivered, online hours, slots completed | HomeScreen stat grid |
| N13 | `GET /picker/incentives/today` | Target, earned, progress %, on-time/late counts | HomeScreen incentive card |

### Onboarding

| # | Endpoint | Purpose | Screens |
| --- | --- | --- | --- |
| N14 | `POST /picker/onboarding/submit` | Submit the application for review; transitions the account into "under review" | ObReviewScreen |
| N15 | `POST /picker/onboarding/kit-ack` | Acknowledge receipt of the 4 kit items (bag, t-shirt, ID card, helmet) | ObTrainingScreen |

### Delivery proof and session

| # | Endpoint | Purpose | Screens |
| --- | --- | --- | --- |
| N16 | `POST /picker/shared-orders/:orderId/proof-photo` | Multipart POD image upload; returns a `photoId`/`url` to pass to `/complete` | PhotoScreen |
| N17 | `POST /picker/bulk/stops/:stopIdx/proof-photo` | The same for bulk stops | BulkVerifyScreen |
| N18 | `POST /picker/auth/logout` | Invalidate `PickerUser.sessionToken` server-side | ProfileScreen "Log out", PendingScreen back |
| N19 | `POST /picker/auth/refresh` | Refresh a 7-day token without re-running OTP | app resume |

### Settings and support

| # | Endpoint | Purpose | Screens |
| --- | --- | --- | --- |
| N20 | `GET` / `PUT /picker/settings/preferences` | Push / location-sharing / sound toggles and language | SettingsScreen, LanguageSheet |
| N21 | `GET` / `POST /picker/support/chat/messages` | Rider↔support chat thread — the frontend currently fakes a canned reply after 900 ms | SupportScreen |
| N22 | `GET /picker/config/cancel-reasons` | Server-driven cancel and bulk-exception reason lists | CancelOrderSheet, BulkExceptionSheet |

---

## Backend Logic Gaps

The API surface exists; the business rules behind it do not.

| # | Gap | Where | Impact |
| --- | --- | --- | --- |
| L1 | **Order state machine for riders.** No transitions, no guards, no timeline writes on the picker path. `accepted` and `picked_up` are not valid `Order.status` values. | `updateSharedOrderStatus` | P0 — the whole standard flow is non-functional |
| L2 | **Delivery OTP verification.** `completeSharedOrder` never checks the OTP; no attempt cap, no lockout. | `completeSharedOrder` | P0 — fraud vector; any picker can mark any order delivered |
| L3 | **Order assignment ownership.** No endpoint verifies that the calling picker is the order's assigned rider. `Order.riderId` is an unindexed `string` with no relation to `PickerUser`. | shared-orders handlers | P0 — horizontal privilege escalation (IDOR) |
| L4 | **Accept concurrency.** No atomic claim; two riders accepting the same order both "succeed". | `updateSharedOrderStatus` | P0 |
| L5 | **Payout calculation.** No per-order rider payout anywhere. `dispatch.service` has `RIDER_EARNING_BASE_INR = 25` and `RIDER_EARNING_PER_KM_INR = 8`, used only for admin cluster metrics and never persisted per order. | earnings, history, order cards | P1 |
| L6 | **Earnings aggregation.** Weekly totals, average per order, online hours, per-day rollups and the standard-vs-bulk split are all uncomputed. `finance.service.getPickerEarningsBreakdown` is a literal zero object. | EarningsScreen | P1 |
| L7 | **Incentive engine.** No targets, no progress, no on-time/late attribution. | Home incentive card | P2 |
| L8 | **COD ledger and reconciliation.** Cash collected on delivery is never recorded against the rider, and deposits do not clear `paymentStatus: 'cod_pending'`. | FloatCash | P0 |
| L9 | **Deposit limit enforcement.** The ₹2,000 limit and end-of-shift deadline exist only as frontend copy and client-side reducer validation. | DepositSheet | P1 |
| L10 | **Shift capacity, overlap and duplicate booking.** `selectShift` has no guards. | ShiftsScreen | P1 |
| L11 | **Per-rider `booked` state on the shift list.** Requires a left join to `PickerShiftAssignment`. | ShiftsScreen, ShiftSelectSheet | P1 |
| L12 | **Online/offline presence.** No `isOnline` on `PickerUser`; `/heartbeat` and `/presence/ping` are echoes; dispatch does not filter by rider availability from the picker model. | Home toggle | P1 |
| L13 | **Onboarding progress computation.** No step model, no record of which of the 5 steps are complete, no submit → review transition. | Ob* screens, PendingScreen | P0 |
| L14 | **Document review feedback loop.** `PickerDocument.rejectionReason` is written by admins but never surfaced to the rider; `RejectedScreen` hard-codes "Driving licence photo was blurry". | RejectedScreen | P1 |
| L15 | **Bulk route sequencing and clustering for riders.** `Cluster` and `dispatch.service.groupOrders` exist admin-side; nothing produces a rider-consumable ordered stop list. | Bulk* screens | P0 |
| L16 | **Bulk bag/load verification.** No bag entity, no scan validation, no "all bags loaded" gate. | BulkLoadingScreen | P0 |
| L17 | **Distance / ETA computation for the rider app.** `dispatch.service.calculateDistance` exists but is admin-only and falls back to a **hash of the address string** when coordinates are missing — not usable as a rider- or customer-facing ETA. | order cards, bulk stops | P1 |
| L18 | **Hub distance sorting.** No geo query on `PickerWorkLocation`. | ObHubScreen | P1 |
| L19 | **Rider rating and on-time percentage.** Not computed anywhere for pickers. | ProfileScreen | P2 |

---

## Database / Model Gaps

| # | Gap | Detail | Priority |
| --- | --- | --- | --- |
| D1 | **Bulk batch model** | No `PickerBulkBatch` / batch-stop collection. Needs `batchId`, `pickerId`, `storeId`, `vehicleType`, `status` (`assigned \| loading \| ready \| dispatched \| in_transit \| completed`), an ordered `stops[]` of `{ stopId, orderId, seq, customer, address, bagCode, distanceKm, etaMinutes, itemCount, status: pending \| delivered \| failed, failureReason, deliveredAt, podPhotoId }`, plus `totalDistanceKm`, `durationMinutes` and `earnings`. `Cluster` is the nearest existing model but has only `orderIds[]`, `center`, `status` and `riderId` — no per-stop state, no sequence, no bag. | P0 |
| D2 | **Bag model** | `bagCode` (`BD01`…`BD10`, `SG-2048-A`) has no representation on `Order` or anywhere in the picker schema. HHD has bag scanning (`hhd.bag.controller`) but against its own models, in a different auth domain. | P0 |
| D3 | **COD / floating-cash ledger** | No collection. Needs `PickerCashLedger` (`pickerId`, `type: cod_collected \| deposit \| adjustment`, `amount`, `orderId?`, `method?`, `ref`, `createdAt`) plus a running `cashInHand` on the picker or a derived aggregate. | P0 |
| D4 | **Deposit record** | The `depositRef` (`DP######`) is generated **client-side** in `reducer.ts`. It needs to be a server-issued, unique, auditable reference. | P0 |
| D5 | **Rider payout and POD on the order** | No `riderPayout` / `earningBreakdown` and no proof-of-delivery photo reference on `Order`. | P1 |
| D6 | **Vehicle fields on `PickerUser`** | `vehicleType` (`bike \| scooter \| ev \| cycle \| auto \| van`), `vehicleRegistrationNumber` and a derived `deliveryMode` (`standard \| bulk`). The frontend derives bulk mode from `vehicleType ∈ {auto, van}` (`selectors.ts`); that rule has no backend counterpart. | P1 |
| D7 | **Onboarding application record** | No `submittedAt`, no step-completion map, no application id. `PendingScreen` shows an `appId` derived client-side from the vehicle number (`selectors.appId`). | P0 |
| D8 | **Kit acknowledgement** | The 4 kit items have no model. | P2 |
| D9 | **Hub/darkstore assignment on the picker** | `PickerUser.currentLocationId` is a loose `String` with no ref to `PickerWorkLocation.warehouseKey`; `storeId` is an unref'd `ObjectId`. The onboarding hub choice has no validated home. | P1 |
| D10 | **Location history / breadcrumb trail** | `PickerUser.gpsLocation` holds a single point. Live tracking, replay and geofence audit need a time-series collection with a TTL index. | P1 |
| D11 | **Rider ↔ order relation** | `Order.riderId: string \| null` is unindexed and has no schema-level relation to `PickerUser` (keyed by `ObjectId`) or to `Rider` (keyed by the `RIDER-\d+` string). Two rider identity spaces coexist, so every "my orders" query is both unindexed and ambiguous. | P0 |

Additional non-blocking observations:

- `PickerUser.selectedShifts[]` (an embedded `{ id, name, time }` array) duplicates
  `PickerShiftAssignment` — two sources of truth for the same fact.
- `PickerAttendance.status` mixes casing conventions in one enum:
  `present | half-day | absent | ON_DUTY | COMPLETED | ON_BREAK`.
- `PickerUser.status` is `SCREAMING_CASE` while `PickerDocument.status` is `lowercase`, so clients
  must handle both conventions.

---

## Authentication & Authorization Gaps

| # | Gap | Detail | Priority |
| --- | --- | --- | --- |
| A1 | **Picker tokens are accepted by the admin middleware** | `picker.auth.service` signs with `process.env.JWT_SECRET`. `authenticateAdmin` verifies with `getAdminJwtSecret()`, which is *the same* `process.env.JWT_SECRET`, so a picker JWT passes. `req.user.role` is `undefined`, so `getDefaultPermissionsForRole(undefined)` returns `[]` and any `requireRole` / `requirePermission` guard denies — but **every route protected by `authenticateAdmin` alone is reachable with a rider token**. That includes all of `/api/v1/rider/*` (dispatch, fleet, HR, compliance, contracts) and `/api/v1/admin/picker/*` (approve/reject pickers, process withdrawals, assign devices). Fix with a separate `PICKER_JWT_SECRET`, or an explicit `aud`/`role` claim check in `authenticateAdmin`. | **P0** |
| A2 | **Unauthenticated rider-facing shift routes** | `GET /api/v1/rider/shifts/available/list`, `GET /shifts/my`, `POST /shifts/select`, `POST /shifts/cancel`, `POST /shifts/start` and `POST /shifts/end` are registered with **no auth middleware at all**, and `my` / `select` / `cancel` take `riderId` from the query or body. Anyone who can reach the service can enumerate and mutate any rider's shift assignments. | **P0** |
| A3 | **No ownership checks on shared-order endpoints** | `getSharedOrder`, `updateSharedOrderStatus` and `completeSharedOrder` never compare the order's assigned rider to `req.pickerId`. Once implemented, they must. | **P0** |
| A4 | **Rider support chat sits behind customer auth** | `/api/v1/rider/support-chat/*` uses `authenticateCustomer`, which verifies with `CUSTOMER_JWT_SECRET` and resolves the subject against the `CustomerUser` collection. A picker token's subject is a `PickerUser` id, so it resolves to `null` → 401. The route is named for riders but is unreachable by them. | P1 |
| A5 | **No token persistence or refresh on the client** | `client.ts` keeps the token in a module-level `let _token`, and `storageService` is an in-memory `Map`. Every app restart forces a full re-OTP. Tokens are 7-day and non-refreshable. | P1 |
| A6 | **No 401 handling on the client** | `request()` returns `{ ok: false, error }` for every failure; nothing distinguishes 401/403 or triggers a logout redirect. A suspended or expired rider sees a generic inline error. | P1 |
| A7 | **`SUSPENDED` and `INACTIVE` have no frontend state** | `authenticatePicker` returns 403 `ACCOUNT_SUSPENDED`; the app has no screen for it. `RejectedScreen` exists but nothing routes to it from a server response. | P1 |
| A8 | **OTP dev mode leaks the code** | `OTP_DEV_MODE` is on whenever `NODE_ENV !== 'production'` and returns the OTP **in the response body** (`{ success, message, channel, otp }`). Correct for local work, but it must be verified off in every deployed environment. `TEST_PHONES = { '9698790921': '8790' }` is also a permanent backdoor. | P1 |
| A9 | **No OTP-specific rate limiting** | Only the global per-IP `/api/v1` limiter applies. `checkOtp` caps at 5 attempts per stored record, but a fresh `send-otp` upserts `attempts: 0`, so unlimited retries are available to anyone who can also call send. Needs a per-identifier limit on both send and verify. | P1 |
| A10 | **Email OTP delivery is not implemented** | Outside dev mode, `sendOtpEmail` stores the OTP and returns success **without ever sending an email**. The Email login method cannot work in production. | P1 |
| A11 | **Synthetic phone numbers for email users** | `verifyOtpEmail` fabricates a phone (`syntheticPhone()` — md5-derived, prefixed `1`) to satisfy `PickerUser.phone` being `required + unique`. These accounts carry an unusable phone number that will surface in admin lists and SMS flows. | P2 |
| A12 | **No replay/idempotency protection on mutating rider actions** | `Idempotency-Key` is allowed by CORS but no picker endpoint honours it. Order accept/complete and cash deposit need it. | P2 |

---

## Frontend ↔ Backend Compatibility Matrix

| Frontend Feature | Frontend Requirement | Existing Backend | Result | Required Action | Priority |
| --- | --- | --- | --- | --- | --- |
| Auth landing (Log In / Create Account) | Distinguish an existing rider from a new one | `verifyOtp` auto-creates users; no lookup endpoint | `MODIFY` | Add an `intent` flag and return `404 ACCOUNT_NOT_FOUND`, or drop the `loginNotFound` banner | P2 |
| Login — mobile OTP | POST phone, 4-digit SMS OTP | `POST /picker/auth/send-otp` | `OK` | Wire `LoginScreen` to `authApi.sendOtp` (it only navigates today) | P0 |
| Login — WhatsApp OTP | `preferredChannel: 'whatsapp'` | Accepted; channel echoed in the response | `OK` | Confirm the SMS gateway actually routes WhatsApp | P1 |
| Login — Email OTP | POST email, 4-digit code | `POST /picker/auth/send-otp-email` | `BACKEND LOGIC` | Implement real email delivery | P1 |
| OTP verify | Token plus a routing decision | `verify-otp` returns `token`, `isNewUser`, `user` | `MODIFY` | Add `status`, `onboardingCompleted`, `rejectedReason`; wire `OtpScreen` to `authApi.verifyOtp` (today it is a local reducer with a hard-coded `9000000000` failure case) | P0 |
| Resend OTP | Countdown plus resend | `POST /picker/auth/resend-otp` | `OK` | Wire the timer; add per-identifier throttling | P2 |
| Session persistence | Survive an app restart | 7-day JWT + `sessionToken` in the DB | `MODIFY` | Persist client-side; add `POST /picker/auth/refresh` and `/logout` | P1 |
| Onboarding step 1 — personal | Name, email, verified phone | `PUT /picker/user/profile` (whitelist) | `OK` | Reuse | P1 |
| Onboarding step 2 — vehicle | Vehicle type + registration number | No such fields on `PickerUser`, not in the whitelist | `DATA GAP` | Add `vehicleType`, `vehicleRegistrationNumber`, `deliveryMode`; extend the whitelist | P0 |
| Onboarding step 3 — hub | Location permission, then hubs sorted by distance | `GET /picker/work-locations` real; `/stores/nearby` and `/locations/nearest` are stubs | `MODIFY` | Add a geo query and a `2dsphere` index; return `distanceKm` | P1 |
| Onboarding step 4 — KYC upload | Capture and upload 5 document types | `POST /picker/documents` needs a pre-hosted `url`; no multipart | `MODIFY` | Add multipart (or presigned-URL) upload; enumerate `type`; add front/back sides | P0 |
| Onboarding step 5 — training video | Watch a video and mark it complete | `GET /training/videos` + `PUT /training/watch-progress` | `OK` | Reuse | P1 |
| Onboarding step 5 — kit checklist | Acknowledge 4 kit items | Nothing | `NEW API` + `DATA GAP` | `POST /picker/onboarding/kit-ack` | P2 |
| Onboarding review and submit | Submit the application | Nothing | `NEW API` | `POST /picker/onboarding/submit` | P0 |
| Application pending screen | Application id, hub, status, poll for the outcome | `GET /picker/onboarding/state` is a stub | `BACKEND LOGIC` | Real state plus a server-issued application id | P0 |
| Application rejected screen | Per-document rejection reason | `PickerDocument.rejectionReason` exists but is never exposed | `BACKEND LOGIC` | Surface reasons on the onboarding-state response | P1 |
| Home — greeting and shift chip | Rider name, active shift window | `GET /picker/user/profile`, `GET /picker/shifts/my` | `OK` | Reuse | P1 |
| Home — online/offline toggle | Go online against a chosen shift | `POST /picker/shifts/start` reads `shiftId` from the path only | `MODIFY` | Accept `{ shiftId }` in the body; add an `isOnline` presence flag | P0 |
| Home — Today's Performance (4 tiles) | COD collected, orders delivered, online hours, slots completed | `/performance` covers orders and minutes only; no COD, no slot count | `NEW API` | `GET /picker/dashboard/today` | P1 |
| Home — daily incentive card | Target, earned, progress %, on-time/late split | Nothing | `NEW API` + `BACKEND LOGIC` | `GET /picker/incentives/today` | P2 |
| Home / Orders — new-order badge | Count of available orders | `assignorders` stub returns `total: 0` | `BACKEND LOGIC` | Implement; the badge is hard-coded to `2` today | P1 |
| Orders — available list | `Order[]` with payout, bay, distance, ETA, priority | `GET /shared-orders/assignorders` is a stub and the source fields do not exist | `MODIFY` + `DATA GAP` | Implement; add payout, bay and priority | P0 |
| Orders — resume active order | Current order plus flow stage | The flow stage is client-only (`flowScreen`) | `BACKEND LOGIC` | Persist the rider-facing order stage so resume survives a restart | P1 |
| Accept order | Claim an order atomically | `PUT /shared-orders/:id/status` echoes | `BACKEND LOGIC` | Atomic claim, `accepted` state, ownership check | P0 |
| Travel to store | Live location plus pickup address and bay | `/locations/track` is a stub; no `bay` field | `MODIFY` + `DATA GAP` | Implement tracking; add the dispatch bay/rack | P1 |
| Bag verify and collect | Item manifest plus bag code | `GET /shared-orders/:id` returns `{ orderId }` | `MODIFY` | Return items, bag code and bay | P0 |
| Confirm pickup | `status: 'picked_up'` | Not a valid `Order.status` value | `MODIFY` | Extend the enum or add a rider-stage field | P0 |
| Navigate to customer | Drop address, distance, ETA, call/chat | Address exists on `Order`; distance, ETA and masked calling do not | `MODIFY` + `NEW API` | Add ETA; add a call-masking endpoint if the Call button is to work | P2 |
| Cancel order | 6 reasons plus a note; order returns to the hub | `status: 'cancelled'` echoed; `cancellationReason` is a free string | `MODIFY` + `BACKEND LOGIC` | Enumerate reasons, persist, re-queue the order, apply the rating impact the UI warns about | P1 |
| Proof-of-delivery photo | Capture and upload an image | `photo: boolean` only; no picker upload route | `NEW API` + `DATA GAP` | `POST /shared-orders/:id/proof-photo` (multipart) | P0 |
| Delivery OTP | Verify a 4-digit customer OTP and show an error on mismatch | `completeSharedOrder` returns success unconditionally | `BACKEND LOGIC` | Port the real logic from `order.controller.verifyOtp` with rider ownership | P0 |
| Delivery complete summary | Payout, trip time, distance, today's trip count | None of these are returned | `MODIFY` | Return a completion summary | P1 |
| Bulk — batch overview | Batch id, vehicle, totals, distance, estimated time | Endpoint absent (404) | `NEW API` + `DATA GAP` | `GET /picker/bulk/batch` plus the batch model | P0 |
| Bulk — load bags | Per-bag load state plus an "all loaded" gate | Absent | `NEW API` + `DATA GAP` | `POST /picker/bulk/bag/load` plus the bag model | P0 |
| Bulk — start delivery | Dispatch the batch | Absent | `NEW API` | `POST /picker/bulk/start` | P0 |
| Bulk — active stop and phase | `toNav → navigating → arrived` | Client-only state | `NEW API` | `POST /picker/bulk/stops/:id/arrive` | P1 |
| Bulk — deliver stop | Mark delivered with POD | Absent | `NEW API` | `POST /picker/bulk/stops/:id/deliver` | P0 |
| Bulk — fail stop | 4 exception reasons plus a note | Absent | `NEW API` | `POST /picker/bulk/stops/:id/fail` | P0 |
| Bulk — all-stops list | Search plus filter (`all / current / pending / delivered / failed`) | Absent; no server-side search or filter exists for riders | `NEW API` | Include stops in the batch payload; client-side filtering is acceptable at 10 stops | P1 |
| Bulk — batch complete summary | Orders / delivered / failed / distance / duration / earnings | Absent | `NEW API` | Return on the final delivery, or `GET /bulk/batches/:id` | P1 |
| Shifts — available slots | `{ id, time, label, pay, booked }` | `GET /picker/shifts/available` returns raw shift docs | `MODIFY` | Map fields; add per-rider `booked`, remaining capacity and a date window | P1 |
| Shifts — book | Create an assignment | `POST /picker/shifts/select` | `MODIFY` | Add capacity, duplicate and overlap guards; return the updated slot | P1 |
| Shifts — unbook | Toggle a booking off | No picker-facing endpoint | `NEW API` | `POST /picker/shifts/deselect` | P1 |
| Earnings — weekly hero | Week total, deliveries, average per order, online hours | Stub | `BACKEND LOGIC` | Implement the aggregation with a `period` parameter | P1 |
| Earnings — next payout | Amount, when, schedule ("Every Monday · UPI") | Nothing | `NEW API` + `DATA GAP` | Payout-schedule model plus an endpoint | P2 |
| Earnings — breakdown | Standard / Bulk / Incentives split | Stub | `BACKEND LOGIC` + `DATA GAP` | Requires per-order payout attribution and a bulk/standard tag | P1 |
| Earnings — daily breakdown | Per-day orders, hours and amount | `/wallet/history` stub | `BACKEND LOGIC` | Aggregate from attendance plus deliveries | P1 |
| History — standard deliveries | Time, address, order number, items, distance, payout | `/shared-orders/completed` stub | `BACKEND LOGIC` | Implement with pagination | P1 |
| History — bulk batches | Batch card plus detail | Absent | `NEW API` | `GET /picker/bulk/batches` | P1 |
| History — filter tabs | `all / standard / bulk` | No filter parameter | `MODIFY` | Add `?type=` | P2 |
| Float cash — balance | Cash in hand, ₹2,000 limit, shift deadline | Nothing anywhere in the service | `NEW API` + `DATA GAP` | `GET /picker/cash/summary` plus the ledger model | P0 |
| Float cash — transactions | COD collections and deposits | Nothing | `NEW API` + `DATA GAP` | `GET /picker/cash/transactions` | P0 |
| Deposit cash | Amount plus method (UPI/bank/card) returning a server `ref` | The frontend calls `POST /picker/wallet/deposit`; the route does not exist (404) | `NEW API` | `POST /picker/cash/deposits`; move `ref` generation server-side | P0 |
| Deposit validation | Amount > 0, ≤ cash in hand, ≤ limit | Client-side only (`reducer.CONFIRM_DEPOSIT`) | `BACKEND LOGIC` | Enforce server-side | P0 |
| Profile — identity | Name, email, avatar initial | `GET /picker/user/profile` | `OK` | Reuse | P1 |
| Profile — rating / trips / on-time | ★ 4.9, 1,284 trips, 98% | Not computed for pickers (`Rider.rating` is a different model) | `BACKEND LOGIC` + `DATA GAP` | Add rating and on-time aggregation | P2 |
| Profile — vehicle and mode | Vehicle label, registration number, standard/bulk | No fields | `DATA GAP` | See D6 | P1 |
| Documents & KYC screen | Per-document verification status | `GET /picker/documents` | `OK` | Reuse; map `pending / approved / rejected` to the badges | P1 |
| Support — call / email | Helpline number, support email | Hard-coded in `environment.ts`; `/picker/config` is a stub | `MODIFY` | Serve from remote config | P2 |
| Support — FAQ | `{ q, a }` list | `/picker/faq` stub; a real FAQ module exists at `/customer/faq` | `MODIFY` | Proxy or re-expose | P2 |
| Support — live chat | Message thread with support | The frontend fakes a canned reply; `/rider/support-chat/*` is customer-auth-gated | `NEW API` | Picker-authenticated chat endpoints | P1 |
| Support — raise a ticket | Create a ticket | `/picker/support/tickets` stub | `BACKEND LOGIC` | Bridge to the real support module | P1 |
| Settings — toggles | Push / location / sound | No picker preferences store | `NEW API` + `DATA GAP` | `GET` / `PUT /picker/settings/preferences` | P2 |
| Settings — language | 5 languages (en, hi, kn, ta, te) | Nothing; no i18n on either side | `NEW API` | Persist the preference; app-side i18n is a separate workstream | P3 |
| Settings — push notifications | Register a device token | `POST /picker/push-token` stub | `BACKEND LOGIC` | Implement token storage plus FCM/APNs delivery | P1 |
| Settings — app version | Display plus a force-update check | Hard-coded `v1.0.0` | `MODIFY` | Serve from `/picker/config` with a minimum-supported-version gate | P2 |
| Privacy Policy / Terms | Sectioned document plus a date | `/picker/legal/*` stubs; real content at `/customer/legal/*` | `MODIFY` | Proxy the legal service; agree on the section shape | P2 |
| Logout | Clear the session | Client-side only; `sessionToken` stays valid server-side | `NEW API` | `POST /picker/auth/logout` | P1 |
| Account deletion | — (not present in the UI) | `POST /picker/account/delete-request` exists as a stub | — | Out of scope for this frontend | P3 |

---

## Final Backend Implementation Checklist

### Phase 0 — Security (do first; independent of the frontend)

- [ ] Separate the picker JWT secret from `JWT_SECRET`, **or** add an `aud`/`role` claim and reject picker tokens in `authenticateAdmin`. *(A1)*
- [ ] Add authentication to the rider-facing `/api/v1/rider/shifts/*` routes and derive `riderId` from the token, never from the body or query. *(A2)*
- [ ] Verify `OTP_DEV_MODE` is off in every deployed environment and remove `TEST_PHONES` from production builds. *(A8)*
- [ ] Add per-identifier rate limiting on OTP send and verify; stop `send-otp` from resetting the attempt counter. *(A9)*

### Phase 1 — P0: make the standard delivery flow real

- [ ] Define the rider↔order relation: index `Order.riderId`, choose a single rider identity space (`PickerUser._id` vs `Rider.id`), and backfill. *(D11, L3)*
- [ ] Add rider-facing order stages (`accepted`, `picked_up`) — extend the enum or add a `riderStage` field alongside `Order.status`. *(L1)*
- [ ] Implement `GET /picker/shared-orders/assignorders` with availability filtering, pagination and the frontend `Order` shape. *(M6)*
- [ ] Implement `GET /picker/shared-orders/:orderId` with the item manifest, bag code, bay and an ownership check. *(M7)*
- [ ] Implement `PUT /picker/shared-orders/:orderId/status` as a guarded state machine with an atomic accept claim, ownership check, timeline writes and idempotency. *(M8, L1, L3, L4)*
- [ ] Implement `POST /picker/shared-orders/:orderId/complete` with real OTP verification, a 5-attempt cap, `deliveredAt`, and the COD `paymentStatus` transition — port from `order.controller.verifyOtp`. *(M9, L2)*
- [ ] Add `POST /picker/shared-orders/:orderId/proof-photo` (multipart, image-only, size-capped) and require the resulting `photoId` on `/complete`. *(N16, D5)*
- [ ] Compute and persist a per-order rider payout at assignment time. *(L5, D5)*

### Phase 2 — P0: the bulk delivery vertical

- [ ] Create the bulk batch + stop model *(D1)* and the bag model *(D2)*.
- [ ] Build the rider-facing batch producer on top of `Cluster` / `dispatch.service.groupOrders`, with a stable stop sequence and a server-issued `stopId`. *(L15)*
- [ ] `GET /picker/bulk/batch` — the current batch with ordered stops. *(N1)*
- [ ] `POST /picker/bulk/bag/load` plus the all-loaded gate. *(N2, L16)*
- [ ] `POST /picker/bulk/start` — `loading → dispatched`. *(N3)*
- [ ] `POST /picker/bulk/stops/:stopId/arrive | deliver | fail` with reason enums and POD. *(N4, N5, N8, N17)*
- [ ] Batch completion summary plus `GET /picker/bulk/batches` and `/:batchId` for history. *(N6, N7)*

### Phase 3 — P0: floating cash / COD

- [ ] Create the cash ledger model and the deposit record with a server-issued unique `ref`. *(D3, D4)*
- [ ] Credit `cod_collected` to the rider's ledger automatically on COD delivery completion. *(L8)*
- [ ] `GET /picker/cash/summary`, `GET /picker/cash/transactions`, `POST /picker/cash/deposits`. *(N9–N11)*
- [ ] Enforce the deposit limit, the "≤ cash in hand" rule and the end-of-shift deadline server-side. *(L9)*
- [ ] Reconcile deposits against orders in `paymentStatus: 'cod_pending'`. *(L8)*

### Phase 4 — P0/P1: onboarding

- [ ] Add `vehicleType`, `vehicleRegistrationNumber` and `deliveryMode` to `PickerUser` and to the update whitelist. *(D6)*
- [ ] Add the onboarding application record: step map, `submittedAt`, server-issued application id. *(D7)*
- [ ] Implement `GET /picker/onboarding/state` with real step completion, status and rejection reasons. *(M14, L13, L14)*
- [ ] `POST /picker/onboarding/submit` — validate all steps and transition to review. *(N14)*
- [ ] Add picker-facing multipart document upload with an enumerated `type` and front/back sides. *(M15)*
- [ ] Add hub geo-sorting: a `2dsphere` index on `PickerWorkLocation.coordinates` and a real `/stores/nearby`. *(M16, L18)*
- [ ] `POST /picker/onboarding/kit-ack`. *(N15, D8)*
- [ ] Return `status`, `onboardingCompleted` and `rejectedReason` from both verify-OTP endpoints. *(M1)*

### Phase 5 — P1: shifts, presence, dashboard, earnings

- [ ] Reshape `GET /picker/shifts/available`: display fields, per-rider `booked`, remaining capacity, date window. *(M2, L11)*
- [ ] Add capacity, duplicate and overlap guards to `selectShift`; return the updated slot. *(M3, L10)*
- [ ] `POST /picker/shifts/deselect`. *(M4)*
- [ ] Accept `{ shiftId }` in the body on `/shifts/start` and `/shifts/end`; add an `isOnline` presence flag and wire heartbeat/presence. *(M5, L12)*
- [ ] `GET /picker/dashboard/today` — the four Home tiles. *(N12)*
- [ ] Implement earnings aggregation: weekly summary, daily rollup, standard/bulk/incentive split. *(M11, M12, L6)*
- [ ] Implement `GET /picker/shared-orders/completed` with pagination and a `type` filter. *(M10)*
- [ ] Consolidate `/wallet/balance` onto the real `getWallet`. *(M13)*
- [ ] Persist location tracking and add a breadcrumb collection with a TTL. *(M17, D10, L17)*
- [ ] Implement push-token registration and delivery. *(M18)*

### Phase 6 — P1/P2: support, settings, config, legal

- [ ] Add picker-authenticated support chat endpoints, or re-gate `/rider/support-chat/*` for picker tokens. *(N21, A4)*
- [ ] Bridge `/picker/support/tickets` to the real support module. *(M22)*
- [ ] Proxy `/picker/faq` to the FAQ module and `/picker/legal/*` to the legal module; agree the section shape. *(M20, M21)*
- [ ] Implement `GET /picker/config`: OTP length, deposit limit, support phone/email, minimum app version. *(M19)*
- [ ] `GET` / `PUT /picker/settings/preferences`. *(N20)*
- [ ] `GET /picker/config/cancel-reasons` for both reason lists. *(N22)*
- [ ] `POST /picker/auth/logout` (invalidate `sessionToken`) and `POST /picker/auth/refresh`. *(N18, N19)*
- [ ] Implement real email OTP delivery. *(A10)*

### Phase 7 — P2/P3: polish

- [ ] Rider rating and on-time-percentage aggregation for `PickerUser`. *(L19, M23)*
- [ ] Incentive engine: targets, progress, on-time/late attribution. *(L7, N13)*
- [ ] Payout-schedule model plus a next-payout endpoint.
- [ ] Normalise enum casing across picker models (`PickerUser.status` vs `PickerDocument.status`).
- [ ] Remove the duplicated `PickerUser.selectedShifts[]` in favour of `PickerShiftAssignment`.
- [ ] Honour `Idempotency-Key` on order accept/complete and cash deposit. *(A12)*

### Cross-cutting, non-backend (recorded here so nothing is lost)

- [ ] Point `environment.apiBaseUrl` at the real host — the frontend targets port `3000` while the service defaults to `3333`.
- [ ] Replace the in-memory token store with persistent storage; add 401 handling and a logout redirect. *(A5, A6)*
- [ ] Replace `src/mock/*` reads with the API clients — only `PhotoScreen` calls the API today.
- [ ] Add loading, empty and error states to every list screen (only `PhotoScreen` has an `ActivityIndicator`).
- [ ] Reconcile the three conflicting earnings shapes (`riderApi.EarningsSummary`, `WEEK_EARNINGS`, backend) before implementation begins.
