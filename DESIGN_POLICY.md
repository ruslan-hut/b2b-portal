# Comex Frontend — Admin Design Policy

> Canonical reference for the **admin zone** UI system. Frontend pages in `src/app/admin/**` MUST follow this policy. Reference implementations: `admin/users/user-edit` and `admin/profile`.
>
> Companion documents:
> - **Tokens & sizing**: see the *Sizing System* section in `MEMORY.md` (heights, typography, icons, radii). Tokens are defined in `src/styles.scss`.
> - **Color naming**: semantic only (`--color-text-primary`), never appearance (`--gray-800`).

---

## 1. Architectural rules

1. **Shared classes, not per-page prefixes.** New admin pages MUST use the canonical `.adm-*` class set defined in `src/styles/admin/_components.scss`. Do not invent new per-page BEM prefixes (`ue-`, `pf-`, `usr-`, ...). The two existing prefixed implementations (`ue-*` in user-edit, `pf-*` in profile) are the reference; they will be migrated to `.adm-*` and deleted.
2. **No hardcoded sizes, colors, or radii** in component SCSS. Use tokens. If a token is missing, add it to all three theme blocks in `src/styles.scss` (light / dark / system-dark) and document the addition.
3. **Component SCSS for admin pages stays thin.** A typical admin page SCSS should be < 80 lines — only page-specific layout overrides. All structural CSS lives in the shared admin partial.
4. **OnPush change detection** on every admin component. Standalone-style Angular conventions (signals, `inject()`, `input()`/`output()`, `@if`/`@for`) per the global Angular policy.
5. **Shared formatting utilities, never inline formatting.** Money goes through
   `core/utils/money-format`, dates through `core/utils/date-format`. Do not
   write `.toFixed(2)`, `| number`, or a hand-rolled separator in a template.

### 1.1 Money format

**`19 587,50` — no-break space thousands, comma decimal — in every market.**

One convention app-wide, the same way `date-format` fixes `dd.mm.yyyy` rather
than following the UI language. Ukraine and Poland share this format, and it is
also why the Angular `number` pipe is banned for money: with no `LOCALE_ID`
registered it falls back to `en-US` and renders `19,587.50`, whose thousands
separator is the *decimal* separator in both markets — a ten-thousand-fold
misreading on a price a person is checking.

The separator is U+00A0. A total must never wrap between its thousands and its
hundreds.

Two entry points, because the backend emits two families and the call site is
where the difference has to stay visible:

| Function | Input | Fields |
|---|---|---|
| `formatCents(n)` | integer cents | order lines, totals, insurance |
| `formatAmount(n)` | display units | carrier prices and quotes |

Passing an already-converted value to `formatCents` inflates it by 100. When
adding a field, check which family it is in — `entity.Money` is serialised as a
decimal by the backend and belongs to `formatAmount`.

Anything rendering grouped money also carries `font-variant-numeric: tabular-nums`;
grouping only pays off if the digits line up down the column.

### File layout (target state)

```
src/styles/
  _mixins.scss
  admin/
    _index.scss          // @forward all admin partials
    _shell.scss          // .adm-page, .adm-bar, .adm-grid, .adm-side, .adm-main, .adm-section
    _forms.scss          // .adm-input, .adm-field, .adm-pairs, .adm-pwd, .adm-icon-btn, .adm-toggle, .adm-role-grid
    _identity.scss       // .adm-id-card, .adm-record, .adm-avatar, .adm-role-chip, .adm-meta, .adm-danger
    _buttons.scss        // .adm-btn, .adm-btn--primary, --ghost, --danger, --mini
    _alerts.scss         // .adm-error, .adm-success, .adm-warning
```

`src/styles.scss` adds `@use 'styles/admin' as *;` once. Page SCSS files no longer need to import shell/form primitives.

---

## 2. Page shell

Every admin page is a top-level `.adm-page` flex column.

### 2.1 Sticky top bar — `.adm-bar`

```html
<header class="adm-bar">
  <div class="adm-bar__crumbs">
    <button class="adm-crumb-back" (click)="back()">
      <span class="material-icons">arrow_back</span>
    </button>
    <a class="adm-crumb" (click)="back()">{{ 'admin.users.title' | translate }}</a>
    <span class="adm-crumb-sep">/</span>
    <span class="adm-crumb adm-crumb--active">{{ title }}</span>
  </div>
  <div class="adm-bar__actions">
    <button class="adm-btn adm-btn--ghost">Discard</button>
    <button class="adm-btn adm-btn--primary">Save</button>
  </div>
</header>
```

Rules:
- Sticky top:0, `z-index:10`, 1px bottom border in `--color-border`.
- Padding `var(--spacing-sm) var(--spacing-md)`, `min-height: var(--control-h-lg)`.
- Right side is optional (read-only pages omit actions).
- The back-button + breadcrumb trail is optional for **root** admin pages (e.g. list views); detail/edit pages MUST include it.
- For list pages with no breadcrumb, the bar still carries the page title in `.adm-crumb--active`.
- **One bar per page.** Nothing above it, nothing beside it. A page reached from
  Settings owns its whole trail — `← Settings / <page>` — rather than having the
  shell draw half of it; a second row of chrome is a second bar whether or not
  it is styled like one.

#### Tab sets — `.adm-bar__tabs`

A page that switches between sibling views (webhooks, telegram, invoices) puts
its tabs in the crumbs slot, after the trail: the trail says where the page sits
under Settings, the tabs say which of its views is open.

```html
<div class="adm-bar__crumbs">
  <button class="adm-crumb-back" routerLink="/admin/settings">…</button>
  <a class="adm-crumb" routerLink="/admin/settings">Settings</a>
  <span class="adm-crumb-sep">/</span>
  <span class="adm-crumb adm-crumb--active">Telegram</span>
  <nav class="adm-bar__tabs">
    <a class="adm-bar__tab" routerLinkActive="is-active" …>Subscriptions</a>
  </nav>
</div>
```

