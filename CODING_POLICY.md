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
9. [Testing Guidelines](#testing-guidelines)
10. [Git Workflow](#git-workflow)

## Project Overview

This is a B2B portal application built with Angular that allows clients to browse products and create orders. The application follows a modular architecture with lazy-loaded feature modules.

### Key Features
- User authentication and authorization
- Product catalog with search functionality
- Shopping cart management
- Order creation and confirmation
- Order history tracking

## Technology Stack

- **Framework**: Angular 18+ (module-based architecture)
- **Language**: TypeScript (strict mode enabled)
- **Styling**: SCSS
- **Forms**: Reactive Forms
- **Routing**: Angular Router with lazy loading
- **State Management**: RxJS (BehaviorSubjects for simple state)
- **HTTP Client**: Angular HttpClient (to be integrated)

## Code Organization

### Directory Structure

```
src/
├── app/
│   ├── core/                 # Core module (singleton services, guards, models)
│   │   ├── guards/          # Route guards
│   │   ├── models/          # Data models and interfaces
│   │   └── services/        # Singleton services
│   ├── auth/                # Authentication module
│   ├── orders/              # Orders module
│   ├── products/            # Products module
│   ├── shared/              # Shared components, directives, pipes (future)
│   ├── app.component.*      # Root component
│   ├── app.module.ts        # Root module
│   └── app-routing.module.ts # Root routing
└── assets/                  # Static assets
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
4. **Unsubscribe**: Always unsubscribe from observables
5. **Pure Pipes**: Prefer pure pipes over methods in templates

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
- Implement PWA features
- Add internationalization (i18n)
- Implement advanced caching strategies
- Add monitoring and error tracking (e.g., Sentry)

## Resources

- [Angular Style Guide](https://angular.io/guide/styleguide)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [RxJS Documentation](https://rxjs.dev/)
- [SCSS Documentation](https://sass-lang.com/documentation)

---

**Last Updated**: October 2025
**Version**: 1.0.0

