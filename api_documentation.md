# API Documentation

This document outlines the API endpoints available in the `b2b-back` service.

## Base Path
`/api/v1`

## Authentication

This API uses **JWT (JSON Web Token)** based authentication with support for two types of entities:
- **Users**: Authenticated with username + password
- **Clients**: Authenticated with phone + pincode

### Authentication Flow

1. **Login** to receive access token and refresh token
2. **Include access token** in Authorization header for protected endpoints
3. **Refresh token** when access token expires (every 15 minutes)
4. **Logout** to revoke tokens when done

### Public Endpoints (No Authentication Required)

- `POST /auth/login` - Login as user or client
- `POST /auth/refresh` - Refresh expired access token

### Protected Endpoints (Require Authentication)

All other endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-access-token>
```

### Authentication Endpoints

#### Login
**POST** `/auth/login`

**User Login Request:**
```json
{
  "username": "admin",
  "password": "password123"
}
```

**Client Login Request:**
```json
{
  "phone": "+1234567890",
  "pin_code": "1234"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "xyz789abc...",
    "token_type": "Bearer",
    "expires_in": 900,
    "expires_at": "2025-01-12T10:15:00Z",
    "entity_type": "user",
    "entity_uid": "user-123"
  }
}
```

#### Refresh Token
**POST** `/auth/refresh`

**Request:**
```json
{
  "refresh_token": "xyz789abc..."
}
```

**Response:** Same as login response with new tokens

#### Get Current User/Client Info
**GET** `/auth/me`

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response (User):**
```json
{
  "status": "success",
  "data": {
    "entity_type": "user",
    "user": {
      "uid": "user-123",
      "username": "admin",
      "email": "admin@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "role": "admin",
      "store_uid": "store-456"
    },
    "token_info": {
      "token_uid": "token-abc123",
      "issued_at": "2025-01-12T10:00:00Z",
      "expires_at": "2025-01-12T10:15:00Z"
    }
  }
}
```

#### Logout (Revoke Current Token)
**POST** `/auth/logout`

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "status": "success",
  "data": "logged out successfully"
}
```

#### List Active Tokens (All Devices)
**GET** `/auth/tokens`

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "status": "success",
  "data": [
    {
      "token_uid": "token-abc123",
      "issued_at": "2025-01-12T10:00:00Z",
      "expires_at": "2025-01-12T10:15:00Z",
      "last_used": "2025-01-12T10:05:00Z",
      "user_agent": "Mozilla/5.0...",
      "ip_address": "192.168.1.100",
      "is_current": true
    }
  ]
}
```

#### Revoke Specific Token (Logout from Specific Device)
**DELETE** `/auth/tokens/{token_uid}`

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "status": "success",
  "data": "token revoked successfully"
}
```

#### Revoke All Tokens (Logout from All Devices)
**POST** `/auth/tokens/revoke-all`

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "status": "success",
  "data": "all tokens revoked successfully"
}
```

### Token Lifecycle

- **Access Token Duration**: 15 minutes
- **Refresh Token Duration**: 7 days
- **Token Rotation**: New refresh token issued on each refresh (old one revoked)
- **Multi-Device Support**: Multiple active tokens per user/client
- **Immediate Revocation**: Tokens checked against database on each request

### Example: Complete Authentication Flow

```bash
# 1. Login
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'

# Response: {"data":{"access_token":"eyJ...","refresh_token":"xyz..."}}

# 2. Use access token for protected endpoints
curl -X GET http://localhost:8080/api/v1/user \
  -H "Authorization: Bearer eyJ..."

# 3. When access token expires (401 response), refresh it
curl -X POST http://localhost:8080/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"xyz..."}'

# 4. Logout when done
curl -X POST http://localhost:8080/api/v1/auth/logout \
  -H "Authorization: Bearer eyJ..."
```

### Error Responses

**401 Unauthorized** - Invalid credentials, expired token, or revoked token:
```json
{
  "status": "error",
  "message": "unauthorized"
}
```

**403 Forbidden** - Attempting to access another user's resources:
```json
{
  "status": "error",
  "message": "cannot revoke token from another user"
}
```

For complete authentication API reference, see [AUTH_API_REFERENCE.md](../AUTH_API_REFERENCE.md)

---

## Important Notes

### Batch Operations Support
All main entity operations (User, Product, Client, Category, Currency, Order, Attribute) support **batch upsert**, **batch delete**, and **batch retrieval** operations using array inputs.

### Upsert Pattern
All POST endpoints follow the **upsert pattern** (create OR update):
- If entity with UID exists: **UPDATE**
- If entity doesn't exist: **CREATE**
- No separate create/update endpoints

### Batch Retrieval Pattern
**NEW**: All entities should support batch retrieval to minimize HTTP requests:
- **Single entity**: `GET /entity/{uid}` - Get one entity (backward compatible)
- **Multiple entities**: `POST /entity/batch` - Get multiple entities by UIDs (preferred for bulk operations)

**Batch Retrieval Request Format:**
```json
{
  "data": ["uid1", "uid2", "uid3"]
}
```

**Batch Retrieval Response:**
```json
{
  "status": "success",
  "data": [
    { "uid": "uid1", "name": "Entity 1", ... },
    { "uid": "uid2", "name": "Entity 2", ... },
    { "uid": "uid3", "name": "Entity 3", ... }
  ],
  "timestamp": "2023-10-27T10:00:00Z"
}
}
```

**Benefits:**
- Reduces N+1 query problems
- Minimizes HTTP overhead
- Improves frontend performance
- Example: Load 100 products in 1 request instead of 100 requests

**Currently Implemented:**
- `POST /product/descriptions/batch` - Get descriptions for multiple products
- `POST /order/items/batch` - Get items for multiple orders

### Request Format
All requests that modify or retrieve data use a standardized format:
```json
{
  "data": [ /* array of objects or UIDs */ ]
}
```

## Common Response Structure

All successful responses will have the following structure:
```json
{
    "data": {}, // The actual data returned by the endpoint
    "success": true,
    "status_message": "Success",
    "timestamp": "2023-10-27T10:00:00Z"
}
```

All error responses will have the following structure:
```json
{
    "data": null,
    "success": false,
    "status_message": "Error message",
    "timestamp": "2023-10-27T10:00:00Z"
}
```

---

## Endpoints

### User

#### Upsert Users (Create or Update)
*   **POST** `/user`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "user-123", // Optional for create, required for update
              "username": "string",
              "email": "string",
              "password": "string",
              "first_name": "string",
              "last_name": "string",
              "user_role": "string",
              "store_uid": "store-456" // Optional
            }
          ]
        }
        ```
    *   **Response:** Array of created/updated user UIDs

