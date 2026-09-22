# Backend Implementation Brief — Rider App + Picker App on `/api/v1/picker`

**Target repo:** `selorg-service`
**Primary module:** `src/modules/picker/`
**Date:** 2026-09-04
**Status:** reconciliation of two independently written frontend contracts

---

## 0. How to use this document

This is the **single source of truth** for implementing the backend for two React Native apps.
It supersedes the individual contracts where they disagree.

Four documents exist. Read them in this order:

| Document | Location | Role |
|---|---|---|
| **This brief** | `selorg-service/BACKEND_IMPLEMENTATION_BRIEF.md` | **Authoritative.** Ownership map, conflict resolutions, build order |
| `RIDER_API_CONTRACT.md` | `selorg-service/` (copy) | Rider App's 60 endpoint specs — detail reference |
| `RIDER_GAP_ANALYSIS.md` | `selorg-service/` (copy) | Rider App gap analysis |
| `PICKER_API_CONTRACT.md` / `PICKER_GAP_ANALYSIS.md` | `Selorg PickerApp V1.3/` | Picker App's 55 endpoint specs — detail reference |

**Rule for Cursor (or any implementer):** when this brief and a per-app contract disagree, **this brief
wins**. The per-app contracts were each written without knowledge of the other, and both describe the
same URLs.

---

## 0.5 Current implementation state — READ THIS FIRST

**A large amount of this work is already implemented and uncommitted in the working tree.** The picker
module is ~10,400 lines across 19 files, including 15 new untracked services
(`picker.order.service.ts`, `picker.bulk.service.ts`, `picker.cash.service.ts`,
`picker.app.service.ts`, `picker.profile.service.ts`, `picker.shift.service.ts`,
`picker.upload.service.ts`, `picker.support.service.ts`, `picker.dashboard.service.ts`,
`picker.format.ts`, `picker.idempotency.ts`, `picker.rider.models.ts`,
`picker.rider.validation.ts`, `picker.config.ts`, `picker.upload.middleware.ts`).

**Do not rebuild what exists.** Verify against this table first.

| Item | State | Notes |
|---|---|---|
| Delivery OTP verification | ✅ **Done** | `picker.order.service.ts:601-608` — real comparison, `MAX_OTP_ATTEMPTS` cap. The P0 security defect is fixed. |
| Bulk vertical | ✅ **Done** | `picker.bulk.service.ts` (714 lines); routes `/bulk/batch`, `/bulk/batches`, `/bulk/batches/:id`, stop deliver/fail/arrive, POD photo |
| Bulk stop OTP | ✅ **Done** | `picker.bulk.service.ts:525` — conditional `stop.requiresOtp`, resolving **[DECISION-5]** |
| COD / cash vertical | ✅ **Done** | `picker.cash.service.ts` (336 lines); `/cash/summary`, `/cash/transactions`, `/cash/deposits` |
| `POST /wallet/deposit` | ✅ **Done** | Registered and aliased to the same `recordCashDeposit` handler — **[DECISION-3] resolved: both paths kept.** Nothing to change. |
| `POST /uploads` | ✅ **Done** | Registered with `pickerDocumentUpload` multer middleware |
| Order proof photos | ✅ **Done** | `/shared-orders/:orderId/proof-photo`, `/bulk/stops/:stopId/proof-photo` |
| Suspended access to `/onboarding/state` | ✅ **Done** | `authenticatePickerAllowSuspended` — **[DECISION-2] resolved as recommended** |
| `/wallet/balance` | ✅ **Kept** | Not deprecated. Correct — the Picker App depends on it. |
| `/config`, `/config/cancel-reasons` | ✅ **Done** | Registered with query validation |
| `/onboarding/submit`, `/onboarding/kit-ack` | ✅ **Done** | `picker.profile.service.ts` |
| Zod validation on picker routes | ✅ **Done** | `picker.rider.validation.ts` (556 lines), wired via `validate()` |
| `POST /auth/logout`, `POST /auth/refresh` | ✅ **Done** | Both registered |
| `nextScreen` on verify-OTP | ✅ **Done** | `PickerNextScreen = 'main' \| 'onboarding' \| 'pending_review' \| 'rejected' \| 'suspended'` |
| **Phase 0 — picker JWT secret separation** | ✅ **Done** | `PICKER_JWT_SECRET` + `aud: 'picker'` claim; `authenticateAdmin` rejects any token carrying `aud` (`auth.middleware.ts:34`). The privilege-escalation gap is closed. |
| **Phase 0 — `/api/v1/rider/shifts/*` auth** | ✅ **Done** | All six routes now carry `authenticateAdmin` |
| **Phase 0 — secret leakage in profile** | ✅ **Done** | `picker.profile.service.ts` uses an explicit DTO; `sessionToken` / `locationOtp` no longer serialised |
| **Phase 0 — `TEST_PHONES` backdoor** | ✅ **Done** | Gated to `NODE_ENV !== 'production'` |
| **Phase 0 — OTP rate limiting** | ❌ **Missing** | No limiter on any `/auth/*` route. Only the global per-IP `/api/v1` limiter applies, and `send-otp` still upserts `attempts: 0`, resetting the 5-attempt cap. |
| **`role` discriminator on `PickerUser`** | ❌ **Missing** | Only `employment.role` (an unrelated free-text field) exists. §2 Rule A is **not** implemented — the backend still cannot tell a rider from a picker. |

### Two shared endpoints are currently resolved in *opposite* directions

This is the live risk. The implementation picked a different app to favour on each:

| Endpoint | Current behaviour | Consequence |
|---|---|---|
| `GET /shifts/available` | Returns **`booked: boolean`** *and* `bookedCount: number` (`picker.shift.service.ts:38,40`) | Resolved for the **Rider App**. The Picker App reads `booked` as a slot **count** — it now receives `true`/`false`, so its "N slots open" line and any capacity arithmetic break. |
| `GET /onboarding/state` | Returns **only** `{ state: "ONBOARDING"\|"ACTIVE"\|…, step, completedSteps, submittedForReviewAt, rejectionReason }` (`picker.app.service.ts:350-363`) | Resolved for the **Picker App**. The Rider App's expected `status` (lowercase), `applicationId`, named `steps[]`, `documents[]`, `kit`, `training` and `hub` are absent, so its onboarding gate cannot work. The rider-shaped logic exists in `picker.profile.service.ts:372` but **is not served on this route**. |

