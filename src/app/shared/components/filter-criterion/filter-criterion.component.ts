import { Component, EventEmitter, Input, Output, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';

export interface CriterionOption {
  value: string;
  label: string;
  /** Optional dimmer second line, e.g. a country code next to a country name. */
  hint?: string;
}

/**
 * The selection carried by one criterion: which options are picked, and whether
 * the pick means "only these" or "all but these".
 *
 * An empty `values` array means the criterion is not applied at all — `exclude`
 * is then meaningless and must never be read as "exclude everything". The
 * backend filter follows the same rule.
 */
export interface CriterionSelection {
  values: string[];
  exclude: boolean;
}

/**
 * One collapsible include/exclude criterion in a filter rail.
 *
 * Collapsed it is a single row: label, and a badge summarising the current
 * selection. That is what keeps a rail of six criteria readable — the detail
 * only exists while a criterion is open, and the parent opens one at a time.
 *
 * Expanded it offers an Include/Exclude segmented toggle and a searchable
 * checkbox list. A segmented toggle rather than per-option tri-state because the
 * business question is asked in one direction at a time ("which orders have NO
 * Faktura"), and one toggle is far cheaper to read than N tri-states.
 */
@Component({
  selector: 'app-filter-criterion',
  templateUrl: './filter-criterion.component.html',
  styleUrl: './filter-criterion.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilterCriterionComponent {
  @Input() label = '';
  @Input() icon = '';
  @Input() options: CriterionOption[] = [];
  @Input() selection: CriterionSelection = { values: [], exclude: false };
  /** Shown above the option list when the list is long enough to need it. */
  @Input() searchThreshold = 8;
  @Input() expanded = false;
  /**
   * Caveat shown under the option list, e.g. when the option set had to be
   * truncated. Stating it here is the honest alternative to a list that quietly
   * omits choices the user is looking for.
   */
  @Input() note = '';

  @Output() selectionChange = new EventEmitter<CriterionSelection>();
  @Output() expandedChange = new EventEmitter<boolean>();

  searchTerm = '';

  constructor(private cdr: ChangeDetectorRef) {}

  get showSearch(): boolean {
    return this.options.length >= this.searchThreshold;
  }

  get visibleOptions(): CriterionOption[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.options;
    }
    return this.options.filter(o =>
      o.label.toLowerCase().includes(term) || o.value.toLowerCase().includes(term)
    );
  }

  /** True when at least one option is picked, i.e. the criterion narrows anything. */
  get isActive(): boolean {
    return this.selection.values.length > 0;
  }

  isSelected(value: string): boolean {
    return this.selection.values.includes(value);
  }

  toggleExpanded(): void {
    this.expanded = !this.expanded;
    this.expandedChange.emit(this.expanded);
  }

  toggleOption(value: string): void {
    const values = this.isSelected(value)
      ? this.selection.values.filter(v => v !== value)
      : [...this.selection.values, value];
    this.emit(values, this.selection.exclude);
  }

  setExclude(exclude: boolean): void {
    if (exclude === this.selection.exclude) {
      return;
    }
    this.emit(this.selection.values, exclude);
  }

  /**
   * Clearing resets the direction too. Leaving a stale "exclude" behind on an
   * empty criterion would make the next selection silently mean the opposite of
   * what the user expects.
   */
  clear(event: Event): void {
    event.stopPropagation();
    if (!this.isActive && !this.selection.exclude) {
      return;
    }
    this.emit([], false);
  }

  private emit(values: string[], exclude: boolean): void {
    this.selection = { values, exclude };
    this.selectionChange.emit(this.selection);
    this.cdr.markForCheck();
  }
}
