import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges
} from '@angular/core';
import {
  CatalogImportColumns,
  CatalogImportItem,
  CatalogImportResult,
  CatalogImportSkipReason,
  DEFAULT_IMPORT_COLUMNS
} from '../../core/models/catalog-file.model';
import { MAX_COLUMN, MIN_COLUMN } from '../../core/services/catalog-file.service';

/** What to do with items already in the cart when the file is applied. */
export type ImportApplyMode = 'replace' | 'merge';

/** A chosen file together with the columns to read it by. */
export interface ImportFileRequest {
  file: File;
  columns: CatalogImportColumns;
}

/**
 * Turns a filled-in catalog order form into a cart.
 *
 * Two steps: pick the file, then review what the backend matched before
 * anything touches the cart. Presentational — the parent runs the upload and
 * feeds the result back in.
 */
@Component({
  selector: 'app-order-import-dialog',
  templateUrl: './order-import-dialog.component.html',
  styleUrl: './order-import-dialog.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderImportDialogComponent implements OnChanges {
  @Input() parsing = false;
  @Input() applying = false;
  @Input() result: CatalogImportResult | null = null;
  @Input() currencyName: string | undefined;
  /** Drives the replace/merge choice — only meaningful when the cart is not empty. */
  @Input() cartItemCount = 0;
  @Input() fileName = '';
  /** Column numbers to start from — whatever this browser used last. */
  @Input() columns: CatalogImportColumns = { ...DEFAULT_IMPORT_COLUMNS };

  @Output() fileSelected = new EventEmitter<ImportFileRequest>();
  @Output() confirmed = new EventEmitter<ImportApplyMode>();
  @Output() closed = new EventEmitter<void>();

  applyMode: ImportApplyMode = 'replace';
  dragActive = false;
  /** Skipped rows are collapsed by default — they are the exception, not the point. */
  skippedExpanded = false;

  readonly minColumn = MIN_COLUMN;
  readonly maxColumn = MAX_COLUMN;

  skuColumn = DEFAULT_IMPORT_COLUMNS.sku;
  quantityColumn = DEFAULT_IMPORT_COLUMNS.quantity;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['columns'] && this.columns) {
      this.skuColumn = this.columns.sku;
      this.quantityColumn = this.columns.quantity;
    }
  }

  /** True while either column box holds something that is not a usable column. */
  get columnsInvalid(): boolean {
    return !this.isValidColumn(this.skuColumn) || !this.isValidColumn(this.quantityColumn);
  }

  /** Pointing both settings at one column is always a mistake worth catching. */
  get columnsCollide(): boolean {
    return !this.columnsInvalid && this.skuColumn === this.quantityColumn;
  }

  get columnsUsable(): boolean {
    return !this.columnsInvalid && !this.columnsCollide;
  }

  get columnsAreDefault(): boolean {
    return (
      this.skuColumn === DEFAULT_IMPORT_COLUMNS.sku &&
      this.quantityColumn === DEFAULT_IMPORT_COLUMNS.quantity
    );
  }

  resetColumns(): void {
    this.skuColumn = DEFAULT_IMPORT_COLUMNS.sku;
    this.quantityColumn = DEFAULT_IMPORT_COLUMNS.quantity;
  }

  private isValidColumn(value: number): boolean {
    return Number.isInteger(Number(value)) && value >= MIN_COLUMN && value <= MAX_COLUMN;
  }

  get busy(): boolean {
    return this.parsing || this.applying;
  }

  get hasResult(): boolean {
    return this.result !== null;
  }

  get items(): CatalogImportItem[] {
    return this.result?.items ?? [];
  }

  get canApply(): boolean {
    return this.items.length > 0 && !this.busy;
  }

  get clampedCount(): number {
    return this.items.filter(item => item.clamped).length;
  }

  /** Order total in cents: discounted, VAT-inclusive line prices. */
  get totalCents(): number {
    return this.items.reduce((sum, item) => sum + item.priceFinal * item.quantity, 0);
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.emitFile(input.files?.[0]);
    // Reset so picking the same file again still fires a change event.
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.busy && this.columnsUsable) {
      this.dragActive = true;
    }
  }

  onDragLeave(): void {
    this.dragActive = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive = false;
    this.emitFile(event.dataTransfer?.files?.[0]);
  }

  private emitFile(file: File | undefined): void {
    if (!file || this.busy || !this.columnsUsable) {
      return;
    }
    this.fileSelected.emit({
      file,
      columns: { sku: Number(this.skuColumn), quantity: Number(this.quantityColumn) }
    });
  }

  toggleSkipped(): void {
    this.skippedExpanded = !this.skippedExpanded;
  }

  onConfirm(): void {
    if (!this.canApply) {
      return;
    }
    this.confirmed.emit(this.cartItemCount > 0 ? this.applyMode : 'replace');
  }

  onClose(): void {
    if (this.busy) {
      return;
    }
    this.closed.emit();
  }

  onBackdropClick(): void {
    this.onClose();
  }

  /** Translation key for why a row was left out. */
  skipReasonKey(reason: CatalogImportSkipReason): string {
    switch (reason) {
      case 'duplicate':
        return 'orders.importSkipDuplicate';
      case 'no_stock':
        return 'orders.importSkipNoStock';
      default:
        return 'orders.importSkipNotFound';
    }
  }

  /** Cents to a display string; all money arrives pre-calculated from the backend. */
  money(cents: number): string {
    return (cents / 100).toFixed(2);
  }

  trackByRow(_: number, item: { rowNumber: number }): number {
    return item.rowNumber;
  }
}