**Fix both by returning the superset specified in §5.2 and §5.5.** Neither app should have to lose.
`booked` must be removed entirely in favour of `isBookedByMe` + `bookedCount`, and `/onboarding/state`
must return `status` *and* the deprecated `state` alias.

### Working rules

1. **Never implement a shared endpoint from one contract alone.** Check §4 first. Twenty-six endpoints
   are consumed by both apps; changing one to suit the Rider App will break the Picker App.
2. **Do not delete or rename an existing route** without checking both apps' API clients
   (`Selorg-RiderApp-v1.3/src/services/api/*`, `Selorg PickerApp V1.3/src/services/api/*`).
3. **Every response must keep the `ResponseFormatter` envelope.** Both clients unwrap `data`.
4. Work through §8 in order. Phases 0–1 are prerequisites for everything else.
5. Items marked **[DECISION]** need a human answer before coding — see §9.

---

## 1. The core problem

Two separate React Native apps consume the same backend module:

| | Rider App | Picker App |
|---|---|---|
| Repo | `Selorg-RiderApp-v1.3` | `Selorg PickerApp V1.3` |
| Who uses it | Last-mile delivery riders | In-store / darkstore order pickers |
| Base URL configured | `http://localhost:3000/api/v1` + `/picker/*` paths | `http://localhost:3333/api/v1/picker` |
| Endpoints specified | 60 | 55 |
| Overlap | **26 endpoints in common** | |

Both write to `PickerUser` and both authenticate through `authenticatePicker`. There is **no role
discriminator** anywhere in the schema, so the backend cannot currently tell a rider from a picker.

`PickerUser` as it stands is modelled for the **picker** role: `locationType: warehouse|darkstore`,
`employment`, `agencyId`, `hhdUserId`, `faceVerificationStatus`, `onBreak`. The Rider App needs
vehicle, delivery mode, COD float and trip stats — none of which exist.

### The two apps disagree about the same URLs

Concrete, verified conflicts (full list in §4):

| Endpoint | Rider expects | Picker expects | Severity |
|---|---|---|---|
| `GET /shifts/available` | `booked: boolean` (has *this rider* booked it) | `booked: number` (how many slots taken) | **Type collision on the same field name** |
| `GET /onboarding/state` | `status: "under_review"` (lowercase, 5 named steps) | `state: "ONBOARDING"` (uppercase, numeric steps 1–8) | Different field name, casing and enum |
| `GET /user/profile` | `status: "active"`, `hub: { id, name }` | `status: "ACTIVE"`, `hub: "Indiranagar Darkstore"` | Casing + object vs string |
| `GET /documents` | stored rows keyed by `_id` | checklist keyed by type slug, includes not-yet-uploaded | Different list semantics |
| `POST /documents/upload` | one-step multipart, `type: "aadhar"` | two-step (`/uploads` then JSON), `type: "aadhaar"` | Different flow **and** different spelling |
| `GET /wallet/balance` | "deprecate it, use `/wallet`" | actively used, 12-field payout view model | Rider plan would break Picker |
| `GET /work-locations` | should require auth | called with `auth: false` | Auth requirement |

None of these can be satisfied by implementing one contract and moving on.

---

## 2. Resolution strategy

**Chosen approach: one namespace, one route per URL, canonical field names, role-scoped extensions.**

Namespace splitting (moving the Rider App to `/api/v1/rider/*`) was considered and rejected for now —
it would duplicate auth, profile, wallet, documents, training and shifts across two modules, and the
`/api/v1/rider/*` namespace is already occupied by the admin/dispatch surface.

Three rules follow:

### Rule A — add a role discriminator

Add to `PickerUser`:

```
role: 'picker' | 'rider'   // required, default 'picker', indexed
```

Set it at account creation from the calling app. Both `authenticatePicker` and every shared handler
read it. **[DECISION-1]** — see §9 for how the backend learns which app is calling.

### Rule B — canonical names, no overloaded fields

Where the two contracts use the same field name for different meanings, **both names are retired** and
replaced with unambiguous ones. Both frontends update their mappers. This is a small, one-time change
in each app and removes the ambiguity permanently.

| Ambiguous | Replaced by |
|---|---|
| `booked` (shifts) | `bookedCount: number` **and** `isBookedByMe: boolean` |
| `state` / `status` (onboarding) | `status` only |
| `hub` (string vs object) | `hub: { id, name }` object everywhere |
| `photoUri` / `photoUrl` | `photoUrl` |
| `aadhaar` / `aadhar` | `aadhaar` (correct spelling) |

### Rule C — shared core + role block

Shared endpoints return a **common core** plus one optional role-specific object:

```json
{
  "id": "...", "name": "...", "status": "active", "role": "rider",
  "rider":  { "vehicle": {}, "deliveryMode": "bulk", "floatCash": 840 },
  "picker": null
}
```

The block for the other role is `null`. Neither app needs to know about the other's fields, and
neither breaks when the other's block changes.

---

## 3. Canonical conventions

These override both per-app contracts.

### Envelope

Unchanged — `ResponseFormatter.success` / `.error` / `.paginated`.

> **Important:** the Rider App client (`src/services/api/client.ts`) reads nested keys inside `data`
> (`data.orders`, `data.items`, `data.history`, `data.transactions`, `data.token`, `data.ref`) and
> **ignores the sibling `pagination` object**. For endpoints the Rider App already calls, put the list
> and its paging meta **inside `data`**. Do not use `ResponseFormatter.paginated` on those routes.
> Picker App routes may use either.

### Enum casing — **lowercase_snake everywhere**

Both apps adapt. The Picker App's uppercase expectations (`ACTIVE`, `ONBOARDING`) are dropped.

| Concept | Canonical values |
|---|---|
| Account status | `pending` \| `active` \| `inactive` \| `rejected` \| `suspended` \| `blocked` |
| Onboarding status | `not_started` \| `in_progress` \| `under_review` \| `approved` \| `rejected` |
| Document status | `missing` \| `pending` \| `approved` \| `rejected` |
| Document type | `aadhaar` \| `pan` \| `dl` \| `rc` \| `insurance` \| `photo` \| `other` |
| Login method | `mobile` \| `whatsapp` \| `email` |
| Gender | `male` \| `female` \| `other` |
| Location type | `warehouse` \| `darkstore` |
| Shift slot status | `open` \| `full` \| `closed` \| `started` \| `completed` |
| Shift assignment | `assigned` \| `started` \| `completed` \| `cancelled` \| `no_show` |
| Delivery mode (rider) | `standard` \| `bulk` |
| Payment mode (rider) | `cod` \| `prepaid` |
| Deposit method (rider) | `upi` \| `bank` \| `card` |

