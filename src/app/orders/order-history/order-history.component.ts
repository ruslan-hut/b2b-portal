import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { OrderService } from '../../core/services/order.service';
import { CLIENT_PHASE_FLOW, ClientPhase, Order, OrderItem } from '../../core/models/order.model';
import { TranslationService } from '../../core/services/translation.service';
import { AuthService } from '../../core/services/auth.service';
import { CurrencyService } from '../../core/services/currency.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { CatalogFileService } from '../../core/services/catalog-file.service';
import { NotificationService } from '../../core/services/notification.service';
import { FrontendCategory, ProductService } from '../../core/services/product.service';
import {
  CatalogExportRequest,
  CatalogImportColumns,
  CatalogImportResult,
  DEFAULT_IMPORT_COLUMNS
} from '../../core/models/catalog-file.model';
import { ImportApplyMode, ImportFileRequest } from '../order-import-dialog/order-import-dialog.component';
import { Subscription } from 'rxjs';
import { formatDate } from '../../core/utils/date-format';
import { formatAmount } from '../../core/utils/money-format';

@Component({
    selector: 'app-order-history',
    templateUrl: './order-history.component.html',
    styleUrl: './order-history.component.scss',
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderHistoryComponent implements OnInit, OnDestroy {
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  loading = false;
  currencyName: string | undefined = undefined;

  // Filter properties
  statusFilter: string = '';
  dateFromFilter: string = '';
  dateToFilter: string = '';
  filtersExpanded: boolean = false;

  // Catalog order form (export / import)
  exportDialogOpen = false;
  exporting = false;
  categories: FrontendCategory[] = [];
  categoriesLoading = false;

  importDialogOpen = false;
  importParsing = false;
  importApplying = false;
  importResult: CatalogImportResult | null = null;
  importFileName = '';
  importColumns: CatalogImportColumns = { ...DEFAULT_IMPORT_COLUMNS };
  cartItemCount = 0;

  private subscriptions = new Subscription();

  constructor(
    private orderService: OrderService,
    private router: Router,
    public translationService: TranslationService,
    private authService: AuthService,
    private currencyService: CurrencyService,
    private cdr: ChangeDetectorRef,
    private appSettingsService: AppSettingsService,
    private catalogFileService: CatalogFileService,
    private productService: ProductService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    // Load orders for both Users and Clients
    // Users need StoreUID and PriceTypeUID assigned to access orders
    this.loadOrders();

    // Get currency name from AppSettings
    const settings = this.appSettingsService.getSettingsValue();
    if (settings && settings.currency) {
      this.currencyName = settings.currency.name;
      this.cdr.detectChanges();
    }

    // The import dialog needs to know whether applying the file would discard
    // an existing cart.
    this.subscriptions.add(
      this.orderService.currentOrder$.subscribe(items => {
        this.cartItemCount = items.length;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadOrders(): void {
    this.loading = true;
    this.cdr.markForCheck();

    this.subscriptions.add(
      this.orderService.getOrderHistory().subscribe({
        next: (orders) => {
          // Sort by updatedAt (newest first). Fallback to createdAt if updatedAt missing
          this.orders = orders.sort((a, b) => {
            const aTime = (a.updatedAt || a.createdAt).getTime();
            const bTime = (b.updatedAt || b.createdAt).getTime();
            return bTime - aTime; // newest first
          });

          this.applyFilters();
          this.loading = false;
          // Manually trigger change detection to ensure UI updates
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading orders:', error);
          this.loading = false;
          // If 401/400 error, user might not have StoreUID/PriceTypeUID assigned
          if (error.status === 401 || error.status === 400) {
            console.warn('Unable to load orders. Users need StoreUID and PriceTypeUID assigned.');
          }
          this.cdr.detectChanges();
        }
      })
    );
  }

  applyFilters(): void {
    let filtered = [...this.orders];

    // Filter by status
    if (this.statusFilter) {
      filtered = filtered.filter(order => order.clientPhase === this.statusFilter);
    }

    // Filter by date range
    if (this.dateFromFilter) {
      const fromDate = new Date(this.dateFromFilter);
      fromDate.setHours(0, 0, 0, 0);
      const fromTime = fromDate.getTime();
      filtered = filtered.filter(order => {
        const orderTime = (order.updatedAt || order.createdAt).getTime();
        return orderTime >= fromTime;
      });
    }

    if (this.dateToFilter) {
      const toDate = new Date(this.dateToFilter);
      toDate.setHours(23, 59, 59, 999);
      const toTime = toDate.getTime();
      filtered = filtered.filter(order => {
        const orderTime = (order.updatedAt || order.createdAt).getTime();
        return orderTime <= toTime;
      });
    }

    this.filteredOrders = filtered;
  }

  clearFilters(): void {
    this.statusFilter = '';
    this.dateFromFilter = '';
    this.dateToFilter = '';
    this.applyFilters();
  }

  toggleFilters(): void {
    this.filtersExpanded = !this.filtersExpanded;
  }

  hasActiveFilters(): boolean {
    return !!(this.statusFilter || this.dateFromFilter || this.dateToFilter);
  }

  // ---------------------------------------------------------------------------
  // Catalog order form
  // ---------------------------------------------------------------------------

  /**
   * Importing writes a cart, so it is client-only — staff browse the catalog in
   * read-only preview mode and can still export.
   */
  get canImport(): boolean {
    return this.appSettingsService.isCartEnabled();
  }

  openExportDialog(): void {
    this.exportDialogOpen = true;
    this.loadCategories();
    this.cdr.markForCheck();
  }

  closeExportDialog(): void {
    this.exportDialogOpen = false;
    this.cdr.markForCheck();
  }

  onExportConfirmed(request: CatalogExportRequest): void {
    this.exporting = true;
    this.cdr.markForCheck();

    this.subscriptions.add(
      this.catalogFileService.export(request).subscribe({
        next: (file) => {
          this.catalogFileService.saveToDisk(file);
          this.exporting = false;
          this.exportDialogOpen = false;
          if (file.truncated) {
            this.notificationService.warning(
              this.translationService.instant('orders.exportTruncated')
            );
          }
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error exporting catalog:', error);
          this.exporting = false;
          this.notificationService.error(
            this.translationService.instant('orders.exportFailed')
          );
          this.cdr.markForCheck();
        }
      })
    );
  }

  openImportDialog(): void {
    this.importDialogOpen = true;
    this.importResult = null;
    this.importFileName = '';
    // Start from the column numbers this browser used last time.
    this.importColumns = this.catalogFileService.loadColumnPreferences();
    this.cdr.markForCheck();
  }

  closeImportDialog(): void {
    this.importDialogOpen = false;
    this.importResult = null;
    this.importFileName = '';
    this.cdr.markForCheck();
  }

  onImportFileSelected(request: ImportFileRequest): void {
    this.importParsing = true;
    this.importFileName = request.file.name;
    this.importResult = null;
    // Remember the columns as soon as they are used, so a failed parse still
    // leaves the client's correction in place for the next attempt.
    this.importColumns = request.columns;
    this.catalogFileService.saveColumnPreferences(request.columns);
    this.cdr.markForCheck();

    this.subscriptions.add(
      this.catalogFileService.import(request.file, request.columns).subscribe({
        next: (result) => {
          this.importResult = result;
          this.importParsing = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error importing order file:', error);
          this.importParsing = false;
          this.notificationService.error(this.importErrorMessage(error));
          this.cdr.markForCheck();
        }
      })
    );
  }

  onImportConfirmed(mode: ImportApplyMode): void {
    const result = this.importResult;
    if (!result || result.items.length === 0) {
      return;
    }

    const items: OrderItem[] = result.items.map(item => ({
      productId: item.productUid,
      productName: item.productName,
      sku: item.sku,
      barcode: item.barcode,
      quantity: item.quantity,
      // Prices are display-only here; the backend recalculates the whole cart
      // when the draft is saved (see AGENTS.md: money = backend only).
      price: 0,
      subtotal: 0
    }));

    if (mode === 'replace') {
      this.orderService.setCart(items);
    } else {
      items.forEach(item => this.orderService.addToCart(item));
    }

    this.importApplying = true;
    this.cdr.markForCheck();

    this.subscriptions.add(
      this.orderService.saveDraftCart().subscribe({
        next: () => {
          this.importApplying = false;
          this.closeImportDialog();
          this.notificationService.success(
            this.translationService.instant('orders.importApplied')
          );
          this.router.navigate(['/products/cart']);
        },
        error: (error) => {
          console.error('Error saving imported cart:', error);
          this.importApplying = false;
          this.notificationService.error(
            this.translationService.instant('orders.importApplyFailed')
          );
          this.cdr.markForCheck();
        }
      })
    );
  }

  private loadCategories(): void {
    // Categories rarely change during a session; fetch once per page visit.
    if (this.categories.length > 0 || this.categoriesLoading) {
      return;
    }

    this.categoriesLoading = true;
    this.cdr.markForCheck();

    this.subscriptions.add(
      this.productService.getFrontendCategories().subscribe({
        next: (categories) => {
          // Ordering comes from ProductService, so the export picker lists
          // categories exactly like the catalog filter does.
          this.categories = categories;
          this.categoriesLoading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Error loading categories:', error);
          this.categoriesLoading = false;
          this.cdr.markForCheck();
        }
      })
    );
  }

  /**
   * The backend explains exactly why a file was rejected (wrong format, no
   * header, too many rows); show that instead of a generic failure.
   */
  private importErrorMessage(error: unknown): string {
    const message = (error as { error?: { error?: { message?: string } } })?.error?.error?.message;
    return message || this.translationService.instant('orders.importFailed');
  }

  /**
   * Order totals arrive already converted to display units (order.service
   * divides by 100), so this is the formatAmount family, not formatCents.
   */
  formatTotal(value: number | null | undefined): string {
    return formatAmount(value);
  }

  phaseLabel(phase: ClientPhase): string {
    return this.translationService.instant('orders.phase.' + phase);
  }

  viewOrderDetails(orderId: string): void {
    this.router.navigate(['/orders/detail', orderId]);
  }

  navigateToCatalog(): void {
    this.router.navigate(['/products/catalog']);
  }

  getOrderTitle(order: Order): string {
    const dateStr = formatDate(order.createdAt);
    return order.number ? `${dateStr} - ${order.number}` : dateStr;
  }

  /**
   * The filter lists the phases actually present in the loaded orders, in track
   * order rather than alphabetically — the client thinks of them as a sequence.
   * Cancelled is appended last since it is off the track.
   */
  getStatusOptions(): Array<{ value: string; label: string }> {
    const present = new Set(this.orders.map(order => order.clientPhase).filter(Boolean));
    const ordered: ClientPhase[] = [...CLIENT_PHASE_FLOW, 'cancelled'];

    return [
      { value: '', label: this.translationService.instant('orders.allStatuses') },
      ...ordered
        .filter(phase => present.has(phase))
        .map(phase => ({ value: phase, label: this.phaseLabel(phase) }))
    ];
  }
}
