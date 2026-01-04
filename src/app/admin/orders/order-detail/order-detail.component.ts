import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Currency } from '../../../core/models/currency.model';
import { ProductService } from '../../../core/services/product.service';
import { TranslationService } from '../../../core/services/translation.service';

interface OrderDetail {
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
  original_total?: number; // Original total before discount
  discount_amount?: number; // Total discount amount saved
  shipping_address: string;
  billing_address?: string;
  country_code?: string; // ISO country code (e.g., "UA", "PL")
  zipcode?: string; // Postal code
  city?: string; // City name
  address_text?: string; // Street address
  comment?: string;
  created_at: string;
  last_update?: string;
}

interface OrderItem {
  order_uid: string;
  product_uid: string;
  product_sku: string; // Product SKU (from backend)
  quantity: number;
  price: number; // Base price in cents (without VAT or discount)
  price_with_vat: number; // Base price with VAT (calculated by backend)
  discount: number; // Discount percentage (0-100)
  price_discount?: number; // Price after discount in cents (without VAT)
  price_after_discount_with_vat: number; // Price after discount with VAT (calculated by backend)
  tax?: number; // VAT amount for this item
  total: number; // Total with VAT (quantity × price_after_discount_with_vat)
}

interface Client {
  uid: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  discount: number;
  vat_rate?: number; // VAT rate percentage (0-100)
  vat_number?: string; // VAT registration number
  active: boolean;
}

interface Product {
  uid: string;
  sku: string;
  name: string;
}

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
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDetailComponent implements OnInit {
  orderUID: string = '';
  order: OrderDetail | null = null;
  client: Client | null = null;
  items: OrderItem[] = [];
  products: { [uid: string]: Product } = {};
  loading = true;
  error: string | null = null;

  // History state
  history: OrderStatusHistory[] = [];
  historyLimit = 10;
  historyOffset = 0;
  historyDesc = true; // default: newest first
  historyLoading = false;

  // Mobile UI state
  showAllItems = false;
  itemsPreviewLimit = 5;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private productService: ProductService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.orderUID = this.route.snapshot.params['id'];
    this.loadOrderDetail();
  }

  loadOrderDetail(): void {
    this.loading = true;
    this.error = null;

    // Step 1: Fetch order
    this.http.post<ApiResponse<OrderDetail[]>>(`${environment.apiUrl}/order/batch`, {
      data: [this.orderUID]
    }).pipe(
      switchMap(orderResponse => {
        if (!orderResponse.data || orderResponse.data.length === 0) {
          throw new Error('Order not found');
        }

        this.order = orderResponse.data[0];

        // Step 2: Fetch client and items in parallel
        return forkJoin({
          client: this.http.post<ApiResponse<Client[]>>(`${environment.apiUrl}/client/batch`, {
            data: [this.order.client_uid]
          }),
          items: this.http.post<ApiResponse<OrderItem[][]>>(`${environment.apiUrl}/order/items/batch`, {
            data: [this.orderUID]
          })
        });
      }),
      switchMap(({ client, items }) => {
        this.client = client.data?.[0] || null;
        this.items = items.data?.[0] || [];

        // Step 3: Fetch products for items
        const productUIDs = [...new Set(this.items.map(item => item.product_uid))];

        if (productUIDs.length > 0) {
          const lang = this.translationService.getCurrentLanguage();

          // Use ProductService to get names/descriptions and backend product batch to get SKUs
          return forkJoin({
            backendProducts: this.http.post<ApiResponse<any[]>>(`${environment.apiUrl}/product/batch`, { data: productUIDs }),
            descriptions: this.productService.getBatchProductDescriptions(productUIDs, lang)
          });
        }

        return of({ backendProducts: { data: [] }, descriptions: new Map() });
      })
    ).subscribe({
      next: (res: any) => {
        const backendProducts = res.backendProducts?.data || [];
        const descriptions: Map<string, any> = res.descriptions || new Map();

        // Merge backend product info (sku) with descriptions (name)
        backendProducts.forEach((bp: any) => {
          const name = (descriptions.get && descriptions.get(bp.uid)?.name) || bp.name || 'Unknown Product';
          this.products[bp.uid] = { uid: bp.uid, sku: bp.sku || '-', name };
        });

        // For any descriptions that didn't have a backend product record, still expose the name
        if (descriptions instanceof Map) {
          descriptions.forEach((desc: any, uid: string) => {
            if (!this.products[uid]) {
              this.products[uid] = { uid, sku: '-', name: desc?.name || 'Unknown Product' };
            }
          });
        }

        this.loading = false;
        // Load status history after order and items are loaded
        // Defer to next tick to avoid ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => this.loadHistory());
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load order detail:', err);
        this.error = 'Failed to load order details';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadHistory(): void {
    if (!this.orderUID) return;
    this.historyLoading = true;
    this.http.post<ApiResponse<Record<string, OrderStatusHistory[]>>>(
      `${environment.apiUrl}/order/history?limit=${this.historyLimit}&offset=${this.historyOffset}&sort=${this.historyDesc ? 'desc' : 'asc'}`,
      { data: [this.orderUID] }
    ).subscribe({
      next: (resp) => {
        const map = resp.data || {};
        this.history = map[this.orderUID] || [];
        this.historyLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load order history', err);
        this.history = [];
        this.historyLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  nextHistoryPage(): void {
    this.historyOffset += this.historyLimit;
    this.loadHistory();
  }

  prevHistoryPage(): void {
    this.historyOffset = Math.max(0, this.historyOffset - this.historyLimit);
    this.loadHistory();
  }

  toggleHistorySort(): void {
    this.historyDesc = !this.historyDesc;
    this.historyOffset = 0; // reset paging when sort changes
    this.loadHistory();
  }

  getProductName(uid: string): string {
    return this.products[uid]?.name || 'Unknown Product';
  }

  // Return null by default; Orders list component manages currency lookup.
  getCurrency(code: string): Currency | null {
    return null;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  goBack(): void {
    this.router.navigate(['/admin/orders']);
  }

  calculateSubtotal(item: OrderItem): number {
    return item.quantity * item.price - item.discount;
  }

  getStatusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  hasDeliveryAddress(): boolean {
    return !!this.order &&
      (!!this.order.address_text ||
       !!this.order.city ||
       !!this.order.zipcode ||
       !!this.order.country_code);
  }

  // Mobile UI methods
  get visibleItems(): OrderItem[] {
    if (this.showAllItems) {
      return this.items;
    }
    return this.items.slice(0, this.itemsPreviewLimit);
  }

  get hasMoreItems(): boolean {
    return this.items.length > this.itemsPreviewLimit;
  }

  get hiddenItemsCount(): number {
    return this.items.length - this.itemsPreviewLimit;
  }

  toggleShowAllItems(): void {
    this.showAllItems = !this.showAllItems;
  }
}
