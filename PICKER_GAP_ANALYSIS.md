# Frontend ↔ Backend Gap Analysis

**New frontend:** `Selorg PickerApp V1.3` (React Native, workforce app for pickers)
**Existing backend:** `selorg-service` (Express + Mongoose), picker module mounted at `/api/v1/picker`
**Analysis date:** 2026-09-04
**Frontend base URL:** `src/constants/config.ts` → `http://localhost:3333/api/v1/picker`

> Scope note: this document covers only the picker workforce app. It does not cover the HHD scanning app, the customer app, or the admin console, except where those modules are candidates for reuse.

---

## Executive Summary

The frontend was written against the existing picker route table, so **URL paths and the HTTP envelope line up almost perfectly**. The problem is one layer deeper.

Three findings dominate everything else:

**1. The picker module is mostly a route skeleton.**
`picker.routes.ts` declares 89 picker-facing routes. Only **22** are backed by real logic in `picker.service.ts`. The remaining **67 are stub handlers** in `picker.controller.ts` that return a hardcoded literal — `{ verified: true }`, `{ sent: true }`, `{ faqs: [] }`, `{ userId, summary: {} }` — and touch no database. Every one of those returns HTTP 200, so the frontend cannot even detect that the call did nothing. Endpoints such as `POST /manager/verify-otp` (`{ verified: true }` for any OTP) and `POST /bank/verify` (`{ verified: true }` for any account) are stubs that actively assert a false success.

**2. The frontend expects display-ready view models; the backend returns raw domain documents.**
Every data screen uses the pattern `const x = apiData ?? mockShape`. The mock shapes are pre-formatted for rendering — `'₹18,450'`, `'March 2026'`, `'9h 02m'`, `tone: 'success'`, `icon: 'wallet'`, plus literal hex colours. The backend returns normalized Mongo documents with entirely different field names (`_id`, `amount`, `createdAt`, `accountHolderName`). Because the fallback only fires on `null`, a successful-but-differently-shaped response **replaces** the mock and the screen renders blanks — or crashes.

**3. Seven screens crash on a successful API response.**
Where the frontend expects an array and the backend returns a paginated wrapper object, `.map()` is called on an object. This is a hard `TypeError`, not a blank state:

| Screen | Call | Backend returns | Frontend does |
|---|---|---|---|
| Payouts | `GET /wallet/transactions` | `{ transactions, total, page, … }` | `payouts.map(…)` |
| Notifications | `GET /notifications` | `{ notifications, total, unread, … }` | `items.map(…)` |
| Work History | `GET /attendance` | `{ records, total, page, … }` | `wh.summary.present`, `wh.rows.map(…)` |
| Attendance | `GET /attendance/summary` | `{ userId, present: 0, absent: 0, late: 0 }` | `a.detailsRows.map(…)` |
| Performance | `GET /performance/summary` | `{ userId, summary: {} }` | `p.cards.map(…)` |
| Device Status | `GET /devices/assigned` | `{ userId, device: null }` | `deviceRows.map(…)` |
| FAQs | `GET /faq` | `{ faqs: [] }` | `faqs.map(…)` |

**The single hardest blocker:** `GET /onboarding/state` returns the literal string `'pending'`. The frontend (`useAuth.verifyOtp`) routes to the main app only when the value is exactly `'ACTIVE'`. Every user — including fully approved ones — is therefore sent back into the onboarding wizard on every login. **No user can ever reach the main app.**

Two further structural gaps sit behind the API surface:

- **`PickerUser` cannot store most of what the frontend collects.** Date of birth, address, city, pincode, alternate phone, emergency contact (name/phone/relation), Aadhaar number, PAN number, and bank fields as the frontend names them have no schema home. `updateProfile` silently drops unknown keys through an allow-list, so the Personal Information screen appears to save and persists nothing.
- **There is no file upload anywhere in the picker module.** `POST /documents/upload` requires a pre-existing `url`. The frontend has no storage service and no upload endpoint to call, so KYC documents, the face-verification selfie, and device condition photos have no path to the server.

Security items requiring attention before production: `getProfile` returns the raw `PickerUser` document including `sessionToken` and `locationOtp`; the OTP is returned in the API response whenever `NODE_ENV !== 'production'`; and no route checks that a picker is `ACTIVE` — a `PENDING` applicant can punch in and request withdrawals.

**Counts.** Of 34 distinct frontend↔backend interactions: **3 OK**, **26 MODIFY**, **5 NEW API**. Backend logic gaps: **14**. Database/model gaps: **11**.

---

## Existing APIs That Can Be Reused

These are backed by real service code and need no contract change for the frontend to work.

| Endpoint | Method | Backing | Frontend caller | Verdict |
|---|---|---|---|---|
| `/auth/send-otp` | POST | `picker.auth.service.sendOtp` | `authApi.sendOtp` (mobile/whatsapp) | **OK** |
| `/auth/resend-otp` | POST | `picker.auth.service.resendOtp` | `authApi.resendOtp` | **OK** |
| `/auth/verify-otp` | POST | `picker.auth.service.verifyOtp` | `authApi.verifyOtp` | **OK** |
| `/auth/send-otp-email` | POST | `sendOtpEmail` | `authApi.sendOtp` (email) | **OK** |
| `/auth/resend-otp-email` | POST | `resendOtpEmail` | `authApi.resendOtp` (email) | **OK** |
| `/auth/verify-otp-email` | POST | `verifyOtpEmail` | `authApi.verifyOtp` (email) | **OK** |

**Why these are compatible.** The frontend reads `res.token` from the unwrapped envelope; `verifyOtp` returns `{ success, message, token, isNewUser, user }` inside `data`. Phone normalization (`+91`, leading `0`, 12-digit) is handled server-side. OTP length is 4 digits on both sides (`config.otpLength = 4`, backend `/^\d{4}$/`). The 5-attempt lockout and 5-minute TTL are implemented.

**Caveats that do not break the contract but must be fixed before production:**

- `sendOtp` returns the OTP in the response body whenever `OTP_DEV_MODE` is on, and `OTP_DEV_MODE` defaults to `process.env.NODE_ENV !== 'production'`. Verify the production env sets `NODE_ENV=production` **and** `OTP_DEV_MODE=false`.
- Email OTP is never actually sent — `sendOtpEmail` stores the OTP and returns success with no mail transport call. Email login works only in dev mode where the OTP is echoed back.
- A hardcoded test phone bypass exists: `TEST_PHONES = { '9698790921': '8790' }`. Remove or gate it.
- `verifyOtp` returns `isNewUser`; the frontend's TypeScript declares `onboardingComplete`, which the backend does not send. Harmless today (the field is unused — the app calls `/onboarding/state` separately), but the declared type is wrong.

**Partially reusable — real logic, wrong shape.** These have working service methods and correct persistence; only the response projection is wrong. They are listed under *APIs That Need Modification* rather than here: `GET /user/profile`, `GET /work-locations`, `GET /shifts/available`, `GET /training/videos`, `GET /documents`, `GET /notifications`, `GET /attendance`, `GET /wallet`, `GET /wallet/transactions`, `POST /wallet/withdraw`, `GET /bank/accounts`, `GET /performance`, `POST /attendance/punch-in`, `POST /attendance/punch-out`, `POST /shifts/break/start`, `POST /shifts/break/end`.

**Reuse opportunities from other backend modules** (do not build these from scratch):

