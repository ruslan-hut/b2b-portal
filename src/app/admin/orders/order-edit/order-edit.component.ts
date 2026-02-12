import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { forkJoin, Subscription, Subject, of } from 'rxjs';
import { switchMap, catchError, debounceTime, map } from 'rxjs/operators';
import { TranslationService } from '../../../core/services/translation.service';
import { ProductService } from '../../../core/services/product.service';

interface OrderDetail {
  uid: string;
  number?: string;
  client_uid: string;
  store_uid: string;
  price_type_uid: string;
  currency_code: string;
  status: string;
  total: number;
  discount_percent?: number;
  vat_rate?: number;
  subtotal?: number;
  total_vat?: number;
  original_total?: number;
  discount_amount?: number;
  shipping_address: string;
  country_code?: string;
  zipcode?: string;
  city?: string;
  address_text?: string;
  items?: OrderEditItem[];
}

interface OrderEditItem {
  order_uid?: string;
  product_uid: string;
  product_sku?: string;
  quantity: number;
  price?: number;
  price_discount?: number;
  discount?: number;
  tax?: number;
  total?: number;
}

interface Client {
  uid: string;
  name: string;
  email: string;
  discount: number;
  vat_rate?: number;
  language?: string;
}

interface ClientAddress {
  uid: string;
  client_uid: string;
  country_code: string;
  zipcode?: string;
  city?: string;
  address_text?: string;
  is_default: boolean;
}

interface Product {
  uid: string;
  sku: string;
  name: string;
  price?: number;
}

