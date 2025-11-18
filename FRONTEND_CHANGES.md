# Frontend Changes Required

This document outlines the changes required in your frontend application to work with the updated backend API.

## 1. Product Quantity Management Changes

### Overview
The backend now uses a **product allocation system** that separates CRM inventory from order allocations. The `product.quantity` field is no longer modified by order operations.

### What Changed
- **Before:** Creating an order decreased `product.quantity`
- **After:** Creating an order creates allocation records; `product.quantity` remains unchanged

### Required Frontend Changes

#### A. Product Availability Checks

**OLD APPROACH (No longer accurate):**
```javascript
// ❌ INCORRECT - This shows CRM quantity, not available quantity
const isAvailable = product.quantity >= requestedQuantity;
```

**NEW APPROACH (Required):**
```javascript
// ✅ CORRECT - Calculate available quantity
const availableQuantity = product.quantity - allocatedQuantity;
const isAvailable = availableQuantity >= requestedQuantity;
```

#### B. Display Available Inventory

You need to calculate and display available inventory differently:

**Implementation Option 1: Client-Side Calculation**
```javascript
// When displaying product availability
function getAvailableQuantity(product) {
  // You'll need to track allocations separately
  // or make an API call to get available quantity
  return product.quantity - getTotalAllocatedQuantity(product.uid);
}
```

**Implementation Option 2: Backend Endpoint (Recommended)**
Create a new API endpoint handler to expose `GetAvailableQuantity`:

```go
// backend/internal/http-server/handlers/product/available_quantity.go
func GetAvailableQuantity(logger *slog.Logger, product Core) http.HandlerFunc {
    return func(w http.ResponseWriter, r *http.Request) {
        uid := chi.URLParam(r, "uid")
        availableQty, err := product.GetAvailableQuantity(r.Context(), uid)
        if err != nil {
            response.Error(w, r, http.StatusNotFound, "failed to get available quantity")
            return
        }
        render.JSON(w, r, response.Ok(map[string]int{"available_quantity": availableQty}))
    }
}
```

Then in your frontend:
```javascript
// Fetch available quantity from API
async function getAvailableQuantity(productUID) {
  const response = await fetch(`/api/v1/product/${productUID}/available`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data.data.available_quantity;
}

// Use it in your UI
const availableQty = await getAvailableQuantity(product.uid);
if (availableQty < requestedQuantity) {
  showError(`Only ${availableQty} items available`);
}
```

#### C. Product List Display

**Update your product cards/lists:**

```javascript
// Example: Product Card Component
function ProductCard({ product }) {
  const [available, setAvailable] = useState(null);

  useEffect(() => {
    // Fetch available quantity
    getAvailableQuantity(product.uid).then(setAvailable);
  }, [product.uid]);

  return (
    <div className="product-card">
      <h3>{product.name}</h3>
      <p>Price: ${product.price / 100}</p>

      {/* OLD: Show CRM quantity */}
      <p className="stock-old">
        Stock: {product.quantity} ❌ (This is CRM quantity)
      </p>

      {/* NEW: Show available quantity */}
      <p className="stock-new">
        Available: {available ?? 'Loading...'} ✅
      </p>

      {/* Show both for clarity during transition */}
      <div className="stock-details">
        <small>CRM Inventory: {product.quantity}</small>
        <small>Available to Order: {available}</small>
      </div>
    </div>
  );
}
```

#### D. Cart Validation

Update cart validation logic:

```javascript
// OLD: Check against product.quantity
async function validateCart(cartItems) {
  for (const item of cartItems) {
    const product = await getProduct(item.productUID);
    if (product.quantity < item.quantity) {  // ❌ WRONG
      return { valid: false, message: 'Insufficient stock' };
    }
  }
  return { valid: true };
}

// NEW: Check against available quantity
async function validateCart(cartItems) {
  for (const item of cartItems) {
    const available = await getAvailableQuantity(item.productUID);
    if (available < item.quantity) {  // ✅ CORRECT
      return {
        valid: false,
        message: `Only ${available} items available for ${item.name}`
      };
    }
  }
  return { valid: true };
}
```

