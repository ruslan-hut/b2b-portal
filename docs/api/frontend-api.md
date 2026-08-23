# Frontend API Documentation

Frontend API endpoints for authenticated clients. These endpoints provide client-specific product listings with pre-calculated prices, cart operations, order management, and profile self-service.

For endpoint list, see [structure.md](structure.md#frontend-authenticated-for-clients).
For authentication details, see [authentication-and-common-patterns.md](authentication-and-common-patterns.md#authentication).

---

## Base Path

`/api/v1/frontend`

---

## Authentication

All frontend endpoints require client authentication via JWT token (except `/frontend/languages` which is public).

**Client Login:**
```json
{
  "phone": "+1234567890",
  "pin_code": "1234"
}
```

**Header:**
```
Authorization: Bearer <access-token>
```

**Access Control:** Most endpoints are client-only; admin/manager users receive `403 Forbidden`. Cart and order endpoints also allow authenticated users (admin/manager) with `store_uid` and `price_type_uid` assigned.

---

## Products

### List Products with Calculated Prices

**GET** `/frontend/products`

Returns products with all price variants pre-calculated for the authenticated client's price type, discount, and VAT rate.

**Query Parameters:**
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 20
- `category`: (optional) string - Filter by category UID
- `search`: (optional) string - Search by product SKU or name (requires `language`)
- `language`: (optional) string - Language for descriptions (default: client's language or `"en"`)
- `order_total`: (optional) integer - Current cart total in cents for accurate scale-based discount calculation

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "uid": "prod-123",
      "name": "Premium Widget",
      "description": "High-quality widget for B2B use",
      "base_price": 1999,
      "price_with_vat": 2399,
      "price_with_discount": 1799,
      "price_final": 2159,
      "vat_rate": 20.0,
      "discount_percent": 10,
      "available_quantity": 85,
      "category_uid": "cat-456",
      "category_name": "Widgets",
      "image": "base64_encoded_image_data",
      "is_new": true,
      "is_hot_sale": false,
      "sort_order": 1,
      "sku": "WIDGET-001",
      "tags": [
        {
          "uid": "tag-new",
          "store_uid": "store-1",
          "name": "NEW",
          "color": "#2E7D32",
          "sort_order": 10
        }
      ],
      "certified_countries": ["PL", "DE"],
      "certified_any_country": false
    }
  ],
  "meta": {
    "page": 1,
    "count": 20,
    "total": 250
  },
  "request_id": "req-abc123"
}
```

**Price Fields (all in cents):**
- `base_price` - Original price from price table (net, without VAT)
- `price_with_vat` - `base_price * (1 + vat_rate/100)` (gross)
- `price_with_discount` - `base_price * (1 - discount/100)` (net after discount)
- `price_final` - `price_with_discount * (1 + vat_rate/100)` (gross after discount)
- `vat_rate` - VAT rate percentage (0-100, supports decimals, e.g. `23.0`)
- `discount_percent` - Effective discount applied (0-100)

**Notes:**
- Prices calculated using client's assigned `price_type_uid`
- Discount applies client's effective discount (fixed or scale-based), capped by per-product discount limits
- Products without prices in the client's price type are excluded from results
- `available_quantity` reflects stock in client's assigned store minus existing allocations
- `tags` contains store-scoped product badges for the authenticated client's store, sorted by `sort_order`, then `name`; tags with a negative `sort_order` are listed after the ranking ones
- Product order is `min(sort_order of the product's tags with sort_order >= 0)` ascending (products with no such tag last), then the product's own `sort_order`, then `sku`. A tag with a negative `sort_order` has sorting disabled: its badge still renders, but the product stays in the common order among untagged products
- When the client's store sets `use_certification_filter`, the list (and its pagination totals) is restricted to products the ERP marked available for at least one of the client's certification countries — the ERP-owned list of final destinations, not the delivery address; with no such countries loaded, only products flagged for *any* country are returned. See [Product Country Availability](data-management-api.md#product-country-availability) and [Client Certification Countries](data-management-api.md#client-certification-countries)
- `certified_countries` / `certified_any_country` are informational, for the product details panel — they do not affect what is returned
- Search mode searches by product SKU and name in product descriptions
- When `order_total` is provided, scale-based discount is calculated with that additional turnover

---

### List Categories

**GET** `/frontend/categories`

Returns categories that have at least one active product. Designed for filter dropdowns.

**Query Parameters:**
- `language`: (optional) string - Language for category names (default: `"en"`)

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "uid": "cat-456",
      "name": "Widgets"
    },
    {
      "uid": "cat-789",
      "name": "Accessories"
    }
  ],
  "request_id": "req-abc123"
}
```

**Notes:**
- Only returns categories that have at least one active product (empty categories excluded)
- Category name comes from category descriptions in the requested language
- Falls back to category UID if no description found for the language

---

### List Available Languages

**GET** `/frontend/languages`

Returns distinct language codes available in product descriptions.

**Authentication:** Not required (public endpoint).

**Response:**
```json
{
  "status": "success",
  "data": ["en", "uk", "de"],
  "request_id": "req-abc123"
}
```

---

## Catalog Order Form

A round-trip spreadsheet: the client exports the catalog, types quantities into
the (deliberately empty) **Кількість / Quantity** column, and uploads the same
file back to fill an order.

Sheet layout — column headings follow the caller's language:

| Штрих-код | Арт. | Найменування | Кількість | Ціна | Знижка % | Ціна зі знижкою |
|---|---|---|---|---|---|---|

All prices are **VAT-inclusive**: *Ціна* is the list price with VAT, *Ціна зі
знижкою* the same price after the client's discount. A technical `product_uid`
column is appended and hidden so the import can match rows exactly.

### Export Catalog

**POST** `/frontend/catalog/export`

Streams the catalog as an XLSX order form, priced with the caller's own price
type, discount and VAT — the same numbers the catalog page shows.

Available to clients and to staff (admin/manager) in read-only preview scope.

**Request Body:** (all fields optional; an empty body exports the whole catalog
with numeric barcodes)
```json
{
  "format": "text",
  "category_uids": ["cat-456", "cat-789"],
  "language": "uk"
}
```

- `format`: `"text"` writes the barcode as digits, `"image"` embeds a scannable
  barcode picture (EAN-13/EAN-8 where valid, Code 128 otherwise). Default `"text"`.
- `category_uids`: restricts the export; empty or omitted means the whole catalog.
- `language`: product names and column headings. Defaults to the client's language.

**Response:** `200 OK` with the workbook.

| Header | Meaning |
|---|---|
| `Content-Type` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` |
| `Content-Disposition` | `attachment; filename="catalog_YYYY-MM-DD.xlsx"` |
| `X-Catalog-Export-Truncated` | `true` when the catalog exceeded the 20 000-row ceiling and the tail was left out |

