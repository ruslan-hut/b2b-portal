import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { forkJoin, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Currency } from '../../../core/models/currency.model';
import { ProductService } from '../../../core/services/product.service';
import { TranslationService } from '../../../core/services/translation.service';
import { InvoiceService, InvoiceType, Invoice } from '../../../core/services/invoice.service';
import { UserService, AdminUser } from '../../../core/services/user.service';
import { BoxService } from '../../shipment/services/box.service';
import { ShipmentBox } from '../../shipment/models/shipment-box.model';

interface ShipmentServiceSettings {
  enabled: boolean;
  service_running: boolean;
  active_carrier_count: number;
}

interface ShipmentCarrier {
  uid: string;
  name: string;
  carrier_type: string;
  active: boolean;
}

interface Shipment {
  uid: string;
  order_uid: string;
  carrier_uid: string;
  tracking_number: string | null;
  tracking_url: string | null;
  carrier_shipment_id: string | null;
  status: string;
  status_description: string | null;
  label_format: string | null;
  receiver_name: string;
  receiver_city: string;
  receiver_postal_code: string;
  receiver_country_code: string;
  weight_kg: number | null;
  pieces_count: number;
  shipped_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
  created_at: string;
  last_update: string;
  events?: ShipmentEvent[];
}

interface ShipmentEvent {
  uid: string;
  event_code: string;
  event_status: string;
  event_description: string | null;
  terminal_name: string | null;
  terminal_city: string | null;
  event_timestamp: string;
  received_at: string;
}

interface CrmPipelineStage {
  uid: string;
  name: string;
  allow_create_shipment: boolean;
}

interface OrderPipeline {
  order_uid: string;
  stage_uid: string;
  stage?: CrmPipelineStage;
}

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

interface InventoryItem {
  store_uid: string;
  product_uid: string;
  quantity: number;
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
  inventory: { [productUid: string]: number } = {};
  loading = true;
  error: string | null = null;

  // Edit permission state
  canEdit = false;
  canEditReason = '';
  checkingEditPermission = false;

  // History state
  history: OrderStatusHistory[] = [];
  historyLimit = 10;
  historyOffset = 0;
  historyDesc = true; // default: newest first
  historyLoading = false;

  // Mobile UI state
  showAllItems = false;
  itemsPreviewLimit = 5;

  // Navigation origin tracking
  private fromLocation: string | null = null;

  // Invoice state
  invoiceTypes: InvoiceType[] = [];
  orderInvoices: Invoice[] = [];
  showInvoiceModal = false;
  invoiceLoading = false;
  invoiceRequesting = false;
  selectedInvoiceTypeUid: string = '';

  // Users map for invoice requested_by lookup
  usersMap: Map<string, AdminUser> = new Map();

  // Shipment state
  shipmentServiceEnabled = false;
  shipmentCarriers: ShipmentCarrier[] = [];
  orderShipments: Shipment[] = [];
  shipmentLoading = false;
  showCreateShipmentModal = false;
  selectedCarrierUid = '';
  shipmentWeight = 0.5;
  shipmentPieces = 1;
  creatingShipment = false;
  trackingShipmentUid: string | null = null;
  stageAllowsShipment = false; // Whether current CRM stage allows shipment creation