#### List Users
*   **GET** `/user`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of users with metadata

#### Get Users Batch
*   **POST** `/user/batch`
    *   **Description:** Retrieve multiple users by their UIDs.
    *   **Request Body:**
        ```json
        {
          "data": ["user-123", "user-456"]
        }
        ```
    *   **Response:** Array of user objects.

#### Delete Users Batch
*   **POST** `/user/delete`
    *   **Description:** Delete multiple users by their UIDs.
    *   **Request Body:**
        ```json
        {
          "data": ["user-123", "user-456", "user-789"]
        }
        ```
    *   **Response:** Success message.

#### Find Users by Email Batch
*   **POST** `/user/find/email`
    *   **Description:** Find multiple users by their email addresses.
    *   **Request Body:**
        ```json
        {
          "data": ["user1@example.com", "user2@example.com"]
        }
        ```
    *   **Response:** Array of user objects.

#### Find Users by Username Batch
*   **POST** `/user/find/username`
    *   **Description:** Find multiple users by their usernames.
    *   **Request Body:**
        ```json
        {
          "data": ["username1", "username2"]
        }
        ```
    *   **Response:** Array of user objects.

---

### Product

#### Product Inventory Management
**IMPORTANT:** The inventory system uses a **multi-store architecture**:

- **Products NO LONGER have a global quantity field** - inventory is tracked per-store
- **Store Inventory**: Each store tracks its own inventory via the `/store/inventory` endpoints
- **Order Allocations**: When orders are created with status `"new"`, quantities are allocated from the client's assigned store
- **Available Quantity**: Calculated per-store as `store_inventory.quantity - SUM(allocations WHERE store_uid = X)`
- **Client-Store Association**: Each client is assigned to a specific store, and orders allocate from that store only
- **Allocation Lifecycle**:
  - Created when order status is `"new"` (user confirmed, from client's store)
  - Maintained during `"processing"` status (CRM fulfilling)
  - Deleted when order status becomes `"confirmed"` (order fulfilled)

This design ensures:
- Multi-location inventory management
- Per-store stock tracking and allocation
- Clients always order from their assigned store
- Real-time available inventory per location
- See the **[Store](#store)** section for inventory management endpoints

#### Upsert Products (Create or Update)
*   **POST** `/product`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "prod-123", // Optional for create, required for update
              "price": 1000,
              "category_uid": "cat-456",
              "active": true, // Optional, defaults to true
              "sort_order": 10, // Optional, defaults to 0
              "is_new": true // Optional, defaults to false
            }
          ]
        }
        ```
    *   **Response:** Array of created/updated product UIDs
    *   **Note:** Products no longer have a quantity field. Use the Store inventory endpoints to manage stock per location

#### List Products
*   **GET** `/product`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of products with metadata

#### Get Products Batch
*   **POST** `/product/batch`
    *   **Description:** Retrieve multiple products by their UIDs.
    *   **Request Body:**
        ```json
        {
          "data": ["prod-123", "prod-456"]
        }
        ```
    *   **Response:** Array of product objects.

#### Delete Products Batch
*   **POST** `/product/delete`
    *   **Description:** Delete multiple products by their UIDs.
    *   **Request Body:**
        ```json
        {
          "data": ["prod-123", "prod-456", "prod-789"]
        }
        ```
    *   **Response:** Success message.

#### Find Products by Category Batch
*   **POST** `/product/find/category`
    *   **Description:** Find multiple products by their category UIDs.
    *   **Request Body:**
        ```json
        {
          "data": ["cat-123", "cat-456"]
        }
        ```
    *   **Response:** Array of product objects.

#### Update Product Active Status (Batch)
*   **POST** `/product/active`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "prod-123",
              "active": false
            },
            {
              "uid": "prod-456",
              "active": true
            }
          ]
        }
        ```
    *   **Response:** Success message
    *   **Description:** Update the active status of one or more products. Use this to soft-delete or activate products.

#### Upsert Product Descriptions (Batch)
*   **POST** `/product/description`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "product_uid": "prod-123",
              "language": "en",
              "name": "Premium Widget",
              "description": "High-quality widget"
            },
            {
              "product_uid": "prod-123",
              "language": "es",
              "name": "Widget Premium",
              "description": "Widget de alta calidad"
            }
          ]
        }
        ```
    *   **Response:** Success message

#### Delete Product Descriptions Batch
*   **POST** `/product/description/delete`
    *   **Description:** Delete multiple product descriptions.
    *   **Request Body:**
        ```json
        {
          "data": [
            {"product_uid": "prod-123", "language": "en"},
            {"product_uid": "prod-123", "language": "es"}
          ]
        }
        ```
    *   **Response:** Success message.

#### Get Batch Product Descriptions
*   **POST** `/product/descriptions/batch`
    *   **Description:** Retrieve simplified product descriptions (UID + Name + Description) for multiple products in a specific language. Useful for bulk operations and displaying product names and descriptions in lists.
    *   **Query Parameters:**
        *   `language`: (required) string
    *   **Request Body:**
        ```json
        {
          "data": [
            "prod-123",
            "prod-456"
          ]
        }
        ```
    *   **Response:**
        ```json
        {
          "success": true,
          "data": [
            {
              "uid": "prod-123",
              "name": "Basic Widget",
              "description": "High-quality basic widget"
            }
          ],
          "status_message": "success",
          "timestamp": "2025-11-17T12:00:00Z"
        }
        ```
    *   **Notes:**
        - Only products with descriptions in the requested language will be returned
        - Products without matching descriptions are omitted from response
        - Efficient single-query implementation using SQL IN clause
        - Maximum efficiency for bulk name lookups

---

### Order

#### Order and Product Allocation System
**IMPORTANT:** Order operations now use a **store-based product allocation system** with a simplified status flow:

**Order Status Flow:**
```
Frontend:    "draft" (saved cart)  →  "new" (user confirmed)
             ↓                        ↓
             No allocation           Allocation created FROM CLIENT'S STORE

