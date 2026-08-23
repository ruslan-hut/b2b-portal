# Admin API Documentation

Admin-only API endpoints. Requires user authentication and admin/manager role privileges.

For endpoint list, see [structure.md](structure.md#admin-authenticated--user-role-required).
For authentication details, see [authentication-and-common-patterns.md](authentication-and-common-patterns.md#authentication).

---

## Base Path

`/api/v1/admin`

---

## Access Control

Admin routes are protected by middleware layers:
1. **authenticate** - Validates JWT token
2. **requireuser** - Ensures entity type is "user" (not "client")
3. **requirerole** - Verifies user role from database

**Role Hierarchy:**
- **admin** - Full access to all admin features including user management, database viewer, and pipeline configuration
- **manager** - Access to admin zone (dashboard, clients, orders, products, CRM board, shipments, invoices)
- **user** - Standard user access (no admin zone access)
- **client** - Client access only (cannot access admin endpoints)

**Error Responses:**

Client attempting admin access:
```json
{
  "status": "error",
  "message": "Access denied: admin privileges required"
}
```

User with insufficient role:
```json
{
  "status": "error",
  "message": "Access denied: admin role required"
}
```

---

## Admin/Manager Role Required

### Dashboard Statistics

#### Get Dashboard Statistics

**GET** `/admin/dashboard`

Returns dashboard statistics including orders by status counts, total clients, and total products.

**Query Parameters:**
- `store_uid` (optional): Filter statistics by store

**Response:**
```json
{
  "status": "success",
  "data": {
    "orders_by_status": {
      "draft": 5,
      "new": 12,
      "processing": 8,
      "confirmed": 45
    },
    "total_clients": 150,
    "total_products": 320
  }
}
```

---

#### Get Discount Scales for Dashboard

**GET** `/admin/discount_scale`

Returns discount scales for a store (used in dashboard/order views).

**Query Parameters:**
- `store_uid` (required): Store UID to fetch scales for

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "store_uid": "store-1",
      "sum_purchase": 0,
      "discount": 5,
      "currency_code": "USD"
    },
    {
      "store_uid": "store-1",
      "sum_purchase": 100000,
      "discount": 10,
      "currency_code": "USD"
    }
  ]
}
```

**Notes:**
- Scales sorted by `sum_purchase` ascending (lowest to highest threshold)
- Returns validation error if `store_uid` is missing

---

### Product Discount Limits

A limit caps the discount a client can earn on that product. It is **not** a hard
ceiling on the final line discount: a client's `additional_discount` is added
after the cap and deliberately goes over it (see
[Discount Calculation](data-management-api.md#discount-calculation)).

#### Get Product Discount Limits by Store

**GET** `/admin/product_discount_limits`

**Query Parameters:**
- `store_uid` (required): Store UID

**Response:** Array of `ProductDiscountLimit` sorted by `product_uid`

#### Upsert Product Discount Limits

**POST** `/admin/product_discount_limits`

**Request Body:**
```json
{
  "data": {
    "limits": [
      {"store_uid": "store-1", "product_uid": "prod-1", "percent": 15},
      {"store_uid": "store-1", "product_uid": "prod-2", "percent": 0}
    ]
  }
}
```

**Response:** Count of upserted limits

#### Delete Product Discount Limit

**POST** `/admin/product_discount_limits/delete`

**Request Body:**
```json
{
  "data": {
    "store_uid": "store-1",
    "product_uid": "prod-1"
  }
}
```

---

### Product Tags

Product tags are store-scoped colored badges displayed on products. Admin routes manage tag definitions; product-tag assignments are uploaded through the ERP data-management endpoints.

#### Product Tag Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Unique tag identifier |
| `store_uid` | string | Yes | Store this tag belongs to |
| `name` | string | Yes | Badge label, max 64 characters |
| `color` | string | Yes | RGB hex color such as `#FF6B6B` |
| `sort_order` | int | No | Catalog priority; lower values sort first. **Negative disables sorting** — the badge still renders, but tagged products keep their common position among untagged ones |
| `last_update` | datetime | No | Last update timestamp |

#### List Product Tags

**GET** `/admin/product_tags`

**Query Parameters:**
- `store_uid` (required): Store UID
- `page` (optional): Page number, default 1
- `count` (optional): Items per page, default 100

**Response:** Paginated array of `ProductTag` sorted by `sort_order`, then `name`.

#### Upsert Product Tags

