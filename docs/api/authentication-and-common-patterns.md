# API Documentation

This document covers authentication, common patterns, and API conventions.

For endpoint documentation, see:
- **[structure.md](structure.md)** - Complete endpoint list with links
- **[frontend-api.md](frontend-api.md)** - Frontend API for clients
- **[data-management-api.md](data-management-api.md)** - Data management endpoints for staff
- **[admin-api.md](admin-api.md)** - Admin-only endpoints

---

## Base Path

`/api/v1`

---

## Authentication

This API uses **JWT (JSON Web Token)** based authentication with support for two types of entities:
- **Users**: Authenticated with username + password (staff/admin)
- **Clients**: Authenticated with phone + pincode (B2B customers)

### Authentication Flow

1. **Login** to receive access token and refresh token
2. **Include access token** in Authorization header for protected endpoints
3. **Refresh token** when access token expires
4. **Logout** to revoke tokens when done

### Public Endpoints (No Authentication Required)

- `POST /auth/login` - Login as user or client (rate limited)
- `POST /auth/refresh` - Refresh expired access token (rate limited)
- `GET /health` - Health check (returns `{"status":"ok"}`)
- `GET /frontend/languages` - Available product description languages

### Protected Endpoints (Require Authentication)

All other endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <your-access-token>
```

---

## Authentication Endpoints

### Login

**POST** `/auth/login`

Supports both user and client authentication in a single endpoint. The server determines auth type from the request fields.

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
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "xyz789abc...",
    "token_type": "Bearer",
    "expires_in": 900,
    "expires_at": "2025-01-12T10:15:00Z",
    "entity_type": "user",
    "entity_uid": "user-123"
  },
  "success": true,
  "status_message": "Success",
  "timestamp": "2025-01-12T10:00:00Z",
  "request_id": "req-abc123"
}
```

**Response Fields:**
- `access_token` - JWT token for Authorization header
- `refresh_token` - Token for obtaining new access tokens
- `token_type` - Always `"Bearer"`
- `expires_in` - Access token lifetime in seconds
- `expires_at` - Access token expiration timestamp
- `entity_type` - `"user"` or `"client"`
- `entity_uid` - UID of the authenticated entity

**Detection Logic:** If `username` is provided, authenticates as user. Otherwise uses `phone` + `pin_code` for client auth.

### Refresh Token

**POST** `/auth/refresh`

**Request:**
```json
{
  "refresh_token": "xyz789abc..."
}
```

**Response:** Same structure as login response with new access and refresh tokens.

**Notes:**
- Old refresh token is revoked upon successful refresh (token rotation)
- Returns `401 Unauthorized` if refresh token is invalid or revoked

### Get Current User/Client Info

**GET** `/auth/me`

Returns the authenticated entity's information along with full application settings.

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response (User):**
```json
{
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
    "app_settings": {
      "entity": { ... },
      "entity_type": "user",
      "currency": { ... },
      "store": { ... },
      "price_type": { ... },
      "effective_vat_rate": 20.0,
      "addresses": [],
      "discount_info": null,
      "token_info": { ... }
    },
    "token_info": {
      "token_uid": "token-abc123",
      "issued_at": "2025-01-12T10:00:00Z",
      "expires_at": "2025-01-12T10:15:00Z"
    }
  },
  "success": true,
  "status_message": "Success",
  "timestamp": "2025-01-12T10:00:00Z",
  "request_id": "req-abc123"
}
```

**Response (Client):**
```json
{
  "data": {
    "entity_type": "client",
    "client": {
      "uid": "client-123",
      "name": "ACME Corporation",
      "phone": "+1234567890",
      "email": "contact@acme.com",
      "discount": 10,
      "fixed_discount": true,
      "vat_rate": 20.0,
      "vat_number": "VAT123456",
      "store_uid": "store-456",
      "price_type_uid": "pt-usd",
      "language": "en"
    },
    "app_settings": {
      "entity": { ... },
      "entity_type": "client",
      "currency": { "code": "USD", "name": "US Dollar", "symbol": "$" },
      "store": { "uid": "store-456", "name": "Main Store", ... },
      "price_type": { "uid": "pt-usd", "currency_code": "USD", ... },
      "effective_vat_rate": 20.0,
      "addresses": [
        {
          "uid": "addr-001",
          "client_uid": "client-123",
          "country_code": "UA",
          "zipcode": "01001",
          "city": "Kyiv",
          "address_text": "123 Main Street",
          "is_default": true
        }
      ],
      "discount_info": {
        "current_discount": 10,
        "additional_discount": 0,
        "next_discount": 15,
        "progress": 0.65
      },
      "token_info": { ... }
    },
    "token_info": {
      "token_uid": "token-abc123",
      "issued_at": "2025-01-12T10:00:00Z",
      "expires_at": "2025-01-12T10:15:00Z"
    }
  },
  "success": true,
  "status_message": "Success",
  "timestamp": "2025-01-12T10:00:00Z",
  "request_id": "req-abc123"
}
```

