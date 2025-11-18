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

**Response:**
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
      "role": "admin"
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
All main entity operations (User, Product, Client, Category, Currency, Order, Attribute) support **batch upsert** and **batch delete** operations using array inputs.

### Upsert Pattern
All POST endpoints follow the **upsert pattern** (create OR update):
- If entity with UID exists: **UPDATE**
- If entity doesn't exist: **CREATE**
- No separate create/update endpoints

### Request Format
All requests that modify data use a standardized format:
```json
{
  "data": [ /* array of objects */ ]
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
              "user_role": "string"
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

#### Get User by UID
*   **GET** `/user/{uid}`
    *   **Response:** Single user object

#### Delete Users
*   **DELETE** `/user/{uid}` - Delete single user (backward compatible)
*   **DELETE** `/user` - Batch delete
    *   **Request Body:**
        ```json
        {
          "data": ["user-123", "user-456", "user-789"]
        }
        ```

#### Find User by Email
*   **GET** `/user/email/{email}`
    *   **Response:** Single user object

#### Find User by Username
*   **GET** `/user/username/{username}`
    *   **Response:** Single user object

---

### Product

#### Product Quantity Management
**IMPORTANT:** The product quantity system has been refactored to separate CRM inventory from local order allocations:

- **`product.quantity`**: Stores the quantity received from your external CRM system (read-only for order operations)
- **Order Allocations**: When orders are created with status `"new"`, quantities are allocated in a separate `order_product_allocations` table
- **Available Quantity**: Calculated as `product.quantity - SUM(allocated_quantities)`
- **Stock Updates**: Use `/product/stock` endpoint to update CRM quantities. Order creation/deletion does NOT modify `product.quantity`
- **Allocation Lifecycle**:
  - Created when order status is `"new"` (user confirmed)
  - Maintained during `"processing"` status (CRM fulfilling)
  - Deleted when order status becomes `"confirmed"` (order fulfilled)

This design ensures:
- CRM data remains untouched by order operations
- Accurate available inventory calculation
- Ability to see which orders have reserved which products
- Simple reconciliation with external CRM systems

#### Upsert Products (Create or Update)
*   **POST** `/product`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "prod-123", // Optional for create, required for update
              "price": 1000,
              "quantity": 50, // CRM quantity - not modified by order operations
              "category_uid": "cat-456",
              "active": true // Optional, defaults to true
            }
          ]
        }
        ```
    *   **Response:** Array of created/updated product UIDs
    *   **Note:** The `quantity` field represents CRM inventory and is NOT automatically decreased when orders are created

#### List Products
*   **GET** `/product`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of products with metadata

#### Get Product by UID
*   **GET** `/product/{uid}`
    *   **Response:** Single product object

#### Delete Products
*   **DELETE** `/product/{uid}` - Delete single product (backward compatible)
*   **DELETE** `/product` - Batch delete
    *   **Request Body:**
        ```json
        {
          "data": ["prod-123", "prod-456", "prod-789"]
        }
        ```

#### Find Products by Category
*   **GET** `/product/category/{categoryUID}`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of products

