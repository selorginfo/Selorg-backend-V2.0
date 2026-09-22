# API Contract — Selorg Picker App (New Frontend)

**Frontend:** `Selorg PickerApp V1.3` (React Native)
**Backend:** `selorg-service`, picker module mounted at `/api/v1/picker`
**Date:** 2026-09-04

This contract covers **only** the APIs the new picker frontend needs. Each entry is marked `EXISTING`, `MODIFY_REQUIRED`, or `NEW`, and states exactly what the frontend sends and expects.

---

## 1. Conventions

### Base URL

```
{scheme}://{host}:{port}/api/v1/picker
```

Configured in `src/constants/config.ts` as `apiBaseUrl`. Currently `http://localhost:3333/api/v1/picker`.

### Request headers

| Header | Value | When |
|---|---|---|
| `Content-Type` | `application/json` | Always |
| `Accept` | `application/json` | Always |
| `Authorization` | `Bearer <jwt>` | All routes except those marked *Public* |

The frontend client (`src/services/api/client.ts`) reads the token from local storage key `token` and attaches it automatically unless the call passes `auth: false`.

### Timeout

20 000 ms (`config.apiTimeoutMs`), enforced client-side via `AbortController`. On timeout the client raises `ApiError(0, 'Request timed out')`.

### Success envelope

Every response is wrapped by `ResponseFormatter.success`:

```json
{
  "success": true,
  "message": "Success",
  "data": { },
  "error": null,
  "pagination": null,
  "timestamp": "2026-09-04T10:15:00.000Z"
}
```

**The frontend unwraps `data` and hands only that to the caller.** Every "Response structure" section below therefore describes the **contents of `data`**, not the envelope.

### Paginated envelope

`ResponseFormatter.paginated` populates the envelope's `pagination` field:

```json
{
  "success": true,
  "message": "Items fetched successfully",
  "data": [ ],
  "error": null,
  "pagination": { "total": 120, "page": 1, "limit": 20, "pages": 6, "hasNextPage": true, "hasPrevPage": false },
  "timestamp": "2026-09-04T10:15:00.000Z"
}
```

> **Critical convention.** The frontend client returns `parsed.data` directly. When a screen renders a list it calls `.map()` on that value, so **`data` must be the array itself**. List metadata belongs in `pagination`, never wrapped around the array inside `data`. Several current endpoints violate this and crash the app — each is flagged below.

### Error envelope

```json
{
  "success": false,
  "message": "Invalid or expired OTP. Please try again.",
  "data": null,
  "error": {
    "code": 400,
    "appCode": "OTP_EXPIRED",
    "title": "Bad Request",
    "message": "Invalid or expired OTP. Please try again.",
    "detail": "Invalid or expired OTP. Please try again.",
    "details": null
  },
  "pagination": null,
  "timestamp": "2026-09-04T10:15:00.000Z"
}
```

The frontend reads the **top-level `message`** and surfaces it to the user. Any error response omitting top-level `message` degrades to `"HTTP <status>"`.

> `picker.auth.middleware.ts` currently returns `{ success: false, error: { code, message } }` with **no top-level `message`**. All 401/403 responses should be migrated to `ResponseFormatter.error`.

### Standard error statuses

| Status | Meaning | Frontend behaviour |
|---|---|---|
| 400 | Bad request / validation | Shows `message` in a toast |
| 401 | Missing, invalid, or expired token | Shows `message`; **no redirect to login today** — needs a frontend interceptor |
| 403 | Account suspended / not permitted | Shows `message` |
| 404 | Resource not found | Shows `message` |
| 409 | Conflict (duplicate) | Shows `message` |
| 422 | Validation error with field details | Shows `message` (field details unused) |
| 429 | Rate limited | Shows `message` |
| 500 | Server error | Shows generic message |

### Enums

| Enum | Frontend values | Backend values | Status |
|---|---|---|---|
| Picker status | `PENDING`, `ACTIVE`, `REJECTED`, `BLOCKED`, `SUSPENDED`, `DELETION_PENDING` | `PENDING`, `ACTIVE`, `INACTIVE`, `REJECTED`, `SUSPENDED` | **Mismatch** — no `BLOCKED`/`DELETION_PENDING`; `INACTIVE` unused by FE |
| Onboarding state | `ONBOARDING`, `ACTIVE`, `REJECTED`, `BLOCKED`, `SUSPENDED` | stub returns `'pending'` | **Mismatch** |
| Login channel | `mobile`, `whatsapp`, `email` | `mobile`, `whatsapp`, `email` | OK |
| Preferred channel (request) | `sms`, `whatsapp` | `sms`, `whatsapp` | OK |
| Withdrawal status | `PENDING`, `APPROVED`, `PAID`, `REJECTED` | `PENDING`, `APPROVED`, `REJECTED`, `PAID` | OK |
| Document status | `verified` / `pending` (booleans) | `pending`, `approved`, `rejected` | **Needs mapping** |
| Gender | `Male`, `Female`, `Other` | `male`, `female` | **Mismatch** |
| Location type | `Darkstore`, `Warehouse` | `darkstore`, `warehouse` | **Case mismatch** |
| Badge tone | `success`, `warning`, `danger`, `neutral`, `info` | — | Frontend-only, must be derived server-side for view-model endpoints |
| Attendance status | — | `present`, `half-day`, `absent`, `ON_DUTY`, `COMPLETED`, `ON_BREAK` | Backend mixes two axes |
| Emergency relation | `Spouse`, `Parent`, `Sibling`, `Friend` | — | No backend field |

### Dates and formatting

The frontend renders **pre-formatted display strings** rather than formatting raw values itself. Endpoints marked as returning a view model must emit:

| Kind | Format | Example |
|---|---|---|
| Currency | `₹` + thousands separators | `"₹18,450"` |
| Month label | `MMMM YYYY` | `"March 2026"` |
| Pay date | `D MMM YYYY` | `"5 Apr 2026"` |
| Row date | `ddd, DD MMM` | `"Wed, 11 Mar"` |
| Duration | `Xh YYm` | `"9h 02m"` |
| Live timer | `HH:MM:SS` | `"07:24:10"` |
| Relative time | human | `"2h ago"`, `"Yesterday"` |
| Video duration | `X min` | `"12 min"` |
| Raw timestamps | ISO 8601 UTC | `"2026-09-04T10:15:00.000Z"` |

Raw numeric fields are supplied alongside formatted ones where the frontend does arithmetic (e.g. `available: "₹4,850"` **and** `availableAmount: 4850`).

### Null and empty conventions

- Lists must return `[]`, never `null` — the frontend calls `.map()` unconditionally.
- Optional scalars should be `null`, not omitted, so `??` fallbacks behave predictably.
- The frontend's `apiData ?? mockShape` fallback fires only on `null`/`undefined`. A `200` with a wrong shape **replaces** the mock and breaks the screen.

---

## 2. API Index

| # | API | Method | Endpoint | Status |
|---|---|---|---|---|
| 1 | Send OTP (phone) | POST | `/auth/send-otp` | `EXISTING` |
| 2 | Send OTP (email) | POST | `/auth/send-otp-email` | `EXISTING` |
| 3 | Resend OTP (phone) | POST | `/auth/resend-otp` | `EXISTING` |
| 4 | Resend OTP (email) | POST | `/auth/resend-otp-email` | `EXISTING` |
| 5 | Verify OTP (phone) | POST | `/auth/verify-otp` | `EXISTING` |
| 6 | Verify OTP (email) | POST | `/auth/verify-otp-email` | `EXISTING` |
| 7 | Logout | POST | `/auth/logout` | `NEW` |
| 8 | Onboarding state | GET | `/onboarding/state` | `MODIFY_REQUIRED` |
| 9 | Get profile | GET | `/user/profile` | `MODIFY_REQUIRED` |
| 10 | Update profile | PUT | `/user/profile` | `MODIFY_REQUIRED` |
| 11 | Profile overview | GET | `/user/profile/overview` | `MODIFY_REQUIRED` |
| 12 | Set location type | PUT | `/user/location-type` | `MODIFY_REQUIRED` |
| 13 | Set UPI | PUT | `/user/upi` | `MODIFY_REQUIRED` |
| 14 | List work locations | GET | `/work-locations` | `MODIFY_REQUIRED` |
| 15 | List available shifts | GET | `/shifts/available` | `MODIFY_REQUIRED` |
| 16 | List training videos | GET | `/training/videos` | `MODIFY_REQUIRED` |
| 17 | Track watch progress | PUT | `/training/watch-progress` | `MODIFY_REQUIRED` |
| 18 | Complete training video | POST | `/training/complete/:videoId` | `MODIFY_REQUIRED` |
| 19 | Training progress | GET | `/training/user-progress` | `MODIFY_REQUIRED` |
| 20 | Upload document | POST | `/documents/upload` | `MODIFY_REQUIRED` |
| 21 | List documents | GET | `/documents` | `MODIFY_REQUIRED` |
| 22 | Upload file | POST | `/uploads` | `NEW` |
| 23 | Face verification | POST | `/verify/face` | `MODIFY_REQUIRED` |
| 24 | Request manager OTP | POST | `/manager/request-otp` | `MODIFY_REQUIRED` |
| 25 | Verify manager OTP | POST | `/manager/verify-otp` | `MODIFY_REQUIRED` |
| 26 | Confirm device collection | POST | `/devices/collection-complete` | `MODIFY_REQUIRED` |
| 27 | Get assigned device | GET | `/devices/assigned` | `MODIFY_REQUIRED` |
| 28 | Report issue | POST | `/issues` | `MODIFY_REQUIRED` |
| 29 | Home dashboard | GET | `/home/summary` | `NEW` |
| 30 | Shift readiness | GET | `/shifts/readiness` | `MODIFY_REQUIRED` |
| 31 | Start shift | POST | `/shifts/start` | `MODIFY_REQUIRED` |
| 32 | End shift | POST | `/shifts/end` | `MODIFY_REQUIRED` |
| 33 | Select shift | POST | `/shifts/select` | `MODIFY_REQUIRED` |
| 34 | Start / end break | POST | `/shifts/break/start`, `/shifts/break/end` | `MODIFY_REQUIRED` |
| 35 | Punch in | POST | `/attendance/punch-in` | `MODIFY_REQUIRED` |
| 36 | Punch out | POST | `/attendance/punch-out` | `MODIFY_REQUIRED` |
| 37 | Attendance summary | GET | `/attendance/summary` | `MODIFY_REQUIRED` |
| 38 | Attendance stats | GET | `/attendance/stats` | `MODIFY_REQUIRED` |
| 39 | Work history | GET | `/attendance` | `MODIFY_REQUIRED` |
| 40 | Wallet balance | GET | `/wallet/balance` | `MODIFY_REQUIRED` |
| 41 | Transactions | GET | `/wallet/transactions` | `MODIFY_REQUIRED` |
| 42 | Withdraw | POST | `/wallet/withdraw` | `MODIFY_REQUIRED` |
| 43 | List bank accounts | GET | `/bank/accounts` | `MODIFY_REQUIRED` |
| 44 | Add bank account | POST | `/bank/accounts` | `MODIFY_REQUIRED` |
| 45 | Verify bank account | POST | `/bank/verify` | `MODIFY_REQUIRED` |
| 46 | Performance summary | GET | `/performance/summary` | `MODIFY_REQUIRED` |
| 47 | List notifications | GET | `/notifications` | `MODIFY_REQUIRED` |
| 48 | Mark all read | PUT | `/notifications/read-all` | `MODIFY_REQUIRED` |
| 49 | Mark one read | PUT | `/notifications/:id/read` | `MODIFY_REQUIRED` |
| 50 | Register push token | POST | `/push-token` | `MODIFY_REQUIRED` |
| 51 | List FAQs | GET | `/faq` | `MODIFY_REQUIRED` |
| 52 | Create support ticket | POST | `/support/tickets` | `MODIFY_REQUIRED` |
| 53 | List support tickets | GET | `/support/tickets` | `MODIFY_REQUIRED` |
| 54 | Support chat | — | `/support/chat/*` | `NEW` |
| 55 | Request account deletion | POST | `/account/delete-request` | `MODIFY_REQUIRED` |

Sections 3–13 document each of these.

---

## 3. Authentication

### 3.1 Send OTP (phone / WhatsApp)

#### Status
`EXISTING`

