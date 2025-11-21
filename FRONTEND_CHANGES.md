# Frontend Changes Required - Multi-Store Inventory System

This document outlines the changes required in your frontend application to work with the new **multi-store inventory system** and **batch-first API design**. The backend has been fundamentally reworked from a single global inventory to a per-store model, and all major entity operations now prioritize batch processing.

---

## 1. The Multi-Store Inventory System & Batch API Design

### Overview
The backend no longer tracks a single, global quantity for each product. Instead, inventory is managed on a per-store basis. This is a major architectural shift. Additionally, all major entity operations (create, retrieve, update, delete) now primarily use batch endpoints.

### Key Concepts
1.  **Stores are the source of truth for inventory.** Each product can have different stock levels in different stores.
2.  **Users can be associated with a single store.** A user's `store_uid` determines which store's inventory they see and order from.
3.  **Product availability is store-specific.** When a user browses products, they will only see the stock available in their assigned store.
4.  **Orders are fulfilled from the user's store.** When an order is placed, inventory is allocated from the user's assigned store.
5.  **Batch-first API design:** All CRUD operations for main entities now support array inputs/outputs to minimize HTTP requests and improve performance.

### What Changed
- **Before:** Products had a single `quantity` field. Availability was global. Single-entity GET/DELETE endpoints were common.
- **After:** The `product.quantity` field has been **removed**. Inventory is now in a new `store_inventory` table. Users can be linked to a `store_uid`. All major entity operations now use `POST` endpoints with `{"data": [...]}` for batch processing. Old URL-parameter based GET/DELETE endpoints have been removed or replaced.

---

## 2. Required Frontend Changes

This is a **breaking change**. Your frontend will require significant updates to function correctly.

### A. Fetching the User's Store

The first step after a user logs in is to identify their assigned store. The `store_uid` is now part of the `User` entity returned from the authentication endpoint.

```javascript
// When fetching user data after login
async function getUserData() {
  const response = await fetch(`/api/v1/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const user = (await response.json()).data;

  // ⚠️ IMPORTANT: Store the user's store_uid globally
  // You will need this for all inventory checks.
  const userStoreUID = user.store_uid;
  
  // Example: save to context, Redux, etc.
  setAppStore({ ...appStore, currentUserStore: userStoreUID });

  return user;
}
```
**If `user.store_uid` is empty, the user may not be able to order products.** You should probably show a message asking them to contact support or handle this case gracefully based on your business logic.

### B. Product Availability Checks (Critical Change)

The old way of checking availability is **obsolete**. You must now check availability within the user's store.

**OLD APPROACH (No longer works):**
```javascript
// ❌ INCORRECT - This endpoint is changed or removed
const response = await fetch(`/api/v1/product/${productUID}/available`); 
```

**NEW APPROACH (Required):**
The endpoint to get available quantity now requires a `store_uid` and is a `POST` request for batching.

**API Endpoint:** `POST /api/v1/store/inventory/available`

```javascript
// ✅ CORRECT - Pass the user's store_uid and product UIDs in a batch request
async function getAvailableQuantities(storeUID, productUIDs) {
  if (!storeUID || productUIDs.length === 0) {
    return {}; // Return empty object if no store or products
  }
  const response = await fetch(`/api/v1/store/inventory/available`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify({
      data: [{ store_uid: storeUID, product_uids: productUIDs }]
    })
  });
  
  if (!response.ok) {
      // Handle error appropriately
      console.error('Failed to fetch available quantities');
      return {};
  }

  const data = await response.json();
  // The response data is nested by store_uid, then product_uid
  return data.data[storeUID] || {}; 
}

// --- Usage Example ---
// Get the user's store UID from your app's state/context
const userStoreUID = useUserStore(); 
const productUIDsInCart = cartItems.map(item => item.productUID);

const availableQuantities = await getAvailableQuantities(userStoreUID, productUIDsInCart);