**Notes:**
- Only products the client can actually order are included — the same
  price-type + store-stock filter the catalog listing applies.
- The quantity column ships empty by design.

---

### Import Order File

**POST** `/frontend/catalog/import`

Reads a filled-in order form and returns the lines it could resolve, priced for
the caller. **Nothing is written** — the client reviews the result and then saves
it through `POST /frontend/cart/update` as usual.

**Only the article code and the quantity are read from the file.** Everything
else — price, discount percent, VAT, product name, barcode — is recalculated
from current data, so a stale or hand-edited sheet cannot influence what the
order costs. Pricing goes through `CalculateOrderTotalsWithScale`, the same
calculator the cart uses, which means a scale-based discount is resolved from
the imported order's own turnover (counting only the lines that survived
validation, at the quantities they were clamped to) and the review screen cannot
drift from what saving the cart produces.

The standard order checks all run: the product must be active, must have a
sellable price for the client's price type, and must have stock in their store;
per-product discount limits and the address-derived VAT rate are applied.

**Client-only** (staff preview accounts cannot order). Max upload 32 MiB, max
5 000 lines.

**Request:** `multipart/form-data`.

| Part | Required | Meaning |
|---|---|---|
| `file` | yes | The workbook (`.xlsx` / `.xlsm`) |
| `sku_column` | no | 1-based column holding the article code. Default **2** (where the export puts it) |
| `quantity_column` | no | 1-based column holding the quantity. Default **4** |

Both column fields let a client import a sheet in their own layout rather than
the exported one. Omit them (or send an empty value) to fall back to detecting
the columns from the header row.

**Response:**
```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "row_number": 2,
        "product_uid": "prod-123",
        "sku": "KK05",
        "barcode": "4823126210476",
        "product_name": "DARK Пензлик для гелю (10мм)",
        "quantity": 3,
        "requested_quantity": 3,
        "available_quantity": 12,
        "price_with_vat": 21500,
        "price_final": 15050,
        "discount_percent": 30,
        "clamped": false
      }
    ],
    "skipped": [
      { "row_number": 7, "sku": "OLD-1", "quantity": 2, "reason": "not_found" }
    ],
    "rows_with_quantity": 2
  },
  "request_id": "req-abc123"
}
```

**Matching order:** hidden `product_uid` → SKU (case-insensitive) → barcode.
The UID wins because a client may have edited the visible columns — *unless*
`sku_column` was supplied, which drops the hidden UID entirely: the client is
saying the file is not our export, so a stale UID must not override the column
they pointed at.

**Skip reasons:**

| Reason | Meaning |
|---|---|
| `not_found` | No product in the client's catalog matches the row (unknown code, inactive product, or no price for the client's price type) |
| `duplicate` | The same product already appeared on an earlier row |
| `no_stock` | Matched, but nothing is available in the client's store |

**Notes:**
- `sku`, `barcode` and `product_name` in the response come from the product
  record, not from the uploaded row. When the product has no description in the
  client's language the SKU is used as the name — never the name in the file.
