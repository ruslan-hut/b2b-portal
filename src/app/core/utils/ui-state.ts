/**
 * Manages a boolean toggle state (e.g., filter panel expanded/collapsed).
 *
 * Usage in component:
 *   filters = new ToggleState();
 *
 * In template:
 *   (click)="filters.toggle()"
 *   [class.expanded]="filters.expanded"
 */
export class ToggleState {
  expanded = false;

  toggle(): void {
    this.expanded = !this.expanded;
  }

  open(): void {
    this.expanded = true;
  }

  close(): void {
    this.expanded = false;
  }
}

/**
 * Manages a Set-based expand/collapse state for card lists.
 * Tracks which items (by string ID) are expanded.
 *
 * Usage in component:
 *   cards = new ExpandState();
 *
 * In template:
 *   (click)="cards.toggle(item.uid)"
 *   [class.expanded]="cards.isExpanded(item.uid)"
 */
export class ExpandState {
  private ids = new Set<string>();

  toggle(id: string): void {
    if (this.ids.has(id)) {
      this.ids.delete(id);
    } else {
      this.ids.add(id);
    }
  }

  isExpanded(id: string): boolean {
    return this.ids.has(id);
  }

  collapseAll(): void {
    this.ids.clear();
  }
}
