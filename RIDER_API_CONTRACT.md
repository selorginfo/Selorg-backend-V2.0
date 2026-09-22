# API Contract — Selorg Rider App (v1.3)

Contract for **every backend interaction the new rider frontend requires**, derived from the actual
frontend implementation (`src/services/api/*`, screens, store, selectors, mock shapes) and compared
against the actual backend routes, controllers, services and models in `selorg-service`.

- **Base URL:** `{API_BASE}/api/v1` — the frontend currently hard-codes `http://localhost:3000/api/v1`
  in `src/config/environment.ts`; the service defaults to port `3333`. Reconcile before integration.
- **Transport:** JSON over HTTPS, except the two multipart upload endpoints.
- **Authentication:** `Authorization: Bearer <picker JWT>` for everything except the public auth,
  config, legal and FAQ endpoints. Verified by `authenticatePicker`
  (`src/modules/picker/picker.auth.middleware.ts`), which sets `req.pickerId`.
- **Role:** every authenticated endpoint below is scoped to the **rider (picker)** role. No endpoint
  in this contract may accept an admin or customer token, and no endpoint may accept a rider
  identifier from the client — the subject always comes from the token.

## Standard response envelope

Every response is wrapped by `ResponseFormatter` / `apiEnvelopeMiddleware`:

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

Errors:

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

Paginated responses use `ResponseFormatter.paginated`, which puts the array in `data` and the meta in
a sibling `pagination` object:

```json
{
  "success": true,
  "data": [ ],
  "pagination": { "total": 128, "page": 1, "limit": 20, "pages": 7, "hasNextPage": true, "hasPrevPage": false }
}
```

> **Frontend constraint that shapes every contract below.** `src/services/api/client.ts` returns
> `{ ok: envelope.success, data: envelope.data }` and reads nested keys such as `data.orders`,
> `data.items`, `data.history`, `data.transactions`, `data.token`, `data.ref`. It **never reads the
> sibling `pagination` object**. Any endpoint the current frontend already calls must therefore
> return its list *inside* `data` (e.g. `data.orders` + `data.pagination`), not via
> `ResponseFormatter.paginated`. New endpoints may use either, provided the frontend client is
> updated to match. Each contract below states which form it uses.

## Common conventions

| Concern | Convention |
| --- | --- |
| IDs | Mongo `ObjectId` as a 24-char hex string, unless a domain id is stated (`batchId`, `stopId`, `shiftId`) |
| Money | Integer **paise-free rupees** as a `number` (e.g. `52`). Display strings (`"₹52"`) are the frontend's job. Any field named `*Display` is a pre-formatted string. |
| Dates | ISO-8601 UTC (`2026-09-04T10:15:00.000Z`). Any `*Display` variant is a pre-formatted local string. |
| Distance | `distanceKm: number` plus optional `distanceDisplay: "2.4 km"` |
| Duration | `durationMinutes: number` plus optional `durationDisplay: "12 min"` |
| Nullability | Optional fields are omitted or `null`; arrays are never `null` — always `[]` |
| Enums | `lowercase_snake` for all new fields. Existing `SCREAMING_CASE` enums on `PickerUser` / `PickerShift` are mapped at the API boundary, never leaked. |
| Idempotency | `Idempotency-Key: <uuid>` header honoured on order accept/complete, bulk deliver/fail, and cash deposit |

## Contract index

| # | API | Status |
| --- | --- | --- |
| 1 | Send OTP (phone / WhatsApp) | `EXISTING` |
| 2 | Resend OTP (phone / WhatsApp) | `EXISTING` |
| 3 | Send OTP (email) | `MODIFY_REQUIRED` |
| 4 | Verify OTP (phone / WhatsApp) | `MODIFY_REQUIRED` |
| 5 | Verify OTP (email) | `MODIFY_REQUIRED` |
| 6 | Logout | `NEW` |
| 7 | Refresh token | `NEW` |
| 8 | Get rider profile | `MODIFY_REQUIRED` |
| 9 | Update rider profile | `MODIFY_REQUIRED` |
| 10 | Get onboarding state | `MODIFY_REQUIRED` |
| 11 | List hubs (work locations, distance-sorted) | `MODIFY_REQUIRED` |
| 12 | Upload KYC document | `MODIFY_REQUIRED` |
| 13 | List KYC documents | `EXISTING` |
| 14 | List training videos | `EXISTING` |
| 15 | Update training watch progress | `EXISTING` |
| 16 | Acknowledge kit items | `NEW` |
| 17 | Submit onboarding application | `NEW` |
| 18 | List available shifts | `MODIFY_REQUIRED` |
| 19 | Book a shift | `MODIFY_REQUIRED` |
| 20 | Unbook a shift | `NEW` |
| 21 | List my shifts | `EXISTING` |
| 22 | Start shift (go online) | `MODIFY_REQUIRED` |
| 23 | End shift (go offline) | `MODIFY_REQUIRED` |
| 24 | Today's dashboard stats | `NEW` |
| 25 | Today's incentive | `NEW` |
| 26 | List available orders | `MODIFY_REQUIRED` |
| 27 | Get order detail (bag manifest) | `MODIFY_REQUIRED` |
| 28 | Update order status (accept / pickup / cancel) | `MODIFY_REQUIRED` |
| 29 | Upload proof-of-delivery photo | `NEW` |
| 30 | Complete delivery (OTP) | `MODIFY_REQUIRED` |
| 31 | Track rider location | `MODIFY_REQUIRED` |
| 32 | Get current bulk batch | `NEW` |
| 33 | Load a bulk bag | `NEW` |
| 34 | Start bulk delivery | `NEW` |
| 35 | Mark arrival at a bulk stop | `NEW` |
| 36 | Upload bulk stop POD photo | `NEW` |
| 37 | Deliver a bulk stop | `NEW` |
| 38 | Fail a bulk stop | `NEW` |
| 39 | List completed bulk batches | `NEW` |
| 40 | Get bulk batch detail | `NEW` |
| 41 | Earnings summary | `MODIFY_REQUIRED` |
| 42 | Daily earnings breakdown | `MODIFY_REQUIRED` |
| 43 | Wallet balance | `MODIFY_REQUIRED` |
| 44 | Wallet transactions | `EXISTING` |
| 45 | Delivery history (standard) | `MODIFY_REQUIRED` |
| 46 | Floating-cash summary | `NEW` |
| 47 | Floating-cash transactions | `NEW` |
| 48 | Record a cash deposit | `NEW` |
| 49 | Get notification/settings preferences | `NEW` |
| 50 | Update notification/settings preferences | `NEW` |
| 51 | Register push token | `MODIFY_REQUIRED` |
| 52 | App config | `MODIFY_REQUIRED` |
| 53 | Cancel / exception reason lists | `NEW` |
| 54 | FAQ list | `MODIFY_REQUIRED` |
| 55 | Support ticket list | `MODIFY_REQUIRED` |
| 56 | Create support ticket | `MODIFY_REQUIRED` |
| 57 | Support chat — read messages | `NEW` |
| 58 | Support chat — send message | `NEW` |
| 59 | Terms of Service | `MODIFY_REQUIRED` |
| 60 | Privacy Policy | `MODIFY_REQUIRED` |

---

# 1. Send OTP (phone / WhatsApp)

### Status

`EXISTING`

### Frontend Usage

- **Frontend page:** `src/screens/auth/LoginScreen.tsx`
- **Component:** `PhoneInput` + `SegmentedControl` (Mobile / WhatsApp / Email) + `PrimaryButton` ("Send OTP" / "Send code on WhatsApp")
- **User action:** enters a 10-digit number, taps Send
- **Why:** starts the only authentication method the app supports. Service client: `authApi.sendOtp(method, target)`.
- **Note:** the button currently only navigates to `Otp`; `authApi.sendOtp` is defined but not yet called.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/auth/send-otp` |
| **Authentication** | None (public) |
| **Authorization** | None |
| **Headers** | `Content-Type: application/json` |
| **Path params** | — |
| **Query params** | — |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `phone` | `string` | Yes | 10 digits after normalisation. Server strips non-digits and trims a `91` / leading `0` prefix; rejects all-zero numbers. |
| `preferredChannel` | `"sms" \| "whatsapp"` | No (default `"sms"`) | Any other value is treated as `sms` |

```json
{ "phone": "9876543210", "preferredChannel": "whatsapp" }
```

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.success` | `boolean` | Yes | No |
| `data.message` | `string` | Yes | No |
| `data.channel` | `"sms" \| "whatsapp"` | Yes | No |
| `data.otp` | `string` | No | No — **present only in dev mode**; must never appear in production |

```json
{
  "success": true,
  "message": "Success",
  "data": { "success": true, "message": "OTP sent successfully", "channel": "whatsapp" },
  "error": null, "pagination": null, "timestamp": "2026-09-04T10:15:00.000Z"
}
```

### Error Responses

| Status | `appCode` / condition | Meaning |
| --- | --- | --- |
| `400` | `INVALID_PHONE` | Not a valid 10-digit Indian mobile number |
| `400` | `SMS_GATEWAY_ERROR` | The SMS provider rejected or failed the send |
| `429` | rate limit | Too many OTP requests — **not yet implemented**, see gap A9 |
| `500` | — | Unexpected server error |

### Existing Backend Comparison