**POST** `/admin/product_tags`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "tag-new",
      "store_uid": "store-1",
      "name": "NEW",
      "color": "#2E7D32",
      "sort_order": 10
    }
  ]
}
```

**Response:** Array of upserted tag UIDs.

#### Get Product Tags Batch

**POST** `/admin/product_tags/batch`

**Request Body:**
```json
{
  "data": ["tag-new", "tag-season"]
}
```

#### Delete Product Tags

**POST** `/admin/product_tags/delete`

Deletes tags by UID and removes their assignments.

**Request Body:**
```json
{
  "data": ["tag-new", "tag-season"]
}
```

---

### Client Management

Alias endpoints for client management in admin zone. Same functionality as `/client` endpoints.

See [data-management-api.md - Client](data-management-api.md#client) for detailed documentation.

| Admin Path | Data Management Path |
|------------|---------------------|
| `POST /admin/clients` | `POST /client` |
| `GET /admin/clients` | `GET /client` |
| `POST /admin/clients/batch` | `POST /client/batch` |
| `POST /admin/clients/delete` | `POST /client/delete` |
| `POST /admin/clients/find/email` | `POST /client/find/email` |
| `POST /admin/clients/active` | `POST /client/active` |

---

### Client Balance Management

Update client purchase turnover balance (used for scale-based discounts).

#### Update Client Balance

**POST** `/admin/client_balance`

**Request Body:**
```json
{
  "client_uid": "client-123",
  "balance": 75000
}
```

**Response:** Success message

#### Update Client Balance Batch

**POST** `/admin/client_balance/batch`

**Request Body:**
```json
{
  "data": [
    {"client_uid": "client-123", "balance": 75000},
    {"client_uid": "client-456", "balance": 50000}
  ]
}
```

**Response:** Success message

---

### Order Management

#### List All Orders

**GET** `/admin/orders`

**Query Parameters:**
- `page`, `count`: (optional) pagination; `count` defaults to 100
- `status`: (optional) string - Filter by order status (exact match)
- `stage_uid`: (optional) string - Filter by CRM pipeline stage UID. Preferred over
  `status` for stage filtering: order statuses mirror stage *names*, so renaming a
  stage breaks a `status` filter but not a `stage_uid` one.
- `scope`: (optional) `pipeline` | `drafts`. `pipeline` returns only confirmed
  (non-draft) orders — the ones on the CRM board; `drafts` returns only unconfirmed
  draft orders (carts). Omitted means no lifecycle filter, i.e. drafts and confirmed
  orders together. An unrecognised value is rejected with 400 rather than silently
  ignored.
- `store_uid`: (optional) string - Filter by store. Store-scoped users are always
  restricted to their own store regardless of this parameter.
- `manager_uid`: (optional) string - Filter by the CRM-assigned manager
- `search`: (optional) string - Case-insensitive substring match on order number,
  order UID, client UID or client name

**Example:**
```bash
GET /admin/orders?scope=pipeline&stage_uid=stage-abc&page=1&count=20
```

The admin orders list uses `scope=pipeline` by default, and switches to
`scope=drafts` when the operator ticks "Show draft orders".

#### Order Marks Batch

**POST** `/admin/orders/marks`

Returns a compact per-order summary of the documents attached to each order. Used by
the admin orders list to render the invoice and shipment columns in one request per
page instead of loading full invoice/shipment records per row.

**Request Body:**
```json
{
  "data": ["order-uid-1", "order-uid-2"]
}
```

**Response:** Map keyed by order UID. Orders with neither invoices nor shipments are
omitted from the map.
```json
{
  "success": true,
  "data": {
    "order-uid-1": {
      "order_uid": "order-uid-1",
      "invoice_types": ["Proforma", "Faktura"],
      "has_shipment": true
    }
  }
}
```

- `invoice_types`: distinct names of the invoice types successfully generated for the
  order, ordered by when each type was first generated. Failed invoice attempts
  (non-2xx status or a populated `error`) are excluded.
- `has_shipment`: true when at least one shipment exists for the order, regardless of
  its carrier status.

Store-scoped users only receive marks for orders of their own store; UIDs outside
their store are dropped from the request.

#### Find Orders by Statuses Batch

**POST** `/admin/orders/find/status`

**Request Body:**
```json
{
  "data": ["new", "processing"]
}
```

**Response:** Array of order objects.

#### Update Order Status

**POST** `/admin/orders/status`

Primary use: External CRM systems transitioning orders through fulfillment stages.

**Request Body:**
```json
{
  "data": [
    {"uid": "order-123", "status": "confirmed"},
    {"uid": "order-456", "status": "processing"}
  ]
}
```

**Special Behavior - Order Confirmation:**
- When changing status to `"confirmed"`:
  1. Updates order status to "confirmed"
  2. Deletes all allocation records for this order (order is fulfilled)
  3. Products are now available for other orders

**Typical CRM Flow:**
1. Frontend creates order with `status: "new"` (allocation created)
2. CRM updates to `"processing"` (allocation remains)
3. CRM updates to `"confirmed"` (allocation deleted - order fulfilled)

#### Delete Orders Batch

**POST** `/admin/orders/delete`

**Request Body:**
```json
{
  "data": ["order-123", "order-456", "order-789"]
}
```

#### Delete Order Items Batch

**POST** `/admin/orders/item/delete`

**Request Body:**
```json
{
  "data": [
    {"order_uid": "order-123", "product_uid": "prod-456"},
    {"order_uid": "order-123", "product_uid": "prod-789"}
  ]
}
```

---

### Order Editing

Allows admin/manager to modify existing confirmed orders (change items, quantities, discount, address).

#### Check if Order Can Be Edited

**POST** `/admin/orders/edit/check`

**Request Body:**
```json
{
  "data": {
    "order_uid": "order-123"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "can_edit": true,
    "reason": ""
  }
}
```

**Notes:**
- Checks CRM pipeline stage's `allow_edit` flag
- Returns `can_edit: false` with reason if editing is blocked

#### Preview Order Edit

**POST** `/admin/orders/edit/preview`

Performs a dry-run calculation without saving. Shows what the order would look like after editing.

**Request Body:**
```json
{
  "data": {
    "order_uid": "order-123",
    "items": [
      {"product_uid": "prod-1", "quantity": 5},
      {"product_uid": "prod-2", "quantity": 3}
    ],
    "discount_percent": 10,
    "address_uid": "addr-456"
  }
}
```

**Response:** Full order object with recalculated totals (not saved to database)

Fields that carry no money are accepted by `/admin/orders/edit` but ignored by the
preview, since they cannot change a total:

| Field | Who may send it | Description |
|-------|-----------------|-------------|
| `price_type_uid` | admins only | Switches the order to another price type and adopts its currency. Rejected when any line has no price in the target type |
| `company_uid` | admins and managers | Reassigns the order to another selling legal entity. Must be an active company; the name is copied from the company directory, never taken from the payload. `""` clears the assignment |
| `internal_comment` | admins and managers | Staff-only warehouse note (max 2000 chars). Never returned by any client-facing endpoint; exchanged with the ERP through the `internal_comment` element of the ERP order edit endpoint. `""` clears it; omitting it leaves it untouched |

#### Edit Order

**POST** `/admin/orders/edit`

Applies modifications and recalculates the order.

**Request Body:** Same as Preview

**Response:**
```json
{
  "status": "success",
  "data": {
    "order": { /* full order with items */ },
    "message": "Order updated successfully"
  }
}
```

**Notes:**
- All fields are optional (only specified fields are modified)
- Backend recalculates all monetary values
- Creates activity record for the edit
- Tracks editing user for audit

---

### Order Splitting

Moves part of a confirmed order's goods onto new orders. Available when the order's
CRM stage has `allow_split` set (admins may split at any stage).

**The order is not cancelled — it becomes the first part.** It stays where it is,
keeps its `uid`, `number`, ERP number, creation date, stage, manager, history and
delivery cost, and simply ends up holding fewer goods. The goods that moved become
new orders alongside it, at the same stage, each carrying `parent_order_uid`
pointing at the order they came from.

Line prices and discounts are copied verbatim — a split never re-prices. All
amounts are gross (VAT included) cents, like the order total.

The planner keeps every product's line inside a single part where it can, letting a
part deviate from the target amount by `tolerance_percent` (default 10) to do so. Only
a line that fits into no part at all is cut by whole units.

#### Per-part company and payer

Each part can be assigned its own **selling company** and its own **billed party**
(a branch of the order's client, or the client itself). This is what makes splitting
useful at an invoicing stage, where full order editing is closed: the goods are
already agreed, and what needs correcting is who invoices whom.

**A part's assignment may not change its VAT rate.** The chosen party is run through
the same rate rule as the rest of the system (destination country vs. store country,
then the party's VAT number and rate); if the result differs from the order's current
rate, the whole split is refused with `400`. Splitting must move goods, not money.

In practice this only bites on cross-border orders. A domestic order carries the
store's rate whatever the party is, so every branch is selectable.

Use `/admin/orders/split/options` to populate the selectors — it returns each party
with the rate it would produce and a `vat_neutral` flag, so ineligible parties can be
shown disabled with a reason rather than silently omitted.

#### Check if Order Can Be Split

**POST** `/admin/orders/split/check`

**Request Body:**
```json
{"order_uid": "order-123"}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "can_split": false,
    "reason": "the order already has an issued invoice",
    "reason_code": "has_invoice"
  }
}
```

`reason` is an English sentence, for logs and as a last-resort message. `reason_code`
is the stable slug to key a localised message off — **never match on `reason`'s
text**. `stage_name` is present only with `stage_forbids`, so the message can name
the stage.

| `reason_code` | Meaning |
|---------------|---------|
| `not_found` | No such order |
| `draft` | Drafts cannot be split — confirm the order first |
| `cancelled` | Cancelled orders cannot be split |
| `no_items` | The order has nothing to divide |
| `not_in_pipeline` | The order is not on the CRM board |
| `stage_forbids` | The current stage has no `allow_split`. Waived for admins; `stage_name` names the stage |
| `has_shipment` | A shipment already exists for the order |
| `has_invoice` | An invoice has already been issued for the order |
| `has_shipment_and_invoice` | Both |

The three document refusals apply **to admins too** — a split takes goods off the
order, and neither document is reissued, so it would silently stop matching the order
it names. A *failed* invoice attempt does not block: retrying after a split is normal.

Only `stage_forbids` is waived for admins.

#### Split Options

**POST** `/admin/orders/split/options`

Lists what the parts may be assigned to. One round trip for the whole dialog.

**Request Body:**
```json
{"order_uid": "order-123"}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "order_uid": "order-123",
    "current_vat_rate": 0,
    "current_company_uid": "company-1",
    "current_branch_uid": "branch-7",
    "client_name": "Acme GmbH",
    "companies": [
      {"uid": "company-1", "name": "Comex Sp. z o.o."},
      {"uid": "company-2", "name": "Comex Trade"}
    ],
    "branches": [
      {"uid": "", "is_client": true, "name": "Acme GmbH", "vat_number": "DE123",
       "result_vat_rate": 0, "vat_neutral": true, "active": true},
      {"uid": "branch-7", "name": "Acme Berlin", "vat_number": "DE456",
       "result_vat_rate": 0, "vat_neutral": true, "active": true},
      {"uid": "branch-9", "name": "Acme Counter", "vat_number": "",
       "result_vat_rate": 23, "vat_neutral": false, "active": true,
       "warnings": ["official_address_missing"]}
    ]
  }
}
```

`branches[]` always leads with the parent client (`uid: ""`, `is_client: true`) —
billing the client directly is a real choice. Only options with `vat_neutral: true`
**and** `active: true` may be sent as an assignment; the rest are returned so the UI
can explain why.

`warnings[]` are advisory and never block a split. They are slugs:

| Slug | Meaning |
|------|---------|
| `business_registration_missing` | The store requires a business registration number and this party has none. Branch data never falls back to the parent |
| `official_address_missing` | The party has no official (invoicing) address, so the invoice's `billing_*` fields will be empty |
| `contact_email_missing` | The branch has no e-mail of its own. The invoice service keys contractors by e-mail, so it will be merged into the parent client's contractor record |

An equal VAT rate is not the same as a complete invoice — these are the difference.

#### Preview Split

**POST** `/admin/orders/split/preview`

Plans the division and resolves the assignments without writing anything. An invalid
branch, or one that would move the VAT rate, fails here rather than on commit.

**Request Body:**
```json
{
  "order_uid": "order-123",
  "mode": "parts",
  "parts": 2,
  "tolerance_percent": 10,
  "assignments": [
    {"index": 2, "company_uid": "company-2", "branch_uid": "branch-7"}
  ]
}
```

`mode` is `parts` (requires `parts` >= 2) or `limit` (requires `limit`, the maximum
gross amount of one part, in cents).

`assignments` is optional, at most one entry per part, and only for the parts you want
to change — a part left out inherits the order's company and billed party. `index` is
the 1-based part number as it appears in the preview.

Both UIDs distinguish three states:

| Value | Meaning |
|-------|---------|
| key omitted | Inherit from the order |
| `""` | `company_uid`: no company. `branch_uid`: bill the parent client directly |
| a UID | That company / branch |

**Response:**
```json
{
  "status": "success",
  "data": {
    "order_uid": "order-123",
    "number": "UA-500",
    "total": 2000000,
    "target_amount": 1000000,
    "tolerance_percent": 10,
    "mode": "parts",
    "within_tolerance": true,
    "divided_products": [],
    "parts": [
      {
        "index": 1,
        "total": 995000,
        "company_uid": "company-1",
        "company_name": "Comex Sp. z o.o.",
        "branch_uid": "branch-3",
        "payer_name": "Acme Munich",
        "vat_rate": 0,
        "items": [{"product_uid": "prod-1", "sku": "A-1", "quantity": 10, "total": 995000}]
      },
      {
        "index": 2,
        "total": 1005000,
        "company_uid": "company-2",
        "company_name": "Comex Trade",
        "branch_uid": "branch-7",
        "payer_name": "Acme Berlin",
        "vat_rate": 0,
        "warnings": ["official_address_missing"],
        "items": [{"product_uid": "prod-2", "sku": "A-2", "quantity": 5, "total": 1005000}]
      }
    ]
  }
}
```

The company, payer, `vat_rate` and `warnings` are reported for **every** part,
assigned or not, so the whole invoicing picture is reviewable before committing.
`vat_rate` is always the order's existing rate.

#### Split Order

**POST** `/admin/orders/split`

**Request Body:** same as Preview.

**Response:** the same shape, with `order_uid` and `number` filled in on every part.
Part 1 carries the original order's `order_uid` and `number`, because part 1 *is* the
original order.

**Notes:**
- Runs in one transaction: the order is updated to hold only what it kept, the other
  parts are created, and stock allocations are rebuilt across all of them
- Allocations are rebuilt when the stage creates them **or** the order already held
  them, so an order that reserves stock does not lose the reservation by being split
- Before writing, the order row is locked and re-checked: if it no longer holds
  exactly the goods the plan was built from, the split is refused. This covers an
  edit landing mid-plan and makes a double-submit safe
- The order's manager assignment is copied to every new part
- The order is flagged `is_edited` — reducing the product list is an edit
- Status history records "Split: moved goods to orders ..." on the order that stayed
  and "Split from ..." on each new one
- Change records are written for all of them, so the ERP picks them up. See
  [data-management-api.md](data-management-api.md#order-splitting)

**Errors:**

| Status | Cause |
|--------|-------|
| `400` | The plan is impossible (more parts than units, limit already met); an assignment names an unknown/inactive/foreign branch or an inactive company; an assignment would change the VAT rate; the order changed while the split was being prepared |
| `403` | The stage does not allow splitting; the order already has a shipment or an issued invoice |

---

### Search Products for Order

**GET** `/admin/products/search`

Search products by SKU or name (used for autocomplete when adding products to orders).

**Query Parameters:**
- `q` (required): Search query (SKU or name)
- `store_uid` (required): Store UID for inventory/price context
- `language` (optional, default: "en"): Language for product names
- `limit` (optional, default: 10, max: 10): Result limit

**Response:** Array of product search results with name, SKU, price, and stock.

---

### Order Invoice Operations

Manage invoice generation for orders. Requires invoice feature to be enabled.

#### Request Invoice

**POST** `/admin/orders/invoice/request`

**Request Body:**
```json
{
  "data": {
    "order_uid": "order-123",
    "type_uid": "invoice-type-1"
  }
}
```

**Response:** Invoice object (with `response_type` of "link" or "file")

#### Get Invoice Types for Order

**POST** `/admin/orders/invoice/types`

Returns available invoice types that can be used for this order.

**Request Body:**
```json
{
  "data": {
    "order_uid": "order-123"
  }
}
```

**Response:** Array of `InvoiceType` objects

#### Get Invoices for Orders

**POST** `/admin/orders/invoice/list`

**Request Body:**
```json
{
  "data": ["order-123", "order-456"]
}
```

**Response:** Map of order UIDs to their invoice arrays:
```json
{
  "status": "success",
  "data": {
    "order-123": [
      {
        "uid": "inv-1",
        "order_uid": "order-123",
        "type_uid": "type-1",
        "response_type": "file",
        "file_name": "invoice.pdf",
        "status_code": 200,
        "created_at": "2025-01-15T10:00:00Z"
      }
    ]
  }
}
```

#### Download Invoice

**GET** `/admin/orders/invoice/{uid}`

Downloads an invoice file. Only works for invoices with `response_type: "file"`.

**Response:** Binary file download with appropriate Content-Type and Content-Disposition headers.

---

### Order Shipment Operations

Create and manage shipments for orders.

#### Create Shipment

**POST** `/admin/orders/shipment/create`

**Request Body:**
```json
{
  "data": {
    "order_uid": "order-123",
    "carrier_uid": "carrier-1",
    "box_uid": "box-1",
    "weight_kg": 2.5,
    "pieces_count": 1,
    "length_cm": 30,
    "width_cm": 20,
    "height_cm": 15,
    "service_type": "AH",
    "cod_amount": 5000
  }
}
```

**Response:** Created `Shipment` object with tracking number and label data.

**Notes:**
- `box_uid` is optional - if provided, box dimensions are used
- `cod_amount` is in cents (cash on delivery)
- Receiver address is snapshotted from the order
- **Company gate:** when the order carries a `company_uid` and at least one active carrier of the order's store is bound to that company (`ShipmentCarrier.company_uid`), only those carriers are accepted; any other `carrier_uid` is rejected. If `carrier_uid` is omitted, a company-bound carrier takes precedence over the store's default carrier. Orders without a company (or companies with no bound carrier) behave as before. The same rule applies to `/admin/orders/shipment/price`.
- **Consolidation:** an optional `additional_order_uids` array puts several orders on one AWB. See below.

#### Consolidated Shipments

Several orders travelling on one carrier AWB. `order_uid` stays the **lead
order** — its address and branch produce the label, and it is the order recorded
on `shipments.order_uid`. The extras are recorded in `shipment_orders`, and the
shipment then appears on every member order's detail page, order-list marks and
ERP payload.

Add `additional_order_uids` to the **create** (and **price**) request:

```json
{
  "data": {
    "order_uid": "order-123",
    "additional_order_uids": ["order-456", "order-789"],
    "carrier_uid": "carrier-1"
  }
}
```

Orders may share an AWB only when they have the same client, store, company,
currency and destination **country**, no active shipment, and **the same CRM
stage**, which must allow shipment creation. Zip, city and street are *not*
compared: the consignment ships to the lead order's address, and whether several
orders belong in one parcel is the client's call. The carrier adds
two more rules:
the destination must need **no customs declaration** (one declaration cannot
cover several orders' invoices), and the carrier must be able to put several
parcels on one AWB to that destination. A refusal returns **400** with the rule
that blocked it.

Effects of consolidating:
- parcels are the union of every order's ERP boxes, renumbered `1..N`
- insurance under `insurance_mode: "order_total"` covers the **combined** value
- the carrier's freight cost is split across the member orders **by weight**
- carrier tracking events advance **every** member order's CRM stage
- **stage moves are synchronised**: a board drag or ERP-driven move of any member
  moves the whole group. Invoice-driven moves stay per-order, because invoices
  are per-order — a companion has no invoice of its own to justify the stage.
- each member order gets an order-status-history entry naming the AWB and its companions
- cancelling the shipment dissolves the group, and each order moves independently again

A consolidated shipment carries an `orders` array — every order it covers, lead
first — on the shipment object and in the shipment list. It is **absent for an
ordinary single-order shipment**, so a non-empty `orders` is itself the signal
that a waybill is consolidated. Searching the shipment list by any member order's
number finds it.

##### List consolidation candidates

**POST** `/admin/orders/shipment/consolidation/candidates`

```json
{ "data": { "order_uid": "order-123" } }
```

Returns the same client's other orders as `ConsolidationCandidate` objects
(`order_uid`, `number`, `total`, `box_count`, `weight_kg`, `eligible`, `reason`,
`reason_code`, `reason_params`). Orders blocked by a fixable condition are
returned with `eligible: false` and a reason, so the operator can see why an
expected order is not offered. Orders that could never qualify — another client,
another country, a draft — are omitted.

`total` is in **cents**, the same family as `Order.total`.

`reason` is English and meant as a fallback. `reason_code` is the stable
identifier a UI translates against, and `reason_params` carries the values the
sentence names so the translated form can name them too:

```json
{
  "eligible": false,
  "reason": "at stage 'Packing', not 'Ready to ship'",
  "reason_code": "differentStage",
  "reason_params": { "stage": "Packing", "leadStage": "Ready to ship" }
}
```

The codes are `alreadyOnShipment`, `orderIsDraft`, `orderCancelled`,
`differentClient`, `differentStore`,
`differentCurrency`, `differentCountry`, `activeShipmentExists`, `notOnBoard`,
`differentStage`, `stageForbidsShipment`, `orderNotFound`, `carrierNotFound` and
`leadNotOnBoard`. A refusal composed from a carrier's own error carries no
`reason_code`; render `reason` as-is.

##### Check a proposed consolidation

**POST** `/admin/orders/shipment/consolidation/check`

```json
{
  "data": {
    "order_uid": "order-123",
    "additional_order_uids": ["order-456"],
    "carrier_uid": "carrier-1"
  }
}
```

Returns `ConsolidationCheckResponse`: an overall `eligible` flag, a `reason` (and
`reason_code`, as above) when a carrier or destination rule blocks the whole
combination, the per-order verdicts in `orders` (lead first), and the totals the
consignment would carry (`total_boxes`, `total_weight_kg`, `total_value`, in
cents). `carrier_uid` is optional; the customs and multi-parcel rules are only
checked when it is given.

These totals are the ones to display. They count only eligible orders and are
the same arithmetic booking will do, so a caller that sums the candidate rows
itself will eventually disagree with what the carrier is handed.

A refusal here is a **200** with `eligible: false` — the caller asked a question
and got an answer.

#### Saved Shipment Recipients

The reusable "who and where" a client's parcels go to. A client legitimately has
several (shops, warehouses, named people), so this is a list rather than the
single last-used destination `/admin/orders/shipment/client-pref` returns.

Availability is per driver: a carrier opts in by returning a `recipient` block
from `/admin/shipment/carriers/{uid}/options`, which names the selector keys that
form a recipient and maps them onto the carrier-neutral columns. Carriers without
one return an empty list here.

**POST** `/admin/orders/shipment/recipients` — list, default first then most
recently used.

```json
{ "data": { "order_uid": "order-123", "carrier_uid": "carrier-1" } }
```

**POST** `/admin/orders/shipment/recipients/save` — create or update. A blank
`uid` creates (re-using an identical destination the client already has rather
than duplicating it); a `uid` updates that row in place. `values` is the flat
selector map, including the resolved `<key>_ref`, `<key>_label` and flattened
lookup meta `<key>__<meta>` entries.

```json
{
  "data": {
    "uid": "",
    "order_uid": "order-123",
    "carrier_uid": "carrier-1",
    "set_default": false,
    "values": {
      "recipient_type": "PrivatePerson",
      "recipient_name": "Ільченко Анна",
      "recipient_phone": "0671234567",
      "delivery_mode": "warehouse",
      "recipient_city": "Київ",
      "recipient_city_ref": "8d5a980d-391c-11dd-90d9-001a92567626",
      "recipient_city__settlement_ref": "e71 …",
      "recipient_warehouse_number": "5",
      "recipient_warehouse_number_ref": "1ec09d2e- …"
    }
  }
}
```

**POST** `/admin/orders/shipment/recipients/delete` — soft-delete, so shipments
that reference the recipient stay resolvable.

**POST** `/admin/orders/shipment/recipients/default` — mark as the client's
default for that carrier; the creation dialog preselects it.

```json
{ "data": { "uid": "recipient-1" } }
```

All four are store-scoped: a store-scoped user may only touch recipients of
orders in their own store.

#### Get Shipments by Order

**POST** `/admin/orders/shipment/list`

**Request Body:**
```json
{
  "data": {
    "order_uid": "order-123"
  }
}
```

**Response:** Array of `Shipment` objects for the order

#### Get Shipments Batch

**POST** `/admin/orders/shipment/batch`

**Request Body:**
```json
{
  "data": ["shipment-1", "shipment-2"]
}
```

#### List All Shipments

**GET** `/admin/orders/shipment`

**Query Parameters:**
- `offset` (default: 0)
- `limit` (default: 50)

**Response:** Paginated list of shipments (without large label data)

#### Get Shipment Details

**GET** `/admin/orders/shipment/{uid}`

**Response:** Full `Shipment` object including events

#### Download Shipment Label

**GET** `/admin/orders/shipment/{uid}/label`

**Response:**
```json
{
  "format": "PDF",
  "data": "base64-encoded-label-data",
  "url": "",
  "file_name": "label-SHP-123.pdf"
}
```

#### Update Tracking

**POST** `/admin/orders/shipment/{uid}/track`

Fetches latest tracking data from the carrier.

**Response:** Updated `Shipment` object with new events

#### Cancel Shipment

**POST** `/admin/orders/shipment/{uid}/cancel`

**Response:** Success message

**Notes:** Only works for shipments not in a final state (delivered/returned/cancelled)

#### Get Shipment Events

**GET** `/admin/orders/shipment/{uid}/events`

**Response:** Array of `ShipmentEvent` objects (tracking history)

---

### Shipment Service (Read-Only)

Read-only endpoints for shipment service data. Available to admin and manager.

#### Get Shipment Settings

**GET** `/admin/shipment/settings`

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "enabled": true,
    "default_carrier_uid": "carrier-1",
    "auto_track_updates": true,
    "tracking_poll_interval_minutes": 60,
    "active_carrier_count": 3,
    "service_running": true
  }
}
```

