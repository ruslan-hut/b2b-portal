import { Injectable } from '@angular/core';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { Order, OrderItem, CreateOrderRequest, OrderStatus } from '../models/order.model';
import { MOCK_ORDERS } from '../mock-data/orders.mock';
import { MOCK_PRODUCTS } from '../mock-data/products.mock';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private currentOrderSubject = new BehaviorSubject<OrderItem[]>([]);
  public currentOrder$ = this.currentOrderSubject.asObservable();

  constructor() { }

  getOrderHistory(): Observable<Order[]> {
    // TODO: Replace with actual API call
    return of(MOCK_ORDERS).pipe(delay(500));
  }

  getOrderById(id: string): Observable<Order | undefined> {
    // TODO: Replace with actual API call
    return new Observable(observer => {
      this.getOrderHistory().subscribe(orders => {
        observer.next(orders.find(o => o.id === id));
        observer.complete();
      });
    });
  }

  createOrder(request: CreateOrderRequest): Observable<Order> {
    // TODO: Replace with actual API call
    const mockOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      orderNumber: 'ORD-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 1000)).padStart(3, '0'),
      userId: '1',
      items: request.items.map(item => {
        const product = MOCK_PRODUCTS.find(p => p.id === item.productId);
        const price = product?.price || 0;
        return {
          productId: item.productId,
          productName: product?.name || 'Unknown Product',
          quantity: item.quantity,
          price: price,
          subtotal: price * item.quantity
        };
      }),
      totalAmount: 0, // Calculate from items
      status: OrderStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      shippingAddress: request.shippingAddress
    };

    mockOrder.totalAmount = mockOrder.items.reduce((sum, item) => sum + item.subtotal, 0);

    return of(mockOrder).pipe(delay(500));
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
}