- **Existing endpoint:** `POST /api/v1/picker/auth/send-otp` → `picker.controller.sendOtp` → `picker.auth.service.sendOtp`.
- **Why it is compatible:** the handler already accepts exactly `{ phone, preferredChannel }`, normalises the number, generates a **4-digit** OTP (matching `environment.otpLength: 4` and the frontend's `OtpInput`), stores it in `PickerOtp` with a 5-minute TTL, and returns the channel the frontend uses to render its confirmation copy. No contract change is required.
- **Operational caveat:** `OTP_DEV_MODE` is enabled whenever `NODE_ENV !== 'production'` and returns the OTP in the body. Ensure it is off in deployed environments.

---

# 2. Resend OTP (phone / WhatsApp)

### Status

`EXISTING`

### Frontend Usage

- **Frontend page:** `src/screens/auth/OtpScreen.tsx`
- **Component:** the "Resend in 0:24" label (currently static text; the API is not yet wired)
- **User action:** taps resend after the countdown expires
- **Why:** OTP delivery failure is the single biggest drop-off point in phone auth

### Request

Identical to API 1, at `POST /api/v1/picker/auth/resend-otp`.

### Response

Identical to API 1.

### Error Responses

Identical to API 1.

### Existing Backend Comparison

- **Existing endpoint:** `POST /api/v1/picker/auth/resend-otp` → `picker.auth.service.resendOtp`, which delegates directly to `sendOtp`.
- **Why it is compatible:** same request and response shape; the frontend only needs to call it.
- **Required backend follow-up (not a contract change):** because `storeOtp` upserts with `attempts: 0`, resending resets the 5-attempt cap. Add a per-identifier throttle (e.g. max 3 resends per 15 minutes) as described in gap A9.

---

# 3. Send OTP (email)

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `src/screens/auth/LoginScreen.tsx` with `loginMethod === 'email'`
- **Component:** the email `TextInput` row + `PrimaryButton`
- **User action:** enters an email address and taps Send OTP
- **Why:** Email is one of the three login methods offered by the `SegmentedControl`

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/auth/send-otp-email` |
| **Authentication** | None |
| **Headers** | `Content-Type: application/json` |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `email` | `string` | Yes | Trimmed, lowercased, must match `^[^\s@]+@[^\s@]+\.[^\s@]+$` (the frontend enables Send on `/.+@.+\..+/`) |

```json
{ "email": "arjun.m@selorg.in" }
```

### Response

`200 OK`

| Field | Type | Required |
| --- | --- | --- |
| `data.success` | `boolean` | Yes |
| `data.message` | `string` | Yes |
| `data.channel` | `"email"` | Yes |
| `data.otp` | `string` | Dev mode only |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `INVALID_PHONE` | Malformed email — **the code is misleading and should become `INVALID_EMAIL`** |
| `502` | `EMAIL_GATEWAY_ERROR` | Provider failure (does not exist yet; add with delivery) |

### Existing Backend Comparison

- **Current backend contract:** `picker.auth.service.sendOtpEmail(email)` validates the address, generates a 4-digit OTP, stores it under the identifier `email|<address>`, and returns `{ success: true, channel: 'email' }`.
- **Frontend expected contract:** identical — the shape is already right.
- **Exact mismatch:** **the email is never sent.** Outside `OTP_DEV_MODE` the function stores the OTP and returns success with no delivery attempt (there is no email transport call anywhere in the branch). The rider therefore receives nothing and can never complete email login in a deployed environment. Secondary mismatch: the error code for a bad email is `INVALID_PHONE`.
- **Required change:** integrate an email transport (the same provider used for `admin-user-emails`), return `502 EMAIL_GATEWAY_ERROR` on failure, and rename the validation code to `INVALID_EMAIL`.

---

# 4. Verify OTP (phone / WhatsApp)

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `src/screens/auth/OtpScreen.tsx`
- **Component:** `OtpInput` (4 boxes) + `PrimaryButton` "Verify & Continue"
- **User action:** enters the 4-digit code and taps Verify
- **Why:** issues the session token **and decides where the app navigates next** — `RootNavigator` must choose between `Main`, `ObWelcome`, `Pending` and `Rejected`.
- **Current state:** `onVerify` calls `actions.verifyOtp()`, a local reducer that hard-codes a failure for the phone `9000000000`. `authApi.verifyOtp` exists but is not called.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/auth/verify-otp` |
| **Authentication** | None |
| **Headers** | `Content-Type: application/json` |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `phone` | `string` | Yes | Same normalisation as API 1 |
| `otp` | `string` | Yes | Exactly 4 numeric digits (`^\d{4}$`) |
| `preferredChannel` | `"sms" \| "whatsapp"` | No | Recorded as `loginMethod` |
| `intent` | `"login" \| "signup"` | No — **new** | When `"login"` and no account exists, return `404` instead of auto-creating |
| `storeId` | `string` | No | Accepted today; unused by the rider app |

```json
{ "phone": "9876543210", "otp": "1234", "preferredChannel": "sms", "intent": "login" }
```

### Response

`200 OK`

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data.success` | `boolean` | Yes | No | |
| `data.message` | `string` | Yes | No | |
| `data.token` | `string` | Yes | No | JWT, 7-day expiry. Frontend stores it via `saveToken`. |
| `data.isNewUser` | `boolean` | Yes | No | |
| `data.user.id` | `string` | Yes | No | `PickerUser._id` |
| `data.user.phone` | `string` | Yes | No | |
| `data.user.email` | `string` | Yes | **Yes** | |
| `data.user.name` | `string` | Yes | **Yes** | Drives the Home greeting and Profile |
| `data.user.loginMethod` | `"mobile" \| "whatsapp" \| "email"` | Yes | No | |
| `data.user.status` | `"pending" \| "active" \| "inactive" \| "rejected" \| "suspended"` | Yes — **new** | No | Mapped from `PickerUser.status` (`SCREAMING_CASE` → lowercase) |
| `data.user.onboardingCompleted` | `boolean` | Yes — **new** | No | True once the application has been submitted and approved |
| `data.user.rejectedReason` | `string` | No — **new** | Yes | Populated only when `status === "rejected"` |
| `data.nextScreen` | `"main" \| "onboarding" \| "pending_review" \| "rejected" \| "suspended"` | Yes — **new** | No | Server-computed routing hint |

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "success": true,
    "message": "OTP verified",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "isNewUser": false,
    "user": {
      "id": "66f0a1b2c3d4e5f60718293a",
      "phone": "9876543210",
      "email": "arjun.m@selorg.in",
      "name": "Arjun Mehta",
      "loginMethod": "mobile",
      "status": "active",
      "onboardingCompleted": true,
      "rejectedReason": null
    },
    "nextScreen": "main"
  },
  "error": null, "pagination": null, "timestamp": "2026-09-04T10:15:30.000Z"
}
```

### Error Responses

| Status | `appCode` | Meaning | Frontend handling |
| --- | --- | --- | --- |
| `400` | `INCORRECT_OTP` | OTP is not 4 numeric digits | inline `otpError` |
| `400` | `OTP_EXPIRED` | Wrong, expired, already used, or over the 5-attempt cap | inline `otpError` ("Incorrect code. Please try again.") |
| `400` | `INVALID_PHONE` | Bad phone number | back to Login |
| `404` | `ACCOUNT_NOT_FOUND` | **New** — `intent: "login"` with no existing account | sets `loginNotFound`, shows the Create-Account banner |
| `403` | `ACCOUNT_SUSPENDED` | **New** — account is suspended | dedicated screen (does not exist yet) |
| `429` | `OTP_RATE_LIMITED` | **New** — too many attempts | disable Verify with a countdown |

### Existing Backend Comparison

**Current backend contract** (`picker.auth.service.verifyOtp`):

```json
{ "success": true, "message": "OTP verified", "token": "...", "isNewUser": false,
  "user": { "phone": "9876543210", "id": "66f0...", "email": null, "loginMethod": "mobile" } }
```

**Frontend expected contract:** the response above, including `status`, `onboardingCompleted`, `rejectedReason` and `nextScreen`.

**Exact mismatches**

1. **No account status.** `PickerUser.status` (`PENDING | ACTIVE | INACTIVE | REJECTED | SUSPENDED`) is loaded but not returned. `isNewUser` alone cannot separate "submitted, awaiting review" from "approved", so the app cannot choose between `Pending`, `ObWelcome` and `Main`.
2. **No `name`.** `HomeScreen` and `ProfileScreen` need it immediately; today it takes a second `GET /user/profile` round trip.
3. **No rejection reason.** `RejectedScreen` currently hard-codes "Driving licence photo was blurry".
4. **Login intent is impossible to honour.** The service auto-creates a `PickerUser` on first successful verify, so the frontend's `loginNotFound` banner can never fire.
5. **Enum casing.** `PickerUser.status` is `SCREAMING_CASE`; the frontend's `accountStatus` is `none | pending | approved`. Map at the API boundary.

**Required change:** extend the response with the four new fields, add optional `intent` handling with a `404 ACCOUNT_NOT_FOUND` branch, and return `403 ACCOUNT_SUSPENDED` for suspended accounts instead of issuing a token that `authenticatePicker` will reject on the next call.

---

# 5. Verify OTP (email)

### Status

`MODIFY_REQUIRED`

### Frontend Usage

Same screen and component as API 4, taken when `loginMethod === 'email'`
(`authApi.verifyOtp` branches on `target.includes('@')`).

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/auth/verify-otp-email` |
| **Authentication** | None |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `email` | `string` | Yes | Normalised and validated as in API 3 |
| `otp` | `string` | Yes | `^\d{4}$` |
| `intent` | `"login" \| "signup"` | No — **new** | As in API 4 |

### Response

Identical to API 4, with `user.loginMethod: "email"`.

### Error Responses

Identical to API 4, with `INVALID_PHONE` replaced by `INVALID_EMAIL` (see API 3).

### Existing Backend Comparison

- **Current backend contract:** `verifyOtpEmail` returns `{ success, message, token, isNewUser, user: { phone, email, id, loginMethod } }`.
- **Frontend expected contract:** as API 4.
- **Exact mismatches:** the same four omissions as API 4, plus one email-specific issue — because `PickerUser.phone` is `required` and `unique`, the service fabricates a **synthetic phone number** (`syntheticPhone()`, an md5-derived digit string prefixed with `1`) for email-only riders. That value is returned in `user.phone` and will surface in admin lists and SMS flows as an unusable number.
- **Required change:** the same four fields as API 4, plus either make `phone` optional on `PickerUser` (with a partial unique index) or return `phone: null` for email-only accounts rather than the synthetic value.

---

# 6. Logout

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `src/screens/profile/ProfileScreen.tsx` ("⏻ Log out"), `PendingScreen` (back), `RejectedScreen` (back)
- **Component:** `OutlineButton`, tone `danger`
- **User action:** taps Log out
- **Why:** `authApi.logout()` only calls `clearToken()`, which clears an in-memory variable. The server-side `PickerUser.sessionToken` remains valid for the full 7-day JWT lifetime, so a stolen token still works after the rider logs out.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/auth/logout` |
| **Authentication** | Bearer picker JWT (required) |
| **Authorization** | Rider (self only) |
| **Body** | none |

### Response

`200 OK`

```json
{ "success": true, "message": "Logged out", "data": { "loggedOut": true }, "error": null }
```

| Field | Type | Required |
| --- | --- | --- |
| `data.loggedOut` | `boolean` | Yes |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `401` | `AUTH_TOKEN_REQUIRED` / `AUTH_TOKEN_INVALID` | Missing or invalid token — the client should clear local state and continue to the auth landing regardless |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** there is no picker logout route in `picker.routes.ts`. The HHD module has `POST /hhd/auth/logout`, but it operates in a different auth domain against HHD users. `tokenBlocklist` in `utils/auth` is used only by the admin/customer middlewares and is not consulted by `authenticatePicker`.
- **Proposed endpoint contract:** `POST /picker/auth/logout`, authenticated, which sets `PickerUser.sessionToken = null`. `authenticatePicker` already compares the token's `sid` claim against `sessionToken` and returns `401 AUTH_SESSION_EXPIRED` on a mismatch, so clearing the field invalidates every outstanding token for that rider with no new infrastructure.
- **Expected request:** empty body.
- **Expected response:** `{ loggedOut: true }`.
- **Expected errors:** `401` only.

---

# 7. Refresh token

### Status

`NEW`

### Frontend Usage

- **Frontend page:** app resume (`App.tsx` / `RootNavigator` bootstrap) — not yet implemented
- **Component:** none (silent)
- **User action:** none; runs on cold start when a stored token is near expiry
- **Why:** the JWT lasts 7 days and cannot be renewed, so an active rider is forced through full SMS OTP once a week. This is also a prerequisite for persisting the token at all (gap A5).

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/auth/refresh` |
| **Authentication** | Bearer picker JWT — accepted while unexpired, or within a defined grace window after expiry |
| **Body** | none |

### Response

`200 OK`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `data.token` | `string` | Yes | A new 7-day JWT with a fresh `sid` |
| `data.expiresAt` | `string (ISO-8601)` | Yes | |
| `data.user.status` | `string` | Yes | Same enum as API 4 — lets the app react to a mid-session suspension |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `401` | `AUTH_TOKEN_INVALID` | Token unusable — force re-login |
| `401` | `AUTH_SESSION_EXPIRED` | `sid` no longer matches `sessionToken` (logged out elsewhere) |
| `403` | `ACCOUNT_SUSPENDED` | Account suspended since the last call |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** no refresh route exists for pickers. `buildToken` is exported from `picker.auth.service` but is unused. There is no refresh-token model.
- **Proposed endpoint contract:** rotate `sessionToken` and issue a new JWT carrying the new `sid`, invalidating the previous one. No separate refresh-token store is required because `sessionToken` already provides single-session semantics.
- **Expected request:** empty body, current token in the header.
- **Expected response:** `{ token, expiresAt, user: { status } }`.
- **Expected errors:** `401`, `403` as above.

---

# 8. Get rider profile

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend pages:** `ProfileScreen.tsx`, `HomeScreen.tsx` (greeting), `ObPersonalScreen.tsx` (prefill)
- **Components:** avatar tile, name/email block, rating pill, `StatTile` × 3 (total trips, on-time %, float cash), vehicle & mode card
- **User action:** opens Profile, or the app bootstraps
- **Why:** the single source of rider identity. Backed in state by `epName`, `epEmail`, `epVehicle`, currently seeded from hard-coded defaults (`"Arjun Mehta"`, `"arjun.m@selorg.in"`, `"KA 01 AB 1234"`).

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/user/profile` (alias `/picker/profile`) |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider — always the token's own subject; **no `pickerId` parameter may be accepted** |
| **Path / query params** | — |

### Response

`200 OK`

| Field | Type | Required | Nullable | Source |
| --- | --- | --- | --- | --- |
| `data.id` | `string` | Yes | No | `PickerUser._id` |
| `data.name` | `string` | Yes | Yes | existing |
| `data.email` | `string` | Yes | Yes | existing |
| `data.phone` | `string` | Yes | Yes | existing |
| `data.photoUrl` | `string` | No | Yes | `photoUri` |
| `data.status` | `"pending" \| "active" \| "inactive" \| "rejected" \| "suspended"` | Yes | No | mapped from `PickerUser.status` |
| `data.vehicle.type` | `"bike" \| "scooter" \| "ev" \| "cycle" \| "auto" \| "van"` | Yes — **new** | Yes | **new field** |
| `data.vehicle.registrationNumber` | `string` | Yes — **new** | Yes | **new field** |
| `data.vehicle.label` | `string` | Yes — **new** | Yes | display label ("Motorbike", "AUTO") |
| `data.deliveryMode` | `"standard" \| "bulk"` | Yes — **new** | No | derived server-side; `auto`/`van` ⇒ `bulk` |
| `data.hub.id` | `string` | Yes | Yes | `currentLocationId` → `PickerWorkLocation.warehouseKey` |
| `data.hub.name` | `string` | Yes | Yes | |
| `data.stats.totalTrips` | `number` | Yes — **new** | No | aggregate |
| `data.stats.onTimePercent` | `number` | Yes — **new** | No | 0–100, one decimal |
| `data.stats.rating` | `number` | Yes — **new** | Yes | 0–5, one decimal; `null` until enough trips |
| `data.floatCash` | `number` | Yes — **new** | No | current cash in hand (see API 46) |
| `data.kycVerified` | `boolean` | Yes — **new** | No | true when every required document is `approved` |
| `data.createdAt` | `string (ISO-8601)` | Yes | No | |

```json
{
  "success": true,
  "data": {
    "id": "66f0a1b2c3d4e5f60718293a",
    "name": "Arjun Mehta",
    "email": "arjun.m@selorg.in",
    "phone": "9876543210",
    "photoUrl": null,
    "status": "active",
    "vehicle": { "type": "auto", "registrationNumber": "KA 01 AB 1234", "label": "Auto" },
    "deliveryMode": "bulk",
    "hub": { "id": "kor", "name": "Koramangala Darkstore" },
    "stats": { "totalTrips": 1284, "onTimePercent": 98.0, "rating": 4.9 },
    "floatCash": 840,
    "kycVerified": true,
    "createdAt": "2026-01-14T06:00:00.000Z"
  },
  "error": null
}
```

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `401` | `AUTH_TOKEN_REQUIRED` / `AUTH_TOKEN_INVALID` / `AUTH_SESSION_EXPIRED` | Re-authenticate |
| `403` | `ACCOUNT_SUSPENDED` | Suspended rider |
| `404` | — | Picker record not found (`getProfile` returns `null`) |

### Existing Backend Comparison

- **Current backend contract:** `pickerService.getProfile` returns the **raw `PickerUser` document** — every schema field, including internal ones (`sessionToken`, `locationOtp`, `faceVerificationStatus`, `deletionReason`, `hhdUserId`, `agencyId`).
- **Frontend expected contract:** the curated shape above.
- **Exact mismatches:**
  1. **No vehicle fields.** `vehicleType` and `vehicleRegistrationNumber` do not exist on `PickerUser`, yet onboarding step 2 collects both and Profile displays both.
  2. **No `deliveryMode`.** The frontend derives it client-side in `selectors.ts` (`auto`/`van` ⇒ bulk). That rule must move server-side, since it decides which whole delivery vertical the rider sees.
  3. **No stats.** `totalTrips`, `onTimePercent` and `rating` are not computed for pickers. `Rider.rating` exists but lives on the operational `riders` collection, keyed `RIDER-\d+`, with no link to `PickerUser`.
  4. **No `floatCash`.** No COD ledger exists at all (see API 46).
  5. **Over-exposure.** `sessionToken` and `locationOtp` are secrets and must not be serialised to a client.
  6. **Hub is a loose string.** `currentLocationId` has no ref to `PickerWorkLocation`, so a name cannot be resolved reliably.
- **Required change:** add a response DTO that projects only the fields above, add the vehicle fields to the schema, compute `deliveryMode` server-side, and join the hub and stats.

---

# 9. Update rider profile

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend pages:** `ObPersonalScreen.tsx` (name, email), `ObVehicleScreen.tsx` (vehicle type, registration number), `ObHubScreen.tsx` (hub)
- **Components:** `LabeledInput`, vehicle selection grid, `RadioRow` hub list
- **User action:** completes an onboarding step and taps Continue
- **Why:** persists onboarding answers so the flow survives an app restart — today every answer lives only in the reducer.

### Request

| | |
| --- | --- |
| **Method** | `PUT` |
| **Endpoint** | `/api/v1/picker/user/profile` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |
| **Headers** | `Content-Type: application/json` |

**Body** — all fields optional; a partial update.

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `name` | `string` | No | 2–100 chars, trimmed; frontend requires non-empty before Continue |
| `email` | `string` | No | Valid email; frontend requires non-empty before Continue |
| `photoUrl` | `string` | No | https URL |
| `vehicleType` | `"bike" \| "scooter" \| "ev" \| "cycle" \| "auto" \| "van"` | No — **new** | Must be one of the enum values. The frontend's `ObVehicleScreen` offers `bike \| scooter \| ev \| cycle`; `auto`/`van` come from fleet assignment. |
| `vehicleRegistrationNumber` | `string` | No — **new** | Uppercased; frontend enforces ≥ 4 chars. Recommended server pattern: `^[A-Z]{2}[ -]?\d{1,2}[ -]?[A-Z]{1,3}[ -]?\d{4}$` |
| `hubId` | `string` | No — **new** | Must match an active `PickerWorkLocation.warehouseKey` |
| `age` | `number` | No | 18–70 (the Terms screen states a minimum age of 18) |
| `gender` | `"male" \| "female"` | No | existing enum |
| `upiId` | `string` | No | existing |

```json
{ "vehicleType": "scooter", "vehicleRegistrationNumber": "KA 01 AB 1234" }
```

### Response

`200 OK` — the same DTO as API 8, reflecting the update.

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Invalid enum value or malformed registration number; `error.details` carries `[{ field, message }]` |
| `401` | auth codes | |
| `404` | — | Picker not found |
| `409` | `HUB_INACTIVE` | The chosen hub is no longer active |

### Existing Backend Comparison

- **Current backend contract:** `PUT /picker/user/profile` → `pickerService.updateProfile`, which whitelists `['name','email','age','gender','photoUri','locationType','upiId','upiName','gpsLocation']` and silently drops everything else.
- **Frontend expected contract:** the body above.
- **Exact mismatches:**
  1. `vehicleType` and `vehicleRegistrationNumber` are neither schema fields nor whitelisted — sending them **silently succeeds while discarding the data**, which is worse than a 400.
  2. `hubId` has no equivalent; `locationType` (`warehouse | darkstore`) is a *category*, not a hub selection, and `currentLocationId` is not writable.
  3. **No validation at all.** `updateProfile` performs a raw `findByIdAndUpdate` — no email format check, no age bounds, no enum enforcement beyond what Mongoose itself applies.
  4. Field naming: the schema uses `photoUri`; the API should expose `photoUrl` consistently with every other URL field.
- **Required change:** add the two vehicle fields and a hub reference to `PickerUser`, extend the whitelist, and add a Zod schema (the codebase already uses `validate(schema)` middleware in the customer modules — none of the picker routes use it today).
---

# 10. Get onboarding state

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend pages:** `PendingScreen.tsx` ("Check application status"), `RejectedScreen.tsx`, `RootNavigator` bootstrap, `ObWelcomeScreen` resume
- **Components:** application card (Application ID / Hub / Status), `SegmentedProgress` on `ObStepLayout`
- **User action:** submits the application and then polls; or reopens the app mid-onboarding
- **Why:** the app has four onboarding-related destinations (`ObWelcome`, `Pending`, `ObDone`, `Rejected`) and no way to know which one applies. `accountStatus` is currently mutated purely client-side (`submitOnboard`, `approveAccount`, `resubmitDocs`), so "Check application status" is a demo button that approves the rider locally.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/onboarding/state` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |

### Response

`200 OK`

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data.applicationId` | `string` | Yes | Yes | Server-issued, e.g. `SL-RA-2048`. `null` before submission. Replaces the client-side `selectors.appId`. |
| `data.status` | `"not_started" \| "in_progress" \| "under_review" \| "approved" \| "rejected"` | Yes | No | Maps to the frontend's `accountStatus` plus the Rejected screen |
| `data.submittedAt` | `string (ISO-8601)` | Yes | Yes | |
| `data.reviewedAt` | `string (ISO-8601)` | Yes | Yes | |
| `data.rejectionReason` | `string` | Yes | Yes | Overall reason shown on `RejectedScreen` |
| `data.hub.id` / `data.hub.name` | `string` | Yes | Yes | Shown on `PendingScreen` |
| `data.steps[]` | `array` | Yes | No | Always 5 entries, in order |
| `data.steps[].key` | `"personal" \| "vehicle" \| "hub" \| "documents" \| "training"` | Yes | No | |
| `data.steps[].label` | `string` | Yes | No | "Personal details", "Vehicle information", … |
| `data.steps[].completed` | `boolean` | Yes | No | Drives `SegmentedProgress` |
| `data.steps[].blockedReason` | `string` | No | Yes | e.g. "2 of 5 documents rejected" |
| `data.documents[]` | `array` | Yes | No | Per-document review state for `RejectedScreen` |
| `data.documents[].type` | `"aadhar" \| "pan" \| "dl" \| "rc" \| "ins"` | Yes | No | |
| `data.documents[].status` | `"missing" \| "pending" \| "approved" \| "rejected"` | Yes | No | |
| `data.documents[].rejectionReason` | `string` | Yes | Yes | |
| `data.kit.acknowledged` | `boolean` | Yes | No | |
| `data.training.completed` | `boolean` | Yes | No | From `PickerUser.trainingCompleted` |
| `data.training.progressPercent` | `number` | Yes | No | 0–100 |

```json
{
  "success": true,
  "data": {
    "applicationId": "SL-RA-2048",
    "status": "rejected",
    "submittedAt": "2026-09-03T11:20:00.000Z",
    "reviewedAt": "2026-09-04T07:05:00.000Z",
    "rejectionReason": "One or more documents could not be verified.",
    "hub": { "id": "kor", "name": "Koramangala Darkstore" },
    "steps": [
      { "key": "personal",  "label": "Personal details",     "completed": true },
      { "key": "vehicle",   "label": "Vehicle information",  "completed": true },
      { "key": "hub",       "label": "Choose your hub",      "completed": true },
      { "key": "documents", "label": "Upload documents",     "completed": false,
        "blockedReason": "1 of 5 documents rejected" },
      { "key": "training",  "label": "Training & kit",       "completed": true }
    ],
    "documents": [
      { "type": "aadhar", "status": "approved", "rejectionReason": null },
      { "type": "pan",    "status": "approved", "rejectionReason": null },
      { "type": "dl",     "status": "rejected", "rejectionReason": "Driving licence photo was blurry and could not be verified." },
      { "type": "rc",     "status": "approved", "rejectionReason": null },
      { "type": "ins",    "status": "approved", "rejectionReason": null }
    ],
    "kit": { "acknowledged": true },
    "training": { "completed": true, "progressPercent": 100 }
  },
  "error": null
}
```

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `401` | auth codes | |
| `403` | `ACCOUNT_SUSPENDED` | |

### Existing Backend Comparison

- **Current backend contract:** `getOnboardingState` is a one-line stub returning `{ userId, state: 'pending', steps: [] }`. The value `'pending'` is a literal — it never reflects the account.
- **Frontend expected contract:** the document above.
- **Exact mismatches:** everything except the field name `steps`. No application id, no real status, no per-step completion, no document review feedback, no hub, no training progress.
- **Required change:** implement the handler against `PickerUser.status`, `PickerUser.rejectedReason`, `PickerDocument` (status + `rejectionReason`), `PickerUser.trainingCompleted`/`trainingProgress`, and a new onboarding-application record (gap D7) that stores `applicationId`, `submittedAt` and `reviewedAt`. Map `PickerUser.status` as: `PENDING` + no submission ⇒ `in_progress` (or `not_started`); `PENDING` + submitted ⇒ `under_review`; `ACTIVE` ⇒ `approved`; `REJECTED` ⇒ `rejected`.

---

# 11. List hubs (work locations, distance-sorted)

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `ObHubScreen.tsx` (onboarding step 3)
- **Component:** `RadioRow` list with name, address, bay count and a right-aligned distance label
- **User action:** grants location permission, then picks a darkstore
- **Why:** hub choice determines which darkstore dispatches the rider's orders. Currently served by the `HUBS` mock (3 hard-coded Bengaluru hubs with fixed distances).

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/work-locations` |
| **Authentication** | Bearer picker JWT (currently public — should require auth) |
| **Authorization** | Rider |

**Query params**

| Param | Type | Required | Validation |
| --- | --- | --- | --- |
| `type` | `"warehouse" \| "darkstore"` | No | Existing filter |
| `lat` | `number` | No — **new** | −90…90; required for distance sorting |
| `lng` | `number` | No — **new** | −180…180 |
| `radiusKm` | `number` | No — **new** | 1–100, default 25 |

### Response

`200 OK` — array in `data`.

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data[].id` | `string` | Yes | No — `warehouseKey` |
| `data[].name` | `string` | Yes | No |
| `data[].address` | `string` | Yes | Yes |
| `data[].type` | `"warehouse" \| "darkstore"` | Yes | No |
| `data[].coordinates.latitude` | `number` | Yes | Yes |
| `data[].coordinates.longitude` | `number` | Yes | Yes |
| `data[].distanceKm` | `number` | No — **new** | Yes — present only when `lat`/`lng` are supplied |
| `data[].distanceDisplay` | `string` | No — **new** | Yes — `"1.2 km"` |
| `data[].dispatchBays` | `number` | No — **new** | Yes — the UI renders "6 dispatch bays" |
| `data[].isActive` | `boolean` | Yes | No |

Sorted ascending by `distanceKm` when coordinates are supplied; otherwise by `name`.

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Invalid coordinates |
| `401` | auth codes | |

### Existing Backend Comparison

- **Current backend contract:** `GET /picker/work-locations` → `pickerService.listWorkLocations(type)` returns `PickerWorkLocation[]` (`warehouseKey`, `name`, `address`, `type`, `isActive`, `coordinates`, `geofenceRadius`) filtered to `isActive: true`. It is **registered without `authenticatePicker`**, so it is currently public.
- **Frontend expected contract:** the same list plus `distanceKm` and `dispatchBays`, sorted by proximity.
- **Exact mismatches:**
  1. **No distance.** `ObHubScreen` is built around a location-permission gate whose entire purpose is proximity sorting ("Location on · showing hubs near Koramangala"). No distance is computed and no sort is applied.
  2. **No dispatch-bay count.** The UI renders it as a subtitle; the model has no such field.
  3. **No geo index.** `coordinates` is a plain `{ latitude, longitude }` subdocument with no `2dsphere` index, so `$near` is unavailable.
  4. The sibling stubs `/picker/stores/nearby` and `/picker/locations/nearest` return empty and should either be implemented or removed to avoid ambiguity about which endpoint is authoritative.
- **Required change:** add a GeoJSON `location` field with a `2dsphere` index (or compute Haversine in an aggregation), accept `lat`/`lng`/`radiusKm`, add `dispatchBays`, and require picker auth.

---

# 12. Upload KYC document

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `ObKycScreen.tsx` (onboarding step 4)
- **Component:** per-document row with an "Upload" / "✓ Uploaded" badge, over `DOC_LIST` (Aadhaar, PAN, Driving Licence, Vehicle RC, Vehicle Insurance)
- **User action:** taps Upload, picks or captures an image
- **Why:** KYC is mandatory before approval. Currently `actions.toggleObDoc(code)` only flips a boolean in the reducer — no file is captured or sent.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/documents` (alias `/picker/documents/upload`) |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |
| **Headers** | `Content-Type: multipart/form-data` — **changed from `application/json`** |

**Form fields**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `file` | binary | Yes | `image/jpeg`, `image/png` or `application/pdf`; ≤ 10 MB (matches the HHD multer limit) |
| `type` | `"aadhar" \| "pan" \| "dl" \| "rc" \| "ins"` | Yes | **Must be enumerated** — matches `DOC_LIST[].code` |
| `side` | `"front" \| "back"` | Conditional | Required when `type === "aadhar"` (the UI says "Front & back photo"); ignored otherwise |
| `fileName` | `string` | No | ≤ 255 chars |

### Response

`201 Created`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.id` | `string` | Yes | No |
| `data.type` | `string` | Yes | No |
| `data.side` | `"front" \| "back"` | No | Yes |
| `data.status` | `"pending" \| "approved" \| "rejected"` | Yes | No — always `pending` on upload |
| `data.url` | `string` | Yes | No — server-hosted URL |
| `data.fileName` | `string` | Yes | Yes |
| `data.uploadedAt` | `string (ISO-8601)` | Yes | No |
| `data.rejectionReason` | `string` | Yes | Yes — always `null` on upload |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Missing file, unknown `type`, or missing `side` for Aadhaar |
| `413` | `FILE_TOO_LARGE` | Over 10 MB |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Not an image or PDF |
| `401` | auth codes | |
| `409` | `DOCUMENT_ALREADY_APPROVED` | Re-uploading a document already approved (allow only after rejection) |

### Existing Backend Comparison

- **Current backend contract:** `POST /picker/documents` accepts JSON `{ type, url, fileName }`, requires `type` and `url`, and creates a `PickerDocument` with `status: 'pending'`. `type` is an unconstrained `String`.
- **Frontend expected contract:** a multipart upload of the captured file itself.
- **Exact mismatches:**
  1. **The client must already have a hosted URL.** A mobile app that just took a photo does not. There is **no picker-facing upload endpoint** anywhere: multer appears only in `hhd.routes.ts` (`POST /hhd/photos`, image-only, 10 MB, disk storage under `UPLOAD_DIR`) and in the admin compliance / support attachment middleware — none reachable with a picker token.
  2. **`type` is unvalidated.** A typo silently creates a document of an unknown type that no reviewer screen will surface.
  3. **No `side`.** Aadhaar needs front and back; the model has no way to express two files of the same type other than two rows that cannot be told apart.
  4. **No duplicate/replacement semantics.** Re-uploading after a rejection creates a second row; nothing marks the earlier one superseded.
- **Required change:** add multer (mirroring `hhd.routes.ts`), enumerate `type`, add `side` and a `supersedes` reference, and keep the JSON variant only if an admin-side import path still needs it.

---

# 13. List KYC documents

### Status

`EXISTING`

### Frontend Usage

- **Frontend page:** `src/screens/profile/DocsScreen.tsx` ("Documents & KYC")
- **Component:** per-document rows with a "Verified" pill, and a success `Banner` ("KYC Verified — All documents approved")
- **User action:** opens Documents & KYC from Profile
- **Why:** shows verification state per document. Currently the screen renders the `DOC_LIST` mock with every row hard-coded to "Verified".

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/documents` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |

### Response

`200 OK` — array in `data`.

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data[]._id` | `string` | Yes | No |
| `data[].type` | `string` | Yes | No |
| `data[].url` | `string` | Yes | No |
| `data[].fileName` | `string` | No | Yes |
| `data[].status` | `"pending" \| "approved" \| "rejected"` | Yes | No |
| `data[].rejectionReason` | `string` | No | Yes |
| `data[].reviewedAt` | `string (ISO-8601)` | No | Yes |
| `data[].createdAt` | `string (ISO-8601)` | Yes | No |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `401` | auth codes | |

### Existing Backend Comparison

- **Existing endpoint:** `GET /api/v1/picker/documents` → `pickerService.listDocuments` → `PickerDocument.find({ userId })`.
- **Why it is compatible:** the query is already scoped to the authenticated picker, and the returned fields (`type`, `status`, `rejectionReason`, `reviewedAt`) cover every state `DocsScreen` renders. The frontend need only map `approved → "Verified"`, `pending → "Under review"` and `rejected → "Re-upload required"`, and derive the banner from "all required types approved".
- **Minor note:** because `type` is unvalidated on write (see API 12), the frontend should render unknown types defensively rather than assuming the five `DOC_LIST` codes.

---

# 14. List training videos

### Status

`EXISTING`

### Frontend Usage

- **Frontend page:** `ObTrainingScreen.tsx` (onboarding step 5)
- **Component:** the gradient video tile ("Rider onboarding · 3 min")
- **User action:** taps the tile to play
- **Why:** training completion is a prerequisite for submitting the application

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/training/videos` |
| **Authentication** | None today (route is public); should require picker auth |
| **Query params** | `warehouseKey` (`string`, optional) — hub-specific videos |

### Response

`200 OK` — array in `data`, ordered by `order` ascending.

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data[].videoId` | `string` | Yes | No |
| `data[].title` | `string` | Yes | No |
| `data[].description` | `string` | No | Yes |
| `data[].url` | `string` | Yes | No |
| `data[].thumbnailUrl` | `string` | No | Yes |
| `data[].durationSeconds` | `number` | No | Yes |
| `data[].order` | `number` | Yes | No |
| `data[].isActive` | `boolean` | Yes | No |

### Error Responses

| Status | Meaning |
| --- | --- |
| `500` | Unexpected server error |

### Existing Backend Comparison

- **Existing endpoint:** `GET /api/v1/picker/training/videos` → `pickerService.listTrainingVideos(warehouseKey)`.
- **Why it is compatible:** returns active videos ordered by `order`, with the URL, title and duration the tile needs. The frontend currently models a single video (`obVideo: boolean`); it should either render the first entry or extend to a list — no backend change either way.

---

# 15. Update training watch progress

### Status

`EXISTING`

### Frontend Usage

- **Frontend page:** `ObTrainingScreen.tsx`
- **Component:** the video tile transitioning to "✓ Training completed"
- **User action:** finishes the video (`actions.playVideo()` currently sets the flag immediately)
- **Why:** gates the "Review & Submit" button and feeds `onboarding/state`

### Request

| | |
| --- | --- |
| **Method** | `PUT` |
| **Endpoint** | `/api/v1/picker/training/watch-progress` |
| **Authentication** | Bearer picker JWT |
| **Headers** | `Content-Type: application/json` |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `videoId` | `string` | Yes | Must match `PickerTrainingVideo.videoId` |
| `progress` | `number` | Yes | 0–100; clamped server-side |

### Response

`200 OK`

| Field | Type | Required |
| --- | --- | --- |
| `data.trainingProgress` | `Record<string, number>` | Yes — keyed by `videoId` |
| `data.trainingCompleted` | `boolean` | Yes |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `videoId` or `progress` missing |
| `401` | auth codes | |
| `404` | — | Picker not found |

### Existing Backend Comparison

- **Existing endpoint:** `PUT /api/v1/picker/training/watch-progress` → `pickerService.updateTrainingProgress`.
- **Why it is compatible:** it clamps progress to 0–100, persists per-video progress on `PickerUser.trainingProgress`, and auto-sets `trainingCompleted` + `trainingCompletedAt` once every active video reaches 100 — exactly the gate `ObTrainingScreen` needs. No change required.

---

# 16. Acknowledge kit items

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `ObTrainingScreen.tsx` (onboarding step 5, lower half)
- **Component:** a 4-row `Checkbox` list over `KIT_LIST` — insulated delivery bag, Selorg uniform t-shirt, rider ID card, safety helmet
- **User action:** ticks each item received; all four are required before "Review & Submit" enables
- **Why:** kit issuance is a physical hand-over that operations must be able to audit. Today `actions.toggleObKit(id)` writes only to the reducer, so the acknowledgement is lost on restart and invisible to the hub.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/onboarding/kit-ack` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |
| **Headers** | `Content-Type: application/json` |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `items` | `string[]` | Yes | Non-empty; each value ∈ `["bag","tshirt","id","helmet"]`; no duplicates |
| `hubId` | `string` | No | Hub where the kit was collected; defaults to the rider's assigned hub |

```json
{ "items": ["bag", "tshirt", "id", "helmet"], "hubId": "kor" }
```

### Response

`201 Created`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.acknowledged` | `boolean` | Yes | No |
| `data.items` | `string[]` | Yes | No |
| `data.acknowledgedAt` | `string (ISO-8601)` | Yes | No |
| `data.hubId` | `string` | Yes | Yes |
| `data.complete` | `boolean` | Yes | No — true when all required items are acknowledged |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Unknown item code or empty array |
| `401` | auth codes | |
| `409` | `KIT_ALREADY_ACKNOWLEDGED` | Already acknowledged (idempotent re-post may return `200` instead) |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** nothing in the service models rider kit. `PickerDevice` covers HHD hardware (`deviceId`, `type`, `condition`, assign/unassign) — a different concern with a different lifecycle, and its assignment is admin-driven, not rider-acknowledged. There is no collection, route or service function for uniform, bag, ID card or helmet.
- **Proposed endpoint contract:** `POST /picker/onboarding/kit-ack`, storing a `PickerKitAcknowledgement` record (`pickerId`, `items[]`, `hubId`, `acknowledgedAt`) and surfacing `kit.acknowledged` on API 10.
- **Expected request:** `{ items, hubId? }` as above.
- **Expected response:** the acknowledgement record.
- **Expected errors:** `400`, `401`, `409`.

---

# 17. Submit onboarding application

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `ObReviewScreen.tsx`
- **Component:** `PrimaryButton` "Submit Application"
- **User action:** reviews name / email / phone / vehicle / hub / documents and submits
- **Why:** transitions the rider into review and unlocks `PendingScreen`. Today `actions.submitOnboard()` sets `accountStatus: 'pending'` in the reducer only — the backend never learns an application was submitted.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/onboarding/submit` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |
| **Headers** | `Content-Type: application/json`, optional `Idempotency-Key` |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `acceptedTermsVersion` | `string` | No | Version string of the Terms accepted at signup |
| `acceptedPrivacyVersion` | `string` | No | |

The submission takes its content from what is already persisted (profile, vehicle, hub, documents,
training, kit). The body carries only the consent record, so the client cannot submit an application
that disagrees with stored state.

### Response

`201 Created`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.applicationId` | `string` | Yes | No |
| `data.status` | `"under_review"` | Yes | No |
| `data.submittedAt` | `string (ISO-8601)` | Yes | No |
| `data.estimatedReviewHours` | `number` | No | Yes — backs the "usually takes a few hours" copy |

### Error Responses

| Status | `appCode` | Meaning | Frontend handling |
| --- | --- | --- | --- |
| `400` | `ONBOARDING_INCOMPLETE` | One or more steps unfinished; `error.details` lists `[{ step, reason }]` | route back to the first incomplete step |
| `401` | auth codes | | |
| `409` | `ALREADY_SUBMITTED` | An application is already under review | go straight to `Pending` |
| `409` | `ALREADY_APPROVED` | Rider is already active | go straight to `Main` |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** there is no submit route. `PickerUser.status` defaults to `PENDING` at creation, so a rider who has typed nothing is indistinguishable from one who has completed all five steps. Approval exists only on the admin side (`PUT /admin/picker/pickers/:id/approve` → `status: 'ACTIVE'`), with no corresponding rider-initiated submission and no submission timestamp for the review queue to sort by.
- **Proposed endpoint contract:** validate all five steps server-side, create the onboarding-application record (gap D7) with a generated `applicationId`, stamp `submittedAt`, and place the rider in the admin review queue.
- **Expected request:** optional consent versions.
- **Expected response:** `{ applicationId, status, submittedAt, estimatedReviewHours }`.
- **Expected errors:** `400 ONBOARDING_INCOMPLETE` with per-step detail, plus the two `409` conflicts.

---

# 18. List available shifts

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend pages:** `src/screens/profile/ShiftsScreen.tsx` ("My Shifts"), `ShiftSelectSheet` (Home go-online sheet)
- **Component:** `SlotCard` — time range, pay line, Book/Booked toggle; `RadioDot` rows in the sheet
- **User action:** opens Book More Slots, or flips the online toggle
- **Why:** riders can only work booked slots. Service client: `riderApi.getShifts()`. Currently served by the `SLOTS` mock (4 slots, `s1` pre-booked).

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/shifts/available` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider |

**Query params**

| Param | Type | Required | Validation |
| --- | --- | --- | --- |
| `warehouseKey` | `string` | No | Existing filter; should default to the rider's assigned hub |
| `date` | `string (YYYY-MM-DD)` | No — **new** | Defaults to today. `ShiftsScreen` renders "Today · Tue, 13 Feb". |
| `dateFrom` / `dateTo` | `string (YYYY-MM-DD)` | No — **new** | For a multi-day picker |

### Response

`200 OK` — array in `data`.

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data[].id` | `string` | Yes | No | Shift id used by API 19 |
| `data[].label` | `string` | Yes | No | "Morning", "Midday" — from `PickerShift.name` |
| `data[].date` | `string (YYYY-MM-DD)` | Yes | No | |
| `data[].startTime` | `string (HH:mm)` | Yes | No | |
| `data[].endTime` | `string (HH:mm)` | Yes | No | |
| `data[].timeDisplay` | `string` | Yes — **new** | No | `"6:00 AM – 10:00 AM"` — exactly what `SlotCard` renders |
| `data[].payDisplay` | `string` | Yes — **new** | No | `"₹120/hr + incentives"` |
| `data[].basePayPerHour` | `number` | Yes | Yes | Raw value for clients that format themselves |
| `data[].hasIncentive` | `boolean` | Yes — **new** | No | |
| `data[].isSurge` | `boolean` | Yes — **new** | No | Drives the "+ surge" suffix |
| `data[].capacity` | `number` | Yes | No | |
| `data[].bookedCount` | `number` | Yes — **new** | No | |
| `data[].remainingSlots` | `number` | Yes — **new** | No | `capacity − bookedCount` |
| `data[].booked` | `boolean` | Yes — **new** | No | **Whether the calling rider has booked this slot** |
| `data[].status` | `"open" \| "full" \| "closed" \| "started" \| "completed"` | Yes | No | Lowercase; mapped from `PickerShift.status` + capacity |
| `data[].hubId` / `data[].hubName` | `string` | Yes | Yes | |

```json
{
  "success": true,
  "data": [
    { "id": "66f1...a1", "label": "Morning", "date": "2026-09-04",
      "startTime": "06:00", "endTime": "10:00",
      "timeDisplay": "6:00 AM – 10:00 AM", "payDisplay": "₹120/hr + incentives",
      "basePayPerHour": 120, "hasIncentive": true, "isSurge": false,
      "capacity": 12, "bookedCount": 9, "remainingSlots": 3,
      "booked": true, "status": "open",
      "hubId": "kor", "hubName": "Koramangala Darkstore" }
  ],
  "error": null
}
```

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Malformed date |
| `401` | auth codes | |

### Existing Backend Comparison

- **Current backend contract:** `GET /picker/shifts/available` → `pickerService.listAvailableShifts(warehouseKey)` → `PickerShift.find({ status: 'SCHEDULED', warehouseKey? }).sort({ startTime: 1 })`, returning raw documents: `{ _id, id?, name, warehouseKey, site, siteId, startTime, endTime, time, duration, capacity, breakDuration, status, orders, basePay, color, locationType }`.
- **Frontend expected contract:** the DTO above (`ShiftSlot { id, time, label, pay, booked }` plus capacity info).
- **Exact mismatches:**
  1. **No `booked` flag.** The single most important field for this screen — `SlotCard` and `ShiftSelectSheet` both key off it — and it cannot be derived from `PickerShift` alone. It needs a left join to `PickerShiftAssignment` for `req.pickerId`. The frontend currently falls back to a static `booked` value baked into the `SLOTS` mock.
  2. **No formatted display strings.** `basePay` is a bare number with no currency, no "/hr" and no incentive/surge text; `PickerShift` has both `startTime`/`endTime` and a free-text `time`, with nothing guaranteeing they agree.
  3. **No booked count or remaining capacity.** `capacity` exists but nothing counts assignments, so a full slot cannot be disabled.
  4. **No date filter.** The query filters only on `status: 'SCHEDULED'`, so shifts from previous days are returned forever, and `PickerShift` has no `date` field at all — only `startTime`/`endTime` strings.
  5. **Enum casing.** `SCHEDULED | ACTIVE | COMPLETED | CANCELLED` versus the frontend's lowercase vocabulary.
  6. **Ambiguous id.** `PickerShift` has both `_id` and an optional string `id`; `selectShift` looks up by `_id`. The API must expose exactly one id and use it consistently.
- **Required change:** add a `date` field to `PickerShift` (or derive it), aggregate the per-rider booking join and the booked count, emit display strings, and map the status enum.

---

# 19. Book a shift

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `ShiftsScreen.tsx`
- **Component:** `SlotCard` Book button
- **User action:** taps Book on an open slot
- **Why:** reserves the slot. Service client: `riderApi.bookShift(id, true)`.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/shifts/select` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only — `userId` comes from the token) |
| **Headers** | `Content-Type: application/json` |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `shiftId` | `string` | Yes | Must reference an existing, open, future shift |

### Response

`201 Created` — returns the **updated slot** in the API 18 shape so the list can be patched in place.

| Field | Type | Required |
| --- | --- | --- |
| `data.assignmentId` | `string` | Yes |
| `data.shift` | `ShiftSlot` (API 18 item) | Yes — with `booked: true` and a decremented `remainingSlots` |

### Error Responses

| Status | `appCode` | Meaning | Frontend handling |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Missing `shiftId` | |
| `401` | auth codes | | |
| `404` | `SHIFT_NOT_FOUND` | Unknown shift | refresh the list |
| `409` | `SHIFT_FULL` | `bookedCount >= capacity` | show "Slot full", refresh |
| `409` | `ALREADY_BOOKED` | Rider already holds this slot | treat as success (idempotent) |
| `409` | `SHIFT_OVERLAP` | Overlaps another booked slot; `error.details` names it | show a conflict message |
| `409` | `SHIFT_CLOSED` | Booking window closed or the shift has started | refresh |
| `403` | `ONBOARDING_INCOMPLETE` | Rider is not yet `active` | route to onboarding |

### Existing Backend Comparison

- **Current backend contract:** `POST /picker/shifts/select` → `pickerService.selectShift(userId, shiftId)`. It looks up the shift, 404s if absent, then unconditionally creates a `PickerShiftAssignment` with `{ userId, shiftId, date: new Date(), warehouseKey, status: 'ASSIGNED' }` and returns the raw assignment with `201`.
- **Frontend expected contract:** the updated slot, plus the guard errors above.
- **Exact mismatches:**
  1. **No capacity check.** `PickerShift.capacity` is never compared to the number of existing assignments, so a slot can be over-booked without limit.
  2. **No duplicate check.** Tapping Book twice creates two assignments for the same rider and shift; the booked count then double-counts.
  3. **No overlap check.** A rider can hold two shifts covering the same hours.
  4. **`date` is always today.** `date: new Date()` ignores the shift's own date, so tomorrow's booking is recorded as today's and `getMyShifts` (which sorts by `date`) is wrong.
  5. **No eligibility check.** A `PENDING` or `REJECTED` picker can book shifts.
  6. **Response shape.** Returns a raw assignment; the frontend needs the slot back so `SlotCard` can flip to "Booked" without a refetch.
- **Required change:** add the four guards, use the shift's date, gate on `status === 'ACTIVE'`, and return the API 18 slot DTO.

---

# 20. Unbook a shift

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `ShiftsScreen.tsx`
- **Component:** `SlotCard` — the same control, in its "Booked" state
- **User action:** taps a booked slot to release it (`actions.toggleBooked` toggles both ways)
- **Why:** `riderApi.bookShift` carries the comment *"The service has no picker-facing 'unbook' endpoint; cancellation handled server-side"* and silently no-ops on `booked: false`, so the UI shows a state change that never reaches the server.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/shifts/deselect` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider — may cancel **only their own** assignment |
| **Headers** | `Content-Type: application/json` |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `shiftId` | `string` | Yes | Must be a shift the caller currently holds |
| `reason` | `string` | No | ≤ 200 chars, for the ops audit trail |

### Response

`200 OK`

| Field | Type | Required |
| --- | --- | --- |
| `data.cancelled` | `boolean` | Yes |
| `data.shift` | `ShiftSlot` (API 18 item) | Yes — with `booked: false` and an incremented `remainingSlots` |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `401` | auth codes | |
| `404` | `ASSIGNMENT_NOT_FOUND` | The rider does not hold this shift |
| `409` | `SHIFT_ALREADY_STARTED` | Assignment status is `STARTED` or `COMPLETED` |
| `409` | `CANCELLATION_WINDOW_CLOSED` | Inside the no-cancellation window before start |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** `picker.routes.ts` has no deselect/cancel route. `POST /api/v1/rider/shifts/cancel` exists but is unusable here for three independent reasons: it has **no authentication middleware at all**; it takes `riderId` from the request body, so any caller can cancel anyone's shift (gap A2); and it operates on `RiderShiftAssignment` / `RiderShift`, a **different pair of collections** from the `PickerShiftAssignment` / `PickerShift` models that `selectShift` writes to. Calling it would cancel nothing the picker app created.
- **Proposed endpoint contract:** `POST /picker/shifts/deselect`, authenticated, resolving the assignment by `(req.pickerId, shiftId)` and setting `status: 'CANCELLED'` with `cancelledAt` (both already exist on `PickerShiftAssignment`).
- **Expected request:** `{ shiftId, reason? }`.
- **Expected response:** the updated slot.
- **Expected errors:** `404`, plus the two `409` conflicts.

---

# 21. List my shifts

### Status

`EXISTING`

### Frontend Usage

- **Frontend pages:** `ShiftsScreen.tsx` ("N slots booked"), `HomeScreen.tsx` (the shift chip showing the active window)
- **Component:** the subtitle line and `ClockMiniIcon` chip
- **User action:** opens Home or Shifts
- **Why:** shows what the rider has committed to. Currently derived from the `SLOTS` mock via `bookedCount` / `activeShiftLabel`.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/shifts/my` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |

### Response

`200 OK` — array in `data`.

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data[]._id` | `string` | Yes | No — assignment id |
| `data[].status` | `"ASSIGNED" \| "STARTED" \| "COMPLETED" \| "CANCELLED" \| "NO_SHOW"` | Yes | No |
| `data[].date` | `string (ISO-8601)` | Yes | No |
| `data[].warehouseKey` | `string` | No | Yes |
| `data[].startedAt` / `data[].completedAt` | `string (ISO-8601)` | No | Yes |
| `data[].shiftId` | `object` | Yes | No — populated `PickerShift` |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `401` | auth codes | |

### Existing Backend Comparison

- **Existing endpoint:** `GET /api/v1/picker/shifts/my` → `pickerService.getMyShifts` → `PickerShiftAssignment.find({ userId, status: { $in: ['ASSIGNED','STARTED'] } }).populate('shiftId').sort({ date: 1 })`.
- **Why it is compatible:** scoped to the token subject, populated with the shift so the time window is available for the Home chip, and filtered to live assignments — which is what both consumers need. Two follow-ups worth noting but not blocking: the status enum is `SCREAMING_CASE` while the rest of the new contract is lowercase, and `date` is unreliable until API 19's date bug is fixed.

---

# 22. Start shift (go online)

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `HomeScreen.tsx` → `ShiftSelectSheet`
- **Component:** `ToggleSwitch` (size `lg`) with the Online/Offline label; the sheet's "Start Working" button
- **User action:** flips the toggle on, picks a slot, taps Start Working
- **Why:** the single gate for receiving orders. `actions.startShift()` currently only sets `isOnline: true` and `activeShiftId` in the reducer.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/shifts/start` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |
| **Headers** | `Content-Type: application/json` |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `shiftId` | `string` | Yes — **must now be accepted in the body** | A shift the rider holds with assignment status `ASSIGNED` |
| `location.latitude` | `number` | No | Geofence check against the hub |
| `location.longitude` | `number` | No | |

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.assignmentId` | `string` | Yes | No |
| `data.shiftId` | `string` | Yes | No |
| `data.status` | `"started"` | Yes | No |
| `data.startedAt` | `string (ISO-8601)` | Yes | No |
| `data.isOnline` | `boolean` | Yes — **new** | No |
| `data.shift.timeDisplay` | `string` | Yes — **new** | No | Backs the Home chip without a second call |

### Error Responses

| Status | `appCode` | Meaning | Frontend handling |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Missing `shiftId` | |
| `401` | auth codes | | |
| `404` | `ASSIGNMENT_NOT_FOUND` | No `ASSIGNED` assignment for this rider and shift | revert the toggle, prompt to book |
| `409` | `SHIFT_ALREADY_STARTED` | Already online on this shift | treat as success |
| `409` | `ANOTHER_SHIFT_ACTIVE` | Another shift is already `STARTED` | prompt to end it first |
| `403` | `OUTSIDE_GEOFENCE` | Too far from the hub (if enforced) | show the hub distance |
| `403` | `ONBOARDING_INCOMPLETE` | Rider is not `active` | route to onboarding |

### Existing Backend Comparison

- **Current backend contract:** two routes map to the same handler —
  `POST /shifts/start` and `POST /shifts/:shiftId/start` — and `picker.controller.startShift` reads
  `req.params.shiftId` in both cases. On the body-form route `req.params.shiftId` is `undefined`, so
  `PickerShiftAssignment.findOne({ userId, shiftId: undefined, status: 'ASSIGNED' })` cannot match and
  the call **always fails with 404**. The frontend's `riderApi` has no start call at all today, so the
  body form is the natural one to fix.
- **Frontend expected contract:** the request and response above.
- **Exact mismatches:**
  1. **`shiftId` is not read from the body**, making the body-form route permanently broken.
  2. **No online-presence concept.** `PickerUser` has `onBreak` (which `startShift` does set to `false`) but no `isOnline`, no `onlineSince` and no linkage to dispatch. Nothing distinguishes a rider who is working from one who booked a slot and never showed up.
  3. **No concurrency guard.** Nothing prevents two shifts being `STARTED` at once.
  4. **No geofence check**, despite `PickerWorkLocation.geofenceRadius` existing for exactly this purpose.
  5. **Response shape.** Returns the raw assignment; the Home chip needs the display time window.
- **Required change:** read `shiftId` from the body (keeping the path variant for compatibility), add `isOnline`/`onlineSince` to `PickerUser`, add the concurrency guard, and optionally enforce the geofence.

---

# 23. End shift (go offline)

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `HomeScreen.tsx`
- **Component:** the same `ToggleSwitch`, flipped off (`actions.goOffline`)
- **User action:** ends the working session
- **Why:** stops order assignment and closes the attendance record. Today it only clears `isOnline` and `activeShiftId` in the reducer.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/shifts/end` |
| **Authentication** | Bearer picker JWT |
| **Headers** | `Content-Type: application/json` |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `shiftId` | `string` | Yes — **must now be accepted in the body** | A shift with assignment status `STARTED` |
| `location.latitude` / `location.longitude` | `number` | No | |

### Response

`200 OK`

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data.assignmentId` | `string` | Yes | No | |
| `data.status` | `"completed"` | Yes | No | |
| `data.completedAt` | `string (ISO-8601)` | Yes | No | |
| `data.isOnline` | `boolean` | Yes — **new** | No | Always `false` |
| `data.summary.workedMinutes` | `number` | Yes — **new** | No | |
| `data.summary.ordersDelivered` | `number` | Yes — **new** | No | |
| `data.summary.earnings` | `number` | Yes — **new** | No | |
| `data.summary.cashInHand` | `number` | Yes — **new** | No | Drives the "deposit before end of shift" prompt |
| `data.warnings[]` | `string[]` | No — **new** | No | e.g. `"UNDEPOSITED_CASH"` |

### Error Responses

| Status | `appCode` | Meaning | Frontend handling |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Missing `shiftId` | |
| `401` | auth codes | | |
| `404` | `SHIFT_NOT_STARTED` | No `STARTED` assignment | revert the toggle |
| `409` | `ACTIVE_ORDER_IN_PROGRESS` | An order or bulk batch is still open | block going offline, deep-link to the order |
| `409` | `UNDEPOSITED_CASH` | Cash in hand exceeds the allowed carry-over | warn and route to Deposit |

### Existing Backend Comparison

- **Current backend contract:** `picker.controller.endShift` mirrors `startShift` and reads `req.params.shiftId`, so `POST /shifts/end` is broken in exactly the same way. `pickerService.endShift` sets `status: 'COMPLETED'` and `completedAt`, and returns the raw assignment.
- **Frontend expected contract:** the request and response above.
- **Exact mismatches:** the same `shiftId` source bug; no `isOnline` reset; **no guard against going offline mid-delivery**, which would strand an accepted order; no end-of-shift summary; and no cash-deposit check even though `FloatCashScreen` states "Deposit before end of shift" as a rule.
- **Required change:** read `shiftId` from the body, clear `isOnline`, add the two `409` guards, and return the summary block.

---

# 24. Today's dashboard stats

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `HomeScreen.tsx` — "Today's Performance"
- **Component:** a 2×2 `StatCard` grid
- **User action:** opens Home
- **Why:** the app's primary landing metrics. Currently served entirely by the `HOME_PERFORMANCE` mock (`codCollected: '₹1,240'`, `ordersDelivered: '14'`, `onlineHours: '5.2'`, `slotsCompleted: '2'`).

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/dashboard/today` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |

**Query params**

| Param | Type | Required | Validation |
| --- | --- | --- | --- |
| `date` | `string (YYYY-MM-DD)` | No | Defaults to today in the rider's hub timezone (IST) |

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.date` | `string (YYYY-MM-DD)` | Yes | No |
| `data.codCollected` | `number` | Yes | No |
| `data.ordersDelivered` | `number` | Yes | No |
| `data.onlineHours` | `number` | Yes | No — one decimal |
| `data.slotsCompleted` | `number` | Yes | No |
| `data.earnings` | `number` | Yes | No |
| `data.availableOrdersCount` | `number` | Yes | No — backs the Home "N new orders available" badge |
| `data.activeOrderId` | `string` | Yes | Yes — resume hint |
| `data.activeBatchId` | `string` | Yes | Yes — resume hint for bulk |
| `data.isOnline` | `boolean` | Yes | No |
| `data.activeShift.timeDisplay` | `string` | No | Yes |

```json
{
  "success": true,
  "data": {
    "date": "2026-09-04",
    "codCollected": 1240, "ordersDelivered": 14, "onlineHours": 5.2, "slotsCompleted": 2,
    "earnings": 980, "availableOrdersCount": 2,
    "activeOrderId": null, "activeBatchId": "BD-10482",
    "isOnline": true, "activeShift": { "timeDisplay": "6:00 AM – 10:00 AM" }
  },
  "error": null
}
```

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Malformed date |
| `401` | auth codes | |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** the closest endpoint is `GET /picker/performance` (`pickerService.getPerformance`), which is real but aggregates **`PickerAttendance` only** and returns `{ totalShifts, present, absent, totalWorkedMinutes, totalOrdersCompleted, averageOrdersPerShift }` over an optional date range. It supplies at best two of the four tiles (orders and hours), has **no COD figure at all** (no cash ledger exists), no per-day default window, no `slotsCompleted`, no available-order count and no resume hints. `GET /picker/performance/summary` and `/performance/history` are stubs. Building the Home screen out of `/performance` plus three other calls would cost four round trips on the app's most-visited screen.
- **Proposed endpoint contract:** one aggregate for a single day, joining attendance (hours), completed deliveries (orders, earnings), the cash ledger (COD), shift assignments (slots) and the current assignment state (resume hints).
- **Expected request:** optional `date`.
- **Expected response:** the object above.
- **Expected errors:** `400`, `401`.

---

# 25. Today's incentive

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `HomeScreen.tsx` — the purple "DAILY INCENTIVE" gradient card
- **Component:** target title, earned pill, `ProgressBar`, footnote
- **User action:** opens Home
- **Why:** the primary motivational surface. Currently mocked as `incentiveTarget: 'Complete 20 orders'`, `incentiveEarned: '₹150 earned'`, `incentiveProgressPct: 70`, `incentiveProgressLabel: '14/20 Orders'`, `incentiveFootnote: 'Delivered on time: 13, late: 1'`.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/incentives/today` |
| **Authentication** | Bearer picker JWT |
| **Query params** | `date` (`YYYY-MM-DD`, optional) |

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.hasIncentive` | `boolean` | Yes | No — when `false` the card is hidden |
| `data.title` | `string` | Yes | Yes — "Complete 20 orders" |
| `data.targetValue` | `number` | Yes | Yes |
| `data.currentValue` | `number` | Yes | Yes |
| `data.unit` | `"orders" \| "deliveries" \| "hours"` | Yes | Yes |
| `data.progressPercent` | `number` | Yes | No — 0–100 |
| `data.progressLabel` | `string` | Yes | Yes — "14/20 Orders" |
| `data.earnedAmount` | `number` | Yes | No |
| `data.rewardAmount` | `number` | Yes | Yes — payable on completion |
| `data.onTimeCount` | `number` | Yes | No |
| `data.lateCount` | `number` | Yes | No |
| `data.footnote` | `string` | Yes | Yes |
| `data.expiresAt` | `string (ISO-8601)` | Yes | Yes |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `401` | auth codes | |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** there is no incentive concept for riders anywhere in the service. Grepping `incentive` matches only `darkstore.models.ts` and the warehouse controller — a different domain (staff/warehouse incentives), with no rider linkage, no per-rider progress and no route reachable by a picker token. `PickerShift.basePay` exists but is a flat hourly rate, not a target-based bonus.
- **Proposed endpoint contract:** an incentive-rule model (target metric, threshold, reward, validity window, hub scope) plus per-rider progress evaluated against today's completed deliveries and their on-time flags.
- **Expected request:** optional `date`.
- **Expected response:** the object above; `hasIncentive: false` with all other fields `null` when no rule applies, so the client can hide the card without special-casing.
- **Expected errors:** `401` only.
- **Dependency:** requires on-time attribution per delivery (gap L19) — the footnote splits on-time versus late.
---

# 26. List available orders

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `src/screens/orders/OrdersScreen.tsx` ("Live Orders")
- **Components:** `OrderCard` (available list) and `ActiveOrderCard` (in-progress); `HomeScreen`'s "N new orders available" row
- **User action:** opens the Orders tab, or taps the Home banner
- **Why:** the entry point to the whole standard delivery flow. Service client: `orderApi.listAvailable()` → reads `data.orders`. Currently served by the `ORDERS` mock (2 orders) via `availableOrders(state)`.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/shared-orders/assignorders` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider — the result set is scoped to the caller's hub and eligibility; **no `pickerId` parameter is accepted** |

**Query params**

| Param | Type | Required | Validation |
| --- | --- | --- | --- |
| `scope` | `"available" \| "mine" \| "all"` | No — **new** | Default `"all"`. `OrdersScreen` renders both sections in one pass. |
| `page` | `number` | No — **new** | ≥ 1, default 1 |
| `limit` | `number` | No — **new** | 1–50, default 20 |

### Response

`200 OK` — the list lives **inside `data`** because `orderApi.listAvailable` reads `data.orders`.

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data.orders[].id` | `string` | Yes | No | Order id used by APIs 27–30 |
| `data.orders[].num` | `string` | Yes | No | Display number, `"#SG-2048"` |
| `data.orders[].raw` | `string` | Yes | No | Bare number, `"2048"` — used to build the bag label |
| `data.orders[].payout` | `number` | Yes — **new** | No | Rider earning in ₹ |
| `data.orders[].pickup` | `string` | Yes | No | Store name |
| `data.orders[].bay` | `string` | Yes — **new** | Yes | `"Bay 3 · Rack B"` |
| `data.orders[].deliver` | `string` | Yes | No | Formatted drop address |
| `data.orders[].distanceKm` | `number` | Yes — **new** | Yes | |
| `data.orders[].distance` | `string` | Yes | Yes | `"2.4 km"` |
| `data.orders[].etaMinutes` | `number` | Yes — **new** | Yes | |
| `data.orders[].time` | `string` | Yes | Yes | `"12 min"` |
| `data.orders[].items` | `number` | Yes | No | Item count |
| `data.orders[].priority` | `boolean` | Yes — **new** | No | Drives the Priority badge |
| `data.orders[].paymentMode` | `"cod" \| "prepaid"` | Yes — **new** | No | The rider must know before accepting |
| `data.orders[].codAmount` | `number` | Yes — **new** | Yes | `null` when prepaid |
| `data.orders[].assignedToMe` | `boolean` | Yes — **new** | No | Splits `available` from `active` |
| `data.orders[].riderStage` | `"offered" \| "accepted" \| "picked_up" \| "delivered" \| "cancelled"` | Yes — **new** | No | Drives resume routing |
| `data.orders[].expiresAt` | `string (ISO-8601)` | No — **new** | Yes | Offer expiry |
| `data.total` | `number` | Yes | No | |
| `data.page` / `data.limit` / `data.totalPages` | `number` | Yes — **new** | No | |

```json
{
  "success": true,
  "data": {
    "orders": [
      { "id": "66f2b0...aa", "num": "#SG-2048", "raw": "2048", "payout": 52,
        "pickup": "Selorg Darkstore — Koramangala", "bay": "Bay 3 · Rack B",
        "deliver": "142, 3rd Cross, HSR Layout",
        "distanceKm": 2.4, "distance": "2.4 km", "etaMinutes": 12, "time": "12 min",
        "items": 8, "priority": true, "paymentMode": "cod", "codAmount": 520,
        "assignedToMe": false, "riderStage": "offered",
        "expiresAt": "2026-09-04T10:22:00.000Z" }
    ],
    "total": 2, "page": 1, "limit": 20, "totalPages": 1
  },
  "error": null
}
```

### Error Responses

| Status | `appCode` | Meaning | Frontend handling |
| --- | --- | --- | --- |
| `401` | auth codes | | re-authenticate |
| `403` | `RIDER_OFFLINE` | Rider is not on an active shift | show the offline empty state |
| `403` | `ONBOARDING_INCOMPLETE` | Not yet approved | route to onboarding |

### Existing Backend Comparison

**Current backend contract:** `GET /picker/shared-orders/assignorders` → `picker.controller.getAssignOrders`, a stub:

```ts
res.json(ResponseFormatter.success({ orders: [], total: 0 }));
```

**Frontend expected contract:** the payload above.

**Exact mismatches**

1. **No implementation.** The handler never touches the database. The envelope key `orders` happens to match what `orderApi` reads, so the app renders a permanent empty state rather than an error.
2. **`payout` does not exist.** No per-order rider earning is stored anywhere. `dispatch.service` holds `RIDER_EARNING_BASE_INR = 25` and `RIDER_EARNING_PER_KM_INR = 8`, used only to compute admin cluster metrics on the fly and never persisted.
3. **`bay` does not exist.** No dispatch bay or rack field on `Order`. The nearest concept is HHD's rack scanning, in a separate model and auth domain.
4. **`distance` / `time` do not exist.** `dispatch.service.calculateDistance` is admin-only and, when coordinates are missing, **falls back to a character-sum hash of the address string** — acceptable for clustering heuristics, unacceptable as a rider-facing figure.
5. **`priority` does not exist.** `dispatch.service.calculatePriority` derives `high|medium|low` from `slaDeadline` at request time; nothing is stored on the order.
6. **No assignment concept.** `Order.riderId` is an unindexed `string \| null` with no `assignedAt`, no offer expiry, and no relation to `PickerUser._id`. The `assignorders` collection that HHD reads directly (`mongoose.connection.collection('assignorders')`) is a separate, schema-less collection used by the in-store picking app — not the last-mile assignment model.
7. **No pagination and no scope filter**, though `OrdersScreen` needs both the available list and the caller's active order.

**Required change:** implement the query against `Order` filtered by hub, status and rider eligibility; add `riderPayout`, `dispatchBay`, `distanceKm`, `etaMinutes` and `priority` at assignment time; index `riderId`; and add the `scope` and pagination parameters.

---

# 27. Get order detail (bag manifest)

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `src/screens/delivery/BagScreen.tsx` ("Verify & Collect")
- **Components:** the bag banner (`Bag SG-2048-A`, `N/M` counter) and a per-item `Checkbox` list
- **User action:** at the darkstore, ticks each item before confirming pickup
- **Why:** item verification prevents mis-picks. Service client: `orderApi.getBagItems(orderId)` → reads `data.items`. Currently served by the `ORDER_ITEMS` mock (4 fixed items for every order).

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/shared-orders/:orderId` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider — **must be the order's assigned rider**; otherwise `403` |
| **Path params** | `orderId` (`string`, required, 24-char hex) |

### Response

`200 OK`

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data.id` | `string` | Yes | No | |
| `data.num` | `string` | Yes | No | `"#SG-2048"` |
| `data.raw` | `string` | Yes | No | `"2048"` |
| `data.riderStage` | `string` | Yes | No | Resume hint |
| `data.status` | `string` | Yes | No | Underlying order status |
| `data.bagCode` | `string` | Yes — **new** | Yes | `"SG-2048-A"` |
| `data.bay` | `string` | Yes — **new** | Yes | `"Bay 3 · Rack B"` |
| `data.items[]` | `array` | Yes | No | **Read by `orderApi.getBagItems`** |
| `data.items[].id` | `string` | Yes | No | |
| `data.items[].name` | `string` | Yes | No | From `Order.items[].productName` |
| `data.items[].qty` | `string` | Yes | No | Display quantity, `"2 bunches"` — composed from `quantity` + `variantSize` |
| `data.items[].quantity` | `number` | Yes | No | Raw count |
| `data.items[].image` | `string` | No | Yes | |
| `data.items[].itemStatus` | `"pending" \| "picked" \| "not_found" \| "damaged" \| "substituted" \| "delivered"` | Yes | No | Existing enum |
| `data.pickup.name` | `string` | Yes | No | |
| `data.pickup.address` | `string` | Yes | Yes | |
| `data.pickup.latitude` / `longitude` | `number` | Yes | Yes | Needed for navigation |
| `data.customer.name` | `string` | Yes | No | |
| `data.customer.maskedPhone` | `string` | Yes — **new** | Yes | Never the raw number |
| `data.delivery.address` | `string` | Yes | No | |
| `data.delivery.landmark` | `string` | No | Yes | |
| `data.delivery.latitude` / `longitude` | `number` | Yes | Yes | |
| `data.payout` | `number` | Yes — **new** | No | |
| `data.paymentMode` | `"cod" \| "prepaid"` | Yes — **new** | No | |
| `data.codAmount` | `number` | Yes — **new** | Yes | |
| `data.distanceKm` / `data.etaMinutes` | `number` | Yes — **new** | Yes | |

### Error Responses

| Status | `appCode` | Meaning | Frontend handling |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Malformed `orderId` | |
| `401` | auth codes | | |
| `403` | `NOT_ASSIGNED_TO_RIDER` | The caller is not this order's rider | return to Orders |
| `404` | `ORDER_NOT_FOUND` | | refresh the list |

### Existing Backend Comparison

**Current backend contract:** `getSharedOrder` is a stub returning `{ orderId: req.params.orderId }`.

**Frontend expected contract:** the document above; `orderApi.getBagItems` specifically reads `data.items` and returns `[]` when absent, so the screen currently shows an empty bag.

**Exact mismatches**

1. **No implementation** — nothing is read from the database.
2. **No `items`.** `Order.items[]` exists with `productName`, `quantity`, `variantSize`, `image` and `itemStatus`, so the mapping is straightforward, but no code performs it.
3. **No `bagCode`.** The UI renders `Bag SG-{raw}-A`, a value it invents client-side. No bag entity exists on `Order` (gap D2).
4. **No `bay`.** Same gap as API 26.
5. **No customer contact.** `NavScreen` shows Call and Chat buttons; there is no masked phone and no call-masking service.
6. **No ownership check.** As written, any authenticated picker could fetch any order id — an IDOR once the handler is implemented (gap L3).
7. **No coordinates surfaced.** `Order.deliveryAddress` carries `latitude`/`longitude`, but the stub returns nothing, so navigation has no destination.

**Required change:** implement the read with an ownership guard, project the item manifest, and add `bagCode` and `bay`.

---

# 28. Update order status (accept / pickup / cancel)

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend pages:** `OrdersScreen` (Accept), `BagScreen` (Confirm Pickup), `NavScreen` → `CancelOrderSheet` (Cancel order)
- **Components:** `OrderCard` Accept button, `PrimaryButton` "Confirm Pickup", the cancel sheet's 6-reason `RadioRow` list plus a note field
- **User action:** accepts an offered order; confirms pickup after ticking every item; or cancels with a reason
- **Why:** the single transition endpoint for the standard flow. Service clients: `orderApi.accept`, `orderApi.confirmPickup`, `orderApi.cancel`.

### Request

| | |
| --- | --- |
| **Method** | `PUT` |
| **Endpoint** | `/api/v1/picker/shared-orders/:orderId/status` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider — `accepted` requires the order to be unassigned or offered to the caller; `picked_up` and `cancelled` require the caller to be the assigned rider |
| **Headers** | `Content-Type: application/json`, optional `Idempotency-Key` |
| **Path params** | `orderId` (`string`, required) |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `status` | `"accepted" \| "picked_up" \| "cancelled"` | Yes | Must be a legal transition from the current stage |
| `reason` | `"unreachable" \| "refused" \| "address" \| "asked" \| "vehicle" \| "other"` | Conditional | **Required when `status === "cancelled"`** — matches `CANCEL_REASONS` exactly |
| `note` | `string` | Conditional | **Required when `reason === "other"`** (the frontend enforces this); ≤ 500 chars |
| `location.latitude` / `longitude` | `number` | No | Where the transition happened |
| `itemsVerified` | `boolean` | No | Sent with `picked_up`; the UI blocks the button until every item is ticked |

```json
{ "status": "cancelled", "reason": "unreachable", "note": "", "location": { "latitude": 12.93, "longitude": 77.62 } }
```

**Allowed transitions**

| From | To | Guard |
| --- | --- | --- |
| `offered` | `accepted` | Unassigned or offered to the caller; atomic claim |
| `accepted` | `picked_up` | Caller is the assigned rider; all items verified |
| `accepted` \| `picked_up` | `cancelled` | Caller is the assigned rider; reason supplied |
| `picked_up` | `delivered` | **Not via this endpoint — use API 30** |

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.id` | `string` | Yes | No |
| `data.riderStage` | `"accepted" \| "picked_up" \| "cancelled"` | Yes | No |
| `data.status` | `string` | Yes | No — the underlying order status |
| `data.updatedAt` | `string (ISO-8601)` | Yes | No |
| `data.cancellation.reason` | `string` | No | Yes |
| `data.cancellation.note` | `string` | No | Yes |
| `data.cancellation.reassigned` | `boolean` | No | Yes — the sheet says the order "has been returned to the hub for reassignment" |

### Error Responses

| Status | `appCode` | Meaning | Frontend handling |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Unknown status, or missing reason/note | inline error |
| `401` | auth codes | | |
| `403` | `NOT_ASSIGNED_TO_RIDER` | Not the caller's order | return to Orders |
| `404` | `ORDER_NOT_FOUND` | | refresh |
| `409` | `ORDER_ALREADY_ASSIGNED` | Another rider claimed it first | "Order no longer available", refresh |
| `409` | `INVALID_TRANSITION` | e.g. `picked_up` before `accepted` | resync from API 26 |
| `409` | `ITEMS_NOT_VERIFIED` | Pickup attempted without full verification | return to Bag |
| `409` | `CANCELLATION_NOT_ALLOWED` | Past the point where cancelling is permitted | direct to support |

### Existing Backend Comparison

**Current backend contract:** `updateSharedOrderStatus` is a stub that echoes the input:

```ts
res.json(ResponseFormatter.success({ orderId: req.params.orderId, status: req.body.status }));
```

**Frontend expected contract:** the transition semantics above.

**Exact mismatches**

1. **Nothing is persisted.** The frontend treats a 200 as confirmation and advances its flow, so the app and the database diverge immediately and permanently.
2. **Enum incompatibility.** `Order.status` is `pending | confirmed | getting-packed | on-the-way | arrived | delivered | cancelled`. The frontend sends `accepted` and `picked_up`, **neither of which exists**. The Zod schema on the admin transition route (`updateOrderStatusSchema`) enumerates only `confirmed | getting-packed | on-the-way | arrived | delivered | cancelled` — the same gap.
3. **No ownership check** (gap L3) and **no atomic claim** (gap L4): two riders accepting the same order both receive 200.
4. **No state machine.** Nothing prevents `picked_up` before `accepted`, or a second `accepted` on a delivered order.
5. **Cancel reason is not modelled.** `Order.cancellationReason` is a free-form string with no enum; the frontend's six ids would be stored as opaque text, unusable for reporting. Nothing re-queues the order for reassignment, and nothing applies the rating consequence the sheet warns about ("Frequent cancellations may affect your rating").
6. **A real transition service exists but is unreachable.** `ordersService.updateCustomerOrderStatus` is invoked from `PUT /api/v1/customer/orders/:id/update-status`, which is `authenticateAdmin`-guarded. A picker token would in fact pass that middleware today (gap A1) — a bug, not a design, and the Zod enum still rejects the rider states.

**Required change:** add a `riderStage` field (or extend the status enum), implement the guarded state machine with an atomic `findOneAndUpdate` claim, enumerate `cancellationReason`, re-queue cancelled orders, and honour `Idempotency-Key`.

---

# 29. Upload proof-of-delivery photo

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `src/screens/delivery/PhotoScreen.tsx` ("Proof of Delivery")
- **Component:** the tap-to-capture box that switches to "Photo captured / Tap to retake"
- **User action:** photographs the package at the door
- **Why:** proof of delivery is the evidence trail for disputes and COD reconciliation. The frontend currently sends only a boolean (`orderApi.confirmDelivery(orderId, otp, photo: boolean)`), and `actions.togglePhoto()` merely flips a flag — no image is captured or transmitted, so there is no proof at all.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/shared-orders/:orderId/proof-photo` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider — must be the assigned rider, and the order must be `picked_up` |
| **Headers** | `Content-Type: multipart/form-data` |
| **Path params** | `orderId` (`string`, required) |

**Form fields**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `photo` | binary | Yes | `image/jpeg` or `image/png`; ≤ 10 MB |
| `capturedAt` | `string (ISO-8601)` | No | Client capture time |
| `latitude` / `longitude` | `number` | No | Geotag for the audit trail |

### Response

`201 Created`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.photoId` | `string` | Yes | No — passed to API 30 |
| `data.url` | `string` | Yes | No |
| `data.orderId` | `string` | Yes | No |
| `data.uploadedAt` | `string (ISO-8601)` | Yes | No |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | No file supplied |
| `401` | auth codes | |
| `403` | `NOT_ASSIGNED_TO_RIDER` | |
| `404` | `ORDER_NOT_FOUND` | |
| `409` | `INVALID_ORDER_STAGE` | Order is not `picked_up` |
| `413` | `FILE_TOO_LARGE` | Over 10 MB |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Not an image |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** no picker route accepts a file. `POST /picker/devices/upload-condition-photo` exists but is a stub returning `{ uploaded: true, url: null }` and is about device condition, not delivery. `POST /hhd/photos` is a real multipart endpoint (multer, disk storage, image-only, 10 MB) but sits behind the HHD `protect` middleware in a separate auth domain and writes to HHD models. The `Order` schema has no proof-of-delivery field of any kind.
- **Proposed endpoint contract:** mirror the HHD multer configuration, store the file through the same storage abstraction, create a POD record linked to the order and the rider, and return a `photoId` that API 30 requires.
- **Expected request:** multipart with `photo` plus optional geotag.
- **Expected response:** `{ photoId, url, orderId, uploadedAt }`.
- **Expected errors:** as above.
- **Related:** API 36 is the bulk-stop equivalent.

---

# 30. Complete delivery (OTP)

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `src/screens/delivery/PhotoScreen.tsx`
- **Components:** `OtpInput` ("Customer delivery OTP") + `PrimaryButton` "Confirm Delivery"; on failure the inline `otpError` text
- **User action:** enters the customer's 4-digit code and confirms
- **Why:** **the only frontend screen that actually calls the API today** (`PhotoScreen.tsx:30`). It branches on `result.ok`: success routes to `CompleteScreen`; failure shows `result.error || 'Incorrect OTP. Please try again.'`.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/shared-orders/:orderId/complete` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider — must be the assigned rider, order must be `picked_up` |
| **Headers** | `Content-Type: application/json`, optional `Idempotency-Key` |
| **Path params** | `orderId` (`string`, required) |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `otp` | `string` | Yes | Exactly 4 numeric digits; compared against `Order.deliveryOtp` |
| `photoId` | `string` | Yes — **replaces the current `photo: boolean`** | Must be a POD photo from API 29 for this order |
| `codCollected` | `number` | Conditional — **new** | Required when `paymentMode === "cod"`; must equal `codAmount` |
| `location.latitude` / `longitude` | `number` | No | |

```json
{ "otp": "1234", "photoId": "66f3c1...bb", "codCollected": 520 }
```

> **Transitional compatibility.** The frontend currently sends `{ otp, photo: true }`. The backend
> should accept `photo: boolean` for one release, treating it as "no verifiable proof", while the app
> is updated to upload a real image and send `photoId`.

### Response

`200 OK`

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data.orderId` | `string` | Yes | No | |
| `data.completed` | `boolean` | Yes | No | |
| `data.deliveredAt` | `string (ISO-8601)` | Yes | No | |
| `data.summary.payout` | `number` | Yes — **new** | No | `CompleteScreen` "You earned ₹52" |
| `data.summary.tripMinutes` | `number` | Yes — **new** | Yes | "11 min · Trip time" |
| `data.summary.distanceKm` | `number` | Yes — **new** | Yes | |
| `data.summary.tripsToday` | `number` | Yes — **new** | No | "15 · Today's trips" |
| `data.cash.collected` | `number` | Yes — **new** | Yes | |
| `data.cash.cashInHand` | `number` | Yes — **new** | No | Updated float after this collection |
| `data.paymentStatus` | `"paid" \| "cod_pending"` | Yes | No | |

```json
{
  "success": true,
  "data": {
    "orderId": "66f2b0...aa", "completed": true, "deliveredAt": "2026-09-04T11:42:00.000Z",
    "summary": { "payout": 52, "tripMinutes": 11, "distanceKm": 2.4, "tripsToday": 15 },
    "cash": { "collected": 520, "cashInHand": 1360 },
    "paymentStatus": "paid"
  },
  "error": null
}
```

### Error Responses

| Status | `appCode` | Meaning | Frontend handling |
| --- | --- | --- | --- |
| `400` | `INCORRECT_OTP` | OTP does not match | inline "Incorrect OTP. Please try again." |
| `400` | `VALIDATION_ERROR` | Missing `otp` or `photoId` | inline |
| `401` | auth codes | | |
| `403` | `NOT_ASSIGNED_TO_RIDER` | | back to Orders |
| `404` | `ORDER_NOT_FOUND` | | |
| `409` | `INVALID_ORDER_STAGE` | Not `picked_up` | resync |
| `409` | `ALREADY_DELIVERED` | Idempotent replay | treat as success |
| `409` | `COD_AMOUNT_MISMATCH` | `codCollected ≠ codAmount` | show the expected amount |
| `429` | `OTP_ATTEMPTS_EXCEEDED` | More than 5 attempts | lock the field, direct to support |

### Existing Backend Comparison

**Current backend contract:** `completeSharedOrder` is a stub:

```ts
res.json(ResponseFormatter.success({ orderId: req.params.orderId, completed: true }));
```

**Frontend expected contract:** the OTP-verified completion above.

**Exact mismatches**

1. **The OTP is never checked.** Every call returns `completed: true`, so `result.ok` is always true and the "Incorrect OTP" branch in `PhotoScreen` is dead code. Any authenticated picker can mark any order delivered by posting any four digits. This is the most severe defect in the integration.
2. **Nothing is persisted.** `status`, `deliveredAt`, `otpVerified` and the timeline are untouched.
3. **No COD settlement.** `paymentStatus` stays `cod_pending`, and the collected cash is recorded nowhere.
4. **No attempt cap.** Unlimited guesses against a 4-digit code — 10,000 combinations, trivially brute-forced.
5. **No proof requirement.** `photo` is a boolean the server ignores.
6. **No completion summary**, so `CompleteScreen` renders hard-coded values ("11 min", "15 trips").

**Reference implementation already in the codebase:** `order.controller.verifyOtp` (customer path) does all of this correctly — increments `otpAttempts`, returns `429` past 5, compares `deliveryOtp`, sets `status: 'delivered'` and `deliveredAt`, flips `paymentStatus` from `cod_pending` to `paid`, and appends a timeline entry with `actor: 'rider'`. It is unusable here only because it is gated by `authenticateCustomer` and scoped by `Order.findOne({ _id, userId })` to the customer's own order.

**Required change:** port that logic behind `authenticatePicker` with rider ownership instead of customer ownership, require a POD `photoId`, credit the COD ledger (API 46), and return the completion summary.

---

# 31. Track rider location

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend pages:** `TravelScreen.tsx`, `NavScreen.tsx`, `BulkActiveScreen.tsx` (all render `MapPlaceholder`)
- **Component:** background location updates while online; the Settings "Location sharing" toggle governs it
- **User action:** none — periodic while on an active delivery
- **Why:** customer live tracking, dispatch decisions, and the audit trail the Privacy Policy describes ("Location is tracked only while you are online and on an active delivery")

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/locations/track` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |
| **Headers** | `Content-Type: application/json` |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `latitude` | `number` | Yes | −90…90 |
| `longitude` | `number` | Yes | −180…180 |
| `accuracy` | `number` | No | Metres |
| `speed` | `number` | No | m/s |
| `heading` | `number` | No | 0–360 |
| `recordedAt` | `string (ISO-8601)` | No | Defaults to server time; enables batched offline replay |
| `orderId` | `string` | No | Active order context |
| `batchId` | `string` | No | Active bulk batch context |
| `batteryLevel` | `number` | No | 0–100 — `PickerUser.batteryLevel` already exists |

### Response

`200 OK`

| Field | Type | Required |
| --- | --- | --- |
| `data.tracked` | `boolean` | Yes |
| `data.recordedAt` | `string (ISO-8601)` | Yes |
| `data.nextPingSeconds` | `number` | Yes — server-controlled cadence, so the interval can be tuned without an app release |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Coordinates out of range |
| `401` | auth codes | |
| `403` | `LOCATION_SHARING_DISABLED` | The rider turned the toggle off — the client should stop pinging |

### Existing Backend Comparison

- **Current backend contract:** `trackUserLocation` is a stub returning `{ tracked: true }`. Its siblings `setUserLocation`, `validateLocation`, `getCurrentLocation`, `saveDarkstoreGps` and `ensureDarkstoreVerification` are stubs too.
- **Frontend expected contract:** the payload above.
- **Exact mismatches:**
  1. **Nothing is stored.** `PickerUser.gpsLocation` (`{ latitude, longitude, timestamp }`) exists but this handler does not write to it.
  2. **No history.** A single point cannot support live tracking replay, geofence audit or distance-travelled calculations — a time-series collection with a TTL is needed (gap D10).
  3. **No order/batch context**, so a breadcrumb cannot be attributed to a delivery.
  4. **No cadence control**, so the ping interval is frozen in the app binary.
  5. **No consent check** against the Settings toggle, which the Privacy Policy explicitly promises.
- **Required change:** persist the latest point on `PickerUser.gpsLocation`, append to a TTL-indexed breadcrumb collection, accept order/batch context, return `nextPingSeconds`, and honour the location-sharing preference from API 49.

---

# 32. Get current bulk batch

### Status

`NEW`

### Frontend Usage

- **Frontend pages:** `BulkOverviewScreen`, `BulkLoadingScreen`, `BulkActiveScreen`, `BulkAllStopsScreen`, `BulkStopDetailScreen`; the Home and Orders bulk banners
- **Components:** the batch summary grid, `StopRail`, the stop list with search and filters, the current-stop card
- **User action:** opens any bulk screen
- **Why:** the single source for the whole bulk vertical. Service client: `bulkApi.getBatch()` → reads `data.id` and `data.orders`. Currently served entirely by the `BULK_ORDERS` mock (10 stops) and `BULK_BATCH_ID = 'BD-10482'`, with per-stop status held in the reducer (`bulkStatuses`) and lost on restart.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/bulk/batch` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider — returns only the caller's own active batch |

**Query params**

| Param | Type | Required | Validation |
| --- | --- | --- | --- |
| `batchId` | `string` | No | Defaults to the caller's active batch |

### Response

`200 OK` — `bulkApi.getBatch` reads `data.id` and `data.orders`, so both keys are required at the top level of `data`.

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data.id` | `string` | Yes | No | `"BD-10482"` — **read by `bulkApi`** |
| `data.status` | `"assigned" \| "loading" \| "ready" \| "dispatched" \| "in_transit" \| "completed"` | Yes | No | Matches `BulkBatchStatus` in `types/domain.ts` exactly |
| `data.vehicle.type` | `"auto" \| "van" \| "motorcycle"` | Yes | No | |
| `data.vehicle.label` | `string` | Yes | No | `"AUTO"` |
| `data.vehicle.registrationNumber` | `string` | Yes | Yes | |
| `data.hub.id` / `data.hub.name` | `string` | Yes | Yes | `"Selorg Darkstore — Koramangala"` |
| `data.totals.orders` | `number` | Yes | No | |
| `data.totals.delivered` | `number` | Yes | No | |
| `data.totals.failed` | `number` | Yes | No | |
| `data.totals.remaining` | `number` | Yes | No | |
| `data.totals.distanceKm` | `number` | Yes | Yes | `"14.6 km"` on the overview |
| `data.totals.estimatedMinutes` | `number` | Yes | Yes | `"1h 42m"` |
| `data.currentStopId` | `string` | Yes | Yes | First unresolved stop |
| `data.currentStopPhase` | `"to_nav" \| "navigating" \| "arrived"` | Yes | Yes | Server-side mirror of `bulkStopPhase` |
| `data.orders[]` | `array` | Yes | No | **Read by `bulkApi`**; ordered by `seq` |
| `data.orders[].stopId` | `string` | Yes | No | **Stable id — preferred over the array index** |
| `data.orders[].seq` | `number` | Yes | No | 0-based, matching today's `stopIdx` |
| `data.orders[].orderId` | `string` | Yes | No | |
| `data.orders[].customer` | `string` | Yes | No | |
| `data.orders[].num` | `string` | Yes | No | `"#SG-2048"` |
| `data.orders[].addr` | `string` | Yes | No | |
| `data.orders[].latitude` / `longitude` | `number` | Yes | Yes | |
| `data.orders[].bag` | `string` | Yes | No | `"BD01"` |
| `data.orders[].bagLoaded` | `boolean` | Yes | No | Drives `BulkLoadingScreen` |
| `data.orders[].dist` | `string` | Yes | Yes | `"1.2 km"` |
| `data.orders[].distanceKm` | `number` | Yes | Yes | |
| `data.orders[].eta` | `string` | Yes | Yes | `"6 min"` |
| `data.orders[].etaMinutes` | `number` | Yes | Yes | |
| `data.orders[].items` | `number` | Yes | No | |
| `data.orders[].status` | `"pending" \| "delivered" \| "failed"` | Yes | No | Matches `BulkStopStatus` |
| `data.orders[].failureReason` | `string` | Yes | Yes | |
| `data.orders[].deliveredAt` | `string (ISO-8601)` | Yes | Yes | |
| `data.orders[].maskedPhone` | `string` | Yes | Yes | The Call button |
| `data.orders[].paymentMode` | `"cod" \| "prepaid"` | Yes | No | |
| `data.orders[].codAmount` | `number` | Yes | Yes | |

```json
{
  "success": true,
  "data": {
    "id": "BD-10482", "status": "dispatched",
    "vehicle": { "type": "auto", "label": "AUTO", "registrationNumber": "KA 01 AB 1234" },
    "hub": { "id": "kor", "name": "Selorg Darkstore — Koramangala" },
    "totals": { "orders": 10, "delivered": 3, "failed": 1, "remaining": 6,
                "distanceKm": 14.6, "estimatedMinutes": 102 },
    "currentStopId": "st_5", "currentStopPhase": "to_nav",
    "orders": [
      { "stopId": "st_1", "seq": 0, "orderId": "66f2...01", "customer": "Rahul Kumar",
        "num": "#SG-2048", "addr": "142, 3rd Cross, HSR Layout",
        "latitude": 12.911, "longitude": 77.638,
        "bag": "BD01", "bagLoaded": true,
        "dist": "1.2 km", "distanceKm": 1.2, "eta": "6 min", "etaMinutes": 6,
        "items": 3, "status": "delivered", "failureReason": null,
        "deliveredAt": "2026-09-04T10:31:00.000Z",
        "maskedPhone": "+91 98XXX XX210", "paymentMode": "prepaid", "codAmount": null }
    ]
  },
  "error": null
}
```

### Error Responses

| Status | `appCode` | Meaning | Frontend handling |
| --- | --- | --- | --- |
| `401` | auth codes | | |
| `403` | `NOT_BULK_RIDER` | Rider's `deliveryMode` is `standard` | hide the bulk UI |
| `404` | `NO_ACTIVE_BATCH` | No batch assigned | show the standard flow instead |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** `/api/v1/picker/bulk/*` **does not exist** — no such path is registered in `picker.routes.ts`, so every one of `bulkApi`'s five calls returns 404 through `notFoundMiddleware`. The nearest concept is the admin dispatch clustering surface: `Cluster` (`clusterId`, `orderIds[]`, `center`, `status: active|assigned|completed|cancelled`, `riderId`, `color`, `zone`, `metadata`) plus `dispatch.service.groupOrders`, `computeClusterMetrics`, `listClusters`, `saveClusters` and `assignCluster` — all behind `authenticateAdmin` on `/api/v1/rider/dispatch/*`. `Cluster` carries no per-stop status, no route sequence, no bag code, no per-stop failure reason and no ETA, so it cannot be returned to a rider as-is.
- **Proposed endpoint contract:** a rider-facing read over a new bulk batch model (gap D1) whose stops are produced from the admin clustering pipeline at assignment time, freezing the sequence so index-based addressing stays stable.
- **Expected request:** optional `batchId`.
- **Expected response:** the document above.
- **Expected errors:** `401`, `403 NOT_BULK_RIDER`, `404 NO_ACTIVE_BATCH`.
- **Design note:** the current client addresses stops by array index (`bulkApi.markDelivered(stopIdx)`). The contract exposes both `stopId` and `seq` so the app can migrate to stable ids without a breaking change.

---

# 33. Load a bulk bag

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `BulkLoadingScreen.tsx` ("Load Bulk Orders")
- **Component:** a per-bag `Checkbox` row plus the `N/M` counter and the "N bags not loaded yet" warning banner
- **User action:** scans or ticks each bag while loading the vehicle at the darkstore
- **Why:** the missing-bag check before dispatch. Service client: `bulkApi.loadBag(bag)`. Currently `actions.toggleBulkBag(bag)` writes only to `bulkLoaded` in the reducer.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/bulk/bag/load` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider — must own the batch containing the bag |
| **Headers** | `Content-Type: application/json` |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `bag` | `string` | Yes | Bag code (`"BD01"`); must belong to the caller's active batch |
| `batchId` | `string` | No | Defaults to the active batch |
| `loaded` | `boolean` | No | Default `true`; `false` un-loads, since the UI toggles both ways |
| `scanMethod` | `"scan" \| "manual"` | No | Audit trail — the UI copy says "scan each to continue" |

### Response

`200 OK`

| Field | Type | Required |
| --- | --- | --- |
| `data.bag` | `string` | Yes |
| `data.loaded` | `boolean` | Yes |
| `data.loadedCount` | `number` | Yes |
| `data.totalBags` | `number` | Yes |
| `data.allLoaded` | `boolean` | Yes — gates the "Start Bulk Delivery" button |
| `data.batchStatus` | `string` | Yes — flips to `ready` when all bags are loaded |

### Error Responses

| Status | `appCode` | Meaning | Frontend handling |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Missing `bag` | |
| `401` | auth codes | | |
| `403` | `NOT_BATCH_RIDER` | Not the caller's batch | |
| `404` | `BAG_NOT_IN_BATCH` | Unknown bag code | "This bag isn't part of your batch" |
| `409` | `BATCH_ALREADY_DISPATCHED` | Cannot change loading after dispatch | refresh |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** no bulk routes exist. Bag scanning does exist in HHD (`POST /hhd/bags/scan`, `GET/PUT /hhd/bags/:bagId`) but against HHD models, behind HHD auth, and for in-store picking rather than vehicle loading. There is no bag entity on `Order` or in the picker schema (gap D2).
- **Proposed endpoint contract:** toggle the `bagLoaded` flag on the batch stop, recompute the loaded count, and promote the batch from `loading` to `ready` when every bag is loaded.
- **Expected request:** `{ bag, batchId?, loaded?, scanMethod? }`.
- **Expected response:** the counters plus `allLoaded`.
- **Expected errors:** as above.

---

# 34. Start bulk delivery

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `BulkLoadingScreen.tsx`
- **Component:** `PrimaryButton` "Start Bulk Delivery", enabled only when every bag is loaded
- **User action:** taps it after loading, then lands on `BulkActiveScreen`
- **Why:** dispatches the batch and starts the customer-facing clock. Service client: `bulkApi.startDelivery()`. Today `actions.startBulkDelivery()` only sets `bulkBatchStatus: 'dispatched'` locally.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/bulk/start` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider — must own the batch, which must be `ready` |
| **Headers** | `Content-Type: application/json`, optional `Idempotency-Key` |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `batchId` | `string` | No | Defaults to the active batch |
| `location.latitude` / `longitude` | `number` | No | Departure point |

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.batchId` | `string` | Yes | No |
| `data.status` | `"dispatched"` | Yes | No |
| `data.startedAt` | `string (ISO-8601)` | Yes | No |
| `data.currentStopId` | `string` | Yes | Yes |
| `data.currentStopPhase` | `"to_nav"` | Yes | No |

### Error Responses

| Status | `appCode` | Meaning | Frontend handling |
| --- | --- | --- | --- |
| `401` | auth codes | | |
| `403` | `NOT_BATCH_RIDER` | | |
| `404` | `NO_ACTIVE_BATCH` | | |
| `409` | `BAGS_NOT_LOADED` | `error.details` lists the missing bag codes | show the warning banner |
| `409` | `ALREADY_DISPATCHED` | Idempotent replay | treat as success |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** no bulk routes exist. `POST /api/v1/rider/dispatch/clusters/:clusterId/assign` assigns a cluster to a rider, but it is an admin action performed *before* the rider is involved, is `authenticateAdmin`-guarded, and has no notion of loading completeness or a dispatch moment.
- **Proposed endpoint contract:** transition the batch `ready → dispatched`, stamp `startedAt`, set the first pending stop as current with phase `to_nav`, and emit the per-order status changes that notify customers.
- **Expected request:** `{ batchId?, location? }`.
- **Expected response:** `{ batchId, status, startedAt, currentStopId, currentStopPhase }`.
- **Expected errors:** as above; `409 BAGS_NOT_LOADED` must enumerate the missing bags so the client can highlight them.

---

# 35. Mark arrival at a bulk stop

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `BulkActiveScreen.tsx`
- **Component:** the phase button cycling "Start Navigation" → "Mark Arrived" → "Deliver Order"
- **User action:** advances the phase as they travel (`actions.bulkPhaseAdvance()`)
- **Why:** the `toNav → navigating → arrived` machine exists **only in the reducer** (`bulkStopPhase`), so closing the app mid-stop resets the rider to "Start Navigation" and the hub has no visibility of arrival times.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/bulk/stops/:stopId/arrive` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider — must own the batch; the stop must be the current one |
| **Path params** | `stopId` (`string`, required) — accepts a `stopId` or, transitionally, the numeric `seq` the current client sends |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `phase` | `"navigating" \| "arrived"` | Yes | Only forward transitions are allowed |
| `location.latitude` / `longitude` | `number` | No | Geotags the arrival |

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.stopId` | `string` | Yes | No |
| `data.phase` | `"to_nav" \| "navigating" \| "arrived"` | Yes | No |
| `data.updatedAt` | `string (ISO-8601)` | Yes | No |
| `data.navigationStartedAt` | `string (ISO-8601)` | No | Yes |
| `data.arrivedAt` | `string (ISO-8601)` | No | Yes |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Unknown phase |
| `401` | auth codes | |
| `403` | `NOT_BATCH_RIDER` | |
| `404` | `STOP_NOT_FOUND` | |
| `409` | `NOT_CURRENT_STOP` | Attempting to advance a stop other than the current one |
| `409` | `INVALID_PHASE_TRANSITION` | e.g. `arrived` before `navigating` |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** nothing in the service models per-stop progress. `Cluster.status` is batch-level (`active | assigned | completed | cancelled`) with no stop granularity.
- **Proposed endpoint contract:** persist the phase and its timestamps on the batch stop, enabling accurate per-stop dwell time, on-time attribution and customer-facing "rider has arrived" notifications.
- **Expected request:** `{ phase, location? }`.
- **Expected response:** the stop's phase and timestamps.
- **Expected errors:** as above.

---

# 36. Upload bulk stop POD photo

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `BulkVerifyScreen.tsx` ("Proof of Delivery")
- **Component:** the tap-to-capture box (`actions.toggleBulkPhoto`)
- **User action:** photographs the package at the door before confirming the stop
- **Why:** `BulkVerifyScreen` requires a photo to enable "Confirm Delivery" (`disabled={!taken}`) but there is no upload path and no API call — `confirmBulkDelivery` is a pure reducer action.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/bulk/stops/:stopId/proof-photo` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider — must own the batch; stop must be `arrived` |
| **Headers** | `Content-Type: multipart/form-data` |

**Form fields**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `photo` | binary | Yes | `image/jpeg` or `image/png`; ≤ 10 MB |
| `latitude` / `longitude` | `number` | No | |

### Response

`201 Created` — `{ photoId, url, stopId, uploadedAt }`, mirroring API 29.

### Error Responses

Identical to API 29, with `STOP_NOT_FOUND` in place of `ORDER_NOT_FOUND`.

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** no bulk routes and no picker upload route exist (see APIs 29 and 32).
- **Proposed endpoint contract:** identical to API 29, keyed to a batch stop instead of a standalone order.
- **Expected request / response / errors:** as API 29.

---

# 37. Deliver a bulk stop

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `BulkVerifyScreen.tsx`
- **Component:** `PrimaryButton` "Confirm Delivery"
- **User action:** confirms after capturing the photo; the app then routes to `BulkActive` or, on the last stop, `BulkComplete`
- **Why:** the core bulk transition. Service client: `bulkApi.markDelivered(stopIdx)`. Currently `CONFIRM_BULK_DELIVERY` mutates `bulkStatuses` in the reducer and nothing else.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/bulk/stops/:stopId/deliver` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider — must own the batch; stop must be `pending` and `arrived` |
| **Headers** | `Content-Type: application/json`, optional `Idempotency-Key` |
| **Path params** | `stopId` (`string`) — or the numeric `seq` sent by the current client |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `photoId` | `string` | Yes | From API 36 |
| `otp` | `string` | Conditional | 4 digits, required when the stop's order requires OTP confirmation. **Note:** the current `BulkVerifyScreen` has no OTP field — see the compatibility note below. |
| `codCollected` | `number` | Conditional | Required when the stop is COD; must equal `codAmount` |
| `location.latitude` / `longitude` | `number` | No | |

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.stopId` | `string` | Yes | No |
| `data.status` | `"delivered"` | Yes | No |
| `data.deliveredAt` | `string (ISO-8601)` | Yes | No |
| `data.batch.status` | `string` | Yes | No — flips to `completed` on the final stop |
| `data.batch.delivered` / `failed` / `remaining` | `number` | Yes | No |
| `data.batch.nextStopId` | `string` | Yes | Yes — `null` when the batch is complete |
| `data.batch.summary` | `object` | No | Yes — present only on completion; see API 40 |
| `data.cash.collected` / `data.cash.cashInHand` | `number` | Yes | Yes |

### Error Responses

| Status | `appCode` | Meaning | Frontend handling |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Missing `photoId` | |
| `400` | `INCORRECT_OTP` | OTP mismatch, where required | inline error |
| `401` | auth codes | | |
| `403` | `NOT_BATCH_RIDER` | | |
| `404` | `STOP_NOT_FOUND` | | |
| `409` | `STOP_ALREADY_RESOLVED` | Already delivered or failed | treat as success and resync |
| `409` | `NOT_ARRIVED` | Phase is not `arrived` | resync the phase |
| `409` | `COD_AMOUNT_MISMATCH` | | show the expected amount |
| `429` | `OTP_ATTEMPTS_EXCEEDED` | | |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** no bulk routes exist, and no model expresses per-stop status (gap D1). Marking each underlying order delivered one at a time through API 30 would lose the batch relationship, the stop sequence and the batch-completion trigger, and would require an OTP the bulk UI does not collect.
- **Proposed endpoint contract:** resolve the stop, mark its order delivered through the shared completion service (so `paymentStatus`, `deliveredAt` and the timeline stay consistent with API 30), credit COD to the ledger, advance `currentStopId`, and complete the batch when no pending stops remain.
- **Expected request:** `{ photoId, otp?, codCollected?, location? }`.
- **Expected response:** the stop result plus the updated batch counters.
- **Expected errors:** as above.
- **Product decision required:** standard deliveries require a customer OTP (API 30) but `BulkVerifyScreen` collects only a photo. Either bulk stops are exempt from OTP — a deliberate weakening of delivery proof that should be signed off — or the screen needs an `OtpInput`. The contract makes `otp` conditional so the backend can enforce whichever policy is chosen per order.

---

# 38. Fail a bulk stop

### Status

`NEW`

### Frontend Usage

- **Frontend components:** `BulkExceptionSheet` (opened from `BulkActiveScreen`'s "Report Delivery Issue" and from `BulkStopDetailScreen`'s "Report Issue")
- **Component:** a 4-reason `RadioRow` list plus a conditional note field, and the red "Mark Failed" button
- **User action:** selects a reason and confirms; the stop is marked failed and skipped
- **Why:** exception handling for undeliverable stops. Service client: `bulkApi.markFailed(stopIdx, reason, note)`. Currently `CONFIRM_BULK_EXCEPTION` only mutates the reducer.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/bulk/stops/:stopId/fail` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider — must own the batch; stop must be `pending` |
| **Headers** | `Content-Type: application/json`, optional `Idempotency-Key` |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `reason` | `"unreachable" \| "refused" \| "address" \| "other"` | Yes | **Exactly the four ids in `BULK_EXCEPTION_REASONS`** — note this is a *different, shorter* list than the six standard cancel reasons |
| `note` | `string` | Conditional | **Required when `reason === "other"`** (the sheet enforces it); ≤ 500 chars |
| `photoId` | `string` | No | Optional evidence |
| `location.latitude` / `longitude` | `number` | No | |

```json
{ "reason": "other", "note": "Gate locked, security refused entry" }
```

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.stopId` | `string` | Yes | No |
| `data.status` | `"failed"` | Yes | No |
| `data.reason` | `string` | Yes | No |
| `data.failedAt` | `string (ISO-8601)` | Yes | No |
| `data.batch.status` | `string` | Yes | No |
| `data.batch.delivered` / `failed` / `remaining` | `number` | Yes | No |
| `data.batch.nextStopId` | `string` | Yes | Yes |
| `data.returnToHub` | `boolean` | Yes | No — whether the parcel must be returned |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Unknown reason, or missing note for `other` |
| `401` | auth codes | |
| `403` | `NOT_BATCH_RIDER` | |
| `404` | `STOP_NOT_FOUND` | |
| `409` | `STOP_ALREADY_RESOLVED` | |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** no bulk routes and no stop-level failure model exist. `POST /picker/issues` (`reportIssue`) is a stub that echoes its body and has no relationship to orders, stops or batches.
- **Proposed endpoint contract:** mark the stop failed with an enumerated reason, transition the underlying order to a failed-delivery state that operations can re-queue, advance `currentStopId`, and flag the parcel for return.
- **Expected request:** `{ reason, note?, photoId?, location? }`.
- **Expected response:** the stop result plus the updated batch counters.
- **Expected errors:** as above.
- **Contract note:** the bulk exception list (4 reasons) and the standard cancel list (6 reasons) are deliberately different in the frontend. Both should be served by API 53 rather than hard-coded, but their enums must remain distinct.

---

# 39. List completed bulk batches

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `HistoryScreen.tsx` — the Bulk tab and the "All" tab's bulk card
- **Component:** the bulk batch card (batch id, route, summary line, earnings)
- **User action:** opens History and selects All or Bulk
- **Why:** bulk work is invisible in history otherwise. Currently served by the single hard-coded `BULK_HISTORY` mock (`BD-10475`).

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/bulk/batches` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |

**Query params**

| Param | Type | Required | Validation |
| --- | --- | --- | --- |
| `status` | `"completed" \| "cancelled" \| "all"` | No | Default `"completed"` |
| `dateFrom` / `dateTo` | `string (YYYY-MM-DD)` | No | |
| `page` | `number` | No | ≥ 1, default 1 |
| `limit` | `number` | No | 1–50, default 20 |

### Response

`200 OK`

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data.batches[].id` | `string` | Yes | No | `"BD-10475"` |
| `data.batches[].completedAt` | `string (ISO-8601)` | Yes | No | |
| `data.batches[].whenDisplay` | `string` | Yes | No | `"Yesterday, 6:20 PM"` |
| `data.batches[].route` | `string` | Yes | Yes | `"Koramangala → HSR Layout"` |
| `data.batches[].orders` | `number` | Yes | No | |
| `data.batches[].delivered` | `number` | Yes | No | |
| `data.batches[].failed` | `number` | Yes | No | |
| `data.batches[].distanceKm` | `number` | Yes | Yes | |
| `data.batches[].summaryLine` | `string` | Yes | No | `"18 orders · 17 delivered · 14.2 km"` |
| `data.batches[].earnings` | `number` | Yes | No | |
| `data.total` / `page` / `limit` / `totalPages` | `number` | Yes | No | |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Malformed dates |
| `401` | auth codes | |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** no bulk model or route exists. `GET /picker/shared-orders/completed` is a stub, and even implemented it would return individual orders with no batch grouping, no route label and no batch earnings.
- **Proposed endpoint contract:** paginated list over completed batches for the calling rider, with pre-computed display strings so the card needs no client-side formatting.
- **Expected request / response / errors:** as above.

---

# 40. Get bulk batch detail

### Status

`NEW`

### Frontend Usage

- **Frontend pages:** `BulkHistoryDetailScreen.tsx`, and `BulkCompleteScreen.tsx` (the just-finished summary)
- **Components:** three `StatTile`s (orders / delivered / failed) plus a detail card (vehicle, distance, duration, earnings)
- **User action:** taps a batch card in History, or finishes the last stop of a batch
- **Why:** the per-batch breakdown. Currently `BULK_HISTORY.detail` is a static object, and `BulkCompleteScreen` reads `selectBulk(state).summary`, whose earnings are computed client-side as `420 + completed * 26`.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/bulk/batches/:batchId` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider — must be the batch's rider |
| **Path params** | `batchId` (`string`, required) |

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.id` | `string` | Yes | No |
| `data.status` | `string` | Yes | No |
| `data.completedAt` | `string (ISO-8601)` | Yes | Yes |
| `data.route` | `string` | Yes | Yes |
| `data.vehicle` | `string` | Yes | Yes — `"Auto · KA 01 AB 1234"` |
| `data.totals.orders` / `delivered` / `failed` | `number` | Yes | No |
| `data.totals.distanceKm` | `number` | Yes | Yes |
| `data.totals.distanceDisplay` | `string` | Yes | Yes — `"14.2 km"` |
| `data.totals.durationMinutes` | `number` | Yes | Yes |
| `data.totals.durationDisplay` | `string` | Yes | Yes — `"1h 12m"` |
| `data.earnings.total` | `number` | Yes | No |
| `data.earnings.base` / `perStop` / `distance` / `incentive` | `number` | No | Yes — breakdown |
| `data.stops[]` | `array` | Yes | No — the same stop shape as API 32, with final statuses |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `401` | auth codes | |
| `403` | `NOT_BATCH_RIDER` | |
| `404` | `BATCH_NOT_FOUND` | |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** no bulk model or route exists, and no batch-level earnings are computed anywhere. `dispatch.service.computeClusterMetrics` produces an admin-side estimate using the `RIDER_EARNING_BASE_INR` / `RIDER_EARNING_PER_KM_INR` constants, but it is an estimate for planning, is not persisted, and is not reachable with a picker token.
- **Proposed endpoint contract:** a read of the stored batch with its final per-stop statuses and a persisted earnings breakdown, so the figure shown on `BulkCompleteScreen` at completion is the same figure History shows a week later.
- **Expected request:** `batchId` in the path.
- **Expected response:** the document above.
- **Expected errors:** `401`, `403`, `404`.
---

# 41. Earnings summary

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `src/screens/earnings/EarningsScreen.tsx`
- **Components:** `GradientHeroCard` (week total + 3 stats), the "Next payout" `Card`, and the "Earnings breakdown" rows
- **User action:** opens the Earnings tab, or taps "View Details ›" on Home
- **Why:** the rider's pay statement. Service client: `riderApi.getEarningsSummary()`. Currently served by the `WEEK_EARNINGS` mock.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/wallet/earnings-breakdown` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |

**Query params**

| Param | Type | Required | Validation |
| --- | --- | --- | --- |
| `period` | `"week" \| "month" \| "custom"` | No — **new** | Default `"week"` |
| `dateFrom` / `dateTo` | `string (YYYY-MM-DD)` | Conditional — **new** | Required when `period === "custom"` |

### Response

`200 OK`

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data.period.from` / `data.period.to` | `string (YYYY-MM-DD)` | Yes | No | |
| `data.total` | `number` | Yes | No | Period total in ₹ |
| `data.totalDisplay` | `string` | Yes | No | `"₹6,480"` |
| `data.deliveries` | `number` | Yes | No | |
| `data.avgPerOrder` | `number` | Yes | No | |
| `data.avgPerOrderDisplay` | `string` | Yes | No | `"₹95"` |
| `data.onlineHours` | `number` | Yes | No | |
| `data.onlineHoursDisplay` | `string` | Yes | No | `"28.5h"` |
| `data.breakdown[]` | `array` | Yes | No | Always three rows, in this order |
| `data.breakdown[].key` | `"standard" \| "bulk" \| "incentive"` | Yes | No | |
| `data.breakdown[].label` | `string` | Yes | No | "Standard Deliveries", "Bulk Delivery", "Incentives" |
| `data.breakdown[].amount` | `number` | Yes | No | |
| `data.breakdown[].amountDisplay` | `string` | Yes | No | `"₹4,120"` |
| `data.breakdown[].highlight` | `boolean` | Yes | No | The frontend's `purple` flag — true for the bulk row |
| `data.nextPayout.amount` | `number` | Yes | Yes | |
| `data.nextPayout.amountDisplay` | `string` | Yes | Yes | `"₹6,480"` |
| `data.nextPayout.dueAt` | `string (ISO-8601)` | Yes | Yes | |
| `data.nextPayout.whenDisplay` | `string` | Yes | Yes | `"in 2 days"` |
| `data.nextPayout.scheduleDisplay` | `string` | Yes | Yes | `"Every Monday · UPI"` |

```json
{
  "success": true,
  "data": {
    "period": { "from": "2026-08-31", "to": "2026-09-06" },
    "total": 6480, "totalDisplay": "₹6,480",
    "deliveries": 68, "avgPerOrder": 95, "avgPerOrderDisplay": "₹95",
    "onlineHours": 28.5, "onlineHoursDisplay": "28.5h",
    "breakdown": [
      { "key": "standard",  "label": "Standard Deliveries", "amount": 4120, "amountDisplay": "₹4,120", "highlight": false },
      { "key": "bulk",      "label": "Bulk Delivery",       "amount": 1680, "amountDisplay": "₹1,680", "highlight": true  },
      { "key": "incentive", "label": "Incentives",          "amount": 680,  "amountDisplay": "₹680",   "highlight": false }
    ],
    "nextPayout": { "amount": 6480, "amountDisplay": "₹6,480",
                    "dueAt": "2026-09-07T04:00:00.000Z",
                    "whenDisplay": "in 2 days", "scheduleDisplay": "Every Monday · UPI" }
  },
  "error": null
}
```

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Invalid period or date range |
| `401` | auth codes | |

### Existing Backend Comparison

**Current backend contract:** `getEarningsBreakdown` is a stub returning `{ userId, breakdown: [] }`. The related admin path `GET /admin/finance/picker-earnings/:pickerId/breakdown` calls `finance.service.getPickerEarningsBreakdown`, which is itself a literal `{ pickerId, totalEarned: 0, totalWithdrawn: 0, pending: 0, breakdown: [] }`.

**Frontend expected contract:** the document above.

**Exact mismatches**

1. **No implementation** on either the picker or the finance path.
2. **Three conflicting shapes.** `riderApi.EarningsSummary` declares `{ total: string, orders: number, hours: string, breakdown: [{ label, amount }] }`; `EarningsScreen` actually consumes `WEEK_EARNINGS` with `{ weekTotal, deliveries, avgPerOrder, onlineHours, nextPayout, nextPayoutWhen, nextPayoutSchedule, breakdown: [{ label, value, purple }] }`; the backend returns a fourth shape. The frontend service and the screen it serves do not agree with each other. This must be settled before implementation — the contract above adopts the screen's needs, with both raw numbers and display strings so either style works.
3. **No period concept.** Nothing scopes to a week, so "THIS WEEK" cannot be produced.
4. **No standard/bulk/incentive attribution.** Requires a per-order rider payout and a bulk/standard tag on every earning (gaps D5, L5).
5. **No payout schedule.** "Every Monday · UPI" and "in 2 days" have no backing model.
6. **`riderApi.getEarningsSummary` swallows errors** — it returns `result.data ?? { total: '₹0', ... }`, so a failure is indistinguishable from a genuinely empty week. The frontend should surface the error state once the endpoint is real.

**Required change:** implement the aggregation over completed deliveries and their persisted payouts, add the `period` parameters, and add a payout-schedule model.

---

# 42. Daily earnings breakdown

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `EarningsScreen.tsx` — the "Daily breakdown" card
- **Component:** per-day rows with a weekday chip, date, "N orders · Xh" and the amount
- **User action:** scrolls the Earnings tab
- **Why:** the day-level view riders use to check a specific shift. Service client: `riderApi.getDailyBreakdown()` → reads `data.history`. Currently served by the `DAILY_BREAKDOWN` mock (5 days).

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/wallet/history` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |

**Query params**

| Param | Type | Required | Validation |
| --- | --- | --- | --- |
| `period` | `"week" \| "month"` | No — **new** | Default `"week"` |
| `dateFrom` / `dateTo` | `string (YYYY-MM-DD)` | No — **new** | |
| `limit` | `number` | No — **new** | 1–90, default 7 |

### Response

`200 OK` — the array must sit at `data.history` because that is what `riderApi.getDailyBreakdown` reads.

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data.history[].date` | `string (YYYY-MM-DD)` | Yes | No | |
| `data.history[].day` | `string` | Yes | No | `"MON"` — the weekday chip |
| `data.history[].dateDisplay` | `string` | Yes | No | `"Mon, 12 Feb"` |
| `data.history[].orders` | `number` | Yes | No | |
| `data.history[].hours` | `string` | Yes | No | `"4.5h"` |
| `data.history[].hoursDecimal` | `number` | Yes | No | `4.5` |
| `data.history[].amount` | `string` | Yes | No | `"980"` — the UI prefixes ₹ itself |
| `data.history[].amountValue` | `number` | Yes | No | `980` |
| `data.total` | `number` | Yes | No | Sum over the returned days |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Invalid range |
| `401` | auth codes | |

### Existing Backend Comparison

- **Current backend contract:** `getWalletHistory` is a stub returning `{ userId, history: [], total: 0 }`.
- **Frontend expected contract:** the per-day rollup above. The key `history` already matches what the client reads, so the app renders an empty list rather than an error.
- **Exact mismatches:**
  1. **No implementation and no aggregation.** A per-day rollup of orders, worked hours and earnings does not exist. `PickerAttendance` provides `totalWorkedMinutes` and `ordersCompleted` per punch record, so hours and orders are derivable, but earnings need the per-order payout that does not exist yet (gap D5).
  2. **Naming collision.** "wallet history" suggests a ledger, but the frontend uses this endpoint for *earnings by day*. Either rename it (`/picker/earnings/daily`) or document the intent — as it stands, `/wallet/history`, `/wallet/transactions` and `/wallet/earnings-breakdown` are three similar names for three different concepts, and the frontend maps them in a way none of their names imply.
  3. **No date filtering or limit.**
- **Required change:** implement the aggregation, add the range parameters, and settle the naming.

---

# 43. Wallet balance

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend pages:** not yet surfaced — the app shows *floating cash* (API 46), not the payout wallet
- **Component:** intended for a future payout/withdrawal screen
- **Why:** documented because two endpoints currently claim this concept and one of them is fake, which will mislead the next implementer.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/wallet` (**authoritative**) — deprecate `/picker/wallet/balance` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.availableBalance` | `number` | Yes | No |
| `data.pendingBalance` | `number` | Yes | No |
| `data.reservedBalance` | `number` | Yes | No |
| `data.totalEarnings` | `number` | Yes | No |
| `data.currency` | `string` | Yes | No — `"INR"` |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `401` | auth codes | |

### Existing Backend Comparison

- **Current backend contract:** **two** endpoints exist. `GET /picker/wallet` → `pickerService.getWallet` is real: it finds or lazily creates the `PickerWallet` and returns all four balances. `GET /picker/wallet/balance` → `getWalletBalance` is a stub returning `{ userId, balance: 0, currency: 'INR' }` — a hard-coded zero with a *different field name* (`balance` rather than `availableBalance`).
- **Frontend expected contract:** one endpoint returning the four balances.
- **Exact mismatch:** a client that reaches for the intuitively named `/wallet/balance` gets a permanent zero. This is a trap rather than a gap.
- **Required change:** delete or redirect `/wallet/balance` to the real handler, and standardise on `availableBalance`.

---

# 44. Wallet transactions

### Status

`EXISTING`

### Frontend Usage

- **Frontend page:** no dedicated screen today. `riderApi.getHistory()` points at this endpoint, but `HistoryScreen` renders the `HISTORY` *delivery* mock, not wallet rows.
- **Component:** intended for a future wallet ledger screen
- **Why:** documented because the frontend service currently mis-targets it (see API 45).

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/wallet/transactions` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |

**Query params**

| Param | Type | Required | Validation |
| --- | --- | --- | --- |
| `page` | `number` | No | ≥ 1, default 1 |
| `limit` | `number` | No | ≥ 1, default 20 |

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.transactions[]._id` | `string` | Yes | No |
| `data.transactions[].type` | `"credit" \| "debit"` | Yes | No |
| `data.transactions[].amount` | `number` | Yes | No |
| `data.transactions[].description` | `string` | Yes | No |
| `data.transactions[].referenceId` | `string` | No | Yes |
| `data.transactions[].status` | `"pending" \| "completed" \| "failed"` | Yes | No |
| `data.transactions[].currency` | `string` | Yes | No |
| `data.transactions[].createdAt` | `string (ISO-8601)` | Yes | No |
| `data.total` / `page` / `limit` / `totalPages` | `number` | Yes | No |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `401` | auth codes | |

### Existing Backend Comparison

- **Existing endpoint:** `GET /api/v1/picker/wallet/transactions` → `pickerService.getTransactions` → paginated `PickerTransaction.find({ userId }).sort({ createdAt: -1 })`.
- **Why it is compatible:** it is fully implemented, correctly scoped and paginated, and its `data.transactions` key already matches what `riderApi.getHistory` reads. It is a valid wallet-ledger endpoint exactly as it stands.
- **Caveat:** the frontend points its *delivery history* call here. That is a frontend bug, not a backend gap — see API 45.

---

# 45. Delivery history (standard)

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `src/screens/history/HistoryScreen.tsx`
- **Components:** `HistoryCard` rows plus the `all / standard / bulk` `FilterTabs`
- **User action:** opens the History tab
- **Why:** the rider's completed-delivery record. Currently served by the `HISTORY` mock (4 entries), while `riderApi.getHistory()` — which the screen does not call — points at `/picker/wallet/transactions`.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/shared-orders/completed` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |

**Query params**

| Param | Type | Required | Validation |
| --- | --- | --- | --- |
| `type` | `"all" \| "standard" \| "bulk"` | No — **new** | Default `"all"`; mirrors the `FilterTabs` |
| `dateFrom` / `dateTo` | `string (YYYY-MM-DD)` | No — **new** | |
| `page` | `number` | No — **new** | ≥ 1, default 1 |
| `limit` | `number` | No — **new** | 1–50, default 20 |

### Response

`200 OK` — the array sits at `data.orders`, consistent with API 26.

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data.orders[].id` | `string` | Yes | No | |
| `data.orders[].num` | `string` | Yes | No | `"#SG-2041"` |
| `data.orders[].deliveredAt` | `string (ISO-8601)` | Yes | No | |
| `data.orders[].time` | `string` | Yes | No | `"Today, 11:42 AM"` — relative display string |
| `data.orders[].addr` | `string` | Yes | No | |
| `data.orders[].items` | `number` | Yes | No | |
| `data.orders[].dist` | `string` | Yes | Yes | `"2.4 km"` |
| `data.orders[].distanceKm` | `number` | Yes | Yes | |
| `data.orders[].payout` | `number` | Yes | No | |
| `data.orders[].type` | `"standard" \| "bulk"` | Yes — **new** | No | Drives the filter |
| `data.orders[].batchId` | `string` | Yes — **new** | Yes | Set when `type === "bulk"` |
| `data.orders[].status` | `"delivered" \| "failed" \| "cancelled"` | Yes — **new** | No | History shows delivered today, but failures matter |
| `data.orders[].codCollected` | `number` | Yes — **new** | Yes | |
| `data.total` / `page` / `limit` / `totalPages` | `number` | Yes — **new** | No | |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Invalid type or date range |
| `401` | auth codes | |

### Existing Backend Comparison

- **Current backend contract:** `getCompletedSharedOrders` is a stub returning `{ orders: [], total: 0 }`.
- **Frontend expected contract:** the paginated, filterable list above.
- **Exact mismatches:**
  1. **No implementation.**
  2. **The frontend calls the wrong endpoint.** `riderApi.getHistory()` targets `/picker/wallet/transactions` and types the result as `HistoryEntry[]` (`{ time, addr, num, items, dist, payout }`), but that endpoint returns `PickerTransaction` rows (`{ type, amount, description, status, createdAt }`). The two shapes have **no fields in common**, so if the screen were wired to the service today it would render blank rows. Repoint `riderApi.getHistory` at `/picker/shared-orders/completed`.
  3. **No `type` filter,** so the History tabs cannot work server-side.
  4. **No pagination,** on a list that grows without bound.
  5. **No payout,** the most prominent value on each card.
  6. **No relative time formatting.** "Today, 11:42 AM" requires the rider's timezone; either the server formats it or it returns an ISO timestamp and the client formats it. The contract returns both.
- **Required change:** implement the query against delivered orders for the calling rider, add filtering and pagination, include payout and type, and fix the frontend's endpoint target.

---

# 46. Floating-cash summary

### Status

`NEW`

### Frontend Usage

- **Frontend pages:** `src/screens/profile/FloatCashScreen.tsx`, plus the `ProfileScreen` "Float cash" `StatTile` and menu subtitle
- **Component:** `GradientHeroCard` — "CASH IN HAND (COD)", the amount, and "Deposit limit: ₹2,000 · Deposit before end of shift"
- **User action:** opens Floating Cash from Profile
- **Why:** COD cash is company money the rider is holding; the limit and the deadline are compliance rules. Currently `state.floatingCash` starts at the mock constant `DEFAULT_FLOAT_CASH = 840` and is mutated only by local deposits.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/cash/summary` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |

### Response

`200 OK`

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data.cashInHand` | `number` | Yes | No | |
| `data.cashInHandDisplay` | `string` | Yes | No | `"₹840"` |
| `data.depositLimit` | `number` | Yes | No | Replaces the hard-coded `environment.codDepositLimit` |
| `data.limitExceeded` | `boolean` | Yes | No | |
| `data.depositDueBy` | `string (ISO-8601)` | Yes | Yes | End of the current shift |
| `data.depositDueDisplay` | `string` | Yes | Yes | `"Deposit before end of shift"` |
| `data.collectedToday` | `number` | Yes | No | |
| `data.depositedToday` | `number` | Yes | No | |
| `data.pendingDeposits` | `number` | Yes | No | Deposits recorded but not yet reconciled by finance |
| `data.canGoOffline` | `boolean` | Yes | No | Whether the cash position blocks ending the shift (API 23) |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `401` | auth codes | |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** **nothing in the service models rider-held cash.** Grepping `floatingCash`, `cashInHand`, `codCollect` and `/deposit` across `src/` returns no matches. `PickerWallet` is the *payout* wallet (earnings owed **to** the rider) — the exact inverse of COD float (cash the rider owes **to** the company); using it for both would net two opposite liabilities into one meaningless number. `Order.paymentStatus: 'cod_pending'` records that a specific order's cash is outstanding, but nothing aggregates it per rider.
- **Proposed endpoint contract:** a summary over a new `PickerCashLedger` (gap D3), with the limit and deadline served from configuration rather than hard-coded in the app.
- **Expected request:** none.
- **Expected response:** the object above.
- **Expected errors:** `401`.
- **Related:** `cashInHand` must also appear on API 8 (Profile), API 24 (Home) and API 30 (post-delivery).

---

# 47. Floating-cash transactions

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `FloatCashScreen.tsx` — "Recent transactions"
- **Component:** signed rows — "COD collected · #SG-2041 / +₹520 / 11:42 AM", "Deposit to Selorg wallet / −₹1,200 / 10:00 AM"
- **User action:** opens Floating Cash
- **Why:** the rider's own audit trail when a hub disputes a deposit. Currently `floatTxns(state)` concatenates locally recorded deposits with the `BASE_FLOAT_TXNS` mock — and `selectors.ts` contains a **duplicated copy** of that mock (`BASE_FLOAT_TXNS_INLINE`), so the two can drift.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/cash/transactions` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |

**Query params**

| Param | Type | Required | Validation |
| --- | --- | --- | --- |
| `dateFrom` / `dateTo` | `string (YYYY-MM-DD)` | No | Default: current shift day |
| `type` | `"all" \| "cod_collected" \| "deposit"` | No | Default `"all"` |
| `page` | `number` | No | ≥ 1, default 1 |
| `limit` | `number` | No | 1–50, default 20 |

### Response

`200 OK`

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data.transactions[].id` | `string` | Yes | No | |
| `data.transactions[].type` | `"cod_collected" \| "deposit" \| "adjustment"` | Yes | No | |
| `data.transactions[].amount` | `number` | Yes | No | Always positive |
| `data.transactions[].direction` | `"in" \| "out"` | Yes | No | The frontend's `pos` boolean |
| `data.transactions[].label` | `string` | Yes | No | `"COD collected · #SG-2041"` |
| `data.transactions[].amountDisplay` | `string` | Yes | No | `"+₹520"` / `"−₹1,200"` |
| `data.transactions[].time` | `string` | Yes | No | `"11:42 AM"` |
| `data.transactions[].createdAt` | `string (ISO-8601)` | Yes | No | |
| `data.transactions[].orderId` | `string` | Yes | Yes | |
| `data.transactions[].ref` | `string` | Yes | Yes | Deposit reference |
| `data.transactions[].method` | `"upi" \| "bank" \| "card"` | Yes | Yes | Deposits only |
| `data.transactions[].status` | `"pending" \| "confirmed" \| "reconciled" \| "disputed"` | Yes | No | |
| `data.total` / `page` / `limit` / `totalPages` | `number` | Yes | No | |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Invalid range |
| `401` | auth codes | |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** no cash ledger exists (see API 46). `GET /picker/wallet/transactions` is the payout ledger and its `PickerTransaction` schema (`type: credit|debit`, `amount`, `description`, `referenceId`, `status`) has no COD semantics, no order link, no deposit method and no reconciliation state.
- **Proposed endpoint contract:** paginated read over `PickerCashLedger`, with both raw and display fields so the row renders without client-side currency formatting.
- **Expected request / response / errors:** as above.

---

# 48. Record a cash deposit

### Status

`NEW`

### Frontend Usage

- **Frontend component:** `DepositSheet` (opened from `FloatCashScreen`'s "Deposit cash to Selorg")
- **Components:** the amount field with "Deposit full amount", a 3-option method list (UPI / Bank Transfer / Debit-Credit Card), the confirm button, and the "Deposit recorded" success state showing the remaining cash and a `Ref`
- **User action:** enters an amount, picks a method, confirms
- **Why:** closes the COD loop. Service client: `riderApi.recordDeposit(amount, method)` → `POST /picker/wallet/deposit` — **a route that does not exist**, so the call 404s and the client falls back to a locally generated reference.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/cash/deposits` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |
| **Headers** | `Content-Type: application/json`, `Idempotency-Key` **strongly recommended** |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `amount` | `number` | Yes | Integer > 0; ≤ `cashInHand`; ≤ `depositLimit`. The frontend already enforces the first two client-side in `CONFIRM_DEPOSIT`; the server must enforce all three. |
| `method` | `"upi" \| "bank" \| "card"` | Yes | Matches `PAY_METHODS` ids exactly |
| `hubId` | `string` | No | Where the cash was handed over |
| `note` | `string` | No | ≤ 200 chars |

```json
{ "amount": 840, "method": "upi", "hubId": "kor" }
```

### Response

`201 Created`

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data.ref` | `string` | Yes | No | **Server-issued**, e.g. `"DP482913"` — `riderApi.recordDeposit` reads `data.ref` |
| `data.depositId` | `string` | Yes | No | |
| `data.amount` | `number` | Yes | No | |
| `data.method` | `string` | Yes | No | |
| `data.methodLabel` | `string` | Yes | No | `"UPI"` / `"Bank Transfer"` / `"Card"` |
| `data.status` | `"pending" \| "confirmed"` | Yes | No | |
| `data.createdAt` | `string (ISO-8601)` | Yes | No | |
| `data.cashInHand` | `number` | Yes | No | Remaining float after the deposit |
| `data.cashInHandDisplay` | `string` | Yes | No | |
| `data.receiptUrl` | `string` | No | Yes | The sheet says "A receipt has been sent to your app" |

```json
{
  "success": true,
  "data": {
    "ref": "DP482913", "depositId": "66f4d2...cc",
    "amount": 840, "method": "upi", "methodLabel": "UPI",
    "status": "confirmed", "createdAt": "2026-09-04T13:05:00.000Z",
    "cashInHand": 0, "cashInHandDisplay": "₹0", "receiptUrl": null
  },
  "error": null
}
```

### Error Responses

| Status | `appCode` | Meaning | Frontend handling |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Amount ≤ 0 or missing method | "Enter an amount to deposit." |
| `400` | `AMOUNT_EXCEEDS_CASH_IN_HAND` | `error.details.cashInHand` carries the true value | "Amount exceeds cash in hand (₹840)." |
| `400` | `AMOUNT_EXCEEDS_LIMIT` | Over the per-deposit limit | show the limit |
| `401` | auth codes | | |
| `409` | `DUPLICATE_DEPOSIT` | Idempotency-key replay | return the original deposit |
| `502` | `PAYMENT_GATEWAY_ERROR` | UPI/card collection failed | offer a retry |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** **the endpoint the frontend calls does not exist.** `riderApi.recordDeposit` posts to `/picker/wallet/deposit`; `picker.routes.ts` registers `POST /wallet/withdraw` and nothing else under `/wallet` for writes, so the call falls through to `notFoundMiddleware` and returns 404. The client then silently synthesises a reference: `result.data?.ref ?? 'DP' + Math.floor(100000 + Math.random() * 900000)` — so the rider is shown an official-looking receipt number that exists nowhere on the server. `POST /picker/wallet/withdraw` is the **opposite** operation (paying earnings out to the rider) and cannot be repurposed.
- **Proposed endpoint contract:** validate against the live cash position, write a `deposit` row to `PickerCashLedger`, generate a unique server-side `ref`, reduce cash in hand, and mark the covered orders as reconciled.
- **Expected request:** `{ amount, method, hubId?, note? }`.
- **Expected response:** the deposit record including the server `ref` and the new cash position.
- **Expected errors:** as above.
- **Critical follow-up:** remove the client-side `ref` fallback from `riderApi.recordDeposit`. A fabricated reference on a cash-handling receipt is a reconciliation and fraud hazard.

---

# 49. Get notification/settings preferences

### Status

`NEW`

### Frontend Usage

- **Frontend pages:** `src/screens/profile/SettingsScreen.tsx`, `LanguageSheet`
- **Components:** three `ToggleSwitch` rows (Push notifications, Location sharing, Order sound alerts) and the Language value row
- **User action:** opens Settings
- **Why:** preferences must persist across devices and reinstalls, and **location sharing is a consent record**, not a UI convenience — the Privacy Policy promises the rider can turn it off. Currently `state.toggles` and `state.language` live only in the reducer.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/settings/preferences` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |

### Response

`200 OK`

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data.pushNotifications` | `boolean` | Yes | No | |
| `data.locationSharing` | `boolean` | Yes | No | Consent record; gates API 31 |
| `data.orderSoundAlerts` | `boolean` | Yes | No | |
| `data.language` | `"en" \| "hi" \| "kn" \| "ta" \| "te"` | Yes | No | The UI currently keys languages by their native label (`"हिन्दी"`); the API uses ISO codes and the client maps for display |
| `data.updatedAt` | `string (ISO-8601)` | Yes | No | |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `401` | auth codes | |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** there is no picker preferences store. `GET/PUT /api/v1/customer/notifications/preferences` is real but sits behind `authenticateCustomer`, so a picker token resolves to no `CustomerUser` and gets 401 (gap A4); its schema is also customer-shaped (order updates, promotions) with no location-sharing consent and no language. `PickerUser` has no preferences subdocument.
- **Proposed endpoint contract:** a preferences subdocument on `PickerUser` (or a small `PickerPreferences` collection), returned with defaults `{ pushNotifications: true, locationSharing: true, orderSoundAlerts: true, language: "en" }` — matching the frontend's `initialState`.
- **Expected request:** none.
- **Expected response:** the object above.
- **Expected errors:** `401`.

---

# 50. Update notification/settings preferences

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `SettingsScreen.tsx`, `LanguageSheet`
- **Component:** toggle rows and the language picker
- **User action:** flips a toggle or picks a language
- **Why:** persists the choice. `actions.toggleSetting` / `actions.setLanguage` currently write only to the reducer.

### Request

| | |
| --- | --- |
| **Method** | `PUT` |
| **Endpoint** | `/api/v1/picker/settings/preferences` |
| **Authentication** | Bearer picker JWT |
| **Headers** | `Content-Type: application/json` |

**Body** — partial update; every field optional.

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `pushNotifications` | `boolean` | No | |
| `locationSharing` | `boolean` | No | Turning it off must stop server-side tracking and may restrict order assignment — the Privacy Policy states "you will not receive orders while it is off" |
| `orderSoundAlerts` | `boolean` | No | |
| `language` | `"en" \| "hi" \| "kn" \| "ta" \| "te"` | No | |

### Response

`200 OK` — the full preferences object from API 49.

### Error Responses

| Status | `appCode` | Meaning | Frontend handling |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Unsupported language code | |
| `401` | auth codes | | |
| `409` | `LOCATION_REQUIRED_WHILE_ONLINE` | Disabling location while on an active delivery | prompt to go offline first |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** as API 49 — the only equivalent is customer-authenticated and customer-shaped.
- **Proposed endpoint contract:** partial update with validation, returning the full object so the client can replace its state atomically.
- **Expected request:** any subset of the four fields.
- **Expected response:** the full preferences object.
- **Expected errors:** `400`, `401`, `409`.

---

# 51. Register push token

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** app bootstrap after login; governed by the Settings "Push notifications" toggle
- **Component:** none (silent)
- **User action:** grants notification permission
- **Why:** new-order alerts are what make the "2 new orders available" flow work. Without push, a rider must keep the app open.

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/push-token` |
| **Authentication** | Bearer picker JWT |
| **Headers** | `Content-Type: application/json` |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `token` | `string` | Yes | FCM/APNs token, ≤ 512 chars |
| `platform` | `"ios" \| "android"` | Yes | |
| `deviceId` | `string` | No | Stable install id, so a re-registration replaces rather than duplicates |
| `appVersion` | `string` | No | |

### Response

`200 OK`

| Field | Type | Required |
| --- | --- | --- |
| `data.registered` | `boolean` | Yes |
| `data.tokenId` | `string` | Yes |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Missing token or platform |
| `401` | auth codes | |

### Existing Backend Comparison

- **Current backend contract:** `POST /picker/push-token` → `registerPushToken`, a stub that echoes a success object without storing anything.
- **Frontend expected contract:** the request above with real persistence.
- **Exact mismatches:**
  1. **Nothing is stored**, so no push can ever be addressed to a rider.
  2. **No platform or device id**, so tokens cannot be deduplicated or expired.
  3. Real token storage exists only on the customer side (`POST /customer/notifications/register-token`, `authenticateCustomer`, with a `registerPushTokenSchema` Zod validator) — a good template, but unreachable with a picker token.
  4. The admin path `POST /admin/picker/pickers/:pickerId/push` (`adminSendPickerPush`) is also a stub, so even the send side is unimplemented.
- **Required change:** persist tokens per picker and device, honour the `pushNotifications` preference from API 49, and implement the FCM/APNs send path.

---

# 52. App config

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend pages:** app bootstrap; `SupportScreen` (helpline, email), `SettingsScreen` (app version), `DepositSheet` (deposit limit), `OtpScreen` (OTP length)
- **Component:** none directly — it feeds `environment.ts`
- **Why:** every one of these values is currently a compile-time constant (`otpLength: 4`, `codDepositLimit: 2000`, `supportPhone: '+91 1800 266 0800'`, `supportEmail: 'support@selorg.in'`, `appVersion: 'v1.0.0'`), so changing a helpline number requires an app-store release.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/config` |
| **Authentication** | None (public) — the app needs it before login |
| **Query params** | `platform` (`"ios" \| "android"`, optional), `appVersion` (`string`, optional) for the update check |

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.otpLength` | `number` | Yes | No |
| `data.otpResendSeconds` | `number` | Yes | No — backs the "Resend in 0:24" timer |
| `data.codDepositLimit` | `number` | Yes | No |
| `data.support.phone` | `string` | Yes | No |
| `data.support.email` | `string` | Yes | No |
| `data.support.hours` | `string` | Yes | Yes — `"24×7"` |
| `data.support.emailSlaHours` | `number` | Yes | Yes — `"~4 hrs"` |
| `data.app.minSupportedVersion` | `string` | Yes | No |
| `data.app.latestVersion` | `string` | Yes | No |
| `data.app.forceUpdate` | `boolean` | Yes | No |
| `data.app.updateUrl` | `string` | Yes | Yes |
| `data.features.bulkDelivery` | `boolean` | Yes | No — feature flag for the bulk vertical |
| `data.features.emailLogin` | `boolean` | Yes | No — should be `false` until API 3 delivers mail |
| `data.locationPingSeconds` | `number` | Yes | No |
| `data.languages[]` | `array` | Yes | No — `{ code, native, english }` |

### Error Responses

| Status | Meaning |
| --- | --- |
| `500` | Unexpected server error |

### Existing Backend Comparison

- **Current backend contract:** `GET /picker/config` → `getPublicConfig`, which returns the literal `{ config: {} }`.
- **Frontend expected contract:** the document above.
- **Exact mismatches:** the endpoint returns an empty object with a redundant nesting level (`data.config`), so nothing can be configured remotely. A real, well-structured equivalent exists at `GET /api/v1/customer/app-config` (`app-config.controller.getPublicConfig` over an `AppConfig` model with sectioned admin updates) — that module is the right template, and the picker config should follow the same pattern rather than inventing another.
- **Required change:** implement a picker `AppConfig` section (or add a `rider` section to the existing model), flatten the response, and add the version-gate and feature-flag fields. The `emailLogin` flag in particular lets the app hide a login method that cannot currently work (gap A10).

---

# 53. Cancel / exception reason lists

### Status

`NEW`

### Frontend Usage

- **Frontend components:** `CancelOrderSheet` (6 reasons with subtitles) and `BulkExceptionSheet` (4 reasons)
- **Component:** `RadioRow` lists plus a conditional note field for "Other reason"
- **User action:** cancels an order or reports a bulk delivery issue
- **Why:** the reason taxonomy drives operations reporting and rider ratings. Both lists are hard-coded in `src/mock/index.ts` (`CANCEL_REASONS`, `BULK_EXCEPTION_REASONS`), so operations cannot add or retire a reason without an app release, and the app's ids can silently drift from whatever the backend eventually stores.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/config/cancel-reasons` |
| **Authentication** | Bearer picker JWT |
| **Query params** | `context`: `"standard" \| "bulk"` — required |

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.context` | `"standard" \| "bulk"` | Yes | No |
| `data.reasons[].id` | `string` | Yes | No |
| `data.reasons[].label` | `string` | Yes | No |
| `data.reasons[].subtitle` | `string` | Yes | Yes — the standard list has subtitles, the bulk list does not |
| `data.reasons[].requiresNote` | `boolean` | Yes | No — `true` for `other` |
| `data.reasons[].order` | `number` | Yes | No |

```json
{
  "success": true,
  "data": {
    "context": "standard",
    "reasons": [
      { "id": "unreachable", "label": "Customer not reachable",         "subtitle": "No answer after multiple calls", "requiresNote": false, "order": 1 },
      { "id": "refused",     "label": "Customer refused delivery",      "subtitle": "Order declined at the door",     "requiresNote": false, "order": 2 },
      { "id": "address",     "label": "Wrong or incomplete address",    "subtitle": "Location could not be found",    "requiresNote": false, "order": 3 },
      { "id": "asked",       "label": "Customer asked to cancel",       "subtitle": "Requested cancellation directly","requiresNote": false, "order": 4 },
      { "id": "vehicle",     "label": "Vehicle breakdown / safety issue","subtitle": "Unable to continue the trip",   "requiresNote": false, "order": 5 },
      { "id": "other",       "label": "Other reason",                   "subtitle": "Add a note for support",         "requiresNote": true,  "order": 6 }
    ]
  },
  "error": null
}
```

The `bulk` context returns exactly `unreachable`, `refused`, `address` and `other` — a deliberately
shorter list, since `vehicle` and `asked` do not apply to a single stop within a batch.

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Unknown context |
| `401` | auth codes | |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** there is no reason-taxonomy endpoint for riders. A `CancellationPolicy` model and admin CRUD exist (`/customer/admin/cancellation-policies`), but they govern **customer** cancellation windows and fees, not rider-side failure reasons, and are admin-authenticated. `Order.cancellationReason` is a free string with no enum, so nothing constrains what a rider cancellation can record.
- **Proposed endpoint contract:** a small reason-catalogue collection keyed by context, seeded with exactly the ids above so the enum used by APIs 28 and 38 stays authoritative and versioned in one place.
- **Expected request:** `?context=standard|bulk`.
- **Expected response:** the ordered list.
- **Expected errors:** `400`, `401`.

---

# 54. FAQ list

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `src/screens/profile/SupportScreen.tsx` — "Quick help"
- **Component:** question/answer cards
- **User action:** opens Help & Support
- **Why:** deflects support contacts. Currently served by the `FAQS` mock (3 entries).

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/faq` |
| **Authentication** | None (public) |

**Query params**

| Param | Type | Required | Validation |
| --- | --- | --- | --- |
| `category` | `string` | No | e.g. `"earnings"`, `"delivery"` |
| `limit` | `number` | No | 1–50, default 20 |

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.faqs[].id` | `string` | Yes | No |
| `data.faqs[].q` | `string` | Yes | No |
| `data.faqs[].a` | `string` | Yes | No |
| `data.faqs[].category` | `string` | Yes | Yes |
| `data.faqs[].order` | `number` | Yes | No |

### Error Responses

| Status | Meaning |
| --- | --- |
| `500` | Unexpected server error |

### Existing Backend Comparison

- **Current backend contract:** `GET /picker/faq` → `listFAQ`, a stub returning `{ faqs: [] }`.
- **Frontend expected contract:** the same key with real content.
- **Exact mismatches:** no implementation; no rider-scoped content; no category filter. A **fully implemented** FAQ module already exists at `GET /api/v1/customer/faq` — public, validated (`listFaqQuerySchema`), paginated, with `/categories` and feedback endpoints — but its content is customer-facing, and its response field names come from the FAQ model rather than the `{ q, a }` pair the rider screen renders.
- **Required change:** either proxy the picker route to the FAQ service with an audience filter (`audience: 'rider'`) and map the fields to `{ q, a }`, or point the app at `/customer/faq` and map client-side. Proxying is preferable: it keeps the rider app on one namespace and lets rider-specific content be curated separately.

---

# 55. Support ticket list

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `SupportScreen.tsx`
- **Component:** not yet rendered — the screen currently shows only channels, FAQ and chat
- **Why:** a rider who raised an issue yesterday has no way to see its status. The route exists, so it will be reached for as soon as the screen grows a ticket list.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/support/tickets` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |

**Query params**

| Param | Type | Required | Validation |
| --- | --- | --- | --- |
| `status` | `"open" \| "in_progress" \| "resolved" \| "closed" \| "all"` | No | Default `"all"` |
| `page` / `limit` | `number` | No | Defaults 1 / 20 |

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.tickets[].id` | `string` | Yes | No |
| `data.tickets[].subject` | `string` | Yes | No |
| `data.tickets[].category` | `string` | Yes | Yes |
| `data.tickets[].status` | `string` | Yes | No |
| `data.tickets[].orderId` | `string` | Yes | Yes |
| `data.tickets[].lastMessageAt` | `string (ISO-8601)` | Yes | Yes |
| `data.tickets[].unreadCount` | `number` | Yes | No |
| `data.tickets[].createdAt` | `string (ISO-8601)` | Yes | No |
| `data.total` / `page` / `limit` / `totalPages` | `number` | Yes | No |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `401` | auth codes | |

### Existing Backend Comparison

- **Current backend contract:** `listSupportTickets` is a stub returning `{ userId, tickets: [], total: 0 }`.
- **Frontend expected contract:** the paginated list above.
- **Exact mismatches:** no implementation and no link to the real support module. A complete support system exists at `/api/v1/customer/support/tickets` (list, create with attachments, reopen, per-ticket messages) but is `authenticateCustomer`-gated, and its ticket model is keyed to `CustomerUser`.
- **Required change:** bridge the picker route to the support service with a rider requester type, so rider tickets land in the same admin queue as customer tickets rather than in a parallel system.

---

# 56. Create support ticket

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `SupportScreen.tsx` — the Email channel, and the escalation path from a failed delivery
- **Component:** the Email channel tile (which currently just shows a banner: "Compose to support@selorg.in — we reply within ~4 hours")
- **User action:** raises an issue
- **Why:** an in-app ticket is traceable; a mailto is not

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/support/tickets` |
| **Authentication** | Bearer picker JWT |
| **Headers** | `Content-Type: multipart/form-data` (for attachments) or `application/json` |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `subject` | `string` | Yes | 3–200 chars |
| `message` | `string` | Yes | 1–2000 chars |
| `category` | `"payment" \| "order" \| "account" \| "app" \| "other"` | No | Default `"other"` |
| `orderId` | `string` | No | Must belong to the rider |
| `batchId` | `string` | No | |
| `attachments` | binary[] | No | ≤ 3 files, ≤ 5 MB each, images or PDF |

### Response

`201 Created`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.id` | `string` | Yes | No |
| `data.ticketNumber` | `string` | Yes | No |
| `data.subject` | `string` | Yes | No |
| `data.status` | `"open"` | Yes | No |
| `data.createdAt` | `string (ISO-8601)` | Yes | No |
| `data.estimatedResponseHours` | `number` | Yes | Yes — backs the "~4 hrs" copy |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Missing subject or message |
| `401` | auth codes | |
| `403` | `ORDER_NOT_OWNED` | `orderId` belongs to another rider |
| `413` | `FILE_TOO_LARGE` | |
| `429` | `TOO_MANY_TICKETS` | Abuse guard |

### Existing Backend Comparison

- **Current backend contract:** `createSupportTicket` is a stub — `res.status(201).json(ResponseFormatter.success({ ticket: req.body }))`. It echoes the request and stores nothing, so a rider is shown a created ticket that does not exist.
- **Frontend expected contract:** a real ticket with a number the rider can quote.
- **Exact mismatches:** no persistence, no ticket number, no attachment handling, no order linkage, no routing into the support queue. The real implementation (`support.controller.createTicket` with `supportAttachmentUpload` middleware) is customer-authenticated; the public `POST /api/v1/support/tickets` accepts anonymous tickets but cannot associate them with the rider's account or orders.
- **Required change:** bridge to the support service with a rider requester type and attachment support, returning a real ticket number.

---

# 57. Support chat — read messages

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `SupportScreen.tsx` — the Live Chat channel and the message thread at the bottom
- **Component:** chat bubbles (`state.chat`), seeded with "Hi Arjun! How can we help you today?"
- **User action:** taps Live Chat and scrolls the thread
- **Why:** the chat is currently **entirely fake** — `SEND_CHAT` appends the rider's message locally and a 900 ms timer appends a canned reply ("Thanks! Our support team will look into this and get back to you shortly."). No message reaches support.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/support/chat/messages` |
| **Authentication** | Bearer picker JWT |
| **Authorization** | Rider (self only) |

**Query params**

| Param | Type | Required | Validation |
| --- | --- | --- | --- |
| `since` | `string (ISO-8601)` | No | Incremental fetch for polling |
| `limit` | `number` | No | 1–100, default 50 |

### Response

`200 OK`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.conversationId` | `string` | Yes | No |
| `data.status` | `"open" \| "closed"` | Yes | No |
| `data.agentOnline` | `boolean` | Yes | No — drives the "● Online" / "● Support online" indicators |
| `data.messages[].id` | `string` | Yes | No |
| `data.messages[].me` | `boolean` | Yes | No — matches the frontend `ChatMessage.me` |
| `data.messages[].text` | `string` | Yes | No |
| `data.messages[].senderName` | `string` | Yes | Yes |
| `data.messages[].createdAt` | `string (ISO-8601)` | Yes | No |
| `data.messages[].readAt` | `string (ISO-8601)` | Yes | Yes |
| `data.unreadCount` | `number` | Yes | No |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `401` | auth codes | |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** a rider support-chat module **does exist** — `/api/v1/rider/support-chat/conversation`, `/conversation/messages` (GET and POST) and `/conversation/read`, with a matching admin side (`/admin/support-chat/conversations`). It is unusable by this app because all four rider routes are guarded by **`authenticateCustomer`**, which verifies against `CUSTOMER_JWT_SECRET` and resolves the subject against the `CustomerUser` collection. A picker JWT's subject is a `PickerUser` id, so `resolveCustomerFromToken` returns `null` and every call gets `401 AUTH_TOKEN_INVALID`. The routes are named for riders but were wired to the customer identity system.
- **Proposed endpoint contract:** either (a) re-expose the same controllers under `/picker/support/chat/*` behind `authenticatePicker`, or (b) add a picker-aware auth path to the existing rider routes. Option (a) keeps the rider app on one namespace and one token type; either way the underlying conversation model and admin console are reused unchanged.
- **Expected request:** optional `since` and `limit`.
- **Expected response:** the thread above, with `me` computed server-side so the client does not need to know its own id.
- **Expected errors:** `401`.

---

# 58. Support chat — send message

### Status

`NEW`

### Frontend Usage

- **Frontend page:** `SupportScreen.tsx` — the composer row
- **Component:** `TextInput` plus the `SendIcon` button (`actions.sendChat`)
- **User action:** types a message and sends
- **Why:** see API 57 — the message currently never leaves the device

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/picker/support/chat/messages` |
| **Authentication** | Bearer picker JWT |
| **Headers** | `Content-Type: application/json` |

**Body**

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| `text` | `string` | Yes | 1–2000 chars after trimming; the frontend already rejects empty input |
| `orderId` | `string` | No | Context for the agent |
| `batchId` | `string` | No | |
| `clientMessageId` | `string` | No | For optimistic rendering and deduplication |

### Response

`201 Created`

| Field | Type | Required | Nullable |
| --- | --- | --- | --- |
| `data.id` | `string` | Yes | No |
| `data.clientMessageId` | `string` | Yes | Yes |
| `data.me` | `boolean` | Yes | No — always `true` |
| `data.text` | `string` | Yes | No |
| `data.createdAt` | `string (ISO-8601)` | Yes | No |
| `data.conversationId` | `string` | Yes | No |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | Empty or oversized message |
| `401` | auth codes | |
| `409` | `CONVERSATION_CLOSED` | Thread closed — prompt to open a ticket |
| `429` | `TOO_MANY_MESSAGES` | Flood guard |

### Existing Backend Comparison

- **Why existing APIs cannot satisfy the frontend:** as API 57 — `POST /api/v1/rider/support-chat/conversation/messages` exists and is implemented, but is gated by `authenticateCustomer` and unreachable with a picker token.
- **Proposed endpoint contract:** the same controller behind `authenticatePicker`, resolving or creating the rider's conversation from the token subject.
- **Expected request:** `{ text, orderId?, batchId?, clientMessageId? }`.
- **Expected response:** the persisted message.
- **Expected errors:** as above.
- **Follow-up:** remove the canned auto-reply from `RiderContext.sendChat` once this is live — showing a fabricated support response is worse than showing none.

---

# 59. Terms of Service

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `src/screens/profile/TermsScreen.tsx` (via `LegalScreen`)
- **Component:** a heading/body section list plus an "Effective 1 Jan 2026" date line
- **User action:** taps Terms of Service in Settings, or the legal line on the auth landing screen
- **Why:** a legal requirement. Currently served by the `TERMS` mock (5 sections) with a hard-coded date.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/legal/terms` |
| **Authentication** | None (public) — reachable before login |
| **Query params** | `version` (`string`, optional) — fetch a specific historical version |

### Response

`200 OK`

| Field | Type | Required | Nullable | Notes |
| --- | --- | --- | --- | --- |
| `data.version` | `string` | Yes | No | |
| `data.effectiveDate` | `string (ISO-8601)` | Yes | No | |
| `data.effectiveDateDisplay` | `string` | Yes | No | `"Effective 1 Jan 2026"` |
| `data.title` | `string` | Yes | No | |
| `data.sections[].h` | `string` | Yes | No | Matches the frontend `LegalSection` field names |
| `data.sections[].b` | `string` | Yes | No | |
| `data.contentHtml` | `string` | No | Yes | Fallback when the document is not sectioned |

### Error Responses

| Status | `appCode` | Meaning |
| --- | --- | --- |
| `404` | `DOCUMENT_NOT_FOUND` | Unknown version |
| `500` | — | |

### Existing Backend Comparison

- **Current backend contract:** the picker module has **two** stubs for this — `GET /picker/legal/terms` and `GET /rider/legal/terms` — both returning `{ terms: '' }`.
- **Frontend expected contract:** the sectioned document above.
- **Exact mismatches:**
  1. **No content.** Both routes return an empty string.
  2. **Shape.** The real legal module (`GET /api/v1/customer/legal/terms` → `legalService.getTerms(version)`, public and version-aware, with full admin CRUD and a `setCurrentDocument` flow) returns a document, not a `{ h, b }` section array. The rider app renders sections.
  3. **Audience.** The stored Terms are customer-facing; the rider Terms in the mock are rider-specific (eligibility, COD deposit obligations, ratings, termination) and are a genuinely different document.
- **Required change:** add a rider-audience legal document to the existing legal module, proxy `/picker/legal/terms` to `legalService`, and agree the representation — either store the document as sections, or return `contentHtml` and have `LegalScreen` render it. Storing sections keeps the current UI unchanged.

---

# 60. Privacy Policy

### Status

`MODIFY_REQUIRED`

### Frontend Usage

- **Frontend page:** `src/screens/profile/PrivacyScreen.tsx` (via `LegalScreen`)
- **Component:** the same section list, with "Last updated 12 Feb 2026"
- **User action:** taps Privacy Policy in Settings
- **Why:** legally required, and specifically load-bearing here — the mock policy's section 3 states that location is tracked only while online and that the rider may disable sharing in Settings. That promise must match what API 31 and API 50 actually do.

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/legal/privacy` |
| **Authentication** | None (public) |
| **Query params** | `version` (`string`, optional) |

### Response

Identical in shape to API 59, with `lastUpdatedDisplay` (`"Last updated 12 Feb 2026"`) in place of `effectiveDateDisplay`.

### Error Responses

Identical to API 59.

### Existing Backend Comparison

- **Current backend contract:** `GET /picker/legal/privacy` and `GET /rider/legal/privacy` are stubs returning `{ privacy: '' }`.
- **Frontend expected contract:** the sectioned document.
- **Exact mismatches:** as API 59 — no content, a shape mismatch against the real legal service, and a rider-specific document that does not exist in the store.
- **Required change:** as API 59. Additionally, `GET /picker/legal/config` (also a stub returning `{ config: {} }`) should return the acceptance requirements the auth landing screen implies ("By continuing you agree to Selorg's Terms of Service & Privacy Policy") — the real `legalService.getLoginLegalConfig()` already does exactly this for customers, and `POST /customer/legal/accept` records consent. Consider a picker equivalent so rider consent is auditable.

---

# Appendix A — Frontend API clients as they stand today

For the implementer's reference, this is what `src/services/api/*` calls right now, and how each maps
to this contract.

| Client method | Calls today | Contract | Note |
| --- | --- | --- | --- |
| `authApi.sendOtp` | `POST /picker/auth/send-otp` or `/send-otp-email` | 1, 3 | Defined but **not called** by `LoginScreen` |
| `authApi.verifyOtp` | `POST /picker/auth/verify-otp` or `/verify-otp-email` | 4, 5 | Defined but **not called** by `OtpScreen` |
| `authApi.logout` | none — clears an in-memory variable | 6 | No server call |
| `orderApi.listAvailable` | `GET /picker/shared-orders/assignorders` → `data.orders` | 26 | Not called by `OrdersScreen` |
| `orderApi.getBagItems` | `GET /picker/shared-orders/:id` → `data.items` | 27 | Not called by `BagScreen` |
| `orderApi.accept` | `PUT /picker/shared-orders/:id/status` `{status:'accepted'}` | 28 | Not called |
| `orderApi.confirmPickup` | `PUT .../status` `{status:'picked_up'}` | 28 | Not called |
| `orderApi.confirmDelivery` | `POST /picker/shared-orders/:id/complete` `{otp, photo}` | 30 | **The only live API call in the app** (`PhotoScreen.tsx:30`) |
| `orderApi.cancel` | `PUT .../status` `{status:'cancelled', reason, note}` | 28 | Not called |
| `bulkApi.getBatch` | `GET /picker/bulk/batch` → `data.id`, `data.orders` | 32 | **404 — route does not exist** |
| `bulkApi.loadBag` | `POST /picker/bulk/bag/load` | 33 | **404** |
| `bulkApi.startDelivery` | `POST /picker/bulk/start` | 34 | **404** |
| `bulkApi.markDelivered` | `POST /picker/bulk/stops/:idx/deliver` | 37 | **404** |
| `bulkApi.markFailed` | `POST /picker/bulk/stops/:idx/fail` | 38 | **404** |
| `riderApi.getShifts` | `GET /picker/shifts/available` | 18 | Not called by `ShiftsScreen` |
| `riderApi.bookShift` | `POST /picker/shifts/select` (book only) | 19, 20 | Unbook silently no-ops |
| `riderApi.getEarningsSummary` | `GET /picker/wallet/earnings-breakdown` | 41 | Shape disagrees with `EarningsScreen` |
| `riderApi.getDailyBreakdown` | `GET /picker/wallet/history` → `data.history` | 42 | Not called |
| `riderApi.getHistory` | `GET /picker/wallet/transactions` → `data.transactions` | 45 | **Wrong endpoint** — wallet ledger, not deliveries |
| `riderApi.recordDeposit` | `POST /picker/wallet/deposit` → `data.ref` | 48 | **404 — route does not exist**; falls back to a client-generated `ref` |

# Appendix B — Enum reference

| Concept | Frontend values | Backend today | Contract |
| --- | --- | --- | --- |
| Login method | `mobile \| whatsapp \| email` | `mobile \| whatsapp \| email` | unchanged |
| Account status | `none \| pending \| approved` (+ Rejected screen) | `PENDING \| ACTIVE \| INACTIVE \| REJECTED \| SUSPENDED` | `pending \| active \| inactive \| rejected \| suspended` (API 4, 8) |
| Onboarding status | implicit | none | `not_started \| in_progress \| under_review \| approved \| rejected` (API 10) |
| Document type | `aadhar \| pan \| dl \| rc \| ins` | free `String` | enumerated (API 12) |
| Document status | implicit "Verified" | `pending \| approved \| rejected` | `missing \| pending \| approved \| rejected` (API 10, 13) |
| Order rider stage | `accept \| travel \| bag \| nav \| photo \| complete` (screen names) | `Order.status` has no rider stages | `offered \| accepted \| picked_up \| delivered \| cancelled` (API 26, 28) |
| Order status | not consumed | `pending \| confirmed \| getting-packed \| on-the-way \| arrived \| delivered \| cancelled` | unchanged; rider stage is separate |
| Cancel reason | `unreachable \| refused \| address \| asked \| vehicle \| other` | free string | enumerated (API 28, 53) |
| Bulk exception reason | `unreachable \| refused \| address \| other` | none | enumerated (API 38, 53) |
| Bulk batch status | `assigned \| loading \| ready \| dispatched \| in_transit \| completed` | none | unchanged (API 32) |
| Bulk stop status | `pending \| delivered \| failed` | none | unchanged (API 32) |
| Bulk stop phase | `toNav \| navigating \| arrived` | none | `to_nav \| navigating \| arrived` (API 32, 35) |
| Shift status | booked / not booked | `SCHEDULED \| ACTIVE \| COMPLETED \| CANCELLED` | `open \| full \| closed \| started \| completed` (API 18) |
| Shift assignment | implicit | `ASSIGNED \| STARTED \| COMPLETED \| CANCELLED \| NO_SHOW` | unchanged (API 21) |
| Deposit method | `upi \| bank \| card` | none | unchanged (API 48) |
| Vehicle type | `bike \| scooter \| ev \| cycle` (onboarding), `motorcycle \| auto \| van` (`VehicleType`) | none | `bike \| scooter \| ev \| cycle \| auto \| van` (API 8, 9) — **the frontend's two vehicle vocabularies must be reconciled** |
| Delivery mode | `standard \| bulk` | none | unchanged; derived server-side (API 8) |
| Payment mode | not consumed | `card \| upi \| cash \| wallet \| digital` | `cod \| prepaid` at the rider boundary (API 26) |
| Language | `English \| हिन्दी \| ಕನ್ನಡ \| தமிழ் \| తెలుగు` | none | ISO codes `en \| hi \| kn \| ta \| te` (API 49) |