Tabs are `<a>` when they route and `<button>` when they switch in place; both
take `.adm-bar__tab` and mark the current one with `.is-active`. They sit on the
bar, so their hover and active grounds come from `--adm-bar-control-bg` and
`--color-primary-container` — never `--color-background-secondary`, which is
identical to `--card-bg` in dark.

**The bar is chrome; the cards below it are content.** Its ground is
`--adm-bar-bg` and controls sitting on it take `--adm-bar-control-bg` — never
`--card-bg`, which is the card plane and would erase the edge between the two.
The dark theme is the case that forces this: `--card-bg` and
`--admin-content-bg` are both `#161b22` there, so the bar goes *darker* than the
canvas rather than lighter. Do not substitute `--color-background-secondary`;
it is within 3% of `--card-bg` in light and identical to it in dark.

The `min-height` is load-bearing. It keeps the bar a constant 53px whether or
not the page has a primary action, which is what lets anything sticky beneath it
(`.adm-side`, a sticky `thead`) offset by a known amount.

#### Action hierarchy

A bar of N `--ghost` buttons has no primary, and the operator re-reads the whole
row on every visit. Every bar with actions resolves to:

| Slot | Count | Notes |
|---|---|---|
| `--primary` | 0 or 1 | Chosen by record state, not fixed per page. |
| `--ghost` with label | ≤ 2 | The routine actions. |
| `--ghost --icon` | any | Rare actions and navigation shortcuts. Icon only; `title` **and** `aria-label` required. |
| `.adm-bar__state` | 0 or 1 | Current state, when acting on it is itself an action. |

The primary comes from a getter over the record's state rather than a constant —
on an order it is "create shipment" while the stage allows one and "edit"
otherwise. Return `null` while the state is still loading so the primary appears
once instead of changing identity under the cursor.

State that can be acted on is one control, not a label plus a button. Colour on
`.adm-bar__state` goes in the dot and a 10% tint, never the label: stage colours
are picked by an admin in CRM settings, so a pale one used as text falls under
contrast at any weight.

### 2.2 Two-column grid — `.adm-grid`

```scss
.adm-grid {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: var(--spacing-md-lg);
  padding: var(--spacing-md-lg);
  align-items: start;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
  }
}
```

- Sidebar (280px) on the left, main column on the right.
- Sidebar is `position: sticky`; static under 960px. Its `top` is derived, not
  guessed: bar height (`--control-h-lg` + `--spacing-md` + 1px border) plus the
  grid's own `--spacing-md-lg` top padding.
- For list/table pages with no sidebar, use a single-column variant `.adm-grid--full` (no sidebar; the bar still applies).

**Detail pages use the two-column grid. `--full` is for list pages.** The spine
is not decoration on a page that has a record: it carries identity, what the
record comes to, and its destination — the things you check *while* working the
detail beside them. A totals block belongs there, not right-aligned at the
bottom of a 700-row table where it is furthest from every row it summarises.

Both columns space their children with `gap`. A card inside them must not also
carry `margin-bottom`; the two add rather than replace.

Nothing appears in both columns. Where a summary in the spine would restate a
section in the main column, keep the section and leave the spine out of it — a
duplicated block agrees on the day it is written and drifts on the next field.

### 2.3 Numbered sections — `.adm-section`

```html
<section class="adm-section">
  <header class="adm-section__head">
    <div>
      <h2 class="adm-section__title">Identity</h2>
      <p class="adm-section__sub">Username, email, name</p>
    </div>
  </header>
  <div class="adm-fields">...</div>
</section>
```

Rules:
- Background `var(--card-bg)`, border `1px solid var(--card-border)`, radius `var(--radius-md)`.
- Padding `var(--spacing-md) var(--spacing-md-lg)`.
- `.adm-section--danger` variant uses `border-color: var(--color-danger)`.
- Section headers ALWAYS have a one-line subtitle. If there's nothing useful to say, the section probably doesn't need a header.
- A section that summarises a page living elsewhere links to it from its own
  head with `.adm-section__link` (right-aligned, `arrow-right` icon). It is
  navigation, so it stays a link: the bar owns a page's buttons (§2.1), and a
  "view all" styled as a `--ghost` button competes with the actions up there.

### 2.4 Record header — `.adm-record`

A detail page whose subject is a record (an order, an invoice, a shipment) opens
with its identity, once:

```html
<div class="adm-record">
  <div class="adm-record__head">
    <h2 class="adm-record__id">UA-63</h2>
    <span class="adm-record__status" [ngClass]="getStatusClass(status)">Нове замовлення</span>
  </div>
  <div class="adm-record__id-alt">
    <span>ERP</span>
    <span class="adm-record__id-alt-value">РН-00012345</span>
  </div>
  <div class="adm-record__name">ФОП Корінний Богдан Юрійович</div>
  <div class="adm-record__meta">
    <span>Created …</span><span class="adm-record__sep">·</span><span>Updated …</span>
  </div>
  <div class="adm-record__flags"><!-- exception chips --></div>
</div>
```

Rules:
- `__id` is a real heading (`<h2>`) at `--text-2xl`/700, `tabular-nums`. The
  record's number is the page's name; it is not one cell in a grid of five at
  the same size as its "last updated" timestamp.
- Three weights, three jobs: identity, then the facts that qualify it
  (`--text-md`), then timestamps and counts (`--text-sm`, muted).
- `__id-alt` is for a **second identifier the same record answers to** — an ERP
  document number beside the Comex order number. Its own row directly under
  `__head`, above `__name`: the block then runs identity → second identity →
  qualifying fact → footnotes. Not inside `__head` — at 280px the spine cannot
  fit heading + number + status, and the wrap orphans the status chip so it
  reads as a mistake.
- `__id-alt` adds no fourth weight. It takes the third tier's size, with the
  muted label / primary `__id-alt-value` colour pair doing the separating — at
  tier-3 muted throughout it would be indistinguishable from the timestamps
  under it, and an identifier that reads as a footnote is in the wrong place.
  `__id-alt-value` is monospaced so it is never mistaken for a variant of
  `__id`, and `user-select: all` because the number exists to be read back.
  Prefix it with a short mark (`ERP`). One per record, and only when the second
  number really is an identifier — a reference or a note goes in `__meta`.
