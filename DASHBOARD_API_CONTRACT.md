# API Contract — Dashboard Endpoints (selorg-service)

Contract for **every route whose path contains `/dashboard`**, plus the closely related
picker home/incentive reads that back mobile Home dashboards. Derived from route mounts in
`src/app.ts` and the module routers/controllers/services under `src/modules/*`.

- **Base URL:** `{API_BASE}/api/v1`
- **Transport:** JSON over HTTPS
- **Scope:** dashboard aggregates only — not full finance/darkstore/production CRUD surfaces

## Standard response envelope

Most handlers use `ResponseFormatter.success(payload)`:

```json
{
  "success": true,
  "message": "Success",
  "data": { },
  "error": null,
  "pagination": null,
  "timestamp": "2026-09-10T10:15:00.000Z"
}
```

Errors:

```json
{
  "success": false,
  "message": "…",
  "data": null,
  "error": {
    "code": 400,
    "appCode": "VALIDATION_ERROR",
    "title": "Bad Request",
    "message": "…",
    "detail": "…",
    "details": null
  },
  "pagination": null,
  "timestamp": "2026-09-10T10:15:00.000Z"
}
```

> **Envelope caveat.** `apiEnvelopeMiddleware` only wraps bodies that lack a top-level
> `success`. Production (and a few stubs) already return `{ success: true, … }` with fields
> **outside** `data` — those pass through unchanged. Each section below states which form applies.

## Auth summary

| Audience | Middleware | Used by |
| --- | --- | --- |
| Admin / ops dashboard JWT | `authenticateAdmin` | finance, darkstore, production (+ role), shared, vendor, rider dashboard |
| HHD operator JWT | `protect` (`req.hhdUser`) | `GET /hhd/dashboard` |
| Picker / rider JWT | `authenticatePicker` (+ `requireActivePicker` where noted) | picker home / dashboard / incentives |

## Contract index

| # | Module | Method | Endpoint | Status |
| --- | --- | --- | --- | --- |
| 1 | Finance | `GET` | `/admin/finance/dashboard/summary` | `EXISTING` |
| 2 | Finance | `GET` | `/admin/finance/dashboard/payment-method-split` | `EXISTING` |
| 3 | Finance | `GET` | `/admin/finance/dashboard/live-transactions` | `EXISTING` |
| 4 | Finance | `GET` | `/admin/finance/dashboard/daily-metrics` | `EXISTING` |
| 5 | Finance | `GET` | `/admin/finance/dashboard/gateway-status` | `EXISTING` |
| 6 | Finance | `GET` | `/admin/finance/dashboard/hourly-trends` | `EXISTING` |
| 7 | Finance | `GET` | `/admin/finance/dashboard/wallet-liability` | `STUB` |
| 8 | Finance | `POST` | `/admin/finance/dashboard/export` | `STUB` |
| 9 | Darkstore | `GET` | `/darkstore/dashboard/summary` | `EXISTING` |
| 10 | Darkstore | `GET` | `/darkstore/dashboard/store-profile` | `STUB` |
| 11 | Darkstore | `GET` | `/darkstore/dashboard/warehouse-profile` | `STUB` |
| 12 | Darkstore | `GET` | `/darkstore/dashboard/staff-load` | `EXISTING` |
| 13 | Darkstore | `GET` | `/darkstore/dashboard/stock-alerts` | `EXISTING` |
| 14 | Darkstore | `GET` | `/darkstore/dashboard/rto-alerts` | `EXISTING` |
| 15 | Darkstore | `GET` | `/darkstore/dashboard/live-orders` | `EXISTING` |
| 16 | Darkstore | `GET` | `/darkstore/dashboard/alert-history` | `EXISTING` |
| 17 | Darkstore | `POST`/`GET` | `/darkstore/dashboard/refresh` | `STUB` |
| 18 | Production | `GET` | `/production/dashboard/summary` | `EXISTING` |
| 19 | Production | `GET` | `/production/dashboard/alerts` | `EXISTING` |
| 20 | Production | `PUT` | `/production/dashboard/alerts/:alertId/status` | `EXISTING` |
| 21 | Production | `DELETE` | `/production/dashboard/alerts/resolved` | `EXISTING` |
| 22 | Production | `GET` | `/production/dashboard/alerts/:alertId` | `EXISTING` |
| 23 | Production | `GET` | `/production/dashboard/incidents` | `EXISTING` |
| 24 | Production | `POST` | `/production/dashboard/incidents` | `EXISTING` |
| 25 | Production | `PUT` | `/production/dashboard/incidents/:incidentId/status` | `EXISTING` |
| 26 | Production | `GET` | `/production/dashboard/reports` | `EXISTING` |
| 27 | Production | `GET` | `/production/dashboard/reports/export` | `EXISTING` |
| 28–39 | Production | * | `/production/dashboard/{legacy,utilities}/*` | `STUB` |
| 40 | Shared | `GET` | `/shared/dashboard/summary` | `STUB` |
| 41 | Vendor | `GET` | `/admin/vendor/dashboard/summary` | `EXISTING` |
| 42 | Rider | `GET` | `/rider/dashboard/counts` | `EXISTING` |
| 43 | Rider | `GET` | `/rider/hr/dashboard/summary` | `EXISTING` |
| 44 | Rider | `GET` | `/rider/notifications` | `EXISTING` |
| 45 | Rider | `PUT` | `/rider/notifications/:notificationId/read` | `EXISTING` |
| 46 | Rider | `POST` | `/rider/notifications/read-all` | `EXISTING` |
| 47 | HHD | `GET` | `/hhd/dashboard` | `EXISTING` |
| 48 | Picker | `GET` | `/picker/home/summary` | `EXISTING` |
| 49 | Picker | `GET` | `/picker/dashboard/today` | `EXISTING` |
| 50 | Picker | `GET` | `/picker/incentives/today` | `EXISTING` |