External CRM:  "new"  →  "processing"  →  "confirmed"
               ↓          ↓               ↓
               Allocated  Allocated       Allocation DELETED (fulfilled)
```

**Status Descriptions:**
- **`"draft"`**: Saved cart, no validation, no allocation
- **`"new"`**: User confirmed order, stock validated **in client's assigned store**, allocation created
- **`"processing"`**: CRM processing, allocation exists
- **`"confirmed"`**: CRM fulfilled order, allocation **deleted**

**Frontend Can Only Create:**
- **Status `"draft"`** - Save cart for later
- **Status `"new"`** - Confirm order and reserve inventory **from client's store**

**External CRM Manages:**
- **`"new"` → `"processing"`** - Begin processing
- **`"processing"` → `"confirmed"`** - Mark as fulfilled (auto-deletes allocation)

---

**When Creating a Draft Order:**
1. Creates order record with status `"draft"`
2. **Does NOT** validate product availability
3. **Does NOT** create allocation records
4. **Does NOT** modify store inventory

**When Creating a "New" Order (User Confirmed):**
1. Gets client's assigned store UID
2. Validates available quantity **in that store**: `store_inventory.quantity - allocated_quantities (for that store)`
3. Creates order record with status `"new"`
4. Creates allocation records in `order_product_allocations` table **with store_uid**
5. **Does NOT modify** store inventory quantities

**When CRM Changes Status to "Confirmed":**
1. Updates order status to `"confirmed"`
2. **Deletes allocation records** (order fulfilled, inventory shipped)
3. **Does NOT modify** store inventory quantities

**When Deleting/Cancelling an Order:**
1. Removes allocation records (via CASCADE delete for "new" orders)
2. Deletes order record
3. **Does NOT modify** store inventory quantities

**When Adding/Updating Order Items:**
- **Draft Orders (`"draft"`):** Items can be added/updated without validation or allocations
- **New Orders (`"new"`):** Validates available quantity **in client's store** and creates/updates allocations
- **Processing/Confirmed Orders:** **Cannot be modified from frontend** (managed by CRM)

**When Removing Order Items:**
- **Draft Orders (`"draft"`):** Removes items without allocation management
- **New Orders (`"new"`):** Removes items and corresponding allocation records
- **Processing/Confirmed Orders:** **Cannot be modified from frontend** (managed by CRM)

**Key Benefits:**
- Users can save carts without reserving inventory
- Clear separation: frontend creates, CRM manages fulfillment
- Allocations automatically released when order confirmed (fulfilled)
- Store inventory remains unchanged by order operations
- Real-time available inventory calculation **per store**
- Each client orders from their assigned store only

#### Upsert Orders (Create or Update)
*   **POST** `/order`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "order-123", // Optional for create, required for update
              "user_uid": "user-456",
              "status": "draft", // Can be "draft", "new", "confirmed", "processing"
              "total": 5000.0,
              "shipping_address": "123 Main St",
              "billing_address": "123 Main St",
              "comment": "Please deliver after 5 PM", // Optional
              "items": [
                {
                  "product_uid": "prod-789",
                  "quantity": 2,
                  "price": 1000,
                  "discount": 0,
                  "total": 2000.0
                }
              ]
            }
          ]
        }
        ```
    *   **Response:** Array of created/updated order UIDs
    *   **Behavior Based on Status:**
        - **`status: "draft"`**: Saves cart without validation or allocations
        - **`status: "new"`**: Validates stock and creates allocations (user confirmed)
        - **Other statuses**: Will return error - only "draft" or "new" allowed from frontend
    *   **Status Transition Behavior (Update Operations):**
        - **Draft → Draft**: Simple update, no validation or allocation changes
        - **Draft → New**: Validates stock availability and creates allocations in a transaction
        - **Draft → Processing/Confirmed**: Returns error (only CRM can set these statuses)
        - **New → New**: Updates order without allocation changes
        - **Other transitions**: Managed by CRM through `/order/status` endpoint
    *   **Note:**
        - The `comment` field is optional and can be used to store additional notes about the order
        - Stock validation uses available quantity (CRM quantity - allocated quantity)
        - Creates product allocation records automatically for "new" orders
        - Frontend can only create with "draft" or "new" status
        - When updating an order and changing status from "draft" to "new", stock is validated and allocations are created atomically
    *   **Example Workflow:**
        1. Create order with `status: "draft"` to save cart → No allocation
        2. Update same order with `status: "new"` to confirm → Stock validated, allocation created
        3. CRM changes to "processing" → Allocation exists
        4. CRM changes to "confirmed" → Allocation deleted

#### List Orders
*   **GET** `/order`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of orders with metadata

#### Get Orders Batch
*   **POST** `/order/batch`
    *   **Description:** Retrieve multiple orders by their UIDs.
    *   **Request Body:**
        ```json
        {
          "data": ["order-123", "order-456"]
        }
        ```
    *   **Response:** Array of order objects.

#### Delete Orders Batch
*   **POST** `/order/delete`
    *   **Description:** Delete multiple orders by their UIDs.
    *   **Request Body:**
        ```json
        {
          "data": ["order-123", "order-456", "order-789"]
        }
        ```
    *   **Response:** Success message.

#### Find Orders by User UIDs Batch
*   **POST** `/order/find/user`
    *   **Description:** Find multiple orders by their user UIDs.
    *   **Request Body:**
        ```json
        {
          "data": ["user-123", "user-456"]
        }
        ```
    *   **Response:** Array of order objects.

