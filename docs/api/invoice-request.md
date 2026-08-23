# Invoice Request Feature

A manager (or admin) can request an invoice for an order. The backend builds an order
payload, sends it to a configurable external invoice service (e.g. wFirma), and stores the
result (a downloadable file or a link) as an `Invoice` record.

This document describes the **endpoints**, the **payload the frontend sends in**, and the
**payload the backend sends out** to the external invoice service.

## Source of truth

| Component | File |
|-----------|------|
| Routes | `backend/internal/http-server/api/api.go` (`/admin/orders/invoice/*`) |
| Handlers | `backend/internal/http-server/handlers/admin/invoice.go` |
| Incoming request struct | `backend/entity/invoice.go` (`InvoiceRequest`) |
| Outgoing payload builder | `backend/impl/core/invoice.go` (`buildInvoicePayload`) |
| Outgoing HTTP request | `backend/impl/core/invoice.go` (`sendInvoiceRequest`) |
| Response processing | `backend/impl/core/invoice.go` (`processInvoiceResponse`) |
| Invoice type config | `backend/entity/invoice_type.go` (`InvoiceType`) |
| Stored invoice record | `backend/entity/invoice.go` (`Invoice`) |

## Endpoints

All under `/api/v1/admin/orders/invoice`. Operational routes require **admin OR manager**;
invoice-type **configuration** routes (`/api/v1/admin/invoice/types`) are **admin only**.

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| POST | `/orders/invoice/request` | `RequestInvoice` | Request an invoice for one order |
| POST | `/orders/invoice/types` | `GetTypesForOrder` | List invoice types available for an order |
| POST | `/orders/invoice/list` | `GetInvoicesForOrders` | List existing invoices for orders |
| GET | `/orders/invoice/{uid}` | `DownloadInvoice` | Download a stored invoice file |

Store-scoped managers may only request invoices for orders that belong to their store
(enforced in `enforceInvoiceOrderStore`).

## 1. Request the frontend sends in

The API uses the project-wide envelope: the body is `{ "data": { ... } }`, decoded by
`request.DecodeAndValidateData` into `entity.InvoiceRequest`.

```go
// backend/entity/invoice.go
type InvoiceRequest struct {
    OrderUID       string `json:"order_uid"       validate:"required"`
    TypeUID        string `json:"type_uid"        validate:"required"`
    InvoiceContent string `json:"invoice_content,omitempty" validate:"omitempty,oneof=products delivery"`
}
```

Example `POST /api/v1/admin/orders/invoice/request`:

