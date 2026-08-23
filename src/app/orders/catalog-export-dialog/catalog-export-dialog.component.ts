import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import { CatalogExportFormat, CatalogExportRequest } from '../../core/models/catalog-file.model';
import { FrontendCategory } from '../../core/services/product.service';

/**
 * Picks what goes into the catalog order form: how the barcode column is drawn
 * and which categories to include.
 *
 * Purely presentational — the parent runs the download and feeds `exporting`
 * back in, so the dialog never has to know about HTTP.
 */
@Component({
  selector: 'app-catalog-export-dialog',
  templateUrl: './catalog-export-dialog.component.html',
  styleUrl: './catalog-export-dialog.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogExportDialogComponent implements OnChanges {
  @Input() categories: FrontendCategory[] = [];
  @Input() categoriesLoading = false;
  @Input() exporting = false;

  @Output() confirmed = new EventEmitter<CatalogExportRequest>();
  @Output() closed = new EventEmitter<void>();

  format: CatalogExportFormat = 'text';
  categoryFilter = '';

  /** Empty means "every category", which is also the default. */
  readonly selected = new Set<string>();

  visibleCategories: FrontendCategory[] = [];

  /**
   * Categories arrive after the dialog opens, so the visible list has to be
   * re-derived whenever the input lands — not just once on init.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['categories']) {
      this.applyFilter();
    }
  }

  onFilterChange(): void {
    this.applyFilter();
  }

  private applyFilter(): void {
    const needle = this.categoryFilter.trim().toLowerCase();
    this.visibleCategories = needle
      ? this.categories.filter(category => category.name.toLowerCase().includes(needle))
      : this.categories;
  }

  toggleCategory(uid: string): void {
    if (this.selected.has(uid)) {
      this.selected.delete(uid);
    } else {
      this.selected.add(uid);
    }
  }

  isSelected(uid: string): boolean {
    return this.selected.has(uid);
  }

  /** Selects every category currently passing the filter. */
  selectAllVisible(): void {
    this.visibleCategories.forEach(category => this.selected.add(category.uid));
  }

  clearSelection(): void {
    this.selected.clear();
  }

  get selectedCount(): number {
    return this.selected.size;
  }

  /** No selection is not an error — it exports the whole catalog. */
  get exportsEverything(): boolean {
    return this.selected.size === 0;
  }

  onConfirm(): void {
    if (this.exporting) {
      return;
    }
    this.confirmed.emit({
      format: this.format,
      categoryUids: Array.from(this.selected)
    });
  }

  onClose(): void {
    if (this.exporting) {
      return;
    }
    this.closed.emit();
  }

  onBackdropClick(): void {
    this.onClose();
  }

  trackByUid(_: number, category: FrontendCategory): string {
    return category.uid;
  }
}