#### Find Orders by Statuses Batch
*   **POST** `/order/find/status`
    *   **Description:** Find multiple orders by their statuses.
    *   **Request Body:**
        ```json
        {
          "data": ["new", "processing"]
        }
        ```
    *   **Response:** Array of order objects.

#### Update Order Status
*   **POST** `/order/status`
    *   **Primary Use:** This endpoint is primarily used by external CRM systems to transition orders through fulfillment stages
    *   **Request Body:**
        ```json
        {
          "data": [
            {"uid": "order-123", "status": "confirmed"},
            {"uid": "order-456", "status": "processing"}
          ]
        }
        ```
    *   **Special Behavior - Order Confirmation:**
        - When changing status to `"confirmed"`:
          1. Updates order status to "confirmed"
          2. **Deletes all allocation records** for this order (order is fulfilled)
          3. Products are now available for other orders
        - Example: CRM marks order as shipped/delivered → `"processing"` → `"confirmed"` → Allocations deleted
    *   **Typical CRM Flow:**
        1. Frontend creates order with `status: "new"` (allocation created)
        2. CRM updates to `"processing"` (allocation remains)
        3. CRM updates to `"confirmed"` (allocation deleted - order fulfilled)
    *   **Response:** Success message

#### Upsert Order Items (Batch)
*   **POST** `/order/item`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "order_uid": "order-123",
              "product_uid": "prod-456",
              "quantity": 2,
              "price": 1000,
              "discount": 100,
              "total": 1800.0
            },
            {
              "order_uid": "order-123",
              "product_uid": "prod-789",
              "quantity": 1,
              "price": 500,
              "discount": 0,
              "total": 500.0
            }
          ]
        }
        ```
    *   **Behavior:**
        - Uses database-level upsert based on order_uid + product_uid
        - **Draft Orders:** Adds/updates items without validation or allocations
        - **New Orders:** Validates available quantity and creates/updates allocations
        - **Processing/Confirmed Orders:** Cannot be modified (returns error - CRM managed)
        - Does NOT modify `product.quantity`
    *   **Response:** Success message

#### Delete Order Items Batch
*   **POST** `/order/item/delete`
    *   **Description:** Delete multiple order items.
    *   **Request Body:**
        ```json
        {
          "data": [
            {"order_uid": "order-123", "product_uid": "prod-456"},
            {"order_uid": "order-123", "product_uid": "prod-789"}
          ]
        }
        ```
    *   **Behavior:**
        - Removes order item records
        - **Draft Orders:** Only removes items, no allocation management
        - **New Orders:** Removes items and corresponding allocation records
        - **Processing/Confirmed Orders:** Cannot be modified (returns error - CRM managed)
        - Does NOT modify `product.quantity`
    *   **Response:** Success message

#### Get Batch Order Items
*   **POST** `/order/items/batch`
    *   **Description:** Retrieve order items for multiple orders.
    *   **Request Body:**
        ```json
        {
          "data": [
            "order-123",
            "order-456"
          ]
        }
        ```
    *   **Response:**
        ```json
        {
          "success": true,
          "data": [
            [
              {
                "order_uid": "order-123",
                "product_uid": "prod-456",
                "quantity": 2,
                "price": 1000,
                "discount": 100,
                "total": 1800.0,
                "last_update": "2025-11-17T12:00:00Z"
              }
            ],
            [
              {
                "order_uid": "order-456",
                "product_uid": "prod-789",
                "quantity": 1,
                "price": 500,
                "discount": 0,
                "total": 500.0,
                "last_update": "2025-11-17T12:00:00Z"
              }
            ]
          ],
          "status_message": "success",
          "timestamp": "2025-11-17T12:00:00Z"
        }
        ```

---

### Order Status

#### Upsert Order Statuses (Create or Update)
*   **POST** `/order_status`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "status": "new",
              "language": "en",
              "name": "New Order"
            },
            {
              "status": "processing",
              "language": "en",
              "name": "Processing Order"
            }
          ]
        }
        ```
    *   **Response:** Array of created/updated order status codes

#### List Order Statuses
*   **GET** `/order_status`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of order statuses with metadata

#### Get Order Statuses Batch
*   **POST** `/order_status/batch`
    *   **Description:** Retrieve multiple order statuses by their composite keys.
    *   **Request Body:**
        ```json
        {
          "data": [
            {"status": "new", "language_code": "en"},
            {"status": "processing", "language_code": "es"}
          ]
        }
        ```
    *   **Response:** Array of order status objects.

#### Delete Order Statuses Batch
*   **POST** `/order_status/delete`
    *   **Description:** Delete multiple order statuses by their composite keys.
    *   **Request Body:**
        ```json
        {
          "data": [
            {"status": "new", "language_code": "en"},
            {"status": "processing", "language_code": "es"}
          ]
        }
        ```
    *   **Response:** Success message.

---

### Client

#### Upsert Clients (Create or Update)
*   **POST** `/client`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "client-123", // Optional for create, required for update
              "name": "string",
              "email": "string",
              "phone": "string",
              "pin_code": "string",
              "address": "string",
              "discount": 10,
              "currency": "USD",
              "price_type_uid": "string",
              "store_uid": "store-456", // Required: Assigns client to a specific store
              "active": true // Optional, defaults to true
            }
          ]
        }
        ```
    *   **Response:** Array of created/updated client UIDs
    *   **Note:** Each client must be assigned to a store via `store_uid`. Orders from this client will allocate inventory from their assigned store

#### List Clients
*   **GET** `/client`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of clients with metadata

#### Get Clients Batch
*   **POST** `/client/batch`
    *   **Description:** Retrieve multiple clients by their UIDs.
    *   **Request Body:**
        ```json
        {
          "data": ["client-123", "client-456"]
        }
        ```
    *   **Response:** Array of client objects.

#### Delete Clients Batch
*   **POST** `/client/delete`
    *   **Description:** Delete multiple clients by their UIDs.
    *   **Request Body:**
        ```json
        {
          "data": ["client-123", "client-456", "client-789"]
        }
        ```
    *   **Response:** Success message.

#### Find Clients by Email Batch
*   **POST** `/client/find/email`
    *   **Description:** Find multiple clients by their email addresses.
    *   **Request Body:**
        ```json
        {
          "data": ["client1@example.com", "client2@example.com"]
        }
        ```
    *   **Response:** Array of client objects.

#### Update Client Active Status (Batch)
*   **POST** `/client/active`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "client-123",
              "active": false
            },
            {
              "uid": "client-456",
              "active": true
            }
          ]
        }
        ```
    *   **Response:** Success message
    *   **Description:** Update the active status of one or more clients. Use this to soft-delete or activate client accounts.

