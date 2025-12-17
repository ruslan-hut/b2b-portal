import { Component, OnInit } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { Currency } from '../../core/models/currency.model';
import { CurrencyService } from '../../core/services/currency.service';
import { Store } from '../../core/models/store.model';
import { StoreService } from '../../core/services/store.service';
import { PriceType } from '../../core/models/price-type.model';
import { PriceTypeService } from '../../core/services/price-type.service';
import { forkJoin } from 'rxjs';
import { switchMap } from 'rxjs/operators';

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
    standalone: false
})
export class OrdersComponent implements OnInit {
  orders: AdminOrder[] = [];
  filteredOrders: AdminOrder[] = [];
  loading = false;
  error: string | null = null;

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

  // Edit
  editingOrder: AdminOrder | null = null;
  showStatusModal = false;
  newStatus = '';

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
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadInitialData();
  }

  loadInitialData(): void {
    this.loading = true;
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

        this.loadOrders(); // Now load the orders
      },
      error: (err) => {
        console.error('Failed to load filter data:', err);
        this.error = 'Failed to load filter data';
        this.loading = false;
      }
    });
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
      },
      error: (err) => {
        console.error('Failed to load orders:', err);
        this.error = 'Failed to load orders';
        this.loading = false;
      }
    });
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

  editStatus(order: AdminOrder): void {
    this.editingOrder = order;
    this.newStatus = order.status;
    this.showStatusModal = true;
  }

  saveStatus(): void {
    if (!this.editingOrder || !this.newStatus) {
      return;
    }

    this.http.post(`${environment.apiUrl}/admin/orders/status`, {
      data: [{
        uid: this.editingOrder.uid,
        status: this.newStatus
      }]
    }).subscribe({
      next: () => {
        this.showStatusModal = false;
        this.loadOrders();
      },
      error: (err) => {
        console.error('Failed to update order status:', err);
        alert('Failed to update order status');
      }
    });
  }

  cancelEdit(): void {
    this.showStatusModal = false;
    this.editingOrder = null;
    this.newStatus = '';
  }

  deleteOrder(order: AdminOrder): void {
    if (!confirm(`Are you sure you want to delete order "${order.number || order.uid}"?`)) {
      return;
    }

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
    });
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
}
