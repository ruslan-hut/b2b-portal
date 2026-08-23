# Data Management API Documentation

Data management API endpoints for internal use (staff/users). Clients use the frontend API instead.

For endpoint list, see [structure.md](structure.md#data-management-api-authenticated-for-staffusers).
For authentication details, see [authentication-and-common-patterns.md](authentication-and-common-patterns.md#authentication).
For admin-only endpoints, see [admin-api.md](admin-api.md).

---

## Base Path

`/api/v1`

---

## Client

A client may have branches — see [Client Branch](#client-branch). The client record always holds the commercial parameters (discount, balance, manager, price type, store, PIN); a branch holds only its own legal identity.

#### Client Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Unique identifier |
| `name` | string | Yes | Client/company name |
| `phone` | string | Yes | Phone number (8-15 characters) |
| `pin_code` | string | No | PIN code for client login (if empty, client is inactive) |
| `email` | string | No | Email address |
| `address` | string | No | Physical address |
| `discount` | int | No | Fixed discount percentage (0-100), used when `fixed_discount=true` |
| `additional_discount` | int | No | Bonus discount in percentage points (0-100) added on top of the earned discount, **after** any product discount limit — see below |
| `fixed_discount` | bool | No | If true, use `discount` field; if false, calculate from discount scale |
| `cumulative_discount` | bool | No | If true, use balance+order for scale lookup; if false, use only current order (default: true) |
| `balance` | int | No | Current monthly purchase turnover in cents (set by CRM) |
| `vat_rate` | float | No | VAT rate percentage (0-100) |
| `vat_number` | string | No | VAT registration number (max 50 characters) |
| `business_registration_number` | string | No | Business registration number (max 50 characters). Required to confirm orders (drafts allowed without it) |
| `manager_uid` | string | No | UID of assigned manager user (max 255 characters) |
| `price_type_uid` | string | Yes | Price type for this client |
| `store_uid` | string | Yes | Assigned store for inventory allocation |
| `active` | bool | No | Whether client can log in (defaults to false if no pin_code) |
| `language` | string | No | Preferred language code (max 10 characters, e.g., "en", "uk") |

#### Discount Calculation

Three discount modes are supported:

1. **Fixed Discount** (`fixed_discount: true`): Uses the `discount` field directly, ignores balance and discount scale
2. **Cumulative Scale-Based** (`fixed_discount: false`, `cumulative_discount: true`): Looks up discount from the discount scale based on `client.balance + current_order_total`. This allows clients to build up turnover over time to reach higher discount tiers.
3. **Per-Order Scale-Based** (`fixed_discount: false`, `cumulative_discount: false`): Looks up discount from the discount scale based on `current_order_total` only. Each order is evaluated independently without considering historical balance.

The discount that ends up on an order line is resolved in a fixed sequence:

1. **Earned discount** — from the mode above (fixed field or scale lookup).
2. **Product discount limit** — if the product has a limit, the earned discount is capped at it.
3. **Additional discount** — `client.additional_discount` is added on top, in percentage points.

Step 3 runs **after** step 2 on purpose, so the additional discount deliberately
exceeds the product limit. A client on 20% with `additional_discount: 3` buying a
product limited to 5% pays 8% off, not 5%. The result is capped at 100%.

`additional_discount` never affects the scale turnover — the tier is still earned
on the undiscounted order total. `order.discount_percent` reports the client-level
total (earned + additional); a product-limited line carries less, never more.

A manager-set order discount (`discount_override`) replaces the whole client-level
discount, additional discount included.

#### Upsert Clients (Create or Update)

**POST** `/client`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "client-123",
      "name": "ACME Corporation",
      "phone": "+1234567890",
      "pin_code": "1234",
      "email": "contact@acme.com",
      "address": "123 Business St",
      "discount": 10,
      "additional_discount": 0,
      "fixed_discount": true,
      "cumulative_discount": true,
      "vat_rate": 20,
      "vat_number": "VAT123456",
      "business_registration_number": "BRN123456",
      "manager_uid": "user-mgr-001",
      "price_type_uid": "wholesale-usd",
      "store_uid": "store-456",
      "active": true,
      "language": "en"
    }
  ]
}
```

#### List Clients

**GET** `/client`

**Query Parameters:**
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100

#### Get Clients Batch

**POST** `/client/batch`

**Request Body:**
```json
{
  "data": ["client-123", "client-456"]
}
```

#### Delete Clients Batch

**POST** `/client/delete`

**Request Body:**
```json
{
  "data": ["client-123", "client-456", "client-789"]
}
```

#### Find Clients by Email Batch

**POST** `/client/find/email`

**Request Body:**
```json
{
  "data": ["client1@example.com", "client2@example.com"]
}
```

#### Update Client Active Status (Batch)

**POST** `/client/active`

**Request Body:**
```json
{
  "data": [
    {"uid": "client-123", "active": false},
    {"uid": "client-456", "active": true}
  ]
}
```

---

## Client Branch

Branches (filials, points of sale) of a client. The **parent client owns every commercial parameter** — discount, discount mode, balance/turnover, manager, price type, store, login PIN — while a **branch owns only its own legal identity**: name, VAT number, business registration number, contact person. A branch never logs in and never accumulates a balance of its own.

The ERP is the source of truth: it populates the directory via the upsert/delete/sync endpoints and assigns the UIDs (ERP GUIDs — the portal never generates them, unlike clients). Branches are read-only in the admin UI.

> **No inheritance.** A branch **never** inherits its parent's `vat_number` or `business_registration_number`. An empty value means the branch genuinely has none. A branch that should trade under its parent's numbers must carry an **explicit copy** of them, pushed by the ERP. The same holds for `vat_rate`, which mirrors `clients.vat_rate` field for field.
>
> Consequence for the ERP: `vat_rate` and `vat_number` must be populated **together**. A branch given a VAT number but left at the default `0.0000` rate will bill cross-border orders at 0% VAT, and the column cannot distinguish that from deliberate intra-EU reverse charge.

> **Branch billing is live.** An address linked to a branch makes that branch the party billed for orders delivered there: its VAT number and rate set the order's `vat_rate`, its identity is snapshotted onto the order's [`branch_*` fields](#order-entity-fields), its business registration number is what the store's confirmation gate checks, and the outgoing [invoice](./invoice-request.md#7-branch-billing) and webhook payloads carry the branch in their `client_*` fields.

#### Client Branch Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | ERP GUID, primary identifier (set by ERP, never minted by the portal) |
| `client_uid` | string | Yes | Parent client. Must reference an existing client — an unknown UID rejects the whole batch |
| `name` | string | Yes | Branch name. Replaces the client name on documents once branch billing is enabled |
| `vat_number` | string | No | Branch VAT number (max 50 characters). Empty means the branch has none — never inherited from the parent |
| `vat_rate` | float | No | VAT rate in percent (0–100). Mirrors `clients.vat_rate`: the customer rate, set to 0 for intra-EU reverse charge |
| `business_registration_number` | string | No | Branch business registration number (max 50 characters). Empty means the branch has none — never inherited |
| `contact_name` | string | No | Contact person at the branch (max 255 characters) |
| `contact_phone` | string | No | Contact phone (max 50 characters). **May duplicate the parent client's phone** — branches are not subject to the client phone-uniqueness rule |
| `contact_email` | string | No | Contact email (must be a valid address when present) |
| `active` | bool | No | Active flag |

> **ERP integrators — `active` is a plain bool on a full-record upsert.** An omitted key decodes as `false` and deactivates the branch. Send it on every push. This matches the `company` and `client_address` flag behaviour.

#### Upsert Client Branches (Create or Update)

**POST** `/client_branch`

ERP bulk sync endpoint (detached from the request timeout, like company/product sync). Upsert is keyed on `uid`. Every `client_uid` in the batch is verified to exist **before** any row is written, so a batch containing one bad parent reference is rejected whole rather than half-applied.

**Request Body:**
```json
{
  "data": [
    {
      "uid": "b1b2c3d4-0000-0000-0000-000000000001",
      "client_uid": "client-123",
      "name": "Salon Centrum",
      "vat_number": "PL9876543210",
      "vat_rate": 0,
      "business_registration_number": "0000987654",
      "contact_name": "Anna Nowak",
      "contact_phone": "+48123456789",
      "contact_email": "centrum@example.com",
      "active": true
    }
  ]
}
```

**Response:** Array of upserted branch UIDs.

#### List Client Branches

**GET** `/client_branch`

**Query Parameters:**
- `page`: (optional) integer, default 1
- `count`: (optional) integer, default 100

#### Get Client Branches Batch

**POST** `/client_branch/batch`

**Request Body:**
```json
{
  "data": ["b1b2c3d4-0000-0000-0000-000000000001"]
}
```

#### Find Client Branches by Client UIDs

**POST** `/client_branch/find/client`

Returns branches grouped by parent client UID. This is what the admin client page reads.

**Request Body:**
```json
{
  "data": ["client-123", "client-456"]
}
```

**Response:**
```json
{
  "data": {
    "client-123": [
      {"uid": "b1b2c3d4-0000-0000-0000-000000000001", "client_uid": "client-123", "name": "Salon Centrum", "active": true}
    ]
  }
}
```

#### Sync Client Branches (Full-List Reconciliation)

**POST** `/client_branch/sync`

The ERP sends the **full authoritative list** of branch UIDs; every branch not present in the list is deleted. An empty list is rejected (validation error) so a malformed payload cannot wipe the directory — use `/client_branch/delete` for explicit removals.

**Request Body:**
```json
{
  "data": [
    "b1b2c3d4-0000-0000-0000-000000000001",
    "b1b2c3d4-0000-0000-0000-000000000002"
  ]
}
```

**Response:** Array of deleted (stale) branch UIDs — empty when the directory already matched.

#### Delete Client Branches Batch

**POST** `/client_branch/delete`

**Request Body:**
```json
{
  "data": ["b1b2c3d4-0000-0000-0000-000000000001"]
}
```

Deleting a client deletes its branches (`ON DELETE CASCADE`).

---

## Company

Company directory of legal entities that orders are placed under. The ERP is the source of truth: it populates the directory via the upsert/delete endpoints and assigns the UIDs (ERP GUIDs — the portal never generates them, unlike clients). Companies are read-only in the admin UI.

A company may be bound to a shipment carrier (`shipment_carriers.company_uid`). When an order carries a `company_uid` and at least one active carrier of the order's store is bound to that company, shipping for the order is restricted to those carriers (see [admin-api.md](admin-api.md#list-active-carriers)). Companies are optional — orders without a company keep the full manual carrier choice.

#### Company Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | ERP GUID, primary identifier (set by ERP, never minted by the portal) |
| `name` | string | Yes | Company name |
| `business_registration_number` | string | No | Business registration number (max 50 characters) |
| `vat_number` | string | No | VAT registration number (max 50 characters) |
| `country_code` | string | No | Country code of the registered address (max 5 characters) |
| `zipcode` | string | No | Postal code |
| `city` | string | No | City |
| `address_text` | string | No | Street address |
| `contact_first_name` | string | No | Contact person first name |
| `contact_last_name` | string | No | Contact person last name |
| `contact_phone` | string | No | Contact person phone (max 50 characters) |
| `active` | bool | No | Active flag |

#### Upsert Companies (Create or Update)

**POST** `/company`

ERP bulk sync endpoint (detached from the request timeout, like product/category sync). Upsert is keyed on `uid`.

**Request Body:**
```json
{
  "data": [
    {
      "uid": "a1b2c3d4-0000-0000-0000-000000000001",
      "name": "Comex Sp. z o.o.",
      "business_registration_number": "0000123456",
      "vat_number": "PL1234567890",
      "country_code": "PL",
      "zipcode": "01-258",
      "city": "Warszawa",
      "address_text": "Wolska 171",
      "contact_first_name": "Jan",
      "contact_last_name": "Kowalski",
      "contact_phone": "+48123456789",
      "active": true
    }
  ]
}
```

**Response:** Array of upserted company UIDs.

#### List Companies

**GET** `/company`

**Query Parameters:**
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100

#### Get Companies Batch

**POST** `/company/batch`

**Request Body:**
```json
{
  "data": ["a1b2c3d4-0000-0000-0000-000000000001"]
}
```

#### Sync Companies (Full-List Reconciliation)

**POST** `/company/sync`

The ERP sends the **full authoritative list** of company UIDs; every company not present in the list is deleted. Combined with upserts, this is how the ERP keeps the directory up to date. An empty list is rejected (validation error) so a malformed payload cannot wipe the directory — use `/company/delete` for explicit removals.

**Request Body:**
```json
{
  "data": [
    "a1b2c3d4-0000-0000-0000-000000000001",
    "a1b2c3d4-0000-0000-0000-000000000002"
  ]
}
```

**Response:** Array of deleted (stale) company UIDs — empty when the directory already matched.

#### Delete Companies Batch

**POST** `/company/delete`

Deleting a company does not touch carriers bound to it — the binding simply stops matching any order until the ERP re-creates the company.

**Request Body:**
```json
{
  "data": ["a1b2c3d4-0000-0000-0000-000000000001"]
}
```

---

## Product

#### Product Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Unique identifier |
| `sku` | string | Yes | Stock Keeping Unit (product code) |
| `category_uid` | string | Yes | Category this product belongs to |
| `image` | string | No | Legacy image field (use Product Images API instead) |
| `barcode` | string | No | Product barcode |
| `sort_order` | int | No | Display order within category (default: 0) |
| `active` | bool | No | Whether product is visible in catalog |
| `is_new` | bool | No | Mark as new product (for highlighting) |
| `is_hot_sale` | bool | No | Mark as hot sale product (for highlighting) |
| `weight_g` | int | No | Unit weight in **grams** (default: 0). Used by shipment carriers for customs gross-weight lines and for distributing products across boxes by weight when a carrier splits a multi-box order. Acts as the catalogue fallback when an order line does not carry its own `weight_g` |
| `hs_code` | string | No | HS / customs tariff code (max 20 chars). Used to build international customs declarations. When empty, the shipment carrier's configured default tariff code is used |
| `origin_country` | string | No | ISO 3166-1 alpha-2 country of origin (e.g. `"PL"`). Used in customs declarations. When empty, the carrier's configured default country of origin is used |
| `tags` | array | No | Store-scoped product tags. On read, populated from `product_tag_assignments`. On upsert (write), used to replace the product's tag assignments — only `tag.uid` is consumed; an empty or omitted `tags` array wipes existing assignments |

#### Product Description Fields

Product descriptions are language-specific.

**Composite Key:** `(product_uid, language)`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_uid` | string | Yes | Product this description belongs to |
| `language` | string | Yes | Language code (e.g., "en", "uk") |
| `name` | string | Yes | Product name in this language |
| `description` | string | No | Product description in this language |