- **FAQ** — `src/modules/faq/` is fully implemented (model, repository, service, controller) with `{ question, answer, order, category, isActive }` and category filtering. The picker's `GET /faq` stub should delegate to `faq.service` with `category: 'picker'` and map `question → q`, `answer → a`.
- **Support tickets** — `src/modules/support/` has a complete `SupportTicket` model with notes, attachments, status and priority. Picker tickets should reuse it with a picker-scoped requester rather than a new collection.
- **Support chat** — `src/modules/support-chat/` already exposes a `riderRouter`. The picker chat screen should reuse this module rather than the current design of posting each chat message as a new ticket.
- **SMS** — `src/services/sms.service.ts` (`sendOtpSms`) is available for the manager-OTP flow, which currently sends nothing.

---

## APIs That Need Modification

Grouped by domain. "Current" = what the backend returns today; "Required" = what the frontend consumes.

### Auth & Session

**`GET /onboarding/state` — P0, blocking**
- Current: stub — `{ userId, state: 'pending', steps: [] }`. Never reads `PickerUser.status`.
- Required: `{ state: 'ONBOARDING' | 'ACTIVE' | 'REJECTED' | 'BLOCKED' | 'SUSPENDED' }`.
- Mismatch: lowercase `'pending'` is not in the frontend union. `useAuth.verifyOtp` compares `obState === 'ACTIVE'` and otherwise resets to the onboarding stack. Result: **no user ever reaches the main app**.
- Change: read `PickerUser.status` and map it. Also add the derived `ONBOARDING` state (approved-but-incomplete profile) and the `BLOCKED` state, neither of which exists in the schema enum.

### Profile

**`GET /user/profile` — P0**
- Current: `PickerUser.findById(userId).lean()` — returns the **entire document**, including `sessionToken`, `locationOtp`, and `locationOtpForLocationId`.
- Required: `{ id, name, phone, email, status, memberSince, hub, role }`.
- Mismatch: `_id` vs `id`; `memberSince`, `hub`, `role` are not returned and `role` has no schema field; secrets are leaked.
- Change: add an explicit projection. Derive `memberSince` from `createdAt`, `hub` from `currentLocationId` joined to `PickerWorkLocation.name`, and `role` from `employment.role` with a `'Picker'` default.

**`PUT /user/profile` — P0**
- Current: allow-list `['name','email','age','gender','photoUri','locationType','upiId','upiName','gpsLocation']`. Unknown keys are silently dropped; the response is still 200.
- Required (Edit Profile): `{ name, dob, email }`. Required (Personal Info): `{ altPhone, address, city, pincode, emgName, emgPhone, emgRel }`. Required (Onboarding step 1): `{ name, dob, gender }`.
- Mismatch: **`dob` and all seven Personal Info fields are dropped.** The screen shows "Changes saved" and nothing persists. `gender` is `'Male' | 'Female' | 'Other'` on the frontend but `enum: ['male','female']` in the schema — `'Other'` is rejected and the casing does not match.
- Change: extend the schema (see *Database / Model Gaps*), extend the allow-list, normalize gender casing, and **return 400 on unknown keys** instead of dropping them silently.

**`GET /user/profile/overview` — P2**
- Current: stub — `{ userId, overview: {} }`.
- Required: `profileApi.getOverview()` is typed as returning the full `Picker` object.
- Change: either implement it as a superset of `/user/profile` or remove the frontend method. Not called from any screen today.

**`PUT /user/upi` — P2**
- Current: stub — echoes `{ upi: req.body.upi }`, no write. `PickerUser.upiId` / `upiName` / `upiPayoutVerificationStatus` exist but are never set here.
- Change: persist to `upiId`, set `upiPayoutVerificationStatus = 'pending'`.

### Onboarding

**`GET /work-locations` — P1**
- Current: real. `PickerWorkLocation` documents — `{ _id, warehouseKey, name, address, type, isActive, coordinates, geofenceRadius }`.
- Required: `WorkLocation[]` = `{ id, title, sub }`, where `sub` is `"2.1 km · 80 Ft Rd, HAL 2nd Stage"`.
- Mismatch: no `id`/`title`/`sub`. `RadioCard key={l.id}` receives `undefined` for every row and `ob.setLocation(undefined)` breaks selection, so the user cannot pass onboarding step 3.
- Change: project `id`, `title` (from `name`), `sub`. `sub` requires a distance calculation — accept `lat`/`lng` query params and compute against `coordinates`, or drop distance from `sub`.

**`GET /shifts/available` — P1**
- Current: real. `PickerShift` documents — `{ _id, name, startTime, endTime, time, duration, capacity, basePay, … }`.
- Required: `ShiftOption[]` = `{ id, title, sub }`, e.g. `title: 'Morning · 9:00 AM – 6:00 PM'`, `sub: '18 slots open'`.
- Mismatch: same `id`/`title`/`sub` problem; onboarding step 4 selection is broken.
- Change: project the three fields. `sub` ("N slots open") requires `capacity` minus the count of `PickerShiftAssignment` for that shift and date — that aggregation does not exist. The frontend also never sends `warehouseKey`, so **all shifts at every site are returned**; the endpoint should scope to the picker's selected location.

**`GET /training/videos` — P1**
- Current: real. `PickerTrainingVideo` — `{ videoId, title, description, url, thumbnailUrl, durationSeconds, order, isActive }`.
- Required: `TrainingModule[]` = `{ name, dur }` with `dur` as `'12 min'`.
- Mismatch: `title` vs `name`; `durationSeconds` (number) vs `dur` (formatted string). Rows render blank.
- Change: project `name` and a formatted `dur`. Also return `videoId` and `url` — the frontend keys modules by array index, which is fragile, and the video modal has no URL to play.

**`POST /documents/upload` — P0**
- Current: real persistence, but requires `{ type, url }` and returns 400 without them.
- Required: onboarding step 6 sends `{ aadhaar: '<number>', pan: '<number>' }` — no `type`, no `url`.
- Mismatch: **every KYC submission returns 400.** The backend models a document as a stored file reference; the frontend collects identity *numbers*. These are different concepts.
- Change: decide the model. Either (a) add an upload endpoint plus a document-number field so the frontend sends `{ type: 'aadhaar', number, url }`, or (b) add a separate KYC-number endpoint. Note the frontend has no file picker or storage service today, so (a) also needs frontend work.

**`POST /verify/face` — P0**
- Current: stub — `{ verified: false }`. No write. `PickerUser.faceVerificationStatus` exists but is never set.
- Required: onboarding step 7 calls `submitForReview()` with `{}` and expects the application to move to review. `StatusGateScreen` then polls for approval.
- Mismatch: nothing is submitted, nothing is reviewed, and the returned `verified: false` is ignored by the frontend.
- Change: accept a face image reference, set `faceVerificationStatus = 'pending'`, and transition the user into the review queue so the admin approval route has something to act on.

**`POST /manager/request-otp` — P0, security**
- Current: stub — `{ sent: true }`. No OTP is generated, stored, or sent.
- Required: send a 4-digit OTP to the hub manager for device handover.
- Change: generate, store (`PickerUser.locationOtp` exists for this), and dispatch via `sms.service`.

**`POST /manager/verify-otp` — P0, security**
- Current: stub — `{ verified: true }` for **any** input, including an empty body.
- Required: verify the manager OTP before assigning the device.
- Mismatch: the device-handover control is a no-op that always succeeds. Anyone can claim a device.
- Change: compare against the stored OTP with expiry and attempt limits.

