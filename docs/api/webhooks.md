# Webhooks Documentation

Webhooks allow external systems to receive real-time notifications when specific events occur in the B2B portal. When an event is triggered, the system sends an HTTP POST request to the configured URL with event data in JSON format.

## Overview

- **Delivery**: Asynchronous (non-blocking) - webhook calls don't block the main operation
- **Retry Strategy**: 3 retries with exponential backoff (1s, 5s, 30s delays)
- **Timeout**: 30 seconds per request
- **Content-Type**: `application/json`
- **User-Agent**: `Comex-Webhook/1.0`

## Supported Events

| Event | Description | Trigger |
|-------|-------------|---------|
| `order_confirmed` | Order has been confirmed | When an order status changes to `new` (confirmed by client) |

## Webhook Configuration

Webhooks are configured via the Admin Zone UI (`/admin/webhooks`).

### Configuration Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Human-readable name for the webhook (max 255 chars) |
| `url` | string | Yes | HTTPS endpoint URL to receive webhook (max 2048 chars) |
| `event` | string | Yes | Event type to subscribe to (currently: `order_confirmed`) |
| `store_uid` | string | No | Filter by store UID. If null, receives events from all stores |
| `auth_header` | string | No | Custom authentication header name (e.g., `Authorization`, `X-API-Key`) |
| `auth_value` | string | No | Value for the authentication header (e.g., `Bearer token123`) |
| `active` | boolean | Yes | Enable/disable the webhook |

### Example Configuration

```json
{
  "name": "CRM Integration",
  "url": "https://crm.example.com/api/webhooks/orders",
  "event": "order_confirmed",
  "store_uid": null,
  "auth_header": "Authorization",
  "auth_value": "Bearer sk_live_abc123xyz",
  "active": true
}
```

## Payload Structure

### Common Envelope

All webhook payloads share a common envelope structure:

```json
{
  "event": "event_type",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": { ... }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `event` | string | Event type identifier |
| `timestamp` | string | ISO 8601 timestamp (UTC) when the event occurred |
| `data` | object | Event-specific payload data |

---

## Event: `order_confirmed`

Triggered when an order is confirmed (status = `new`).

### Full Payload Example

```json
{
  "event": "order_confirmed",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "order_uid": "ord_abc123def456",
    "order_number": "1-1234",
    "client_uid": "cli_xyz789",
    "store_uid": "store_001",
    "status": "new",
    "total": 1249.99,
    "subtotal": 1041.66,
    "total_vat": 208.33,
    "discount_percent": 10,
    "discount_amount": 115.74,
    "delivery_cost": 0.00,
    "currency_code": "USD",
    "shipping_address": "123 Main St, New York, NY 10001",
    "comment": "Please deliver before noon",
    "created_at": "2024-01-15T10:29:45Z",
    "items": [
      {
        "product_uid": "prod_001",
        "product_sku": "SKU-12345",
        "quantity": 2,
        "price": 574.99,
        "discount": 10,
        "price_discount": 517.49,
        "tax": 103.50,
        "total": 621.48
      },
      {
        "product_uid": "prod_002",
        "product_sku": "SKU-67890",
        "quantity": 1,
        "price": 629.99,
        "discount": 10,
        "price_discount": 566.99,
        "tax": 104.83,
        "total": 628.51
      }
    ]
  }
}
```

### Data Fields

#### Order Level

All money fields are sent as float values with 2 decimal places (e.g., 999.99).

| Field | Type | Description |
|-------|------|-------------|
| `order_uid` | string | Unique order identifier |
| `order_number` | string | Human-readable order number |
| `client_uid` | string | Identifier of the party the order is billed to. Normally the client; for an order delivered to a [branch](./data-management-api.md#client-branch) address this is the **branch UID** — see the note below |
| `store_uid` | string | Store identifier |
| `status` | string | Order status (always `new` for this event) |
| `total` | number | Final order total including VAT, 2 decimal places |
| `subtotal` | number | Order subtotal before VAT, 2 decimal places |
| `total_vat` | number | Total VAT amount, 2 decimal places |
| `discount_percent` | number | Client discount percentage (0-100) |
| `discount_amount` | number | Total discount amount saved, 2 decimal places |
| `delivery_cost` | number | Delivery cost, 2 decimal places. Already included in `total`. Always present — sent as `0.00` when the order has no delivery cost |
| `currency_code` | string | ISO 4217 currency code (e.g., `USD`, `EUR`) |
| `shipping_address` | string | Shipping address (optional) |
| `comment` | string | Order comment/notes (optional) |
| `created_at` | string | ISO 8601 timestamp when order was created |
| `items` | array | Array of order items |

**Branch billing.** A client may have branches (filials, points of sale). When an order's
delivery address is linked to one, that branch is the party the order is billed to, and
`client_uid`, `client_name` and `client_tax_id` carry the **branch's** identity instead of
the parent client's. The payload shape is unchanged and no new fields are added — a
consumer is simply told who to bill and needs no knowledge of branches or of the
relationship between a branch and its parent.

A branch never inherits its parent's VAT number, so an empty `client_tax_id` on a branch
order means that branch is not VAT-registered.

`client_email` and `client_phone` are the exception to that rule: they take the branch's
contact details when it has them and fall back to the parent's when it does not, because a
payload with no contact address is not usable. Services that identify a contractor by e-mail
(wFirma among them) therefore need every invoiceable branch to carry its own
`contact_email` — see [invoice-request.md](./invoice-request.md#7-branch-billing).

#### Item Level

All money fields are sent as float values with 2 decimal places (e.g., 999.99).

| Field | Type | Description |
|-------|------|-------------|
| `product_uid` | string | Product unique identifier |
| `product_sku` | string | Product SKU (optional) |
| `quantity` | number | Quantity ordered |
| `price` | number | Unit price in main currency units (e.g., 19.99), 2 decimal places |
| `discount` | number | Item discount percentage (0-100) |
| `price_discount` | number | Unit price after discount (e.g., 17.99), 2 decimal places |
| `tax` | number | VAT amount for this line item, 2 decimal places |
| `total` | number | Line item total (quantity × discounted price + VAT), 2 decimal places |

---

## Test Webhook

Use the "Test Webhook" feature in the Admin UI to verify your endpoint is working correctly.

### Test Payload

```json
{
  "event": "test",
  "timestamp": "2024-01-15T10:30:00Z",
  "test": true,
  "message": "This is a test webhook from Comex"
}
```

A successful test indicates your endpoint:
1. Is reachable from the server
2. Accepts POST requests with JSON body
3. Returns HTTP 2xx status code

---

## Delivery & Retries

### Delivery Process

1. Event occurs (e.g., order confirmed)
2. System finds all active webhooks matching the event and store
3. For each webhook, an async goroutine is spawned
4. HTTP POST request is sent to the configured URL
5. Success/failure is logged to `webhook_deliveries` table

### Retry Logic

If a delivery fails (non-2xx response or network error), the system retries with exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | Immediate |
| 2 | 1 second |
| 3 | 5 seconds |
| 4 | 30 seconds |

After 4 attempts, the delivery is marked as `failed`.

### Delivery Statuses

| Status | Description |
|--------|-------------|
| `pending` | Delivery in progress |
| `success` | Delivered successfully (HTTP 2xx received) |
| `failed` | All retry attempts exhausted |

---

## Best Practices for Receiving Webhooks

### 1. Return Quickly

Your endpoint should return a 2xx response as quickly as possible. Process the webhook asynchronously if needed.

```
// Good: Acknowledge immediately, process later
HTTP 200 OK