#### Update Product Stock (Batch)
*   **POST** `/product/stock`
    *   **Description:** Updates CRM quantity for products. This should be used when syncing with external CRM system. Order creation/deletion does NOT affect this value.
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "prod-123",
              "quantity": 50  // New CRM quantity
            },
            {
              "uid": "prod-456",
              "quantity": 100
            }
          ]
        }
        ```
    *   **Response:** Success message
    *   **Use Case:** Synchronizing inventory from external CRM/ERP systems

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

#### Remove Product Descriptions
*   **DELETE** `/product/description/{productUID}/{language}` - Delete single (backward compatible)
*   **DELETE** `/product/description` - Batch delete
    *   **Request Body:**
        ```json
        {
          "data": [
            {"product_uid": "prod-123", "language": "en"},
            {"product_uid": "prod-123", "language": "es"}
          ]
        }
        ```

#### Get Product Descriptions
*   **GET** `/product/description/{productUID}`
    *   **Response:** Array of product descriptions

#### Get Batch Product Descriptions
*   **POST** `/product/descriptions/batch`
    *   **Description:** Retrieve simplified product descriptions (UID + Name + Description) for multiple products in a specific language. Useful for bulk operations and displaying product names and descriptions in lists.
    *   **Request Body:**
        ```json
        {
          "product_uids": [
            "prod-123",
            "prod-456"
          ],
          "language": "en"
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
**IMPORTANT:** Order operations now use a product allocation system with a simplified status flow:

**Order Status Flow:**
```
Frontend:    "draft" (saved cart)  →  "new" (user confirmed)
             ↓                        ↓
             No allocation           Allocation created

External CRM:  "new"  →  "processing"  →  "confirmed"
               ↓          ↓               ↓
               Allocated  Allocated       Allocation DELETED (fulfilled)
```

**Status Descriptions:**
- **`"draft"`**: Saved cart, no validation, no allocation
- **`"new"`**: User confirmed order, stock validated, allocation created
- **`"processing"`**: CRM processing, allocation exists
- **`"confirmed"`**: CRM fulfilled order, allocation **deleted**

**Frontend Can Only Create:**
- **Status `"draft"`** - Save cart for later
- **Status `"new"`** - Confirm order and reserve inventory

**External CRM Manages:**
- **`"new"` → `"processing"`** - Begin processing
- **`"processing"` → `"confirmed"`** - Mark as fulfilled (auto-deletes allocation)

---

**When Creating a Draft Order:**
1. Creates order record with status `"draft"`
2. **Does NOT** validate product availability
3. **Does NOT** create allocation records
4. **Does NOT** modify `product.quantity`

**When Creating a "New" Order (User Confirmed):**
1. Validates available quantity: `product.quantity - allocated_quantities`
2. Creates order record with status `"new"`
3. Creates allocation records in `order_product_allocations` table
4. **Does NOT modify** `product.quantity`

**When CRM Changes Status to "Confirmed":**
1. Updates order status to `"confirmed"`
2. **Deletes allocation records** (order fulfilled, inventory shipped)
3. **Does NOT modify** `product.quantity`

**When Deleting/Cancelling an Order:**
1. Removes allocation records (via CASCADE delete for "new" orders)
2. Deletes order record
3. **Does NOT modify** `product.quantity`

**When Adding/Updating Order Items:**
- **Draft Orders (`"draft"`):** Items can be added/updated without validation or allocations
- **New Orders (`"new"`):** Validates available quantity and creates/updates allocations
- **Processing/Confirmed Orders:** **Cannot be modified from frontend** (managed by CRM)

**When Removing Order Items:**
- **Draft Orders (`"draft"`):** Removes items without allocation management
- **New Orders (`"new"`):** Removes items and corresponding allocation records
- **Processing/Confirmed Orders:** **Cannot be modified from frontend** (managed by CRM)

**Key Benefits:**
- Users can save carts without reserving inventory
- Clear separation: frontend creates, CRM manages fulfillment
- Allocations automatically released when order confirmed (fulfilled)
- Product CRM quantity remains unchanged by order operations
- Real-time available inventory calculation

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
    *   **Note:**
        - The `comment` field is optional and can be used to store additional notes about the order
        - Stock validation uses available quantity (CRM quantity - allocated quantity)
        - Creates product allocation records automatically for "new" orders
        - Frontend can only create with "draft" or "new" status
    *   **Example Workflow:**
        1. Create order with `status: "draft"` to save cart → No allocation
        2. Create order with `status: "new"` to confirm → Allocation created
        3. CRM changes to "processing" → Allocation exists
        4. CRM changes to "confirmed" → Allocation deleted

#### List Orders
*   **GET** `/order`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of orders with metadata

#### Get Order by UID
*   **GET** `/order/{uid}`
    *   **Response:** Single order object

#### Delete Orders
*   **DELETE** `/order/{uid}` - Delete single order (backward compatible)
*   **DELETE** `/order` - Batch delete
    *   **Request Body:**
        ```json
        {
          "data": ["order-123", "order-456", "order-789"]
        }
        ```

#### Find Orders by User
*   **GET** `/order/user/{user_uid}`
    *   **Path Parameters:**
        *   `user_uid`: User UID (required)
    *   **Query Parameters (via request body):**
        *   `page`: (optional) integer, default 1
        *   `count`: (optional) integer, default 100
    *   **Example:** `GET /order/user/123`
    *   **Response:** Array of orders with pagination metadata

#### Find Orders by Status
*   **GET** `/order/status/{status}`
    *   **Path Parameters:**
        *   `status`: Order status code (required) - e.g., "pending", "shipped", "delivered"
    *   **Query Parameters (via request body):**
        *   `page`: (optional) integer, default 1
        *   `count`: (optional) integer, default 100
    *   **Example:** `GET /order/status/pending`
    *   **Response:** Array of orders with pagination metadata

#### Update Order Status
*   **PUT** `/order/status` - Batch update order statuses (Array Input)
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

#### Remove Order Items
*   **DELETE** `/order/{orderUID}/item/{productUID}` - Delete single item (backward compatible)
*   **DELETE** `/order/items` - Batch delete
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

#### Get Order Items
*   **GET** `/order/{orderUID}/items`
    *   **Response:** Array of order items

#### Get Batch Order Items
*   **POST** `/order/items/batch`
    *   **Description:** Retrieve order items for multiple orders.
    *   **Request Body:**
        ```json
        {
          "order_uids": [
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

#### Get Order Status by Status and Language Code
*   **GET** `/order_status/{status}/{lang_code}`
    *   **Response:** Single order status object

#### Delete Order Statuses
*   **DELETE** `/order_status` - Batch delete
    *   **Request Body:**
        ```json
        {
          "data": {
            "statuses": ["new", "processing"],
            "lang_codes": ["en", "en"]
          }
        }
        ```
    *   **Response:** Success message

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
              "active": true // Optional, defaults to true
            }
          ]
        }
        ```
    *   **Response:** Array of created/updated client UIDs

#### List Clients
*   **GET** `/client`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of clients with metadata

#### Get Client by UID
*   **GET** `/client/{uid}`
    *   **Response:** Single client object

#### Delete Clients
*   **DELETE** `/client/{uid}` - Delete single client (backward compatible)
*   **DELETE** `/client` - Batch delete
    *   **Request Body:**
        ```json
        {
          "data": ["client-123", "client-456", "client-789"]
        }
        ```

#### Find Client by Email
*   **GET** `/client/email/{email}`
    *   **Response:** Single client object

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

#### Get Category by UID
*   **GET** `/category/{uid}`
    *   **Response:** Single category object

#### Delete Categories
*   **DELETE** `/category/{uid}` - Delete single category (backward compatible)
*   **DELETE** `/category` - Batch delete
    *   **Request Body:**
        ```json
        {
          "data": ["cat-123", "cat-456", "cat-789"]
        }
        ```

#### Find Categories by Parent
*   **GET** `/category/parent/{parentUID}`
    *   **Response:** Array of categories

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

#### Remove Category Descriptions
*   **DELETE** `/category/description/{categoryUID}/{language}` - Delete single (backward compatible)
*   **DELETE** `/category/description` - Batch delete
    *   **Request Body:**
        ```json
        {
          "data": [
            {"category_uid": "cat-123", "language": "en"},
            {"category_uid": "cat-123", "language": "es"}
          ]
        }
        ```

#### Get Category Descriptions
*   **GET** `/category/description/{categoryUID}`
    *   **Response:** Array of category descriptions
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

#### Get Currency by Code
*   **GET** `/currency/{code}`
    *   **Response:** Single currency object

#### Delete Currencies
*   **DELETE** `/currency/{code}` - Delete single currency (backward compatible)
*   **DELETE** `/currency` - Batch delete
    *   **Request Body:**
        ```json
        {
          "data": ["USD", "EUR", "GBP"]
        }
        ```

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

#### Get Attribute by UID
*   **GET** `/attribute/{uid}`
    *   **Response:** Single attribute object

#### Delete Attributes
*   **DELETE** `/attribute/{uid}` - Delete single attribute (backward compatible)
*   **DELETE** `/attribute` - Batch delete
    *   **Request Body:**
        ```json
        {
          "data": ["attr-123", "attr-456", "attr-789"]
        }
        ```

#### Find Attributes by Product
*   **GET** `/attribute/product/{productUID}`
    *   **Response:** Array of attributes

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

#### Remove Attribute Descriptions
*   **DELETE** `/attribute/description/{attributeUID}/{language}` - Delete single (backward compatible)
*   **DELETE** `/attribute/description` - Batch delete
    *   **Request Body:**
        ```json
        {
          "data": [
            {"attribute_uid": "attr-123", "language": "en"},
            {"attribute_uid": "attr-123", "language": "es"}
          ]
        }
        ```

#### Get Attribute Descriptions
*   **GET** `/attribute/description/{attributeUID}`
    *   **Response:** Array of attribute descriptions

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

#### Remove Attribute Values
*   **DELETE** `/attribute/value/{valueUID}/{language}` - Delete single (backward compatible)
*   **DELETE** `/attribute/value` - Batch delete
    *   **Request Body:**
        ```json
        {
          "data": [
            {"uid": "val-123", "language": "en"},
            {"uid": "val-123", "language": "es"}
          ]
        }
        ```

#### Get Attribute Values
*   **GET** `/attribute/value/{valueUID}`
    *   **Response:** Array of attribute values

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

## Authentication Summary

This API uses JWT-based authentication with support for both **Users** (username+password) and **Clients** (phone+pincode).

**Key Points:**
- Access tokens expire after 15 minutes
- Refresh tokens are valid for 7 days
- Multi-device support with token management
- All endpoints except `/auth/login` and `/auth/refresh` require authentication

**See the [Authentication](#authentication) section above for complete details and examples.**

For detailed authentication documentation, see [AUTH_API_REFERENCE.md](../AUTH_API_REFERENCE.md)