- Quantities above available stock are reduced to what is in stock and flagged
  with `clamped: true` (`requested_quantity` keeps the original number).
- Rows with a blank, zero or negative quantity are ignored entirely — they are
  not reported as skipped.
- The header row is located anywhere in the first 20 rows, and both the
  Ukrainian and English headings are recognised, so a file exported in one
  language imports in another.
- Supplying `quantity_column` lifts the header requirement altogether: rows are
  then told apart by whether that cell holds a positive number, which skips
  titles and headings on its own. A file with neither a recognisable header nor
  `quantity_column` is rejected.

---

## Product Images

### Get Main Product Images (Batch)

**POST** `/frontend/product/images`

Retrieve main images for multiple products. Designed for frontend caching.

**Request Body:**
```json
{
  "data": ["prod-123", "prod-456", "prod-789"]
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "prod-123": {
      "file_data": "data:image/png;base64,iVBORw0KGgo...",
      "last_update": "2025-01-15T10:30:00Z"
    },
    "prod-456": {
      "file_data": "data:image/jpeg;base64,/9j/4AAQSkZJ...",
      "last_update": "2025-01-15T10:30:00Z"
    }
  },
  "request_id": "req-abc123"
}
```

**Notes:**
- Returns map of product UID to image data
- Products without images are omitted from response
- Returns empty object `{}` if no images found
- `file_data` includes MIME type prefix (e.g. `data:image/png;base64,...`)
- Use `last_update` for cache invalidation

---

## Cart

### Update Cart

**POST** `/frontend/cart/update`

Create or update the client's shopping cart (draft order). The backend calculates all prices, discounts, VAT, and totals.

**Request Body (plain JSON, not wrapped in `data`):**
```json
{
  "order_uid": "order-draft-789",
  "address_uid": "addr-001",
  "items": [
    {
      "product_uid": "prod-123",
      "quantity": 2
    },
    {
      "product_uid": "prod-456",
      "quantity": 1
    }
  ],
  "comment": "Please handle with care",
  "version": 7
}
```

**Request Fields:**
- `order_uid` (string, optional) - UID of existing draft order to update; if omitted, auto-finds existing draft or creates new
- `address_uid` (string, optional) - UID of client address to use; if omitted, uses default address
- `items` (array, required, min 1) - Cart items with `product_uid` (required) and `quantity` (required, > 0)
- `comment` (string, optional) - Order comment
- `version` (int, optional) - Cart version this update was built on, as last returned by the server. Omit it to skip the check (last-write-wins). See **Concurrent sessions** below.

**Concurrent sessions:**

One client account can be signed in from several places at once, and each session
sends the whole item list. Without a guard the last save wins and the other
session's items are silently lost.

