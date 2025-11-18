import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject, throwError } from 'rxjs';
import { delay, map, catchError, switchMap } from 'rxjs/operators';
import { Order, OrderItem, CreateOrderRequest, OrderStatus, BackendOrderRequest, BackendOrderResponse, ShippingAddress } from '../models/order.model';
import { OrderMapper } from '../mappers/order.mapper';
import { AuthService } from './auth.service';
import { ProductService } from './product.service';
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

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private productService: ProductService
  ) {
    // Load draft cart when user is available (on service init or after login)
    // Subscribe to auth changes and react accordingly
    this.authService.currentEntity$.subscribe(entity => {
      if (entity) {
        this.loadDraftCart();
      } else {
        // On logout/unauthenticated state clear local cart and draft pointer
        this.draftOrderUid = undefined;
        this.currentOrderSubject.next([]);
      }
    });
  }

  /**
   * Fetch order history for current user
   */
  getOrderHistory(offset: number = 0, limit: number = 20): Observable<Order[]> {
    const currentEntity = this.authService.currentEntityValue;
    if (!currentEntity) {
      console.error('No authenticated user');
      return of(MOCK_ORDERS).pipe(delay(500));
    }

    const userUid = this.getCurrentUserId();
    const params = new HttpParams()
      .set('offset', offset.toString())
      .set('limit', limit.toString());

    return this.http.get<ApiResponse<BackendOrderResponse[]>>(
      `${this.apiUrl}/order/user/${userUid}`,
      { params }
    ).pipe(
      switchMap(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch orders');
        }

        const ordersData = response.data;

        if (ordersData.length === 0) {
          return of([]);
        }

        // Extract all order UIDs
        const orderUids = ordersData.map(o => o.uid);

        // Fetch all order items in ONE batch request
        return this.getBatchOrderItems(orderUids).pipe(
          switchMap(itemsMap => {
            // Extract all unique product UIDs from all order items
            const productUids = new Set<string>();
            itemsMap.forEach(items => {
              items.forEach(item => {
                if (item.product_uid) {
                  productUids.add(item.product_uid);
                }
              });
            });

            // If no products, return orders without names
            if (productUids.size === 0) {
              return of(ordersData.map(orderData => {
                const items = itemsMap.get(orderData.uid) || [];
                return OrderMapper.fromBackendResponse(orderData, items);
              }));
            }

            // Fetch product names in ONE batch request
            return this.productService.getBatchProductDescriptions(
              Array.from(productUids),
              this.productService['translationService'].getCurrentLanguage()
            ).pipe(
              map(productNamesMap => {
                // Enrich items with product names
                return ordersData.map(orderData => {
                  const items = itemsMap.get(orderData.uid) || [];

                  // Add product names to items
                  const enrichedItems = items.map(item => ({
                    ...item,
                    product_name: productNamesMap.get(item.product_uid)?.name || 'Unknown Product'
                  }));

                  return OrderMapper.fromBackendResponse(orderData, enrichedItems);
                });
              })
            );
          })
        );
      }),
      catchError(error => {
        console.error('Error fetching orders, using mock data:', error);
        return of(MOCK_ORDERS).pipe(delay(500));
      })
    );
  }

  /**
   * Fetch specific order by ID
   */
  getOrderById(orderUid: string): Observable<Order | undefined> {
    return this.http.get<ApiResponse<BackendOrderResponse>>(`${this.apiUrl}/order/${orderUid}`).pipe(
      switchMap(response => {
        if (!response.success) {
          throw new Error(response.message || 'Order not found');
        }

        const orderData = response.data;

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
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/order/${orderUid}/items`).pipe(
      map(response => {
        if (!response.success) {
          return [];
        }
        return response.data;
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
      order_uids: orderUids
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
   * Create new order with specified status ('new' or 'draft')
   * Use 'new' for confirmed orders (validates stock, creates allocations)
   * Use 'draft' for saved carts (no validation, no allocations)
   */
  createOrder(request: CreateOrderRequest, status: 'draft' | 'new' = 'new', orderUid?: string): Observable<Order> {
    const userId = this.getCurrentUserId();

    // Get current cart items with full details
    const cartItems = this.getCartItems();

    // Convert to backend format
    const backendRequest: BackendOrderRequest = OrderMapper.toBackendRequest(
      userId,
      cartItems,
      request.shippingAddress,
      undefined, // billingAddress
      request.comment,
      status // Pass status to mapper
      , orderUid // allow passing existing UID to update
    );

    // Wrap in data array as per API spec
    const payload = {
      data: [backendRequest]
    };

    return this.http.post<ApiResponse<string[]>>(`${this.apiUrl}/order`, payload).pipe(
      switchMap(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to create order');
        }

        // Response contains array of order UIDs
        const orderUid = response.data[0];

        // Fetch the created order to return full details
        return this.getOrderById(orderUid).pipe(
          map(order => {
            if (!order) {
              throw new Error('Failed to fetch created order');
            }
            return order;
          })
        );
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
   * Create draft order (saved cart)
   * No stock validation, no allocations
   */
  createDraftOrder(request: CreateOrderRequest): Observable<Order> {
    return this.createOrder(request, 'draft');
  }

  /**
   * Save current cart as draft on server. If a draft already exists it will be updated.
   * Returns Observable<Order> of the saved draft.
   */
  saveDraftCart(shippingAddress?: ShippingAddress, comment?: string): Observable<Order> {
    // Ensure we have at least an empty shipping address to satisfy mapper
    const addr: ShippingAddress = shippingAddress || { street: '', city: '', state: '', zipCode: '', country: '' };

    const request: CreateOrderRequest = {
      items: this.getCartItems().map(i => ({ productId: i.productId, quantity: i.quantity })),
      shippingAddress: addr,
      comment: comment
    };

    return this.createOrder(request, 'draft', this.draftOrderUid).pipe(
      map(order => {
        // remember draft UID for future updates
        this.draftOrderUid = order.id;

        // sync local cart items with server response (use server version if available)
        this.currentOrderSubject.next(order.items || []);
        return order;
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
          this.currentOrderSubject.next(latest.items || []);
        } else {
          // No drafts - keep empty cart
          this.draftOrderUid = undefined;
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
      order_uid: orderUid,
      status: newStatus
    };

    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/order/status`, payload).pipe(
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
   * Clear draft order UID (call after confirming draft)
   */
  clearDraftUid(): void {
    this.draftOrderUid = undefined;
  }

  // Cart management
  addToCart(item: OrderItem): void {
    const currentItems = this.currentOrderSubject.value;
    const existingItem = currentItems.find(i => i.productId === item.productId);

    if (existingItem) {
      existingItem.quantity += item.quantity;
      existingItem.subtotal = existingItem.quantity * existingItem.price;
    } else {
      currentItems.push(item);
    }

    this.currentOrderSubject.next([...currentItems]);
  }

  removeFromCart(productId: string): void {
    const currentItems = this.currentOrderSubject.value;
    this.currentOrderSubject.next(currentItems.filter(i => i.productId !== productId));
  }

  updateCartItemQuantity(productId: string, quantity: number): void {
    const currentItems = this.currentOrderSubject.value;
    const item = currentItems.find(i => i.productId === productId);

    if (item) {
      item.quantity = quantity;
      item.subtotal = item.quantity * item.price;
      this.currentOrderSubject.next([...currentItems]);
    }
  }

  clearCart(): void {
    this.currentOrderSubject.next([]);
    // Clear draft UID when cart is cleared
    this.draftOrderUid = undefined;
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
}
