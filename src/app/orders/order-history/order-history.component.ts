import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { OrderService } from '../../core/services/order.service';
import { Order, OrderStatus, toLegacyStatus } from '../../core/models/order.model';
import { TranslationService } from '../../core/services/translation.service';
import { AuthService } from '../../core/services/auth.service';
import { CurrencyService } from '../../core/services/currency.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { Subscription } from 'rxjs';

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

  private subscriptions = new Subscription();

  constructor(
    private orderService: OrderService,
    private router: Router,
    public translationService: TranslationService,
    private authService: AuthService,
    private currencyService: CurrencyService,
    private cdr: ChangeDetectorRef,
    private appSettingsService: AppSettingsService
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
      filtered = filtered.filter(order => order.status === this.statusFilter);
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

  getDisplayStatus(status: string): string {
    const legacyStatus = toLegacyStatus(status);
    if (legacyStatus) {
      const keyMap: { [key in OrderStatus]: string } = {
        [OrderStatus.DRAFT]: 'orders.draft',
        [OrderStatus.NEW]: 'orders.new',
        [OrderStatus.PROCESSING]: 'orders.processing',
        [OrderStatus.CONFIRMED]: 'orders.confirmed',
        [OrderStatus.CANCELLED]: 'orders.cancelled'
      };
      return this.translationService.instant(keyMap[legacyStatus]);
    }
    return this.formatCustomStageName(status);
  }

  getStatusClass(status: string): string {
    const legacyStatus = toLegacyStatus(status);
    if (legacyStatus) {
      const classMap: { [key in OrderStatus]: string } = {
        [OrderStatus.DRAFT]: 'status-draft',
        [OrderStatus.NEW]: 'status-new',
        [OrderStatus.PROCESSING]: 'status-processing',
        [OrderStatus.CONFIRMED]: 'status-confirmed',
        [OrderStatus.CANCELLED]: 'status-cancelled'
      };
      return classMap[legacyStatus];
    }
    return this.getCustomStageClass(status);
  }

  private formatCustomStageName(stageName: string): string {
    if (!stageName || stageName.trim() === '') {
      return this.translationService.instant('orders.unknownStatus');
    }
    // Title case each word
    return stageName.split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private getCustomStageClass(stageName: string): string {
    const lower = stageName.toLowerCase();
    if (lower.includes('cancel') || lower.includes('reject')) return 'status-custom-cancelled';
    if (lower.includes('confirm') || lower.includes('complet') || lower.includes('done')) return 'status-custom-confirmed';
    if (lower.includes('process') || lower.includes('review') || lower.includes('pending')) return 'status-custom-processing';
    return 'status-custom-default';
  }

  // Deprecated: kept for backward compatibility
  getTranslatedStatus(status: string): string {
    return this.getDisplayStatus(status);
  }

  viewOrderDetails(orderId: string): void {
    this.router.navigate(['/orders/detail', orderId]);
  }

  navigateToCatalog(): void {
    this.router.navigate(['/products/catalog']);
  }

  getOrderTitle(order: Order): string {
    const dateStr = new Date(order.createdAt).toLocaleDateString();
    return order.number ? `${dateStr} - ${order.number}` : dateStr;
  }

  getStatusOptions(): Array<{ value: string; label: string }> {
    const options: Array<{ value: string; label: string }> = [
      { value: '', label: this.translationService.instant('orders.allStatuses') }
    ];

    // Collect unique statuses from loaded orders
    const uniqueStatuses = new Set<string>();
    this.orders.forEach(order => {
      if (order.status) uniqueStatuses.add(order.status);
    });

    // Separate legacy and custom statuses
    const legacyStatuses: OrderStatus[] = [];
    const customStatuses: string[] = [];

    uniqueStatuses.forEach(status => {
      const legacy = toLegacyStatus(status);
      legacy ? legacyStatuses.push(legacy) : customStatuses.push(status);
    });

    // Add legacy statuses first (in defined order)
    const legacyOrder = [OrderStatus.DRAFT, OrderStatus.NEW, OrderStatus.PROCESSING, OrderStatus.CONFIRMED, OrderStatus.CANCELLED];
    legacyOrder.forEach(status => {
      if (legacyStatuses.includes(status)) {
        options.push({ value: status, label: this.getDisplayStatus(status) });
      }
    });

    // Add custom statuses (alphabetical)
    customStatuses.sort().forEach(status => {
      options.push({ value: status, label: this.getDisplayStatus(status) });
    });

    return options;
  }
}