Every cart response carries a `version`. Send it back with the next update and
the server refuses the write if the cart has moved on since, answering **409**:

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Cart was modified in another session. Reload it before saving again.",
    "extra": {
      "reason": "cart_version_conflict",
      "current_version": 9,
      "order_uid": "order-draft-789"
    }
  }
}
```

Resolve a 409 by reloading the server cart (`POST /frontend/cart/validate`) and
showing the user what it now contains — **never** by resending the same items,
which would undo the other session's change.

The version counts cart writes for the client, not the draft order, so it keeps
advancing across a cart being emptied and started again. Clearing the cart
(`/frontend/cart/delete`) also advances it.

**Editing lease:**

On top of the version check, the first session to write a cart takes an *editing
lease* on it, renewed by each of its saves and lapsing 90 seconds after the last
one. While it holds, a save from a different session of the same client is
refused with **423**:

```json
{
  "success": false,
  "error": {
    "code": "LOCKED",
    "message": "This cart is open in another session.",
    "extra": {
      "reason": "cart_locked",
      "holder_user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      "expires_at": "2026-08-04T12:01:30Z"
    }
  }
}
```

A 423 means **nothing was written** — unlike a 409, the caller's cart is not
stale and must not be reloaded or discarded. The client either retries after the
lease lapses or calls `/frontend/cart/takeover`.

The lease is a usability guard, not the correctness guard: the per-client cart
lock and the version are what actually make concurrent writes safe. Requests
authenticated with an integration key hold no lease and are never blocked by one.

**Query Parameters:**
- `language`: (optional) string - Language for product names (default: `"en"`)

**Response:**
```json
{
  "status": "success",
  "data": {
    "order_uid": "order-draft-789",
    "version": 8,
    "items": [
      {
        "product_uid": "prod-123",
        "product_sku": "WIDGET-001",
        "product_name": "Premium Widget",
        "quantity": 2,
        "base_price": 1999,
        "price_with_vat": 2398.8,
        "price_discount": 1799,
        "price_after_discount_with_vat": 2158.8,
        "discount": 10,
        "tax": 359.8,
        "subtotal": 4317.6,
        "available_quantity": 85
      }
    ],
    "totals": {
      "original_total": 3998.0,
      "original_total_with_vat": 4797.6,
      "subtotal": 3598.0,
      "discount_amount": 400.0,
      "discount_amount_with_vat": 480.0,
      "total_vat": 719.6,
      "total": 4317.6
    },
    "discount_percent": 10,
    "vat_rate": 20.0,
    "vat_rate_changed": false,
    "address": {
      "uid": "addr-001",
      "country_code": "UA",
      "country_name": "Ukraine",
      "zipcode": "01001",
      "city": "Kyiv",
      "address_text": "123 Main Street",
      "shipping_address": "123 Main Street, Kyiv, 01001, Ukraine",
      "is_default": true
    }
  },
  "request_id": "req-abc123"
}
```

**Response Item Fields (all monetary values in cents):**
- `base_price` (int) - Original unit price from price table
- `price_with_vat` (float) - Unit price with VAT: `base_price * (1 + vat_rate/100)`
- `price_discount` (int) - Unit price after discount, without VAT
- `price_after_discount_with_vat` (float) - Unit price after discount with VAT: `item.total / quantity`
- `discount` (int) - Actual discount percent applied to this item (after product limits)
- `tax` (float) - VAT amount for this item (all units)
- `subtotal` (float) - Item total including VAT: `quantity * price_discount + tax`
- `available_quantity` (int) - Available stock in client's store

**Response Totals Fields (all monetary values in cents as float):**
- `original_total` - Sum before discount, NET (without VAT)
- `original_total_with_vat` - Sum before discount, GROSS (with VAT)
- `subtotal` - After discount, before VAT
- `discount_amount` - Total discount saved, NET
- `discount_amount_with_vat` - Total discount saved, GROSS
- `total_vat` - Total VAT amount
- `total` - Final total with VAT (GROSS)

**VAT Rate Change Detection:**
- `vat_rate_changed: true` indicates VAT rate changed from the previous cart save (e.g., address changed to different country)
- Frontend should alert user and refresh cart display when this occurs

**Address Resolution:**
1. If `address_uid` provided: verify it belongs to client, use it
2. If no `address_uid`: use client's default address
3. If no default address: `address` field is `null`

**VAT Rate Determination:**
- If client has `vat_number` AND address has a country: use country's VAT rate
- Otherwise: use store's default VAT rate

**Notes:**
- Creates draft order if none exists for the client
- Each client can have ONE active draft order at a time
- Does NOT reserve inventory (draft status)
- Cart persists between sessions
- Also accessible by admin/manager users with `store_uid` and `price_type_uid` assigned (discount = 0, no VAT)

---

### Change One Cart Line

**POST** `/frontend/cart/item`

Change a single cart line, leaving every other line as the server has it.

**Prefer this over `/frontend/cart/update` for single-product actions** — add to
cart, change one quantity, remove one line. `/cart/update` sends the whole item
list, so it can only express "the cart is exactly this", which means one session
overwrites the other's additions or gets a 409. A line change says only what the
user did, so two sessions adding different products both keep their product:
there is no version to send and no conflict to resolve.

`/cart/update` remains the right endpoint for whole-cart operations — the order
file import and bulk edits — where replacing the list is the actual intent.

**Request Body (plain JSON, not wrapped in `data`):**
```json
{
  "product_uid": "prod-123",
  "mode": "increment",
  "quantity": 1,
  "address_uid": "addr-001"
}
```

**Request Fields:**
- `product_uid` (string, required) - The line to change
- `mode` (string, optional) - `set` (default) makes the quantity exactly `quantity`; `increment` adds `quantity` to it, creating the line if absent; `remove` drops the line
- `quantity` (int, optional, >= 0) - Read according to `mode`; ignored for `remove`. `set` with 0 removes the line
- `address_uid` (string, optional) - Delivery address. Omitted falls back to the client's **default** address, so pass the address the cart is showing if it is not the default one
- `comment` (string, optional) - Replaces the cart comment. Omit it to keep the stored one

**Query Parameters:**
- `language`: (optional) string - Language for product names (default: `"en"`)

**Response:** the same payload as `/frontend/cart/update` — the whole recalculated
cart, including lines added by other sessions. When the change removed the last
line the draft is deleted and the response carries an empty `items` array, no
`order_uid`, and the new `version`.

**Notes:**
- No `version` field: the server reads the current cart and merges, retrying internally if another session writes in between. A 409 only appears if that keeps failing
- Still subject to the editing lease — a **423** means another session holds the cart (see **Editing lease** above)
- Removing the last line deletes the draft, exactly as `/frontend/cart/delete` would

---

### Delete Cart

**POST** `/frontend/cart/delete`

Delete the client's draft order (cart).

**Request Body (plain JSON, not wrapped in `data`):**
```json
{
  "order_uid": "order-draft-789"
}
```

**Request Fields:**
- `order_uid` (string, required) - UID of the draft order to delete

**Response:**
```json
{
  "status": "success",
  "data": {
    "message": "Cart deleted successfully"
  },
  "request_id": "req-abc123"
}
```

**Notes:**
- Verifies the order belongs to the authenticated client
- Only draft orders can be deleted
- Returns error if order does not exist or doesn't belong to client
- Advances the cart version and releases the editing lease

---

### Cart State

**GET** `/frontend/cart/state`

Report whether the cart has moved and who is holding it, without returning the
cart. Poll this while a cart is on screen and reload only when `version` differs
from the one the session holds — that way an open cart page notices changes made
in another session instead of drifting until the user next touches it.

Cheap by design: an unchanged cart costs a couple of indexed reads, not a cart
recalculation.

**Response:**
```json
{
  "status": "success",
  "data": {
    "version": 8,
    "order_uid": "order-draft-789",
    "item_count": 3,
    "editing_session": "other",
    "holder_user_agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"
  },
  "request_id": "req-abc123"
}
```

**Response Fields:**
- `version` (int) - Current cart version; a change means some session wrote the cart
- `order_uid` (string) - Current cart, empty when the client has none
- `item_count` (int) - Lines in the current cart
- `editing_session` (string) - `none`, `self` or `other` — who holds the editing lease, from the asking session's point of view
- `holder_user_agent` (string) - The holding session, present when `editing_session` is `other`

**Notes:**
- Polling, not a pushed stream: no long-lived connection to keep alive through the proxies, and a dropped request degrades to noticing a moment later rather than silently never noticing. If push is added later this payload is what would be pushed — clients need not change
- This is a convenience, not the safety mechanism. Loss is prevented by the cart version on write (409) and the per-client cart lock

---

### Take Over Cart

**POST** `/frontend/cart/takeover`

Claim the cart editing lease from whichever session of this client currently
holds it. Call this when `/frontend/cart/update` answered **423** and the user
chose to take the cart over.

Cart contents are not touched and the version does not move — this changes only
who is allowed to write. The displaced session finds out when its next save is
refused.

This endpoint exists because a lease belongs to a session and sessions die
without saying so (a closed laptop, a killed tab, a phone off the network).
Without it a client would be locked out of their own cart until the lease lapsed.

**Request Body:** none (empty JSON object).

**Response:**
```json
{
  "status": "success",
  "data": {
    "order_uid": "order-draft-789",
    "version": 4,
    "expires_at": "2026-08-04T12:03:00Z"
  },
  "request_id": "req-abc123"
}
```

**Response Fields:**
- `order_uid` (string) - The cart now held; empty when the client has no cart yet
- `version` (int) - Current cart version, so the caller can save without another round trip
- `expires_at` (timestamp) - When this lease lapses unless a cart write renews it

**Notes:**
- **Client-only**, and the session must be a real logged-in session (integration keys cannot hold a cart)
- Reload the cart afterwards: the previous holder may have saved before losing the lease

---

## Orders

### Preview Order

**POST** `/frontend/orders/preview`

Calculate order totals without creating the order. Used to show pricing before confirmation.

**Request Body (plain JSON, not wrapped in `data`):**
```json
{
  "items": [
    {
      "product_uid": "prod-123",
      "quantity": 2
    },
    {
      "product_uid": "prod-456",
      "quantity": 1
    }
  ]
}
```

**Request Fields:**
- `items` (array, required, min 1) - Order items with `product_uid` (required) and `quantity` (required, > 0)

**Response:**
```json
{
  "status": "success",
  "data": {
    "status": "preview",
    "items": [
      {
        "product_uid": "prod-123",
        "product_sku": "WIDGET-001",
        "product_name": "Premium Widget",
        "quantity": 2,
        "base_price": 1999,
        "price_with_vat": 2398.8,
        "price_discount": 1799,
        "price_after_discount_with_vat": 2158.8,
        "discount": 10,
        "tax": 359.8,
        "subtotal": 4317.6
      }
    ],
    "discount_percent": 10,
    "vat_rate": 20.0,
    "original_total": 3998.0,
    "original_total_with_vat": 4797.6,
    "subtotal": 3598.0,
    "discount_amount": 400.0,
    "discount_amount_with_vat": 480.0,
    "total_vat": 719.6,
    "total": 4317.6,
    "currency_code": "USD"
  },
  "request_id": "req-abc123"
}
```

**Notes:**
- Does NOT create an order (no `uid` in response)
- Returns `status: "preview"` (not persisted)
- Does NOT require address or shipping details
- Does NOT check stock availability (that happens on confirm)
- Uses same price calculation logic as cart (discount, VAT, product limits)
- Useful for showing "order summary" before user enters shipping details

---

### Confirm Order

**POST** `/frontend/orders/confirm`

Create a confirmed order with status `"new"`. Validates stock availability and creates inventory allocations.

**Request Body (plain JSON, not wrapped in `data`):**
```json
{
  "items": [
    {
      "product_uid": "prod-123",
      "quantity": 2
    }
  ],
  "comment": "Please deliver after 5 PM",
  "shipping_address": {
    "street": "123 Main Street",
    "city": "Kyiv",
    "state": "Kyiv Oblast",
    "zipCode": "01001",
    "country": "UA"
  }
}
```

**Request Fields:**
- `items` (array, required, min 1) - Order items with `product_uid` (required) and `quantity` (required, > 0)
- `comment` (string, optional) - Order comment/notes
- `shipping_address` (object, optional) - Shipping details:
  - `street` (string) - Street address (stored in `address_text`)
  - `city` (string) - City name
  - `state` (string) - State/region (included in formatted address)
  - `zipCode` (string) - Postal code
  - `country` (string) - Country code (stored in `country_code`)

**Response:**
```json
{
  "status": "success",
  "data": {
    "uid": "order-12345",
    "number": "ORD-001",
    "client_phase": "placed",
    "items": [
      {
        "product_uid": "prod-123",
        "product_sku": "WIDGET-001",
        "product_name": "Premium Widget",
        "quantity": 2,
        "base_price": 1999,
        "price_with_vat": 2398.8,
        "price_discount": 1799,
        "price_after_discount_with_vat": 2158.8,
        "discount": 10,
        "tax": 359.8,
        "subtotal": 4317.6
      }
    ],
    "discount_percent": 10,
    "vat_rate": 20.0,
    "original_total": 3998.0,
    "original_total_with_vat": 4797.6,
    "subtotal": 3598.0,
    "discount_amount": 400.0,
    "discount_amount_with_vat": 480.0,
    "total_vat": 719.6,
    "total": 4317.6,
    "currency_code": "USD",
    "shipping_address": "123 Main Street, Kyiv, Kyiv Oblast, 01001, UA",
    "country_code": "UA",
    "zipcode": "01001",
    "city": "Kyiv",
    "address_text": "123 Main Street",
    "comment": "Please deliver after 5 PM",
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-15T10:00:00Z"
  },
  "request_id": "req-abc123"
}
```

**Behavior:**
- Creates order with status `"new"` (confirmed)
- Validates stock availability and creates allocation records
- Shipping address parts are parsed into individual fields (`country_code`, `zipcode`, `city`, `address_text`) and also stored as formatted string
- Snapshots discount and VAT rate at order creation time
- Returns complete order data with all calculated prices

**Errors:**
- `422` - Insufficient stock: `"insufficient stock for product prod-123: need 5, available 3"`
- `400` - Invalid request format or missing required fields
- `500` - Database errors

---

### Get Order History

**GET** `/frontend/orders/history`

Get the client's order history with full order details including items.

**Pagination (JSON body or defaults):**
```json
{
  "data": {
    "page": 1,
    "count": 20
  }
}
```

If body is empty, defaults to `page: 1`, `count: 20`.

**Query Parameters:**
- `language`: (optional) string - Language for product names (default: `"en"`)

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "uid": "order-12345",
      "number": "ORD-001",
      "client_phase": "placed",
      "items": [
        {
          "product_uid": "prod-123",
          "product_sku": "WIDGET-001",
          "product_name": "Premium Widget",
          "quantity": 2,
          "base_price": 1999,
          "price_with_vat": 2398.8,
          "price_discount": 1799,
          "price_after_discount_with_vat": 2158.8,
          "discount": 10,
          "tax": 359.8,
          "subtotal": 4317.6
        }
      ],
      "discount_percent": 10,
      "vat_rate": 20.0,
      "original_total": 3998.0,
      "original_total_with_vat": 4797.6,
      "subtotal": 3598.0,
      "discount_amount": 400.0,
      "discount_amount_with_vat": 480.0,
      "total_vat": 719.6,
      "total": 4317.6,
      "currency_code": "USD",
      "shipping_address": "123 Main Street, Kyiv, 01001, UA",
      "country_code": "UA",
      "zipcode": "01001",
      "city": "Kyiv",
      "address_text": "123 Main Street",
      "comment": "",
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T14:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "count": 20,
    "total": 15
  },
  "request_id": "req-abc123"
}
```

