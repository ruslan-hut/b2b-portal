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

#### Upsert Products (Create or Update)
*   **POST** `/product`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "prod-123", // Optional for create, required for update
              "price": 1000,
              "quantity": 50,
              "category_uid": "cat-456",
              "active": true // Optional, defaults to true
            }
          ]
        }
        ```
    *   **Response:** Array of created/updated product UIDs

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
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "prod-123",
              "quantity": 50
            },
            {
              "uid": "prod-456",
              "quantity": 100
            }
          ]
        }
        ```
    *   **Response:** Success message

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

---

### Order

#### Upsert Orders (Create or Update)
*   **POST** `/order`
    *   **Request Body:**
        ```json
        {
          "data": [
            {
              "uid": "order-123", // Optional for create, required for update
              "user_uid": "user-456",
              "status": "pending",
              "total": 5000.0,
              "shipping_address": "123 Main St",
              "billing_address": "123 Main St"
            }
          ]
        }
        ```
    *   **Response:** Array of created/updated order UIDs

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
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of orders

#### Find Orders by Status
*   **GET** `/order/status/{status}`
    *   **Query Parameters:**
        *   `offset`: (optional) integer, default 0
        *   `limit`: (optional) integer, default 100
    *   **Response:** Array of orders

#### Update Order Status
*   **PUT** `/order/status` - Batch update order statuses (Array Input)
    *   **Request Body:**
        ```json
        {
          "data": [
            {"uid": "order-123", "status": "shipped"},
            {"uid": "order-456", "status": "delivered"},
            {"uid": "order-789", "status": "cancelled"}
          ]
        }
        ```
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
    *   **Note:** Uses database-level upsert based on order_uid + product_uid
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

#### Get Order Items
*   **GET** `/order/{orderUID}/items`
    *   **Response:** Array of order items

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