#### E. Real-Time Updates

If you have real-time inventory updates, adjust your logic:

```javascript
// When receiving CRM inventory updates
socket.on('inventory_update', (data) => {
  // Update product.quantity (CRM quantity)
  updateProduct(data.productUID, { quantity: data.newQuantity });

  // Recalculate available quantity
  refreshAvailableQuantity(data.productUID);
});

// When orders are created/deleted
socket.on('order_change', (data) => {
  // No need to update product.quantity
  // Just recalculate available quantity for affected products
  data.affectedProducts.forEach(productUID => {
    refreshAvailableQuantity(productUID);
  });
});
```

### Migration Strategy

**Phase 1: Add Available Quantity Display (Non-Breaking)**
1. Add available quantity calculation/fetching alongside existing quantity display
2. Show both values to users with clear labels
3. Test thoroughly with real orders

**Phase 2: Update Validation Logic**
1. Switch cart validation to use available quantity
2. Update all availability checks before adding to cart
3. Add user-friendly error messages

**Phase 3: Update UI (Optional)**
1. Consider showing "Available: X" instead of "In Stock: X"
2. Add tooltips explaining the difference
3. Show allocation details for admin users

### Testing Checklist

- [ ] Product pages show correct available quantity
- [ ] Cart validation prevents ordering more than available
- [ ] Creating orders doesn't change displayed CRM quantity
- [ ] Cancelling orders updates available quantity
- [ ] Multiple users can't over-allocate the same product
- [ ] Error messages are user-friendly

---

## 2. Category Description Changes

### Overview
Category descriptions now automatically include the parent category name as a prefix.

### What Changed
- **Before:** `GET /category/description/{uid}` returned `"Smartphones"`
- **After:** `GET /category/description/{uid}` returns `"Electronics Smartphones"`

### Required Frontend Changes

#### A. Category Display

**If you were building breadcrumbs manually:**

```javascript
// OLD: Manual breadcrumb building
function buildBreadcrumbs(category) {
  const breadcrumbs = [];
  let current = category;

  while (current) {
    breadcrumbs.unshift(current.name);  // e.g., ["Smartphones", "Mobile Phones"]
    current = getParentCategory(current.parent_uid);
  }

  return breadcrumbs.join(' > ');  // "Electronics > Smartphones"
}

// NEW: Parent already included in name
function buildBreadcrumbs(category) {
  // Name already has parent prefix: "Electronics Smartphones"
  // Option 1: Use as-is
  return category.name;

  // Option 2: Split by space if you need separate parts
  const parts = category.name.split(' ');
  return parts.join(' > ');  // "Electronics > Smartphones"
}
```

#### B. Category Names in Product Listings

```javascript
// If displaying category in product card
function ProductCard({ product }) {
  const [categoryName, setCategoryName] = useState('');

  useEffect(() => {
    // Fetch category description
    fetchCategoryDescription(product.category_uid, 'en')
      .then(desc => {
        // desc.name will be "Electronics Smartphones" (with parent prefix)
        setCategoryName(desc.name);
      });
  }, [product.category_uid]);

  return (
    <div className="product-card">
      <h3>{product.name}</h3>
      <p className="category">{categoryName}</p>  {/* Shows "Electronics Smartphones" */}
    </div>
  );
}
```

#### C. Category Selection Dropdowns

**If you have category selection UI:**

```javascript
// Categories might now appear duplicated in dropdown
// Example: Both parent and child show "Electronics"

// OLD appearance:
// - Electronics
//   - Smartphones
//   - Laptops

// NEW appearance (without adjustment):
// - Electronics
//   - Electronics Smartphones    ← redundant
//   - Electronics Laptops         ← redundant

// SOLUTION: Remove parent prefix for display in nested UI
function CategoryDropdown({ categories }) {
  function removeParentPrefix(category) {
    if (!category.parent_uid) {
      // Top-level category, no prefix
      return category.name;
    }

    // Child category - remove parent prefix
    // "Electronics Smartphones" → "Smartphones"
    const parts = category.name.split(' ');
    return parts.slice(1).join(' ');  // Skip first word (parent name)
  }

  return (
    <select>
      {categories.map(cat => (
        <option key={cat.uid} value={cat.uid}>
          {cat.parent_uid ? '  ' : ''}{removeParentPrefix(cat)}
        </option>
      ))}
    </select>
  );
}
```