**Notes:**
- Returns full order details with all items and calculated prices (same structure as confirm response)
- Excludes draft orders (only confirmed/processed orders)
- Product names resolved from descriptions in the requested language
- Returns empty array if no orders found
- `client_phase` is the coarse phase the order's internal CRM stage is mapped to, one of `placed`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`. It is empty when the order sits in a stage no operator mapped. The internal stage name is never returned on client routes: stages are operator-authored and may carry internal wording.

---

### Get Order Progress

**GET** `/frontend/orders/{uid}/history`

Get the simplified progress track for one of the caller's own orders. Responds `403` when the order belongs to another client.

This route returns phases and timestamps only — never the underlying status history, which records the staff member or ERP operator behind each change along with internal comments.

**Response:**
```json
{
  "status": "success",
  "data": {
    "current": "shipped",
    "cancelled": false,
    "steps": [
      { "phase": "placed",     "reached": true,  "reached_at": "2025-01-15T10:00:00Z" },
      { "phase": "confirmed",  "reached": true,  "reached_at": "2025-01-15T11:30:00Z" },
      { "phase": "processing", "reached": true,  "reached_at": "2025-01-16T09:12:00Z" },
      { "phase": "shipped",    "reached": true,  "reached_at": "2025-01-17T14:40:00Z" },
      { "phase": "delivered",  "reached": false }
    ]
  },
  "request_id": "req-abc123"
}
```

