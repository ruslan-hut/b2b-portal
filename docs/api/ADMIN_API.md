# Admin API Documentation

Admin-only API endpoints. Requires user authentication and admin/manager role privileges.

For endpoint list, see [API_STRUCTURE.md](API_STRUCTURE.md#admin-authenticated--user-role-required).
For authentication details, see [api_documentation.md](api_documentation.md#authentication).

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
      "quantity": 50
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
| `creates_allocation` | bool | Create stock allocations when entering |
| `deletes_allocation` | bool | Delete allocations when entering |
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
      "creates_allocation": false,
      "deletes_allocation": false,
      "active": true
    }
  ]
}
```

**Notes:** Only one stage can be marked as `is_initial`

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
      "config": {},
      "event_mappings": {
        "DELIVERED": "stage-final-uid",
        "RETURNED": null
      }
    }
  ]
}
```

**Carrier Types:** `dhl24`, `dpd`, `inpost`

**Event Mappings:** Map carrier event codes to CRM stage UIDs. `null` value means "record only" (don't move order).

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
