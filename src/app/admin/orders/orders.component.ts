import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Currency } from '../../core/models/currency.model';
import { CurrencyService } from '../../core/services/currency.service';
import { Store } from '../../core/models/store.model';
import { StoreService } from '../../core/services/store.service';
import { PriceType } from '../../core/models/price-type.model';
import { PriceTypeService } from '../../core/services/price-type.service';
import { forkJoin, Subscription } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { PageTitleService } from '../../core/services/page-title.service';
import { AuthService } from '../../core/services/auth.service';
import { User } from '../../core/models/user.model';

export interface AdminOrder {
  uid: string;
  number?: string;
  client_uid: string;
  store_uid: string;
  price_type_uid: string;
  currency_code: string;
  status: string;
  total: number;
  discount_percent?: number; // Client discount percentage (0-100)
  vat_rate?: number; // VAT rate percentage (0-100)
  subtotal?: number; // Subtotal without VAT
  total_vat?: number; // Total VAT amount
  shipping_address: string;
  billing_address?: string;
  comment?: string;
  created_at: string;
  last_update?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  metadata?: {
    page: number;
    count: number;
    total: number;
    total_pages: number;
  };
}

@Component({
    selector: 'app-orders',
    templateUrl: './orders.component.html',
    styleUrls: ['./orders.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrdersComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  orders: AdminOrder[] = [];
  filteredOrders: AdminOrder[] = [];
  loading = false;
  error: string | null = null;
  isAdmin = false;

  // Pagination
  currentPage = 1;
  pageSize = 20;
  total = 0;
  totalPages = 1;

  // Filters
  statusFilter: string = '';
  searchTerm = '';
  storeFilter: string = '';
  priceTypeFilter: string = '';

  // Mobile UI state
  isFiltersExpanded = false;
  expandedCardIds: Set<string> = new Set();

  // Filter Options
  statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'new', label: 'New' },
    { value: 'processing', label: 'Processing' },
    { value: 'confirmed', label: 'Confirmed' }
  ];
  storeOptions: { value: string; label: string; }[] = [];
  priceTypeOptions: { value: string; label: string; }[] = [];

  // Data maps
  currencies: { [code: string]: Currency } = {};
  stores: { [uid: string]: Store } = {};
  priceTypes: { [uid: string]: PriceType } = {};
  clients: { [uid: string]: any } = {};

  constructor(
    private http: HttpClient,
    private currencyService: CurrencyService,
    private storeService: StoreService,
    private priceTypeService: PriceTypeService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private pageTitleService: PageTitleService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle('Orders');

    // Check if user is admin
    this.subscriptions.add(
      this.authService.currentEntity$.subscribe(entity => {
        if (entity && this.authService.entityTypeValue === 'user') {
          const user = entity as User;
          this.isAdmin = user?.role === 'admin';
          this.cdr.markForCheck();
        } else {
          this.isAdmin = false;
          this.cdr.markForCheck();
        }
      })
    );

    this.loadInitialData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadInitialData(): void {
    this.loading = true;
    this.subscriptions.add(
      forkJoin({
        stores: this.storeService.getStores(),
        priceTypes: this.priceTypeService.getPriceTypes()
      }).subscribe({
        next: ({ stores, priceTypes }) => {
          this.stores = stores;
          this.priceTypes = priceTypes;

          this.storeOptions = [
            { value: '', label: 'All Stores' },
            ...Object.values(stores).map(s => ({ value: s.uid, label: s.name })).sort((a, b) => a.label.localeCompare(b.label))
          ];
          this.priceTypeOptions = [
            { value: '', label: 'All Price Types' },
            ...Object.values(priceTypes).map(pt => ({ value: pt.uid, label: pt.name })).sort((a, b) => a.label.localeCompare(b.label))
          ];
          this.cdr.detectChanges();

          this.loadOrders(); // Now load the orders
        },
        error: (err) => {
          console.error('Failed to load filter data:', err);
          this.error = 'Failed to load filter data';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  loadOrders(): void {
    this.loading = true;
    this.error = null;

    let params = new HttpParams()
      .set('page', this.currentPage.toString())
      .set('count', this.pageSize.toString());

    if (this.statusFilter) {
      params = params.set('status', this.statusFilter);
    }
    if (this.storeFilter) {
      params = params.set('store_uid', this.storeFilter);
    }
    if (this.priceTypeFilter) {
      params = params.set('price_type_uid', this.priceTypeFilter);
    }

    const url = `${environment.apiUrl}/admin/orders`;

    this.subscriptions.add(
      this.http.get<ApiResponse<AdminOrder[]>>(url, { params }).pipe(
        switchMap((response: ApiResponse<AdminOrder[]>) => {
          this.orders = response.data || [];
          this.total = response.metadata?.total || this.orders.length;
          this.totalPages = response.metadata?.total_pages || Math.ceil(this.total / this.pageSize);

          const currencyCodes = [...new Set(this.orders.map(order => order.currency_code))];
          return this.currencyService.getCurrenciesByCodes(currencyCodes);
        }),
        switchMap((currencies) => {
          currencies.forEach(currency => {
            if (!this.currencies[currency.code]) {
              this.currencies[currency.code] = currency;
            }
          });

          // Fetch clients
          const clientUIDs = [...new Set(this.orders.map(order => order.client_uid))];

          if (clientUIDs.length > 0) {
            return this.http.post<ApiResponse<any[]>>(
              `${environment.apiUrl}/client/batch`,
              { data: clientUIDs }
            );
          }

          return forkJoin({ data: [] });
        })
      ).subscribe({
        next: (clientsResponse: any) => {
          if (clientsResponse.data) {
            clientsResponse.data.forEach((client: any) => {
              this.clients[client.uid] = client;
            });
          }

          this.applySearch();
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load orders:', err);
          this.error = 'Failed to load orders';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadOrders();
  }

  getStoreName(uid: string): string {
    return this.stores[uid]?.name || uid;
  }

  getPriceTypeName(uid: string): string {
    return this.priceTypes[uid]?.name || uid;
  }

  getClientName(uid: string): string {
    return this.clients[uid]?.name || uid;
  }

  getCurrency(code: string): Currency | null {
    return this.currencies[code] || null;
  }

  applySearch(): void {
    if (!this.searchTerm.trim()) {
      this.filteredOrders = [...this.orders];
      return;
    }

    const search = this.searchTerm.toLowerCase();
    this.filteredOrders = this.orders.filter(order =>
      order.number?.toLowerCase().includes(search) ||
      order.uid.toLowerCase().includes(search) ||
      order.client_uid.toLowerCase().includes(search) ||
      this.getClientName(order.client_uid).toLowerCase().includes(search)
    );
  }

  onSearchChange(): void {
    this.applySearch();
  }

  deleteOrder(order: AdminOrder): void {
    if (!confirm(`Are you sure you want to delete order "${order.number || order.uid}"?`)) {
      return;
    }

    this.subscriptions.add(
      this.http.post(`${environment.apiUrl}/admin/orders/delete`, {
        data: [order.uid]
      }).subscribe({
        next: () => {
          this.loadOrders();
        },
        error: (err) => {
          console.error('Failed to delete order:', err);
          alert('Failed to delete order');
        }
      })
    );
  }

  getStatusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadOrders();
    }
  }

  viewOrderDetail(order: AdminOrder): void {
    this.router.navigate(['/admin/orders', order.uid]);
  }

  // Mobile UI methods
  toggleFilters(): void {
    this.isFiltersExpanded = !this.isFiltersExpanded;
    this.cdr.detectChanges();
  }

  toggleCardExpanded(uid: string): void {
    if (this.expandedCardIds.has(uid)) {
      this.expandedCardIds.delete(uid);
    } else {
      this.expandedCardIds.add(uid);
    }
  }

  isCardExpanded(uid: string): boolean {
    return this.expandedCardIds.has(uid);
  }
}