---

# 1. Finance dashboard summary

### Status

`EXISTING`

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/admin/finance/dashboard/summary` |
| **Authentication** | Bearer admin JWT (`authenticateAdmin`) |

**Query**

| Param | Type | Required | Notes |
| --- | --- | --- | --- |
| `entityId` | `string` | No | Filters `FinanceSummary` / fallback aggregates |

### Response

`200 OK` — envelope; `data` is either the latest `FinanceSummary` document or an aggregate fallback:

| Field | Type | Notes |
| --- | --- | --- |
| `totalReceivedToday` | `number` | |
| `totalReceivedChangePercent` | `number` | |
| `pendingSettlementsAmount` | `number` | |
| `pendingSettlementsGateways` | `number` | |
| `vendorPayoutsAmount` | `number` | |
| `vendorPayoutsStatusText` | `string` | |
| `failedPaymentsRatePercent` | `number` | |
| `failedPaymentsCount` | `number` | |
| `entityId` / `date` / timestamps | optional | Present when a stored summary doc is returned |

```json
{
  "success": true,
  "data": {
    "totalReceivedToday": 125000,
    "totalReceivedChangePercent": 4.2,
    "pendingSettlementsAmount": 18000,
    "pendingSettlementsGateways": 2,
    "vendorPayoutsAmount": 42000,
    "vendorPayoutsStatusText": "2 pending",
    "failedPaymentsRatePercent": 1.5,
    "failedPaymentsCount": 3
  },
  "error": null
}
```

---

# 2. Finance payment-method split

### Status

`EXISTING`

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/admin/finance/dashboard/payment-method-split` |
| **Authentication** | Admin JWT |
| **Query** | `entityId?` |

### Response

`data`: `Array<{ method: string | null, count: number, total: number }>`

---

# 3. Finance live transactions

### Status

`EXISTING`

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/admin/finance/dashboard/live-transactions` |
| **Authentication** | Admin JWT |
| **Query** | `entityId?`, `limit?` (default `20`) |

### Response

`data`: `LiveTransaction[]`

| Field | Type |
| --- | --- |
| `txnId` | `string?` |
| `orderId` | `string?` |
| `customerId` | `string?` |
| `amount` | `number?` |
| `currency` | `string` (default `INR`) |
| `method` | `string?` |
| `status` | `"pending" \| "success" \| "failed"` |
| `gateway` | `string?` |
| `entityId` | `string?` |
| `createdAt` / `updatedAt` | ISO |

---

# 4. Finance daily metrics

### Status

`EXISTING`

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/admin/finance/dashboard/daily-metrics` |
| **Authentication** | Admin JWT |
| **Query** | `entityId?`, `days?` (default `30`) |

### Response

`data`: `Array<{ _id: string /* YYYY-MM-DD */, total: number, count: number }>`

---