---

### Store

#### Multi-Store Inventory System
**IMPORTANT:** The store system enables multi-location inventory management:

- **Store-Based Inventory**: Each store maintains its own inventory for all products
- **Client-Store Assignment**: Each client is permanently assigned to a specific store
- **Store-Based Allocations**: Orders allocate inventory from the client's assigned store only
- **Available Quantity Per Store**: Real-time calculation: `store_inventory.quantity - SUM(allocations WHERE store_uid = X AND product_uid = Y)`
- **Independent Stock Levels**: The same product can have different quantities in different stores

**Use Cases:**
- Multiple warehouse locations
- Regional distribution centers
- Physical retail store + online fulfillment center
- Partner/franchise inventory tracking

#### Upsert Stores (Create or Update)
*   **POST** `/store`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "store-123", // Optional for create, required for update
              "name": "Main Warehouse",
              "active": true // Optional, defaults to true
            },
            {
              "uid": "store-456",
              "name": "Regional Distribution Center",
              "active": true
            }
          ]
        }
        ```
    *   **Response:** Array of created/updated store UIDs
    *   **Note:** Uses upsert pattern - if UID exists, updates; otherwise creates

#### List Stores
*   **GET** `/store`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of stores with pagination metadata

#### Upsert Store Inventory
*   **POST** `/store/inventory`
    *   **Description:** Create or update inventory for products in specific stores.
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "store_uid": "store-123",
              "product_uid": "prod-456",
              "quantity": 100
            },
            {
              "store_uid": "store-123",
              "product_uid": "prod-789",
              "quantity": 50
            }
          ]
        }
        ```
    *   **Response:** Success message
    *   **Validations:**
        - Store must exist
        - Product must exist
        - Quantity must be >= 0
    *   **Use Case:** Set or update stock levels for products at specific locations.

---

### Batch Operations for Stores and Inventory

The following batch endpoints support efficient multi-entity operations with array-based requests. These endpoints follow the `{"data": [...]}` pattern and significantly reduce HTTP overhead for bulk operations.

#### Get Stores Batch
*   **POST** `/store/batch`
    *   **Description:** Retrieve multiple stores by their UIDs in a single request
    *   **Request Body:**
        ```json
        {
          "data": ["store-uid-1", "store-uid-2", "store-uid-3"]
        }
        ```
    *   **Response:**
        ```json
        {
          "status": "success",
          "data": [
            {
              "uid": "store-uid-1",
              "name": "Main Warehouse",
              "active": true,
              "last_update": "2025-01-21T10:00:00Z"
            },
            {
              "uid": "store-uid-2",
              "name": "Regional Center",
              "active": true,
              "last_update": "2025-01-21T10:00:00Z"
            }
          ]
        }
        ```
    *   **Use Case:** Load multiple store details efficiently (e.g., for dropdown lists, reports)

#### Delete Stores Batch
*   **POST** `/store/delete`
    *   **Description:** Delete multiple stores by their UIDs in a single request
    *   **Request Body:**
        ```json
        {
          "data": ["store-uid-1", "store-uid-2", "store-uid-3"]
        }
        ```
    *   **Response:** Success message
    *   **Use Case:** Bulk cleanup operations, admin management

#### Update Stores Active Status Batch
*   **POST** `/store/active`
    *   **Description:** Update active status for multiple stores in a single request
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "store-uid-1",
              "active": false
            },
            {
              "uid": "store-uid-2",
              "active": true
            }
          ]
        }
        ```
    *   **Response:** Success message
    *   **Use Case:** Bulk activate/deactivate stores

#### Get Inventory by Stores Batch
*   **POST** `/store/inventory/batch`
    *   **Description:** Retrieve inventory for multiple stores in a single request
    *   **Request Body:**
        ```json
        {
          "data": ["store-uid-1", "store-uid-2"]
        }
        ```
    *   **Response:**
        ```json
        {
          "status": "success",
          "data": {
            "store-uid-1": [
              {
                "store_uid": "store-uid-1",
                "product_uid": "prod-1",
                "quantity": 100,
                "last_update": "2025-01-21T10:00:00Z"
              },
              {
                "store_uid": "store-uid-1",
                "product_uid": "prod-2",
                "quantity": 50,
                "last_update": "2025-01-21T10:00:00Z"
              }
            ],
            "store-uid-2": [
              {
                "store_uid": "store-uid-2",
                "product_uid": "prod-1",
                "quantity": 75,
                "last_update": "2025-01-21T10:00:00Z"
              }
            ]
          }
        }
        ```
    *   **Use Case:** Compare inventory across multiple locations

#### Get Inventory by Products Batch
*   **POST** `/store/inventory/find/product`
    *   **Description:** Retrieve inventory for multiple products across all stores
    *   **Request Body:**
        ```json
        {
          "data": ["product-uid-1", "product-uid-2", "product-uid-3"]
        }
        ```
    *   **Response:**
        ```json
        {
          "status": "success",
          "data": {
            "product-uid-1": [
              {
                "store_uid": "store-1",
                "product_uid": "product-uid-1",
                "quantity": 100,
                "last_update": "2025-01-21T10:00:00Z"
              },
              {
                "store_uid": "store-2",
                "product_uid": "product-uid-1",
                "quantity": 75,
                "last_update": "2025-01-21T10:00:00Z"
              }
            ],
            "product-uid-2": [...]
          }
        }
        ```
    *   **Use Case:** See which stores stock specific products and their quantities

#### Get Inventory by Store-Products (Nested Batch)
*   **POST** `/store/inventory/get`
    *   **Description:** Retrieve inventory for specific store-product combinations using nested arrays
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "store_uid": "store-uid-1",
              "product_uids": ["prod-1", "prod-2", "prod-3"]
            },
            {
              "store_uid": "store-uid-2",
              "product_uids": ["prod-1", "prod-4"]
            }
          ]
        }
        ```
    *   **Response:**
        ```json
        {
          "status": "success",
          "data": {
            "store-uid-1": [
              {
                "store_uid": "store-uid-1",
                "product_uid": "prod-1",
                "quantity": 100,
                "last_update": "2025-01-21T10:00:00Z"
              },
              {
                "store_uid": "store-uid-1",
                "product_uid": "prod-2",
                "quantity": 50,
                "last_update": "2025-01-21T10:00:00Z"
              }
            ],
            "store-uid-2": [...]
          }
        }
        ```
    *   **Use Case:** Get specific inventory items efficiently (e.g., client checking availability for their cart at their assigned store)