#### Product Tag Fields

Product tags are short colored badges (for example, `"NEW"` or `"IN SEASON"`) attached to products. Tags are scoped by store and are returned in product reads as `tags`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Unique tag identifier |
| `store_uid` | string | Yes | Store this tag belongs to |
| `name` | string | Yes | Badge label, max 64 characters |
| `color` | string | Yes | RGB hex color such as `#FF6B6B` |
| `sort_order` | int | No | Catalog priority; lower values sort first. **Negative disables sorting** — the badge still renders, but tagged products keep their common position among untagged ones |
| `last_update` | datetime | No | Last update timestamp |

#### Product Tag Assignment Fields

Product tag assignments bind products to tags. Assignments are uploaded by ERP and use a composite key.

**Composite Key:** `(product_uid, tag_uid)`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_uid` | string | Yes | Product receiving the tag |
| `tag_uid` | string | Yes | Tag assigned to the product |
| `last_update` | datetime | No | Last update timestamp |

#### Upsert Products (Create or Update)

**POST** `/product`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "prod-123",
      "sku": "WIDGET-001",
      "category_uid": "cat-electronics",
      "barcode": "1234567890123",
      "sort_order": 10,
      "active": true,
      "is_new": false,
      "is_hot_sale": true,
      "weight_g": 1500,
      "hs_code": "85044090",
      "origin_country": "PL",
      "tags": [
        {"uid": "tag-new"},
        {"uid": "tag-season"}
      ]
    }
  ]
}
```

**Tag sync semantics.** The `tags` array, when present, replaces the product's tag assignments. Only `tag.uid` is consumed; other tag fields (`name`, `color`, `store_uid`, etc.) are ignored. Sending `"tags": []` and omitting `tags` are equivalent — both delete all existing assignments for that product. To leave a product's assignments untouched, do not call this endpoint for that product, or use the dedicated `/product_tags/assignments` endpoints.

Tag UIDs are not validated against `product_tags`. Unknown UIDs are inserted as orphan rows and are silently filtered out when products are read (the read path joins through `product_tags`).

If product rows persist successfully but the tag-sync step fails, the endpoint returns `500`. Reposting the same payload is safe — both the product upsert and the wipe-and-replace tag sync are idempotent.

#### Upsert Product Descriptions (Create or Update)

**POST** `/product/description`

**Request Body:**
```json
{
  "data": [
    {
      "product_uid": "prod-123",
      "language": "en",
      "name": "Premium Widget",
      "description": "High-quality widget for all your needs"
    },
    {
      "product_uid": "prod-123",
      "language": "uk",
      "name": "Преміум Віджет",
      "description": "Високоякісний віджет для всіх ваших потреб"
    }
  ]
}
```

#### Delete Product Descriptions Batch

**POST** `/product/description/delete`

Delete product descriptions by composite keys (product_uid + language).

**Request Body:**
```json
{
  "data": [
    {"product_uid": "prod-123", "language": "en"},
    {"product_uid": "prod-456", "language": "uk"}
  ]
}
```

#### Update Product Active Status (Batch)

**POST** `/product/active`

**Request Body:**
```json
{
  "data": [
    {"uid": "prod-123", "active": false},
    {"uid": "prod-456", "active": true}
  ]
}
```

#### Delete Products Batch

**POST** `/product/delete`

**Request Body:**
```json
{
  "data": ["prod-123", "prod-456"]
}
```

#### Product Inventory Management

The inventory system uses a **multi-store architecture**:
- Products do not have a global quantity field - inventory is tracked per-store
- Each store tracks its own inventory via `/store/inventory` endpoints
- When orders are created with status `"new"`, quantities are allocated from the client's assigned store
- Available quantity = `store_inventory.quantity - SUM(allocations)`

#### List Products

**GET** `/product`

**Query Parameters:**
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100

#### Get Products Batch

**POST** `/product/batch`

**Request Body:**
```json
{
  "data": ["prod-123", "prod-456"]
}
```

#### Find Products by Category Batch

**POST** `/product/find/category`

**Request Body:**
```json
{
  "data": ["cat-123", "cat-456"]
}
```

#### Get Batch Product Descriptions

**POST** `/product/descriptions/batch`

Retrieve product descriptions (UID + Name + Description) for multiple products in a specific language.

**Query Parameters:**
- `language`: (required) string

**Request Body:**
```json
{
  "data": ["prod-123", "prod-456"]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "uid": "prod-123",
      "name": "Basic Widget",
      "description": "High-quality basic widget"
    }
  ]
}
```

#### Upsert Product Tags (ERP)

**POST** `/product_tags`

Creates or updates store-scoped tag definitions.

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
    },
    {
      "uid": "tag-season",
      "store_uid": "store-1",
      "name": "IN SEASON",
      "color": "#F57C00",
      "sort_order": 20
    }
  ]
}
```

**Response:** Array of upserted tag UIDs.

#### Delete Product Tags (ERP)

**POST** `/product_tags/delete`

Deletes tags by UID and removes their assignments.

**Request Body:**
```json
{
  "data": ["tag-new", "tag-season"]
}
```

#### Upsert Product Tag Assignments (ERP)

**POST** `/product_tags/assignments`

> Most ERPs should sync tags via the `/product` upsert endpoint (`tags` field), which performs a per-product wipe-and-replace. Use this endpoint when adding or removing assignments without touching the product row, or for fine-grained reconciliation.

Assigns tags to products. The product catalog returns assigned tags filtered to the client's store.

**Request Body:**
```json
{
  "data": [
    {"product_uid": "prod-123", "tag_uid": "tag-new"},
    {"product_uid": "prod-456", "tag_uid": "tag-season"}
  ]
}
```

#### Delete Product Tag Assignments (ERP)

**POST** `/product_tags/assignments/delete`

> Most ERPs should sync tags via the `/product` upsert endpoint (`tags` field), which wipes a product's assignments by sending an empty or omitted `tags` array. Use this endpoint to delete specific pairs without touching the product row.

Deletes specific product-tag pairs.

**Request Body:**
```json
{
  "data": [
    {"product_uid": "prod-123", "tag_uid": "tag-new"},
    {"product_uid": "prod-456", "tag_uid": "tag-season"}
  ]
}
```

---

## Category

#### Category Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Unique identifier |
| `parent_uid` | string | No | Parent category UID (for hierarchical categories) |
| `active` | bool | No | Whether category is visible |
| `menu` | bool | No | Whether category appears in navigation menu |
| `sort_order` | int | No | Display order (default: 0) |

#### Category Description Fields

**Composite Key:** `(category_uid, language)`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `category_uid` | string | Yes | Category this description belongs to |
| `language` | string | Yes | Language code (e.g., "en", "uk") |
| `name` | string | Yes | Category name in this language |
| `description` | string | No | Category description in this language |

#### Category Description Format

Category descriptions automatically include parent category names:
- Format: `"Parent Name Child Name"` (if parent exists)
- Applies to all languages independently

#### Upsert Categories (Create or Update)

**POST** `/category`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "cat-electronics",
      "parent_uid": "",
      "active": true,
      "menu": true,
      "sort_order": 1
    },
    {
      "uid": "cat-smartphones",
      "parent_uid": "cat-electronics",
      "active": true,
      "menu": true,
      "sort_order": 0
    }
  ]
}
```

#### Upsert Category Descriptions (Create or Update)

**POST** `/category/description`

**Request Body:**
```json
{
  "data": [
    {
      "category_uid": "cat-electronics",
      "language": "en",
      "name": "Electronics",
      "description": "Electronic devices and accessories"
    }
  ]
}
```

#### Delete Categories Batch

**POST** `/category/delete`

**Request Body:**
```json
{
  "data": ["cat-123", "cat-456"]
}
```

#### Delete Category Descriptions Batch

**POST** `/category/description/delete`

**Request Body:**
```json
{
  "data": [
    {"category_uid": "cat-123", "language": "en"},
    {"category_uid": "cat-456", "language": "uk"}
  ]
}
```

#### List Categories

**GET** `/category`

**Query Parameters:**
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100

#### Get Categories Batch

**POST** `/category/batch`

**Request Body:**
```json
{
  "data": ["cat-123", "cat-456"]
}
```

#### Find Categories by Parent UIDs Batch

**POST** `/category/find/parent`

**Request Body:**
```json
{
  "data": ["parent-cat-1", "parent-cat-2"]
}
```

#### Get Batch Category Descriptions

**POST** `/category/description/batch`

**Request Body:**
```json
{
  "data": ["cat-123", "cat-456"]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "category_uid": "cat-smartphones",
      "language": "en",
      "name": "Electronics Smartphones",
      "description": "Mobile phones and accessories"
    }
  ]
}
```

---

## Attribute

#### Attribute Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Unique identifier |
| `product_uid` | string | Yes | Product this attribute belongs to |
| `value_uid` | string | Yes | Reference to attribute value |

#### Attribute Description Fields

**Composite Key:** `(attribute_uid, language)`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `attribute_uid` | string | Yes | Attribute this description belongs to |
| `name` | string | Yes | Attribute name in this language |
| `language` | string | Yes | Language code (e.g., "en", "uk") |

#### Attribute Value Fields

**Composite Key:** `(uid, language)`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Unique identifier |
| `name` | string | Yes | Value display name in this language |
| `language` | string | Yes | Language code (e.g., "en", "uk") |

#### Upsert Attributes (Create or Update)

**POST** `/attribute`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "attr-color-prod-123",
      "product_uid": "prod-123",
      "value_uid": "val-red"
    }
  ]
}
```

#### Upsert Attribute Descriptions (Create or Update)

**POST** `/attribute/description`

**Request Body:**
```json
{
  "data": [
    {
      "attribute_uid": "attr-color-prod-123",
      "name": "Color",
      "language": "en"
    }
  ]
}
```

#### Upsert Attribute Values (Create or Update)

**POST** `/attribute/value`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "val-red",
      "name": "Red",
      "language": "en"
    }
  ]
}
```

#### Delete Attributes Batch

**POST** `/attribute/delete`

**Request Body:**
```json
{
  "data": ["attr-123", "attr-456"]
}
```

#### Delete Attribute Descriptions Batch

**POST** `/attribute/description/delete`

**Request Body:**
```json
{
  "data": [
    {"attribute_uid": "attr-123", "language": "en"}
  ]
}
```

#### Delete Attribute Values Batch

**POST** `/attribute/value/delete`

