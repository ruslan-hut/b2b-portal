# Mobile List Page Pattern

Pattern for admin list pages (Clients, Orders, Products, etc.) with mobile-optimized card layout.

## Overview

- **Desktop**: Traditional table layout
- **Mobile (<=768px)**: Card-based layout with collapsible filters

## TypeScript Requirements

Add these properties and methods to the component:

```typescript
// Mobile UI state
isFiltersExpanded = false;
expandedCardIds: Set<string> = new Set();

// Mobile UI methods
toggleFilters(): void {
  this.isFiltersExpanded = !this.isFiltersExpanded;
}

toggleCardExpanded(id: string): void {
  if (this.expandedCardIds.has(id)) {
    this.expandedCardIds.delete(id);
  } else {
    this.expandedCardIds.add(id);
  }
}

isCardExpanded(id: string): boolean {
  return this.expandedCardIds.has(id);
}
```

## HTML Structure

### Header (compact with inline add button)

```html
<div class="header">
  <h1>Page Title</h1>
  <button class="btn-add" (click)="createItem()">
    <span class="material-icons">add</span>
    <span class="btn-text">Add</span>
  </button>
</div>
```

### Collapsible Filters

```html
<!-- Mobile Filter Toggle -->
<button class="filter-toggle" (click)="toggleFilters()">
  <span class="material-icons">filter_list</span>
  <span>Filters</span>
  <span class="material-icons toggle-icon" [class.expanded]="isFiltersExpanded">
    expand_more
  </span>
</button>

<div class="filters" [class.expanded]="isFiltersExpanded">
  <!-- Filter controls here -->
</div>
```

### Desktop Table + Mobile Cards

```html
<!-- Desktop Table View -->
<div class="data-table desktop-only">
  <table>
    <!-- Table content -->
  </table>
</div>

<!-- Mobile Card View -->
<div class="data-cards mobile-only">
  @for (item of items; track item) {
    <div class="item-card" [class.expanded]="isCardExpanded(item.uid)" (click)="toggleCardExpanded(item.uid)">

      <!-- Card Header: Primary info (name, status) -->
      <div class="card-header">
        <div class="card-title">
          <span class="item-name">{{ item.name }}</span>
          <span class="status-badge" [class.active]="item.active">
            {{ item.active ? 'Active' : 'Inactive' }}
          </span>
        </div>
        <div class="card-subtitle">{{ item.secondaryInfo }}</div>
      </div>

      <!-- Card Summary: Key metrics always visible -->
      <div class="card-summary">
        <div class="summary-item">
          <span class="label">Label:</span>
          <span class="value">{{ item.value }}</span>
        </div>
        <span class="material-icons expand-icon">
          {{ isCardExpanded(item.uid) ? 'expand_less' : 'expand_more' }}
        </span>
      </div>

      <!-- Card Details: Expanded content + Edit button -->
      @if (isCardExpanded(item.uid)) {
        <div class="card-details">
          <div class="detail-row">
            <span class="label">Field:</span>
            <span class="value">{{ item.field }}</span>
          </div>
          <!-- More detail rows... -->
          <button class="btn-edit" (click)="editItem(item); $event.stopPropagation()">
            <span class="material-icons">edit</span>
            Edit Item
          </button>
        </div>
      }
    </div>
  }
  @if (items.length === 0) {
    <div class="no-data-card">No items found</div>
  }
</div>
```

## SCSS Styles

### Base Styles (always applied)

