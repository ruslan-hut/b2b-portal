# Client API (`/api/client/v1`)

The Client API is the machine-to-machine surface for clients' own systems
(ERP, back-office, procurement tools). It exposes the same capabilities as the
client web UI — priced catalog, order placement and tracking, addresses — but is
authenticated with **per-client API keys** instead of a web session, and every
request runs strictly in the scope of the client that owns the key.

Status: **Phases 1–2 built 2026-08-17** — keys, authentication, gates, rate
limits, request log, idempotency, admin management endpoints, and the client
endpoints (catalog, quote, orders, invoices/tracking, profile). Verified live
against Postgres and MySQL (`backend/scripts/client-api-smoke*.sh`).

**Contract:** the OpenAPI document is embedded in the binary and served
publicly at `GET /api/client/v1/openapi.yaml`
(source: `backend/internal/http-server/handlers/clientapi/openapi.yaml`). A
test fails the build if a mounted route is missing from it or vice versa.

---

## Base URL

```
https://<host>/api/client/v1
```

Requests bodies are **plain JSON objects** (no `{"data": …}` envelope).
Responses use the standard envelope:

```json
{ "success": true, "data": { … }, "status_message": "", "timestamp": "…", "request_id": "…" }
{ "success": false, "error": { "code": "…", "message": "…", "details": { … } }, "request_id": "…" }
```

`X-Request-ID` is echoed on every response; quote it in support requests.

## Authentication

Every request must carry an API key, either as

```
Authorization: Bearer cmx_live_XXXXXXXX_…
```
or
```
X-API-Key: cmx_live_XXXXXXXX_…
```

Key format: `cmx_<mode>_<prefix>_<secret>` where `mode` is `live` or `test`,
`prefix` is 8 characters (public — it identifies the key in the admin panel and
logs) and `secret` is 32 characters. The plaintext key is shown **once**, when it
is created or rotated. Only a peppered SHA-256 hash is stored.

A key authenticates only when **all** gates are open:

| Gate | Where it is set |
|------|-----------------|
| Client API globally enabled | Admin → Client API → Settings |
| The client's store enabled | Admin → Client API → Stores (default from settings) |
| The client opted in (`api_enabled`) | Admin → client card / Client API keys page — **off by default** |
| Client account active | ERP / admin |
| Key active, not expired | key lifecycle |