```json
{
  "data": {
    "order_uid": "5f9a3c1e-...-order",
    "type_uid": "a1b2c3d4-...-invtype",
    "invoice_content": "products"
  }
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `order_uid` | yes | Order to invoice |
| `type_uid` | yes | UID of the configured `InvoiceType` (which provider/URL to call) |
| `invoice_content` | no | `"products"` (default) or `"delivery"`. `"delivery"` requires a non-zero delivery cost on the order |

## 2. Payload the backend sends OUT to the invoice service

Built by `buildInvoicePayload`. The HTTP method, URL, and headers come from the selected
`InvoiceType`.

- **POST** (typical): the full JSON below is the request body, `Content-Type: application/json`.
- **GET**: no body — only `?order_uid=<uid>` is appended as a query parameter.
- A `User-Agent: Comex-Invoice/1.0` header is always set, plus any custom headers from the
  invoice type config.
- **HTTP Basic Auth**: if the invoice type has both `auth_username` and `auth_password` set,
  an `Authorization: Basic <base64(user:pass)>` header is added (via `req.SetBasicAuth`).
  Auth is skipped unless *both* values are present.
- The upstream call runs on a **detached context** with a **120s timeout**
  (`InvoiceTimeout`) so reverse proxies don't cancel it mid-flight.

### Outgoing JSON (POST body)

```json
{
  "order_uid": "5f9a3c1e-...-order",
  "order_number": "ORD-12345",
  "client_uid": "c0ffee00-...-client",
  "client_name": "ТОВ Приклад",
  "client_email": "buyer@example.com",
  "client_phone": "+380501234567",
  "client_vat": "UA1234567890",
  "client_country": "UA",
  "client_city": "Київ",
  "client_address": "вул. Хрещатик, 1",
  "client_zipcode": "01001",
  "billing_country": "UA",
  "billing_city": "Львів",
  "billing_address": "вул. Городоцька, 10",
  "billing_zipcode": "79000",
  "store_uid": "5704e2c0-...-store",
  "status": "confirmed",
  "total": 1025.00,
  "subtotal": 850.00,
  "total_vat": 150.00,
  "discount_percent": 5,
  "discount_amount": 50.00,
  "shipment": 25.00,
  "invoice_content": "products",
  "currency_code": "UAH",
  "created_at": "2026-06-09T12:30:00Z",
  "items": [
    {
      "product_uid": "p1-...-uid",
      "product_sku": "SKU-001",
      "product_name": "Назва товару",
      "quantity": 10,
      "price": 102.00,
      "discount": 5,
      "price_discount": 96.90,
      "tax": 15.00,
      "total": 807.50
    }
  ]
}
```

### Field reference (top level)

| Field | Source | Notes |
|-------|--------|-------|
| `order_uid` | `order.UID` | |
| `order_number` | `order.Number` | |
| `client_uid` | the **billed party** | `order.ClientUID`, or the branch UID when the order is delivered to a branch address — see [Branch billing](#7-branch-billing) |
| `client_name` / `client_vat` | the **billed party** | The branch's name and VAT number for a branch order, the client's otherwise |
| `client_email` / `client_phone` | branch when set, else client | The branch's `contact_email` / `contact_phone` when it has them, the client's otherwise. **The e-mail is how wFirma identifies a contractor** — see [Branch billing](#7-branch-billing) |
| `client_country` | `order.CountryCode` | Delivery address snapshot on the order |
| `client_city` / `client_address` / `client_zipcode` | `order.City` / `order.AddressText` / `order.Zipcode` | Delivery address snapshot on the order |
| `billing_country` / `billing_city` / `billing_address` / `billing_zipcode` | the **billed party's** official `ClientAddress` | The address flagged `is_official`, for the branch when the order has one and for the client otherwise. **Empty strings when that party has no official address** — the external service can treat empty `billing_*` as "no official/invoicing address on file". See [Official invoicing address](#6-official-invoicing-address-billing-fields) |
| `store_uid` | `order.StoreUID` | |
| `status` | `order.Status` | |
| `total` / `subtotal` / `total_vat` | order totals | |
| `discount_percent` | `order.DiscountPercent` | integer percent |
| `discount_amount` | `order.DiscountAmount` | |
| `shipment` | `order.DeliveryCost` | |
| `invoice_content` | from the incoming request | `"products"` or `"delivery"` |
| `currency_code` | `order.CurrencyCode` | |
| `created_at` | `order.CreatedAt` | RFC3339 |
| `items[]` | order items | see below |

### Item fields

| Field | Source | Notes |
|-------|--------|-------|
| `product_uid` | item | |
| `product_sku` | product lookup | empty if SKU lookup fails |
| `product_name` | localized description | see language resolution below |
| `quantity` | item | |
| `price` | `item.Price` | **gross** (see money/VAT note) |
| `discount` | `item.Discount` | integer percent |
| `price_discount` | `item.PriceDiscount` | **gross** |
| `tax` | `item.Tax` | |
| `total` | `item.Total` | |

### Money & VAT note (important)

- Monetary amounts are stored internally in **cents** and divided by 100 before sending
  (so the outgoing payload carries decimal currency units, not cents).
- The item `price` and `price_discount` are sent as **gross/brutto** prices — net price is
  multiplied by the VAT multiplier `1 + order.VATRate/100` before being sent, because the
  invoice service (wFirma) expects gross prices. `tax` and `total` are the order's stored
  values divided by 100.

### Product name language resolution

`product_name` is resolved by:
1. The **client's** language preference (`client.Language`), if set;
2. otherwise the **invoice type's** `default_language`.

If a name is still missing after both lookups, the field is sent **empty** and a warning is
logged.

## 3. What comes back & what gets stored

`processInvoiceResponse` inspects the upstream response:

- **File** (`application/pdf`, `application/zip`, `application/octet-stream`, images, Office
  docs, …): body is base64-encoded into `ResponseData`, with `MimeType`, `FileSize`, and
  `FileName` (from `Content-Disposition` or a MIME-based default). Stored as
  `response_type: "file"`.
- **Link**: a plain-text URL body, or a URL pulled from JSON fields
  (`url`, `link`, `invoice_url`, `download_url`, `file_url`, `document_url`). Stored as
  `response_type: "link"`.
- **Multiple URLs** (split orders): collected from JSON array fields `urls` / `links` /
  `documents`; the first becomes `ResponseData`, the full list goes to `response_urls`.
- HTTP status outside 200–299 → the body (first 4 KB) is turned into an error message and
  stored on the invoice; a Telegram error notification is triggered.

Stored record:

```go
// backend/entity/invoice.go
type Invoice struct {
    UID          string    `json:"uid"`
    OrderUID     string    `json:"order_uid"`
    TypeUID      string    `json:"type_uid"`
    ResponseType string    `json:"response_type"`        // "link" or "file"
    ResponseData string    `json:"response_data"`        // URL or base64 file
    ResponseURLs []string  `json:"response_urls,omitempty"`
    FileName     string    `json:"file_name,omitempty"`
    MimeType     string    `json:"mime_type,omitempty"`
    FileSize     int64     `json:"file_size,omitempty"`
    Error        string    `json:"error,omitempty"`
    StatusCode   int       `json:"status_code"`
    RequestedBy  string    `json:"requested_by,omitempty"` // user UID who requested
    CreatedAt    time.Time `json:"created_at"`
}
```

The handler returns the stored `Invoice` in the standard envelope:

```json
{
  "data": { "uid": "...", "order_uid": "...", "response_type": "link", "response_data": "https://...", "status_code": 200, "...": "..." },
  "success": true,
  "status_message": "Success",
  "timestamp": "2026-06-09T12:30:05Z",
  "request_id": "..."
}
```

Note: the request can succeed at the HTTP level (`success: true`) while the invoice itself
failed upstream — check `data.error` and `data.status_code`.

## 4. Invoice type configuration

Each invoice type defines which external service is called and how:

```go
// backend/entity/invoice_type.go
type InvoiceType struct {
    UID             string            `json:"uid"`
    Name            string            `json:"name"`
    URL             string            `json:"url"`
    Method          string            `json:"method"`            // GET or POST
    Headers         map[string]string `json:"headers,omitempty"` // custom headers
    AuthUsername    string            `json:"auth_username,omitempty"` // HTTP Basic Auth username
    AuthPassword    string            `json:"auth_password,omitempty"` // HTTP Basic Auth password
    Active          bool              `json:"active"`
    StoreUID        *string           `json:"store_uid,omitempty"`
    DefaultLanguage string            `json:"default_language"`
    CreatedAt       time.Time         `json:"created_at"`
    LastUpdate      time.Time         `json:"last_update"`
}
```

Managed via the admin-only `/api/v1/admin/invoice/types` CRUD endpoints. The invoice feature
must be enabled in `InvoiceSettings`, and the selected type must be `Active`, for a request
to proceed.

## 5. History retention

Stored invoice records are cleaned up automatically by a background job
(`internal/jobs/invoice_retention.go`):

- **Error records** (records with a non-empty `error`) are deleted **5 days** after creation.
- **Other records** are deleted **60 days** after the related order reached a **final CRM
  pipeline stage** (stages with `is_final` set, configured in the CRM). Records for orders
  that have not reached a final stage are kept indefinitely.

Configured in `config.yml`:

```yaml
invoice_retention:
  enabled: true             # INVOICE_RETENTION_ENABLED
  interval: 24h             # INVOICE_RETENTION_INTERVAL
  error_retention_days: 5   # INVOICE_RETENTION_ERROR_DAYS
  final_retention_days: 60  # INVOICE_RETENTION_FINAL_DAYS