**`POST /devices/collection-complete` — P1**
- Current: stub — `{ acknowledged: true }`. No device assignment, no write.
- Required: mark `HHD-xxxx` assigned to the picker.
- Change: set `PickerDevice.assignedTo` and `status = 'assigned'`, set `PickerUser.activeDeviceId`. Note the frontend method `onboardingApi.confirmDeviceCollection` **does not exist** (see *Frontend defects*).

**`POST /dark-store-login`, `POST /locations/set-darkstore-from-current` — P2**
- Both stubs (`{ registered: true }`, `{ set: true }`). Neither writes `currentLocationId`. The picker's hub is therefore never recorded, which is why `hub` cannot be returned on the profile.

### Shift & Attendance

**`GET /shifts/readiness` — P0**
- Current: stub — `{ userId, ready: false, checks: [] }`.
- Required: `{ ready: boolean, accuracyM: number, onSite: boolean }`.
- Mismatch: field names differ entirely; `accuracyM` and `onSite` are undefined. The frontend ignores the result and proceeds regardless, so **the geofence gate does not exist**.
- Change: implement a real check against `PickerWorkLocation.coordinates` and `geofenceRadius` (frontend expects a 150 m default from `config.geofenceMeters`), and have the frontend block on `ready === false`.

**`POST /shifts/start` and `POST /shifts/end` — P0**
- Current: routed to the same handler as `/shifts/:shiftId/start`, which reads `req.params.shiftId`. On the no-param route that is `undefined`, and `new mongoose.Types.ObjectId(undefined)` **generates a fresh random id**, so `findOne` never matches.
- Required: `shiftApi.start()` and `shiftApi.end()` are called with no argument from `useShift`.
- Mismatch: **every shift start and end returns 404 "Shift assignment not found".** This is the exact call the Home screen's "START MY SHIFT" button makes.
- Change: when `shiftId` is absent, resolve the picker's current assignment for today. Additionally, `startShift` does not create a `PickerAttendance` record — see *Backend Logic Gaps*.

**`POST /attendance/punch-in` / `punch-out` — P1**
- Current: reads `req.body.location` as an object.
- Required: the frontend sends `{ latitude, longitude }` flat.
- Mismatch: `location` is always `undefined`, so `locationIn` / `locationOut` are never stored and geofencing has no data.
- Change: accept the flat shape (or both).

**`GET /attendance/summary` — P0**
- Current: stub — `{ userId, present: 0, absent: 0, late: 0 }`.
- Required: `{ present: { window, punchedInOnTime, hoursToday, pct }, detailsRows: KeyValue[], ot: { totalHrs, rate, totalEarnings, weeks[] }, history: { month, dow[], cells[], presentDays, halfDays }, stats: { presentDays, halfDays, otHours } }`.
- Mismatch: `present` is a number where an object is expected, and `detailsRows` is absent — **`a.detailsRows.map()` throws.** The Attendance screen is the app's second tab.
- Change: build the full aggregate. Note `ot.rate` (`'1.5x'`) and `ot.totalEarnings` require an overtime pay rule that does not exist anywhere in the backend.

**`GET /attendance/stats` — P2**
- Current: stub — `{ userId, stats: {} }`. Required: `{ presentDays, halfDays, otHours }`. Not called from any screen today.

**`GET /attendance` (Work History) — P0**
- Current: real, returns `{ records, total, page, limit, totalPages }` where `records` are raw `PickerAttendance` documents.
- Required: `{ month: 'March 2026', summary: { present, overtime, total }, rows: WorkDay[] }` where `WorkDay = { date: 'Wed, 11 Mar', hub, hrs: '9h 02m', badge: 'Present', tone: 'success' }`.
- Mismatch: **`wh.summary.present` throws** (`summary` is undefined). The `month` query parameter the frontend sends is **ignored** — the controller only reads `page` and `limit`.
- Change: this endpoint serves two different callers (`attendanceApi.getAttendance` and `profileApi.getWorkHistory`) with two different expected shapes. Split it, or add a `view=history` parameter. Implement month filtering, the monthly summary, and `badge`/`tone` derivation.

### Wallet & Payouts

**`GET /wallet/balance` — P0**
- Current: stub — `{ userId, balance: 0, currency: 'INR' }`.
- Required: `{ month, netPayout: '₹18,450', payDate, available: '₹4,850', availableAmount: 4850, bankLabel: 'HDFC ••7821', bankVerified, upiVerified }`.
- Mismatch: only `currency` overlaps. The Payouts screen renders `undefined` for every figure.
- Change: build from `PickerWallet` + `PickerBankAccount`. `netPayout` and `payDate` require a monthly payout cycle that does not exist in the backend.

