# Chat Service Integration Guide

This document describes how to integrate an external chat service with the Comex B2B portal. The chat module connects to an external messaging aggregator via WebSocket and REST API, enabling real-time customer conversations from multiple platforms (Telegram, Instagram, WhatsApp, etc.) directly within the admin panel.

## Architecture Overview

```
+---------------------+          +---------------------------+
|   Comex Frontend    |          |   External Chat Service   |
|   (Angular Admin)   |          |   (your bot/aggregator)   |
|                     |          |                           |
|  ChatWebsocketSvc --+--> WS --+--> /crm/ws                |
|  ChatService -------+--> HTTP -+--> /crm/chats             |
|                     |          |    /crm/chats/.../messages |
|                     |          |    /crm/chats/.../send     |
+---------------------+          +---------------------------+
```

- **Configuration** is stored in the Comex database (`chat_service_settings` table) and managed via the admin settings page at `/admin/chat-service`.
- The frontend reads the configuration from the backend API (`GET /api/v1/admin/chat-service/settings`) and uses it to connect to the external chat service.
- No hardcoded URLs or tokens; everything is runtime-configurable.

## Configuration

### Admin Settings Page

Navigate to **Admin Zone > Chat Service** to configure:

| Field | Description | Default |
|-------|-------------|---------|
| **Enabled** | Master toggle for the chat service | `false` |
| **Base URL** | Root URL of your chat service API | *(empty)* |
| **Auth Token** | Bearer token for HTTP requests / query param for WebSocket | *(empty)* |
| **WebSocket Path** | WebSocket endpoint path | `/crm/ws` |
| **Chats Path** | Endpoint to list all chats | `/crm/chats` |
| **Messages Path** | Endpoint to fetch messages | `/crm/chats/{platform}/{userId}/messages` |
| **Send Path** | Endpoint to send a message | `/crm/chats/{platform}/{userId}/send` |
| **Platforms** | List of supported messaging platforms | `[]` |

The Chat sidebar link only appears when the service is fully configured (enabled + base URL + auth token + at least one enabled platform).

### Backend API

```
GET  /api/v1/admin/chat-service/settings   # Get current configuration
PUT  /api/v1/admin/chat-service/settings   # Update configuration
```

Both endpoints require admin authentication.

## WebSocket Protocol

### Connection

```
wss://{base_url}{ws_endpoint}?token={auth_token}
```

Example: `wss://bot.example.com/api/v1/crm/ws?token=abc123`

The frontend automatically:
- Connects when the admin zone loads (if configured)
- Reconnects with exponential backoff on disconnect
- Sends heartbeat pings every 25 seconds

### Events (Server -> Client)

#### `new_message`

Fired when a new message arrives from any platform.

```json
{
  "type": "new_message",
  "data": {
    "id": "msg_123",
    "platform": "telegram",
    "user_id": "user_456",
    "user_name": "John Doe",
    "direction": "incoming",
    "sender": "John Doe",
    "text": "Hello, I need help with my order",
    "created_at": "2025-01-15T10:30:00Z"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique message identifier |
| `platform` | string | Platform identifier (e.g., `telegram`, `instagram`, `whatsapp`) |
| `user_id` | string | User identifier on the platform |
| `user_name` | string | Display name of the user (optional) |
| `direction` | `"incoming"` \| `"outgoing"` | Message direction |
| `sender` | string | Sender name |
| `text` | string | Message content |
| `created_at` | string (ISO 8601) | Timestamp |

#### `typing`

Fired when a user starts typing.

```json
{
  "type": "typing",
  "data": {
    "platform": "telegram",
    "user_id": "user_456"
  }
}
```

### Events (Client -> Server)

#### `ping`

Heartbeat keepalive (sent every 25s).

```json
{ "type": "ping" }
```

#### `mark_read`

Mark all messages in a chat as read.

```json
{
  "type": "mark_read",
  "data": {
    "platform": "telegram",
    "user_id": "user_456"
  }
}
```

## REST API Endpoints

All HTTP requests include the header:
```
Authorization: Bearer {auth_token}
```

### List Chats

```
GET {base_url}{chats_endpoint}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "platform": "telegram",
      "user_id": "user_456",
      "user_name": "John Doe",
      "last_message": "Hello!",
      "last_time": "2025-01-15T10:30:00Z",
      "unread": 3
    }
  ]
}
```

### Get Messages

```
GET {base_url}{messages_endpoint}?limit=50&offset=0
```

Path parameters (replaced in the endpoint template):
- `{platform}` - Platform identifier
- `{userId}` - User identifier

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "msg_123",
      "platform": "telegram",
      "user_id": "user_456",
      "direction": "incoming",
      "sender": "John Doe",
      "text": "Hello!",
      "created_at": "2025-01-15T10:30:00Z"
    }
  ]
}
```

### Send Message

```
POST {base_url}{send_endpoint}
Content-Type: application/json

{
  "text": "Thank you for reaching out!"
}
```

**Response:**
```json
{
  "ok": true
}
```

## Response Format

All REST endpoints must return responses wrapped in the standard format:

```json
{
  "success": true,
  "data": <payload>,
  "message": "optional error/status message"
}
```

## Platform Configuration

Platforms are stored as a JSON array in the settings. Each platform has:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (e.g., `telegram`, `instagram`, `custom_sms`) |
| `name` | string | Display name shown in the UI |
| `enabled` | boolean | Whether this platform is active |
| `base_url` | string | Optional per-platform base URL override |
| `icon` | string | Material Icons name for the UI (e.g., `send`, `camera_alt`, `phone`, `chat`) |

The admin settings page provides preset buttons for Telegram, Instagram, and WhatsApp, plus a form for adding custom platforms.

## Implementing a Compatible Chat Service

To build a chat service that integrates with Comex, you need to implement:

1. **WebSocket endpoint** (`/crm/ws`) that:
   - Accepts connections with `?token=` query parameter for authentication
   - Pushes `new_message` and `typing` events to connected clients
   - Handles `ping` (keepalive) and `mark_read` events from clients

2. **REST endpoints**:
   - `GET /crm/chats` - Return list of all chats with unread counts
   - `GET /crm/chats/{platform}/{userId}/messages?limit=N&offset=N` - Return paginated messages
   - `POST /crm/chats/{platform}/{userId}/send` - Send a message (body: `{"text": "..."}`)

3. **Authentication**: Validate the `Bearer` token on all HTTP requests and the `token` query parameter on WebSocket connections.

All endpoint paths are configurable in the admin settings, so you can use different paths if needed.
