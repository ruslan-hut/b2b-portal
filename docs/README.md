# Frontend Documentation

Complete documentation for the Comex B2B Portal (Angular application).

## 📚 Quick Navigation

### Getting Started
- **[Main README](../README.md)** - Frontend overview and setup instructions
- **[Quick Start Guide](./QUICKSTART.md)** - Fast setup and testing

### Development Guides
- **[Frontend CLAUDE Guide](../CLAUDE.md)** - Frontend development patterns and architecture
- **[Coding Policy](./CODING_POLICY.md)** - Coding standards and conventions
- **[API Documentation](./api_documentation.md)** - Frontend API integration guide

### Translation System
- **[Translation Implementation](./TRANSLATION_IMPLEMENTATION.md)** - Complete translation system documentation
- **[Translation Quick Start](./TRANSLATION_QUICK_START.md)** - Quick translation setup guide

### Deployment
- **[Deployment Guide](./DEPLOYMENT.md)** - Frontend deployment instructions

## 🚀 Getting Started

New to the frontend? Start here:

1. **Setup**: Follow the [Main README](../README.md) for installation
2. **Quick Test**: Use the [Quick Start Guide](./QUICKSTART.md)
3. **Development**: Read the [Frontend CLAUDE Guide](../CLAUDE.md)
4. **Coding Standards**: Review [Coding Policy](./CODING_POLICY.md)

## 🏗️ Architecture Overview

The frontend uses **Angular 21** with a **module-based architecture** (not standalone components):

```
src/app/
├── core/                   # Singleton services, guards, pipes
│   ├── services/           # AuthService, ProductService, etc.
│   ├── guards/             # Route protection
│   ├── models/             # TypeScript interfaces
│   ├── pipes/              # TranslatePipe (i18n)
│   └── components/         # LanguageSwitcherComponent
├── auth/                   # Lazy-loaded authentication module
├── products/               # Lazy-loaded products module
├── orders/                 # Lazy-loaded orders module
└── admin/                  # Lazy-loaded admin module
```

### Key Patterns
- **CoreModule**: Imported in all feature modules
- **Lazy Loading**: Feature modules loaded on-demand
- **State Management**: RxJS BehaviorSubjects (not NgRx)
- **Translation System**: Custom i18n with APP_INITIALIZER
- **API Integration**: Services use real API calls via HttpClient

See [Frontend CLAUDE Guide](../CLAUDE.md) for detailed architecture.

## 🌍 Translation System

The application supports **multi-language** functionality (English, Ukrainian):

- **Translation Files**: `src/assets/i18n/en.json`, `uk.json`
- **Custom Pipe**: `{{ 'key' | translate }}`
- **Service API**: `translationService.instant('key', {param: value})`
- **APP_INITIALIZER**: Loads translations before app bootstrap

### Quick Usage
```html
<!-- In templates -->
{{ 'common.welcome' | translate }}
{{ 'validation.minLength' | translate: {min: 5} }}
```

```typescript
// In components
const message = this.translationService.instant('error.required');
```

See complete guide: [Translation Implementation](./TRANSLATION_IMPLEMENTATION.md)

## 🎨 Styling & UI

### Design System
- **Theme**: Gradient-based modern design
- **Colors**: Primary gradient `#667eea` → `#764ba2`
- **Responsive**: Mobile-first with media queries
- **Styling**: SCSS with component-scoped styles

### Component Structure
- Each component has `.component.ts`, `.component.html`, `.component.scss`, `.component.spec.ts`
- Use `styleUrl` (singular) in Angular 17+
- Responsive breakpoints in component SCSS

See [Coding Policy](./CODING_POLICY.md) for styling guidelines.

## 🔐 Authentication

JWT-based authentication with dual login support:

### Login Types
- **User Login**: Username + password
- **Client Login**: Phone + PIN code
- **Auto-detection**: Form automatically detects login type

### Implementation
- **AuthService**: Manages user state with BehaviorSubjects
- **AuthGuard**: Protects routes requiring authentication
- **Token Storage**: localStorage (`authToken`, `currentUser`)

## 🧪 Testing

### API Integration
The application uses **real API integration** with the backend:

- **Services**: Use `HttpClient` for all API calls
- **Base URL**: Configured in `environment.ts` (default: `/api/v1`)
- **Authentication**: JWT-based authentication via `AuthService`
- **Error Handling**: Services include fallback logic for offline scenarios

See [API Documentation](./api_documentation.md) for integration details.

### Running Tests
```bash
npm test              # Run Karma unit tests
ng test               # Alternative command
```

## 📦 Build & Deployment

### Development Build
```bash
npm start             # Dev server on localhost:4200
ng serve              # Alternative command
```

### Production Build
```bash
npm run build:prod    # Production build with optimizations
```

The build uses environment variables:
- `API_URL`: Backend API URL (default: `/api/v1`)
- `APP_TITLE`: Application title (default: `B2B Portal`)

See [Deployment Guide](./DEPLOYMENT.md) for complete deployment instructions.

## 🛠️ Development Workflow

### Adding New Components
1. Generate: `ng generate component module-name/component-name`
2. Import CoreModule in feature module
3. Add translation keys to `src/assets/i18n/en.json` and `uk.json`
4. Use `{{ 'key' | translate }}` in templates

### Adding New Routes
1. Create route in feature routing module
2. Add AuthGuard for protected routes: `canActivate: [AuthGuard]`
3. Update navigation in `app.component.html`
4. Lazy-load feature modules

### Adding New Services
1. Generate in `core/services/`: `ng generate service core/services/service-name`
2. Use `providedIn: 'root'` for singleton services
3. Return Observables from methods
4. Use BehaviorSubject for reactive state

See [Frontend CLAUDE Guide](../CLAUDE.md) for detailed patterns.

## 📝 Coding Standards

Follow the [Coding Policy](./CODING_POLICY.md) for:
- TypeScript standards
- Naming conventions
- Component structure
- Service patterns
- Styling guidelines
- Git workflow

### Key Conventions
- **File Naming**: `kebab-case.component.ts`
- **TypeScript**: Strict mode, explicit types, no `any`
- **Forms**: Reactive Forms with validation
- **Module Type**: NgModule (not standalone components)

## 🔗 API Integration

### Current Status
The frontend uses **real API integration** with the backend service.

### Integration Points
- ✅ Services use `HttpClient` for all API calls
- ✅ Authentication via JWT tokens
- ✅ Batch operations for efficient data retrieval
- ✅ Error handling and retry logic implemented

See [API Documentation](./api_documentation.md) for integration details.

## 📖 Additional Resources

### External Resources
- [Angular Documentation](https://angular.io/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [RxJS Documentation](https://rxjs.dev/)

## 📝 Contributing

When modifying the frontend:
1. Follow [Coding Policy](./CODING_POLICY.md)
2. Update translation files for new text
3. Write/update tests for new features
4. Update documentation for significant changes
5. Test in both English and Ukrainian languages