# 5. Finance gateway status

### Status

`EXISTING` (synthetic single gateway row)

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/admin/finance/dashboard/gateway-status` |
| **Authentication** | Admin JWT |

### Response

```json
{
  "success": true,
  "data": [
    {
      "gateway": "default",
      "status": "operational",
      "successRate": 98.5,
      "total": 200,
      "success": 197,
      "failed": 3
    }
  ]
}
```

---

# 6. Finance hourly trends

### Status

`EXISTING`

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/admin/finance/dashboard/hourly-trends` |
| **Authentication** | Admin JWT |
| **Query** | `entityId?` (last 24h window) |

### Response

`data`: `Array<{ _id: number /* hour 0–23 */, total: number, count: number }>`

---

# 7. Finance wallet liability

### Status

`STUB` — hardcoded zeros

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/admin/finance/dashboard/wallet-liability` |
| **Authentication** | Admin JWT |
| **Query** | `entityId?` |

### Response

```json
{
  "success": true,
  "data": {
    "totalLiability": 0,
    "activeWallets": 0,
    "reservedAmount": 0,
    "entityId": null
  }
}
```

---

# 8. Finance dashboard export

### Status

`STUB` — returns a queued id only; no file generation

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/admin/finance/dashboard/export` |
| **Authentication** | Admin JWT |
| **Body** | `Record<string, unknown>` (passed through as `filters`) |

### Response

```json
{
  "success": true,
  "data": {
    "exportId": "EXP-…",
    "status": "queued",
    "filters": {}
  }
}
```

---

# 9. Darkstore dashboard summary

### Status

`EXISTING`

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/darkstore/dashboard/summary` |
| **Authentication** | Admin JWT |
| **Query** | `storeId` \| `store_id` (falls back to default store) |

### Response

```json
{
  "success": true,
  "data": {
    "queue": {
      "total": 12,
      "new_orders": 4,
      "returns_count": 1,
      "cancelled_count": 2,
      "breakdown": { "normal": 8, "priority": 3, "express": 1 }
    },
    "sla_threat": {
      "percentage": 25,
      "orders_at_risk": 3,
      "orders_under_5min": 1
    },
    "store_capacity": { "percentage": 42 }
  }
}
```

---

# 10. Darkstore store profile

### Status

`STUB` — hardcoded profile

### Request

`GET /api/v1/darkstore/dashboard/store-profile` — Admin JWT; `storeId?`

### Response

```json
{
  "success": true,
  "data": {
    "store_id": "DS-Adyar-01",
    "name": "Selorg Darkstore",
    "type": "darkstore",
    "status": "active"
  }
}
```

---

# 11. Darkstore warehouse profile

### Status

`STUB`

### Request

`GET /api/v1/darkstore/dashboard/warehouse-profile` — Admin JWT; `storeId?`

### Response

```json
{
  "success": true,
  "data": {
    "store_id": "DS-Adyar-01",
    "name": "Selorg Warehouse",
    "type": "warehouse",
    "status": "active"
  }
}
```

---

# 12. Darkstore staff load

### Status

`EXISTING`

### Request

`GET /api/v1/darkstore/dashboard/staff-load` — Admin JWT; `storeId?`

### Response

```json
{
  "success": true,
  "data": {
    "active": 8,
    "total": 12,
    "by_role": [{ "role": "picker", "active": 5, "total": 7 }]
  }
}
```

---

# 13. Darkstore stock alerts

### Status

`EXISTING`

### Request

`GET /api/v1/darkstore/dashboard/stock-alerts` — Admin JWT; `storeId?`

### Response

`data`: unresolved `StockAlert[]` (limit 50), fields include:

| Field | Type |
| --- | --- |
| `sku` | `string?` |
| `product_name` | `string?` |
| `current_stock` | `number?` |
| `threshold` | `number?` |
| `alert_type` | `"low_stock" \| "out_of_stock" \| "near_expiry" \| "overstock"` |
| `store_id` | `string?` |
| `resolved` | `boolean` |
| `createdAt` / `updatedAt` | ISO |

---

# 14. Darkstore RTO alerts

### Status

`EXISTING`

### Request

`GET /api/v1/darkstore/dashboard/rto-alerts` — Admin JWT; `storeId?`

### Response

`data`: `RTOAlert[]` with `order_id`, `reason`, `store_id`, `status` (`open` \| `resolved`), `resolved_at?`, timestamps.

---

# 15. Darkstore live orders

### Status

`EXISTING`

### Request

`GET /api/v1/darkstore/dashboard/live-orders` — Admin JWT; `storeId?`

### Response

`data`: live `DarkstoreOrder[]` (statuses in the active/picking pipeline). Notable fields:

`order_id`, `store_id`, `order_type`, `status`, `item_count`, `items[]`, `sla_timer`, `sla_status`, `sla_deadline`, `assignee?`, `customer_name`, `customer_phone`, `payment_status`, `payment_method`, `total_bill`, `delivery_address`, RTO fields, `timeline[]`, `pickerAssignment?`, `pickingData?`, `bagId`, `rackLocation`, `version`.

---

# 16. Darkstore alert history

### Status

`EXISTING`

### Request

`GET /api/v1/darkstore/dashboard/alert-history` — Admin JWT; `storeId?`, `orderId?`

### Response

`data`: `AlertHistory[]` — `order_id?`, `action?`, `actor?`, `note?`, `store_id?`, `timestamp`, timestamps.

---

# 17. Darkstore refresh

### Status

`STUB`

### Request

`POST` or `GET` `/api/v1/darkstore/dashboard/refresh` — Admin JWT

### Response

**Non-canonical** (no `data` / `timestamp` from ResponseFormatter):

```json
{ "success": true, "refreshed": true }
```

---

# 18. Production dashboard summary

### Status

`EXISTING`

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/production/dashboard/summary` |
| **Authentication** | Admin JWT + `requireRole('production', 'admin', 'super_admin')` |
| **Query** | `storeId` \| `factoryId` (env default if omitted) |