**AppSettings Fields:**
- `entity` - Full User or Client object
- `entity_type` - `"user"` or `"client"`
- `currency` - Currency object (derived from price type, clients only)
- `store` - Store object (if entity has `store_uid`)
- `price_type` - Price type object (if entity has `price_type_uid`)
- `effective_vat_rate` - Calculated VAT rate for the entity
- `addresses` - Client addresses (clients only)
- `discount_info` - Current discount tier and progress to next (clients only). `current_discount` excludes `additional_discount`: the bonus is reported separately because it is added only after a product's discount limit, so the two cannot be summed into one number that holds for every product.
- `token_info` - Current token metadata

### Logout (Revoke Current Token)

**POST** `/auth/logout`

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "data": "logged out successfully",
  "success": true,
  "status_message": "Logged out successfully",
  "timestamp": "2025-01-12T10:05:00Z",
  "request_id": "req-abc123"
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
  ],
  "success": true,
  "status_message": "Success",
  "timestamp": "2025-01-12T10:05:00Z"
}
```

**Notes:**
- JWT token strings and refresh tokens are NOT included in response (sanitized)
- `is_current` marks the token used for this request

### Revoke Specific Token (Logout from Specific Device)

**DELETE** `/auth/tokens/{token_uid}`

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "data": "token revoked successfully",
  "success": true,
  "status_message": "Success",
  "timestamp": "2025-01-12T10:05:00Z"
}
```

**Errors:**
- `403` - Cannot revoke a token belonging to another user

### Revoke All Tokens (Logout from All Devices)

**POST** `/auth/tokens/revoke-all`

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "data": "all tokens revoked successfully",
  "success": true,
  "status_message": "Success",
  "timestamp": "2025-01-12T10:05:00Z"
}
```

---

## Token Lifecycle

- **Access Token Duration**: Configurable, default `15m` (configured via `jwt.access_token_duration`)
- **Refresh Token Duration**: Configurable, default `168h` / 7 days (configured via `jwt.refresh_token_duration`)
- **Token Rotation**: New refresh token issued on each refresh (old one revoked)
- **Multi-Device Support**: Multiple active tokens per user/client
- **Immediate Revocation**: Tokens checked against database on each request
- **Rate Limiting**: Login and refresh endpoints are rate-limited (configurable)

---

## Example: Complete Authentication Flow

```bash
# 1. Login
curl -X POST http://localhost:8888/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password123"}'

# Response: {"data":{"access_token":"eyJ...","refresh_token":"xyz..."},"success":true,...}

# 2. Use access token for protected endpoints
curl -X GET http://localhost:8888/api/v1/auth/me \
  -H "Authorization: Bearer eyJ..."

# 3. When access token expires (401 response), refresh it
curl -X POST http://localhost:8888/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"xyz..."}'

# 4. Logout when done
curl -X POST http://localhost:8888/api/v1/auth/logout \
  -H "Authorization: Bearer eyJ..."
