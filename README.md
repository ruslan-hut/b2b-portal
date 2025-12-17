# B2B Portal

[![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)](https://angular.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![SCSS](https://img.shields.io/badge/SCSS-CC6699?logo=sass&logoColor=white)](https://sass-lang.com/)
[![RxJS](https://img.shields.io/badge/RxJS-B7178C?logo=reactivex&logoColor=white)](https://rxjs.dev/)
![i18n](https://img.shields.io/badge/i18n-EN%20%7C%20UK-green)
![Responsive](https://img.shields.io/badge/Responsive-Design-blue)
[![License](https://img.shields.io/badge/License-BSD_3--Clause-blue.svg)](LICENSE)

A modern B2B portal application built with Angular 21, designed for clients to browse products and create orders.

## Technology Stack

- **Framework**: Angular 21.x with Module-based architecture
- **Language**: TypeScript 5.9 (strict mode)
- **Styling**: SCSS with responsive design and gradient themes
- **Forms**: Reactive Forms with custom validation
- **State Management**: RxJS BehaviorSubjects
- **HTTP Client**: Angular HttpClient
- **Routing**: Angular Router with lazy loading and route guards
- **Internationalization**: Custom translation system (English, Ukrainian)
- **Build Tool**: Angular CLI with Webpack

## Features

-  **User Authentication** - JWT-based authentication with support for Users and Clients
   - Auto-detection of login type (username+password or phone+PIN)
   - Automatic token refresh
   - Multi-device session management
-  **Product Catalog** - Browse and search through product inventory
-  **Shopping Cart** - Add products to cart with quantity management
-  **Order Management** - Create orders and view order history
-  **Responsive Design** - Works seamlessly on desktop and mobile devices
-  **Modern UI** - Beautiful gradient-based design with smooth animations
-  **Internationalization** - English and Ukrainian language support

## Project Structure

```
src/app/
 core/                    # Core module (singleton services, guards, models)
    guards/             # Route guards (auth protection)
    models/             # Data models and interfaces
    services/           # Application-wide services
 auth/                   # Authentication module
    login/             # Login component
 orders/                 # Orders module
    order-history/     # Order history component
 products/               # Products module
    product-catalog/   # Product catalog component
    order-confirmation/ # Order confirmation component
 shared/                 # Shared components (future)
```

## Technology Stack

- **Framework**: Angular 21.x
- **Language**: TypeScript 5.9 (strict mode)
- **Styling**: SCSS
- **Forms**: Reactive Forms
- **State Management**: RxJS BehaviorSubjects
- **Routing**: Angular Router with lazy loading

## Getting Started

### Prerequisites

- Node.js (v22 or higher)
- npm (v10 or higher)

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend
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

### Authentication

The application uses **JWT-based authentication** and supports two types of entities:

#### User Login (username + password)
```
Username/Phone: admin
Password/PIN: password123
```

#### Client Login (phone + PIN code)
```
Username/Phone: +1234567890
Password/PIN: 1234
```

**Auto-Detection**: The login form automatically detects whether you're logging in as a User or Client based on the identifier format:
- Phone numbers (10+ digits, optional +) → Client login
- Other text → User login

### Backend Configuration

Before using authentication, ensure your backend API is running and configured:

1. **Local Development** (Recommended): Use `environment.local.ts` for your personal dev settings:
   ```bash
   cp src/environments/environment.local.example.ts src/environments/environment.local.ts
   # Edit environment.local.ts with your backend URL
   ng serve --configuration=local
   ```
   See [LOCAL_DEVELOPMENT.md](./docs/LOCAL_DEVELOPMENT.md) for details.

2. **Default Development**: Update `src/environments/environment.ts`:
   ```typescript
   apiUrl: 'http://localhost:8080/api/v1'
   ```

3. **Production**: Set the `API_URL` environment variable or GitHub secret (see [DEPLOYMENT.md](./docs/DEPLOYMENT.md))

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

## Configuration

### Environment Files

- `environment.ts` - Development environment
- `environment.prod.ts` - Production environment

Configure API endpoints and other settings in these files.

## Coding Standards

Please refer to [CODING_POLICY.md](./docs/CODING_POLICY.md) for detailed coding guidelines including:
- TypeScript standards
- Naming conventions
- Component structure
- Service patterns
- Styling guidelines
- Git workflow

## Documentation

For comprehensive frontend documentation, see the [Frontend Documentation Index](docs/README.md):

- **[Quick Start Guide](docs/QUICKSTART.md)** - Fast setup and testing
- **[Coding Policy](docs/CODING_POLICY.md)** - Coding standards and conventions
- **[API Documentation](docs/api_documentation.md)** - Frontend API integration guide
- **[Translation Implementation](docs/TRANSLATION_IMPLEMENTATION.md)** - Complete translation system
- **[Translation Quick Start](docs/TRANSLATION_QUICK_START.md)** - Quick translation setup
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Frontend deployment instructions
- **[Frontend CLAUDE Guide](CLAUDE.md)** - Frontend development patterns

For project-wide documentation, see the [Main Documentation Index](docs/README.md).

## Contributing

1. Create a feature branch
2. Make your changes
3. Write/update tests
4. Submit a pull request

Please follow the coding standards outlined in [CODING_POLICY.md](./docs/CODING_POLICY.md).

## License

This project is licensed under the BSD 3-Clause License - see the [LICENSE](LICENSE) file for details.

## Support

For questions or issues, please create an issue in the repository.

---

**Built with  using Angular**
