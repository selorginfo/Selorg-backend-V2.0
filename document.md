# Selorg Service — File Architecture & Structure Reference

**Project:** `selorg-service`  
**Stack:** Node.js · TypeScript · Express · Mongoose · Zod · Redis (optional)  
**Purpose of this document:** Explain how the backend is organized on disk so the same layout and conventions can be reused when building another project’s backend.  
**Scope:** File architecture, naming conventions, layering, and wiring — not a full route catalog or business-logic dump.

---

## 1. Design goals (why it looks like this)

| Goal | How the structure supports it |
|------|-------------------------------|
| Feature isolation | One folder per domain under `src/modules/` owns routes, controllers, services, models, validation |
| Clear request pipeline | Shared middleware + utilities sit outside modules; modules plug into `app.ts` |
| Type-safe validation | Zod schemas live next to the feature (`*.validation.ts`) and run via a shared `validate()` middleware |
| Multi-audience API | Same codebase serves customer, admin, picker, rider, darkstore, vendor, finance under versioned prefixes |
| Gradual migration | Legacy monolith was split module-by-module; each module is independently mountable |
| Fail-fast ops | Env validation and DB connect happen in `server.ts` before listen |

This is a **modular monolith**: one deployable process, feature folders instead of microservices.

---

## 2. Repository root layout

