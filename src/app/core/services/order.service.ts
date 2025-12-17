import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject, throwError } from 'rxjs';
import { delay, map, catchError, switchMap, finalize, tap } from 'rxjs/operators';
import { Order, OrderItem, CreateOrderRequest, OrderStatus, BackendOrderRequest, BackendOrderResponse, ShippingAddress, CartAddress } from '../models/order.model';
import { OrderMapper } from '../mappers/order.mapper';
import { AuthService } from './auth.service';
import { ProductService } from './product.service';
// PriceCalculationService removed - all calculations done on backend
import { StoreService } from './store.service';
import { AppSettingsService } from './app-settings.service';
import { Client } from '../models/user.model';
import { environment } from '../../../environments/environment';
import { MOCK_ORDERS } from '../mock-data/orders.mock';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
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

  // Store the current draft order with backend-calculated totals
  private currentDraftOrderSubject = new BehaviorSubject<Order | null>(null);
  currentDraftOrder$ = this.currentDraftOrderSubject.asObservable();

  // Guard against concurrent cart save requests to prevent database deadlocks
  private saveInProgress = false;
  private pendingSaveRequest: { addressUid?: string; comment?: string } | null = null;

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
    this.authService.currentEntity$.subscribe(entity => {
      if (entity) {
        this.loadDraftCart();
      } else {
        // On logout/unauthenticated state clear local cart, draft order, and draft pointer
        this.draftOrderUid = undefined;
        this.currentDraftOrderSubject.next(null);
        this.currentOrderSubject.next([]);
      }
    });
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
        return response.data.map((orderData: any) => this.mapOrderResponse(orderData, orderData.status || 'new'));
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
   * Fetch specific order by ID
   */
  getOrderById(orderUid: string): Observable<Order | undefined> {
    // Use batch endpoint for single order retrieval
    const payload = { data: [orderUid] };
    return this.http.post<ApiResponse<BackendOrderResponse[]>>(`${this.apiUrl}/order/batch`, payload).pipe(
      switchMap(response => {
        if (!response.success || !response.data || response.data.length === 0) {
          throw new Error(response.message || 'Order not found');
        }

        const orderData = response.data[0];

        // Fetch items
        return this.getOrderItems(orderUid).pipe(
          switchMap(items => {
            // Extract product UIDs from items
            const productUids = items
              .filter(item => item.product_uid)
              .map(item => item.product_uid);

            if (productUids.length === 0) {
              return of(OrderMapper.fromBackendResponse(orderData, items));
            }

            // Fetch product names
            return this.productService.getBatchProductDescriptions(
              productUids,
              this.productService['translationService'].getCurrentLanguage()
            ).pipe(
              map(productNamesMap => {
                // Enrich items with product names
                const enrichedItems = items.map(item => ({
                  ...item,
                  product_name: productNamesMap.get(item.product_uid)?.name || 'Unknown Product'
                }));

                return OrderMapper.fromBackendResponse(orderData, enrichedItems);
              })
            );
          })
        );
      }),
      catchError(error => {
        console.error('Error fetching order:', error);
        return of(undefined);
      })
    );
  }

  /**
   * Fetch items for a specific order - SINGLE order
   */
  private getOrderItems(orderUid: string): Observable<any[]> {
    const payload = { data: [orderUid] };
    return this.http.post<ApiResponse<any[][]>>(`${this.apiUrl}/order/items/batch`, payload).pipe(
      map(response => {
        if (!response.success || !response.data || response.data.length === 0) {
          return [];
        }
        // Response is an array of arrays; first element corresponds to our single order
        return response.data[0] || [];
      }),
      catchError(() => of([]))
    );
  }

  /**
   * Fetch order items in BATCH - all orders in ONE request
   */
  private getBatchOrderItems(orderUids: string[]): Observable<Map<string, any[]>> {
    if (orderUids.length === 0) {
      return of(new Map());
    }

    const payload = {
      data: orderUids
    };

    return this.http.post<ApiResponse<any[][]>>(
      `${this.apiUrl}/order/items/batch`,
      payload
    ).pipe(
      map(response => {
        if (!response.success || !response.data) {
          return new Map();
        }

        // The API returns array of arrays, one array per order
        // We need to match them with order UIDs
        const itemsMap = new Map<string, any[]>();

        response.data.forEach((items, index) => {
          if (index < orderUids.length) {
            itemsMap.set(orderUids[index], items);
          }
        });

        return itemsMap;
      }),
      catchError(error => {
        console.error('Error fetching batch order items:', error);
        return of(new Map());
      })
    );
  }

  /**
   * Preview order before confirmation
   * Uses frontend/orders/preview endpoint - calculates totals without creating order
   */
  previewOrder(items: { productId: string; quantity: number }[]): Observable<Order> {
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

        return this.mapOrderResponse(response.data, 'preview');
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

        const order = this.mapOrderResponse(response.data, 'new');
        
        // Clear draft UID since order is now confirmed
        this.clearDraftUid();
        
        return order;
      }),
      catchError(error => {
        console.error('Error creating order:', error);

        // Parse specific error types
        if (error.error?.message) {
          const msg = error.error.message.toLowerCase();

          if (msg.includes('insufficient stock')) {
            return throwError(() => new Error('INSUFFICIENT_STOCK: ' + error.error.message));
          }
          if (msg.includes('not active')) {
            return throwError(() => new Error('PRODUCT_INACTIVE: ' + error.error.message));
          }
          if (msg.includes('not found')) {
            return throwError(() => new Error('PRODUCT_NOT_FOUND: ' + error.error.message));
          }
        }

        return throwError(() => error);
      })
    );
  }

  /**
   * Map order response from frontend API to Order model
   */
  private mapOrderResponse(data: any, status: string): Order {
    return {
      id: data.uid || '',
      orderNumber: data.number || data.uid || '',
      number: data.number,
      userId: this.getCurrentUserId(),
      items: (data.items || []).map((item: any) => ({
        productId: item.product_uid,
        productName: item.product_name || '',
        quantity: item.quantity,
        price: item.base_price / 100, // Convert from cents
        priceDiscount: item.price_discount ? item.price_discount / 100 : undefined,
        tax: item.tax ? item.tax / 100 : undefined,
        subtotal: item.subtotal / 100,
        discount: data.discount_percent
      })),
      totalAmount: data.total / 100,
      discountPercent: data.discount_percent,
      vatRate: data.vat_rate,
      subtotal: data.subtotal ? data.subtotal / 100 : undefined,
      totalVat: data.total_vat ? data.total_vat / 100 : undefined,
      originalTotal: data.original_total ? data.original_total / 100 : undefined,
      discountAmount: data.discount_amount ? data.discount_amount / 100 : undefined,
      status: status as OrderStatus,
      createdAt: data.created_at ? new Date(data.created_at) : new Date(),
      updatedAt: data.updated_at ? new Date(data.updated_at) : new Date(),
      shippingAddress: data.shipping_address ? this.parseShippingAddress(data.shipping_address) : undefined,
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
      comment: comment || undefined
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

        const cartData = response.data;

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
            is_default: cartData.address.is_default || false
          };
        }

        // Map response to Order format
        const order: Order = {
          id: cartData.order_uid,
          orderNumber: cartData.order_uid,
          userId: this.getCurrentUserId(),
          items: cartData.items.map((item: any) => ({
            productId: item.product_uid,
            productName: item.product_name,
            quantity: item.quantity,
            price: item.base_price / 100, // Convert from cents
            priceDiscount: item.price_discount / 100,
            tax: item.tax / 100,
            subtotal: item.subtotal / 100,
            discount: cartData.discount_percent
          })),
          totalAmount: cartData.totals.total / 100,
          discountPercent: cartData.discount_percent,
          vatRate: cartData.vat_rate,
          vatRateChanged: cartData.vat_rate_changed || false,
          subtotal: cartData.totals.subtotal / 100,
          totalVat: cartData.totals.total_vat / 100,
          originalTotal: cartData.totals.original_total / 100,
          discountAmount: cartData.totals.discount_amount / 100,
          status: OrderStatus.DRAFT,
          createdAt: new Date(),
          updatedAt: new Date(),
          address: address,
          comment: comment
        };

        // Remember draft UID for future updates
        this.draftOrderUid = order.id;

        // Store complete draft order with backend-calculated totals
        this.currentDraftOrderSubject.next(order);

        // Sync local cart items with server response
        this.currentOrderSubject.next(order.items || []);
        return order;
      }),
      catchError(error => {
        console.error('Error saving cart:', error);
        return throwError(() => error);
      }),
      finalize(() => {
        // Clear in-progress flag
        this.saveInProgress = false;

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
   * Load user's latest draft from server (if any) and set it as current cart.
   */
  loadDraftCart(): void {
    this.getDraftOrders().subscribe({
      next: drafts => {
        if (drafts && drafts.length > 0) {
          // Choose the most recently updated draft
          const latest = drafts.sort((a, b) => (new Date(b.updatedAt).getTime()) - (new Date(a.updatedAt).getTime()))[0];
          this.draftOrderUid = latest.id;
          // Store complete draft order with backend-calculated totals
          this.currentDraftOrderSubject.next(latest);
          this.currentOrderSubject.next(latest.items || []);
          // Recalculate discount and priceDiscount with current client discount
          this.recalculateCartWithCurrentDiscount();
        } else {
          // No drafts - keep empty cart
          this.draftOrderUid = undefined;
          this.currentDraftOrderSubject.next(null);
          this.currentOrderSubject.next([]);
        }
      },
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
    // First, get the existing draft order
    return this.getOrderById(orderUid).pipe(
      switchMap(order => {
        if (!order) {
          return throwError(() => new Error('Order not found'));
        }

        if (order.status !== OrderStatus.DRAFT) {
          return throwError(() => new Error('Only draft orders can be confirmed'));
        }

        const userId = this.getCurrentUserId();

        // Convert to backend format with 'new' status
        // Backend will recalculate ALL monetary values (discount, VAT, subtotal, total)
        const backendRequest: BackendOrderRequest = OrderMapper.toBackendRequest(
          userId,
          order.items,
          order.shippingAddress!,
          undefined,
          order.comment,
          'new', // Change status to 'new'
          orderUid // Use existing UID
        );

        const payload = {
          data: [backendRequest]
        };

        return this.http.post<ApiResponse<string[]>>(`${this.apiUrl}/order`, payload).pipe(
          switchMap(response => {
            if (!response.success) {
              throw new Error(response.message || 'Failed to confirm order');
            }

            // Fetch the updated order
            return this.getOrderById(orderUid);
          }),
          map(updatedOrder => {
            if (!updatedOrder) {
              throw new Error('Failed to fetch confirmed order');
            }
            return updatedOrder;
          })
        );
      }),
      catchError(error => {
        console.error('Error confirming draft order:', error);

        // Parse specific error types
        if (error.error?.message) {
          const msg = error.error.message.toLowerCase();

          if (msg.includes('insufficient stock')) {
            return throwError(() => new Error('INSUFFICIENT_STOCK: ' + error.error.message));
          }
          if (msg.includes('not active')) {
            return throwError(() => new Error('PRODUCT_INACTIVE: ' + error.error.message));
          }
        }

        return throwError(() => error);
      })
    );
  }

  /**
   * Get draft orders for current user
   */
  getDraftOrders(): Observable<Order[]> {
    return this.getOrderHistory().pipe(
      map(orders => orders.filter(order => order.status === OrderStatus.DRAFT))
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
   * Clear draft order UID (call after confirming draft)
   */
  clearDraftUid(): void {
    this.draftOrderUid = undefined;
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
    this.draftOrderUid = undefined;
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
      // Use effective VAT rate from AppSettings (already calculated by backend)
      return new Observable(observer => {
        observer.next(settings.effective_vat_rate || 0);
        observer.complete();
      });
    }

    return new Observable(observer => {
      observer.next(0);
      observer.complete();
    });
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
   */
  getCartTotalsBreakdown(): Observable<{
    originalTotal: number;
    discountAmount: number;
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
            discountAmount: 0,
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
        const discountAmount = draftOrder.discountAmount || 0;

        return {
          originalTotal,
          discountAmount,
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