#### List Active Carriers

**POST** `/admin/shipment/carriers/active`

**Query Parameters:**
- `store_uid` (optional): Filter to carriers visible to the store (store-specific + shared rows)
- `order_uid` (optional): Scope the list to an order — returns carriers of the order's store, restricted to the order's company-bound carriers when the company gate applies (takes precedence over `store_uid`)

**Response:** Array of active `ShipmentCarrier` objects (with masked credentials)

#### Get Active Boxes

**GET** `/admin/shipment/boxes/active`

**Query Parameters:**
- `store_uid` (optional): Filter by store

**Response:** Array of active `ShipmentBox` templates

---

### CRM Change Tracking

Records modifications to Orders, Clients, and Client Addresses for external CRM sync.

#### List Pending Changes

**GET** `/admin/changes`

Retrieve all pending change records that haven't been confirmed by the CRM. Ordered by creation time (oldest first).

**Query Parameters:**
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "uid": "change-abc123",
      "object_name": "order",
      "object_uid": "order-456",
      "created_at": "2025-01-15T10:00:00Z"
    }
  ],
  "metadata": {
    "offset": 0,
    "limit": 100,
    "total": 2
  }
}
```

**Object Types:**
- `order` - Order created, updated, or status changed
- `client` - Client created or updated
- `client_address` - Client address created, updated, or deleted

#### Confirm Changes

**POST** `/admin/changes/confirm`

Confirm that changes have been processed by the CRM. Deletes the change records.

**Request Body:**
```json
{
  "data": ["change-abc123", "change-def456"]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Changes confirmed and deleted successfully"
}
```

**Note:** Only confirm changes after successfully processing them. Once confirmed, change records cannot be recovered.

---

### Product Management

#### List All Products

**GET** `/admin/products`

**Query Parameters:**
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100
- `category`: (optional) string - Filter by category UID

#### List Products with Details

**GET** `/admin/products/details`

Returns products enriched with descriptions, prices, and inventory data.

**Query Parameters:**
- `page`, `count` (pagination)
- `language` (optional): Language code for descriptions
- `store` (optional): Store UID for inventory
- `price_type` (optional): Price type UID for pricing
- `category` (optional): Category UID filter

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "uid": "prod-1",
      "sku": "WIDGET-001",
      "category_uid": "cat-1",
      "active": true,
      "sort_order": 10,
      "is_new": false,
      "product_name": "Widget",
      "product_description": "A useful widget",
      "category_name": "Widgets",
      "category_description": "All widgets",
      "price": 1999,
      "quantity": 50,
      "tags": [
        {
          "uid": "tag-new",
          "store_uid": "store-1",
          "name": "NEW",
          "color": "#2E7D32",
          "sort_order": 10
        }
      ]
    }
  ]
}
```

