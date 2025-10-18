# B2B Portal

A modern B2B portal application built with Angular 18, designed for clients to browse products and create orders.

## Features

- 🔐 **User Authentication** - Secure login system with JWT token support
- 🛍️ **Product Catalog** - Browse and search through product inventory
- 🛒 **Shopping Cart** - Add products to cart with quantity management
- 📦 **Order Management** - Create orders and view order history
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile devices
- 🎨 **Modern UI** - Beautiful gradient-based design with smooth animations

## Project Structure

```
src/app/
├── core/                    # Core module (singleton services, guards, models)
│   ├── guards/             # Route guards (auth protection)
│   ├── models/             # Data models and interfaces
│   └── services/           # Application-wide services
├── auth/                   # Authentication module
│   └── login/             # Login component
├── orders/                 # Orders module
│   └── order-history/     # Order history component
├── products/               # Products module
│   ├── product-catalog/   # Product catalog component
│   └── order-confirmation/ # Order confirmation component
└── shared/                 # Shared components (future)
```

## Technology Stack

- **Framework**: Angular 18.x
- **Language**: TypeScript 5.x (strict mode)
- **Styling**: SCSS
- **Forms**: Reactive Forms
- **State Management**: RxJS BehaviorSubjects
- **Routing**: Angular Router with lazy loading

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd b2b-portal/b2b-portal
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
ng serve
```

4. Navigate to `http://localhost:4200/` in your browser

## Development

### Development Server

Run `ng serve` for a dev server. The application will automatically reload if you change any of the source files.

### Code Scaffolding

Generate new components:
```bash
ng generate component component-name
ng generate service service-name
ng generate module module-name
```

### Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

### Running Tests

```bash
ng test              # Unit tests
ng e2e               # End-to-end tests (when configured)
```

## Usage

### Testing with Mock Data

The application includes comprehensive mock data for testing all features before API integration.

**📖 See [MOCK_DATA.md](./MOCK_DATA.md) for detailed information about:**
- Available test users and login credentials
- Complete product catalog (15 products across 3 categories)
- Sample orders with various statuses
- Testing scenarios and tips

### Quick Start - Demo Credentials

Login with any of these test accounts:
- **Admin**: `admin@example.com` (any password)
- **Client**: `client@example.com` (any password)
- **Demo**: `demo@example.com` (any password)

### Key Features

1. **Product Browsing**
   - Search products by name, description, or category
   - View product details including price, SKU, and availability
   - Add products to cart directly from catalog

2. **Shopping Cart**
   - Side panel with cart items
   - Adjust quantities or remove items
   - See real-time total calculation
   - Proceed to checkout

3. **Order Confirmation**
   - Review cart items
   - Enter shipping address
   - Submit order
   - Receive order confirmation

4. **Order History**
   - View all past orders
   - See order status and details
   - Track order timeline

## API Integration

Currently, the application uses mock data located in `src/app/core/mock-data/`. To integrate with a real API:

1. Update the service files in `src/app/core/services/`
2. Replace mock implementations with HTTP calls
3. Configure API base URL in environment files
4. Add proper error handling and retry logic

Example:
```typescript
// Before (mock)
return of(MOCK_PRODUCTS).pipe(delay(500));

// After (real API)
return this.http.get<Product[]>(`${this.apiUrl}/products`).pipe(
  retry(1),
  catchError(this.handleError)
);
```

See [MOCK_DATA.md](./MOCK_DATA.md) for complete details on the mock data structure.

## Configuration

### Environment Files

- `environment.ts` - Development environment
- `environment.prod.ts` - Production environment

Configure API endpoints and other settings in these files.

## Coding Standards

Please refer to [CODING_POLICY.md](./CODING_POLICY.md) for detailed coding guidelines including:
- TypeScript standards
- Naming conventions
- Component structure
- Service patterns
- Styling guidelines
- Git workflow

## Project Status

### Completed ✅
- Angular project setup
- Authentication module with login page
- Product catalog with search and cart functionality
- Order confirmation page with shipping form
- Order history page
- Routing and navigation
- Service layer with mock data
- Responsive UI design

### Pending 🚧
- Real API integration
- Unit tests
- E2E tests
- State management (if needed for complexity)
- Error logging and monitoring
- Performance optimization
- PWA features
- Internationalization

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Submit a pull request

Please follow the coding standards outlined in CODING_POLICY.md.

## License

This project is licensed under the MIT License.

## Support

For questions or issues, please create an issue in the repository.

---

**Built with ❤️ using Angular**