```

---

## Common Response Structure

All API responses use a consistent JSON structure defined in `internal/lib/api/response/response.go`.

### Success Response

```json
{
  "data": { ... },
  "success": true,
  "status_message": "Success",
  "timestamp": "2025-01-12T10:00:00Z",
  "request_id": "req-abc123"
}
```

### Success Response with Message

```json
{
  "data": { ... },
  "success": true,
  "status_message": "Entities upserted successfully",
  "timestamp": "2025-01-12T10:00:00Z",
  "request_id": "req-abc123"
}
```

### Error Response

```json
{
  "success": false,
  "status_message": "Human-readable error message",
  "timestamp": "2025-01-12T10:00:00Z",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error message",
    "details": {
      "field_name": "specific field error"
    }
  },
  "request_id": "req-abc123"
}
```

**Response Fields:**
- `data` - Response payload (omitted on error)
- `success` (boolean) - `true` for success, `false` for error
- `status_message` (string) - Human-readable status
- `timestamp` (string) - ISO 8601 timestamp
- `pagination` (object, optional) - Present on paginated list responses
- `error` (object, optional) - Present on error responses
- `request_id` (string, optional) - Request tracking ID

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 422 | Field validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED` | 401 | Authentication required or invalid |
| `FORBIDDEN` | 403 | Insufficient privileges |
| `DUPLICATE_KEY` | 409 | Duplicate unique key |
| `CONFLICT` | 409 | Resource conflict |
| `BAD_REQUEST` | 400 | Malformed request |
| `INVALID_INPUT` | 400 | Invalid input data |
| `ENTITY_TOO_LARGE` | 413 | Request payload too large |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `DATABASE_ERROR` | 500 | Database operation failed |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |
| `TIMEOUT` | 504 | Request timed out |

---

## Pagination

List endpoints return pagination in the response:

```json
{
  "data": [ ... ],
  "success": true,
  "status_message": "Success",
  "timestamp": "2025-01-12T10:00:00Z",
  "pagination": {
    "page": 1,
    "count": 20,
    "total": 250,
    "total_pages": 13
  },
  "request_id": "req-abc123"
}
```

**Pagination Fields:**
- `page` - Current page number (1-based)
- `count` - Items per page
- `total` - Total number of items across all pages
- `total_pages` - Total number of pages (ceiling division)

**Pagination Input:** Most list endpoints accept pagination via:
- **Query parameters**: `?offset=0&limit=20` (converted internally to page/count)
- **Request body**: `{"page": 1, "count": 20}`

---

## Common Patterns

### Upsert Pattern

All POST endpoints follow the **upsert pattern** (create OR update):
- If entity with UID exists: **UPDATE**
- If entity doesn't exist: **CREATE**
- No separate create/update endpoints

### Batch Operations

All main entity operations support **batch upsert**, **batch delete**, and **batch retrieval** using array inputs.

**Benefits:**
- Reduces N+1 query problems
- Minimizes HTTP overhead
- Improves frontend performance
- Example: Load 100 products in 1 request instead of 100 requests

### Request Format

All data management requests use a standardized format:
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
  "data": [
    { "uid": "uid1", "name": "Entity 1" },
    { "uid": "uid2", "name": "Entity 2" },
    { "uid": "uid3", "name": "Entity 3" }
  ],
  "success": true,
  "status_message": "Success",
  "timestamp": "2025-01-12T10:00:00Z"
}
```

**Note:** Frontend endpoints (cart, orders) use plain JSON bodies without the `data` wrapper. See [frontend-api.md](frontend-api.md) for details.

---

## Database-Level Upserts

The following operations use true database-level upserts (INSERT ... ON DUPLICATE KEY UPDATE / ON CONFLICT DO UPDATE):
- Order Items: Based on composite key (order_uid + product_uid)
- Product Descriptions: Based on composite PRIMARY KEY (product_uid + language)
- Product Images: Based on composite PRIMARY KEY (product_uid + sort_order)
- Product Tag Assignments: Based on composite PRIMARY KEY (product_uid + tag_uid)
- Category Descriptions: Based on composite PRIMARY KEY (category_uid + language)
- Attribute Descriptions: Based on composite PRIMARY KEY (attribute_uid + language)
- Attribute Values: Based on composite PRIMARY KEY (uid + language)
- Order Statuses: Based on composite PRIMARY KEY (status + language)
- Prices: Based on composite PRIMARY KEY (price_type_uid + product_uid)
- Countries: Based on PRIMARY KEY (country_code)
- Client Addresses: Based on PRIMARY KEY (uid)
- Discount Scales: Based on composite PRIMARY KEY (store_uid + sum_purchase + currency_code)
- Product Discount Limits: Based on composite PRIMARY KEY (store_uid + product_uid)

This ensures atomic operations and prevents race conditions.