- `__status` is neutral by default. A record's status arrives from the ERP as
  free text and only sometimes matches a known keyword, at which point a
  `.status-*` class supplies the colour. Never assume one exists.
- `__flags` is one row for exception chips ("edited in ERP", "manual discount").
  They say the same kind of thing, so they sit together rather than stacking.

### 2.5 No bottom action footer

Page-level actions (Save / Cancel / Discard / Create) live **only** in the sticky `.adm-bar`. Do not duplicate them in a trailing `.adm-footer` — the bar is always visible while scrolling. Per-section save buttons (e.g. profile's "Save notifications") are allowed when a section saves independently of the page.

---

## 3. Form primitives

All under `src/styles/admin/_forms.scss`.

### 3.1 `.adm-fields` grid

Two-column responsive grid for form fields:

```scss
.adm-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md-sm) var(--spacing-md);
  @media (max-width: 600px) { grid-template-columns: 1fr; }
}
```

Use `.adm-field--span2` to make a field span both columns.

### 3.2 `.adm-field`

```html
<label class="adm-field">
  <span class="adm-field__label">Username <em>*</em></span>
  <input class="adm-input" ... />
  <span class="adm-field__uid">{{ form.store_uid }}</span> <!-- optional -->
</label>
```

- Label is uppercase, `--text-xs`, `font-weight: 600`, `letter-spacing: .08em`, color `--color-text-muted`.
- Required marker: `<em>*</em>`, color `--color-danger`, no italic.
- Optional `.adm-field__uid` line for showing the underlying UID under a select.
- Optional `.adm-field__warning` for inline warning text (with material icon).

### 3.3 `.adm-input`

Single height: `var(--control-h-md)` (32 desktop / 40 mobile). Border `1px solid var(--color-border)`, radius `var(--radius-control)`. Focus: border `--color-primary`, box-shadow `var(--focus-ring)`. Modifiers:
- `.adm-input--mono` — monospace + slightly looser letter-spacing (passwords, UIDs).

`select.adm-input` keeps the same height; the custom chevron is rendered via background-image gradient triangles (see reference impl) — do not replace with a native arrow.

### 3.4 `.adm-pwd` — password row

```html
<div class="adm-pwd">
  <input class="adm-input adm-input--mono" [type]="showPassword ? 'text' : 'password'" />
  <button class="adm-icon-btn" (click)="showPassword = !showPassword">...</button>
  <button class="adm-icon-btn" (click)="copy()">...</button>
  <button class="adm-btn adm-btn--mini">Generate</button>
</div>
```

Flex row, gap `6px`, items stretch to input height.

### 3.5 `.adm-icon-btn`

Square `var(--control-h-md)` button. Transparent background, `1px solid var(--color-border)`. Hover: border + color → `--color-primary`. Used for show/hide, copy, inline single-icon actions.

### 3.6 `.adm-toggle`

Switch-style boolean, with label inside the toggle row (not adjacent):

```html
<label class="adm-toggle adm-field--span2">
  <input type="checkbox" [(ngModel)]="...">
  <span class="adm-toggle__track"><span class="adm-toggle__dot"></span></span>
  <span class="adm-toggle__text">
    Receive email notifications
    <span class="adm-toggle__hint">Optional explanation line.</span>
  </span>
</label>
```

Rules:
- Track `32×18`, dot `14×14`, transitions `.2s ease`.
- On state: track background `--color-primary`.
- The whole label is the click surface — do not place separate `<label>` text outside.
- Always pair with a `.adm-toggle__hint` if the toggle's effect isn't obvious from the title alone.
- Use `.is-disabled` for visual dim when `[disabled]` is set.

### 3.7 `.adm-role-grid` / `.adm-role-card`

For mutually-exclusive enum selection (role, status, type). Radios styled as cards with a colored dot. Grid is `repeat(4, 1fr)` desktop, `repeat(2, 1fr)` under 720px. The active card uses the role color (admin → danger, manager → primary, etc.) via `[data-role="..."]`.

---

### 3.8 `.adm-pairs` / `.adm-pair` — read-only label/value

The counterpart to `.adm-field` for data you look at rather than edit.

```html
<div class="adm-pairs">
  <div class="adm-pair adm-pair--span2">
    <span class="adm-pair__label">Name</span>
    <span class="adm-pair__value">Умань, beautybaza, Савранський Денис</span>
  </div>
  <div class="adm-pair">
    <span class="adm-pair__label">VAT number</span>
    <span class="adm-pair__value adm-pair__value--muted">—</span>
  </div>
</div>
```

- Label above at `--text-xs` uppercase muted; value below at `--text-md`.
- **Inline `<strong>Label:</strong> value` is banned.** Bolding the label puts
  the weight on the part the reader already knows, and starting every value at a
  different x makes a column of them impossible to scan down.
- `--span2` for long values (an address, a full company name).
- `--muted` on an absent value, so "—" does not read with the weight of data.
- Inside `.adm-side` the grid is single-column and `--span2` resets; the spine is
  280px at every viewport.

Column counts are explicit at every breakpoint (4 / 3 / 2 / 1). **Uncapped
`repeat(auto-fit, minmax(X, 1fr))` is banned in the admin**: on a 1900px canvas
it resolves to six ragged columns and stretches a two-character value across
300px. Cap the count or the max width.

## 4. Buttons

Single class hierarchy. **Do not** introduce new button classes for one-off pages.

| Class | Use |
|---|---|
| `.adm-btn` | Base — height `--control-h-md`, transparent. |
| `.adm-btn--primary` | Main save/confirm action. Height bumps to `--control-h-lg`. Filled `--color-primary`. |
| `.adm-btn--ghost` | Secondary action (Discard, Cancel). Border `--color-border`. |
| `.adm-btn--danger` | Destructive. Outline `--color-danger`, fills on hover. |
| `.adm-btn--mini` | Compact inline action (e.g. "Generate" inside password row). Height `--control-h-sm`. |

Disabled state: `opacity: .55`. Active press: `transform: translateY(1px)`.

Icon inside button: `<app-icon name="…" size="sm">` first, then text (§11).

---

## 5. Identity blocks (sidebar)

Under `src/styles/admin/_identity.scss`, which also holds `.adm-record` (§2.4) —
the in-page counterpart for a page whose subject is a record, not a person.

### 5.1 `.adm-id-card`

Centered identity block at the top of the sidebar:

```html
<div class="adm-id-card">
  <div class="adm-avatar" [attr.data-role]="user.role">{{ initials() }}</div>
  <div class="adm-id-name">{{ displayName }}</div>
  <div class="adm-id-username">@{{ username }}</div>
  <div class="adm-id-role">
    <span class="adm-role-chip" [attr.data-role]="user.role">{{ user.role }}</span>
  </div>
</div>
```

- **Avatar**: 72×72 circle, 24px bold initials. Background color follows `[data-role]`. Dashed `1px` ring at `inset:-4px`.
- **Initials helper** must live on the component (`initials()` returning up to 2 chars from first/last name, falling back to username slice).
- `.adm-id-username` is monospace, muted, `@`-prefixed.
- `.adm-role-chip` is a pill in the role's color with uppercase letter-spaced text.

### 5.2 `.adm-meta` — info table

```html
<div class="adm-meta">
  <div class="adm-meta__title">Activity</div>
  <div class="adm-meta__row">
    <span class="adm-meta__label">Last login</span>
    <span class="adm-meta__value">{{ formatDate(...) }}</span>
  </div>
  <div class="adm-meta__row adm-meta__row--mono">
    <span class="adm-meta__label">UID</span>
    <span class="adm-meta__value adm-uid">{{ uid }}</span>
  </div>
</div>
```

- Title is uppercase, letter-spaced, muted.
- Rows are separated by a 1px dashed top border (not the first row).
- `--mono` rows right-align a monospace value and use `--text-xs`.

### 5.3 `.adm-danger` — danger zone

```html
<div class="adm-danger">
  <div class="adm-danger__title">Danger zone</div>
  <p class="adm-danger__hint">Removing this user is permanent.</p>
  <button class="adm-btn adm-btn--danger">
    <span class="material-icons">delete_outline</span> Delete user
  </button>
</div>
```

Card with `border: 1px solid var(--color-danger)`. Always pairs a danger button with a one-line hint explaining the consequence.

---

## 6. Alerts

```html
<div class="adm-error" role="alert">{{ error }}</div>
<div class="adm-success">Saved.</div>
<div class="adm-warning">Read-only.</div>
```

- Left 3px accent border in the semantic color.
- Background uses the matching `--*-bg` token. If a status background token is missing for the theme, add it (see existing `--status-success-bg`, `--status-error-bg`, `--status-warning-bg`).
- Always `role="alert"` on errors.

---

## 7. Hard rules (do / don't)

**DO**
- Use shared `.adm-*` classes for all new admin pages.
- Reuse the page shell exactly: sticky bar → 280px sidebar grid → numbered sections.
- Reach into `var(--control-h-*)`, `var(--text-*)`, `var(--radius-*)`, `var(--spacing-*)` tokens for every measurement.
- Add missing tokens to all three theme blocks at once.

**DON'T**
- Don't introduce new BEM prefixes for admin pages.
- Don't hardcode heights, font sizes, hex colors, or radii. **The colour half of
  this is now enforced** — `npm run check:theme` fails the build on a hex,
  `rgb()`/`rgba()` or colour keyword in a component stylesheet (§12).
- Don't write `var(--token, #fallback)`. A colour fallback is a colour no theme
  can reach, and it becomes what actually renders the day the token is renamed —
  which had already happened at seven call sites (§12).
- Don't write `<strong>Label:</strong> value` for read-only data — use `.adm-pair` (§3.8).
- Don't leave `repeat(auto-fit, minmax(X, 1fr))` uncapped (§3.8).
- Don't ship a bar of equal `--ghost` buttons with no primary (§2.1).
- Don't draw a breadcrumb, title or tab row outside the bar — one bar per page (§2.1).
- Don't give the bar `--card-bg`, and don't put a page's identity in a grid cell (§2.1, §2.4).
- Don't print a column whose value is the same on every row (§9.1).
- Don't use a user-configurable colour (a CRM stage) as text — dot or tint it (§2.1).
- Don't format money with `.toFixed(2)` or `| number` — use `money-format` (§1.1).
- Don't call `toLocaleString()` on a number, with or without `style: 'currency'`. With no `LOCALE_ID` registered it resolves to en-US and prints `3,455,520.44` (§1.1); counts go through `formatCount`.
- Don't build a UI string in a component with an English literal — a `days` / `ago` / `< 1 day` suffix is a translation key like any other.
- Don't use an emoji, a Unicode glyph or a `.material-icons` ligature as an icon in new code — `<app-icon>` only (§11).
- Don't give a set of tiles one accent colour each. Colour marks the one that needs acting on; the rest are neutral.
- Don't add mobile media-queries to override button/input heights — the token layer handles that.
- Don't put logout, navigation, or other non-destructive actions in the danger zone.
- Don't number sections out of DOM order (e.g. don't use `04` for the visually-first section).
- Don't replace `<select>` chevrons with native arrows — keep the custom gradient triangles for consistency.

