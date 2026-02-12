# Frontend API Documentation

Frontend API endpoints for authenticated clients. These endpoints provide client-specific product listings with pre-calculated prices, cart operations, order management, and profile self-service.

For endpoint list, see [API_STRUCTURE.md](API_STRUCTURE.md#frontend-authenticated-for-clients).
For authentication details, see [api_documentation.md](api_documentation.md#authentication).

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
      "sku": "WIDGET-001"
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
  "comment": "Please handle with care"
}
```

**Request Fields:**
- `order_uid` (string, optional) - UID of existing draft order to update; if omitted, auto-finds existing draft or creates new
- `address_uid` (string, optional) - UID of client address to use; if omitted, uses default address
- `items` (array, required, min 1) - Cart items with `product_uid` (required) and `quantity` (required, > 0)
- `comment` (string, optional) - Order comment

**Query Parameters:**
- `language`: (optional) string - Language for product names (default: `"en"`)

**Response:**
```json
{
  "status": "success",
  "data": {
    "order_uid": "order-draft-789",
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
    "status": "new",
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
      "status": "new",
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
  "is_default": true
}
```

**Request Fields:**
- `uid` (string, optional) - Omit to create new address; provide to update existing
- `country_code` (string, required, max 5) - ISO country code
- `zipcode` (string, optional) - Postal code
- `city` (string, optional) - City name
- `address_text` (string, optional) - Full address text
- `is_default` (boolean) - Set as default address

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
