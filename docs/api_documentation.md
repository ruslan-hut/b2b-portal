# Frontend API Documentation

This document outlines the API endpoints relevant for the frontend application. For complete backend API documentation, see [Backend API Documentation](../../backend/docs/api_documentation.md).

## Base Path
`/api/v1`

---

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

### Token Lifecycle

- **Access Token Duration**: 15 minutes
- **Refresh Token Duration**: 7 days
- **Token Rotation**: New refresh token issued on each refresh (old one revoked)
- **Multi-Device Support**: Multiple active tokens per user/client
- **Immediate Revocation**: Tokens checked against database on each request

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

---

## Common Rules

### Request Format
All requests that modify or retrieve data use a standardized format:
```json
{
  "data": [ /* array of objects or UIDs */ ]
}
```

### Response Structure

All successful responses will have the following structure:
```json
{
    "data": {},
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

### Pagination Metadata

List endpoints return pagination metadata:
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

### Batch Operations Support
All main entity operations support **batch retrieval** operations using array inputs:
- **Single entity**: `GET /entity/{uid}` - Get one entity
- **Multiple entities**: `POST /entity/batch` - Get multiple entities by UIDs

**Batch Retrieval Request Format:**
```json
{
  "data": ["uid1", "uid2", "uid3"]
}
```

---

## Optimized Frontend Endpoints (Recommended)

These endpoints are specifically designed for the frontend and combine multiple data sources into single responses.

### Unified Products Endpoint

#### Get Frontend Products (Recommended)
*   **GET** `/frontend/products`
    *   **Description:** Returns products with **all calculated prices, descriptions, and availability** in a single request. This is the recommended endpoint for the product catalog.
    *   **Authentication:** Required (client only)
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
        *   `language`: (optional) string, default "en"
        *   `category`: (optional) string, category UID to filter by
    *   **What it does internally:**
        1. Extracts client from JWT token
        2. Loads client's `store_uid`, `price_type_uid`, `discount`, `vat_rate`
        3. Fetches products (with pagination/category filter)
        4. Batch-fetches product descriptions in requested language
        5. Batch-fetches category names in requested language
        6. Batch-fetches prices for client's price type
        7. Batch-fetches available quantities for client's store
        8. Calculates all price variants
    *   **Response:**
        ```json
        {
          "success": true,
          "data": [
            {
              "uid": "prod-123",
              "name": "Product Name (localized)",
              "description": "Product description (localized)",
              "base_price": 1999,
              "price_with_vat": 2399,
              "price_with_discount": 1799,
              "price_final": 2159,
              "vat_rate": 20.0,
              "discount_percent": 10,
              "available_quantity": 50,
              "category_uid": "cat-456",
              "category_name": "Electronics",
              "image": "https://...",
              "is_new": true,
              "is_hot_sale": false,
              "sort_order": 10,
              "sku": "PROD-123"
            }
          ],
          "pagination": { "page": 1, "count": 100, "total": 250 }
        }
        ```
    *   **Price Fields (all in cents):**
        *   `base_price`: Base price without VAT or discount
        *   `price_with_vat`: Base price + VAT (no discount)
        *   `price_with_discount`: Base price - discount (no VAT)
        *   `price_final`: Final price (base - discount + VAT)

### Product Images Endpoint

#### Get Main Product Images (Batch)
*   **POST** `/frontend/product/images`
    *   **Description:** Returns main images for multiple products. Images are stored as Base64 in the database and should be cached in IndexedDB on the frontend.
    *   **Authentication:** Required (client only)
    *   **Request Body:**
        ```json
        {
          "data": ["prod-123", "prod-456", "prod-789"]
        }
        ```
    *   **Response:**
        ```json
        {
          "success": true,
          "data": {
            "prod-123": {
              "file_data": "data:image/png;base64,iVBORw0KGgo...",
              "last_update": "2025-12-17T10:30:00Z"
            },
            "prod-456": {
              "file_data": "data:image/jpeg;base64,/9j/4AAQ...",
              "last_update": "2025-12-15T08:00:00Z"
            }
          }
        }
        ```
    *   **Caching Strategy:**
        *   Store images in IndexedDB with `last_update` timestamp
        *   On subsequent requests, compare `last_update` to detect changes
        *   Convert Base64 to Blob URLs for display

---

## Standard Product Endpoints

#### List Products
*   **GET** `/product`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of products with metadata

#### Get Products Batch
*   **POST** `/product/batch`
    *   **Request Body:**
        ```json
        {
          "data": ["prod-123", "prod-456"]
        }
        ```
    *   **Response:** Array of product objects.

#### Find Products by Category Batch
*   **POST** `/product/find/category`
    *   **Request Body:**
        ```json
        {
          "data": ["cat-123", "cat-456"]
        }
        ```
    *   **Response:** Array of product objects.

#### Get Batch Product Descriptions
*   **POST** `/product/descriptions/batch`
    *   **Description:** Retrieve simplified product descriptions (UID + Name + Description) for multiple products in a specific language.
    *   **Query Parameters:**
        *   `language`: (required) string
    *   **Request Body:**
        ```json
        {
          "data": ["prod-123", "prod-456"]
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
          ]
        }
        ```

---

### Order

#### Order Status Flow (Frontend Perspective)

```
Frontend:    "draft" (saved cart)  →  "new" (user confirmed)
             ↓                        ↓
             No allocation           Stock validated, allocation created