#### Product Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Unique identifier |
| `sku` | string | Yes | Stock keeping unit code |
| `image` | string | No | Legacy image field (use Product Images API instead) |
| `category_uid` | string | Yes | Category this product belongs to |
| `active` | bool | No | Whether product is visible (default: false) |
| `sort_order` | int | No | Display order (default: 0) |
| `is_new` | bool | No | Mark as new product (default: false) |
| `barcode` | string | No | Product barcode |
| `is_hot_sale` | bool | No | Mark as hot sale item (default: false) |
| `tags` | array | No | Store-scoped product tags returned by tag-aware product reads; not persisted on the products table |

#### Get Products Batch

**POST** `/admin/products/batch`

**Request Body:**
```json
{
  "data": ["prod-123", "prod-456"]
}
```

#### Find Products by Category Batch

**POST** `/admin/products/find/category`

**Request Body:**
```json
{
  "data": ["cat-123", "cat-456"]
}
```

#### Upsert Products (Create or Update)

**POST** `/admin/products`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "prod-123",
      "sku": "WIDGET-001",
      "category_uid": "cat-456",
      "active": true,
      "sort_order": 10,
      "is_new": true,
      "barcode": "1234567890123"
    }
  ]
}
```

#### Delete Products Batch

**POST** `/admin/products/delete`

**Request Body:**
```json
{
  "data": ["prod-123", "prod-456"]
}
```

#### Update Product Active Status (Batch)

**POST** `/admin/products/active`

**Request Body:**
```json
{
  "data": [
    {"uid": "prod-123", "active": true},
    {"uid": "prod-456", "active": false}
  ]
}
```

---

### CRM Pipeline Board

The CRM module provides a Kanban-style pipeline board for managing orders through sales stages.

#### Pipeline Stage Entity

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Unique identifier |
| `name` | string | Stage display name |
| `color` | string | Hex color code for UI |
| `sort_order` | int | Display order |
| `is_initial` | bool | New orders auto-placed here |
| `is_final` | bool | Orders considered completed |
| `allow_edit` | bool | Allow order editing in this stage |
| `allow_create_shipment` | bool | Allow creating shipments |
| `allow_split` | bool | Allow splitting orders in this stage |
| `creates_allocation` | bool | Create stock allocations when entering |
| `deletes_allocation` | bool | Delete allocations when entering |
| `client_phase` | string | Client-visible phase this stage maps to: `placed`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`, or `""` for internal-only |
| `store_uid` | string | Optional store-specific stage |
| `active` | bool | Soft delete flag |