**Notes:**
- `steps` always carries the five track phases in order, whatever the internal pipeline looks like
- A phase before the current position is `reached` even with no `reached_at`: the order passed through it without a stage mapped to it recording the moment
- `cancelled: true` means the order's latest phase is `cancelled`; `cancelled_at` accompanies it and clients should hide the track rather than show a position. An order cancelled and later reinstated reports `false` again
- `current` is empty and no step is reached when none of the stages the order visited are mapped to a client phase
- Pagination and `sort` parameters are accepted and ignored — the track has a fixed length

---

## Countries

### List Countries

**GET** `/frontend/countries`

Get list of countries for address forms.

**Query Parameters:**
- `page`: (optional) integer, default 1
- `count`: (optional) integer, default 100

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "country_code": "UA",
      "name": "Ukraine"
    },
    {
      "country_code": "PL",
      "name": "Poland"
    }
  ]
}
```

### List Countries (POST)

**POST** `/frontend/countries`

Same as GET but supports pagination in request body.

**Request Body:**
```json
{
  "page": 1,
  "count": 50
}
```

---

## Profile

### Update Client Profile

**PUT** `/frontend/profile`

Update client's own profile data. Only specified fields are updated (partial update).

**Request Body:**
```json
{
  "name": "ACME Corporation",
  "email": "contact@acme.com",
  "phone": "1234567890",
  "vat_number": "VAT123456",
  "language": "en"
}
```

All fields are optional, but at least one must be provided.

**Response:**
```json
{
  "status": "success",
  "data": null,
  "message": "Profile updated successfully",
  "request_id": "req-abc123"
}
```

**Editable Fields:**
- `name` - Company/client name (1-255 characters)
- `email` - Email address (valid email format)
- `phone` - Phone number (numeric, 8-15 digits, no `+` prefix)
- `vat_number` - VAT registration number (max 50 characters)
- `language` - Preferred language code (max 10 characters)

**Cannot modify:** `discount`, `price_type_uid`, `store_uid`, `active`, `balance`, `fixed_discount`.

**Errors:**
- `400` - No fields provided for update
- `409` - Phone number already in use by another client
- `422` - Validation failed (invalid email, phone format, etc.)

---

## Addresses

Address management endpoints return the full `AppSettings` object on success (includes entity data, addresses, discount info, etc.). This allows the frontend to refresh all client settings in a single response.

### Get My Addresses

**GET** `/frontend/profile/addresses`

Get all addresses for the authenticated client.

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "uid": "addr-001",
      "client_uid": "client-123",
      "country_code": "UA",
      "zipcode": "01001",
      "city": "Kyiv",
      "address_text": "123 Main Street, Office 5",
      "is_default": true,
      "is_official": true,
      "last_update": "2025-01-15T10:30:00Z"
    },
    {
      "uid": "addr-002",
      "client_uid": "client-123",
      "country_code": "PL",
      "zipcode": "00-001",
      "city": "Warsaw",
      "address_text": "456 Business Ave",
      "is_default": false,
      "is_official": false,
      "last_update": "2025-01-10T08:00:00Z"
    }
  ],
  "request_id": "req-abc123"
}
```