```

**Frontend Can Only Create:**
- **Status `"draft"`** - Save cart for later
- **Status `"new"`** - Confirm order and reserve inventory

**Status Descriptions:**
- **`"draft"`**: Saved cart, no validation, no allocation
- **`"new"`**: User confirmed order, stock validated, allocation created
- **`"processing"`**: CRM processing (read-only for frontend)
- **`"confirmed"`**: CRM fulfilled order (read-only for frontend)

#### Upsert Orders (Create or Update)
*   **POST** `/order`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "order-123",
              "user_uid": "user-456",
              "status": "draft",
              "total": 5000.0,
              "shipping_address": "123 Main St",
              "billing_address": "123 Main St",
              "comment": "Please deliver after 5 PM",
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

#### List Orders
*   **GET** `/order`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of orders with metadata

#### Get Orders Batch
*   **POST** `/order/batch`
    *   **Request Body:**
        ```json
        {
          "data": ["order-123", "order-456"]
        }
        ```
    *   **Response:** Array of order objects.

#### Delete Orders Batch
*   **POST** `/order/delete`
    *   **Request Body:**
        ```json
        {
          "data": ["order-123", "order-456"]
        }
        ```
    *   **Response:** Success message.

#### Find Orders by User UIDs Batch
*   **POST** `/order/find/user`
    *   **Request Body:**
        ```json
        {
          "data": ["user-123", "user-456"]
        }
        ```
    *   **Response:** Array of order objects.

#### Find Orders by Statuses Batch
*   **POST** `/order/find/status`
    *   **Request Body:**
        ```json
        {
          "data": ["new", "processing"]
        }
        ```
    *   **Response:** Array of order objects.

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
            }
          ]
        }
        ```
    *   **Response:** Success message

#### Delete Order Items Batch
*   **POST** `/order/item/delete`
    *   **Request Body:**
        ```json
        {
          "data": [
            {"order_uid": "order-123", "product_uid": "prod-456"}
          ]
        }
        ```
    *   **Response:** Success message

#### Get Batch Order Items
*   **POST** `/order/items/batch`
    *   **Request Body:**
        ```json
        {
          "data": ["order-123", "order-456"]
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
                "total": 1800.0
              }
            ]
          ]
        }
        ```

---

### Order Status

#### List Order Statuses
*   **GET** `/order_status`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of order statuses with metadata

#### Get Order Statuses Batch
*   **POST** `/order_status/batch`
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

---

### Category

#### List Categories
*   **GET** `/category`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of categories with metadata

#### Get Categories Batch
*   **POST** `/category/batch`
    *   **Request Body:**
        ```json
        {
          "data": ["cat-123", "cat-456"]
        }
        ```
    *   **Response:** Array of category objects.

#### Find Categories by Parent UIDs Batch
*   **POST** `/category/find/parent`
    *   **Request Body:**
        ```json
        {
          "data": ["parent-cat-1", "parent-cat-2"]
        }
        ```
    *   **Response:** Array of category objects.

#### Get Batch Category Descriptions
*   **POST** `/category/description/batch`
    *   **Request Body:**
        ```json
        {
          "data": ["cat-123", "cat-456"]
        }
        ```
    *   **Response:** Array of category description objects with parent name prefix when available.

