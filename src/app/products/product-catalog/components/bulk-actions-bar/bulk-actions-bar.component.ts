import { ChangeDetectionStrategy, Component, input, model, output } from '@angular/core';
import { FrontendCategory } from '../../../../core/services/product.service';

/**
 * Presentational component for bulk view actions bar.
 * Handles category filtering and search for bulk order mode.
 * Search is only triggered on Enter or button click (no debounced input search).
 */
@Component({
  selector: 'app-bulk-actions-bar',
  standalone: false,
  templateUrl: './bulk-actions-bar.component.html',
  styleUrl: './bulk-actions-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BulkActionsBarComponent {
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
