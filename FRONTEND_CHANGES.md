# Frontend Changes Required - Multi-Store Inventory & Flexible Pricing System

This document outlines the changes required in your frontend application to work with the new **multi-store inventory system**, **flexible pricing system**, and **batch-first API design**. The backend has been fundamentally reworked from a single global inventory to a per-store model, from single-price products to multi-tier pricing, and all major entity operations now prioritize batch processing.

---

## 1. The Multi-Store Inventory System, Flexible Pricing & Batch API Design

### Overview
The backend has undergone two major architectural changes:
1. **Multi-Store Inventory**: No longer tracks a single, global quantity for each product. Instead, inventory is managed on a per-store basis.
2. **Flexible Pricing System**: Products no longer have a single price. Instead, prices are defined per price type (e.g., Retail, Wholesale, VIP), allowing different users to see different prices for the same product.
3. **Batch-First API**: All major entity operations (create, retrieve, update, delete) now primarily use batch endpoints.

### Key Concepts

#### Inventory Management
1.  **Stores are the source of truth for inventory.** Each product can have different stock levels in different stores.
2.  **Users can be associated with a single store.** A user's `store_uid` determines which store's inventory they see and order from.
3.  **Product availability is store-specific.** When a user browses products, they will only see the stock available in their assigned store.
4.  **Orders are fulfilled from the user's store.** When an order is placed, inventory is allocated from the user's assigned store.

#### Pricing System
1.  **Price Types define pricing schemes.** Each price type (e.g., "Retail USD", "Wholesale USD", "VIP EUR") is associated with a currency.
2.  **Products have multiple prices.** The same product can have different prices under different price types (Retail: $19.99, Wholesale: $14.99).
3.  **Users/Clients are assigned a price type.** A user's `price_type_uid` determines which prices they see throughout the application.
4.  **Currency is determined by price type.** Each price type is linked to a specific currency, enabling multi-currency support.
5.  **Batch price retrieval is optimized.** The most common operation is fetching prices for multiple products under one specific price type.

#### API Design
1.  **Batch-first API design:** All CRUD operations for main entities now support array inputs/outputs to minimize HTTP requests and improve performance.

### What Changed

#### Inventory Changes
- **Before:** Products had a single `quantity` field. Availability was global. Single-entity GET/DELETE endpoints were common.
- **After:** The `product.quantity` field has been **removed**. Inventory is now in a new `store_inventory` table. Users can be linked to a `store_uid`.

#### Pricing Changes
- **Before:** Products had a single `price` field. All users saw the same price.
- **After:** The `product.price` field is **deprecated**. Prices are now in a separate `prices` table with a composite key (price_type_uid + product_uid). Users/clients have a `price_type_uid` field that determines which prices they see.

#### API Changes
- **Before:** Single-entity GET/DELETE endpoints (e.g., `GET /product/{uid}`) were common.
- **After:** All major entity operations now use `POST` endpoints with `{"data": [...]}` for batch processing. Old URL-parameter based GET/DELETE endpoints have been removed or replaced.

---

## 2. Required Frontend Changes

This is a **breaking change**. Your frontend will require significant updates to function correctly.

### A. Fetching the User's Store and Price Type (Critical)

The first step after a user logs in is to identify their assigned store and price type. Both `store_uid` and `price_type_uid` are now part of the `User` entity returned from the authentication endpoint.