**Note:** Address entity does not include `country_name` - use the countries endpoint to resolve names.

---

### Upsert My Address

**POST** `/frontend/profile/addresses`

Create or update an address for the authenticated client.

**Request Body:**
```json
{
  "uid": "addr-001",
  "country_code": "UA",
  "zipcode": "01001",
  "city": "Kyiv",
  "address_text": "123 Main Street, Office 5",
  "is_default": true,
  "is_official": false
}
```

**Request Fields:**
- `uid` (string, optional) - Omit to create new address; provide to update existing
- `country_code` (string, required, max 5) - ISO country code
- `zipcode` (string, optional) - Postal code
- `city` (string, optional) - City name
- `address_text` (string, optional) - Full address text
- `is_default` (boolean) - Set as the default **delivery** address
- `is_official` (boolean) - Set as the **official/invoicing** address (feeds the invoice `billing_*` fields)

**Response (AppSettings):**
```json
{
  "status": "success",
  "data": {
    "entity": { ... },
    "entity_type": "client",
    "currency": { ... },
    "store": { ... },
    "price_type": { ... },
    "effective_vat_rate": 20.0,
    "addresses": [
      {
        "uid": "addr-001",
        "client_uid": "client-123",
        "country_code": "UA",
        "zipcode": "01001",
        "city": "Kyiv",
        "address_text": "123 Main Street, Office 5",
        "is_default": true,
        "is_official": false,
        "last_update": "2025-01-15T10:30:00Z"
      }
    ],
    "discount_info": { ... },
    "token_info": { ... }
  },
  "request_id": "req-abc123"
}
```