#### Delete Inventory Batch
*   **POST** `/store/inventory/delete`
    *   **Description:** Delete multiple store-product inventory entries
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "store_uid": "store-uid-1",
              "product_uid": "prod-1"
            },
            {
              "store_uid": "store-uid-1",
              "product_uid": "prod-2"
            },
            {
              "store_uid": "store-uid-2",
              "product_uid": "prod-3"
            }
          ]
        }
        ```
    *   **Response:** Success message
    *   **Use Case:** Bulk inventory cleanup, discontinuing products

#### Get Available Quantity Batch (Nested Batch)
*   **POST** `/store/inventory/available`
    *   **Description:** Get available quantities (after allocations) for multiple store-product pairs using nested arrays
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "store_uid": "store-uid-1",
              "product_uids": ["prod-1", "prod-2"]
            },
            {
              "store_uid": "store-uid-2",
              "product_uids": ["prod-1", "prod-3"]
            }
          ]
        }
        ```
    *   **Response:**
        ```json
        {
          "status": "success",
          "data": {
            "store-uid-1": {
              "prod-1": 85,
              "prod-2": 45
            },
            "store-uid-2": {
              "prod-1": 60,
              "prod-3": 30
            }
          }
        }
        ```
    *   **Calculation:** For each store-product pair: `available = store_inventory.quantity - SUM(allocations WHERE store_uid = X AND product_uid = Y)`
    *   **Use Case:** Real-time availability checking for shopping carts, order validation across multiple items and stores

---

### Batch Operations Benefits

The batch endpoints provide significant advantages:

1. **Performance**: Reduce 100 HTTP requests to 1 request
2. **Efficiency**: Single database query with IN clause vs N queries
3. **Consistency**: Atomic data retrieval ensures consistent state
4. **Network**: Minimize HTTP overhead and latency
5. **Scalability**: Better server resource utilization

---

### Category

#### Category Description Format
**IMPORTANT:** Category descriptions now automatically include parent category names:

- When retrieving category descriptions via `GET /category/description/{categoryUID}`, the `name` field will include the parent category name as a prefix
- Format: `"Parent Name Child Name"` (if parent exists and has a description in the same language)
- If no parent exists or parent has no description in that language, only the category name is returned
- This applies to all languages independently (parent name in EN will prefix child name in EN, etc.)

**Example:**
- Category "Smartphones" with parent "Electronics"
- Returned name: `"Electronics Smartphones"`
- Without parent: `"Smartphones"`

This feature helps with:
- Displaying full category paths
- Better context for nested categories
- Improved navigation and breadcrumbs

#### Upsert Categories (Create or Update)
*   **POST** `/category`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "cat-123", // Optional for create, required for update
              "parent_uid": "cat-parent"
            }
          ]
        }
        ```
    *   **Response:** Array of created/updated category UIDs

#### List Categories
*   **GET** `/category`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of categories with metadata

#### Get Categories Batch
*   **POST** `/category/batch`
    *   **Description:** Retrieve multiple categories by their UIDs.
    *   **Request Body:**
        ```json
        {
          "data": ["cat-123", "cat-456"]
        }
        ```
    *   **Response:** Array of category objects.

#### Delete Categories Batch
*   **POST** `/category/delete`
    *   **Description:** Delete multiple categories by their UIDs.
    *   **Request Body:**
        ```json
        {
          "data": ["cat-123", "cat-456", "cat-789"]
        }
        ```
    *   **Response:** Success message.

#### Find Categories by Parent UIDs Batch
*   **POST** `/category/find/parent`
    *   **Description:** Find multiple categories by their parent UIDs.
    *   **Request Body:**
        ```json
        {
          "data": ["parent-cat-1", "parent-cat-2"]
        }
        ```
    *   **Response:** Array of category objects.

#### Upsert Category Descriptions (Batch)
*   **POST** `/category/description`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "category_uid": "cat-123",
              "language": "en",
              "name": "Electronics",
              "description": "Electronic devices and accessories"
            },
            {
              "category_uid": "cat-123",
              "language": "es",
              "name": "Electrónica",
              "description": "Dispositivos electrónicos y accesorios"
            }
          ]
        }
        ```
    *   **Response:** Success message

#### Delete Category Descriptions Batch
*   **POST** `/category/description/delete`
    *   **Description:** Delete multiple category descriptions.
    *   **Request Body:**
        ```json
        {
          "data": [
            {"category_uid": "cat-123", "language": "en"},
            {"category_uid": "cat-123", "language": "es"}
          ]
        }
        ```
    *   **Response:** Success message.