#### D. Search and Filtering

Category names are now longer, which may affect search:

```javascript
// User searches for "smartphones"
function searchCategories(query) {
  return categories.filter(cat =>
    // Will match "Electronics Smartphones"
    cat.name.toLowerCase().includes(query.toLowerCase())
  );
}

// This still works! Searching for "smartphones" will find "Electronics Smartphones"
```

### Migration Strategy

**Phase 1: Visual Inspection**
1. Check all places where category names are displayed
2. Verify they look correct with parent prefixes
3. Identify any UI that looks redundant

**Phase 2: Adjust Nested Displays**
1. Update dropdowns to remove prefix for child categories
2. Adjust breadcrumb logic if needed
3. Update any category trees/menus

**Phase 3: Internationalization**
1. Verify parent prefixes work correctly for all languages
2. Test with categories that have translations
3. Ensure Spanish parent names prefix Spanish child names (not English parent + Spanish child)

### Testing Checklist

- [ ] Category names display correctly in product listings
- [ ] Breadcrumbs don't show redundant parent names
- [ ] Category dropdowns are readable and not redundant
- [ ] Search still finds categories by child name
- [ ] Multi-language categories show correct prefixes per language
- [ ] Top-level categories (no parent) display normally

### Special Cases

#### A. Categories Without Parent Descriptions
If a child category has a parent UID, but the parent has no description in the requested language:
- Backend returns: `"Smartphones"` (no prefix)
- Frontend: Handle this gracefully, don't assume prefix always exists

```javascript
function getCategoryDisplayName(category) {
  // category.name might be:
  // - "Electronics Smartphones" (with parent)
  // - "Smartphones" (parent has no description in this language)
  // - "Electronics" (top-level category)

  return category.name;  // Use as-is
}
```

#### B. Dynamic Category Hierarchies
If users can change category parents:
- Name will update automatically when parent changes
- Frontend should refetch category descriptions after hierarchy changes

---

## 3. Order Status Flow (Draft and New)

### Overview
The order status system now supports two frontend-managed statuses: `"draft"` (saved cart) and `"new"` (confirmed order). Additional statuses (`"processing"`, `"confirmed"`) are managed by your external CRM system.

### Status Definitions
- **`"draft"`**: Saved cart, no validation, no inventory allocation
- **`"new"`**: User-confirmed order, stock validated, inventory allocated
- **`"processing"`**: CRM fulfilling order (cannot be modified by frontend)
- **`"confirmed"`**: CRM completed order, inventory allocation deleted (order fulfilled)

### Important Constraints
- **Frontend can ONLY create orders with status `"draft"` or `"new"`**
- **Attempting to create orders with `"processing"` or `"confirmed"` will return an error**
- **Orders in `"processing"` or `"confirmed"` status cannot be modified (CRM-managed)**

### Status Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND MANAGED                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  "draft" (Saved Cart)          "new" (User Confirmed)        │
│  • No validation               • Stock validated             │
│  • No allocation               • Allocation created          │
│  • Can modify freely           • Can modify (with validation)│
│  • User clicks "Save"          • User clicks "Place Order"   │
│                                                               │
│  Frontend can create: ✅       Frontend can create: ✅       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      CRM MANAGED (Read-Only)                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  "processing"                  "confirmed"                    │
│  • CRM fulfilling order        • Order complete              │
│  • Allocation exists           • Allocation DELETED          │
│  • Cannot modify from FE ❌    • Cannot modify from FE ❌    │
│                                                               │
│  Frontend can create: ❌       Frontend can create: ❌       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Guide

#### A. Saving Cart as Draft Order