```javascript
// When fetching user data after login
async function getUserData() {
  const response = await fetch(`/api/v1/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const user = (await response.json()).data;

  // ⚠️ CRITICAL: Store BOTH the user's store_uid AND price_type_uid globally
  // You will need store_uid for inventory checks and price_type_uid for pricing
  const userStoreUID = user.store_uid;
  const userPriceTypeUID = user.price_type_uid;

  // Example: save to context, Redux, etc.
  setAppStore({
    ...appStore,
    currentUserStore: userStoreUID,
    currentPriceType: userPriceTypeUID
  });

  return user;
}
```

**Important Notes:**
- **If `user.store_uid` is empty**, the user may not be able to order products. Show a message asking them to contact support or handle this case gracefully.
- **If `user.price_type_uid` is empty**, the user won't see any prices. Either assign a default price type or show an error message.
- **For Client authentication**: Clients also have both `store_uid` and `price_type_uid` fields. The same logic applies.

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

### C. Product Pricing (New Critical Feature)

The old `product.price` field is **deprecated**. You must now fetch prices based on the user's assigned price type.

**OLD APPROACH (No longer works):**
```javascript
// ❌ INCORRECT - product.price is deprecated
const price = product.price;
```

**NEW APPROACH (Required):**
Fetch prices for products under the user's specific price type using batch API.

**API Endpoint:** `POST /api/v1/price/batch/price_type_products`

```javascript
// ✅ CORRECT - Fetch prices for multiple products under user's price type
async function getProductPrices(priceTypeUID, productUIDs) {
  if (!priceTypeUID || productUIDs.length === 0) {
    return {}; // Return empty object if no price type or products
  }

  const response = await fetch(`/api/v1/price/batch/price_type_products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      data: {
        price_type_uid: priceTypeUID,
        product_uids: productUIDs
      }
    })
  });

  if (!response.ok) {
    console.error('Failed to fetch product prices');
    return {};
  }

  const result = await response.json();
  // Convert array of prices to map: product_uid -> price
  const priceMap = {};
  for (const priceObj of result.data) {
    priceMap[priceObj.product_uid] = priceObj.price;
  }
  return priceMap;
}

// --- Usage Example ---
const userPriceTypeUID = useUserPriceType(); // Get from app state/context
const productUIDsOnPage = products.map(p => p.uid);

const prices = await getProductPrices(userPriceTypeUID, productUIDsOnPage);

products.forEach(product => {
  const price = prices[product.uid];
  if (price !== undefined) {
    console.log(`${product.name}: $${price / 100}`);
  } else {
    console.log(`${product.name}: Price not available`);
  }
});
```

**Key Points:**
- **Always use the user's `price_type_uid`** when fetching prices
- **Batch all price requests** for products on the same page into a single API call
- **Handle missing prices gracefully** - some products may not have prices defined for all price types
- **Price values are in cents** - divide by 100 to display in dollars (or your currency's smallest unit)

### D. Product List & Detail Display

Your product pages must be updated to show both inventory from the user's store AND prices from the user's price type. This will likely involve fetching all product UIDs on a page and then making two batch requests: one for available quantities and one for prices.

```javascript
// Example: Product Card Component (UPDATED for pricing + inventory)
function ProductCard({ product }) {
  const userStoreUID = useUserStore(); // Get from context/state
  const userPriceTypeUID = useUserPriceType(); // Get from context/state
  const [available, setAvailable] = useState(null);
  const [price, setPrice] = useState(null);

  useEffect(() => {
    if (userStoreUID && product?.uid) {
      // Fetch available quantity for this single product in the user's store
      // For a list of products, you would batch this.
      getAvailableQuantities(userStoreUID, [product.uid]).then(res => {
        setAvailable(res[product.uid]);
      });
    }
  }, [product?.uid, userStoreUID]);

  useEffect(() => {
    if (userPriceTypeUID && product?.uid) {
      // Fetch price for this product under the user's price type
      // For a list of products, you would batch this.
      getProductPrices(userPriceTypeUID, [product.uid]).then(res => {
        setPrice(res[product.uid]);
      });
    }
  }, [product?.uid, userPriceTypeUID]);

  return (
    <div className="product-card">
      <h3>{product.name}</h3>

      {/* OLD: product.price is deprecated! */}
      {/* <p>Price: ${product.price / 100}</p> ❌ */}

      {/* NEW: Show price from user's price type */}
      <p className="price-new">
        Price: {price !== null ? `$${price / 100}` : 'Loading...'} ✅
      </p>

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

**Better Approach: Batch Fetch for Product Lists**

For better performance, fetch prices and availability for all products on the page at once:

```javascript
// Example: Product List Component with Batch Fetching
function ProductList({ products }) {
  const userStoreUID = useUserStore();
  const userPriceTypeUID = useUserPriceType();
  const [availabilities, setAvailabilities] = useState({});
  const [prices, setPrices] = useState({});

  useEffect(() => {
    if (userStoreUID && userPriceTypeUID && products.length > 0) {
      const productUIDs = products.map(p => p.uid);

      // Batch fetch both availability and prices
      Promise.all([
        getAvailableQuantities(userStoreUID, productUIDs),
        getProductPrices(userPriceTypeUID, productUIDs)
      ]).then(([availData, priceData]) => {
        setAvailabilities(availData);
        setPrices(priceData);
      });
    }
  }, [products, userStoreUID, userPriceTypeUID]);

  return (
    <div className="product-list">
      {products.map(product => (
        <div key={product.uid} className="product-card">
          <h3>{product.name}</h3>
          <p>Price: ${(prices[product.uid] || 0) / 100}</p>
          <p>Available: {availabilities[product.uid] ?? 'N/A'}</p>
        </div>
      ))}
    </div>
  );
}
```

### E. Cart Validation and Pricing

Cart validation must now check both availability in the user's store AND use the correct prices from the user's price type. The backend will validate this when creating an order with status `"new"`, but you should validate it on the frontend first for better UX.

```javascript
// NEW: Validate cart with both availability and pricing
async function validateAndPriceCart(cartItems, storeUID, priceTypeUID) {
  const productUIDs = cartItems.map(item => item.productUID);

  // Batch fetch both availability and prices
  const [availableQuantities, prices] = await Promise.all([
    getAvailableQuantities(storeUID, productUIDs),
    getProductPrices(priceTypeUID, productUIDs)
  ]);

  let totalPrice = 0;
  const validatedItems = [];

  for (const item of cartItems) {
    const available = availableQuantities[item.productUID] || 0;
    const price = prices[item.productUID];

    // Check availability
    if (available < item.quantity) {
      return {
        valid: false,
        message: `Only ${available} items available for ${item.name} in your store.`
      };
    }

    // Check if price exists
    if (price === undefined) {
      return {
        valid: false,
        message: `Price not available for ${item.name} under your pricing plan.`
      };
    }

    // Calculate item total using fetched price
    const itemTotal = price * item.quantity;
    totalPrice += itemTotal;

    validatedItems.push({
      ...item,
      unitPrice: price,
      totalPrice: itemTotal
    });
  }

  return {
    valid: true,
    items: validatedItems,
    totalPrice: totalPrice
  };
}

// --- Usage Example ---
const cartValidation = await validateAndPriceCart(
  cartItems,
  userStoreUID,
  userPriceTypeUID
);

if (!cartValidation.valid) {
  showError(cartValidation.message);
} else {
  // Proceed to checkout with validated items and calculated total
  console.log('Cart Total:', `$${cartValidation.totalPrice / 100}`);
  proceedToCheckout(cartValidation.items, cartValidation.totalPrice);
}
```

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

#### Price Type Endpoints (NEW)
-   `POST /api/v1/price_type` - Upsert Price Types (NEW - batch)
-   `GET /api/v1/price_type` - List Price Types (NEW)
-   `POST /api/v1/price_type/batch` - Get Price Types by UIDs (NEW)
-   `POST /api/v1/price_type/delete` - Delete Price Types by UIDs (NEW)
-   `POST /api/v1/price_type/find/currency` - Find Price Types by Currency Codes (NEW)

#### Price Endpoints (NEW - Composite Key)
-   `POST /api/v1/price` - Upsert Prices (NEW - batch, composite key: price_type_uid + product_uid)
-   `POST /api/v1/price/find/product` - Get all prices for a product (NEW)
-   `POST /api/v1/price/batch/products` - Get prices for multiple products (NEW - returns map[productUID][]Price)
-   `POST /api/v1/price/batch/price_types` - Get prices for multiple price types (NEW - returns map[priceTypeUID][]Price)
-   `POST /api/v1/price/batch/price_type_products` - **Get prices for products under specific price type (NEW - MOST COMMONLY USED)**
-   `POST /api/v1/price/delete` - Delete specific prices (NEW)
-   `POST /api/v1/price/delete/products` - Delete all prices for products (NEW)
-   `POST /api/v1/price/delete/price_types` - Delete all prices for price types (NEW)

### Removed / Deprecated Fields & Endpoints

-   **`product.quantity`**: This field has been **removed** from the `Product` entity. Use the store inventory endpoints instead.
-   **`product.price`**: This field is **deprecated** from the `Product` entity. Use the new Price endpoints with the user's `price_type_uid` instead.
-   **All single-entity GET/DELETE endpoints** (e.g., `GET /user/{uid}`, `DELETE /product/{uid}`) have been replaced by batch `POST` endpoints.
-   **User/Client entities now require `price_type_uid`**: Users and clients must be assigned to a price type to see prices.

---

## 4. Migration Strategy

Follow these steps to adapt your frontend application. This is a **breaking change** requiring significant updates.

**Phase 1: User Store and Price Type Identification (Critical)**
1.  On user login, fetch the user data from `/api/v1/auth/me` and extract **both** `store_uid` and `price_type_uid`.
2.  Store both values in a global state (Context, Redux, Zustand, etc.).
3.  Handle missing values:
    - If `store_uid` is missing: Show "Contact Support" or default to a main store
    - If `price_type_uid` is missing: Show error or assign default price type
4.  For client authentication, extract the same fields from the client entity.

**Phase 2: Update Pricing Display (Critical - Breaking Change)**
1.  Create a new `getProductPrices(priceTypeUID, productUIDs)` helper function as shown above.
2.  Search your codebase for **all references to `product.price`** and remove them.
3.  Replace with calls to `getProductPrices()` using the user's `price_type_uid`.
4.  Update all product displays:
    - Product cards/lists
    - Product detail pages
    - Shopping cart items
    - Checkout pages
    - Order summaries
5.  Always batch price requests for products on the same page.

**Phase 3: Update Availability Checks (Critical - Breaking Change)**
1.  Create a new `getAvailableQuantities(storeUID, productUIDs)` helper function as shown above.
2.  Search your codebase for **all references to `product.quantity`** and remove them.
3.  Replace with calls to `getAvailableQuantities()` using the user's `store_uid`.
4.  Update availability displays:
    - Product cards/lists
    - Product detail pages
    - "Add to Cart" validation
    - Shopping cart validation
    - Checkout validation

**Phase 4: Update Cart Logic (Critical)**
1.  Rewrite cart validation to use both availability AND pricing from user's context.
2.  Use `validateAndPriceCart()` helper shown above.
3.  Calculate totals using fetched prices, not stored prices.
4.  Re-validate cart on every page load and before checkout.
5.  Handle cases where:
    - Product is out of stock in user's store
    - Product has no price under user's price type
    - User's store or price type changes mid-session

**Phase 5: Update UI Components**
1.  Remove all references to `product.quantity` and `product.price`.
2.  Update all product displays to show:
    - Price from user's price type
    - Availability from user's store
3.  Add loading states for price and availability fetching.
4.  Handle missing prices/availability gracefully (show "N/A" or disable purchase).

**Phase 6: Adapt to Batch Endpoints**
1.  Identify all places where you perform single-entity GET, DELETE, or "find by field" operations.
2.  Replace these with calls to the new batch `POST` endpoints.
    -   For single operations, simply pass a single UID/object in the `data` array.
    -   For multiple operations, consolidate into a single batch request.
3.  Ensure your request bodies are always `{"data": [...]}` and responses are handled as arrays.

**Phase 7: Admin Panel Updates (If applicable)**
1.  **Store Management:**
    - Add UI for listing, creating, and editing stores
    - Add UI for managing inventory on a per-store basis
2.  **Price Type Management:**
    - Add UI for listing, creating, and editing price types
    - Link each price type to a currency
3.  **Price Management:**
    - Add UI for setting prices for products under different price types
    - Consider bulk import/export for managing large price lists
4.  **User/Client Management:**
    - When creating or editing a user/client, add dropdowns to assign:
      - A store (determines inventory they see)
      - A price type (determines prices they see)
    - Mark both fields as required or provide sensible defaults

---

## 5. FAQ & Common Issues

### Inventory Issues

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

### Pricing Issues

**Q: Why are all product prices showing as "N/A" or undefined?**
A: This can have several causes:
1.  You are not passing the `price_type_uid` when fetching prices.
2.  The user's assigned `price_type_uid` is incorrect or empty.
3.  The products genuinely don't have prices defined for that price type.
4.  You're still trying to use the deprecated `product.price` field.

**Q: Different users are seeing different prices for the same product. Is this a bug?**
A: No! This is by design. Users are assigned different price types (Retail, Wholesale, VIP, etc.), and each price type can have different prices for the same product. This enables customer tier pricing, multi-currency support, and regional pricing.

**Q: How can an admin set prices for products?**
A: Use the new `/api/v1/price` endpoints. The admin UI should:
1.  Select a price type (e.g., "Retail USD")
2.  Select one or more products
3.  Set the price for each product under that price type
4.  For efficiency, use bulk import/export for managing large price lists

**Q: Can a product have different prices in different currencies?**
A: Yes! Create multiple price types, each linked to a different currency (e.g., "Retail USD", "Retail EUR", "Retail GBP"). Set prices for the same product under each price type. Assign users to the price type matching their preferred currency.

**Q: What happens if a user's price type changes mid-session?**
A: The frontend should re-fetch prices when detecting a price type change. Consider subscribing to user profile updates or re-fetching on critical pages (cart, checkout).

### Migration Issues

**Q: Do I need to migrate existing product prices?**
A: Yes! If you have existing `product.price` data, you should:
1.  Create a "Default" price type
2.  Migrate all existing prices to the `prices` table under the default price type
3.  Assign all existing users/clients to the default price type
4.  See the migration script in `docs/refactor_plan_pricing.md`

**Q: What happens to old orders?**
A: The backend migration assigns them to a default store and default price type, so they should remain consistent.

**Q: Can I keep using `product.price` for now?**
A: The field is deprecated but may still exist for backward compatibility. However, it will not be updated and should not be relied upon. You should migrate to the new pricing system as soon as possible.

---
*This document describes the required changes for the multi-store inventory system and flexible pricing system. The allocation system still exists but is now scoped to stores, and all major API interactions are now batch-first.*
