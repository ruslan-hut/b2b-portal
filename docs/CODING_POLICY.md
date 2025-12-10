# B2B Portal - Coding Policy

## Table of Contents
1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Code Organization](#code-organization)
4. [Coding Standards](#coding-standards)
5. [Component Guidelines](#component-guidelines)
6. [Service Guidelines](#service-guidelines)
7. [Styling Guidelines](#styling-guidelines)
8. [API Integration](#api-integration)
9. [PWA Guidelines](#pwa-guidelines)
10. [Testing Guidelines](#testing-guidelines)
11. [Git Workflow](#git-workflow)

## Project Overview

This is a B2B portal application built with Angular that allows clients to browse products and create orders. The application follows a modular architecture with lazy-loaded feature modules.

### Key Features
- User authentication and authorization
- Product catalog with search functionality
- Shopping cart management
- Order creation and confirmation
- Order history tracking

## Technology Stack

- **Framework**: Angular 17+ (module-based architecture)
- **Language**: TypeScript (strict mode enabled)
- **Styling**: SCSS
- **Forms**: Reactive Forms
- **Routing**: Angular Router with lazy loading
- **State Management**: RxJS (BehaviorSubjects for simple state)
- **HTTP Client**: Angular HttpClient
- **PWA**: Angular Service Worker (@angular/pwa)

## Code Organization

### Directory Structure

```
src/
 app/
    core/                 # Core module (singleton services, guards, models)
       guards/          # Route guards
       models/          # Data models and interfaces
       services/        # Singleton services
    auth/                # Authentication module
    orders/              # Orders module
    products/            # Products module
    shared/              # Shared components, directives, pipes (future)
    app.component.*      # Root component
    app.module.ts        # Root module
    app-routing.module.ts # Root routing
 assets/                  # Static assets
```

### Module Organization

- **Core Module**: Contains singleton services, guards, and models used across the application
- **Feature Modules**: Self-contained modules with their own routing (auth, orders, products)
- **Shared Module** (future): Reusable components, directives, and pipes

## Coding Standards

### TypeScript

1. **Strict Mode**: Always use TypeScript strict mode
2. **Type Safety**: Avoid using `any` type; use proper types or interfaces
3. **Null Safety**: Handle null and undefined explicitly
4. **Access Modifiers**: Use `private`, `public`, `protected` appropriately

```typescript
// Good
export class ProductService {
  private products: Product[] = [];
  
  public getProducts(): Observable<Product[]> {
    return of(this.products);
  }
}

// Bad
export class ProductService {
  products: any;
  
  getProducts() {
    return of(this.products);
  }
}
```

### Naming Conventions

1. **Files**: Use kebab-case (e.g., `product-catalog.component.ts`)
2. **Classes**: Use PascalCase (e.g., `ProductCatalogComponent`)
3. **Interfaces**: Use PascalCase (e.g., `Product`, `User`)
4. **Variables/Functions**: Use camelCase (e.g., `getProducts`, `currentUser`)
5. **Constants**: Use UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
6. **Observables**: Suffix with `$` (e.g., `currentUser$`)

### Code Style

1. **Indentation**: 2 spaces
2. **Quotes**: Use single quotes for strings
3. **Semicolons**: Always use semicolons
4. **Line Length**: Maximum 120 characters
5. **Comments**: Use JSDoc for public methods and classes

```typescript
/**
 * Retrieves the list of products from the API
 * @returns Observable of Product array
 */
getProducts(): Observable<Product[]> {
  // Implementation
}
```

## Component Guidelines

### Component Structure

1. **Single Responsibility**: Each component should have one clear purpose
2. **Smart vs Presentational**: Distinguish between container (smart) and presentation components
3. **Lifecycle Hooks**: Only implement hooks you need
4. **OnPush Change Detection** (future optimization): Use when possible

### Component Template

```typescript
@Component({
  selector: 'app-product-catalog',
  templateUrl: './product-catalog.component.html',
  styleUrl: './product-catalog.component.scss'
})
export class ProductCatalogComponent implements OnInit {
  // Public properties (template bindings)
  products: Product[] = [];
  loading = false;
  
  // Private properties
  private subscription?: Subscription;
  
  constructor(
    private productService: ProductService,
    private router: Router
  ) {}
  
  ngOnInit(): void {
    this.loadProducts();
  }
  
  // Public methods (template actions)
  loadProducts(): void {
    // Implementation
  }
  
  // Private helper methods
  private processData(data: any): void {
    // Implementation
  }
}
```

### Template Best Practices

1. **Async Pipe**: Prefer `async` pipe for observables in templates
2. **TrackBy**: Always use `trackBy` with `*ngFor` for performance
3. **Avoid Logic**: Keep complex logic out of templates
4. **Accessibility**: Include proper ARIA attributes and semantic HTML

```html
<!-- Good -->
<div *ngFor="let product of products; trackBy: trackById">
  {{ product.name }}
</div>

<!-- Bad -->
<div *ngFor="let product of products">
  {{ product.name }}
</div>
```

## Service Guidelines

### Service Organization

1. **Single Responsibility**: One service per domain/feature
2. **Injectable**: Always use `providedIn: 'root'` for singleton services
3. **Error Handling**: Implement proper error handling in HTTP calls
4. **Return Types**: Always specify return types for methods

### Service Template

```typescript
@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private readonly API_URL = 'api/products';
  
  constructor(private http: HttpClient) {}
  
  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(this.API_URL).pipe(
      catchError(this.handleError)
    );
  }
  
  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('An error occurred:', error);
    return throwError(() => new Error('Something went wrong'));
  }
}
```

## Styling Guidelines

### Material Icons

This project uses [Google Material Icons](https://fonts.google.com/icons) for all icons throughout the application. Emoji symbols should **not** be used for icons in the UI.

#### Setup

Material Icons are included via CDN in `index.html`:

```html
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
```

Global styles for Material Icons are defined in `styles.scss` to ensure consistent rendering.

#### Usage in Templates

Use Material Icons with the `material-icons` class:

```html
<!-- Basic icon -->
<span class="material-icons">shopping_cart</span>

<!-- Icon with custom styling -->
<span class="material-icons cart-icon">shopping_cart</span>

<!-- Icon in button -->
<button class="close-btn">
  <span class="material-icons">close</span>
</button>
```

#### Icon Selection

- **Cart/Shopping**: `shopping_cart`
- **User/Person**: `person`, `account_circle`
- **Navigation**: `keyboard_arrow_down`, `keyboard_arrow_up`, `arrow_back`, `arrow_forward`
- **Actions**: `add`, `edit`, `delete`, `close`, `check`, `cancel`
- **Status**: `check_circle`, `cancel`, `warning`, `error`, `info`
- **Products**: `inventory_2`, `store`, `category`
- **Orders**: `receipt`, `list_alt`
- **Network**: `signal_wifi_off`, `wifi`, `cloud_off`
- **Language**: `language`, `public`, `translate`
- **View**: `view_list`, `view_module`, `grid_view`
- **Search**: `search`
- **Update**: `refresh`, `sync`

Browse all available icons at [Material Icons](https://fonts.google.com/icons).

#### Styling Material Icons

Material Icons should be styled with proper display and alignment:

```scss
.material-icons {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
  font-size: 24px; // Adjust size as needed
}

// Component-specific icon styling
.cart-icon {
  font-size: 18px;
  color: #667eea;
}

// Icon in button
.close-btn {
  .material-icons {
    font-size: 24px;
  }
}
```

#### Best Practices

1. **Always use Material Icons**: Replace all emoji symbols with Material Icons
2. **Consistent Sizing**: Use consistent font-size values (typically 18px, 20px, 24px, or 48px)
3. **Color Inheritance**: Icons inherit text color by default; override when needed
4. **Accessibility**: Include appropriate ARIA labels when icons are interactive
5. **Alignment**: Use `inline-flex` with `align-items: center` for proper vertical alignment
6. **Spacing**: Add appropriate gap/margin between icons and text

```html
<!-- Good: Icon with proper alignment -->
<button class="btn-cart">
  <span class="material-icons cart-icon">shopping_cart</span>
  <span class="cart-text">Cart</span>
</button>

<!-- Good: Accessible icon button -->
<button class="close-btn" [attr.aria-label]="'Close dialog'">
  <span class="material-icons">close</span>
</button>

<!-- Avoid: Emoji symbols -->
<button>🛒 Cart</button>
```

#### Common Patterns

```scss
// Icon in header/menu
.menu-icon {
  font-size: 20px;
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

// Large icon for empty states
.empty-icon {
  font-size: 80px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  color: #999;
}

// Icon with rotation animation
.expand-icon {
  font-size: 18px;
  transition: transform 0.2s ease;
  
  &.expanded {
    transform: rotate(180deg);
  }
}
```

### SCSS Organization

1. **Component Styles**: Scope styles to components
2. **Variables**: Use variables for colors, spacing, and breakpoints
3. **Mixins**: Create reusable mixins for common patterns
4. **BEM Naming** (optional): Consider BEM methodology for class names

### Style Template

```scss
.component-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  
  .component-header {
    margin-bottom: 20px;
    
    h1 {
      font-size: 24px;
      color: #333;
    }
  }
  
  @media (max-width: 768px) {
    padding: 10px;
  }
}
```

### Color Palette

```scss
// Primary Colors
$primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
$primary-color: #667eea;

// Neutral Colors
$text-primary: #333;
$text-secondary: #666;
$border-color: #e1e8ed;
$background: #f5f7fa;

// Status Colors
$success: #28a745;
$warning: #ffc107;
$danger: #dc3545;
$info: #17a2b8;
```

## PWA Guidelines

### Progressive Web App Features

The application is configured as a Progressive Web App (PWA) with the following features:

1. **Service Worker**: Automatically caches app shell and assets for offline functionality
2. **Web App Manifest**: Defines app metadata, icons, and display mode
3. **Offline Support**: Network detection and offline action queuing
4. **Update Notifications**: Automatic detection and notification of app updates

### Service Worker Configuration

The service worker is configured in `ngsw-config.json`:

- **App Shell**: Prefetched with network-first strategy
- **Static Assets**: Lazy loaded with prefetch updates
- **API Data**: Network-first with freshness strategy (5-10 minute cache)

```json
{
  "dataGroups": [
    {
      "name": "api-products",
      "urls": ["/api/v1/products/**"],
      "cacheConfig": {
        "strategy": "freshness",
        "maxAge": "10m",
        "timeout": "5s"
      }
    }
  ]
}
```

### Network Service Pattern

Use `NetworkService` to monitor connectivity:

```typescript
constructor(private networkService: NetworkService) {}

ngOnInit(): void {
  this.networkService.isOnline$.subscribe(isOnline => {
    if (!isOnline) {
      // Handle offline state
    }
  });
}
```

### Offline Storage Pattern

Use `OfflineStorageService` to queue actions when offline:

```typescript
constructor(
  private offlineStorage: OfflineStorageService,
  private networkService: NetworkService
) {}

createOrder(order: CreateOrderRequest): void {
  if (this.networkService.isOnline) {
    // Execute immediately
    this.orderService.createOrder(order).subscribe();
  } else {
    // Queue for later
    this.offlineStorage.queueAction('order', order).subscribe();
  }
}
```

### Update Notification

The `UpdateNotificationComponent` automatically detects and notifies users of app updates. It's included in the root component and requires no additional configuration.

**Translation Support**: The update notification component uses the translation service to display messages in the user's selected language. Translation keys are defined under the `pwa` namespace in translation files:
- `pwa.updateAvailable` - Title text
- `pwa.updateMessage` - Description text
- `pwa.reload` - Reload button text
- `pwa.later` - Dismiss button text

### PWA Best Practices

1. **Service Worker**: Only enabled in production builds
2. **Caching Strategy**: Use freshness strategy for API calls, cache-first for static assets
3. **Offline Indicators**: Always show clear UI feedback when offline
4. **Update Handling**: Provide user-friendly update notifications
5. **Manifest**: Keep manifest.webmanifest updated with correct icons and metadata

### PWA Testing

- Test installability on mobile and desktop browsers
- Test offline functionality by disabling network
- Test update notifications by deploying new versions
- Validate manifest.json with PWA audit tools (Lighthouse)

## API Integration

### REST API Standards

1. **Base URL**: Configure base URL in environment files
2. **HTTP Methods**: 
   - GET: Retrieve data
   - POST: Create new resource
   - PUT: Update entire resource
   - PATCH: Partial update
   - DELETE: Remove resource
3. **Error Handling**: Implement consistent error handling
4. **Loading States**: Show loading indicators during API calls
5. **Retry Logic**: Implement retry logic for failed requests (when appropriate)

### API Service Pattern

```typescript
@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = environment.apiUrl;
  
  constructor(private http: HttpClient) {}
  
  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${endpoint}`).pipe(
      retry(1),
      catchError(this.handleError)
    );
  }
  
  post<T>(endpoint: string, data: any): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${endpoint}`, data).pipe(
      catchError(this.handleError)
    );
  }
  
  private handleError(error: HttpErrorResponse): Observable<never> {
    // Implement error handling logic
    return throwError(() => error);
  }
}
```

## Testing Guidelines

### Unit Testing

1. **Coverage**: Aim for at least 80% code coverage
2. **Test Structure**: Use AAA pattern (Arrange, Act, Assert)
3. **Mocking**: Mock external dependencies
4. **Naming**: Use descriptive test names

```typescript
describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;
  
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ProductService]
    });
    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
  });
  
  it('should fetch products successfully', () => {
    // Arrange
    const mockProducts: Product[] = [/* mock data */];
    
    // Act
    service.getProducts().subscribe(products => {
      // Assert
      expect(products).toEqual(mockProducts);
    });
    
    const req = httpMock.expectOne('api/products');
    req.flush(mockProducts);
  });
  
  afterEach(() => {
    httpMock.verify();
  });
});
```

### E2E Testing

- Use Protractor or Cypress for E2E tests
- Test critical user flows
- Test across different browsers

## Git Workflow

### Branch Naming

- `feature/feature-name` - New features
- `bugfix/bug-name` - Bug fixes
- `hotfix/issue-name` - Urgent fixes
- `refactor/refactor-name` - Code refactoring
- `docs/documentation-update` - Documentation updates

### Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance tasks

Example:
```
feat(products): add product search functionality

- Implemented search input with debounce
- Added filter logic for products
- Updated UI to show search results

Closes #123
```

### Pull Request Guidelines

1. **Description**: Provide clear description of changes
2. **Testing**: Describe how changes were tested
3. **Screenshots**: Include screenshots for UI changes
4. **Code Review**: Request at least one review before merging
5. **Conflicts**: Resolve merge conflicts before requesting review

## Best Practices

### Security

1. **Authentication**: Never store sensitive data in localStorage without encryption
2. **XSS Prevention**: Always sanitize user input
3. **CSRF Protection**: Implement CSRF tokens for state-changing operations
4. **Environment Variables**: Use environment files for configuration

### Performance

1. **Lazy Loading**: Use lazy loading for feature modules
2. **OnPush**: Consider OnPush change detection strategy
3. **TrackBy**: Always use trackBy with ngFor
4. **Unsubscribe**: Always unsubscribe from observables (use OnDestroy lifecycle hook)
5. **Pure Pipes**: Prefer pure pipes over methods in templates
6. **Service Worker**: Leverage service worker caching for improved performance
7. **Bundle Size**: Monitor and optimize bundle sizes (use production builds)

### Accessibility

1. **Semantic HTML**: Use proper HTML elements
2. **ARIA Labels**: Add ARIA labels where needed
3. **Keyboard Navigation**: Ensure keyboard accessibility
4. **Color Contrast**: Maintain proper color contrast ratios

### Documentation

1. **README**: Keep README up to date
2. **Code Comments**: Comment complex logic
3. **API Documentation**: Document API endpoints
4. **Changelog**: Maintain a changelog for releases

## Future Enhancements

- Implement state management solution (NgRx or Akita) if complexity increases
- Add comprehensive unit and E2E tests
- Enhance PWA features (background sync, push notifications)
- Add internationalization (i18n) - partially implemented
- Implement advanced caching strategies
- Add monitoring and error tracking (e.g., Sentry)
- Add IndexedDB for more robust offline storage

## Resources

- [Angular Style Guide](https://angular.io/guide/styleguide)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [RxJS Documentation](https://rxjs.dev/)
- [SCSS Documentation](https://sass-lang.com/documentation)

---

**Last Updated**: January 2025
**Version**: 1.1.0