```javascript
// When user wants to save cart for later
async function saveCart(cartItems, userUID) {
  const order = {
    user_uid: userUID,
    status: "draft",  // ✅ NEW: Draft status
    total: calculateTotal(cartItems),
    shipping_address: getUserAddress(),
    billing_address: getUserAddress(),
    items: cartItems.map(item => ({
      product_uid: item.productUID,
      quantity: item.quantity,
      price: item.price,
      discount: item.discount || 0,
      total: item.quantity * item.price
    }))
  };

  const response = await fetch('/api/v1/order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({ data: [order] })
  });

  const result = await response.json();
  return result.data[0]; // Returns order UID
}
```

#### B. Loading Saved Cart

```javascript
// Load user's draft orders (saved carts)
async function loadSavedCarts(userUID) {
  const response = await fetch(`/api/v1/order/user/${userUID}?status=draft`, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });

  const result = await response.json();
  return result.data.filter(order => order.status === 'draft');
}
```

#### C. Confirming Draft Order (Creating New Order)

When a user confirms their cart, change the order status from `"draft"` to `"new"`. This triggers stock validation and creates allocations.

**Option 1: Create Order Directly with "new" Status (Recommended)**
```javascript
// Create a new order when user confirms cart
async function confirmCart(cartItems, userUID) {
  try {
    const order = {
      user_uid: userUID,
      status: "new",  // ✅ IMPORTANT: Use "new" status, NOT "confirmed"
      total: calculateTotal(cartItems),
      shipping_address: getUserAddress(),
      billing_address: getUserAddress(),
      items: cartItems.map(item => ({
        product_uid: item.productUID,
        quantity: item.quantity,
        price: item.price,
        discount: item.discount || 0,
        total: item.quantity * item.price
      }))
    };

    const response = await fetch('/api/v1/order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`
      },
      body: JSON.stringify({ data: [order] })
    });

    if (!response.ok) {
      const error = await response.json();
      // Handle insufficient stock error
      throw new Error(error.message || 'Failed to create order');
    }

    return await response.json();
  } catch (err) {
    // Show user-friendly error
    if (err.message.includes('insufficient stock')) {
      alert('Some items are no longer available in the requested quantity');
    }
    throw err;
  }
}
```

**Option 2: Convert Existing Draft Order (If draft was saved previously)**
```javascript
// If user has a saved draft order, update it to "new" status
async function convertDraftToNew(draftOrder) {
  // Update the order with "new" status
  const newOrder = {
    ...draftOrder,
    status: "new"  // ✅ Change from "draft" to "new"
  };

  const response = await fetch('/api/v1/order', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({ data: [newOrder] })
  });

  if (!response.ok) {
    // Handle validation errors (stock check, product availability)
    const error = await response.json();
    throw new Error(error.message);
  }

  return await response.json();
}
```

**❌ INCORRECT - Do Not Use "confirmed" Status:**
```javascript
// ❌ WRONG: Frontend should NOT use "confirmed" status
const order = {
  status: "confirmed"  // This will return an error!
};

// ❌ WRONG: Only CRM should transition to "confirmed"
// Frontend has no access to processing → confirmed transition
```

#### D. Modifying Orders

Order modification rules depend on the order status:

- **Draft Orders (`"draft"`)**: Can be modified freely without stock validation or allocation management
- **New Orders (`"new"`)**: Can be modified with stock validation and allocation updates
- **Processing/Confirmed Orders (`"processing"`, `"confirmed"`)**: ❌ Cannot be modified (returns error)

**Modifying Draft Orders:**

```javascript
// Add items to draft order
async function addItemToDraft(orderUID, productUID, quantity, price) {
  const response = await fetch('/api/v1/order/item', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({
      data: [{
        order_uid: orderUID,
        product_uid: productUID,
        quantity: quantity,
        price: price,
        discount: 0,
        total: quantity * price
      }]
    })
  });

  return await response.json();
}