for (const item of cartItems) {
  const available = availableQuantities[item.productUID] || 0;
  if (available < item.quantity) {
    showError(`Only ${available} items available for ${item.name} in your store`);
    break;
  }
}
```

### C. Product List & Detail Display

Your product pages must be updated to show inventory from the user's store. This will likely involve fetching all product UIDs on a page and then making a single batch request for their available quantities.

```javascript
// Example: Product Card Component
function ProductCard({ product }) {
  const userStoreUID = useUserStore(); // Get from context/state
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    if (userStoreUID && product?.uid) {
      // Fetch available quantity for this single product in the user's store
      // For a list of products, you would batch this.
      getAvailableQuantities(userStoreUID, [product.uid]).then(res => {
        setAvailable(res[product.uid]);
      });
    }
  }, [product?.uid, userStoreUID]);

  return (
    <div className="product-card">
      <h3>{product.name}</h3>
      <p>Price: ${product.price / 100}</p>

      {/* OLD: product.quantity no longer exists! */}
      {/* <p>Stock: {product.quantity}</p> ❌ */}

      {/* NEW: Show available quantity in the user's store */}
      <p className="stock-new">
        Available: {available ?? 'Loading...'} ✅
      </p>
    </div>
  );
}
```

### D. Cart Validation

Cart validation must also use the user's store. The backend will validate this when creating an order with status `"new"`, but you should validate it on the frontend first for better UX. Use the batch endpoint for efficiency.

```javascript
// NEW: Check against available quantity in the user's store using batch API
async function validateCart(cartItems, storeUID) {
  const productUIDs = cartItems.map(item => item.productUID);
  const availableQuantities = await getAvailableQuantities(storeUID, productUIDs);

  for (const item of cartItems) {
    const available = availableQuantities[item.productUID] || 0;
    if (available < item.quantity) {  // ✅ CORRECT
      return {
        valid: false,
        message: `Only ${available} items available for ${item.name} in your store.`
      };
    }
  }
  return { valid: true };
}
```

### E. User Management (For Admin UIs)

If you have an admin panel for managing users, you must now include the `store_uid`.

```javascript
// When creating or updating a user
async function upsertUser(userData) {
    const payload = {
        uid: userData.uid,
        username: userData.username,
        // ... other fields
        store_uid: userData.selectedStoreUID // ✅ NEW & OPTIONAL
    };

    const response = await fetch('/api/v1/user', { // Assuming a /user endpoint
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [payload] })
    });
    // ...
}
```
You will likely need a new UI component (like a dropdown) to list and select from available stores to assign to a user.

---

## 3. API Endpoint Changes

### General Batch API Pattern

All major entity operations (User, Product, Client, Category, Currency, Order, Attribute, Order Status) now follow a batch-first design.

-   **Upsert (Create/Update):** `POST /{entity}` with `{"data": [...]}`
-   **Batch Get:** `POST /{entity}/batch` with `{"data": ["uid1", "uid2"]}`
-   **Batch Delete:** `POST /{entity}/delete` with `{"data": ["uid1", "uid2"]}`
-   **Batch Find (by field):** `POST /{entity}/find/{field}` with `{"data": ["value1", "value2"]}`

### New Endpoints

A full suite of endpoints for managing stores and their inventory is available. These are primarily for admin frontends.

```
// Store Management
POST   /api/v1/store          - Create/update stores (batch)
GET    /api/v1/store          - List all stores
POST   /api/v1/store/batch    - Get multiple stores by UIDs
POST   /api/v1/store/delete   - Delete multiple stores by UIDs
POST   /api/v1/store/active   - Update active status for multiple stores

