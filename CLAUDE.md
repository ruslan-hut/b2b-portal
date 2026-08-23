# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Angular 21 B2B portal: a client area (catalog, cart, orders, partners, profile)
and a staff admin zone (clients, orders, products, CRM, chat, shipments,
integrations) in one application. Module-based architecture — **not** standalone
components — with lazy-loaded feature modules. The app talks to a live backend
over REST and WebSocket; `core/mock-data/` survives only as fixtures for
`order.service.ts` fallbacks and tests.

This repository is the public mirror of the platform frontend and carries the
published documentation for the platform's external APIs — most importantly the
[Client API](docs/api/client-api.md).

## Development Commands

```bash
npm start            # dev server on localhost:4200
npm run local        # dev server with src/environments/environment.local.ts
npm run build        # development build
npm run build:prod   # set-env.js + production build
npm run set-env      # apply API_URL / APP_TITLE / THEME / THEME_COLOR to the tree
npm run gen:brand    # regenerate brand assets
npm run check:theme  # audit a brand file against the design policy
npm test             # Karma unit tests
```

### Important notes

- **Base href** is `/`; the deploy URL is `/` (angular.json).
- **Module-based**: NgModules, not standalone components (angular.json schematics).
- **Node 22+, npm 10+**, TypeScript 5.9 strict, Angular 21.
- `npm run build:prod` **writes into the source tree** — `environment.prod.ts`,
  `index.html`, `src/brand/_active.scss`, `src/assets/branding/`. That is
  deliberate; every file is committed with its stock value, so `git checkout`
  restores you. See [theming contract](docs/development/theming-contract.md).
- Two deployment modes, both using the relative `/api/v1` by default:
  Nginx serving `/var/www/b2b/current` with the backend on 8888, or the Docker
  monolith where the backend serves the built frontend. See
  [docs/deployment/](docs/deployment/overview.md).

## Architecture

```
src/app/
├── core/            # Singletons: services, guards, interceptors, models, pipes, utils
├── auth/            # Login
├── products/        # Catalog with cart panel, order confirmation
├── orders/          # Order history and detail
├── partners/        # Partners area
├── profile/         # Client profile, addresses, self-service Client API keys
├── api-docs/        # Public: Redoc rendering of /api/client/v1/openapi.yaml
├── api-guide/       # Public: narrative Client API guide
├── admin/           # Admin zone (lazy, role-gated): dashboard, clients, companies,
│                    # orders, products, CRM, chat, shipments, invoices, content,
│                    # webhooks, telegram, mail, ai, binotel, client-api, stores,
│                    # tags, users, sessions, logs, tables, settings
├── shared/          # Shared components and directives
└── app.module.ts
src/brand/           # Brand token files; _active.scss is generated
src/styles/          # Global tokens and element styles
```

### Key patterns

**CoreModule** — imported by AppModule and by feature modules; exports
`TranslatePipe` and the language switcher, and registers the app initializer
that loads translations before bootstrap.

**State** — RxJS `BehaviorSubject` services (no NgRx). Newer components use
signals, `computed()` and `inject()`; modernize the file you touch rather than
sweeping the repo.

**Guards** (`core/guards/`) — `authGuard`, `adminGuard` (admin or manager),
`roleGuard`, `clientGuard`, `unsavedChangesGuard`. `auth.interceptor.ts` attaches
the JWT and handles refresh.

**Theming** — `ThemeService` toggles light/dark and syncs the browser chrome
colour; all colour, spacing and typography values come from tokens. The
authoritative rules live in [DESIGN_POLICY.md](DESIGN_POLICY.md).

## Money

Backend-authoritative: prices, discounts, VAT and totals are computed by the
backend, and the frontend displays what it receives. Two families, and the
distinction matters:

- **Integer cents** — order and invoice payloads (`1999` = 19.99). Format with
  `formatCents()` from `core/utils/money-format.ts`; the caller does not divide.
- **Display units** — anything the backend already converted (carrier prices,
  quotes, `entity.Money` fields) arrives as `25.4`. Format with `formatAmount()`.
  **Do not divide these by 100 again.**

`PriceFormattingService` formats only; it never calculates. When creating an
order, send product UIDs and quantities — the backend returns the fully
calculated order.

### Order and item fields (all pre-calculated by the backend)

Order: `discount_percent`, `vat_rate`, `subtotal`, `total_vat`, `total`,
`original_total`, `discount_amount`.
Item: `price`, `discount`, `price_discount`, `tax`, `total`, plus `sku` and
`product_name` for display.

### Preview pricing in the catalog

The catalog shows a **local preview** price for products not yet in the cart, and
for the window between a quantity change and the backend's response:
`originalPrice × (1 − discount/100) × (1 + vatRate/100)`. It is never sent
anywhere. Once the item is in the cart and quantities match, display switches to
the authoritative `cartItem.subtotal / cartItem.quantity`. Detecting the
quantity mismatch is what prevents a wrong price flashing mid-update.

## Translation system

- Translations load before bootstrap via an app initializer in `core.module.ts`,
  so translation keys never flash.
- Asset paths are **relative** (`assets/i18n/en.json`), which keeps the app
  working under a non-root base href.
- Files: `src/assets/i18n/en.json`, `src/assets/i18n/uk.json`. Dot-notation keys,
  `{{param}}` interpolation. Add every key to **both** files.

```typescript
translationService.instant('key', { param: value })  // synchronous
translationService.get('key', { param: value })      // observable
translationService.setLanguage('uk')
```

```html
{{ 'common.welcome' | translate }}
{{ 'validation.minLength' | translate: {min: 5} }}
```

## Conventions

- Components ship `.ts` + `.html` + `.scss` colocated; `styleUrl` (singular).
- `kebab-case.component.ts`, `.service.ts`, `.model.ts`, `.module.ts`.
- Strict TypeScript, ES2022, no implicit `any` — type explicitly.
- Reactive Forms everywhere; validation messages go through the translation
  service.
- New services: `core/services/`, `providedIn: 'root'`, return Observables.
- New routes: declare in the feature routing module, add the right guard, and
  give the route a `data.title` translation key.

## Documentation

- [docs/README.md](docs/README.md) — documentation index
- [docs/api/client-api.md](docs/api/client-api.md) — the external Client API
- [DESIGN_POLICY.md](DESIGN_POLICY.md) — authoritative UI policy
- [docs/development/frontend-coding-policy.md](docs/development/frontend-coding-policy.md)
- [docs/development/translation-implementation.md](docs/development/translation-implementation.md)
- [docs/deployment/overview.md](docs/deployment/overview.md)

Keep documentation in step with the code: an endpoint, env var or brand token
that changes here changes in `docs/` in the same commit.

## Common issues

1. Translation keys visible on load → check the initializer in `core.module.ts`.
2. 404 on translation files → asset paths must stay relative.
3. Auth not persisting → check `localStorage` for the token and current user.
4. Dirty `git status` after a production build → that is `set-env.js`; discard it.
5. Wrong prices by a factor of 100 → you used `formatCents` on display units, or
   `formatAmount` on cents.