**Request Body:**
```json
{
  "data": [
    {"uid": "val-123", "language": "en"}
  ]
}
```

#### List Attributes

**GET** `/attribute`

**Query Parameters:**
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100

#### Get Attributes Batch

**POST** `/attribute/batch`

**Request Body:**
```json
{
  "data": ["attr-123", "attr-456"]
}
```

#### Find Attributes by Product UIDs Batch

**POST** `/attribute/find/product`

**Request Body:**
```json
{
  "data": ["prod-123", "prod-456"]
}
```

#### Get Batch Attribute Descriptions

**POST** `/attribute/description/batch`

**Request Body:**
```json
{
  "data": ["attr-123", "attr-456"]
}
```

#### Get Batch Attribute Values

**POST** `/attribute/value/batch`

**Request Body:**
```json
{
  "data": ["val-123", "val-456"]
}
```

---

## Price

Prices link products to price types with specific amounts. All prices are stored as **integers in cents** (e.g., $19.99 = `1999`).

**Composite Key:** `(price_type_uid, product_uid)`

#### Price Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `price_type_uid` | string | Yes | Price type this price belongs to |
| `product_uid` | string | Yes | Product this price belongs to |
| `price` | int | Yes | Price in cents (must be >= 0) |

#### Upsert Prices (Create or Update)

**POST** `/price`

**Request Body:**
```json
{
  "data": [
    {
      "price_type_uid": "retail-price-usd",
      "product_uid": "product-001",
      "price": 1999
    },
    {
      "price_type_uid": "wholesale-price-usd",
      "product_uid": "product-001",
      "price": 1499
    }
  ]
}
```

#### Delete Prices Batch

**POST** `/price/delete`

Delete prices by composite keys (price_type_uid + product_uid).

**Request Body:**
```json
{
  "data": [
    {"price_type_uid": "retail-price-usd", "product_uid": "product-001"},
    {"price_type_uid": "wholesale-price-usd", "product_uid": "product-002"}
  ]
}
```

#### Delete Prices by Products Batch

**POST** `/price/delete/products`

Delete all prices for the specified products.

**Request Body:**
```json
{
  "data": ["product-001", "product-002"]
}
```

#### Delete Prices by Price Types Batch

**POST** `/price/delete/price_types`

Delete all prices for the specified price types.

**Request Body:**
```json
{
  "data": ["retail-price-usd", "wholesale-price-usd"]
}
```

#### Get All Prices for a Product

**POST** `/price/find/product`

**Request Body:**
```json
{
  "data": {
    "product_uid": "product-001"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "price_type_uid": "retail-price-usd",
      "product_uid": "product-001",
      "price": 1999
    },
    {
      "price_type_uid": "wholesale-price-usd",
      "product_uid": "product-001",
      "price": 1499
    }
  ]
}
```

#### Get Prices for Multiple Products (Batch)

**POST** `/price/batch/products`

**Request Body:**
```json
{
  "data": ["product-001", "product-002", "product-003"]
}
```

**Response:** Map of product UID to array of prices.

#### Get Prices for Multiple Price Types (Batch)

**POST** `/price/batch/price_types`

**Request Body:**
```json
{
  "data": ["retail-price-usd", "wholesale-price-usd"]
}
```

**Response:** Map of price type UID to array of prices.

#### Get Prices for Products Under Specific Price Type (Batch)

**POST** `/price/batch/price_type_products`

Most commonly used endpoint for displaying product catalogs with user-specific pricing.

**Request Body:**
```json
{
  "data": {
    "price_type_uid": "retail-price-usd",
    "product_uids": ["product-001", "product-002", "product-003"]
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "price_type_uid": "retail-price-usd",
      "product_uid": "product-001",
      "price": 1999
    }
  ]
}
```

---

## Order