// Remove items from draft order
async function removeItemFromDraft(orderUID, productUID) {
  const response = await fetch('/api/v1/order/items', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({
      data: [{
        order_uid: orderUID,
        product_uid: productUID
      }]
    })
  });

  return await response.json();
}
```

### UI/UX Recommendations

#### A. Cart Page

```javascript
function CartPage() {
  const [cartItems, setCartItems] = useState([]);
  const [draftOrderUID, setDraftOrderUID] = useState(null);

  // Auto-save cart as draft
  useEffect(() => {
    const autoSave = async () => {
      if (cartItems.length > 0) {
        if (draftOrderUID) {
          // Update existing draft
          await updateDraftOrder(draftOrderUID, cartItems);
        } else {
          // Create new draft
          const uid = await saveCart(cartItems, currentUserUID);
          setDraftOrderUID(uid);
        }
      }
    };

    const timer = setTimeout(autoSave, 2000); // Auto-save after 2s of inactivity
    return () => clearTimeout(timer);
  }, [cartItems]);

  async function handleCheckout() {
    try {
      if (draftOrderUID) {
        // Convert draft to "new" order (validates stock and creates allocations)
        await convertDraftToNew(draftOrderUID);
        navigate('/order-confirmation');
      } else {
        // Create new order directly with "new" status
        const order = createOrderFromCart(cartItems, "new");  // ✅ Use "new", NOT "confirmed"
        await createOrder(order);
        navigate('/order-confirmation');
      }
    } catch (err) {
      if (err.message.includes('insufficient stock')) {
        // Show which items are unavailable
        showStockError(err);
      }
    }
  }

  return (
    <div>
      <h1>Shopping Cart</h1>
      {/* Cart items display */}
      {cartItems.map(item => <CartItem key={item.productUID} item={item} />)}

      <div className="cart-actions">
        {draftOrderUID && (
          <p className="auto-save-indicator">✓ Cart saved</p>
        )}
        <button onClick={handleCheckout}>Proceed to Checkout</button>
      </div>
    </div>
  );
}
```

#### B. Saved Carts Page

```javascript
function SavedCartsPage() {
  const [savedCarts, setSavedCarts] = useState([]);

  useEffect(() => {
    loadSavedCarts(currentUserUID).then(setSavedCarts);
  }, []);

  async function handleRestoreCart(orderUID) {
    const order = await getOrder(orderUID);
    // Load items into current cart
    setCurrentCart(order.items);
    navigate('/cart');
  }

  async function handleConfirmSavedCart(orderUID) {
    try {
      // Convert draft to "new" order (validates stock and creates allocations)
      await convertDraftToNew(orderUID);
      alert('Order placed successfully!');
      // Refresh list (draft will no longer appear)
      loadSavedCarts(currentUserUID).then(setSavedCarts);
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <h1>Saved Carts</h1>
      {savedCarts.map(cart => (
        <div key={cart.uid} className="saved-cart">
          <h3>Cart from {new Date(cart.last_update).toLocaleDateString()}</h3>
          <p>{cart.items.length} items | Total: ${cart.total}</p>
          <button onClick={() => handleRestoreCart(cart.uid)}>
            Restore to Cart
          </button>
          <button onClick={() => handleConfirmSavedCart(cart.uid)}>
            Place Order
          </button>
          <button onClick={() => deleteOrder(cart.uid)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
```

### Error Handling

```javascript
async function placeOrderWithErrorHandling(orderUID) {
  try {
    // Convert draft to "new" order (validates stock and creates allocations)
    await convertDraftToNew(orderUID);
    return { success: true };
  } catch (err) {
    const errorMessage = err.message.toLowerCase();

    if (errorMessage.includes('insufficient stock')) {
      // Parse product UID from error message if available
      return {
        success: false,
        error: 'INSUFFICIENT_STOCK',
        message: 'Some items in your cart are no longer available in the requested quantity.',
        action: 'Please review your cart and adjust quantities.'
      };
    }

    if (errorMessage.includes('not active')) {
      return {
        success: false,
        error: 'PRODUCT_INACTIVE',
        message: 'Some items in your cart are no longer available.',
        action: 'Please remove unavailable items from your cart.'
      };
    }

    if (errorMessage.includes('cannot modify') || errorMessage.includes('crm managed')) {
      return {
        success: false,
        error: 'ORDER_LOCKED',
        message: 'This order is being processed and cannot be modified.',
        action: 'Contact support if you need to make changes.'
      };
    }

    return {
      success: false,
      error: 'UNKNOWN',
      message: 'Failed to place order. Please try again.',
      action: null
    };
  }
}
```

### Migration Strategy

**Phase 1: Implement Draft Order Support**
1. Add "Save Cart" functionality
2. Auto-save carts as draft orders
3. Add "Saved Carts" page

**Phase 2: User Education**
1. Add tooltip explaining auto-save feature
2. Show notification when cart is saved
3. Highlight saved carts count in navigation

**Phase 3: Error Handling**
1. Implement proper error messages for confirmation failures
2. Show which items have stock issues
3. Allow users to adjust quantities or remove items

### Testing Checklist

**Draft Order Functionality:**
- [ ] Draft orders can be created without stock validation
- [ ] Draft orders don't create allocation records
- [ ] Draft orders can be modified freely (add/remove items)
- [ ] Auto-save works correctly
- [ ] Saved carts page displays all draft orders

**Order Placement (Draft → New):**
- [ ] Converting draft to "new" validates stock correctly
- [ ] Converting draft to "new" creates allocations
- [ ] Error messages are clear when placement fails due to stock
- [ ] Multiple users can't over-allocate the same product

**New Order Functionality:**
- [ ] Creating order with status "new" validates stock and creates allocations
- [ ] New orders can be modified (with stock validation and allocation updates)
- [ ] Removing items from "new" order removes corresponding allocations

**Status Restrictions:**
- [ ] Cannot create orders with status "processing" or "confirmed" (returns error)
- [ ] Cannot modify orders in "processing" status (returns error)
- [ ] Cannot modify orders in "confirmed" status (returns error)

**CRM Integration:**
- [ ] Orders in "processing" status display correctly but cannot be edited
- [ ] Orders in "confirmed" status show completion state
- [ ] Order history shows full status progression (draft → new → processing → confirmed)

---

## 4. Summary of Breaking Changes

### Critical Changes (Require Immediate Action)
1. **Product Availability Checks** - Must use available quantity, not product.quantity
2. **Cart Validation** - Must validate against available quantity

### Non-Breaking Changes (Recommended Updates)
1. **Category Display** - Names include parent prefix (usually improves UX)
2. **Product Display** - Consider showing both CRM and available quantities

### New Features (Optional)
1. **Draft Orders (`"draft"`)** - Save carts without reserving inventory or validation
2. **New Orders (`"new"`)** - User-confirmed orders with stock validation and allocation
3. **Status-Based Flow** - Frontend creates draft/new, CRM manages processing/confirmed
4. **Allocation Tracking** - You can now show which orders have allocated products
5. **Better Inventory Insights** - CRM quantity vs. available quantity provides better data
6. **Improved Categories** - Automatic breadcrumb support via parent prefixes
7. **Auto-Save Cart** - Implement automatic cart saving with draft orders

---

## 5. API Changes Summary

### New Behavior (Existing Endpoints)
- `POST /order` - Creates allocations for "new" orders, doesn't modify product.quantity
  - **Only accepts `status: "draft"` or `status: "new"`**
  - **Returns error for `status: "processing"` or `status: "confirmed"`**
- `PUT /order/status` - CRM endpoint to transition orders (new → processing → confirmed)
  - Deletes allocations when status changes to "confirmed"
- `DELETE /order/{uid}` - Removes allocations via CASCADE
- `POST /order/item` - Creates allocations for "new" orders, validates stock
  - **Returns error if order status is "processing" or "confirmed"**
- `DELETE /order/items` - Removes allocations
  - **Returns error if order status is "processing" or "confirmed"**
- `GET /category/description/{categoryUID}` - Returns names with parent prefix
- `POST /product/stock` - Now explicitly for CRM sync only

### Recommended New Endpoint (Backend Implementation Needed)
```
GET /api/v1/product/{uid}/available
Response: { "available_quantity": 25 }
```

Implementation:
```go
// Add to internal/http-server/api/api.go
r.Get("/{uid}/available", product.GetAvailableQuantity(log, handler))
```

---

## 6. Example Migration Code

### Complete Product Component Example

```javascript
import { useState, useEffect } from 'react';

function ProductDetails({ productUID }) {
  const [product, setProduct] = useState(null);
  const [available, setAvailable] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');

  useEffect(() => {
    // Fetch product data
    fetchProduct(productUID).then(setProduct);

    // Fetch available quantity
    fetchAvailableQuantity(productUID).then(setAvailable);
  }, [productUID]);

  async function handleAddToCart() {
    // ✅ CORRECT: Validate against available quantity
    if (quantity > available) {
      setError(`Only ${available} items available`);
      return;
    }

    try {
      await addToCart({
        product_uid: productUID,
        quantity: quantity
      });
      alert('Added to cart!');
    } catch (err) {
      setError(err.message);
    }
  }

  if (!product) return <div>Loading...</div>;

  return (
    <div className="product-details">
      <h1>{product.name}</h1>
      <p>Price: ${product.price / 100}</p>

      {/* Show both quantities for transparency */}
      <div className="inventory-info">
        <p>
          <strong>Available to Order:</strong> {available ?? 'Loading...'}
        </p>
        <details>
          <summary>Inventory Details</summary>
          <p>CRM Inventory: {product.quantity}</p>
          <p>Allocated: {product.quantity - (available ?? 0)}</p>
          <p>Available: {available ?? 'Loading...'}</p>
        </details>
      </div>

      {/* Quantity selector with validation */}
      <div className="quantity-selector">
        <label>Quantity:</label>
        <input
          type="number"
          min="1"
          max={available}  // ✅ Limit to available quantity
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
      </div>

      {error && <p className="error">{error}</p>}

      <button
        onClick={handleAddToCart}
        disabled={!available || quantity > available}
      >
        Add to Cart
      </button>
    </div>
  );
}

// API helper functions
async function fetchProduct(uid) {
  const response = await fetch(`/api/v1/product/${uid}`, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  return (await response.json()).data;
}

async function fetchAvailableQuantity(uid) {
  // Option 1: If backend endpoint exists
  const response = await fetch(`/api/v1/product/${uid}/available`, {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  return (await response.json()).data.available_quantity;

  // Option 2: Calculate client-side (less accurate)
  // const product = await fetchProduct(uid);
  // const allocations = await fetchAllocations(uid);
  // return product.quantity - allocations.reduce((sum, a) => sum + a.quantity, 0);
}

async function addToCart(item) {
  const response = await fetch('/api/v1/cart', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: JSON.stringify({ data: [item] })
  });

  if (!response.ok) throw new Error('Failed to add to cart');
  return response.json();
}
```

---

## 7. Rollback Plan

If issues arise during migration:

### Temporary Workaround
You can temporarily treat available quantity the same as product.quantity:
```javascript
// Emergency fallback
const available = product.quantity;  // Ignore allocations temporarily
```

**Warning:** This will allow over-allocation but keeps the frontend functional.

### Backend Rollback
The backend team can temporarily restore old behavior by:
1. Removing allocation checks in order creation
2. Re-enabling stock decrease/increase on order operations

**Note:** This is NOT recommended as it loses the allocation data.

---

## 8. Support and Questions

### Common Issues

**Q: Why am I getting "insufficient stock" errors when product.quantity shows available items?**
A: You're checking `product.quantity` instead of available quantity. Other orders have allocated some of that inventory.

**Q: How do I show how many items are allocated?**
A: Calculate: `allocated = product.quantity - available_quantity`

**Q: Can I still use product.quantity for anything?**
A: Yes! Use it to show total CRM inventory, but not for availability checks.

**Q: Why do category names have parent prefixes now?**
A: This provides better context and automatic breadcrumbs. You can split the name if needed for specific UI components.

### Getting Help

- Review updated API documentation: `/docs/api_documentation.md`
- Check backend logs for allocation-related errors
- Contact backend team for API endpoint additions

---

## Document Version
- **Version:** 1.0
- **Last Updated:** 2025-11-18
- **Backend Version:** Post product allocation refactor
