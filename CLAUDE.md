# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Angular 17+ B2B portal application for product catalog and order management. Uses module-based architecture (not standalone components) with lazy-loaded feature modules. Currently uses mock data - designed for future API integration.

## Development Commands

### Common Commands
```bash
npm start              # Start dev server (localhost:4200)
ng serve              # Alternative start command
ng build              # Production build
ng build --watch --configuration development  # Development build with watch
ng test               # Run Karma unit tests
```

### Code Generation
```bash
ng generate component module-name/component-name  # New component
ng generate service core/services/service-name    # New service
ng generate module module-name                    # New module
```

### Important Notes
- **Base URL**: Application is configured with `/` as base href (see angular.json:47)
- **Module-based**: NOT using standalone components (configured in angular.json schematics)
- **Working Directory**: Commands should be run from `frontend/` directory (not parent directory)
- **Deployment Modes**: Supports two deployment scenarios (see `../deployment/SCENARIOS.md`):
  - **Server + Nginx**: Frontend served by Nginx at `/var/www/b2b/current`, backend on port 8888
  - **Docker Monolith**: Frontend served by backend from `./static` directory
- **API Integration**: Currently uses mock data; backend API integration in progress

## Architecture

### Module Structure
```
src/app/
├── core/                    # Singleton services, guards, pipes, models
│   ├── services/            # AuthService, ProductService, OrderService, TranslationService
│   ├── guards/              # AuthGuard (route protection)
│   ├── models/              # TypeScript interfaces
│   ├── pipes/               # TranslatePipe
│   ├── components/          # LanguageSwitcherComponent
│   ├── mock-data/           # Mock data for testing
│   └── core.module.ts       # Exports TranslatePipe & LanguageSwitcher, includes APP_INITIALIZER
├── auth/                    # Authentication module (lazy-loaded)
│   └── login/               # Login component
├── products/                # Products module (lazy-loaded)
│   ├── product-catalog/     # Product catalog with cart panel
│   └── order-confirmation/  # Order confirmation page
├── orders/                  # Orders module (lazy-loaded)
│   └── order-history/       # Order history page
├── admin/                   # Admin zone module (lazy-loaded, admin/manager only)
│   ├── dashboard/           # Dashboard with statistics
│   ├── clients/             # Clients management
│   ├── orders/              # Orders management
│   ├── products/            # Products management
│   ├── users/               # Users management (admin only)
│   └── tables/              # Database tables viewer (admin only)
└── app.module.ts            # Root module - imports CoreModule
```

### Key Architectural Patterns

**CoreModule Pattern:**
- CoreModule is imported in AppModule and all feature modules
- Provides shared functionality: TranslatePipe, LanguageSwitcherComponent
- Uses APP_INITIALIZER to load translations before app bootstrap
- Contains singleton services (provided in 'root')

**State Management:**
- Uses RxJS BehaviorSubjects (not NgRx)
- AuthService: `currentUserSubject` for user state
- ProductService: `viewModeSubject` for grid/bulk toggle
- TranslationService: `currentLanguageSubject` and `translationsSubject`

**Lazy Loading:**
- Feature modules (auth, products, orders) are lazy-loaded via routing
- See app-routing.module.ts for route configuration

**Mock Data Pattern:**
- All services return Observables with delay() to simulate API calls
- Mock data stored in `core/mock-data/` folder
- Search "TODO: Replace with actual API call" to find integration points

## Translation System

### Critical Implementation Details

**APP_INITIALIZER Pattern (core.module.ts:27-32):**
- Translations load BEFORE app bootstrap to prevent translation keys from flashing
- `initializeTranslations()` factory function returns Promise
- Must return Promise for APP_INITIALIZER to wait

**Relative Asset Paths:**
- Translation service uses `assets/i18n/en.json` (relative, NOT `/assets/i18n/en.json`)
- Critical for compatibility with custom base URLs like `/b2b/`
- Browser automatically resolves to `/b2b/assets/i18n/en.json`

**Translation Service API:**
```typescript
translationService.instant('key', {param: value})  // Synchronous (use in components)
translationService.get('key', {param: value})      // Observable (reactive)
translationService.setLanguage('uk')               // Switch language
translationService.toggleLanguage()                // Toggle en/uk
```