Existing `SCREAMING_CASE` values in Mongo (`PickerUser.status`, `PickerShiftAssignment.status`,
`PickerShift.status`) stay in the database. **Map at the API boundary only** — do not migrate the
collections as part of this work.

`blocked` is new at the API layer; map it from `PickerUser.status = 'INACTIVE'`.

### Display strings

Both apps render pre-formatted strings. Return **both** the raw value and the display string, using a
`*Display` suffix:

```json
{ "cashInHand": 840, "cashInHandDisplay": "₹840" }
```

| Kind | Format | Example |
|---|---|---|
| Currency | `₹` + thousands separators | `"₹18,450"` |
| Month label | `MMMM YYYY` | `"March 2026"` |
| Date | `D MMM YYYY` | `"5 Apr 2026"` |
| Row date | `ddd, DD MMM` | `"Wed, 11 Mar"` |
| Duration | `Xh YYm` | `"9h 02m"` |
| Distance | one decimal + unit | `"2.4 km"` |
| Raw timestamps | ISO 8601 UTC | `"2026-09-04T10:15:00.000Z"` |

### Nulls

Lists are always `[]`, never `null` — both clients call `.map()` unconditionally.
Optional scalars are `null`, never omitted.

> **Danger, both apps:** each client falls back to bundled mock data on `null`/`undefined` but **not**
> on a wrong shape. A `200` with the wrong fields replaces the mock and renders a broken screen. Shape
> correctness matters more than availability here.

### Secrets

`sessionToken`, `locationOtp`, `locationOtpForLocationId` and `__v` must never appear in any response.
`pickerService.getProfile` currently returns the raw document including all of them — **this is a live
security defect**, fixed in Phase 1.

---

## 4. Endpoint ownership map

### 4a. SHARED — both apps (26). Read §5 before touching any of these.

| Endpoint | Method | Rider ref | Picker ref | Conflict? |
|---|---|---|---|---|
| `/auth/send-otp` | POST | 1 | 1 | No |
| `/auth/resend-otp` | POST | 2 | 3 | No |
| `/auth/send-otp-email` | POST | 3 | 2 | No |
| `/auth/resend-otp-email` | POST | — | 4 | No |
| `/auth/verify-otp` | POST | 4 | 5 | **Yes** — §5.1 |
| `/auth/verify-otp-email` | POST | 5 | 6 | **Yes** — §5.1 |
| `/auth/logout` | POST | 6 | 7 | No — both `NEW`, converge |
| `/onboarding/state` | GET | 10 | 8 | **Yes** — §5.2 |
| `/user/profile` | GET | 8 | 9 | **Yes** — §5.3 |
| `/user/profile` | PUT | 9 | 10 | **Yes** — §5.3 |
| `/work-locations` | GET | 11 | 14 | **Yes** — §5.4 |
| `/shifts/available` | GET | 18 | 15 | **Yes (severe)** — §5.5 |
| `/shifts/select` | POST | 19 | 33 | **Yes** — §5.5 |
| `/shifts/my` | GET | 21 | — (called) | No |
| `/shifts/start` | POST | 22 | 31 | **Yes** — §5.6 |
| `/shifts/end` | POST | 23 | 32 | **Yes** — §5.6 |
| `/documents` | GET | 13 | 21 | **Yes** — §5.7 |
| `/documents/upload` | POST | 12 | 20 | **Yes (severe)** — §5.7 |
| `/training/videos` | GET | 14 | 16 | No |
| `/training/watch-progress` | PUT | 15 | 17 | No |
| `/wallet/balance` | GET | 43 | 40 | **Yes** — §5.8 |
| `/wallet/transactions` | GET | 44 | 41 | Minor — §5.8 |
| `/push-token` | POST | 51 | 50 | No |
| `/faq` | GET | 54 | 51 | Minor — §5.9 |
| `/support/tickets` | GET + POST | 55, 56 | 52, 53 | No |
| `/support/chat/*` | GET + POST | 57, 58 | 54 | No — both `NEW`, converge |

### 4b. RIDER-ONLY (26) — safe to build without affecting the Picker App

Specs in `RIDER_API_CONTRACT.md`.

| Group | Endpoints |
|---|---|
| Orders | `GET /shared-orders/assignorders`, `GET /shared-orders/:orderId`, `PUT /shared-orders/:orderId/status`, `POST /shared-orders/:orderId/complete`, `POST /shared-orders/:orderId/proof-photo`, `GET /shared-orders/completed` |
| Bulk delivery | `GET /bulk/batch`, `POST /bulk/bag/load`, `POST /bulk/start`, `POST /bulk/stops/:stopId/arrive`, `POST /bulk/stops/:stopId/proof-photo`, `POST /bulk/stops/:stopId/deliver`, `POST /bulk/stops/:stopId/fail`, `GET /bulk/batches`, `GET /bulk/batches/:batchId` |
| COD / float | `GET /cash/summary`, `GET /cash/transactions`, `POST /cash/deposits` |
| Earnings | `GET /wallet/earnings-breakdown`, `GET /wallet/history` |
| Dashboard | `GET /dashboard/today`, `GET /incentives/today` |
| Onboarding | `POST /onboarding/submit`, `POST /onboarding/kit-ack` |
| Shifts | `POST /shifts/deselect` |
| Other | `POST /locations/track`, `GET /settings/preferences` + `PUT`, `GET /config`, `GET /config/cancel-reasons`, `GET /legal/terms`, `GET /legal/privacy`, `POST /auth/refresh` |

### 4c. PICKER-ONLY (29) — safe to build without affecting the Rider App

Specs in `PICKER_API_CONTRACT.md`.

