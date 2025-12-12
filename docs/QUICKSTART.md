# Quick Start Guide

## Running the Application

### 1. Configure Local Development (Optional)

If you want to connect to a custom dev backend URL without committing it to git:

```bash
cd frontend
cp src/environments/environment.local.example.ts src/environments/environment.local.ts
# Edit environment.local.ts and set your backend URL
```

See [LOCAL_DEVELOPMENT.md](./LOCAL_DEVELOPMENT.md) for detailed instructions.

### 2. Start the Development Server

**Default development** (uses `environment.ts`):
```bash
cd frontend
ng serve
```

Or with npm:
```bash
npm start
```

**Local development** (uses `environment.local.ts` - your custom config):
```bash
ng serve --configuration=local
```

The application will be available at: **http://localhost:4200/**

### 2. Login

When you first access the application, you'll be redirected to the login page.

**Login Credentials:**
- **User Login**: Username + password (for staff users)
- **Client Login**: Phone + PIN code (for client users)

The application uses real backend authentication. Use valid credentials from your backend system.

### 3. Explore the Features

After logging in, you'll be redirected to the Product Catalog.

#### Product Catalog
- Browse available products
- Search products by name, description, or category
- Click "Add to Cart" to add products to your shopping cart
- Click the cart icon in the header to view your cart

#### Shopping Cart (Side Panel)
- Adjust quantities using +/- buttons
- Remove items from cart
- View total price
- Click "Proceed to Checkout" to create an order

#### Order Confirmation
- Review your cart items
- Fill in shipping address
- Click "Place Order" to submit
- You'll be redirected to Order History after successful submission

#### Order History
- View all your past orders
- See order status, items, and totals
- Click "Browse Products" to return to catalog

#### Navigation
- Use the navigation menu in the header:
  - **Products** - Product catalog
  - **Orders** - Order history
- Click the logo to return to the product catalog
- **Logout** - Sign out and return to login

## Project Structure

```
src/app/
 auth/
    login/                    # Login page
 orders/
    order-history/           # Order history page
 products/
    product-catalog/         # Product catalog with cart
    order-confirmation/      # Order confirmation page
 core/
     services/                # Auth, Product, Order services
     models/                  # TypeScript interfaces
     guards/                  # Route protection
```

## Key Pages

1. **Login** (`/auth/login`)
   - Authentication page
   - Validates email format and password length

2. **Product Catalog** (`/products/catalog`)
   - Main landing page after login
   - Browse and search products
   - Add to cart functionality

3. **Order Confirmation** (`/products/confirm-order`)
   - Review cart and enter shipping details
   - Submit order

4. **Order History** (`/orders/history`)
   - View past orders
   - Check order status

## API Integration

The application uses real API integration with the backend:

- **Products**: Fetched from `/api/v1/product`
- **Orders**: Fetched from `/api/v1/order`
- **Authentication**: JWT-based via `/api/v1/auth/login`

See [API Documentation](./api_documentation.md) for details.

## Development

### Add New Components

```bash
ng generate component module-name/component-name
```

### Add New Services

```bash
ng generate service core/services/service-name
```

### Build for Production

```bash
ng build --configuration production
```

Build artifacts will be in `dist/` directory.

## Next Steps

1. **Backend Setup**
   - Ensure backend API is running
   - Configure API URL in `environment.ts` if needed
   - Test authentication flow

2. **Testing**
   - Write unit tests for components and services
   - Add E2E tests for critical user flows

3. **Features**
   - Add user profile page
   - Implement product filtering by category
   - Add order details page
   - Implement order status updates
   - Add payment integration

4. **Optimization**
   - Implement OnPush change detection
   - Add service workers for PWA
   - Optimize bundle size

## Troubleshooting

### Port Already in Use

If port 4200 is already in use:

```bash
ng serve --port 4201
```

### NPM Cache Issues

If you encounter npm cache permission errors:

```bash
npm install --cache=/tmp/npm-cache
```

### Module Not Found

Make sure all dependencies are installed:

```bash
npm install
```

## Support

For detailed coding guidelines, see [CODING_POLICY.md](./CODING_POLICY.md)

For project overview, see [README.md](./README.md)