#### List Stages

**GET** `/admin/crm/stages`

**Query Parameters:**
- `page` (default: 1)
- `count` (default: 50)

**Response:** Paginated array of `CRMPipelineStage`

#### Get Stages Batch

**POST** `/admin/crm/stages/batch`

**Request Body:**
```json
{
  "data": ["stage-uid-1", "stage-uid-2"]
}
```

#### List Transitions

**GET** `/admin/crm/transitions`

Returns all allowed stage-to-stage transitions.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "from_stage_uid": "stage-1",
      "to_stage_uid": "stage-2",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### Get Board

**GET** `/admin/crm/board`

Returns the complete pipeline board with all stages and their orders.

**Query Parameters:**
- `store_uid` (optional): Filter by store (managers forced to their store)
- `orders_per_stage` (default: 50): Max orders per stage column

**Response:**
```json
{
  "status": "success",
  "data": {
    "columns": [
      {
        "stage": {
          "uid": "stage-1",
          "name": "New Orders",
          "color": "#6366f1",
          "sort_order": 0,
          "is_initial": true,
          "is_final": false
        },
        "orders": [
          {
            "order": {
              "uid": "order-123",
              "number": "ORD-001",
              "client_uid": "client-1",
              "total": 15999,
              "currency_code": "USD",
              "status": "new"
            },
            "assignment": {
              "user_uid": "user-1",
              "user_name": "John Doe"
            },
            "client": {
              "uid": "client-1",
              "name": "ACME Corp"
            },
            "entered_at": "2025-01-15T10:30:00Z",
            "time_in_stage_seconds": 3600
          }
        ],
        "count": 25
      }
    ]
  }
}
```

**Notes:**
- Managers can only view their own store's board
- Admins can view all stores or filter by `store_uid`

#### Get Board Changes

**GET** `/admin/crm/board/changes`

Returns changes since a timestamp (for polling-based refresh).

**Query Parameters:**
- `since` (required): RFC3339 timestamp
- `store_uid` (optional): Filter by store

**Response:**
```json
{
  "status": "success",
  "data": {
    "last_change_at": "2025-01-01T12:30:00Z",
    "has_changes": true,
    "affected_stages": ["stage-1", "stage-2"],
    "change_count": 5
  }
}
```

#### Move Order to Stage

**POST** `/admin/crm/board/move`

**Query Parameters:**
- `validate_transition` (default: true): Set to `false` to skip transition rules

**Request Body:**
```json
{
  "data": {
    "order_uid": "order-123",
    "stage_uid": "stage-2"
  }
}
```

**Notes:**
- Validates allowed transitions unless `?validate_transition=false`
- Creates activity record for the move

#### Get Order Pipeline Info Batch

**POST** `/admin/crm/board/pipeline/batch`

**Request Body:**
```json
{
  "data": ["order-uid-1", "order-uid-2"]
}
```

**Response:** Map of order UIDs to their pipeline info (stage, entered_at)

#### Populate Pipeline

**POST** `/admin/crm/board/populate`

Adds existing orders (not already in pipeline) to the initial stage.

**Query Parameters:**
- `store_uid` (optional): Filter by store

**Response:**
```json
{
  "status": "success",
  "data": {
    "added": 15
  }
}
```

---

### CRM Assignments

#### Assign Orders

**POST** `/admin/crm/assignments`

**Request Body:**
```json
{
  "data": {
    "order_uids": ["order-1", "order-2"],
    "user_uid": "user-123"
  }
}
```

#### Get Assignments Batch

**POST** `/admin/crm/assignments/batch`

**Request Body:**
```json
{
  "data": ["order-uid-1", "order-uid-2"]
}
```

**Response:** Array of `CRMOrderAssignment` objects

#### Unassign Orders

**POST** `/admin/crm/assignments/delete`

**Request Body:**
```json
{
  "data": ["order-uid-1", "order-uid-2"]
}
```

#### Get My Assignments

**GET** `/admin/crm/assignments/my`

Returns orders assigned to the current authenticated user.

**Query Parameters:**
- `page` (default: 1)
- `count` (default: 50)

---

### CRM Activities

Activity timeline for order tracking (notes, stage changes, assignments, edits).

#### Activity Types

- `note` - Manual note
- `comment` - Comment on order
- `stage_change` - Order moved between stages
- `assignment` / `unassignment` - Order assigned/unassigned
- `order_created` - Order created
- `status_change` - Order status changed
- `order_edit` - Order edited
- `items_changed` / `total_changed` / `discount_changed` - Specific changes

#### Get Activity Timeline

**GET** `/admin/crm/activities/{order_uid}`

**Query Parameters:**
- `page` (default: 1)
- `count` (default: 50)

**Response:** Paginated array of activities (newest first)