---

## 8. Migration checklist (per page)

Run this for each admin page being converted. Tick items as you go; reviewers will ask for the checklist on the PR.

**Inventory**
- [ ] Identify the page-local BEM prefix (e.g. `.user-list__*`) and list every selector.
- [ ] Note any hardcoded sizes / hex colors / radii that need to migrate to tokens.
- [ ] Note any one-off components that don't map to `.adm-*` and need either (a) generalization into the shared partial or (b) a justified page-local exception.

**Shell**
- [ ] Wrap the page in `.adm-page`.
- [ ] Replace the page's top header with `.adm-bar` (breadcrumb left, actions right).
- [ ] Wrap content in `.adm-grid` (or `.adm-grid--full` for list pages).
- [ ] Convert sidebar to `.adm-side` with sticky positioning.

**Sections**
- [ ] Convert each card/panel into `.adm-section` with `__head`, `__title`, `__sub`.

**Forms**
- [ ] Replace all custom inputs with `.adm-input`.
- [ ] Wrap inputs in `.adm-field` with uppercase `.adm-field__label`.
- [ ] Lay out fields with `.adm-fields` grid; mark full-width as `.adm-field--span2`.
- [ ] Replace checkboxes used as preference toggles with `.adm-toggle`.
- [ ] Replace inline password fields with `.adm-pwd` (input + icon-btn + mini button).
- [ ] Replace radio groups for enums with `.adm-role-grid` / `.adm-role-card`.