```
selorg-service/
├── src/                    # All application TypeScript source
├── dist/                   # Compiled JS output (`tsc` → outDir)
├── logs/                   # Runtime log files (Winston / local)
├── node_modules/
├── .env                    # Local secrets (not committed)
├── .env.example            # Documented env template (safe to commit)
├── .gitignore
├── package.json            # Scripts, dependencies
├── package-lock.json
├── tsconfig.json           # Strict TS, path alias `@/*` → `src/*`
├── README.md               # Project overview / port status
└── document.md             # This architecture reference
```

**Root rules for a new project:**

- Keep **all** application code under `src/`.
- Keep secrets in `.env` / `.env.production`; document keys only in `.env.example`.
- Build artifact goes to `dist/`; never edit `dist/` by hand.
- `package.json` scripts should register path aliases at runtime (`tsconfig-paths/register`) for both `dev` and `start`.

### 2.1 Scripts (from `package.json`)

| Script | Role |
|--------|------|
| `dev` | `ts-node-dev` on `src/server.ts` with path alias registration |
| `build` | `tsc -p tsconfig.json` → `dist/` |
| `start` | Build then run `dist/server.js` with path aliases |
| `typecheck` | `tsc --noEmit` |
| `lint` | ESLint on `.ts` |
| `test` | Jest |

### 2.2 TypeScript path alias

```json
"baseUrl": "src",
"paths": { "@/*": ["*"] }
```

Imports may use `@/modules/...`, `@/utils/...`, etc., resolving from `src/`. Relative imports within a module (`./auth.service`) are still common and fine.

---

## 3. `src/` top-level architecture

```
src/
├── server.ts          # Process bootstrap: env → DB → HTTP listen
├── app.ts             # Express app factory: middleware stack + route mounts
├── config/            # Environment, CORS, RBAC, Swagger, domain config
├── database/          # MongoDB + Redis connection helpers
├── middleware/        # Cross-cutting Express middleware
├── modules/           # Feature modules (primary business code)
├── services/          # Shared infrastructure services (SMS, email, S3, …)
├── types/             # Shared TS types + Express Request augmentation
└── utils/             # Pure helpers: errors, responses, auth crypto, logging
```

### Responsibility split (memorize this)

| Folder | Owns | Must not own |
|--------|------|--------------|
| `config/` | Typed config objects, allow-lists, Swagger setup | HTTP handlers, DB queries |
| `database/` | Connection lifecycle, pool health | Feature schemas / business rules |
| `middleware/` | Auth, validation, cache, errors used by many modules | Feature-specific business logic |
| `modules/<feature>/` | That feature’s HTTP surface + domain logic + persistence | Global app wiring (that stays in `app.ts`) |
| `services/` | Reusable integrations (email, SMS, S3, pricing, audit) | Feature-only controllers/routes |
| `types/` | Shared contracts / Express globals | Runtime behavior |
| `utils/` | Small reusable helpers | Express routers |
| `app.ts` | Middleware order + `app.use(path, router)` | Business logic |
| `server.ts` | Startup / shutdown process concerns | Route definitions |

---

## 4. Bootstrap flow

```
server.ts
  │
  ├─ import './config/env'          # Load .env before anything else
  ├─ validateEnvironment()
  ├─ validateJWTSecret()
  ├─ createApp()                    # from app.ts
  ├─ connectDB() / waitForConnection()
  └─ httpServer.listen(port, host)
```

### 4.1 `server.ts`

- Single `bootstrap()` async function.
- Exits process on missing/invalid env or DB failure.
- Registers `unhandledRejection` / `uncaughtException` handlers.
- Skips listen when `NODE_ENV === 'test'` (exports `bootstrap` for tests).

### 4.2 `app.ts` (`createApp()`)

Order of concerns (preserve this order when cloning):

1. **Request ID** (`X-Request-ID` / `req.id`)
2. **Request logging**
3. **Health endpoints** (`/health`, `/healthz`, `/health/db`, `/health/ready`) — before auth
4. **CORS** (OPTIONS short-circuit, then `cors` middleware)
5. **Security** — Helmet, mongo-sanitize, HPP, XSS-clean, compression
6. **Body parsers** — `express.json` / `urlencoded` (size limits)
7. **API envelope middleware** — normalizes `res.json` shapes
8. **Rate limit** on `/api/v1`
9. **Module routers** mounted under `/api/v1/...`
10. **Swagger** at `/api-docs` (non-prod or `ENABLE_SWAGGER=true`)
11. **404** then **global error handler** (always last)

`createApp()` returns the Express instance; it does **not** connect to Mongo or listen.

---

## 5. Feature module pattern (core convention)

### 5.1 Canonical file set

For a typical feature (example: `auth`, `cart`, `addresses`):

```
src/modules/<feature>/
├── <feature>.routes.ts        # Express Router: path → middleware → controller
├── <feature>.controller.ts    # HTTP adapter: parse req, call service, format res
├── <feature>.service.ts       # Business rules / orchestration
├── <feature>.repository.ts    # Mongoose / data-access helpers
├── <feature>.model.ts         # Schemas, interfaces, models
└── <feature>.validation.ts    # Zod schemas + inferred input types
```

**Request flow inside a module:**

```
HTTP
  → routes.ts          (auth middleware?, validate(schema), controller)
    → controller.ts    (try/catch → next(err); ResponseFormatter)
      → service.ts     (rules; throw AppError)
        → repository.ts / model.ts
        → (optional) ../../services/*.service.ts
```

### 5.2 Layer rules

| Layer | Does | Does not |
|-------|------|----------|
| **routes** | Bind method/path; attach `validate`, auth, permission middleware; OpenAPI comments | Contain business logic |
| **controller** | Read `req.body/params/query/user/customer`; call service; `res.status().json(ResponseFormatter...)`; `next(err)` | Talk to Mongoose directly (prefer service/repo) |
| **service** | Domain logic, orchestration, call repos + shared services | Know about Express `Request`/`Response` (except rare IP/UA passthrough) |
| **repository** | Queries, creates, updates, lean selects | HTTP status decisions |
| **model** | Schema definition, indexes, document interfaces | Route wiring |
| **validation** | Zod schemas; export `z.infer` types for controllers | Side effects |

### 5.3 Naming conventions

| Pattern | Meaning |
|---------|---------|
| `*.routes.ts` | Default-export (or named) Express `Router` |
| `*.controller.ts` | Named exports: one function per handler |
| `*.service.ts` | Named exports: business functions |
| `*.repository.ts` | Named exports: data access |
| `*.model.ts` / `*.models.ts` | Mongoose model(s) — singular or plural both appear |
| `*.validation.ts` | Zod schemas + `export type XInput = z.infer<typeof xSchema>` |
| `*.constants.ts` | Feature-local constants |
| `*-upload.middleware.ts` | Feature-local Multer/upload middleware |
| `adminRouter` / `publicRouter` named exports | Extra routers from the same module mounted at different paths in `app.ts` |

### 5.4 Variations by module maturity

Not every module has all six files. When cloning the architecture, treat the six-file set as the **default**, and use these known variations only when needed:

| Variation | Examples | When |
|-----------|----------|------|
| Full 6-file set | `auth`, `cart`, `addresses`, `faq`, `wallet`, … | Standard CRUD / customer features |
| No validation file | `banners`, ops modules | Simple/read-heavy or validated elsewhere |
| No repository (service uses models directly) | `darkstore`, `finance`, `picker`, `rider`, `vendor`, `payments` | Large/port-style modules or gateway logic |
| Models only / shared data | `store`, `app-config` | Shared persistence used by other modules |
| Thin HTTP-only | `invoice` (controller + routes) | Delegates to other services |
| Mega-module (many co-located sub-features) | `admin/` | One URL namespace, many controllers/routers composed in `admin.routes.ts` |
| Extra domain helpers beside the core set | `products.variants.ts`, `orders/cancellation.service.ts`, `payments/worldline.service.ts` | Keep related logic in the same folder; avoid dumping into `utils/` |

### 5.5 Dual routers from one module

Some modules export more than one router so customer and admin surfaces stay co-located:

```ts
// e.g. legal.routes.ts
export default router;           // customer
export const adminRouter = ...;  // admin CRUD for same domain
```

Mounted in `app.ts` at different prefixes, for example:

- `/api/v1/customer/legal`
- `/api/v1/customer/admin/legal`

Same idea for FAQ, onboarding, coupons, support (`publicRouter`), picker (`pickerAdminRouter`).

---

## 6. Module inventory & API mount map

### 6.1 Modules under `src/modules/`

| Module folder | Role (high level) |
|---------------|-------------------|
| `auth` | Customer OTP login / logout / link-phone |
| `user` | Customer profile (uses auth model via repository) |
| `addresses` | Delivery addresses |
| `onboarding` | Onboarding pages / flow |
| `legal` | Terms / privacy content |
| `faq` | FAQ content |
| `banners` | Marketing banners |
| `notifications` | Customer notifications / push prefs |
| `categories` | Catalog taxonomy |
| `products` | Catalog, variants, stock helpers |
| `cart` | Shopping cart |
| `coupons` | Coupon apply / admin coupon management |
| `orders` | Place/track orders, cancellation, refund-request models |
| `payments` | Payment methods + Worldline gateway |
| `wallet` | Wallet balance & transactions |
| `refunds` | Refund flows |
| `invoice` | Invoice download/view endpoints |
| `support` | Support tickets + attachments |
| `admin` | Dashboard auth, RBAC, master data, config, compliance, fraud, analytics, … |
| `store` | Shared store / dark-store models + repository |
| `app-config` | App config model |
| `darkstore` | Darkstore / warehouse ops API |
| `picker` | Picker app + admin picker routes |
| `rider` | Rider / dispatch / shifts |
| `vendor` | Vendor admin API |
| `finance` | Finance admin API |

### 6.2 Mount points in `app.ts`

| Mount path | Module entry |
|------------|--------------|
| `/api/v1/customer/auth` | `modules/auth` |
| `/api/v1/customer/legal` (+ `/customer/admin/legal`) | `modules/legal` |
| `/api/v1/customer/faq` (+ `/customer/admin/faq`) | `modules/faq` |
| `/api/v1/customer/banners` | `modules/banners` |
| `/api/v1/customer/onboarding` (+ admin onboarding-pages) | `modules/onboarding` |
| `/api/v1/customer/user` | `modules/user` |
| `/api/v1/customer/addresses` | `modules/addresses` |
| `/api/v1/customer/notifications` | `modules/notifications` |
| `/api/v1/customer/products` | `modules/products` |
| `/api/v1/customer/categories` | `modules/categories` |
| `/api/v1/customer/cart` | `modules/cart` |
| `/api/v1/customer/orders` | `modules/orders` (+ `invoice` also under orders) |
| `/api/v1/customer/payments` | `modules/payments` |
| `/api/v1/customer/wallet` | `modules/wallet` |
| `/api/v1/customer/coupons` (+ `/customer/admin/coupons`) | `modules/coupons` |
| `/api/v1/customer/refunds` | `modules/refunds` |
| `/api/v1/customer/support` | `modules/support` |
| `/api/v1/support` | `modules/support` public router |
| `/api/v1/admin` | `modules/admin` |
| `/api/v1/rider` | `modules/rider` |
| `/api/v1/picker` | `modules/picker` |
| `/api/v1/admin/picker` | `modules/picker` admin router |
| `/api/v1/darkstore` | `modules/darkstore` |
| `/api/v1/admin/vendor` | `modules/vendor` |
| `/api/v1/admin/finance` | `modules/finance` |

**URL versioning convention:** everything public API lives under `/api/v1/...`, then an audience segment (`customer`, `admin`, `picker`, `rider`, `darkstore`).

---

## 7. Shared infrastructure folders

### 7.1 `src/config/`

| File | Purpose |
|------|---------|
| `env.ts` | Load dotenv (`.env` / `.env.production` / `DOTENV_PATH`); export `appConfig`; `validateEnvironment()` |
| `cors.ts` | Allowed-origin helper used by CORS middleware and error handler |
| `permissions.ts` | RBAC permission constants + role defaults (`PERMISSIONS`, helpers) |
| `otp.ts` | OTP-related config helpers |
| `paymentCrypto.ts` | Payment crypto config |
| `swagger.ts` | OpenAPI / swagger-jsdoc spec |

**Pattern for a new project:** one `env.ts` that is imported first from `server.ts` and `app.ts` so `process.env` is populated before other modules read it.

### 7.2 `src/database/`

| File | Purpose |
|------|---------|
| `mongoose.ts` | Connect, disconnect, pool health, optional SRV DNS resolution (esp. Windows) |
| `redis.ts` | Optional Redis client; in-memory fallback when disabled/unavailable |

### 7.3 `src/middleware/`

| File | Purpose |
|------|---------|
| `auth.middleware.ts` | `authenticateAdmin`, `authenticateCustomer`, `optionalCustomerAuth`, `requireRole`, `requirePermission`, JWT secret validation |
| `validate.middleware.ts` | `validate(zodSchema, 'body' \| 'query' \| 'params')` → 422 on failure |
| `error.middleware.ts` | `apiEnvelopeMiddleware`, `notFoundMiddleware`, `errorHandlerMiddleware` |
| `cache.middleware.ts` | Response caching helpers |

**Auth identity split (important):**

- Admin / dashboard JWT → `req.user` (`AdminAuthUser`)
- Customer JWT → `req.customer` (`CustomerAuthUser`)

Do not overload a single `req.user` for both audiences in a unified TypeScript codebase.

Picker has its **own** auth middleware inside `modules/picker/picker.auth.middleware.ts` (feature-local auth is allowed when the audience is not the shared admin/customer pair).

### 7.4 `src/services/` (cross-cutting)

Used by many modules; **not** mounted as HTTP routers:

| File | Concern |
|------|---------|
| `sms.service.ts` | OTP / SMS / WhatsApp providers |
| `email.service.ts` | Transactional email providers + SMTP |
| `s3.service.ts` | Object storage uploads |
| `webpush.service.ts` | Web push |
| `geocoding.service.ts` | Address geocoding |
| `audit.service.ts` | Audit log writes |
| `pricing.service.ts` / `deliveryPricing.service.ts` / `deliveryRuntime.service.ts` | Pricing / delivery calculations |
| `platformConfig.service.ts` (+ model) | Runtime platform configuration |

**Rule:** if logic is an external integration or shared across ≥2 features, put it in `services/`. If it is feature-owned business logic, keep it in `modules/<feature>/`.

### 7.5 `src/utils/`

| File | Purpose |
|------|---------|
| `AppError.ts` | Typed HTTP errors (`badRequest`, `unauthorized`, …) consumed by error middleware |
| `response.ts` | `ResponseFormatter` success / paginated / error / validation envelopes |
| `auth.ts` | JWT secrets accessors, OTP hash/verify, token blocklist, sign helpers |
| `logger.ts` | Winston (or similar) structured logging |
| `cache.ts` | Cache get/set helpers |
| `customerDisplay.ts` / `catalogHygiene.ts` / `catalogMediaFields.ts` / `mediaEnrichment.ts` | Domain presentation / media helpers |

### 7.6 `src/types/`

| File | Purpose |
|------|---------|
| `common.ts` | `ApiSuccessResponse`, `ApiErrorResponse`, `PaginationMeta`, etc. |
| `express.d.ts` | Augments `Express.Request` with `id`, `user`, `customer`, `rawBody` |
| `xss-clean.d.ts` | Ambient types for untyped dependency |

---

## 8. Cross-cutting response & error contracts

### 8.1 Success / error envelope

Controllers prefer:

```ts
res.status(200).json(ResponseFormatter.success(data, 'Optional message'));
```

Shape (see `types/common.ts`):

```ts
{
  success: boolean;
  message: string;
  data: T | null;
  error: { code, message, details? } | null;
  pagination: PaginationMeta | null;
  timestamp: string; // ISO
}
```

`apiEnvelopeMiddleware` wraps raw `res.json({...})` objects that lack a `success` field so older/partial handlers still emit a consistent envelope (skipped for health, swagger, webhooks/callbacks).

### 8.2 Errors

- Throw `AppError` (or static helpers) from services.
- Controllers catch and `next(err)`.
- `errorHandlerMiddleware` maps Mongo validation / cast / duplicate key / JWT errors to status codes and the standard envelope.

### 8.3 Validation

```ts
// routes
router.post('/send-otp', validate(sendOtpSchema), authController.sendOtp);
```

On failure → **422** with `{ field, message }[]` via `ResponseFormatter.validationError`.

---

## 9. `admin` mega-module structure

`modules/admin/` is intentionally denser: many sub-domains share `/api/v1/admin`.

Typical composition:

```
admin/
├── admin.routes.ts              # Composes sub-routers; applies authenticateAdmin
├── admin.validation.ts          # Shared Zod for auth/users/roles/permissions
├── admin.repository.ts
├── admin-auth.controller.ts / admin-auth.service.ts
├── admin-users.* / roles.* / permissions.*
├── master-data.* / store-warehouse.* / integration.*
├── system-config.* / platform-config.* / app-settings.*
├── compliance.* / fraud.* / analytics.* / notification-campaign.*
├── activity-logs.*
└── *.model.ts                   # Roles, permissions, feature flags, etc.
```

Pattern:

1. Build small `Router()` instances per sub-area (users, roles, …).
2. Mount them from `admin.routes.ts` under paths like `/users`, `/roles`.
3. Protect with `authenticateAdmin` + `requirePermission(PERMISSIONS.…)` from shared middleware/config.
4. Export one default router mounted at `/api/v1/admin` in `app.ts`.

Use this pattern when a single audience has many sub-features that should stay versioned under one prefix.

---

## 10. Environment & configuration layout

### 10.1 Files

- `.env.example` — committed template, grouped by section (Core, Redis, Cache, OTP, SMS, Email, Swagger, …).
- `.env` — local runtime (gitignored).
- Optional `.env.production` — selected when `NODE_ENV=production` (see `config/env.ts`).

### 10.2 Minimum bootstrap secrets (from template)

- `MONGO_URI` (or `MONGODB_URI`)
- `JWT_SECRET` (≥ 32 chars; admin/dashboard)
- `CUSTOMER_JWT_SECRET` (customer tokens)
- `ALLOWED_ORIGINS` (recommended)
- `PORT` / `HOST` / `NODE_ENV` / `API_VERSION`

Provider keys (SMS, email, S3, payment) stay env-driven — no checked-in `config.json` for vendors.

---

## 11. Security & middleware stack (structural)

Applied globally in `app.ts` (not per module):

- Helmet (API-tuned: CSP off for JSON APIs)
- `express-mongo-sanitize`
- `hpp`
- `xss-clean`
- Compression
- Rate limiting on `/api/v1`
- CORS with credentials + explicit headers (`Authorization`, `X-Request-ID`, `Idempotency-Key`, …)

Per-route / per-router:

- JWT auth middleware
- Zod `validate`
- Permission / role guards
- Feature upload middleware (Multer) next to the feature that needs it

---

## 12. How to replicate this architecture for a new backend

Use this checklist when scaffolding another project from this layout:

### Step A — Skeleton

```
src/
  server.ts
  app.ts
  config/env.ts
  config/cors.ts
  database/mongoose.ts
  middleware/auth.middleware.ts
  middleware/validate.middleware.ts
  middleware/error.middleware.ts
  types/common.ts
  types/express.d.ts
  utils/AppError.ts
  utils/response.ts
  utils/logger.ts
  utils/auth.ts
  modules/
  services/
```

### Step B — Conventions to copy verbatim

1. **One folder per feature** under `modules/`.
2. **Six-file default** (`routes` → `controller` → `service` → `repository` → `model` + `validation`).
3. **Mount only in `app.ts`** — modules export routers; they do not `listen`.
4. **Versioned prefixes** — `/api/v1/<audience>/<feature>`.
5. **Zod + `validate()`** for inputs; export inferred types to controllers.
6. **`ResponseFormatter` + `AppError` + global error middleware**.
7. **Separate auth principals** on `Request` (`user` vs `customer`, or equivalent audiences).
8. **Shared integrations in `services/`**, feature logic in `modules/`.
9. **Env load first**, validate before DB connect and listen.
10. **Path alias `@/*`** + `tsconfig-paths` in npm scripts.

### Step C — Adding a new feature (template)

1. Create `src/modules/<name>/` with the six files.
2. Implement Zod schemas → routes with `validate` → thin controllers → service → repository/model.
3. Import the router in `app.ts` and `app.use('/api/v1/...', router)`.
4. Add OpenAPI JSDoc on routes if Swagger is enabled.
5. Add any new env keys to `.env.example` only (never commit secrets).

### Step D — What not to copy blindly

- Selorg-specific payment providers, SMS vendors, darkstore/picker/rider domains.
- The large `admin/` surface — start with auth + one CRUD feature, grow into a mega-module only when needed.
- Ops modules that skip repository/validation — prefer the full six-file pattern for greenfield work.

---

## 13. Mental model diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         server.ts                           │
│              env validate → DB → listen(port)               │
└───────────────────────────┬─────────────────────────────────┘
                            │ createApp()
┌───────────────────────────▼─────────────────────────────────┐
│                          app.ts                             │
│  requestId → log → health → cors → security → body →        │
│  envelope → rateLimit → [module routers] → 404 → errors     │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   modules/*            middleware/          services/
   (feature HTTP        (auth, zod,          (sms, email,
    + domain)            cache, errors)       s3, audit, …)
        │                   │                   │
        └─────────┬─────────┴─────────┬─────────┘
                  ▼                   ▼
              database/            utils/ + types/
              (mongo, redis)       (AppError, ResponseFormatter, …)
```

---

## 14. Quick reference — “where does X go?”

| If you are adding… | Put it in… |
|--------------------|------------|
| A new REST resource | `src/modules/<feature>/` (full file set) + mount in `app.ts` |
| A Zod request schema | `modules/<feature>/<feature>.validation.ts` |
| JWT / permission check used by many modules | `middleware/auth.middleware.ts` + `config/permissions.ts` |
| SMS / email / S3 call | `services/<name>.service.ts` |
| Shared response shape | `utils/response.ts` + `types/common.ts` |
| Env flag / secret | `.env.example` (+ read in `config/env.ts` if typed config needed) |
| Express `req` field | `types/express.d.ts` |
| Mongoose connection tuning | `database/mongoose.ts` |
| Admin-only sub-feature under existing admin API | Files inside `modules/admin/` composed by `admin.routes.ts` |
| Customer + admin APIs for same content | One module, two routers (`default` + `adminRouter`) |

---

## 15. Summary

`selorg-service` is organized as a **TypeScript Express modular monolith**:

- **Process edge:** `server.ts` + `app.ts`
- **Shared platform:** `config/`, `database/`, `middleware/`, `services/`, `utils/`, `types/`
- **Business surface:** `modules/<feature>/` with a consistent **routes → controller → service → repository → model (+ validation)** file architecture
- **HTTP composition:** all public mounts declared in one place (`app.ts`) under `/api/v1/...`

Reusing this structure for another backend means copying the **folder contracts and layering rules**, then filling modules with that product’s domains — not copying Selorg business routes wholesale.
