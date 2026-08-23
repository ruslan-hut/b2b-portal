import { Component, ChangeDetectorRef, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { OrderService } from '../../core/services/order.service';
import { AuthService } from '../../core/services/auth.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { ErrorHandlerService, OrderErrorDetail } from '../../core/services/error-handler.service';
import { Order, OrderItem, CreateOrderRequest, ShippingAddress, CartAddress, RemovedCartItem, CartLockInfo } from '../../core/models/order.model';
import { User, Client } from '../../core/models/user.model';

// Extended OrderItem interface for cart display with stock validation
interface CartItem extends OrderItem {
  insufficientStock?: boolean;
  availableQuantity?: number;
  active?: boolean;
}

@Component({
  selector: 'app-cart-page',
  templateUrl: './cart-page.component.html',
  styleUrls: ['./cart-page.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartPageComponent implements OnInit, OnDestroy {
  cartItems: CartItem[] = [];
  cartTotal = 0;
  cartOriginalTotal = 0;
  cartOriginalTotalWithVat = 0; // GROSS original price (matches product card display)
  cartDiscountAmount = 0;
  cartDiscountAmountWithVat = 0; // GROSS discount amount
  cartSubtotal = 0;
  cartVatAmount = 0;
  currentDiscount = 0;
  currentVatRate = 0;
  hasDiscount = false;
  hasVat = false;
  orderComment = '';
  commentSectionExpanded = false;
  isCreatingOrder = false;
  // True once an order has been successfully placed, until we navigate away.
  // Guards against a second submission if the user dismisses the success dialog
  // before the auto-navigate fires.
  orderPlaced = false;
  private successTimeout: ReturnType<typeof setTimeout> | null = null;
  showOrderDialog = false;
  isOrderSuccess = false;
  currencyName: string | undefined = undefined;

  // Error dialog state (replaces native alert on order failure)
  showErrorDialog = false;
  errorDetail: OrderErrorDetail | null = null;
  // Products the last rejected checkout named as problems. The cart row itself
  // carries no flag for reasons like "no price" or "deleted", so without this the
  // "Show problem items" filter would come up empty for exactly those failures.
  private problemProductUids = new Set<string>();

  // Filter state — when true, only items flagged as problems render in the lists.
  showProblemsOnly = false;

  // Items removed from the draft by cart validation on login (dismissible notice)
  removedItems: RemovedCartItem[] = [];
  // True while the "another session changed this cart" notice is showing.
  cartConflict = false;
  // Set while another session holds the cart; carries who, for the notice.
  cartLocked: CartLockInfo | null = null;
  takingOverCart = false;
  // True after the cart was reloaded because another session changed it.
  cartRefreshed = false;

  // Address for cart
  currentAddress: CartAddress | null = null;
  selectedAddressUid: string | undefined;

  // Entity info
  entityType: 'user' | 'client' | null = null;
  currentEntity: User | Client | null = null;

  // Whether to show numeric stock quantity to clients
  showQuantity: boolean = true;

  // Whether the client's store requires a business registration number to confirm an order
  storeRequiresBusinessRegistration: boolean = true;

  // Mobile expandable cards state
  expandedItems: Set<string> = new Set();

  // Mobile "show more" state
  showAllMobileItems = false;
  readonly mobileItemsLimit = 5;

  private subscriptions = new Subscription();

  constructor(
    private orderService: OrderService,
    private authService: AuthService,
    private appSettingsService: AppSettingsService,
    private errorHandler: ErrorHandlerService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to entity type
    this.subscriptions.add(
      this.authService.entityType$.subscribe(type => {
        this.entityType = type;
      })
    );

    // Subscribe to current entity
    this.subscriptions.add(
      this.authService.currentEntity$.subscribe(entity => {
        this.currentEntity = entity;
        if (this.authService.entityTypeValue === 'client') {
          const client = entity as Client;
          // Placeholder until the backend breakdown arrives below; mirror the
          // order-level total (own discount + bonus) so it does not jump.
          this.currentDiscount = (client?.discount || 0) + (client?.additional_discount || 0);
          this.hasDiscount = this.currentDiscount > 0;
          this.currentVatRate = this.appSettingsService.getEffectiveVatRate();
          this.hasVat = this.currentVatRate > 0;
        } else {
          this.currentDiscount = 0;
          this.currentVatRate = 0;
          this.hasDiscount = false;
          this.hasVat = false;
        }
        this.cdr.markForCheck();
      })
    );

    // Subscribe to AppSettings for currency
    this.subscriptions.add(
      this.appSettingsService.settings$.subscribe(settings => {
        if (settings?.currency) {
          this.currencyName = settings.currency.name;
        } else {
          this.currencyName = undefined;
        }
        this.showQuantity = settings?.store?.show_quantity ?? true;
        this.storeRequiresBusinessRegistration = settings?.store?.require_business_registration ?? true;
        this.cdr.markForCheck();
      })
    );

    // Subscribe to cart items
    this.subscriptions.add(
      this.orderService.currentOrder$.subscribe(items => {
        this.cartItems = this.sortProductsByName(items.map(item => ({
          ...item,
          insufficientStock: item.availableQuantity !== undefined && item.quantity > item.availableQuantity,
          availableQuantity: item.availableQuantity,
          active: item.active
        })));
        // If the user filtered to problems-only and the last problem disappeared,
        // drop the filter so the cart doesn't look empty for confusing reasons.
        if (this.showProblemsOnly && this.problemCount === 0) {
          this.showProblemsOnly = false;
        }
      })
    );

    // Single subscription to cart totals — re-emits whenever the draft order
    // updates. Avoids leaking a new subscription per items / address change.
    this.subscriptions.add(
      this.orderService.getCartTotalsBreakdown().subscribe(breakdown => {
        this.cartOriginalTotal = breakdown.originalTotal;
        this.cartOriginalTotalWithVat = breakdown.originalTotalWithVat;
        this.cartDiscountAmount = breakdown.discountAmount;
        this.cartDiscountAmountWithVat = breakdown.discountAmountWithVat;
        this.cartSubtotal = breakdown.subtotal;
        this.cartVatAmount = breakdown.vatAmount;
        this.cartTotal = breakdown.total;
        this.currentDiscount = breakdown.discountPercent;
        this.currentVatRate = breakdown.vatRate;
        this.hasDiscount = breakdown.hasDiscount;
        this.hasVat = breakdown.hasVat;
        this.cdr.markForCheck();
      })
    );

    // Items removed by server-side cart validation (on login)
    this.subscriptions.add(
      this.orderService.removedCartItems$.subscribe(items => {
        this.removedItems = items;
        this.cdr.markForCheck();
      })
    );

    // A save refused because another session had already changed the cart
    this.subscriptions.add(
      this.orderService.cartConflict$.subscribe(conflict => {
        this.cartConflict = conflict;
        this.cdr.markForCheck();
      })
    );

    // A save refused because another session is holding the cart
    this.subscriptions.add(
      this.orderService.cartLocked$.subscribe(locked => {
        this.cartLocked = locked;
        this.cdr.markForCheck();
      })
    );

    // Subscribe to draft order changes to get address data
    this.subscriptions.add(
      this.orderService.currentDraftOrder$.subscribe((order: Order | null) => {
        if (order) {
          this.currentAddress = order.address || null;
          this.selectedAddressUid = order.address?.uid;
          this.orderComment = order.comment || '';
        } else {
          this.currentAddress = null;
          this.selectedAddressUid = undefined;
        }
        this.cdr.markForCheck();
      })
    );

    // The cart was pulled in again because another session changed it
    this.subscriptions.add(
      this.orderService.cartRefreshed$.subscribe(refreshed => {
        this.cartRefreshed = refreshed;
        this.cdr.markForCheck();
      })
    );

    // Notice changes made in another session while this page is open, instead of
    // letting the list drift until the user next touches it. Torn down with the
    // rest of the subscriptions when the page closes, so nothing polls in the
    // background.
    this.subscriptions.add(this.orderService.watchCartState());
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.successTimeout) {
      clearTimeout(this.successTimeout);
      this.successTimeout = null;
    }
  }

  sortProductsByName(products: CartItem[]): CartItem[] {
    return products.sort((a, b) => {
      const aSortOrder = a.sortOrder ?? 999999;
      const bSortOrder = b.sortOrder ?? 999999;
      if (aSortOrder !== bSortOrder) {
        return aSortOrder - bSortOrder;
      }
      return a.productName.localeCompare(b.productName);
    });
  }

  removeFromCart(productId: string): void {
    this.orderService.removeFromCart(productId);

    // A line change: the server drops just this line, and deletes the draft itself
    // if it was the last one — no separate empty-cart call needed here, and no risk
    // of deleting a cart another session has meanwhile added to.
    this.orderService.changeCartItem(productId, 'remove', 0, this.selectedAddressUid, this.orderComment).subscribe({
      next: () => {
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error(`Error saving cart after removing product ${productId}:`, error);
      }
    });
  }

  /**
   * Quantity typed into the box, which arrives a digit at a time. The change is
   * marked as settling so "12" is stored once as 12, not as 1 and then 12.
   *
   * An empty box is not a removal: clearing it to type a new number would
   * otherwise delete the line under the user mid-edit. Removal is the trash
   * button.
   */
  onQuantityInput(productId: string, quantity: number | null): void {
    if (quantity === null || !Number.isFinite(quantity) || quantity <= 0) {
      return;
    }
    this.updateQuantity(productId, quantity, true);
  }

  updateQuantity(productId: string, quantity: number, settle = false): void {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    this.orderService.updateCartItemQuantity(productId, quantity);
    this.orderService.changeCartItem(productId, 'set', quantity, this.selectedAddressUid, this.orderComment, settle).subscribe({
      next: () => {
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to save draft cart after quantity change:', err);
      }
    });
  }

  onAddressChange(addressUid: string): void {
    if (!addressUid) return;

    this.selectedAddressUid = addressUid;

    if (this.cartItems.length > 0) {
      this.orderService.saveDraftCart(addressUid).subscribe({
        error: (err) => {
          console.error('[Cart Address Change] Failed to save cart with new address:', err);
        }
      });
    }
  }

  hasSelectedAddress(): boolean {
    return !!this.currentAddress;
  }

  /**
   * True when the cart's delivery address is billed to a branch the ERP has
   * deactivated. The backend refuses to confirm such an order, so the button is
   * blocked here and the reason is stated next to it instead of letting the
   * client hit a rejection at the end of checkout.
   */
  get hasInactiveBranch(): boolean {
    return !!this.currentAddress?.branch_uid && this.currentAddress.branch_active === false;
  }

  /** Branch the cart is invoiced to, for display next to the confirm button. */
  get billedBranchName(): string {
    return this.currentAddress?.branch_name || '';
  }

  get hasInsufficientStock(): boolean {
    return this.cartItems.some(item => item.insufficientStock);
  }

  get hasInactiveProducts(): boolean {
    return this.cartItems.some(item => item.active === false);
  }

  isProblemItem(item: CartItem): boolean {
    return !!item.insufficientStock || item.active === false || this.problemProductUids.has(item.productId);
  }

  get problemCount(): number {
    return this.cartItems.reduce((n, i) => n + (this.isProblemItem(i) ? 1 : 0), 0);
  }

  get hasBlockingProblems(): boolean {
    return this.problemCount > 0;
  }

  /** Items shown in the desktop list — filtered when "Problems only" is on. */
  get displayedItems(): CartItem[] {
    return this.showProblemsOnly
      ? this.cartItems.filter(i => this.isProblemItem(i))
      : this.cartItems;
  }

  dismissConflictNotice(): void {
    this.orderService.dismissCartConflict();
  }

  dismissLockedNotice(): void {
    this.orderService.dismissCartLocked();
  }

  dismissRefreshedNotice(): void {
    this.orderService.dismissCartRefreshed();
  }

  /**
   * Claim the cart from the session currently holding it. The cart shown after
   * this is the server's, which may differ from what was on screen — that other
   * session may have saved before losing the lease.
   */
  takeOverCart(): void {
    if (this.takingOverCart) {
      return;
    }
    this.takingOverCart = true;
    this.cdr.markForCheck();

    this.orderService.takeOverCart().subscribe({
      next: () => {
        this.takingOverCart = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to take over the cart:', err);
        this.takingOverCart = false;
        this.cdr.markForCheck();
      }
    });
  }

  dismissRemovedNotice(): void {
    this.orderService.dismissRemovedCartItems();
  }

  toggleProblemsFilter(): void {
    this.showProblemsOnly = !this.showProblemsOnly;
    if (this.showProblemsOnly) {
      // Reset mobile pagination so the user sees all problems immediately.
      this.showAllMobileItems = true;
    }
    this.cdr.markForCheck();
  }

  proceedToCheckout(): void {
    if (this.cartItems.length === 0 || this.isCreatingOrder || this.orderPlaced) {
      return;
    }

    this.isCreatingOrder = true;
    this.showOrderDialog = true;

    const emptyAddress: ShippingAddress = {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    };

    const orderRequest: CreateOrderRequest = {
      items: this.cartItems.map(item => ({
        productId: item.productId,
        quantity: item.quantity
      })),
      shippingAddress: emptyAddress,
      comment: this.orderComment.trim() || undefined
    };

    this.orderService.createOrder(orderRequest, 'new').subscribe({
      next: (order) => {
        this.isCreatingOrder = false;
        this.orderPlaced = true;
        this.cartTotal = order.totalAmount || this.cartTotal;
        this.isOrderSuccess = true;
        // Clear the cart immediately on success. The draft order is already
        // consumed server-side, so leaving items in the local cart would let a
        // manual dialog-close re-enable the Confirm button and create a
        // duplicate order. With the cart empty, proceedToCheckout() is a no-op.
        this.orderService.clearCart();
        this.orderComment = '';
        this.successTimeout = setTimeout(() => {
          this.completeOrderFlow();
        }, 1500);
      },
      error: (error) => {
        this.isCreatingOrder = false;
        console.error('Error creating order:', error);
        this.closeOrderDialog();
        const detail = this.errorHandler.getOrderErrorDetail(error);
        // Backend returns SKU/uid only — fill in human-readable names from the
        // local cart so the dialog reads naturally.
        detail.problems = detail.problems.map(p => {
          if (p.name) return p;
          const local = this.cartItems.find(i => i.productId === p.productUid || i.sku === p.sku);
          return { ...p, name: local?.productName ?? p.sku };
        });
        this.problemProductUids = new Set(detail.problems.map(p => p.productUid).filter(Boolean));
        this.errorDetail = detail;
        this.showErrorDialog = true;
        this.cdr.markForCheck();
      }
    });
  }

  closeErrorDialog(): void {
    this.showErrorDialog = false;
    this.errorDetail = null;
    this.cdr.markForCheck();
  }

  showProblemItemsFromError(): void {
    this.showProblemsOnly = true;
    this.showAllMobileItems = true;
    this.closeErrorDialog();
  }

  // completeOrderFlow finishes a successful checkout: it cancels any pending
  // auto-navigate timer, hides the dialog, and routes to order history. Safe to
  // call more than once (timer fire + manual dismiss race).
  private completeOrderFlow(): void {
    if (this.successTimeout) {
      clearTimeout(this.successTimeout);
      this.successTimeout = null;
    }
    this.showOrderDialog = false;
    this.isOrderSuccess = false;
    this.router.navigate(['/orders/history']);
  }

  closeOrderDialog(): void {
    // If the order already succeeded, dismissing the dialog early should just
    // complete the flow (navigate) rather than drop the user back on an
    // already-cleared cart.
    if (this.orderPlaced) {
      this.completeOrderFlow();
      return;
    }
    this.showOrderDialog = false;
    this.isOrderSuccess = false;
    this.isCreatingOrder = false;
  }

  goBack(): void {
    this.router.navigate(['/products/catalog']);
  }

  getUserData(): User | null {
    return this.entityType === 'user' ? this.currentEntity as User : null;
  }

  getClientData(): Client | null {
    return this.entityType === 'client' ? this.currentEntity as Client : null;
  }

  get isMissingBusinessRegistration(): boolean {
    if (this.entityType !== 'client') {
      return false;
    }
    if (!this.storeRequiresBusinessRegistration) {
      return false;
    }
    const client = this.getClientData();
    // Don't block while the client entity is still loading; the backend enforces this regardless.
    if (!client) {
      return false;
    }
    return !client.business_registration_number;
  }

  // Mobile expandable card methods
  toggleItemExpanded(productId: string): void {
    if (this.expandedItems.has(productId)) {
      this.expandedItems.delete(productId);
    } else {
      this.expandedItems.add(productId);
    }
  }

  isItemExpanded(productId: string): boolean {
    return this.expandedItems.has(productId);
  }

  // Mobile "show more" methods — operate on the filtered list so the
  // "Problems only" toggle composes correctly.
  get visibleMobileItems(): CartItem[] {
    const items = this.displayedItems;
    if (this.showAllMobileItems || items.length <= this.mobileItemsLimit) {
      return items;
    }
    return items.slice(0, this.mobileItemsLimit);
  }

  get hasMoreMobileItems(): boolean {
    return this.displayedItems.length > this.mobileItemsLimit;
  }

  get remainingMobileItemsCount(): number {
    return this.displayedItems.length - this.mobileItemsLimit;
  }

  toggleShowAllMobileItems(): void {
    this.showAllMobileItems = !this.showAllMobileItems;
  }
}
