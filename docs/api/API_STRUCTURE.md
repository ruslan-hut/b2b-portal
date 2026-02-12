# API Structure

Base path: `/api/v1`

Detailed documentation:
- [api_documentation.md](api_documentation.md) - Authentication, common patterns, response structure
- [FRONTEND_API.md](FRONTEND_API.md) - Frontend API for clients
- [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md) - Data management endpoints for staff
- [ADMIN_API.md](ADMIN_API.md) - Admin-only endpoints

---

## Public (No Authentication)

| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /health` | Health check | - |
| `POST /auth/login` | Login | [api_documentation.md](api_documentation.md#login) |
| `POST /auth/refresh` | Refresh token | [api_documentation.md](api_documentation.md#refresh-token) |

---

## Frontend (Authenticated, for clients)

See [FRONTEND_API.md](FRONTEND_API.md) for detailed documentation.

### `/frontend`
| Endpoint | Description |
|----------|-------------|
| `GET /products` | List products with calculated prices |
| `GET /categories` | List categories for filter dropdown |
| `GET /languages` | List available languages for product descriptions |
| `POST /product/images` | Get main product images (batch) |
| `POST /cart/update` | Update cart |
| `POST /cart/delete` | Delete cart |
| `POST /orders/preview` | Preview order |
| `POST /orders/confirm` | Confirm order |
| `GET /orders/history` | Get order history |
| `GET /countries` | List countries |
| `POST /countries` | List countries (with pagination) |

### `/frontend/profile`
| Endpoint | Description |
|----------|-------------|
| `PUT /` | Update client profile |
| `GET /addresses` | Get my addresses |
| `POST /addresses` | Upsert my address |
| `DELETE /addresses/{uid}` | Delete my address |
| `PUT /addresses/{uid}/default` | Set default address |

---

## Data Management API (Authenticated, for staff/users)

See [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md) for detailed documentation.

### `/auth`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /logout` | Logout | [api_documentation.md](api_documentation.md#logout-revoke-current-token) |
| `GET /me` | Get current user | [api_documentation.md](api_documentation.md#get-current-userclient-info) |
| `GET /tokens` | List tokens | [api_documentation.md](api_documentation.md#list-active-tokens-all-devices) |
| `DELETE /tokens/{token_uid}` | Revoke token | [api_documentation.md](api_documentation.md#revoke-specific-token-logout-from-specific-device) |
| `POST /tokens/revoke-all` | Revoke all tokens | [api_documentation.md](api_documentation.md#revoke-all-tokens-logout-from-all-devices) |

### `/client`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /` | Upsert client | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#client) |
| `GET /` | List clients | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#list-clients) |
| `POST /batch` | Get clients batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-clients-batch) |
| `POST /delete` | Delete clients batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#delete-clients-batch) |
| `POST /find/email` | Find clients by emails | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#find-clients-by-email-batch) |
| `POST /active` | Update client active status | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#update-client-active-status-batch) |

### `/product`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List products | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#list-products) |
| `POST /batch` | Get products batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-products-batch) |
| `POST /find/category` | Find products by category UIDs | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#find-products-by-category-batch) |
| `POST /descriptions/batch` | Get product descriptions batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-batch-product-descriptions) |
| `POST /` | Upsert product | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#product) |
| `POST /delete` | Delete products batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#product) |
| `POST /active` | Update product active status | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#product) |
| `POST /description` | Upsert product description | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#product) |
| `POST /description/delete` | Delete product descriptions batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#product) |
| `GET /image/{productUID}` | Get product images | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-product-images) |
| `POST /image` | Upsert product images | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#upsert-product-images-batch) |
| `POST /image/batch` | Get main images batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-main-images-batch) |
| `POST /image/delete` | Delete product images | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#delete-product-images-batch) |

### `/category`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List categories | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#list-categories) |
| `POST /batch` | Get categories batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-categories-batch) |
| `POST /find/parent` | Find categories by parent UIDs | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#find-categories-by-parent-uids-batch) |
| `POST /description/batch` | Get category descriptions batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-batch-category-descriptions) |
| `POST /` | Upsert category | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#category) |
| `POST /delete` | Delete categories batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#category) |
| `POST /description` | Upsert category description | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#category) |
| `POST /description/delete` | Delete category descriptions batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#category) |

