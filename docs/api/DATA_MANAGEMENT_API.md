# Data Management API Documentation

Data management API endpoints for internal use (staff/users). Clients use the frontend API instead.

For endpoint list, see [API_STRUCTURE.md](API_STRUCTURE.md#data-management-api-authenticated-for-staffusers).
For authentication details, see [api_documentation.md](api_documentation.md#authentication).
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
| `discount_percent` | int | No | Discount percentage (0-100) |
| `vat_rate` | float | No | VAT rate percentage (0-100) |
| `country_code` | string | No | Shipping country (ISO code) |
| `zipcode` | string | No | Shipping postal code |
| `city` | string | No | Shipping city |
| `address_text` | string | No | Full shipping address |
| `shipping_address` | string | No | Shipping address reference |
| `billing_address` | string | No | Billing address reference |
| `comment` | string | No | Order notes |
| `items` | array | Yes | Order items (min 1 required) |
| `created_at` | timestamp | No | Order creation timestamp |

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
      "country_code": "UA"
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

Client addresses store shipping and billing address information.

#### Client Address Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `uid` | string | Yes | Unique identifier |
| `client_uid` | string | Yes | Client this address belongs to |
| `country_code` | string | Yes | Country (must exist in countries table, max 5 chars) |
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
- **New user**: Created with `role="manager"` and `password_hash="!no_password_set"` (cannot log in)
- **Existing user**: Username, first_name, last_name, and email are updated; password, store_uid, and price_type_uid are preserved

---

## CRM Pipeline (ERP Integration)

These endpoints provide ERP systems with read/write access to the CRM pipeline without admin/manager role restrictions. They use standard authentication (API key or JWT token).

For admin CRM endpoints with role-based restrictions, see [ADMIN_API.md](ADMIN_API.md#crm-pipeline).

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
      "total": 25999,
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
        erp_result = create_erp_order(order)

        if erp_result.success:
            # 4. Move to "processing" stage
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
| 2 | `/order/batch` | POST | Get full order details with items |
| 3 | `/product/batch` | POST | Get product details (optional) |
| 4 | `/client/batch` | POST | Get client details (optional) |
| 5 | `/crm/board/move` | POST | Move order to next stage |
| 6 | `/changes` | GET | Get pending changes (optional) |
| 7 | `/changes/confirm` | POST | Confirm processed changes (optional) |

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