| Group | Endpoints |
|---|---|
| Profile extras | `GET /user/profile/overview`, `PUT /user/location-type`, `PUT /user/upi` |
| Attendance | `POST /attendance/punch-in`, `POST /attendance/punch-out`, `GET /attendance/summary`, `GET /attendance/stats`, `GET /attendance` |
| Shifts | `GET /shifts/readiness`, `POST /shifts/break/start`, `POST /shifts/break/end` |
| Wallet | `POST /wallet/withdraw` |
| Bank | `GET /bank/accounts`, `POST /bank/accounts`, `POST /bank/verify` |
| Training | `POST /training/complete/:videoId`, `GET /training/user-progress` |
| Devices | `GET /devices/assigned`, `POST /devices/collection-complete` |
| Verification | `POST /verify/face`, `POST /manager/request-otp`, `POST /manager/verify-otp` |
| Home | `GET /home/summary` |
| Notifications | `GET /notifications`, `PUT /notifications/read-all`, `PUT /notifications/:id/read` |
| Files | `POST /uploads` |
| Other | `POST /issues`, `GET /performance/summary`, `POST /account/delete-request` |

> Note: `POST /uploads` (Picker) and `POST /shared-orders/:id/proof-photo` (Rider) are both file
> uploads. Build `/uploads` **first** as the shared storage primitive — see §5.7.

---

## 5. Shared endpoint reconciliation

Each subsection gives: what each app wants, the exact conflict, and the **resolved spec to implement**.

### 5.1 `POST /auth/verify-otp` and `/auth/verify-otp-email`

**Rider wants** `{ token, isNewUser, user: { id, phone, email, name, loginMethod, status (lowercase), onboardingCompleted, rejectedReason }, nextScreen }`.

**Picker wants** `{ token, isNewUser, user: {...} }` and then immediately calls `GET /onboarding/state`
to route (`useAuth.verifyOtp`).

**Conflict.** The Rider App routes from the verify response; the Picker App routes from a second call.
Status casing also differs.

**Resolved spec — implement:**

```json
{
  "success": true, "message": "OTP verified",
  "token": "<jwt>", "isNewUser": false,
  "user": {
    "id": "66f0a1b2c3d4e5f60718293a",
    "phone": "9876543210", "email": null, "name": "Arjun Mehta",
    "loginMethod": "mobile",
    "role": "rider",
    "status": "active",
    "onboardingStatus": "approved",
    "onboardingCompleted": true,
    "rejectedReason": null
  },
  "nextScreen": "main"
}
```

- `status` and `onboardingStatus` use the canonical lowercase enums (§3).
- `nextScreen`: `main` \| `onboarding` \| `pending_review` \| `rejected` \| `suspended` \| `blocked`.
- The Picker App may keep calling `/onboarding/state` — that stays valid; this response simply lets
  both apps route in one round trip.
- Accept optional `intent: "login" | "signup"`. When `intent = "login"` and no account exists, return
  `404 ACCOUNT_NOT_FOUND` instead of auto-creating. Without it the Rider App's "We couldn't find an
  account" banner can never fire.
- Return `403 ACCOUNT_SUSPENDED` for suspended accounts rather than a token the next call rejects.

**Also fix (both apps):** `sendOtpEmail` stores the OTP and returns success **without sending any
email** outside dev mode. Email login cannot work in production for either app.

### 5.2 `GET /onboarding/state`

**Rider wants** `{ applicationId, status: "under_review", steps: [{ key: "personal"|"vehicle"|"hub"|"documents"|"training", label, completed, blockedReason }], documents[], kit, training, hub, submittedAt, reviewedAt, rejectionReason }` — 5 named steps.

**Picker wants** `{ state: "ONBOARDING", step: 3, completedSteps: [1,2], submittedForReviewAt, rejectionReason }` — 8 numeric steps.

**Conflict.** Different field name (`status` vs `state`), different casing, different enum values, and
a fundamentally different step model. The two apps have genuinely different onboarding wizards.

**Resolved spec — implement:**

```json
{
  "status": "under_review",
  "role": "rider",
  "applicationId": "SL-RA-2048",
  "submittedAt": "2026-09-03T11:20:00.000Z",
  "reviewedAt": null,
  "rejectionReason": null,
  "hub": { "id": "kor", "name": "Koramangala Darkstore" },
  "currentStep": 4,
  "completedSteps": [1, 2, 3],
  "steps": [
    { "seq": 1, "key": "personal", "label": "Personal details", "completed": true, "blockedReason": null }
  ],
  "documents": [ { "type": "aadhaar", "status": "approved", "rejectionReason": null } ],
  "training": { "completed": true, "progressPercent": 100 },
  "kit": { "acknowledged": true },
  "state": "ONBOARDING"
}
```

- `steps[]` is **role-dependent**: 5 entries for `rider`, 8 for `picker`. Each entry carries both a
  `seq` (satisfies the Picker App) and a `key` (satisfies the Rider App).
- `currentStep` + `completedSteps` serve the Picker App's resume logic.
- `status` is canonical lowercase and is the field to build on.
- **`state` is a deprecated compatibility alias** carrying the Picker App's uppercase value. Keep it
  for one release so the Picker App keeps working unchanged, then remove it. Mapping:
  `active → "ACTIVE"`, `pending/in_progress → "ONBOARDING"`, `rejected → "REJECTED"`,
  `suspended → "SUSPENDED"`, `blocked → "BLOCKED"`.

**Why this matters most:** today the stub returns the literal `"pending"`, which is in neither app's
enum. The Picker App's check `obState === 'ACTIVE'` is therefore **always false**, so *every* picker —
approved or not — is bounced back into the onboarding wizard on every login, and admin approval has no
observable effect. This is the highest-priority functional defect in the whole integration.

**Middleware note:** `authenticatePicker` returns `403 ACCOUNT_SUSPENDED` before the handler runs, so
`status: "suspended"` is unreachable on this route. Either allow suspended accounts through on this
route specifically, or have both apps map the 403 to their suspended gate. **[DECISION-2]**

### 5.3 `GET /user/profile` and `PUT /user/profile`

**Rider wants** `{ id, name, email, phone, photoUrl, status (lower), vehicle: {type, registrationNumber, label}, deliveryMode, hub: {id,name}, stats: {totalTrips, onTimePercent, rating}, floatCash, kycVerified, createdAt }`.

**Picker wants** `{ id, name, phone: "+91 98765 43210", email, status (UPPER), memberSince: "Jan 2026", hub: "Indiranagar Darkstore", role: "Picker", photoUri, dob, gender: "Male", altPhone, address, city, pincode, emergencyContact }`.

