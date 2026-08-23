import { Component, OnInit, OnDestroy, AfterViewInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { forkJoin, of } from 'rxjs';
import { switchMap, catchError, map } from 'rxjs/operators';
import { Currency } from '../../../core/models/currency.model';
import { ProductService } from '../../../core/services/product.service';
import { TranslationService } from '../../../core/services/translation.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { formatDateTime, formatDateShort } from '../../../core/utils/date-format';
import { formatCents, formatAmount, formatDecimal } from '../../../core/utils/money-format';
import { sanitizeReturnUrl } from '../../../core/utils/return-url';
import { InvoiceService, InvoiceType, Invoice } from '../../../core/services/invoice.service';
import { UserService, AdminUser } from '../../../core/services/user.service';
import { BoxService } from '../../shipment/services/box.service';
import { ShipmentBox } from '../../shipment/models/shipment-box.model';
import { CrmService } from '../../crm/services/crm.service';
import { CrmStage, CrmTransition } from '../../crm/models/crm-stage.model';
import { ApiResponse } from '../../../core/models/api.model';
import { AuthService } from '../../../core/services/auth.service';
import { ClientBranch } from '../../../core/models/app-settings.model';
import { CanSplitOrderResponse, OrderSplitPreview } from '../models/order-split.model';

interface ShipmentServiceSettings {
  enabled: boolean;
  service_running: boolean;
  active_carrier_count: number;
}

interface ShipmentCarrier {
  uid: string;
  name: string;
  active: boolean;
  currency?: string;
}

type SelectorType = 'select' | 'text' | 'number' | 'lookup';

interface SelectorChoice {
  value: string;
  label?: string;
  label_key?: string;
  // Drops this single option when the condition does not hold, for choices the
  // carrier cannot honour in the current context (e.g. Nova Poshta door
  // delivery in a settlement it does not drive to).
  visible_when?: SelectorVisibility;
}

// One match returned by the carrier-lookup endpoint (city / warehouse / street
// search). `meta` is opaque driver data attached to the match: it is forwarded
// verbatim as parameters to dependent lookups, submitted with the create
// request, and matched by meta-based visibility conditions.
interface LookupOption {
  value: string;
  ref?: string;
  label: string;
  sub?: string;
  meta?: Record<string, string>;
}

// A condition on another control. `field` compares that selector's value;
// `meta_of` + `meta_field` instead compare a property of the option chosen in
// that lookup, and take precedence.
interface SelectorVisibility {
  field: string;
  values?: string[];
  value_prefixes?: string[];
  meta_of?: string;
  meta_field?: string;
}

// Tells the dialog how this carrier's selectors compose a reusable recipient.
// Present only for drivers that support the saved recipient book.
interface RecipientSchema {
  keys: string[];
  name?: string;
  phone?: string;
  tax_id?: string;
  contact_name?: string;
  type?: string;
  business_value?: string;
  delivery_mode?: string;
  address_value?: string;
}

// A saved "who and where" a client's parcels go to.
interface ShipmentRecipient {
  uid: string;
  client_uid: string;
  carrier_type: string;
  title: string;
  recipient_type: string;
  name: string;
  phone?: string;
  tax_id?: string;
  contact_name?: string;
  delivery_mode: string;
  payload?: Record<string, string>;
  is_default: boolean;
  usage_count: number;
  last_used?: string;
}

interface ProviderSelector {
  key: string;
  // Routes the value: '' (default) places it at the top level of the request;
  // 'extra_data' nests it under the request's extra_data object.
  target?: string;
  type: SelectorType;
  label?: string;
  label_key?: string;
  required?: boolean;
  default?: string;
  placeholder?: string;
  choices?: SelectorChoice[];
  visible_when?: SelectorVisibility;
  max_length?: number;
  // For type 'lookup': the carrier-lookup source to query, and the key of
  // another selector whose resolved ref this lookup depends on.
  source?: string;
  depends_on?: string;
}

interface ProviderOptions {
  selectors: ProviderSelector[];
  recipient?: RecipientSchema;
}

// One reason the create is blocked. 'missing' = required and empty,
// 'unresolved' = typed but never confirmed against the carrier. hidden marks a
// field the operator cannot currently see (collapsed behind the recipient
// picker), which is the case that otherwise looks like a broken button.
interface SelectorIssue {
  key: string;
  label: string;
  reason: 'missing' | 'unresolved';
  hidden: boolean;
}

/** One order a shipment covers. Present only on consolidated shipments. */
interface ShipmentOrderRef {
  order_uid: string;
  number?: string;
  lead?: boolean;
}

/**
 * An order that could share this order's AWB. Ineligible ones are returned too,
 * with a reason, so the operator sees why an order they expected is not offered
 * instead of wondering where it went.
 */
interface ConsolidationCandidate {
  order_uid: string;
  number?: string;
  status?: string;
  total: number;
  currency_code?: string;
  box_count: number;
  weight_kg: number;
  created_at: string;
  lead?: boolean;
  eligible: boolean;
  /** English fallback. Prefer `reason_code`, which is translatable. */
  reason?: string;
  reason_code?: string;
  reason_params?: Record<string, string>;
}

/**
 * What the server says the ticked set would book. The totals are its own, not
 * re-derived here: one rule, one implementation, and the preview cannot drift
 * away from what the carrier is actually handed.
 */
interface ConsolidationCheckResponse {
  eligible: boolean;
  reason?: string;
  reason_code?: string;
  orders: ConsolidationCandidate[];
  total_boxes: number;
  total_weight_kg: number;
  total_value: number;
  currency_code?: string;
}

interface Shipment {
  uid: string;
  order_uid: string;
  /**
   * Every order this shipment covers, lead first. Empty unless consolidated,
   * so a non-empty value is itself the "this is consolidated" signal.
   */
  orders?: ShipmentOrderRef[];
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
  cod_amount: number | null;
  insurance_amount: number | null;
  carrier_price: number | null;
  carrier_fuel_surcharge: number | null;
  carrier_price_total: number | null;
  shipped_at: string | null;
  delivered_at: string | null;
  error_message: string | null;
  created_at: string;
  last_update: string;
  events?: ShipmentEvent[];
  actions?: ShipmentAction[];
}

interface ShipmentAction {
  key: string;
  label_key?: string;
  icon?: string;
  variant?: string;
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
  color: string;
  allow_create_shipment: boolean;
  // A final stage closes the order to the billed-branch change: past that point
  // a wrong payer is corrected in accounting, not here.
  is_final?: boolean;
}

/**
 * What changing the billed branch would do, as computed by the backend without
 * saving. The rate is the reason this is previewed rather than just confirmed:
 * branch substitution is total, so a branch with no VAT number is not
 * VAT-registered and a cross-border order to it flips from reverse-charge 0% to
 * the store's full rate — changing the total of an order the ERP already holds.
 */
interface BranchChangePreview {
  branch_uid: string;
  branch_name: string;
  branch_vat_number: string;
  branch_business_registration_number: string;
  current_vat_rate: number;
  new_vat_rate: number;
  current_total: number;
  new_total: number;
  current_total_vat: number;
  new_total_vat: number;
  currency_code: string;
  has_shipment: boolean;
  has_invoice: boolean;
  business_registration_missing: boolean;
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
  // true while the order is still a cart/draft. Sent unconditionally by the
  // backend; optional here only because older callers built this type by hand.
  draft?: boolean;
  total: number;
  discount_percent?: number; // Client discount percentage (0-100)
  vat_rate?: number; // VAT rate percentage (0-100)
  subtotal?: number; // Subtotal without VAT
  total_vat?: number; // Total VAT amount
  original_total?: number; // Original total before discount
  discount_amount?: number; // Total discount amount saved
  delivery_cost?: number; // Delivery cost in cents
  shipping_address: string;
  billing_address?: string;
  country_code?: string; // ISO country code (e.g., "UA", "PL")
  zipcode?: string; // Postal code
  city?: string; // City name
  address_text?: string; // Street address
  comment?: string;
  // Staff-only note for the warehouse. Never returned by client-facing
  // endpoints; do not surface it anywhere a client can reach.
  internal_comment?: string;
  is_edited?: boolean;
  discount_override?: boolean;
  company_uid?: string; // ERP company GUID (used downstream, e.g. invoice)
  company_name?: string; // ERP company name (display only)
  // Document number the ERP assigns once it has processed the order. Read-only:
  // the ERP is the only writer, no admin endpoint accepts it. Not to be confused
  // with `number` above, which is the Comex order number.
  erp_number?: string;
  // Branch snapshot: the client branch this order is billed to, captured when
  // the delivery address was selected. Empty branch_uid = billed to the client.
  // Note the direction: company_* above is the SELLER's legal entity, these are
  // the BUYER's sub-entity.
  branch_uid?: string;
  branch_name?: string;
  branch_vat_number?: string;
  branch_business_registration_number?: string;
  // Set when an operator chose the branch directly. The order then stops
  // following its address' branch link — see EditOrderBillingBranch.
  branch_override?: boolean;
  created_at: string;
  last_update?: string;
  boxes?: OrderBox[]; // Physical packaging from ERP: one entry per box
}

interface OrderBox {
  order_uid: string;
  box_number: number;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  weight_kg: number;
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
  line_number?: number; // 1-based line position assigned at confirm (0/undefined = draft/unset)
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
  /** Actor reported by an external system (ERP) — a plain name, no user account behind it. */
  external_user?: string;
  status: string;
  comment?: string;
  created_at: string;
}

@Component({
    selector: 'app-order-detail',
    templateUrl: './order-detail.component.html',
    styleUrls: [
        './order-detail.component.scss',
        // The shipments list and the create-shipment modal. Separate file, same
        // component: it is the seam that modal will be lifted out along.
        './order-detail-shipment.scss',
    ],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class OrderDetailComponent implements OnInit, AfterViewInit, OnDestroy {
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

  // Split permission and dialog state. Splitting is gated by the CRM stage's
  // allow_split flag, independently of allow_edit.
  canSplit = false;
  /** Why the split action is unavailable, as a slug — see splitBlockedTooltip(). */
  splitBlockedCode = '';
  splitBlockedReason = '';
  splitBlockedStage = '';
  showSplitDialog = false;

  // History state
  history: OrderStatusHistory[] = [];
  historyLimit = 10;
  historyOffset = 0;
  historyDesc = true; // default: newest first
  historyLoading = false;

  // Mobile UI state
  showAllItems = false;
  itemsPreviewLimit = 5;

  // Desktop UI state — collapse long item lists
  showAllItemsDesktop = false;
  desktopItemsThreshold = 50;
  desktopItemsPreviewLimit = 20;

  // Floating scroll-to-top button visibility
  showScrollTop = false;
  private scrollTopThreshold = 400;
  private scrollContainer: HTMLElement | null = null;
  private scrollListener: (() => void) | null = null;

  // Navigation origin tracking
  private fromLocation: string | null = null;
  /** In-app URL to return to, carrying the caller's own list state. */
  private returnUrl: string | null = null;

  // Invoice state
  invoiceTypes: InvoiceType[] = [];
  orderInvoices: Invoice[] = [];
  showInvoiceModal = false;
  invoiceLoading = false;
  invoiceRequesting = false;
  invoiceRequestError: string | null = null;
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
  printingShipmentUid: string | null = null;
  cancellingShipmentUid: string | null = null;
  bookingPickupUid: string | null = null;
  stageAllowsShipment = false; // Whether current CRM stage allows shipment creation
  currentStage: CrmPipelineStage | null = null;

  // Delivery cost edit state
  showDeliveryCostModal = false;
  deliveryCostInput: number | null = null;
  savingDeliveryCost = false;
  deliveryCostError: string | null = null;

  // Billed-branch change state. Separate from the edit page on purpose: this is
  // available at stages where editing is not, because the wrong payer is
  // discovered at invoicing and invoicing has no stage gate.
  showBranchModal = false;
  branchOptions: ClientBranch[] = [];
  // null = nothing picked yet; '' = bill the parent client directly.
  selectedBranchUid: string | null = null;
  branchPreview: BranchChangePreview | null = null;
  loadingBranchOptions = false;
  previewingBranch = false;
  savingBranch = false;
  branchError: string | null = null;

  // Stage change state
  showStageChangeModal = false;
  availableTransitions: CrmStage[] = [];
  transitionsLoading = false;
  selectedTargetStageUid = '';
  changingStage = false;
  stageChangeError: string | null = null;

  // Admin "Move" (force stage change, bypass transitions) state
  isAdmin = false;
  showForceMoveModal = false;
  allStages: CrmStage[] = [];
  forceMoveStagesLoading = false;
  selectedForceMoveStageUid = '';
  forceMoving = false;
  forceMoveError: string | null = null;

  // Box selection state
  availableBoxes: ShipmentBox[] = [];
  selectedBoxUID: string | null = null;
  shipmentLength: number | null = null;
  shipmentWidth: number | null = null;
  shipmentHeight: number | null = null;

  // Driver-supplied UI schema for the currently selected carrier. The frontend
  // renders selectors generically and stays carrier-agnostic.
  carrierOptions: ProviderOptions | null = null;
  carrierOptionsLoading = false;

  // Current values for every driver-defined selector keyed by Selector.key.
  // The same keys go straight onto the price/create-shipment request bodies.
  selectorValues: Record<string, string> = {};

  // State for type 'lookup' selectors (remote-search autocompletes), all keyed
  // by Selector.key. lookupResolved marks a value as confirmed (chosen from the
  // list or pre-filled) and carries its carrier ref, used both as the ✓ marker
  // and as the dependency ref for child lookups.
  lookupResults: Record<string, LookupOption[]> = {};
  lookupLoading: Record<string, boolean> = {};
  lookupOpen: Record<string, boolean> = {};
  lookupResolved: Record<string, { ref: string; label: string; meta: Record<string, string> }> = {};
  private lookupDebounce: Record<string, any> = {};

  // Saved recipient book for this order's client with the selected carrier.
  shipmentRecipients: ShipmentRecipient[] = [];
  selectedRecipientUid = '';
  recipientsLoading = false;
  // When true the recipient fields are expanded for editing; the picker alone is
  // shown otherwise, which is the one-click path for a repeat order.
  recipientEditing = false;
  savingRecipient = false;
  recipientError: string | null = null;

  // Pre-calculated carrier price (no shipment created). Cleared when any input
  // that influences the price changes.
  calculatingPrice = false;
  priceResult: { price: number; fuel_surcharge: number; total_price: number; currency?: string; estimated_delivery_date?: string } | null = null;
  priceError: string | null = null;
  createShipmentError: string | null = null;

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
    private crmService: CrmService,
    private authService: AuthService,
    private confirmDialog: ConfirmDialogService,
    private notifications: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.orderUID = this.route.snapshot.params['id'];
    this.fromLocation = this.route.snapshot.queryParams['from'] || null;
    this.returnUrl = sanitizeReturnUrl(this.route.snapshot.queryParams['returnUrl']);
    this.isAdmin = this.authService.currentUser?.role === 'admin';
    this.loadOrderDetail();
  }

  ngAfterViewInit(): void {
    // Admin layout scrolls inside .admin-content, not the window.
    const container = document.querySelector('.admin-content') as HTMLElement | null;
    if (!container) return;
    this.scrollContainer = container;
    this.scrollListener = () => {
      const next = container.scrollTop > this.scrollTopThreshold;
      if (next !== this.showScrollTop) {
        this.showScrollTop = next;
        this.cdr.detectChanges();
      }
    };
    container.addEventListener('scroll', this.scrollListener, { passive: true });
  }

  ngOnDestroy(): void {
    if (this.scrollContainer && this.scrollListener) {
      this.scrollContainer.removeEventListener('scroll', this.scrollListener);
    }
    this.scrollContainer = null;
    this.scrollListener = null;
  }

  loadOrderDetail(): void {
    this.loading = true;
    this.error = null;
    this.currentStage = null;

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
          this.checkSplitPermission();
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
    return formatDateTime(dateString);
  }

  goBack(): void {
    // A returnUrl carries the caller's own state — the analysis page's criteria
    // live in its query string, so returning to a bare /admin/orders/analysis
    // would silently drop the query the user had built.
    if (this.returnUrl) {
      this.router.navigateByUrl(this.returnUrl);
      return;
    }
    if (this.fromLocation === 'crm') {
      this.router.navigate(['/admin/crm']);
    } else {
      this.router.navigate(['/admin/orders']);
    }
  }

  /** Breadcrumb label for wherever "back" leads. */
  get backLabel(): string {
    if (this.fromLocation === 'analysis') {
      return 'admin.analysis.title';
    }
    if (this.fromLocation === 'crm') {
      return 'admin.nav.crmPipeline';
    }
    return 'admin.orders.allOrders';
  }

  calculateSubtotal(item: OrderItem): number {
    return item.quantity * item.price - item.discount;
  }

  getStatusClass(status: string): string {
    return `status-${status.toLowerCase()}`;
  }

  /**
   * The page's title: the order number, or a shortened UID while the order is
   * still a draft and the ERP has not assigned one.
   *
   * A raw UID is 32 hex characters — at heading size it overflows the 280px
   * spine and pushes the client panel off the page. The head is enough to tell
   * two drafts apart; the full value stays on the element's title attribute.
   */
  get displayOrderNumber(): string {
    if (!this.order) return '';
    if (this.order.number) return this.order.number;
    const uid = this.order.uid || '';
    return uid.length > 12 ? `${uid.slice(0, 12)}…` : uid;
  }

  /** Full identifier, for the title tooltip when the heading is shortened. */
  get fullOrderNumber(): string {
    return this.order?.number || this.order?.uid || '';
  }

  /**
   * Who made the change: the Comex user when there is one, otherwise the name the
   * ERP reported for its own operator. Empty when neither — a system-made change.
   */
  historyActor(h: OrderStatusHistory): string {
    const name = `${h.user_firstname || ''} ${h.user_lastname || ''}`.trim();
    return name || (h.external_user || '').trim();
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

  get visibleItemsDesktop(): OrderItem[] {
    if (this.showAllItemsDesktop || this.items.length <= this.desktopItemsThreshold) {
      return this.items;
    }
    return this.items.slice(0, this.desktopItemsPreviewLimit);
  }

  get hasMoreItemsDesktop(): boolean {
    return this.items.length > this.desktopItemsThreshold;
  }

  get hiddenItemsCountDesktop(): number {
    return this.items.length - this.desktopItemsPreviewLimit;
  }

  toggleShowAllItemsDesktop(): void {
    this.showAllItemsDesktop = !this.showAllItemsDesktop;
  }

  scrollToTop(): void {
    if (this.scrollContainer) {
      this.scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  checkEditPermission(): void {
    if (!this.orderUID) return;
    // Admins may edit at any stage; skip the server roundtrip.
    if (this.isAdmin) {
      this.canEdit = true;
      this.canEditReason = '';
      this.checkingEditPermission = false;
      return;
    }
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

  checkSplitPermission(): void {
    if (!this.orderUID) return;

    this.http.post<ApiResponse<CanSplitOrderResponse>>(
      `${environment.apiUrl}/admin/orders/split/check`,
      { order_uid: this.orderUID }
    ).subscribe({
      next: (resp) => {
        this.canSplit = resp.data?.can_split || false;
        this.splitBlockedCode = resp.data?.reason_code || '';
        this.splitBlockedReason = resp.data?.reason || '';
        this.splitBlockedStage = resp.data?.stage_name || '';
        this.cdr.detectChanges();
      },
      error: () => {
        this.canSplit = false;
        this.splitBlockedCode = '';
        this.splitBlockedReason = '';
        this.splitBlockedStage = '';
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Tooltip for the split button. Enabled: what the button does. Disabled: why
   * it cannot be used — the button stays visible and explains itself rather than
   * vanishing, since "the order already has an invoice" is not something anyone
   * would infer from a missing button.
   *
   * Falls back to the backend's English sentence if a reason code arrives that
   * this build has no translation for, so a new code degrades to a worse message
   * rather than to no message.
   */
  splitBlockedTooltip(): string {
    if (this.canSplit) {
      return this.translationService.instant('admin.orders.splitOrder');
    }
    if (!this.splitBlockedCode) {
      return this.splitBlockedReason;
    }

    const key = `admin.orders.splitBlocked.${this.splitBlockedCode}`;
    const message = this.translationService.instant(key, { stage: this.splitBlockedStage });
    return message === key ? (this.splitBlockedReason || message) : message;
  }

  openSplitDialog(): void {
    this.showSplitDialog = true;
    this.cdr.detectChanges();
  }

  closeSplitDialog(): void {
    this.showSplitDialog = false;
    this.cdr.detectChanges();
  }

  /**
   * This order survives a split as its first part, holding whatever stayed on
   * it, so the page reloads in place. The navigation is a fallback for the case
   * where the first part somehow is not this order.
   */
  onOrderSplit(result: OrderSplitPreview): void {
    this.showSplitDialog = false;
    const numbers = result.parts.map(part => part.number).filter(Boolean).join(', ');
    this.notifications.success(
      `${this.translationService.instant('admin.orders.splitDone')} ${numbers}`
    );

    const first = result.parts[0]?.order_uid;
    if (first && first !== this.orderUID) {
      this.router.navigate(['/admin/orders', first]);
      return;
    }
    this.loadOrderDetail();
  }

  editOrder(): void {
    // Both are forwarded so the origin survives the detail → edit → detail
    // round trip and "back" still lands on the list the user came from.
    const queryParams: { [key: string]: string } = {};
    if (this.fromLocation) {
      queryParams['from'] = this.fromLocation;
    }
    if (this.returnUrl) {
      queryParams['returnUrl'] = this.returnUrl;
    }
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
      users: this.userService.getStaff().pipe(catchError(() => of([])))
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
      // Single type available - request directly without modal
      this.selectedInvoiceTypeUid = this.invoiceTypes[0].uid;
      this.requestInvoice();
      return;
    }
    // Multiple types - show modal
    this.selectedInvoiceTypeUid = '';
    this.showInvoiceModal = true;
  }

  closeInvoiceModal(): void {
    this.showInvoiceModal = false;
    this.selectedInvoiceTypeUid = '';
  }

  requestInvoice(): void {
    if (this.invoiceRequesting) return; // guard against double-submit → duplicate ERP invoice
    if (!this.selectedInvoiceTypeUid || !this.orderUID) return;

    this.invoiceRequesting = true;
    this.invoiceRequestError = null;
    // Hide the type-selection modal so the progress modal (gated on
    // invoiceRequesting) takes over as the sole overlay. The request can take
    // 30s+, so the operator needs a clear "in progress, please wait" indicator.
    this.showInvoiceModal = false;
    this.invoiceService.requestInvoice(this.orderUID, this.selectedInvoiceTypeUid).subscribe({
      next: (response) => {
        this.invoiceRequesting = false;
        if (response.success && response.data) {
          // Record the attempt in history regardless of outcome (a failed
          // invoice still returns a persisted record with an error field).
          this.orderInvoices = [response.data, ...this.orderInvoices];
        }
        // The invoice service can return HTTP 200 with a populated error field
        // (the upstream provider rejected the request). Surface that in the
        // modal instead of silently closing.
        const upstreamError = response.data?.error || (!response.success ? response.error : '');
        if (upstreamError) {
          this.invoiceRequestError = upstreamError;
        } else {
          this.closeInvoiceModal();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to request invoice:', err);
        this.invoiceRequesting = false;
        this.invoiceRequestError = err?.error?.error?.message || err?.error?.message || err?.message
          || this.translationService.instant('invoice.requestFailed');
        this.cdr.detectChanges();
      }
    });
  }

  // Dismiss the invoice request progress/error modal after a failed request.
  dismissInvoiceRequestModal(): void {
    this.invoiceRequestError = null;
    this.closeInvoiceModal();
  }

  openInvoice(invoice: Invoice): void {
    this.invoiceService.openInvoice(invoice);
  }

  invoiceLinks(invoice: Invoice): string[] {
    return this.invoiceService.invoiceLinks(invoice);
  }

  openInvoiceURL(url: string): void {
    window.open(url, '_blank');
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

  private readonly expandedInvoiceErrors = new Set<string>();

  isInvoiceErrorExpanded(uid: string): boolean {
    return this.expandedInvoiceErrors.has(uid);
  }

  toggleInvoiceError(uid: string): void {
    if (this.expandedInvoiceErrors.has(uid)) {
      this.expandedInvoiceErrors.delete(uid);
    } else {
      this.expandedInvoiceErrors.add(uid);
    }
  }

  // Tracking-events collapse: long timelines collapse to the current status.
  private readonly expandedShipmentEvents = new Set<string>();
  // Below this count the timeline is always shown in full.
  private readonly shipmentEventsCollapseThreshold = 3;

  isShipmentEventsExpanded(uid: string): boolean {
    return this.expandedShipmentEvents.has(uid);
  }

  toggleShipmentEvents(uid: string): void {
    if (this.expandedShipmentEvents.has(uid)) {
      this.expandedShipmentEvents.delete(uid);
    } else {
      this.expandedShipmentEvents.add(uid);
    }
  }

  // Tracking events with displayable content, ordered oldest → newest.
  shipmentTimelineEvents(shipment: Shipment): ShipmentEvent[] {
    return (shipment.events || [])
      .filter(e => e.event_status || e.event_description || e.terminal_city)
      .slice()
      .sort((a, b) => this.eventTime(a) - this.eventTime(b));
  }

  // Whether this shipment's timeline is collapsible (more than the threshold).
  isShipmentEventsCollapsible(shipment: Shipment): boolean {
    return this.shipmentTimelineEvents(shipment).length > this.shipmentEventsCollapseThreshold;
  }

  // Events to render: the full timeline when expanded or short, otherwise just
  // the most recent event (the current status).
  visibleShipmentEvents(shipment: Shipment): ShipmentEvent[] {
    const events = this.shipmentTimelineEvents(shipment);
    if (events.length <= this.shipmentEventsCollapseThreshold || this.isShipmentEventsExpanded(shipment.uid)) {
      return events;
    }
    return events.slice(-1);
  }

  // Human-readable location for a tracking event: terminal name and/or city,
  // whichever the carrier provided (DHL fills only the name, InPost both).
  eventLocation(e: ShipmentEvent): string {
    return [e.terminal_name, e.terminal_city]
      .map(s => (s || '').trim())
      .filter(s => s.length > 0)
      .join(' ');
  }

  private eventTime(e: ShipmentEvent): number {
    const t = e.event_timestamp ? Date.parse(e.event_timestamp) : NaN;
    return isNaN(t) ? 0 : t;
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

    // Scope settings/carriers to the order's store so per-store enable/active state is honored
    const storeUid = this.order?.store_uid;
    const storeQuery = storeUid ? `?store_uid=${encodeURIComponent(storeUid)}` : '';
    // Carriers are additionally scoped to the order so the backend filters out
    // carriers bound to a different company than the order's.
    const carrierParams = new URLSearchParams();
    if (storeUid) carrierParams.set('store_uid', storeUid);
    carrierParams.set('order_uid', this.orderUID);
    const carrierQuery = `?${carrierParams.toString()}`;

    // Load service settings, carriers, existing shipments, and CRM pipeline info
    forkJoin({
      settings: this.http.get<{ data: ShipmentServiceSettings }>(`${environment.apiUrl}/admin/shipment/settings${storeQuery}`),
      carriers: this.http.post<{ data: ShipmentCarrier[] }>(`${environment.apiUrl}/admin/shipment/carriers/active${carrierQuery}`, {}),
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
        this.currentStage = orderPipeline?.stage || null;

        this.shipmentLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load shipment data:', err);
        this.shipmentServiceEnabled = false;
        this.shipmentCarriers = [];
        this.orderShipments = [];
        this.stageAllowsShipment = false;
        this.currentStage = null;
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

  /**
   * VAT earns a column only where it moves a price. Derived from the items
   * rather than order.vat_rate, which is optional and would also flatten an
   * order whose lines carry different rates.
   */
  /** Money held as integer cents: order lines, totals, insurance. */
  formatMoney(cents: number | null | undefined): string {
    return formatCents(cents);
  }

  /** Money the backend already converted: carrier prices and quotes. */
  formatPrice(value: number | null | undefined): string {
    return formatAmount(value);
  }

  /** Weights and other measured quantities, without the float tail. */
  formatWeight(value: number | null | undefined): string {
    return formatDecimal(value);
  }

  /**
   * Coerced because these arrive as JSON: the ERP has sent numeric fields as
   * strings before, and "35" vs 35 in a Set reads as two different rates, which
   * would keep a column that holds one value on every row.
   */
  private numeric(value: unknown): number {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
  }

  get itemsHaveVat(): boolean {
    return this.items.some(i => this.numeric(i.price_with_vat ?? i.price) !== this.numeric(i.price));
  }

  get itemsHaveDiscount(): boolean {
    return this.items.some(i => this.numeric(i.discount) > 0);
  }

  /**
   * The one discount rate every line shares, or null when they differ. A shared
   * rate is stated once above the table; only a varying one needs a column.
   */
  get uniformDiscount(): number | null {
    if (!this.items.length) return null;
    const rates = new Set(this.items.map(i => this.numeric(i.discount)));
    return rates.size === 1 ? rates.values().next().value ?? null : null;
  }

  get showItemDiscountColumn(): boolean {
    return this.itemsHaveDiscount && this.uniformDiscount === null;
  }

  /** Kept in step with the conditional columns so colspans stay honest. */
  get itemColumnCount(): number {
    return 7
      + (this.itemsHaveVat ? 1 : 0)
      + (this.showItemDiscountColumn ? 1 : 0)
      + (this.itemsHaveDiscount ? 1 : 0);
  }

  /**
   * Which bar action carries primary weight. The stage decides: while it allows
   * a shipment that is the next thing to do, otherwise editing is. Null while
   * the stage is still loading, so the primary appears once rather than
   * switching identity under the cursor.
   */
  get primaryAction(): 'shipment' | 'edit' | null {
    if (this.shipmentLoading) return null;
    if (this.canCreateShipment) return 'shipment';
    if (this.canEdit && !this.checkingEditPermission) return 'edit';
    return null;
  }

  get orderBoxes(): OrderBox[] {
    return this.order?.boxes ?? [];
  }

  get hasOrderBoxes(): boolean {
    return this.orderBoxes.length > 0;
  }

  get orderBoxesTotalWeight(): number {
    return this.orderBoxes.reduce((sum, b) => sum + (b.weight_kg || 0), 0);
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
    this.carrierOptions = null;
    this.selectorValues = {};
    this.resetLookupState();
    this.resetRecipientState();
    this.priceResult = null;
    this.priceError = null;
    this.createShipmentError = null;
    this.calculatingPrice = false;
    this.resetConsolidationState();
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

    if (this.selectedCarrierUid) {
      this.loadCarrierOptions(this.selectedCarrierUid);
    }

    this.cdr.detectChanges();
  }

  closeCreateShipmentModal(): void {
    this.showCreateShipmentModal = false;
    this.resetConsolidationState();
    this.selectedCarrierUid = '';
    this.carrierOptions = null;
    this.selectorValues = {};
    this.resetLookupState();
    this.resetRecipientState();
    this.createShipmentError = null;
    this.cdr.detectChanges();
  }

  openDeliveryCostModal(): void {
    if (!this.stageAllowsShipment) return;
    const cents = this.order?.delivery_cost || 0;
    this.deliveryCostInput = +(cents / 100).toFixed(2);
    this.deliveryCostError = null;
    this.showDeliveryCostModal = true;
    this.cdr.detectChanges();
  }

  closeDeliveryCostModal(): void {
    if (this.savingDeliveryCost) return;
    this.showDeliveryCostModal = false;
    this.deliveryCostError = null;
    this.cdr.detectChanges();
  }

  saveDeliveryCost(): void {
    if (!this.orderUID || this.deliveryCostInput === null || this.deliveryCostInput < 0) return;
    if (this.savingDeliveryCost) return;

    const cents = Math.round(this.deliveryCostInput * 100);
    this.savingDeliveryCost = true;
    this.deliveryCostError = null;

    this.http.post<ApiResponse<{ order: OrderDetail; message?: string }>>(`${environment.apiUrl}/admin/orders/delivery-cost`, {
      order_uid: this.orderUID,
      delivery_cost: cents
    }).subscribe({
      next: () => {
        this.savingDeliveryCost = false;
        this.showDeliveryCostModal = false;
        this.loadOrderDetail();
        this.loadHistory();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.savingDeliveryCost = false;
        this.deliveryCostError = this.extractApiErrorMessage(err);
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Whether the operator may change who this order is billed to.
   *
   * Deliberately not tied to canEdit — the point of the action is to work where
   * editing does not. A draft is excluded because its branch still follows its
   * freely-editable address, so pinning an override there would only strand it.
   */
  get canChangeBranch(): boolean {
    if (!this.order || this.order.draft) return false;
    if (this.isAdmin) return true;
    return !this.currentStage?.is_final;
  }

  /** The party currently billed: the branch when there is one, else the client. */
  get billedPartyName(): string {
    return this.order?.branch_name || this.client?.name || '';
  }

  openBranchModal(): void {
    if (!this.canChangeBranch || !this.orderUID) return;

    this.showBranchModal = true;
    this.branchError = null;
    this.branchPreview = null;
    this.selectedBranchUid = null;
    this.loadingBranchOptions = true;
    this.branchOptions = [];
    this.cdr.detectChanges();

    this.http.post<ApiResponse<ClientBranch[]>>(`${environment.apiUrl}/admin/orders/branch/options`, {
      order_uid: this.orderUID
    }).subscribe({
      next: (resp) => {
        this.branchOptions = resp.data || [];
        this.loadingBranchOptions = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.branchOptions = [];
        this.loadingBranchOptions = false;
        this.branchError = this.extractApiErrorMessage(err);
        this.cdr.detectChanges();
      }
    });
  }

  closeBranchModal(): void {
    if (this.savingBranch) return;
    this.showBranchModal = false;
    this.branchError = null;
    this.branchPreview = null;
    this.selectedBranchUid = null;
    this.cdr.detectChanges();
  }

  /**
   * Previews the pick as soon as it is made. The operator sees the resulting VAT
   * rate and total before committing, rather than discovering the order's value
   * moved after the fact.
   */
  selectBranch(branchUid: string): void {
    if (this.savingBranch || !this.orderUID) return;

    this.selectedBranchUid = branchUid;
    this.branchPreview = null;
    this.branchError = null;
    this.previewingBranch = true;
    this.cdr.detectChanges();

    this.http.post<ApiResponse<BranchChangePreview>>(`${environment.apiUrl}/admin/orders/branch/preview`, {
      order_uid: this.orderUID,
      branch_uid: branchUid
    }).subscribe({
      next: (resp) => {
        this.branchPreview = resp.data || null;
        this.previewingBranch = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.branchPreview = null;
        this.previewingBranch = false;
        this.branchError = this.extractApiErrorMessage(err);
        this.cdr.detectChanges();
      }
    });
  }

  /** True when the previewed change would move the order's total. */
  get branchChangeMovesTotal(): boolean {
    const p = this.branchPreview;
    return !!p && p.new_total !== p.current_total;
  }

  /**
   * The signed difference the change would make to the total, e.g. "+46.00".
   * Stated outright rather than left for the operator to subtract: it is the
   * number the decision actually turns on.
   */
  get branchTotalDelta(): string {
    const p = this.branchPreview;
    if (!p) return '';
    const delta = p.new_total - p.current_total;
    return `${delta > 0 ? '+' : '−'}${this.formatMoney(Math.abs(delta))}`;
  }

  saveBranchChange(): void {
    if (!this.orderUID || this.selectedBranchUid === null) return;
    if (this.savingBranch || this.previewingBranch) return;

    this.savingBranch = true;
    this.branchError = null;
    this.cdr.detectChanges();

    this.http.post<ApiResponse<{ order: OrderDetail; message?: string }>>(`${environment.apiUrl}/admin/orders/branch`, {
      order_uid: this.orderUID,
      branch_uid: this.selectedBranchUid
    }).subscribe({
      next: () => {
        this.savingBranch = false;
        this.showBranchModal = false;
        this.branchPreview = null;
        this.selectedBranchUid = null;
        this.loadOrderDetail();
        this.loadHistory();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.savingBranch = false;
        this.branchError = this.extractApiErrorMessage(err);
        this.cdr.detectChanges();
      }
    });
  }

  selectedCarrier(): ShipmentCarrier | undefined {
    return this.shipmentCarriers.find(c => c.uid === this.selectedCarrierUid);
  }

  onShipmentCarrierChanged(): void {
    this.carrierOptions = null;
    this.selectorValues = {};
    this.resetLookupState();
    this.resetRecipientState();
    if (this.selectedCarrierUid) {
      this.loadCarrierOptions(this.selectedCarrierUid);
    }
    // The carrier owns two of the consolidation rules — whether the destination
    // needs a declaration, and whether several parcels fit on one AWB — so a
    // verdict reached under the previous carrier no longer describes this one.
    this.scheduleConsolidationCheck();
    this.cdr.detectChanges();
  }

  // The value arrives straight from ngModelChange, so a number selector hands
  // back a number — everything downstream treats selectorValues as strings, so
  // normalise here rather than defending at each read site.
  onSelectorChanged(key: string, value: unknown): void {
    const text = value === null || value === undefined ? '' : String(value);
    this.selectorValues = { ...this.selectorValues, [key]: text };
    this.clearSelectorsHiddenByDependency();
    this.resetSelectorsWithHiddenChoice();
    this.clearPriceResult();
    this.cdr.detectChanges();
  }

  resolveLabel(item: { label?: string; label_key?: string; value?: string }): string {
    if (item.label_key) {
      const t = this.translationService.instant(item.label_key);
      if (t && t !== item.label_key) return t;
    }
    return item.label || item.value || '';
  }

  isSelectorVisible(sel: ProviderSelector): boolean {
    return this.conditionHolds(sel.visible_when);
  }

  // Evaluates a visibility condition. A meta condition reads the property of the
  // option chosen in the referenced lookup, so an unresolved lookup fails it —
  // we cannot claim a property of a choice that has not been made.
  private conditionHolds(v: SelectorVisibility | undefined): boolean {
    if (!v) return true;

    let current: string;
    if (v.meta_of) {
      const resolved = this.lookupResolved[v.meta_of];
      if (!resolved) return false;
      current = resolved.meta[v.meta_field ?? ''] ?? '';
    } else {
      if (!v.field) return true;
      current = this.selectorValues[v.field] ?? '';
    }

    if (v.values && v.values.includes(current)) return true;
    if (v.value_prefixes && v.value_prefixes.some(p => current.startsWith(p))) return true;
    return false;
  }

  // Whether a selector's control is shown at all. Recipient-owned fields are
  // collapsed behind the picker once a saved recipient is chosen — that is the
  // whole point of saving one — and reappear when the operator edits it or
  // starts a new one. Everything else (parcel, payer, declared value) is always
  // shown, because it belongs to this shipment rather than to the recipient.
  isSelectorEditable(sel: ProviderSelector): boolean {
    if (!this.hasRecipientBook) return true;
    if (this.recipientEditing) return true;
    return !this.carrierOptions!.recipient!.keys.includes(sel.key);
  }

  // The options of a select that currently apply. Filtering happens here rather
  // than in the template so the reset below and the render agree on one rule.
  visibleChoices(sel: ProviderSelector): SelectorChoice[] {
    return (sel.choices ?? []).filter(c => this.conditionHolds(c.visible_when));
  }

  // Falls a select back to its default when the option it holds has just been
  // filtered out — e.g. the operator picked door delivery, then switched to a
  // settlement the carrier does not drive to.
  private resetSelectorsWithHiddenChoice(): void {
    if (!this.carrierOptions) return;
    const next = { ...this.selectorValues };
    let changed = false;
    for (const sel of this.carrierOptions.selectors) {
      if (sel.type !== 'select' || !sel.choices?.length) continue;
      const current = next[sel.key] ?? '';
      if (this.visibleChoices(sel).some(c => c.value === current)) continue;
      next[sel.key] = sel.default ?? this.visibleChoices(sel)[0]?.value ?? '';
      changed = true;
    }
    if (changed) {
      this.selectorValues = next;
      this.clearSelectorsHiddenByDependency();
    }
  }

  // --- Lookup (remote-search autocomplete) selectors ------------------------

  private resetRecipientState(): void {
    this.shipmentRecipients = [];
    this.selectedRecipientUid = '';
    this.recipientEditing = false;
    this.recipientsLoading = false;
    this.savingRecipient = false;
    this.recipientError = null;
  }

  private resetLookupState(): void {
    for (const t of Object.values(this.lookupDebounce)) clearTimeout(t);
    this.lookupDebounce = {};
    this.lookupResults = {};
    this.lookupLoading = {};
    this.lookupOpen = {};
    this.lookupResolved = {};
  }

  // A lookup is "resolved" once its current value was confirmed (chosen from
  // the list or pre-filled) — i.e. we hold a matching carrier ref for it.
  isLookupResolved(sel: ProviderSelector): boolean {
    return !!this.lookupResolved[sel.key];
  }

  // A dependent lookup (e.g. warehouse) is disabled until its parent (city) is
  // resolved, so we never query without the ref the carrier needs.
  isLookupDisabled(sel: ProviderSelector): boolean {
    return !!sel.depends_on && !this.lookupResolved[sel.depends_on];
  }

  // Fired on every keystroke in a lookup input: the typed value becomes
  // unresolved (until re-selected), dependents are cleared, and a debounced
  // search runs.
  onLookupInput(sel: ProviderSelector, value: string): void {
    this.selectorValues = { ...this.selectorValues, [sel.key]: value ?? '' };
    delete this.lookupResolved[sel.key];
    this.lookupOpen[sel.key] = true;
    this.clearDependentLookups(sel.key);
    this.resetSelectorsWithHiddenChoice();
    this.clearPriceResult();

    if (this.lookupDebounce[sel.key]) clearTimeout(this.lookupDebounce[sel.key]);
    const query = (value ?? '').trim();
    // Two characters keep name searches (settlements, streets) from firing on
    // every first letter, but a branch number is a valid one-character query —
    // "3" is a real destination and used to be unreachable.
    const minLength = /^\d+$/.test(query) ? 1 : 2;
    if (query.length < minLength) {
      this.lookupResults[sel.key] = [];
      this.lookupLoading[sel.key] = false;
      this.cdr.detectChanges();
      return;
    }
    this.lookupLoading[sel.key] = true;
    this.lookupDebounce[sel.key] = setTimeout(() => this.runLookup(sel, query), 300);
    this.cdr.detectChanges();
  }

  private runLookup(sel: ProviderSelector, query: string): void {
    const params: Record<string, string> = {};
    if (sel.depends_on) {
      const parent = this.lookupResolved[sel.depends_on];
      if (!parent) { // parent no longer resolved — abort
        this.lookupLoading[sel.key] = false;
        this.cdr.detectChanges();
        return;
      }
      // The parent's meta travels alongside its ref: one reference is not always
      // enough (Nova Poshta warehouses need the city ref, streets the settlement
      // ref). 'ref' is set last so a meta key of that name cannot shadow it.
      Object.assign(params, parent.meta);
      params['ref'] = parent.ref;
    }
    this.http.post<{ data: LookupOption[] }>(
      `${environment.apiUrl}/admin/orders/shipment/lookup`,
      { data: { carrier_uid: this.selectedCarrierUid, source: sel.source, query, params } }
    ).subscribe({
      next: (response) => {
        this.lookupResults[sel.key] = response.data || [];
        this.lookupLoading[sel.key] = false;
        this.lookupOpen[sel.key] = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.lookupResults[sel.key] = [];
        this.lookupLoading[sel.key] = false;
        this.cdr.detectChanges();
      }
    });
  }

  selectLookupOption(sel: ProviderSelector, opt: LookupOption): void {
    this.selectorValues = { ...this.selectorValues, [sel.key]: opt.value };
    this.lookupResolved[sel.key] = {
      ref: opt.ref ?? '',
      label: opt.label || opt.value,
      meta: opt.meta ?? {}
    };
    this.lookupOpen[sel.key] = false;
    this.lookupResults[sel.key] = [];
    this.clearDependentLookups(sel.key);
    // A new choice may invalidate options gated on its meta (e.g. door delivery
    // in a settlement without it).
    this.resetSelectorsWithHiddenChoice();
    this.clearPriceResult();
    this.cdr.detectChanges();
  }

  closeLookupDropdown(sel: ProviderSelector): void {
    // Defer so a click on a result registers before the dropdown closes.
    setTimeout(() => { this.lookupOpen[sel.key] = false; this.cdr.detectChanges(); }, 150);
  }

  // When a parent lookup changes, any lookup depending on it loses its value
  // and resolution (a warehouse only makes sense within its city).
  private clearDependentLookups(parentKey: string): void {
    if (!this.carrierOptions) return;
    const next = { ...this.selectorValues };
    let changed = false;
    for (const s of this.carrierOptions.selectors) {
      if (s.depends_on === parentKey) {
        if (next[s.key]) { next[s.key] = ''; changed = true; }
        delete this.lookupResolved[s.key];
        this.lookupResults[s.key] = [];
        this.lookupOpen[s.key] = false;
      }
    }
    if (changed) this.selectorValues = next;
  }

  private loadCarrierOptions(carrierUid: string): void {
    this.carrierOptionsLoading = true;
    this.http.get<{ data: ProviderOptions }>(
      `${environment.apiUrl}/admin/shipment/carriers/${carrierUid}/options`
    ).subscribe({
      next: (response) => {
        const options = response.data || { selectors: [] };
        this.carrierOptions = options;
        this.resetLookupState();
        const next: Record<string, string> = {};
        for (const sel of options.selectors) {
          next[sel.key] = sel.default ?? '';
        }
        this.selectorValues = next;
        this.carrierOptionsLoading = false;
        this.resetRecipientState();
        this.loadRecipients(carrierUid);
        this.prefillFromClientPref(carrierUid);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load carrier options:', err);
        this.carrierOptions = { selectors: [] };
        this.selectorValues = {};
        this.resetLookupState();
        this.carrierOptionsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Pre-fills the lookup selectors from this client's last-used destination for
  // the carrier (if any), so repeat orders don't re-search the same branch. The
  // payload uses the generic "<key>" / "<key>_ref" / "<key>_label" convention.
  //
  // Superseded by the recipient book where a carrier has one; kept as the
  // fallback for carriers that do not, and for clients whose last destination
  // predates the book.
  private prefillFromClientPref(carrierUid: string): void {
    if (!this.orderUID || !this.carrierOptions) return;
    const lookups = this.carrierOptions.selectors.filter(s => s.type === 'lookup');
    if (!lookups.length) return;

    this.http.post<{ data: Record<string, string> | null }>(
      `${environment.apiUrl}/admin/orders/shipment/client-pref`,
      { data: { order_uid: this.orderUID, carrier_uid: carrierUid } }
    ).subscribe({
      next: (response) => {
        const p = response.data;
        // Ignore a stale response if the operator switched carriers meanwhile,
        // or if a saved recipient already filled the form.
        if (!p || this.selectedCarrierUid !== carrierUid || this.selectedRecipientUid) return;
        this.applyValueMap(p, lookups.map(s => s.key));
        this.cdr.detectChanges();
      },
      error: () => { /* prefill is best-effort */ }
    });
  }

  // --- Saved recipient book -------------------------------------------------

  // Whether this carrier's driver supports saved recipients at all.
  get hasRecipientBook(): boolean {
    return !!this.carrierOptions?.recipient?.keys?.length;
  }

  get selectedRecipient(): ShipmentRecipient | undefined {
    return this.shipmentRecipients.find(r => r.uid === this.selectedRecipientUid);
  }

  // Loads the client's saved recipients and applies the default (or the single
  // one) straight away — the one-click path for a repeat order.
  private loadRecipients(carrierUid: string): void {
    if (!this.orderUID || !this.hasRecipientBook) {
      this.shipmentRecipients = [];
      return;
    }
    this.recipientsLoading = true;
    this.http.post<{ data: ShipmentRecipient[] }>(
      `${environment.apiUrl}/admin/orders/shipment/recipients`,
      { data: { order_uid: this.orderUID, carrier_uid: carrierUid } }
    ).subscribe({
      next: (response) => {
        // Ignore a stale response if the operator switched carriers meanwhile.
        if (this.selectedCarrierUid !== carrierUid) return;
        this.shipmentRecipients = response.data || [];
        this.recipientsLoading = false;
        // The list is already ordered default-first, so the head is the best
        // guess. An empty book leaves the form open for a new recipient.
        const preferred = this.shipmentRecipients[0];
        if (preferred) {
          this.applyRecipient(preferred.uid);
        } else {
          this.recipientEditing = true;
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.shipmentRecipients = [];
        this.recipientsLoading = false;
        this.recipientEditing = true;
        this.cdr.detectChanges();
      }
    });
  }

  // Writes a saved recipient's stored values back into the form, including the
  // resolved refs — so the destination counts as confirmed and no carrier
  // lookup has to be repeated.
  applyRecipient(uid: string): void {
    this.selectedRecipientUid = uid;
    this.recipientEditing = false;
    this.recipientError = null;
    const recipient = this.selectedRecipient;
    if (!recipient?.payload) {
      this.clearPriceResult();
      this.cdr.detectChanges();
      return;
    }
    this.applyValueMap(recipient.payload, this.carrierOptions?.recipient?.keys ?? []);
    this.clearPriceResult();
    this.cdr.detectChanges();
  }

  // Clears the recipient selection and opens the fields for a fresh entry.
  startNewRecipient(): void {
    this.selectedRecipientUid = '';
    this.recipientEditing = true;
    this.recipientError = null;
    const next = { ...this.selectorValues };
    for (const key of this.carrierOptions?.recipient?.keys ?? []) {
      next[key] = this.carrierOptions?.selectors.find(s => s.key === key)?.default ?? '';
      delete this.lookupResolved[key];
      this.lookupResults[key] = [];
    }
    this.selectorValues = next;
    this.clearPriceResult();
    this.cdr.detectChanges();
  }

  // Reveals the recipient fields for the currently selected entry. Saving then
  // updates that row rather than creating a second one.
  editRecipient(): void {
    this.recipientEditing = true;
    this.recipientError = null;
    this.cdr.detectChanges();
  }

  // Persists the recipient fields as they currently stand. With a selection this
  // updates that recipient in place; without one it creates a new entry (or
  // re-uses an identical destination the client already has).
  saveRecipient(setDefault = false): void {
    if (!this.orderUID || !this.selectedCarrierUid || this.savingRecipient) return;
    this.savingRecipient = true;
    this.recipientError = null;

    this.http.post<{ data: ShipmentRecipient }>(
      `${environment.apiUrl}/admin/orders/shipment/recipients/save`,
      {
        data: {
          uid: this.selectedRecipientUid || undefined,
          order_uid: this.orderUID,
          carrier_uid: this.selectedCarrierUid,
          values: this.recipientValues(),
          set_default: setDefault
        }
      }
    ).subscribe({
      next: (response) => {
        const saved = response.data;
        this.savingRecipient = false;
        this.recipientEditing = false;
        if (saved) {
          const index = this.shipmentRecipients.findIndex(r => r.uid === saved.uid);
          if (index >= 0) this.shipmentRecipients[index] = saved;
          else this.shipmentRecipients = [saved, ...this.shipmentRecipients];
          this.selectedRecipientUid = saved.uid;
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.savingRecipient = false;
        this.recipientError = this.extractApiErrorMessage(err);
        this.cdr.detectChanges();
      }
    });
  }

  deleteRecipient(): void {
    if (!this.selectedRecipientUid || this.savingRecipient) return;
    const uid = this.selectedRecipientUid;
    this.savingRecipient = true;

    this.http.post(`${environment.apiUrl}/admin/orders/shipment/recipients/delete`,
      { data: { uid } }
    ).subscribe({
      next: () => {
        this.savingRecipient = false;
        this.shipmentRecipients = this.shipmentRecipients.filter(r => r.uid !== uid);
        this.startNewRecipient();
      },
      error: (err) => {
        this.savingRecipient = false;
        this.recipientError = this.extractApiErrorMessage(err);
        this.cdr.detectChanges();
      }
    });
  }

  // The recipient half of the form, as the flat map the save endpoint expects:
  // the driver's recipient keys plus everything derived from them (refs, labels,
  // flattened lookup meta).
  private recipientValues(): Record<string, string> {
    const keys = this.carrierOptions?.recipient?.keys ?? [];
    const out: Record<string, string> = {};
    for (const key of keys) {
      const value = (this.selectorValues[key] ?? '').trim();
      if (value) out[key] = value;
      const resolved = this.lookupResolved[key];
      if (!resolved) continue;
      if (resolved.ref) out[`${key}_ref`] = resolved.ref;
      if (resolved.label) out[`${key}_label`] = resolved.label;
      for (const [metaKey, metaValue] of Object.entries(resolved.meta)) {
        if (metaValue) out[`${key}__${metaKey}`] = metaValue;
      }
    }
    return out;
  }

  // Restores a stored flat map into the form. Lookup selectors among `keys` are
  // marked resolved when the map carries their ref, so a restored destination is
  // treated as confirmed and dependent lookups stay enabled.
  private applyValueMap(values: Record<string, string>, keys: string[]): void {
    const next = { ...this.selectorValues };
    for (const key of keys) {
      const value = values[key];
      if (value !== undefined) next[key] = value;

      const ref = values[`${key}_ref`];
      if (!ref) continue;
      const meta: Record<string, string> = {};
      const metaPrefix = `${key}__`;
      for (const [k, v] of Object.entries(values)) {
        if (k.startsWith(metaPrefix)) meta[k.slice(metaPrefix.length)] = v;
      }
      this.lookupResolved[key] = { ref, label: values[`${key}_label`] || value || '', meta };
    }
    this.selectorValues = next;
    this.resetSelectorsWithHiddenChoice();
  }

  // --- Order data card ------------------------------------------------------
  // What the order itself records about where this goes: the receiver as
  // captured from the client/branch, and the delivery address. Reference only —
  // a carrier that resolves its own destination (Nova Poshta: settlement +
  // branch or street) never reads the address below, and an operator who mistook
  // it for the shipping destination would be misled.

  // --- Consolidation: several orders on one AWB ---------------------------
  //
  // Candidates are loaded lazily, on the first expand. Most shipments are
  // single-order, and fetching a client's order history every time the modal
  // opens would make the common case pay for the rare one.

  consolidationExpanded = false;
  consolidationLoading = false;
  consolidationLoaded = false;
  consolidationCandidates: ConsolidationCandidate[] = [];
  consolidationError: string | null = null;
  selectedConsolidationUids = new Set<string>();

  /**
   * The server's verdict on the current selection, and the only source of the
   * consignment totals. Summing box counts and weights here as well would be a
   * second implementation of a rule that already exists in Core, and the copy
   * that disagrees is the one the operator reads before booking.
   */
  consolidationCheck: ConsolidationCheckResponse | null = null;
  consolidationChecking = false;
  private consolidationCheckTimer: ReturnType<typeof setTimeout> | null = null;

  /** Set when a ticked order invalidated a quote the operator had already run. */
  priceStale = false;

  toggleConsolidation(): void {
    this.consolidationExpanded = !this.consolidationExpanded;
    if (this.consolidationExpanded && !this.consolidationLoaded) {
      this.loadConsolidationCandidates();
    }
  }

  private loadConsolidationCandidates(): void {
    if (!this.orderUID) return;

    this.consolidationLoading = true;
    this.consolidationError = null;

    this.http.post<{ data: ConsolidationCandidate[] }>(
      `${environment.apiUrl}/admin/orders/shipment/consolidation/candidates`,
      { data: { order_uid: this.orderUID } }
    ).subscribe({
      next: (response) => {
        // Eligible first, each group keeping the server's order. Blocked rows
        // are worth showing — the reason is why the operator stops looking for
        // an order that is not there — but they must not be interleaved with
        // the ones that can actually be ticked.
        const candidates = response.data || [];
        this.consolidationCandidates = [
          ...candidates.filter(c => c.eligible),
          ...candidates.filter(c => !c.eligible),
        ];
        this.consolidationLoaded = true;
        this.consolidationLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load consolidation candidates:', err);
        this.consolidationError = this.extractApiErrorMessage(err);
        this.consolidationLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  toggleConsolidationOrder(candidate: ConsolidationCandidate, event?: Event): void {
    if (!candidate.eligible) {
      // The row stays focusable so a screen reader reaches its reason, which
      // means the checkbox is still clickable and has just moved itself out of
      // step with the model. Put it back.
      const input = event?.target as HTMLInputElement | undefined;
      if (input) input.checked = false;
      return;
    }

    if (this.selectedConsolidationUids.has(candidate.order_uid)) {
      this.selectedConsolidationUids.delete(candidate.order_uid);
    } else {
      this.selectedConsolidationUids.add(candidate.order_uid);
    }
    // The quote no longer describes what would be booked. Say so, rather than
    // letting a price the operator just ran vanish from a block scrolled out of
    // sight above the picker.
    this.priceStale = !!(this.priceResult || this.priceError);
    this.clearPriceResult();
    this.scheduleConsolidationCheck();
    this.cdr.detectChanges();
  }

  isConsolidationSelected(orderUid: string): boolean {
    return this.selectedConsolidationUids.has(orderUid);
  }

  get selectedConsolidationCount(): number {
    return this.selectedConsolidationUids.size;
  }

  /**
   * Asks the server what the ticked set would actually book. Debounced, because
   * an operator ticking three orders in a row should cost one round trip, not
   * three — and the last answer is the only one that describes the selection.
   */
  private scheduleConsolidationCheck(): void {
    if (this.consolidationCheckTimer) clearTimeout(this.consolidationCheckTimer);

    if (this.selectedConsolidationUids.size === 0) {
      this.consolidationCheck = null;
      this.consolidationChecking = false;
      return;
    }

    this.consolidationChecking = true;
    this.consolidationCheckTimer = setTimeout(() => this.runConsolidationCheck(), 300);
  }

  private runConsolidationCheck(): void {
    if (!this.orderUID) return;

    // The carrier owns two of the rules, so naming it when one is chosen makes
    // the answer stricter — and matches what booking will check.
    const requested = Array.from(this.selectedConsolidationUids);
    const requestedCarrier = this.selectedCarrierUid;

    this.http.post<{ data: ConsolidationCheckResponse }>(
      `${environment.apiUrl}/admin/orders/shipment/consolidation/check`,
      {
        data: {
          order_uid: this.orderUID,
          additional_order_uids: requested,
          carrier_uid: requestedCarrier || undefined,
        }
      }
    ).subscribe({
      next: (response) => {
        // A slower earlier answer must not overwrite a newer question.
        if (!this.answersCurrentQuestion(requested, requestedCarrier)) return;
        this.consolidationCheck = response.data || null;
        this.consolidationChecking = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (!this.answersCurrentQuestion(requested, requestedCarrier)) return;
        console.error('Failed to check consolidation:', err);
        this.consolidationCheck = null;
        this.consolidationChecking = false;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Whether an answer still describes what is on screen. The carrier is part of
   * the question, not just the selection: switching carriers with the same set
   * ticked fires a second check, and the first one's verdict was reached under
   * rules that no longer apply.
   */
  private answersCurrentQuestion(uids: string[], carrierUid: string): boolean {
    return carrierUid === this.selectedCarrierUid
      && uids.length === this.selectedConsolidationUids.size
      && uids.every(uid => this.selectedConsolidationUids.has(uid));
  }

  /**
   * Why an order cannot join, in the operator's language. The backend sends a
   * stable code plus the values its sentence names; `reason` is the English
   * fallback for rules composed from a carrier's own error, which have no code.
   */
  consolidationReasonText(candidate: { reason?: string; reason_code?: string; reason_params?: Record<string, string> }): string {
    if (!candidate.reason_code) return candidate.reason || '';

    const key = `admin.orders.consolidationReason.${candidate.reason_code}`;
    const translated = this.translationService.instant(key, candidate.reason_params || {});
    return translated && translated !== key ? translated : (candidate.reason || '');
  }

  /**
   * The consolidation half of the create/price payload. Omits the key entirely
   * when nothing is ticked, so an ordinary shipment sends exactly the request it
   * always did.
   */
  private consolidationRequestFields(): Record<string, unknown> {
    if (this.selectedConsolidationUids.size === 0) return {};
    return { additional_order_uids: Array.from(this.selectedConsolidationUids) };
  }

  private resetConsolidationState(): void {
    if (this.consolidationCheckTimer) {
      clearTimeout(this.consolidationCheckTimer);
      this.consolidationCheckTimer = null;
    }
    this.consolidationExpanded = false;
    this.consolidationLoading = false;
    this.consolidationLoaded = false;
    this.consolidationCandidates = [];
    this.consolidationError = null;
    this.consolidationCheck = null;
    this.consolidationChecking = false;
    this.priceStale = false;
    this.selectedConsolidationUids.clear();
  }

  /**
   * The other orders a shipment covers, for the card's badge. Empty for an
   * ordinary shipment: the backend only fills `orders` when consolidated.
   */
  shipmentCompanionOrders(shipment: Shipment): ShipmentOrderRef[] {
    return (shipment.orders || []).filter(o => o.order_uid !== this.orderUID);
  }

  // Collapsed by default: it is reference, and open it pushes the fields that
  // actually decide the shipment below the fold of the dialog.
  orderDataExpanded = false;

  toggleOrderData(): void {
    this.orderDataExpanded = !this.orderDataExpanded;
    this.cdr.markForCheck();
  }

  // The receiver as the order records it, before any per-shipment override.
  // Mirrors the backend's own fallback chain (getReceiverName).
  get orderReceiverName(): string {
    return this.order?.branch_name || this.client?.name || this.order?.shipping_address || '';
  }

  get orderReceiverPhone(): string {
    return this.client?.phone || '';
  }

  get orderDeliveryAddress(): string {
    if (!this.order) return '';
    return [this.order.address_text, this.order.city, this.order.zipcode, this.order.country_code]
      .map(part => (part ?? '').trim())
      .filter(part => !!part)
      .join(', ');
  }

  // --- Recipient warning ----------------------------------------------------
  // Previews the receiver that will end up on the label, so the operator can
  // catch a missing contact before the carrier rejects the waybill.
  //
  // The backend resolves the receiver as override → branch → client. The panel
  // mirrors that for the name, but not for the phone: the order snapshot carries
  // branch_name and no branch contact number, so for a branch order without an
  // override the panel cannot know which number will be used (see
  // recipientPhoneWarning).

  // The value an operator has typed into the driver's recipient name/phone
  // selector, read through the carrier's recipient schema so the panel needs no
  // knowledge of any carrier's field names.
  private recipientOverride(field: 'name' | 'phone'): string {
    const schema = this.carrierOptions?.recipient;
    const key = field === 'name' ? schema?.name : schema?.phone;
    if (!key) return '';
    return (this.selectorValues[key] ?? '').trim();
  }

  get recipientName(): string {
    return this.recipientOverride('name')
      || this.order?.branch_name
      || this.client?.name
      || this.order?.shipping_address
      || '';
  }

  get recipientPhone(): string {
    return this.recipientOverride('phone') || this.client?.phone || '';
  }

  get recipientNameWarning(): boolean {
    return !this.recipientName;
  }

  // Flags a phone the carrier would reject. The test is the digit count rather
  // than a country-specific shape: nine digits is the shortest national
  // subscriber number in the markets in play, and a stricter rule would raise
  // false alarms on the carriers this dialog also serves.
  //
  // A branch order with no override is left unjudged — the label may carry the
  // branch's own number, which is not in the order snapshot, so any verdict here
  // would be a guess.
  get recipientPhoneWarning(): boolean {
    if (!this.recipientOverride('phone') && this.order?.branch_uid) return false;
    return (this.recipientPhone.replace(/\D/g, '')).length < 9;
  }

  get hasRecipientWarning(): boolean {
    return this.recipientNameWarning || this.recipientPhoneWarning;
  }

  private clearSelectorsHiddenByDependency(): void {
    if (!this.carrierOptions) return;
    let changed = false;
    const next = { ...this.selectorValues };
    for (const sel of this.carrierOptions.selectors) {
      if (!this.isSelectorVisible(sel) && next[sel.key]) {
        next[sel.key] = '';
        changed = true;
      }
    }
    if (changed) this.selectorValues = next;
  }

  // Builds the selector-derived request fields. Values are placed at the top
  // level by default; selectors with target 'extra_data' are nested under an
  // extra_data object (driver-specific fields the request can't model directly).
  private selectorRequestFields(): Record<string, unknown> {
    const root: Record<string, string> = {};
    const extra: Record<string, string> = {};
    if (this.carrierOptions) {
      for (const sel of this.carrierOptions.selectors) {
        if (!this.isSelectorVisible(sel)) continue;
        const v = (this.selectorValues[sel.key] ?? '').trim();
        if (!v) continue;
        if (sel.target === 'extra_data') extra[sel.key] = v;
        else root[sel.key] = v;

        // Submit what the autocomplete already resolved. Without this the
        // driver has to re-resolve every name against the carrier at create
        // time, which costs API calls and can pick a different match than the
        // operator saw (two streets of the same name, say).
        const resolved = this.lookupResolved[sel.key];
        if (!resolved) continue;
        const target = sel.target === 'extra_data' ? extra : root;
        if (resolved.ref) target[`${sel.key}_ref`] = resolved.ref;
        if (resolved.label) target[`${sel.key}_label`] = resolved.label;
        for (const [metaKey, metaValue] of Object.entries(resolved.meta)) {
          if (metaValue) target[`${sel.key}__${metaKey}`] = metaValue;
        }
      }
    }
    const fields: Record<string, unknown> = { ...root };
    if (Object.keys(extra).length) fields['extra_data'] = extra;
    return fields;
  }

  // Every required selector that currently blocks the create, with the reason.
  // A disabled button the operator cannot explain is worse than no button, and
  // the blocking field is often one they cannot even see: recipient fields are
  // collapsed behind the picker, so a saved recipient missing a ref (an entry
  // saved before a field existed, or restored without its resolved reference)
  // fails validation with nothing on screen to fix.
  get selectorIssues(): SelectorIssue[] {
    if (!this.carrierOptions) return [];
    const issues: SelectorIssue[] = [];
    for (const sel of this.carrierOptions.selectors) {
      if (!sel.required) continue;
      if (!this.isSelectorVisible(sel)) continue;
      const hidden = !this.isSelectorEditable(sel);
      const v = (this.selectorValues[sel.key] ?? '').trim();
      if (!v) {
        issues.push({ key: sel.key, label: this.resolveLabel(sel), reason: 'missing', hidden });
        continue;
      }
      // A lookup value only counts when it was confirmed against the carrier
      // (resolved ref), so a half-typed city can't be submitted.
      if (sel.type === 'lookup' && !this.lookupResolved[sel.key]) {
        issues.push({ key: sel.key, label: this.resolveLabel(sel), reason: 'unresolved', hidden });
      }
    }
    return issues;
  }

  get areSelectorsValid(): boolean {
    return this.selectorIssues.length === 0;
  }

  // True when something the operator cannot see is what blocks the create, so
  // the hint can offer to open the recipient fields.
  get hasHiddenSelectorIssue(): boolean {
    return this.selectorIssues.some(i => i.hidden);
  }

  isSelectorInvalid(sel: ProviderSelector): boolean {
    return this.selectorIssues.some(i => i.key === sel.key);
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

  private extractApiErrorMessage(err: any): string {
    const body = err?.error;
    if (typeof body === 'string' && body.trim()) {
      return body;
    }
    const nested = body?.error;
    if (typeof nested === 'string' && nested.trim()) {
      return nested;
    }
    if (typeof nested?.message === 'string' && nested.message.trim()) {
      return nested.message;
    }
    if (typeof body?.status_message === 'string' && body.status_message.trim()) {
      return body.status_message;
    }
    if (typeof body?.message === 'string' && body.message.trim()) {
      return body.message;
    }
    if (typeof err?.message === 'string' && err.message.trim()) {
      return err.message;
    }
    return 'Failed to calculate price';
  }

  clearPriceResult(): void {
    if (this.priceResult || this.priceError) {
      this.priceResult = null;
      this.priceError = null;
    }
    if (this.createShipmentError) {
      this.createShipmentError = null;
    }
  }

  calculatePrice(): void {
    if (!this.selectedCarrierUid || !this.orderUID || this.calculatingPrice) return;
    if (!this.areSelectorsValid) return;

    this.calculatingPrice = true;
    this.priceResult = null;
    this.priceError = null;
    // Whatever made the last quote stale is about to be answered.
    this.priceStale = false;

    this.http.post<{ data: { price: number; fuel_surcharge: number; total_price: number; currency?: string; estimated_delivery_date?: string } }>(
      `${environment.apiUrl}/admin/orders/shipment/price`,
      {
        data: {
          order_uid: this.orderUID,
          ...this.consolidationRequestFields(),
          carrier_uid: this.selectedCarrierUid,
          box_uid: this.selectedBoxUID || undefined,
          weight_kg: this.shipmentWeight,
          pieces_count: this.shipmentPieces,
          length_cm: this.shipmentLength || undefined,
          width_cm: this.shipmentWidth || undefined,
          height_cm: this.shipmentHeight || undefined,
          ...this.selectorRequestFields()
        }
      }
    ).subscribe({
      next: (response) => {
        this.priceResult = response.data || null;
        this.calculatingPrice = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.priceError = this.extractApiErrorMessage(err);
        this.calculatingPrice = false;
        this.cdr.detectChanges();
      }
    });
  }

  createShipment(): void {
    if (this.creatingShipment) return; // guard against double-submit → duplicate carrier shipment
    if (!this.selectedCarrierUid || !this.orderUID) return;
    if (!this.areSelectorsValid) return;

    this.creatingShipment = true;
    this.createShipmentError = null;
    this.http.post<{ data: Shipment }>(`${environment.apiUrl}/admin/orders/shipment/create`, {
      data: {
        order_uid: this.orderUID,
        ...this.consolidationRequestFields(),
        carrier_uid: this.selectedCarrierUid,
        box_uid: this.selectedBoxUID || undefined,
        weight_kg: this.shipmentWeight,
        pieces_count: this.shipmentPieces,
        length_cm: this.shipmentLength || undefined,
        width_cm: this.shipmentWidth || undefined,
        height_cm: this.shipmentHeight || undefined,
        ...this.selectorRequestFields()
      }
    }).subscribe({
      next: () => {
        this.creatingShipment = false;
        this.closeCreateShipmentModal();
        // Reload order (delivery cost updated) and shipment data
        this.loadOrderDetail();
        this.loadShipmentData();
      },
      error: (err) => {
        console.error('Failed to create shipment:', err);
        this.creatingShipment = false;
        this.createShipmentError = this.extractApiErrorMessage(err);
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
            const updated = response.data;
            // Preserve the existing action buttons if the response omits them,
            // so refreshing never leaves the row without its controls.
            if (!updated.actions?.length) {
              updated.actions = this.orderShipments[index].actions;
            }
            // Likewise keep the existing tracking-event timeline if the response
            // carries none, so a refresh never blanks the history.
            if (!updated.events?.length) {
              updated.events = this.orderShipments[index].events;
            }
            this.orderShipments[index] = updated;
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
    this.fetchShipmentLabel(shipment).subscribe({
      next: (label) => {
        if (label.url) {
          window.open(label.url, '_blank');
          return;
        }
        if (label.data) {
          this.triggerDownload(label.data, label.format, shipment);
        }
      },
      error: (err) => {
        console.error('Failed to download label:', err);
      }
    });
  }

  // Print the shipping label by loading the PDF into a hidden iframe and
  // firing the browser's print dialog. Non-PDF formats (ZPL/EPL) fall back
  // to a download since browsers cannot render thermal-printer payloads.
  printLabel(shipment: Shipment): void {
    if (this.printingShipmentUid) {
      return;
    }
    this.printingShipmentUid = shipment.uid;
    this.cdr.detectChanges();

    this.fetchShipmentLabel(shipment).subscribe({
      next: (label) => {
        this.printingShipmentUid = null;
        this.cdr.detectChanges();

        if (label.url) {
          window.open(label.url, '_blank');
          return;
        }
        if (!label.data) {
          return;
        }

        const format = (label.format || 'PDF').toUpperCase();
        if (format !== 'PDF') {
          // Thermal-printer formats can't be browser-printed; fall back to
          // download so the user can send the file to the printer driver.
          this.triggerDownload(label.data, format, shipment);
          return;
        }

        this.openLabelForPrint(label.data, shipment);
      },
      error: (err) => {
        console.error('Failed to print label:', err);
        this.printingShipmentUid = null;
        this.cdr.detectChanges();
      }
    });
  }

  carrierRejectedReason(shipment: Shipment): { summary: string; details: string | null } | null {
    const desc = shipment.status_description || '';
    const prefix = 'carrier_rejected:';
    if (!desc.startsWith(prefix)) {
      return null;
    }
    return this.splitTechnicalPayload(desc.slice(prefix.length).trim());
  }

  shipmentErrorMessage(shipment: Shipment): { summary: string; details: string | null } | null {
    if (!shipment.error_message) {
      return null;
    }
    return this.splitTechnicalPayload(shipment.error_message);
  }

  private splitTechnicalPayload(raw: string): { summary: string; details: string | null } {
    const jsonStart = raw.search(/[{[]/);
    if (jsonStart < 0) {
      return { summary: raw.replace(/[\s;:,.]+$/, '').trim(), details: null };
    }
    const summary = raw.slice(0, jsonStart).replace(/[\s;:,.]+$/, '').trim();
    const details = raw.slice(jsonStart).trim();
    let pretty = details;
    try {
      pretty = JSON.stringify(JSON.parse(details), null, 2);
    } catch {
      // not valid JSON — keep raw
    }
    return { summary: summary || raw, details: pretty };
  }

  handleShipmentAction(shipment: Shipment, action: ShipmentAction): void {
    switch (action.key) {
      case 'track':
        this.refreshShipmentTracking(shipment);
        return;
      case 'label_print':
        this.printLabel(shipment);
        return;
      case 'label_download':
        this.downloadLabel(shipment);
        return;
      case 'cancel':
        this.cancelShipment(shipment);
        return;
      case 'book_pickup':
        this.bookPickupNow(shipment);
        return;
      default:
        console.warn('Unknown shipment action key:', action.key);
    }
  }

  isShipmentActionBusy(shipment: Shipment, key: string): boolean {
    switch (key) {
      case 'track':
        return this.trackingShipmentUid === shipment.uid;
      case 'label_print':
        return this.printingShipmentUid === shipment.uid;
      case 'cancel':
        return this.cancellingShipmentUid === shipment.uid;
      case 'book_pickup':
        return this.bookingPickupUid === shipment.uid;
      default:
        return false;
    }
  }

  shipmentActionClass(action: ShipmentAction): string {
    const base = 'btn-track-icon';
    if (action.variant === 'danger') return `${base} btn-icon-cancel`;
    if (action.key === 'label_print') return `${base} btn-icon-print`;
    return base;
  }

  async cancelShipment(shipment: Shipment): Promise<void> {
    if (this.cancellingShipmentUid) {
      return;
    }
    const confirmed = await this.confirmDialog.ask({
      message: this.translationService.instant('admin.orders.confirmCancelShipment'),
      danger: true
    });
    if (!confirmed) {
      return;
    }
    this.cancellingShipmentUid = shipment.uid;
    this.cdr.detectChanges();

    this.http.post<{ data: Shipment }>(`${environment.apiUrl}/admin/orders/shipment/${shipment.uid}/cancel`, {}).subscribe({
      next: (response) => {
        const index = this.orderShipments.findIndex(s => s.uid === shipment.uid);
        if (index >= 0 && response?.data) {
          this.orderShipments[index] = response.data;
        } else if (index >= 0) {
          this.orderShipments[index] = { ...this.orderShipments[index], status: 'cancelled' };
        }
        this.cancellingShipmentUid = null;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to cancel shipment:', err);
        this.cancellingShipmentUid = null;
        this.cdr.detectChanges();
      }
    });
  }

  // Book a courier pickup (carrier dispatch order) for a single shipment on
  // demand. The backend returns a message indicating whether a pickup was
  // actually booked — some sending methods (e.g. paczkomat drop-off) book
  // nothing by design — so we surface that message to the operator.
  bookPickupNow(shipment: Shipment): void {
    if (this.bookingPickupUid) {
      return;
    }
    this.bookingPickupUid = shipment.uid;
    this.cdr.detectChanges();

    this.http.post<{ data: Shipment; status_message?: string }>(
      `${environment.apiUrl}/admin/orders/shipment/${shipment.uid}/book-pickup`, {}
    ).subscribe({
      next: (response) => {
        const index = this.orderShipments.findIndex(s => s.uid === shipment.uid);
        if (index >= 0 && response?.data) {
          const updated = response.data;
          if (!updated.events?.length) {
            updated.events = this.orderShipments[index].events;
          }
          this.orderShipments[index] = updated;
        }
        this.bookingPickupUid = null;
        this.cdr.detectChanges();
        if (response?.status_message) {
          this.notifications.info(this.translationService.instant(response.status_message));
        }
      },
      error: (err) => {
        console.error('Failed to book pickup:', err);
        this.bookingPickupUid = null;
        this.cdr.detectChanges();
        this.notifications.error(this.translationService.instant('admin.orders.bookPickupError'));
      }
    });
  }

  private fetchShipmentLabel(shipment: Shipment) {
    return this.http.get<{ data: { format: string; data: string; url?: string } }>(
      `${environment.apiUrl}/admin/orders/shipment/${shipment.uid}/label`
    ).pipe(
      // Lift the inner data object so callers don't repeat the unwrap.
      map(response => response.data || { format: '', data: '' })
    );
  }

  private base64ToBlobUrl(base64: string, mime: string): string {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: mime });
    return window.URL.createObjectURL(blob);
  }

  private triggerDownload(base64: string, format: string, shipment: Shipment): void {
    const ext = this.labelExtension(format);
    const mime = this.labelMime(format);
    const url = this.base64ToBlobUrl(base64, mime);
    const link = document.createElement('a');
    link.href = url;
    link.download = `label-${shipment.tracking_number || shipment.uid}.${ext}`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  // openLabelForPrint loads the PDF into a hidden iframe and asks the embedded
  // viewer to print. Falls back to opening a new tab if the iframe approach
  // fails (e.g. Safari with PDF rendering disabled).
  private openLabelForPrint(base64: string, shipment: Shipment): void {
    const url = this.base64ToBlobUrl(base64, 'application/pdf');
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;

    let printed = false;
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        printed = true;
      } catch (err) {
        console.warn('iframe print failed, falling back to new tab', err);
      }
    };

    // If the iframe didn't trigger a print within a reasonable window,
    // assume the embedded PDF viewer can't auto-print and open a new tab so
    // the user has manual control.
    setTimeout(() => {
      if (!printed) {
        window.open(url, '_blank');
      }
    }, 1500);

    document.body.appendChild(iframe);

    // Clean the iframe + blob URL up after the print dialog is likely done.
    // No reliable cross-browser signal exists; one minute is generous enough
    // for the user to confirm the dialog without leaking the URL forever.
    setTimeout(() => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
      window.URL.revokeObjectURL(url);
    }, 60_000);

    // Fallback marker for the unused parameter; kept so the signature mirrors
    // triggerDownload and reads cleanly at the call site.
    void shipment;
  }

  private labelExtension(format: string): string {
    switch (format.toUpperCase()) {
      case 'ZPL':
        return 'zpl';
      case 'EPL':
        return 'epl';
      default:
        return 'pdf';
    }
  }

  private labelMime(format: string): string {
    switch (format.toUpperCase()) {
      case 'ZPL':
      case 'EPL':
        return 'application/octet-stream';
      default:
        return 'application/pdf';
    }
  }

  getCarrierName(carrierUid: string): string {
    const carrier = this.shipmentCarriers.find(c => c.uid === carrierUid);
    return carrier?.name || carrierUid;
  }

  getCarrierCurrency(carrierUid: string): string {
    return this.shipmentCarriers.find(c => c.uid === carrierUid)?.currency || '';
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
        return 'shipment-error';
      case 'cancelled':
        return 'shipment-cancelled';
      default:
        return '';
    }
  }

  formatShipmentDate(dateString: string | null): string {
    return formatDateShort(dateString);
  }

  // Stage change methods
  openStageChangeModal(): void {
    this.showStageChangeModal = true;
    this.selectedTargetStageUid = '';
    this.stageChangeError = null;
    this.transitionsLoading = true;
    this.cdr.detectChanges();

    forkJoin({
      transitions: this.crmService.getTransitions(),
      stages: this.crmService.getStages()
    }).subscribe({
      next: ({ transitions, stages }) => {
        if (!this.currentStage) {
          this.availableTransitions = [];
          this.transitionsLoading = false;
          this.cdr.detectChanges();
          return;
        }
        const validTargetUids = transitions
          .filter(t => t.from_stage_uid === this.currentStage!.uid)
          .map(t => t.to_stage_uid);
        this.availableTransitions = stages
          .filter(s => validTargetUids.includes(s.uid))
          .sort((a, b) => a.sort_order - b.sort_order);
        this.transitionsLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.stageChangeError = this.translationService.instant('crm.loadError');
        this.transitionsLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeStageChangeModal(): void {
    this.showStageChangeModal = false;
    this.selectedTargetStageUid = '';
    this.stageChangeError = null;
    this.availableTransitions = [];
    this.cdr.detectChanges();
  }

  confirmStageChange(): void {
    if (this.changingStage) return; // guard against double-submit → duplicate stage move + notifications
    if (!this.selectedTargetStageUid || !this.orderUID) return;
    this.changingStage = true;
    this.stageChangeError = null;

    this.crmService.moveOrder(this.orderUID, this.selectedTargetStageUid, true).subscribe({
      next: () => {
        this.changingStage = false;
        this.crmService.clearStagesCache();
        this.crmService.clearTransitionsCache();
        this.closeStageChangeModal();
        this.loadOrderDetail();
      },
      error: (err) => {
        const message = err?.error?.message || err?.error?.error || this.translationService.instant('crm.moveError');
        this.stageChangeError = message;
        this.changingStage = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Admin-only: open the force-move modal listing every stage regardless of
  // pipeline transitions.
  openForceMoveModal(): void {
    if (!this.isAdmin) return;
    this.showForceMoveModal = true;
    this.selectedForceMoveStageUid = '';
    this.forceMoveError = null;
    this.forceMoveStagesLoading = true;
    this.cdr.detectChanges();

    const storeUid = this.order?.store_uid;
    this.crmService.getStages().subscribe({
      next: (stages) => {
        const filtered = storeUid
          ? stages.filter(s => !s.store_uid || s.store_uid === storeUid)
          : stages;
        this.allStages = filtered
          .filter(s => s.active !== false && s.uid !== this.currentStage?.uid)
          .sort((a, b) => a.sort_order - b.sort_order);
        this.forceMoveStagesLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.forceMoveError = this.translationService.instant('crm.loadError');
        this.forceMoveStagesLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  closeForceMoveModal(): void {
    this.showForceMoveModal = false;
    this.selectedForceMoveStageUid = '';
    this.forceMoveError = null;
    this.allStages = [];
    this.cdr.detectChanges();
  }

  confirmForceMove(): void {
    if (this.forceMoving) return; // guard against double-submit → duplicate stage move + notifications
    if (!this.selectedForceMoveStageUid || !this.orderUID || !this.isAdmin) return;
    this.forceMoving = true;
    this.forceMoveError = null;

    this.crmService.forceMoveOrder(this.orderUID, this.selectedForceMoveStageUid).subscribe({
      next: () => {
        this.forceMoving = false;
        this.crmService.clearStagesCache();
        this.crmService.clearTransitionsCache();
        this.closeForceMoveModal();
        this.loadOrderDetail();
      },
      error: (err) => {
        const message = err?.error?.message || err?.error?.error || this.translationService.instant('crm.moveError');
        this.forceMoveError = message;
        this.forceMoving = false;
        this.cdr.detectChanges();
      }
    });
  }
}
