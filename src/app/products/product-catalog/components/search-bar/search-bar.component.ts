import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FrontendCategory } from '../../../../core/services/product.service';

/**
 * Presentational component for product catalog search bar.
 * Handles category filtering and search.
 * Search is only triggered on Enter or button click (backend-driven search).
 */
@Component({
  selector: 'app-search-bar',
  standalone: false,
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchBarComponent {
  readonly viewMode = input<'grid' | 'bulk'>('grid');
  readonly categories = input.required<FrontendCategory[]>();
  readonly selectedCategory = model<string>('');
  readonly cartTotal = input<number>(0);
  readonly currencyName = input<string | undefined>(undefined);
  readonly searchQuery = model<string>('');
  /** Read-only catalog preview for staff: hides the cart total. */
  readonly previewMode = input<boolean>(false);

  readonly search = output<string>();
  readonly categoryChange = output<string>();

  onSearchClick(): void {
    this.search.emit(this.searchQuery());
  }

  onCategorySelect(): void {
    this.categoryChange.emit(this.selectedCategory());
  }
}