**Conflicts:** status casing; `hub` object vs string; `photoUrl` vs `photoUri`; `phone` raw vs
formatted; `role` as a display label vs a discriminator; and two disjoint sets of extension fields.

**Resolved spec — implement (Rule C):**

```json
{
  "id": "4821",
  "name": "Arjun Mehta",
  "phone": "9876543210",
  "phoneDisplay": "+91 98765 43210",
  "email": "arjun.m@selorg.in",
  "photoUrl": null,
  "status": "active",
  "role": "rider",
  "roleLabel": "Rider",
  "memberSince": "Jan 2026",
  "createdAt": "2026-01-14T06:00:00.000Z",
  "hub": { "id": "kor", "name": "Koramangala Darkstore" },
  "kycVerified": true,
  "rider": {
    "vehicle": { "type": "auto", "registrationNumber": "KA 01 AB 1234", "label": "Auto" },
    "deliveryMode": "bulk",
    "stats": { "totalTrips": 1284, "onTimePercent": 98.0, "rating": 4.9 },
    "floatCash": 840, "floatCashDisplay": "₹840"
  },
  "picker": null
}
```

- `role` is the discriminator (`picker`/`rider`); `roleLabel` is the display string the Picker App shows.
- `hub` is always an object. The Picker App maps `hub.name`.
- The Picker App's `picker` block carries `dob`, `gender`, `altPhone`, `address`, `city`, `pincode`,
  `emergencyContact`, `locationType`, `upiId`, `upiPayoutVerificationStatus`.
- **Never spread the raw Mongo document.** Build an explicit DTO.

**`PUT /user/profile` — extend the whitelist.** It currently allows only
`name, email, age, gender, photoUri, locationType, upiId, upiName, gpsLocation` and **silently drops
everything else**, which is worse than a 400. Add: `vehicleType`, `vehicleRegistrationNumber`, `hubId`,
`dob`, `altPhone`, `address`, `city`, `pincode`, `emergencyContact`, `photoUrl`.
Add Zod validation — no picker route uses the `validate()` middleware today.

### 5.4 `GET /work-locations`

**Rider wants** authenticated, `distanceKm` + `distanceDisplay`, `dispatchBays`, sorted by proximity.
**Picker wants** **unauthenticated** (its client passes `auth: false`), with a `sub` display string.

**Conflict:** auth requirement.

**Resolved spec:** keep the route **public** (the Picker App calls it during onboarding, before a
token exists). Return:

```json
[{ "id": "kor", "name": "Koramangala Darkstore", "address": "80 Feet Rd, 4th Block",
   "type": "darkstore", "coordinates": { "latitude": 12.93, "longitude": 77.62 },
   "distanceKm": 1.2, "distanceDisplay": "1.2 km", "dispatchBays": 6,
   "sub": "1.2 km · 6 dispatch bays", "isActive": true }]
```

- Accept optional `lat`, `lng`, `radiusKm`, `type`. Sort by `distanceKm` when coordinates are given,
  else by `name`. `distanceKm` is `null` without coordinates.
- `sub` is the Picker App's display line, composed server-side.
- Requires a `2dsphere` index on `PickerWorkLocation` — none exists today.

### 5.5 `GET /shifts/available` and `POST /shifts/select`

**Rider wants** `[{ id, label, date, startTime, endTime, timeDisplay, payDisplay, basePayPerHour, hasIncentive, isSurge, capacity, bookedCount, remainingSlots, booked: BOOLEAN, status, hubId, hubName }]`.

**Picker wants** `[{ id, title: "Morning · 9:00 AM – 6:00 PM", sub: "18 slots open", capacity, booked: NUMBER, basePay }]`.

**Conflict — the sharpest in the integration:** `booked` is a **boolean** in one contract and a
**number** in the other, on the same field of the same endpoint. Implementing either silently corrupts
the other app (`if (slot.booked)` is true for any non-zero count).

**Resolved spec — retire `booked` entirely (Rule B):**

```json
[{
  "id": "66f1a1", "label": "Morning", "date": "2026-09-04",
  "startTime": "06:00", "endTime": "10:00",
  "title": "Morning · 6:00 AM – 10:00 AM",
  "timeDisplay": "6:00 AM – 10:00 AM",
  "sub": "3 slots open",
  "payDisplay": "₹120/hr + incentives", "basePay": 780, "basePayPerHour": 120,
  "hasIncentive": true, "isSurge": false,
  "capacity": 12, "bookedCount": 9, "remainingSlots": 3,
  "isBookedByMe": true,
  "status": "open",
  "hub": { "id": "kor", "name": "Koramangala Darkstore" }
}]
```

- **`booked` must not appear in the response at all.** Both apps update their mappers:
  Rider `booked` → `isBookedByMe`; Picker `booked` → `bookedCount`.
- `isBookedByMe` requires a left join to `PickerShiftAssignment` for the calling user — the single most
  important missing piece on this endpoint.
- Add a `date` query parameter with a default of today. The current query filters only on
  `status: 'SCHEDULED'` with no date window, so **past shifts are returned indefinitely**. `PickerShift`
  has no `date` field at all — add one.
- Resolve the `id` vs `_id` ambiguity: `PickerShift` has both, and `selectShift` looks up by `_id`.
  Expose **one** id and use it consistently in `/shifts/select`.

**`POST /shifts/select` — add the missing guards.** It currently creates an assignment with no checks
at all: no capacity check, no duplicate check (booking twice creates two assignments), no overlap
check, and `date: new Date()` **always** — so booking tomorrow's shift records today, and `/shifts/my`
(which sorts by `date`) is wrong. Add all four, gate on `status === 'active'`, and return the updated
slot in the shape above. New errors: `409 SHIFT_FULL`, `409 ALREADY_BOOKED`, `409 SHIFT_OVERLAP`,
`409 SHIFT_CLOSED`.

### 5.6 `POST /shifts/start` and `POST /shifts/end`

**Both apps** post `{ shiftId }` in the body.

**Live bug affecting both:** `picker.controller.startShift` and `endShift` read
`req.params.shiftId`, but the body-form routes `POST /shifts/start` and `POST /shifts/end` have no
path parameter — so the lookup is `findOne({ shiftId: undefined })` and **both endpoints always return
404**. The path variants (`/shifts/:shiftId/start`) work.

**Resolved spec:** read `shiftId` from `req.body.shiftId ?? req.params.shiftId`. Keep both routes.