**Template Usage:**
```html
{{ 'common.welcome' | translate }}                    <!-- Simple -->
{{ 'validation.minLength' | translate: {min: 5} }}    <!-- With params -->
```

**Language Files:**
- Located in `src/assets/i18n/en.json` and `src/assets/i18n/uk.json`
- Use dot notation for nested keys: `"common": { "welcome": "..." }`
- Parameter interpolation: `"Hello {{name}}"` → `{name: 'John'}`

### When Adding New Components
1. Import CoreModule in the feature module
2. Use `translate` pipe in templates
3. Use `translationService.instant()` for component logic
4. Add translation keys to both en.json and uk.json

## Service Integration Patterns

### Authentication Flow
```typescript
// AuthService uses BehaviorSubject for reactive auth state
authService.login(credentials)         // Returns Observable<LoginResponse>
  → authService.setAuthData(response)  // Stores in localStorage
  → currentUserSubject.next(user)      // Updates reactive state

// AuthGuard uses authService.isAuthenticated()
// Protects routes in routing modules
```

### Product Catalog Flow
```typescript
// ProductService manages view mode state
productService.getProducts()           // Returns Observable<Product[]>
productService.viewMode$               // Observable<'grid' | 'bulk'>
productService.toggleViewMode()        // Switches between grid/bulk display
```

### Mock Data Location
- Users: `core/mock-data/users.mock.ts`
- Products: `core/mock-data/products.mock.ts` (15 products, 3 categories)
- Orders: `core/mock-data/orders.mock.ts`

## Styling Guidelines

### Color Scheme
```scss
// Primary gradient theme
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)

// Use CSS variables defined in styles.scss
// Component styles use SCSS with scoped styles
```

### Component Structure
- Each component has `.component.ts`, `.component.html`, `.component.scss`, `.component.spec.ts`
- Use `styleUrl` (singular, not `styleUrls`) in Angular 17+
- Responsive design with media queries in component SCSS

### UI Patterns
- Gradient-based modern design
- Smooth animations (transitions for language switcher, cart panel)
- Mobile-responsive (breakpoints in component styles)
- Cart panel slides in from right side
- Language switcher is compact dropdown (60px wide)

## Form Handling

### Reactive Forms Pattern
```typescript
// All forms use ReactiveFormsModule
loginForm = this.fb.group({
  email: ['', [Validators.required, Validators.email]],
  password: ['', [Validators.required, Validators.minLength(6)]]
})

// Validation messages use translation service
getErrorMessage(control: FormControl): string {
  if (control.hasError('required')) {
    return this.translationService.instant('validation.required');
  }
  // ...
}
```

## Routing and Guards

### Route Protection
- AuthGuard protects all routes except `/auth/login`
- Guards check `authService.isAuthenticated()`
- Failed auth redirects to `/auth/login`

### Route Structure
```
/auth/login              → LoginComponent
/products/catalog        → ProductCatalogComponent (default after login)
/products/confirm-order  → OrderConfirmationComponent
/orders/history          → OrderHistoryComponent
/admin/dashboard         → AdminDashboardComponent (admin/manager only)
/admin/clients           → AdminClientsComponent (admin/manager only)
/admin/orders            → AdminOrdersComponent (admin/manager only)
/admin/products          → AdminProductsComponent (admin/manager only)
/admin/users             → AdminUsersComponent (admin only)
/admin/tables            → AdminTablesComponent (admin only)
```

### Admin Zone

**Location**: `core/guards/admin.guard.ts`

**Guards**:
- `adminGuard` - Requires 'admin' or 'manager' role
- `adminOnlyGuard` - Requires 'admin' role only

**Usage**:
```typescript
{
  path: 'admin',
  canActivate: [adminGuard],
  loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)
}
```

**Behavior**:
- Redirects to login if not authenticated
- Redirects to products if authenticated but insufficient role
- Checks user role from AuthService

## Testing

### Test Files Location
- Unit tests alongside components: `*.component.spec.ts`
- Service tests alongside services: `*.service.spec.ts`
- Run with `ng test` (Karma + Jasmine)

