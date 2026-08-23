# Design Policy

This document defines the design standards for the COMEX B2B application — desktop and mobile. Follow these guidelines to maintain visual consistency across all components.

## Core Principles

1. **Compact Desktop, Comfortable Mobile** — Dense B2B layouts on desktop, 44px touch targets on mobile
2. **Business-First** — Clean, professional look suitable for B2B operations and power users
3. **Token-Driven** — Every size, color, and spacing value comes from a CSS variable; no hardcoded values
4. **Theme-Safe** — Every color must resolve in both light and dark themes

---

## Sizing System (compact B2B)

Comex uses a **desktop-first compact density** inspired by Linear, Stripe Dashboard, and Retool. Mobile viewport (`max-width: 768px`) automatically inflates tokens to meet WCAG touch-target guidelines — you do NOT need to add mobile overrides for sizing; the token layer handles it.

### Control heights

| Token | Desktop | Mobile (≤768px) | Use |
|-------|---------|------------------|-----|
| `--control-h-xs` | **24px** | 24px | chips, tags, inline badges |
| `--control-h-sm` | **28px** | 28px | dense icon actions in table rows |
| `--control-h-md` | **32px** | **40px** | default: buttons, inputs, selects |
| `--control-h-lg` | **36px** | **44px** | primary CTAs, form submits |
| `--touch-target-min` | **32px** | **44px** | enforced minimum for any interactive element |

### Typography scale

| Token | Value | Use |
|-------|-------|-----|
| `--text-xs` | 11px | labels, helper text, badges |
| `--text-sm` | 12px | compact controls, meta, filter labels |
| `--text-base` | 13px | table cells, compact buttons, dense body text |
| `--text-md` | 14px | **body default**, form inputs, primary buttons |
| `--text-lg` | 16px | h3, card titles |
| `--text-xl` | 18px | h2 |
| `--text-2xl` | 20px | h1 |

Body base: `font-size: var(--text-md)` (14px), `line-height: 1.5`.

### Icon sizes

| Token | Value | Use |
|-------|-------|-----|
| `--icon-sm` | 16px | compact toolbars, `.compact-btn` |
| `--icon-md` | 18px | default inside buttons |
| `--icon-lg` | 20px | sidebar, prominent actions |
| `--icon-xl` | 24px | hero/empty-state |

### Radii

| Token | Value | Use |
|-------|-------|-----|
| `--radius-control` | 6px | **default for buttons and form inputs** |
| `--radius-md` | 8px | cards, panels |
| `--radius-lg` | 12px | modals, large containers |
| `--radius-pill` | 9999px | badges |

### Mandatory rules

- **Never hardcode control heights** (`height: 48px`, `min-height: 40px`, etc). Always use the token.
- **Never hardcode font-sizes on body/inputs/buttons** — use `var(--text-*)`.
- **Never hardcode hex colors** — use CSS variables; add a new token if one doesn't exist.
- **Do not add mobile media-query height overrides** for buttons/inputs — the token layer already scales these at `max-width: 768px`.
- **Mobile font-size** on `<input>` is bumped to 16px by the global stylesheet to prevent iOS zoom — do not override.

### Spacing scale

Preferred: clean 4/8 grid: `4 · 8 · 12 · 16 · 24 · 32 · 48`. Legacy intermediates (`sm-md: 10`, `md-sm: 12`, `md-lg: 20`) remain for backward compatibility but avoid in new code.

---

## Typography System