Add for both apps:
- `isOnline` / `onlineSince` on `PickerUser` (no presence field exists today).
- A guard against two `STARTED` assignments at once → `409 ANOTHER_SHIFT_ACTIVE`.
- Optional geofence check against `PickerWorkLocation.geofenceRadius`, which exists for exactly this
  purpose and is unused → `403 OUTSIDE_GEOFENCE`.

Rider-specific on `/shifts/end`: block going offline mid-delivery (`409 ACTIVE_ORDER_IN_PROGRESS`) and
warn on undeposited COD (`409 UNDEPOSITED_CASH`). Return an end-of-shift summary.

### 5.7 `GET /documents` and `POST /documents/upload`

**Rider wants** stored rows `[{ _id, type, url, fileName, status, rejectionReason, reviewedAt, createdAt }]`, and a **one-step multipart** upload to `POST /documents` with `type: "aadhar"` and a `side` field for Aadhaar front/back.

**Picker wants** a **checklist** `[{ id: <type slug>, name, num (masked), verified, pending, status, rejectionReason }]` that **includes not-yet-uploaded types**, and a **two-step** upload: `POST /uploads` (multipart) returning a URL, then `POST /documents/upload` (JSON) with `{ type: "aadhaar", number, url, fileName }`.

**Conflicts:** list semantics (stored rows vs checklist); key (`_id` vs type slug); upload flow
(one-step vs two-step); and the type spelling `aadhar` vs `aadhaar`.

**Resolved spec:**

**Upload — adopt the Picker App's two-step flow for both apps.** It is strictly more flexible (the
same `/uploads` primitive serves KYC, selfies, avatars, device photos and rider POD photos), and it
matches the existing `PickerDocument` schema, which already requires a `url`.

1. `POST /uploads` — multipart, `file` + `purpose` (`kyc`|`face`|`avatar`|`device`|`pod`), image/PDF,
   ≤ 10 MB. Returns `{ url, fileName, mimeType, sizeBytes }`. Mirror the multer config already working
   in `src/modules/hhd/hhd.routes.ts`. **Build this first — five other endpoints depend on it.**
2. `POST /documents/upload` — JSON `{ type, number?, side?, url, fileName? }`.
   - `type` enum: `aadhaar | pan | dl | rc | insurance | photo | other` (canonical spelling).
   - `number` required for `aadhaar` (12 digits) and `pan` (`^[A-Z]{5}\d{4}[A-Z]$`) — **new field, no
     schema home today**.
   - `side` (`front`|`back`) required for `aadhaar` — the Rider App's UI says "Front & back photo" and
     the model currently cannot distinguish two rows of the same type.

**List — return the checklist superset:**

```json
[{ "id": "aadhaar", "documentId": "66f1e2...", "type": "aadhaar",
   "name": "Aadhaar card", "num": "•••• •••• 1234",
   "status": "approved", "verified": true, "pending": false,
   "url": "https://...", "fileName": "aadhaar-front.jpg",
   "rejectionReason": null, "reviewedAt": "...", "createdAt": "..." }]
```

- `id` is the **type slug** (React key for the Picker App); `documentId` is the Mongo `_id`.
- Include **expected-but-not-uploaded** types with `status: "missing"`, `documentId: null`,
  `num: "Not uploaded"`. The required set is role-dependent: rider needs
  `aadhaar, pan, dl, rc, insurance`; picker needs `aadhaar, pan, dl`.
- `verified` / `pending` are derived booleans kept for the Picker App.
- Never expose the raw Aadhaar or PAN number — always masked.

### 5.8 `GET /wallet/balance` and `GET /wallet/transactions`

**Rider wants** `/wallet/balance` **deprecated** in favour of `GET /wallet` (which is real and returns
`availableBalance`, `pendingBalance`, `reservedBalance`, `totalEarnings`).

**Picker wants** `/wallet/balance` as a 12-field payout view model: `{ month, netPayout, payDate,
available, availableAmount, pending, pendingAmount, currency, bankLabel, bankVerified, upiVerified,
minWithdrawal }`.

**Conflict:** the Rider App's plan would delete an endpoint the Picker App's Payouts screen depends on.

**Resolved spec — do not deprecate. Implement `/wallet/balance` as the Picker App specifies, and add
the raw balances so both work:**

```json
{
  "month": "March 2026", "netPayout": "₹18,450", "payDate": "5 Apr 2026",
  "available": "₹4,850", "availableAmount": 4850,
  "pending": "₹1,200", "pendingAmount": 1200,
  "reservedAmount": 0, "totalEarningsAmount": 64200,
  "currency": "INR",
  "bankLabel": "HDFC ••7821", "bankVerified": true, "upiVerified": false,
  "minWithdrawal": 100
}
```

`GET /wallet` stays as the raw-balance endpoint. Both are backed by the same `PickerWallet` read.

**`/wallet/transactions`** is **already fully implemented and correct** — paginated, scoped to the
caller, `data.transactions` matches both clients. Only add display fields (`amountDisplay`,
`dateDisplay`) and an optional `month` filter for the Picker App.

> **Rider App bug, no backend change needed:** `riderApi.getHistory()` calls
> `/wallet/transactions` but types the result as delivery history (`{ time, addr, num, items, dist,
> payout }`). The two shapes share **no fields**. Repoint it at `/shared-orders/completed`.

> **`POST /wallet/deposit`:** both apps call it and **it does not exist** — there is no such route, so
> it 404s. The Rider App then fabricates a receipt reference client-side
> (`'DP' + Math.random()`). See §6.3; the resolved home for this is `POST /cash/deposits`, and the
> Picker App must be repointed. **[DECISION-3]**

### 5.9 `GET /faq`, support tickets, support chat, push token

No structural conflicts — all four are stubs today and both apps want the same thing.

- **`/faq`** — stub returning `{ faqs: [] }`. A real FAQ module exists at `/customer/faq` (public,
  paginated, with categories). Proxy to it with an `audience` filter (`rider` / `picker`) and map to
  `{ id, q, a, category, order }`.
- **`/support/tickets`** GET + POST — both stubs; POST currently **echoes the request and stores
  nothing**, so both apps show users a ticket that does not exist. Bridge to the real support module
  (`/customer/support/tickets`) with a picker/rider requester type so tickets land in the same admin
  queue.
