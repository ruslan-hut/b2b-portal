import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

/**
 * Presentational component for pagination controls
 * Displays floating "Load More" button and "Scroll to Top" button
 */
@Component({
  selector: 'app-pagination-controls',
  standalone: false,
  templateUrl: './pagination-controls.component.html',
  styleUrl: './pagination-controls.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaginationControlsComponent {
  /**
   * Whether there are more products to load
   */
  @Input() hasMore: boolean = false;

  /**
   * Whether products are currently loading
   */
  @Input() loading: boolean = false;

  /**
   * Whether to show scroll-to-top button
   */
  @Input() showScrollToTop: boolean = false;

  /**
   * Whether to show floating "Show More" button
   */
  @Input() showFloating: boolean = false;

  /**
   * Emitted when load more button is clicked
   */
  @Output() loadMore = new EventEmitter<void>();

  /**
   * Emitted when scroll to top button is clicked
   */
  @Output() scrollToTop = new EventEmitter<void>();

  /**
   * Handle load more click
   */
  onLoadMoreClick(): void {
    this.loadMore.emit();
  }

  /**
   * Handle scroll to top click
   */
  onScrollToTopClick(): void {
    this.scrollToTop.emit();
  }
}