**`GET /wallet/transactions` — P0**
- Current: real — `{ transactions, total, page, limit, totalPages }`.
- Required: `Payout[]` = `{ month, date, mode, amt }`.
- Mismatch: **object vs array — `payouts.map()` throws.** Field names differ completely (`amount` vs `amt`, `createdAt` vs `date`, no `mode`, no `month`).
- Change: return the array at the top level (pagination belongs in the envelope's `pagination` field, which `ResponseFormatter.paginated` already provides) and project the payout view model.

**`POST /wallet/withdraw` — P1**
- Current: real. Reads only `amount`. Returns the `PickerWithdrawalRequest` document.
- Required: the frontend sends `{ amount, accountId }` and expects `{ id, status }`.
- Mismatch: `accountId` is **ignored** — the withdrawal is not tied to a bank account. `_id` vs `id`. The frontend generates an `idempotencyKey` in `useWallet` but `walletApi.withdraw` **never puts it in the body**, and the backend has no idempotency handling — a double tap creates two withdrawals.
- Change: accept and validate `accountId`, accept `idempotencyKey`, return `id`. Enforce the ₹100 minimum server-side (`config.minWithdrawal`); the backend currently accepts any amount above 0.

**`GET /wallet/earnings-breakdown`, `/wallet/history`, `/wallet/transactions/:id` — P3**
All stubs. Defined in `walletApi` but not called from any screen.

### Notifications

**`GET /notifications` — P0**
- Current: real — `{ notifications, total, unread, page, limit, totalPages }`; items are `{ _id, type, title, body, data, read, createdAt }`.
- Required: `AppNotification[]` = `{ id, icon, color, bg, title, body, time }`.
- Mismatch: **object vs array — `items.map()` throws.** `title` and `body` match; `id`, `icon`, `color`, `bg`, `time` do not exist.
- Change: return the array at the top level and derive `icon`/`color`/`bg` from `type`, and `time` as a relative string from `createdAt`. Presentation values in the API is a questionable design — the cleaner fix is to return `type` and `createdAt` and let the frontend map them, which requires a frontend change too.

**`PUT /notifications/read-all` — P2**
- Current: stub — returns a message, writes nothing. Change: `updateMany({ userId, read: false }, { read: true })`.

**`POST /push-token` — P2**
- Current: stub — `{ registered: true }`. No model exists to store a token. Push notifications cannot work.

### Documents & Devices

**`GET /documents` — P1**
- Current: real, returns an array of `PickerDocument` — `{ _id, type, url, fileName, status, … }`.
- Required: `DocItem[]` = `{ id, name, num, verified, pending }`.
- Mismatch: it is an array, so `.map()` survives, but every field is wrong — the screen renders three blank rows. `num` (`'•••• •••• 1234'`) requires a masked document number that is not stored.
- Change: project the view model; map `status: 'approved' → verified: true`, `'pending' → pending: true`. Requires a document-number field.

**`GET /devices/assigned` — P0**
- Current: stub — `{ userId, device: null }`.
- Required: `KeyValue[]` — the screen does `deviceRows.map(r => …)`.
- Mismatch: **object vs array — throws.** The screen additionally renders `mockDevice.id`, `.model`, `.battery`, `.lastSynced` from the hardcoded mock; those are never fetched.
- Change: return the device rows array plus a device header object. `battery` lives on `PickerUser.batteryLevel`, and **`lastSynced` has no field anywhere**.

**`POST /issues` — P1**
- Current: stub — echoes the body with `{ reported: true }`. No model, no persistence, no support routing.
- Required: the Device Issue sheet submits `{ reason }` (or `{ type, description }` via `supportApi.reportIssue`).
- Change: persist and route to support. Note the frontend method `profileApi.reportDeviceIssue` **does not exist** (see *Frontend defects*).

**`POST /devices/return`, `/devices/upload-condition-photo` — P3** — stubs; not called by the frontend.

### Training

**`PUT /training/watch-progress` — P1**
- Current: stub — `{ tracked: true, ...body }`. **The real implementation exists** as `pickerService.updateTrainingProgress`, but it is wired to `PUT /training/progress`, which the frontend does not call.
- Change: point `/training/watch-progress` at the real handler (a one-line route fix).

**`POST /training/complete/:videoId` — P1**
- Current: stub — `{ completed: true }`, no write.
- Required: onboarding step 5 gates progression on all modules being complete.
- Mismatch: completion is held only in frontend state (`ob.trainDone`, `state.support.profTrainDone`) and is never persisted. **A reinstall loses all training progress, and the gate can be bypassed.**
- Change: set `trainingProgress[videoId] = 100` via the existing service method.

**`GET /training/user-progress` — P2**
- Current: stub — `{ userId, progress: [] }`. Required: `{ completed: string[], total: number }`. Not read by any screen today, which is why local state is authoritative.

**`POST /training/assessment` — P3** — stub; `{ passed: false, score: 0 }`. Not called from any screen.

### Support

**`GET /faq` — P0**
- Current: stub — `{ faqs: [] }`.
- Required: `Faq[]` = `{ q, a }`.
- Mismatch: **object vs array — `faqs.map()` throws.**
- Change: delegate to the existing `faq.service` filtered to a picker category and map `question → q`, `answer → a`. Do not build a new FAQ store.

**`POST /support/tickets` — P1**
- Current: stub — echoes `{ ticket: req.body }`. Nothing is persisted.
- Required: `{ subject, description, category }` → `{ ok, id }`.
- Mismatch: no persistence, and no `id` is returned.
- Change: reuse the existing `support` module's `SupportTicket` model with a picker requester.

**`GET /support/tickets` — P2** — stub; `{ tickets: [], total: 0 }`. `supportApi.listTickets` is defined but unused.

**Chat support — P1, design mismatch.** `supportApi.sendMessage` posts **every chat message as a new support ticket**. The agent reply is a hardcoded `setTimeout` in `useSupport`. There is no messaging API. The `support-chat` module (which has a `riderRouter`) should be extended to pickers.

### Bank

**`POST /bank/accounts` — P0**
- Current: real, but `PickerBankAccount.create({ userId, ...data })` with a schema requiring `accountHolderName`, `accountNumber`, `ifscCode`.
- Required: three different frontend callers send three different shapes:
  - `profileApi.save('bank', …)` → `{ holder, bank, acc, ifsc }`
  - `bankApi.addAccount` / `onboardingApi.addBankAccount` → `{ accountNumber, ifsc, holderName }`
  - `onboardingApi.complete()` → `{}`
- Mismatch: **none of the three satisfies the schema.** Every call fails Mongoose validation and surfaces as a 500. `onboardingApi.complete()` sending `{}` is the **final action of onboarding** — onboarding cannot be completed.
- Change: settle on one contract (`{ accountHolderName, accountNumber, ifscCode, bankName? }`), align all three frontend callers, and return a 422 validation error rather than a 500.

**`POST /bank/verify` — P1, security**
- Current: stub — `{ verified: true, ...body }` for any input.
- Required: `{ valid: boolean, holderName: string }`.
- Mismatch: field name (`verified` vs `valid`), no `holderName`, and the endpoint **asserts every account is valid**.
- Change: integrate a real penny-drop/IFSC verification, or return an explicit `unverified` state rather than a false positive.

**`PUT /bank/accounts/:id`, `/set-default`, `POST /:id/delete` — P2** — all stubs that echo their parameters and write nothing. `PickerBankAccount.isPrimary` exists but is never set. Not currently called by any screen.

### Account

**`POST /account/delete-request` — P2**
- Current: stub — `{ requested: true }`. `PickerUser.deletionRequestedAt` and `deletionReason` exist but are never written. The frontend's `DELETION_PENDING` status can therefore never be reached.

---

## New APIs Required

These have no suitable existing endpoint.

### 1. `GET /home/summary` — P0

The Home screen — the app's landing tab — is **100% hardcoded**. `HomeScreen.tsx` imports `mockHome` and renders it directly, and makes no API call at all. The greeting (`"Hi, Rahul"`), picker ID (`"ID 4821"`) and avatar initials (`"RV"`) are literals in JSX.

Data the screen displays with no source: hub name and address, GPS accuracy and on-site flag, today's shift window, available and pending balance, order count / pending / sync progress, today's earnings, today's incentives, and performance rank / accuracy / speed.

No existing endpoint aggregates this. Composing it client-side would require six round trips on app open, four of which are stubs. **A single aggregate endpoint is the right answer** — and the frontend must be changed to call it.

> Note: the order count, sync progress and incentives originate in the HHD scanning app, which is a separate system. Confirm the integration path before specifying those fields.

### 2. `POST /uploads` (or `/documents/upload-file`) — P0

There is **no file upload endpoint in the picker module** and no multer middleware. `POST /documents/upload` requires a `url` that must already exist. Blocked by this: KYC document images, the face-verification selfie, the profile photo (`PickerUser.photoUri`), and device condition photos (`/devices/upload-condition-photo` is a stub returning `{ url: null }`).

The frontend also has no storage service and no file picker, so this needs work on both sides.

### 3. `POST /auth/logout` — P1

`useAuth.logout` only removes the token from local storage. `PickerUser.sessionToken` is never cleared, so a leaked JWT stays valid for its full 7-day life. The middleware already validates `sid` against `sessionToken` — the endpoint just needs to null it.

### 4. `GET /profile/summary-menu` (or extend `/user/profile/overview`) — P2

`ProfileScreen` renders `profileMenu` from `src/mock/profile.ts` with hardcoded subtitles: `'HHD-2231 · Assigned'`, `'HDFC ••7821'`, `'4 of 4 modules complete'`, `'Aadhaar, PAN · verified'`. These are live values presented as static text. Either extend `/user/profile/overview` to return them or accept that the menu subtitles are decorative.

### 5. `GET /settings` / `PUT /settings` — P3

`useSettings` is entirely local React state: five notification toggles (`push`, `shiftRem`, `payout`, `incentive`, `sound`) and a language choice (English / हिंदी / বাংলা). Nothing is sent to the server and no model exists. **The frontend makes no call here**, so this is only required if preferences must survive a reinstall or drive server-side push filtering. Listed for completeness, not as a current frontend requirement.

---

## Backend Logic Gaps

API exists (or is trivially addable) but the required business logic is absent.

| # | Gap | Where | Impact | Priority |
|---|---|---|---|---|
| 1 | **Onboarding state machine.** No concept of an onboarding step, completion, or progression. `getOnboardingState` returns a constant. There is no record of which of the 8 wizard steps a picker has finished. | `picker.controller.getOnboardingState` | Users cannot reach the app; progress is lost on reinstall | **P0** |
| 2 | **Shift start/end with no `shiftId`.** `req.params.shiftId` is `undefined` on the no-param routes; `new ObjectId(undefined)` mints a random id, so the lookup always misses. | `picker.service.startShift` / `endShift` | Every "START MY SHIFT" tap returns 404 | **P0** |
| 3 | **Starting a shift does not punch in.** `startShift` only flips the assignment status. No `PickerAttendance` record is created. | `picker.service.startShift` | Attendance is never recorded via the normal flow; breaks then fail because they require an `ON_DUTY` attendance row | **P0** |
| 4 | **No geofence validation.** `punchIn` stores whatever location it is given (currently nothing) and never compares it to `PickerWorkLocation.coordinates` / `geofenceRadius`. The frontend advertises a 150 m fence. | `picker.service.punchIn` | Pickers can punch in from anywhere | **P0** |
| 5 | **Manager OTP is fabricated.** `requestManagerOtp` sends nothing; `verifyManagerOtp` returns `{ verified: true }` unconditionally. | `picker.controller` | Device handover control is a no-op | **P0** |
| 6 | **Bank verification is fabricated.** `verifyBankAccount` returns `{ verified: true }` for any input. | `picker.controller` | Payouts can be sent to unverified accounts | **P0** |
| 7 | **No late / overtime calculation.** `punchOut` computes `totalWorkedMinutes` only. `lateByMinutes` and `overtimeMinutes` stay at their `0` defaults; nothing compares punch-in against the scheduled shift start. | `picker.service.punchOut` | The entire OT tab (hours, rate, earnings) has no source | **P1** |
| 8 | **No payout cycle.** Nothing computes a monthly net payout, a pay date, or credits `PickerWallet` from attendance. `PickerTransaction` rows are never created by any code path. | absent | Wallet balances stay at 0; there is no earnings pipeline | **P1** |
| 9 | **No performance metrics.** `getPerformance` aggregates `ordersCompleted` — a field **no code ever writes**. Accuracy, speed score, and rank/percentile have no source at all. | `picker.service.getPerformance` | The Performance tab cannot be populated | **P1** |
| 10 | **No withdrawal idempotency.** No key is accepted or checked; a double tap creates two requests and reserves the balance twice. | `picker.service.requestWithdrawal` | Duplicate payouts | **P1** |
| 11 | **Withdrawals ignore the bank account.** `accountId` is dropped; the request is not linked to a `PickerBankAccount`. | `picker.service.requestWithdrawal` | Admin cannot tell where to pay | **P1** |
| 12 | **Shift capacity is never enforced.** `selectShift` creates an assignment without checking `PickerShift.capacity` against existing assignments. There is also no unique constraint on (user, shift, date). | `picker.service.selectShift` | Overbooking; duplicate assignments on repeat taps | **P1** |
| 13 | **Face verification is never processed.** `faceVerificationStatus` defaults to `'pending'` and no code path ever changes it (outside the admin override stub). | `picker.controller.verifyFace` | Onboarding step 7 cannot complete | **P1** |
| 14 | **Training completion is not persisted.** The real `updateTrainingProgress` exists but the routes the frontend calls (`/training/watch-progress`, `/training/complete/:videoId`) are stubs. | `picker.routes` + controller | Training gate is bypassable and resets on reinstall | **P1** |

---

## Database / Model Gaps

| # | Missing | Model | Needed by | Priority |
|---|---|---|---|---|
| 1 | `dob` / date of birth | `PickerUser` | Edit Profile, onboarding step 1 | **P0** |
| 2 | `address`, `city`, `pincode`, `altPhone` | `PickerUser` | Personal Information screen (silently discarded today) | **P0** |
| 3 | `emergencyContact { name, phone, relation }` | `PickerUser` | Personal Information screen; `emgRel` enum is `Spouse\|Parent\|Sibling\|Friend` | **P0** |
| 4 | Document number (+ masked form) | `PickerDocument` | Documents screen `num: '•••• •••• 1234'`; onboarding step 6 submits Aadhaar/PAN **numbers**, which have nowhere to go | **P0** |
| 5 | Onboarding progress (current step, per-step completion, submitted-for-review timestamp) | `PickerUser` or a new collection | The entire 8-step wizard; `getOnboardingState` | **P0** |
| 6 | `gender` enum lacks `'Other'`; casing differs (`male` vs `Male`) | `PickerUser` | Onboarding step 1 rejects `'Other'` | **P1** |
| 7 | `status` enum lacks `BLOCKED`; frontend also uses `ONBOARDING` and `DELETION_PENDING`. Backend's `INACTIVE` has no frontend equivalent. | `PickerUser` | `StatusGateScreen` renders blocked/suspended gates that can never trigger | **P1** |
| 8 | Device `battery` and `lastSyncedAt` | `PickerDevice` | Device Status screen (`battery: 86`, `lastSynced: '2 min ago'`). `PickerUser.batteryLevel` exists but is per-user, not per-device, and nothing writes it | **P1** |
| 9 | Push token store | absent | `POST /push-token`; push notifications cannot be delivered | **P1** |
| 10 | Device issue / incident record | absent | `POST /issues`; the Report-an-issue sheet has nowhere to persist | **P1** |
| 11 | Notification settings and language preference | absent | `useSettings` (local-only today) | **P3** |

**Additional schema observations:**

- `PickerAttendance.status` mixes two naming conventions in a single enum: `'present' | 'half-day' | 'absent' | 'ON_DUTY' | 'COMPLETED' | 'ON_BREAK'`. The first three are day classifications, the last three are live states. These are different axes and should be separate fields.
- `PickerShift` has overlapping, redundant time fields: `startTime`, `endTime`, `time`, `duration`, all optional strings with no format contract.
- `PickerShift.id` (a `String`) coexists with Mongo's `_id`, and `listAvailableShifts` returns both. Ambiguous which one `POST /shifts/select` expects.
- `PickerUser.trainingProgress` is `Schema.Types.Mixed` defaulting to `{ video1: 0, … video4: 0 }` — hardcoded keys that will not match `PickerTrainingVideo.videoId` values.
- `PickerBankAccount` has no `isDefault`; `isPrimary` exists but is never written by any code.

---

## Authentication & Authorization Gaps

| # | Gap | Detail | Priority |
|---|---|---|---|
| 1 | **Profile response leaks secrets** | `getProfile` returns the raw `PickerUser` document, including `sessionToken`, `locationOtp`, and `locationOtpForLocationId`. `sessionToken` is the value the middleware checks `sid` against — handing it to the client undermines session invalidation. | **P0** |
| 2 | **OTP returned in the response body** | `sendOtp` / `sendOtpEmail` include `otp` in the payload whenever `OTP_DEV_MODE` is on, and it defaults to on for any `NODE_ENV !== 'production'`. | **P0** |
| 3 | **No status gate on operational routes** | `authenticatePicker` rejects only `SUSPENDED`. A `PENDING` (unapproved) or `REJECTED` picker can call `punch-in`, `wallet/withdraw`, `shifts/select`, and every other authenticated route. | **P0** |
| 4 | **Hardcoded test-phone bypass** | `TEST_PHONES = { '9698790921': '8790' }` grants a fixed OTP in all environments. | **P0** |
| 5 | **No server-side logout** | Nothing clears `sessionToken`. A stolen JWT is valid for 7 days regardless of the user logging out. | **P1** |
| 6 | **No refresh token** | 7-day expiry with no renewal; the user is silently logged out mid-session. | **P1** |
| 7 | **Frontend has no 401 handler** | `client.ts` throws a generic `ApiError` on 401. Nothing redirects to login or clears the stale token, so an expired session shows "Something went wrong" on every screen. | **P1** |
| 8 | **Auth middleware error shape differs** | `authenticatePicker` returns `{ success: false, error: { code, message } }` with **no top-level `message`**, unlike `ResponseFormatter.error`. The frontend reads `parsed?.message`, so auth failures surface as `"HTTP 401"` instead of the real reason. | **P2** |
| 9 | **No per-identifier OTP rate limit** | Only a global per-IP limit applies to `/api/v1`. The 5-attempt cap is per OTP record and resets on resend, so unlimited resends are possible. | **P2** |
| 10 | **JWT secret falls back to a literal** | `process.env.JWT_SECRET \|\| 'picker-app-secret-change-in-production'`. Fail startup instead of defaulting. | **P2** |
| 11 | **Email accounts get a synthetic phone** | `verifyOtpEmail` derives a fake phone from an MD5 of the email to satisfy the `required, unique` constraint on `phone`. Collision-prone and it pollutes the phone namespace. | **P2** |

**Working correctly:** Bearer extraction, JWT verification with a distinct expired-vs-invalid message, session (`sid`) matching, `SUSPENDED` blocking, admin routes gated by `authenticateAdmin`, and public routes (`/work-locations`, `/training/videos`, `/faq`, `/auth/*`) correctly left unauthenticated — matching the frontend's `auth: false` flags.

---

## Validation Gaps

**The picker module uses no validation middleware at all.** Every other module in the codebase (`faq`, `support`, `products`, `coupons`) uses `validate(schema, 'body'|'query')`. `picker.routes.ts` uses none — validation is a handful of ad-hoc `if` checks inside controllers.

| Area | Frontend rule | Backend rule | Gap |
|---|---|---|---|
| Phone | 10 digits (`isPhone10`) | normalized + 10-digit check | **OK** |
| OTP | 4 digits (`isOtp4`) | `/^\d{4}$/` | **OK** |
| Email | regex (`isEmail`) | regex | **OK** |
| Aadhaar | 12 digits (`validators.ts`) | **none** | Client-only |
| PAN | `ABCDE1234F` | **none** | Client-only |
| Pincode | 6 digits | **none** (no field) | Client-only |
| IFSC | required, non-empty | **none** | No format check |
| Account number | required, non-empty | required only | No format/length check |
| Withdrawal minimum | ₹100 (`config.minWithdrawal`) | `amount > 0`, schema `min: 1` | **Server accepts ₹1** |
| Withdrawal maximum | client-side vs a hardcoded `4850` | balance check exists | Frontend constant is fake |
| Profile name / DOB | required | not validated; `dob` not stored | Silently dropped |
| Gender | `Male\|Female\|Other` | `male\|female` | Case + missing value |
| Document type | not constrained | free string | No enum |
| Unknown request fields | — | silently dropped by allow-list | Should be 400 |

Error-status consistency: schema validation failures surface as **500**, not 422. `ResponseFormatter.validationError` exists and is unused in this module.

---

## Frontend Defects Found During Analysis

Not backend gaps, but they will block integration and the backend developer will encounter them.

1. **`onboardingApi.confirmDeviceCollection` does not exist.** Called by `useOnboarding.confirmCollect` (`src/hooks/useOnboarding.ts`). `onboardingApi` has no such method → `TypeError` when the user confirms device collection. The corresponding backend route (`POST /devices/collection-complete`) does exist.
2. **`profileApi.reportDeviceIssue` does not exist.** Called by `DeviceIssueSheet.submit` (`src/overlays/DeviceIssueSheet.tsx`) → `TypeError` on submit. The backend route `POST /issues` exists.
3. **`walletApi.withdraw` drops the idempotency key.** `useWallet` generates one and passes it, but the body sent is `{ amount, accountId }` only.
4. **`useWallet` hardcodes `AVAILABLE = 4850`** and validates the withdrawal against it rather than the fetched balance.
5. **HomeScreen and ProfileScreen make no API calls** — both render mock modules directly.
6. **`shiftApi.ping()` and `shiftApi.heartbeat()` are defined but never called**, so `lastSeenAt` and presence can never be populated.
7. **`config.USE_MOCKS = false`** with a `localhost` base URL — every screen currently hits the network. On a physical Android device `localhost` resolves to the device itself; this needs a LAN IP or `10.0.2.2` for the emulator.
8. **Training completion is keyed by array index** (`ob.trainDone[i]`), so it breaks if the video list order or length changes.

---

## Frontend ↔ Backend Compatibility Matrix

| Frontend Feature | Frontend Requirement | Existing Backend | Result | Required Action | Priority |
|---|---|---|---|---|---|
| Login — send OTP (SMS/WhatsApp) | `POST /auth/send-otp` `{phone, preferredChannel}` | Implemented, real | **OK** | Disable dev OTP echo + test-phone bypass in prod | P0 |
| Login — send OTP (email) | `POST /auth/send-otp-email` `{email}` | Implemented, no mail transport | **BACKEND LOGIC** | Wire an email provider | P1 |
| Login — resend OTP | `POST /auth/resend-otp` | Implemented | **OK** | None | — |
| Login — verify OTP | `POST /auth/verify-otp` → `{token}` | Implemented | **OK** | None (frontend's `onboardingComplete` type is unused) | — |
| Post-login routing | `GET /onboarding/state` → `'ACTIVE'` | Stub returns `'pending'` | **MODIFY** | Read `PickerUser.status`; map to the frontend enum | **P0** |
| Logout | clear session | No endpoint | **NEW API** | `POST /auth/logout` — clear `sessionToken` | P1 |
| Session expiry handling | 401 → login | No refresh; FE has no 401 handler | **BACKEND LOGIC** | Refresh token + frontend interceptor | P1 |
| Onboarding step 1 — profile | `PUT /user/profile` `{name, dob, gender}` | `dob` dropped; `gender` enum mismatch | **DATA GAP** | Add `dob`; extend gender enum; normalize case | **P0** |
| Onboarding step 2 — location type | `PUT /user/location-type` | Stub, no write | **MODIFY** | Persist to `locationType` | P1 |
| Onboarding step 3 — work location | `GET /work-locations` → `{id,title,sub}[]` | Real, wrong shape | **MODIFY** | Project view model; add distance | P1 |
| Onboarding step 4 — shift | `GET /shifts/available` → `{id,title,sub}[]` | Real, wrong shape; no site filter | **MODIFY** | Project view model; compute open slots; scope by location | P1 |
| Onboarding step 5 — training | `GET /training/videos` → `{name,dur}[]` | Real, wrong shape | **MODIFY** | Project `name`/`dur`; also return `videoId`/`url` | P1 |
| Training — mark complete | `POST /training/complete/:videoId` | Stub, no write | **MODIFY** | Route to `updateTrainingProgress` | P1 |
| Training — watch progress | `PUT /training/watch-progress` | Stub (real handler on a different path) | **MODIFY** | Repoint the route | P1 |
| Onboarding step 6 — KYC | `POST /documents/upload` `{aadhaar, pan}` | Requires `{type, url}` → 400 | **DATA GAP** | Add document-number storage; add upload endpoint | **P0** |
| Onboarding step 7 — face | `POST /verify/face` | Stub, no write | **BACKEND LOGIC** | Store image, set `faceVerificationStatus`, enqueue review | **P0** |
| Onboarding status gate | poll approval status | No state machine | **BACKEND LOGIC** | Onboarding state machine (gap #1) | **P0** |
| Onboarding step 8 — bank | `POST /bank/accounts` `{}` / `{holder,bank,acc,ifsc}` | Schema needs `accountHolderName`/`accountNumber`/`ifscCode` | **MODIFY** | Align the contract; onboarding cannot complete today | **P0** |
| Device collection — request OTP | `POST /manager/request-otp` | Stub, sends nothing | **BACKEND LOGIC** | Generate/store/send via `sms.service` | **P0** |
| Device collection — verify OTP | `POST /manager/verify-otp` | Stub, always `verified: true` | **BACKEND LOGIC** | Real verification | **P0** |
| Device collection — confirm | `POST /devices/collection-complete` | Stub, no assignment | **MODIFY** | Assign device; **FE method missing** | P1 |
| Home — dashboard | hub, balance, orders, metrics, performance | No aggregate; screen is hardcoded | **NEW API** | `GET /home/summary` + wire the screen | **P0** |
| Home — start shift readiness | `GET /shifts/readiness` → `{ready,accuracyM,onSite}` | Stub, wrong fields | **MODIFY** | Real geofence check | **P0** |
| Home — start shift | `POST /shifts/start` (no id) | 404 — `undefined` shiftId bug | **BACKEND LOGIC** | Resolve today's assignment; create attendance | **P0** |
| Home — check out | `POST /shifts/end` (no id) | 404 — same bug | **BACKEND LOGIC** | Same fix | **P0** |
| Shift breaks | `POST /shifts/break/start`\|`end` | Real, but needs an `ON_DUTY` attendance row | **BACKEND LOGIC** | Depends on the start-shift fix | P1 |
| Punch in / out | `POST /attendance/punch-in` `{latitude,longitude}` | Reads `body.location` → always undefined | **MODIFY** | Accept the flat shape; add geofence validation | P1 |
| Attendance — summary tab | `GET /attendance/summary` (nested view model) | Stub `{present:0,absent:0,late:0}` | **MODIFY** | Build the aggregate — **crashes today** | **P0** |
| Attendance — OT tab | `ot.{totalHrs,rate,totalEarnings,weeks[]}` | No OT calculation at all | **BACKEND LOGIC** | Overtime rules + pay rate | P1 |
| Attendance — history calendar | `history.{month,dow,cells,presentDays,halfDays}` | Not returned | **BACKEND LOGIC** | Month aggregation + per-day tone | P1 |
| Work History screen | `GET /attendance?month=` → `{month,summary,rows}` | Real but paginated wrapper; `month` ignored | **MODIFY** | Month filter + summary + view model — **crashes today** | **P0** |
| Payouts — balance card | `GET /wallet/balance` (8 fields) | Stub `{balance:0,currency}` | **MODIFY** | Build from wallet + bank account | **P0** |
| Payouts — transaction list | `GET /wallet/transactions` → `Payout[]` | Real, paginated object | **MODIFY** | Return array + project — **crashes today** | **P0** |
| Payouts — monthly net payout | `netPayout`, `payDate` | No payout cycle exists | **BACKEND LOGIC** | Monthly earnings pipeline | P1 |
| Withdraw | `POST /wallet/withdraw` `{amount, accountId}` | `accountId` ignored; no idempotency; `_id` not `id` | **MODIFY** | Accept `accountId`+`idempotencyKey`; enforce ₹100 min | P1 |
| Bank details — view | `GET /bank/accounts` | Real, raw documents | **MODIFY** | Project + mask the account number | P2 |
| Bank details — save | `POST /bank/accounts` | Field-name mismatch | **MODIFY** | Align contract (same as onboarding step 8) | **P0** |
| Bank — verify | `POST /bank/verify` → `{valid, holderName}` | Stub, always `verified: true` | **BACKEND LOGIC** | Real verification | P1 |
| UPI details | `PUT /user/upi` | Stub, no write | **MODIFY** | Persist + set verification status | P2 |
| Performance tab | `GET /performance/summary` → `{cards,weekBars,…}` | Stub `{summary:{}}` | **MODIFY** | Build the view model — **crashes today** | **P0** |
| Performance — accuracy/speed/rank | accuracy %, items/hr, percentile | No data source anywhere | **DATA GAP** | Define metric sources (likely from HHD) | P1 |
| Profile — header | name, ID, status | Screen is hardcoded | **MODIFY** | Wire `GET /user/profile`; add projection | P1 |
| Profile — menu subtitles | device, bank, training counts | No aggregate | **NEW API** | Extend `/user/profile/overview` | P2 |
| Edit Profile | `PUT /user/profile` `{name,dob,email}` | `dob` dropped silently | **DATA GAP** | Add `dob`; reject unknown keys | **P0** |
| Personal Information | 7 fields | **all 7 dropped silently** | **DATA GAP** | Add address/city/pincode/altPhone/emergency contact | **P0** |
| Documents list | `GET /documents` → `DocItem[]` | Real, wrong fields | **MODIFY** | Project + map status; needs document number | P1 |
| Document upload | file upload | No upload endpoint anywhere | **NEW API** | `POST /uploads` (+ frontend file picker) | **P0** |
| Device Status | `GET /devices/assigned` → `KeyValue[]` | Stub `{device:null}` | **MODIFY** | Return rows — **crashes today** | **P0** |
| Device — battery / last synced | `battery`, `lastSynced` | No fields on `PickerDevice` | **DATA GAP** | Add fields + a sync pipeline | P1 |
| Device — report issue | `POST /issues` | Stub, no model | **DATA GAP** | Add issue model; **FE method missing** | P1 |
| Device — request replacement | — | No API; frontend shows a toast only | **NEW API** | Only if the flow is required | P3 |
| Notifications list | `GET /notifications` → `AppNotification[]` | Real, paginated object | **MODIFY** | Return array + project — **crashes today** | **P0** |
| Notifications — mark read | `PUT /notifications/read-all` | Stub, no write | **MODIFY** | `updateMany` | P2 |
| Push notifications | `POST /push-token` | Stub, no model | **DATA GAP** | Token store + delivery | P1 |
| FAQs | `GET /faq` → `Faq[]` | Stub `{faqs:[]}` | **MODIFY** | Delegate to the existing `faq` module — **crashes today** | **P0** |
| Support — create ticket | `POST /support/tickets` | Stub, echoes body | **MODIFY** | Reuse the `support` module | P1 |
| Support — chat | message send/receive | Posts each message as a new ticket | **NEW API** | Extend `support-chat` to pickers | P1 |
| Support — settings | 5 toggles + language | Local state only; no API called | **NEW API** | Only if persistence is required | P3 |
| Account deletion | `POST /account/delete-request` | Stub, no write | **MODIFY** | Set `deletionRequestedAt`/`deletionReason` | P2 |
| Presence / heartbeat | `POST /heartbeat`, `/presence/ping` | Stubs; **frontend never calls them** | **MODIFY** | Update `lastSeenAt` if the feature is wanted | P3 |
| Offline banner | connectivity only | n/a | **OK** | None | — |

---

## Final Backend Implementation Checklist

### P0 — Blocking (the app cannot function)

**Unblock login and navigation**
- [ ] `GET /onboarding/state` — read `PickerUser.status`; return `ONBOARDING` / `ACTIVE` / `REJECTED` / `BLOCKED` / `SUSPENDED`.
- [ ] Add `BLOCKED` to the `PickerUser.status` enum; decide how `ONBOARDING` and `DELETION_PENDING` are represented.
- [ ] Build the onboarding state machine: per-step completion, current step, submitted-for-review timestamp.

**Fix the crash-on-success responses (7 screens)**
- [ ] `GET /wallet/transactions` — return an array at the top level; use the envelope's `pagination` field.
- [ ] `GET /notifications` — same.
- [ ] `GET /attendance` (Work History view) — return `{ month, summary, rows[] }`; honour the `month` query parameter.
- [ ] `GET /attendance/summary` — return the full nested view model (`present`, `detailsRows`, `ot`, `history`, `stats`).
- [ ] `GET /performance/summary` — return `{ cards[], todaysEarnings, hub, weekBars[], home }`.
- [ ] `GET /devices/assigned` — return the device rows array plus the header object.
- [ ] `GET /faq` — delegate to the existing `faq.service`; map `question → q`, `answer → a`.

**Fix the shift lifecycle**
- [ ] `POST /shifts/start` / `/shifts/end` without a `shiftId` — resolve today's assignment instead of constructing an ObjectId from `undefined`.
- [ ] Create a `PickerAttendance` record on shift start (breaks currently depend on one existing).
- [ ] `GET /shifts/readiness` — return `{ ready, accuracyM, onSite }` from a real geofence check.

**Fix onboarding completion**
- [ ] Settle the `POST /bank/accounts` contract and align all three frontend callers. Onboarding's final step fails today.
- [ ] `POST /documents/upload` — reconcile "document numbers" vs "uploaded files".
- [ ] `POST /verify/face` — persist and set `faceVerificationStatus`.
- [ ] `POST /manager/request-otp` — actually generate, store, and send an OTP.
- [ ] `POST /manager/verify-otp` — actually verify it.

**Fix profile persistence**
- [ ] Add to `PickerUser`: `dob`, `address`, `city`, `pincode`, `altPhone`, `emergencyContact { name, phone, relation }`.
- [ ] Extend the `updateProfile` allow-list; return 400 on unknown keys instead of dropping them.
- [ ] Add `'other'` to the gender enum; normalize casing.
- [ ] `GET /user/profile` — add an explicit projection. **Stop returning `sessionToken` and `locationOtp`.**

**New endpoints**
- [ ] `GET /home/summary` — the Home screen aggregate.
- [ ] `POST /uploads` — file upload (KYC, face, profile photo, device photos).

**Security**
- [ ] Ensure `OTP_DEV_MODE=false` and `NODE_ENV=production` in production.
- [ ] Remove the `TEST_PHONES` bypass.
- [ ] Gate operational routes on `status === 'ACTIVE'` (not just non-`SUSPENDED`).
- [ ] Fail startup when `JWT_SECRET` is unset rather than falling back to a literal.

### P1 — Required (features are visibly broken or fabricated)

- [ ] Late / overtime calculation on `punchOut` (`lateByMinutes`, `overtimeMinutes`) against the scheduled shift.
- [ ] Monthly payout pipeline: attendance → earnings → `PickerTransaction` → `PickerWallet`, with a pay date.
- [ ] Define the source for accuracy, speed score, and rank; `ordersCompleted` is currently never written.
- [ ] `POST /wallet/withdraw` — accept `accountId` and `idempotencyKey`; enforce the ₹100 minimum; return `id`.
- [ ] `POST /bank/verify` — real verification, or an explicit "unverified" state instead of a false positive.
- [ ] Enforce `PickerShift.capacity` in `selectShift`; add a unique index on (user, shift, date).
- [ ] Repoint `PUT /training/watch-progress` to the real `updateTrainingProgress`; implement `POST /training/complete/:videoId`.
- [ ] Project the view model for `/work-locations`, `/shifts/available`, `/training/videos`, `/documents`.
- [ ] Accept the flat `{latitude, longitude}` punch payload; validate the geofence.
- [ ] Persist `PUT /user/location-type` and `POST /dark-store-login` so `currentLocationId` (and therefore `hub`) is populated.
- [ ] Push token model + `POST /push-token` persistence.
- [ ] Device issue model + `POST /issues` persistence and support routing.
- [ ] Add `battery` and `lastSyncedAt` to `PickerDevice`.
- [ ] Reuse the `support` module for `POST /support/tickets`.
- [ ] Extend `support-chat` to pickers (replace ticket-per-message).
- [ ] `POST /auth/logout` — clear `sessionToken`.
- [ ] Wire an email transport for email OTP.

### P2 — Important

- [ ] Add `validate()` middleware across `picker.routes.ts`; return 422 via `ResponseFormatter.validationError` instead of 500.
- [ ] Server-side format validation: Aadhaar, PAN, IFSC, account number, pincode.
- [ ] `PUT /notifications/read-all` and `/:id/read` — real writes.
- [ ] `PUT /user/upi` — persist and set `upiPayoutVerificationStatus`.
- [ ] Implement the bank account update / set-default / delete stubs; write `isPrimary`.
- [ ] `POST /account/delete-request` — write `deletionRequestedAt` / `deletionReason`.
- [ ] `GET /user/profile/overview` — return the profile-menu aggregate.
- [ ] Align the auth middleware's error envelope with `ResponseFormatter.error` (add top-level `message`).
- [ ] Per-identifier OTP rate limiting and a resend cooldown (frontend uses 24 s).
- [ ] Replace the synthetic-phone hack for email accounts.
- [ ] Split `PickerAttendance.status` into a day classification and a live state.

### P3 — Optional

- [ ] Settings persistence (notification toggles, language) — the frontend calls no API today.
- [ ] `GET /wallet/earnings-breakdown`, `/wallet/history`, `/wallet/transactions/:id` — defined in the frontend service, unused by screens.
- [ ] `POST /heartbeat`, `/presence/ping` — the frontend never calls them.
- [ ] `POST /training/assessment` — no screen uses it.
- [ ] `POST /devices/return`, `/devices/upload-condition-photo` — no screen uses them.
- [ ] Device replacement request flow (frontend shows a toast only).
- [ ] Clean up redundant `PickerShift` time fields and the `id` / `_id` ambiguity.

### Frontend fixes required in parallel

- [ ] Add the missing `onboardingApi.confirmDeviceCollection` method.
- [ ] Add the missing `profileApi.reportDeviceIssue` method.
- [ ] Send `idempotencyKey` in the withdraw request body.
- [ ] Replace the hardcoded `AVAILABLE = 4850` in `useWallet` with the fetched balance.
- [ ] Wire `HomeScreen` and `ProfileScreen` to APIs.
- [ ] Add a 401 interceptor that clears the token and resets to the auth stack.
- [ ] Point `config.apiBaseUrl` at a device-reachable host.
- [ ] Key training modules by `videoId` rather than array index.