- **`/support/chat/*`** — `NEW` in both contracts. A working implementation already exists at
  `/api/v1/rider/support-chat/*` but is gated by **`authenticateCustomer`**, which resolves against
  `CustomerUser` — so a picker token always 401s. Re-expose the same controllers under
  `/picker/support/chat/*` behind `authenticatePicker`. Reuse the conversation model and admin console
  unchanged.
- **`/push-token`** — stub that stores nothing, so no push can ever be addressed. Persist per
  user + device (`token`, `platform`, `deviceId`, `appVersion`) and implement the send path.
  `POST /admin/picker/pickers/:id/push` is also a stub.

---

## 6. Rider-only work (summary)

Full specs in `RIDER_API_CONTRACT.md`. Three verticals are **entirely absent** from the backend.

### 6.1 Order lifecycle — all four handlers are stubs

`getAssignOrders`, `getSharedOrder`, `updateSharedOrderStatus` and `completeSharedOrder` return
hard-coded objects and never touch the database.

**`completeSharedOrder` is a security defect:** it returns `{ completed: true }` **unconditionally**,
without checking the delivery OTP. Any authenticated user can mark any order delivered with any four
digits, and the Rider App's "Incorrect OTP" branch is dead code.

The correct logic already exists at `order.controller.verifyOtp` (customer path): compares
`Order.deliveryOtp`, caps `otpAttempts` at 5 → 429, sets `status: 'delivered'` + `deliveredAt`, flips
`paymentStatus` `cod_pending → paid`, appends a timeline entry with `actor: 'rider'`. **Port it behind
`authenticatePicker` with rider ownership instead of customer ownership.**

Also required: `accepted` and `picked_up` are **not valid `Order.status` values** — add a separate
`riderStage` field. Add an atomic claim on accept (two riders currently both "succeed"), an ownership
check on every handler (IDOR), and an enum for `cancellationReason`.

### 6.2 Bulk delivery — 404s entirely

All five paths the Rider App calls (`/bulk/batch`, `/bulk/bag/load`, `/bulk/start`,
`/bulk/stops/:idx/deliver`, `/bulk/stops/:idx/fail`) are unregistered. Needs a new batch + stop model
and a bag model. The `Cluster` model and `dispatch.service.groupOrders` are the closest existing
concept but are admin-only and carry no per-stop state, sequence, bag or failure reason.

**Note:** the Rider App addresses stops by **array index**. Issue stable `stopId`s and accept both.

### 6.3 COD / floating cash — no model, no endpoints

`floatingCash`, `cashInHand`, `codCollect` and `/deposit` match **nothing** in the codebase.
`PickerWallet` is the *payout* wallet (money owed **to** the rider) — the exact inverse of COD float
(money the rider owes **to** the company). Netting them would be meaningless.

Needs: a `PickerCashLedger` model, a deposit record with a **server-issued** `ref`, automatic COD
credit on delivery completion, server-side limit enforcement, and reconciliation against orders in
`paymentStatus: 'cod_pending'`.

---

## 7. Picker-only work (summary)

Full specs in `PICKER_API_CONTRACT.md`. Mostly `MODIFY_REQUIRED` on real handlers, plus stubs:

- **Real and working:** attendance punch in/out + list, breaks, wallet + transactions + withdrawal,
  bank accounts, training videos + progress, notifications. These mainly need DTO shaping and display
  strings.
- **Stubs to implement:** `/shifts/readiness`, `/attendance/summary`, `/attendance/stats`,
  `/performance/summary`, `/performance/history`, `/devices/assigned`,
  `/devices/collection-complete`, `/verify/face`, `/manager/request-otp`, `/manager/verify-otp`,
  `/issues`, `/account/delete-request`, and every `/locations/*` handler.
- **New:** `GET /home/summary` (dashboard view model), `POST /uploads` (§5.7).

---

## 8. Build order

> **Read §0.5 first.** Much of Phases 3 and 4 is already implemented in the working tree. Treat the
> list below as a **verification checklist**, not a from-scratch plan: for each item, confirm the
> existing implementation matches the resolved spec in §5 before writing anything new.
>
> Most of Phase 0 is also done (JWT separation with an `aud` claim, rider shift-route auth, secret
> projection, `TEST_PHONES` gating).
>
> **The genuinely outstanding work is short:**
> 1. `role` discriminator on `PickerUser` — **[DECISION-1]**, blocks proper role scoping (Phase 1, item 6)
> 2. `GET /shifts/available` — remove `booked`, add `isBookedByMe` (§5.5) — Picker App currently broken
> 3. `GET /onboarding/state` — return the superset with `status` + named `steps[]` (§5.2) — Rider App currently broken
> 4. OTP rate limiting per identifier (Phase 0, item 5)
> 5. Verify `/documents` returns the checklist superset (§5.7) and `/user/profile` the role-scoped shape (§5.3)

Phases 0 and 1 are prerequisites. Phases 3–5 are independent and can run in parallel.

### Phase 0 — Security (before any feature work)

1. **Separate the picker JWT secret from `JWT_SECRET`**, or add an `aud`/`role` claim check to
   `authenticateAdmin`. Today `picker.auth.service` signs with `process.env.JWT_SECRET` and
   `authenticateAdmin` verifies with the *same* secret, so **a picker or rider token passes
   `authenticateAdmin`**. Role-only guards (`requireRole`) still deny, but every route protected by
   `authenticateAdmin` **alone** is reachable — including all of `/api/v1/rider/*` (dispatch, fleet,
   HR, compliance) and `/api/v1/admin/picker/*` (approve/reject pickers, process withdrawals).
2. **Add auth to `/api/v1/rider/shifts/*`.** Six rider-facing routes (`available/list`, `my`,
   `select`, `cancel`, `start`, `end`) are registered with **no auth middleware at all**, and three
   take `riderId` from the query or body. Anyone reachable on the network can read and mutate any
   rider's shift assignments.
3. **Stop returning `sessionToken` and `locationOtp`** from `getProfile` (§3).
4. **Verify `OTP_DEV_MODE` is off** in every deployed environment — it is on whenever
   `NODE_ENV !== 'production'` and returns the OTP **in the response body**. Remove
   `TEST_PHONES = { '9698790921': '8790' }` from production builds.
5. **Add per-identifier OTP rate limiting.** Only the global per-IP limiter applies today, and
   `send-otp` upserts `attempts: 0`, which resets the 5-attempt cap — so unlimited guesses are
   available to anyone who can also call send.

