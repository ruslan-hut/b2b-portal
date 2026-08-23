import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { forkJoin, Subscription, Subject, of } from 'rxjs';
import { switchMap, catchError, debounceTime, map } from 'rxjs/operators';
import { TranslationService } from '../../../core/services/translation.service';
import { ProductService } from '../../../core/services/product.service';
import { AuthService } from '../../../core/services/auth.service';
import { PriceTypeService } from '../../../core/services/price-type.service';
import { PriceType } from '../../../core/models/price-type.model';
import { ApiResponse } from '../../../core/models/api.model';
import { ClientBranchService } from '../../../core/services/client-branch.service';
import { ClientBranch } from '../../../core/models/app-settings.model';
import { sanitizeReturnUrl } from '../../../core/utils/return-url';

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
  delivery_cost?: number;
  shipping_address: string;
  country_code?: string;
  zipcode?: string;
  city?: string;
  address_text?: string;
  items?: OrderEditItem[];
  unpriced_product_uids?: string[];
  /** Staff-only note for the warehouse. Never reaches a client-facing payload. */
  internal_comment?: string;
  /** Selling legal entity the order is invoiced under (ERP GUID + name). */
  company_uid?: string;
  company_name?: string;
}

/** One row of the ERP-owned company directory. */
interface CompanyOption {
  uid: string;
  name: string;
  active?: boolean;
}

interface OrderEditItem {
  order_uid?: string;
  product_uid: string;
  product_sku?: string;
  quantity: number;
  price?: number;
  price_discount?: number;
  // Gross unit prices (cents) calculated by backend. Frontend never recomputes.
  price_with_vat?: number;
  price_after_discount_with_vat?: number;
  discount?: number;
  tax?: number;
  total?: number;
}

// A single product that blocks order confirmation, returned in the API error's extra.problems.
interface OrderProblem {
  product_uid: string;
  sku?: string;
  name?: string;
  reason: string; // "inactive" | "insufficient_stock"
  available?: number;
  requested?: number;
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
  /** Branch this address belongs to; empty = the client is billed directly. */
  branch_uid?: string;
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

interface OrderEditRequest {
  order_uid: string;
  items?: { product_uid: string; quantity: number }[];
  discount_percent?: number;
  address_uid?: string;
  delivery_cost?: number;
  price_type_uid?: string;
  company_uid?: string;
  internal_comment?: string;
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
  deliveryCost: number | null = null; // In main currency units (e.g., 15.00)
  clientAddresses: ClientAddress[] = [];
  // Client branches, read-only. Used to name the branch an address belongs to.
  branches: ClientBranch[] = [];
  selectedAddressUID: string | null = null;
  originalAddressUID: string | null = null; // To track if address changed

  // Staff-only note for the warehouse, edited here and exchanged with the ERP.
  // Never rendered on any client-facing screen.
  internalComment = '';
  private originalInternalComment = '';

  // Selling legal entity. Staff (admins and managers) may reassign the order to
  // any active company; only active ones are offered, so an ERP-deactivated
  // company cannot be picked by mistake.
  companies: CompanyOption[] = [];
  selectedCompanyUID: string | null = null;
  originalCompanyUID: string | null = null;

  // Price type (admin-only switch)
  priceTypes: PriceType[] = [];
  selectedPriceTypeUID: string | null = null;
  originalPriceTypeUID: string | null = null;
  // Product UIDs the current price type has no price for (reported by the
  // preview recalc). Drives an inline warning; does not block the dropdown.
  unpricedProductUIDs = new Set<string>();

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
  refreshingAddresses = false;
  confirming = false;
  error: string | null = null;
  successMessage: string | null = null;
  inactiveProductUIDs = new Set<string>();
  missingProductUIDs = new Set<string>();
  // True when a confirm failed solely on insufficient-stock problems and the
  // current user is an admin — enables the "confirm anyway" stock override.
  stockBypassAvailable = false;

  get isDraft(): boolean {
    return this.order?.status === 'draft';
  }

  get isAdmin(): boolean {
    return this.authService.isAdmin;
  }

  get canConfirm(): boolean {
    return this.isDraft
      && this.editItems.length > 0
      && !!this.selectedAddressUID
      && !this.saving
      && !this.confirming
      && !this.previewLoading;
  }

