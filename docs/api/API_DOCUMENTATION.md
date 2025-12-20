# API Documentation

This document covers authentication, common patterns, and API conventions.

For endpoint documentation, see:
- **[API_STRUCTURE.md](API_STRUCTURE.md)** - Complete endpoint list with links
- **[FRONTEND_API.md](FRONTEND_API.md)** - Frontend API for clients
- **[DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md)** - Data management endpoints for staff
- **[ADMIN_API.md](ADMIN_API.md)** - Admin-only endpoints

---

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
- `POST /logs` - Submit frontend logs

### Protected Endpoints (Require Authentication)

All other endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-access-token>
```

---

## Authentication Endpoints

### Login

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

### Refresh Token

**POST** `/auth/refresh`

**Request:**
```json
{
  "refresh_token": "xyz789abc..."
}
```

**Response:** Same as login response with new tokens

### Get Current User/Client Info

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

### Logout (Revoke Current Token)

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

### List Active Tokens (All Devices)

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

### Revoke Specific Token (Logout from Specific Device)

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

### Revoke All Tokens (Logout from All Devices)

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

---

## Token Lifecycle

- **Access Token Duration**: 15 minutes
- **Refresh Token Duration**: 7 days
- **Token Rotation**: New refresh token issued on each refresh (old one revoked)
- **Multi-Device Support**: Multiple active tokens per user/client
- **Immediate Revocation**: Tokens checked against database on each request

---

## Example: Complete Authentication Flow

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

---

## Error Responses

**401 Unauthorized** - Invalid credentials, expired token, or revoked token:
```json
{
  "status": "error",
  "message": "unauthorized"
}
```

**403 Forbidden** - Attempting to access another user's resources or insufficient privileges:
```json
{
  "status": "error",
  "message": "Access denied: admin privileges required"
}
```

---

## Common Patterns

### Upsert Pattern

All POST endpoints follow the **upsert pattern** (create OR update):
- If entity with UID exists: **UPDATE**
- If entity doesn't exist: **CREATE**
- No separate create/update endpoints

### Batch Operations

All main entity operations support **batch upsert**, **batch delete**, and **batch retrieval** operations using array inputs.

**Benefits:**
- Reduces N+1 query problems
- Minimizes HTTP overhead
- Improves frontend performance
- Example: Load 100 products in 1 request instead of 100 requests

### Request Format

All requests that modify or retrieve data use a standardized format:
```json
{
  "data": [ /* array of objects or UIDs */ ]
}
```

**Batch Retrieval Request:**
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
```

---

## Common Response Structure

**Success Response:**
```json
{
    "data": {},
    "success": true,
    "status_message": "Success",
    "timestamp": "2023-10-27T10:00:00Z"
}
```

**Error Response:**
```json
{
    "data": null,
    "success": false,
    "status_message": "Error message",
    "timestamp": "2023-10-27T10:00:00Z"
}
```

---

## Pagination

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

---

## Database-Level Upserts

The following operations use true database-level upserts (INSERT ... ON DUPLICATE KEY UPDATE):
- Order Items: Based on composite key (order_uid + product_uid)
- Product Descriptions: Based on composite PRIMARY KEY (product_uid + language)
- Product Images: Based on composite PRIMARY KEY (product_uid + sort_order)
- Category Descriptions: Based on composite PRIMARY KEY (category_uid + language)
- Attribute Descriptions: Based on composite PRIMARY KEY (attribute_uid + language)
- Attribute Values: Based on composite PRIMARY KEY (uid + language)
- Order Statuses: Based on composite PRIMARY KEY (status + language)
- Prices: Based on composite PRIMARY KEY (price_type_uid + product_uid)
- Countries: Based on PRIMARY KEY (country_code)
- Client Addresses: Based on PRIMARY KEY (uid)

This ensures atomic operations and prevents race conditions.