### Response

**Non-canonical** — payload not under `data`:

```json
{
  "success": true,
  "summary": {
    "lines": { "total": 4, "running": 2 },
    "workOrders": { "pending": 6 },
    "alerts": { "active": 1 }
  }
}
```

---

# 19. Production alerts list

### Status

`EXISTING`

### Request

`GET /api/v1/production/dashboard/alerts` — production/admin role; `?status=` (`all` or filter)

### Response

```json
{
  "success": true,
  "alerts": [
    {
      "alert_id": "…",
      "title": "…",
      "description": "…",
      "severity": "critical",
      "category": "equipment",
      "status": "active",
      "location": null,
      "assigned_to": null,
      "resolved_by": null,
      "resolved_at": null,
      "factory_id": "chennai-hub",
      "created_at": "…",
      "updated_at": "…"
    }
  ]
}
```

**Enums**

- `severity`: `critical` \| `warning` \| `info`
- `category`: `equipment` \| `material` \| `quality` \| `safety` \| `shift` \| `production`
- `status`: `active` \| `acknowledged` \| `resolved` \| `dismissed`

---

# 20. Update production alert status

### Status

`EXISTING`

### Request

| | |
| --- | --- |
| **Method** | `PUT` |
| **Endpoint** | `/api/v1/production/dashboard/alerts/:alertId/status` |
| **Body** | `{ "status": "active" \| "resolved" \| "acknowledged" \| "dismissed" }` |

### Response

`{ "success": true, "alert": {…}, "message": "…" }`

---

# 21. Clear resolved production alerts

### Status

`EXISTING`

### Request

`DELETE /api/v1/production/dashboard/alerts/resolved`

### Response

`{ "success": true, "message": "Cleared N resolved alert(s)" }`

---

# 22. Production alert by id

### Status

`EXISTING`

### Request

`GET /api/v1/production/dashboard/alerts/:alertId`

### Response

`{ "success": true, "alert": {…} }` or `404`

---

# 23. Production incidents list

### Status

`EXISTING`

### Request

`GET /api/v1/production/dashboard/incidents` — store/factory scoped

### Response

```json
{
  "success": true,
  "data": [
    {
      "store_id": "chennai-hub",
      "title": "…",
      "description": "…",
      "status": "open",
      "severity": "…",
      "reportedBy": null,
      "resolvedAt": null,
      "resolutionNotes": null,
      "createdAt": "…",
      "updatedAt": "…"
    }
  ]
}
```

---

# 24. Create production incident

### Status

`EXISTING`

### Request

| | |
| --- | --- |
| **Method** | `POST` |
| **Endpoint** | `/api/v1/production/dashboard/incidents` |
| **Body** | `{ "title": string, "description"?, "severity"?, "reportedBy"?, … }` (+ store resolution) |