  // Navigation origin tracking
  private fromLocation: string | null = null;
  /** In-app URL the originating list wants the user returned to. */
  private returnUrl: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private translationService: TranslationService,
    private productService: ProductService,
    private authService: AuthService,
    private priceTypeService: PriceTypeService,
    private clientBranchService: ClientBranchService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.orderUID = this.route.snapshot.params['id'];
    this.fromLocation = this.route.snapshot.queryParams['from'] || null;
    this.returnUrl = sanitizeReturnUrl(this.route.snapshot.queryParams['returnUrl']);
    this.loadOrderData();

    // Price-type switching is admin-only; only fetch the list for admins.
    if (this.isAdmin) {
      this.subscriptions.add(
        this.priceTypeService.getPriceTypes().subscribe(map => {
          this.priceTypes = Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
          this.cdr.markForCheck();
        })
      );
    }

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
        this.cdr.markForCheck();
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
        this.deliveryCost = this.order.delivery_cost ? this.order.delivery_cost / 100 : null;
        this.selectedPriceTypeUID = this.order.price_type_uid || null;
        this.originalPriceTypeUID = this.selectedPriceTypeUID;
        this.selectedCompanyUID = this.order.company_uid || null;
        this.originalCompanyUID = this.selectedCompanyUID;
        this.internalComment = this.order.internal_comment || '';
        this.originalInternalComment = this.internalComment;

