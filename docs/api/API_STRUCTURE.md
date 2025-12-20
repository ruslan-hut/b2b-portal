# API Structure

Base path: `/api/v1`

Detailed documentation:
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - Authentication, common patterns, response structure
- [FRONTEND_API.md](FRONTEND_API.md) - Frontend API for clients
- [DATA_MANAGEMENT_API.md](DATA_MANAGEMENT_API.md) - Data management endpoints for staff
- [ADMIN_API.md](ADMIN_API.md) - Admin-only endpoints

---

## Public (No Authentication)

| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /health` | Health check | - |
| `GET /debug/static` | Static files diagnostic | - |
| `POST /auth/login` | Login | [API_DOCUMENTATION.md](API_DOCUMENTATION.md#login) |
| `POST /auth/refresh` | Refresh token | [API_DOCUMENTATION.md](API_DOCUMENTATION.md#refresh-token) |
| `POST /logs` | Submit frontend logs | - |

---

## Frontend (Authenticated, for clients)

See [FRONTEND_API.md](FRONTEND_API.md) for detailed documentation.

### `/frontend`
| Endpoint | Description |
|----------|-------------|
| `GET /products` | List products with calculated prices |
| `POST /product/images` | Get main product images (batch) |
| `POST /cart/update` | Update cart |
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
| `POST /logout` | Logout | [API_DOCUMENTATION.md](API_DOCUMENTATION.md#logout-revoke-current-token) |
| `GET /me` | Get current user | [API_DOCUMENTATION.md](API_DOCUMENTATION.md#get-current-userclient-info) |
| `GET /tokens` | List tokens | [API_DOCUMENTATION.md](API_DOCUMENTATION.md#list-active-tokens-all-devices) |
| `DELETE /tokens/{token_uid}` | Revoke token | [API_DOCUMENTATION.md](API_DOCUMENTATION.md#revoke-specific-token-logout-from-specific-device) |
| `POST /tokens/revoke-all` | Revoke all tokens | [API_DOCUMENTATION.md](API_DOCUMENTATION.md#revoke-all-tokens-logout-from-all-devices) |

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

---

## Admin (Authenticated + User role required)

See [ADMIN_API.md](ADMIN_API.md) for detailed documentation.

### Admin/Manager Role Required

#### `/admin`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /dashboard` | Dashboard statistics | [ADMIN_API.md](ADMIN_API.md#get-dashboard-statistics) |

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
| `POST /batch` | Get products batch | [ADMIN_API.md](ADMIN_API.md#get-products-batch) |
| `POST /find/category` | Find products by category UIDs | [ADMIN_API.md](ADMIN_API.md#find-products-by-category-batch) |
| `POST /` | Upsert product | [ADMIN_API.md](ADMIN_API.md#upsert-products-create-or-update) |
| `POST /delete` | Delete products batch | [ADMIN_API.md](ADMIN_API.md#delete-products-batch) |
| `POST /active` | Update product active status | [ADMIN_API.md](ADMIN_API.md#update-product-active-status-batch) |
| `POST /description` | Upsert product description | [ADMIN_API.md](ADMIN_API.md#product-management) |
| `POST /description/delete` | Delete product descriptions batch | [ADMIN_API.md](ADMIN_API.md#product-management) |

### Admin Role Only

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