// Store Inventory Management
POST   /api/v1/store/inventory                 - Create/update inventory for products in specific stores (batch)
POST   /api/v1/store/inventory/batch           - Get inventory for multiple stores (returns map[storeUID][]inventory)
POST   /api/v1/store/inventory/find/product    - Get inventory for multiple products across all stores (returns map[productUID][]inventory)
POST   /api/v1/store/inventory/get             - Get inventory for specific store-product combinations (nested batch)
POST   /api/v1/store/inventory/delete          - Delete multiple store-product inventory entries (batch)
POST   /api/v1/store/inventory/available       - Get available quantities for multiple store-product pairs (nested batch)
```

### Modified Endpoints (Batch-First Adoption)

The following endpoints have been updated to use the batch-first pattern. Old single-entity GET/DELETE endpoints (e.g., `GET /user/{uid}`, `DELETE /product/{uid}`) have been **removed**.

#### User Endpoints
-   `POST /api/v1/user` - Upsert Users (batch)
-   `GET /api/v1/user` - List Users
-   `POST /api/v1/user/batch` - Get Users by UIDs (NEW)
-   `POST /api/v1/user/delete` - Delete Users by UIDs (NEW)
-   `POST /api/v1/user/find/email` - Find Users by Emails (NEW)
-   `POST /api/v1/user/find/username` - Find Users by Usernames (NEW)
-   **Removed:** `GET /user/{uid}`, `DELETE /user/{uid}`, `GET /user/email/{email}`, `GET /user/username/{username}`

#### Product Endpoints
-   `POST /api/v1/product` - Upsert Products (batch)
-   `GET /api/v1/product` - List Products
-   `POST /api/v1/product/batch` - Get Products by UIDs (NEW)
-   `POST /api/v1/product/delete` - Delete Products by UIDs (NEW)
-   `POST /api/v1/product/find/category` - Find Products by Category UIDs (NEW)
-   `POST /api/v1/product/active` - Update Product Active Status (batch)
-   `POST /api/v1/product/description` - Upsert Product Descriptions (batch)
-   `POST /api/v1/product/description/delete` - Delete Product Descriptions (NEW)
-   `POST /api/v1/product/descriptions/batch` - Get Batch Product Descriptions (EXISTING)
-   **Removed:** `GET /product/{uid}`, `DELETE /product/{uid}`, `GET /product/category/{categoryUID}`, `DELETE /product/description/{productUID}/{language}`, `GET /product/description/{productUID}`

#### Category Endpoints
-   `POST /api/v1/category` - Upsert Categories (batch)
-   `GET /api/v1/category` - List Categories
-   `POST /api/v1/category/batch` - Get Categories by UIDs (NEW)
-   `POST /api/v1/category/delete` - Delete Categories by UIDs (NEW)
-   `POST /api/v1/category/find/parent` - Find Categories by Parent UIDs (NEW)
-   `POST /api/v1/category/description` - Upsert Category Descriptions (batch)
-   `POST /api/v1/category/description/batch` - Get Batch Category Descriptions (NEW)
-   `POST /api/v1/category/description/delete` - Delete Category Descriptions (NEW)
-   **Removed:** `GET /category/{uid}`, `DELETE /category/{uid}`, `GET /category/parent/{parentUID}`, `DELETE /category/description/{categoryUID}/{language}`, `GET /category/description/{categoryUID}`

#### Client Endpoints
-   `POST /api/v1/client` - Upsert Clients (batch)
-   `GET /api/v1/client` - List Clients
-   `POST /api/v1/client/batch` - Get Clients by UIDs (NEW)
-   `POST /api/v1/client/delete` - Delete Clients by UIDs (NEW)
-   `POST /api/v1/client/find/email` - Find Clients by Emails (NEW)
-   `POST /api/v1/client/active` - Update Client Active Status (batch)
-   **Removed:** `GET /client/{uid}`, `DELETE /client/{uid}`, `GET /client/email/{email}`

#### Currency Endpoints
-   `POST /api/v1/currency` - Upsert Currencies (batch)
-   `GET /api/v1/currency` - List Currencies
-   `POST /api/v1/currency/batch` - Get Currencies by Codes (NEW)
-   `POST /api/v1/currency/delete` - Delete Currencies by Codes (NEW)
-   **Removed:** `GET /currency/{code}`, `DELETE /currency/{code}`

#### Attribute Endpoints
-   `POST /api/v1/attribute` - Upsert Attributes (batch)
-   `GET /api/v1/attribute` - List Attributes
-   `POST /api/v1/attribute/batch` - Get Attributes by UIDs (NEW)
-   `POST /api/v1/attribute/delete` - Delete Attributes by UIDs (NEW)
-   `POST /api/v1/attribute/find/product` - Find Attributes by Product UIDs (NEW)
-   `POST /api/v1/attribute/description` - Upsert Attribute Descriptions (batch)
-   `POST /api/v1/attribute/description/batch` - Get Batch Attribute Descriptions (NEW)
-   `POST /api/v1/attribute/description/delete` - Delete Attribute Descriptions (NEW)
-   `POST /api/v1/attribute/value` - Upsert Attribute Values (batch)
-   `POST /api/v1/attribute/value/batch` - Get Batch Attribute Values (NEW)
-   `POST /api/v1/attribute/value/delete` - Delete Attribute Values (NEW)
-   **Removed:** `GET /attribute/{uid}`, `DELETE /attribute`, `GET /attribute/product/{productUID}`, `DELETE /attribute/description`, `GET /attribute/description/{attributeUID}`, `DELETE /attribute/value`, `GET /attribute/value/{valueUID}`

#### Order Endpoints
-   `POST /api/v1/order` - Upsert Orders (batch)
-   `GET /api/v1/order` - List Orders
-   `POST /api/v1/order/batch` - Get Orders by UIDs (NEW)
-   `POST /api/v1/order/delete` - Delete Orders by UIDs (NEW)
-   `POST /api/v1/order/find/user` - Find Orders by User UIDs (NEW)
-   `POST /api/v1/order/find/status` - Find Orders by Statuses (NEW)
-   `POST /api/v1/order/status` - Update Order Status (batch)
-   `POST /api/v1/order/item` - Upsert Order Items (batch)
-   `POST /api/v1/order/item/delete` - Delete Order Items (NEW)
-   `POST /api/v1/order/items/batch` - Get Batch Order Items (EXISTING)
-   **Removed:** `GET /order/{uid}`, `DELETE /order/{uid}`, `GET /order/user/{user_uid}`, `GET /order/status/{status}`, `PUT /order/{uid}/status`, `DELETE /order/{orderUID}/item/{productUID}`, `GET /order/{orderUID}/items`

#### Order Status Endpoints
-   `POST /api/v1/order_status` - Upsert Order Statuses (batch)
-   `GET /api/v1/order_status` - List Order Statuses
-   `POST /api/v1/order_status/batch` - Get Order Statuses (NEW)
-   `POST /api/v1/order_status/delete` - Delete Order Statuses (NEW)
-   **Removed:** `GET /order_status/{status}/{lang_code}`, `DELETE /order_status`

### Removed Fields / Endpoints

-   **`product.quantity`**: This field is gone from the `Product` entity. Do not use it.
-   **All single-entity GET/DELETE endpoints** (e.g., `GET /user/{uid}`, `DELETE /product/{uid}`) have been replaced by batch `POST` endpoints.

---

## 4. Migration Strategy

Follow these steps to adapt your frontend application.

**Phase 1: User Store Identification**
1.  On user login, fetch the user data from `/api/v1/auth/me` and extract the `store_uid`.
2.  Store this `store_uid` in a global state (Context, Redux, etc.).
3.  Handle cases where `store_uid` is missing (e.g., show a "Contact Support" message or default to a public/main store).

**Phase 2: Update Availability Checks (Critical)**
1.  Create a new `getAvailableQuantities(storeUID, productUIDs)` helper function as shown above.
2.  Search your codebase for all old availability checks and replace them with calls to the new function, passing the user's `store_uid` and an array of product UIDs.
3.  This includes product pages, cart validation, and any "add to cart" logic.

**Phase 3: Update UI**
1.  Remove any references to `product.quantity`.
2.  Update product lists, product detail pages, and cart items to display the available quantity fetched for the user's store.

**Phase 4: Adapt to Batch Endpoints**
1.  Identify all places where you perform single-entity GET, DELETE, or "find by field" operations.
2.  Replace these with calls to the new batch `POST` endpoints.
    -   For single operations, simply pass a single UID/object in the `data` array.
    -   For multiple operations, consolidate into a single batch request.
3.  Ensure your request bodies are always `{"data": [...]}` and responses are handled as arrays.

**Phase 5: Admin Panel Updates (If applicable)**
1.  Add a UI for listing, creating, and editing stores.
2.  When creating or editing a user, add a dropdown or selector to assign a store.
3.  Add a new section for managing inventory on a per-store basis.

---

## 5. FAQ & Common Issues

**Q: Why is the available quantity always 0 for all products?**
A: This can have several causes:
1.  You are not passing the `store_uid` in the availability check.
2.  The user's assigned `store_uid` is incorrect or empty.
3.  The products genuinely have 0 stock in that specific store.
4.  The product has not been added to the store's inventory at all.

**Q: A user sees stock, but gets an "insufficient stock" error when ordering. Why?**
A: This can happen in a race condition where another user orders the same item. Your frontend logic for validating on "add to cart" and re-validating on the cart page should be robust. The final check is always done by the backend during order creation.

**Q: How can an admin manage inventory now?**
A: Use the new `/api/v1/store/inventory` endpoints. The UI needs to allow selecting a store, then a product, and then setting its quantity.

**Q: What happens to old orders?**
A: The backend migration assigns them to a default store, so they should remain consistent.

---
*This document replaces the previous `FRONTEND_CHANGES.md` regarding the product allocation system. The allocation system still exists but is now scoped to stores, and all major API interactions are now batch-first.*
