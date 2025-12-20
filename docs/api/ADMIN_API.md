# Admin API Documentation

Admin-only API endpoints. Requires user authentication and admin/manager role privileges.

For endpoint list, see [API_STRUCTURE.md](API_STRUCTURE.md#admin-authenticated--user-role-required).
For authentication details, see [API_DOCUMENTATION.md](API_DOCUMENTATION.md#authentication).

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
- **admin** - Full access to all admin features including user management and database viewer
- **manager** - Access to admin zone (dashboard, clients, orders, products management)
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

**Response:**
```json
{
  "success": true,
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

### Client Management

Alias endpoints for client management in admin zone. Same functionality as `/client` endpoints.

See [DATA_MANAGEMENT_API.md - Client](DATA_MANAGEMENT_API.md#client) for detailed documentation.

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
- `offset`: (optional) integer, default 0
- `limit`: (optional) integer, default 100
- `status`: (optional) string - Filter by order status

**Example:**
```bash
GET /admin/orders?status=new&offset=0&limit=20
```

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
    },
    {
      "uid": "change-def456",
      "object_name": "client",
      "object_uid": "client-789",
      "created_at": "2025-01-15T10:05:00Z"
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

**CRM Workflow:**
1. CRM calls `GET /admin/changes` to fetch pending changes
2. CRM processes each change by calling the appropriate API endpoint to get full object data
3. CRM calls `POST /admin/changes/confirm` with the UIDs of processed changes

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

Returns products with additional details for admin views.

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

## Admin Role Only

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
| `role` | string | Yes | User role: `admin`, `manager`, or `user` |
| `store_uid` | string | No | Assigned store UID |
| `price_type_uid` | string | No | Default price type for this user |

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

Returns list of database tables.

#### Search Table Records

**POST** `/admin/tables/{table_name}/records`

Search records in a specific table.

---

### Logs Viewer

#### List Logs

**GET** `/admin/logs`

Returns application logs.

#### Cleanup Logs

**DELETE** `/admin/logs/cleanup`

Delete old log entries.