### Response

`{ "success": true, "data": <incident> }` — status forced to `"open"`.

---

# 25. Update production incident status

### Status

`EXISTING`

### Request

`PUT /api/v1/production/dashboard/incidents/:incidentId/status`  
Body: `{ "status": string }`

### Response

`{ "success": true, "data": <incident> }`

---

# 26. Production reports

### Status

`EXISTING`

### Request

`GET /api/v1/production/dashboard/reports`

### Response

```json
{
  "success": true,
  "data": {
    "totalOrders": 0,
    "completedOrders": 0,
    "totalWorkOrders": 0,
    "generatedAt": "2026-09-10T10:15:00.000Z"
  }
}
```

---

# 27. Production reports export

### Status

`EXISTING` (returns JSON orders, not a downloadable file)

### Request

`GET /api/v1/production/dashboard/reports/export`

### Response

`{ "success": true, "data": <ProductionOrder[]>, "exportedAt": "<ISO>" }`

---

# 28–39. Production legacy / utilities dashboard stubs

All under `/api/v1/production/dashboard/…`, same production/admin auth. Responses are placeholders.

| # | Method | Path | Response |
| --- | --- | --- | --- |
| 28 | `GET` | `/dashboard/alert-history` | `{ success: true, data: [] }` |
| 29 | `GET` | `/dashboard/live-orders` | `{ success: true, data: [] }` |
| 30 | `GET` | `/dashboard/refresh` | `{ success: true, data: { refreshedAt: ISO } }` |
| 31 | `POST` | `/dashboard/refresh` | same |
| 32 | `GET` | `/dashboard/rto-alerts` | `{ success: true, data: [] }` |
| 33 | `GET` | `/dashboard/staff-load` | `{ success: true, data: { totalStaff: 0, load: [] } }` |
| 34 | `GET` | `/dashboard/stock-alerts` | `{ success: true, data: [] }` |
| 35 | `GET` | `/dashboard/utilities/settings` | `{ success: true, data: {} }` |
| 36 | `PUT` | `/dashboard/utilities/settings` | `{ success: true, data: <req.body> }` |
| 37 | `GET` | `/dashboard/utilities/sync-history` | `{ success: true, data: [] }` |
| 38 | `GET` | `/dashboard/utilities/upload-history` | `{ success: true, data: [] }` |
| 39 | `POST` | `/dashboard/utilities/hsd-sync` | `{ success: true, message: "HSD sync triggered" }` |

---

# 40. Shared dashboard summary

### Status

`STUB`

### Request

`GET /api/v1/shared/dashboard/summary` — Admin JWT

### Response

```json
{ "success": true, "data": {}, "message": "OK" }
```

---

# 41. Vendor dashboard summary

### Status

`EXISTING`

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/admin/vendor/dashboard/summary` |
| **Authentication** | Admin JWT |
| **Query** | `hubKey?` (or `req.vendorHubKey` / default hub) |

### Response

```json
{
  "success": true,
  "data": {
    "active_vendors": 12,
    "pending_invoices": 4,
    "pending_approvals": 2,
    "open_alerts": 1
  }
}
```

---

# 42. Rider fleet dashboard counts

### Status

`EXISTING` (cached)

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/rider/dashboard/counts` |
| **Authentication** | Admin JWT |

### Response

```json
{
  "success": true,
  "data": {
    "online": 10,
    "busy": 4,
    "offline": 20,
    "idle": 3,
    "total": 37
  }
}
```

---

# 43. Rider HR dashboard summary

### Status

`EXISTING` (cached)

### Request

`GET /api/v1/rider/hr/dashboard/summary` — Admin JWT

### Response

```json
{
  "success": true,
  "data": {
    "total": 50,
    "pendingOnboarding": 5,
    "pendingDocuments": 8
  }
}
```

---

# 44. Rider dashboard notifications list

### Status

`EXISTING`

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/rider/notifications` |
| **Authentication** | Admin JWT |
| **Query** | `read?` (`true`\|`false`), `page?`, `limit?` (default 20) |

### Response

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "_id": "…",
        "type": "…",
        "title": "…",
        "body": "…",
        "scopeKey": null,
        "data": null,
        "read": false,
        "createdAt": "…",
        "updatedAt": "…"
      }
    ],
    "total": 1
  }
}
```

