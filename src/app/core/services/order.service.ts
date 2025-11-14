import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject, throwError, forkJoin } from 'rxjs';
import { delay, map, catchError, switchMap } from 'rxjs/operators';
import { Order, OrderItem, CreateOrderRequest, OrderStatus, BackendOrderRequest, BackendOrderResponse } from '../models/order.model';
import { OrderMapper } from '../mappers/order.mapper';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { MOCK_ORDERS } from '../mock-data/orders.mock';
import { MOCK_PRODUCTS } from '../mock-data/products.mock';

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

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

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

        // For each order, fetch items
        const orders$ = response.data.map(orderData =>
          this.getOrderItems(orderData.uid).pipe(
            map(items => OrderMapper.fromBackendResponse(orderData, items))
          )
        );

        return orders$.length > 0 ? forkJoin(orders$) : of([]);
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
          map(items => OrderMapper.fromBackendResponse(orderData, items))
        );
      }),
      catchError(error => {
        console.error('Error fetching order:', error);
        return of(undefined);
      })
    );
  }

  /**
   * Fetch items for a specific order
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
   * Create new order
   */
  createOrder(request: CreateOrderRequest): Observable<Order> {
    const userId = this.getCurrentUserId();

    // Get current cart items with full details
    const cartItems = this.getCartItems();

    // Convert to backend format
    const backendRequest: BackendOrderRequest = OrderMapper.toBackendRequest(
      userId,
      cartItems,
      request.shippingAddress
    );

    // Wrap in data array as per API spec
    const payload = {
      data: [backendRequest]
    };

    return this.http.post<ApiResponse<string[]>>(`${this.apiUrl}/order/`, payload).pipe(
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