        return forkJoin({
          client: this.http.post<ApiResponse<Client[]>>(`${environment.apiUrl}/client/batch`, {
            data: [this.order.client_uid]
          }),
          items: this.http.post<ApiResponse<OrderEditItem[]>>(`${environment.apiUrl}/order/items/batch`, {
            data: [this.orderUID]
          }),
          addresses: this.http.post<ApiResponse<Record<string, ClientAddress[]>>>(`${environment.apiUrl}/client_address/find/client`, {
            data: [this.order.client_uid]
          }),
          // Branches are needed only to name the one an address belongs to.
          // Non-fatal: without them the address selector still works, it just
          // cannot label the branch.
          branches: this.clientBranchService.getForClient(this.order.client_uid).pipe(
            catchError(() => of<ClientBranch[]>([]))
          )
        });
      }),
      switchMap(({ client, items, addresses, branches }) => {
        this.branches = branches;
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

        // After the order is in hand: the list is filtered against the company it
        // already carries, so it cannot run before this point.
        this.loadCompanies();

        this.loading = false;
        this.cdr.markForCheck();

        // Load inventory and initial preview
        this.loadInventory();
        this.loadPreview();
      },
      error: (err) => {
        console.error('Failed to load order data:', err);
        this.error = 'Failed to load order data';
        this.loading = false;
        this.cdr.markForCheck();
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
    this.cdr.markForCheck();

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
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('[OrderEdit] Failed to load inventory', err);
        this.inventoryLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  loadPreview(): void {
    if (this.editItems.length === 0) {
      // Fresh draft with no items yet — leave the preview blank without raising an error.
      this.previewOrder = null;
      this.unpricedProductUIDs.clear();
      this.cdr.markForCheck();
      return;
    }

    this.previewLoading = true;
    this.error = null;
    this.cdr.markForCheck();
    const request = this.buildEditRequest();

    this.subscriptions.add(
      this.http.post<ApiResponse<OrderDetail>>(`${environment.apiUrl}/admin/orders/edit/preview`, request)
        .subscribe({
          next: (response) => {
            this.previewOrder = response.data;
            this.unpricedProductUIDs = new Set(response.data?.unpriced_product_uids || []);
            this.previewLoading = false;
            this.cdr.markForCheck();
          },
          error: (err) => {
            console.error('Failed to load preview:', err);
            // API errors are nested at error.error.message; fall back progressively.
            this.error = err.error?.error?.message || err.error?.message || 'Failed to load preview';
            this.unpricedProductUIDs.clear();
            this.previewLoading = false;
            this.cdr.markForCheck();
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

    // Include delivery cost (convert from currency units to cents)
    const currentDeliveryCostCents = this.order?.delivery_cost || 0;
    const newDeliveryCostCents = Math.round((this.deliveryCost || 0) * 100);
    if (newDeliveryCostCents !== currentDeliveryCostCents) {
      request.delivery_cost = newDeliveryCostCents;
    }

    // Include price type if an admin switched it (backend enforces admin-only).
    if (this.selectedPriceTypeUID && this.selectedPriceTypeUID !== this.originalPriceTypeUID) {
      request.price_type_uid = this.selectedPriceTypeUID;
    }

    // Include the warehouse note only when edited. Sent as a plain string so an
    // emptied box clears it, rather than being read as "leave it alone".
    if (this.internalComment !== this.originalInternalComment) {
      request.internal_comment = this.internalComment;
    }

    // Include the company only when reassigned. An empty string is meaningful —
    // it clears the assignment — so the check is against the original, not truthiness.
    if (this.selectedCompanyUID !== this.originalCompanyUID) {
      request.company_uid = this.selectedCompanyUID || '';
    }

    return request;
  }

  // Loads the ERP company directory. One page is enough — the directory is small.
  // The order's own company is kept in the list even when the ERP has since
  // deactivated it, so the selector shows what the order actually carries
  // instead of silently reading as "no company".
  private loadCompanies(): void {
    this.subscriptions.add(
      this.http.get<ApiResponse<CompanyOption[]>>(`${environment.apiUrl}/company?count=500`).pipe(
        map(response => response.data || []),
        catchError(() => of<CompanyOption[]>([]))
      ).subscribe(companies => {
        this.companies = companies
          .filter(c => c.active !== false || c.uid === this.order?.company_uid)
          .map(c => ({ uid: c.uid, name: c.name || c.uid, active: c.active }))
          .sort((a, b) => a.name.localeCompare(b.name));
        this.cdr.markForCheck();
      })
    );
  }

  onCompanySelect(companyUID: string): void {
    // Nothing monetary depends on the company, so no preview refresh is needed.
    this.selectedCompanyUID = companyUID || null;
  }

  onPriceTypeSelect(priceTypeUID: string): void {
    this.selectedPriceTypeUID = priceTypeUID || null;
    // Price type drives every item's base price and the order currency — refresh totals.
    this.loadPreview();
  }

  hasUnpricedProduct(productUID: string): boolean {
    return this.unpricedProductUIDs.has(productUID);
  }

  get hasUnpricedProducts(): boolean {
    return this.unpricedProductUIDs.size > 0;
  }

  saveOrder(): void {
    if (this.saving || this.confirming) return; // guard against double-submit
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
          this.cdr.markForCheck();

          // Navigate back after a short delay, replacing history so back button works correctly
          setTimeout(() => {
            this.router.navigate(['/admin/orders', this.orderUID], {
              replaceUrl: true,
              queryParams: this.detailQueryParams()
            });
          }, 1500);
        },
        error: (err) => {
          console.error('Failed to save order:', err);
          this.error = err.error?.error?.message || err.error?.message || 'Failed to save order';
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  // Save the current edit state as draft, then promote it to "new" via the admin
  // confirm endpoint. Used by the Confirm Order button on draft orders.
  // bypassStock (admin-only) confirms the order even when items are short on
  // stock, deliberately overselling. Offered via a secondary button after a
  // confirm fails solely on insufficient-stock problems.
  confirmOrder(bypassStock = false): void {
    if (!this.canConfirm) return;

    this.confirming = true;
    this.error = null;
    this.inactiveProductUIDs.clear();
    this.missingProductUIDs.clear();
    this.stockBypassAvailable = false;
    this.cdr.markForCheck();

    const editRequest = this.buildEditRequest();

    this.http.post<ApiResponse<{ order: OrderDetail; message: string }>>(
      `${environment.apiUrl}/admin/orders/edit`, editRequest
    ).pipe(
      switchMap(() => this.http.post<ApiResponse<{ order: OrderDetail; message: string }>>(
        `${environment.apiUrl}/admin/orders/confirm`, { order_uid: this.orderUID, bypass_stock: bypassStock }
      ))
    ).subscribe({
      next: (response) => {
        this.confirming = false;
        this.successMessage = response.data.message || 'Order confirmed';
        this.cdr.markForCheck();
        setTimeout(() => {
          this.router.navigate(['/admin/orders', this.orderUID], {
            replaceUrl: true,
            queryParams: this.detailQueryParams()
          });
        }, 1200);
      },
      error: (err) => {
        console.error('Failed to confirm order:', err);
        const apiError = err.error?.error;
        const details = apiError?.details;
        const problems = apiError?.extra?.problems as OrderProblem[] | undefined;
        if (details?.reason === 'validation' && problems?.length) {
          // Admins can override when the ONLY blockers are insufficient stock.
          this.stockBypassAvailable = this.isAdmin && !bypassStock
            && problems.every((p) => p.reason === 'insufficient_stock');
          const lines = problems.map((p) => {
            const name = this.getProductName(p.product_uid);
            const sku = p.sku || this.getProductSKU(p.product_uid);
            if (p.reason === 'inactive') {
              this.inactiveProductUIDs.add(p.product_uid);
              const reason = this.translationService.instant('admin.orders.problemInactive') || 'product is inactive';
              return `• ${name} (${sku}): ${reason}`;
            }
            if (p.reason === 'insufficient_stock') {
              const reason = this.translationService.instant('admin.orders.problemInsufficientStock', {
                available: p.available ?? 0,
                requested: p.requested ?? 0,
              }) || `insufficient stock (available ${p.available ?? 0}, requested ${p.requested ?? 0})`;
              return `• ${name} (${sku}): ${reason}`;
            }
            if (p.reason === 'not_found') {
              this.missingProductUIDs.add(p.product_uid);
              const reason = this.translationService.instant('admin.orders.problemNotFound') || 'product no longer exists';
              return `• ${name} (${sku}): ${reason}`;
            }
            return `• ${name} (${sku}): ${p.reason}`;
          });
          this.error = `${this.translationService.instant('admin.orders.validationError') || 'Order cannot be confirmed. Fix the following items:'}\n${lines.join('\n')}`;
        } else if (details?.reason === 'inactive_product' && details.product_uid) {
          this.inactiveProductUIDs.add(details.product_uid);
          const sku = details.sku || this.getProductSKU(details.product_uid);
          const name = this.getProductName(details.product_uid);
          this.error = this.translationService.instant('admin.orders.inactiveProductError', { name, sku })
            || `Product "${name}" (${sku}) is inactive and must be removed before confirming the order.`;
        } else {
          this.error = apiError?.message || err.error?.status_message || err.error?.message || 'Failed to confirm order';
        }
        this.confirming = false;
        this.cdr.markForCheck();
      }
    });
  }

  isInactiveProduct(productUID: string): boolean {
    return this.inactiveProductUIDs.has(productUID);
  }

  isMissingProduct(productUID: string): boolean {
    return this.missingProductUIDs.has(productUID);
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
    return orderQty <= inventoryQty;
  }

  isStockInsufficient(orderQty: number, productUid: string): boolean {
    const inventoryQty = this.getInventoryQuantity(productUid);
    if (inventoryQty === null) return false;
    return orderQty > inventoryQty;
  }

  updateQuantity(index: number, delta: number): void {
    const newQty = this.editItems[index].quantity + delta;
    if (newQty > 0) {
      this.editItems[index].quantity = newQty;
      this.cdr.markForCheck();
    }
  }

  setQuantity(index: number, value: number): void {
    if (value > 0) {
      this.editItems[index].quantity = value;
      this.cdr.markForCheck();
    }
  }

  removeItem(index: number): void {
    this.editItems.splice(index, 1);
    this.previewOrder = null; // Clear preview when items change
    this.cdr.markForCheck();
  }

  // Product search
  searchProducts(): void {
    if (!this.productSearchQuery.trim()) {
      this.filteredProducts = [];
      this.searchHighlightIndex = -1;
      this.cdr.markForCheck();
      return;
    }
    this.searchSubject.next(this.productSearchQuery);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (!this.filteredProducts.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.searchHighlightIndex = Math.min(this.searchHighlightIndex + 1, this.filteredProducts.length - 1);
      this.cdr.markForCheck();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.searchHighlightIndex = Math.max(this.searchHighlightIndex - 1, 0);
      this.cdr.markForCheck();
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
    this.editItems.unshift({
      product_uid: product.uid,
      product_sku: product.sku,
      quantity: 1
    });
    this.productSearchQuery = '';
    this.filteredProducts = [];
    this.searchHighlightIndex = -1;
    this.previewOrder = null;
    this.recentlyAddedProductUID = product.uid;
    this.cdr.markForCheck();
    setTimeout(() => {
      this.recentlyAddedProductUID = null;
      this.cdr.markForCheck();
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
    this.cdr.markForCheck();
  }

  // Address
  onAddressSelect(addressUID: string): void {
    this.selectedAddressUID = addressUID || null;
    const addr = this.getSelectedAddress();
    if (addr && this.order) {
      this.order.address_text = addr.address_text || '';
      this.order.city = addr.city || '';
      this.order.zipcode = addr.zipcode || '';
      this.order.country_code = addr.country_code || '';
    }
  }

  refreshClientAddresses(): void {
    if (!this.order?.client_uid || this.refreshingAddresses) return;

    this.refreshingAddresses = true;
    this.cdr.markForCheck();

    this.http.post<ApiResponse<Record<string, ClientAddress[]>>>(`${environment.apiUrl}/client_address/find/client`, {
      data: [this.order.client_uid]
    }).subscribe({
      next: (response) => {
        const addressMap = response.data || {};
        this.clientAddresses = addressMap[this.order!.client_uid] || [];
        this.clientAddresses.sort((a, b) => {
          if (a.is_default && !b.is_default) return -1;
          if (!a.is_default && b.is_default) return 1;
          return (a.city || '').localeCompare(b.city || '');
        });

        // Auto-select default address and force address_uid to be sent on save
        // (address data may have changed even though UID is the same)
        const defaultAddr = this.clientAddresses.find(a => a.is_default);
        if (defaultAddr) {
          this.selectedAddressUID = defaultAddr.uid;
          // Update order's displayed address to reflect the new selection
          this.order!.address_text = defaultAddr.address_text || '';
          this.order!.city = defaultAddr.city || '';
          this.order!.zipcode = defaultAddr.zipcode || '';
          this.order!.country_code = defaultAddr.country_code || '';
        }
        this.originalAddressUID = null;

        this.refreshingAddresses = false;
        this.cdr.markForCheck();

        // Address may have changed (country affects VAT) — recalculate totals
        this.loadPreview();
      },
      error: () => {
        this.refreshingAddresses = false;
        this.cdr.markForCheck();
      }
    });
  }

  hasOrderAddress(): boolean {
    return !!this.order &&
      (!!this.order.address_text || !!this.order.city || !!this.order.zipcode || !!this.order.country_code);
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

  /**
   * Name of the branch the selected address belongs to, or '' when it belongs to
   * the client directly.
   *
   * Read-only: the branch follows the address, it is never picked separately.
   * Shown because changing the address can change which legal entity the order
   * is invoiced to — and its VAT rate with it — which is not otherwise visible
   * from an address line.
   */
  getSelectedBranchName(): string {
    const addr = this.getSelectedAddress();
    if (!addr?.branch_uid) return '';
    const branch = this.branches.find(b => b.uid === addr.branch_uid);
    return branch ? branch.name : addr.branch_uid;
  }

  /**
   * True when an address is billed to a branch the ERP has deactivated. Staff
   * may still pick it — they may be fixing an order the ERP has since changed —
   * but confirmation will refuse it, so the state is labelled here.
   */
  isAddressBranchInactive(address: ClientAddress | null): boolean {
    if (!address?.branch_uid) return false;
    const branch = this.branches.find(b => b.uid === address.branch_uid);
    return !!branch && !branch.active;
  }

  /** Whether the address currently on the order is billed to an inactive branch. */
  get selectedBranchInactive(): boolean {
    return this.isAddressBranchInactive(this.getSelectedAddress());
  }

  /**
   * The origin markers to hand back to the order detail, so that page's own
   * "back" still knows which list — and which list state — the user came from.
   */
  private detailQueryParams(): { [key: string]: string } {
    const queryParams: { [key: string]: string } = {};
    if (this.fromLocation) {
      queryParams['from'] = this.fromLocation;
    }
    if (this.returnUrl) {
      queryParams['returnUrl'] = this.returnUrl;
    }
    return queryParams;
  }

  // Navigation
  goBack(): void {
    // Replace history so back button returns to where order was opened from
    this.router.navigate(['/admin/orders', this.orderUID], {
      replaceUrl: true,
      queryParams: this.detailQueryParams()
    });
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
    if (!previewItem?.price_with_vat) return 0;
    return previewItem.price_with_vat / 100;
  }

  getPriceAfterDiscountWithVat(item: OrderEditItem): number {
    const previewItem = this.getPreviewItem(item);
    if (previewItem?.price_after_discount_with_vat) {
      return previewItem.price_after_discount_with_vat / 100;
    }
    return this.getPriceWithVat(item);
  }

  getItemSubtotal(item: OrderEditItem): number {
    const previewItem = this.getPreviewItem(item);
    if (previewItem?.total) return previewItem.total / 100;
    return this.getPriceAfterDiscountWithVat(item) * item.quantity;
  }

  /**
   * True when the backend preview (authoritative pricing) is available for this
   * item. The template shows a pending placeholder rather than the local
   * fallback estimate until this is true, so the operator never sees a number
   * that might differ from what the backend will actually charge.
   */
  hasBackendPreview(item: OrderEditItem): boolean {
    return this.getPreviewItem(item) !== null;
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