**Buttons**
- [ ] Replace every button class with `.adm-btn` + variant (`--primary`, `--ghost`, `--danger`, `--mini`).
- [ ] Confirm primary save/confirm action is `--primary`, cancel is `--ghost`.
- [ ] Remove any custom `.btn-*` styles that overlapped.

**Identity & meta** (detail pages only)
- [ ] Sidebar opens with `.adm-id-card` (avatar + name + username + role chip).
- [ ] Implement `initials()` on the component.
- [ ] Add `.adm-meta` for read-only activity / IDs.
- [ ] If destructive actions exist, place them in `.adm-danger` with a one-line hint.

**Alerts**
- [ ] Convert error/success/warning banners to `.adm-error` / `.adm-success` / `.adm-warning`.
- [ ] Add `role="alert"` on errors.

**Cleanup**
- [ ] Page SCSS contains only page-specific layout (target < 80 lines).
- [ ] No hex colors, no hardcoded heights/font sizes/radii in the page SCSS.
- [ ] Run `npm run build:prod`; verify no new SCSS-size budget warnings on this file.
- [ ] Visually verify both light and dark themes.
- [ ] Verify keyboard focus ring is visible on every interactive element.

**Done when**
- [ ] Page renders identically (functionally) to before migration.
- [ ] Page matches `admin/users/user-edit` and `admin/profile` visual language.
- [ ] No `ue-*` / `pf-*` / page-local prefix remains in the file.

---

## 9. Content section (`admin/content/**`)

The rest of the admin is a **ledger**: rows of ERP-owned records you inspect and correct. The Partner Resources is the one place a person **authors** something a customer will read. That difference earns the extensions below — and nothing else. Everything not listed here follows §1–§7 unchanged.

Reference implementation: `admin/content/page-edit`.

### 9.1 `.data-table` is shared

`src/styles/admin/_tables.scss` now owns `.data-table`, `.actions-col` and the `.desktop-only` / `.mobile-only` switch.

- **New admin pages must not paste a local `.data-table` copy.** Ten pre-existing components still carry one; they win by Angular's emulated-encapsulation specificity and are unaffected. Delete them opportunistically when touching those files.
- A table inside a section card uses `.adm-section .adm-section--table` (padding 0, overflow hidden) so the card draws the border and the table runs edge to edge.
- Row action buttons sit at `opacity: .55` and come up on row hover / focus. Forty rows must not read as eighty buttons. Restored to full opacity under `@media (hover: none)`.

**Numeric columns** are right-aligned with `font-variant-numeric: tabular-nums`.
Money and counts are compared down a column, so they must share a decimal
position. An index column (line number) is narrow, right-aligned and muted — it
is a label, not a measurement.

**`thead` sticks past ~15 rows**, offset by the bar's height (§2.1). The
background moves onto the `th` cells, because a sticky `thead` does not paint
its own.

**A column whose value is identical on every row moves to the section subhead.**
It is dropped from the grid, never from the page: on a 0% VAT order the net and
gross price columns held the same number 65 times, and one shared discount rate
held 35% 65 times — three columns of noise crowding the two being read. State
them once above the table instead ("VAT 0% · Discount 35% on all items").

Derive the column set from the rows, not from the market or a config flag —
compare `price_with_vat` against `price` per item rather than trusting an
optional order-level `vat_rate`, which would also flatten a mixed-rate order.
Keep header wording identical whether or not a column renders: an operator with
two markets open should not have to re-read the headers. And keep a
`columnCount` getter in step with the conditions so `colspan` stays honest.

### 9.2 Colour has four jobs and no more

| Token | Means |
|---|---|
| `--color-primary` | your action, committed — Save, Publish, the active language |
| `--assist` (= `--color-secondary`) | **produced by the assistant, not yet checked by a person** — Translate, Import, the proposal dialog |
| `--color-success` | live / published |
| muted + dashed borders | draft, empty, absent translation |

`--assist` is deliberately the same purple `_identity.scss` already assigns to the `content_editor` role. Do not spend it on anything a human wrote. Its companions are `--assist-soft` (panel bands) and `--assist-ink` (text on those bands). All three are defined in every theme block.

### 9.3 Content tokens

Added to all three theme blocks: `--color-border-subtle` (hairline inside a card, one step lighter than `--color-border`), `--content-canvas` (the tray a block stack sits on), `--assist` / `--assist-soft` / `--assist-ink`. Added to base `:root`: `--text-prose` / `--leading-prose` (reading size for authored text) and `--z-modal`.

### 9.4 Editor shell

`page-edit` uses the **two-column `.adm-grid`** from §2.2 — this is what the 280px sidebar is for on a page with no identity card:

- **Sidebar** = the page's spine, read-only except the language switch: publish state, the translation rail, the block outline.
- **Main** = Page → Audience → Content.
- Nothing appears in both columns. The audience summary lives on the Audience section's own `__sub`; it is not repeated in the sidebar.
- Over 960px the sidebar is capped at `calc(100vh - …)` and scrolls internally, so a long outline cannot push the sticky column past the fold.

### 9.5 The translation rail