**Note:** Category description names automatically include parent category names as prefix (e.g., "Electronics Smartphones").

---

### Currency

#### List Currencies
*   **GET** `/currency`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of currencies with metadata

#### Get Currencies Batch
*   **POST** `/currency/batch`
    *   **Request Body:**
        ```json
        {
          "data": ["USD", "EUR"]
        }
        ```
    *   **Response:** Array of currency objects.

---

### Price

#### Get Prices for Products Under Specific Price Type (Batch)
*   **POST** `/price/batch/price_type_products`
    *   **Description:** Retrieve prices for multiple products under one specific price type. **Most commonly used endpoint** for displaying product catalogs with user-specific pricing.
    *   **Request Body:**
        ```json
        {
          "data": {
            "price_type_uid": "retail-price-usd",
            "product_uids": ["product-001", "product-002"]
          }
        }
        ```
    *   **Response:**
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
    *   **Use Cases:**
        - Display product catalog with user-specific pricing
        - Shopping cart price calculation
        - Show wholesale prices to business customers

---

### Store Inventory

#### Get Available Quantity Batch
*   **POST** `/store/inventory/available`
    *   **Description:** Get available quantities (after allocations) for multiple store-product pairs.
    *   **Request Body:**
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
    *   **Response:**
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
    *   **Use Case:** Real-time availability checking for shopping carts, order validation

---

### Client (Read-Only for Frontend)

#### Get Current Client Info
*   **GET** `/auth/me`
    *   Returns client information including assigned `store_uid` and `price_type_uid`

---

## Frontend Integration Notes

### Authentication Flow
1. Call `POST /auth/login` with credentials
2. Store `access_token` and `refresh_token`
3. Include `Authorization: Bearer <token>` in all subsequent requests
4. When receiving 401, call `POST /auth/refresh` to get new tokens
5. On logout, call `POST /auth/logout`

### Product Catalog Display (Optimized - Recommended)

**Using unified endpoint (1-2 requests):**

```
Initial Load (Cold Cache):
1. GET /frontend/products?language=en    → Products + prices + availability
2. POST /frontend/product/images         → Main images (cached in IndexedDB)

Subsequent Loads (Warm Cache):
1. GET /frontend/products?language=en    → Products + prices + availability
2. Images loaded from IndexedDB          → 0 requests
```

**Frontend implementation:**
```typescript
// ProductService.getFrontendProducts() uses this endpoint
this.productService.getFrontendProducts(0, 100, category).subscribe(products => {
  // Products already have: name, description, all price variants, availability
  // Load images separately (cached in IndexedDB)
  this.imageCacheService.loadMainImages(products.map(p => p.id)).subscribe();
});
```

### Product Catalog Display (Legacy - Multiple Requests)

**Using separate endpoints (5+ requests):**
1. Get client info via `GET /auth/me` to get `price_type_uid`
2. Fetch products via `GET /product`
3. Get product descriptions via `POST /product/descriptions/batch`
4. Get prices via `POST /price/batch/price_type_products` using client's `price_type_uid`
5. Get available quantities via `POST /store/inventory/available` using client's `store_uid`
6. Get images via `POST /frontend/product/images`

**Note:** This approach is deprecated for the product catalog. Use `GET /frontend/products` instead.

### Shopping Cart & Order Flow
1. Save cart as draft: `POST /order` with `status: "draft"`
2. Update cart items: `POST /order/item`
3. Confirm order: `POST /order` with `status: "new"` (validates stock, creates allocations)
4. View order history: `POST /order/find/user` with current user UID

### Image Caching Strategy

The frontend uses a three-tier caching system for product images:

| Tier | Storage | Lifetime | Speed |
|------|---------|----------|-------|
| Memory | Blob URL Map | Browser session | Instant |
| IndexedDB | Browser database | Persistent | Fast |
| API | Backend database | Permanent | Network |

**Implementation:**
1. Check IndexedDB for cached images
2. If cached, create Blob URLs and return immediately
3. For missing images, fetch from `POST /frontend/product/images`
4. Store new images in IndexedDB
5. Use `last_update` timestamp for cache invalidation

---

## Related Documentation

- [Backend API Documentation](../../backend/docs/api_documentation.md) - Complete API reference
- [Frontend README](../README.md) - Frontend setup and usage
- [Frontend CLAUDE Guide](../CLAUDE.md) - Development patterns