### Mock Data for Testing
- Login credentials: Any email format with any password (6+ chars)
- Test users available in `MOCK_USERS` array
- 15 sample products across 3 categories

## Production Build Notes

### Build Configuration
- Output path: `dist/comex-front/browser`
- Base href: `/` (configured in angular.json:47)
- Deploy URL: `/` (configured in angular.json:48)
- Assets include `src/assets` (contains i18n folder)
- Build command: `npm run build:prod` (runs `set-env.js` before building)
- Environment variables: `API_URL` (default: `/api/v1`), `APP_TITLE` (optional)

### Deployment Scenarios

The application supports two deployment modes:

**Scenario 1: Server + Nginx**
- Frontend deployed to: `/var/www/b2b/current` on server
- Backend runs as systemd service on port 8888
- Nginx serves frontend and proxies `/api/*` to backend
- Build command: `npm run build:prod` (uses `API_URL` from environment, default: `/api/v1`)
- Deployment: Automated via GitHub Actions on push to `master`
- See: `../deployment/nginx/README.md`

**Scenario 2: Docker Monolith**
- Frontend built into Docker image at `./static` during multi-stage build
- Backend serves both frontend and API from single container
- Build happens during Docker build stage (`Dockerfile`)
- Backend config: `SERVE_STATIC=true`
- API URL: Relative `/api/v1` (same origin)
- See: `../deployment/docker/README.md`

**Key Difference**: Both scenarios use relative `/api/v1` by default. No configuration changes needed for standard deployments.

### Environment Variables (Build Time)

```bash
# API URL (default: /api/v1 for relative path)
API_URL=/api/v1                              # Docker deployment (relative)
API_URL=https://api.portal.example/api/v1   # Server deployment (can be absolute)

# App Title (optional)
APP_TITLE="B2B Portal"
```

Set these before running `npm run build:prod`. The `scripts/set-env.js` script will inject them into the build.

### Critical for Production
- Translation files MUST be in build output: `dist/comex-front/browser/assets/i18n/`
- Relative paths in translation service ensure compatibility with any deployment URL
- Verify translation files load successfully (check Network tab)
- API URL must match deployment scenario (relative for same-origin, absolute for cross-origin)

## Common Patterns

### Adding New Translations
1. Add key to `src/assets/i18n/en.json`
2. Add corresponding key to `src/assets/i18n/uk.json`
3. Use in template: `{{ 'new.key' | translate }}`

### Adding New Routes
1. Create route in feature routing module
2. Add AuthGuard if route requires authentication
3. Update navigation in app.component.html

### Adding New Services
1. Generate in `core/services/` folder
2. Use `providedIn: 'root'` for singleton services
3. Return Observables from methods
4. Use BehaviorSubject for reactive state

### Working with Mock Data
- Mock responses include `delay(500)` to simulate network latency
- Replace mock implementations with HttpClient calls when ready
- Keep mock data files for testing purposes

## TypeScript Configuration

- Strict mode enabled (tsconfig.json)
- Target: ES2022
- Module: ES2022
- No implicit any, strict null checks enabled
- Always use explicit types, avoid `any`

## Important Files to Review

- `CODING_POLICY.md` - Detailed coding standards and conventions
- `TRANSLATION_IMPLEMENTATION.md` - Complete translation system documentation
- `README.md` - Project overview and setup instructions
- `QUICKSTART.md` - Quick setup and testing guide
- `MOCK_DATA.md` - Mock data structure and test credentials

## Quick Reference

### View Current Settings
- Angular version: 17.1.x (see `package.json` for exact version)
- TypeScript version: 5.3.2
- Styling: SCSS
- Forms: Reactive Forms
- Module type: NgModule (not standalone)
- Node.js: 18+ required
- npm: 9+ required

### File Naming Conventions
- Components: `kebab-case.component.ts`
- Services: `kebab-case.service.ts`
- Models: `kebab-case.model.ts`
- Modules: `kebab-case.module.ts`

### Common Issues
1. **Translation keys visible on load**: Verify APP_INITIALIZER in core.module.ts
2. **404 on translation files**: Check asset paths are relative (not absolute)
3. **Auth not persisting**: Check localStorage for 'currentUser' and 'authToken'
4. **Routes not protected**: Ensure AuthGuard is applied in routing module