#### Order Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | No | Unique identifier (auto-generated if not provided) |
| `number` | string | No | Order number (display reference) |
| `client_uid` | string | Yes | Client placing the order |
| `store_uid` | string | No | Store for inventory (auto-set from client) |
| `price_type_uid` | string | No | Price type (auto-set from client) |
| `currency_code` | string | No | Currency code (auto-set from price type) |
| `status` | string | Yes | Order status: `draft`, `new`, `processing`, `confirmed`, `cancelled` |
| `draft` | bool | No | Whether this is a draft order |
| `total` | float | No | Order total including VAT (calculated by backend) |
| `subtotal` | float | No | Order subtotal before VAT (calculated by backend) |
| `total_vat` | float | No | Total VAT amount (calculated by backend) |
| `original_total` | float | No | Total before discount (calculated by backend) |
| `discount_amount` | float | No | Total discount savings (calculated by backend) |
| `delivery_cost` | float | No | Delivery cost in **cents**, set by the manager or derived from the carrier quote. Read-only for the ERP — it is never accepted as input. Already included in `total` |
| `discount_percent` | int | No | Discount percentage (0-100) |
| `vat_rate` | float | No | VAT rate percentage (0-100) |
| `country_code` | string | No | Shipping country (ISO code) |
| `zipcode` | string | No | Shipping postal code |
| `city` | string | No | Shipping city |
| `address_text` | string | No | Full shipping address |
| `shipping_address` | string | No | Shipping address reference |
| `billing_address` | string | No | Billing address reference |
| `comment` | string | No | Order notes |
| `branch_uid` | string | No | **Read-only.** [Branch](#client-branch) billed for this order, snapshotted when the delivery address was selected. Empty means the client is billed directly. This is the party identifier for data exchange — see the note below |
| `branch_name` | string | No | **Read-only.** Branch name snapshot |
| `branch_vat_number` | string | No | **Read-only.** Branch VAT number snapshot |
| `branch_business_registration_number` | string | No | **Read-only.** Branch business registration number snapshot |
| `branch_override` | bool | No | **Read-only.** Present (`true`) only when an operator chose the branch directly instead of it being derived from the delivery address. Omitted otherwise. See the note below |
| `company_uid` | string | No | Selling legal entity the order is placed under (ERP GUID from the [company](#company) directory). Note the direction: this is the **seller**, while `branch_uid` above is the buyer's sub-entity. Set by the ERP on sync or reassigned by staff |
| `company_name` | string | No | **Read-only.** Company name, copied from the directory row so the two can never disagree |
| `erp_number` | string | No | **Read-only for every Comex caller.** The document number the ERP assigns once it has processed the order. Written only through the `erp_number` element of the [ERP order edit](#erp-order-edit) endpoint. Do not confuse it with `number` above, which Comex generates |
| `is_edited` | bool | No | **Read-only.** Set when the order's product list has been changed after confirmation — by a manager, by an ERP item edit, or by a split |
| `parent_order_uid` | string | No | **Read-only.** Set on an order created by splitting another one, naming the order its goods came from. Empty on every other order. Written once, at creation, and never updated. See [Order Splitting](#order-splitting) |
| `items` | array | Yes | Order items (min 1 required) |
| `boxes` | array | No | Packaging boxes supplied by the ERP after picking & packing (physical attributes only — see [Order Box Fields](#order-box-fields)) |
| `created_at` | timestamp | No | Order creation timestamp |
| `last_update` | timestamp | No | **Read-only.** Timestamp of the last write to the order row. Returned on every order read path. Note it is stamped on any row write, not only on a semantically meaningful change, so it is not a reliable change-detection key — use the [changes](#changes) feed for that |

**Zero-value money fields are omitted from responses.** The calculated money fields (`total`, `subtotal`, `total_vat`, `original_total`, `discount_amount`, `delivery_cost`) are serialized with `omitempty`, so a field worth 0 is absent from the JSON rather than present as `0`. Consumers must treat a missing field as zero — an order with no delivery cost has no `delivery_cost` key at all.

**Delivery cost.** `delivery_cost` is in cents, like every other money field on the order, and it is already added into `total` (`total = subtotal + total_vat + delivery_cost`). Do not add it again when reconciling the order total in the ERP. It is set inside Comex — by a manager on the order, or automatically from the carrier price when a shipment is created — and the ERP cannot write it: the ERP order edit endpoint accepts only items, boxes, and a company assignment. It is returned on every order read path (`/order/batch`, `/order/find/status`, `/order/find/client`, `/order`, `/crm/board/orders`, and the ERP order edit response), and a change to it is reported as a `delivery_cost` field change through the [changes](#changes) sync feed.

**Branch billing.** When the order's delivery address is linked to a [branch](#client-branch), that branch — not the client — is the legal party the order is billed to. The `branch_*` fields are a **snapshot** taken when the address was selected and refreshed at confirmation: they are what the document must be issued against, even if the ERP later edits or deletes the branch record.

On the order entity itself `client_uid` always names the parent client — it is a foreign key, and the client is who signs in and accumulates turnover. **Outgoing document payloads are different**: the [invoice](./invoice-request.md#7-branch-billing) and the `order_confirmed` [webhook](./webhooks.md) write the branch's identity into their own `client_*` fields, so those consumers are told who to bill without needing to know branches exist.

Substitution is total. A branch's VAT number, VAT rate and business registration number replace the client's outright, with no fallback — an empty `branch_vat_number` means that branch is not VAT-registered, and the order is rated accordingly. Two consequences worth planning for:

- The branch's VAT number and rate drive `vat_rate` on the order. A branch with a VAT number but `vat_rate` left at `0` bills cross-border orders at 0% VAT.
- If the order's store has `require_business_registration` enabled, a branch with **no** `business_registration_number` cannot have its orders confirmed — even when the parent client has one. Populate branch records fully before linking their addresses.

These fields are never accepted as input. They are set by Comex from the address link and returned on every order read path. Moving an order between a branch address and a client address is reported as a `branch_uid` field change through the [changes](#changes) sync feed.

A payload that **omits** the `branch_*` keys does not clear them: on an existing order the branch snapshot is always taken from the stored row, never merged from the request. The fields are server-owned, so echoing them back is a no-op and sending different values has no effect.

**`branch_override` — an order that no longer follows its address.** An operator can change the billed branch directly on a live order, at a pipeline stage where the order can no longer be edited. This exists because the wrong-payer mistake surfaces at invoicing, which has no stage gate, by which point the delivery address is frozen. Assigning a payer to a part while [splitting an order](#order-splitting) sets it for the same reason.

When that happens the order carries `branch_override: true` and **stops tracking `client_addresses.branch_uid` permanently**. Re-pointing the address' branch link, or moving the order to a different address, will not change who it is billed to. Treat `branch_override: true` as "this order's payer was decided by hand — the address link is not the source of truth here". The change is reported as a `branch_uid` field change through the [changes](#changes) feed like any other.

Only the VAT rate is recalculated when this happens: item prices and discounts are left exactly as confirmed, so `total` may move purely because the new party's VAT status differs.

#### Order Splitting

A manager can split an order: some of its goods move onto new orders, so that each
resulting order can be invoiced by a different legal entity to a different payer.
This is available at whichever pipeline stages have `allow_split` set, including
late, invoicing-time stages where the order can no longer be edited.

**Nothing is cancelled.** The order being split survives as the first part:

- it keeps its `uid`, `number`, `erp_number`, `created_at`, `status`, its pipeline
  stage, its manager and its `delivery_cost`;
- its `items` are replaced with the subset that stayed on it, and `total`,
  `subtotal`, `total_vat`, `original_total` and `discount_amount` are re-derived from
  those lines at an **unchanged `vat_rate`**;
- `is_edited` becomes `true`;
- its `company_uid` and `branch_uid` may have been reassigned, if the operator
  assigned the first part.

The goods that moved become **new orders**, each with:

- a fresh `uid` and a fresh Comex `number`, and an **empty `erp_number`** — these are
  documents the ERP has not seen;
- `parent_order_uid` = the `uid` of the order that survived;
- the same `client_uid`, `store_uid`, `price_type_uid`, `currency_code`, `status`,
  `vat_rate` and delivery address as the order they came from;
- their own `company_uid` / `company_name` and their own `branch_*` snapshot, which
  may differ from the surviving order's and from each other's;
- item `price` and `discount` copied verbatim — **a split never re-prices**;
- `delivery_cost` of zero: the freight stays whole on the order that was already
  carrying it.

So for the ERP a split reduces to two operations it already handles:

1. **An update to an order it knows** — same identity, fewer lines, lower total,
   `is_edited` set exactly as an ERP item edit sets it.
2. **One or more order creations**, each pointing back through `parent_order_uid`.

All of them are reported through the [changes](#changes) sync feed as `order`
changes, so a normal polling loop picks the whole split up in one pass.

**The money is conserved.** Comex refuses to write a split unless the resulting
orders hold exactly the source order's products in exactly its quantities, and their
totals add up to the source order's total (to within a cent per line, since VAT
rounds per line). The VAT rate cannot move either: a payer reassignment that would
change it is rejected outright rather than re-rating the goods. An ERP reconciling
`parent_order_uid` groups can rely on the group summing to what the order was worth
before the split.

**What blocks a split.** Comex refuses once the order has a shipment or a
successfully issued invoice, because neither is reissued and both would stop matching
the order they name. It does **not** currently refuse on the basis of `erp_number`
alone — an order the ERP has numbered can still shrink. If that is a problem on the
ERP side, say so and the check can be added.

#### Order Item Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `order_uid` | string | Yes | Order this item belongs to |
| `product_uid` | string | Yes | Product UID |
| `quantity` | int | Yes | Quantity (must be > 0) |
| `price` | int | Yes | Unit price in cents (from prices table) |
| `discount` | int | No | Item-level discount percentage (0-100) |
| `price_discount` | int | No | Price after discount in cents (calculated by backend) |
| `tax` | float | No | VAT amount for this item (calculated by backend) |
| `total` | float | No | Item total including VAT (calculated by backend) |
| `weight_g` | int | No | Unit weight in **grams** for this order line (default: 0). Optional per-order snapshot that overrides the product catalogue's `weight_g` for shipment customs and weight-based box distribution. When 0/omitted, the product catalogue weight is used |

#### Order Box Fields

Packaging boxes are produced by the ERP after an order is picked and packed. They carry **only physical attributes** — never monetary data. The backend remains the single source of truth for prices and totals.

**Composite Key:** `(order_uid, box_number)`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `order_uid` | string | Yes | Order this box belongs to |
| `box_number` | int | Yes | Sequential box index within the order (1..N). Reassigned on every ERP full-replacement update |
| `length_cm` | int | Yes | Length in centimetres (must be > 0) |
| `width_cm` | int | Yes | Width in centimetres (must be > 0) |
| `height_cm` | int | Yes | Height in centimetres (must be > 0) |
| `weight_kg` | float | Yes | Weight in kilograms (must be > 0) |
| `last_update` | timestamp | No | Last modification timestamp (auto-set) |

Boxes use **full-replacement semantics**: submitting a boxes array overwrites all existing boxes for the order. Deleting the parent order cascades to its boxes.

#### Order Status Flow

```
Frontend:    "draft" (saved cart)  →  "new" (user confirmed)
             ↓                        ↓
             No allocation           Allocation created

External CRM:  "new"  →  "processing"  →  "confirmed"
               ↓          ↓               ↓
               Allocated  Allocated       Allocation DELETED
```

#### Create Order (Upsert)

**POST** `/order`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "order-123",
      "client_uid": "client-456",
      "status": "draft",
      "items": [
        {
          "product_uid": "prod-789",
          "quantity": 2,
          "price": 1000
        }
      ]
    }
  ]
}
```

**Behavior Based on Status:**
- **`status: "draft"`**: Saves cart without validation or allocations
- **`status: "new"`**: Validates stock and creates allocations

#### Partial Update Order

**PUT** `/order`

Update specific fields without replacing the entire order.

**Request Body:**
```json
{
  "data": [
    {
      "uid": "order-123",
      "shipping_address": "456 New St",
      "comment": "Updated delivery instructions"
    }
  ]
}
```

#### List Orders

**GET** `/order`

**Query Parameters:**
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100

#### Get Orders Batch

**POST** `/order/batch`

**Request Body:**
```json
{
  "data": ["order-123", "order-456"]
}
```

Returns the full order objects (items, boxes, totals). When a carrier shipment
with an assigned tracking number exists for an order, the response also carries a
`shipments` array — see [Order Shipment Tracking Data](#order-shipment-tracking-data).

#### Delete Orders Batch

**POST** `/order/delete`

**Request Body:**
```json
{
  "data": ["order-123", "order-456"]
}
```

#### Find Orders by Client UIDs Batch

**POST** `/order/find/client`

**Request Body:**
```json
{
  "data": ["client-123", "client-456"]
}
```

#### Find Orders by Statuses Batch

**POST** `/order/find/status`

**Request Body:**
```json
{
  "data": ["new", "processing"]
}
```

Paginated (`offset`/`limit` query params). Each returned order carries a
`shipments` array once a carrier shipment with a tracking number exists — see
[Order Shipment Tracking Data](#order-shipment-tracking-data).

#### Order Shipment Tracking Data

The ERP obtains a carrier **tracking number** by re-reading an order through
`/order/batch` or `/order/find/status`. When at least one shipment for the order
has been created with the carrier (InPost, Nova Poshta, etc.) and a tracking
number assigned, the order object includes a `shipments` array:

```json
{
  "uid": "order-123",
  "number": "1-42",
  "items": [ ... ],
  "boxes": [ ... ],
  "shipments": [
    {
      "uid": "ship-789",
      "carrier_uid": "carrier-novaposhta",
      "carrier_name": "Nova Poshta",
      "tracking_number": "20450123456789",
      "tracking_url": "https://novaposhta.ua/tracking/?cargo_number=20450123456789",
      "status": "in_transit",
      "status_description": "Parcel is on its way to the recipient's city",
      "shipped_at": "2026-06-25T10:00:00Z"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Shipment UID |
| `carrier_uid` | string | UID of the carrier the shipment was booked with |
| `carrier_name` | string | Human-readable carrier name (e.g. `Nova Poshta`, `InPost`). For **manual** carriers this is the courier name typed by the Comex operator when creating the shipment, not the name of the carrier configuration |
| `tracking_number` | string | Carrier tracking number / waybill (TTN). Always present in this projection |
| `tracking_url` | string | Carrier tracking page URL (omitted if the carrier provides none) |
| `status` | string | Shipment status: `created`, `picked_up`, `in_transit`, `delivered`, `returned`, `cancelled`, `error` — see [Shipment Statuses](#shipment-statuses) |
| `status_description` | string | Carrier's human-readable reason for the current status (e.g. `Undelivered`, `Delivery failed, recipient not found`). Written by the background tracking sync from the carrier's own state text, so it is absent on a freshly created shipment and until the first tracking poll returns a state. This is what makes an `error` status actionable |
| `shipped_at` | string | RFC 3339 timestamp the shipment was dispatched (omitted if not yet shipped) |

#### Shipment Statuses

| Status | Meaning |
|--------|---------|
| `created` | Booked with the carrier, tracking number assigned, not yet picked up |
| `picked_up` | Collected by the carrier |
| `in_transit` | Moving through the carrier network |
| `delivered` | Delivered to the recipient (final) |
| `returned` | Returned to sender (final) |
| `cancelled` | Shipment cancelled (final) |
| `error` | The carrier reported a problem — e.g. undelivered, recipient not found, parcel oversized, complaint opened. **Requires human attention.** Read `status_description` for the carrier's reason |

An internal `pending` status also exists (shipment recorded, carrier has not yet
returned a tracking number), but it is **never** visible to the ERP: shipments
without a tracking number are not surfaced at all.

**Handle `error` explicitly.** It is not a transient creation failure — carrier
tracking events map onto it *after* a tracking number exists (InPost
`undelivered` / `not_delivered` / `oversized` / `claimed`; Nova Poshta "not
found" / "delivery failed, recipient not found"). An ERP that only switches on
the happy-path statuses will silently ignore exactly the deliveries that went
wrong.

**Behaviour notes:**
- The `shipments` field is **omitted entirely** until a shipment with a tracking
  number exists. An order with no shipment, or whose shipment is still `pending`
  (no tracking number yet), returns no `shipments` key — only shipments that
  already have a tracking number are surfaced.
- **Only `/order/batch` and `/order/find/status` carry shipments.** The other
  order read paths — `/order/find/client`, `GET /order`, and `/crm/board/orders`
  — return orders **without** a `shipments` key even after dispatch. In
  particular the CRM board (step 1 of the ERP loop) never shows tracking data;
  re-read the order by UID to get it.
- **Poll model:** the tracking number does not exist when the ERP sends packing
  data via `/order/edit/{uid}` — a Comex operator first creates the shipment,
  then the carrier assigns the number. The ERP must re-read the order
  (`/order/batch` or `/order/find/status`) after dispatch until `shipments`
  appears.
- An order may have **multiple** shipments (re-tries, split parcels), so the
  field is always an array. Entries are ordered newest first.
- This is a read-only projection: it is never accepted as input and the bulky
  Shipment fields (shipping label, receiver snapshot, package dimensions) are not
  exposed here.

#### Update Order Status

**POST** `/order/status`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "order-123",
      "status": "processing",
      "comment": "Order being prepared"
    }
  ]
}
```

#### Upsert Order Items (Batch)

**POST** `/order/item`

**Request Body:**
```json
{
  "data": [
    {
      "order_uid": "order-123",
      "product_uid": "prod-456",
      "quantity": 2,
      "price": 1000
    }
  ]
}
```

#### Delete Order Items Batch

**POST** `/order/item/delete`

**Request Body:**
```json
{
  "data": [
    {"order_uid": "order-123", "product_uid": "prod-456"},
    {"order_uid": "order-123", "product_uid": "prod-789"}
  ]
}
```

#### Get Batch Order Items

**POST** `/order/items/batch`

**Request Body:**
```json
{
  "data": ["order-123", "order-456"]
}
```

#### Get Order History Batch

**POST** `/order/history`

Retrieve order history (status changes) for multiple orders.

**Request Body:**
```json
{
  "data": ["order-123", "order-456"]
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "order-123": [
      {"order_uid": "order-123", "status": "draft", "changed_at": "2025-01-15T10:00:00Z"},
      {"order_uid": "order-123", "status": "new", "changed_at": "2025-01-15T11:00:00Z"}
    ]
  }
}
```

#### ERP Order Edit

**POST** `/order/edit/{uid}`

Edit an order's items and/or packaging boxes from an ERP system. The payload is a single typed array under `data`; each element carries a `type` discriminator (`"item"`, `"box"`, `"company"`, `"erp_number"`, `"internal_comment"` or `"user"`). The backend recalculates all prices, discounts, VAT, and totals — ERP does not send prices.

**Item elements** (`type: "item"`, replace-all semantics, applied only when at least one is present):
- Items with `quantity > 0` are kept or added to the order
- Items with `quantity = 0` are removed from the order
- Items not in the request are removed (replace-all)
- If item elements are provided but every entry has `quantity = 0`, the request is rejected unless no box elements are present — in which case the items branch is skipped and only boxes are applied
- Each item element may carry an optional `weight_g` (unit weight in **grams**), stored as a per-order snapshot and used for shipment customs and weight-based box distribution. When omitted it falls back to the product catalogue's `weight_g`. **Change-detection caveat:** whether the items branch runs is decided by `product_uid` + `quantity` only; a `weight_g`-only change on otherwise-identical lines does not re-trigger persistence — pair it with an item/quantity change, or set the weight on the product catalogue via the Upsert Products endpoint

**Box elements** (`type: "box"`, full-replacement semantics, applied only when at least one is present):
- The supplied box elements overwrite all existing boxes for the order
- Only physical attributes (dimensions, weight) are accepted — monetary fields are never sourced from the ERP
- `box_number` is assigned sequentially by the backend (1..N, in the order supplied)

**User element** (`type: "user"`, at most one per request, optional):
- Names the ERP-side operator behind the change. That user exists only in the ERP's scope and has no Comex account, so the name is stored verbatim as `external_user` on every status-history record the request produces (item edits and box updates) and shown in the order's status history in place of a Comex user name
- It only labels the change — a request carrying nothing but a user element is rejected

**ERP number element** (`type: "erp_number"`, at most one per request, optional):
- Records the document number the ERP assigned to the order once it processed it. Comex stores and displays it verbatim next to its own order number, and the admin order list search matches on it
- **This endpoint is the only way the field is ever written.** No admin or client route accepts it, and it is excluded from the full-order update statement, so a subsequent order save cannot overwrite it
- Omitting the element leaves the stored number untouched; sending an explicit `""` clears it (the document was voided or reissued). Those two are deliberately different
- Treated as metadata: it does not set the order's `is_edited` flag. A change is recorded on the status history, attributed to the `user` element when one is present
- Maximum 64 characters
- Applied after the item branch. If items are present in the same request and fail, the request returns an error and the number is not applied — send it on its own if you want it recorded regardless

**Internal comment element** (`type: "internal_comment"`, at most one per request, optional):
- Carries the staff-only warehouse note managers write on the order edit screen (packing and handling instructions). Comex stores it verbatim, shows it to staff only, and returns it as `internal_comment` on every staff/ERP order payload — so the ERP can read it, let its own operators edit it, and send the result back through this element
- Never reaches a client: no storefront or Client API response includes the field
- Omitting the element leaves the stored note untouched; sending an explicit `""` clears it. Those two are deliberately different
- Treated as metadata: it does not set the order's `is_edited` flag. A change is recorded on the status history, attributed to the `user` element when one is present
- Maximum 2000 characters

At least one item, box, company, erp_number or internal_comment element must be provided. The order must be editable (draft, or CRM pipeline stage with `allow_edit: true`).

**Path Parameters:**
- `uid`: (required) string — UID of the order to edit

**Request Body:**
```json
{
  "data": [
    {"type": "item", "product_uid": "prod-1", "quantity": 5, "weight_g": 1500},
    {"type": "item", "product_uid": "prod-2", "quantity": 0},
    {"type": "item", "product_uid": "prod-3", "quantity": 10},
    {"type": "box", "length_cm": 40, "width_cm": 30, "height_cm": 20, "weight_kg": 2.5},
    {"type": "box", "length_cm": 60, "width_cm": 40, "height_cm": 30, "weight_kg": 7.8},
    {"type": "erp_number", "number": "РН-00012345"},
    {"type": "internal_comment", "comment": "Pack in two boxes, fragile"},
    {"type": "user", "name": "Богдана Бакланова"}
  ]
}
```

**Backward compatibility:** an array whose elements omit `type` is treated as items-only (the original ERP edit shape, before boxes were introduced).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `data` | array | Yes | Typed elements describing items and/or boxes |
| `data[].type` | string | Yes (recommended) | `"item"`, `"box"`, `"company"`, `"erp_number"`, `"internal_comment"` or `"user"`. Omitted → treated as `"item"` (legacy) |
| `data[].product_uid` | string | item only | Product UID |
| `data[].quantity` | int | item only | Quantity (0 = remove, >0 = keep/add) |
| `data[].weight_g` | int | item, optional | Unit weight in grams (≥ 0). Per-order snapshot; falls back to the product catalogue weight when omitted |
| `data[].length_cm` | int | box only | Length in centimetres (> 0) |
| `data[].width_cm` | int | box only | Width in centimetres (> 0) |
| `data[].height_cm` | int | box only | Height in centimetres (> 0) |
| `data[].weight_kg` | float | box only | Weight in kilograms (> 0) |
| `data[].number` | string | erp_number only | ERP-assigned document number (max 64 chars). `""` clears it; omitting the element leaves it untouched |
| `data[].comment` | string | internal_comment only | Staff-only warehouse note (max 2000 chars). `""` clears it; omitting the element leaves it untouched |
| `data[].name` | string | user only | ERP-side operator name (max 255 chars), recorded on the status history as `external_user` |

**Atomicity note:** Items and boxes are applied in two independent transactions. If items succeed and boxes fail (after retries), the order ends with new items and stale boxes until the ERP resends. Item updates are idempotent and boxes use full-replacement, so retrying the same payload converges to the correct state.

**Response:**
```json
{
  "status": "success",
  "data": {
    "uid": "order-123",
    "number": "1-42",
    "client_uid": "client-1",
    "status": "new",
    "total": 26500,
    "subtotal": 20000,
    "total_vat": 5000,
    "vat_rate": 20,
    "discount_percent": 10,
    "original_total": 22222,
    "discount_amount": 2222,
    "delivery_cost": 1500,
    "items": [
      {
        "order_uid": "order-123",
        "product_uid": "prod-1",
        "quantity": 5,
        "price": 5000,
        "discount": 10,
        "price_discount": 4500,
        "tax": 4500,
        "total": 27000,
        "weight_g": 1500
      },
      {
        "order_uid": "order-123",
        "product_uid": "prod-3",
        "quantity": 10,
        "price": 2000,
        "discount": 10,
        "price_discount": 1800,
        "tax": 3600,
        "total": 21600,
        "weight_g": 0
      }
    ],
    "boxes": [
      {
        "order_uid": "order-123",
        "box_number": 1,
        "length_cm": 40,
        "width_cm": 30,
        "height_cm": 20,
        "weight_kg": 2.5,
        "last_update": "2026-04-22T17:57:00Z"
      },
      {
        "order_uid": "order-123",
        "box_number": 2,
        "length_cm": 60,
        "width_cm": 40,
        "height_cm": 30,
        "weight_kg": 7.8,
        "last_update": "2026-04-22T17:57:00Z"
      }
    ]
  },
  "message": "Order edited successfully",
  "request_id": "req-abc123"
}
```

**What happens:**
- All monetary fields are recalculated from the prices table
- The order's existing `delivery_cost` (cents) is preserved and re-added into `total`; the ERP never sends it, and it is omitted from the response when zero
- Order status history records "Order edited", attributed to the `user` element's name when one was sent
- Change record is created for CRM synchronization
- CRM activity timeline logs item changes
- Telegram notification sent (if configured)

**Error Responses:**
- `400` - Validation error (no items, all items have quantity 0, invalid product UID)
- `404` - Order not found
- `403` - Order editing not allowed at current pipeline stage
- `500` - Price not found for product, calculation error

---

## Store

#### Store Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | No | Unique identifier (auto-generated if not provided) |
| `name` | string | Yes | Store display name |
| `active` | bool | No | Whether store is active |
| `default_vat_rate` | float | No | Default VAT rate percentage (0-100) |
| `country_code` | string | No | Store country (ISO code, max 5 characters) |
| `order_prefix` | string | No | Store part of composed order numbers (`<prefix>-<orderID>`), so different portals can upload orders into one ERP base. Latin letters and digits only, max 10 characters. Omitting the field keeps the stored value; an explicit `""` clears it. When unset, the store's numeric database ID is used |
| `use_certification_filter` | bool | No | Restrict the catalog and order confirmation to products marked available for at least one of the client's [certification countries](#client-certification-countries) (see [Product Country Availability](#product-country-availability)). Defaults to `false` on new stores. **Omitting the field keeps the stored value** — an ERP sync that does not manage this setting will not switch it off. The admin UI refuses to switch it *on* while no availability rows exist (see [Count Availability Rows](#count-availability-rows)); the API itself has no such restriction |

#### Store Inventory Fields

**Composite Key:** `(store_uid, product_uid)`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `store_uid` | string | Yes | Store this inventory belongs to |
| `product_uid` | string | Yes | Product this inventory tracks |
| `quantity` | int | Yes | Stock quantity (must be >= 0) |

#### Multi-Store Inventory System

- Each store maintains its own inventory for all products
- Each client is permanently assigned to a specific store
- Orders allocate inventory from the client's assigned store only
- Available quantity = `store_inventory.quantity - SUM(allocations)`

#### Upsert Stores (Create or Update)

**POST** `/store`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "store-123",
      "name": "Main Warehouse",
      "active": true,
      "default_vat_rate": 20,
      "country_code": "UA",
      "order_prefix": "MW",
      "use_certification_filter": true
    }
  ]
}
```

#### Delete Stores Batch

**POST** `/store/delete`

**Request Body:**
```json
{
  "data": ["store-123", "store-456"]
}
```

#### Update Store Active Status (Batch)

**POST** `/store/active`

**Request Body:**
```json
{
  "data": [
    {"uid": "store-123", "active": false},
    {"uid": "store-456", "active": true}
  ]
}
```

#### List Stores

**GET** `/store`

**Query Parameters:**
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100

#### Get Stores Batch

**POST** `/store/get`

**Request Body:**
```json
{
  "data": ["store-uid-1", "store-uid-2"]
}
```

#### Upsert Store Inventory (Batch)

**POST** `/store/inventory`

**Request Body:**
```json
{
  "data": [
    {
      "store_uid": "store-uid-1",
      "product_uid": "prod-1",
      "quantity": 100
    },
    {
      "store_uid": "store-uid-1",
      "product_uid": "prod-2",
      "quantity": 50
    }
  ]
}
```

#### Delete Store Inventory Batch

**POST** `/store/inventory/delete`

**Request Body:**
```json
{
  "data": [
    {"store_uid": "store-uid-1", "product_uid": "prod-1"},
    {"store_uid": "store-uid-1", "product_uid": "prod-2"}
  ]
}
```

#### Get Inventory by Store-Products (Nested Batch)

**POST** `/store/inventory/get`

**Request Body:**
```json
{
  "data": [
    {
      "store_uid": "store-uid-1",
      "product_uids": ["prod-1", "prod-2"]
    }
  ]
}
```

**Response:** Map of store UID to array of inventory items.

#### Get Inventory by Products Batch

**POST** `/store/inventory/find/product`

**Request Body:**
```json
{
  "data": ["product-uid-1", "product-uid-2"]
}
```

**Response:** Map of product UID to array of inventory items across all stores.

#### Get Inventory by Store-Product Pairs Batch

**POST** `/store/inventory/find/store-product`

**Request Body:**
```json
{
  "data": [
    {"store_uid": "store-uid-1", "product_uid": "prod-1"},
    {"store_uid": "store-uid-2", "product_uid": "prod-2"}
  ]
}
```

#### Get Available Quantity Batch (Nested Batch)

**POST** `/store/inventory/available`

Get available quantities (after allocations) for multiple store-product pairs.

**Request Body:**
```json
{
  "data": [
    {
      "store_uid": "store-uid-1",
      "product_uids": ["prod-1", "prod-2"]
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "store-uid-1": {
      "prod-1": 85,
      "prod-2": 45
    }
  }
}
```

---

## Price Type

Price types define different pricing schemes for products. Each price type is associated with a specific currency.

#### Price Type Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Unique identifier |
| `name` | string | Yes | Price type display name (e.g., "Retail", "Wholesale") |
| `currency_code` | string | Yes | Currency code for this price type |

#### Upsert Price Types (Create or Update)

**POST** `/price_type`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "retail-price-usd",
      "name": "Retail USD",
      "currency_code": "USD"
    },
    {
      "uid": "wholesale-price-eur",
      "name": "Wholesale EUR",
      "currency_code": "EUR"
    }
  ]
}
```

#### Delete Price Types Batch

**POST** `/price_type/delete`

**Request Body:**
```json
{
  "data": ["retail-price-usd", "wholesale-price-eur"]
}
```

#### List Price Types

**GET** `/price_type`

**Query Parameters:**
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100

#### Get Price Types Batch

**POST** `/price_type/batch`

**Request Body:**
```json
{
  "data": ["retail-price-usd", "wholesale-price-usd"]
}
```

#### Find Price Types by Currency Codes Batch

**POST** `/price_type/find/currency`

**Request Body:**
```json
{
  "data": ["USD", "EUR"]
}
```

---

## Currency

#### Currency Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Currency code (primary key, e.g., "USD", "EUR") |
| `name` | string | Yes | Currency display name (e.g., "US Dollar") |
| `sign` | string | No | Currency symbol (e.g., "$", "€") |
| `rate` | float | Yes | Exchange rate (must be > 0) |

**Note:** Currency uses `code` as the primary key instead of `uid`.

#### Upsert Currencies (Create or Update)

**POST** `/currency`

**Request Body:**
```json
{
  "data": [
    {
      "code": "USD",
      "name": "US Dollar",
      "sign": "$",
      "rate": 1.0
    },
    {
      "code": "EUR",
      "name": "Euro",
      "sign": "€",
      "rate": 0.92
    }
  ]
}
```

#### Delete Currencies Batch

**POST** `/currency/delete`

**Request Body:**
```json
{
  "data": ["USD", "EUR"]
}
```

#### List Currencies

**GET** `/currency`

**Query Parameters:**
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100

#### Get Currencies Batch

**POST** `/currency/batch`

**Request Body:**
```json
{
  "data": ["USD", "EUR"]
}
```

#### Get Currency Names Batch

**POST** `/currency/names`

Lightweight endpoint for displaying currency labels.

**Request Body:**
```json
{
  "data": ["USD", "EUR", "GBP"]
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "USD": "US Dollar",
    "EUR": "Euro",
    "GBP": "British Pound"
  }
}
```

#### Get Currency for Client

**POST** `/currency/names/client`

Get the currency name associated with a client (via their price type).

**Request Body:**
```json
{
  "data": ["client-123", "client-456"]
}
```

---

## Order Status

Order statuses provide localized names for order status codes.

**Composite Key:** `(status, language)`

#### Order Status Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | Status code (e.g., `draft`, `new`, `processing`, `confirmed`, `cancelled`) |
| `language` | string | Yes | Language code (e.g., "en", "uk") |
| `name` | string | Yes | Localized display name for this status |

#### Upsert Order Statuses (Create or Update)

**POST** `/order_status`

**Request Body:**
```json
{
  "data": [
    {"status": "new", "language": "en", "name": "New"},
    {"status": "new", "language": "uk", "name": "Новий"},
    {"status": "processing", "language": "en", "name": "Processing"}
  ]
}
```

#### Delete Order Statuses Batch

**POST** `/order_status/delete`

**Request Body:**
```json
{
  "data": [
    {"status": "cancelled", "language": "en"},
    {"status": "cancelled", "language": "uk"}
  ]
}
```

#### List Order Statuses

**GET** `/order_status`

**Query Parameters:**
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100

#### Get Order Statuses Batch

**POST** `/order_status/batch`

**Request Body:**
```json
{
  "data": [
    {"status": "new", "language_code": "en"},
    {"status": "processing", "language_code": "es"}
  ]
}
```

---

## Country

Countries store VAT rate configurations.

#### Country Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `country_code` | string | Yes | ISO 3166-1 alpha-2 code (max 5 chars) - primary key |
| `name` | string | Yes | Country name |
| `vat_rate` | float | No | VAT rate percentage (0-100) |
| `uid` | string | No | Alternative identifier for external systems |

#### List Countries

**GET** `/country`

**Query Parameters:**
- `page`: (optional) integer, default 1
- `count`: (optional) integer, default 100

#### Get Countries Batch

**POST** `/country/batch`

**Request Body:**
```json
{
  "data": ["UA", "PL", "DE"]
}
```

#### Upsert Countries

**POST** `/country`

**Request Body:**
```json
{
  "data": [
    {
      "country_code": "UA",
      "name": "Ukraine",
      "vat_rate": 20,
      "uid": "country-ua"
    }
  ]
}
```

#### Delete Countries Batch

**POST** `/country/delete`

**Request Body:**
```json
{
  "data": ["UA", "PL"]
}
```

---

## Client Address

Client addresses store a client's address book. Each address carries two independent flags:
`is_default` marks the default **delivery** address, and `is_official` marks the client's
**official/invoicing** address (the source of the `billing_*` fields in the outgoing
[invoice payload](./invoice-request.md#6-official-invoicing-address-billing-fields)). An
address may be both, either, or neither.

#### Client Address Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Unique identifier |
| `client_uid` | string | Yes | Client this address belongs to |
| `branch_uid` | string | No | [Branch](#client-branch) this address belongs to. Empty means the address belongs to the client directly. The branch must belong to the same client — an upsert naming another client's branch is rejected |
| `country_code` | string | Yes | Country (must exist in countries table, max 5 chars) |
| `zipcode` | string | No | Postal/ZIP code |
| `city` | string | No | City name |
| `address_text` | string | No | Full address text |
| `is_default` | bool | No | Mark as the default **delivery** address for the client |
| `is_official` | bool | No | Mark as the **official/invoicing** address for the client (feeds the invoice `billing_*` fields) |

At most one address per client may be `is_default`, and at most one may be `is_official`.
When an upsert sets `is_official: true`, the backend transactionally clears `is_official`
on the client's other addresses (single-official-per-client is enforced server-side).

> **ERP integrators — flag preservation.** `is_default` and `is_official` are plain booleans
> on the upsert. An omitted flag is decoded as `false` and the row is fully overwritten, so a
> sync that upserts an address **without** these fields will clear whichever flag was set.
> When pushing address updates from the ERP, always send the current `is_default` and
> `is_official` values (or avoid upserting addresses whose flags are managed in the admin UI).
>
> **`branch_uid` behaves differently — and safely.** It is the one field on this payload
> that preserves rather than overwrites: omit the key (or send `null`) and the stored branch
> link is kept untouched. Send `""` to explicitly unlink. An ERP address sync that knows
> nothing about branches therefore cannot unlink them by accident.

#### List Client Addresses

**GET** `/client_address`

**Query Parameters:**
- `page`: (optional) integer, default 1
- `count`: (optional) integer, default 100

#### Get Client Addresses Batch

**POST** `/client_address/batch`

**Request Body:**
```json
{
  "data": ["addr-001", "addr-002"]
}
```

#### Find Client Addresses by Client UIDs

**POST** `/client_address/find/client`

**Request Body:**
```json
{
  "data": ["client-123", "client-456"]
}
```

**Response:** Map of client UID to array of addresses.

#### Upsert Client Addresses

**POST** `/client_address`

**Request Body:**
```json
{
  "data": [
    {
      "uid": "addr-001",
      "client_uid": "client-123",
      "country_code": "UA",
      "zipcode": "01001",
      "city": "Kyiv",
      "address_text": "123 Main Street, Office 5",
      "is_default": true,
      "is_official": false
    }
  ]
}
```

Setting `is_official: true` here also makes this the client's official/invoicing address and
clears the flag on the client's other addresses. Self-service clients and the admin UI can
also set it via the dedicated endpoints (see
[frontend/self-service](./frontend-api.md), `PUT /frontend/profile/addresses/{uid}/official`).

#### Delete Client Addresses Batch

**POST** `/client_address/delete`

**Request Body:**
```json
{
  "data": ["addr-001", "addr-002"]
}
```

---

## Changes

Change records track modifications to entities for CRM synchronization. When clients, orders, or client addresses are created or updated, a change record is automatically created. External CRM systems can poll for pending changes and confirm when they've been processed.

**Draft orders are not reported.** An unconfirmed order is a cart — it has not entered the CRM pipeline and is of no interest to the ERP, so no `order` change is returned while `draft` is true. The order first appears in the feed when it is confirmed, and every later modification is reported as usual.

#### Change Record Fields

| Field | Type | Description |
|-------|------|-------------|
| `uid` | string | Unique identifier for this change record |
| `object_name` | string | Type of object: `"order"`, `"client"`, `"client_address"` |
| `object_uid` | string | UID of the changed object |
| `created_at` | timestamp | When the change was recorded |

#### Get Pending Changes

**GET** `/changes`

Returns a list of pending changes that need to be synchronized with external systems.

**Query Parameters:**
- `limit`: (optional) integer, default 100, max 1000

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "uid": "change-001",
      "object_name": "client",
      "object_uid": "client-123",
      "created_at": "2025-01-15T10:30:00Z"
    },
    {
      "uid": "change-002",
      "object_name": "order",
      "object_uid": "order-456",
      "created_at": "2025-01-15T10:35:00Z"
    }
  ]
}
```

#### Confirm Changes

**POST** `/changes/confirm`

Confirms that changes have been processed by the CRM. This deletes the change records so they won't be returned again.

**Request Body:**
```json
{
  "data": ["change-001", "change-002", "change-003"]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Changes confirmed successfully"
}
```

#### Synchronization Workflow

1. CRM polls `GET /changes?limit=100` periodically
2. CRM processes each change (fetches updated entity data)
3. CRM calls `POST /changes/confirm` with processed change UIDs
4. Change records are deleted, won't appear in future polls

---

## Cleanup

#### Delete Records Older Than a Specific Date

**POST** `/cleanup`

**Request Body:**
```json
{
  "date": "2023-01-01T00:00:00Z"
}
```

---

## Product Images

Product images are stored as Base64 encoded strings.

#### Product Image Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_uid` | string | Yes | Product this image belongs to |
| `file_data` | string | Yes | Base64 encoded image data |
| `is_main` | bool | No | Mark as main/primary image (default: false) |
| `sort_order` | int | No | Display order (default: 0) |

**Composite Key:** `(product_uid, sort_order)`

#### Get Product Images

**GET** `/product/image/{productUID}`

Returns all images for a product, ordered by `sort_order`.

#### Upsert Product Images (Batch)

**POST** `/product/image`

**Request Body:**
```json
{
  "data": [
    {
      "product_uid": "prod-123",
      "file_data": "data:image/png;base64,iVBORw0KGgo...",
      "is_main": true,
      "sort_order": 0
    }
  ]
}
```

#### Get Main Images Batch

**POST** `/product/image/batch`

Returns only images where `is_main = true`.

**Request Body:**
```json
{
  "data": ["prod-123", "prod-456"]
}
```

**Response:** Map of product UID to main image.

#### Delete Product Images (Batch)

**POST** `/product/image/delete`

**Request Body (specific image):**
```json
{
  "data": [
    {"product_uid": "prod-123", "sort_order": 1}
  ]
}
```

**Request Body (all images for product):**
```json
{
  "data": [
    {"product_uid": "prod-123"}
  ]
}
```

---

## Discount Scale

Discount scales define tiered discounts based on client purchase turnover.

#### Discount Scale Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `store_uid` | string | Yes | Store this scale belongs to |
| `sum_purchase` | int | Yes | Turnover threshold in cents (0 = base tier) |
| `discount` | int | Yes | Discount percentage (0-100) for this tier |
| `currency_code` | string | Yes | Currency for the threshold |

**Composite Key:** `(store_uid, sum_purchase, currency_code)`

#### How Scale-Based Discounts Work

1. Client has `fixed_discount: false` and `balance: 75000`
2. System finds discount scales for client's store and currency
3. Finds highest `sum_purchase` threshold <= client's balance
4. Returns that tier's discount percentage

**Example Scale:**
| sum_purchase | discount | Description |
|--------------|----------|-------------|
| 0 | 0 | Base tier (no discount) |
| 10000 | 5 | 5% discount for 100+ purchases |
| 50000 | 10 | 10% discount for 500+ purchases |

#### Get Discount Scales by Store

**GET** `/discount_scale`

**Query Parameters:**
- `store_uid`: (required) string
- `currency_code`: (optional) string

#### Upsert Discount Scales

**POST** `/discount_scale`

**Request Body:**
```json
{
  "data": [
    {
      "store_uid": "store-123",
      "sum_purchase": 0,
      "discount": 0,
      "currency_code": "USD"
    },
    {
      "store_uid": "store-123",
      "sum_purchase": 10000,
      "discount": 5,
      "currency_code": "USD"
    }
  ]
}
```

#### Delete Discount Scale Entry

**POST** `/discount_scale/delete`

**Request Body:**
```json
{
  "store_uid": "store-123",
  "sum_purchase": 10000,
  "currency_code": "USD"
}
```

#### Delete All Discount Scales for Store

**DELETE** `/discount_scale/store`

**Query Parameters:**
- `store_uid`: (required) string

---

## Product Discount Limits

Product discount limits allow capping the maximum discount percentage for specific products per store. When a client's discount exceeds the product limit, the lower product limit is applied.

#### Product Discount Limit Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `store_uid` | string | Yes | Store this limit applies to |
| `product_uid` | string | Yes | Product this limit applies to |
| `percent` | int | Yes | Maximum discount percentage allowed (0-100) |
| `last_update` | timestamp | No | Last modification timestamp (auto-set) |

**Composite Key:** `(store_uid, product_uid)`

#### How Product Discount Limits Work

1. Client has a discount of 15%
2. Product has a limit of 10% for the client's store
3. When calculating prices, the effective discount is capped at 10%
4. If no limit exists for a product, the full client discount applies

**Example:**
| Client Discount | Product Limit | Effective Discount |
|-----------------|---------------|-------------------|
| 15% | 10% | 10% (capped) |
| 5% | 10% | 5% (no cap needed) |
| 20% | 0% | 0% (no discount allowed) |
| 10% | (none) | 10% (full discount) |

#### Get Product Discount Limits by Store

**GET** `/product_discount_limit`

> Also available at `/admin/product_discount_limits` for admin users.

**Query Parameters:**
- `store_uid`: (required) string

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "store_uid": "store-123",
      "product_uid": "prod-456",
      "percent": 10,
      "last_update": "2025-01-15T10:00:00Z"
    },
    {
      "store_uid": "store-123",
      "product_uid": "prod-789",
      "percent": 5,
      "last_update": "2025-01-15T10:00:00Z"
    }
  ]
}
```

#### Upsert Product Discount Limits (Batch)

**POST** `/product_discount_limit`

> Also available at `/admin/product_discount_limits` for admin users.

Create or update product discount limits. This is the primary endpoint for CRM synchronization.

**Request Body:**
```json
{
  "data": [
    {
      "store_uid": "store-123",
      "product_uid": "prod-456",
      "percent": 10
    },
    {
      "store_uid": "store-123",
      "product_uid": "prod-789",
      "percent": 5
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Product discount limits upserted successfully",
  "data": 2
}
```

#### Delete Product Discount Limit

**POST** `/product_discount_limit/delete`

> Also available at `/admin/product_discount_limits/delete` for admin users.

**Request Body:**
```json
{
  "data": {
    "store_uid": "store-123",
    "product_uid": "prod-456"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "data": "Product discount limit deleted successfully"
}
```

#### Integration with Frontend Products API

When clients view products via the frontend API (`GET /frontend/products`), the backend automatically:

1. Fetches product discount limits for the client's store
2. Compares client discount with product limit
3. Applies the lower value as the effective discount
4. Returns `discount_percent` in the response (the actual discount applied)

The frontend displays this as a badge (e.g., "-10%") next to the product price.

---

## Product Country Availability

Per-country sales permission for a product, driven by product certification. A
row answers two independent questions: may this product be shipped to this
country (`is_available`), and does it hold a certificate there (`is_certified`).

They are independent on purpose — a country may not require a certificate for a
given product, so the product is available there without being certified. **Only
`is_available` gates what a client can see and order**; `is_certified` is
informational and is shown in the product details and in the admin product list.

#### Product Country Availability Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_uid` | string | Yes | Product this row applies to |
| `country_code` | string | No | ISO 3166-1 alpha-2 destination country, max 5 characters. **An empty value means "any country"**: the product needs no certification anywhere. Codes are trimmed and upper-cased on write |
| `is_available` | bool | No | Product may be sold into this country |
| `is_certified` | bool | No | Product holds a certificate for this country |
| `last_update` | timestamp | No | Last modification timestamp (auto-set) |

**Composite Key:** `(product_uid, country_code)`

#### How the Filter Works

The filter is off unless a store sets `use_certification_filter` (see
[Store](#store)). When it is on:

1. The destinations are the client's
   [certification countries](#client-certification-countries) — the ERP-owned
   list of countries that client sells into. **The delivery address is not
   used**: a client may take delivery in one country and resell the goods into
   others, so only the final destinations may decide what it can be offered. The
   same list is used for the catalog and for order confirmation, so confirmation
   cannot reject a line the catalog legitimately showed.
2. A product is shown/orderable when it has at least one row with
   `is_available = true` whose `country_code` is either empty (any country) or
   **any one** of the client's certification countries. One certified
   destination is enough — the client simply resells that product only there.
3. **A product with no rows at all is not sellable.** This is deliberate: a store
   that switches the filter on before the ERP has pushed its data sees an empty
   catalog rather than silently shipping uncertified goods.
4. When the destinations are unknown — the ERP has pushed no certification
   countries for the client, or a staff user is previewing the catalog — only
   any-country products are shown.

The gate applies to the catalog listing, the category dropdown, the catalog
export/import, cart re-validation on login, and order confirmation. An order the
ERP pushes through `POST /order` is **not** gated: the ERP is authoritative for
its own orders.

Blocked lines surface as an order problem with reason `not_available`, alongside
the existing `inactive`, `not_found`, `no_price` and `insufficient_stock`.

**Example:**
| Rows for the product | Client's certification countries | Result |
|---|---|---|
| `("", available)` | any | Shown |
| `("PL", available, certified)` | `["PL"]` | Shown |
| `("PL", available, certified)` | `["DE"]` | Hidden |
| `("PL", available, certified)` | `["DE", "PL"]` | Shown — one match is enough |
| `("UA", available, not certified)` | `["UA"]` | Shown — UA needs no certificate |
| `("DE", not available)` | `["DE"]` | Hidden |
| *(no rows)* | any | Hidden |

#### Get Availability for Products (Batch)

**POST** `/product_country_availability/batch`

> Also available read-only at `/admin/product_country_availability/batch`.

**Request Body:**
```json
{
  "data": ["prod-456", "prod-789"]
}
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "product_uid": "prod-456",
      "country_code": "",
      "is_available": true,
      "is_certified": true,
      "last_update": "2026-07-31T10:00:00Z"
    },
    {
      "product_uid": "prod-789",
      "country_code": "PL",
      "is_available": true,
      "is_certified": true,
      "last_update": "2026-07-31T10:00:00Z"
    }
  ]
}
```

#### List Availability by Country

**GET** `/product_country_availability`

> Also available read-only at `/admin/product_country_availability`.

**Query Parameters:**
- `country_code`: (optional) string — omit or leave empty to list the
  any-country rows
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100

#### Count Availability Rows

**GET** `/product_country_availability/count`

> Also available read-only at `/admin/product_country_availability/count`.

**Response:**
```json
{
  "status": "success",
  "data": { "total": 1420 }
}
```

The admin store settings page reads this to decide whether the
`use_certification_filter` toggle can be switched **on**: while the total is `0`
there is nothing to filter against, so enabling it would hide every product.
Switching the flag **off** is never blocked, so a store whose data was wiped can
always recover. Note this is a UI guard only — the API still accepts
`use_certification_filter: true` at any time, so an ERP may set the flag in the
same sync run that loads the rows.

#### Upsert Availability (Batch)

**POST** `/product_country_availability`

Creates or updates the rows in the payload and leaves every other row untouched.

**Request Body:**
```json
{
  "data": [
    {"product_uid": "prod-456", "country_code": "", "is_available": true, "is_certified": true},
    {"product_uid": "prod-789", "country_code": "PL", "is_available": true, "is_certified": true},
    {"product_uid": "prod-789", "country_code": "UA", "is_available": true, "is_certified": false}
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Product country availability upserted successfully",
  "data": 3
}
```

#### Sync Availability (Full Replace per Product)

**POST** `/product_country_availability/sync`

Same body as the upsert, but every row of each product **mentioned in the
payload** is deleted first. Use this when sending a product's complete list:
a plain upsert cannot express a *revoked* certification, because the stale row
would simply survive. Products absent from the payload are untouched.

#### Delete a Single Row

**POST** `/product_country_availability/delete`

**Request Body:**
```json
{
  "data": {
    "product_uid": "prod-456",
    "country_code": "PL"
  }
}
```

#### Delete All Rows of Products (Batch)

**POST** `/product_country_availability/delete/products`

Drops every availability row of the given products. With the store filter on,
those products stop being sellable anywhere until new rows arrive.

**Request Body:**
```json
{
  "data": ["prod-456", "prod-789"]
}
```

#### Integration with Frontend Products API

`GET /frontend/products` applies the gate to the returned page (and to its
pagination totals) and adds two informational fields per product:

| Field | Type | Description |
|-------|------|-------------|
| `certified_countries` | string[] | ISO codes the product is certified for |
| `certified_any_country` | bool | True when the product needs no country-specific certificate |

The admin listing `GET /admin/products` returns the raw rows as
`country_availability`, which the admin UI renders as a badge opening the country
list. The admin zone is read-only for this data — only the ERP writes it.

---

## Client Certification Countries

The countries a client sells into. This collection — not the delivery address —
is what the certification gate is evaluated against, because a client may take
delivery in one country and resell the goods into several others; what has to be
certified is the **final destination**.

The ERP owns the list and pushes it per client. It is read-only in the admin
zone.

#### Client Certification Country Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `client_uid` | string | Yes | Client this row applies to |
| `country_code` | string | Yes | ISO 3166-1 alpha-2 destination country, max 5 characters. Trimmed and upper-cased on write, so it matches `product_country_availability.country_code` |
| `last_update` | timestamp | No | Last modification timestamp (auto-set) |

**Composite Key:** `(client_uid, country_code)`

An empty `country_code` is rejected: "any country" is a property of a product's
availability row, not of a client's destination list. A client with **no rows**
counts as having unknown destinations, so with the store filter on it is offered
only any-country products.

#### Get Certification Countries for Clients (Batch)

**POST** `/client_certification_countries/batch`

> Also available read-only at `/admin/client_certification_countries/batch`.

**Request Body:**
```json
{
  "data": ["client-123", "client-456"]
}
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {"client_uid": "client-123", "country_code": "PL", "last_update": "2026-08-04T10:00:00Z"},
    {"client_uid": "client-123", "country_code": "UA", "last_update": "2026-08-04T10:00:00Z"},
    {"client_uid": "client-456", "country_code": "DE", "last_update": "2026-08-04T10:00:00Z"}
  ]
}
```

#### List Certification Countries

**GET** `/client_certification_countries`

> Also available read-only at `/admin/client_certification_countries`.

**Query Parameters:**
- `country_code`: (optional) string — omit to list every row, or pass a code to
  list the clients selling into that country
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100

#### Count Certification Country Rows

**GET** `/client_certification_countries/count`

> Also available read-only at `/admin/client_certification_countries/count`.

**Response:**
```json
{
  "status": "success",
  "data": { "total": 87 }
}
```

A total of `0` means no client has a declared destination yet, so every store
with `use_certification_filter` on offers only any-country products.

#### Upsert Certification Countries (Batch)

**POST** `/client_certification_countries`

Adds the rows in the payload and leaves every other row untouched.

**Request Body:**
```json
{
  "data": [
    {"client_uid": "client-123", "country_code": "PL"},
    {"client_uid": "client-123", "country_code": "UA"},
    {"client_uid": "client-456", "country_code": "DE"}
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Client certification countries upserted successfully",
  "data": 3
}
```

#### Sync Certification Countries (Full Replace per Client)

**POST** `/client_certification_countries/sync`

Same body as the upsert, but every row of each client **mentioned in the
payload** is deleted first. Use this when sending a client's complete list: a
plain upsert cannot express a country the client stopped selling into, because
the stale row would simply survive and keep uncertified goods visible. Clients
absent from the payload are untouched — clearing a client entirely goes through
the delete endpoint below.

#### Delete a Single Row

**POST** `/client_certification_countries/delete`

**Request Body:**
```json
{
  "data": {
    "client_uid": "client-123",
    "country_code": "PL"
  }
}
```

#### Delete All Rows of Clients (Batch)

**POST** `/client_certification_countries/delete/clients`

Clears the destination list of the given clients. With the store filter on they
fall back to seeing only any-country products — the same state as a client the
ERP never pushed.

**Request Body:**
```json
{
  "data": ["client-123", "client-456"]
}
```

---

## ERP User Upload

Upload manager users from the ERP system in batch format. Users are created with role `"manager"` and a non-matchable password placeholder (`!no_password_set`). They cannot log in until an admin sets a real password via `POST /admin/user`.

#### ERP User Entity Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Unique identifier from ERP system |
| `username` | string | Yes | Login username |
| `first_name` | string | Yes | First name |
| `last_name` | string | Yes | Last name |
| `email` | string | No | Email address (no format validation) |

#### Upsert ERP Users

**POST** `/user`

Creates new users with role `"manager"` and a placeholder password, or updates existing users (preserving their password, store_uid, and price_type_uid).

**Request Body:**
```json
{
  "data": [
    {
      "uid": "erp-mgr-001",
      "username": "john.doe",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com"
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "ERP users upserted successfully",
  "data": ["erp-mgr-001"]
}
```

**Behavior:**
- **New user**: Created with `role="manager"`, `password_hash="!no_password_set"` (cannot log in) and `active=true`
- **Existing user**: Username, first_name, last_name, and email are updated; password, store_uid, price_type_uid and the `active` flag are preserved

#### Sync Active User Roster

**POST** `/user/active`

Sends the ERP's **complete** roster of currently-active staff UIDs. Any manager
missing from the roster is deactivated: they can no longer log in, and their
open sessions are revoked immediately.

**Request Body:**
```json
{
  "data": ["erp-mgr-001", "erp-mgr-002", "erp-mgr-007"]
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Active user roster synced",
  "data": {
    "checked": 12,
    "already_inactive": 3,
    "deactivated": ["erp-mgr-004"]
  }
}
```

| Field | Description |
|-------|-------------|
| `checked` | Number of manager rows examined |
| `already_inactive` | Managers absent from the roster that were already deactivated and left alone |
| `deactivated` | UIDs blocked by this run |

**Scope — read this before wiring the sync up:**
- Only users whose role is **exactly** `"manager"` are in scope — the role this
  API assigns in `POST /user`. Admins, content editors, portal users and
  clients are never touched, so a truncated payload cannot lock the platform's
  own administrators out.
- The sync **only ever deactivates**. Presence in the roster does not
  reactivate a blocked manager: that would let a scheduled sync silently undo
  an admin's manual block. Reactivation is done by an admin in the users page.
- An **empty `data` array is rejected** with `VALIDATION_ERROR`. An empty
  roster is far more likely to be a truncated ERP payload than an instruction
  to block every manager.
- Send the roster in full on every call. Sending a partial list deactivates
  every manager you left out.

**Errors:**

| Status | Code | Cause |
|--------|------|-------|
| 400 | `VALIDATION_ERROR` | `data` is missing, empty, or not an array of strings |
| 500 | `DATABASE_ERROR` | The roster could not be read or a deactivation failed |

---

## CRM Pipeline (ERP Integration)

These endpoints provide ERP systems with read/write access to the CRM pipeline without admin/manager role restrictions. They use standard authentication (API key or JWT token).

For admin CRM endpoints with role-based restrictions, see [admin-api.md](admin-api.md#crm-pipeline).

### ERP Integration Workflow

A typical ERP integration follows this flow:

#### Step 1: Get Orders in a Stage

First, retrieve orders that are in a specific pipeline stage (e.g., "New Orders" stage):

```bash
# Get orders in the "new-orders" stage with pagination
curl -H "Authorization: Bearer {API_KEY}" \
  "https://api.example.com/api/v1/crm/board/orders?stage_uid=new-orders&page=1&count=20"
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "order": {
        "uid": "order-123",
        "number": "ORD-001",
        "client_uid": "client-456",
        "store_uid": "store-789",
        "total": 25999,
        "status": "new"
      },
      "client": {
        "uid": "client-456",
        "name": "ACME Corporation",
        "email": "orders@acme.com"
      },
      "assignment": {
        "user_uid": "user-1",
        "user_name": "John Doe"
      },
      "entered_at": "2024-01-15T10:30:00Z",
      "time_in_stage_seconds": 3600
    }
  ],
  "pagination": {
    "page": 1,
    "count": 20,
    "total": 45
  }
}
```

#### Step 2: Get Full Order Details with Items

Once you have order UIDs, fetch complete order data including line items:

```bash
# Get full order details
curl -X POST -H "Authorization: Bearer {API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"data": ["order-123"]}' \
  "https://api.example.com/api/v1/order/batch"
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "uid": "order-123",
      "number": "ORD-001",
      "client_uid": "client-456",
      "store_uid": "store-789",
      "price_type_uid": "wholesale-usd",
      "currency_code": "USD",
      "status": "new",
      "discount_percent": 10,
      "vat_rate": 20,
      "subtotal": 21665.83,
      "total_vat": 4333.17,
      "delivery_cost": 1500,
      "total": 27499,
      "country_code": "UA",
      "city": "Kyiv",
      "address_text": "123 Business Street",
      "comment": "Urgent delivery requested",
      "created_at": "2024-01-15T10:30:00Z",
      "items": [
        {
          "product_uid": "prod-001",
          "quantity": 5,
          "price": 2000,
          "discount": 10,
          "price_discount": 1800,
          "tax": 1800,
          "total": 10800
        },
        {
          "product_uid": "prod-002",
          "quantity": 3,
          "price": 5000,
          "discount": 10,
          "price_discount": 4500,
          "tax": 2700,
          "total": 16200
        }
      ]
    }
  ]
}
```

All money fields above are in **cents**. `delivery_cost` is the shipping charge Comex added to the order (set by a manager, or taken from the carrier quote when a shipment is created); it is already part of `total`, so do not add it a second time in the ERP. When the order has no delivery cost the key is absent from the response entirely — treat a missing `delivery_cost` as zero. The same applies to the other calculated money fields; see [Order Entity Fields](#order-entity-fields).

#### Step 3: Get Product Details (Optional)

If you need product names/SKUs for the order items:

```bash
# Get product details
curl -X POST -H "Authorization: Bearer {API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"data": ["prod-001", "prod-002"]}' \
  "https://api.example.com/api/v1/product/batch"
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "uid": "prod-001",
      "sku": "WIDGET-001",
      "category_uid": "cat-electronics",
      "active": true
    },
    {
      "uid": "prod-002",
      "sku": "GADGET-002",
      "category_uid": "cat-electronics",
      "active": true
    }
  ]
}
```

#### Step 4: Process Order in ERP

At this point, your ERP system processes the order (creates invoices, updates inventory, etc.).

#### Step 4b: Update Order Items and/or Boxes from ERP (Optional)

If the order changed in ERP (items added/removed, quantities adjusted, or boxes produced after packing), update it. The payload is a single typed array under `data` carrying item and/or box elements:

```bash
curl -X POST -H "Authorization: Bearer {API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {"type": "item", "product_uid": "prod-1", "quantity": 5},
      {"type": "item", "product_uid": "prod-2", "quantity": 0},
      {"type": "item", "product_uid": "prod-3", "quantity": 10},
      {"type": "box", "length_cm": 40, "width_cm": 30, "height_cm": 20, "weight_kg": 2.5},
      {"type": "box", "length_cm": 60, "width_cm": 40, "height_cm": 30, "weight_kg": 7.8}
    ]
  }' \
  "https://api.example.com/api/v1/order/edit/order-123"
```

**Notes:**
- Order UID is a path parameter (`/order/edit/{uid}`), not in the body
- Send the complete item list — items not included are removed
- Use `quantity: 0` to explicitly mark items for removal
- Do NOT send prices — the backend fetches prices and recalculates all totals, discounts, and VAT
- Boxes carry only physical attributes (L/W/H in cm, weight in kg). Submitting any box element replaces all existing boxes for the order
- Omit all box elements to leave existing boxes untouched; omit all item elements to leave existing items untouched
- The response contains the updated order with recalculated monetary values and the final boxes array

#### Step 5: Move Order to Next Stage

After processing, move the order to the next pipeline stage:

```bash
# Move order to "processing" stage
curl -X POST -H "Authorization: Bearer {API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"data": {"order_uid": "order-123", "stage_uid": "processing"}}' \
  "https://api.example.com/api/v1/crm/board/move"
```

**Response:**
```json
{
  "status": "success",
  "message": "Order moved successfully"
}
```

**What happens when you move an order:**
- Order's `status` field is updated to match the stage name
- If target stage has `creates_allocation: true`, inventory is allocated
- If target stage has `deletes_allocation: true`, allocations are released
- `entered_at` timestamp is updated to current time
- Activity log records the stage change

#### Step 6: Confirm Processed Changes (Optional)

If using the changes tracking system, confirm that you've processed the changes:

```bash
# Get pending changes
curl -H "Authorization: Bearer {API_KEY}" \
  "https://api.example.com/api/v1/changes?limit=100"

# Confirm processed changes
curl -X POST -H "Authorization: Bearer {API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"data": ["change-001", "change-002"]}' \
  "https://api.example.com/api/v1/changes/confirm"
```

### Complete Polling Loop Example

```python
# Python pseudocode for ERP integration

import requests

API_URL = "https://api.example.com/api/v1"
HEADERS = {"Authorization": "Bearer {API_KEY}"}

def process_new_orders():
    # 1. Get orders in "new-orders" stage
    response = requests.get(
        f"{API_URL}/crm/board/orders",
        params={"stage_uid": "new-orders", "page": 1, "count": 50},
        headers=HEADERS
    )
    orders_data = response.json()["data"]

    for order_info in orders_data:
        order_uid = order_info["order"]["uid"]

        # 2. Get full order with items
        response = requests.post(
            f"{API_URL}/order/batch",
            json={"data": [order_uid]},
            headers=HEADERS
        )
        order = response.json()["data"][0]

        # 3. Process in ERP (your business logic)
        erp_result = process_erp_order(order)

        # 4. Update order items and/or boxes if changed in ERP (optional)
        if erp_result.items_changed or erp_result.boxes_changed:
            elements = []
            # erp_result.items: [{"product_uid": "...", "quantity": N}, ...]
            elements += [{"type": "item", **it} for it in erp_result.items]
            # erp_result.boxes: [{"length_cm": L, "width_cm": W, "height_cm": H, "weight_kg": Kg}, ...]
            elements += [{"type": "box", **bx} for bx in erp_result.boxes]
            requests.post(
                f"{API_URL}/order/edit/{order_uid}",
                json={"data": elements},
                headers=HEADERS
            )

        if erp_result.success:
            # 5. Move to "processing" stage
            requests.post(
                f"{API_URL}/crm/board/move",
                json={"data": {"order_uid": order_uid, "stage_uid": "processing"}},
                headers=HEADERS
            )

# Run every 5 minutes
while True:
    process_new_orders()
    time.sleep(300)
```

### Endpoint Summary for ERP Integration

| Step | Endpoint | Method | Purpose |
|------|----------|--------|---------|
| 1 | `/crm/board/orders` | GET | Get orders in a specific stage |
| 2 | `/order/batch` | POST | Get full order details with items (and shipment tracking, once created) |
| 3 | `/product/batch` | POST | Get product details (optional) |
| 4 | `/client/batch` | POST | Get client details (optional) |
| 5 | `/order/edit/{uid}` | POST | Edit order items and/or boxes (recalculates prices) |
| 6 | `/crm/board/move` | POST | Move order to next stage |
| 7 | `/order/batch` or `/order/find/status` | POST | Poll for the carrier tracking number (`shipments` array) after dispatch |
| 8 | `/changes` | GET | Get pending changes (optional) |
| 9 | `/changes/confirm` | POST | Confirm processed changes (optional) |

### Stages

#### List Active Pipeline Stages

**GET** `/crm/stages`

Returns all active pipeline stages, optionally filtered by store.

**Query Parameters:**
- `store_uid`: (optional) string - Filter by store

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "uid": "stage-1",
      "name": "New Orders",
      "color": "#6366f1",
      "sort_order": 0,
      "is_initial": true,
      "is_final": false,
      "active": true
    },
    {
      "uid": "stage-2",
      "name": "Processing",
      "color": "#22c55e",
      "sort_order": 1,
      "is_initial": false,
      "is_final": false,
      "active": true
    }
  ]
}
```

#### Get Stages Batch

**POST** `/crm/stages/batch`

Get multiple stages by their UIDs.

**Request Body:**
```json
{
  "data": ["stage-1", "stage-2", "stage-3"]
}
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "uid": "stage-1",
      "name": "New Orders",
      "color": "#6366f1",
      "sort_order": 0,
      "is_initial": true
    }
  ]
}
```

### Board Operations

#### Get Pipeline Board

**GET** `/crm/board`

Returns the full CRM board with all stages and their orders.

**Query Parameters:**
- `store_uid`: (optional) string - Filter by store
- `orders_per_stage`: (optional) integer, default 50 - Maximum orders to return per stage

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
          "is_initial": true
        },
        "orders": [
          {
            "order": {
              "uid": "order-123",
              "number": "ORD-001",
              "client_uid": "client-1",
              "total": 15999,
              "status": "new"
            },
            "client": {
              "uid": "client-1",
              "name": "ACME Corp"
            },
            "assignment": {
              "user_uid": "user-1",
              "user_name": "John Doe"
            },
            "entered_at": "2024-01-15T10:30:00Z",
            "time_in_stage_seconds": 3600
          }
        ],
        "count": 25
      }
    ]
  }
}
```

#### Get Orders by Stage

**GET** `/crm/board/orders`

Returns orders for a specific stage with pagination.

**Query Parameters:**
- `stage_uid`: (required) string - Stage UID
- `store_uid`: (optional) string - Filter by store
- `page`: (optional) integer, default 1
- `count`: (optional) integer, default 20

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "order": {
        "uid": "order-123",
        "number": "ORD-001",
        "total": 15999
      },
      "client": {
        "uid": "client-1",
        "name": "ACME Corp"
      },
      "assignment": {
        "user_uid": "user-1",
        "user_name": "John Doe"
      },
      "entered_at": "2024-01-15T10:30:00Z",
      "time_in_stage_seconds": 3600
    }
  ],
  "pagination": {
    "page": 1,
    "count": 20,
    "total": 45
  }
}
```

#### Move Order to Stage

**POST** `/crm/board/move`

Moves an order to a different pipeline stage.

**Query Parameters:**
- `validate_transition`: (optional) boolean, default true - Whether to validate allowed transitions

**Request Body:**
```json
{
  "data": {
    "order_uid": "order-123",
    "stage_uid": "stage-2"
  }
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Order moved successfully"
}
```

**Notes:**
- When `validate_transition=true`, only transitions defined in `crm_pipeline_transitions` are allowed
- When `validate_transition=false`, any stage transition is permitted
- Moving to a stage with `creates_allocation=true` creates inventory allocations
- Moving to a stage with `deletes_allocation=true` removes inventory allocations
- Order status is automatically updated to match the target stage name

#### Get Order Pipeline Info (Batch)

**POST** `/crm/board/pipeline/batch`

Get pipeline information for multiple orders.

**Request Body:**
```json
{
  "data": ["order-123", "order-456", "order-789"]
}
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "order_uid": "order-123",
      "stage_uid": "stage-1",
      "entered_at": "2024-01-15T10:30:00Z"
    },
    {
      "order_uid": "order-456",
      "stage_uid": "stage-2",
      "entered_at": "2024-01-14T08:00:00Z"
    }
  ]
}
```