```json
{
  "status": "success",
  "data": [
    {
      "uid": "activity-123",
      "order_uid": "order-123",
      "user_uid": "user-1",
      "user_name": "John Doe",
      "activity_type": "note",
      "content": "Discussed pricing with client",
      "is_internal": false,
      "metadata": {},
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### Create Activity

**POST** `/admin/crm/activities`

**Request Body:**
```json
{
  "data": {
    "order_uid": "order-123",
    "activity_type": "note",
    "content": "Called client about delivery",
    "is_internal": true,
    "metadata": {}
  }
}
```

**Response:** Activity UID

#### Delete Activity

**DELETE** `/admin/crm/activities/{uid}`

#### Delete Activities Batch

**POST** `/admin/crm/activities/delete`

**Request Body:**
```json
{
  "data": {
    "uids": ["activity-1", "activity-2"]
  }
}
```

---

### CRM Tasks

Task management linked to orders.

#### Task Entity

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Unique identifier |
| `order_uid` | string | Linked order |
| `assigned_to_uid` | string | Assigned user |
| `assigned_to_name` | string | Populated from user lookup |
| `created_by_uid` | string | Creator |
| `created_by_name` | string | Populated from user lookup |
| `title` | string | Task title (max 500 chars) |
| `description` | string | Detailed description |
| `due_date` | timestamp | Optional due date |
| `priority` | string | `low`, `medium`, `high`, `urgent` |
| `status` | string | `pending`, `in_progress`, `completed`, `cancelled` |
| `completed_at` | timestamp | When task was completed |

#### Create Task

**POST** `/admin/crm/tasks`

**Request Body:**
```json
{
  "data": {
    "order_uid": "order-123",
    "assigned_to_uid": "user-456",
    "title": "Prepare custom quote",
    "description": "Client requested volume discount",
    "due_date": "2025-01-20T10:00:00Z",
    "priority": "high"
  }
}
```

**Response:** Task UID

#### List Tasks

**GET** `/admin/crm/tasks`

**Query Parameters:**
- `page` (default: 1)
- `count` (default: 50)

#### Get My Tasks

**GET** `/admin/crm/tasks/my`

Returns tasks assigned to the current authenticated user.

**Query Parameters:**
- `page` (default: 1)
- `count` (default: 50)

#### Get Overdue Tasks

**GET** `/admin/crm/tasks/overdue`

**Query Parameters:**
- `page` (default: 1)
- `count` (default: 50)

#### Get Tasks by Order

**GET** `/admin/crm/tasks/order/{order_uid}`

**Query Parameters:**
- `page` (default: 1)
- `count` (default: 50)

#### Get Tasks Batch

**POST** `/admin/crm/tasks/batch`

**Request Body:**
```json
{
  "data": ["task-uid-1", "task-uid-2"]
}
```

#### Delete Tasks Batch

**POST** `/admin/crm/tasks/delete`

**Request Body:**
```json
{
  "data": {
    "uids": ["task-1", "task-2"]
  }
}
```

#### Get Task

**GET** `/admin/crm/tasks/{uid}`

#### Update Task

**PUT** `/admin/crm/tasks/{uid}`

**Request Body** (all fields optional):
```json
{
  "data": {
    "title": "Updated title",
    "assigned_to_uid": "user-new",
    "due_date": "2025-01-25T10:00:00Z",
    "priority": "urgent",
    "status": "in_progress"
  }
}
```

#### Delete Task

**DELETE** `/admin/crm/tasks/{uid}`

#### Update Task Status

**POST** `/admin/crm/tasks/{uid}/status`

**Request Body:**
```json
{
  "data": {
    "status": "in_progress"
  }
}
```

#### Complete Task

**POST** `/admin/crm/tasks/{uid}/complete`

Sets status to "completed" and records `completed_at` timestamp.

---

### CRM Dashboard & Analytics

#### CRM Dashboard

**GET** `/admin/crm/dashboard`

**Query Parameters** (all optional):
- `store_uid`: Filter by store
- `date_from`, `date_to`: RFC3339 timestamps
- `assignee_uid`: Filter by assignee
- `priority`: Filter by priority

**Response:** Aggregated statistics including pipeline stats, workload stats, task stats, and recent activity.

#### Team Workload

**GET** `/admin/crm/workload`

**Query Parameters:** Same as Dashboard

**Response:** Per-user workload statistics (assigned orders, pending/overdue tasks, completions)

#### Pipeline Statistics

**GET** `/admin/crm/pipeline-stats`

**Query Parameters:** Same as Dashboard

**Response:** Per-stage statistics (order count, total value, avg days in stage)

#### Task Statistics

**GET** `/admin/crm/task-stats`

**Query Parameters:** Same as Dashboard

**Response:** Aggregated task counts (pending, in progress, overdue, completed today/week)

---

### CRM Users

#### Get Assignable Users

**GET** `/admin/crm/users`

Returns users that can be assigned to orders (admins and managers).

**Query Parameters:**
- `store_uid` (optional): Filter by store

**Notes:**
- Admins see all admins + managers
- Managers see only managers in their store

---

## Admin Role Only

### CRM Pipeline Configuration (Admin Only)

#### Upsert Stages

**POST** `/admin/crm/stages`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "",
      "name": "New Orders",
      "color": "#6366f1",
      "sort_order": 0,
      "is_initial": true,
      "is_final": false,
      "allow_edit": true,
      "allow_create_shipment": false,
      "allow_split": false,
      "creates_allocation": false,
      "deletes_allocation": false,
      "client_phase": "placed",
      "active": true
    }
  ]
}
```

**Notes:**
- Only one stage can be marked as `is_initial`
- `client_phase` decides what the client sees and whether they are emailed. A stage left at `""` never appears on the client's progress track and never triggers a client notification, so internal pipeline churn stays internal. A client notification fires only when a move changes the phase, whatever route made the move — REST status update or CRM board drag

#### Delete Stages

**POST** `/admin/crm/stages/delete`

**Request Body:**
```json
{
  "data": ["stage-uid-1", "stage-uid-2"]
}
```

#### Reorder Stages

**POST** `/admin/crm/stages/reorder`

**Request Body:**
```json
{
  "data": [
    {"uid": "stage-uid-1", "sort_order": 0},
    {"uid": "stage-uid-2", "sort_order": 1}
  ]
}
```

#### Upsert Transitions

**POST** `/admin/crm/transitions`

**Request Body:**
```json
{
  "data": [
    {"from_stage_uid": "stage-1", "to_stage_uid": "stage-2"}
  ]
}
```

#### Delete Transitions

**POST** `/admin/crm/transitions/delete`

**Request Body:**
```json
{
  "data": [
    {"from_stage_uid": "stage-1", "to_stage_uid": "stage-2"}
  ]
}
```

---

### Shipment Service Configuration (Admin Only)

#### Update Shipment Settings

**PUT** `/admin/shipment/settings`

**Request Body:**
```json
{
  "data": {
    "enabled": true,
    "default_carrier_uid": "carrier-1",
    "auto_track_updates": true,
    "tracking_poll_interval_minutes": 60
  }
}
```

#### Restart Shipment Service

**POST** `/admin/shipment/restart`

Restarts the shipment tracking service.

#### Carrier Management

##### List All Carriers

**GET** `/admin/shipment/carriers`

**Query Parameters:**
- `offset` (default: 0)
- `limit` (default: 50)

##### Upsert Carriers