The signature control. One row per translated language, each carrying **how much of the page exists in it** (`filled/total` plus a 3px meter), because in a multi-market hub the expensive failure is a page live in Polish and silently blank in Ukrainian.

- Counted generically from `blockCarriesText()` + a non-empty payload, never from a per-type field inventory that would drift.
- Rows are in **registry order**, so the rail does not reshuffle as languages are added.
- "Copy from" and "Translate from" sit under the rail, not in the form: they answer the same question the rail asks — how does this language get its text.
- The page-tree list shows the same idea in one line: **every** registry language as a chip, absent ones dashed and muted. Listing only the translations that exist answers the cheap question.

### 9.6 Authored fields show their own effect

Where a control's whole job is to change how text will publish, the input renders at the published treatment: the page title in `--font-heading` at `--text-lg`; a heading block at H2/H3 size driven by its level select; a callout tinted on its left border by its tone. Text areas holding prose use `--text-prose` / `--leading-prose`, not control size.

### 9.7 Select actions

A native `<select>` cannot hold an icon, so `.pe-select` positions one over it and pads the control. Use it instead of prefixing the first `<option>` with a glyph — `⧉` and `✨` were the admin's only two non-Material icons and are gone.

### 9.8 Icons, not emoji

No emoji in UI copy or option labels, in any language file. Icons follow §11.

### 9.9 The text block is a formatting surface, not a markup box

`shared/components/rich-text` (`<app-rich-text>`) is the editor for the `text`
block: a contenteditable surface with bold / italic / underline, H2 / H3, bullet
and numbered lists, link, clear formatting, and an HTML source toggle. It is a
`ControlValueAccessor`, so it binds with `[(ngModel)]` like any input.

- **No editor library.** The vocabulary it may produce is fixed by
  `backend/internal/lib/htmlsafe`; a library's own schema would be one more
  thing to map back down, and a narrower one would drop tags the Notion import
  already produces.
- **`styleWithCSS` stays off** and pasted markup is sanitised at the paste, by
  `core/utils/html-sanitize` — the client mirror of that allowlist. Both exist
  for the same reason: the server strips `style` and unknown tags on save, and
  formatting that survives the editor but not the save is work an editor watches
  disappear. **A tag added to `allowedTags` goes into the mirror in the same
  change** (and into `.pp-text`, per §10.4).
- **The source toggle stays.** Imported pages arrive as markup that sometimes
  needs correcting by hand; hiding the HTML is what turns that into a support
  request.
- The surface restates its own edits as a bubbling `input` event, because
  `page-edit` tracks unsaved work with one host listener rather than a binding
  per field (§ the `onFieldEdit` listener) and a toolbar click must not slip
  past the guard.
- Per §9.6 the surface renders authored text at `--text-prose` with the block
  rules `.pp-text` uses — at admin scale, not `--read-*`.

---

## 10. Partner Resources (client-facing — `app/partners/**`)

The admin zone is operated; the Partner Resources is **read**. It is the only surface in this app where a customer sits with the text — safety data sheets, storage rules, conformity notes — and it is regularly printed and filed. §1–§9 govern the admin; this section governs the client side, and the two must not borrow from each other.

### 10.1 One renderer, two hosts

`shared/components/content-article` renders the whole article — title, summary, every block type, the document row, child cards. **The partner route and the admin editor's preview both use it, and neither may grow its own copy.** A second implementation would agree on the day it was written and drift on the next block type, which is the one failure a preview exists to prevent.

It is presentational: no fetching, no routing, no publication state. What varies arrives as inputs.

- `language` — empty means the blocks carry a server-resolved `payload` (the partner route). The editor passes the language it is editing and the component reads `payloads[]` instead, which is what lets a preview show text that has never been saved.
- `linksActive` — off in the preview. Following a link card out of the editor would discard unsaved work. Downloads stay live either way; checking that a row points at the right PDF is a reason to open the preview.
- The page shell — sidebar, breadcrumbs, staff bar — stays with the partner route, which is the only thing that has one.

**The article is a container** (`container-type: inline-size`), and its responsive rules are `@container`, not `@media`. On the partner route the two agree; in the editor's phone preview they do not, and a 390px preview showing the desktop layout is showing something no partner will ever see. The breakpoint is 480px, measured against the article, because the column is only ~680px wide even at full desktop size.

### 10.2 Preview states what it is

The preview renders **unsaved, in-memory** state, which is the point — but an editor who assumed otherwise would publish on the strength of it. A strip above the content therefore always states publication status, the language being previewed, the audience, and that unsaved changes are included. The canvas sits on the partner background (`--color-background`), not `--card-bg`: link cards are white with a transparent border in the light theme and disappear against a white canvas, and a preview that hides a block is worse than no preview.

### 10.3 Reading scale, not control scale

The admin scale exists to typeset tables and forms and tops out at 20px. Applied to an article it produced a 20px title over 14px body — a form with a heading. The Hub uses a separate reading scale, defined in base `:root`:

| Token | Value | Use |
|---|---|---|
| `--read-h1` | 30px | article / hub title |
| `--read-h2` | 21px | section heading |
| `--read-h3` | 17px | sub-heading, card title |
| `--read-body` | 16px | body text |
| `--read-small` | 13px | captions, metadata, table cells |
| `--read-lead` | 1.7 | body line-height |

**Admin pages must not use `--read-*`, and Hub article text must not use `--text-*`.** Measure is `68ch`. Headings drop ~6px under 900px.

### 10.4 Authored HTML must cover the whole allowlist

`.pp-text` renders `[innerHTML]` sanitised by `backend/internal/lib/htmlsafe`. That allowlist admits **tables, blockquote, pre/code, h1–h6, dl/dt/dd, img, sub/sup, abbr, del/ins** — and the Notion import path produces tables and blockquotes routinely. Because the global reset zeroes every margin and padding, an unstyled allowlisted tag renders genuinely broken, not merely plain (a table collapses to borderless run-on text).

**Rule: when a tag is added to `allowedTags`, it gets a rule in `.pp-text` in the same change.** Tables scroll inside their own `overflow-x` rather than squeezing the column.