// Bad: Long processing before response (may timeout)
```

### 2. Verify Authentication

If you configured an auth header, validate it in your endpoint:

```python
# Example (Python)
expected_token = "Bearer sk_live_abc123xyz"
if request.headers.get("Authorization") != expected_token:
    return Response(status=401)
```

### 3. Handle Duplicates

In rare cases, the same event may be delivered multiple times. Use the `order_uid` to deduplicate:

```python
# Check if order was already processed
if order_already_processed(payload["data"]["order_uid"]):
    return Response(status=200)  # Already handled
```

### 4. Use HTTPS

Always use HTTPS endpoints to ensure payload data is encrypted in transit.

### 5. Log Incoming Webhooks

Keep logs of received webhooks for debugging:

```python
logger.info(f"Received webhook: {payload['event']} for order {payload['data']['order_uid']}")
```

---

## Admin API Endpoints

### Webhooks Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/webhooks` | List webhooks (paginated) |
| POST | `/api/v1/admin/webhooks` | Create/update webhooks |
| POST | `/api/v1/admin/webhooks/batch` | Get webhooks by UIDs |
| POST | `/api/v1/admin/webhooks/delete` | Delete webhooks |
| POST | `/api/v1/admin/webhooks/active` | Toggle active status |
| POST | `/api/v1/admin/webhooks/test` | Test webhook configuration |

### Delivery Logs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/admin/webhooks/deliveries` | List all delivery logs |
| GET | `/api/v1/admin/webhooks/deliveries/{webhook_uid}` | List deliveries for specific webhook |
| DELETE | `/api/v1/admin/webhooks/deliveries/cleanup` | Clean up old delivery logs |

### Query Parameters

List endpoints support pagination:
- `page` - Page number (1-indexed, default: 1)
- `count` - Items per page (default: 50, max: 100)

---

## Configuration

Server-side configuration in `config.yml`:

```yaml
webhooks:
  delivery_retention_days: 60    # Auto-cleanup deliveries older than this
  request_timeout: 30s           # HTTP request timeout
  max_retries: 3                 # Number of retry attempts
```

Delivery history is cleaned up automatically by a background job
(`internal/jobs/webhook_retention.go`) that runs once per day and deletes records older
than `delivery_retention_days` (default: 60). The manual cleanup endpoint remains available.

Environment variables:
- `WEBHOOKS_DELIVERY_RETENTION_DAYS` - Retention period for delivery logs
- `WEBHOOKS_REQUEST_TIMEOUT` - Request timeout duration
- `WEBHOOKS_MAX_RETRIES` - Maximum retry attempts
