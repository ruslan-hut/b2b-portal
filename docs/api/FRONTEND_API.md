# Frontend API Documentation

Frontend API endpoints for authenticated clients. These endpoints provide client-specific product listings, cart operations, order management, and profile self-service.

For endpoint list, see [API_STRUCTURE.md](API_STRUCTURE.md#frontend-authenticated-for-clients).
For authentication details, see [API_DOCUMENTATION.md](API_DOCUMENTATION.md#authentication).

---

## Base Path

`/api/v1/frontend`

---

## Authentication

All frontend endpoints require client authentication via JWT token.

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

---

## Products

### List Products with Calculated Prices

**GET** `/frontend/products`

Returns products with prices calculated for the authenticated client's price type and discount.

**Query Parameters:**
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100
- `category`: (optional) string - Filter by category UID
- `language`: (optional) string - Language for descriptions

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "uid": "prod-123",
      "sku": "WIDGET-001",
      "category_uid": "cat-456",
      "name": "Premium Widget",
      "description": "High-quality widget",
      "price": 1999,
      "price_with_discount": 1799,
      "discount_percent": 10,
      "available_quantity": 85,
      "is_new": true,
      "is_hot_sale": false
    }
  ],
  "metadata": {
    "offset": 0,
    "limit": 100,
    "total": 250
  }
}
```

**Notes:**
- Prices are calculated using client's assigned `price_type_uid`
- Discounts are applied based on client's `discount` (fixed) or scale-based discount
- `available_quantity` reflects stock in client's assigned store

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
  }
}
```

**Frontend Caching:**
- Store images in IndexedDB for offline access
- Use `last_update` for cache invalidation
- Convert to Blob URLs for display

---

## Cart

### Update Cart

**POST** `/frontend/cart/update`

Update the client's shopping cart. Creates or updates a draft order.

**Request Body:**
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

**Response:**
```json
{
  "status": "success",
  "data": {
    "order_uid": "order-draft-789",
    "items": [
      {
        "product_uid": "prod-123",
        "quantity": 2,
        "price": 1999,
        "price_with_discount": 1799,
        "total": 3598
      }
    ],
    "subtotal": 5397,
    "discount_amount": 540,
    "vat_amount": 972,
    "total": 5829
  }
}
```

**Notes:**
- Creates draft order if none exists
- Does NOT reserve inventory (draft status)
- Prices calculated with client's discount

---

## Orders

### Preview Order

**POST** `/frontend/orders/preview`

Preview order totals before confirmation. Validates stock availability.

**Request Body:**
```json
{
  "shipping_address_uid": "addr-001",
  "items": [
    {
      "product_uid": "prod-123",
      "quantity": 2
    }
  ],
  "comment": "Please deliver after 5 PM"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "items": [
      {
        "product_uid": "prod-123",
        "name": "Premium Widget",
        "quantity": 2,
        "price": 1999,
        "price_with_discount": 1799,
        "available": true,
        "available_quantity": 85
      }
    ],
    "shipping_address": {
      "country_code": "UA",
      "city": "Kyiv",
      "address_text": "123 Main Street"
    },
    "subtotal": 3598,
    "discount_percent": 10,
    "discount_amount": 360,
    "vat_rate": 20,
    "vat_amount": 648,
    "total": 3886,
    "currency_code": "USD",
    "can_confirm": true
  }
}
```

**Validation:**
- Checks stock availability in client's store
- Returns `can_confirm: false` if any item unavailable
- Shows `available: false` for unavailable items

### Confirm Order

**POST** `/frontend/orders/confirm`

Confirm order and reserve inventory.

**Request Body:**
```json
{
  "shipping_address_uid": "addr-001",
  "items": [
    {
      "product_uid": "prod-123",
      "quantity": 2
    }
  ],
  "comment": "Please deliver after 5 PM"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "order_uid": "order-12345",
    "order_number": "ORD-2025-0001",
    "status": "new",
    "total": 3886,
    "created_at": "2025-01-15T10:00:00Z"
  }
}
```

**Behavior:**
- Creates order with status `"new"`
- Reserves inventory (creates allocation records)
- Clears client's draft cart
- Triggers CRM change notification

**Errors:**
- `400` - Insufficient stock
- `400` - Invalid shipping address

### Get Order History

**GET** `/frontend/orders/history`

Get client's order history.

**Query Parameters:**
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100
- `status`: (optional) string - Filter by status

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "uid": "order-12345",
      "number": "ORD-2025-0001",
      "status": "confirmed",
      "status_name": "Confirmed",
      "total": 3886,
      "currency_code": "USD",
      "items_count": 2,
      "created_at": "2025-01-15T10:00:00Z",
      "updated_at": "2025-01-15T14:00:00Z"
    }
  ],
  "metadata": {
    "offset": 0,
    "limit": 100,
    "total": 15
  }
}
```

---

## Countries

### List Countries

**GET** `/frontend/countries`

Get list of countries (for address forms).

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

Update client's own profile data.

**Request Body:**
```json
{
  "name": "ACME Corporation",
  "email": "contact@acme.com",
  "phone": "+1234567890",
  "vat_number": "VAT123456"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Profile updated successfully"
}
```

**Editable Fields:**
- `name` - Company/client name
- `email` - Email address
- `phone` - Phone number
- `vat_number` - VAT registration number

**Note:** Cannot modify `discount`, `price_type_uid`, `store_uid`, or `active` status.

---

## Addresses

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
      "country_code": "UA",
      "country_name": "Ukraine",
      "zipcode": "01001",
      "city": "Kyiv",
      "address_text": "123 Main Street, Office 5",
      "is_default": true
    },
    {
      "uid": "addr-002",
      "country_code": "PL",
      "country_name": "Poland",
      "zipcode": "00-001",
      "city": "Warsaw",
      "address_text": "456 Business Ave",
      "is_default": false
    }
  ]
}
```

### Upsert My Address

**POST** `/frontend/profile/addresses`

Create or update an address.

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

**Response:**
```json
{
  "status": "success",
  "data": {
    "uid": "addr-001"
  }
}
```

**Notes:**
- If `uid` is omitted, creates new address
- If `uid` is provided, updates existing address
- Setting `is_default: true` clears default from other addresses

### Delete My Address

**DELETE** `/frontend/profile/addresses/{uid}`

Delete an address.

**Response:**
```json
{
  "status": "success",
  "message": "Address deleted successfully"
}
```

**Note:** Cannot delete the last remaining address or the default address if it's the only one.

### Set Default Address

**PUT** `/frontend/profile/addresses/{uid}/default`

Set an address as the default.

**Response:**
```json
{
  "status": "success",
  "message": "Default address updated"
}
```