### 10.5 Callout tones must be four distinguishable things

`--color-warning` is `#ff6b6b` — a red — so `warn` and `danger` rendered as the same colour and two of the editor's four tones were indistinguishable. On regulatory content that is a correctness problem, not a taste one. `warn` uses the amber `--color-alert-warning-*` tokens; `danger` keeps `--color-danger`.

### 10.6 The document row

The Hub's signature element and the reason a partner opened the page. Line one is identity (name + language/market chips), line two is provenance (revision date, size, current/superseded). Rules:

- The row is a hover target; downloading is a **labelled** control, not a bare icon.
- A superseded row **recedes but is never hidden** — a partner holding the old document has to discover it was replaced. It loses the download and gains a link to the current version.
- Dates and sizes are `tabular-nums`; documents are scanned by date.

### 10.7 Quality floor

- Every interactive element carries `:focus-visible` with `var(--focus-ring)`. This is the customer-facing surface; hover-only is not sufficient.
- **Print styles are required.** An SDS is printed and filed: drop navigation, staff bar and hub chrome, avoid breaking inside callouts and document rows, and spell out link targets with `content: ' (' attr(href) ')'`.
- Both themes verified; `prefers-reduced-motion` respected.

---

## 11. Icons — SVG only, everywhere

**Every icon in this project is inline SVG rendered by `<app-icon>`. Nothing
else is an icon: not an icon font, not a Unicode glyph, not an emoji.** This
governs the admin, the client catalogue and the Partner Resources alike — it is
the one rule in this document that is not zone-specific.

```html
<app-icon name="package"></app-icon>
<app-icon name="overdue" size="lg" [label]="'admin.crm.overdueTasks' | translate"></app-icon>
```

`shared/components/icon/` holds the component; `icons.ts` holds the geometry.
`SharedModule` exports it, so any feature module that already imports
`SharedModule` has it.

**The keys are the Material Icons names** (`filter_list`, `local_shipping`),
kept through the migration on purpose: icon names in this product are *data* —
a content page's `icon` column, a chat platform's `icon`, the editor's icon
picker. Renaming them would have been a data migration for a cosmetic gain,
and would have left every stored value pointing at nothing. A new icon with no
Material counterpart is named for what it means here.

### 11.1 Why not the three things it replaces

| Was | Fails because |
|---|---|
| Material Icons ligature font | Loaded from a Google Fonts CDN — a third-party request on every page, and until it lands the button renders the literal string `filter_list`. It cannot be recoloured per path, cannot be part of an offline build, and one missing name silently prints its own name in the UI. |
| Emoji (📦 💰 📝) | Rendered by the OS, so the same tile is a flat Noto glyph on Windows, a glossy Apple one on macOS, and something else on Android. They ignore `color`, so they cannot take a theme token, cannot go muted, and cannot go `--color-danger` with the row they sit in. They also read as decoration in an operations tool. |
| Text glyphs (`✓` `✕` `★` `⇄` `→`) | They are text: they inherit the body font, so weight and size drift per family, they baseline-align rather than centre, and a screen reader announces them. |

### 11.2 Rules

- **`size` comes from the token scale** — `sm` / `md` / `lg` / `xl` map to
  `--icon-sm` … `--icon-xl`. Never set an icon's width in px at the call site.
- **Sizing travels as `font-size`; the svg is `1em` square.** That is what let
  ~580 call sites swap in place: every existing `.some-icon { font-size: 20px }`
  rule still sizes its icon. A page needing a size off the scale sets
  `font-size` on the element, as before — not `width`.
- **Colour is inherited.** The svg draws in `currentColor`, so an icon in a
  `--alert` row goes danger with the row. Do not give an icon its own colour
  rule unless it is the only thing carrying the meaning.
- **Decorative by default.** No `label` → `aria-hidden`, because the text next
  to it already says the word. `label` is for an icon-only control, and then
  the button still needs its own `title` **and** `aria-label` (§2.1).
- **Add to the registry, not to the template.** A one-off inline `<svg>` in a
  component template is the same drift the font had. New entries: 24×24
  viewBox, geometry inset to a 20×20 live area, stroked (the component owns
  width, caps and joins), named for what it means here — `overdue`, not
  `triangle`.
- **An unknown name renders nothing.** A typo leaves a visible gap rather than
  a plausible-looking wrong glyph.
- **Arrows in links are icons too.** `&rarr;` in a "view all" link is a text
  glyph; use `<app-icon name="arrow-right" size="sm">` (see `.adm-section__link`).

### 11.3 The one exception

`.adm-uid::after` — the copy affordance on a UID row — is a pseudo-element and
cannot host a component. It carries the same `content_copy` geometry as a
`mask` (`--icon-copy` in base `:root`) with `background-color: currentColor`,
so it still follows the row's colour. **A mask is the only sanctioned
alternative, and only where a real element is impossible.** A `background-image`
would not take `currentColor` and would need a second copy per theme.

### 11.4 The brand mark

The installation's mark is `brand_mark` in the same registry, so the header logo
is inline SVG on `currentColor` and takes `--color-primary` from whichever brand
is built — a raster `<img>` could only ever match one installation.

Its geometry is **generated, not hand-written**. The mark is a ring plus three
blades, described as annular sectors in `scripts/brand-mark.js`; `npm run
gen:brand` walks that one table into the registry path data, `src/assets/branding/logo.svg`,
and every favicon, apple-touch and manifest raster. Change the mark by editing
the sector table and re-running the script — never by editing a path or an
exported PNG, which would leave the fifteen files disagreeing with each other.

The header renders it at `--color-primary-light`, not `--color-primary`: primary
is the flat brand colour the buttons and the active nav item carry, and at logo
weight it sits heavier than the header wants.

**Optical sizing.** A gap is an angle, so it vanishes in absolute terms as the
mark shrinks — at 16px the design's 8 degrees is under a pixel of arc and the
blades smear into the C. `gapFor()` therefore opens the gaps below roughly 48px
until they are worth ~2.2px of arc, narrowing the blades to match. The
silhouette never moves, so it is one mark, not two.

