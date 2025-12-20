import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { OrderService } from '../../core/services/order.service';
import { Order, OrderStatus } from '../../core/models/order.model';
import { TranslationService } from '../../core/services/translation.service';
import { CurrencyService } from '../../core/services/currency.service';
import { AuthService } from '../../core/services/auth.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import * as XLSX from 'xlsx';

interface OrderStatusHistory {
  uid: string;
  order_uid: string;
  user_firstname?: string;
  user_lastname?: string;
  status: string;
  comment?: string;
  created_at: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

@Component({
    selector: 'app-order-detail',
    templateUrl: './order-detail.component.html',
    styleUrl: './order-detail.component.scss',
    standalone: false
})
export class OrderDetailComponent implements OnInit, OnDestroy {
  orderId: string = '';
  order: Order | null = null;
  loading = true;
  error: string | null = null;
  currencyName: string | undefined = undefined;

  // History state
  history: OrderStatusHistory[] = [];
  historyLimit = 50;
  historyOffset = 0;
  historyDesc = true; // default: newest first
  historyLoading = false;

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
          this.loadHistory();
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

  loadHistory(): void {
    if (!this.orderId) return;
    this.historyLoading = true;
    this.cdr.markForCheck();

    this.subscriptions.add(
      this.http.post<ApiResponse<Record<string, OrderStatusHistory[]>>>(
        `${environment.apiUrl}/order/history?limit=${this.historyLimit}&offset=${this.historyOffset}&sort=${this.historyDesc ? 'desc' : 'asc'}`,
        { data: [this.orderId] }
      ).subscribe({
        next: (resp) => {
          const map = resp.data || {};
          this.history = map[this.orderId] || [];
          this.historyLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load order history', err);
          this.history = [];
          this.historyLoading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  formatDate(date: Date | string): string {
    if (!date) return '-';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
  }

  goBack(): void {
    this.router.navigate(['/orders/history']);
  }

  getStatusClass(status: OrderStatus | string): string {
    const statusStr = typeof status === 'string' ? status.toLowerCase() : status;
    const statusClasses: { [key: string]: string } = {
      'draft': 'status-draft',
      'new': 'status-new',
      'processing': 'status-processing',
      'confirmed': 'status-confirmed',
      'cancelled': 'status-cancelled'
    };
    return statusClasses[statusStr] || 'status-new';
  }

  getTranslatedStatus(status: OrderStatus | string): string {
    const statusEnum = typeof status === 'string' ? status as OrderStatus : status;
    const statusKeys: { [key in OrderStatus]: string } = {
      [OrderStatus.DRAFT]: 'orders.draft',
      [OrderStatus.NEW]: 'orders.new',
      [OrderStatus.PROCESSING]: 'orders.processing',
      [OrderStatus.CONFIRMED]: 'orders.confirmed',
      [OrderStatus.CANCELLED]: 'orders.cancelled'
    };
    const key = statusKeys[statusEnum] || 'orders.new';
    return this.translationService.instant(key);
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
      // Convert from cents to currency format (divide by 100)
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