#### Get Batch Category Descriptions
*   **POST** `/category/description/batch`
    *   **Description:** Retrieve descriptions for multiple categories.
    *   **Request Body:**
        ```json
        {
          "data": ["cat-123", "cat-456"]
        }
        ```
    *   **Response:** Array of category description objects.
    *   **Response Format:**
        ```json
        {
          "success": true,
          "data": [
            {
              "category_uid": "cat-smartphones",
              "language": "en",
              "name": "Electronics Smartphones",  // Includes parent name prefix
              "description": "Mobile phones and accessories",
              "last_update": "2025-11-18T10:00:00Z"
            },
            {
              "category_uid": "cat-smartphones",
              "language": "es",
              "name": "Electrónica Teléfonos Inteligentes",  // Parent name in Spanish + child name in Spanish
              "description": "Teléfonos móviles y accesorios",
              "last_update": "2025-11-18T10:00:00Z"
            }
          ]
        }
        ```
    *   **Note:** The `name` field automatically includes the parent category name as a prefix when available in the same language

---

### Currency

#### Upsert Currencies (Create or Update)
*   **POST** `/currency`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "code": "USD",
              "name": "US Dollar",
              "rate": 1.0
            },
            {
              "code": "EUR",
              "name": "Euro",
              "rate": 0.85
            }
          ]
        }
        ```
    *   **Response:** Array of created/updated currency codes

#### List Currencies
*   **GET** `/currency`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of currencies with metadata

#### Get Currencies Batch
*   **POST** `/currency/batch`
    *   **Description:** Retrieve multiple currencies by their codes.
    *   **Request Body:**
        ```json
        {
          "data": ["USD", "EUR"]
        }
        ```
    *   **Response:** Array of currency objects.

#### Delete Currencies Batch
*   **POST** `/currency/delete`
    *   **Description:** Delete multiple currencies by their codes.
    *   **Request Body:**
        ```json
        {
          "data": ["USD", "EUR", "GBP"]
        }
        ```
    *   **Response:** Success message.

---

### Attribute

#### Upsert Attributes (Create or Update)
*   **POST** `/attribute`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "attr-123", // Optional for create, required for update
              "product_uid": "prod-456",
              "value_uid": "val-789"
            }
          ]
        }
        ```
    *   **Response:** Array of created/updated attribute UIDs

#### List Attributes
*   **GET** `/attribute`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of attributes with metadata

#### Get Attributes Batch
*   **POST** `/attribute/batch`
    *   **Description:** Retrieve multiple attributes by their UIDs.
    *   **Request Body:**
        ```json
        {
          "data": ["attr-123", "attr-456"]
        }
        ```
    *   **Response:** Array of attribute objects.

#### Delete Attributes Batch
*   **POST** `/attribute/delete`
    *   **Description:** Delete multiple attributes by their UIDs.
    *   **Request Body:**
        ```json
        {
          "data": ["attr-123", "attr-456", "attr-789"]
        }
        ```
    *   **Response:** Success message.

#### Find Attributes by Product UIDs Batch
*   **POST** `/attribute/find/product`
    *   **Description:** Find multiple attributes by their product UIDs.
    *   **Request Body:**
        ```json
        {
          "data": ["prod-123", "prod-456"]
        }
        ```
    *   **Response:** Array of attribute objects.

#### Upsert Attribute Descriptions (Batch)
*   **POST** `/attribute/description`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "attribute_uid": "attr-123",
              "language": "en",
              "name": "Color"
            },
            {
              "attribute_uid": "attr-123",
              "language": "es",
              "name": "Color"
            }
          ]
        }
        ```
    *   **Response:** Success message

#### Delete Attribute Descriptions Batch
*   **POST** `/attribute/description/delete`
    *   **Description:** Delete multiple attribute descriptions.
    *   **Request Body:**
        ```json
        {
          "data": [
            {"attribute_uid": "attr-123", "language": "en"},
            {"attribute_uid": "attr-123", "language": "es"}
          ]
        }
        ```
    *   **Response:** Success message.

#### Get Batch Attribute Descriptions
*   **POST** `/attribute/description/batch`
    *   **Description:** Retrieve descriptions for multiple attributes.
    *   **Request Body:**
        ```json
        {
          "data": ["attr-123", "attr-456"]
        }
        ```
    *   **Response:** Array of attribute description objects.

#### Upsert Attribute Values (Batch)
*   **POST** `/attribute/value`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "val-123",
              "language": "en",
              "name": "Red"
            },
            {
              "uid": "val-123",
              "language": "es",
              "name": "Rojo"
            }
          ]
        }
        ```
    *   **Response:** Success message

#### Delete Attribute Values Batch
*   **POST** `/attribute/value/delete`
    *   **Description:** Delete multiple attribute values.
    *   **Request Body:**
        ```json
        {
          "data": [
            {"uid": "val-123", "language": "en"},
            {"uid": "val-123", "language": "es"}
          ]
        }
        ```
    *   **Response:** Success message.

#### Get Batch Attribute Values
*   **POST** `/attribute/value/batch`
    *   **Description:** Retrieve values for multiple attributes.
    *   **Request Body:**
        ```json
        {
          "data": ["val-123", "val-456"]
        }
        ```
    *   **Response:** Array of attribute value objects.

---

### Cleanup

#### Delete Records Older Than a Specific Date
*   **POST** `/cleanup`
    *   **Description:** Deletes all records in various tables that have a `created_at` timestamp older than the provided date.
    *   **Request Body:**
        ```json
        {
          "date": "2023-01-01T00:00:00Z" // Date in RFC3339 format
        }
        ```
    *   **Response:**
        ```json
        {
          "data": {},
          "success": true,
          "status_message": "Success",
          "timestamp": "2023-10-27T10:00:00Z"
        }
        ```
        Or an error response if cleanup fails or date format is invalid.

---

## Pagination Metadata

List endpoints now return pagination metadata:
```json
{
  "data": [...],
  "success": true,
  "status_message": "Success",
  "timestamp": "2023-10-27T10:00:00Z",
  "metadata": {
    "offset": 0,
    "limit": 100,
    "total": 250
  }
}
```

## Database-Level Upserts