#### Frontend Usage
- **Page:** `src/screens/auth/LoginScreen.tsx`
- **Component:** `TextField` (phone) + `SegmentedControl` (channel) + `PrimaryButton` "Send OTP"
- **Service:** `authApi.sendOtp` → `src/services/api/authApi.ts`
- **Hook:** `useAuth.sendOtp`
- **User action:** Picker enters a 10-digit mobile number, selects Mobile or WhatsApp, accepts the Terms checkbox, taps **Send OTP**.
- **Why needed:** Primary authentication. The app has no password login — OTP is the only entry path.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/auth/send-otp` |
| Authentication | **None** (public) |
| Authorization | — |
| Headers | `Content-Type: application/json`, `Accept: application/json` |
| Path parameters | — |
| Query parameters | — |

**Body**

```json
{ "phone": "9876543210", "preferredChannel": "sms" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `phone` | string | **Yes** | 10 digits after normalization. Server strips non-digits and handles `+91` (12-digit), leading `0` (11-digit), and >10-digit inputs by taking the last 10. All-zero rejected. |
| `preferredChannel` | string | No | `"sms"` \| `"whatsapp"`. Defaults to `"sms"`. The frontend maps its `whatsapp` channel to `"whatsapp"` and `mobile` to `"sms"`. |

#### Response

**200 OK** — `data`:

```json
{ "success": true, "message": "OTP sent successfully", "channel": "sms" }
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `success` | boolean | Yes | No | Service-level flag nested inside `data` (distinct from the envelope's) |
| `message` | string | Yes | No | |
| `channel` | string | Yes | No | `"sms"` \| `"whatsapp"` |
| `otp` | string | No | No | **Present only in dev mode.** Must never appear in production. |

The frontend types this as `{ ok: boolean }` and does not read any field — it only awaits success before navigating to the OTP screen.

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Phone not 10 digits | `"Please provide a valid 10-digit mobile number."` (`appCode: INVALID_PHONE`) |
| 400 | SMS gateway failure | `"Failed to send OTP. Please try again."` (`appCode: SMS_GATEWAY_ERROR`) |
| 429 | Global IP rate limit | Rate-limit message |
| 500 | Unexpected | Generic |

#### Existing Backend Comparison

- **Existing endpoint:** `POST /api/v1/picker/auth/send-otp` → `picker.controller.sendOtp` → `picker.auth.service.sendOtp`.
- **Why compatible:** Field names (`phone`, `preferredChannel`) and the channel enum match exactly. Phone normalization is server-side, so the frontend's raw 10-digit input is accepted. A 4-digit OTP is generated, stored in `PickerOtp` with a 5-minute TTL, and dispatched via `sendOtpSms`. The frontend ignores the response body, so field-level differences are immaterial.
- **Production caveats (no contract change):** disable `OTP_DEV_MODE` so `otp` is not echoed; remove the `TEST_PHONES` bypass; add per-phone rate limiting.

---

### 3.2 Send OTP (email)

#### Status
`EXISTING` *(contract-compatible; delivery not implemented)*

#### Frontend Usage
- **Page:** `LoginScreen` with the Email channel selected
- **Service:** `authApi.sendOtp` (email branch)
- **User action:** Picker enters an email address and taps **Send OTP**.
- **Why needed:** Alternative login for pickers without a reachable mobile number.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/auth/send-otp-email` |
| Authentication | **None** (public) |

**Body**

```json
{ "email": "rahul.verma@gmail.com" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `email` | string | **Yes** | `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, lower-cased and trimmed server-side |

#### Response

**200 OK** — `data`: `{ "success": true, "message": "OTP sent successfully", "channel": "email" }` (plus `otp` in dev mode).

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Invalid email | `"Please enter a valid email address."` (`appCode: INVALID_PHONE` — misnamed, see below) |
| 429 | Rate limited | Rate-limit message |

#### Existing Backend Comparison

- **Existing endpoint:** `POST /auth/send-otp-email` → `picker.auth.service.sendOtpEmail`.
- **Why compatible:** The request field name matches and the OTP is stored under the identifier `email|<address>`, so verification works.
- **Gaps that do not change the contract:** (1) **No email is actually sent** — the service stores the OTP and returns success with no mail transport call, so this only works in dev mode where the OTP is echoed. (2) The `appCode` for an invalid email is `INVALID_PHONE`; it should be `INVALID_EMAIL`.

---

### 3.3 Resend OTP (phone and email)

#### Status
`EXISTING`

#### Frontend Usage
- **Page:** `src/screens/auth/OtpScreen.tsx`
- **Component:** "Resend OTP" link, disabled while `resendIn > 0`
- **Service:** `authApi.resendOtp`
- **Hook:** `useAuth.resendOtp` — no-ops while the cooldown is active
- **User action:** After the 24-second cooldown (`config.resendCooldownSec`), the picker taps **Resend OTP**.
- **Why needed:** Recovery when the first OTP does not arrive.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/auth/resend-otp` (phone) or `/auth/resend-otp-email` (email) |
| Authentication | **None** (public) |

**Body — phone**

```json
{ "phone": "9876543210" }
```

**Body — email**

```json
{ "email": "rahul.verma@gmail.com" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `phone` | string | Yes (phone variant) | Same as 3.1 |
| `email` | string | Yes (email variant) | Same as 3.2 |

> The frontend does **not** send `preferredChannel` on resend, so the server defaults to `"sms"`. A picker who chose WhatsApp receives the resent OTP over SMS. Minor behavioural inconsistency; either the frontend should send the channel or the server should remember the original choice.

#### Response

**200 OK** — identical to 3.1 / 3.2.

#### Error Responses

Identical to 3.1 / 3.2.

#### Existing Backend Comparison

- **Existing endpoints:** `POST /auth/resend-otp`, `POST /auth/resend-otp-email` — both delegate directly to `sendOtp` / `sendOtpEmail`.
- **Why compatible:** Same contract as the send endpoints; `storeOtp` upserts by identifier, so a resend replaces the prior code and resets `attempts` to 0.
- **Note:** Because `attempts` resets on every resend, the 5-attempt lockout can be bypassed by resending. A per-identifier resend limit is recommended (see the gap analysis, auth gap #9).

---

### 3.4 Verify OTP (phone)

#### Status
`EXISTING`

#### Frontend Usage
- **Page:** `src/screens/auth/OtpScreen.tsx`
- **Component:** `OtpInput` (4 boxes) + `PrimaryButton` "Verify"
- **Service:** `authApi.verifyOtp`
- **Hook:** `useAuth.verifyOtp` — on success writes the token to storage key `token`, dispatches `auth/loginSuccess`, then calls `GET /onboarding/state` to decide whether to land on `Main` or `Onboarding`.
- **User action:** Picker enters the 4-digit code and taps **Verify**.
- **Why needed:** Issues the JWT that authorizes every other call in the app.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/auth/verify-otp` |
| Authentication | **None** (public) |

**Body**

```json
{ "phone": "9876543210", "otp": "8790" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `phone` | string | **Yes** | Normalized to 10 digits |
| `otp` | string | **Yes** | Exactly 4 numeric digits (`/^\d{4}$/`) — matches `config.otpLength` |
| `preferredChannel` | string | No | Accepted by the server; **the frontend does not send it** on verify |
| `storeId` | string | No | Accepted; not sent by the frontend |

#### Response

**200 OK** — `data`:

```json
{
  "success": true,
  "message": "OTP verified",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "isNewUser": false,
  "user": {
    "id": "66f1a2b3c4d5e6f708192a3b",
    "phone": "9876543210",
    "email": null,
    "loginMethod": "mobile"
  }
}
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `token` | string | **Yes** | No | JWT, 7-day expiry. Payload: `{ sub, userId, sid }`. **The only field the frontend reads.** |
| `isNewUser` | boolean | Yes | No | True when the `PickerUser` was created by this call |
| `user.id` | string | Yes | No | Mongo ObjectId as a string |
| `user.phone` | string | Yes | No | |
| `user.email` | string | Yes | **Yes** | `null` for phone logins |
| `user.loginMethod` | string | Yes | No | `"mobile"` \| `"whatsapp"` \| `"email"` |

#### Error Responses

| Status | Case | `message` | `appCode` |
|---|---|---|---|
| 400 | Missing phone or OTP | `"Phone and OTP are required"` | — |
| 400 | OTP not 4 digits | `"OTP must be exactly 4 numeric digits"` | `INCORRECT_OTP` |
| 400 | Invalid phone | `"Invalid phone number."` | `INVALID_PHONE` |
| 400 | Wrong, expired, or >5 attempts | `"Invalid or expired OTP. Please try again."` | `OTP_EXPIRED` |
| 429 | Rate limited | Rate-limit message | — |

> The same `OTP_EXPIRED` code covers wrong-code, expired, and locked-out. The frontend shows the message verbatim and does not branch, so this is acceptable — but distinct codes would let the UI offer a targeted action (e.g. "resend" vs "try again").

#### Existing Backend Comparison

- **Existing endpoint:** `POST /auth/verify-otp` → `picker.auth.service.verifyOtp`.
- **Why compatible:** Request fields match exactly. `data.token` is present and is the only field the frontend consumes. The service creates the `PickerUser` on first verification, rotates `sessionToken`, and signs a JWT carrying `sid` — which `authenticatePicker` then validates, so the session model is coherent end to end.
- **One type-declaration discrepancy (no runtime impact):** the frontend declares the response as `{ token: string; onboardingComplete: boolean }`. The backend returns `isNewUser`, not `onboardingComplete`. Nothing reads the field — `useAuth` calls `GET /onboarding/state` separately — so the contract holds, but the frontend type should be corrected to `{ token: string; isNewUser: boolean; user: {...} }`.

---

### 3.5 Verify OTP (email)

#### Status
`EXISTING`

#### Frontend Usage
Same screen and hook as 3.4, taken when `auth.channel === 'email'`.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/auth/verify-otp-email` |
| Authentication | **None** (public) |

**Body**

```json
{ "email": "rahul.verma@gmail.com", "otp": "4821" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `email` | string | **Yes** | Valid email, lower-cased |
| `otp` | string | **Yes** | Exactly 4 digits |

#### Response

**200 OK** — same shape as 3.4, with `user.loginMethod = "email"` and `user.email` populated.

#### Error Responses

| Status | Case | `message` | `appCode` |
|---|---|---|---|
| 400 | Invalid email | `"Please enter a valid email address."` | `INVALID_PHONE` |
| 400 | OTP not 4 digits | `"OTP must be exactly 4 numeric digits"` | `INCORRECT_OTP` |
| 400 | Wrong or expired | `"Invalid or expired OTP. Please try again."` | `OTP_EXPIRED` |

#### Existing Backend Comparison

- **Existing endpoint:** `POST /auth/verify-otp-email` → `verifyOtpEmail`.
- **Why compatible:** Same token contract as 3.4; the frontend's single `verifyOtp` handler treats both branches identically.
- **Implementation concern (not a contract break):** `PickerUser.phone` is `required` and `unique`, so email-only signups are given a **synthetic phone** derived from an MD5 of the email (`syntheticPhone`). This is collision-prone and pollutes the phone namespace. Making `phone` optional with a sparse unique index would be cleaner.

---

### 3.6 Logout

#### Status
`NEW`

#### Frontend Usage
- **Page:** `src/screens/profile/ProfileScreen.tsx` → `src/overlays/LogoutConfirmModal.tsx`
- **Component:** "Log out" menu row → confirmation modal
- **Hook:** `useAuth.logout`
- **User action:** Picker taps **Log out** and confirms.
- **Why needed:** `useAuth.logout` currently only removes the token from local storage and resets navigation. `PickerUser.sessionToken` is never cleared, so a JWT captured before logout stays valid for its full 7-day life. The session-invalidation machinery already exists in the middleware (`decoded.sid !== user.sessionToken → 401`); only the endpoint that clears it is missing.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/auth/logout` |
| Authentication | **Required** — `Authorization: Bearer <jwt>` |
| Authorization | Any authenticated picker (including non-`ACTIVE`) |
| Path / query parameters | — |
| Body | Empty (`{}`) |

#### Response

**200 OK** — `data`:

```json
{ "ok": true }
```

| Field | Type | Required | Nullable |
|---|---|---|---|
| `ok` | boolean | Yes | No |

#### Error Responses

| Status | Case |
|---|---|
| 401 | Missing or invalid token — the frontend should clear local state and reset to the auth stack regardless |

The frontend must treat this call as best-effort: clear local storage and navigate even if the request fails (offline logout).

#### Existing Backend Comparison — `NEW`

- **Why existing APIs cannot satisfy the frontend:** there is no logout, session-revocation, or token-invalidation route anywhere in `picker.routes.ts`. Nothing in the module ever writes `sessionToken` back to `null` after the initial login rotation.
- **Proposed contract:**
  - Request: `POST /auth/logout`, bearer auth, empty body.
  - Behaviour: `PickerUser.findByIdAndUpdate(pickerId, { sessionToken: null })`. Every subsequent request presenting the old JWT then fails the `sid` check in `authenticatePicker` and receives 401 `AUTH_SESSION_EXPIRED`.
  - Response: `200 { "ok": true }`.
  - Errors: `401` only.
- **Frontend change required:** add `authApi.logout()` and call it from `useAuth.logout` before clearing storage.

---

## 4. Onboarding State

### 4.1 Get onboarding state

#### Status
`MODIFY_REQUIRED` — **highest-priority defect in the integration**

#### Frontend Usage
- **Pages:** `src/screens/auth/OtpScreen.tsx` (immediately after OTP verification) and `src/screens/onboarding/StatusGateScreen.tsx`
- **Service:** `authApi.onboardingState` and `onboardingApi.getState`
- **Hook:** `useAuth.verifyOtp`
- **User action:** Implicit — runs on every successful login, and again while the picker waits on the status gate.
- **Why needed:** This single value decides whether the app shows the main tab bar or the onboarding wizard. It is also the mechanism by which an approved picker is released from the "under review" screen.

The exact frontend logic (`src/hooks/useAuth.ts`):

```ts
const { state: obState } = await authApi.onboardingState();
if (obState === 'ACTIVE') { resetTo('Main'); }
else { dispatch({ type: 'ob/setStep', step: 1 }); resetTo('Onboarding'); }
```

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/onboarding/state` |
| Authentication | **Required** — bearer |
| Authorization | Any authenticated picker, any status |
| Path / query parameters | — |
| Body | — |

#### Response

**200 OK** — `data`:

```json
{
  "state": "ONBOARDING",
  "step": 3,
  "completedSteps": [1, 2],
  "submittedForReviewAt": null,
  "rejectionReason": null
}
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `state` | string | **Yes** | No | `"ONBOARDING"` \| `"ACTIVE"` \| `"REJECTED"` \| `"BLOCKED"` \| `"SUSPENDED"`. **Must be exactly one of these, upper-case.** |
| `step` | number | No | No | Current wizard step, 1–8. Lets the app resume mid-onboarding instead of always restarting at step 1. |
| `completedSteps` | number[] | No | No | `[]` when none |
| `submittedForReviewAt` | string | No | **Yes** | ISO 8601; non-null once step 7 is submitted. Drives the "under review" gate. |
| `rejectionReason` | string | No | **Yes** | Populated when `state = "REJECTED"`; shown on the rejection gate |

Only `state` is consumed today. The other four fields close the "progress is lost on reinstall" gap described in the analysis and are strongly recommended.

#### Error Responses

| Status | Case |
|---|---|
| 401 | Missing / invalid / expired token |
| 403 | Account suspended — **note:** the middleware blocks `SUSPENDED` with 403 *before* the handler runs, so the frontend can never observe `state: "SUSPENDED"` here. To make the suspended gate reachable, either allow `SUSPENDED` through on this route specifically or have the frontend map the 403 to the suspended gate. |
| 404 | Picker not found |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract** (`picker.controller.getOnboardingState`, a stub):

```json
{ "userId": "66f1a2b3c4d5e6f708192a3b", "state": "pending", "steps": [] }
```

**Frontend expected contract:**

```json
{ "state": "ACTIVE" }
```

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| `state` value | `"pending"` (hardcoded literal, lower-case) | `"ACTIVE"` \| `"ONBOARDING"` \| `"REJECTED"` \| `"BLOCKED"` \| `"SUSPENDED"` | `"pending"` is in neither union. `obState === 'ACTIVE'` is **always false**, so **every user — approved or not — is routed back into the onboarding wizard on every login. No picker can ever reach the main app.** |
| Data source | None — a constant. `PickerUser.status` is never read. | Must reflect the picker's real status | Admin approval (`PUT /admin/picker/pickers/:id/approve`, which correctly sets `status: 'ACTIVE'`) has **no observable effect on the app**. |
| `steps` | Always `[]` | — | No resume capability; a reinstall restarts onboarding from step 1 |
| Extra field | `userId` echoed | Not expected | Harmless |

**Required change:**

1. Read `PickerUser` and map `status` to the frontend enum:

   | `PickerUser.status` | Additional condition | Return `state` |
   |---|---|---|
   | `ACTIVE` | — | `"ACTIVE"` |
   | `PENDING` | — | `"ONBOARDING"` |
   | `REJECTED` | — | `"REJECTED"` |
   | `SUSPENDED` | — | `"SUSPENDED"` |
   | `INACTIVE` | — | `"BLOCKED"` |

2. Add `BLOCKED` to the `PickerUser.status` enum, or formalise the `INACTIVE → BLOCKED` mapping above.
3. Add onboarding-progress persistence (current step, completed steps, `submittedForReviewAt`) — see *Database / Model Gaps* #5 in the analysis — and return them.
4. Decide how the middleware's 403-on-`SUSPENDED` interacts with this route, so the suspended gate is actually reachable.

---

## 5. Profile

### 5.1 Get profile

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Pages:** `src/screens/profile/ProfileScreen.tsx` (header: avatar initials, name, `Picker · ID 4821`, status badge), `src/screens/profile/EditProfileScreen.tsx` (prefill)
- **Service:** `profileApi.getProfile`
- **User action:** Opens the Profile tab, or Profile → Edit Profile.
- **Why needed:** Supplies the picker's identity everywhere it is displayed.

> **Current frontend state:** `ProfileScreen` does **not** call this endpoint — it renders `mockPicker` from `src/mock/profile.ts` and the header name is hardcoded. Wiring the screen is a frontend task tracked in the analysis; the contract below is what it must consume.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/user/profile` |
| Authentication | **Required** — bearer |
| Authorization | Own profile only; `pickerId` is taken from the token, never from a parameter |
| Path / query parameters | — |

#### Response

**200 OK** — `data`:

```json
{
  "id": "4821",
  "name": "Rahul Verma",
  "phone": "+91 98765 43210",
  "email": "rahul.verma@gmail.com",
  "status": "ACTIVE",
  "memberSince": "Jan 2026",
  "hub": "Indiranagar Darkstore",
  "role": "Picker",
  "photoUri": null,
  "dob": "1998-04-12",
  "gender": "Male",
  "altPhone": null,
  "address": null,
  "city": null,
  "pincode": null,
  "emergencyContact": { "name": null, "phone": null, "relation": null }
}
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `id` | string | **Yes** | No | Displayed as `ID {id}`. Either the ObjectId or a short human-readable picker code. |
| `name` | string | **Yes** | **Yes** | `null` until onboarding step 1 |
| `phone` | string | **Yes** | No | Display format `"+91 98765 43210"` |
| `email` | string | **Yes** | **Yes** | |
| `status` | string | **Yes** | No | Frontend `PickerStatus` enum |
| `memberSince` | string | **Yes** | **Yes** | `"MMM YYYY"`, derived from `createdAt` |
| `hub` | string | **Yes** | **Yes** | Work-location name |
| `role` | string | **Yes** | No | Defaults to `"Picker"` |
| `photoUri` | string | No | **Yes** | Avatar URL |
| `dob` | string | No | **Yes** | `YYYY-MM-DD` for form prefill |
| `gender` | string | No | **Yes** | `"Male"` \| `"Female"` \| `"Other"` |
| `altPhone`, `address`, `city`, `pincode` | string | No | **Yes** | Personal Information prefill |
| `emergencyContact` | object | No | **Yes** | `{ name, phone, relation }`, each nullable |

**Must not be returned:** `sessionToken`, `locationOtp`, `locationOtpForLocationId`, `__v`.

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 401 | Invalid / expired token | Auth message |
| 404 | Picker not found | `"User not found"` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract** — `picker.service.getProfile` returns `PickerUser.findById(userId).lean()`, i.e. the **entire raw document**:

```json
{
  "_id": "66f1a2b3c4d5e6f708192a3b",
  "phone": "9876543210",
  "status": "PENDING",
  "email": null,
  "loginMethod": "mobile",
  "name": "Rahul Verma",
  "selectedShifts": [],
  "trainingProgress": { "video1": 0, "video2": 0, "video3": 0, "video4": 0 },
  "trainingCompleted": false,
  "upiPayoutVerificationStatus": "none",
  "faceVerificationStatus": "pending",
  "onBreak": false,
  "sessionToken": "8f14e45f-ceea-467a-9f4c-2b1d3a5e7c90",
  "locationOtp": "4821",
  "locationOtpForLocationId": "indiranagar",
  "deletionReason": "",
  "createdAt": "2026-01-08T06:30:00.000Z",
  "updatedAt": "2026-09-04T09:12:00.000Z"
}
```

**Frontend expected contract:** the projected object in the Response section above.

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| Identifier | `_id` | `id` | `ID undefined` in the profile header |
| `memberSince` | Absent (`createdAt` is raw ISO) | `"Jan 2026"` | Blank |
| `hub` | Absent (`currentLocationId` is a key, unresolved) | `"Indiranagar Darkstore"` | Blank |
| `role` | Absent (no schema field; `employment.role` is unpopulated) | `"Picker"` | Blank |
| `phone` | `"9876543210"` | `"+91 98765 43210"` | Unformatted |
| `dob`, `altPhone`, `address`, `city`, `pincode`, `emergencyContact` | **No schema fields** | Needed for form prefill | Edit/Personal Info forms cannot prefill |
| **Secrets** | `sessionToken`, `locationOtp` returned | Must not be exposed | **Security defect** — `sessionToken` is the value `authenticatePicker` matches `sid` against; exposing it undermines session revocation |

**Required change:**

1. Add an explicit projection — replace `.lean()` with a mapped DTO. Never spread the raw document.
2. Derive `memberSince` from `createdAt`; resolve `hub` by joining `currentLocationId` to `PickerWorkLocation.name`; default `role` from `employment.role ?? 'Picker'`.
3. Format `phone` for display, or return both `phone` (raw) and `phoneDisplay`.
4. Add the missing `PickerUser` fields (see 5.2 and the analysis) so the profile forms can prefill.
5. **Remove `sessionToken` and `locationOtp` from every response.**

---

### 5.2 Update profile

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage

Three distinct screens post to this one endpoint with three different payloads:

| Caller | Screen | Service call | Payload |
|---|---|---|---|
| Edit Profile | `src/screens/profile/EditProfileScreen.tsx` | `profileApi.save('edit', data)` | `{ name, dob, gender, email }` |
| Personal Information | `src/screens/profile/PersonalInfoScreen.tsx` | `profileApi.save('personal', data)` | `{ altPhone, address, city, pincode, emgName, emgPhone, emgRel }` |
| Onboarding step 1 | `src/screens/onboarding/steps/Step1Profile.tsx` | `onboardingApi.submitProfile(data)` | `{ name, dob, gender }` |

- **Hook:** `useProfileForms.save` / `useOnboarding.next`
- **User action:** Picker fills a form and taps **Save** (or **Continue** in onboarding).
- **Why needed:** The only write path for picker identity, contact, and emergency details.

#### Request

| Item | Value |
|---|---|
| Method | `PUT` |
| Endpoint | `/user/profile` |
| Authentication | **Required** — bearer |
| Authorization | Own profile only |
| Path / query parameters | — |

**Body — Edit Profile**

```json
{ "name": "Rahul Verma", "dob": "1998-04-12", "gender": "Male", "email": "rahul.verma@gmail.com" }
```

**Body — Personal Information**

```json
{
  "altPhone": "9876500000",
  "address": "12, 4th Cross, HAL 2nd Stage",
  "city": "Bengaluru",
  "pincode": "560038",
  "emgName": "Sunita Verma",
  "emgPhone": "9876511111",
  "emgRel": "Parent"
}
```

**Fields — all optional; a partial update applies only the keys present**

| Field | Type | Required | Validation (client) | Validation (server, required) |
|---|---|---|---|---|
| `name` | string | No | Non-empty | 1–100 chars |
| `dob` | string | No | Non-empty | `YYYY-MM-DD`; age ≥ 18 |
| `gender` | string | No | — | `"Male"` \| `"Female"` \| `"Other"` (case-insensitive) |
| `email` | string | No | Email regex | Email regex; unique |
| `altPhone` | string | No | 10 digits | 10 digits; must differ from `phone` |
| `address` | string | No | Non-empty, multiline | ≤ 250 chars |
| `city` | string | No | Non-empty | ≤ 100 chars |
| `pincode` | string | No | 6 digits | `/^\d{6}$/` |
| `emgName` | string | No | Non-empty | ≤ 100 chars |
| `emgPhone` | string | No | 10 digits | 10 digits |
| `emgRel` | string | No | — | `"Spouse"` \| `"Parent"` \| `"Sibling"` \| `"Friend"` |

#### Response

**200 OK** — `data`: the updated profile, same shape as 5.1.

The frontend types the result as `{ ok: boolean }` and ignores the body — it shows a "Changes saved" toast and navigates back. Returning the full profile is preferred so the store can be refreshed.

#### Error Responses

| Status | Case | Body |
|---|---|---|
| 400 | Unrecognised field submitted | `message`: `"Unknown field: <name>"` — **currently unknown fields are silently dropped; this must become an error** |
| 401 | Invalid token | Auth message |
| 409 | Email already in use | `"That email is already registered."` |
| 422 | Field validation failed | `ResponseFormatter.validationError` with `error.details: [{ field, message }]` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract** (`picker.service.updateProfile`):

```ts
const allowed = ['name','email','age','gender','photoUri','locationType','upiId','upiName','gpsLocation'];
const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
return PickerUser.findByIdAndUpdate(userId, safe, { new: true }).lean();
```

**Exact mismatch:**

| Field sent | In allow-list? | Schema field exists? | Outcome |
|---|---|---|---|
| `name` | Yes | Yes | **Saved** |
| `email` | Yes | Yes | **Saved** |
| `gender` | Yes | Yes, but `enum: ['male','female']` | **Rejected** — `"Male"` fails the enum; `"Other"` has no valid value at all |
| `dob` | **No** | **No** | **Silently dropped** |
| `altPhone` | **No** | **No** | **Silently dropped** |
| `address` | **No** | **No** | **Silently dropped** |
| `city` | **No** | **No** | **Silently dropped** |
| `pincode` | **No** | **No** | **Silently dropped** |
| `emgName` | **No** | **No** | **Silently dropped** |
| `emgPhone` | **No** | **No** | **Silently dropped** |
| `emgRel` | **No** | **No** | **Silently dropped** |

**Consequence:** the **entire Personal Information screen is a no-op**. All seven fields are discarded, the endpoint returns `200`, and the frontend displays "Changes saved". The picker believes their address and emergency contact are on file; nothing was stored. Emergency contact data is a safety-relevant record for a field workforce.

Edit Profile partially works: `name` and `email` persist, `dob` is discarded, and `gender` fails the enum.

**Required change:**

1. **Extend the `PickerUser` schema** with `dob` (Date), `altPhone` (String), `address` (String), `city` (String), `pincode` (String), and `emergencyContact: { name, phone, relation }` where `relation` is `enum: ['Spouse','Parent','Sibling','Friend']`.
2. Extend the allow-list to cover the new fields.
3. Change `gender` to `enum: ['male','female','other']` and normalize incoming values with `.toLowerCase()`; return `"Male"`/`"Female"`/`"Other"` on read.
4. **Reject unknown keys with 400** instead of dropping them, so a future frontend/backend drift fails loudly.
5. Add `validate()` middleware with the schema in the request table above; return 422 via `ResponseFormatter.validationError`.

> **Naming note.** The frontend sends flat `emgName` / `emgPhone` / `emgRel`. Either the backend accepts those names and maps them to a nested `emergencyContact`, or the frontend is changed to send the nested object. Pick one and record it — do not support both.

---

### 5.3 Profile overview

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Service:** `profileApi.getOverview` — defined in `src/services/api/profileApi.ts`, typed as returning the full `Picker` object.
- **Current usage:** **not called by any screen.** `ProfileScreen` renders the static `profileMenu` array instead.
- **Why needed:** The Profile menu shows live values as static text — `'HHD-2231 · Assigned'`, `'HDFC ••7821'`, `'4 of 4 modules complete'`, `'Aadhaar, PAN · verified'`. If those subtitles are to be accurate, they need a single aggregate.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/user/profile/overview` |
| Authentication | **Required** — bearer |

#### Response

**200 OK** — `data`:

```json
{
  "profile": { "id": "4821", "name": "Rahul Verma", "status": "ACTIVE", "hub": "Indiranagar Darkstore", "role": "Picker" },
  "menu": {
    "device": "HHD-2231 · Assigned",
    "personalInfo": "Phone, address & emergency",
    "workHistory": "Attendance & shift records",
    "documents": "Aadhaar, PAN · verified",
    "bank": "HDFC ••7821",
    "payouts": "Earnings & payment history",
    "training": "4 of 4 modules complete",
    "support": "Help, FAQs & notifications"
  }
}
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `profile` | object | Yes | No | Subset of 5.1 |
| `menu.*` | string | Yes | **Yes** | Pre-formatted subtitle; `null` → the frontend falls back to its static copy |

#### Error Responses

| Status | Case |
|---|---|
| 401 | Invalid token |
| 404 | Picker not found |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** stub — `{ "userId": "...", "overview": {} }`. No data is assembled.
- **Frontend expected contract:** the object above.
- **Exact mismatch:** the response carries no usable data; `overview` is an empty object. The declared frontend return type (`typeof mockPicker`) does not match either.
- **Required change:** either implement the aggregate (device assignment, primary bank account masked, training completion count, document verification summary) or **delete `profileApi.getOverview` from the frontend** and accept that the menu subtitles are decorative. Given the screen does not call it today, this is P2 — decide the intent before building.

---

### 5.4 Set location type

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Page:** `src/screens/onboarding/steps/Step2LocationType.tsx`
- **Component:** `RadioCard` — "Darkstore" / "Warehouse"
- **Service:** `onboardingApi.submitLocationType`
- **User action:** Picker selects a facility type and taps **Continue**.
- **Why needed:** Determines which work locations and shifts are offered in steps 3 and 4.

#### Request

| Item | Value |
|---|---|
| Method | `PUT` |
| Endpoint | `/user/location-type` |
| Authentication | **Required** — bearer |

**Body**

```json
{ "locationType": "Darkstore" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `locationType` | string | **Yes** | Frontend sends `"Darkstore"` \| `"Warehouse"` (capitalised). Schema enum is `['warehouse','darkstore']` (lower-case) — **the server must lower-case before writing.** |

#### Response

**200 OK** — `data`: `{ "locationType": "darkstore" }`

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Value not in the enum | `"locationType must be warehouse or darkstore"` |
| 401 | Invalid token | Auth message |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** stub — `res.json(success({ locationType: req.body.locationType }))`. It **echoes the input and writes nothing.**
- **Frontend expected contract:** the selection is persisted so steps 3–4 can be filtered and the choice survives a reinstall.
- **Exact mismatch:** (1) no persistence — `PickerUser.locationType` is never set by this route; (2) case mismatch — `"Darkstore"` would fail the schema enum if it *were* written.
- **Required change:** lower-case the value, validate against the enum, and `findByIdAndUpdate(pickerId, { locationType })`. Note that `PUT /user/profile` **does** accept `locationType` through its allow-list, so this route is arguably redundant — but the frontend calls this one, so it must work.

---

### 5.5 Set UPI

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Page:** `src/screens/payouts/UpiDetailsScreen.tsx`
- **Service:** `profileApi.setUpi`
- **User action:** Picker enters a UPI ID and saves.
- **Why needed:** Alternative payout rail to bank transfer; the Payouts screen shows a UPI verification badge.

#### Request

| Item | Value |
|---|---|
| Method | `PUT` |
| Endpoint | `/user/upi` |
| Authentication | **Required** — bearer |

**Body**

```json
{ "upi": "rahulverma@okhdfcbank" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `upi` | string | **Yes** | `/^[\w.\-]{2,256}@[a-zA-Z]{2,64}$/` |

#### Response

**200 OK** — `data`:

```json
{ "upiId": "rahulverma@okhdfcbank", "upiName": null, "upiPayoutVerificationStatus": "pending" }
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `upiId` | string | Yes | No | |
| `upiName` | string | Yes | **Yes** | Resolved holder name, `null` until verified |
| `upiPayoutVerificationStatus` | string | Yes | No | `"none"` \| `"pending"` \| `"verified"` \| `"rejected"` |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Malformed UPI ID | `"Enter a valid UPI ID"` |
| 401 | Invalid token | Auth message |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** stub — echoes `{ upi: req.body.upi }`, no write.
- **Frontend expected contract:** persisted, with a verification status the Payouts screen can badge.
- **Exact mismatch:** no persistence and no validation. The schema fields `upiId`, `upiName`, and `upiPayoutVerificationStatus` (with a full enum and a `upiPayoutRejectionReason` field) all exist and are **never written by any code path**, so the UPI badge on the Payouts screen can never leave its default state.
- **Required change:** validate the format, write `upiId`, set `upiPayoutVerificationStatus = 'pending'`, and return the three fields. Note the request field is `upi` but the schema field is `upiId` — map explicitly.

---

## 6. Onboarding Data & KYC

### 6.1 List work locations

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Page:** `src/screens/onboarding/steps/Step3WorkLocation.tsx`
- **Component:** `RadioCard` list, keyed `key={l.id}`, selected via `ob.setLocation(l.id)`
- **Service:** `onboardingApi.getLocations`
- **Hook:** `useApiResource(() => onboardingApi.getLocations())`
- **User action:** Picker picks the facility they will work from, then taps **Continue**.
- **Why needed:** Onboarding step 3 cannot proceed without a selection (`useOnboarding.next` blocks on `!ob.location`).

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/work-locations` |
| Authentication | **None** — the frontend passes `auth: false` |
| Authorization | — |
| Path parameters | — |

**Query parameters**

| Name | Type | Required | Notes |
|---|---|---|---|
| `type` | string | No | `warehouse` \| `darkstore`. Supported by the backend; **the frontend does not send it** — it should, using the step-2 selection. |
| `lat` | number | No | **Proposed** — needed to compute the distance shown in `sub` |
| `lng` | number | No | **Proposed** — as above |

#### Response

**200 OK** — `data` is an **array**:

```json
[
  { "id": "indiranagar", "title": "Indiranagar Darkstore", "sub": "2.1 km · 80 Ft Rd, HAL 2nd Stage" },
  { "id": "koramangala", "title": "Koramangala Darkstore", "sub": "4.8 km · 5th Block" },
  { "id": "whitefield",  "title": "Whitefield Hub",        "sub": "11.3 km · ITPL Main Rd" }
]
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `id` | string | **Yes** | No | The value posted back on selection. Use `warehouseKey` (stable, human-readable) rather than `_id`. |
| `title` | string | **Yes** | No | Display name |
| `sub` | string | **Yes** | No | `"<distance> · <short address>"`. Omit the distance prefix when `lat`/`lng` are absent. |

Empty list must be `[]`.

#### Error Responses

| Status | Case |
|---|---|
| 500 | Unexpected server error — `useApiResource` sets `error` and the list falls back to the bundled mock |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract** — `picker.service.listWorkLocations` returns `PickerWorkLocation.find({ isActive: true }).lean()`:

```json
[
  {
    "_id": "66f1b2c3d4e5f60718293a4b",
    "warehouseKey": "indiranagar",
    "name": "Indiranagar Darkstore",
    "address": "80 Ft Rd, HAL 2nd Stage, Bengaluru 560038",
    "type": "darkstore",
    "isActive": true,
    "coordinates": { "latitude": 12.9784, "longitude": 77.6408 },
    "geofenceRadius": 200
  }
]
```

**Frontend expected contract:** `[{ id, title, sub }]`.

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| Array vs object | Array | Array | `.map()` is safe |
| `id` | `_id` / `warehouseKey` | `id` | **`key={l.id}` is `undefined` for every row**, and `ob.setLocation(undefined)` means the selection never registers — **the picker cannot pass step 3** |
| `title` | `name` | `title` | Every row renders with a blank title |
| `sub` | `address` (no distance) | `sub` | Blank subtitle |
| Filtering | `type` supported | Not sent | All facility types listed regardless of the step-2 choice |

**Required change:**

1. Project to `{ id: warehouseKey, title: name, sub }`.
2. Build `sub` as `"<distance> · <short address>"`; accept `lat`/`lng` and compute against `coordinates`, or omit the distance when they are absent.
3. Have the frontend pass `type` from the step-2 selection.

---

### 6.2 List available shifts

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Page:** `src/screens/onboarding/steps/Step4Shift.tsx`
- **Component:** `RadioCard` list, `key={s.id}`, selected via `ob.setShift(s.id)`
- **Service:** `onboardingApi.getShifts` / `shiftApi.listAvailable`
- **User action:** Picker chooses a shift slot and taps **Continue** (`useOnboarding.next` blocks on `!ob.shift`).
- **Why needed:** Assigns the picker's working window; drives the Home screen's "Today's Shift" and the attendance schedule.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/shifts/available` |
| Authentication | **Required** — bearer |

**Query parameters**

| Name | Type | Required | Notes |
|---|---|---|---|
| `warehouseKey` | string | No | Supported by the backend; **the frontend does not send it** |
| `date` | string | No | **Proposed** — `YYYY-MM-DD`, needed to compute remaining capacity |

#### Response

**200 OK** — `data` is an **array**:

```json
[
  { "id": "morning", "title": "Morning · 9:00 AM – 6:00 PM", "sub": "18 slots open", "capacity": 20, "booked": 2, "basePay": 780 },
  { "id": "evening", "title": "Evening · 2:00 PM – 11:00 PM", "sub": "9 slots open",  "capacity": 15, "booked": 6, "basePay": 820 },
  { "id": "night",   "title": "Night · 10:00 PM – 7:00 AM",   "sub": "4 slots open",  "capacity": 10, "booked": 6, "basePay": 900 }
]
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `id` | string | **Yes** | No | Posted back to `/shifts/select`. **Resolve the `id` vs `_id` ambiguity — see below.** |
| `title` | string | **Yes** | No | `"<name> · <start> – <end>"` |
| `sub` | string | **Yes** | No | `"N slots open"` |
| `capacity` | number | No | No | Raw, for future client-side logic |
| `booked` | number | No | No | Raw |
| `basePay` | number | No | **Yes** | Rupees |

#### Error Responses

| Status | Case |
|---|---|
| 401 | Invalid token |
| 500 | Unexpected — falls back to the bundled mock |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract** — `PickerShift.find({ status: 'SCHEDULED' }).sort({ startTime: 1 }).lean()`:

```json
[
  {
    "_id": "66f1c2d3e4f5a60718293b5c",
    "id": "morning",
    "name": "Morning Shift",
    "warehouseKey": "indiranagar",
    "startTime": "09:00",
    "endTime": "18:00",
    "time": "9:00 AM – 6:00 PM",
    "duration": "9 hrs",
    "capacity": 20,
    "breakDuration": 45,
    "status": "SCHEDULED",
    "basePay": 780
  }
]
```

**Frontend expected contract:** `[{ id, title, sub }]`.

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| `title` | `name` + separate `time` | Single `title` string | Blank title |
| `sub` | **No open-slot count exists** | `"18 slots open"` | Blank subtitle; the picker cannot see availability |
| `id` | Both `_id` **and** an optional `id` string are returned | One `id` | Ambiguous which value `/shifts/select` expects; if `id` is unset on the document, `key` is `undefined` and **selection fails exactly as in 6.1** |
| Site scoping | `warehouseKey` supported but not sent | — | **Shifts from every site in the network are listed** |
| Capacity | `capacity` returned; bookings never counted | `sub` needs `capacity - booked` | No aggregation exists |

**Required change:**

1. Project `{ id, title, sub }`; compose `title` from `name` + `time` (or `startTime`/`endTime`).
2. Aggregate `PickerShiftAssignment` per shift and date to compute `booked`, then render `sub` as `"${capacity - booked} slots open"`.
3. **Standardise on one identifier.** Return `_id` as `id` and drop the redundant `id` string field from `PickerShift`, or make `id` required and unique — then ensure `POST /shifts/select` accepts the same value.
4. Scope by `warehouseKey` from the picker's selected location; have the frontend send it.

---

### 6.3 List training videos

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Pages:** `src/screens/onboarding/steps/Step5Training.tsx` (onboarding gate) and `src/screens/profile/TrainingScreen.tsx` (reference)
- **Component:** module rows with a Watch/Rewatch button; opens `src/overlays/TrainingVideoModal.tsx`
- **Service:** `onboardingApi.getTraining` / `trainingApi.listVideos`
- **User action:** Picker taps **Watch** on each module. Step 5 blocks until `ob.trainDone.every(Boolean)`.
- **Why needed:** Mandatory training gate before KYC.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/training/videos` |
| Authentication | **None** on the backend route; the frontend sends a bearer token anyway (harmless) |

**Query parameters**

| Name | Type | Required | Notes |
|---|---|---|---|
| `warehouseKey` | string | No | Supported; not sent by the frontend |

#### Response

**200 OK** — `data` is an **array**, ordered by `order` ascending:

```json
[
  { "videoId": "v-app-basics", "name": "App & shift basics", "dur": "12 min", "url": "https://cdn.selorg.in/training/app-basics.mp4", "thumbnailUrl": "https://cdn.selorg.in/training/app-basics.jpg", "durationSeconds": 720, "order": 1 },
  { "videoId": "v-order-handling", "name": "Order handling & quality", "dur": "18 min", "url": "https://cdn.selorg.in/training/orders.mp4", "thumbnailUrl": null, "durationSeconds": 1080, "order": 2 }
]
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `videoId` | string | **Yes** | No | Stable key; posted to the completion endpoints |
| `name` | string | **Yes** | No | Module title |
| `dur` | string | **Yes** | No | `"12 min"` — pre-formatted |
| `url` | string | **Yes** | No | Playable media URL for the modal |
| `thumbnailUrl` | string | No | **Yes** | |
| `durationSeconds` | number | No | No | Raw |
| `order` | number | No | No | Display order |

#### Error Responses

| Status | Case |
|---|---|
| 500 | Unexpected — falls back to the bundled mock |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract** — `PickerTrainingVideo.find({ isActive: true }).sort({ order: 1 }).lean()`:

```json
[
  {
    "_id": "66f1d2e3f4a5b60718293c6d",
    "videoId": "v-app-basics",
    "title": "App & shift basics",
    "description": "How to start a shift and use the app",
    "url": "https://cdn.selorg.in/training/app-basics.mp4",
    "thumbnailUrl": null,
    "durationSeconds": 720,
    "order": 1,
    "isActive": true
  }
]
```

**Frontend expected contract:** `[{ name, dur }]` (plus `videoId` and `url` to fix the defects below).

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| Array vs object | Array | Array | `.map()` is safe |
| Title | `title` | `name` | **`key={m.name}` is `undefined`** — duplicate React keys across all rows; every row title is blank |
| Duration | `durationSeconds: 720` | `dur: "12 min"` | Blank duration |
| Completion key | `videoId` returned but unused by the UI | Frontend keys completion by **array index** (`ob.trainDone[i]`) | Reordering or adding a video silently mis-attributes completion |
| Media URL | `url` returned but not read | The modal has no source | The video cannot actually play |

**Required change:**

1. Project `name` (from `title`) and `dur` (format `durationSeconds` as `"N min"`).
2. Keep returning `videoId` and `url`, and change the frontend to key modules by `videoId` and play `url` in the modal.
3. Optionally scope by `warehouseKey`.

---

### 6.4 Track watch progress

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Component:** `src/overlays/TrainingVideoModal.tsx`
- **Service:** `trainingApi.watchProgress`
- **User action:** Fired as the picker watches a module.
- **Why needed:** Persists partial progress so a closed app does not reset a half-watched module.

#### Request

| Item | Value |
|---|---|
| Method | `PUT` |
| Endpoint | `/training/watch-progress` |
| Authentication | **Required** — bearer |

**Body**

```json
{ "videoId": "v-app-basics", "progress": 65 }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `videoId` | string | **Yes** | Must match an active `PickerTrainingVideo.videoId` |
| `progress` | number | **Yes** | Integer 0–100; clamped server-side |

#### Response

**200 OK** — `data`:

```json
{ "trainingProgress": { "v-app-basics": 65, "v-order-handling": 0 }, "trainingCompleted": false }
```

| Field | Type | Required | Nullable |
|---|---|---|---|
| `trainingProgress` | object (map `videoId` to 0–100) | Yes | No |
| `trainingCompleted` | boolean | Yes | No |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Missing `videoId` or `progress` | `"videoId and progress are required"` |
| 401 | Invalid token | Auth message |
| 404 | Picker not found | `"User not found"` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** `PUT /training/watch-progress` is a **stub** — `{ tracked: true, ...req.body }`, no write.
- **Frontend expected contract:** the persisted progress map above.
- **Exact mismatch:** the route the frontend calls does nothing. **The real implementation already exists** as `picker.service.updateTrainingProgress` — it clamps `progress` to 0–100, writes `PickerUser.trainingProgress[videoId]`, and flips `trainingCompleted` once every active video reaches 100. It is wired to `PUT /training/progress`, **a path the frontend never calls**.
- **Required change:** repoint the route — `router.put('/training/watch-progress', authenticatePicker, ctrl.updateTrainingProgress)`. This is a one-line fix.
- **Related data gap:** `PickerUser.trainingProgress` defaults to the hardcoded map `{ video1: 0, video2: 0, video3: 0, video4: 0 }`, whose keys will not match real `videoId` values. Change the default to `{}`.

---

### 6.5 Mark training video complete

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Services:** `onboardingApi.completeTrainingVideo`, `trainingApi.markComplete`
- **User action:** Fired when a module finishes playing.
- **Why needed:** Onboarding step 5 will not advance until every module is complete.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/training/complete/:videoId` |
| Authentication | **Required** — bearer |

**Path parameters**

| Name | Type | Required | Validation |
|---|---|---|---|
| `videoId` | string | **Yes** | Must match an active `PickerTrainingVideo.videoId` |

Body: empty.

#### Response

**200 OK** — `data`:

```json
{ "videoId": "v-app-basics", "completed": true, "trainingProgress": { "v-app-basics": 100 }, "trainingCompleted": false }
```

| Field | Type | Required | Nullable |
|---|---|---|---|
| `videoId` | string | Yes | No |
| `completed` | boolean | Yes | No |
| `trainingProgress` | object | Yes | No |
| `trainingCompleted` | boolean | Yes | No |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 401 | Invalid token | Auth message |
| 404 | Unknown `videoId` | `"Training video not found"` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** stub — `{ userId, videoId, completed: true }`. **No write.**
- **Frontend expected contract:** completion persisted per `videoId`.
- **Exact mismatch:** nothing is stored. Completion lives only in frontend state (`ob.trainDone` during onboarding, `state.support.profTrainDone` on the Training screen). Consequences: (a) a reinstall or logout resets all training progress; (b) the mandatory training gate is enforced purely client-side and is therefore bypassable; (c) admin `GET /admin/picker/pickers/:id/training-progress` (itself a stub) has no data to report.
- **Required change:** delegate to the existing `updateTrainingProgress(userId, videoId, 100)`, which already handles the "all complete" transition and sets `trainingCompletedAt`.

---

### 6.6 Get training progress

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Service:** `trainingApi.getProgress` — defined, **not called by any screen today**. Both training screens rely on local state, which is precisely why progress does not survive a reinstall.
- **Why needed:** To rehydrate completion state on app start so 6.5 has a readable counterpart.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/training/user-progress` |
| Authentication | **Required** — bearer |

#### Response

**200 OK** — `data`:

```json
{ "completed": ["v-app-basics", "v-order-handling"], "total": 4, "progress": { "v-app-basics": 100, "v-order-handling": 100, "v-safety": 40, "v-returns": 0 }, "trainingCompleted": false }
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `completed` | string[] | **Yes** | No | `videoId`s at 100. `[]` when none. |
| `total` | number | **Yes** | No | Count of active videos |
| `progress` | object | No | No | Full map, for partial-progress UI |
| `trainingCompleted` | boolean | No | No | |

#### Error Responses

| Status | Case |
|---|---|
| 401 | Invalid token |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** stub — `{ userId, progress: [] }`.
- **Frontend expected contract:** `{ completed: string[], total: number }`.
- **Exact mismatch:** `progress` is an empty array where a `completed` string array and a `total` count are expected. No field name overlaps.
- **Required change:** read `PickerUser.trainingProgress`, derive `completed` as the keys at 100, and count active `PickerTrainingVideo` documents for `total`. Then wire the frontend to call it on mount so local state stops being authoritative.

---

### 6.7 Upload document (KYC)

#### Status
`MODIFY_REQUIRED` — **contract is fundamentally incompatible today**

#### Frontend Usage
- **Page:** `src/screens/onboarding/steps/Step6Kyc.tsx`
- **Component:** `TextField` for the Aadhaar number, `TextField` for the PAN number, plus an "Upload" outline button
- **Services:** `onboardingApi.submitKyc`, `profileApi.uploadDocument`, `documentApi.upload`
- **User action:** Picker types their Aadhaar and PAN numbers and taps **Continue**.
- **Why needed:** Mandatory KYC gate before face verification and approval.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/documents/upload` |
| Authentication | **Required** — bearer |

**Body — proposed reconciled contract**

```json
{ "type": "aadhaar", "number": "123412341234", "url": "https://cdn.selorg.in/kyc/66f1a2b3-aadhaar.jpg", "fileName": "aadhaar-front.jpg" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `type` | string | **Yes** | Enum: `aadhaar` \| `pan` \| `dl` \| `photo` \| `other` |
| `number` | string | Conditional | Required for `aadhaar` (12 digits) and `pan` (`/^[A-Z]{5}\d{4}[A-Z]$/`). **New field — no schema home today.** |
| `url` | string | Conditional | Required when a file is attached. Must come from `POST /uploads` (7.1). |
| `fileName` | string | No | Original file name |

**What the frontend actually sends today**

```json
{ "aadhaar": "123412341234", "pan": "ABCDE1234F" }
```

#### Response

**201 Created** — `data`:

```json
{
  "id": "66f1e2f3a4b5c60718293d7e",
  "type": "aadhaar",
  "number": "••••••••1234",
  "url": "https://cdn.selorg.in/kyc/66f1a2b3-aadhaar.jpg",
  "fileName": "aadhaar-front.jpg",
  "status": "pending",
  "rejectionReason": null,
  "createdAt": "2026-09-04T10:15:00.000Z"
}
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `id` | string | Yes | No | |
| `type` | string | Yes | No | |
| `number` | string | Yes | **Yes** | **Masked** — never return the full identity number |
| `url` | string | Yes | **Yes** | |
| `status` | string | Yes | No | `pending` \| `approved` \| `rejected` |
| `rejectionReason` | string | Yes | **Yes** | |
| `createdAt` | string | Yes | No | ISO 8601 |

The frontend types the result as `{ ok, id }` and ignores the body.

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Missing `type`, or missing both `number` and `url` | `"type and url are required"` (current) |
| 401 | Invalid token | Auth message |
| 409 | Document of this type already pending | `"An Aadhaar document is already under review."` |
| 422 | Aadhaar/PAN format invalid | Validation details |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract** (`picker.controller.uploadDocument`):

```ts
const { type, url, fileName } = req.body;
if (!type || !url) { res.status(400).json(error('type and url are required', 400)); return; }
await pickerService.uploadDocument(userId, type, url, fileName);
```

`PickerDocument` schema: `{ userId, type, url (required), fileName, status, reviewedBy, reviewedAt, rejectionReason }`.

**Frontend expected contract:** `{ aadhaar, pan }` — two identity numbers, no `type`, no `url`.

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| `type` | Required | Not sent | **400 on every call** |
| `url` | Required | Not sent | **400 on every call** |
| Identity number | **No schema field at all** | Sends `aadhaar` and `pan` numbers | Even if the 400 were bypassed, **the numbers have nowhere to be stored** |
| Cardinality | One document per request | Sends both Aadhaar and PAN in one body | Needs two calls, or batch support |
| Conceptual model | A document is a **stored file reference** | KYC is an **identity number** typed into a text field | The two sides model KYC differently |

**Consequence:** **onboarding step 6 fails on every attempt.** This is one of three separate blockers preventing any picker from completing onboarding (the others being 6.9 face verification and 10.4 bank account).

**Required change — decide the model first:**

- **Option A (recommended).** Add `number` (encrypted at rest) and `numberMasked` to `PickerDocument`, make `url` optional, and add `POST /uploads` (7.1) for the file. The frontend then sends one request per document type with `{ type, number, url? }`. Requires frontend changes: a file picker and two calls instead of one.
- **Option B.** Keep `PickerDocument` for files only and add a separate `PUT /user/kyc` accepting `{ aadhaar, pan }` into new `PickerUser` fields. Smaller change, but splits KYC across two models and leaves the Documents screen (9.1) without the `num` field it renders.

Whichever is chosen, add server-side Aadhaar and PAN format validation — currently both are validated **client-side only** (`src/utils/validators.ts`), so the API accepts anything.

---

### 6.8 Upload a file

#### Status
`NEW`

#### Frontend Usage
- **Pages:** `Step6Kyc.tsx` (document images), `Step7Face.tsx` (selfie), `EditProfileScreen.tsx` (avatar), `DeviceStatusScreen.tsx` (condition photos)
- **Service:** **none — the frontend has no storage service and no file picker.** Both sides need work.
- **User action:** Picker taps "Upload" and selects or captures an image.
- **Why needed:** Every document-bearing flow depends on producing a `url`, and nothing in the system can currently produce one.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/uploads` |
| Authentication | **Required** — bearer |
| Headers | `Content-Type: multipart/form-data` (**not** JSON — the shared client wrapper must be bypassed) |

**Form fields**

| Field | Type | Required | Validation |
|---|---|---|---|
| `file` | binary | **Yes** | `image/jpeg`, `image/png`, `application/pdf`; max 5 MB |
| `purpose` | string | **Yes** | `kyc` \| `face` \| `avatar` \| `device` |

#### Response

**201 Created** — `data`:

```json
{ "url": "https://cdn.selorg.in/kyc/66f1a2b3-aadhaar.jpg", "fileName": "aadhaar-front.jpg", "mimeType": "image/jpeg", "sizeBytes": 184320 }
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `url` | string | **Yes** | No | Passed to 6.7 / 6.9 as the `url` field |
| `fileName` | string | Yes | No | |
| `mimeType` | string | Yes | No | |
| `sizeBytes` | number | Yes | No | |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | No file, or unsupported `purpose` | `"A file is required"` |
| 401 | Invalid token | Auth message |
| 413 | Over 5 MB | `"File is too large. Maximum size is 5 MB."` |
| 415 | Unsupported media type | `"Only JPEG, PNG and PDF files are accepted."` |

#### Existing Backend Comparison — `NEW`

- **Why existing APIs cannot satisfy the frontend:** there is **no file-upload route anywhere in `picker.routes.ts`** and no multer middleware registered for the picker module. `POST /documents/upload` requires a `url` that must already exist, and `POST /devices/upload-condition-photo` is a stub returning `{ uploaded: true, url: null }` — it accepts nothing and produces nothing. The only upload machinery in the codebase is `src/modules/support/support-upload.middleware.ts`, which is scoped to support-ticket attachments and gated behind customer auth.
- **Proposed contract:** as specified above.
- **Expected request:** `multipart/form-data` with `file` and `purpose`.
- **Expected response:** `201 { url, fileName, mimeType, sizeBytes }`.
- **Expected errors:** 400, 401, 413, 415.
- **Reuse note:** `support-upload.middleware.ts` is a reasonable starting point for the multer configuration and storage adapter — extend it for picker auth rather than writing a second uploader.
- **Frontend work required:** add a file picker (e.g. `react-native-image-picker`), add a `storageService.upload()` that posts `multipart/form-data` **without** the JSON `Content-Type` the shared `request()` wrapper always sets, then pass the returned `url` into 6.7 and 6.9.

---

### 6.9 Face verification / submit for review

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Page:** `src/screens/onboarding/steps/Step7Face.tsx`
- **Component:** face-capture panel + **Submit for review** button
- **Service:** `onboardingApi.verifyFace` / `onboardingApi.submitForReview`
- **Hook:** `useOnboarding.next` — at step 7, blocks on `!ob.faceDone`, then calls `submitForReview()` and navigates to `StatusGateScreen`.
- **User action:** Picker completes the face scan and taps **Submit for review**.
- **Why needed:** This is the transition from "filling in the wizard" to "awaiting admin approval" — the moment the application enters the review queue.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/verify/face` |
| Authentication | **Required** — bearer |

**Body — proposed**

```json
{ "imageUrl": "https://cdn.selorg.in/face/66f1a2b3-selfie.jpg" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `imageUrl` | string | **Yes** (proposed) | URL from `POST /uploads` with `purpose: "face"` |

**What the frontend sends today:** `{}` (an empty object — `submitForReview()` defaults to `data ?? {}`).

#### Response

**200 OK** — `data`:

```json
{ "faceVerificationStatus": "pending", "submittedForReviewAt": "2026-09-04T10:15:00.000Z", "state": "ONBOARDING" }
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `faceVerificationStatus` | string | **Yes** | No | `pending` \| `verified` \| `rejected` \| `overridden_approved` \| `overridden_rejected` |
| `submittedForReviewAt` | string | **Yes** | **Yes** | ISO 8601 — the frontend's `StatusGateScreen` uses this to show the "under review" gate |
| `state` | string | No | No | Mirrors 4.1 so the client can update its gate without a second call |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Missing `imageUrl` (once required) | `"A face image is required"` |
| 401 | Invalid token | Auth message |
| 409 | Already submitted for review | `"Your application is already under review."` |
| 422 | No face detected / poor quality | `"We could not detect a face. Please try again in better light."` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract:**

```ts
export async function verifyFace(req, res, next) {
  try { res.json(ResponseFormatter.success({ verified: false })); } catch (err) { next(err); }
}
```

**Frontend expected contract:** the application transitions into review and `StatusGateScreen` reflects it.

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| Persistence | **None** — no write of any kind | Application must enter review | `PickerUser.faceVerificationStatus` stays at its `'pending'` default forever; **no record is created that an application was ever submitted** |
| Response field | `verified: false` | `faceVerificationStatus`, `submittedForReviewAt` | Field names do not overlap; the frontend ignores the body and navigates regardless, so the failure is silent |
| Image | Not accepted | Not sent | There is no face image to verify or for an admin to review |
| Review queue | Nothing enqueued | Admin approves via `PUT /admin/picker/pickers/:id/approve` | The admin approval route works, but **nothing tells an admin this picker is waiting** |

**Consequence:** onboarding step 7 appears to succeed and does nothing. Combined with 4.1 (which never reports `ACTIVE`), a picker who completes the wizard is left permanently on the status gate.

**Required change:**

1. Accept `imageUrl` (produced by 6.8) and store it against the picker.
2. Set `faceVerificationStatus = 'pending'` and record `submittedForReviewAt` (a new field — see *Database / Model Gaps* #5).
3. Surface the picker in the admin approvals queue (`GET /admin/picker/approvals`, which is already implemented and reads `PickerUser`).
4. Return the response above so `StatusGateScreen` can render the correct gate.

> There is also a partially stubbed Didit KYC integration (`POST /didit/session`, `GET /didit/status`, `POST /didit/webhook` — all stubs). Decide whether face verification runs through Didit or a first-party check before implementing, so the two do not diverge.

---

### 6.10 Request manager OTP

#### Status
`MODIFY_REQUIRED` — **security defect**

#### Frontend Usage
- **Component:** `src/overlays/CollectDeviceSheet.tsx`, opened from the Home screen's "Collect your device" card
- **Service:** `onboardingApi.requestManagerOtp`
- **Hook:** `useOnboarding.requestMgrOtp` — on success sets `mgrSent` and toasts "OTP sent to your hub manager"
- **User action:** Picker taps **Send OTP to manager** during device handover.
- **Why needed:** The hub manager reads the OTP to the picker, proving the handover was authorised by staff.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/manager/request-otp` |
| Authentication | **Required** — bearer |
| Body | Empty (`{}`). The manager is resolved server-side from the picker's `currentLocationId`. |

#### Response

**200 OK** — `data`:

```json
{ "sent": true, "sentTo": "+91 98765 ••210", "expiresInSeconds": 300 }
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `sent` | boolean | **Yes** | No | |
| `sentTo` | string | No | **Yes** | **Masked** manager phone, for UI confirmation |
| `expiresInSeconds` | number | No | No | Drives a client-side countdown |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Picker has no assigned location | `"Select your work location first."` |
| 401 | Invalid token | Auth message |
| 404 | No manager configured for the hub | `"No manager is configured for this location."` |
| 429 | Too many requests | `"Please wait before requesting another OTP."` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** stub — `{ sent: true }`. **No OTP is generated, stored, or sent.**
- **Frontend expected contract:** a real OTP delivered to the hub manager.
- **Exact mismatch:** the response asserts an OTP was sent when none exists. The frontend then shows "OTP sent to your hub manager", so the picker waits for a code that will never arrive — while 6.11 accepts *any* code they eventually type.
- **Required change:** generate a 4-digit OTP, store it (the `PickerUser.locationOtp` and `locationOtpForLocationId` fields exist for exactly this and are never written), and dispatch it via the existing `src/services/sms.service.ts` `sendOtpSms`. Requires a manager-contact field on `PickerWorkLocation`, which does not currently exist.

---

### 6.11 Verify manager OTP

#### Status
`MODIFY_REQUIRED` — **security defect**

#### Frontend Usage
- **Component:** `CollectDeviceSheet.tsx` — 4-digit input plus a "device received" acknowledgement checkbox
- **Service:** `onboardingApi.verifyManagerOtp`; the sheet's confirm handler calls `onboardingApi.confirmDeviceCollection({ otp })`
- **Hook:** `useOnboarding.confirmCollect` — validates `/^\d{4}$/` and `deviceAck` client-side, then submits
- **User action:** Picker enters the OTP the manager read out, ticks the acknowledgement, and taps **Confirm**.
- **Why needed:** Authorises the device handover.

> **Frontend defect:** `onboardingApi.confirmDeviceCollection` **does not exist** in `src/services/api/onboardingApi.ts`. `useOnboarding.confirmCollect` therefore throws a `TypeError` before any request is made. Must be added — see 6.12.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/manager/verify-otp` |
| Authentication | **Required** — bearer |

**Body**

```json
{ "otp": "4821" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `otp` | string | **Yes** | Exactly 4 digits; must match the stored OTP; must not be expired; max 5 attempts |

#### Response

**200 OK** — `data`:

```json
{ "verified": true, "locationId": "indiranagar" }
```

| Field | Type | Required | Nullable |
|---|---|---|---|
| `verified` | boolean | **Yes** | No |
| `locationId` | string | No | **Yes** |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Wrong or expired OTP | `"Invalid or expired OTP. Please try again."` |
| 400 | Not 4 digits | `"OTP must be exactly 4 numeric digits"` |
| 401 | Invalid token | Auth message |
| 429 | Attempts exceeded | `"Too many attempts. Request a new OTP."` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract:**

```ts
export async function verifyManagerOtp(req, res, next) {
  try { res.json(ResponseFormatter.success({ verified: true })); } catch (err) { next(err); }
}
```

**Exact mismatch:** the handler **ignores the request body entirely and returns `verified: true` unconditionally** — including for an empty body, a wrong code, or no code at all. There is no comparison, no expiry, and no attempt limit.

**Consequence:** the manager-authorisation control on device handover is a no-op that always succeeds. Any authenticated picker can claim a device without a manager being involved. Because 6.10 also sends nothing, the entire two-step handover authorisation is theatre.

**Required change:** compare the submitted OTP against the stored `PickerUser.locationOtp`, enforce a 5-minute expiry and a 5-attempt cap (mirroring the pattern already implemented in `picker.auth.service.checkOtp`, which can be reused), and clear the OTP on success.

---

### 6.12 Confirm device collection

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Component:** `CollectDeviceSheet.tsx`
- **Service:** `profileApi.acknowledgeDeviceCollection` (defined) / `onboardingApi.confirmDeviceCollection` (**called but missing**)
- **User action:** Final confirmation of the handover, after the manager OTP.
- **Why needed:** Records that the picker now holds the HHD; the Home screen's "Collect your device" card is hidden once `deviceCollected` is true.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/devices/collection-complete` |
| Authentication | **Required** — bearer |

**Body**

```json
{ "otp": "4821", "deviceId": "HHD-2231", "acknowledged": true }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `otp` | string | **Yes** | 4 digits — verified as in 6.11 (combine both steps into this one call, or require 6.11 first) |
| `deviceId` | string | No | Assigned by the hub if omitted |
| `acknowledged` | boolean | **Yes** | Must be `true` — the picker confirms physical receipt |

#### Response

**200 OK** — `data`:

```json
{ "deviceId": "HHD-2231", "model": "Zebra TC21 · Handheld", "status": "assigned", "assignedAt": "2026-09-04T10:15:00.000Z" }
```

| Field | Type | Required | Nullable |
|---|---|---|---|
| `deviceId` | string | **Yes** | No |
| `model` | string | Yes | **Yes** |
| `status` | string | **Yes** | No |
| `assignedAt` | string | **Yes** | No |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Invalid OTP, or `acknowledged` not true | `"Invalid or expired OTP."` |
| 401 | Invalid token | Auth message |
| 404 | No device available at the hub | `"No device is available at your hub. Contact your manager."` |
| 409 | Picker already holds a device | `"A device is already assigned to you."` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** stub — `{ acknowledged: true }`. No write of any kind.
- **Frontend expected contract:** the device is assigned and readable by 9.2.
- **Exact mismatch:** no assignment occurs. `PickerDevice.assignedTo` and `PickerUser.activeDeviceId` are never set by this route. Consequently `GET /devices/assigned` has nothing to return, and the Home screen's collect-device card is driven entirely by the local flag `state.onboarding.deviceCollected` — which resets on reinstall.
- **Required change:** verify the OTP, select an available `PickerDevice` at the picker's hub, set `assignedTo` and `status = 'assigned'`, set `PickerUser.activeDeviceId`, and return the device. Admin-side assignment logic already exists in `picker.service.assignDevice(deviceId, userId)` and should be reused.
- **Frontend change required:** add the missing `onboardingApi.confirmDeviceCollection` method.

---

## 7. Home Dashboard

### 7.1 Home summary

#### Status
`NEW`

#### Frontend Usage
- **Page:** `src/screens/dashboard/HomeScreen.tsx` — the app's landing tab
- **Components:** header greeting + `Avatar`, collect-device card, hub/shift card, balance card, orders card, two metric tiles, performance card
- **Service:** **none — the screen makes no API call.** It imports `mockHome` from `src/mock/home.ts` and renders it directly.
- **User action:** Opens the app; the screen is the default tab after login.
- **Why needed:** This is the first and most-viewed screen in the app, and **every value on it is currently a hardcoded literal**. The greeting (`"Hi, Rahul"`), role line (`"Picker · ID 4821"`) and avatar initials (`"RV"`) are literals in JSX; everything else comes from the mock module.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/home/summary` |
| Authentication | **Required** — bearer |
| Authorization | `status === 'ACTIVE'` |
| Path parameters | — |

**Query parameters**

| Name | Type | Required | Notes |
|---|---|---|---|
| `lat` | number | No | Device GPS latitude — enables `hub.accuracy` and `hub.onSite` |
| `lng` | number | No | Device GPS longitude |
| `accuracyM` | number | No | Device-reported GPS accuracy in metres |

#### Response

**200 OK** — `data`:

```json
{
  "picker": { "id": "4821", "name": "Rahul", "initials": "RV", "role": "Picker" },
  "hub": {
    "name": "Indiranagar Darkstore",
    "address": "80 Ft Rd, HAL 2nd Stage, Bengaluru 560038",
    "accuracy": "±8 m",
    "onSite": true
  },
  "shift": {
    "window": "9:00 AM – 6:00 PM",
    "active": false,
    "startedAt": null,
    "elapsedSeconds": 0,
    "onBreak": false
  },
  "balance": { "available": "₹4,850", "pending": "₹1,200 pending", "availableAmount": 4850 },
  "orders": { "count": 64, "pending": 8, "syncedLabel": "Orders synced from HHD", "progress": 88 },
  "metrics": { "todaysEarnings": "₹720", "incentivesToday": "₹150" },
  "performance": { "rank": "Top 12%", "accuracy": 98, "speedLabel": "42 items/hr", "speedPct": 85 },
  "device": { "collected": false, "id": "HHD-2231", "copy": "Enter the manager OTP to receive HHD-2231" },
  "unreadNotifications": 3
}
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `picker.id` | string | Yes | No | Rendered as `Picker · ID {id}` |
| `picker.name` | string | Yes | **Yes** | First name only — `Hi, {name}` |
| `picker.initials` | string | Yes | **Yes** | For `Avatar` |
| `hub.name` | string | Yes | **Yes** | `null` until a location is chosen |
| `hub.address` | string | Yes | **Yes** | |
| `hub.accuracy` | string | Yes | **Yes** | `"±8 m"` — pre-formatted; `null` when no GPS supplied |
| `hub.onSite` | boolean | Yes | No | Drives the "On site ✓" indicator |
| `shift.window` | string | Yes | **Yes** | `"9:00 AM – 6:00 PM"` |
| `shift.active` | boolean | Yes | No | Toggles START MY SHIFT vs CHECK OUT and the LIVE pill |
| `shift.startedAt` | string | Yes | **Yes** | ISO 8601 — lets the client resume the timer after a restart |
| `shift.elapsedSeconds` | number | Yes | No | Server-authoritative elapsed time |
| `shift.onBreak` | boolean | Yes | No | |
| `balance.available` | string | Yes | No | `"₹4,850"` |
| `balance.pending` | string | Yes | No | `"₹1,200 pending"` |
| `balance.availableAmount` | number | Yes | No | Raw, for the withdraw sheet's validation |
| `orders.count` | number | Yes | No | Today's completed orders |
| `orders.pending` | number | Yes | No | |
| `orders.syncedLabel` | string | Yes | No | |
| `orders.progress` | number | Yes | No | 0–100 |
| `metrics.todaysEarnings` | string | Yes | No | `"₹720"` |
| `metrics.incentivesToday` | string | Yes | No | `"₹150"` |
| `performance.rank` | string | Yes | **Yes** | `"Top 12%"` |
| `performance.accuracy` | number | Yes | No | 0–100 |
| `performance.speedLabel` | string | Yes | No | `"42 items/hr"` |
| `performance.speedPct` | number | Yes | No | 0–100 |
| `device.collected` | boolean | Yes | No | Hides the collect-device card when `true` |
| `device.id` | string | Yes | **Yes** | |
| `device.copy` | string | Yes | **Yes** | |
| `unreadNotifications` | number | No | No | Drives the bell badge dot |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 401 | Invalid / expired token | Auth message |
| 403 | Picker not `ACTIVE` | `"Your account is not active."` |
| 500 | Unexpected | Generic — the screen shows `ErrorState` with a retry |

#### Existing Backend Comparison — `NEW`

**Why existing APIs cannot satisfy the frontend.** No endpoint aggregates this data, and assembling it client-side would need six calls on every app open:

| Home section | Nearest existing endpoint | State |
|---|---|---|
| Hub name / address / GPS | `GET /shifts/readiness` | **Stub** — returns `{ ready: false, checks: [] }` |
| Shift window and active state | `GET /shifts/my` | Real, but returns raw assignment documents |
| Balance | `GET /wallet/balance` | **Stub** — `{ balance: 0, currency }` |
| Orders and sync progress | — | **No endpoint exists.** Sourced from the HHD app. |
| Today's earnings and incentives | — | **No endpoint exists.** No earnings pipeline (see logic gap #8). |
| Performance rank / accuracy / speed | `GET /performance/summary` | **Stub** — `{ summary: {} }` |
| Device collected | `GET /devices/assigned` | **Stub** — `{ device: null }` |
| Unread notifications | `GET /notifications` | Real — returns an `unread` count |

Four of the eight are stubs and two have no endpoint at all. Six round trips on a cold start, on a mobile connection, for one screen is also the wrong shape for the problem.

**Proposed endpoint contract:** `GET /home/summary` as specified above.

**Expected request:** bearer auth, optional `lat` / `lng` / `accuracyM`.

**Expected response:** the aggregate object above; every list-like field has a defined empty value and every optional scalar is nullable, so the screen degrades gracefully while upstream pipelines are still being built.

**Expected errors:** 401, 403, 500.

**Dependencies before this can return real data:**

- `orders.*` and `metrics.incentivesToday` originate in the **HHD scanning app**, a separate system. Confirm the integration path before specifying these fields as authoritative — until then they can be `0`.
- `metrics.todaysEarnings` requires the earnings pipeline (backend logic gap #8).
- `performance.*` requires defined metric sources (backend logic gap #9) — `ordersCompleted` is never written by any code today.
- `hub.onSite` requires the geofence check (backend logic gap #4).

**Frontend work required:** replace the `mockHome` import with `useApiResource(() => homeApi.getSummary())`, and remove the hardcoded greeting, ID and initials from JSX.

---

## 8. Shift & Attendance

### 8.1 Shift readiness

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Page:** `HomeScreen.tsx` → `src/overlays/ShiftVerifySheet.tsx`
- **Service:** `shiftApi.readiness`
- **Hook:** `useShift.startShift` — awaits the call, then advances the sheet to the `'location'` step
- **User action:** Picker taps **START MY SHIFT**; the verification sheet opens on the location check.
- **Why needed:** Confirms the picker is physically at their hub before a shift can begin. `config.geofenceMeters = 150`.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/shifts/readiness` |
| Authentication | **Required** — bearer |

**Query parameters**

| Name | Type | Required | Notes |
|---|---|---|---|
| `lat` | number | No | **Should be required** — the check is meaningless without it |
| `lng` | number | No | As above |
| `accuracyM` | number | No | Device-reported accuracy |

#### Response

**200 OK** — `data`:

```json
{
  "ready": true,
  "accuracyM": 8,
  "onSite": true,
  "distanceM": 42,
  "geofenceM": 150,
  "hub": "Indiranagar Darkstore",
  "blockers": []
}
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `ready` | boolean | **Yes** | No | All checks passed |
| `accuracyM` | number | **Yes** | No | GPS accuracy in metres — rendered as `±8 m` |
| `onSite` | boolean | **Yes** | No | Within the geofence |
| `distanceM` | number | No | **Yes** | Distance to the hub |
| `geofenceM` | number | No | No | Configured radius |
| `hub` | string | No | **Yes** | |
| `blockers` | string[] | No | No | Human-readable reasons; `[]` when ready |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | No location supplied | `"Location is required to start a shift."` |
| 401 | Invalid token | Auth message |
| 404 | No shift assigned for today | `"You have no shift scheduled today."` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract:** stub — `{ userId, ready: false, checks: [] }`.

**Frontend expected contract:** `{ ready, accuracyM, onSite }`.

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| `accuracyM` | Absent | Required | Undefined — the sheet cannot show GPS accuracy |
| `onSite` | Absent | Required | Undefined — the on-site indicator is meaningless |
| `checks` vs `blockers` | `checks: []` | Not expected | Unused |
| `ready` | Hardcoded `false` | Should gate progression | **The frontend ignores `ready` entirely** — `useShift.startShift` awaits the call and advances regardless of the result |
| Location input | Not accepted | Not sent | No geofence evaluation is possible |

**Consequence:** the geofence gate does not exist in either direction. The backend cannot evaluate it (no coordinates are accepted) and the frontend would not honour it (the result is discarded). A picker can start a shift from anywhere.

**Required change:**

1. Accept `lat`, `lng`, `accuracyM`.
2. Resolve the picker's hub via `currentLocationId` and compare against `PickerWorkLocation.coordinates` using `geofenceRadius` (default 200 in the schema; the frontend advertises 150 — **reconcile these two values**).
3. Return `ready`, `accuracyM`, `onSite` plus the diagnostic fields.
4. **Frontend change required:** block on `ready === false` and surface `blockers` instead of advancing unconditionally.

---

### 8.2 Start shift

#### Status
`MODIFY_REQUIRED` — **contains a hard bug**

#### Frontend Usage
- **Page:** `HomeScreen.tsx` → `ShiftVerifySheet.tsx`, final "Start work" step
- **Service:** `shiftApi.start()` — **called with no argument**, so it posts to `/shifts/start`
- **Hook:** `useShift.startWork` — awaits the call, then dispatches `shift/startWork` to begin the local timer
- **User action:** Picker completes location, identity and face checks, then taps **Start work**.
- **Why needed:** Begins the working session; flips the Home card to the LIVE state with a running timer.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/shifts/start` (no path parameter) — `/shifts/:shiftId/start` also exists but the frontend never uses it |
| Authentication | **Required** — bearer |
| Authorization | `status === 'ACTIVE'` |
| Body | Empty. **Proposed:** `{ "latitude": 12.9784, "longitude": 77.6408 }` so the punch-in location is captured. |

#### Response

**200 OK** — `data`:

```json
{
  "shiftId": "66f1c2d3e4f5a60718293b5c",
  "assignmentId": "66f1f2a3b4c5d60718293e8f",
  "status": "STARTED",
  "startedAt": "2026-09-04T03:32:00.000Z",
  "attendanceId": "66f2a3b4c5d6e70819203f90",
  "window": "9:00 AM – 6:00 PM"
}
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `shiftId` | string | Yes | No | |
| `assignmentId` | string | Yes | No | |
| `status` | string | Yes | No | `ASSIGNED` \| `STARTED` \| `COMPLETED` \| `CANCELLED` \| `NO_SHOW` |
| `startedAt` | string | **Yes** | No | ISO 8601 — the client should seed its timer from this, not from device time |
| `attendanceId` | string | Yes | No | The `PickerAttendance` record created by this call |
| `window` | string | No | **Yes** | |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Outside the geofence | `"You must be at your hub to start a shift."` |
| 401 | Invalid token | Auth message |
| 403 | Picker not `ACTIVE` | `"Your account is not active."` |
| 404 | No assignment for today | `"You have no shift scheduled today."` |
| 409 | Shift already started | `"Your shift is already active."` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract:**

```ts
// picker.routes.ts
router.post('/shifts/start', authenticatePicker, ctrl.startShift);
router.post('/shifts/:shiftId/start', authenticatePicker, ctrl.startShift);

// picker.controller.ts
const result = await pickerService.startShift(userId, req.params.shiftId);

// picker.service.ts
const assignment = await PickerShiftAssignment.findOne({
  userId: new mongoose.Types.ObjectId(userId),
  shiftId: new mongoose.Types.ObjectId(shiftId),   // shiftId === undefined
  status: 'ASSIGNED',
});
if (!assignment) throw Object.assign(new Error('Shift assignment not found'), { statusCode: 404 });
```

**Frontend expected contract:** `POST /shifts/start` with no path parameter starts today's shift.

**Exact mismatch:**

1. **The `undefined` ObjectId bug.** Both routes share one handler that reads `req.params.shiftId`. On `/shifts/start` that value is `undefined`, and `new mongoose.Types.ObjectId(undefined)` does not throw — it **generates a brand-new random ObjectId**. The query then searches for an assignment whose `shiftId` is a value that has never existed, `findOne` returns `null`, and the service throws 404.

   **Result: every "START MY SHIFT" tap fails with `404 "Shift assignment not found"`.** This is the primary action on the app's main screen.

2. **No attendance record is created.** `startShift` only sets `assignment.status = 'STARTED'` and `startedAt`. It never inserts a `PickerAttendance` row. But `startBreak` requires one:

   ```ts
   const attendance = await PickerAttendance.findOne({ userId, punchOut: null, status: 'ON_DUTY' });
   if (!attendance) throw Object.assign(new Error('No active shift found'), { statusCode: 404 });
   ```

   So even if bug 1 were fixed, **breaks would still fail with 404**, and the shift would leave no attendance trace — meaning no hours, no payroll, and nothing for the Attendance or Work History screens to show.

3. **No geofence check** — see 8.1.

4. **`startedAt` is not consumed.** The frontend runs its timer purely from local state, so force-quitting the app loses the elapsed time.

**Required change:**

1. When `shiftId` is absent, resolve the picker's assignment for today (`userId`, `date` within today, `status: 'ASSIGNED'`) instead of constructing an ObjectId from `undefined`. Guard the parameterised route with `mongoose.isValidObjectId` as well.
2. Create the `PickerAttendance` record (`punchIn: now`, `status: 'ON_DUTY'`, `locationIn`) inside the same operation, ideally in a transaction with the assignment update.
3. Validate the geofence before allowing the start.
4. Return `startedAt` and have the frontend seed its timer from it.

---

### 8.3 End shift

#### Status
`MODIFY_REQUIRED` — **same bug as 8.2**

#### Frontend Usage
- **Page:** `HomeScreen.tsx` — the red **CHECK OUT** button shown while a shift is active
- **Service:** `shiftApi.end()` — called with no argument, posting to `/shifts/end`
- **Hook:** `useShift.checkout`
- **User action:** Picker finishes work and taps **CHECK OUT**.
- **Why needed:** Closes the working session and finalises the day's hours.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/shifts/end` |
| Authentication | **Required** — bearer |
| Body | Empty. **Proposed:** `{ "latitude": 12.9784, "longitude": 77.6408 }`. |

#### Response

**200 OK** — `data`:

```json
{
  "shiftId": "66f1c2d3e4f5a60718293b5c",
  "status": "COMPLETED",
  "completedAt": "2026-09-04T12:32:00.000Z",
  "totalWorkedMinutes": 444,
  "breakMinutes": 45,
  "overtimeMinutes": 0,
  "lateByMinutes": 2,
  "hrs": "7h 24m"
}
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `shiftId` | string | Yes | No | |
| `status` | string | Yes | No | `COMPLETED` |
| `completedAt` | string | Yes | No | ISO 8601 |
| `totalWorkedMinutes` | number | Yes | No | Net of breaks |
| `breakMinutes` | number | Yes | No | |
| `overtimeMinutes` | number | Yes | No | Currently always `0` — see logic gap #7 |
| `lateByMinutes` | number | Yes | No | Currently always `0` |
| `hrs` | string | No | No | Pre-formatted, for a summary toast |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 401 | Invalid token | Auth message |
| 404 | No active shift | `"Shift not started"` |
| 409 | Already ended | `"Your shift has already ended."` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** identical structure to `startShift`, matching on `status: 'STARTED'`. **It carries the same `undefined` ObjectId bug** — `POST /shifts/end` always returns `404 "Shift not started"`.
- **Frontend expected contract:** ends today's active shift and returns the finalised totals.
- **Exact mismatch:** (1) the ObjectId bug makes checkout impossible; (2) `endShift` does **not** punch out — it only flips the assignment status, so `PickerAttendance.punchOut` and `totalWorkedMinutes` are never set by this path (the calculation lives in `punchOut`, which the frontend never calls); (3) none of the response fields above are returned — the raw assignment document is.
- **Required change:** resolve today's assignment when `shiftId` is absent, close the attendance record (punch out, compute worked and break minutes, and — once logic gap #7 is addressed — late and overtime minutes), and return the finalised payload.

---

### 8.4 Select shift

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Service:** `shiftApi.select(shiftId)`
- **Current usage:** onboarding step 4 stores the choice in local state (`ob.shift`) and does not call this endpoint; the selection is not persisted anywhere today.
- **Why needed:** To turn the step-4 choice into a real `PickerShiftAssignment`, which 8.2 then needs in order to start a shift.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/shifts/select` |
| Authentication | **Required** — bearer |

**Body**

```json
{ "shiftId": "morning", "date": "2026-09-05" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `shiftId` | string | **Yes** | Must match the `id` returned by 6.2 — **resolve the `id` vs `_id` ambiguity** |
| `date` | string | No | `YYYY-MM-DD`; defaults to today |

#### Response

**201 Created** — `data`:

```json
{ "assignmentId": "66f1f2a3b4c5d60718293e8f", "shiftId": "66f1c2d3e4f5a60718293b5c", "date": "2026-09-05", "status": "ASSIGNED" }
```

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Missing `shiftId` | `"shiftId is required"` |
| 404 | Unknown shift | `"Shift not found"` |
| 409 | Already assigned for that date | `"You already have a shift on this date."` |
| 409 | Shift full | `"This shift is fully booked."` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** real — `picker.service.selectShift` creates a `PickerShiftAssignment` and returns the document (`_id`, not `assignmentId`).
- **Exact mismatch:** (1) **capacity is never enforced** — `PickerShift.capacity` is read but never compared against existing assignments, so a shift can be overbooked without limit; (2) **no duplicate guard** — there is no unique index on `(userId, shiftId, date)`, so repeated taps create duplicate assignments, which would then make 8.2's "find today's assignment" ambiguous; (3) `date` is hardcoded to `new Date()`, so a future date cannot be booked; (4) `_id` vs `assignmentId` naming.
- **Required change:** enforce capacity, add a unique compound index on `(userId, shiftId, date)`, accept an optional `date`, and return the projected response. **Frontend change required:** call this endpoint from onboarding step 4 instead of only storing the choice locally.

---

### 8.5 Start / end break

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Services:** `shiftApi.startBreak`, `shiftApi.endBreak`
- **Current usage:** defined; not yet called from a screen.
- **Why needed:** Break time is deducted from worked hours in `punchOut`, so the pay calculation depends on it.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/shifts/break/start`, `/shifts/break/end` |
| Authentication | **Required** — bearer |
| Body | Empty |

#### Response

**200 OK** — `data`:

```json
{ "onBreak": true, "breakStartedAt": "2026-09-04T07:00:00.000Z", "breakMinutesToday": 15, "status": "ON_BREAK" }
```

| Field | Type | Required | Nullable |
|---|---|---|---|
| `onBreak` | boolean | Yes | No |
| `breakStartedAt` | string | Yes | **Yes** |
| `breakMinutesToday` | number | Yes | No |
| `status` | string | Yes | No |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 401 | Invalid token | Auth message |
| 404 | No active shift (start) | `"No active shift found"` |
| 404 | No active break (end) | `"No active break found"` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** real and correct in itself — `startBreak` pushes `{ startTime }` onto `PickerAttendance.breaks` and sets `status: 'ON_BREAK'`; `endBreak` closes the last open break. Both mirror the state to `PickerUser.onBreak`.
- **Exact mismatch:** the response is the raw `PickerAttendance` document, not the projected fields above. More importantly, **both depend on a `PickerAttendance` row with `status: 'ON_DUTY'`, which the shift-start flow never creates** (see 8.2). Until 8.2 is fixed, both break endpoints return `404 "No active shift found"` for every picker.
- **Required change:** project the response, and fix 8.2 so an attendance record exists. Also consider enforcing `PickerShift.breakDuration` as a cap — it is stored but never used.

---

### 8.6 Punch in

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Service:** `attendanceApi.punchIn({ latitude, longitude })`
- **Current usage:** defined; the Home screen's shift flow calls `shiftApi.start()` instead. Retained as the explicit attendance action.
- **Why needed:** Creates the attendance record that drives hours, payroll and the Work History screen.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/attendance/punch-in` |
| Authentication | **Required** — bearer |

**Body — what the frontend sends**

```json
{ "latitude": 12.9784, "longitude": 77.6408 }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `latitude` | number | **Yes** | −90 to 90 |
| `longitude` | number | **Yes** | −180 to 180 |
| `accuracyM` | number | No | |
| `shiftId` | string | No | Defaults to today's assignment |

#### Response

**201 Created** — `data`:

```json
{ "ok": true, "time": "2026-09-04T03:32:00.000Z", "attendanceId": "66f2a3b4c5d6e70819203f90", "status": "ON_DUTY", "lateByMinutes": 2 }
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `ok` | boolean | Yes | No | The frontend types the result as `{ ok, time }` |
| `time` | string | **Yes** | No | ISO 8601 punch-in time |
| `attendanceId` | string | Yes | No | |
| `status` | string | Yes | No | `ON_DUTY` |
| `lateByMinutes` | number | Yes | No | |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Already punched in | `"Already punched in"` |
| 400 | Outside the geofence | `"You must be at your hub to punch in."` |
| 401 | Invalid token | Auth message |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract:**

```ts
const { location, shiftId } = req.body;
const result = await pickerService.punchIn(userId, location, shiftId);
```

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| Location shape | Reads `req.body.location` (nested object) | Sends flat `{ latitude, longitude }` | **`location` is always `undefined`**, so `locationIn` is never stored and there is no data to geofence against |
| Response | Raw `PickerAttendance` document | `{ ok, time }` | `ok` and `time` are both undefined |
| Geofence | Not validated | — | Punch-in succeeds from anywhere |
| `lateByMinutes` | Defaults to `0`, never computed | — | No lateness tracking |

The duplicate-punch guard (`punchOut: null` → 400 "Already punched in") is correct and should be kept.

**Required change:** accept the flat `{ latitude, longitude, accuracyM }` shape (or both shapes during a transition), validate the geofence, compute `lateByMinutes` against the scheduled shift start, and return `{ ok, time, attendanceId, status, lateByMinutes }`.

---

### 8.7 Punch out

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Service:** `attendanceApi.punchOut({ latitude, longitude })`
- **Why needed:** Closes the attendance record and computes worked hours.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/attendance/punch-out` |
| Authentication | **Required** — bearer |
| Body | `{ "latitude": 12.9784, "longitude": 77.6408 }` |

#### Response

**200 OK** — `data`:

```json
{ "ok": true, "time": "2026-09-04T12:32:00.000Z", "totalWorkedMinutes": 444, "breakMinutes": 45, "overtimeMinutes": 0, "status": "COMPLETED" }
```

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Not punched in | `"Not punched in"` |
| 401 | Invalid token | Auth message |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** real and mostly correct — sets `punchOut`, `status: 'COMPLETED'`, and computes `totalWorkedMinutes` as elapsed minus break time. Returns the raw document.
- **Exact mismatch:** (1) same `req.body.location` vs flat `{ latitude, longitude }` problem as 8.6, so `locationOut` is never stored; (2) `{ ok, time }` are not returned; (3) **`overtimeMinutes` and `lateByMinutes` are never computed** — they stay at their schema defaults of `0`, which is why the Attendance screen's entire OT tab has no data source (logic gap #7).
- **Required change:** accept the flat location shape, project the response, and compute overtime against the scheduled shift end and a defined OT policy.

---

### 8.8 Attendance summary

#### Status
`MODIFY_REQUIRED` — **crashes the screen today**

#### Frontend Usage
- **Page:** `src/screens/attendance/AttendanceScreen.tsx` — the second tab in the bottom navigation
- **Components:** hours-worked header, three tabs (`details`, `ot`, `history`), `KeyValueRow` list, OT week rows, month calendar grid
- **Service:** `attendanceApi.getSummary`
- **Hook:** `useAttendance` → `useApiResource(() => attendanceApi.getSummary())`; `liveHours` prefers the running shift timer and falls back to `resource.data?.present.hoursToday`
- **User action:** Opens the Attendance tab and switches between the three sub-tabs.
- **Why needed:** Supplies every value on the screen — today's punch details, overtime, and the monthly calendar.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/attendance/summary` |
| Authentication | **Required** — bearer |

**Query parameters**

| Name | Type | Required | Notes |
|---|---|---|---|
| `month` | string | No | **Proposed** — `YYYY-MM`; defaults to the current month. Needed for the calendar's month pager. |

#### Response

**200 OK** — `data`:

```json
{
  "present": { "window": "9:00 AM – 6:00 PM", "punchedInOnTime": true, "hoursToday": "07:24:10", "pct": 82 },
  "detailsRows": [
    { "k": "Warehouse / Darkstore", "v": "Indiranagar" },
    { "k": "Punch In", "v": "09:02 AM" },
    { "k": "Expected Punch Out", "v": "06:00 PM" },
    { "k": "Scheduled Hours", "v": "9 hrs" }
  ],
  "ot": {
    "totalHrs": "12 hrs",
    "rate": "1.5x",
    "totalEarnings": "₹1,800",
    "weeks": [
      { "week": "Week 1", "range": "Mar 1-7",   "hrs": "4 hrs", "amt": "₹600" },
      { "week": "Week 2", "range": "Mar 8-14",  "hrs": "3 hrs", "amt": "₹450" },
      { "week": "Week 3", "range": "Mar 15-21", "hrs": "5 hrs", "amt": "₹750" }
    ]
  },
  "history": {
    "month": "March 2026",
    "dow": ["S", "M", "T", "W", "T", "F", "S"],
    "cells": [
      { "n": "1", "tone": "none", "selected": false },
      { "n": "2", "tone": "present", "selected": false },
      { "n": "",  "tone": "empty", "selected": false }
    ],
    "presentDays": 22,
    "halfDays": 1
  },
  "stats": { "presentDays": 22, "halfDays": 1, "otHours": 12 }
}
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `present` | object | **Yes** | No | **Must be an object, not a number** |
| `present.window` | string | Yes | **Yes** | Scheduled shift window |
| `present.punchedInOnTime` | boolean | Yes | No | |
| `present.hoursToday` | string | Yes | **Yes** | `HH:MM:SS`; overridden by the live timer while a shift is active |
| `present.pct` | number | Yes | No | 0–100, progress through the shift |
| `detailsRows` | array | **Yes** | No | `{ k, v }` pairs. **Must be `[]`, never absent** — the screen calls `.map()` on it. |
| `ot.totalHrs` | string | Yes | No | |
| `ot.rate` | string | Yes | No | `"1.5x"` — requires an OT pay policy that does not exist |
| `ot.totalEarnings` | string | Yes | No | |
| `ot.weeks` | array | **Yes** | No | `{ week, range, hrs, amt }`; `[]` when none |
| `history.month` | string | Yes | No | `"March 2026"` |
| `history.dow` | string[] | Yes | No | Seven weekday initials |
| `history.cells` | array | **Yes** | No | 35 or 42 cells. `n` is the day number or `""` for padding; `tone` is `present` \| `half` \| `none` \| `empty`; `selected` marks today. |
| `history.presentDays` | number | Yes | No | |
| `history.halfDays` | number | Yes | No | |
| `stats` | object | Yes | No | `{ presentDays, halfDays, otHours }` |

#### Error Responses

| Status | Case |
|---|---|
| 401 | Invalid / expired token |
| 500 | Unexpected — `useApiResource` sets `error` and the screen falls back to the bundled mock |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract:**

```ts
export async function getAttendanceSummary(req, res, next) {
  try {
    const userId = requirePickerId(req);
    res.json(ResponseFormatter.success({ userId, present: 0, absent: 0, late: 0 }));
  } catch (err) { next(err); }
}
```

**Frontend expected contract:** the nested view model above.

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| `present` | `0` (number) | `{ window, punchedInOnTime, hoursToday, pct }` | `resource.data.present.hoursToday` on a number yields `undefined` — no crash, but the hours header is blank |
| `detailsRows` | **Absent** | Array | **`a.detailsRows.map()` throws `TypeError: Cannot read property 'map' of undefined`** — the Details tab, which is the default tab, crashes on render |
| `ot` | **Absent** | Object with a `weeks` array | `a.ot.weeks.map()` throws |
| `history` | **Absent** | Object with `dow` and `cells` arrays | `a.history.dow.map()` throws |
| `stats` | **Absent** | Object | Blank |
| `absent`, `late` | Returned | Not expected | Unused |

**Consequence:** the Attendance tab **crashes on open** as soon as the API responds, because the `?? mockAttendance` fallback does not fire — the response is a successful non-null object, so it replaces the mock, and the mock's `detailsRows` is exactly what the render path requires.

**Required change:**

1. Build the full aggregate from `PickerAttendance` and the picker's assigned `PickerShift`.
2. `detailsRows`, `ot.weeks`, `history.dow` and `history.cells` must always be arrays — `[]` at minimum.
3. `present` must be an object.
4. Generate the calendar grid server-side, mapping each day's attendance `status` to a `tone`: `present` → `present`, `half-day` → `half`, no record or a rest day → `none`, and padding cells → `empty` with `n: ""`.
5. **Blocked on backend logic gap #7:** `ot.rate`, `ot.totalEarnings` and `ot.weeks[].amt` require an overtime pay policy. `overtimeMinutes` is never computed today, so OT values will be zero until `punchOut` is fixed. Ship the correct **shape** first with zeroed values, so the screen renders while the pay pipeline is built.

---

### 8.9 Attendance stats

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Service:** `attendanceApi.getStats` — defined, **not called by any screen**. The Attendance screen reads `stats` from 8.8 instead.
- **Why needed:** A lighter call for the same three counters, if a widget ever needs them without the full summary.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/attendance/stats` |
| Authentication | **Required** — bearer |
| Query parameters | `month` (`YYYY-MM`, optional) |

#### Response

**200 OK** — `data`: `{ "presentDays": 22, "halfDays": 1, "otHours": 12 }`

| Field | Type | Required | Nullable |
|---|---|---|---|
| `presentDays` | number | Yes | No |
| `halfDays` | number | Yes | No |
| `otHours` | number | Yes | No |

#### Error Responses

| Status | Case |
|---|---|
| 401 | Invalid token |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** stub — `{ userId, stats: {} }`.
- **Frontend expected contract:** the three flat counters above (matching `mockAttendance.stats`).
- **Exact mismatch:** the counters are nested inside an empty `stats` object rather than returned at the top level, and none are computed. No field name overlaps.
- **Required change:** aggregate `PickerAttendance` by status for the month and return the three counters flat. Low priority — no screen consumes it.

---

### 8.10 Work history

#### Status
`MODIFY_REQUIRED` — **crashes the screen today; one endpoint serving two incompatible contracts**

#### Frontend Usage
- **Page:** `src/screens/profile/WorkHistoryScreen.tsx` (Profile → Work History)
- **Components:** month pager, three summary tiles (Present / Overtime / Total), day rows with a `StatusBadge`
- **Service:** `profileApi.getWorkHistory({ month })`
- **Hook:** `useApiResource(() => profileApi.getWorkHistory())`
- **User action:** Opens Profile → Work History; pages between months.
- **Why needed:** The picker's record of attendance and hours — the basis for any pay dispute.

> **Contract collision.** `GET /attendance` is called by **two different frontend services expecting two different shapes**: `attendanceApi.getAttendance({ month, year })` (paginated records) and `profileApi.getWorkHistory({ month })` (the view model below). These cannot both be satisfied by one response — see *Required change*.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/attendance` |
| Authentication | **Required** — bearer |

**Query parameters**

| Name | Type | Required | Notes |
|---|---|---|---|
| `month` | string | No | `YYYY-MM`. **Sent by the frontend; ignored by the backend today.** |
| `year` | string | No | Sent by `attendanceApi.getAttendance`; ignored |
| `view` | string | No | **Proposed** — `history` to select the view model below |
| `page` | number | No | Read by the backend; not sent by the frontend |
| `limit` | number | No | Read by the backend; not sent by the frontend |

#### Response

**200 OK** — `data`:

```json
{
  "month": "March 2026",
  "summary": { "present": "22", "overtime": "12h", "total": "198h" },
  "rows": [
    { "date": "Wed, 11 Mar", "hub": "Indiranagar", "hrs": "9h 02m", "badge": "Present",     "tone": "success" },
    { "date": "Tue, 10 Mar", "hub": "Indiranagar", "hrs": "9h 14m", "badge": "Present +OT", "tone": "success" },
    { "date": "Mon, 09 Mar", "hub": "Indiranagar", "hrs": "4h 30m", "badge": "Half day",    "tone": "warning" },
    { "date": "Fri, 06 Mar", "hub": "Indiranagar", "hrs": "—",      "badge": "Absent",      "tone": "danger" }
  ]
}
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `month` | string | **Yes** | No | `"March 2026"` |
| `summary.present` | string | **Yes** | No | Day count **as a string** — rendered directly |
| `summary.overtime` | string | **Yes** | No | `"12h"` |
| `summary.total` | string | **Yes** | No | `"198h"` |
| `rows` | array | **Yes** | No | **Must be `[]`, never absent** — `.map()` is called on it |
| `rows[].date` | string | Yes | No | `"Wed, 11 Mar"`. **Used as the React key — must be unique within the month.** |
| `rows[].hub` | string | Yes | **Yes** | Short location name |
| `rows[].hrs` | string | Yes | No | `"9h 02m"`, or `"—"` when absent |
| `rows[].badge` | string | Yes | No | `Present` \| `Present +OT` \| `Half day` \| `Absent` |
| `rows[].tone` | string | Yes | No | `success` \| `warning` \| `danger` \| `neutral` \| `info` |

#### Error Responses

| Status | Case |
|---|---|
| 401 | Invalid token |
| 500 | Unexpected — falls back to the bundled mock |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract** (`picker.service.getAttendance`):

```json
{
  "records": [
    {
      "_id": "66f2a3b4c5d6e70819203f90",
      "userId": "66f1a2b3c4d5e6f708192a3b",
      "punchIn": "2026-03-11T03:32:00.000Z",
      "punchOut": "2026-03-11T12:34:00.000Z",
      "status": "COMPLETED",
      "breaks": [],
      "lateByMinutes": 0,
      "overtimeMinutes": 0,
      "totalWorkedMinutes": 542
    }
  ],
  "total": 47, "page": 1, "limit": 20, "totalPages": 3
}
```

**Frontend expected contract:** `{ month, summary, rows }`.

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| `summary` | **Absent** | `{ present, overtime, total }` | **`wh.summary.present` throws `TypeError: Cannot read property 'present' of undefined`** — the screen crashes before rendering any row |
| `rows` | `records` | `rows` | `wh.rows.map()` throws |
| `month` | **Absent** | `"March 2026"` | Month pager blank |
| Row date | `punchIn` (ISO) | `"Wed, 11 Mar"` | Unformatted |
| Row hours | `totalWorkedMinutes: 542` | `"9h 02m"` | Unformatted |
| Row hub | **Absent** (`warehouseKey` is not projected) | `hub` | Blank |
| `badge` / `tone` | **Absent** — no display mapping | Required | No badge |
| `month` filter | **Ignored** — the controller reads only `page` and `limit` | Sent by the frontend | Always returns the most recent 20 records regardless of the month requested; **the month pager cannot work** |
| Pagination | Wrapped inside `data` | Frontend expects `data` to be the view model | Structural conflict |

**Required change:**

1. **Resolve the two-caller collision.** Recommended: add `?view=history` returning the view model, and keep the default response for the paginated-records caller. Alternatively, split into `GET /attendance` (records) and `GET /attendance/history` (view model). Whichever is chosen, update the frontend service so each caller hits the right contract.
2. **Implement the `month` filter** — parse `YYYY-MM` and range-query `punchIn`.
3. Compute the monthly summary: present-day count, total overtime hours, total hours worked — each formatted as a string.
4. Project each row with a formatted `date`, resolved `hub`, formatted `hrs`, and a derived `badge`/`tone`:

   | Condition | `badge` | `tone` |
   |---|---|---|
   | `status = present`/`COMPLETED`, `overtimeMinutes = 0` | `Present` | `success` |
   | `status = present`/`COMPLETED`, `overtimeMinutes > 0` | `Present +OT` | `success` |
   | `status = half-day` | `Half day` | `warning` |
   | `status = absent` or no record on a scheduled day | `Absent` | `danger` |

5. Move pagination metadata into the envelope's `pagination` field, never inside `data`.
6. Note that `badge = "Present +OT"` depends on `overtimeMinutes`, which is **never computed** (logic gap #7) — that badge can never appear until `punchOut` is fixed.
7. `rows[].date` is the React key, so absent days must still produce a unique date string.

---

## 9. Wallet & Payouts

### 9.1 Wallet balance

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Page:** `src/screens/payouts/PayoutsScreen.tsx`
- **Components:** payout card (month, net payout, pay date), available-to-withdraw row with a **Withdraw** button, bank/UPI verification rows
- **Service:** `walletApi.getBalance`
- **Hook:** `useApiResource(() => walletApi.getBalance())`; `const w = walletData ?? mockWalletSummary`
- **User action:** Opens Profile → Payouts, or taps the Home balance card.
- **Why needed:** Shows earnings and gates the withdrawal flow.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/wallet/balance` |
| Authentication | **Required** — bearer |
| Query parameters | `month` (`YYYY-MM`, optional) |

#### Response

**200 OK** — `data`:

```json
{
  "month": "March 2026",
  "netPayout": "₹18,450",
  "payDate": "5 Apr 2026",
  "available": "₹4,850",
  "availableAmount": 4850,
  "pending": "₹1,200",
  "pendingAmount": 1200,
  "currency": "INR",
  "bankLabel": "HDFC ••7821",
  "bankVerified": true,
  "upiVerified": false,
  "minWithdrawal": 100
}
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `month` | string | **Yes** | No | `"March 2026"` |
| `netPayout` | string | **Yes** | No | Formatted currency |
| `payDate` | string | **Yes** | **Yes** | `"5 Apr 2026"` |
| `available` | string | **Yes** | No | Formatted |
| `availableAmount` | number | **Yes** | No | **Raw — the withdraw sheet must validate against this**, replacing the hardcoded `4850` in `useWallet` |
| `pending` / `pendingAmount` | string / number | No | No | |
| `currency` | string | Yes | No | `"INR"` |
| `bankLabel` | string | **Yes** | **Yes** | Masked, e.g. `"HDFC ••7821"`; `null` when no account |
| `bankVerified` | boolean | **Yes** | No | Drives the Verified/Pending badge |
| `upiVerified` | boolean | **Yes** | No | |
| `minWithdrawal` | number | No | No | Lets the client stop hardcoding `config.minWithdrawal` |

#### Error Responses

| Status | Case |
|---|---|
| 401 | Invalid token |
| 500 | Unexpected — falls back to the bundled mock |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract:** stub — `{ userId, balance: 0, currency: 'INR' }`.

**Frontend expected contract:** the eleven fields above.

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| `month` | Absent | Required | `Current Month · undefined` |
| `netPayout` | Absent | Required | Blank hero figure |
| `payDate` | Absent | Required | `Pay date: undefined` |
| `available` | `balance: 0` | `available: "₹4,850"` | Blank |
| `availableAmount` | Absent | Required | Withdraw validation has no real ceiling |
| `bankLabel` / `bankVerified` / `upiVerified` | Absent | Required | Verification rows show hardcoded badges |

**Only `currency` overlaps.** Every figure on the Payouts screen renders as `undefined`.

**Required change:**

1. Read `PickerWallet` (`availableBalance`, `pendingBalance`, `totalEarnings`) — the real `picker.service.getWallet` already does this, including lazily creating the wallet.
2. Join the primary `PickerBankAccount` for `bankLabel` (masked) and `bankVerified`; read `PickerUser.upiPayoutVerificationStatus` for `upiVerified`.
3. Format the currency strings and return the raw amounts alongside.
4. **Blocked on backend logic gap #8:** `netPayout` and `payDate` require a monthly payout cycle that does not exist. Ship the shape with zeroed values first.

---

### 9.2 Transaction history

#### Status
`MODIFY_REQUIRED` — **crashes the screen today**

#### Frontend Usage
- **Page:** `PayoutsScreen.tsx` — "Transaction history" section
- **Service:** `walletApi.getTransactions`
- **Hook:** `useApiResource(() => walletApi.getTransactions())`; `const payouts = txnsData ?? mockPayouts`, then `payouts.map(p => …)` keyed `key={p.month}`
- **User action:** Scrolls the Payouts screen.
- **Why needed:** The picker's payment record.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/wallet/transactions` |
| Authentication | **Required** — bearer |

**Query parameters**

| Name | Type | Required | Default | Notes |
|---|---|---|---|---|
| `page` | number | No | 1 | Supported; **not sent by the frontend** (no pagination UI) |
| `limit` | number | No | 20 | Supported; not sent |

#### Response

**200 OK** — `data` is an **array**; pagination goes in the envelope:

```json
[
  { "id": "66f3a4b5c6d7e80819204a01", "month": "February 2026", "date": "5 Mar 2026", "mode": "Bank transfer", "amt": "₹17,200", "amount": 17200, "status": "completed", "type": "credit" },
  { "id": "66f3a4b5c6d7e80819204a02", "month": "January 2026",  "date": "5 Feb 2026", "mode": "Bank transfer", "amt": "₹16,850", "amount": 16850, "status": "completed", "type": "credit" }
]
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `id` | string | **Yes** | No | Should become the React key (see below) |
| `month` | string | **Yes** | No | `"February 2026"` — **currently used as the React key, so it must be unique** |
| `date` | string | **Yes** | No | `"5 Mar 2026"` |
| `mode` | string | **Yes** | No | `"Bank transfer"` \| `"UPI"` |
| `amt` | string | **Yes** | No | Formatted |
| `amount` | number | No | No | Raw |
| `status` | string | No | No | `pending` \| `completed` \| `failed` |
| `type` | string | No | No | `credit` \| `debit` |

Empty → `[]`; the screen shows an `EmptyState`.

#### Error Responses

| Status | Case |
|---|---|
| 401 | Invalid token |
| 500 | Unexpected — falls back to the bundled mock |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract** (`picker.service.getTransactions`):

```json
{
  "transactions": [
    {
      "_id": "66f3a4b5c6d7e80819204a01",
      "userId": "66f1a2b3c4d5e6f708192a3b",
      "type": "credit",
      "amount": 17200,
      "description": "February payout",
      "referenceId": "PAY-2026-02",
      "status": "completed",
      "currency": "INR",
      "createdAt": "2026-03-05T06:00:00.000Z"
    }
  ],
  "total": 12, "page": 1, "limit": 20, "totalPages": 1
}
```

**Frontend expected contract:** `[{ month, date, mode, amt }]`.

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| Array vs object | `{ transactions, total, … }` | Array | **`payouts.map()` throws `TypeError: payouts.map is not a function`** — the Payouts screen crashes |
| `month` | Absent | Required, **used as the React key** | Every key `undefined` |
| `date` | `createdAt` (ISO) | `"5 Mar 2026"` | Unformatted |
| `mode` | Absent | `"Bank transfer"` | Blank |
| `amt` | `amount: 17200` | `"₹17,200"` | Unformatted |
| Identifier | `_id` | `id` | — |

**Required change:**

1. **Return the array as `data`**; move `total`/`page`/`limit` into the envelope's `pagination` field via `ResponseFormatter.paginated`.
2. Project `month` (from `createdAt`), `date`, `mode` (derive from the payout rail), and `amt`.
3. Keep `id` and change the frontend key from `p.month` to `p.id` — two payouts in one month would otherwise collide.
4. Note that `PickerTransaction` rows are **never created by any code path** (logic gap #8), so this list is empty for every picker until the earnings pipeline exists.

---

### 9.3 Request withdrawal

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Component:** `src/overlays/WithdrawSheet.tsx`, opened from the Payouts screen's **Withdraw** button
- **Service:** `walletApi.withdraw`
- **Hook:** `useWallet.submitWithdraw` — validates `amt >= config.minWithdrawal` (₹100) and `amt <= AVAILABLE`, then submits
- **User action:** Picker enters an amount and taps **Withdraw**.
- **Why needed:** The only way for a picker to move earnings to their bank account.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/wallet/withdraw` |
| Authentication | **Required** — bearer |
| Authorization | `status === 'ACTIVE'`, and a verified bank account |

**Body**

```json
{ "amount": 2000, "accountId": "66f4b5c6d7e8f90819205b12", "idempotencyKey": "wd_1757001234567" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `amount` | number | **Yes** | Integer ≥ `100` (`config.minWithdrawal`), ≤ `availableBalance` |
| `accountId` | string | No | A `PickerBankAccount` owned by the picker; defaults to the primary account |
| `idempotencyKey` | string | **Yes** (proposed) | Client-generated; a repeat within 24 h returns the original request rather than creating a second |

#### Response

**201 Created** — `data`:

```json
{ "id": "66f5c6d7e8f9a00819206c23", "status": "PENDING", "amount": 2000, "requestedAt": "2026-09-04T10:15:00.000Z", "availableBalance": 2850 }
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `id` | string | **Yes** | No | Frontend types this as `{ id, status }` |
| `status` | string | **Yes** | No | `PENDING` \| `APPROVED` \| `PAID` \| `REJECTED` |
| `amount` | number | Yes | No | |
| `requestedAt` | string | Yes | No | ISO 8601 |
| `availableBalance` | number | No | No | Post-debit balance, so the client can refresh without a second call |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Amount missing or ≤ 0 | `"Valid amount is required"` |
| 400 | Below the minimum | `"Minimum withdrawal is ₹100."` |
| 400 | Exceeds the available balance | `"Insufficient balance"` |
| 401 | Invalid token | Auth message |
| 403 | No verified bank account | `"Add a verified bank account before withdrawing."` |
| 404 | Wallet or account not found | `"Wallet not found"` |
| 409 | Duplicate `idempotencyKey` | Returns the original request with `200` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract:**

```ts
const { amount } = req.body;
if (!amount || amount <= 0) { res.status(400).json(error('Valid amount is required', 400)); return; }
const result = await pickerService.requestWithdrawal(userId, amount);
// service: checks availableBalance, moves amount to reservedBalance, creates PickerWithdrawalRequest
```

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| `accountId` | **Read from the body? No — ignored entirely** | Sent as `accountId` | The withdrawal is not linked to any bank account. An admin approving it in `PUT /admin/picker/withdrawals/:id/process` **has no destination** |
| `idempotencyKey` | Not accepted, no dedup | Generated in `useWallet` but **`walletApi.withdraw` never puts it in the body** | Double-tap creates **two** withdrawal requests and reserves the balance twice. Defect on both sides. |
| Identifier | `_id` on the returned document | `id` | Frontend reads `res.id` → `undefined` |
| Minimum | Only `amount > 0`; schema `min: 1` | ₹100 enforced client-side only | **The API accepts a ₹1 withdrawal** |
| Balance ceiling | `availableBalance` checked correctly | Compared against a hardcoded `AVAILABLE = 4850` | Client-side check is meaningless; the server check is the only real one |

The balance-reservation logic itself is correct: `availableBalance -= amount; reservedBalance += amount`, with the rejection path restoring it in `processWithdrawal`.

**Required change:**

1. Accept and validate `accountId`; verify ownership and that the account is verified; store it on `PickerWithdrawalRequest` (**a new field — the model has no account reference today**).
2. Accept `idempotencyKey`, add a unique index, and return the existing request on a repeat.
3. Enforce `amount >= 100` server-side.
4. Return `id` rather than `_id`.
5. **Frontend change required:** include `idempotencyKey` in the request body, and validate against `availableAmount` from 9.1 instead of the hardcoded constant.

---

## 10. Bank Accounts

### 10.1 List bank accounts

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Page:** `src/screens/payouts/BankDetailsScreen.tsx`
- **Component:** `KeyValueRow` list — Account Holder, Bank Name, Account Number (masked), IFSC Code
- **Service:** `bankApi.listAccounts`
- **User action:** Opens Profile → Bank Account.
- **Why needed:** Displays the payout destination and prefills the edit form.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/bank/accounts` |
| Authentication | **Required** — bearer |
| Authorization | Own accounts only — scoped by `pickerId` from the token |

#### Response

**200 OK** — `data` is an **array**:

```json
[
  {
    "id": "66f4b5c6d7e8f90819205b12",
    "accountHolderName": "Rahul Verma",
    "bankName": "HDFC Bank",
    "accountNumberMasked": "••••••••4821",
    "ifscCode": "HDFC0001234",
    "branchName": "Indiranagar",
    "isVerified": true,
    "isPrimary": true,
    "label": "HDFC ••7821"
  }
]
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `id` | string | **Yes** | No | |
| `accountHolderName` | string | **Yes** | No | |
| `bankName` | string | Yes | **Yes** | |
| `accountNumberMasked` | string | **Yes** | No | **Never return the full account number** |
| `ifscCode` | string | **Yes** | No | |
| `branchName` | string | No | **Yes** | |
| `isVerified` | boolean | **Yes** | No | |
| `isPrimary` | boolean | **Yes** | No | |
| `label` | string | No | No | `"HDFC ••7821"` for the Payouts row |

Empty → `[]`.

#### Error Responses

| Status | Case |
|---|---|
| 401 | Invalid token |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** real — `PickerBankAccount.find({ userId }).lean()` returns an array of raw documents: `{ _id, userId, accountHolderName, accountNumber, ifscCode, bankName, branchName, isVerified, isPrimary, createdAt, updatedAt }`.
- **Frontend expected contract:** the projection above.
- **Exact mismatch:** (1) **`accountNumber` is returned in full** — it should be masked; (2) `_id` vs `id`; (3) `userId`, `__v` and timestamps are leaked unnecessarily; (4) no `label` or `accountNumberMasked` for display. It **is** an array, so `.map()` is safe — this screen does not crash.
- **Required change:** project explicitly, mask the account number, and add `label`.

---

### 10.2 Add bank account

#### Status
`MODIFY_REQUIRED` — **blocks onboarding completion**

#### Frontend Usage

Three callers, **three different payload shapes**:

| Caller | Screen | Service call | Payload sent |
|---|---|---|---|
| Bank Details save | `BankDetailsScreen.tsx` | `profileApi.save('bank', data)` | `{ holder, bank, acc, ifsc }` |
| Onboarding step 8 | `Step8Bank.tsx` | `onboardingApi.addBankAccount(...)` | `{ accountNumber, ifsc, holderName }` |
| Onboarding finish | `useOnboarding.next` (step 8) | `onboardingApi.complete()` | `{}` — **an empty object** |

- **User action:** Picker enters bank details and taps **Save**, or **Finish & enter app** at the end of onboarding.
- **Why needed:** Payout destination; also the final action that completes onboarding.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/bank/accounts` |
| Authentication | **Required** — bearer |

**Body — proposed canonical contract**

```json
{
  "accountHolderName": "Rahul Verma",
  "accountNumber": "50100123454821",
  "ifscCode": "HDFC0001234",
  "bankName": "HDFC Bank",
  "isPrimary": true
}
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `accountHolderName` | string | **Yes** | 2–100 chars |
| `accountNumber` | string | **Yes** | 9–18 digits |
| `ifscCode` | string | **Yes** | `/^[A-Z]{4}0[A-Z0-9]{6}$/`, upper-cased |
| `bankName` | string | No | Resolvable from the IFSC |
| `branchName` | string | No | Resolvable from the IFSC |
| `isPrimary` | boolean | No | Defaults to `true` for the first account |

#### Response

**201 Created** — `data`: a single account object, same shape as 10.1.

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 401 | Invalid token | Auth message |
| 409 | Account already added | `"This account is already on file."` |
| 422 | Missing or malformed fields | `ResponseFormatter.validationError` with `error.details: [{ field, message }]` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract:**

```ts
// controller
const account = await pickerService.addBankAccount(userId, req.body);
// service
return PickerBankAccount.create({ userId, ...data });
```

`PickerBankAccount` schema requires `accountHolderName`, `accountNumber`, and `ifscCode`.

**Exact mismatch — none of the three callers can succeed:**

| Caller | Sends | Schema requires | Outcome |
|---|---|---|---|
| `profileApi.save('bank', …)` | `holder`, `bank`, `acc`, `ifsc` | `accountHolderName`, `accountNumber`, `ifscCode` | **All three required fields missing** → Mongoose `ValidationError` → surfaces as **500** |
| `bankApi.addAccount` / `onboardingApi.addBankAccount` | `accountNumber`, `ifsc`, `holderName` | as above | `accountNumber` matches; `ifsc` ≠ `ifscCode`, `holderName` ≠ `accountHolderName` → **two required fields missing** → **500** |
| `onboardingApi.complete()` | `{}` | as above | **All three missing** → **500** |

Field-by-field:

| Frontend field | Backend field | Match? |
|---|---|---|
| `holder` / `holderName` | `accountHolderName` | **No** |
| `acc` / `accountNumber` | `accountNumber` | Partial — only the second variant |
| `ifsc` | `ifscCode` | **No** |
| `bank` | `bankName` | **No** |

**Consequence:** `onboardingApi.complete()` is the **final action of the onboarding wizard** — `useOnboarding.next` calls it at step 8, then toasts "Onboarding complete · welcome aboard!" and resets to `Main`. It sends `{}`, which cannot satisfy the schema. **Onboarding cannot be completed.** This is one of three independent blockers on that flow (with 6.7 KYC and 6.9 face verification).

Additionally, the raw Mongoose validation error surfaces as a **500** rather than a **422**, so the frontend shows a generic failure instead of naming the bad fields — even though `ResponseFormatter.validationError` exists for exactly this.

**Required change:**

1. **Adopt one canonical contract** (the proposed body above) and align all three frontend callers — including replacing `onboardingApi.complete()`'s empty body with the real form data from `ob.bank`.
2. Add `validate()` middleware; return **422** with field-level details.
3. Validate the IFSC format and the account-number length server-side.
4. Set `isPrimary` on the first account (the field exists and is never written).
5. Return the projected account object, not the raw document.

> **Naming decision required.** Either the backend accepts the frontend's `holder`/`acc`/`ifsc` names and maps them, or the frontend is changed to send schema names. Record the decision — do not accept both.

---

### 10.3 Verify bank account

#### Status
`MODIFY_REQUIRED` — **security defect**

#### Frontend Usage
- **Page:** `BankDetailsScreen.tsx` — pre-save verification
- **Service:** `bankApi.verify`
- **User action:** Picker enters an account number and IFSC; the app verifies the holder name before saving.
- **Why needed:** Prevents payouts to a mistyped account.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/bank/verify` |
| Authentication | **Required** — bearer |

**Body**

```json
{ "accountNumber": "50100123454821", "ifsc": "HDFC0001234" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `accountNumber` | string | **Yes** | 9–18 digits |
| `ifsc` | string | **Yes** | `/^[A-Z]{4}0[A-Z0-9]{6}$/` |

#### Response

**200 OK** — `data`:

```json
{ "valid": true, "holderName": "RAHUL VERMA", "bankName": "HDFC Bank", "branchName": "Indiranagar" }
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `valid` | boolean | **Yes** | No | **Frontend field name is `valid`, not `verified`** |
| `holderName` | string | **Yes** | **Yes** | From the verification provider; `null` when `valid` is false |
| `bankName` | string | No | **Yes** | |
| `branchName` | string | No | **Yes** | |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Malformed account number or IFSC | `"Enter a valid account number and IFSC."` |
| 401 | Invalid token | Auth message |
| 422 | Verification failed | `"We could not verify this account. Check the details."` |
| 502 | Verification provider unreachable | `"Verification is temporarily unavailable."` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract:**

```ts
export async function verifyBankAccount(req, res, next) {
  try { res.json(ResponseFormatter.success({ verified: true, ...req.body })); } catch (err) { next(err); }
}
```

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| Result field | `verified` | `valid` | `res.valid` is `undefined` — the frontend cannot read the result |
| `holderName` | Absent | Required | Cannot confirm the account holder |
| Verification | **None — returns `true` unconditionally**, echoing the request body | A real check | **Every account, including a fabricated one, is reported valid** |

**Consequence:** the endpoint asserts a successful verification it never performed. A picker who mistypes their account number is told it is valid, and — once the payout pipeline exists — money is sent to the wrong account. `PickerBankAccount.isVerified` is separately never set by any code path, so the Payouts screen's "Verified" badge is also unbacked.

**Required change:** integrate a real penny-drop or IFSC-directory verification provider, rename the field to `valid`, return `holderName`, and set `PickerBankAccount.isVerified` on success. If no provider is available yet, **return `valid: false` with a `"Verification unavailable"` state rather than a false positive** — the current behaviour is worse than no endpoint.

---

## 11. Performance

### 11.1 Performance summary

#### Status
`MODIFY_REQUIRED` — **crashes the screen today**

#### Frontend Usage
- **Page:** `src/screens/performance/PerformanceScreen.tsx` — the third tab
- **Components:** four metric cards, a weekly bar chart, today's earnings, hub label
- **Service:** `performanceApi.getSummary`
- **Hook:** `useApiResource(() => performanceApi.getSummary())`; `const p = data ?? mockPerformance`, then `p.cards.map(…)` and `p.weekBars.map(…)`
- **User action:** Opens the Performance tab.
- **Why needed:** The picker's productivity view, and the source of the Home screen's performance card.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/performance/summary` |
| Authentication | **Required** — bearer |
| Query parameters | `startDate`, `endDate` (ISO dates, optional — supported by `GET /performance`) |

#### Response

**200 OK** — `data`:

```json
{
  "cards": [
    { "icon": "package", "color": "#0E8F8A", "bg": "#E0F2F0", "value": "64",      "label": "Today's Orders" },
    { "icon": "target",  "color": "#1E8E43", "bg": "#EAF5EC", "value": "98%",     "label": "Accuracy" },
    { "icon": "zap",     "color": "#E8A317", "bg": "#FCF2DC", "value": "42",      "label": "Speed Score" },
    { "icon": "trophy",  "color": "#1E8E43", "bg": "#EAF5EC", "value": "Top 12%", "label": "Performance" }
  ],
  "todaysEarnings": "₹720",
  "hub": "Indiranagar Darkstore",
  "weekBars": [
    { "d": "Mon", "pct": 55, "highlight": false },
    { "d": "Tue", "pct": 72, "highlight": false },
    { "d": "Wed", "pct": 48, "highlight": false },
    { "d": "Thu", "pct": 90, "highlight": true },
    { "d": "Fri", "pct": 66, "highlight": false },
    { "d": "Sat", "pct": 80, "highlight": false },
    { "d": "Sun", "pct": 30, "highlight": false }
  ],
  "home": { "rank": "Top 12%", "accuracy": 98, "speedLabel": "42 items/hr", "speedPct": 85 }
}
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `cards` | array | **Yes** | No | **Must be `[]` at minimum** — `.map()` is called on it |
| `cards[].icon` | string | Yes | No | Must be a valid frontend `IconName` (see the enum in `src/types/index.ts`) |
| `cards[].color` / `.bg` | string | Yes | No | Hex colours — **presentation values in an API payload; see the note below** |
| `cards[].value` | string | Yes | No | Pre-formatted (`"98%"`, `"Top 12%"`) |
| `cards[].label` | string | Yes | No | |
| `todaysEarnings` | string | Yes | No | `"₹720"` |
| `hub` | string | Yes | **Yes** | |
| `weekBars` | array | **Yes** | No | Exactly 7 entries; `{ d, pct, highlight }` |
| `home` | object | Yes | No | The compact variant for the Home screen |

> **Design note.** `icon`, `color` and `bg` are presentation concerns and do not belong in an API response — a theme change would require a backend deploy. The cleaner contract returns semantic metric keys (`ordersToday`, `accuracy`, `speedScore`, `rank`) and lets the frontend map them to icons and colours. That requires a frontend change, so it is recorded here as the recommended target rather than the minimum fix.

#### Error Responses

| Status | Case |
|---|---|
| 401 | Invalid token |
| 500 | Unexpected — falls back to the bundled mock |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract:** `GET /performance/summary` is a **stub** — `{ userId, summary: {} }`.

A **real but different** endpoint exists at `GET /performance` (`picker.service.getPerformance`), which the frontend's `performanceApi.get()` can reach but no screen calls:

```json
{ "totalShifts": 22, "present": 22, "absent": 0, "totalWorkedMinutes": 11880, "totalOrdersCompleted": 0, "averageOrdersPerShift": 0 }
```

**Frontend expected contract:** the view model above.

**Exact mismatch:**

| Aspect | Backend (`/performance/summary`) | Frontend | Consequence |
|---|---|---|---|
| `cards` | **Absent** | Array | **`p.cards.map()` throws `TypeError`** — the Performance tab crashes on open |
| `weekBars` | **Absent** | Array of 7 | `p.weekBars.map()` throws |
| `todaysEarnings` | Absent | Required | Blank |
| `hub` | Absent | Required | Blank |
| `home` | Absent | Required by the Home card | Blank |
| Everything | Nested in an empty `summary` object | Top level | No field overlaps at all |

Even the real `GET /performance` cannot supply the screen: it has no accuracy, no speed score, no rank, and no per-day series.

**Underlying data gap (backend logic gap #9).** The metrics have no source:

| Metric | Required source | Reality |
|---|---|---|
| Today's Orders | `PickerAttendance.ordersCompleted` | Field exists; **no code ever writes it**. `getPerformance` sums a field that is always undefined, hence `totalOrdersCompleted: 0`. |
| Accuracy | Pick-accuracy events | **No field, no collection, no source anywhere** |
| Speed Score | Items per hour | **No source** |
| Performance rank | Percentile across peers | **No ranking computation exists** |
| Today's earnings | Earnings pipeline | Does not exist (logic gap #8) |
| Weekly bars | Per-day aggregation | Not implemented |

Orders and accuracy realistically originate in the **HHD scanning app** — a separate system. The integration path must be settled before this endpoint can return meaningful data.

**Required change:**

1. Ship the correct **shape** first, with zeroed values and `cards`/`weekBars` as populated arrays, so the tab renders instead of crashing.
2. Define and implement the metric sources — starting with writing `ordersCompleted`.
3. Implement per-day aggregation for `weekBars` (`pct` relative to a target, `highlight` on today).
4. Long term, move `icon`/`color`/`bg` to the frontend and return semantic keys.

---

## 12. Documents & Devices

### 12.1 List documents

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Page:** `src/screens/profile/DocumentsScreen.tsx`
- **Components:** document rows with an `IconChip` and a `StatusBadge` (Verified / Upload)
- **Service:** `profileApi.getDocuments` / `documentApi.list`
- **Hook:** `useApiResource(() => profileApi.getDocuments())`; `const documents = data ?? mockDocuments`
- **User action:** Opens Profile → Documents.
- **Why needed:** Shows KYC status and which documents are still outstanding.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/documents` |
| Authentication | **Required** — bearer |
| Authorization | Own documents only |

#### Response

**200 OK** — `data` is an **array**:

```json
[
  { "id": "aadhaar", "name": "Aadhaar card",    "num": "•••• •••• 1234", "verified": true,  "pending": false, "status": "approved", "rejectionReason": null },
  { "id": "pan",     "name": "PAN card",        "num": "ABCDE••••F",     "verified": true,  "pending": false, "status": "approved", "rejectionReason": null },
  { "id": "dl",      "name": "Driving licence", "num": "Not uploaded",   "verified": false, "pending": true,  "status": "pending",  "rejectionReason": null }
]
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `id` | string | **Yes** | No | React key; use the document type slug |
| `name` | string | **Yes** | No | Human-readable label |
| `num` | string | **Yes** | No | **Masked** number, or `"Not uploaded"` |
| `verified` | boolean | **Yes** | No | `status === 'approved'` |
| `pending` | boolean | **Yes** | No | `status !== 'approved'` — drives the amber "Upload" badge |
| `status` | string | No | No | Raw: `pending` \| `approved` \| `rejected` |
| `rejectionReason` | string | No | **Yes** | |

The list should include **expected-but-not-yet-uploaded** document types (as `dl` above), not only stored rows — the screen is a checklist.

#### Error Responses

| Status | Case |
|---|---|
| 401 | Invalid token |
| 500 | Unexpected — falls back to the bundled mock |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract:** real — `PickerDocument.find({ userId }).lean()` returns an array:

```json
[
  {
    "_id": "66f1e2f3a4b5c60718293d7e",
    "userId": "66f1a2b3c4d5e6f708192a3b",
    "type": "aadhaar",
    "url": "https://cdn.selorg.in/kyc/aadhaar.jpg",
    "fileName": "aadhaar-front.jpg",
    "status": "pending",
    "rejectionReason": null,
    "createdAt": "2026-09-04T10:15:00.000Z"
  }
]
```

**Frontend expected contract:** `[{ id, name, num, verified, pending }]`.

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| Array vs object | Array | Array | **`.map()` is safe — this screen does not crash** |
| `id` | `_id` | `id` | React key `undefined` |
| `name` | `type` (`"aadhaar"`) | `"Aadhaar card"` | Blank row title |
| `num` | **No number field exists** | `"•••• •••• 1234"` | Blank; also `d.name.split(' ')[0]` in the tap handler throws on `undefined` |
| `verified` / `pending` | `status` enum | Two booleans | Badge always renders the `pending` branch |
| Missing types | Only stored rows | Checklist including not-yet-uploaded types | The picker cannot see what is still required |

**Consequence:** the screen renders one blank row per stored document, with no name, no number, and an incorrect badge — and tapping a row throws.

**Required change:**

1. Project `{ id, name, num, verified, pending }` and map `status` to the two booleans.
2. Add a display-name lookup for each document type.
3. **Blocked on data gap #4:** `num` needs a masked document number, which `PickerDocument` cannot store today (see 6.7).
4. Merge the stored rows with the expected document-type list so the checklist is complete.

---

### 12.2 Get assigned device

#### Status
`MODIFY_REQUIRED` — **crashes the screen today**

#### Frontend Usage
- **Page:** `src/screens/profile/DeviceStatusScreen.tsx`
- **Components:** device header card (id, model, Active pill, battery bar), `KeyValueRow` detail list, "Report an issue" and "Request replacement" buttons
- **Service:** `profileApi.getDevice`
- **Hook:** `useApiResource(() => profileApi.getDevice())`; `const deviceRows = (deviceData as typeof mockDeviceRows) ?? mockDeviceRows`, then `deviceRows.map(r => …)`
- **User action:** Opens Profile → Device Status.
- **Why needed:** Confirms which HHD the picker is accountable for.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/devices/assigned` |
| Authentication | **Required** — bearer |

#### Response

**200 OK** — `data`:

```json
{
  "device": {
    "id": "HHD-2231",
    "model": "Zebra TC21 · Handheld",
    "status": "Active",
    "battery": 86,
    "lastSynced": "2 min ago"
  },
  "rows": [
    { "k": "Model",       "v": "Zebra TC21 HHD" },
    { "k": "Serial",      "v": "HHD-2231" },
    { "k": "Assigned on", "v": "08 Jan 2026" },
    { "k": "Hub",         "v": "Indiranagar Darkstore" }
  ]
}
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `device` | object | **Yes** | **Yes** | `null` when no device is assigned — the screen should then show an empty state |
| `device.id` | string | Yes | No | `"HHD-2231"` |
| `device.model` | string | Yes | **Yes** | |
| `device.status` | string | Yes | No | `"Active"` \| `"Inactive"` |
| `device.battery` | number | Yes | **Yes** | 0–100; `null` when unknown |
| `device.lastSynced` | string | Yes | **Yes** | Relative, `"2 min ago"` |
| `rows` | array | **Yes** | No | **Must be `[]` at minimum** — `.map()` is called on it |

> **Shape decision required.** The frontend's `profileApi.getDevice()` is typed as returning `KeyValueRow[]` — a bare array — while the screen also needs the header fields. Either return the object above and change the frontend to read `data.rows` / `data.device`, or return only `rows` and add a second endpoint for the header. The object is recommended; note it requires a frontend change.

#### Error Responses

| Status | Case |
|---|---|
| 401 | Invalid token |
| 404 | No device assigned — **prefer `200` with `device: null` and `rows: []`** so the screen renders an empty state rather than an error |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract:** stub — `{ userId, device: null }`.

**Frontend expected contract:** the object above (or a `KeyValue[]` array, per the shape decision).

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| Shape | `{ userId, device: null }` | Array (per the current frontend type) | **`deviceRows.map()` throws `TypeError: deviceRows.map is not a function`** — the response is a truthy object, so the `?? mockDeviceRows` fallback does not fire and the screen crashes |
| `rows` | Absent | Required | — |
| Device data | Always `null` — `PickerDevice` is never queried | Full header | The header renders `mockDevice` literals regardless of the API |
| Persistence | Nothing assigns a device to a picker (6.12 is also a stub) | — | Even a correct implementation would find no assignment |

**Required change:**

1. Query `PickerDevice.findOne({ assignedTo: pickerId })` — or resolve `PickerUser.activeDeviceId` — and project the response.
2. **Always return `rows` as an array**, `[]` when there is no device.
3. **Blocked on data gap #8:** `battery` and `lastSynced` have **no fields on `PickerDevice`**. `PickerUser.batteryLevel` exists but is per-user rather than per-device, and nothing writes it (the frontend never calls `/heartbeat`, which is the natural reporting path — and that route is itself a stub). Add `battery` and `lastSyncedAt` to `PickerDevice` and populate them from an HHD heartbeat.
4. **Blocked on 6.12:** device assignment must actually happen first.

---

### 12.3 Report an issue

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Component:** `src/overlays/DeviceIssueSheet.tsx`, opened from "Report an issue" on the Device Status screen
- **Component detail:** `RadioCard` list of fixed reasons — "Device won't turn on", "Scanner / camera not working", "Battery draining fast", "Screen damage", "Other"
- **Service:** `profileApi.reportDeviceIssue({ reason })` — **called but not defined**; `supportApi.reportIssue({ type, description })` exists instead
- **User action:** Picker selects a reason and taps **Submit report**.
- **Why needed:** A broken HHD stops the picker working; this is the escalation path.

> **Frontend defect:** `profileApi.reportDeviceIssue` does not exist in `src/services/api/profileApi.ts`. `DeviceIssueSheet.submit` therefore throws a `TypeError` before any request is made. Must be added.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/issues` |
| Authentication | **Required** — bearer |

**Body**

```json
{ "type": "device", "reason": "Scanner / camera not working", "description": "Scanner stopped reading barcodes after the morning break.", "deviceId": "HHD-2231" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `type` | string | **Yes** | `device` \| `app` \| `shift` \| `payout` \| `other` |
| `reason` | string | **Yes** | One of the fixed reasons, or free text when `"Other"` |
| `description` | string | No | ≤ 1000 chars |
| `deviceId` | string | No | Defaults to the picker's assigned device |

#### Response

**201 Created** — `data`:

```json
{ "id": "66f6d7e8f9a0b10819207d34", "type": "device", "status": "open", "ticketId": "SUP-10482", "createdAt": "2026-09-04T10:15:00.000Z" }
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `id` | string | **Yes** | No | |
| `type` | string | Yes | No | |
| `status` | string | Yes | No | `open` \| `in_progress` \| `resolved` |
| `ticketId` | string | No | **Yes** | Support ticket reference, when routed |
| `createdAt` | string | Yes | No | ISO 8601 |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Missing `type` or `reason` | `"Select an issue to report."` |
| 401 | Invalid token | Auth message |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract:**

```ts
export async function reportIssue(req, res, next) {
  try { res.status(201).json(ResponseFormatter.success({ reported: true, ...req.body })); } catch (err) { next(err); }
}
```

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| Persistence | **None** — echoes the request body | Issue recorded and routed | **No model exists.** The report vanishes; support never sees it |
| `id` / `ticketId` | Absent | Expected | No reference the picker can quote |
| Routing | None | Should reach support | Nobody is notified that a device is down |

**Consequence:** the sheet reports "Issue reported · support will call you". Nobody will call — nothing was recorded anywhere.

**Required change:**

1. **Create an issue model** (data gap #10) — `{ userId, type, reason, description, deviceId, status, ticketId, createdAt }`.
2. Route device issues into the existing `support` module's `SupportTicket` collection so they land in the same queue as other tickets, and return the `ticketId`.
3. Optionally set `PickerDevice.status = 'maintenance'` for hardware faults.
4. **Frontend change required:** add the missing `profileApi.reportDeviceIssue` method.

---

## 13. Notifications

### 13.1 List notifications

#### Status
`MODIFY_REQUIRED` — **crashes the screen today**

#### Frontend Usage
- **Page:** `src/screens/notifications/NotificationsScreen.tsx`, reached from the Home screen's bell icon
- **Components:** notification rows with an `IconChip`, title, body and relative time
- **Service:** `notificationApi.list`
- **Hook:** `useApiResource(() => notificationApi.list())`; `const items = data ?? mockNotifications`, then `items.map(n => …)` keyed `key={n.id}`
- **User action:** Taps the bell on the Home screen.
- **Why needed:** Delivers approval decisions, payout confirmations, incentive alerts and shift reminders.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/notifications` |
| Authentication | **Required** — bearer |

**Query parameters**

| Name | Type | Required | Default | Notes |
|---|---|---|---|---|
| `page` | number | No | 1 | Supported; **not sent by the frontend** (no pagination UI) |
| `limit` | number | No | 20 | Supported; not sent |
| `unreadOnly` | boolean | No | false | **Proposed** |

#### Response

**200 OK** — `data` is an **array**; counts go in the envelope's `pagination`, with `unread` as an extra top-level field if needed:

```json
[
  {
    "id": "66f7e8f9a0b1c20819208e45",
    "type": "approval",
    "icon": "check",
    "color": "#1E8E43",
    "bg": "#EAF5EC",
    "title": "Application approved",
    "body": "Welcome aboard! You can now start your first shift.",
    "time": "2h ago",
    "createdAt": "2026-09-04T08:15:00.000Z",
    "read": false
  },
  {
    "id": "66f7e8f9a0b1c20819208e46",
    "type": "payout",
    "icon": "wallet",
    "color": "#0E8F8A",
    "bg": "#E0F2F0",
    "title": "Payout processed",
    "body": "₹17,200 was transferred to your HDFC account.",
    "time": "Yesterday",
    "createdAt": "2026-09-03T06:00:00.000Z",
    "read": true
  }
]
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `id` | string | **Yes** | No | React key |
| `type` | string | Yes | No | `approval` \| `payout` \| `incentive` \| `shift` \| `device` \| `system` |
| `icon` | string | **Yes** | No | Frontend `IconName` — see the mapping below |
| `color` | string | **Yes** | No | Hex |
| `bg` | string | **Yes** | No | Hex |
| `title` | string | **Yes** | No | |
| `body` | string | **Yes** | No | |
| `time` | string | **Yes** | No | Relative, `"2h ago"` |
| `createdAt` | string | No | No | ISO 8601 |
| `read` | boolean | No | No | |

**Type → presentation mapping** (implement server-side for the minimum fix, or move to the frontend for the recommended target):

| `type` | `icon` | `color` | `bg` |
|---|---|---|---|
| `approval` | `check` | `#1E8E43` | `#EAF5EC` |
| `payout` | `wallet` | `#0E8F8A` | `#E0F2F0` |
| `incentive` | `zap` | `#E8A317` | `#FCF2DC` |
| `shift` | `cal` | `#1E8E43` | `#EAF5EC` |
| `device` | `phoneDevice` | `#0E8F8A` | `#E0F2F0` |
| `system` | `bell` | `#5E6E63` | `#EFF3EE` |

Empty → `[]`; the screen shows an `EmptyState`.

#### Error Responses

| Status | Case |
|---|---|
| 401 | Invalid token |
| 500 | Unexpected — falls back to the bundled mock |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract** (`picker.service.getNotifications`):

```json
{
  "notifications": [
    {
      "_id": "66f7e8f9a0b1c20819208e45",
      "userId": "66f1a2b3c4d5e6f708192a3b",
      "type": "approval",
      "title": "Application approved",
      "body": "Welcome aboard! You can now start your first shift.",
      "data": {},
      "read": false,
      "createdAt": "2026-09-04T08:15:00.000Z"
    }
  ],
  "total": 14, "unread": 3, "page": 1, "limit": 20, "totalPages": 1
}
```

**Frontend expected contract:** `[{ id, icon, color, bg, title, body, time }]`.

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| Array vs object | `{ notifications, total, unread, … }` | Array | **`items.map()` throws `TypeError: items.map is not a function`** — the Notifications screen crashes |
| `id` | `_id` | `id` | React key `undefined` |
| `title`, `body` | Present | Present | **These two match** |
| `icon`, `color`, `bg` | **Absent** | Required | `IconChip` renders with no icon and no background |
| `time` | `createdAt` (ISO) | `"2h ago"` | Blank timestamp |
| `unread` | Returned inside `data` | Not read here | Useful for the Home bell badge (7.1) |

**Required change:**

1. **Return the array as `data`**; move `total`/`page`/`limit` into the envelope's `pagination` and surface `unread` where the Home summary can use it.
2. Project `id` from `_id`, derive `time` as a relative string from `createdAt`.
3. Derive `icon`/`color`/`bg` from `type` using the table above.
4. **Recommended target:** return `type` and `createdAt` only, and move the icon/colour mapping and relative-time formatting into the frontend — presentation values in an API payload mean a theme change needs a backend deploy. This requires a frontend change, so the server-side mapping is the minimum fix.

---

### 13.2 Mark all notifications read

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Service:** `notificationApi.markAllRead` — defined; **not currently called from `NotificationsScreen`**, which renders every notification identically regardless of `read`.
- **Why needed:** Clears the Home bell badge dot. Without it, `unreadNotifications` in 7.1 never decreases.

#### Request

| Item | Value |
|---|---|
| Method | `PUT` |
| Endpoint | `/notifications/read-all` |
| Authentication | **Required** — bearer |
| Body | Empty |

#### Response

**200 OK** — `data`: `{ "updated": 3, "unread": 0 }`

| Field | Type | Required | Nullable |
|---|---|---|---|
| `updated` | number | Yes | No |
| `unread` | number | Yes | No |

#### Error Responses

| Status | Case |
|---|---|
| 401 | Invalid token |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** stub — `{ userId, message: 'All notifications marked as read' }`. **No write.**
- **Frontend expected contract:** notifications actually marked read.
- **Exact mismatch:** the response claims the action succeeded and performs no update. The badge never clears and every notification stays unread forever.
- **Required change:** `PickerNotification.updateMany({ userId, read: false }, { read: true })` and return the counts. One line — the `read` field and its index already exist.

---

### 13.3 Mark one notification read

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Service:** `notificationApi.markRead(notificationId)` — defined; not called from a screen today (rows are not tappable).
- **Why needed:** Per-item read state, if row taps are added.

#### Request

| Item | Value |
|---|---|
| Method | `PUT` |
| Endpoint | `/notifications/:notificationId/read` |
| Authentication | **Required** — bearer |

**Path parameters**

| Name | Type | Required | Validation |
|---|---|---|---|
| `notificationId` | string | **Yes** | Valid ObjectId; must belong to the authenticated picker |

#### Response

**200 OK** — `data`: `{ "id": "66f7e8f9a0b1c20819208e45", "read": true, "unread": 2 }`

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 401 | Invalid token | Auth message |
| 404 | Not found, or not owned by this picker | `"Notification not found"` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** **real** — `markNotificationRead` performs `findOneAndUpdate({ _id, userId }, { read: true })`, correctly scoped by `userId` so one picker cannot mark another's notification. The controller then discards the result and returns `{ message: 'Notification marked as read' }`.
- **Exact mismatch:** minor. (1) A missing or non-owned notification still returns **200** because the `null` result is never checked — it should be 404. (2) The response returns only a message, not `id`/`read`/`unread`.
- **Required change:** check for `null` and return 404; project the response so the client can update the badge without a refetch.

---

### 13.4 Register push token

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Service:** `notificationApi.registerPushToken({ token, platform })`
- **Current usage:** defined; not yet called on app start.
- **Why needed:** Without a stored token the backend cannot deliver any push notification — shift reminders, payout alerts and approval decisions are all undeliverable.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/push-token` |
| Authentication | **Required** — bearer |

**Body**

```json
{ "token": "fcm_dGhpcyBpcyBhIHRva2Vu...", "platform": "android" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `token` | string | **Yes** | Non-empty; ≤ 512 chars |
| `platform` | string | **Yes** | `"ios"` \| `"android"` |
| `deviceId` | string | No | **Proposed** — lets one picker hold tokens for several devices |

#### Response

**200 OK** — `data`: `{ "registered": true }`

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Missing `token` or bad `platform` | `"token and platform are required"` |
| 401 | Invalid token | Auth message |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** stub — `{ registered: true }`. No validation, no write.
- **Frontend expected contract:** the token is stored against the picker.
- **Exact mismatch:** **no model exists to store a push token** (data gap #9). `PickerUser` has no token field and there is no separate collection. The response asserts registration that did not happen.
- **Required change:** add a push-token store — a `pushTokens: [{ token, platform, deviceId, updatedAt }]` array on `PickerUser`, or a dedicated collection — upsert by `token`, and prune stale entries on delivery failure. Then wire a delivery service; nothing currently sends push notifications. **Frontend change required:** request notification permission and call this on app start and on token refresh.

---

## 14. Support

### 14.1 List FAQs

#### Status
`MODIFY_REQUIRED` — **crashes the screen today**

#### Frontend Usage
- **Page:** `src/screens/support/FaqsScreen.tsx` (Profile → Support & Settings → FAQs)
- **Components:** accordion rows, expanded one at a time via `faqOpen`
- **Service:** `supportApi.faqs`
- **Hook:** `useApiResource(() => supportApi.faqs())`; `const faqs = data ?? mockFaqs`, then `faqs.map((f, i) => …)` keyed `key={f.q}`
- **User action:** Opens the FAQs screen and expands a question.
- **Why needed:** First-line self-service support.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/faq` |
| Authentication | **None** (public) |

**Query parameters**

| Name | Type | Required | Notes |
|---|---|---|---|
| `category` | string | No | **Proposed** — defaults to the picker category |

#### Response

**200 OK** — `data` is an **array**:

```json
[
  { "q": "How do I start my shift?", "a": "Open Home, tap Start My Shift, verify your location and identity, then tap Start work. You must be within 150 m of your hub." },
  { "q": "When do I get paid?",      "a": "Payouts are processed monthly on the 5th to your verified bank account. Track them under Profile → Payouts." }
]
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `q` | string | **Yes** | No | Question. **Used as the React key — must be unique.** |
| `a` | string | **Yes** | No | Answer |
| `id` | string | No | No | Recommended, so the key can move off `q` |
| `category` | string | No | No | |

Empty → `[]`.

#### Error Responses

| Status | Case |
|---|---|
| 500 | Unexpected — falls back to the bundled mock |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract:**

```ts
export async function listFAQ(req, res, next) {
  try { res.json(ResponseFormatter.success({ faqs: [] })); } catch (err) { next(err); }
}
```

**Frontend expected contract:** `[{ q, a }]`.

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| Array vs object | `{ faqs: [] }` | Array | **`faqs.map()` throws `TypeError: faqs.map is not a function`** — the FAQs screen crashes |
| Field names | — | `q`, `a` | No data at all |
| Content | Hardcoded empty | Real FAQ content | Nothing to show |

**Required change — reuse, do not rebuild.** `src/modules/faq/` is a **fully implemented module** with a model, repository, service and controller. `FaqItem` stores `{ question, answer, order, category, isActive }` with indexes on `(isActive, order)` and `(category, isActive, order)`, and `faq.service` already supports category filtering and ordering.

1. Delegate the picker's `GET /faq` to `faq.service` with `category: 'picker'` (or a dedicated picker category).
2. Map `question → q` and `answer → a`; return the **array** as `data`.
3. Return `id` as well, and change the frontend key from `f.q` to `f.id`.

**Do not create a second FAQ store.** The content is already administrable through `/api/v1/customer/admin/faq`.

---

### 14.2 Create support ticket

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Pages:** `src/screens/support/SupportSettingsScreen.tsx` ("Email us"), `src/screens/support/ChatSupportScreen.tsx`
- **Service:** `supportApi.createTicket({ subject, description, category })`; also `supportApi.sendMessage({ text })`, which wraps **every chat message** as a new ticket with `subject: 'Chat message'`
- **Hook:** `useSupport.sendChat`
- **User action:** Picker sends a support message.
- **Why needed:** The only channel for issues the FAQs do not cover.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/support/tickets` |
| Authentication | **Required** — bearer |

**Body**

```json
{ "subject": "Payout not received", "description": "My March payout has not arrived.", "category": "payout" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `subject` | string | **Yes** | 3–200 chars |
| `description` | string | **Yes** | 1–2000 chars |
| `category` | string | No | `general` \| `payout` \| `shift` \| `device` \| `account`; defaults to `general` |
| `priority` | string | No | `low` \| `medium` \| `high` \| `urgent`; defaults to `medium` |

#### Response

**201 Created** — `data`:

```json
{ "id": "66f8f9a0b1c2d30819209f56", "ticketNumber": "SUP-10482", "subject": "Payout not received", "status": "open", "category": "payout", "priority": "medium", "createdAt": "2026-09-04T10:15:00.000Z" }
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `id` | string | **Yes** | No | Frontend types this as `{ ok, id }` |
| `ticketNumber` | string | No | **Yes** | Human-readable reference |
| `subject` | string | Yes | No | |
| `status` | string | Yes | No | |
| `category` | string | Yes | No | |
| `priority` | string | Yes | No | |
| `createdAt` | string | Yes | No | ISO 8601 |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 401 | Invalid token | Auth message |
| 422 | Missing `subject` or `description` | Validation details |
| 429 | Too many tickets | `"Please wait before opening another ticket."` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

**Current backend contract:**

```ts
export async function createSupportTicket(req, res, next) {
  try { res.status(201).json(ResponseFormatter.success({ ticket: req.body })); } catch (err) { next(err); }
}
```

**Exact mismatch:**

| Aspect | Backend | Frontend | Consequence |
|---|---|---|---|
| Persistence | **None** — echoes the request body | Ticket created | **No ticket is ever created.** Support never sees it |
| `id` | Absent | Required | No reference for the picker |
| Nesting | `{ ticket: {...} }` | Flat object | `res.id` is `undefined` |
| Validation | None | — | Empty tickets accepted |

**Required change — reuse, do not rebuild.** `src/modules/support/` has a complete `SupportTicket` model with `subject`, `description`, `category`, `priority`, `status`, notes (`customer_reply` / `agent_reply` / `internal_note` / `status_change` / `assignment`) and attachments.

1. Delegate to `support.service` with a **picker-scoped requester**, rather than creating a parallel picker-ticket collection.
2. Return the flat projection above.
3. Add `validate()` middleware.

---

### 14.3 List support tickets

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Service:** `supportApi.listTickets` — defined; **not called from any screen.** The support screen offers only chat, call and email actions with no ticket history.
- **Why needed:** So a picker can see the status of an issue they already raised.

#### Request

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/support/tickets` |
| Authentication | **Required** — bearer |
| Query parameters | `status`, `page`, `limit` (all optional) |

#### Response

**200 OK** — `data` is an **array** of the ticket object from 14.2; `[]` when none. Pagination in the envelope.

#### Error Responses

| Status | Case |
|---|---|
| 401 | Invalid token |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** stub — `{ userId, tickets: [], total: 0 }`.
- **Frontend expected contract:** `unknown[]` — an array.
- **Exact mismatch:** object vs array. If a screen ever consumed this with `.map()`, it would crash exactly as 14.1 does. Nothing is queried.
- **Required change:** query `support.service` scoped to the picker, return the array as `data`, and put counts in `pagination`.

---

### 14.4 Support chat

#### Status
`NEW`

#### Frontend Usage
- **Page:** `src/screens/support/ChatSupportScreen.tsx`
- **Components:** message bubbles (`who: 'agent' | 'me'`), a typing indicator, quick-reply chips, a text input
- **Service:** `supportApi.sendMessage({ text })` — **posts each message as a new support ticket**
- **Hook:** `useSupport.sendChat` — pushes the message locally, sets `typing`, then after a **1400 ms `setTimeout`** pushes a **hardcoded agent reply**: *"Thanks, I've noted that. A support agent will follow up shortly…"*
- **User action:** Picker types a message and sends it.
- **Why needed:** The screen presents itself as live chat with a support agent. It is not.

#### Request — proposed

**Send a message**

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/support/chat/messages` |
| Authentication | **Required** — bearer |

```json
{ "text": "My HHD will not switch on.", "conversationId": "66f9a0b1c2d3e4081920af67" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `text` | string | **Yes** | 1–2000 chars |
| `conversationId` | string | No | Omit to open a new conversation |

**Fetch messages**

| Item | Value |
|---|---|
| Method | `GET` |
| Endpoint | `/support/chat/messages` |
| Query parameters | `conversationId`, `since` (ISO), `limit` |

#### Response — proposed

**201 Created** (send) — `data`:

```json
{ "id": "66f9a0b1c2d3e4081920af68", "conversationId": "66f9a0b1c2d3e4081920af67", "who": "me", "text": "My HHD will not switch on.", "time": "10:15 AM", "createdAt": "2026-09-04T10:15:00.000Z" }
```

**200 OK** (fetch) — `data` is an **array** of the same objects, oldest first.

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `id` | string | Yes | No | |
| `conversationId` | string | Yes | No | |
| `who` | string | **Yes** | No | `"agent"` \| `"me"` — matches the frontend `ChatMessage` type |
| `text` | string | **Yes** | No | |
| `time` | string | **Yes** | No | `"10:15 AM"` — pre-formatted, matching `nowClock()` |
| `createdAt` | string | No | No | ISO 8601 |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 400 | Empty `text` | `"Message cannot be empty."` |
| 401 | Invalid token | Auth message |
| 404 | Unknown `conversationId` | `"Conversation not found"` |

#### Existing Backend Comparison — `NEW`

**Why existing APIs cannot satisfy the frontend.** There is **no messaging endpoint in the picker module**. The frontend works around this by calling `POST /support/tickets` for every message with a fixed subject:

```ts
sendMessage(payload: { text: string }) {
  return request('/support/tickets', {
    method: 'POST',
    body: { subject: 'Chat message', description: payload.text, category: 'general' },
  });
}
```

Two problems follow. **First**, a five-message conversation would create five separate tickets titled "Chat message" — support queue spam with no thread. **Second**, the agent reply is a client-side `setTimeout` with hardcoded text, so **the picker is shown a reply from an agent who does not exist and has not seen the message.** Combined with 14.2 being a stub that persists nothing, the entire chat feature is a simulation.

**Proposed endpoint contract:** as specified above.

**Expected request:** `POST /support/chat/messages` with `{ text, conversationId? }`; `GET /support/chat/messages` with `{ conversationId, since? }` for polling.

**Expected response:** message objects with `who`, `text` and a pre-formatted `time`.

**Expected errors:** 400, 401, 404.

**Reuse note.** `src/modules/support-chat/` already exists and exposes a **`riderRouter`** — a working chat implementation for the rider app with an admin counterpart. **Extend that module to pickers** rather than writing a third messaging system. Real-time delivery (websocket or polling) should follow whatever the rider implementation already does.

**Frontend change required:** remove the hardcoded `setTimeout` agent reply from `useSupport`, poll or subscribe for real replies, and stop routing chat through `createTicket`.

---

## 15. Account

### 15.1 Request account deletion

#### Status
`MODIFY_REQUIRED`

#### Frontend Usage
- **Page:** `SupportSettingsScreen.tsx` — "Delete my account"
- **Service:** `profileApi.requestAccountDeletion`
- **User action:** Picker requests deletion and confirms.
- **Why needed:** Data-protection obligation, and an app-store requirement for accounts created in-app.

#### Request

| Item | Value |
|---|---|
| Method | `POST` |
| Endpoint | `/account/delete-request` |
| Authentication | **Required** — bearer |

**Body**

```json
{ "reason": "No longer working with Selorg" }
```

| Field | Type | Required | Validation |
|---|---|---|---|
| `reason` | string | No | ≤ 500 chars |

#### Response

**200 OK** — `data`:

```json
{ "requested": true, "requestedAt": "2026-09-04T10:15:00.000Z", "status": "DELETION_PENDING", "effectiveAt": "2026-10-04T10:15:00.000Z" }
```

| Field | Type | Required | Nullable | Notes |
|---|---|---|---|---|
| `requested` | boolean | **Yes** | No | |
| `requestedAt` | string | **Yes** | No | ISO 8601 |
| `status` | string | Yes | No | `DELETION_PENDING` — must be reflected by 4.1 |
| `effectiveAt` | string | No | **Yes** | End of the grace period |

#### Error Responses

| Status | Case | `message` |
|---|---|---|
| 401 | Invalid token | Auth message |
| 409 | Already requested | `"A deletion request is already in progress."` |
| 422 | Outstanding balance | `"Withdraw your remaining balance before deleting your account."` |

#### Existing Backend Comparison — `MODIFY_REQUIRED`

- **Current backend contract:** stub — `{ userId, requested: true }`. **No write.**
- **Frontend expected contract:** the request is recorded and the account enters a pending-deletion state.
- **Exact mismatch:** nothing is stored. `PickerUser.deletionRequestedAt` and `deletionReason` exist in the schema and are **never written by any code path**, so the frontend's `DELETION_PENDING` status can never be reached and no admin or job has anything to act on. The endpoint reports success for an action that did not occur — a compliance problem, not just a bug.
- **Required change:** write `deletionRequestedAt` and `deletionReason`, add `DELETION_PENDING` to the status enum (or derive it from `deletionRequestedAt`), have 4.1 report it, refuse deletion while `availableBalance > 0`, and add a retention job that anonymises the record after the grace period.

---

## 16. Defined-but-unused Frontend Endpoints

These exist in the frontend service layer but **no screen calls them today**. They are recorded so the backend developer does not treat them as live requirements. Each is a stub on the backend unless noted.

| Endpoint | Frontend service | Backend state | Recommendation |
|---|---|---|---|
| `GET /wallet` | — (route exists) | **Real** | Redundant with `/wallet/balance`; pick one |
| `GET /wallet/earnings-breakdown` | `walletApi.getEarningsBreakdown` | Stub `{ breakdown: [] }` | Implement only if an earnings-breakdown screen is planned |
| `GET /wallet/history` | `walletApi.getHistory` | Stub `{ history: [], total: 0 }` | Redundant with `/wallet/transactions`; remove one |
| `GET /wallet/transactions/:id` | `walletApi.getTransaction` | Stub — echoes the id | Implement with a transaction-detail screen |
| `POST /wallet/deposit` | `walletApi.deposit` | **No route exists** | Pickers do not deposit — remove from the frontend |
| `PUT /bank/accounts/:id` | `bankApi.updateAccount` | Stub — echoes params | P2 |
| `PUT /bank/accounts/:id/set-default` | `bankApi.setDefault` | Stub | P2 — `isPrimary` is never written |
| `POST /bank/accounts/:id/delete` | `bankApi.deleteAccount` | Stub | P2. Note the non-REST shape (`POST …/delete` rather than `DELETE`) |
| `GET /shifts/my` | `shiftApi.listMy` | **Real** — raw assignment documents | Project before use |
| `POST /presence/ping` | `shiftApi.ping` | Stub | Never called; `lastSeenAt` is never populated |
| `POST /heartbeat` | `shiftApi.heartbeat` | Stub | Never called; the natural source for device battery and `lastSynced` (12.2) |
| `POST /training/assessment` | `trainingApi.submitAssessment` | Stub `{ passed: false, score: 0 }` | No assessment screen exists |
| `GET /training/videos/:videoId` | `trainingApi.getVideo` | Stub — echoes the id | Not needed; the list carries `url` |
| `POST /training/modules/:id/complete` | `trainingApi.completeModule` | Stub | Duplicate of `/training/complete/:videoId`; remove one |
| `POST /devices/return` | `profileApi.returnDevice` | Stub | Implement with an offboarding flow |
| `POST /devices/upload-condition-photo` | — | Stub `{ url: null }` | Blocked on the upload endpoint (6.8) |
| `POST /dark-store-login` | `onboardingApi.registerAtDarkStore` | Stub | Should write `currentLocationId` |
| `POST /locations/set-darkstore-from-current` | `onboardingApi.setDarkstoreFromCurrent` | Stub | Should write `currentLocationId` |
| `GET /performance/history` | `performanceApi.getHistory` | Stub `{ history: [] }` | Merge into `/performance/summary` |
| `GET /user/profile/contract`, `/employment`, `/link-status` | — | Stubs | Not used by this frontend |
| `GET /samples`, `/samples/:id`, `POST /samples` | — | Stubs, **unauthenticated** | **Remove — scaffolding left in the route table** |
| `GET /shared-orders/*` | — | Stubs | Belongs to the HHD app, not the picker workforce app |
| `POST /didit/session`, `GET /didit/status` | — | Stubs | Decide Didit vs first-party face verification (6.9) |
| `GET /store-otp`, `POST /approval/verify-location-otp` | — | Stubs | Clarify against the manager-OTP flow (6.10 / 6.11) |
| `GET /config`, `/legal/config`, `/legal/terms`, `/legal/privacy` | — | Stubs returning empty | The login screen links to Terms — wire to the existing `legal` module |

**Recommendation:** delete the `/samples/*` routes before release. They are unauthenticated scaffolding on a production router.

---

## 17. Implementation Sequence

Ordered so each step unblocks the next.

**Step 1 — make the app reachable (P0).**
Fix `GET /onboarding/state` (4.1). Nothing else is testable end to end while every login lands back in the onboarding wizard.

**Step 2 — stop the crashes (P0).**
Seven endpoints return a shape that makes the screen throw. Fixing the response shape is mechanical and independent of the data pipelines behind them — ship correct shapes with zeroed or empty values first:
9.2 transactions, 13.1 notifications, 8.10 work history, 8.8 attendance summary, 11.1 performance, 12.2 device, 14.1 FAQs.

**Step 3 — unblock onboarding (P0).**
10.2 bank account contract, 6.7 KYC, 6.9 face verification, 6.10 / 6.11 manager OTP, plus 6.8 file upload which 6.7 and 6.9 depend on.

**Step 4 — fix the shift lifecycle (P0).**
8.2 / 8.3 the `undefined` ObjectId bug, attendance-record creation on shift start, then 8.1 geofence readiness. Breaks (8.5) start working once an attendance row exists.

**Step 5 — profile persistence (P0).**
Extend the `PickerUser` schema and the `updateProfile` allow-list (5.2), and add the projection to 5.1 that stops leaking `sessionToken`.

**Step 6 — view-model projections (P1).**
6.1 work locations, 6.2 shifts, 6.3 training videos, 12.1 documents. These unblock onboarding steps 3–5 and the Documents screen.

**Step 7 — data pipelines (P1).**
Earnings and payouts (logic gap #8), overtime and lateness (#7), performance metrics (#9). These fill in the zeroed values from step 2.

**Step 8 — aggregates and the remainder (P1–P2).**
7.1 home summary once its inputs exist; support (14.2–14.4); push notifications (13.4); validation middleware and the auth hardening listed in the gap analysis.

---

## 18. Open Questions for the Backend Team

1. **Presentation in payloads.** Several endpoints are specified to return `icon`, `color`, `bg`, and pre-formatted currency and date strings, because that is what the frontend renders today. Should the API return semantic values instead and move formatting to the client? That is the better long-term contract but requires coordinated frontend changes.
2. **Orders, accuracy and speed.** These originate in the HHD scanning app. What is the integration path — shared collection, event stream, or a service call? Home (7.1) and Performance (11.1) cannot be completed without an answer.
3. **Overtime policy.** `ot.rate` is `"1.5x"` in the mock. What is the actual rule — daily threshold, weekly, or per shift? Needed for 8.8 and logic gap #7.
4. **Payout cycle.** The mock shows a monthly payout on the 5th. Confirm the cadence, the cut-off, and who triggers it.
5. **KYC model.** Option A (document numbers on `PickerDocument`) or Option B (a separate KYC endpoint) from 6.7?
6. **Face verification.** Didit integration or a first-party check? Both paths are half-stubbed.
7. **Geofence radius.** The frontend uses 150 m (`config.geofenceMeters`); `PickerWorkLocation.geofenceRadius` defaults to 200 m. Which is authoritative?
8. **Shift identifier.** `PickerShift` carries both `_id` and an optional `id` string. Which does `POST /shifts/select` expect?
9. **Status enum.** Add `BLOCKED` and `DELETION_PENDING` to `PickerUser.status`, or derive them? And is `INACTIVE` the same thing as `BLOCKED`?
10. **Bank field naming.** Backend schema names (`accountHolderName`, `ifscCode`) or frontend names (`holder`, `ifsc`)? One must give way.
11. **Settings persistence.** The frontend keeps notification toggles and language in local state and calls no API. Should these be server-side?
12. **Suspended pickers.** `authenticatePicker` returns 403 before `/onboarding/state` runs, so the app can never display its suspended gate. Exempt that route, or have the frontend map the 403?