Any failure returns `401 UNAUTHORIZED` with the same message ("Invalid or
inactive API key") — the reason is logged server-side but never disclosed.
Repeated failures from one IP (default 20 in 10 minutes) block that IP for the
window with `429` + `Retry-After`.

Keys carry an expiry (default 365 days, max 730). Rotation issues a new key and
keeps the old one alive for a grace period (default 24 h).

### Scopes

| Scope | Grants |
|-------|--------|
| `catalog:read` | catalog, product, quote |
| `orders:read` | order list, detail, timeline, invoices, tracking |
| `orders:write` | order creation |
| `profile:read` | `GET /me`-style profile data, addresses |
| `profile:write` | address and profile edits |

A route that needs a scope the key lacks returns `403 FORBIDDEN` with
`details.required_scope`. New keys default to `catalog:read orders:read`.

### Test-mode keys

A key created with `is_test = true` (`cmx_test_…`) reads normally; `POST /orders`
runs the full validation and pricing and returns the would-be order **without
saving anything** (`test: true` in the response); other writes are refused with
`403` (`details.reason = test_mode`).

## Rate limiting

Per key, two token buckets: reads (`GET`/`HEAD`) and writes. Defaults 600 read /
60 write per minute (overridable per key). Every response carries
`X-RateLimit-Limit` and `X-RateLimit-Remaining`; a refused request gets `429`,
`Retry-After` and `X-RateLimit-Reset` (seconds).

## Idempotent writes

Send `Idempotency-Key: <unique string ≤128 chars>` on `POST`/`PUT`/`PATCH`. The
first completed response (any status below 500) is stored for 24 h and replayed
for the same key + same body, with `Idempotent-Replayed: true`. The same key with
a **different** body is refused with `409 CONFLICT`. Use it on order creation so
a network retry can never create two orders.

## Limits

Request body ≤ 1 MiB, request timeout 10 s, `offset`/`limit` pagination
(`limit` ≤ 100), maintenance mode → `503` + `Retry-After`.

## Error codes

| HTTP | `error.code` | Meaning |
|------|--------------|---------|
| 400 | `VALIDATION_ERROR` / `BAD_REQUEST` | malformed input, field errors in `error.fields` |
| 401 | `UNAUTHORIZED` | missing / invalid / inactive key, API disabled for the client |
| 403 | `FORBIDDEN` | scope missing, test-mode write |
| 404 | `NOT_FOUND` | unknown resource **in this client's scope** |
| 409 | `CONFLICT` | idempotency key reuse with a different body |
| 429 | `RATE_LIMIT_EXCEEDED` | per-key limit or auth-failure block |
| 503 | `MAINTENANCE` | platform maintenance |

---

## Endpoints

### `GET /me`

No scope required. Returns the client, currency, effective VAT rate, discount
info, addresses, branches, and the key's own scopes/limits.

The `client` object carries the client's own profile only. Internal routing
fields — `manager_uid`, `price_type_uid`, `store_uid`, `active` — are not
exposed, and neither are the `store` and `price_type` blocks they point at:
the commercial context a client needs is the currency, VAT rate and discount
info (see `MeResponse` in
`backend/internal/http-server/handlers/clientapi/me.go`).

```json
{
  "success": true,
  "data": {
    "client": { "uid": "…", "name": "…", "phone": "…", "email": "…", "vat_number": "…", … },
    "currency": { … },
    "vat_rate": 23,
    "discount_info": { … },
    "addresses": [ … ], "branches": [ … ],
    "api_key": {
      "uid": "…", "name": "ERP integration", "prefix": "cmx_live_Ab3dEf9h_…",
      "scopes": ["catalog:read", "orders:read"], "is_test": false,
      "expires_at": "2027-08-17T10:00:00Z",
      "rate_limit_read_per_minute": 600, "rate_limit_write_per_minute": 60
    }
  }
}
```

### Catalog (`catalog:read`)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/catalog/products` | priced list; `category`, `search`, `language`, `order_total`, `offset`/`limit`; only products with a price for the client's price list **and** stock in the client's store, filtered by the store's country/certification rules |
| POST | `/catalog/products/lookup` | `{skus[], barcodes[], language}` → `{products[], not_found[]}` (products the store has none of are returned with `available: false`) |
| GET | `/catalog/products/{uid}` / `/catalog/products/by-sku/{sku}` | one product + all descriptions; 404 when unknown, inactive, not sellable in the client's countries or unpriced |
| GET | `/catalog/products/{uid}/images` | `[{file_data (base64), is_main, sort_order}]` |
| GET | `/catalog/categories`, `/catalog/languages` | |
| POST | `/catalog/export` | xlsx order form (`{category_uids[], language}`) |

Prices are integer cents; `price_final` = with the client's discount and VAT.
The VAT country is the client's **default address**.

Stock levels are never exposed. A product carries `available: true` when the
store holds stock for the client asking, `false` otherwise — no quantities, and
no stock endpoint. Order rejections report `insufficient_stock` per line without
naming how much is left.

### Orders

| Method | Path | Scope | Notes |
|--------|------|-------|-------|
| POST | `/orders/quote` | `catalog:read` | full validation + pricing, nothing stored, `quote: true` |
| POST | `/orders` | `orders:write` | `{items[{product_uid, quantity}], shipping_address_uid?, comment?, client_reference?, language?}`; creates a **confirmed** order (CRM board, stock allocation, notifications) → `201`; test keys → `200` + `test: true`, nothing saved; send `Idempotency-Key` |
| GET | `/orders` | `orders:read` | filters `phase`, `client_reference`, `erp_number` (exact), `search`, `created_from/to`, `updated_since`; drafts (web cart) never listed |
| GET | `/orders/{uid}` | `orders:read` | order + items + `invoices[]` + `shipments[]` |
| GET | `/orders/{uid}/timeline` | `orders:read` | client phase track |
| GET | `/orders/{uid}/invoices`, `/orders/{uid}/invoices/{invoice_uid}/file` | `orders:read` | successful documents only; file streamed or `302` to link |
| GET | `/orders/{uid}/shipments`, `/orders/{uid}/shipments/{shipment_uid}/tracking` | `orders:read` | carrier, tracking number/URL, status; events oldest first |

Rejections (`400`, `error.details.reason`): `validation` (per-line problems in
`error.extra.problems`), `business_registration_required`, `address_invalid`,
`branch_*`, `insufficient_stock`. An unknown order uid — including another
client's — is `404`; an unknown invoice or shipment uid under an order the
client does own is `404` naming that resource.

Order money reconciles as `total = subtotal + total_vat + delivery_cost`
(shipping sits in neither of the first two). Every order line carries
`product_sku` and `barcode` alongside `product_uid`, so lines can be matched
without a catalog lookup.

### Self-service (web session, not the API key)

Clients manage their own keys on the profile page when `capabilities.api_access`
is true (API on globally + store + client opted in + self-service allowed):
`GET/POST /api/v1/frontend/profile/api-keys/`, `PUT …/{uid}` (rename),
`POST …/{uid}/revoke`, `POST …/{uid}/rotate`. Lifetime and limits always come
from the settings. Two public pages, both linked from the profile section:
`/api-guide` — the step-by-step client manual (uk/en, one content component per
language under `frontend/src/app/api-guide/`, a print/e-mail copy of the same
document lives at `docs/api/client-api-manual-uk.html`) — and `/api-docs`, the
self-hosted Redoc reference over `/api/client/v1/openapi.yaml`.

The profile section renders **always**, not only with `capabilities.api_access`:
without access it states what the API does and links the guide, so a client can
discover the feature and ask for it. Only the key-management half calls the
backend.

### Profile

| Method | Path | Scope |
|--------|------|-------|
| PATCH | `/me` | `profile:write` — `{name?, email?, vat_number?}` (phone is the login identity — not changeable via API) |
| GET | `/addresses` | `profile:read` |
| POST | `/addresses` | `profile:write` — create/update (omit `uid` to create); returns the stored address, so a newly created one comes back with its `uid` |
| DELETE | `/addresses/{uid}` | `profile:write` |
| PUT | `/addresses/{uid}/default`, `/addresses/{uid}/official` | `profile:write` |

Test-mode keys are refused on every profile write (`403`, `reason: test_mode`).

---

## Admin management (`/api/v1/admin/client-api`, staff JWT)

Reads are admin-or-manager (store-scoped managers see only their store's
clients); settings and all writes are admin-only. Request bodies use the usual
`{"data": …}` envelope.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/settings` | admin | global settings |
| PUT | `/settings` | admin | partial update (`enabled`, `stores_enabled_by_default`, `self_service_enabled`, `max_keys_per_client`, `default_key_ttl_days`, `max_key_ttl_days`, `default_read_rpm`, `default_write_rpm`, `rotation_grace_hours`, `request_log_retention_days`, `usage_retention_days`, `expiry_warn_days`, `alert_key_events`, `auth_failure_limit`, `auth_failure_window_minutes`) |
| GET | `/stores` | admin | explicit per-store gates |
| PUT | `/stores` | admin | `{store_uid, enabled}` |
| GET | `/clients/{client_uid}/access` | admin/manager | client opt-in state |
| PUT | `/clients/access` | admin | `{client_uid, enabled}` — disabling revokes all the client's keys |
| GET | `/keys` | admin/manager | list; filters `client_uid`, `store_uid`, `status` (`active`/`revoked`/`expired`), `scope`, `is_test`, `expiring_days`, `search`; `offset`/`limit`; rows carry `requests_24h/7d`, `errors_24h` |
| POST | `/keys` | admin | `{client_uid, name, scopes[], is_test, ttl_days, rate_limit_read, rate_limit_write}` → `{key, plaintext_key}` (**shown once**) |
| PUT | `/keys` | admin | `{uid, name?, scopes?, is_test?, expires_at?, rate_limit_read?, rate_limit_write?}` |
| POST | `/keys/revoke` | admin | `{uid, reason}` |
| POST | `/keys/rotate` | admin | `{uid}` → new `{key, plaintext_key}`; old key lives for the grace period |
| GET | `/requests` | admin/manager | raw request log; filters `key_uid`, `client_uid`, `store_uid`, `request_id`, `route`, `status_min`, `status_max`, `from`, `to` |
| GET | `/usage` | admin/manager | hourly aggregates (`hour`, `key_uid`, `route`, `requests`, `status_2xx/4xx/429/5xx`, `avg/max_duration_ms`, `bytes_out`); default last 7 days |

Telegram notices (when `alert_key_events` is on): key created / revoked /
rotated, key expiring in `expiry_warn_days`, IP blocked after repeated auth
failures.

## Server configuration

| Setting | Env | Default | Notes |
|---------|-----|---------|-------|
| `client_api.key_pepper` | `CLIENT_API_KEY_PEPPER` | — | **required** for the API to authenticate anything; `openssl rand -hex 32`; rotating it invalidates every key |
| `client_api.log_batch_size` | `CLIENT_API_LOG_BATCH_SIZE` | 100 | request-log writer |
| `client_api.log_flush_interval` | `CLIENT_API_LOG_FLUSH_INTERVAL` | 2s | |
| `client_api.maintenance_interval` | `CLIENT_API_MAINTENANCE_INTERVAL` | 15m | aggregation, retention, expiry warnings |
| `client_api.idempotency_ttl` | `CLIENT_API_IDEMPOTENCY_TTL` | 24h | |

Tables: `client_api_settings`, `client_api_store_access`,
`client_api_client_access`, `client_api_keys`, `client_api_requests`,
`client_api_usage_hourly`, `client_api_idempotency` (both drivers, auto-migrated).