### `/attribute`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List attributes | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#list-attributes) |
| `POST /batch` | Get attributes batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-attributes-batch) |
| `POST /find/product` | Find attributes by product UIDs | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#find-attributes-by-product-uids-batch) |
| `POST /description/batch` | Get attribute descriptions batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-batch-attribute-descriptions) |
| `POST /value/batch` | Get attribute values batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-batch-attribute-values) |
| `POST /` | Upsert attribute | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#attribute) |
| `POST /delete` | Delete attributes batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#attribute) |
| `POST /description` | Upsert attribute description | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#attribute) |
| `POST /description/delete` | Delete attribute descriptions batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#attribute) |
| `POST /value` | Upsert attribute value | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#attribute) |
| `POST /value/delete` | Delete attribute values batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#attribute) |

### `/price`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /find/product` | Get price by product | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-all-prices-for-a-product) |
| `POST /batch/products` | Get prices by products batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-prices-for-multiple-products-batch) |
| `POST /batch/price_types` | Get prices by price types batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-prices-for-multiple-price-types-batch) |
| `POST /batch/price_type_products` | Get prices by price type and products batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-prices-for-products-under-specific-price-type-batch) |
| `POST /` | Upsert price | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#price) |
| `POST /delete` | Delete prices batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#price) |
| `POST /delete/products` | Delete prices by products batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#price) |
| `POST /delete/price_types` | Delete prices by price types batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#price) |

### `/order`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /` | Upsert order | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#create-order-upsert) |
| `PUT /` | Update order partial | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#partial-update-order) |
| `POST /batch` | Get orders batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-orders-batch) |
| `POST /find/client` | Find orders by client UIDs | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#find-orders-by-client-uids-batch) |
| `POST /item` | Upsert order item | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#upsert-order-items-batch) |
| `POST /items/batch` | Get order items batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-batch-order-items) |
| `GET /` | List all orders | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#order) |
| `POST /delete` | Delete orders batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#order) |
| `POST /find/status` | Find orders by statuses | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#order) |
| `POST /status` | Update order status | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#order) |
| `POST /history` | Get order history batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-order-history-batch) |
| `POST /item/delete` | Delete order items batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#order) |

### `/store`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List stores | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#list-stores) |
| `POST /get` | Get stores batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-stores-batch) |
| `POST /inventory/get` | Get inventory by stores batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-inventory-by-store-products-nested-batch) |
| `POST /inventory/find/product` | Get inventory by products batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-inventory-by-products-batch) |
| `POST /inventory/find/store-product` | Get inventory by store-products batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#store) |
| `POST /inventory/available` | Get available quantity batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-available-quantity-batch-nested-batch) |
| `POST /` | Upsert store | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#store) |
| `POST /delete` | Delete stores batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#store) |
| `POST /active` | Update stores active batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#store) |
| `POST /inventory` | Upsert store inventory | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#store) |
| `POST /inventory/delete` | Delete inventory batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#store) |

### `/price_type`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List price types | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#list-price-types) |
| `POST /batch` | Get price types batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-price-types-batch) |
| `POST /find/currency` | Get price types by currency codes batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#find-price-types-by-currency-codes-batch) |
| `POST /` | Upsert price type | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#price-type) |
| `POST /delete` | Delete price types batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#price-type) |

### `/currency`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List currencies | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#list-currencies) |
| `POST /batch` | Get currencies batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-currencies-batch) |
| `POST /names` | Get currency names batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-currency-names-batch) |
| `POST /names/client` | Get currency for client | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-currency-for-client) |
| `POST /` | Upsert currency | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#currency) |
| `POST /delete` | Delete currencies batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#currency) |

### `/order_status`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List order statuses | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#list-order-statuses) |
| `POST /batch` | Get order statuses batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-order-statuses-batch) |
| `POST /` | Upsert order status | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#order-status) |
| `POST /delete` | Delete order statuses batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#order-status) |

### `/country`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List countries | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#list-countries) |
| `POST /batch` | Get countries batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-countries-batch) |
| `POST /` | Upsert country | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#upsert-countries) |
| `POST /delete` | Delete countries batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#delete-countries-batch) |