> Based on [Material Design 3 Type Scale](https://m3.material.io/styles/typography/applying-type) with Ukrainian Cyrillic support

### Font Families

The application uses **Montserrat** for headings and **Commissioner** for body text, both with excellent Ukrainian Cyrillic support.

| Purpose | Font Family | Weights Available | Cyrillic Support |
|---------|-------------|-------------------|------------------|
| **Headings** | Montserrat | 300-900 (Thin to Black) | ✅ Excellent (8,640+ glyphs) |
| **Body Text** | Commissioner | 100-900 (Thin to Black) | ✅ Excellent (ії ligature fix) |

**Why this pairing:**
- Montserrat: Geometric sans-serif similar to Space Grotesk, professional B2B aesthetic
- Commissioner: Solves tight Ukrainian accents (її) through smart ligatures
- Both available as variable fonts for optimal performance
- Full Ukrainian alphabet support including rare diacritics

### Font Loading

Add to `frontend/src/index.html` in the `<head>` section:

```html
<!-- Preconnect for performance -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- Variable fonts for optimal file size -->
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300..900&family=Commissioner:wght@100..900&display=swap&subset=latin,cyrillic" rel="stylesheet">
```

### CSS Variables

Define in `frontend/src/styles.scss`:

```scss
:root {
  // Font families
  --font-heading: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-body: 'Commissioner', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

  // Font weights
  --font-weight-light: 300;
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --font-weight-extrabold: 800;
  --font-weight-black: 900;
}
```

### Base Typography Styles

```scss
body {
  font-family: var(--font-body);
  font-weight: var(--font-weight-regular);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

// Headings use Montserrat
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
  font-weight: var(--font-weight-bold);
  line-height: 1.25;
  margin: 0;
}

// Buttons use Commissioner
button, .button {
  font-family: var(--font-body);
  font-weight: var(--font-weight-medium);
}
```

### Ukrainian Typography Testing

Test with these Ukrainian strings to verify proper rendering:

```
// Accent-heavy (tests ї, і combinations)
"Київ, Україна"
"Їжачок і їжа"
"Замовлення №12345"
"Продукти: 150 ₴"
```

---

## Spacing Standards

> Based on [Material Design 3 8dp Grid System](https://m3.material.io/foundations/layout/understanding-layout/spacing)

### Spacing Scale (8dp Grid)

Use multiples of 8px for consistent spacing. The 4px increment is available for tight spacing needs.

| Token | Value | Usage |
|-------|-------|-------|
| `--spacing-xs` | 4px | Tight spacing, icon padding |
| `--spacing-sm` | 8px | Standard input padding, small gaps |
| `--spacing-md` | 16px | Default spacing between elements |
| `--spacing-lg` | 24px | Section spacing |
| `--spacing-xl` | 32px | Large section gaps |
| `--spacing-2xl` | 40px | Major section separation |
| `--spacing-3xl` | 48px | Page-level spacing |

### Mobile (max-width: 768px)

| Element Type | Padding | Gap | Margin |
|-------------|---------|-----|--------|
| Container/Page | 12px (1.5×) horizontal | - | - |
| Section/Card | 12px (1.5×) | - | 8-16px bottom |
| List items | 12px (1.5×) | 8px (1×) between | - |
| Buttons | 12px (1.5×) | - | - |
| Form inputs | 8px (1×) (`--spacing-sm`) | - | 12px (1.5×) bottom |

### Extra Small (max-width: 480px)

| Element Type | Padding | Gap | Margin |
|-------------|---------|-----|--------|
| Container/Page | 12px (1.5×) horizontal | - | - |
| Section/Card | 8px (1×) | - | 8px (1×) bottom |
| List items | 8px (1×) | 8px (1×) between | - |

**Note:** Numbers in parentheses (e.g., "1×", "1.5×") indicate multiples of the 8px base grid.

---

## Typography Standards

> Based on [Material Design 3 Type Scale](https://m3.material.io/styles/typography/applying-type)

### Material Design 3 Type Scale (Reference)

Material Design 3 defines a comprehensive type scale. Below are the sizes adapted for B2B mobile applications:

| Role | Size / Line Height | Weight | Mobile Usage |
|------|-------------------|--------|--------------|
| **Display Large** | 57px / 64px | 400 | Hero sections (rare on mobile) |
| **Display Medium** | 45px / 52px | 400 | Marketing headers (rare on mobile) |
| **Display Small** | 36px / 44px | 400 | Large promotional content |
| **Headline Large** | 32px / 40px | 400 | Not recommended for mobile |
| **Headline Medium** | 28px / 36px | 400 | Not recommended for mobile |
| **Headline Small** | 24px / 32px | 400 | Large page titles (use sparingly) |
| **Title Large** | 22px / 28px | 400 | **Page titles (h1)** ✓ |
| **Title Medium** | 16px / 24px | 500 | **Section headers (h2)** ✓ |
| **Title Small** | 14px / 20px | 500 | **Subsections (h3), Cards** ✓ |
| **Body Large** | 16px / 24px | 400 | Large body text, descriptions |
| **Body Medium** | 14px / 20px | 400 | **Standard body text** ✓ |
| **Body Small** | 12px / 16px | 400 | **Secondary text, captions** ✓ |
| **Label Large** | 14px / 20px | 500 | **Large buttons** ✓ |
| **Label Medium** | 12px / 16px | 500 | **Standard buttons, labels** ✓ |
| **Label Small** | 11px / 16px | 500 | **Small labels, badges** ✓ |

### Font Sizes (compact B2B)

Our B2B application uses a compact scale tuned for information density on desktop. Mobile font-size on `<input>` bumps to 16px automatically to prevent iOS zoom.

| Element | Size / Line Height | Weight | Font Family | Token |
|---------|-------------------|--------|-------------|-------|
| Page title (h1) | 20px / 26px | 700 | **Montserrat** | `--text-2xl` |
| Section title (h2) | 18px / 24px | 600 | **Montserrat** | `--text-xl` |
| Subsection (h3) / Card title | 16px / 22px | 600 | **Montserrat** | `--text-lg` |
| Body text | 14px / 21px | 400 | **Commissioner** | `--text-md` |
| Table cell / compact body | 13px / 18px | 400 | **Commissioner** | `--text-base` |
| Secondary text / labels | 12px / 16px | 500 | **Commissioner** | `--text-sm` |
| Badges / helper / micro | 11px / 16px | 600 | **Commissioner** | `--text-xs` |
| Default button | 13px / 18px | 500 | **Commissioner** | `--text-base` |
| Primary CTA button | 14px / 20px | 500 | **Commissioner** | `--text-md` |

### Typography Best Practices

1. **Line Height**: Maintain 1.4-1.5× ratio for readability (e.g., 14px font → 20px line height)
2. **Font Weights**:
   - Headings (Montserrat): 700 (bold), 800 (extra-bold for h1 on desktop)
   - Body (Commissioner): 400 (regular), 500 (medium for labels/buttons), 600 (semi-bold for emphasis)
3. **Hierarchy**: Maximum 3 levels of hierarchy per screen on mobile
4. **Contrast**: Minimum 4.5:1 for body text, 3:1 for large text (18px+)
5. **Letter Spacing**: Use default tracking; avoid custom letter-spacing unless necessary
6. **Ukrainian Accents**: Commissioner's ії ligature ensures proper spacing in Ukrainian text
7. **Font Loading**: Use `font-display: swap` to prevent invisible text during font loading

---

## Touch Targets

Desktop-first B2B density (Linear/Stripe/Retool peers), with mobile enforcing WCAG-compliant targets via the token layer.

| Element | Desktop | Mobile (≤768px) | Token |
|---------|---------|------------------|-------|
| Default button / input | **32px** | 40px | `--control-h-md` |
| Primary CTA / form submit | **36px** | 44px | `--control-h-lg` |
| Icon button | **32×32** | 40×40 | `--control-h-md` square |
| Dense icon action (table row) | **28×28** | 28×28 | `--control-h-sm` square |
| Touch-target minimum | **32px** | 44px | `--touch-target-min` |

Do not set `min-height` on buttons except via these tokens — the mobile override is already wired into `:root` at the `max-width: 768px` media query.

---

## Typography Implementation Examples

### Complete Component Example

```scss
// Card component with proper typography
.product-card {
  padding: 12px;
  border-radius: var(--radius-md);
  background: var(--card-bg);

  .card-title {
    font-family: var(--font-heading);  // Montserrat
    font-size: 16px;
    font-weight: var(--font-weight-bold);  // 700
    line-height: 24px;
    color: var(--color-text-primary);
    margin-bottom: 8px;
  }

  .card-description {
    font-family: var(--font-body);  // Commissioner
    font-size: 14px;
    font-weight: var(--font-weight-regular);  // 400
    line-height: 20px;
    color: var(--color-text-secondary);
    margin-bottom: 12px;
  }

  .card-price {
    font-family: var(--font-heading);  // Montserrat for emphasis
    font-size: 18px;
    font-weight: var(--font-weight-extrabold);  // 800
    color: var(--color-primary);
  }

  .card-label {
    font-family: var(--font-body);  // Commissioner
    font-size: 12px;
    font-weight: var(--font-weight-medium);  // 500
    line-height: 16px;
    color: var(--color-text-muted);
  }

  .card-button {
    font-family: var(--font-body);  // Commissioner
    font-size: 14px;
    font-weight: var(--font-weight-medium);  // 500
    padding: 12px 24px;
    border-radius: var(--radius-md);
  }
}
```

### Heading Hierarchy

```scss
// Montserrat for all headings
h1 {
  font-family: var(--font-heading);
  font-size: 22px;
  font-weight: var(--font-weight-bold);  // 700
  line-height: 28px;

  @media (min-width: 768px) {
    font-size: 28px;
    line-height: 36px;
  }

  @media (min-width: 1024px) {
    font-size: 32px;
    font-weight: var(--font-weight-extrabold);  // 800
    line-height: 40px;
  }
}

h2 {
  font-family: var(--font-heading);
  font-size: 16px;
  font-weight: var(--font-weight-bold);
  line-height: 24px;

  @media (min-width: 768px) {
    font-size: 20px;
    line-height: 28px;
  }
}

h3 {
  font-family: var(--font-heading);
  font-size: 15px;
  font-weight: var(--font-weight-semibold);  // 600
  line-height: 22px;

  @media (min-width: 768px) {
    font-size: 18px;
    line-height: 26px;
  }
}
```

### Form Elements

```scss
// Labels, inputs, and helper text
.form-group {
  margin-bottom: 16px;

  label {
    font-family: var(--font-body);  // Commissioner
    font-size: 12px;
    font-weight: var(--font-weight-medium);  // 500
    line-height: 16px;
    color: var(--color-text-secondary);
    display: block;
    margin-bottom: 4px;
  }

  input,
  select,
  textarea {
    font-family: var(--font-body);  // Commissioner
    font-size: var(--text-md);      // 14px
    font-weight: var(--font-weight-regular);
    line-height: 20px;
    min-height: var(--control-h-md);  // 32px desktop / 40px mobile
    padding: 6px 10px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-control);  // 6px

    &::placeholder {
      font-family: var(--font-body);
      color: var(--color-text-muted);
    }
  }

  .helper-text {
    font-family: var(--font-body);  // Commissioner
    font-size: 11px;
    font-weight: var(--font-weight-regular);  // 400
    line-height: 16px;
    color: var(--color-text-muted);
    margin-top: 4px;
  }

  .error-message {
    font-family: var(--font-body);  // Commissioner
    font-size: 11px;
    font-weight: var(--font-weight-medium);  // 500
    line-height: 16px;
    color: var(--color-danger);
    margin-top: 4px;
  }
}
```

### Buttons

```scss
// All buttons use Commissioner; compact B2B default
.button {
  font-family: var(--font-body);
  font-size: var(--text-base);            // 13px
  font-weight: var(--font-weight-medium);
  line-height: 18px;
  min-height: var(--control-h-md);        // 32px desktop / 40px mobile
  padding: 4px 12px;
  border-radius: var(--radius-control);   // 6px
  transition: all 0.2s ease;

  &.button-large {                        // primary CTA
    min-height: var(--control-h-lg);      // 36px desktop / 44px mobile
    font-size: var(--text-md);            // 14px
    padding: 6px 14px;
  }

  &.button-small {                        // dense table actions
    min-height: var(--control-h-sm);      // 28px
    font-size: var(--text-sm);            // 12px
    padding: 2px 8px;
  }
}
```

### Badges and Chips

```scss
.badge {
  font-family: var(--font-body);  // Commissioner
  font-size: 11px;
  font-weight: var(--font-weight-semibold);  // 600
  line-height: 16px;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  display: inline-block;
}

.chip {
  font-family: var(--font-body);  // Commissioner
  font-size: 12px;
  font-weight: var(--font-weight-medium);  // 500
  line-height: 16px;
  padding: 6px 12px;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
```

---

## Button System

> Based on [Material Design 3 Buttons](https://m3.material.io/components/buttons/guidelines) with B2B customizations

### Button Hierarchy & Types

Material Design 3 defines 5 button types with different emphasis levels. For our B2B application, we use a hybrid approach: **flat buttons in action bars/toolbars** and **gradient buttons for primary CTAs**.

#### Button Emphasis Levels (High to Low)

| Type | Emphasis | Usage | B2B Application |
|------|----------|-------|-----------------|
| **Filled (Gradient)** | Highest | Primary actions, main CTAs | ✅ **Standalone CTAs** (with gradient) |
| **Filled (Flat)** | High | Important actions | ⚠️ Use sparingly |
| **Filled Tonal** | Medium-High | Secondary important actions | ✅ Alternative primary actions |
| **Outlined** | Medium | Action bars, toolbars, forms | ✅ **Action bars/toolbars** (flat) |
| **Text** | Low | Tertiary actions, navigation | ✅ Cancel, dismiss, optional actions |

### Button Style Guidelines

#### 1. Primary CTA Buttons (Gradient, Standalone)

Use for the most important action on a screen (checkout, submit order, confirm purchase). Uses the **lg** control tier to stand out visually against default 32px buttons.

```scss
.button-primary {
  font-family: var(--font-body);
  font-size: var(--text-md);              // 14px
  font-weight: var(--font-weight-medium);
  line-height: 20px;

  min-height: var(--control-h-lg);        // 36px desktop / 44px mobile
  padding: 6px 14px;
  border-radius: var(--radius-control);   // 6px
  border: none;

  background: var(--gradient-primary);
  color: var(--color-on-primary);

  box-shadow: var(--elevation-2);
  transition: all 0.2s ease;

  // Hover state
  &:hover:not(:disabled) {
    box-shadow: var(--elevation-3);
    transform: translateY(-1px);
    // Slightly darker gradient overlay
    background: linear-gradient(135deg, #5568d3 0%, #6a4091 100%);
  }

  // Active/pressed state
  &:active:not(:disabled) {
    box-shadow: var(--elevation-1);
    transform: translateY(0);
  }

  // Focus state
  &:focus:not(:disabled) {
    box-shadow: var(--elevation-2), var(--focus-ring);
  }

  // Disabled state
  &:disabled {
    background: var(--color-border);
    color: var(--color-text-muted);
    box-shadow: none;
    cursor: not-allowed;
    opacity: 0.6;
  }
}
```

**Usage:**
- Maximum **1 gradient button per screen**
- Reserve for highest-priority action (e.g., "Add to Cart", "Place Order", "Submit")
- Should be the most visually prominent element in its context

#### 2. Action Bar Buttons (Flat, Outlined)

Use for actions within toolbars, app bars, and navigation areas.

```scss
.button-action-bar {
  font-family: var(--font-body);
  font-size: var(--text-base);            // 13px
  font-weight: var(--font-weight-medium);
  line-height: 18px;

  min-height: var(--control-h-md);        // 32px desktop / 40px mobile
  padding: 4px 12px;
  border-radius: var(--radius-control);   // 6px

  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);

  box-shadow: none;
  transition: all 0.2s ease;

  // Hover state (subtle background)
  &:hover:not(:disabled) {
    background: var(--color-surface-variant);  // Very light fill
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  // Active/pressed state
  &:active:not(:disabled) {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  }

  // Focus state
  &:focus:not(:disabled) {
    border-color: var(--color-primary);
    box-shadow: var(--focus-ring);
  }

  // Disabled state
  &:disabled {
    background: transparent;
    border-color: var(--color-border-light);
    color: var(--color-text-muted);
    cursor: not-allowed;
    opacity: 0.6;
  }
}
```

**Usage:**
- Toolbar actions (save, edit, delete, filter)
- Navigation controls
- Multiple actions in action bars
- Form actions (alongside primary CTA)

#### 3. Secondary Buttons (Filled Tonal, Flat)

Use for important but non-primary actions.

```scss
.button-secondary {
  font-family: var(--font-body);
  font-size: var(--text-md);              // 14px
  font-weight: var(--font-weight-medium);
  line-height: 20px;

  min-height: var(--control-h-lg);        // 36px desktop / 44px mobile (matches primary)
  padding: 6px 14px;
  border-radius: var(--radius-control);
  border: none;

  background: var(--color-primary-container);
  color: var(--color-on-primary-container);

  box-shadow: var(--elevation-1);
  transition: all 0.2s ease;

  // Hover state
  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-primary) 20%, var(--color-primary-container));
    box-shadow: var(--elevation-2);
  }

  // Active state
  &:active:not(:disabled) {
    background: color-mix(in srgb, var(--color-primary) 25%, var(--color-primary-container));
    box-shadow: var(--elevation-1);
  }

  // Focus state
  &:focus:not(:disabled) {
    box-shadow: var(--elevation-1), var(--focus-ring);
  }

  // Disabled state
  &:disabled {
    background: var(--color-border);
    color: var(--color-text-muted);
    box-shadow: none;
    cursor: not-allowed;
    opacity: 0.6;
  }
}
```

**Usage:**
- Alternative actions (e.g., "Save Draft" alongside "Publish")
- Filter/sort buttons in toolbars
- Secondary CTAs that need prominence

#### 4. Text Buttons (Low Emphasis)

Use for tertiary actions, cancellations, and optional flows.

```scss
.button-text {
  font-family: var(--font-body);
  font-size: var(--text-base);            // 13px
  font-weight: var(--font-weight-medium);
  line-height: 18px;

  min-height: var(--control-h-md);        // 32px desktop / 40px mobile
  padding: 4px 12px;
  border-radius: var(--radius-control);

  background: transparent;
  border: none;
  color: var(--color-primary);

  box-shadow: none;
  transition: all 0.15s ease;

  // Hover state
  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-primary) 8%, transparent);
  }

  // Active state
  &:active:not(:disabled) {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  }

  // Focus state
  &:focus:not(:disabled) {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    box-shadow: var(--focus-ring);
  }

  // Disabled state
  &:disabled {
    color: var(--color-text-muted);
    cursor: not-allowed;
    opacity: 0.38;
  }
}
```

**Usage:**
- "Cancel" buttons
- "Skip" or "Back" navigation
- Dismissible dialogs
- Optional actions

#### 5. Icon Buttons (Compact Actions)

Use in toolbars, lists, and compact interfaces.

```scss
.button-icon {
  width: var(--control-h-md);             // 32px desktop / 40px mobile
  height: var(--control-h-md);
  min-width: var(--control-h-md);
  min-height: var(--control-h-md);
  padding: 0;
  border-radius: var(--radius-control);

  background: transparent;
  border: none;
  color: var(--color-text-secondary);

  .material-icons,
  .icon {
    font-size: var(--icon-md);            // 18px
    width: var(--icon-md);
    height: var(--icon-md);
  }

  box-shadow: none;
  transition: all 0.15s ease;

  // Hover state
  &:hover:not(:disabled) {
    background: var(--color-surface-variant);
    color: var(--color-primary);
  }

  // Active state
  &:active:not(:disabled) {
    background: color-mix(in srgb, var(--color-primary) 12%, transparent);
  }

  // Focus state
  &:focus:not(:disabled) {
    box-shadow: var(--focus-ring);
  }

  // Disabled state
  &:disabled {
    color: var(--color-text-muted);
    cursor: not-allowed;
    opacity: 0.38;
  }

  // Filled variant (for active states)
  &.filled {
    background: var(--color-primary);
    color: var(--color-on-primary);

    &:hover:not(:disabled) {
      background: color-mix(in srgb, #000 8%, var(--color-primary));
    }
  }
}
```

**Usage:**
- Toolbar actions (menu, search, settings, close)
- List item actions (edit, delete, share)
- Navigation icons

### Button Sizing

Compact B2B desktop (Linear/Stripe/Retool density). **Default is 32px.** Mobile inflates via token layer.

| Tier | Desktop | Mobile | Token | Font | Usage |
|------|---------|--------|-------|------|-------|
| **xs** | 24px | 24px | `--control-h-xs` | `--text-xs` 11px | chips, badges |
| **sm** | 28px | 28px | `--control-h-sm` | `--text-sm` 12px | dense row-level icon actions |
| **md** (default) | **32px** | **40px** | `--control-h-md` | `--text-base` 13px | action-bar, secondary, text, icon buttons, filter controls |
| **lg** | **36px** | **44px** | `--control-h-lg` | `--text-md` 14px | primary CTA, form submit, hero inputs |

```scss
// Default button — never set height directly
.button {
  min-height: var(--control-h-md);     // 32px desktop / 40px mobile
  padding: 4px 12px;
  font-size: var(--text-base);
  border-radius: var(--radius-control); // 6px
}

// Primary CTA — one tier larger
.button.primary {
  min-height: var(--control-h-lg);     // 36px desktop / 44px mobile
  padding: 6px 14px;
  font-size: var(--text-md);
}
```

**PRINCIPLES:**
1. **Default is md (32px)**. Only primary CTAs and form submits use lg (36px) for visual hierarchy.
2. **Do not hardcode heights**. Use `var(--control-h-*)` so mobile inflation works automatically.
3. **Border width 1px** on compact controls (not 2px — reserved for heavy emphasis).
4. **Border radius 6px** on controls (`--radius-control`); 8px+ reserved for cards/modals.
5. **Hover state**: border-color + subtle bg. Keep transitions ≤0.2s — B2B interfaces should feel responsive, not whimsical.

### Gradient Implementation

**Primary Gradient (Default):**
```scss
:root {
  --gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  --gradient-primary-hover: linear-gradient(135deg, #5568d3 0%, #6a4091 100%);
}
```

**Best Practices for Gradients:**
1. Use **2 colors maximum** (3 max in rare cases)
2. Maintain **45-135° angle** for natural flow
3. Ensure **4.5:1 contrast** for text (use white text on brand gradients)
4. Avoid **conflicting colors** (use color wheel adjacents or complements)
5. Test on **mobile devices** (gradients can appear differently)
6. Add **subtle texture/noise** for depth (optional, 2-5% opacity)

**When NOT to Use Gradients:**
- ❌ Action bars and toolbars (use flat outlined buttons)
- ❌ Multiple buttons in proximity (only 1 gradient button per screen)
- ❌ Small buttons under 40px height (gradients lose impact)
- ❌ Disabled states (use solid colors)

---

## Compact Controls (`.compact-*` utility classes)

> These utility classes pre-package the default 32px control (matches `--control-h-md`) for use inside action bars, filter rows, and toolbars. They are **not** a dense alternative to a larger default — the whole app already uses compact density; these classes exist as convenient shortcuts.

### When to Use

- Selects/inputs inside `<app-action-bar>` or filter rows
- Toolbar buttons that toggle or filter

### When NOT to Use

- Primary CTAs — use `.btn-primary-cta` (36px tier)
- Form submits — use `.btn-secondary` or `.btn-primary-cta` (36px tier)

### Compact Control Specifications

| Property | Value | Token |
|----------|-------|-------|
| Height | 32px | `var(--control-h-md)` |
| Padding | 4px 10px | — |
| Font size | 13px | `var(--text-base)` |
| Font weight | 500 | `var(--font-weight-medium)` |
| Border | 1px solid border | `var(--color-border)` |
| Border radius | 6px | `var(--radius-control)` |
| Icon size | 16px | `var(--icon-sm)` |
| Mobile override | 40px | auto via media query |

### CSS Classes

```html
<!-- Compact select -->
<select class="compact-select">...</select>

<!-- Compact text input -->
<input class="compact-input" type="text">

<!-- Compact button -->
<button class="compact-btn">
  <span class="material-icons">filter_list</span>
  <span class="btn-text">Filters</span>
</button>
```

### SCSS Mixins

```scss
@use 'styles/mixins' as *;

.custom-toolbar-select {
  @include compact-input;
}

.custom-toolbar-btn {
  @include compact-button;
}
```

### Mobile Behavior (< 768px)

- `.btn-text` inside `.compact-btn` is hidden (icon-only)
- Selects maintain full height but reduce padding slightly

### Comparison with Standard Controls

| Property | Standard (Forms) | Compact (Toolbars) |
|----------|-----------------|-------------------|
| Height | 48px (min-height) | 32px (fixed) |
| Border | 2px | 1px |
| Font size | 15px | 13px |
| Border radius | 8px | 6px |
| Padding | 8px 16px | 5px 12px |
| Use case | Data entry, modals | Action bars, filters |

---

## Action Bars & Toolbars

> Based on [Material Design 3 Top App Bar](https://m3.material.io/components/app-bars/guidelines)

### Top App Bar Anatomy

```
┌─────────────────────────────────────────────────────────┐
│ [Nav Icon]  Page Title               [Action] [Action]  │
└─────────────────────────────────────────────────────────┘
```

### Action Bar Consistency Rules

#### 1. Button Style in Action Bars: **Always Flat**

```scss
.app-bar,
.toolbar,
.action-bar {
  // Container
  min-height: 40px;  // Compact action bar (was 56px)
  padding: 4px 0;
  background: var(--card-bg);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;

  // All buttons in action bar are flat/outlined
  .button,
  button {
    @extend .button-action-bar;  // Flat outlined style
    min-height: 40px;
    padding: 10px 16px;
  }

  // Icon buttons
  .button-icon {
    width: 40px;
    height: 40px;
    padding: 8px;
    background: transparent;

    &:hover {
      background: var(--color-surface-variant);
    }
  }

  // Title
  .app-bar-title {
    font-family: var(--font-heading);  // Montserrat
    font-size: 18px;
    font-weight: var(--font-weight-bold);
    color: var(--color-text-primary);
    flex: 1;
    margin: 0 16px;
  }
}
```

#### 2. Mobile App Bar (Compact)

```scss
@media (max-width: 768px) {
  .app-bar,
  .toolbar {
    height: 56px;
    padding: 0 12px;

    .app-bar-title {
      font-size: 16px;
    }

    // Icon-only buttons on mobile
    .button {
      min-width: 40px;
      padding: 8px;

      // Hide text, show icon only
      .button-text {
        display: none;
      }
    }
  }
}
```

#### 3. Action Bar Actions (Right Side)

**Maximum 3 actions visible:**
- Primary actions should be icon-only for space efficiency
- Use "More" overflow menu (⋮) for additional actions
- Actions ordered by importance (left to right)

```html
<!-- Example action bar -->
<div class="app-bar">
  <button class="button-icon" aria-label="Menu">
    <i class="icon-menu"></i>
  </button>

  <h1 class="app-bar-title">Product Catalog</h1>

  <div class="app-bar-actions">
    <button class="button-icon" aria-label="Search">
      <i class="icon-search"></i>
    </button>
    <button class="button-icon" aria-label="Filter">
      <i class="icon-filter"></i>
    </button>
    <button class="button-icon" aria-label="More options">
      <i class="icon-more-vert"></i>
    </button>
  </div>
</div>
```

### Bottom Action Bar (Mobile)

For mobile screens with primary CTAs:

```scss
.bottom-action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 72px;  // Taller for prominent CTA
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0));
  background: var(--card-bg);
  border-top: 1px solid var(--color-border);
  box-shadow: var(--elevation-3);
  z-index: 100;

  // Primary CTA button (gradient allowed here)
  .button-primary {
    width: 100%;
    min-height: 48px;
  }
}
```

### Menu Consistency

#### Dropdown Menus

```scss
.dropdown-menu {
  background: var(--card-bg);
  border-radius: var(--radius-lg);  // 12px
  box-shadow: var(--elevation-3);
  padding: 8px 0;
  min-width: 200px;

  .menu-item {
    // Text button style
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: var(--font-weight-regular);
    padding: 12px 16px;
    background: transparent;
    border: none;
    color: var(--color-text-primary);
    text-align: left;
    width: 100%;
    cursor: pointer;
    transition: background var(--duration-short);

    &:hover {
      background: var(--color-surface-variant);
    }

    &:active {
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    }

    // With icon
    .icon {
      margin-right: 12px;
      width: 20px;
      height: 20px;
      color: var(--color-text-secondary);
    }

    // Destructive action
    &.destructive {
      color: var(--color-danger);

      .icon {
        color: var(--color-danger);
      }
    }
  }

  .menu-divider {
    height: 1px;
    background: var(--color-border);
    margin: 8px 0;
  }
}
```

### Menu Bar (Horizontal Tab Navigation)

> GitHub-style horizontal navigation for in-page section switching. Use `<app-menu-bar>` for all horizontal tab navigation across the application.

**Component**: `app-menu-bar` (in `SharedModule`)

**Purpose**: Unified horizontal navigation for switching between views/sections within a page. Replaces ad-hoc button groups, pill-style tabs, and inconsistent navigation patterns.

**When to use**:
- Switching between sub-pages within a module (e.g., CRM: Pipeline, Dashboard, Workload)
- Switching between views/tabs on a single page
- Any horizontal navigation that was previously done with button groups

**When NOT to use**:
- Primary app navigation (use sidebar or header)
- Action buttons (use Action Bar)
- Filtering/toggling (use filter buttons)

#### Anatomy

```
┌────────────────────────────────────────────────────────────┐
│ [icon] Label    [icon] Label    [icon] Label    [icon] Lab │
│ ═══════                                                    │ ← active indicator
├────────────────────────────────────────────────────────────┤
│                        border-bottom                       │
└────────────────────────────────────────────────────────────┘
```

#### Specifications

| Property | Value | Notes |
|----------|-------|-------|
| Item height | 40px (min-height) | Compact, space-efficient |
| Padding | 8px 16px | Comfortable touch target with compact height |
| Font | Commissioner 14px, medium (500) | Matches body text system |
| Active font weight | Semibold (600) | Subtle emphasis without being heavy |
| Icon size | 18px | Material Icons, inline with text |
| Icon-text gap | 6px | Tight coupling between icon and label |
| Active indicator | 2px solid `var(--color-primary)` | Bottom border, overlaps container border |
| Container border | 1px solid `var(--color-border)` | Bottom border only |
| Text color (default) | `var(--color-text-secondary)` | Muted when inactive |
| Text color (hover) | `var(--color-text-primary)` | Subtle hover feedback |
| Text color (active) | `var(--color-primary)` | Clear active state |
| Transition | 0.15s ease | Fast, responsive feel |

#### Mobile Behavior (< 768px)

- **Labels hidden**: Only icons visible to save horizontal space
- **Padding reduced**: 8px 12px
- **Horizontal scroll**: Overflow scrolls without visible scrollbar

#### Usage

```typescript
// In component
import { MenuItem } from 'shared/components/menu-bar/menu-bar.component';

menuItems: MenuItem[] = [
  { icon: 'view_kanban', label: 'Pipeline', route: '/admin/crm', exactMatch: true },
  { icon: 'dashboard', label: 'Dashboard', route: '/admin/crm/dashboard' },
  { icon: 'settings', label: 'Settings', route: '/admin/crm/settings' }
];
```

```html
<!-- In template -->
<app-menu-bar [items]="menuItems"></app-menu-bar>
```

#### Style Rules

- **NO background** on items (transparent)
- **NO pills/cards** around active items
- **NO box-shadow** on items
- **Bottom border only** for active indicator (2px, primary color)
- **NO gradient** backgrounds
- Items are flat links, not buttons

#### SCSS Mixin

Use `@include menu-bar-item` from `_mixins.scss` for custom menu bar items outside the component:

```scss
@use 'styles/mixins' as *;

.custom-tab {
  @include menu-bar-item;
}
```

---

### Navigation Menu (Sidebar)

```scss
.navigation-menu {
  width: 280px;
  height: 100vh;
  background: var(--card-bg);
  border-right: 1px solid var(--color-border);
  padding: 16px 0;

  .nav-item {
    // Text button with left alignment
    font-family: var(--font-body);
    font-size: 14px;
    font-weight: var(--font-weight-medium);
    padding: 12px 24px;
    background: transparent;
    border: none;
    border-left: 3px solid transparent;
    color: var(--color-text-primary);
    text-align: left;
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: all var(--duration-short);

    .icon {
      width: 24px;
      height: 24px;
      color: var(--color-text-secondary);
    }

    &:hover {
      background: var(--color-surface-variant);
    }

    &.active {
      background: var(--color-primary-container);
      border-left-color: var(--color-primary);
      color: var(--color-primary);

      .icon {
        color: var(--color-primary);
      }
    }
  }
}
```

---

## Component Patterns

### Cards (Collapsible)

> [!IMPORTANT]
> Always use CSS variables for card styling to ensure proper light/dark theme support.

```scss
.card {
  padding: 10px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--card-border);
  box-shadow: var(--card-shadow);

  &.expanded {
    border-color: var(--color-primary);
    box-shadow: var(--card-hover-shadow);
  }
}
```

**Dark theme visibility**: The `--card-border` variable is set to a visible color (`#30363d`) in dark theme to ensure cards are distinguishable from the dark background.

### Lists with "Show More"

- Default limit: 5 items
- Show remaining count in button: "Show more (X)"
- Button styling: dashed border, full-width, centered text

### Bottom Sheet Dialogs

```scss
.dialog {
  border-radius: 12px 12px 0 0;
  max-height: 80-85vh;
  margin-bottom: env(safe-area-inset-bottom, 0);
}
```

### Form Inputs (Standard Pattern)

Use this pattern for all text inputs, selects, and textareas:

```scss
input,
select,
textarea {
  width: 100%;
  padding: var(--spacing-sm);  // 8px - standard input padding
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);  // 8px
  font-size: 15px;
  background: var(--input-bg);
  color: var(--input-text);
  transition: border-color 0.3s ease, box-shadow 0.3s ease;

  &:focus {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: var(--focus-ring);
  }

  &.invalid,
  &.is-invalid {
    border-color: var(--color-danger);
  }

  &::placeholder {
    color: var(--color-text-muted);
  }
}
```

> [!IMPORTANT]
> **Always use CSS custom properties** (variables) for colors instead of hardcoded hex values. This ensures proper light/dark theme support.

**Key specifications:**
- **Padding**: `var(--spacing-sm)` (8px) - provides optimal text spacing within inputs
- **Border**: 2px solid for clear visual boundary
- **Border radius**: `var(--radius-md)` (8px) for consistency
- **Focus state**: Primary color border + focus ring shadow
- **Invalid state**: Danger color border for validation feedback

---

## Color Palette

> [!WARNING]
> **Never use hardcoded hex colors directly in component styles.** Always reference the CSS custom properties defined in `styles.scss` to ensure proper light/dark theme support.

### Color Consistency Principles

> **CRITICAL**: To prevent different colors appearing on different pages, ALWAYS follow these semantic naming principles.

Material Design 3 uses **design tokens** organized in a three-tier hierarchy:

1. **Reference Tokens** (Raw values): `#667eea`, `#764ba2` — The actual color values
2. **System Tokens** (Semantic names): `--color-primary`, `--color-surface` — Purpose-based names
3. **Component Tokens** (Context-specific): `--button-bg`, `--card-border` — Component-specific usage

#### Mandatory Color Usage Rules

**✅ DO** - Use semantic CSS variables:
```scss
// Correct: Semantic, purpose-based naming
color: var(--color-text-primary);        // Primary text color
background: var(--card-bg);              // Card background
border: 2px solid var(--color-border);   // Standard border

// For interactive states, use color-mix with semantic colors
&:hover {
  background: color-mix(in srgb, var(--color-primary) 8%, transparent);
}
```

**❌ DON'T** - Never use hardcoded colors or appearance-based names:
```scss
// Wrong: Hardcoded hex values
color: #333333;                          // ❌ Breaks theming
background: #ffffff;                     // ❌ Breaks dark mode
border: 2px solid #e1e8ed;               // ❌ Non-semantic

// Wrong: Appearance-based naming (anti-pattern)
color: var(--blue-color);                // ❌ What if design changes to purple?
background: var(--light-gray);           // ❌ Not semantic
```

#### Component Consistency Mapping

To ensure consistency across the application, components MUST use these exact mappings:

| Component Type | Background | Text Color | Border | Hover State |
|---------------|------------|------------|--------|-------------|
| **Buttons (Primary)** | `var(--color-primary)` | `var(--color-on-primary)` | none | `color-mix(in srgb, #000 8%, var(--color-primary))` |
| **Buttons (Secondary)** | `var(--color-primary-container)` | `var(--color-on-primary-container)` | none | `color-mix(in srgb, var(--color-primary) 20%, var(--color-primary-container))` |
| **Buttons (Outlined)** | `transparent` | `var(--color-primary)` | `2px solid var(--color-border)` | `color-mix(in srgb, var(--color-primary) 8%, transparent)` |
| **Buttons (Text)** | `transparent` | `var(--color-primary)` | none | `color-mix(in srgb, var(--color-primary) 8%, transparent)` |
| **Cards** | `var(--card-bg)` | `var(--color-text-primary)` | `1px solid var(--card-border)` | `var(--card-hover-shadow)` |
| **Inputs** | `var(--input-bg)` | `var(--input-text)` | `2px solid var(--color-border)` | `border-color: var(--color-primary)` |
| **Headers (h1-h6)** | inherited | `var(--color-text-primary)` | none | n/a |
| **Body Text** | inherited | `var(--color-text-primary)` | none | n/a |
| **Secondary Text** | inherited | `var(--color-text-secondary)` | none | n/a |
| **Muted Text** | inherited | `var(--color-text-muted)` | none | n/a |
| **Error States** | `var(--color-error-container)` | `var(--color-on-error-container)` | `2px solid var(--color-danger)` | n/a |
| **Success States** | `var(--color-success-container)` | `var(--color-on-success-container)` | `2px solid var(--color-success)` | n/a |

**IMPORTANT**: If you find yourself creating a new color variable, ask:
1. Does this represent a **semantic purpose** (primary action, error state, surface)?
2. Can an existing semantic variable be used instead?
3. Will this color be consistent across ALL similar components?

### Material Design 3 Color Roles

> Based on [Material Design 3 Color System](https://m3.material.io/styles/color/roles)

Material Design 3 uses a semantic color role system. Our B2B application maps these roles as follows:

#### Primary Colors
| MD3 Role | CSS Variable | Light Value | Usage |
|----------|--------------|-------------|-------|
| Primary | `--color-primary` | #667eea | Main brand color, primary actions, FABs |
| On Primary | `--color-on-primary` | #ffffff | Text/icons on primary backgrounds |
| Primary Container | `--color-primary-container` | #e8edff | Tinted backgrounds, chip fills |
| On Primary Container | `--color-on-primary-container` | #1e0060 | Text on primary container |

#### Secondary Colors
| MD3 Role | CSS Variable | Light Value | Usage |
|----------|--------------|-------------|-------|
| Secondary | `--color-secondary` | #764ba2 | Less prominent actions, gradients |
| On Secondary | `--color-on-secondary` | #ffffff | Text/icons on secondary |
| Secondary Container | `--color-secondary-container` | #f3e5ff | Secondary chip backgrounds |
| On Secondary Container | `--color-on-secondary-container` | #2a0052 | Text on secondary container |

#### Surface Colors
| MD3 Role | CSS Variable | Light Value | Usage |
|----------|--------------|-------------|-------|
| Background | `--color-background` | #f5f7fa | Page background |
| Surface | `--card-bg` | #ffffff | Cards, sheets, menus |
| Surface Variant | `--color-surface-variant` | #e8edff | Alternative surface color |
| On Surface | `--color-text-primary` | #333333 | Primary text on surfaces |
| On Surface Variant | `--color-text-secondary` | #666666 | Secondary text on surfaces |

#### Semantic Colors
| MD3 Role | CSS Variable | Light Value | Usage |
|----------|--------------|-------------|-------|
| Error | `--color-danger` | #dc3545 | Error states, destructive actions |
| On Error | `--color-on-error` | #ffffff | Text on error backgrounds |
| Error Container | `--color-error-container` | #f9dedc | Error message backgrounds |
| On Error Container | `--color-on-error-container` | #490909 | Text on error container |
| Success | `--color-success` | #28a745 | Success states, confirmations |
| Warning | `--color-warning` | #ffc107 | Warning states, caution |
| Info | `--color-info` | #17a2b8 | Informational messages |

#### Outline & Border Colors
| MD3 Role | CSS Variable | Light Value | Usage |
|----------|--------------|-------------|-------|
| Outline | `--color-border` | #e1e8ed | Component borders, dividers |
| Outline Variant | `--color-border-light` | #f0f4f8 | Subtle dividers |

#### Legacy Mappings (Existing B2B Variables)
| CSS Variable | Light Value | Usage |
|--------------|-------------|-------|
| `--color-primary-dark` | #5568d3 | Hover states (use `:hover` with opacity instead) |
| `--color-text-muted` | #999999 | Placeholders, disabled states |

### Color Contrast Requirements

Follow WCAG 2.1 AA standards:
- **Body text (< 18px)**: Minimum 4.5:1 contrast ratio
- **Large text (≥ 18px or ≥ 14px bold)**: Minimum 3:1 contrast ratio
- **UI components & borders**: Minimum 3:1 contrast ratio
- **Active elements**: Ensure clear distinction from inactive states

**Example - Correct Usage:**
```scss
.my-component {
  background: var(--card-bg);  // ✅ Adapts to theme
  color: var(--color-text-primary);  // ✅ Adapts to theme
  border: 1px solid var(--color-border);  // ✅ Adapts to theme
}
```

**Example - Incorrect Usage:**
```scss
.my-component {
  background: #ffffff;  // ❌ Breaks dark mode
  color: #333;  // ❌ Breaks dark mode
  border: 1px solid #e1e8ed;  // ❌ Breaks dark mode
}
```

### Color Consistency Enforcement

#### Pre-Commit Checklist

Before committing new component styles, verify:

- [ ] **No hardcoded hex colors** - Search for `#[0-9a-fA-F]` pattern in SCSS files
- [ ] **Semantic variables only** - All colors use `var(--color-*)` or `var(--*-bg)` format
- [ ] **Component mapping followed** - Button colors match the Component Consistency Mapping table
- [ ] **State overlays use color-mix** - Hover/focus/active states use `color-mix()` function
- [ ] **Contrast checked** - Text meets 4.5:1 (body) or 3:1 (large text) contrast ratio
- [ ] **Dark mode tested** - Component looks correct in both light and dark themes

#### Automated Color Audit

Run the UI check tool to detect color violations:
```bash
/uicheck                    # Scan all files for color violations
/uicheck --fix             # Auto-fix color violations
/uicheck --report          # Generate color consistency report
```

The tool will flag:
- Hardcoded hex colors (`color: #333`)
- Non-semantic variable names (`var(--blue-text)`)
- Inconsistent component colors (different button colors in different files)
- Missing color-mix for interactive states

#### Common Color Violations & Fixes

| ❌ Violation | ✅ Fix | Reason |
|-------------|--------|--------|
| `color: #333333;` | `color: var(--color-text-primary);` | Semantic naming, theme support |
| `background: #f5f5f5;` | `background: var(--color-background);` | Consistent backgrounds |
| `border: 1px solid #ddd;` | `border: 1px solid var(--color-border);` | Consistent borders |
| `color: var(--blue-500);` | `color: var(--color-primary);` | Purpose over appearance |
| `.button { background: #667eea; }` | `.button { background: var(--color-primary); }` | Component consistency |
| `.card { box-shadow: 0 2px 8px rgba(0,0,0,0.1); }` | `.card { box-shadow: var(--elevation-2); }` | Elevation tokens |

---

## Icon System

> Based on [Material Design 3 Icons](https://m3.material.io/styles/icons/designing-icons)

### Icon Sizes

| Size | Dimension | Usage |
|------|-----------|-------|
| **Extra Small** | 16×16px | Inline icons, badges, dense lists |
| **Small** | 20×20px | Compact UI, table icons |
| **Medium** (Standard) | 24×24px | **Default icon size** - buttons, inputs, lists |
| **Large** | 32×32px | Prominent actions, large cards |
| **Extra Large** | 48×48px | Feature highlights, empty states |

### Touch Target Padding

Even when the icon visual is 24×24px, ensure the touch target is at least 48×48dp:

```scss
.icon-button {
  // Icon visual size
  .icon {
    width: 24px;
    height: 24px;
  }

  // Touch target (includes padding)
  min-width: 48px;
  min-height: 48px;
  padding: 12px; // (48 - 24) / 2
}
```

### Icon Families

**Material Symbols** (Recommended):
- **Outlined**: Default, clean look for most UI elements
- **Filled**: Active states, selected items
- **Rounded**: Friendly, approachable feel
- **Sharp**: Modern, technical aesthetic

### Icon Usage Guidelines

1. **Semantic Clarity**: Icons should be instantly recognizable
2. **Consistency**: Use the same icon family throughout the app
3. **Accessibility**: Always provide `aria-label` for icon-only buttons
4. **Alignment**: Optically center icons, not mathematically
5. **Color**: Use `currentColor` to inherit text color
6. **Spacing**: 8-12px gap between icon and text

### Icon + Text Pattern

```scss
.button-with-icon {
  display: flex;
  align-items: center;
  gap: 8px; // Material Design standard

  .icon {
    width: 20px;  // Slightly smaller than standalone
    height: 20px;
  }
}
```

### Icon States

```scss
.icon {
  color: var(--color-text-secondary);
  transition: color 0.2s ease;

  &:hover {
    color: var(--color-primary);
  }

  &.active {
    color: var(--color-primary);
  }

  &.disabled {
    color: var(--color-text-muted);
    opacity: 0.38; // Material Design disabled opacity
  }
}
```

---

## Border Radius Standards

> Based on Material Design 3 shape system

| Element | Radius | CSS Variable | Usage |
|---------|--------|--------------|-------|
| Small components | 4px | `--radius-sm` | Chips, small badges |
| Medium components | 8px | `--radius-md` | **Buttons, cards, inputs** (default) |
| Large components | 12px | `--radius-lg` | Large cards, dialogs |
| Extra large | 16px | `--radius-xl` | Bottom sheets, modals |
| Full round | 24px+ | `--radius-full` | Pills, circular buttons |

### Shape Tokens

```scss
:root {
  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 8px;   // Default
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-full: 9999px; // Pill shape
}
```

### Component-Specific Radii

| Component | Radius | Note |
|-----------|--------|------|
| Buttons | 8px (`--radius-md`) | Standard, full-width |
| Text inputs | 8px (`--radius-md`) | Consistency with buttons |
| Cards | 8px (`--radius-md`) | Standard elevation |
| Elevated cards | 12px (`--radius-lg`) | More prominent |
| Badges/Chips | 20px (`--radius-full`) | Pill shape |
| Bottom sheets | 12px (top only) | `border-radius: 12px 12px 0 0` |
| Dialogs/Modals | 12px (`--radius-lg`) | All corners |
| Avatar | 50% / `--radius-full` | Circular |

---

## Elevation & Shadows

> Based on Material Design 3 elevation system

### Elevation Levels

Material Design uses 5 elevation levels for depth hierarchy:

| Level | Elevation | CSS Variable | Shadow Spec | Usage |
|-------|-----------|--------------|-------------|-------|
| **0** | 0dp | `--elevation-0` | None | Flat surfaces, backgrounds |
| **1** | 1dp | `--elevation-1` | 0 1px 2px rgba(0,0,0,0.08) | Cards, raised elements |
| **2** | 3dp | `--elevation-2` | 0 2px 8px rgba(0,0,0,0.12) | Hover cards, dropdowns |
| **3** | 6dp | `--elevation-3` | 0 4px 16px rgba(0,0,0,0.16) | Dialogs, navigation drawers |
| **4** | 8dp | `--elevation-4` | 0 8px 24px rgba(0,0,0,0.20) | Modal overlays |
| **5** | 12dp | `--elevation-5` | 0 12px 32px rgba(0,0,0,0.24) | FABs, tooltips on hover |

### Shadow Definitions

```scss
:root {
  // Elevation shadows
  --elevation-0: none;
  --elevation-1: 0 1px 2px 0 rgba(0, 0, 0, 0.08);
  --elevation-2: 0 2px 8px 0 rgba(0, 0, 0, 0.12);
  --elevation-3: 0 4px 16px 0 rgba(0, 0, 0, 0.16);
  --elevation-4: 0 8px 24px 0 rgba(0, 0, 0, 0.20);
  --elevation-5: 0 12px 32px 0 rgba(0, 0, 0, 0.24);

  // Focus ring
  --focus-ring: 0 0 0 3px rgba(102, 126, 234, 0.15);
}
```

### Usage Guidelines

**B2B Application Preference**: Use **subtle borders** instead of heavy shadows for a clean, professional look:

```scss
// ✓ Preferred for B2B
.card {
  border: 1px solid var(--color-border);
  box-shadow: none; // Or very subtle --elevation-1
}

// ✗ Avoid heavy shadows
.card {
  box-shadow: 0 10px 40px rgba(0,0,0,0.3); // Too dramatic
}
```

**When to Use Shadows**:
- **Elevated states**: Hover, focus, active
- **Floating elements**: Modals, tooltips, dropdowns
- **Clear layering**: When z-index hierarchy needs visual reinforcement

**Transition Pattern**:
```scss
.card {
  box-shadow: var(--elevation-1);
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: var(--elevation-2);
  }
}
```

---

## Responsive Breakpoints

> Based on [Material Design 3 Layout System](https://m3.material.io/foundations/layout/applying-layout)

### Material Design 3 Window Size Classes

Material Design 3 uses **window size classes** instead of traditional pixel breakpoints:

| Class | Width Range | Columns | Margins | Gutters | Description |
|-------|-------------|---------|---------|---------|-------------|
| **Compact** | < 600px | 4 | 16px | 16px | Phones (portrait) |
| **Medium** | 600-839px | 8 | 24px | 24px | Tablets (portrait), large phones |
| **Expanded** | ≥ 840px | 12 | 24px | 24px | Tablets (landscape), desktop |

### B2B Application Breakpoints

Our application uses these practical breakpoints:

| Breakpoint | Width | Window Class | Usage |
|------------|-------|--------------|-------|
| **xs** | < 480px | Compact | Small phones |
| **sm** | 480-767px | Compact | Standard phones |
| **md** | 768-1023px | Medium | Tablets (portrait) |
| **lg** | 1024-1279px | Expanded | Tablets (landscape), small desktop |
| **xl** | ≥ 1280px | Expanded | Desktop |

### Breakpoint Usage in SCSS

```scss
// Mobile-first approach (Material Design recommended)
.component {
  // Base styles (mobile)
  padding: 12px;
  font-size: 14px;

  // Tablet
  @media (min-width: 768px) {
    padding: 16px;
    font-size: 15px;
  }

  // Desktop
  @media (min-width: 1024px) {
    padding: 24px;
    font-size: 16px;
  }
}
```

### Grid Specifications by Breakpoint

```scss
// Compact (< 600px) - Phones
@media (max-width: 599px) {
  .container {
    padding: 0 16px;           // 16px margins
    gap: 16px;                 // 16px gutters
    grid-template-columns: repeat(4, 1fr);
  }
}

// Medium (600-839px) - Large phones, tablets
@media (min-width: 600px) and (max-width: 839px) {
  .container {
    padding: 0 24px;           // 24px margins
    gap: 24px;                 // 24px gutters
    grid-template-columns: repeat(8, 1fr);
  }
}

// Expanded (≥ 840px) - Desktop
@media (min-width: 840px) {
  .container {
    padding: 0 24px;           // 24px margins
    gap: 24px;                 // 24px gutters
    grid-template-columns: repeat(12, 1fr);
  }
}
```

### Responsive Typography

```scss
// Adjust font sizes across breakpoints
h1 {
  font-size: 22px;             // Mobile
  line-height: 28px;

  @media (min-width: 768px) {
    font-size: 28px;           // Tablet
    line-height: 36px;
  }

  @media (min-width: 1024px) {
    font-size: 32px;           // Desktop
    line-height: 40px;
  }
}
```

---

## Safe Area Handling

Always account for notched devices:

```scss
.footer, .bottom-sheet {
  padding-bottom: env(safe-area-inset-bottom, 0);
  // Or add to existing padding:
  padding-bottom: calc(12px + env(safe-area-inset-bottom, 0));
}
```

---

## Component States & Interactions

> Based on Material Design 3 interaction states

### State Layer System

Material Design uses **state layers** - semi-transparent overlays that indicate interactive states:

| State | Opacity | Duration | Usage |
|-------|---------|----------|-------|
| **Hover** | 8% (0.08) | 200ms | Desktop pointer hover |
| **Focus** | 12% (0.12) | Instant | Keyboard/accessibility focus |
| **Pressed** | 12% (0.12) | 100ms | Active click/tap |
| **Dragged** | 16% (0.16) | 200ms | Drag-and-drop operations |
| **Disabled** | 38% (0.38) | - | Inactive elements (reduced opacity) |

### Interactive Element States

```scss
.interactive-element {
  position: relative;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;

  // Default state
  background: var(--card-bg);
  color: var(--color-text-primary);

  // Hover state (8% overlay)
  &:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-primary) 8%, var(--card-bg));
  }

  // Focus state (12% overlay + focus ring)
  &:focus:not(:disabled) {
    outline: none;
    background: color-mix(in srgb, var(--color-primary) 12%, var(--card-bg));
    box-shadow: var(--focus-ring);
  }

  // Active/Pressed state (12% overlay)
  &:active:not(:disabled) {
    background: color-mix(in srgb, var(--color-primary) 12%, var(--card-bg));
  }

  // Disabled state (38% opacity)
  &:disabled {
    opacity: 0.38;
    cursor: not-allowed;
    pointer-events: none;
  }
}
```

### Button States (Complete Pattern)

```scss
.button {
  // Base styles
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease, box-shadow 0.2s ease;

  // Primary button
  &.primary {
    background: var(--color-primary);
    color: var(--color-on-primary);

    &:hover:not(:disabled) {
      background: color-mix(in srgb, #000 8%, var(--color-primary));
      box-shadow: var(--elevation-2);
    }

    &:focus:not(:disabled) {
      box-shadow: var(--focus-ring);
    }

    &:active:not(:disabled) {
      background: color-mix(in srgb, #000 12%, var(--color-primary));
      box-shadow: var(--elevation-1);
    }
  }

  // Secondary button (outlined)
  &.secondary {
    background: transparent;
    color: var(--color-primary);
    border: 2px solid var(--color-primary);

    &:hover:not(:disabled) {
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
    }

    &:active:not(:disabled) {
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    }
  }

  // Disabled state
  &:disabled {
    background: var(--color-border);
    color: var(--color-text-muted);
    cursor: not-allowed;
    box-shadow: none;
  }
}
```

### Input Field States

```scss
input,
select,
textarea {
  // Base styles
  border: 2px solid var(--color-border);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  // Hover state
  &:hover:not(:disabled):not(:focus) {
    border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
  }

  // Focus state
  &:focus:not(:disabled) {
    outline: none;
    border-color: var(--color-primary);
    box-shadow: var(--focus-ring);
  }

  // Error state
  &.invalid,
  &.is-invalid {
    border-color: var(--color-danger);

    &:focus {
      box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.15);
    }
  }

  // Disabled state
  &:disabled {
    background: var(--color-surface-variant);
    border-color: var(--color-border-light);
    color: var(--color-text-muted);
    cursor: not-allowed;
    opacity: 0.6;
  }
}
```

### Transition Standards

```scss
// Standard timing functions
:root {
  --duration-short: 100ms;    // Quick actions (press)
  --duration-medium: 200ms;   // Standard transitions (hover)
  --duration-long: 300ms;     // Complex animations (panel slide)
  --duration-xl: 400ms;       // Page transitions

  --easing-standard: cubic-bezier(0.4, 0.0, 0.2, 1);      // Default
  --easing-decelerate: cubic-bezier(0.0, 0.0, 0.2, 1);   // Enter screen
  --easing-accelerate: cubic-bezier(0.4, 0.0, 1, 1);     // Exit screen
}

// Usage
.element {
  transition: all var(--duration-medium) var(--easing-standard);
}
```

### Accessibility Requirements

1. **Focus Indicators**: Always visible, minimum 3:1 contrast
2. **State Changes**: Communicated to screen readers via ARIA
3. **Touch Targets**: Minimum 48×48px (already covered in Touch Targets section)
4. **Color Independence**: Never rely solely on color to convey state
5. **Keyboard Navigation**: All interactive elements must be keyboard accessible

---

## Do's and Don'ts

### Button & Action Bar Consistency ✓

**Do:**
- ✓ Use **36px visual height** for ALL button types (primary, secondary, action bar, text)
- ✓ Maintain **48px touch targets** via padding (6px top/bottom)
- ✓ Use **flat outlined buttons** in all action bars and toolbars
- ✓ Use **gradient buttons** only for primary CTAs (max 1 per screen)
- ✓ Use **filled tonal buttons** for secondary important actions
- ✓ Use **text buttons** for cancel/dismiss/tertiary actions
- ✓ Use **icon buttons** (48×48px total) for toolbar actions and compact UIs
- ✓ Keep button hierarchy clear: only 1 high-emphasis action visible
- ✓ Use 2-color gradients at 45-135° angles
- ✓ Ensure 4.5:1 text contrast on gradient backgrounds
- ✓ Test gradients on mobile devices
- ✓ Limit action bar to 3 visible actions (use overflow menu)
- ✓ Use icon-only buttons on mobile action bars
- ✓ Maintain consistent spacing: 8-12px gaps between action bar buttons
- ✓ Add proper ARIA labels to icon buttons
- ✓ Use same button size for same action type across entire app

**Don't:**
- ✗ Use gradient buttons in action bars or toolbars
- ✗ Use multiple gradient buttons on the same screen
- ✗ Mix button styles within the same context (all action bar buttons should be flat)
- ✗ Use gradients for disabled states
- ✗ Create gradients with more than 3 colors
- ✗ Use conflicting gradient colors
- ✗ **Use different button heights (48px, 40px, 36px mixed)** — ALL buttons must be 36px visual
- ✗ Create buttons taller than 36px visual height (touch target via padding only)
- ✗ Use text-only buttons for primary actions
- ✗ Place more than 3 actions in mobile action bar without overflow
- ✗ Use different button sizes for the same action type across screens
- ✗ Remove focus indicators from buttons
- ✗ Use gradients on small buttons (<36px height)

### Layout & Spacing ✓

**Do:**
- ✓ Use 8px grid multiples (8, 16, 24, 32, 40, 48px)
- ✓ Use 8px gaps between list items on mobile
- ✓ Keep section padding at 12-16px
- ✓ Use `--spacing-*` CSS variables instead of hardcoded values
- ✓ Apply consistent spacing across similar components
- ✓ Use `gap` property for flex/grid layouts
- ✓ Maintain visual rhythm with consistent spacing

**Don't:**
- ✗ Use arbitrary spacing values (e.g., 13px, 27px)
- ✗ Use gaps larger than 16px on mobile
- ✗ Add excessive padding (>24px) to mobile cards
- ✗ Mix different spacing systems
- ✗ Use negative margins for layout adjustments

### Typography ✓

**Do:**
- ✓ Use Montserrat for all headings (h1-h6)
- ✓ Use Commissioner for all body text, labels, buttons
- ✓ Follow Material Design type scale (Title Large, Body Medium, etc.)
- ✓ Maintain 1.4-1.5× line height ratio (e.g., 14px/20px)
- ✓ Use 14px minimum for body text on mobile (Commissioner)
- ✓ Limit to 3 heading levels per screen
- ✓ Ensure 4.5:1 contrast for body text
- ✓ Use font weights consistently:
  - Montserrat: 700 (bold), 800 (extra-bold for h1 desktop)
  - Commissioner: 400 (regular), 500 (medium), 600 (semi-bold)
- ✓ Test Ukrainian text to verify ії ligature rendering
- ✓ Use variable fonts for optimal performance

**Don't:**
- ✗ Use font sizes smaller than 11px
- ✗ Create more than 4 typography variants per screen
- ✗ Use custom letter-spacing without purpose
- ✗ Mix different font weight scales
- ✗ Use all-caps for long text blocks
- ✗ Use Montserrat for body text (too heavy for reading)
- ✗ Use Commissioner for large headings (lacks impact)
- ✗ Load fonts without `&subset=latin,cyrillic` parameter
- ✗ Use font weights heavier than 800 for Ukrainian text (tight accents)

### Color & Theming ✓

> **CRITICAL**: Color consistency prevents "different colors on different pages" issues.

**Do:**
- ✓ **ALWAYS use CSS custom properties** (`var(--color-primary)`, `var(--card-bg)`)
- ✓ **Use semantic naming** — purpose over appearance (`--color-text-primary` not `--gray-800`)
- ✓ Follow Material Design 3 color roles (Primary, Surface, Error, Success)
- ✓ Follow the **Component Consistency Mapping table** for all components
- ✓ Ensure minimum 3:1 contrast for UI components, 4.5:1 for body text
- ✓ Test designs in both light and dark modes
- ✓ Use `color-mix()` for state overlays (hover: 8%, focus: 12%, active: 12%)
- ✓ Use same button colors across entire application
- ✓ Run `/uicheck` to detect color violations before committing
- ✓ Ask "Does an existing semantic variable cover this?" before creating new colors
- ✓ Document new color tokens with purpose and usage examples

**Don't:**
- ✗ **NEVER hardcode hex colors** (`#333`, `#fff`, `#e1e8ed`) — breaks theming
- ✗ **Use appearance-based names** (`--blue-500`, `--light-gray`) — non-semantic
- ✗ Use different colors for same component type across pages
- ✗ Create component-specific color variables (use semantic system tokens)
- ✗ Use color alone to convey information (combine with icons/text)
- ✗ Create low-contrast interfaces (< 3:1 for UI, < 4.5:1 for text)
- ✗ Use more than 3 brand colors in gradients/combinations
- ✗ Override theme colors with `!important`
- ✗ Skip color consistency checks during code review

### Touch Targets & Accessibility ✓

**Do:**
- ✓ Maintain 48×48px minimum touch targets
- ✓ Add 12px padding around 24px icons
- ✓ Separate touch targets by at least 8px
- ✓ Provide focus indicators (minimum 3px, 3:1 contrast)
- ✓ Use `aria-label` for icon-only buttons
- ✓ Ensure keyboard navigation works

**Don't:**
- ✗ Create touch targets smaller than 44px
- ✗ Place interactive elements too close together (<8px)
- ✗ Remove focus outlines without replacement
- ✗ Use icons without text labels in critical actions
- ✗ Rely on hover states for mobile interfaces

### Visual Style ✓

**Do:**
- ✓ Use 8px border-radius consistently for cards/buttons
- ✓ Prefer subtle borders over heavy shadows (B2B)
- ✓ Use `--elevation-1` or `--elevation-2` for cards
- ✓ Apply smooth transitions (200ms standard)
- ✓ Use state layers for interactive feedback
- ✓ Maintain visual consistency across components

**Don't:**
- ✗ Use heavy drop shadows (> `--elevation-3`)
- ✗ Mix different border-radius values arbitrarily
- ✗ Over-animate interfaces (distracting)
- ✗ Use gradients excessively
- ✗ Create custom shadows instead of using elevation tokens

### Icons ✓

**Do:**
- ✓ Use 24px as default icon size
- ✓ Use consistent icon family (outlined, filled, rounded)
- ✓ Optically center icons, not mathematically
- ✓ Use `currentColor` for icon fills
- ✓ Add 8-12px gap between icon and text
- ✓ Use filled icons for active/selected states

**Don't:**
- ✗ Mix different icon styles in the same interface
- ✗ Use icons smaller than 16px
- ✗ Create custom icons that don't match the system
- ✗ Use icons without clear meaning
- ✗ Place icons inconsistently (sometimes left, sometimes right)

### Forms & Inputs ✓

**Do:**
- ✓ Use standard input padding: 8px (`--spacing-sm`)
- ✓ Use 2px borders for clear boundaries
- ✓ Show clear focus states with border + ring shadow
- ✓ Provide validation feedback immediately
- ✓ Use placeholder text sparingly
- ✓ Group related inputs logically

**Don't:**
- ✗ Use 1px borders (too subtle on mobile)
- ✗ Remove border on focus (reduces clarity)
- ✗ Hide labels in favor of placeholders only
- ✗ Validate on every keystroke (annoying)
- ✗ Use red borders without error messages

---

## Modern CSS Features & Best Practices

### CSS Custom Properties (Variables)

Always use CSS variables for themeable values:

```scss
:root {
  // Spacing scale
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  // Colors (semantic naming)
  --color-primary: #667eea;
  --color-on-primary: #ffffff;
  --color-surface: #ffffff;
  --color-on-surface: #333333;

  // Typography
  --font-size-body-m: 14px;
  --line-height-body-m: 20px;
  --font-weight-regular: 400;
  --font-weight-medium: 500;

  // Elevation
  --elevation-1: 0 1px 2px 0 rgba(0, 0, 0, 0.08);

  // Border radius
  --radius-md: 8px;

  // Transitions
  --duration-short: 100ms;
  --duration-medium: 200ms;
  --easing-standard: cubic-bezier(0.4, 0.0, 0.2, 1);
}
```

### Modern Layout: Flexbox & Grid

```scss
// Flexbox - for one-dimensional layouts
.flex-container {
  display: flex;
  gap: var(--spacing-md);              // Modern gap property
  align-items: center;
  justify-content: space-between;
}

// Grid - for two-dimensional layouts
.grid-container {
  display: grid;
  gap: var(--spacing-md);              // Consistent spacing
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

// Avoid floats and positioning hacks
```

### Color Mixing (Modern State Overlays)

Use `color-mix()` for state layers (supported in modern browsers):

```scss
.button:hover {
  // Mix 8% black into primary color
  background: color-mix(in srgb, #000 8%, var(--color-primary));
}

// Fallback for older browsers
@supports not (background: color-mix(in srgb, #000 8%, white)) {
  .button:hover {
    background: var(--color-primary-dark);
  }
}
```

### Logical Properties (Internationalization)

Use logical properties for better RTL support:

```scss
// ✓ Logical (direction-agnostic)
.element {
  margin-inline-start: 16px;     // Left in LTR, right in RTL
  margin-inline-end: 16px;
  padding-block: 12px;           // Top and bottom
  border-inline-start: 2px solid;
}

// ✗ Physical (direction-specific)
.element {
  margin-left: 16px;             // Always left
  margin-right: 16px;
  padding-top: 12px;
  padding-bottom: 12px;
  border-left: 2px solid;
}
```

### Container Queries (Advanced)

For component-level responsive design:

```scss
.card-container {
  container-type: inline-size;
  container-name: card;
}

.card {
  padding: var(--spacing-sm);

  // Respond to container size, not viewport
  @container card (min-width: 400px) {
    padding: var(--spacing-md);
    display: grid;
    grid-template-columns: auto 1fr;
  }
}
```

### Cascade Layers (Organization)

Manage CSS specificity with `@layer`:

```scss
@layer reset, base, components, utilities;

@layer base {
  h1 { font-size: 22px; }
}

@layer components {
  .button { /* Component styles */ }
}

@layer utilities {
  .text-center { text-align: center; }
}
```

### Modern Units

```scss
// ✓ Use relative units
font-size: 1rem;           // Respects user's browser settings
width: clamp(280px, 90vw, 1200px);  // Fluid sizing with limits
gap: 1rem;                 // Scales with root font size

// ✓ Viewport units
height: 100vh;             // Full viewport height
height: 100dvh;            // Dynamic viewport (accounts for mobile bars)

// ✗ Avoid fixed pixel sizing for everything
width: 320px;              // Doesn't scale
```

### CSS Nesting (Modern SCSS alternative)

Native CSS nesting (supported in modern browsers):

```css
.button {
  padding: 12px 24px;
  background: var(--color-primary);

  &:hover {
    background: var(--color-primary-dark);
  }

  &:disabled {
    opacity: 0.38;
  }

  .icon {
    margin-inline-end: 8px;
  }
}
```

### Performance Best Practices

```scss
// ✓ Use transforms for animations (GPU-accelerated)
.element {
  transition: transform 0.2s ease;
}
.element:hover {
  transform: translateY(-2px);
}

// ✗ Avoid animating layout properties
.element {
  transition: margin 0.2s ease;  // Triggers layout reflow
}
.element:hover {
  margin-top: -2px;
}

// ✓ Use will-change for heavy animations
.animated-element {
  will-change: transform;
  animation: slide-in 0.3s ease;
}

// ✓ Contain layout where possible
.isolated-component {
  contain: layout style paint;
}
```

---

## Implementation Checklist

When creating new mobile layouts:

### Layout & Spacing
- [ ] Use 8dp grid multiples (8, 16, 24, 32, 40, 48px)
- [ ] Container padding: 12-16px horizontal
- [ ] Section/card padding: 12-16px (8px for compact)
- [ ] List gap: 8px between items
- [ ] Use CSS variables for spacing (`--spacing-sm`, `--spacing-md`)
- [ ] Apply `gap` property for flex/grid layouts

### Typography
- [ ] Use Montserrat for all headings (h1-h6)
- [ ] Use Commissioner for all body text, labels, and buttons
- [ ] Follow Material Design type scale (Title Large, Body Medium, Label Small)
- [ ] Body text: 14px minimum (Body Medium, Commissioner)
- [ ] Labels: 12px minimum (Label Medium, Commissioner)
- [ ] Line height: 1.4-1.5× ratio (e.g., 14px/20px)
- [ ] Maximum 3 heading levels per screen
- [ ] Ensure 4.5:1 contrast for body text
- [ ] Test Ukrainian text for proper ії rendering (Commissioner ligature)

### Colors & Theming
- [ ] **NEVER use hardcoded hex colors** (search for `#[0-9a-fA-F]` pattern)
- [ ] **ALWAYS use CSS custom properties** (`var(--color-*)`, `var(--*-bg)`)
- [ ] Use semantic naming (purpose, not appearance: `--color-text-primary` not `--gray-800`)
- [ ] Follow Component Consistency Mapping table for all components
- [ ] Follow Material Design 3 color roles (Primary, Surface, Error, Success)
- [ ] Test in both light and dark modes
- [ ] Ensure minimum 3:1 contrast for UI components, 4.5:1 for body text
- [ ] Use `color-mix()` for interactive states (hover: 8%, focus/active: 12%)
- [ ] Same component type = same colors across entire application
- [ ] Run `/uicheck` before committing to detect color violations

### Touch Targets & Accessibility
- [ ] Touch targets >= 48×48px
- [ ] Icon buttons: 24px icon + 12px padding = 48px total
- [ ] Separate interactive elements by >= 8px
- [ ] Focus indicators visible (3px ring, 3:1 contrast)
- [ ] All buttons keyboard accessible
- [ ] Icon-only buttons have `aria-label`

### Visual Style
- [ ] Border-radius: 8px (`--radius-md`) for buttons, cards, inputs
- [ ] Border-radius: 12px (`--radius-lg`) for bottom sheets, dialogs
- [ ] Use subtle borders instead of heavy shadows (B2B preference)
- [ ] Elevation: `--elevation-1` for cards (if needed)
- [ ] Smooth transitions: 200ms standard (`--duration-medium`)

### Icons
- [ ] Default icon size: 24×24px
- [ ] Consistent icon family (outlined/filled/rounded)
- [ ] Icons use `currentColor` for fills
- [ ] 8-12px gap between icon and text
- [ ] Touch target padding around icons

### Buttons & Actions
- [ ] **ALL buttons use 36px visual height** (no exceptions: primary, secondary, action bar, text)
- [ ] **48px minimum touch targets** maintained via padding (6px top/bottom)
- [ ] Use gradient buttons only for primary CTAs (max 1 per screen)
- [ ] Use flat outlined buttons in all action bars/toolbars
- [ ] Use filled tonal buttons for secondary important actions
- [ ] Use text buttons for cancel/dismiss/tertiary actions
- [ ] Use icon buttons (48×48px total: 24px icon + 12px padding) for toolbar actions
- [ ] Button padding: 6px top/bottom, 16-24px left/right
- [ ] Button font: Commissioner, 500 weight, 14px
- [ ] Gradient: 2 colors, 135° angle, 4.5:1 text contrast
- [ ] Action bar height: 56px with 36px flat buttons
- [ ] Max 3 visible actions in mobile action bar
- [ ] Same button type = same size across entire application
- [ ] Proper ARIA labels on icon buttons
- [ ] No mixing of button heights (48px/40px/36px) across pages

### Forms & Inputs
- [ ] Input padding: 8px (`--spacing-sm`)
- [ ] Border: 2px solid for clarity
- [ ] Focus state: border color + focus ring shadow
- [ ] Invalid state: danger color border
- [ ] Disabled state: 0.6 opacity + muted colors
- [ ] Labels visible (not just placeholders)

### Component States
- [ ] Hover state: 8% overlay (desktop only)
- [ ] Focus state: 12% overlay + focus ring
- [ ] Active/pressed state: 12% overlay
- [ ] Disabled state: 38% opacity
- [ ] State transitions: 200ms ease

### Responsive Design
- [ ] Mobile-first approach
- [ ] Breakpoints: 480px (xs), 768px (md), 1024px (lg)
- [ ] Test on compact (< 600px), medium (600-839px), expanded (≥ 840px)
- [ ] Adjust typography across breakpoints
- [ ] Use window size classes for layout shifts

### Safe Areas & Special Cases
- [ ] Bottom sheets: safe area handling `env(safe-area-inset-bottom)`
- [ ] Collapsible lists for > 5 items
- [ ] "Show more" buttons with count display
- [ ] Proper loading and error states

### Code Quality
- [ ] Use modern CSS features (flexbox, grid, gap)
- [ ] Avoid floats and clearfix hacks
- [ ] Use logical properties for RTL support
- [ ] Proper semantic HTML (headings, buttons, inputs)
- [ ] No inline styles

---

## Quick Reference Card

| Aspect | Specification |
|--------|---------------|
| **Font (Headings)** | Montserrat, 700 weight |
| **Font (Body)** | Commissioner, 400 weight |
| **Font (Buttons/Labels)** | Commissioner, 500 weight |
| **Button (ALL TYPES)** | **36px visual height, 48px touch target** |
| **Button (Primary CTA)** | Gradient, 36px + 6px padding, max 1 per screen |
| **Button (Action Bar)** | Flat outlined, 36px + 6px padding |
| **Button (Secondary)** | Filled tonal, 36px + 6px padding |
| **Button (Tertiary)** | Text only, 36px + 6px padding |
| **Button (Icon)** | 48×48px total (24px icon + 12px padding) |
| **Button Padding** | 6px top/bottom, 16-24px left/right |
| **Gradient** | 2 colors, 135°, `--gradient-primary` |
| **Action Bar Height** | 56px with 36px flat buttons |
| **Colors** | **ALWAYS use semantic CSS variables** (`var(--color-*)`) |
| **Color Rule** | **NEVER hardcode hex colors** (#333, #fff, etc.) |
| **Spacing Base** | 8px grid (4, 8, 16, 24, 32, 40, 48) |
| **Body Text** | 14px / 20px line height (Body Medium) |
| **Touch Target** | 48×48px minimum (enforced through padding) |
| **Border Radius** | 8px (standard), 12px (dialogs) |
| **Icon Size** | 24×24px (default) |
| **Input Padding** | 8px (`--spacing-sm`) |
| **Input Border** | 2px solid |
| **Transition** | 200ms ease |
| **Hover Overlay** | 8% opacity via `color-mix()` |
| **Focus Ring** | 3px, 15% opacity |
| **Disabled Opacity** | 38% (0.38) |
| **Elevation (Cards)** | `--elevation-1` (subtle) |
| **Container Padding** | 12-16px horizontal |

---

*Last updated: January 2026 (Material Design 3)*