---

# 45. Mark rider notification read

### Status

`EXISTING`

### Request

`PUT /api/v1/rider/notifications/:notificationId/read` — Admin JWT

### Response

`data`: updated notification document.

---

# 46. Mark all rider notifications read

### Status

`EXISTING`

### Request

`POST /api/v1/rider/notifications/read-all` — Admin JWT

### Response

```json
{
  "success": true,
  "data": { "message": "All notifications marked as read" }
}
```

---

# 47. HHD operator dashboard

### Status

`EXISTING`

### Frontend usage

HSD app `dashboardApi.get()` → `GET /dashboard` (mounted under `/api/v1/hhd`).

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/hhd/dashboard` |
| **Authentication** | HHD Bearer JWT (`protect`) |

### Response

`200 OK` — ResponseFormatter `data`:

| Field | Type | Notes |
| --- | --- | --- |
| `user.name` | `string` | |
| `user.deviceId` | `string` | `"N/A"` if unset |
| `user.role` | `string` | |
| `goals.dailyTarget` | `number` | From user shift or default `50` |
| `goals.shiftTarget` | `number` | Default `25` |
| `goals.type` | `"orders"` | |
| `statistics.todayCompleted` | `number` | |
| `statistics.accuracyPercent` | `number` | From `accuracyStats`; `100` if no samples |
| `statistics.averagePickTimeSeconds` | `number` | |
| `statistics.slaCompliance` | `number \| null` | Percent, or `null` when ineligible |
| `status.current` | `string` | `waiting` / `picking` / `assigned` / bag/photo statuses |
| `status.assignmentMode` | `"auto"` | |
| `status.connectionStatus` | `"online" \| "offline"` | Based on lastLogin ≤ 2 min |
| `status.nextOrderETA` | `null` | Always null today |
| `status.queuePosition` | `null` | Always null today |
| `shift.startTime` / `endTime` | `string` (`HH:MM`) | |
| `shift.hoursWorked` | `number` | |
| `shift.remainingTime` | `number` | Hours remaining |
| `shift.breakScheduled` | `string` | e.g. `"12:00-12:30"` |
| `notifications` | `[]` | Always empty array today |

```json
{
  "success": true,
  "data": {
    "user": { "name": "Priya", "deviceId": "HHD-01", "role": "picker" },
    "goals": { "dailyTarget": 50, "shiftTarget": 25, "type": "orders" },
    "statistics": {
      "todayCompleted": 18,
      "accuracyPercent": 97,
      "averagePickTimeSeconds": 161,
      "slaCompliance": 92
    },
    "status": {
      "current": "waiting",
      "assignmentMode": "auto",
      "connectionStatus": "online",
      "nextOrderETA": null,
      "queuePosition": null
    },
    "shift": {
      "startTime": "09:00",
      "endTime": "17:00",
      "hoursWorked": 4,
      "remainingTime": 4,
      "breakScheduled": "12:00-12:30"
    },
    "notifications": []
  }
}
```

### Errors

| Status | `appCode` |
| --- | --- |
| `401` | `AUTH_REQUIRED` |
| `404` | `NOT_FOUND` |

---

# 48. Picker home summary

### Status

`EXISTING`

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/home/summary` |
| **Authentication** | Picker JWT (`authenticatePicker`) |
| **Query** | `lat?`, `lng?`, `accuracyM?` |

### Response

`data`:

| Field | Type | Notes |
| --- | --- | --- |
| `picker.id` / `name` / `initials` / `role` | strings | |
| `hub.name` / `address` / `accuracy` | `string \| null` | |
| `hub.onSite` | `boolean` | |
| `shift.window` | `string \| null` | |
| `shift.active` | `boolean` | |
| `shift.startedAt` | ISO \| `null` | |
| `shift.elapsedSeconds` | `number` | |
| `shift.onBreak` | `boolean` | |
| `balance.available` | `string` | Display `"₹…"` |
| `balance.pending` | `string` | Display |
| `balance.availableAmount` | `number` | Raw amount |
| `orders.count` / `pending` | `number` | |
| `orders.syncedLabel` | `string` | |
| `orders.progress` | `number` | |
| `metrics.todaysEarnings` / `incentivesToday` | `string` | Display |
| `performance.rank` | `string` | |
| `performance.accuracy` | `number` | |
| `performance.speedLabel` | `string` | |
| `performance.speedPct` | `number` | |
| `device.collected` | `boolean` | |
| `device.id` / `copy` | `string \| null` | |
| `unreadNotifications` | `number` | |