**POST** `/admin/shipment/carriers`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "",
      "name": "DHL Express",
      "carrier_type": "dhl24",
      "api_url": "https://api.dhl.com/...",
      "username": "user",
      "password": "pass",
      "account_number": "1234567",
      "default_service_type": "AH",
      "active": true,
      "store_uid": "store-1",
      "company_uid": "a1b2c3d4-0000-0000-0000-000000000001",
      "config": {},
      "event_mappings": {
        "DELIVERED": "stage-final-uid",
        "RETURNED": null
      }
    }
  ]
}
```

**Carrier Types:** `dhl24`, `dpd`, `inpost`, `novaposhta`, `manual`

**Event Mappings:** Map carrier event codes to CRM stage UIDs. `null` value means "record only" (don't move order).

**Company Binding:** `company_uid` (optional, nullable) links the carrier to a company from the ERP-owned directory (see [data-management-api.md](data-management-api.md#company)). Orders carrying the same `company_uid` may then ship only via that company's carriers; `null` means the carrier is not bound and stays available to every order.

##### Get Carriers Batch

**POST** `/admin/shipment/carriers/batch`

**Request Body:**
```json
{
  "data": ["carrier-uid-1", "carrier-uid-2"]
}
```

##### Delete Carriers

**POST** `/admin/shipment/carriers/delete`

**Request Body:**
```json
{
  "data": ["carrier-uid-1", "carrier-uid-2"]
}
```

##### Test Carrier Connection

**POST** `/admin/shipment/carriers/test`

**Request Body:**
```json
{
  "data": {
    "carrier_uid": "carrier-1"
  }
}
```

Or test with new credentials:
```json
{
  "data": {
    "carrier_type": "dhl24",
    "api_url": "https://api.dhl.com/...",
    "username": "user",
    "password": "pass",
    "account_number": "1234567"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Connection successful",
  "account_info": "Account Name",
  "api_version": "2.0"
}
```

#### Box Template Management

##### Upsert Boxes

**POST** `/admin/shipment/boxes`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "",
      "name": "Small Box",
      "description": "For small items",
      "length_cm": 30,
      "width_cm": 20,
      "height_cm": 15,
      "max_weight_kg": 5.0,
      "active": true,
      "store_uid": "store-1"
    }
  ]
}
```

##### List Boxes

**GET** `/admin/shipment/boxes`

**Query Parameters:**
- `page`, `count` (pagination)

##### Get Boxes Batch

**POST** `/admin/shipment/boxes/batch`

**Request Body:**
```json
{
  "data": ["box-uid-1", "box-uid-2"]
}
```

##### Delete Boxes

**POST** `/admin/shipment/boxes/delete`

**Request Body:**
```json
{
  "data": ["box-uid-1", "box-uid-2"]
}
```

---

### User Management

#### User Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | No* | Unique identifier (*optional for create, required for update) |
| `username` | string | Yes | Unique username for login |
| `password` | string | No | Password (omit to keep unchanged on update) |
| `email` | string | Yes | Email address (must be valid email format) |
| `first_name` | string | No | User's first name |
| `last_name` | string | No | User's last name |
| `role` | string | Yes | User role: `admin`, `manager`, or `content_editor`. Any other value is rejected with `VALIDATION_ERROR`. |
| `active` | bool | No | Login gate. `false` blocks login and revokes the user's open sessions. **Omitting the field leaves the stored value unchanged** — send it explicitly to change it. New users default to active. |
| `store_uid` | string | No | Assigned store UID |
| `price_type_uid` | string | No | Default price type for this user |

> **Retired roles.** `user` and `client` used to be offered by the admin form
> and are no longer accepted on write. Neither was ever read by an
> authorization check — every gate tests for `admin`, `manager` or
> `content_editor` — so an account holding one could authenticate and then
> reach nothing beyond the `/auth` self-service endpoints. Use `active: false`
> to park an account instead. Existing rows are untouched and still read/list
> normally; saving one requires choosing a current role.
>
> Note that customers are not user rows at all — they live in the `clients`
> table and authenticate with phone + PIN.

> A blocked user keeps their row, role, store binding and order history — only
> authentication is refused. Login returns `403 FORBIDDEN`, and any request
> made with an already-issued token is rejected the same way. The ERP can also
> deactivate managers in bulk via
> [`POST /user/active`](data-management-api.md#sync-active-user-roster).

#### Upsert Users (Create or Update)

**POST** `/admin/user`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "user-123",
      "username": "johndoe",
      "email": "john@example.com",
      "password": "securepass123",
      "first_name": "John",
      "last_name": "Doe",
      "role": "manager",
      "store_uid": "store-456",
      "price_type_uid": "retail-usd"
    }
  ]
}
```

**Notes:**
- Password is hashed before storage
- Omit `password` field on update to keep existing password
- The `uid` field is auto-generated if not provided on create

#### List Users

**GET** `/admin/user`

**Query Parameters:**
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100

#### Get Users Batch

**POST** `/admin/user/batch`

**Request Body:**
```json
{
  "data": ["user-123", "user-456"]
}
```

#### Delete Users Batch

**POST** `/admin/user/delete`

**Request Body:**
```json
{
  "data": ["user-123", "user-456", "user-789"]
}
```

#### Find Users by Email Batch

**POST** `/admin/user/find/email`

**Request Body:**
```json
{
  "data": ["user1@example.com", "user2@example.com"]
}
```

#### Find Users by Username Batch

**POST** `/admin/user/find/username`

**Request Body:**
```json
{
  "data": ["username1", "username2"]
}
```

---

### Database Tables Viewer

#### List Tables

**GET** `/admin/tables`

Returns list of database tables (excludes system tables).

#### Search Table Records

**POST** `/admin/tables/{table_name}/records`

**Request Body:**
```json
{
  "page": 1,
  "count": 100,
  "data": {
    "search": "optional search term",
    "field": "optional field name"
  }
}
```

**Security:**
- Table name validated against whitelist
- Parameterized queries prevent SQL injection
- Read-only (SELECT only)

---

### Logs Viewer

#### List Logs

**GET** `/admin/logs`

**Query Parameters:**
- `page` (default: 1)
- `count` (default: 50, max: 1000)
- `level` (optional): Filter by log level
- `user_uid` (optional): Filter by user
- `request_id` (optional): Filter by request ID
- `date_from` (optional): ISO 8601 date
- `date_to` (optional): ISO 8601 date
- `search` (optional): Search term

#### Cleanup Logs

**DELETE** `/admin/logs/cleanup`

**Query Parameters:**
- `retention_days` (default: 90)

**Response:**
```json
{
  "deleted_count": 1500,
  "retention_days": 90,
  "cutoff_date": "2024-10-15T00:00:00Z"
}
```

---

### Webhook Management

Webhooks deliver event notifications to external services via HTTP POST.

#### Webhook Entity

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Unique identifier |
| `name` | string | Display name (max 255) |
| `url` | string | Target URL (max 2048) |
| `event` | string | Event type (see below) |
| `store_uid` | string | Optional store filter (null = all stores) |
| `auth_header` | string | Optional authentication header name |
| `auth_value` | string | Optional authentication header value |
| `active` | bool | Whether webhook is active |

**Event Types:**
- `order_confirmed` - Order status changed to confirmed
- `crm_stage_changed` - Order moved to new CRM stage
- `crm_order_assigned` - Order assigned to user
- `crm_order_unassigned` - Order unassigned
- `crm_task_created` - New CRM task created
- `crm_task_completed` - CRM task completed

#### List Webhooks

**GET** `/admin/webhooks`

**Query Parameters:**
- `page` (default: 1)
- `count` (default: 50)

#### Upsert Webhooks

**POST** `/admin/webhooks`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "",
      "name": "Order Notifications",
      "url": "https://example.com/webhook",
      "event": "order_confirmed",
      "store_uid": null,
      "auth_header": "X-Webhook-Secret",
      "auth_value": "secret-token",
      "active": true
    }
  ]
}
```

#### Get Webhooks Batch

**POST** `/admin/webhooks/batch`

**Request Body:**
```json
{
  "data": ["webhook-uid-1", "webhook-uid-2"]
}
```

#### Delete Webhooks

**POST** `/admin/webhooks/delete`

**Request Body:**
```json
{
  "data": ["webhook-uid-1", "webhook-uid-2"]
}
```

#### Update Webhook Active Status

**POST** `/admin/webhooks/active`

**Request Body:**
```json
{
  "data": {
    "uid": "webhook-123",
    "active": false
  }
}
```

#### Test Webhook

**POST** `/admin/webhooks/test`

**Request Body:**
```json
{
  "data": {
    "url": "https://example.com/webhook",
    "auth_header": "X-Webhook-Secret",
    "auth_value": "secret-token"
  }
}
```

**Response:**
```json
{
  "success": true,
  "status_code": 200,
  "response_body": "OK"
}
```

#### List Webhook Deliveries

**GET** `/admin/webhooks/deliveries`

**Query Parameters:**
- `page` (default: 1)
- `count` (default: 50)

#### List Deliveries by Webhook

**GET** `/admin/webhooks/deliveries/{webhook_uid}`

**Query Parameters:**
- `page` (default: 1)
- `count` (default: 50)

#### Cleanup Webhook Deliveries

**DELETE** `/admin/webhooks/deliveries/cleanup`

**Query Parameters:**
- `retention_days` (default: 90)

---

### Telegram Management

Manage Telegram bot subscriptions, invite codes, and bot configuration.

#### Subscription Entity

| Field | Type | Description |
|-------|------|-------------|
| `id` | int64 | Auto-increment ID |
| `user_id` | int64 | Telegram user ID |
| `log_level` | string | `debug`, `info`, `warn`, `error` |
| `username` | string | Telegram username |
| `first_name` | string | Telegram first name |
| `last_name` | string | Telegram last name |
| `active` | bool | Whether subscription is active |
| `subscription_types` | int | Bitflag for notification types |
| `internal_user_uid` | string | Linked internal user UID |

**Subscription Type Bitflags:**
- `1` - Log notifications
- `2` - New order notifications
- `4` - Stage change notifications
- `8` - Order edit notifications
- `16` - All orders (vs only assigned orders)

#### List Subscriptions

**GET** `/admin/telegram/subscriptions`

**Query Parameters:**
- `page` (default: 1)
- `count` (default: 50)

#### Get Subscriptions Batch

**POST** `/admin/telegram/subscriptions/batch`

**Request Body:**
```json
{
  "data": {
    "user_ids": [123456789, 987654321]
  }
}
```