```scss
// Header
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md-lg);
  gap: var(--spacing-md-sm);

  h1 {
    margin: 0;
    font-size: var(--text-xl);
    color: var(--color-text-primary);
  }
}

.btn-add {
  // Use the global .btn-primary-cta class instead of redefining here.
  // This block exists only for reference when a custom action is needed.
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  min-height: var(--control-h-lg);
  background: var(--gradient-primary);
  color: var(--color-on-primary);
  border: none;
  border-radius: var(--radius-control);
  cursor: pointer;
  font-size: var(--text-md);
  font-weight: 500;
  white-space: nowrap;
  transition: opacity 0.2s ease;

  .material-icons {
    font-size: var(--icon-md);
  }

  &:hover {
    opacity: 0.9;
  }
}

// Filter toggle - hidden on desktop
.filter-toggle {
  display: none;
}

// Visibility classes
.desktop-only {
  display: block;
}

.mobile-only {
  display: none;
}

// Card layout (base styles)
.data-cards {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md-sm);
}

.item-card {
  background: var(--card-bg);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.2s;

  &:active {
    background-color: var(--color-background-secondary);
  }

  &.expanded {
    box-shadow: var(--shadow-lg);
  }

  .card-header {
    padding: var(--spacing-md-sm) var(--spacing-md);
  }

  .card-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-xs);

    .item-name {
      font-weight: 600;
      color: var(--color-text-primary);
      font-size: var(--text-md);
    }

    .status-badge {
      font-size: var(--text-xs);
      font-weight: 600;
      padding: 2px 8px;
      border-radius: var(--radius-pill);

      &.active {
        background-color: var(--status-success-bg);
        color: var(--color-success-dark);
      }

      &.inactive {
        background-color: var(--status-error-bg);
        color: var(--color-danger-dark);
      }
    }
  }

  .card-subtitle {
    font-size: var(--text-base);
    color: var(--color-text-secondary);
  }

  .card-summary {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--color-background-secondary);
    border-top: 1px solid var(--color-border-light);

    .summary-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      font-size: var(--text-base);

      .label {
        color: var(--color-text-secondary);
      }

      .value {
        font-weight: 600;
        color: var(--color-text-primary);
      }
    }

    .expand-icon {
      margin-left: auto;
      color: var(--color-text-secondary);
      font-size: var(--icon-lg);
      transition: transform 0.2s;
    }
  }

  &.expanded .card-summary .expand-icon {
    transform: rotate(180deg);
  }

  .card-details {
    padding: var(--spacing-md-sm) var(--spacing-md);
    background-color: var(--color-background);
    border-top: 1px solid var(--color-border-light);

    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: var(--spacing-sm) 0;
      font-size: var(--text-base);

      &:not(:last-child) {
        border-bottom: 1px solid var(--color-border-light);
      }

      .label {
        color: var(--color-text-secondary);
      }

      .value {
        color: var(--color-text-primary);
        font-weight: 500;
        text-align: right;
        word-break: break-word;
      }
    }

    .btn-edit {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      margin-top: 12px;
      padding: 12px;
      background-color: #3498db;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;

      .material-icons {
        font-size: 18px;
      }

      &:hover {
        background-color: #2980b9;
      }

      &:active {
        background-color: #2472a4;
      }
    }
  }
}

.no-data-card {
  text-align: center;
  padding: 40px 20px;
  background: white;
  border-radius: 8px;
  color: #7f8c8d;
  font-size: 0.95rem;
}
```

### Mobile Styles (@media max-width: 768px)

```scss
@media (max-width: 768px) {
  // Smaller title
  h1 {
    font-size: 1.25rem;
    margin: 0;
  }

  // Compact add button (icon only)
  .header {
    .btn-add {
      padding: 6px 12px;
      font-size: 0.85rem;

      .material-icons {
        font-size: 16px;
      }

      .btn-text {
        display: none;
      }
    }
  }

  // Show filter toggle
  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 12px 16px;
    margin-bottom: 12px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    color: #2c3e50;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;

    .material-icons:first-child {
      color: #3498db;
    }

    .toggle-icon {
      margin-left: auto;
      transition: transform 0.2s;

      &.expanded {
        transform: rotate(180deg);
      }
    }

    &:hover {
      border-color: #3498db;
    }
  }

  // Collapsible filters (hidden by default)
  .filters {
    display: none;
    flex-direction: column;
    gap: 12px;
    padding: 12px;
    margin-bottom: 12px;

    &.expanded {
      display: flex;
    }
  }

  // Filter inputs
  .filter-group {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;

    label {
      font-size: 0.85rem;
    }

    select, input {
      padding: 12px;
      font-size: 16px; // Prevents iOS zoom
      min-height: 44px;
    }
  }

  // Toggle visibility
  .desktop-only {
    display: none !important;
  }

  .mobile-only {
    display: flex !important;
  }

  // Pagination
  .pagination {
    padding: 12px;
    background: white;
    border-radius: 8px;
    margin-top: 12px;
  }
}
```

## Card Content Guidelines

### What to show in Card Summary (always visible):
- 2-3 key metrics/values
- Most important data at a glance
- Expand icon on the right

### What to show in Card Details (expanded):
- Secondary fields (email, dates, etc.)
- Less frequently needed info
- Edit button at the bottom

### Status Badges:
- Green (#d4edda/#155724) for positive states (Active, Completed, Paid)
- Red (#f8d7da/#721c24) for negative states (Inactive, Cancelled)
- Blue (#cce5ff/#004085) for neutral states (Pending, Processing)
- Yellow (#fff3cd/#856404) for warning states (Draft, On Hold)

## Checklist for New Pages

1. [ ] Add `isFiltersExpanded` and `expandedCardIds` to component
2. [ ] Add `toggleFilters()`, `toggleCardExpanded()`, `isCardExpanded()` methods
3. [ ] Update HTML with compact header (title + small add button)
4. [ ] Add filter toggle button
5. [ ] Add `[class.expanded]="isFiltersExpanded"` to filters div
6. [ ] Add `desktop-only` class to table container
7. [ ] Create mobile card view with `mobile-only` class
8. [ ] Add SCSS for filter toggle, cards, and visibility classes
9. [ ] Test on mobile viewport (375px - 768px)