---

# 49. Picker today's dashboard stats

### Status

`EXISTING`

### Frontend usage

Rider app Home — Today's Performance tiles (`GET /picker/dashboard/today`).

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/dashboard/today` |
| **Authentication** | Picker JWT + `requireActivePicker` |
| **Query** | `date?` (`YYYY-MM-DD`, hub timezone; default today) |

### Response

| Field | Type | Nullable |
| --- | --- | --- |
| `date` | `string` (`YYYY-MM-DD`) | No |
| `codCollected` | `number` | No |
| `ordersDelivered` | `number` | No |
| `onlineHours` | `number` | No (one decimal) |
| `slotsCompleted` | `number` | No |
| `earnings` | `number` | No |
| `availableOrdersCount` | `number` | No |
| `activeOrderId` | `string` | Yes |
| `activeBatchId` | `string` | Yes |
| `isOnline` | `boolean` | No |
| `activeShift.timeDisplay` | `string` | Yes (object may be `null`) |

```json
{
  "success": true,
  "data": {
    "date": "2026-09-10",
    "codCollected": 1240,
    "ordersDelivered": 14,
    "onlineHours": 5.2,
    "slotsCompleted": 2,
    "earnings": 980,
    "availableOrdersCount": 2,
    "activeOrderId": null,
    "activeBatchId": "BD-10482",
    "isOnline": true,
    "activeShift": { "timeDisplay": "6:00 AM – 10:00 AM" }
  }
}
```

### Errors

| Status | Meaning |
| --- | --- |
| `400` | Malformed `date` |
| `401` | Auth |

---

# 50. Picker today's incentive

### Status

`EXISTING`

### Request

| | |
| --- | --- |
| **Method** | `GET` |
| **Endpoint** | `/api/v1/picker/incentives/today` |
| **Authentication** | Picker JWT + `requireActivePicker` |
| **Query** | `date?` (`YYYY-MM-DD`) |

### Response (no active rule)

```json
{
  "success": true,
  "data": {
    "hasIncentive": false,
    "title": null,
    "targetValue": null,
    "currentValue": null,
    "unit": null,
    "progressPercent": 0,
    "progressLabel": null,
    "earnedAmount": 0,
    "rewardAmount": null,
    "onTimeCount": 0,
    "lateCount": 0,
    "footnote": null,
    "expiresAt": null
  }
}
```

### Response (active rule)

| Field | Type |
| --- | --- |
| `hasIncentive` | `true` |
| `title` | `string` |
| `targetValue` / `currentValue` | `number` |
| `unit` | `string` (rule metric, e.g. orders / hours) |
| `progressPercent` | `number` 0–100 |
| `progressLabel` | `string` e.g. `"14/20 Orders"` |
| `earnedAmount` | `number` |
| `rewardAmount` | `number` |
| `onTimeCount` / `lateCount` | `number` |
| `footnote` | `string` |
| `expiresAt` | ISO |

---

## Mount map

| Prefix | Router file |
| --- | --- |
| `/api/v1/admin/finance` | `finance/finance.routes.ts` |
| `/api/v1/darkstore` | `darkstore/darkstore.routes.ts` |
| `/api/v1/production` | `production/production.routes.ts` |
| `/api/v1/shared` | `shared/shared.routes.ts` |
| `/api/v1/admin/vendor` | `vendor/vendor.routes.ts` |
| `/api/v1/rider` | `rider/rider.routes.ts` |
| `/api/v1/hhd` | `hhd/hhd.routes.ts` |
| `/api/v1/picker` | `picker/picker.routes.ts` |

## Implementation notes for clients

1. Prefer reading `data` for ResponseFormatter endpoints; for production alerts/summary and darkstore refresh, read top-level keys.
2. Money: finance/admin numbers are raw amounts; picker home often returns **display strings** (`₹…`) plus a few raw fields (`availableAmount`, incentive amounts, dashboard today COD/earnings).
3. Store/hub scoping: darkstore uses `storeId` / `store_id`; vendor uses `hubKey`; production uses `storeId` / `factoryId`.
4. Stubs (`wallet-liability`, darkstore profiles/refresh, shared summary, production utilities) are safe to call but should not drive production UX until implemented.