### Phase 1 — Foundations (unblocks everything)

6. Add `role: 'picker' | 'rider'` to `PickerUser`, indexed, and set it at account creation. **[DECISION-1]**
7. Add the missing `PickerUser` fields: `vehicleType`, `vehicleRegistrationNumber`, `isOnline`,
   `onlineSince`, `dob`, `altPhone`, `address`, `city`, `pincode`, `emergencyContact`, `hubId` (a real
   ref to `PickerWorkLocation`).
8. Build the shared DTO/mapper layer and the enum-mapping helpers from §3. Every shared handler uses it.
9. Fix `GET /user/profile` + `PUT` (§5.3) — explicit projection, no raw document, extended whitelist,
   Zod validation.
10. Implement `GET /onboarding/state` properly (§5.2). **Highest-priority functional defect** — no
    picker can currently reach the main app.
11. Extend both verify-OTP responses (§5.1).
12. Implement `POST /auth/logout` (clear `sessionToken`; `authenticatePicker` already compares `sid`
    against it, so no new infrastructure is needed).
13. Build `POST /uploads` (§5.7) — five endpoints depend on it.

### Phase 2 — Shared endpoints

14. `GET /shifts/available` — retire `booked`, add `isBookedByMe`, `date` filter, capacity (§5.5).
15. `POST /shifts/select` — the four missing guards, correct `date` (§5.5).
16. `POST /shifts/start` / `/end` — fix the `shiftId` source bug, add presence (§5.6).
17. `GET /documents` + `POST /documents/upload` (§5.7).
18. `GET /wallet/balance` (§5.8).
19. `GET /work-locations` — geo sorting + `2dsphere` index (§5.4).
20. `/faq`, `/support/tickets`, `/support/chat/*`, `/push-token` (§5.9).

### Phase 3 — Rider vertical A: orders

21. Rider↔order relation: index `Order.riderId`, settle the identity space (`PickerUser._id` vs the
    `RIDER-\d+` string on the separate `riders` collection). **[DECISION-4]**
22. `riderStage` field + guarded state machine + atomic accept claim + ownership checks.
23. `GET /shared-orders/assignorders`, `GET /:orderId`, `PUT /:orderId/status`.
24. `POST /:orderId/complete` with **real OTP verification** — port from `order.controller.verifyOtp`.
25. POD photo via `/uploads`; per-order rider payout persisted at assignment.
26. `GET /shared-orders/completed`.

### Phase 4 — Rider vertical B: bulk + cash

27. Bulk batch + stop model, bag model; batch producer over `Cluster`/`groupOrders`.
28. The nine `/bulk/*` endpoints.
29. `PickerCashLedger` + the three `/cash/*` endpoints; COD credit on completion; limit enforcement.

### Phase 5 — Picker vertical + remaining

30. The picker stubs listed in §7; `GET /home/summary`.
31. Rider dashboard/earnings: `/dashboard/today`, `/incentives/today`,
    `/wallet/earnings-breakdown`, `/wallet/history`.
32. `/settings/preferences`, `/config`, `/config/cancel-reasons`, `/legal/*`, `/locations/track`.
33. `POST /auth/refresh`.

---

## 9. Decisions needed before coding

| # | Decision | Status | Why it matters | Recommendation |
|---|---|---|---|---|
| **1** | How does the backend learn whether a new account is a rider or a picker? | ❌ **Open — blocking** | `verify-otp` auto-creates `PickerUser` records; with no signal, every account defaults to one role. Nothing in the schema distinguishes them today. | Send `X-Client-App: rider \| picker` from each app and set `role` from it on creation. An explicit `role` in the verify body is the alternative. |
| **2** | Should `authenticatePicker` let suspended accounts through on `/onboarding/state`? | ✅ **Resolved** | — | Done via `authenticatePickerAllowSuspended`, as recommended. |
| **3** | Where does cash deposit live, `/wallet/deposit` or `/cash/deposits`? | ✅ **Resolved** | — | Both routes registered against the same handler. No client change needed. |
| **4** | Which collection is the canonical rider identity — `PickerUser` or the operational `riders` collection (`RIDER-\d+`)? | ⚠️ **Verify** | `Order.riderId` is an unindexed string with no relation to either. Dispatch, ratings and fleet key off `riders`; the app authenticates against `PickerUser`. | Confirm what `picker.order.service.ts` assumed, then make it explicit and index it. |
| **5** | Do bulk stops require a customer OTP? | ✅ **Resolved** | — | Implemented as conditional per stop (`stop.requiresOtp`). Confirm the policy that sets that flag with operations. |
| **6** | Is the Rider App's `deliveryMode` rule (`auto`/`van` ⇒ bulk) correct? | ⚠️ **Open** | Derived client-side in `selectors.ts`; decides which entire vertical the rider sees. | Move it server-side onto the profile; confirm the vehicle→mode mapping with operations. |
| **7** | Which app wins on `/shifts/available` and `/onboarding/state`? | ❌ **Open — blocking** | Currently resolved in **opposite directions** (§0.5), so each app is broken on one of them. | Return the superset in §5.5 and §5.2 so neither app loses. |

---

## 10. Client-side follow-ups (not backend, tracked so they are not lost)

**Rider App**
- `environment.apiBaseUrl` points at port **3000**; the service runs on **3333**.
- Only **one** screen calls the API (`PhotoScreen.tsx:30`). Everything else reads `src/mock/*`.
- Token lives in a module-level variable and an in-memory `Map` — lost on restart. No 401 handling.
- `riderApi.getHistory` points at the wrong endpoint (§5.8).
- `riderApi.recordDeposit` fabricates a receipt `ref` when the call fails — remove it.
- Three conflicting earnings shapes (`riderApi.EarningsSummary`, `WEEK_EARNINGS`, backend).
- Map `booked` → `isBookedByMe`.

**Picker App**
- `ProfileScreen` does not call `/user/profile` — it renders `mockPicker`.
- No storage service and no file picker; `/uploads` needs a client.
- No 401 interceptor / login redirect.
- Map `booked` → `bookedCount`; adopt lowercase enums; read `hub.name` from the object.

**Both**
- Each falls back to bundled mocks on `null` but **not** on a wrong shape — a `200` with the wrong
  fields silently replaces the mock and breaks the screen. Shape correctness is critical.