#### Delete Subscriptions

**POST** `/admin/telegram/subscriptions/delete`

**Request Body:**
```json
{
  "data": {
    "user_ids": [123456789]
  }
}
```

**Notes:** Reloads bot's in-memory subscription cache after deletion

#### Update Subscription

**POST** `/admin/telegram/subscriptions/update`

**Request Body:**
```json
{
  "data": {
    "user_id": 123456789,
    "log_level": "warn",
    "active": true
  }
}
```

#### Update Subscription Types

**PUT** `/admin/telegram/subscriptions/types`

**Request Body:**
```json
{
  "data": {
    "user_id": 123456789,
    "subscription_types": 7,
    "internal_user_uid": "user-123"
  }
}
```

#### Get Subscriptions by User

**GET** `/admin/telegram/subscriptions/by-user`

**Query Parameters:**
- `user_uid` (required): Internal user UID

#### Invite Code Entity

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Unique identifier |
| `code` | string | Invite code (4-50 chars) |
| `created_by_uid` | string | Who created the code |
| `used_by_telegram_id` | int64 | Telegram ID that used the code |
| `used_at` | timestamp | When the code was used |
| `expires_at` | timestamp | Optional expiration |
| `active` | bool | Whether code is active |

#### Generate Invite Codes

**POST** `/admin/telegram/invites`

**Request Body:**
```json
{
  "data": {
    "count": 5,
    "expires_at": "2025-06-01T00:00:00Z"
  }
}
```

**Response:** Array of generated `TelegramInviteCode` objects

#### List Invite Codes

**GET** `/admin/telegram/invites`

**Query Parameters:**
- `page` (default: 1)
- `count` (default: 50)

#### Get Invite Codes Batch

**POST** `/admin/telegram/invites/batch`

**Request Body:**
```json
{
  "data": {
    "uids": ["code-uid-1", "code-uid-2"]
  }
}
```

#### Delete Invite Codes

**POST** `/admin/telegram/invites/delete`

**Request Body:**
```json
{
  "data": {
    "uids": ["code-uid-1", "code-uid-2"]
  }
}
```

#### Bot Settings

##### Get Bot Settings

**GET** `/admin/telegram/settings`

**Response:** Settings with masked API key and runtime info (bot_connected, bot_username, subscriber_count)

##### Update Bot Settings

**PUT** `/admin/telegram/settings`

**Request Body:**
```json
{
  "data": {
    "api_key": "new-bot-token",
    "bot_name": "MyBot",
    "admin_id": 123456789,
    "enabled": true,
    "min_log_level": "info"
  }
}
```

**Notes:** All fields are optional (partial update)

##### Test Bot Connection

**POST** `/admin/telegram/settings/test`

**Request Body:**
```json
{
  "data": {
    "api_key": "bot-token-to-test"
  }
}
```

**Response:**
```json
{
  "success": true,
  "bot_username": "MyBot",
  "bot_name": "My Bot Name"
}
```

##### Restart Bot

**POST** `/admin/telegram/settings/restart`

Restarts the Telegram bot with current settings.

---

### Site Settings

Global portal branding. Singleton — one row, no create or delete.

#### Get Site Settings

**GET** `/admin/site/settings`

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "site_name": "Comex B2B",
    "site_url": "https://b2b.example.com",
    "last_update": "2025-01-15T10:00:00Z"
  }
}
```

#### Update Site Settings

**PUT** `/admin/site/settings`

Partial update — omitted fields keep their stored value.

| Field | Type | Description |
|-------|------|-------------|
| `site_name` | string | Portal name shown in the browser tab, header and outgoing mail. Falls back to `B2B Portal` when set to empty |
| `site_url` | string | Public origin clients reach the portal at, e.g. `https://b2b.example.com` |

**Notes on `site_url`:**
- Canonicalised on save: any path is dropped and the trailing slash trimmed, so `https://b2b.example.com/orders/` is stored as `https://b2b.example.com`. Read the value back from the response rather than echoing what was sent
- Must be an absolute `http`/`https` URL with a host. A scheme-less or relative value is rejected with `400` and a message naming the problem — it would otherwise reach a client's inbox as a dead link
- Empty is valid and turns portal links off. Order phase notification emails then carry no "View order" button rather than a broken one
- Needed because notification mail is sent from background work, which has no request to derive an origin from (unlike password reset, which reads the `Origin` header)

---

### Mail Settings

Manage email notification service configuration.

#### Get Mail Settings

**GET** `/admin/mail/settings`

**Response:** Settings with masked API key and runtime info (service_connected)

```json
{
  "status": "success",
  "data": {
    "id": 1,
    "provider": "brevo",
    "api_key_masked": "xkeysib***ab1c2",
    "has_api_key": true,
    "sender_email": "noreply@example.com",
    "sender_name": "B2B Portal",
    "reply_to_email": "support@example.com",
    "enabled": true,
    "client_order_confirmation": true,
    "admin_new_order_notification": true,
    "client_status_change_notification": false,
    "service_connected": true
  }
}
```

#### Update Mail Settings

**PUT** `/admin/mail/settings`

**Request Body** (all fields optional):
```json
{
  "data": {
    "provider": "brevo",
    "api_key": "xkeysib-new-key",
    "sender_email": "noreply@example.com",
    "sender_name": "B2B Portal",
    "reply_to_email": "support@example.com",
    "enabled": true,
    "client_order_confirmation": true,
    "admin_new_order_notification": true,
    "client_status_change_notification": false
  }
}
```

#### Test Mail Connection

**POST** `/admin/mail/test`

**Request Body:**
```json
{
  "data": {
    "provider": "brevo",
    "api_key": "api-key",
    "sender_email": "noreply@example.com",
    "sender_name": "Test",
    "test_email": "admin@example.com"
  }
}
```

**Response:**
```json
{
  "success": true
}
```

#### Restart Mail Service

**POST** `/admin/mail/restart`

Restarts the mail service with current settings.

---

### Invoice Configuration

Manage invoice service settings and invoice type configurations.

#### Invoice Settings (Singleton)

##### Get Invoice Settings

**GET** `/admin/invoice/settings`

**Response:**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "enabled": true
  }
}
```

##### Update Invoice Settings

**PUT** `/admin/invoice/settings`

**Request Body:**
```json
{
  "data": {
    "enabled": true
  }
}
```

#### Invoice Type Entity

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Unique identifier |
| `name` | string | Display name (max 255) |
| `url` | string | External service URL (max 2048) |
| `method` | string | `GET` or `POST` |
| `headers` | object | Custom HTTP headers for the request |
| `active` | bool | Whether type is active |
| `store_uid` | string | Optional store filter |

#### List Invoice Types

**GET** `/admin/invoice/types`

**Query Parameters:**
- `page` (default: 1)
- `count` (default: 50)

#### Upsert Invoice Types

**POST** `/admin/invoice/types`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "",
      "name": "Standard Invoice",
      "url": "https://invoice-service.example.com/generate",
      "method": "POST",
      "headers": {
        "Authorization": "Bearer secret",
        "X-Custom": "value"
      },
      "active": true,
      "store_uid": null
    }
  ]
}
```

#### Get Invoice Types Batch

**POST** `/admin/invoice/types/batch`

**Request Body:**
```json
{
  "data": ["type-uid-1", "type-uid-2"]
}
```

#### Delete Invoice Types

**POST** `/admin/invoice/types/delete`

**Request Body:**
```json
{
  "data": ["type-uid-1", "type-uid-2"]
}
```

#### Update Invoice Type Active Status

**POST** `/admin/invoice/types/active`

**Request Body:**
```json
{
  "data": {
    "uid": "type-123",
    "active": false
  }
}
```

#### Test Invoice Type

**POST** `/admin/invoice/types/test`

**Request Body:**
```json
{
  "data": {
    "url": "https://invoice-service.example.com/generate",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer secret"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "status_code": 200,
  "response_type": "file",
  "content_type": "application/pdf"
}
```

#### Invoice History

##### List Invoices

**GET** `/admin/invoice/history`

**Query Parameters:**
- `page` (default: 1)
- `count` (default: 50)

##### Delete Invoices

**POST** `/admin/invoice/history/delete`

**Request Body:**
```json
{
  "data": ["invoice-uid-1", "invoice-uid-2"]
}
```

##### Cleanup Invoices

**DELETE** `/admin/invoice/history/cleanup`

**Request Body:**
```json
{
  "data": {
    "older_than_days": 90
  }
}
```

**Response:** Count of deleted invoices
