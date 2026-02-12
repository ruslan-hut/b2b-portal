import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FrontendCategory } from '../../../../core/services/product.service';

/**
 * Presentational component for bulk view actions bar
 * Handles category filtering and search for bulk order mode
 */
@Component({
  selector: 'app-bulk-actions-bar',
  standalone: false,
  templateUrl: './bulk-actions-bar.component.html',
  styleUrl: './bulk-actions-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BulkActionsBarComponent implements OnInit, OnDestroy {
  /**
   * Categories available for filtering
   */
  @Input({ required: true }) categories!: FrontendCategory[];

  /**
   * Currently selected category UID
   */
  @Input() selectedCategory: string = '';

  /**
   * Cart total amount for display
   */
  @Input() cartTotal: number = 0;

  /**
   * Currency name for display
   */
  @Input() currencyName: string | undefined;

  /**
   * Current search query (from parent state)
   */
  @Input() searchQuery: string = '';

  /**
   * Emitted when search query changes (debounced)
   */
  @Output() search = new EventEmitter<string>();

  /**
   * Emitted when category selection changes
   */
  @Output() categoryChange = new EventEmitter<string>();

  /**
   * Subject for search debouncing
   */
  private searchSubject = new Subject<string>();

  ngOnInit(): void {
    // Setup debounced search
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(query => {
      this.search.emit(query);
    });
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
  }

  /**
   * Handle search input changes
   */
  onSearchInput(): void {
    this.searchSubject.next(this.searchQuery);
  }

  /**
   * Handle search button click or Enter key
   */
  onSearchClick(): void {
    this.search.emit(this.searchQuery);
  }

  /**
   * Handle category selection change
   */
  onCategorySelect(): void {
    this.categoryChange.emit(this.selectedCategory);
  }
}