  // Box selection state
  availableBoxes: ShipmentBox[] = [];
  selectedBoxUID: string | null = null;
  shipmentLength: number | null = null;
  shipmentWidth: number | null = null;
  shipmentHeight: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private http: HttpClient,
    private productService: ProductService,
    private translationService: TranslationService,
    private invoiceService: InvoiceService,
    private userService: UserService,
    private boxService: BoxService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.orderUID = this.route.snapshot.params['id'];
    this.fromLocation = this.route.snapshot.queryParams['from'] || null;
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
          items: this.http.post<ApiResponse<OrderItem[]>>(`${environment.apiUrl}/order/items/batch`, {
            data: [this.orderUID]
          })
        });
      }),
      switchMap(({ client, items }) => {
        this.client = client.data?.[0] || null;
        this.items = items.data || [];

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
        // Load inventory, status history, invoice data, shipment data, and check edit permission after order and items are loaded
        // Defer to next tick to avoid ExpressionChangedAfterItHasBeenCheckedError
        setTimeout(() => {
          this.loadInventory();
          this.loadHistory();
          this.checkEditPermission();
          this.loadInvoiceData();
          this.loadShipmentData();
        });
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

  loadInventory(): void {
    if (!this.order?.store_uid || this.items.length === 0) return;

    const productUIDs = [...new Set(this.items.map(item => item.product_uid))];

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
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[OrderDetail] Failed to load inventory', err);
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
    if (this.fromLocation === 'crm') {
      this.router.navigate(['/admin/crm']);
    } else {
      this.router.navigate(['/admin/orders']);
    }
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

  checkEditPermission(): void {
    if (!this.orderUID) return;
    this.checkingEditPermission = true;

    this.http.post<ApiResponse<{ can_edit: boolean; reason?: string }>>(
      `${environment.apiUrl}/admin/orders/edit/check`,
      { order_uid: this.orderUID }
    ).subscribe({
      next: (resp) => {
        this.canEdit = resp.data?.can_edit || false;
        this.canEditReason = resp.data?.reason || '';
        this.checkingEditPermission = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to check edit permission', err);
        this.canEdit = false;
        this.checkingEditPermission = false;
        this.cdr.detectChanges();
      }
    });
  }

  editOrder(): void {
    const queryParams = this.fromLocation ? { from: this.fromLocation } : {};
    this.router.navigate(['/admin/orders', this.orderUID, 'edit'], { queryParams });
  }

  viewClientProfile(): void {
    if (!this.client?.uid) return;
    this.router.navigate(['/admin/clients', this.client.uid], {
      queryParams: {
        from: 'order',
        orderUid: this.orderUID
      }
    });
  }

  // Invoice methods
  loadInvoiceData(): void {
    if (!this.orderUID) return;
    this.invoiceLoading = true;

    // Load types for this order, existing invoices, and users in parallel
    forkJoin({
      types: this.invoiceService.getTypesForOrder(this.orderUID),
      invoices: this.invoiceService.getInvoicesForOrders([this.orderUID]),
      users: this.userService.getUsers(['admin', 'manager'])
    }).subscribe({
      next: ({ types, invoices, users }) => {
        this.invoiceTypes = types.filter(t => t.active);
        this.orderInvoices = invoices;
        this.usersMap = new Map(users.map(u => [u.uid, u]));
        this.invoiceLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load invoice data:', err);
        this.invoiceTypes = [];
        this.orderInvoices = [];
        this.invoiceLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get canRequestInvoice(): boolean {
    return this.invoiceTypes.length > 0;
  }

  openInvoiceModal(): void {
    if (this.invoiceTypes.length === 1) {
      // Single type available - request directly
      this.selectedInvoiceTypeUid = this.invoiceTypes[0].uid;
      this.requestInvoice();
    } else {
      // Multiple types - show modal
      this.selectedInvoiceTypeUid = '';
      this.showInvoiceModal = true;
    }
  }

  closeInvoiceModal(): void {
    this.showInvoiceModal = false;
    this.selectedInvoiceTypeUid = '';
  }

  requestInvoice(): void {
    if (!this.selectedInvoiceTypeUid || !this.orderUID) return;

    this.invoiceRequesting = true;
    this.invoiceService.requestInvoice(this.orderUID, this.selectedInvoiceTypeUid).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Add new invoice to list
          this.orderInvoices = [response.data, ...this.orderInvoices];
        }
        this.invoiceRequesting = false;
        this.closeInvoiceModal();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to request invoice:', err);
        this.invoiceRequesting = false;
        this.cdr.detectChanges();
      }
    });
  }

  openInvoice(invoice: Invoice): void {
    this.invoiceService.openInvoice(invoice);
  }

  getInvoiceTypeName(typeUid: string): string {
    const type = this.invoiceTypes.find(t => t.uid === typeUid);
    return type?.name || typeUid;
  }

  getInvoiceStatusClass(invoice: Invoice): string {
    if (invoice.error) return 'invoice-error';
    if (invoice.status_code >= 200 && invoice.status_code < 300) return 'invoice-success';
    return 'invoice-warning';
  }

  getRequestedByName(uid: string | undefined): string {
    if (!uid) return '-';
    const user = this.usersMap.get(uid);
    if (!user) return uid;
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return fullName || user.username;
  }

  // Shipment methods
  loadShipmentData(): void {
    if (!this.orderUID) return;
    this.shipmentLoading = true;

    // Load service settings, carriers, existing shipments, and CRM pipeline info
    forkJoin({
      settings: this.http.get<{ data: ShipmentServiceSettings }>(`${environment.apiUrl}/admin/shipment/settings`),
      carriers: this.http.post<{ data: ShipmentCarrier[] }>(`${environment.apiUrl}/admin/shipment/carriers/active`, {}),
      shipments: this.http.post<{ data: Shipment[] }>(`${environment.apiUrl}/admin/orders/shipment/list`, {
        data: { order_uid: this.orderUID }
      }),
      pipeline: this.http.post<{ data: Record<string, OrderPipeline> }>(`${environment.apiUrl}/admin/crm/board/pipeline/batch`, {
        data: [this.orderUID]
      })
    }).subscribe({
      next: ({ settings, carriers, shipments, pipeline }) => {
        this.shipmentServiceEnabled = settings.data?.service_running || false;
        this.shipmentCarriers = carriers.data || [];
        this.orderShipments = shipments.data || [];

        // Check if current CRM stage allows shipment creation
        const orderPipeline = pipeline.data?.[this.orderUID];
        this.stageAllowsShipment = orderPipeline?.stage?.allow_create_shipment || false;

        this.shipmentLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load shipment data:', err);
        this.shipmentServiceEnabled = false;
        this.shipmentCarriers = [];
        this.orderShipments = [];
        this.stageAllowsShipment = false;
        this.shipmentLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  get canCreateShipment(): boolean {
    // Can create shipment if:
    // 1. Shipment service is running
    // 2. At least one active carrier exists
    // 3. Current CRM stage allows shipment creation
    return this.shipmentServiceEnabled &&
           this.shipmentCarriers.length > 0 &&
           this.stageAllowsShipment;
  }

  openCreateShipmentModal(): void {
    if (this.shipmentCarriers.length === 1) {
      this.selectedCarrierUid = this.shipmentCarriers[0].uid;
    } else {
      this.selectedCarrierUid = '';
    }
    this.shipmentWeight = 0.5;
    this.shipmentPieces = 1;
    this.selectedBoxUID = null;
    this.shipmentLength = null;
    this.shipmentWidth = null;
    this.shipmentHeight = null;
    this.showCreateShipmentModal = true;

    // Load available boxes
    this.boxService.getActiveBoxes().subscribe({
      next: (response) => {
        this.availableBoxes = response.data || [];
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load boxes:', err);
        this.availableBoxes = [];
        this.cdr.detectChanges();
      }
    });

    this.cdr.detectChanges();
  }

  closeCreateShipmentModal(): void {
    this.showCreateShipmentModal = false;
    this.selectedCarrierUid = '';
    this.cdr.detectChanges();
  }

  onBoxSelected(): void {
    if (!this.selectedBoxUID) {
      this.shipmentLength = null;
      this.shipmentWidth = null;
      this.shipmentHeight = null;
      this.cdr.detectChanges();
      return;
    }

    const box = this.availableBoxes.find(b => b.uid === this.selectedBoxUID);
    if (box) {
      this.shipmentLength = box.length_cm;
      this.shipmentWidth = box.width_cm;
      this.shipmentHeight = box.height_cm;
      this.cdr.detectChanges();
    }
  }

  createShipment(): void {
    if (!this.selectedCarrierUid || !this.orderUID) return;

    this.creatingShipment = true;
    this.http.post<{ data: Shipment }>(`${environment.apiUrl}/admin/orders/shipment/create`, {
      data: {
        order_uid: this.orderUID,
        carrier_uid: this.selectedCarrierUid,
        box_uid: this.selectedBoxUID || undefined,
        weight_kg: this.shipmentWeight,
        pieces_count: this.shipmentPieces,
        length_cm: this.shipmentLength || undefined,
        width_cm: this.shipmentWidth || undefined,
        height_cm: this.shipmentHeight || undefined
      }
    }).subscribe({
      next: () => {
        this.creatingShipment = false;
        this.closeCreateShipmentModal();
        // Reload shipment data from server to get latest state
        this.loadShipmentData();
      },
      error: (err) => {
        console.error('Failed to create shipment:', err);
        this.creatingShipment = false;
        this.closeCreateShipmentModal();
        this.cdr.detectChanges();
      }
    });
  }

  refreshShipmentTracking(shipment: Shipment): void {
    this.trackingShipmentUid = shipment.uid;
    this.http.post<{ data: Shipment }>(`${environment.apiUrl}/admin/orders/shipment/${shipment.uid}/track`, {}).subscribe({
      next: (response) => {
        if (response.data) {
          const index = this.orderShipments.findIndex(s => s.uid === shipment.uid);
          if (index >= 0) {
            this.orderShipments[index] = response.data;
          }
        }
        this.trackingShipmentUid = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to refresh tracking:', err);
        this.trackingShipmentUid = null;
        this.cdr.detectChanges();
      }
    });
  }

  downloadLabel(shipment: Shipment): void {
    this.http.get<{ data: { format: string; data: string; url?: string } }>(
      `${environment.apiUrl}/admin/orders/shipment/${shipment.uid}/label`
    ).subscribe({
      next: (response) => {
        if (response.data?.url) {
          window.open(response.data.url, '_blank');
        } else if (response.data?.data) {
          // Base64 data - create download link
          const byteCharacters = atob(response.data.data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `label-${shipment.tracking_number || shipment.uid}.pdf`;
          link.click();
          window.URL.revokeObjectURL(url);
        }
      },
      error: (err) => {
        console.error('Failed to download label:', err);
      }
    });
  }

  getCarrierName(carrierUid: string): string {
    const carrier = this.shipmentCarriers.find(c => c.uid === carrierUid);
    return carrier?.name || carrierUid;
  }

  getShipmentStatusClass(status: string): string {
    switch (status) {
      case 'delivered':
        return 'shipment-delivered';
      case 'in_transit':
        return 'shipment-transit';
      case 'created':
      case 'pending':
        return 'shipment-pending';
      case 'error':
      case 'cancelled':
        return 'shipment-error';
      default:
        return '';
    }
  }

  formatShipmentDate(dateString: string | null): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