```

The manual cleanup endpoint `DELETE /api/v1/admin/orders/invoice/history/cleanup`
(`older_than_days`) remains available and deletes by creation date regardless of order stage.

## 6. Official invoicing address (billing fields)

The payload distinguishes the **delivery** address from the **official/invoicing** address:

- `client_country` / `client_city` / `client_address` / `client_zipcode` — the **delivery**
  address, taken from the denormalized snapshot stored on the order (`order.CountryCode`,
  `order.City`, `order.AddressText`, `order.Zipcode`). Unchanged by this feature.
- `billing_country` / `billing_city` / `billing_address` / `billing_zipcode` — the client's
  **official** address, i.e. the `ClientAddress` record flagged `is_official`.

A client address carries two independent flags (see
[Data Management API → Client Address](./data-management-api.md#client-address)):

| Flag | Meaning |
|------|---------|
| `is_default` | Default **delivery** address (pre-selected at checkout / order edit) |
| `is_official` | Official **invoicing** address (source of the `billing_*` payload fields) |

An address may be both, either, or neither. At most one address per client is `is_official`
(enforced transactionally, mirroring `is_default`).

**Resolution & fallback:** `buildInvoicePayload` calls
`ClientAddress().GetOfficialByBranchUID(order.BranchUID)` when the order is billed to a
branch, and `ClientAddress().GetOfficialByClientUID(order.ClientUID)` otherwise. There is
**no fallback from branch to client** — see [Branch billing](#7-branch-billing).

- If an official address exists, `billing_*` is populated from it.
- If the client has **no** official address, all four `billing_*` keys are sent as **empty
  strings**. The lookup failure is non-fatal (logged at debug); the invoice is never blocked
  by a missing official address. Empty `billing_*` is the agreed signal to the external
  service that no official/invoicing address is on file — the delivery `client_*` fields are
  still present and can be used as a fallback on the provider side if desired.

The `billing_*` fields are **not** derived from the order snapshot, so unlike `client_*` they
always reflect the client's **current** official address at the moment the invoice is
requested (not the address as it was when the order was placed).

---

## 7. Branch billing

A client may have [branches](./data-management-api.md#client-branch) — filials or points of
sale. When an order's delivery address is linked to a branch, **that branch is the legal
party the invoice is issued to**, not the parent client.

**The payload shape does not change.** The branch's identity is written into the existing
`client_*` keys, so the invoice service needs no knowledge of branches, of parents, or of
the relationship between them — it is simply told who to bill.

| Payload field | Client order | Branch order |
|---|---|---|
| `client_uid` | client UID | **branch UID** (an ERP GUID, as client UIDs are) |
| `client_name` | client name | **branch name** |
| `client_vat` | client VAT number | **branch VAT number** |
| `billing_*` | client's official address | **the branch's** official address |
| `client_email` / `client_phone` | client's | **branch's `contact_email` / `contact_phone`**, falling back to the client's when the branch has none |
| `client_country` / `client_city` / `client_address` / `client_zipcode` | delivery address | delivery address — unchanged |

> **What this means for the invoice service.** A branch UID it has never seen arrives in
> `client_uid`, together with the branch's own e-mail address. Whether contractors are keyed
> on the UID, the VAT number or the **e-mail** — as wFirma does — a **new contractor record
> is created for the branch**, carrying the branch's own name and VAT number. That is the
> intended outcome. Existing client contractor records are untouched: a branch order never
> carries the parent's identifier.

### ⚠️ A branch must have its own e-mail

Contact details are the one category where branch data does **not** replace the parent
outright. `client_email` and `client_phone` take the branch's `contact_email` /
`contact_phone` when set and fall back to the client's when empty — an invoice with no
e-mail address cannot be delivered, so blanking them is not an option.

The fallback has a cost. **wFirma identifies a contractor by e-mail address**, so a branch
that inherits its parent's e-mail arrives as a different name, VAT number and UID under an
address that already belongs to the parent's contractor. Two contractors cannot share an
e-mail: the service will either reject the invoice or merge the branch into the parent's
record, silently undoing the substitution.

**Every branch that will be invoiced needs its own `contact_email`.** Comex logs a warning
whenever a branch order falls back to the parent's address, so the cases are findable in the
application log before they reach production.

### Substitution is total

A branch never inherits anything from its parent. `client_vat` on a branch order is the
branch's own value, empty if the branch has none — it is never filled in from the client.
The same holds for the `billing_*` address block, which stays empty when the branch has no
official address rather than borrowing the parent's registered address.

This matters most for VAT: the branch's VAT number and rate determine `vat_rate` on the
order, so a branch with no VAT number is charged the store's default rate even when its
parent is zero-rated for intra-EU reverse charge.

### Snapshot semantics

The identity written into `client_uid` / `client_name` / `client_vat` comes from the
**snapshot stored on the order** (`order.branch_uid`, `branch_name`, `branch_vat_number`),
taken when the delivery address was selected and refreshed at confirmation. Re-issuing an
invoice therefore reproduces the identity the order was confirmed with, even if the ERP has
since edited or deleted the branch record.

The `billing_*` address is the exception: like the client-level case, it is read live at
invoice time and reflects the branch's **current** official address.