### `/client_address`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List client addresses | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#list-client-addresses) |
| `POST /batch` | Get client addresses batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-client-addresses-batch) |
| `POST /find/client` | Find by client UIDs | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#find-client-addresses-by-client-uids) |
| `POST /` | Upsert client address | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#upsert-client-addresses) |
| `POST /delete` | Delete client addresses batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#delete-client-addresses-batch) |

### `/cleanup`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /` | Cleanup operation | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#cleanup) |

### `/discount_scale`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | Get discount scales by store | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-discount-scales-by-store) |
| `POST /` | Upsert discount scales | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#upsert-discount-scales) |
| `POST /delete` | Delete discount scale | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#delete-discount-scale-entry) |
| `DELETE /store` | Delete discount scales by store | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#delete-all-discount-scales-for-store) |

### `/product_discount_limit`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | Get product discount limits by store | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-product-discount-limits-by-store) |
| `POST /` | Upsert product discount limits (batch, for CRM sync) | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#upsert-product-discount-limits-batch) |
| `POST /delete` | Delete product discount limit | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#delete-product-discount-limit) |

### `/crm` (ERP Integration)
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /stages` | List active pipeline stages | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#list-active-pipeline-stages) |
| `POST /stages/batch` | Get stages by UIDs | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-stages-batch) |
| `GET /board` | Get full pipeline board | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-pipeline-board) |
| `GET /board/orders` | Get orders by stage (paginated) | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-orders-by-stage) |
| `POST /board/move` | Move order to stage | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#move-order-to-stage) |
| `POST /board/pipeline/batch` | Get order pipeline info batch | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-order-pipeline-info-batch) |

### `/changes` (Change Tracking for ERP)
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | Get pending changes for sync | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#get-pending-changes) |
| `POST /confirm` | Confirm processed changes | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#confirm-changes) |

### `/user` (ERP User Upload)
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /` | Upsert ERP users (batch, creates managers with no password) | [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md#upsert-erp-users) |

---

## Admin (Authenticated + User role required)

See [ADMIN_API.md](ADMIN_API.md) for detailed documentation.

### Admin/Manager Role Required

#### `/admin`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /dashboard` | Dashboard statistics | [ADMIN_API.md](ADMIN_API.md#get-dashboard-statistics) |
| `GET /discount_scale` | Get discount scales for dashboard | [ADMIN_API.md](ADMIN_API.md#discount-scale-dashboard) |

#### `/admin/product_discount_limits`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | Get product discount limits by store | [ADMIN_API.md](ADMIN_API.md#product-discount-limits) |
| `POST /` | Upsert product discount limits (batch) | [ADMIN_API.md](ADMIN_API.md#product-discount-limits) |
| `POST /delete` | Delete product discount limit | [ADMIN_API.md](ADMIN_API.md#product-discount-limits) |

#### `/admin/clients`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /` | Upsert client | [ADMIN_API.md](ADMIN_API.md#client-management) |
| `GET /` | List clients | [ADMIN_API.md](ADMIN_API.md#client-management) |
| `POST /batch` | Get clients batch | [ADMIN_API.md](ADMIN_API.md#client-management) |
| `POST /delete` | Delete clients batch | [ADMIN_API.md](ADMIN_API.md#client-management) |
| `POST /find/email` | Find clients by emails | [ADMIN_API.md](ADMIN_API.md#client-management) |
| `POST /active` | Update client active status | [ADMIN_API.md](ADMIN_API.md#client-management) |

#### `/admin/orders`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List orders | [ADMIN_API.md](ADMIN_API.md#list-all-orders) |
| `POST /batch` | Get orders batch | [ADMIN_API.md](ADMIN_API.md#order-management) |
| `POST /find/status` | Find orders by statuses | [ADMIN_API.md](ADMIN_API.md#find-orders-by-statuses-batch) |
| `POST /status` | Update order status | [ADMIN_API.md](ADMIN_API.md#update-order-status) |
| `POST /delete` | Delete orders batch | [ADMIN_API.md](ADMIN_API.md#delete-orders-batch) |
| `POST /item/delete` | Delete order items batch | [ADMIN_API.md](ADMIN_API.md#delete-order-items-batch) |
| `POST /edit` | Edit order (recalculate with modified items) | [ADMIN_API.md](ADMIN_API.md#edit-order) |
| `POST /edit/preview` | Preview order edit without saving | [ADMIN_API.md](ADMIN_API.md#preview-order-edit) |
| `POST /edit/check` | Check if order can be edited | [ADMIN_API.md](ADMIN_API.md#can-edit-order) |

#### `/admin/orders/invoice`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /request` | Request invoice generation | [ADMIN_API.md](ADMIN_API.md#request-invoice) |
| `POST /types` | Get invoice types available for order | [ADMIN_API.md](ADMIN_API.md#get-invoice-types-for-order) |
| `POST /list` | Get invoices for orders | [ADMIN_API.md](ADMIN_API.md#get-invoices-for-orders) |
| `GET /{uid}` | Download invoice file | [ADMIN_API.md](ADMIN_API.md#download-invoice) |

#### `/admin/orders/shipment`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /create` | Create shipment for order | [ADMIN_API.md](ADMIN_API.md#create-shipment) |
| `POST /list` | Get shipments by order | [ADMIN_API.md](ADMIN_API.md#get-shipments-by-order) |
| `POST /batch` | Get shipments batch | [ADMIN_API.md](ADMIN_API.md#get-shipments-batch) |
| `GET /` | List all shipments | [ADMIN_API.md](ADMIN_API.md#list-shipments) |
| `GET /{uid}` | Get shipment details | [ADMIN_API.md](ADMIN_API.md#get-shipment) |
| `GET /{uid}/label` | Download shipment label | [ADMIN_API.md](ADMIN_API.md#get-shipment-label) |
| `POST /{uid}/track` | Update tracking info | [ADMIN_API.md](ADMIN_API.md#update-tracking) |
| `POST /{uid}/cancel` | Cancel shipment | [ADMIN_API.md](ADMIN_API.md#cancel-shipment) |
| `GET /{uid}/events` | Get shipment tracking events | [ADMIN_API.md](ADMIN_API.md#get-shipment-events) |

#### `/admin/shipment` (Read-only for Admin/Manager)
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /settings` | Get shipment service settings | [ADMIN_API.md](ADMIN_API.md#shipment-settings) |
| `POST /carriers/active` | List active carriers | [ADMIN_API.md](ADMIN_API.md#list-active-carriers) |
| `GET /boxes/active` | Get active box templates | [ADMIN_API.md](ADMIN_API.md#get-active-boxes) |

#### `/admin/changes`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List changes (CRM sync) | [ADMIN_API.md](ADMIN_API.md#list-pending-changes) |
| `POST /confirm` | Confirm changes | [ADMIN_API.md](ADMIN_API.md#confirm-changes) |

#### `/admin/client_balance`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /` | Update client balance | [ADMIN_API.md](ADMIN_API.md#client-balance-management) |
| `POST /batch` | Update client balance batch | [ADMIN_API.md](ADMIN_API.md#client-balance-management) |

#### `/admin/products`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List products | [ADMIN_API.md](ADMIN_API.md#list-all-products) |
| `GET /details` | List products with details | [ADMIN_API.md](ADMIN_API.md#product-management) |
| `GET /search` | Search products for order editing | [ADMIN_API.md](ADMIN_API.md#search-products-for-order) |
| `POST /batch` | Get products batch | [ADMIN_API.md](ADMIN_API.md#get-products-batch) |
| `POST /find/category` | Find products by category UIDs | [ADMIN_API.md](ADMIN_API.md#find-products-by-category-batch) |
| `POST /` | Upsert product | [ADMIN_API.md](ADMIN_API.md#upsert-products-create-or-update) |
| `POST /delete` | Delete products batch | [ADMIN_API.md](ADMIN_API.md#delete-products-batch) |
| `POST /active` | Update product active status | [ADMIN_API.md](ADMIN_API.md#update-product-active-status-batch) |
| `POST /description` | Upsert product description | [ADMIN_API.md](ADMIN_API.md#product-management) |
| `POST /description/delete` | Delete product descriptions batch | [ADMIN_API.md](ADMIN_API.md#product-management) |

#### `/admin/crm` (Pipeline Board - Admin/Manager)

**Stages & Transitions (read-only)**
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /stages` | List pipeline stages | [ADMIN_API.md](ADMIN_API.md#list-stages) |
| `POST /stages/batch` | Get stages by UIDs | [ADMIN_API.md](ADMIN_API.md#get-stages-batch) |
| `GET /transitions` | List stage transitions | [ADMIN_API.md](ADMIN_API.md#list-transitions) |

**Board Operations**
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /board` | Get full pipeline board | [ADMIN_API.md](ADMIN_API.md#get-board) |
| `GET /board/changes` | Get board changes since timestamp | [ADMIN_API.md](ADMIN_API.md#get-board-changes) |
| `POST /board/move` | Move order to stage | [ADMIN_API.md](ADMIN_API.md#move-order) |
| `POST /board/pipeline/batch` | Get order pipeline info batch | [ADMIN_API.md](ADMIN_API.md#get-order-pipeline-batch) |
| `POST /board/populate` | Populate pipeline with existing orders | [ADMIN_API.md](ADMIN_API.md#populate-pipeline) |

**Assignments**
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /assignments` | Assign orders to user | [ADMIN_API.md](ADMIN_API.md#assign-orders) |
| `POST /assignments/batch` | Get assignments by order UIDs | [ADMIN_API.md](ADMIN_API.md#get-assignments-batch) |
| `POST /assignments/delete` | Unassign orders | [ADMIN_API.md](ADMIN_API.md#unassign-orders) |
| `GET /assignments/my` | Get current user's assignments | [ADMIN_API.md](ADMIN_API.md#get-my-assignments) |

**Activities**
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /activities/{order_uid}` | Get activity timeline for order | [ADMIN_API.md](ADMIN_API.md#get-activity-timeline) |
| `POST /activities` | Create activity entry | [ADMIN_API.md](ADMIN_API.md#create-activity) |
| `DELETE /activities/{uid}` | Delete activity | [ADMIN_API.md](ADMIN_API.md#delete-activity) |
| `POST /activities/delete` | Delete activities batch | [ADMIN_API.md](ADMIN_API.md#delete-activities-batch) |

**Tasks**
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /tasks` | Create task | [ADMIN_API.md](ADMIN_API.md#create-task) |
| `GET /tasks` | List tasks (paginated) | [ADMIN_API.md](ADMIN_API.md#list-tasks) |
| `GET /tasks/my` | Get current user's tasks | [ADMIN_API.md](ADMIN_API.md#get-my-tasks) |
| `GET /tasks/overdue` | Get overdue tasks | [ADMIN_API.md](ADMIN_API.md#get-overdue-tasks) |
| `GET /tasks/order/{order_uid}` | Get tasks for order | [ADMIN_API.md](ADMIN_API.md#get-tasks-by-order) |
| `POST /tasks/batch` | Get tasks batch | [ADMIN_API.md](ADMIN_API.md#get-tasks-batch) |
| `POST /tasks/delete` | Delete tasks batch | [ADMIN_API.md](ADMIN_API.md#delete-tasks-batch) |
| `GET /tasks/{uid}` | Get task details | [ADMIN_API.md](ADMIN_API.md#get-task) |
| `PUT /tasks/{uid}` | Update task | [ADMIN_API.md](ADMIN_API.md#update-task) |
| `DELETE /tasks/{uid}` | Delete task | [ADMIN_API.md](ADMIN_API.md#delete-task) |
| `POST /tasks/{uid}/status` | Update task status | [ADMIN_API.md](ADMIN_API.md#update-task-status) |
| `POST /tasks/{uid}/complete` | Complete task | [ADMIN_API.md](ADMIN_API.md#complete-task) |

**Dashboard & Analytics**
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /dashboard` | CRM dashboard statistics | [ADMIN_API.md](ADMIN_API.md#crm-dashboard) |
| `GET /workload` | Team workload overview | [ADMIN_API.md](ADMIN_API.md#crm-workload) |
| `GET /pipeline-stats` | Pipeline statistics | [ADMIN_API.md](ADMIN_API.md#pipeline-stats) |
| `GET /task-stats` | Task statistics | [ADMIN_API.md](ADMIN_API.md#task-stats) |

**Users**
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /users` | Get assignable users for CRM | [ADMIN_API.md](ADMIN_API.md#get-assignable-users) |

### Admin Role Only

#### `/admin/crm` (Pipeline Configuration - Admin Only)
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /stages` | Upsert pipeline stages | [ADMIN_API.md](ADMIN_API.md#upsert-stages) |
| `POST /stages/delete` | Delete stages | [ADMIN_API.md](ADMIN_API.md#delete-stages) |
| `POST /stages/reorder` | Reorder stages | [ADMIN_API.md](ADMIN_API.md#reorder-stages) |
| `POST /transitions` | Upsert transitions | [ADMIN_API.md](ADMIN_API.md#upsert-transitions) |
| `POST /transitions/delete` | Delete transitions | [ADMIN_API.md](ADMIN_API.md#delete-transitions) |

#### `/admin/shipment` (Configuration - Admin Only)
| Endpoint | Description | Details |
|----------|-------------|---------|
| `PUT /settings` | Update shipment service settings | [ADMIN_API.md](ADMIN_API.md#update-shipment-settings) |
| `POST /restart` | Restart shipment service | [ADMIN_API.md](ADMIN_API.md#restart-shipment-service) |
| `GET /carriers` | List all carriers | [ADMIN_API.md](ADMIN_API.md#list-carriers) |
| `POST /carriers` | Upsert carriers | [ADMIN_API.md](ADMIN_API.md#upsert-carriers) |
| `POST /carriers/batch` | Get carriers batch | [ADMIN_API.md](ADMIN_API.md#get-carriers-batch) |
| `POST /carriers/delete` | Delete carriers | [ADMIN_API.md](ADMIN_API.md#delete-carriers) |
| `POST /carriers/test` | Test carrier connection | [ADMIN_API.md](ADMIN_API.md#test-carrier) |
| `POST /boxes` | Upsert box templates | [ADMIN_API.md](ADMIN_API.md#upsert-boxes) |
| `GET /boxes` | List box templates | [ADMIN_API.md](ADMIN_API.md#list-boxes) |
| `POST /boxes/batch` | Get box templates batch | [ADMIN_API.md](ADMIN_API.md#get-boxes-batch) |
| `POST /boxes/delete` | Delete box templates | [ADMIN_API.md](ADMIN_API.md#delete-boxes) |

#### `/admin/user`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /` | Upsert user | [ADMIN_API.md](ADMIN_API.md#upsert-users-create-or-update) |
| `GET /` | List users | [ADMIN_API.md](ADMIN_API.md#list-users) |
| `POST /batch` | Get users batch | [ADMIN_API.md](ADMIN_API.md#get-users-batch) |
| `POST /delete` | Delete users batch | [ADMIN_API.md](ADMIN_API.md#delete-users-batch) |
| `POST /find/username` | Find users by usernames | [ADMIN_API.md](ADMIN_API.md#find-users-by-username-batch) |
| `POST /find/email` | Find users by emails | [ADMIN_API.md](ADMIN_API.md#find-users-by-email-batch) |

#### `/admin/tables`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List database tables | [ADMIN_API.md](ADMIN_API.md#database-tables-viewer) |
| `POST /{table_name}/records` | Search table records | [ADMIN_API.md](ADMIN_API.md#database-tables-viewer) |

#### `/admin/logs`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List logs | [ADMIN_API.md](ADMIN_API.md#logs-viewer) |
| `DELETE /cleanup` | Cleanup logs | [ADMIN_API.md](ADMIN_API.md#logs-viewer) |

#### `/admin/webhooks`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List webhooks | [ADMIN_API.md](ADMIN_API.md#list-webhooks) |
| `POST /` | Upsert webhooks | [ADMIN_API.md](ADMIN_API.md#upsert-webhooks) |
| `POST /batch` | Get webhooks batch | [ADMIN_API.md](ADMIN_API.md#get-webhooks-batch) |
| `POST /delete` | Delete webhooks | [ADMIN_API.md](ADMIN_API.md#delete-webhooks) |
| `POST /active` | Update webhook active status | [ADMIN_API.md](ADMIN_API.md#update-webhook-active-status) |
| `POST /test` | Test webhook delivery | [ADMIN_API.md](ADMIN_API.md#test-webhook) |
| `GET /deliveries` | List all webhook deliveries | [ADMIN_API.md](ADMIN_API.md#list-webhook-deliveries) |
| `GET /deliveries/{webhook_uid}` | List deliveries for webhook | [ADMIN_API.md](ADMIN_API.md#list-webhook-deliveries-by-webhook) |
| `DELETE /deliveries/cleanup` | Cleanup old deliveries | [ADMIN_API.md](ADMIN_API.md#cleanup-webhook-deliveries) |

#### `/admin/telegram`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /subscriptions` | List telegram subscriptions | [ADMIN_API.md](ADMIN_API.md#list-telegram-subscriptions) |
| `POST /subscriptions/batch` | Get subscriptions batch | [ADMIN_API.md](ADMIN_API.md#get-telegram-subscriptions-batch) |
| `POST /subscriptions/delete` | Delete subscriptions | [ADMIN_API.md](ADMIN_API.md#delete-telegram-subscriptions) |
| `POST /subscriptions/update` | Update subscription | [ADMIN_API.md](ADMIN_API.md#update-telegram-subscription) |
| `PUT /subscriptions/types` | Update subscription types | [ADMIN_API.md](ADMIN_API.md#update-telegram-subscription-types) |
| `GET /subscriptions/by-user` | Get subscriptions by user | [ADMIN_API.md](ADMIN_API.md#get-telegram-subscriptions-by-user) |
| `GET /invites` | List invite codes | [ADMIN_API.md](ADMIN_API.md#list-telegram-invite-codes) |
| `POST /invites` | Generate invite codes | [ADMIN_API.md](ADMIN_API.md#generate-telegram-invite-codes) |
| `POST /invites/batch` | Get invite codes batch | [ADMIN_API.md](ADMIN_API.md#get-telegram-invite-codes-batch) |
| `POST /invites/delete` | Delete invite codes | [ADMIN_API.md](ADMIN_API.md#delete-telegram-invite-codes) |
| `GET /settings` | Get bot settings | [ADMIN_API.md](ADMIN_API.md#get-telegram-bot-settings) |
| `PUT /settings` | Update bot settings | [ADMIN_API.md](ADMIN_API.md#update-telegram-bot-settings) |
| `POST /settings/test` | Test bot connection | [ADMIN_API.md](ADMIN_API.md#test-telegram-bot-connection) |
| `POST /settings/restart` | Restart bot | [ADMIN_API.md](ADMIN_API.md#restart-telegram-bot) |

#### `/admin/mail`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /settings` | Get mail service settings | [ADMIN_API.md](ADMIN_API.md#get-mail-settings) |
| `PUT /settings` | Update mail settings | [ADMIN_API.md](ADMIN_API.md#update-mail-settings) |
| `POST /test` | Test mail connection | [ADMIN_API.md](ADMIN_API.md#test-mail-connection) |
| `POST /restart` | Restart mail service | [ADMIN_API.md](ADMIN_API.md#restart-mail-service) |

#### `/admin/invoice`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /settings` | Get invoice settings | [ADMIN_API.md](ADMIN_API.md#get-invoice-settings) |
| `PUT /settings` | Update invoice settings | [ADMIN_API.md](ADMIN_API.md#update-invoice-settings) |
| `GET /types` | List invoice types | [ADMIN_API.md](ADMIN_API.md#list-invoice-types) |
| `POST /types` | Upsert invoice types | [ADMIN_API.md](ADMIN_API.md#upsert-invoice-types) |
| `POST /types/batch` | Get invoice types batch | [ADMIN_API.md](ADMIN_API.md#get-invoice-types-batch) |
| `POST /types/delete` | Delete invoice types | [ADMIN_API.md](ADMIN_API.md#delete-invoice-types) |
| `POST /types/active` | Update invoice type active status | [ADMIN_API.md](ADMIN_API.md#update-invoice-type-active-status) |
| `POST /types/test` | Test invoice type | [ADMIN_API.md](ADMIN_API.md#test-invoice-type) |
| `GET /history` | List invoice history | [ADMIN_API.md](ADMIN_API.md#list-invoices) |
| `POST /history/delete` | Delete invoices | [ADMIN_API.md](ADMIN_API.md#delete-invoices) |
| `DELETE /history/cleanup` | Cleanup old invoices | [ADMIN_API.md](ADMIN_API.md#cleanup-invoices) |