**Notes:**
- If `uid` is omitted, a new UID is auto-generated
- If `uid` is provided, verifies the address belongs to the authenticated client
- Setting `is_default: true` clears default from other addresses
- Setting `is_official: true` clears the official flag from other addresses (single official per client)
- Returns full `AppSettings` so frontend can refresh all client state in one response
- Falls back to returning just the UID if AppSettings retrieval fails

---

### Delete My Address

**DELETE** `/frontend/profile/addresses/{uid}`

Delete an address belonging to the authenticated client.

**Response (AppSettings):**
```json
{
  "status": "success",
  "data": {
    "entity": { ... },
    "entity_type": "client",
    "addresses": [ ... ],
    ...
  },
  "request_id": "req-abc123"
}
```

**Notes:**
- Verifies address ownership before deletion
- Returns `404` if address not found
- Returns `401` if address doesn't belong to the client
- Returns full `AppSettings` with remaining addresses
- Falls back to `"Address deleted successfully"` message if AppSettings retrieval fails

---

### Set Default Address

**PUT** `/frontend/profile/addresses/{uid}/default`

Set an address as the default shipping address.

**Response (AppSettings):**
```json
{
  "status": "success",
  "data": {
    "entity": { ... },
    "entity_type": "client",
    "addresses": [ ... ],
    ...
  },
  "request_id": "req-abc123"
}
```

**Notes:**
- Verifies address ownership before updating
- Clears default flag from all other addresses for this client
- Returns `404` if address not found
- Returns `422` if address doesn't belong to the client
- Returns full `AppSettings` with updated default
- Falls back to `"Default address updated"` message if AppSettings retrieval fails

---

### Set Official Address

**PUT** `/frontend/profile/addresses/{uid}/official`

Set an address as the client's official/invoicing address. This is the address used for the
`billing_*` fields in the outgoing
[invoice payload](./invoice-request.md#6-official-invoicing-address-billing-fields). It is
independent of the default (delivery) address — an address can be both.

**Response (AppSettings):**
```json
{
  "status": "success",
  "data": {
    "entity": { ... },
    "entity_type": "client",
    "addresses": [ ... ],
    ...
  },
  "request_id": "req-abc123"
}
```

**Notes:**
- Verifies address ownership before updating
- Clears the official flag from all other addresses for this client (single official per client)
- Returns `404` if address not found
- Returns `422` if address doesn't belong to the client
- Returns full `AppSettings` with the updated official address
- Falls back to `"Official address updated"` message if AppSettings retrieval fails

---

## Price Calculation Reference

### Calculation Flow

All pricing is calculated on the backend. The frontend only displays pre-calculated values.

1. **Get base price** from `prices` table for client's `price_type_uid` (integer, cents)
2. **Determine discount**: fixed (`client.discount`) or scale-based (lookup from `discount_scales` using `client.balance + order_total`)
3. **Apply product limits**: per-product discount cap from `product_discount_limits` table (per store)
4. **Calculate item prices**:
   - `price_discount = base_price * (1 - effective_discount/100)` (cents, integer)
   - `tax = quantity * price_discount * (vat_rate/100)` (cents, float)
   - `subtotal = quantity * price_discount + tax` (cents, float)
5. **Calculate totals**: sum all items

### VAT Rate Determination

| Condition | VAT Rate Source |
|-----------|----------------|
| Client has `vat_number` AND address has country | Country's VAT rate |
| Otherwise | Store's `default_vat_rate` |

### Discount Resolution

| Client Setting | Discount Source |
|----------------|----------------|
| `fixed_discount = true` | `client.discount` field directly |
| `fixed_discount = false` | Lookup from `discount_scales` table using `balance + order_total` for the client's currency |
| Product has limit | `min(client_discount, product_limit)` |
| Client has `additional_discount` | Added last, on top of the limited value: `min(client_discount, product_limit) + additional_discount` (capped at 100) — it intentionally exceeds the product limit |

---

## Error Response Format

All endpoints return errors in this format:

```json
{
  "status": "error",
  "message": "Human-readable error description",
  "error_code": "ERROR_TYPE",
  "request_id": "req-abc123"
}
```

**Error Codes:**
- `UNAUTHORIZED` (401) - Not authenticated or invalid token
- `FORBIDDEN` (403) - Non-client accessing client-only endpoint
- `BAD_REQUEST` (400) - Invalid request format or missing fields
- `VALIDATION_ERROR` (422) - Field validation failed or insufficient stock
- `NOT_FOUND` (404) - Resource not found
- `CONFLICT` (409) - Duplicate resource (e.g., phone number already in use)
- `DATABASE_ERROR` (500) - Internal database error
- `INTERNAL_ERROR` (500) - Internal server error
