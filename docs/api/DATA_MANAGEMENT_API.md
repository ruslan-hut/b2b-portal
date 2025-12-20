# Data Management API Documentation

Data management API endpoints for internal use (staff/users). Clients use the frontend API instead.

For endpoint list, see [API_STRUCTURE.md](API_STRUCTURE.md#data-management-api-authenticated-for-staffusers).
For authentication details, see [API_DOCUMENTATION.md](API_DOCUMENTATION.md#authentication).
For admin-only endpoints, see [ADMIN_API.md](ADMIN_API.md).

---

## Base Path

`/api/v1`

---

## Client

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
| `fixed_discount` | bool | No | If true, use `discount` field; if false, calculate from discount scale |
| `balance` | int | No | Current monthly purchase turnover in cents (set by CRM) |
| `vat_rate` | float | No | VAT rate percentage (0-100) |
| `vat_number` | string | No | VAT registration number (max 50 characters) |
| `price_type_uid` | string | Yes | Price type for this client |
| `store_uid` | string | Yes | Assigned store for inventory allocation |
| `active` | bool | No | Whether client can log in (defaults to false if no pin_code) |

#### Discount Calculation

- **Fixed Discount** (`fixed_discount: true`): Uses the `discount` field directly
- **Scale-Based Discount** (`fixed_discount: false`): Looks up discount from the discount scale based on client's `balance`

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
      "fixed_discount": true,
      "vat_rate": 20,
      "vat_number": "VAT123456",
      "price_type_uid": "wholesale-usd",
      "store_uid": "store-456",
      "active": true
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

#### Product Description Fields

Product descriptions are language-specific.

**Composite Key:** `(product_uid, language)`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `product_uid` | string | Yes | Product this description belongs to |
| `language` | string | Yes | Language code (e.g., "en", "uk") |
| `name` | string | Yes | Product name in this language |
| `description` | string | No | Product description in this language |

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
      "is_hot_sale": true
    }
  ]
}
```

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

---

## Category

#### Category Description Format

Category descriptions automatically include parent category names:
- Format: `"Parent Name Child Name"` (if parent exists)
- Applies to all languages independently

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

Prices link products to price types with specific amounts.

**Composite Key:** `(price_type_uid, product_uid)`

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
| `total` | float | No | Order total (calculated) |
| `discount_percent` | int | No | Discount percentage (0-100) |
| `vat_rate` | float | No | VAT rate percentage (0-100) |
| `country_code` | string | No | Shipping country (ISO code) |
| `zipcode` | string | No | Shipping postal code |
| `city` | string | No | Shipping city |
| `address_text` | string | No | Full shipping address |
| `comment` | string | No | Order notes |
| `items` | array | Yes | Order items (min 1 required) |

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

#### Get Orders Batch

**POST** `/order/batch`

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

---

## Store

#### Multi-Store Inventory System

- Each store maintains its own inventory for all products
- Each client is permanently assigned to a specific store
- Orders allocate inventory from the client's assigned store only
- Available quantity = `store_inventory.quantity - SUM(allocations)`

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

Price types define different pricing schemes for products.

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

Client addresses store shipping and billing address information.

#### Client Address Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Unique identifier |
| `client_uid` | string | Yes | Client this address belongs to |
| `country_code` | string | Yes | Country (must exist in countries table) |
| `zipcode` | string | No | Postal/ZIP code |
| `city` | string | No | City name |
| `address_text` | string | No | Full address text |
| `is_default` | bool | No | Mark as default address for client |

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
      "is_default": true
    }
  ]
}
```

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
