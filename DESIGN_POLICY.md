# Mobile Design Policy

This document defines the design standards for mobile layouts in the COMEX B2B application. Follow these guidelines to maintain visual consistency across all components.

## Core Principles

1. **Compact & Efficient** - Maximize content visibility with minimal visual noise
2. **Business-First** - Clean, professional look suitable for B2B customers
3. **Touch-Friendly** - All interactive elements meet accessibility standards
4. **Consistent Spacing** - Use standardized gaps and padding across components

---

## Spacing Standards

### Mobile (max-width: 768px)

| Element Type | Padding | Gap | Margin |
|-------------|---------|-----|--------|
| Container/Page | 12px horizontal | - | - |
| Section/Card | 10-12px | - | 10px bottom |
| List items | 10-12px | 6-8px between | - |
| Buttons | 10-14px | - | - |
| Form inputs | 12-14px | - | 12px bottom |

### Extra Small (max-width: 480px)

| Element Type | Padding | Gap | Margin |
|-------------|---------|-----|--------|
| Container/Page | 10-12px horizontal | - | - |
| Section/Card | 8-10px | - | 8px bottom |
| List items | 8-10px | 6px between | - |

---

## Typography Standards

### Mobile Font Sizes

| Element | Size | Weight |
|---------|------|--------|
| Page title (h1) | 22px | 700 |
| Section title (h2/h3) | 15-16px | 700 |
| Body text | 13-14px | 400 |
| Secondary text | 11-12px | 400 |
| Labels | 11-12px | 500 |
| Badges | 9-10px | 600 |

---

## Touch Targets

- **Minimum touch target**: 44px (per WCAG accessibility guidelines)
- **Primary buttons**: min-height 44-48px
- **Icon buttons**: 40-44px width/height
- **List items**: min-height 44-52px
- **Form inputs**: min-height 44px

---

## Component Patterns

### Cards (Collapsible)

```scss
.card {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #e1e8ed;

  &.expanded {
    border-color: #667eea;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}
```

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

---

## Color Palette

| Purpose | Color | Usage |
|---------|-------|-------|
| Primary | #667eea | Buttons, links, active states |
| Primary Dark | #5568d3 | Hover states |
| Secondary | #764ba2 | Gradients, accents |
| Success | #27ae60 | Positive values, discounts |
| Danger | #e74c3c | Errors, delete actions |
| Text Primary | #333 | Main text |
| Text Secondary | #666 | Labels, secondary info |
| Text Muted | #999 | Placeholders, disabled |
| Border | #e1e8ed | Card borders, dividers |
| Background | #f8f9fa | Card backgrounds, sections |

---

## Border Radius Standards

| Element | Radius |
|---------|--------|
| Buttons | 8px |
| Cards | 8px |
| Input fields | 8px |
| Badges | 20px (pill) |
| Bottom sheets | 12px (top corners only) |

---

## Responsive Breakpoints

| Breakpoint | Description |
|------------|-------------|
| 768px | Primary mobile breakpoint |
| 480px | Extra small screens |
| 600px | Small tablets (optional) |
| 900px | Tablets (optional) |
| 1200px | Desktop threshold |

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

## Transition Standards

```scss
// Standard transitions
transition: all 0.2s ease;

// Hover states
&:hover {
  background: #f0f4ff;
}

// Active/pressed states
&:active {
  background: #e8edff;
}
```

---

## Do's and Don'ts

### Do
- Use 6-8px gaps between list items
- Keep section padding at 10-12px
- Use 8px border-radius consistently
- Maintain 44px minimum touch targets
- Use subtle borders (#e1e8ed) over shadows
- Apply compact font sizes (13-14px body, 11-12px labels)

### Don't
- Use gaps larger than 12px on mobile
- Add excessive padding (>16px) to cards
- Use font sizes smaller than 11px
- Create touch targets smaller than 40px
- Use heavy shadows (prefer light borders)
- Over-decorate with gradients or animations

---

## Implementation Checklist

When creating new mobile layouts:

- [ ] Container padding: 12px horizontal (10px for 480px)
- [ ] Section/card padding: 10-12px
- [ ] List gap: 6-8px
- [ ] Font sizes reduced appropriately
- [ ] Touch targets >= 44px
- [ ] Bottom sheet with safe area handling
- [ ] Border-radius: 8px (12px for bottom sheets)
- [ ] Collapsible lists for >5 items

---

*Last updated: December 2024*