The following operations use true database-level upserts (INSERT ... ON DUPLICATE KEY UPDATE):
- Order Items: Based on composite key (order_uid + product_uid)
- Product Descriptions: Based on composite PRIMARY KEY (product_uid + language)
- Category Descriptions: Based on composite PRIMARY KEY (category_uid + language)
- Attribute Descriptions: Based on composite PRIMARY KEY (attribute_uid + language)
- Attribute Values: Based on composite PRIMARY KEY (uid + language)
- Order Statuses: Based on composite PRIMARY KEY (status + language)

This ensures atomic operations and prevents race conditions.

## Batch Retrieval Endpoints

To minimize HTTP requests and improve performance, the following batch retrieval endpoints should be implemented for all main entities:

**Pattern**: `POST /{entity}/batch`
**Request Body**: `{ "data": ["uid1", "uid2", "uid3"] }`
**Response**: Array of entity objects

### Recommended Batch Endpoints

**User**:
- `POST /user/batch` - Get multiple users by UIDs ✅
- `POST /user/delete` - Delete multiple users by UIDs ✅
- `POST /user/find/email` - Find multiple users by emails ✅
- `POST /user/find/username` - Find multiple users by usernames ✅

**Product**:
- `POST /product/batch` - Get multiple products by UIDs ✅
- `POST /product/delete` - Delete multiple products by UIDs ✅
- `POST /product/find/category` - Find multiple products by category UIDs ✅
- `POST /product/description/delete` - Delete multiple product descriptions ✅
- `POST /product/descriptions/batch` - Get descriptions for multiple products ✅ (Already implemented)

**Category**:
- `POST /category/batch` - Get multiple categories by UIDs ✅
- `POST /category/delete` - Delete multiple categories by UIDs ✅
- `POST /category/find/parent` - Find multiple categories by parent UIDs ✅
- `POST /category/description/batch` - Get descriptions for multiple categories ✅
- `POST /category/description/delete` - Delete multiple category descriptions ✅

**Client**:
- `POST /client/batch` - Get multiple clients by UIDs ✅
- `POST /client/delete` - Delete multiple clients by UIDs ✅
- `POST /client/find/email` - Find multiple clients by emails ✅

**Store**:
- `POST /store/batch` - Get multiple stores by UIDs ✅
- `POST /store/delete` - Delete multiple stores by UIDs ✅
- `POST /store/active` - Update active status for multiple stores ✅
- `POST /store/inventory/batch` - Get inventory by stores ✅
- `POST /store/inventory/find/product` - Get inventory by products ✅
- `POST /store/inventory/get` - Get inventory by store-products (nested) ✅
- `POST /store/inventory/delete` - Delete inventory batch ✅
- `POST /store/inventory/available` - Get available quantity batch (nested) ✅

**Order**:
- `POST /order/batch` - Get multiple orders by UIDs ✅
- `POST /order/delete` - Delete multiple orders by UIDs ✅
- `POST /order/find/user` - Find multiple orders by user UIDs ✅
- `POST /order/find/status` - Find multiple orders by statuses ✅
- `POST /order/item/delete` - Delete multiple order items ✅
- `POST /order/items/batch` - Get items for multiple orders ✅ (Already implemented)

**Attribute**:
- `POST /attribute/batch` - Get multiple attributes by UIDs ✅
- `POST /attribute/delete` - Delete multiple attributes by UIDs ✅
- `POST /attribute/find/product` - Find multiple attributes by product UIDs ✅
- `POST /attribute/description/batch` - Get descriptions for multiple attributes ✅
- `POST /attribute/description/delete` - Delete multiple attribute descriptions ✅
- `POST /attribute/value/batch` - Get values for multiple attributes ✅
- `POST /attribute/value/delete` - Delete multiple attribute values ✅

**Currency**:
- `POST /currency/batch` - Get multiple currencies by codes ✅
- `POST /currency/delete` - Delete multiple currencies by codes ✅

**Order Status**:
- `POST /order_status/batch` - Get multiple order statuses ✅
- `POST /order_status/delete` - Delete multiple order statuses ✅

### Implementation Guidelines

For each batch endpoint:
1. **Input Validation**: Ensure array is not empty, limit to reasonable size (e.g., max 1000 UIDs)
2. **Efficient Queries**: Use SQL `IN` clause for optimal database performance
3. **Response Order**: Return entities in same order as input UIDs when possible
4. **Missing Entities**: Include only found entities, omit missing ones (don't error)
5. **Error Handling**: Return error only for invalid request format, not for missing entities

**Example Implementation Pattern**:
```go
// Repository Layer
func (r *ProductRepo) GetByUIDs(ctx context.Context, uids []string) ([]entity.Product, error) {
    query := "SELECT * FROM products WHERE uid IN (?)"
    // Use SQL IN clause with prepared statement
    rows, err := r.db.QueryContext(ctx, query, uids)
    // ... scan and return results
}

// Core Layer
func (c *Core) GetProductsByUIDs(ctx context.Context, uids []string) ([]entity.Product, error) {
    if len(uids) == 0 {
        return nil, fmt.Errorf("empty UIDs array")
    }
    return c.factory.Product().GetByUIDs(ctx, uids)
}

// Handler Layer
func GetProductsBatch(logger *slog.Logger, product Core) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        req, err := request.Decode(r)
        // ... decode request

        var uids []string
        err = request.DecodeArrayData(req, &uids)
        // ... error handling

        products, err := product.GetProductsByUIDs(r.Context(), uids)
        render.JSON(w, r, response.Ok(products))
    }
}
```

## Authentication Summary

This API uses JWT-based authentication with support for both **Users** (username+password) and **Clients** (phone+pincode).

**Key Points:**
- Access tokens expire after 15 minutes
- Refresh tokens are valid for 7 days
- Multi-device support with token management
- All endpoints except `/auth/login` and `/auth/refresh` require authentication

**See the [Authentication](#authentication) section above for complete details and examples.**

For detailed authentication documentation, see [AUTH_API_REFERENCE.md](../AUTH_API_REFERENCE.md)