**The favicon is two files on purpose.** `assets/favicon/favicon.svg` is
declared first in `index.html`: it is resolution-independent and carries its own
`prefers-color-scheme` rule, so the mark on Chrome's dark tab strip flips to its
light ink instead of becoming a hole. That is what modern browsers use. The `.ico`
and the PNG icons are the fallback and cannot flip, so they carry a baked white
halo instead — invisible on a light strip, legible on a dark one. Below 24px
even that halo is a third of the band's width and closes the gaps it was meant
to open, so the small `.ico` entries go without it and lean on the SVG.

Apart from the SVG favicon, the rasters cannot follow the theme (a favicon is a
file, not a stylesheet); they are baked in the ink colour at the top of
`scripts/gen-brand-assets.js`. Only the in-app mark is themed.

**The untheme-able ink is 60% grey, not black.** `INK` is `#666` and `INK_DARK`
is its mirror `#999`, and between them they cover every place the mark is drawn
without `currentColor`: the SVG favicon's own stylesheet, the `.ico`, the
apple-touch and manifest rasters, and `branding/logo.png`. Black sat as a hard
dot against the browser's own chrome; 60% is the lightest tone that still holds
the three blades apart at 16px, which is the floor the value was chosen against.
Change it in one place and re-run `npm run gen:brand`.

### 11.5 Migration status: done

The sweep landed in one change: 584 elements across 80 templates, 57 stylesheets
retargeted from `.material-icons` to `app-icon`, and the webfont removed —

- the `<link href="…fonts.googleapis.com/icon?family=Material+Icons">` is out of
  `src/index.html`; the app makes no font request to Google at all for icons,
- the `.material-icons` block is out of `src/styles.scss`.

There is no ligature fallback left to lean on. An icon that renders as a blank
gap means a name that is not in the registry — add the geometry, don't
reintroduce the font.

---

## 12. Theming — colour comes from tokens, and only from tokens

The portal ships to several installations (PL, UA, standalone) and each is meant
to be able to carry its own brand. That only works if no colour in the app is
written anywhere but the palette. See
`docs/development/theming-contract.md` for the full contract; this section is
the part a component author needs.

### 12.1 Where colour lives

`src/styles/_themes.scss` holds two mixins — `light-palette` and `dark-palette`,
211 tokens each — included by `styles.scss` at three selectors
(`:root, [data-theme="light"]`, `[data-theme="dark"]`, and the media-gated
`[data-theme="system"]`, which shares the dark palette rather than repeating it).

Everything that is not a colour — spacing, type scale, radii, control heights,
motion, z-index, fonts — stays in the base `:root` block in `styles.scss`. It is
shared by every scheme **and** every installation, and is not themable.

### 12.2 The seed rule

Each palette opens with the brand hues as literals. Nothing below the seed may
restate a hue. A tint, glow or shade of the brand derives:

```scss
/* yes */  --focus-ring-color: color-mix(in srgb, var(--color-primary) 25%, transparent);
/* no  */  --focus-ring-color: rgba(102, 126, 234, 0.25);
```

`--color-primary-rgb` and the other `-rgb` channel triplets no longer exist —
they were a second transcription of every hue. Use `color-mix` instead of
`rgba(var(--x-rgb), α)`; it is byte-equivalent in sRGB.

### 12.3 The installation brand

An installation's palette is a file — `src/brand/_<name>.scss` — with two mixins,
`light-overrides` and `dark-overrides`. `styles.scss` includes them right after
the stock palettes at each of the three selectors, so a brand wins on source
order and never needs higher specificity. It overrides tokens; it does not
restate a palette, and anything it leaves out keeps its stock value.

`src/brand/_active.scss` is a one-line `@forward` that `scripts/set-env.js`
rewrites from the `THEME` environment variable — SCSS cannot read one, so the
selection has to become a file. It is committed pointing at `stock`, so
`ng build` and `ng serve` need no setup. A `THEME` with no matching file aborts
the build rather than shipping the stock palette by accident.

What a brand may set is §3 of `docs/development/theming-contract.md`, and it is
narrower than "any token": the seed, the neutral ground, admin chrome, the table
header and the two font families. Semantic colour, the badge sets and user-data
colour are fixed — green means live in every installation.

Read `src/brand/_example.scss` before writing one. It answers the question the
token list does not: swapping the seed is not enough, because the stock neutrals
carry an indigo tint, the admin chrome is an unrelated palette, and a few tokens
hold a hue no derivation reaches.

### 12.4 What the check enforces

`npm run check:theme` (CI: `.github/workflows/frontend-checks.yml`) runs six
checks and fails the build on any of them:

1. no colour literal in a component stylesheet,
2. no colour fallback inside `var()`,
3. every `var(--token)` resolves to something defined — the first run found 62
   references to names nothing defined, whose declarations were being dropped,
4. the light and dark palettes define the same token names,
5. every foreground/background pair clears 4.5:1, with 16 pre-existing failures
   frozen at their measured ratio so they can improve but never regress,
6. every brand file resolves to real tokens, stays inside §3, and clears
   contrast with its own palette applied.

Check 5 is the one to read before choosing a colour: it discovers pairs by
naming convention, so **adding `--x-bg` without `--x-text` opts you out of the
contrast floor**. Add both.

Check 6 does not grandfather. The baseline covers stock debt; the moment a brand
sets either token of a pair, that pair must clear 4.5:1 outright.

### 12.5 Colour from TypeScript

Bind a `var()` reference, not a resolved colour — it goes straight into a style
attribute and resolves against the live theme:

```ts
/* yes */  case 'high': return 'var(--priority-high-color)';
/* no  */  case 'high': return '#ef4444';
```

`readToken()` (`core/utils/theme-token.ts`) exists only for third-party APIs that
demand a resolved string — ReDoc's theme object, `<meta name="theme-color">`. It
reads once and does not follow a theme change. Using it anywhere else is a bug.
