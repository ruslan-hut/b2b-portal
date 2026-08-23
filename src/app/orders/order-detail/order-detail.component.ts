import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { formatDateTime } from '../../core/utils/date-format';
import { formatAmount } from '../../core/utils/money-format';
import { OrderService } from '../../core/services/order.service';
import { ClientPhase, Order, OrderClientTimeline } from '../../core/models/order.model';
import { TranslationService } from '../../core/services/translation.service';
import { CurrencyService } from '../../core/services/currency.service';
import { AuthService } from '../../core/services/auth.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { ApiResponse } from '../../core/models/api.model';
import * as XLSX from 'xlsx';

@Component({
    selector: 'app-order-detail',
    templateUrl: './order-detail.component.html',
    styleUrl: './order-detail.component.scss',
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  orderId: string = '';
  order: Order | null = null;
  loading = true;
  error: string | null = null;
  currencyName: string | undefined = undefined;
  /** Whether this account has any branches at all — gates the billing block. */
  hasBranches = false;

  // Progress track state. The client sees phases, never the internal stage
  // history — those rows carry staff names and internal notes.
  timeline: OrderClientTimeline | null = null;
  timelineLoading = false;

  // Mobile card expansion state
  expandedItems: Set<number> = new Set();

  // Show all items toggle (for orders with 5+ items)
  showAllItems: boolean = false;
  readonly itemsPreviewLimit = 5;

  private subscriptions = new Subscription();

  toggleItemExpanded(index: number): void {
    if (this.expandedItems.has(index)) {
      this.expandedItems.delete(index);
    } else {
      this.expandedItems.add(index);
    }
  }

  isItemExpanded(index: number): boolean {
    return this.expandedItems.has(index);
  }

  toggleShowAllItems(): void {
    this.showAllItems = !this.showAllItems;
  }

  getVisibleItems(): any[] {
    if (!this.order?.items) return [];
    if (this.showAllItems || this.order.items.length <= this.itemsPreviewLimit) {
      return this.order.items;
    }
    return this.order.items.slice(0, this.itemsPreviewLimit);
  }

  hasMoreItems(): boolean {
    if (!this.order?.items) return false;
    return this.order.items.length > this.itemsPreviewLimit;
  }

  getRemainingItemsCount(): number {
    if (!this.order?.items) return 0;
    return this.order.items.length - this.itemsPreviewLimit;
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private orderService: OrderService,
    private translationService: TranslationService,
    private currencyService: CurrencyService,
    private authService: AuthService,
    private appSettingsService: AppSettingsService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  ngOnInit(): void {
    this.orderId = this.route.snapshot.params['id'];
    this.loadOrderDetail();

    // Get currency name from AppSettings
    const settings = this.appSettingsService.getSettingsValue();
    if (settings && settings.currency) {
      this.currencyName = settings.currency.name;
    }
    this.hasBranches = (settings?.branches?.length || 0) > 0;
  }

  /**
   * The billing block earns its place when the payer can vary: the order names
   * a branch, or the account has branches an order could have been billed to.
   * An account with none is always its own payer, so the block would repeat
   * what the header already says.
   */
  showBilledTo(): boolean {
    return !!this.order?.branchUid || this.hasBranches;
  }

  loadOrderDetail(): void {
    this.loading = true;
    this.error = null;
    this.cdr.markForCheck();

    this.subscriptions.add(
      this.orderService.getOrderById(this.orderId).subscribe({
        next: (order) => {
          if (!order) {
            this.error = 'Order not found';
            this.loading = false;
            this.cdr.detectChanges();
            return;
          }

          this.order = order;
          this.loading = false;
          this.cdr.detectChanges();
          // Load status history after order is loaded
          this.loadTimeline();
        },
        error: (err) => {
          console.error('Failed to load order detail:', err);
          this.error = 'Failed to load order details';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  loadTimeline(): void {
    if (!this.orderId) return;
    this.timelineLoading = true;
    this.cdr.markForCheck();

    this.subscriptions.add(
      this.http.get<ApiResponse<OrderClientTimeline>>(
        `${environment.apiUrl}/frontend/orders/${this.orderId}/history`
      ).subscribe({
        next: (resp) => {
          this.timeline = resp.data || null;
          this.timelineLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load order progress', err);
          this.timeline = null;
          this.timelineLoading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  /**
   * The track is worth drawing only once the order has reached a phase. An order
   * sitting in a stage nobody mapped shows nothing rather than an empty bar that
   * reads as "no progress made".
   */
  hasProgress(): boolean {
    return !!this.timeline && !this.timeline.cancelled && !!this.timeline.current;
  }

  phaseLabel(phase: ClientPhase): string {
    return this.translationService.instant('orders.phase.' + phase);
  }

  formatDate(date: Date | string): string {
    return formatDateTime(date);
  }

  goBack(): void {
    this.router.navigate(['/orders/history']);
  }

  /**
   * Order money arrives already converted to display units (order.service
   * divides by 100), so this is the formatAmount family, not formatCents.
   * Use it for every amount on this page — the order list next door formats the
   * same totals, and 19587.50 beside 19 587,50 reads as two different numbers.
   */
  money(value: number | null | undefined): string {
    return formatAmount(value);
  }

  /**
   * Same amount with the app currency appended, joined by a no-break space so
   * a narrow column never leaves "UAH" stranded on its own line.
   */
  moneyWithCurrency(value: number | null | undefined): string {
    const amount = formatAmount(value);
    return this.currencyName ? `${amount} ${this.currencyName}` : amount;
  }

  /**
   * Get original total (before discount) - from backend
   */
  getOriginalTotal(): number {
    if (!this.order) return 0;
    return this.order.originalTotal || 0;
  }

  /**
   * Get discount amount - from backend
   */
  getDiscountAmount(): number {
    if (!this.order) return 0;
    return this.order.discountAmount || 0;
  }

  /**
   * Get subtotal (after discount, before VAT) - from backend
   */
  getSubtotal(): number {
    if (!this.order) return 0;
    return this.order.subtotal || 0;
  }

  /**
   * Get VAT amount - from backend
   */
  getVatAmount(): number {
    if (!this.order) return 0;
    return this.order.totalVat || 0;
  }

  /**
   * Get delivery cost - from backend
   */
  getDeliveryCost(): number {
    if (!this.order) return 0;
    return this.order.deliveryCost || 0;
  }

  /**
   * Get final total (with VAT) - from backend
   */
  getFinalTotal(): number {
    if (!this.order) return 0;
    return this.order.totalAmount || 0;
  }

  /**
   * Check if order has discount
   */
  hasDiscount(): boolean {
    if (!this.order) return false;
    return (this.order.discountPercent || 0) > 0;
  }

  /**
   * Check if order has a delivery address with at least one field filled
   */
  hasDeliveryAddress(): boolean {
    if (!this.order) return false;
    // Check individual address fields from backend
    return !!(this.order.addressText || this.order.city || this.order.zipcode || this.order.countryCode);
  }

  /**
   * Export order to Excel file
   */
  exportToExcel(): void {
    if (!this.order) return;

    // Format date as mmddyyyy
    const date = new Date(this.order.createdAt);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    const formattedDate = `${month}${day}${year}`;

    // Create filename
    const orderNumber = this.order.number || this.order.id;
    const filename = `order_${orderNumber}_${formattedDate}.xlsx`;

    // Prepare data for Excel
    const data = [];

    // Add header row with translations
    data.push([
      this.translationService.instant('orders.excelColumnSku'),
      this.translationService.instant('orders.excelColumnBarcode'),
      this.translationService.instant('orders.excelColumnProductName'),
      this.translationService.instant('orders.excelColumnQuantity'),
      this.translationService.instant('orders.excelColumnPriceWithVat'),
      this.translationService.instant('orders.excelColumnPriceAfterDiscount'),
      this.translationService.instant('orders.excelColumnTotal')
    ]);

    // Add data rows
    this.order.items.forEach(item => {
      // Already in display units — order.service divided by 100 on the way in.
      // Left as plain 2-decimal strings on purpose: the on-screen format uses a
      // no-break space and a comma decimal, which a spreadsheet will not parse.
      const priceWithVat = (item.priceWithVat || 0);
      const priceAfterDiscount = (item.priceAfterDiscountWithVat || 0);
      const total = (item.subtotal || 0);

      data.push([
        item.sku || '-',
        item.barcode || '-',
        item.productName,
        item.quantity,
        priceWithVat.toFixed(2),
        priceAfterDiscount.toFixed(2),
        total.toFixed(2)
      ]);
    });

    // Create workbook and worksheet
    const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Order Items');

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // SKU
      { wch: 15 }, // Barcode
      { wch: 30 }, // Product Name
      { wch: 10 }, // Quantity
      { wch: 20 }, // Price (with VAT)
      { wch: 20 }, // Price after Discount
      { wch: 20 }  // Total
    ];

    // Export to file
    XLSX.writeFile(wb, filename);
  }
}

