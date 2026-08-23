import { Injectable, DestroyRef, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject, ReplaySubject, throwError, EMPTY, Subscription, interval } from 'rxjs';
import { delay, map, catchError, switchMap, finalize, tap, filter } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Order, OrderItem, CreateOrderRequest, ClientPhase, ShippingAddress, CartAddress, RemovedCartItem, CartLockInfo } from '../models/order.model';
import { AuthService } from './auth.service';
import { ProductService } from './product.service';
// PriceCalculationService removed - all calculations done on backend
import { StoreService } from './store.service';
import { AppSettingsService } from './app-settings.service';
import { Client } from '../models/user.model';
import { environment } from '../../../environments/environment';
import { MOCK_ORDERS } from '../mock-data/orders.mock';
import { ApiResponse } from '../models/api.model';

// How long a typed quantity is held before it is sent. Long enough to swallow the
// gap between digits, short enough that the cart does not feel unsaved.
const CART_ITEM_SETTLE_MS = 350;

/**
 * One cart line change waiting for its turn on the wire, plus everyone who asked
 * for a change on that line and is waiting to be told how it turned out.
 */
interface PendingCartItemChange {
  mode: 'set' | 'increment' | 'remove';
  quantity: number;
  addressUid?: string;
  comment?: string;
  waiters: ReplaySubject<Order | null>[];
}

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private currentOrderSubject = new BehaviorSubject<OrderItem[]>([]);
  public currentOrder$ = this.currentOrderSubject.asObservable();

  private readonly apiUrl = environment.apiUrl;

  // Track currently saved draft order UID (if any)
  private draftOrderUid?: string;

  // Concurrency token for the server-side cart, as last issued by the backend.
  // Sent with every cart save so the server can refuse a write built on a view
  // that another session of the same client has since superseded. Undefined means
  // "no token held" — the save then falls back to last-write-wins, which is what
  // happens on the order-history fallback path that carries no version.
  private draftCartVersion?: number;

  // Store the current draft order with backend-calculated totals
  private currentDraftOrderSubject = new BehaviorSubject<Order | null>(null);
  currentDraftOrder$ = this.currentDraftOrderSubject.asObservable();

  // Items removed from the draft by server-side cart validation on login;
  // the cart page shows a dismissible notice until dismissRemovedCartItems().
  private removedCartItemsSubject = new BehaviorSubject<RemovedCartItem[]>([]);
  removedCartItems$ = this.removedCartItemsSubject.asObservable();

  // Set when the server refused a cart save because another session of the same
  // client had already changed the cart. The local cart is replaced with the
  // server's, so the flag is what tells the user why what they just did did not
  // stick. Cleared by dismissCartConflict().
  private cartConflictSubject = new BehaviorSubject<boolean>(false);
  cartConflict$ = this.cartConflictSubject.asObservable();

  // Set when the server refused a cart save because another session of this
  // client holds the editing lease. Unlike a conflict this is not resolved by
  // reloading: the user either waits for that session to go idle or takes the
  // cart over deliberately via takeOverCart(). Carries the holder's user agent
  // so the UI can name the other session; null means the cart is not blocked.
  private cartLockedSubject = new BehaviorSubject<CartLockInfo | null>(null);
  cartLocked$ = this.cartLockedSubject.asObservable();

  // Set when watchCartState() noticed another session had changed the cart and
  // pulled the new one in. Nothing was lost — this only explains why the list on
  // screen changed by itself. Cleared by dismissCartRefreshed().
  private cartRefreshedSubject = new BehaviorSubject<boolean>(false);
  cartRefreshed$ = this.cartRefreshedSubject.asObservable();

  // Guard against concurrent cart save requests to prevent database deadlocks
  private saveInProgress = false;
  private pendingSaveRequest: { addressUid?: string; comment?: string } | null = null;

  // Single-line cart writes are serialised through this queue: one request in
  // flight, later changes to the same product folded into one pending change.
  // See changeCartItem() for why, and foldCartItemChange() for the fold rules.
  private cartItemInFlight = false;
  private pendingCartItemChanges = new Map<string, PendingCartItemChange>();
  private cartItemSettleTimer: ReturnType<typeof setTimeout> | null = null;

  private destroyRef = inject(DestroyRef);

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private productService: ProductService,
    // PriceCalculationService removed - backend calculates all values
    private storeService: StoreService,
    private appSettingsService: AppSettingsService
  ) {
    // Load draft cart when user is available (on service init or after login)
    // Subscribe to auth changes and react accordingly
    // Use takeUntilDestroyed to automatically clean up when service is destroyed
    this.authService.currentEntity$
      .pipe(
        // switchMap cancels any in-flight draft-cart load when the identity
        // changes. Without it, if user A logs out and B logs in while A's
        // validateCart() is still pending, A's late response would overwrite
        // B's cart (cross-session leak).
        switchMap(entity => {
          if (!entity || this.cartActionsDisabled()) {
            // Logged out, or a staff account with no cart: clear local state.
            this.applyLoadedDrafts(null);
            this.removedCartItemsSubject.next([]);
            this.cartConflictSubject.next(false);
            this.cartLockedSubject.next(null);
            this.cartRefreshedSubject.next(false);
            return EMPTY;
          }
          // Re-validate the stored draft against current catalog/client state
          // (prices, price type, address, dead products). Falls back to
          // loading the draft as-is when validation is unavailable.
          return this.validateCart().pipe(
            catchError(err => {
              console.error('Cart validation failed, loading draft as-is:', err);
              return this.getDraftOrders().pipe(
                tap(drafts => this.applyLoadedDrafts(drafts)),
                catchError(() => EMPTY)
              );
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  /**
   * Apply a loaded set of draft orders to the current cart state. Selecting the
   * most recently updated draft, or clearing when there is none.
   */
  private applyLoadedDrafts(drafts: Order[] | null): void {
    // getDraftOrders() is backed by the order-history endpoint, which returns
    // confirmed orders too. Filtering here is what keeps a just-confirmed order —
    // typically the most recently updated one, so the first this method would
    // pick — from becoming draftOrderUid and being overwritten by the next cart
    // save. Do not rely on status: once an order enters the CRM pipeline, status
    // holds the stage name, not a lifecycle value.
    const openCarts = (drafts ?? []).filter(order => order.draft === true);
    if (openCarts.length > 0) {
      const latest = [...openCarts].sort((a, b) => (new Date(b.updatedAt).getTime()) - (new Date(a.updatedAt).getTime()))[0];
      this.draftOrderUid = latest.id;
      // The order-history payload carries no cart version, so this path leaves the
      // token unset rather than inventing one: a wrong token would be refused on
      // every save, while no token means the server skips the check.
      this.draftCartVersion = undefined;
      this.currentDraftOrderSubject.next(latest);
      this.currentOrderSubject.next(latest.items || []);
    } else {
      this.draftOrderUid = undefined;
      this.draftCartVersion = undefined;
      this.currentDraftOrderSubject.next(null);
      this.currentOrderSubject.next([]);
    }
  }

  /**
   * Fetch order history for current user
   * Uses frontend/orders/history endpoint - client context from auth token
   * Note: This endpoint only works for client accounts, not user accounts
   */
  getOrderHistory(offset: number = 0, limit: number = 20): Observable<Order[]> {
    const params = new HttpParams()
      .set('offset', offset.toString())
      .set('limit', limit.toString());

    return this.http.get<ApiResponse<any[]>>(
      `${this.apiUrl}/frontend/orders/history`,
      { params }
    ).pipe(
      map(response => {
        if (!response.success || !response.data || !Array.isArray(response.data)) {
          return [];
        }

        // Frontend endpoint returns complete orders with items already included
        return response.data.map((orderData: any) => this.mapOrderResponse(orderData));
      }),
      catchError(error => {
        // Handle errors gracefully
        if (error.status === 401 || error.status === 400) {
          console.warn('Unable to fetch order history. Users need StoreUID and PriceTypeUID assigned.');
          return of([]);
        }
        console.error('Error fetching order history:', error);
        return of([]);
      })
    );
  }

  /**
   * Fetch specific order by ID.
   * Resolves from the client-scoped history endpoint (returns complete orders
   * with items). Clients have no access to the staff /order* batch routes.
   */
  getOrderById(orderUid: string): Observable<Order | undefined> {
    return this.getOrderHistory(0, 200).pipe(
      map(orders => orders.find(o => o.id === orderUid)),
      catchError(error => {
        console.error('Error fetching order:', error);
        return of(undefined);
      })
    );
  }

  /**
   * Whether cart/order actions are allowed for the logged-in entity.
   * Staff users browse the catalog in read-only preview mode — every cart
   * method below no-ops for them instead of calling endpoints the backend
   * would reject (no more 4xx/5xx noise from stale pages).
   */
  private cartActionsDisabled(): boolean {
    return !this.appSettingsService.isCartEnabled();
  }

  /**
   * Preview order before confirmation
   * Uses frontend/orders/preview endpoint - calculates totals without creating order
   */
  previewOrder(items: { productId: string; quantity: number }[]): Observable<Order> {
    if (this.cartActionsDisabled()) {
      console.info('Order preview skipped: cart is disabled for this account');
      return throwError(() => new Error('Cart is disabled for this account'));
    }

    const payload = {
      items: items.map(i => ({
        product_uid: i.productId,
        quantity: i.quantity
      }))
    };

    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/frontend/orders/preview`, payload).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to preview order');
        }

        return this.mapOrderResponse(response.data);
      }),
      catchError(error => {
        console.error('Error previewing order:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Create new order with status 'new' (confirmed order)
   * Uses frontend/orders/confirm endpoint with minimal payload
   * Validates stock and creates allocations
   * If a draft order exists, it will be confirmed instead of creating a new order
   */
  createOrder(request: CreateOrderRequest, status: 'draft' | 'new' = 'new', orderUid?: string): Observable<Order> {
    if (this.cartActionsDisabled()) {
      console.info('Order creation skipped: cart is disabled for this account');
      return throwError(() => new Error('Ordering is disabled for this account'));
    }

    // For draft orders, use saveDraftCart instead
    if (status === 'draft') {
      return this.saveDraftCart(undefined, request.comment);
    }

    // Check if there's an existing draft order to confirm
    const draftUidToConfirm = orderUid || this.draftOrderUid;

    if (draftUidToConfirm) {
      // Update the draft with latest items and comment first, then confirm it
      return this.saveDraftCart(undefined, request.comment).pipe(
        switchMap((updatedDraft) => {
          // Now confirm the updated draft
          return this.confirmDraftOrder(updatedDraft.id);
        })
        // No fallback - if draft confirmation fails, propagate error to caller
        // This prevents duplicate orders from being created
      );
    }

    // No draft exists, create a new order
    return this.createNewOrder(request);
  }

  /**
   * Create a new order (internal helper method)
   */
  private createNewOrder(request: CreateOrderRequest): Observable<Order> {
    const payload = {
      items: request.items.map(i => ({
        product_uid: i.productId,
        quantity: i.quantity
      })),
      comment: request.comment || undefined,
      shipping_address: request.shippingAddress ? {
        street: request.shippingAddress.street,
        city: request.shippingAddress.city,
        state: request.shippingAddress.state,
        zipCode: request.shippingAddress.zipCode,
        country: request.shippingAddress.country
      } : undefined
    };

    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/frontend/orders/confirm`, payload).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to create order');
        }

        const order = this.mapOrderResponse(response.data);
        
        // Clear draft UID since order is now confirmed
        this.clearDraftUid();
        
        return order;
      }),
      catchError(error => {
        // Pass through the raw HttpErrorResponse so callers can read
        // structured server-side details (error.error.error.extra.problems).
        console.error('Error creating order:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Map order response from frontend API to Order model
   */
  private mapOrderResponse(data: any): Order {
    return {
      id: data.uid || '',
      orderNumber: data.number || data.uid || '',
      number: data.number,
      userId: this.getCurrentUserId(),
      items: (data.items || []).map((item: any) => ({
        productId: item.product_uid,
        sku: item.product_sku || '',
        barcode: item.barcode || '',
        productName: item.product_name || '',
        quantity: item.quantity,
        price: item.base_price / 100, // Convert from cents
        priceWithVat: item.price_with_vat ? item.price_with_vat / 100 : undefined, // Base price with VAT (for strikethrough)
        priceDiscount: item.price_discount ? item.price_discount / 100 : undefined,
        priceAfterDiscountWithVat: item.price_after_discount_with_vat ? item.price_after_discount_with_vat / 100 : undefined, // Price after discount with VAT
        tax: item.tax ? item.tax / 100 : undefined,
        subtotal: item.subtotal / 100,
        discount: item.discount ?? data.discount_percent, // Use item-level discount if available, fallback to order-level
        lineNumber: item.line_number // 1-based line position assigned at confirm (0 = draft/unset)
      })),
      totalAmount: data.total / 100,
      discountPercent: data.discount_percent,
      vatRate: data.vat_rate,
      subtotal: data.subtotal ? data.subtotal / 100 : undefined,
      totalVat: data.total_vat ? data.total_vat / 100 : undefined,
      originalTotal: data.original_total ? data.original_total / 100 : undefined,
      originalTotalWithVat: data.original_total_with_vat ? data.original_total_with_vat / 100 : undefined,
      discountAmount: data.discount_amount ? data.discount_amount / 100 : undefined,
      discountAmountWithVat: data.discount_amount_with_vat ? data.discount_amount_with_vat / 100 : undefined,
      deliveryCost: data.delivery_cost ? data.delivery_cost / 100 : undefined,
      // Individual address fields. The order detail page reads these directly
      // (not the CartAddress below, which is only built when the backend also
      // sent the pre-joined shipping_address) — without them a client sees
      // "no address provided" on an order that has one.
      countryCode: data.country_code || undefined,
      zipcode: data.zipcode || undefined,
      city: data.city || undefined,
      addressText: data.address_text || undefined,
      // Branch snapshot — which legal entity this order was invoiced to.
      branchUid: data.branch_uid || undefined,
      branchName: data.branch_name || undefined,
      branchVatNumber: data.branch_vat_number || undefined,
      branchBusinessRegistrationNumber: data.branch_business_registration_number || undefined,
      clientPhase: (data.client_phase ?? '') as ClientPhase,
      draft: data.draft ?? false,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(),
      updatedAt: data.updated_at || data.last_update ? new Date(data.updated_at || data.last_update) : new Date(),
      shippingAddress: data.shipping_address ? this.parseShippingAddress(data.shipping_address) : undefined,
      // Map address fields to CartAddress object for cart-page display
      address: data.shipping_address ? {
        uid: '', // Not available from order history
        country_code: data.country_code || '',
        country_name: '', // Not available from order history
        zipcode: data.zipcode || '',
        city: data.city || '',
        address_text: data.address_text || '',
        shipping_address: data.shipping_address || '',
        is_default: false
      } : undefined,
      comment: data.comment
    };
  }

  /**
   * Parse shipping address string to object
   */
  private parseShippingAddress(addressStr: string): ShippingAddress {
    const parts = addressStr.split(',').map(p => p.trim());
    return {
      street: parts[0] || '',
      city: parts[1] || '',
      state: parts[2]?.split(' ')[0] || '',
      zipCode: parts[2]?.split(' ')[1] || '',
      country: parts[3] || ''
    };
  }

  /**
   * Create draft order (saved cart)
   * No stock validation, no allocations
   */
  createDraftOrder(request: CreateOrderRequest): Observable<Order> {
    return this.createOrder(request, 'draft');
  }

  /**
   * Save current cart as draft on server. If a draft already exists it will be updated.
   * Uses frontend/cart/update endpoint with minimal payload (only product_uid and quantity).
   * Returns Observable<Order> of the saved draft with all calculated values.
   *
   * This method prevents concurrent requests to avoid database deadlocks.
   * If a save is in progress, subsequent calls will wait and use the latest cart state.
   *
   * @param addressUid Optional address UID to use for the order
   * @param comment Optional comment for the order
   */
  saveDraftCart(addressUid?: string, comment?: string): Observable<Order> {
    if (this.cartActionsDisabled()) {
      console.info('Cart save skipped: cart is disabled for this account');
      return throwError(() => new Error('Cart is disabled for this account'));
    }

    // Prevent concurrent save requests to avoid database deadlocks
    if (this.saveInProgress) {
      // Store the latest request params - will be used after current save completes
      this.pendingSaveRequest = { addressUid, comment };
      // Return the current draft order as-is (optimistic response)
      const currentDraft = this.currentDraftOrderSubject.value;
      if (currentDraft) {
        return of(currentDraft);
      }
      return throwError(() => new Error('Save in progress, please wait'));
    }

    const cartItems = this.getCartItems();

    // Validate cart items before creating request
    if (cartItems.length === 0) {
      return throwError(() => new Error('Cannot save empty cart'));
    }

    const invalidItems = cartItems.filter(item =>
      !item.productId ||
      !item.quantity ||
      item.quantity <= 0
    );

    if (invalidItems.length > 0) {
      return throwError(() => new Error('Cart contains invalid items'));
    }

    // Use frontend endpoint - send only product_uid and quantity
    // Include draft UID if exists to update existing draft
    // Include address_uid if provided
    const payload: any = {
      order_uid: this.draftOrderUid || undefined,
      items: cartItems.map(i => ({
        product_uid: i.productId,
        quantity: i.quantity
      })),
      comment: comment || undefined,
      // Omitted when no token is held, which the backend reads as "skip the check".
      version: this.draftCartVersion
    };

    // Add address_uid if provided
    if (addressUid) {
      payload.address_uid = addressUid;
    }

    // Mark save as in progress
    this.saveInProgress = true;

    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/frontend/cart/update`, payload).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to save cart');
        }
        return this.applyCartResponse(response.data, comment);
      }),
      catchError(error => {
        if (this.isCartLocked(error)) {
          // Another session is actively editing. The local cart is left exactly as
          // the user has it — nothing was written, so there is nothing to reload,
          // and discarding their edits here would be gratuitous. They either wait
          // or press "take over".
          const extra = error?.error?.error?.extra || {};
          this.cartLockedSubject.next({
            holderUserAgent: extra.holder_user_agent || '',
            expiresAt: extra.expires_at ? new Date(extra.expires_at) : undefined
          });
          return throwError(() => error);
        }

        if (this.isCartConflict(error)) {
          // Another session of this client changed the cart first. Adopt the
          // server's cart rather than retrying: a retry would send our stale item
          // list back and undo whatever the other session did — the exact
          // behaviour the version check exists to prevent.
          console.info('Cart save refused as stale, reloading the server cart');
          return this.validateCart().pipe(
            // Raised only once the server cart is actually in place, so the notice
            // never points at a cart the user is not yet looking at.
            tap(() => this.cartConflictSubject.next(true)),
            switchMap(order => order
              ? of(order)
              : throwError(() => error))
          );
        }
        console.error('Error saving cart:', error);
        return throwError(() => error);
      }),
      finalize(() => {
        // Clear in-progress flag
        this.saveInProgress = false;

        // A conflict already resolved by reloading the server cart: re-running the
        // queued save would re-send the local items we just discarded.
        if (this.cartConflictSubject.value) {
          this.pendingSaveRequest = null;
        }

        // If there's a pending request, execute it with the latest cart state
        if (this.pendingSaveRequest) {
          const pending = this.pendingSaveRequest;
          this.pendingSaveRequest = null;
          // Use setTimeout to avoid recursive call in same tick
          setTimeout(() => {
            this.saveDraftCart(pending.addressUid, pending.comment).subscribe({
              error: (err) => console.error('Error processing pending cart save:', err)
            });
          }, 100);
        }
      })
    );
  }

  /**
   * Watch for the cart being changed by another session of this account, and pull
   * the new cart in when it happens.
   *
   * Without this a cart page sits on a stale list until the user touches
   * something, then discovers the surprise at the worst moment. Polling the small
   * state probe is deliberate over a pushed stream: it needs no long-lived
   * connection through the proxies, and a dropped request means "notices a moment
   * later" rather than "silently stops noticing".
   *
   * Only the version is compared, so an unchanged cart costs one small request per
   * interval. When it has moved, the full cart is fetched once and
   * cartRefreshed$ fires so the UI can say why the list changed.
   *
   * Returns a subscription the caller must tear down — the component owns the
   * polling lifetime, so it stops when the cart leaves the screen.
   *
   * @param intervalMs How often to probe. Keep it lazy; this is a courtesy, not a
   *   correctness mechanism — the version check on write is what prevents loss.
   */
  watchCartState(intervalMs: number = 15000): Subscription {
    return interval(intervalMs).pipe(
      // A cart that is already being saved will publish its own new version;
      // probing mid-save would only race it.
      filter(() => !this.saveInProgress && !this.cartActionsDisabled()),
      switchMap(() => this.http.get<ApiResponse<any>>(`${this.apiUrl}/frontend/cart/state`).pipe(
        catchError(() => EMPTY)
      )),
      filter(response => !!response?.success),
      map(response => response.data || {}),
      // Nothing to do while we have no token to compare against: the next write
      // will establish one.
      filter(state => this.draftCartVersion !== undefined && typeof state.version === 'number'),
      filter(state => state.version !== this.draftCartVersion),
      switchMap(state => {
        console.info(`Cart changed elsewhere (version ${this.draftCartVersion} -> ${state.version}), reloading`);
        return this.validateCart().pipe(
          tap(() => this.cartRefreshedSubject.next(true)),
          catchError(() => EMPTY)
        );
      })
    ).subscribe();
  }

  /**
   * Clear the "cart was updated from another session" notice.
   */
  dismissCartRefreshed(): void {
    this.cartRefreshedSubject.next(false);
  }

  /**
   * Persist one cart line, merged by the server into whatever the cart currently
   * holds. Use this for single-product actions (add, change one quantity, remove
   * one line) instead of saveDraftCart().
   *
   * The difference matters when the same account is signed in more than once.
   * saveDraftCart() sends the whole item list, which can only mean "the cart is
   * exactly this" — so it overwrites whatever another session added, or is refused
   * as stale. A line change says only what the user did, and the server applies it
   * to the current cart, so two sessions adding different products both keep them.
   * There is no version to send and no conflict to resolve.
   *
   * The local cart is updated from the response, so it also picks up whatever the
   * other session had added.
   *
   * @param productId Product whose line is changing
   * @param mode 'set' fixes the quantity, 'increment' adds to it, 'remove' drops the line
   * @param quantity Read according to mode; ignored for 'remove'
   * @param addressUid Delivery address; omit to use the client's default
   * @param comment Cart comment; omit to keep the stored one
   * @param settle Hold the change briefly before sending, so a quantity typed a
   *   digit at a time is stored once at its final value instead of once per
   *   keystroke. Pass it from per-keystroke bindings only — a click is already a
   *   final value and should not be delayed.
   */
  changeCartItem(
    productId: string,
    mode: 'set' | 'increment' | 'remove',
    quantity: number = 0,
    addressUid?: string,
    comment?: string,
    settle: boolean = false
  ): Observable<Order | null> {
    if (this.cartActionsDisabled()) {
      console.info('Cart change skipped: cart is disabled for this account');
      return throwError(() => new Error('Cart is disabled for this account'));
    }
    if (!productId) {
      return throwError(() => new Error('Cannot change a cart line without a product'));
    }

    // Queued rather than sent, so a burst of clicks cannot race itself: two line
    // writes in flight at once bump the cart version under one another and the
    // second is refused as stale, which the user sees as a lost click. While a
    // write is in flight further changes fold into the queue instead, so the
    // coalescing window is the round-trip itself — no fixed delay to tune, and a
    // fast server still sends every change separately.
    const waiter = new ReplaySubject<Order | null>(1);
    this.foldCartItemChange(productId, { mode, quantity, addressUid, comment, waiters: [waiter] });

    if (settle) {
      // Restarted by each keystroke, so only the quantity the user stopped on is
      // sent. The queue is what makes this safe to fold into: the digits collapse
      // into one 'set' rather than being sent and then corrected.
      if (this.cartItemSettleTimer) {
        clearTimeout(this.cartItemSettleTimer);
      }
      this.cartItemSettleTimer = setTimeout(() => {
        this.cartItemSettleTimer = null;
        this.pumpCartItemQueue();
      }, CART_ITEM_SETTLE_MS);
    } else {
      // A deliberate action (button, add-to-cart) also flushes whatever was still
      // settling: waiting on a keystroke timer would make the click feel dropped.
      if (this.cartItemSettleTimer) {
        clearTimeout(this.cartItemSettleTimer);
        this.cartItemSettleTimer = null;
      }
      this.pumpCartItemQueue();
    }

    return waiter.asObservable();
  }

  /**
   * Merge one line change into the queued change for the same product.
   *
   * Folding has to respect what each mode means, or coalescing silently loses
   * quantity: 'set' and 'remove' are absolute and supersede anything queued,
   * while two 'increment's are the same as one increment of their sum. An
   * increment landing on a queued absolute is folded into that absolute, which
   * is also what the server would have computed had both been sent.
   */
  private foldCartItemChange(productId: string, next: PendingCartItemChange): void {
    const queued = this.pendingCartItemChanges.get(productId);
    if (!queued) {
      this.pendingCartItemChanges.set(productId, next);
      return;
    }

    // Everyone who asked for a change on this line is answered by the one request
    // that finally carries it.
    next.waiters = [...queued.waiters, ...next.waiters];

    if (next.mode === 'increment') {
      if (queued.mode === 'increment') {
        next.quantity = queued.quantity + next.quantity;
      } else if (queued.mode === 'set') {
        next.mode = 'set';
        next.quantity = queued.quantity + next.quantity;
      } else {
        // Removed, then incremented: the line ends up holding just the increment.
        next.mode = 'set';
      }
    }

    // Address and comment are properties of the cart, not of the line: the most
    // recent value the user had on screen is the right one to send.
    next.addressUid = next.addressUid ?? queued.addressUid;
    next.comment = next.comment ?? queued.comment;

    this.pendingCartItemChanges.set(productId, next);
  }

  /**
   * Send the oldest queued line change, if nothing is in flight. Called again as
   * each request settles, so the queue drains one request at a time.
   */
  private pumpCartItemQueue(): void {
    if (this.cartItemInFlight) {
      return;
    }

    const next = this.pendingCartItemChanges.entries().next();
    if (next.done) {
      return;
    }

    const [productId, change] = next.value;
    this.pendingCartItemChanges.delete(productId);
    this.cartItemInFlight = true;

    // Settled on both paths, and only after the flag is cleared: a request that
    // fails must not leave the queue jammed with nothing in flight to drain it.
    const settle = () => {
      this.cartItemInFlight = false;
      this.pumpCartItemQueue();
    };

    this.sendCartItemChange(productId, change).subscribe({
      next: order => change.waiters.forEach(w => { w.next(order); w.complete(); }),
      error: err => {
        change.waiters.forEach(w => w.error(err));
        settle();
      },
      complete: settle
    });
  }

  /**
   * POST one line change and apply the merged cart the server answers with.
   */
  private sendCartItemChange(
    productId: string,
    change: PendingCartItemChange
  ): Observable<Order | null> {
    const { mode, quantity, addressUid, comment } = change;
    const payload: any = { product_uid: productId, mode, quantity };
    if (addressUid) {
      payload.address_uid = addressUid;
    }
    if (comment !== undefined) {
      payload.comment = comment;
    }

    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/frontend/cart/item`, payload).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to change cart');
        }

        const data = response.data || {};
        if (!data.order_uid) {
          // The last line went: there is no cart left to hold.
          this.applyLoadedDrafts(null);
          this.draftCartVersion = typeof data.version === 'number' ? data.version : undefined;
          return null;
        }
        return this.applyCartResponse(data, comment);
      }),
      catchError(error => {
        if (this.isCartLocked(error)) {
          // Another session holds the cart. Nothing was written, so the local cart
          // is left as the user has it — they wait or take the cart over.
          const extra = error?.error?.error?.extra || {};
          this.cartLockedSubject.next({
            holderUserAgent: extra.holder_user_agent || '',
            expiresAt: extra.expires_at ? new Date(extra.expires_at) : undefined
          });
        } else {
          console.error('Error changing cart line:', error);
        }
        return throwError(() => error);
      })
    );
  }

  /**
   * Map a /frontend/cart/* response payload to the Order model and apply it
   * as the current draft cart state.
   */
  private applyCartResponse(cartData: any, comment?: string): Order {
    // Map address response if present
    let address: CartAddress | undefined;
    if (cartData.address) {
      address = {
        uid: cartData.address.uid || '',
        country_code: cartData.address.country_code || '',
        country_name: cartData.address.country_name || '',
        zipcode: cartData.address.zipcode || '',
        city: cartData.address.city || '',
        address_text: cartData.address.address_text || '',
        shipping_address: cartData.address.shipping_address || '',
        is_default: cartData.address.is_default || false,
        branch_uid: cartData.address.branch_uid || '',
        branch_name: cartData.address.branch_name || '',
        // Absent key means "no branch", which is never an inactive one.
        branch_active: cartData.address.branch_uid ? !!cartData.address.branch_active : true
      };
    }

    // Map response to Order format
    const order: Order = {
      id: cartData.order_uid,
      orderNumber: cartData.order_uid,
      userId: this.getCurrentUserId(),
      items: cartData.items.map((item: any) => ({
        productId: item.product_uid,
        sku: item.product_sku || '',
        productName: item.product_name,
        quantity: item.quantity,
        price: item.base_price / 100, // Convert from cents
        priceWithVat: item.price_with_vat / 100, // Base price with VAT (for strikethrough display)
        priceDiscount: item.price_discount / 100,
        priceAfterDiscountWithVat: item.price_after_discount_with_vat / 100, // Price after discount with VAT
        tax: item.tax / 100,
        subtotal: item.subtotal / 100,
        discount: item.discount, // Actual discount percent (after product discount limits)
        availableQuantity: item.available_quantity,
        active: item.active
      })),
      totalAmount: cartData.totals.total / 100,
      discountPercent: cartData.discount_percent,
      vatRate: cartData.vat_rate,
      vatRateChanged: cartData.vat_rate_changed || false,
      subtotal: cartData.totals.subtotal / 100,
      totalVat: cartData.totals.total_vat / 100,
      originalTotal: cartData.totals.original_total / 100,
      originalTotalWithVat: cartData.totals.original_total_with_vat / 100,
      discountAmount: cartData.totals.discount_amount / 100,
      discountAmountWithVat: cartData.totals.discount_amount_with_vat / 100,
      // A cart has no client phase: it has not been placed yet.
      clientPhase: '',
      draft: true, // Draft orders are always draft=true
      createdAt: new Date(),
      updatedAt: new Date(),
      address: address,
      // Fall back to the server-stored comment so comment-less saves
      // (quantity/address updates) no longer blank the comment box.
      comment: comment ?? cartData.comment
    };

    // Remember draft UID and concurrency token for future updates
    this.draftOrderUid = order.id;
    this.draftCartVersion = typeof cartData.version === 'number' ? cartData.version : undefined;

    // Store complete draft order with backend-calculated totals
    this.currentDraftOrderSubject.next(order);

    // Sync local cart items with server response
    this.currentOrderSubject.next(order.items || []);
    return order;
  }

  /**
   * Re-validate the stored draft cart on the server. The backend removes
   * products that no longer pass validation (deleted, inactive, no price for
   * the client's current price type), re-resolves the delivery address and
   * recalculates prices/discount/VAT. Removed items are published via
   * removedCartItems$ so the cart page can show a notice.
   * Returns the refreshed draft, or null when no draft remains.
   */
  validateCart(): Observable<Order | null> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/frontend/cart/validate`, {}).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to validate cart');
        }

        const data = response.data || {};
        const removed: RemovedCartItem[] = (data.removed_items || []).map((item: any) => ({
          productId: item.product_uid || '',
          sku: item.product_sku || '',
          productName: item.product_name || item.product_sku || item.product_uid || '',
          reason: item.reason,
          quantity: item.quantity
        }));
        // Always emit — a clean validation must clear any earlier notice
        // (BehaviorSubject replays the last value to late subscribers).
        this.removedCartItemsSubject.next(removed);

        if (!data.cart) {
          // No draft, or every item was removed and the draft was deleted.
          this.applyLoadedDrafts(null);
          return null;
        }
        return this.applyCartResponse(data.cart);
      })
    );
  }

  /**
   * Clear the removed-items notice published by validateCart().
   */
  dismissRemovedCartItems(): void {
    this.removedCartItemsSubject.next([]);
  }

  /**
   * True when the server rejected a cart save because the cart had already been
   * changed by another session of the same client (HTTP 409 CART_CONFLICT).
   * Anything else — including a plain 409 from an unrelated endpoint — is a real
   * error and must keep propagating.
   */
  private isCartConflict(error: any): boolean {
    return error?.status === 409 &&
      error?.error?.error?.extra?.reason === 'cart_version_conflict';
  }

  /**
   * Clear the conflict notice raised when a save was refused as stale.
   */
  dismissCartConflict(): void {
    this.cartConflictSubject.next(false);
  }

  /**
   * True when the server refused the save because another session of this client
   * currently holds the cart (HTTP 423 CART_LOCKED).
   */
  private isCartLocked(error: any): boolean {
    return error?.status === 423 &&
      error?.error?.error?.extra?.reason === 'cart_locked';
  }

  /**
   * Claim the cart editing lease from whichever session currently holds it, then
   * reload the server cart and save the local one.
   *
   * Called when the user answers the "open in another session" notice with "take
   * over". The reload is not optional: the other session may have written before
   * losing the lease, and saving straight over that with our version would be
   * refused anyway.
   */
  takeOverCart(): Observable<Order | null> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/frontend/cart/takeover`, {}).pipe(
      switchMap(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to take over cart');
        }
        this.cartLockedSubject.next(null);
        // Adopt the server's cart: this session now owns the lease, so what the
        // holder left behind is the cart to continue from.
        return this.validateCart();
      }),
      catchError(error => {
        console.error('Error taking over cart:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Clear the "cart open in another session" notice.
   */
  dismissCartLocked(): void {
    this.cartLockedSubject.next(null);
  }

  /**
   * Load user's latest draft from server (if any) and set it as current cart.
   * Note: Does not recalculate immediately - draft already has backend-calculated values.
   * Recalculation happens when user modifies cart or explicitly requests it.
   */
  loadDraftCart(): void {
    // Staff accounts have no cart — keep local state empty, skip the request
    if (this.cartActionsDisabled()) {
      this.applyLoadedDrafts(null);
      return;
    }

    this.getDraftOrders().subscribe({
      next: drafts => this.applyLoadedDrafts(drafts),
      error: err => {
        console.error('Failed to load draft cart:', err);
      }
    });
  }

  /**
   * Convert draft order to new order (confirm order)
   * Validates stock and creates allocations
   */
  confirmDraftOrder(orderUid: string): Observable<Order> {
    // Promote the caller's own draft in place via the client endpoint. The
    // draft already holds the latest items/address/comment (saveDraftCart runs
    // first), so only the order_uid is needed; the backend re-prices, allocates
    // stock and returns the confirmed order.
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/frontend/orders/confirm`, { order_uid: orderUid }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to confirm order');
        }

        const order = this.mapOrderResponse(response.data);
        this.clearDraftUid();
        return order;
      }),
      catchError(error => {
        // Pass through the raw HttpErrorResponse so callers can read
        // structured server-side details (error.error.error.extra.problems).
        console.error('Error confirming draft order:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get draft orders for current user
   */
  getDraftOrders(): Observable<Order[]> {
    return this.getOrderHistory().pipe(
      map(orders => orders.filter(order => order.draft === true))
    );
  }

  /**
   * Update order status
   */
  updateOrderStatus(orderUid: string, newStatus: 'new' | 'processing' | 'confirmed'): Observable<void> {
    const payload = {
      data: [ { uid: orderUid, status: newStatus } ]
    };

    // Admin endpoint
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/admin/order/status`, payload).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to update order status');
        }
      }),
      catchError(error => {
        console.error('Error updating order status:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get current draft order UID (if any)
   */
  getCurrentDraftUid(): string | undefined {
    return this.draftOrderUid;
  }

  /**
   * Get current draft order value (synchronous access)
   * Returns backend-calculated order with all totals
   */
  get currentDraftOrderValue(): Order | null {
    return this.currentDraftOrderSubject.value;
  }

  /**
   * Clear draft order UID (call after confirming draft).
   * Drops the cart concurrency token with it: a token issued for a cart we no
   * longer track would be refused by the server on the next save.
   */
  clearDraftUid(): void {
    this.draftOrderUid = undefined;
    this.draftCartVersion = undefined;
  }

  // Cart management
  /**
   * Add item to cart (local state only)
   * Updates local state immediately for responsive UI
   * Does NOT save to backend - caller should call saveDraftCart() when ready
   * This allows bulk operations without multiple backend calls
   */
  addToCart(item: OrderItem): void {
    const currentItems = this.currentOrderSubject.value;
    const existingItem = currentItems.find(i => i.productId === item.productId);

    if (existingItem) {
      existingItem.quantity += item.quantity;
      // DO NOT calculate subtotal - backend calculates all monetary values
      // Keep existing subtotal from backend if available, otherwise 0
      // Backend will recalculate when cart is saved
      if (!existingItem.subtotal) {
        existingItem.subtotal = 0;
      }
    } else {
      // Add new item with minimal info (backend will calculate when saved)
      currentItems.push({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        // DO NOT calculate subtotal - backend calculates all monetary values
        // Use 0 as placeholder, backend will recalculate with discount/VAT
        subtotal: item.subtotal || 0, // Use provided subtotal if available (from backend), otherwise 0
        sortOrder: item.sortOrder
      });
    }

    // Update local state immediately for responsive UI
    this.currentOrderSubject.next([...currentItems]);
  }

  /**
   * Remove item from cart (local state only)
   * Caller must call saveDraftCart() after to persist the change to backend
   * This ensures cart state is always sent as a complete list to backend
   */
  removeFromCart(productId: string): void {
    const currentItems = this.currentOrderSubject.value;
    const itemToRemove = currentItems.find(i => i.productId === productId);

    if (!itemToRemove) {
      console.warn(`[OrderService] Attempted to remove item with productId ${productId} but it was not found in local cart.`);
      return;
    }

    // Update local state - caller must call saveDraftCart() to persist
    this.currentOrderSubject.next(currentItems.filter(i => i.productId !== productId));
  }

  /**
   * Update cart item quantity
   * Updates local state immediately for responsive UI
   * Note: Caller should call saveDraftCart() after this to persist and get backend calculations
   */
  updateCartItemQuantity(productId: string, quantity: number): void {
    const currentItems = this.currentOrderSubject.value;
    const item = currentItems.find(i => i.productId === productId);

    if (item) {
      item.quantity = quantity;
      // Keep old subtotal - backend will recalculate and update
      // This ensures we always show backend values, never frontend calculations
      this.currentOrderSubject.next([...currentItems]);
    }
  }

  clearCart(): void {
    this.currentOrderSubject.next([]);
    // Clear draft order and UID when cart is cleared
    this.currentDraftOrderSubject.next(null);
    this.clearDraftUid();
  }

  /**
   * Delete the draft order (cart) from the server
   * Called when all items are removed from the cart
   * @param orderUid The UID of the draft order to delete
   */
  deleteDraftCart(orderUid?: string): Observable<void> {
    if (this.cartActionsDisabled()) {
      this.currentOrderSubject.next([]);
      this.currentDraftOrderSubject.next(null);
      this.clearDraftUid();
      return of(undefined);
    }

    const uidToDelete = orderUid || this.draftOrderUid;

    if (!uidToDelete) {
      // No draft to delete, just clear local state
      this.currentOrderSubject.next([]);
      this.currentDraftOrderSubject.next(null);
      return of(undefined);
    }

    const payload = {
      order_uid: uidToDelete
    };

    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/frontend/cart/delete`, payload).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to delete cart');
        }

        // Clear local state after successful deletion
        this.currentOrderSubject.next([]);
        this.currentDraftOrderSubject.next(null);
        this.clearDraftUid();
      }),
      catchError(error => {
        console.error('Error deleting cart:', error);
        // Still clear local state even if server deletion fails
        this.currentOrderSubject.next([]);
        this.currentDraftOrderSubject.next(null);
        this.clearDraftUid();
        return of(undefined);
      })
    );
  }

  /**
   * Replace entire cart with new items (used for bulk updates)
   */
  setCart(items: OrderItem[]): void {
    this.currentOrderSubject.next([...items]);
  }

  getCartTotal(): number {
    return this.currentOrderSubject.value.reduce((sum, item) => sum + item.subtotal, 0);
  }

  getCartItems(): OrderItem[] {
    return this.currentOrderSubject.value;
  }

  /**
   * Get current user ID from auth service
   */
  private getCurrentUserId(): string {
    const currentEntity = this.authService.currentEntityValue;
    if (!currentEntity) {
      throw new Error('No authenticated user');
    }

    // Check if it's a User or Client and get the appropriate UID
    if ('uid' in currentEntity) {
      return currentEntity.uid;
    }

    throw new Error('Invalid user entity');
  }

  /**
   * Get current client discount percentage
   */
  private getCurrentClientDiscount(): number {
    const entity = this.authService.currentEntityValue;
    const entityType = this.authService.entityTypeValue;

    if (entityType === 'client' && entity) {
      return (entity as Client).discount || 0;
    }
    return 0;
  }

  /**
   * Get VAT rate for client considering store default
   * Uses AppSettings which already has the effective VAT rate calculated
   * Returns Observable that resolves to the correct VAT rate
   */
  getClientVatRate(): Observable<number> {
    const settings = this.appSettingsService.getSettingsValue();
    if (settings && settings.entity_type === 'client') {
      return of(settings.effective_vat_rate || 0);
    }
    return of(0);
  }

  /**
   * Get current client VAT rate (synchronous version)
   * This uses client.vat_rate directly, which may not reflect store default
   * Use getClientVatRate() for accurate VAT rate calculation
   * @deprecated Use getClientVatRate() instead for proper store default VAT rate handling
   */
  private getCurrentClientVatRate(): number {
    const entity = this.authService.currentEntityValue;
    const entityType = this.authService.entityTypeValue;

    if (entityType === 'client' && entity) {
      return (entity as Client).vat_rate || 0;
    }
    return 0;
  }

  /**
   * Get cart totals with VAT breakdown
   * Returns backend-calculated totals from the current draft order
   * All monetary calculations are done by backend for consistency
   *
   * Includes both NET (without VAT) and GROSS (with VAT) values:
   * - originalTotal/discountAmount: NET values (for traditional B2B display)
   * - originalTotalWithVat/discountAmountWithVat: GROSS values (for consistency with product card)
   */
  getCartTotalsBreakdown(): Observable<{
    originalTotal: number;
    originalTotalWithVat: number;
    discountAmount: number;
    discountAmountWithVat: number;
    subtotal: number;
    vatAmount: number;
    total: number;
    discountPercent: number;
    vatRate: number;
    hasDiscount: boolean;
    hasVat: boolean;
  }> {
    return this.currentDraftOrder$.pipe(
      map(draftOrder => {
        // If no draft order yet, return zeros
        if (!draftOrder) {
          return {
            originalTotal: 0,
            originalTotalWithVat: 0,
            discountAmount: 0,
            discountAmountWithVat: 0,
            subtotal: 0,
            vatAmount: 0,
            total: 0,
            discountPercent: 0,
            vatRate: 0,
            hasDiscount: false,
            hasVat: false
          };
        }

        // Use backend-calculated values directly
        const discountPercent = draftOrder.discountPercent || 0;
        const vatRate = draftOrder.vatRate || 0;
        const subtotal = draftOrder.subtotal || 0;
        const totalVat = draftOrder.totalVat || 0;
        const total = draftOrder.totalAmount || 0;
        const originalTotal = draftOrder.originalTotal || 0;
        const originalTotalWithVat = draftOrder.originalTotalWithVat || 0;
        const discountAmount = draftOrder.discountAmount || 0;
        const discountAmountWithVat = draftOrder.discountAmountWithVat || 0;

        return {
          originalTotal,
          originalTotalWithVat,
          discountAmount,
          discountAmountWithVat,
          subtotal,
          vatAmount: totalVat,
          total,
          discountPercent,
          vatRate,
          hasDiscount: discountPercent > 0,
          hasVat: vatRate > 0
        };
      })
    );
  }

  /**
   * Recalculate all cart items with current client discount/VAT
   * Saves cart to backend as draft, which triggers backend calculations
   * Backend response updates local cart with calculated values
   * Call this when client discount/VAT changes
   */
  recalculateCartWithCurrentDiscount(): void {
    const currentItems = this.currentOrderSubject.value;
    if (currentItems.length === 0) {
      return;
    }

    // Validate that all items have required fields before saving
    const invalidItems = currentItems.filter(item => 
      !item.productId || 
      !item.quantity || 
      item.quantity <= 0 ||
      item.price === undefined || 
      item.price === null ||
      item.subtotal === undefined ||
      item.subtotal === null
    );

    if (invalidItems.length > 0) {
      console.warn('Cannot recalculate cart: some items are missing required fields', invalidItems);
      return;
    }

    // Save cart to backend - backend will recalculate with current client discount/VAT
    // Backend response will update local cart with calculated values
    this.saveDraftCart().subscribe({
      next: () => {
        // Cart updated with backend calculations
      },
      error: err => {
        console.error('Failed to recalculate cart with backend:', err);
        // Log the error details for debugging
        if (err.error) {
          console.error('Error details:', err.error);
          if (err.error.error && err.error.error.message) {
            console.error('Backend error message:', err.error.error.message);
          }
        }
        // Keep current local state if backend fails
      }
    });
  }
}
