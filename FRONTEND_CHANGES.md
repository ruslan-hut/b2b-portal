# Frontend Changes Required - Multi-Store Inventory System

This document outlines the changes required in your frontend application to work with the new **multi-store inventory system**. The backend has been fundamentally reworked from a single global inventory to a per-store model.

---

## 1. The Multi-Store Inventory System

### Overview
The backend no longer tracks a single, global quantity for each product. Instead, inventory is managed on a per-store basis. This is a major architectural shift.

### Key Concepts
1.  **Stores are the source of truth for inventory.** Each product can have different stock levels in different stores.
2.  **Users can be associated with a single store.** A user's `store_uid` determines which store's inventory they see and order from.
3.  **Product availability is store-specific.** When a user browses products, they will only see the stock available in their assigned store.
4.  **Orders are fulfilled from the user's store.** When an order is placed, inventory is allocated from the user's assigned store.

### What Changed
- **Before:** Products had a single `quantity` field. Availability was global.
- **After:** The `product.quantity` field has been **removed**. Inventory is now in a new `store_inventory` table. Users can be linked to a `store_uid`.

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
The endpoint to get available quantity now requires a `store_uid`.

**API Endpoint:** `GET /api/v1/products/{uid}/available?store_uid={store_uid}`

```javascript
// ✅ CORRECT - Pass the user's store_uid
async function getAvailableQuantity(productUID, storeUID) {
  if (!storeUID) {
    // Cannot check availability without a store
    return 0;
  }
  const response = await fetch(`/api/v1/products/${productUID}/available?store_uid=${storeUID}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
      // This can happen if the product has no inventory record in this store
      return 0;
  }

  const data = await response.json();
  return data.data.available_quantity;
}

// --- Usage Example ---
// Get the user's store UID from your app's state/context
const userStoreUID = useUserStore(); 

const availableQty = await getAvailableQuantity(product.uid, userStoreUID);

if (availableQty < requestedQuantity) {
  showError(`Only ${availableQty} items available in your store`);
}
```

### C. Product List & Detail Display

Your product pages must be updated to show inventory from the user's store.

```javascript
// Example: Product Card Component
function ProductCard({ product }) {
  const userStoreUID = useUserStore(); // Get from context/state
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    if (userStoreUID) {
      // Fetch available quantity for the user's store
      getAvailableQuantity(product.uid, userStoreUID).then(setAvailable);
    }
  }, [product.uid, userStoreUID]);

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

Cart validation must also use the user's store. The backend will validate this when creating an order with status `"new"`, but you should validate it on the frontend first for better UX.

```javascript
// NEW: Check against available quantity in the user's store
async function validateCart(cartItems, storeUID) {
  for (const item of cartItems) {
    const available = await getAvailableQuantity(item.productUID, storeUID);
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
        body: JSON.stringify({ data: [payload] })
    });
    // ...
}
```
You will likely need a new UI component (like a dropdown) to list and select from available stores to assign to a user.

---

## 3. API Endpoint Changes

### New Endpoints

A full suite of endpoints for managing stores and their inventory is available. These are primarily for admin frontends.

```
// Store Management
POST   /api/v1/stores          - Create/update stores
GET    /api/v1/stores          - List all stores
GET    /api/v1/stores/{uid}    - Get a single store

// Store Inventory Management
GET    /api/v1/stores/{uid}/inventory                 - List all inventory for a store
POST   /api/v1/stores/{uid}/inventory                 - Update inventory for a product in a store
GET    /api/v1/stores/{uid}/inventory/{product_uid}   - Get a specific inventory item
```

### Modified Endpoints

- `GET /api/v1/auth/me`
  - The response object for the user now includes an optional `store_uid`.
- `POST /api/v1/user` (or similar user management endpoint)
  - The `store_uid` field is now available on the user object.
- `GET /api/v1/products/{uid}/available`
  - Now requires a `?store_uid={store_uid}` query parameter.
  - Will return an error if `store_uid` is missing.
- `POST /api/v1/order`
  - No change to the request body from the frontend.
  - The backend will automatically use the user's `store_uid` to validate stock and create allocations. The frontend must simply ensure the user has a valid store assigned.

### Removed Fields / Endpoints

- **`product.quantity`**: This field is gone from the `Product` entity. Do not use it.
- **`PATCH /api/v1/products/{uid}/stock`**: This endpoint is removed or repurposed for internal sync and should not be used by the frontend.

---

## 4. Migration Strategy

Follow these steps to adapt your frontend application.

**Phase 1: User Store Identification**
1.  On user login, fetch the user data from `/api/v1/auth/me` and extract the `store_uid`.
2.  Store this `store_uid` in a global state (Context, Redux, etc.).
3.  Handle cases where `store_uid` is missing (e.g., show a "Contact Support" message or default to a public/main store).

**Phase 2: Update Availability Checks (Critical)**
1.  Create a new `getAvailableQuantity(productUID, storeUID)` helper function as shown above.
2.  Search your codebase for all old availability checks and replace them with calls to the new function, passing the user's `store_uid`.
3.  This includes product pages, cart validation, and any "add to cart" logic.

**Phase 3: Update UI**
1.  Remove any references to `product.quantity`.
2.  Update product lists, product detail pages, and cart items to display the available quantity fetched for the user's store.

**Phase 4: Admin Panel Updates (If applicable)**
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
A: Use the new `/api/v1/stores/{uid}/inventory` endpoints. The UI needs to allow selecting a store, then a product, and then setting its quantity.

**Q: What happens to old orders?**
A: The backend migration assigns them to a default store, so they should remain consistent.

---
*This document replaces the previous `FRONTEND_CHANGES.md` regarding the product allocation system. The allocation system still exists but is now scoped to stores.*