interface InventoryItem {
  store_uid: string;
  product_uid: string;
  quantity: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

interface OrderEditRequest {
  order_uid: string;
  items?: { product_uid: string; quantity: number }[];
  discount_percent?: number;
  address_uid?: string;
}

@Component({
  selector: 'app-order-edit',
  templateUrl: './order-edit.component.html',
  styleUrl: './order-edit.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderEditComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private searchSubject = new Subject<string>();

  orderUID: string = '';
  order: OrderDetail | null = null;
  previewOrder: OrderDetail | null = null;
  client: Client | null = null;
  products: { [uid: string]: Product } = {};
  inventory: { [productUid: string]: number } = {};

  // Form state
  editItems: OrderEditItem[] = [];
  discountPercent: number | null = null;
  clientAddresses: ClientAddress[] = [];
  selectedAddressUID: string | null = null;
  originalAddressUID: string | null = null; // To track if address changed

  // Product search
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  productSearchQuery = '';
  filteredProducts: Product[] = [];
  searchHighlightIndex = -1;
  recentlyAddedProductUID: string | null = null;

  loading = true;
  saving = false;
  previewLoading = false;
  inventoryLoading = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Navigation origin tracking
  private fromLocation: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private translationService: TranslationService,
    private productService: ProductService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.orderUID = this.route.snapshot.params['id'];
    this.fromLocation = this.route.snapshot.queryParams['from'] || null;
    this.loadOrderData();

    this.subscriptions.add(
      this.searchSubject.pipe(
        debounceTime(300),
        switchMap(query => {
          if (!query.trim() || !this.order?.store_uid) return of([]);
          const language = this.client?.language || 'en';
          const params = new HttpParams()
            .set('q', query)
            .set('store_uid', this.order.store_uid)
            .set('language', language)
            .set('limit', '10');
          return this.http.get<ApiResponse<any[]>>(
            `${environment.apiUrl}/admin/products/search`, { params }
          ).pipe(map(r => r.data || []), catchError(() => of([])));
        })
      ).subscribe(results => {
        this.filteredProducts = results.filter(
          (p: any) => !this.editItems.some(item => item.product_uid === p.uid)
        );
        this.searchHighlightIndex = -1;
        this.cdr.detectChanges();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadOrderData(): void {
    this.loading = true;
    this.error = null;

    // Fetch order and items
    this.http.post<ApiResponse<OrderDetail[]>>(`${environment.apiUrl}/order/batch`, {
      data: [this.orderUID]
    }).pipe(
      switchMap(orderResponse => {
        if (!orderResponse.data || orderResponse.data.length === 0) {
          throw new Error('Order not found');
        }
        this.order = orderResponse.data[0];

        // Initialize form with order data
        this.discountPercent = this.order.discount_percent ?? null;

        return forkJoin({
          client: this.http.post<ApiResponse<Client[]>>(`${environment.apiUrl}/client/batch`, {
            data: [this.order.client_uid]
          }),
          items: this.http.post<ApiResponse<OrderEditItem[]>>(`${environment.apiUrl}/order/items/batch`, {
            data: [this.orderUID]
          }),
          addresses: this.http.post<ApiResponse<Record<string, ClientAddress[]>>>(`${environment.apiUrl}/client_address/find/client`, {
            data: [this.order.client_uid]
          })
        });
      }),
      switchMap(({ client, items, addresses }) => {
        this.client = client.data?.[0] || null;
        this.editItems = (items.data || []).map(item => ({
          product_uid: item.product_uid,
          product_sku: item.product_sku,
          quantity: item.quantity,
          price: item.price,
          price_discount: item.price_discount,
          discount: item.discount,
          tax: item.tax,
          total: item.total
        }));

        // Store client addresses and find matching address
        const addressMap = addresses.data || {};
        this.clientAddresses = addressMap[this.order!.client_uid] || [];
        // Sort addresses: default first, then by city
        this.clientAddresses.sort((a, b) => {
          if (a.is_default && !b.is_default) return -1;
          if (!a.is_default && b.is_default) return 1;
          return (a.city || '').localeCompare(b.city || '');
        });

        // Find matching address from order's current address fields
        const matchingAddress = this.clientAddresses.find(addr =>
          addr.country_code === this.order?.country_code &&
          addr.city === this.order?.city &&
          addr.zipcode === this.order?.zipcode &&
          addr.address_text === this.order?.address_text
        );
        this.selectedAddressUID = matchingAddress?.uid || (this.clientAddresses.find(a => a.is_default)?.uid) || null;
        this.originalAddressUID = this.selectedAddressUID;

        // Get product UIDs for descriptions (only existing order items)
        const allProductUIDs = [
          ...new Set(this.editItems.map(item => item.product_uid))
        ];

        const lang = this.translationService.getCurrentLanguage();
        return forkJoin({
          backendProducts: this.http.post<ApiResponse<any[]>>(`${environment.apiUrl}/product/batch`, { data: allProductUIDs }),
          descriptions: this.productService.getBatchProductDescriptions(allProductUIDs, lang)
        });
      })
    ).subscribe({
      next: (res: any) => {
        const backendProducts = res.backendProducts?.data || [];
        const descriptions: Map<string, any> = res.descriptions || new Map();

        // Build products lookup
        backendProducts.forEach((bp: any) => {
          const name = (descriptions.get && descriptions.get(bp.uid)?.name) || bp.name || 'Unknown Product';
          this.products[bp.uid] = { uid: bp.uid, sku: bp.sku || '-', name };
        });

        this.loading = false;
        this.cdr.detectChanges();

        // Load inventory and initial preview
        this.loadInventory();
        this.loadPreview();
      },
      error: (err) => {
        console.error('Failed to load order data:', err);
        this.error = 'Failed to load order data';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadInventory(): void {
    if (!this.order?.store_uid) return;

    // Get product UIDs from edit items
    const productUIDs = [...new Set(
      this.editItems.map(item => item.product_uid)
    )];

    if (productUIDs.length === 0) return;

    this.inventoryLoading = true;
    this.cdr.detectChanges();

    this.http.post<ApiResponse<any>>(`${environment.apiUrl}/store/inventory/available`, {
      data: [{
        store_uid: this.order.store_uid,
        product_uids: productUIDs
      }]
    })
    .subscribe({
      next: (resp) => {
        // Response format: { store_uid: { product_uid: quantity } }
        const storeData = resp.data?.[this.order!.store_uid];
        if (storeData && typeof storeData === 'object') {
          // storeData is { product_uid: quantity }
          Object.entries(storeData).forEach(([productUid, quantity]) => {
            this.inventory[productUid] = quantity as number;
          });
        }
        this.inventoryLoading = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[OrderEdit] Failed to load inventory', err);
        this.inventoryLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadPreview(): void {
    if (this.editItems.length === 0) {
      this.error = 'Cannot preview order with no items';
      this.cdr.detectChanges();
      return;
    }

    this.previewLoading = true;
    this.error = null;
    this.cdr.detectChanges();
    const request = this.buildEditRequest();

    this.subscriptions.add(
      this.http.post<ApiResponse<OrderDetail>>(`${environment.apiUrl}/admin/orders/edit/preview`, request)
        .subscribe({
          next: (response) => {
            this.previewOrder = response.data;
            this.previewLoading = false;
            this.cdr.markForCheck();
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Failed to load preview:', err);
            this.error = err.error?.message || 'Failed to load preview';
            this.previewLoading = false;
            this.cdr.markForCheck();
            this.cdr.detectChanges();
          }
        })
    );
  }

  buildEditRequest(): OrderEditRequest {
    const request: OrderEditRequest = {
      order_uid: this.orderUID
    };

    // Include items
    request.items = this.editItems.map(item => ({
      product_uid: item.product_uid,
      quantity: item.quantity
    }));

    // Include discount if changed
    if (this.discountPercent !== null && this.discountPercent !== this.order?.discount_percent) {
      request.discount_percent = this.discountPercent;
    }

    // Include address_uid if changed
    if (this.selectedAddressUID && this.selectedAddressUID !== this.originalAddressUID) {
      request.address_uid = this.selectedAddressUID;
    }

    return request;
  }

  saveOrder(): void {
    if (this.editItems.length === 0) {
      this.error = 'Order must have at least one item';
      return;
    }

    this.saving = true;
    this.error = null;

    const request = this.buildEditRequest();

    this.http.post<ApiResponse<{ order: OrderDetail; message: string }>>(`${environment.apiUrl}/admin/orders/edit`, request)
      .subscribe({
        next: (response) => {
          this.saving = false;
          this.successMessage = response.data.message || 'Order saved successfully';
          this.cdr.detectChanges();

          // Navigate back after a short delay, replacing history so back button works correctly
          setTimeout(() => {
            const queryParams = this.fromLocation ? { from: this.fromLocation } : {};
            this.router.navigate(['/admin/orders', this.orderUID], { replaceUrl: true, queryParams });
          }, 1500);
        },
        error: (err) => {
          console.error('Failed to save order:', err);
          this.error = err.error?.message || 'Failed to save order';
          this.saving = false;
          this.cdr.detectChanges();
        }
      });
  }

  // Item management
  getProductName(uid: string): string {
    return this.products[uid]?.name || 'Unknown Product';
  }

  getProductSKU(uid: string): string {
    return this.products[uid]?.sku || '-';
  }

  getInventoryQuantity(uid: string): number | null {
    const quantity = this.inventory[uid];
    if (quantity === undefined || quantity === null) {
      return null;
    }
    return quantity;
  }

  isStockSufficient(orderQty: number, productUid: string): boolean {
    const inventoryQty = this.getInventoryQuantity(productUid);
    if (inventoryQty === null) return false;
    return orderQty < inventoryQty; // Sufficient only if we have MORE than needed
  }

  isStockInsufficient(orderQty: number, productUid: string): boolean {
    const inventoryQty = this.getInventoryQuantity(productUid);
    if (inventoryQty === null) return false;
    return orderQty >= inventoryQty; // Insufficient if order >= available
  }

  updateQuantity(index: number, delta: number): void {
    const newQty = this.editItems[index].quantity + delta;
    if (newQty > 0) {
      this.editItems[index].quantity = newQty;
      this.cdr.detectChanges();
    }
  }

  setQuantity(index: number, value: number): void {
    if (value > 0) {
      this.editItems[index].quantity = value;
      this.cdr.detectChanges();
    }
  }

  removeItem(index: number): void {
    this.editItems.splice(index, 1);
    this.previewOrder = null; // Clear preview when items change
    this.cdr.detectChanges();
  }

  // Product search
  searchProducts(): void {
    if (!this.productSearchQuery.trim()) {
      this.filteredProducts = [];
      this.searchHighlightIndex = -1;
      this.cdr.detectChanges();
      return;
    }
    this.searchSubject.next(this.productSearchQuery);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (!this.filteredProducts.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.searchHighlightIndex = Math.min(this.searchHighlightIndex + 1, this.filteredProducts.length - 1);
      this.cdr.detectChanges();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.searchHighlightIndex = Math.max(this.searchHighlightIndex - 1, 0);
      this.cdr.detectChanges();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.searchHighlightIndex >= 0 && this.searchHighlightIndex < this.filteredProducts.length) {
        this.selectProduct(this.filteredProducts[this.searchHighlightIndex]);
      }
    }
  }

  selectProduct(product: Product): void {
    // Populate products lookup from search result for display
    this.products[product.uid] = {
      uid: product.uid,
      sku: product.sku,
      name: product.name
    };
    this.editItems.push({
      product_uid: product.uid,
      product_sku: product.sku,
      quantity: 1
    });
    this.productSearchQuery = '';
    this.filteredProducts = [];
    this.searchHighlightIndex = -1;
    this.previewOrder = null;
    this.recentlyAddedProductUID = product.uid;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.recentlyAddedProductUID = null;
      this.cdr.detectChanges();
    }, 2000);
    // Defer to next tick so change detection runs cleanly after DOM update
    setTimeout(() => {
      this.loadInventory();
      this.loadPreview();
    });
  }


  // Discount
  onDiscountChange(): void {
    if (this.discountPercent !== null && (this.discountPercent < 0 || this.discountPercent > 100)) {
      this.discountPercent = Math.max(0, Math.min(100, this.discountPercent));
    }
    this.cdr.detectChanges();
  }

  // Address
  onAddressSelect(addressUID: string): void {
    this.selectedAddressUID = addressUID || null;
  }

  formatAddress(address: ClientAddress): string {
    const parts: string[] = [];
    if (address.address_text) parts.push(address.address_text);
    if (address.city) parts.push(address.city);
    if (address.zipcode) parts.push(address.zipcode);
    if (address.country_code) parts.push(address.country_code);
    return parts.join(', ') || 'No address details';
  }

  getSelectedAddress(): ClientAddress | null {
    if (!this.selectedAddressUID) return null;
    return this.clientAddresses.find(a => a.uid === this.selectedAddressUID) || null;
  }

  // Navigation
  goBack(): void {
    // Replace history so back button returns to where order was opened from
    const queryParams = this.fromLocation ? { from: this.fromLocation } : {};
    this.router.navigate(['/admin/orders', this.orderUID], { replaceUrl: true, queryParams });
  }

  cancel(): void {
    this.goBack();
  }

  // Pricing calculations
  getPreviewItem(editItem: OrderEditItem): OrderEditItem | null {
    if (!this.previewOrder?.items) return null;
    return this.previewOrder.items.find(pItem => pItem.product_uid === editItem.product_uid) || null;
  }

  getPriceWithVat(item: OrderEditItem): number {
    const previewItem = this.getPreviewItem(item);
    if (!previewItem?.price) return 0;
    const vatRate = this.previewOrder?.vat_rate || this.order?.vat_rate || 0;
    return (previewItem.price * (1 + vatRate / 100)) / 100;
  }

  getPriceAfterDiscountWithVat(item: OrderEditItem): number {
    const previewItem = this.getPreviewItem(item);
    if (!previewItem?.price_discount) return this.getPriceWithVat(item);
    const vatRate = this.previewOrder?.vat_rate || this.order?.vat_rate || 0;
    const priceDiscountWithVat = previewItem.price_discount * (1 + vatRate / 100);
    return priceDiscountWithVat / 100;
  }

  getItemSubtotal(item: OrderEditItem): number {
    const previewItem = this.getPreviewItem(item);
    if (previewItem?.total) return previewItem.total / 100;
    const priceWithVat = this.getPriceAfterDiscountWithVat(item);
    return priceWithVat * item.quantity;
  }

  hasDiscount(item: OrderEditItem): boolean {
    const previewItem = this.getPreviewItem(item);
    return previewItem?.discount !== undefined && previewItem.discount > 0;
  }

  getItemDiscount(item: OrderEditItem): number {
    const previewItem = this.getPreviewItem(item);
    return previewItem?.discount || 0;
  }
}
