# API Structure

Base path: `/api/v1`

Detailed documentation:
- [authentication-and-common-patterns.md](authentication-and-common-patterns.md) - Authentication, common patterns, response structure
- [frontend-api.md](frontend-api.md) - Frontend API for clients
- [data-management-api.md](data-management-api.md) - Data management endpoints for staff
- [admin-api.md](admin-api.md) - Admin-only endpoints
- [client-api.md](client-api.md) - Client API (`/api/client/v1`, API-key authenticated) and its admin management endpoints

---

## Public (No Authentication)

| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /health` | Health check | - |
| `POST /auth/login` | Login | [authentication-and-common-patterns.md](authentication-and-common-patterns.md#login) |
| `POST /auth/refresh` | Refresh token | [authentication-and-common-patterns.md](authentication-and-common-patterns.md#refresh-token) |

---

## Frontend (Authenticated, for clients)

See [frontend-api.md](frontend-api.md) for detailed documentation.

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
| `PUT /addresses/{uid}/default` | Set default (delivery) address |
| `PUT /addresses/{uid}/official` | Set official (invoicing) address |

---

## Data Management API (Authenticated, for staff/users)

See [data-management-api.md](data-management-api.md) for detailed documentation.

### `/auth`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /logout` | Logout | [authentication-and-common-patterns.md](authentication-and-common-patterns.md#logout-revoke-current-token) |
| `GET /me` | Get current user | [authentication-and-common-patterns.md](authentication-and-common-patterns.md#get-current-userclient-info) |
| `GET /tokens` | List tokens | [authentication-and-common-patterns.md](authentication-and-common-patterns.md#list-active-tokens-all-devices) |
| `DELETE /tokens/{token_uid}` | Revoke token | [authentication-and-common-patterns.md](authentication-and-common-patterns.md#revoke-specific-token-logout-from-specific-device) |
| `POST /tokens/revoke-all` | Revoke all tokens | [authentication-and-common-patterns.md](authentication-and-common-patterns.md#revoke-all-tokens-logout-from-all-devices) |

### `/client`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /` | Upsert client | [data-management-api.md](data-management-api.md#client) |
| `GET /` | List clients | [data-management-api.md](data-management-api.md#list-clients) |
| `POST /batch` | Get clients batch | [data-management-api.md](data-management-api.md#get-clients-batch) |
| `POST /delete` | Delete clients batch | [data-management-api.md](data-management-api.md#delete-clients-batch) |
| `POST /find/email` | Find clients by emails | [data-management-api.md](data-management-api.md#find-clients-by-email-batch) |
| `POST /active` | Update client active status | [data-management-api.md](data-management-api.md#update-client-active-status-batch) |

### `/company`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /` | Upsert companies (ERP sync) | [data-management-api.md](data-management-api.md#company) |
| `GET /` | List companies | [data-management-api.md](data-management-api.md#list-companies) |
| `POST /batch` | Get companies batch | [data-management-api.md](data-management-api.md#get-companies-batch) |
| `POST /delete` | Delete companies batch | [data-management-api.md](data-management-api.md#delete-companies-batch) |
| `POST /sync` | Sync companies (delete missing) | [data-management-api.md](data-management-api.md#sync-companies-full-list-reconciliation) |

### `/product`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List products | [data-management-api.md](data-management-api.md#list-products) |
| `POST /batch` | Get products batch | [data-management-api.md](data-management-api.md#get-products-batch) |
| `POST /find/category` | Find products by category UIDs | [data-management-api.md](data-management-api.md#find-products-by-category-batch) |
| `POST /descriptions/batch` | Get product descriptions batch | [data-management-api.md](data-management-api.md#get-batch-product-descriptions) |
| `POST /` | Upsert product (syncs tags) | [data-management-api.md](data-management-api.md#product) |
| `POST /delete` | Delete products batch | [data-management-api.md](data-management-api.md#product) |
| `POST /active` | Update product active status | [data-management-api.md](data-management-api.md#product) |
| `POST /description` | Upsert product description | [data-management-api.md](data-management-api.md#product) |
| `POST /description/delete` | Delete product descriptions batch | [data-management-api.md](data-management-api.md#product) |
| `GET /image/{productUID}` | Get product images | [data-management-api.md](data-management-api.md#get-product-images) |
| `POST /image` | Upsert product images | [data-management-api.md](data-management-api.md#upsert-product-images-batch) |
| `POST /image/batch` | Get main images batch | [data-management-api.md](data-management-api.md#get-main-images-batch) |
| `POST /image/delete` | Delete product images | [data-management-api.md](data-management-api.md#delete-product-images-batch) |

### `/product_tags` (ERP Integration)
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /` | Upsert product tag definitions | [data-management-api.md](data-management-api.md#upsert-product-tags-erp) |
| `POST /delete` | Delete product tags | [data-management-api.md](data-management-api.md#delete-product-tags-erp) |
| `POST /assignments` | Upsert product-tag assignments | [data-management-api.md](data-management-api.md#upsert-product-tag-assignments-erp) |
| `POST /assignments/delete` | Delete product-tag assignments | [data-management-api.md](data-management-api.md#delete-product-tag-assignments-erp) |

### `/category`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List categories | [data-management-api.md](data-management-api.md#list-categories) |
| `POST /batch` | Get categories batch | [data-management-api.md](data-management-api.md#get-categories-batch) |
| `POST /find/parent` | Find categories by parent UIDs | [data-management-api.md](data-management-api.md#find-categories-by-parent-uids-batch) |
| `POST /description/batch` | Get category descriptions batch | [data-management-api.md](data-management-api.md#get-batch-category-descriptions) |
| `POST /` | Upsert category | [data-management-api.md](data-management-api.md#category) |
| `POST /delete` | Delete categories batch | [data-management-api.md](data-management-api.md#category) |
| `POST /description` | Upsert category description | [data-management-api.md](data-management-api.md#category) |
| `POST /description/delete` | Delete category descriptions batch | [data-management-api.md](data-management-api.md#category) |

### `/attribute`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List attributes | [data-management-api.md](data-management-api.md#list-attributes) |
| `POST /batch` | Get attributes batch | [data-management-api.md](data-management-api.md#get-attributes-batch) |
| `POST /find/product` | Find attributes by product UIDs | [data-management-api.md](data-management-api.md#find-attributes-by-product-uids-batch) |
| `POST /description/batch` | Get attribute descriptions batch | [data-management-api.md](data-management-api.md#get-batch-attribute-descriptions) |
| `POST /value/batch` | Get attribute values batch | [data-management-api.md](data-management-api.md#get-batch-attribute-values) |
| `POST /` | Upsert attribute | [data-management-api.md](data-management-api.md#attribute) |
| `POST /delete` | Delete attributes batch | [data-management-api.md](data-management-api.md#attribute) |
| `POST /description` | Upsert attribute description | [data-management-api.md](data-management-api.md#attribute) |
| `POST /description/delete` | Delete attribute descriptions batch | [data-management-api.md](data-management-api.md#attribute) |
| `POST /value` | Upsert attribute value | [data-management-api.md](data-management-api.md#attribute) |
| `POST /value/delete` | Delete attribute values batch | [data-management-api.md](data-management-api.md#attribute) |

### `/price`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /find/product` | Get price by product | [data-management-api.md](data-management-api.md#get-all-prices-for-a-product) |
| `POST /batch/products` | Get prices by products batch | [data-management-api.md](data-management-api.md#get-prices-for-multiple-products-batch) |
| `POST /batch/price_types` | Get prices by price types batch | [data-management-api.md](data-management-api.md#get-prices-for-multiple-price-types-batch) |
| `POST /batch/price_type_products` | Get prices by price type and products batch | [data-management-api.md](data-management-api.md#get-prices-for-products-under-specific-price-type-batch) |
| `POST /` | Upsert price | [data-management-api.md](data-management-api.md#price) |
| `POST /delete` | Delete prices batch | [data-management-api.md](data-management-api.md#price) |
| `POST /delete/products` | Delete prices by products batch | [data-management-api.md](data-management-api.md#price) |
| `POST /delete/price_types` | Delete prices by price types batch | [data-management-api.md](data-management-api.md#price) |

### `/order`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /` | Upsert order | [data-management-api.md](data-management-api.md#create-order-upsert) |
| `PUT /` | Update order partial | [data-management-api.md](data-management-api.md#partial-update-order) |
| `POST /batch` | Get orders batch | [data-management-api.md](data-management-api.md#get-orders-batch) |
| `POST /find/client` | Find orders by client UIDs | [data-management-api.md](data-management-api.md#find-orders-by-client-uids-batch) |
| `POST /item` | Upsert order item | [data-management-api.md](data-management-api.md#upsert-order-items-batch) |
| `POST /items/batch` | Get order items batch | [data-management-api.md](data-management-api.md#get-batch-order-items) |
| `GET /` | List all orders | [data-management-api.md](data-management-api.md#order) |
| `POST /delete` | Delete orders batch | [data-management-api.md](data-management-api.md#order) |
| `POST /find/status` | Find orders by statuses | [data-management-api.md](data-management-api.md#order) |
| `POST /status` | Update order status | [data-management-api.md](data-management-api.md#order) |
| `POST /history` | Get order history batch | [data-management-api.md](data-management-api.md#get-order-history-batch) |
| `POST /item/delete` | Delete order items batch | [data-management-api.md](data-management-api.md#order) |
| `POST /edit` | ERP order edit (recalculate with modified items) | [data-management-api.md](data-management-api.md#erp-order-edit) |

### `/store`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List stores | [data-management-api.md](data-management-api.md#list-stores) |
| `POST /get` | Get stores batch | [data-management-api.md](data-management-api.md#get-stores-batch) |
| `POST /inventory/get` | Get inventory by stores batch | [data-management-api.md](data-management-api.md#get-inventory-by-store-products-nested-batch) |
| `POST /inventory/find/product` | Get inventory by products batch | [data-management-api.md](data-management-api.md#get-inventory-by-products-batch) |
| `POST /inventory/find/store-product` | Get inventory by store-products batch | [data-management-api.md](data-management-api.md#store) |
| `POST /inventory/available` | Get available quantity batch | [data-management-api.md](data-management-api.md#get-available-quantity-batch-nested-batch) |
| `POST /` | Upsert store | [data-management-api.md](data-management-api.md#store) |
| `POST /delete` | Delete stores batch | [data-management-api.md](data-management-api.md#store) |
| `POST /active` | Update stores active batch | [data-management-api.md](data-management-api.md#store) |
| `POST /inventory` | Upsert store inventory | [data-management-api.md](data-management-api.md#store) |
| `POST /inventory/delete` | Delete inventory batch | [data-management-api.md](data-management-api.md#store) |

### `/price_type`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List price types | [data-management-api.md](data-management-api.md#list-price-types) |
| `POST /batch` | Get price types batch | [data-management-api.md](data-management-api.md#get-price-types-batch) |
| `POST /find/currency` | Get price types by currency codes batch | [data-management-api.md](data-management-api.md#find-price-types-by-currency-codes-batch) |
| `POST /` | Upsert price type | [data-management-api.md](data-management-api.md#price-type) |
| `POST /delete` | Delete price types batch | [data-management-api.md](data-management-api.md#price-type) |

### `/currency`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List currencies | [data-management-api.md](data-management-api.md#list-currencies) |
| `POST /batch` | Get currencies batch | [data-management-api.md](data-management-api.md#get-currencies-batch) |
| `POST /names` | Get currency names batch | [data-management-api.md](data-management-api.md#get-currency-names-batch) |
| `POST /names/client` | Get currency for client | [data-management-api.md](data-management-api.md#get-currency-for-client) |
| `POST /` | Upsert currency | [data-management-api.md](data-management-api.md#currency) |
| `POST /delete` | Delete currencies batch | [data-management-api.md](data-management-api.md#currency) |

### `/order_status`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List order statuses | [data-management-api.md](data-management-api.md#list-order-statuses) |
| `POST /batch` | Get order statuses batch | [data-management-api.md](data-management-api.md#get-order-statuses-batch) |
| `POST /` | Upsert order status | [data-management-api.md](data-management-api.md#order-status) |
| `POST /delete` | Delete order statuses batch | [data-management-api.md](data-management-api.md#order-status) |

### `/country`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List countries | [data-management-api.md](data-management-api.md#list-countries) |
| `POST /batch` | Get countries batch | [data-management-api.md](data-management-api.md#get-countries-batch) |
| `POST /` | Upsert country | [data-management-api.md](data-management-api.md#upsert-countries) |
| `POST /delete` | Delete countries batch | [data-management-api.md](data-management-api.md#delete-countries-batch) |

### `/client_address`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List client addresses | [data-management-api.md](data-management-api.md#list-client-addresses) |
| `POST /batch` | Get client addresses batch | [data-management-api.md](data-management-api.md#get-client-addresses-batch) |
| `POST /find/client` | Find by client UIDs | [data-management-api.md](data-management-api.md#find-client-addresses-by-client-uids) |
| `POST /` | Upsert client address | [data-management-api.md](data-management-api.md#upsert-client-addresses) |
| `POST /delete` | Delete client addresses batch | [data-management-api.md](data-management-api.md#delete-client-addresses-batch) |

### `/cleanup`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /` | Cleanup operation | [data-management-api.md](data-management-api.md#cleanup) |

### `/discount_scale`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | Get discount scales by store | [data-management-api.md](data-management-api.md#get-discount-scales-by-store) |
| `POST /` | Upsert discount scales | [data-management-api.md](data-management-api.md#upsert-discount-scales) |
| `POST /delete` | Delete discount scale | [data-management-api.md](data-management-api.md#delete-discount-scale-entry) |
| `DELETE /store` | Delete discount scales by store | [data-management-api.md](data-management-api.md#delete-all-discount-scales-for-store) |

### `/product_discount_limit`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | Get product discount limits by store | [data-management-api.md](data-management-api.md#get-product-discount-limits-by-store) |
| `POST /` | Upsert product discount limits (batch, for CRM sync) | [data-management-api.md](data-management-api.md#upsert-product-discount-limits-batch) |
| `POST /delete` | Delete product discount limit | [data-management-api.md](data-management-api.md#delete-product-discount-limit) |

### `/product_country_availability`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List availability rows by destination country | [data-management-api.md](data-management-api.md#list-availability-by-country) |
| `GET /count` | Total availability rows (guards the store toggle) | [data-management-api.md](data-management-api.md#count-availability-rows) |
| `POST /batch` | Get availability rows for products | [data-management-api.md](data-management-api.md#get-availability-for-products-batch) |
| `POST /` | Upsert availability rows (batch) | [data-management-api.md](data-management-api.md#upsert-availability-batch) |
| `POST /sync` | Replace all rows of the products in the payload | [data-management-api.md](data-management-api.md#sync-availability-full-replace-per-product) |
| `POST /delete` | Delete a single availability row | [data-management-api.md](data-management-api.md#delete-a-single-row) |
| `POST /delete/products` | Delete all rows of the given products | [data-management-api.md](data-management-api.md#delete-all-rows-of-products-batch) |

### `/client_certification_countries`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List the countries clients sell into | [data-management-api.md](data-management-api.md#list-certification-countries) |
| `GET /count` | Total certification country rows | [data-management-api.md](data-management-api.md#count-certification-country-rows) |
| `POST /batch` | Get certification countries for clients | [data-management-api.md](data-management-api.md#get-certification-countries-for-clients-batch) |
| `POST /` | Upsert certification countries (batch) | [data-management-api.md](data-management-api.md#upsert-certification-countries-batch) |
| `POST /sync` | Replace all rows of the clients in the payload | [data-management-api.md](data-management-api.md#sync-certification-countries-full-replace-per-client) |
| `POST /delete` | Delete a single row | [data-management-api.md](data-management-api.md#delete-a-single-row-1) |
| `POST /delete/clients` | Clear the destination list of the given clients | [data-management-api.md](data-management-api.md#delete-all-rows-of-clients-batch) |

### `/crm` (ERP Integration)
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /stages` | List active pipeline stages | [data-management-api.md](data-management-api.md#list-active-pipeline-stages) |
| `POST /stages/batch` | Get stages by UIDs | [data-management-api.md](data-management-api.md#get-stages-batch) |
| `GET /board` | Get full pipeline board | [data-management-api.md](data-management-api.md#get-pipeline-board) |
| `GET /board/orders` | Get orders by stage (paginated) | [data-management-api.md](data-management-api.md#get-orders-by-stage) |
| `POST /board/move` | Move order to stage | [data-management-api.md](data-management-api.md#move-order-to-stage) |
| `POST /board/pipeline/batch` | Get order pipeline info batch | [data-management-api.md](data-management-api.md#get-order-pipeline-info-batch) |

### `/changes` (Change Tracking for ERP)
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | Get pending changes for sync | [data-management-api.md](data-management-api.md#get-pending-changes) |
| `POST /confirm` | Confirm processed changes | [data-management-api.md](data-management-api.md#confirm-changes) |

### `/user` (ERP User Upload)
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /` | Upsert ERP users (batch, creates managers with no password) | [data-management-api.md](data-management-api.md#upsert-erp-users) |
| `POST /active` | Sync active staff roster (deactivates managers not in the list) | [data-management-api.md](data-management-api.md#sync-active-user-roster) |

---

## Admin (Authenticated + User role required)

See [admin-api.md](admin-api.md) for detailed documentation.

### Admin/Manager Role Required

#### `/admin`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /dashboard` | Dashboard statistics | [admin-api.md](admin-api.md#get-dashboard-statistics) |
| `GET /discount_scale` | Get discount scales for dashboard | [admin-api.md](admin-api.md#discount-scale-dashboard) |

#### `/admin/product_discount_limits`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | Get product discount limits by store | [admin-api.md](admin-api.md#product-discount-limits) |
| `POST /` | Upsert product discount limits (batch) | [admin-api.md](admin-api.md#product-discount-limits) |
| `POST /delete` | Delete product discount limit | [admin-api.md](admin-api.md#product-discount-limits) |

#### `/admin/product_country_availability` (read-only — the ERP owns this data)
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List availability rows by destination country | [data-management-api.md](data-management-api.md#list-availability-by-country) |
| `GET /count` | Total availability rows (guards the store toggle) | [data-management-api.md](data-management-api.md#count-availability-rows) |
| `POST /batch` | Get availability rows for products | [data-management-api.md](data-management-api.md#get-availability-for-products-batch) |

#### `/admin/client_certification_countries` (read-only — the ERP owns this data)
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List the countries clients sell into | [data-management-api.md](data-management-api.md#list-certification-countries) |
| `GET /count` | Total certification country rows | [data-management-api.md](data-management-api.md#count-certification-country-rows) |
| `POST /batch` | Get certification countries for clients | [data-management-api.md](data-management-api.md#get-certification-countries-for-clients-batch) |

#### `/admin/product_tags`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List product tags by store | [admin-api.md](admin-api.md#list-product-tags) |
| `POST /` | Upsert product tags | [admin-api.md](admin-api.md#upsert-product-tags) |
| `POST /batch` | Get product tags batch | [admin-api.md](admin-api.md#get-product-tags-batch) |
| `POST /delete` | Delete product tags | [admin-api.md](admin-api.md#delete-product-tags) |

#### `/admin/clients`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /` | Upsert client | [admin-api.md](admin-api.md#client-management) |
| `GET /` | List clients | [admin-api.md](admin-api.md#client-management) |
| `POST /batch` | Get clients batch | [admin-api.md](admin-api.md#client-management) |
| `POST /delete` | Delete clients batch | [admin-api.md](admin-api.md#client-management) |
| `POST /find/email` | Find clients by emails | [admin-api.md](admin-api.md#client-management) |
| `POST /active` | Update client active status | [admin-api.md](admin-api.md#client-management) |

#### `/admin/orders`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List orders | [admin-api.md](admin-api.md#list-all-orders) |
| `POST /batch` | Get orders batch | [admin-api.md](admin-api.md#order-management) |
| `POST /find/status` | Find orders by statuses | [admin-api.md](admin-api.md#find-orders-by-statuses-batch) |
| `POST /status` | Update order status | [admin-api.md](admin-api.md#update-order-status) |
| `POST /delete` | Delete orders batch | [admin-api.md](admin-api.md#delete-orders-batch) |
| `POST /item/delete` | Delete order items batch | [admin-api.md](admin-api.md#delete-order-items-batch) |
| `POST /edit` | Edit order (recalculate with modified items) | [admin-api.md](admin-api.md#edit-order) |
| `POST /edit/preview` | Preview order edit without saving | [admin-api.md](admin-api.md#preview-order-edit) |
| `POST /edit/check` | Check if order can be edited | [admin-api.md](admin-api.md#can-edit-order) |
| `POST /split` | Split an order: move goods onto new orders | [admin-api.md](admin-api.md#split-order) |
| `POST /split/preview` | Preview a split without saving | [admin-api.md](admin-api.md#preview-split) |
| `POST /split/check` | Check if order can be split | [admin-api.md](admin-api.md#check-if-order-can-be-split) |
| `POST /split/options` | Companies and payers the parts may be assigned to | [admin-api.md](admin-api.md#split-options) |

#### `/admin/orders/invoice`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /request` | Request invoice generation | [admin-api.md](admin-api.md#request-invoice) |
| `POST /types` | Get invoice types available for order | [admin-api.md](admin-api.md#get-invoice-types-for-order) |
| `POST /list` | Get invoices for orders | [admin-api.md](admin-api.md#get-invoices-for-orders) |
| `GET /{uid}` | Download invoice file | [admin-api.md](admin-api.md#download-invoice) |

#### `/admin/orders/shipment`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /create` | Create shipment for order | [admin-api.md](admin-api.md#create-shipment) |
| `POST /list` | Get shipments by order | [admin-api.md](admin-api.md#get-shipments-by-order) |
| `POST /batch` | Get shipments batch | [admin-api.md](admin-api.md#get-shipments-batch) |
| `GET /` | List all shipments | [admin-api.md](admin-api.md#list-shipments) |
| `GET /{uid}` | Get shipment details | [admin-api.md](admin-api.md#get-shipment) |
| `GET /{uid}/label` | Download shipment label | [admin-api.md](admin-api.md#get-shipment-label) |
| `POST /{uid}/track` | Update tracking info | [admin-api.md](admin-api.md#update-tracking) |
| `POST /{uid}/cancel` | Cancel shipment | [admin-api.md](admin-api.md#cancel-shipment) |
| `GET /{uid}/events` | Get shipment tracking events | [admin-api.md](admin-api.md#get-shipment-events) |

#### `/admin/shipment` (Read-only for Admin/Manager)
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /settings` | Get shipment service settings | [admin-api.md](admin-api.md#shipment-settings) |
| `POST /carriers/active` | List active carriers | [admin-api.md](admin-api.md#list-active-carriers) |
| `GET /boxes/active` | Get active box templates | [admin-api.md](admin-api.md#get-active-boxes) |

#### `/admin/changes`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List changes (CRM sync) | [admin-api.md](admin-api.md#list-pending-changes) |
| `POST /confirm` | Confirm changes | [admin-api.md](admin-api.md#confirm-changes) |

#### `/admin/client_balance`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /` | Update client balance | [admin-api.md](admin-api.md#client-balance-management) |
| `POST /batch` | Update client balance batch | [admin-api.md](admin-api.md#client-balance-management) |

#### `/admin/products`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List products | [admin-api.md](admin-api.md#list-all-products) |
| `GET /details` | List products with details | [admin-api.md](admin-api.md#product-management) |
| `GET /search` | Search products for order editing | [admin-api.md](admin-api.md#search-products-for-order) |
| `POST /batch` | Get products batch | [admin-api.md](admin-api.md#get-products-batch) |
| `POST /find/category` | Find products by category UIDs | [admin-api.md](admin-api.md#find-products-by-category-batch) |
| `POST /` | Upsert product | [admin-api.md](admin-api.md#upsert-products-create-or-update) |
| `POST /delete` | Delete products batch | [admin-api.md](admin-api.md#delete-products-batch) |
| `POST /active` | Update product active status | [admin-api.md](admin-api.md#update-product-active-status-batch) |
| `POST /description` | Upsert product description | [admin-api.md](admin-api.md#product-management) |
| `POST /description/delete` | Delete product descriptions batch | [admin-api.md](admin-api.md#product-management) |

#### `/admin/crm` (Pipeline Board - Admin/Manager)

**Stages & Transitions (read-only)**
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /stages` | List pipeline stages | [admin-api.md](admin-api.md#list-stages) |
| `POST /stages/batch` | Get stages by UIDs | [admin-api.md](admin-api.md#get-stages-batch) |
| `GET /transitions` | List stage transitions | [admin-api.md](admin-api.md#list-transitions) |

**Board Operations**
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /board` | Get full pipeline board | [admin-api.md](admin-api.md#get-board) |
| `GET /board/changes` | Get board changes since timestamp | [admin-api.md](admin-api.md#get-board-changes) |
| `POST /board/move` | Move order to stage | [admin-api.md](admin-api.md#move-order) |
| `POST /board/pipeline/batch` | Get order pipeline info batch | [admin-api.md](admin-api.md#get-order-pipeline-batch) |
| `POST /board/populate` | Populate pipeline with existing orders | [admin-api.md](admin-api.md#populate-pipeline) |

**Assignments**
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /assignments` | Assign orders to user | [admin-api.md](admin-api.md#assign-orders) |
| `POST /assignments/batch` | Get assignments by order UIDs | [admin-api.md](admin-api.md#get-assignments-batch) |
| `POST /assignments/delete` | Unassign orders | [admin-api.md](admin-api.md#unassign-orders) |
| `GET /assignments/my` | Get current user's assignments | [admin-api.md](admin-api.md#get-my-assignments) |

**Activities**
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /activities/{order_uid}` | Get activity timeline for order | [admin-api.md](admin-api.md#get-activity-timeline) |
| `POST /activities` | Create activity entry | [admin-api.md](admin-api.md#create-activity) |
| `DELETE /activities/{uid}` | Delete activity | [admin-api.md](admin-api.md#delete-activity) |
| `POST /activities/delete` | Delete activities batch | [admin-api.md](admin-api.md#delete-activities-batch) |

**Tasks**
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /tasks` | Create task | [admin-api.md](admin-api.md#create-task) |
| `GET /tasks` | List tasks (paginated) | [admin-api.md](admin-api.md#list-tasks) |
| `GET /tasks/my` | Get current user's tasks | [admin-api.md](admin-api.md#get-my-tasks) |
| `GET /tasks/overdue` | Get overdue tasks | [admin-api.md](admin-api.md#get-overdue-tasks) |
| `GET /tasks/order/{order_uid}` | Get tasks for order | [admin-api.md](admin-api.md#get-tasks-by-order) |
| `POST /tasks/batch` | Get tasks batch | [admin-api.md](admin-api.md#get-tasks-batch) |
| `POST /tasks/delete` | Delete tasks batch | [admin-api.md](admin-api.md#delete-tasks-batch) |
| `GET /tasks/{uid}` | Get task details | [admin-api.md](admin-api.md#get-task) |
| `PUT /tasks/{uid}` | Update task | [admin-api.md](admin-api.md#update-task) |
| `DELETE /tasks/{uid}` | Delete task | [admin-api.md](admin-api.md#delete-task) |
| `POST /tasks/{uid}/status` | Update task status | [admin-api.md](admin-api.md#update-task-status) |
| `POST /tasks/{uid}/complete` | Complete task | [admin-api.md](admin-api.md#complete-task) |

**Dashboard & Analytics**
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /dashboard` | CRM dashboard statistics | [admin-api.md](admin-api.md#crm-dashboard) |
| `GET /workload` | Team workload overview | [admin-api.md](admin-api.md#crm-workload) |
| `GET /pipeline-stats` | Pipeline statistics | [admin-api.md](admin-api.md#pipeline-stats) |
| `GET /task-stats` | Task statistics | [admin-api.md](admin-api.md#task-stats) |

**Users**
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /users` | Get assignable users for CRM | [admin-api.md](admin-api.md#get-assignable-users) |

### Admin Role Only

#### `/admin/crm` (Pipeline Configuration - Admin Only)
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /stages` | Upsert pipeline stages | [admin-api.md](admin-api.md#upsert-stages) |
| `POST /stages/delete` | Delete stages | [admin-api.md](admin-api.md#delete-stages) |
| `POST /stages/reorder` | Reorder stages | [admin-api.md](admin-api.md#reorder-stages) |
| `POST /transitions` | Upsert transitions | [admin-api.md](admin-api.md#upsert-transitions) |
| `POST /transitions/delete` | Delete transitions | [admin-api.md](admin-api.md#delete-transitions) |

#### `/admin/shipment` (Configuration - Admin Only)
| Endpoint | Description | Details |
|----------|-------------|---------|
| `PUT /settings` | Update shipment service settings | [admin-api.md](admin-api.md#update-shipment-settings) |
| `POST /restart` | Restart shipment service | [admin-api.md](admin-api.md#restart-shipment-service) |
| `GET /carriers` | List all carriers | [admin-api.md](admin-api.md#list-carriers) |
| `POST /carriers` | Upsert carriers | [admin-api.md](admin-api.md#upsert-carriers) |
| `POST /carriers/batch` | Get carriers batch | [admin-api.md](admin-api.md#get-carriers-batch) |
| `POST /carriers/delete` | Delete carriers | [admin-api.md](admin-api.md#delete-carriers) |
| `POST /carriers/test` | Test carrier connection | [admin-api.md](admin-api.md#test-carrier) |
| `POST /boxes` | Upsert box templates | [admin-api.md](admin-api.md#upsert-boxes) |
| `GET /boxes` | List box templates | [admin-api.md](admin-api.md#list-boxes) |
| `POST /boxes/batch` | Get box templates batch | [admin-api.md](admin-api.md#get-boxes-batch) |
| `POST /boxes/delete` | Delete box templates | [admin-api.md](admin-api.md#delete-boxes) |

#### `/admin/user`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `POST /` | Upsert user | [admin-api.md](admin-api.md#upsert-users-create-or-update) |
| `GET /` | List users | [admin-api.md](admin-api.md#list-users) |
| `POST /batch` | Get users batch | [admin-api.md](admin-api.md#get-users-batch) |
| `POST /delete` | Delete users batch | [admin-api.md](admin-api.md#delete-users-batch) |
| `POST /find/username` | Find users by usernames | [admin-api.md](admin-api.md#find-users-by-username-batch) |
| `POST /find/email` | Find users by emails | [admin-api.md](admin-api.md#find-users-by-email-batch) |

#### `/admin/tables`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List database tables | [admin-api.md](admin-api.md#database-tables-viewer) |
| `POST /{table_name}/records` | Search table records | [admin-api.md](admin-api.md#database-tables-viewer) |

#### `/admin/logs`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List logs | [admin-api.md](admin-api.md#logs-viewer) |
| `DELETE /cleanup` | Cleanup logs | [admin-api.md](admin-api.md#logs-viewer) |

#### `/admin/webhooks`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /` | List webhooks | [admin-api.md](admin-api.md#list-webhooks) |
| `POST /` | Upsert webhooks | [admin-api.md](admin-api.md#upsert-webhooks) |
| `POST /batch` | Get webhooks batch | [admin-api.md](admin-api.md#get-webhooks-batch) |
| `POST /delete` | Delete webhooks | [admin-api.md](admin-api.md#delete-webhooks) |
| `POST /active` | Update webhook active status | [admin-api.md](admin-api.md#update-webhook-active-status) |
| `POST /test` | Test webhook delivery | [admin-api.md](admin-api.md#test-webhook) |
| `GET /deliveries` | List all webhook deliveries | [admin-api.md](admin-api.md#list-webhook-deliveries) |
| `GET /deliveries/{webhook_uid}` | List deliveries for webhook | [admin-api.md](admin-api.md#list-webhook-deliveries-by-webhook) |
| `DELETE /deliveries/cleanup` | Cleanup old deliveries | [admin-api.md](admin-api.md#cleanup-webhook-deliveries) |

#### `/admin/telegram`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /subscriptions` | List telegram subscriptions | [admin-api.md](admin-api.md#list-telegram-subscriptions) |
| `POST /subscriptions/batch` | Get subscriptions batch | [admin-api.md](admin-api.md#get-telegram-subscriptions-batch) |
| `POST /subscriptions/delete` | Delete subscriptions | [admin-api.md](admin-api.md#delete-telegram-subscriptions) |
| `POST /subscriptions/update` | Update subscription | [admin-api.md](admin-api.md#update-telegram-subscription) |
| `PUT /subscriptions/types` | Update subscription types | [admin-api.md](admin-api.md#update-telegram-subscription-types) |
| `GET /subscriptions/by-user` | Get subscriptions by user | [admin-api.md](admin-api.md#get-telegram-subscriptions-by-user) |
| `GET /invites` | List invite codes | [admin-api.md](admin-api.md#list-telegram-invite-codes) |
| `POST /invites` | Generate invite codes | [admin-api.md](admin-api.md#generate-telegram-invite-codes) |
| `POST /invites/batch` | Get invite codes batch | [admin-api.md](admin-api.md#get-telegram-invite-codes-batch) |
| `POST /invites/delete` | Delete invite codes | [admin-api.md](admin-api.md#delete-telegram-invite-codes) |
| `GET /settings` | Get bot settings | [admin-api.md](admin-api.md#get-telegram-bot-settings) |
| `PUT /settings` | Update bot settings | [admin-api.md](admin-api.md#update-telegram-bot-settings) |
| `POST /settings/test` | Test bot connection | [admin-api.md](admin-api.md#test-telegram-bot-connection) |
| `POST /settings/restart` | Restart bot | [admin-api.md](admin-api.md#restart-telegram-bot) |

#### `/admin/mail`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /settings` | Get mail service settings | [admin-api.md](admin-api.md#get-mail-settings) |
| `PUT /settings` | Update mail settings | [admin-api.md](admin-api.md#update-mail-settings) |
| `POST /test` | Test mail connection | [admin-api.md](admin-api.md#test-mail-connection) |
| `POST /restart` | Restart mail service | [admin-api.md](admin-api.md#restart-mail-service) |

#### `/admin/invoice`
| Endpoint | Description | Details |
|----------|-------------|---------|
| `GET /settings` | Get invoice settings | [admin-api.md](admin-api.md#get-invoice-settings) |
| `PUT /settings` | Update invoice settings | [admin-api.md](admin-api.md#update-invoice-settings) |
| `GET /types` | List invoice types | [admin-api.md](admin-api.md#list-invoice-types) |
| `POST /types` | Upsert invoice types | [admin-api.md](admin-api.md#upsert-invoice-types) |
| `POST /types/batch` | Get invoice types batch | [admin-api.md](admin-api.md#get-invoice-types-batch) |
| `POST /types/delete` | Delete invoice types | [admin-api.md](admin-api.md#delete-invoice-types) |
| `POST /types/active` | Update invoice type active status | [admin-api.md](admin-api.md#update-invoice-type-active-status) |
| `POST /types/test` | Test invoice type | [admin-api.md](admin-api.md#test-invoice-type) |
| `GET /history` | List invoice history | [admin-api.md](admin-api.md#list-invoices) |
| `POST /history/delete` | Delete invoices | [admin-api.md](admin-api.md#delete-invoices) |
| `DELETE /history/cleanup` | Cleanup old invoices | [admin-api.md](admin-api.md#cleanup-invoices) |
