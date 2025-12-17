import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { OrderService } from '../../core/services/order.service';
import { Order, OrderStatus } from '../../core/models/order.model';
import { TranslationService } from '../../core/services/translation.service';
import { AuthService } from '../../core/services/auth.service';
import { CurrencyService } from '../../core/services/currency.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-order-history',
    templateUrl: './order-history.component.html',
    styleUrl: './order-history.component.scss',
    standalone: false
})
export class OrderHistoryComponent implements OnInit, OnDestroy {
  orders: Order[] = [];
  filteredOrders: Order[] = [];
  loading = false;
  currencyName: string | undefined = undefined;
  
  // Filter properties
  statusFilter: OrderStatus | '' = '';
  dateFromFilter: string = '';
  dateToFilter: string = '';
  
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
    });
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

  getStatusClass(status: OrderStatus): string {
    const statusClasses: { [key in OrderStatus]: string } = {
      [OrderStatus.DRAFT]: 'status-draft',
      [OrderStatus.NEW]: 'status-new',
      [OrderStatus.PROCESSING]: 'status-processing',
      [OrderStatus.CONFIRMED]: 'status-confirmed',
      [OrderStatus.CANCELLED]: 'status-cancelled'
    };
    return statusClasses[status] || 'status-new';
  }

  getTranslatedStatus(status: OrderStatus): string {
    const statusKeys: { [key in OrderStatus]: string } = {
      [OrderStatus.DRAFT]: 'orders.draft',
      [OrderStatus.NEW]: 'orders.new',
      [OrderStatus.PROCESSING]: 'orders.processing',
      [OrderStatus.CONFIRMED]: 'orders.confirmed',
      [OrderStatus.CANCELLED]: 'orders.cancelled'
    };
    const key = statusKeys[status] || 'orders.new';
    return this.translationService.instant(key);
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

  getStatusOptions(): Array<{ value: OrderStatus | ''; label: string }> {
    return [
      { value: '', label: this.translationService.instant('orders.allStatuses') || 'All Statuses' },
      { value: OrderStatus.DRAFT, label: this.translationService.instant('orders.draft') },
      { value: OrderStatus.NEW, label: this.translationService.instant('orders.new') },
      { value: OrderStatus.PROCESSING, label: this.translationService.instant('orders.processing') },
      { value: OrderStatus.CONFIRMED, label: this.translationService.instant('orders.confirmed') },
      { value: OrderStatus.CANCELLED, label: this.translationService.instant('orders.cancelled') }
    ];
  }
}
