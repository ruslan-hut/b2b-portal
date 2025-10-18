# Mock Data Documentation

This document describes the mock data available for testing the B2B Portal before API integration.

## Overview

All services (`AuthService`, `ProductService`, `OrderService`) are currently using mock data to simulate API responses. This allows for complete testing of the application without requiring a backend server.

## Test Users

The following test users are available for login testing. **Note:** In mock mode, any password will work - only the email matters.

### Available Test Accounts

| Email | Name | Company | Role | Description |
|-------|------|---------|------|-------------|
| `admin@example.com` | John Admin | TechCorp Solutions | admin | Administrator with full access |
| `client@example.com` | Jane Smith | ABC Retail Inc | client | Regular client user |
| `demo@example.com` | Demo User | Demo Company | client | Demo user for testing |

### Login Instructions

1. Navigate to the login page
2. Enter any of the emails listed above
3. Enter any password (e.g., "password", "123456", etc.)
4. Click "Login"

The user profile will be populated based on the email used.

## Mock Products

The system includes **15 sample products** across 3 categories:

### Electronics (5 products)
- **Wireless Mouse Pro** - $49.99 (SKU: ELEC-MOUSE-001) ✅ In Stock
- **Mechanical Keyboard** - $129.99 (SKU: ELEC-KEY-002) ✅ In Stock
- **USB-C Hub** - $79.99 (SKU: ELEC-HUB-003) ✅ In Stock
- **Webcam 4K** - $159.99 (SKU: ELEC-CAM-004) ❌ Out of Stock
- **Wireless Headset** - $199.99 (SKU: ELEC-HEAD-005) ✅ In Stock

### Office Supplies (5 products)
- **Premium Notebook Set** - $24.99 (SKU: OFF-NOTE-006) ✅ In Stock
- **Executive Pen Set** - $89.99 (SKU: OFF-PEN-007) ✅ In Stock
- **Desk Organizer** - $34.99 (SKU: OFF-ORG-008) ✅ In Stock
- **Paper Shredder** - $149.99 (SKU: OFF-SHRED-009) ❌ Out of Stock
- **Whiteboard Set** - $119.99 (SKU: OFF-BOARD-010) ✅ In Stock

### Furniture (5 products)
- **Ergonomic Office Chair** - $399.99 (SKU: FURN-CHAIR-011) ✅ In Stock
- **Standing Desk** - $599.99 (SKU: FURN-DESK-012) ✅ In Stock
- **Filing Cabinet** - $249.99 (SKU: FURN-CAB-013) ✅ In Stock
- **Bookshelf Unit** - $179.99 (SKU: FURN-SHELF-014) ✅ In Stock
- **Conference Table** - $899.99 (SKU: FURN-TABLE-015) ❌ Out of Stock

### Features You Can Test
- Browse all products in the catalog
- Filter products by category
- Search products by name or description
- View product details
- Check stock availability
- Add products to cart

## Mock Orders

The system includes **6 sample orders** with various statuses. Orders are assigned to different users:

### Order Statuses
- **PENDING** - Order placed, awaiting confirmation
- **CONFIRMED** - Order confirmed by system
- **PROCESSING** - Order being prepared
- **SHIPPED** - Order shipped to customer
- **DELIVERED** - Order delivered successfully
- **CANCELLED** - Order cancelled

### Sample Orders for `client@example.com` (Jane Smith)

| Order Number | Total | Status | Date | Items |
|--------------|-------|--------|------|-------|
| ORD-2024-001 | $1,149.85 | DELIVERED | Sep 15, 2024 | Mouse (10), Keyboard (5) |
| ORD-2024-002 | $11,999.75 | SHIPPED | Oct 1, 2024 | Office Chair (15), Standing Desk (10) |
| ORD-2024-003 | $3,499.25 | PROCESSING | Oct 10, 2024 | Notebook Set (50), Pen Set (25) |
| ORD-2024-004 | $3,999.68 | CONFIRMED | Oct 14, 2024 | USB-C Hub (20), Headset (12) |
| ORD-2024-005 | $1,999.92 | PENDING | Oct 16, 2024 | Filing Cabinet (8) |

### Sample Orders for `demo@example.com` (Demo User)

| Order Number | Total | Status | Date | Items |
|--------------|-------|--------|------|-------|
| ORD-2024-006 | $1,649.65 | DELIVERED | Sep 20, 2024 | Desk Organizer (30), Whiteboard Set (5) |

### Features You Can Test
- View order history
- Check order status
- View order details (items, shipping address, totals)
- Track orders by status
- Create new orders

## Cart/Ordering Functionality

The shopping cart functionality is fully operational with mock data:

### Features Available
- Add products to cart
- Update quantities
- Remove items from cart
- Calculate totals automatically
- Create new orders with shipping information
- Clear cart after order placement

### Creating a Test Order
1. Log in with any test account
2. Browse products in the catalog
3. Add items to your cart
4. Navigate to order confirmation
5. Enter shipping address:
   ```
   Street: 123 Test Street
   City: Test City
   State: TS
   Zip Code: 12345
   Country: USA
   ```
6. Submit the order

The system will create a new order with a unique order number and PENDING status.

## API Simulation

All services simulate realistic API behavior:

### Network Delays
- Login: 500ms delay
- Product listing: 500ms delay
- Category listing: 300ms delay
- Order history: 500ms delay
- Order creation: 500ms delay

### Authentication
- Successful login stores JWT token in localStorage
- Token format: `mock-jwt-token-{timestamp}`
- Auth guard protects routes requiring authentication
- Logout clears stored credentials

### Error Handling
- Invalid email on login returns error (in mock mode)
- All other operations succeed with valid data
- Network delays simulate real-world conditions

## Mock Data Location

Mock data files are located in: `src/app/core/mock-data/`

- **users.mock.ts** - User accounts and credentials
- **products.mock.ts** - Product catalog and categories  
- **orders.mock.ts** - Order history

## Future API Integration

When integrating real APIs:

1. Update the TODO comments in each service file
2. Replace `of()` observables with `HttpClient` calls
3. Update endpoint URLs in environment files
4. Remove or comment out mock data imports
5. Update error handling for real API responses

The current implementation structure makes this transition straightforward - just replace the mock observables with HTTP calls while maintaining the same return types.

## Testing Tips

### Recommended Test Scenarios

1. **Authentication Flow**
   - Login with different user accounts
   - Test logout functionality
   - Verify protected routes work correctly

2. **Product Catalog**
   - Browse all products
   - Filter by each category
   - Search for specific items
   - Check in-stock vs out-of-stock behavior

3. **Shopping Cart**
   - Add multiple products
   - Update quantities
   - Remove items
   - Verify total calculations

4. **Order Management**
   - View order history for different users
   - Check various order statuses
   - Create new orders
   - View order details

5. **User Experience**
   - Navigate between different sections
   - Test responsive design
   - Verify loading states (notice the simulated delays)
   - Check form validations

## Notes

- All mock data uses consistent IDs for cross-referencing
- Dates in orders use realistic past dates
- Product prices and quantities are B2B-appropriate (bulk quantities)
- Shipping addresses cover different US states for variety
- Order numbers follow a consistent format: `ORD-YYYY-NNN`

---

**Last Updated:** October 17, 2024

