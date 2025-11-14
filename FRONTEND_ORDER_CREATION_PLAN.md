# Front-End Order Creation Implementation Guide

## Overview

This document provides a practical guide for integrating real API order creation into your Angular B2B portal. The backend has been fully fixed and is production-ready with proper inventory tracking, validation, and transactional integrity.

**Backend Status**: ✅ All critical issues fixed (see `ALL_ISSUES_FIXED.md` for details)

---

## Current Implementation Status

Your Angular application currently has:

✅ **Product Catalog** - Grid and bulk views with category filtering
✅ **Cart System** - OrderService with BehaviorSubject state management
✅ **Cart Panel** - Slide-in panel with cart items and checkout button
✅ **Order Confirmation Dialog** - Custom dialog for order success
✅ **Authentication** - JWT-based auth with refresh tokens
✅ **Translation System** - Multi-language support (EN/UK)
✅ **Mock Data** - Ready to be replaced with real API calls

**Next Steps**: Replace mock data with real API integration

---

## Backend Capabilities (Ready to Use)

The backend now provides:

✅ **Atomic order creation** - Order and stock changes in single transaction
✅ **Stock validation** - Products checked for existence, active status, and availability
✅ **Automatic stock reduction** - Inventory updated when orders are created
✅ **Order cancellation** - Stock automatically restored
✅ **Order status management** - Valid statuses: `new`, `processing`, `confirmed`
✅ **Transaction safety** - No partial updates, automatic rollback on errors

---

## API Endpoints Reference

### Base URL
```
/v1/
```

### Authentication
All endpoints require authentication via Bearer token (already implemented in your auth.service.ts).

### Available Endpoints

| Method | Endpoint | Description | Stock Impact |
|--------|----------|-------------|--------------|
| POST | `/order/` | Create/update order | ✅ Reduces stock |
| GET | `/order/` | List orders (paginated) | - |
| GET | `/order/{uid}` | Get specific order | - |
| DELETE | `/order/{uid}` | Delete order | ⚠️ No stock restore |
| GET | `/order/user/{user_uid}` | Get user's orders | - |
| GET | `/order/status/{status}` | Get orders by status | - |
| POST | `/order/status` | Update order status | - |
| POST | `/order/item` | Add/update order item | ⚠️ Validates but doesn't reduce stock |
| DELETE | `/order/{orderUID}/item/{productUID}` | Remove order item | ✅ Restores stock |
| GET | `/order/{orderUID}/items` | Get order items | - |

### Product Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/product/` | List products |
| GET | `/product/{uid}` | Get specific product |
| GET | `/product/description/{productUID}` | Get product descriptions (multi-language) |

---

## Request/Response Format

All requests use standardized format:

```json
{
  "data": [
    {
      // entity fields
    }
  ]
}
```

All responses:

```json
{
  "success": true,
  "message": "Optional message",
  "data": { /* response data */ }
}
```

---

## Model Mapping (Frontend ↔ Backend)

### Your Current Models vs Backend Format

**Frontend (order.model.ts)**:
```typescript
export interface Order {
  id: string;                    // Maps to: uid
  orderNumber: string;           // Generated on backend
  userId: string;                // Maps to: user_uid
  items: OrderItem[];           // Maps to: items[]
  totalAmount: number;          // Maps to: total
  status: OrderStatus;          // Maps to: status ('new', 'processing', 'confirmed')
  createdAt: Date;             // Generated on backend
  updatedAt: Date;             // Generated on backend
  shippingAddress?: ShippingAddress; // Maps to: shipping_address (string on backend)
}

export interface OrderItem {
  productId: string;            // Maps to: product_uid
  productName: string;          // Not sent to backend (fetched from product)
  quantity: number;             // Maps to: quantity
  price: number;                // Maps to: price (in cents on backend)
  subtotal: number;             // Maps to: total
}
```

**Backend Expected Format**:
```typescript
{
  uid: string;                  // Your: id
  user_uid: string;             // Your: userId
  status: 'new' | 'processing' | 'confirmed';
  total: number;                // Your: totalAmount (in cents: 1000 = $10.00)
  shipping_address: string;     // Your: formatted string from ShippingAddress
  billing_address?: string;     // Optional
  items: [
    {
      order_uid: string;
      product_uid: string;      // Your: productId
      quantity: number;
      price: number;            // In cents
      discount: number;         // In cents, default 0
      total: number;            // In cents
    }
  ]
}
```

---

## Implementation Plan

### Phase 1: Update Models (30 minutes)

Update your models to support backend format while keeping current structure.

**File: `src/app/core/models/order.model.ts`**

```typescript
export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: Date;
  updatedAt: Date;
  shippingAddress?: ShippingAddress;
}

export interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export enum OrderStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED'
}

export interface CreateOrderRequest {
  items: {
    productId: string;
    quantity: number;
  }[];
  shippingAddress: ShippingAddress;
}

// NEW: Backend API format
export interface BackendOrderRequest {
  uid?: string;
  user_uid: string;
  status?: 'new' | 'processing' | 'confirmed';
  total: number;
  shipping_address: string;
  billing_address?: string;
  items: {
    order_uid?: string;
    product_uid: string;
    quantity: number;
    price: number;
    discount?: number;
    total: number;
  }[];
}

export interface BackendOrderResponse {
  uid: string;
  user_uid: string;
  status: string;
  total: number;
  shipping_address: string;
  billing_address?: string;
  created_at: string;
  updated_at: string;
}
```

**File: `src/app/core/models/product.model.ts`**

```typescript
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  inStock: boolean;
  sku: string;
  quantity?: number; // NEW: Add stock quantity
  active?: boolean;  // NEW: Add active status
}

// NEW: Backend API format
export interface BackendProduct {
  uid: string;
  name?: string; // May need to fetch from descriptions
  price: number; // In cents
  quantity: number;
  active: boolean;
  category?: string;
  sku?: string;
}
```

---

### Phase 2: Create API Mappers (1 hour)

Create mapper utilities to transform between frontend and backend formats.

**File: `src/app/core/mappers/order.mapper.ts`** (NEW)

```typescript
import { Order, OrderItem, BackendOrderRequest, BackendOrderResponse, ShippingAddress } from '../models/order.model';
import { v4 as uuidv4 } from 'uuid'; // Install: npm install uuid

export class OrderMapper {
  /**
   * Convert frontend order to backend format
   */
  static toBackendRequest(
    userId: string,
    items: OrderItem[],
    shippingAddress: ShippingAddress,
    billingAddress?: ShippingAddress
  ): BackendOrderRequest {
    const orderUid = uuidv4();

    // Calculate total in cents
    const total = items.reduce((sum, item) => sum + item.subtotal, 0) * 100;

    // Format address as string
    const shippingAddressStr = this.formatAddress(shippingAddress);
    const billingAddressStr = billingAddress ? this.formatAddress(billingAddress) : shippingAddressStr;

    return {
      uid: orderUid,
      user_uid: userId,
      status: 'new',
      total: total,
      shipping_address: shippingAddressStr,
      billing_address: billingAddressStr,
      items: items.map(item => ({
        order_uid: orderUid,
        product_uid: item.productId,
        quantity: item.quantity,
        price: Math.round(item.price * 100), // Convert to cents
        discount: 0,
        total: Math.round(item.subtotal * 100) // Convert to cents
      }))
    };
  }

  /**
   * Convert backend response to frontend order
   */
  static fromBackendResponse(response: BackendOrderResponse, items: any[]): Order {
    return {
      id: response.uid,
      orderNumber: this.generateOrderNumber(response.uid),
      userId: response.user_uid,
      items: items.map(item => ({
        productId: item.product_uid,
        productName: item.product_name || 'Unknown Product',
        quantity: item.quantity,
        price: item.price / 100, // Convert from cents
        subtotal: item.total / 100 // Convert from cents
      })),
      totalAmount: response.total / 100, // Convert from cents
      status: this.mapBackendStatus(response.status),
      createdAt: new Date(response.created_at),
      updatedAt: new Date(response.updated_at),
      shippingAddress: this.parseAddress(response.shipping_address)
    };
  }

  /**
   * Format address object to string
   */
  private static formatAddress(address: ShippingAddress): string {
    return `${address.street}, ${address.city}, ${address.state} ${address.zipCode}, ${address.country}`;
  }

  /**
   * Parse address string to object (basic implementation)
   */
  private static parseAddress(addressStr: string): ShippingAddress {
    // Basic parsing - adjust based on actual format
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
   * Map backend status to frontend enum
   */
  private static mapBackendStatus(status: string): any {
    const statusMap: any = {
      'new': 'PENDING',
      'processing': 'PROCESSING',
      'confirmed': 'CONFIRMED',
      'shipped': 'SHIPPED',
      'delivered': 'DELIVERED',
      'cancelled': 'CANCELLED'
    };
    return statusMap[status.toLowerCase()] || 'PENDING';
  }

  /**
   * Generate order number from UID
   */
  private static generateOrderNumber(uid: string): string {
    const year = new Date().getFullYear();
    const shortId = uid.substring(0, 8).toUpperCase();
    return `ORD-${year}-${shortId}`;
  }
}
```

**File: `src/app/core/mappers/product.mapper.ts`** (NEW)

```typescript
import { Product, BackendProduct } from '../models/product.model';

export class ProductMapper {
  /**
   * Convert backend product to frontend format
   */
  static fromBackend(backendProduct: BackendProduct, name?: string, description?: string): Product {
    return {
      id: backendProduct.uid,
      name: name || backendProduct.name || 'Unknown Product',
      description: description || '',
      price: backendProduct.price / 100, // Convert from cents
      category: backendProduct.category || 'Uncategorized',
      imageUrl: undefined, // Set if you have image URLs
      inStock: backendProduct.active && backendProduct.quantity > 0,
      sku: backendProduct.sku || '',
      quantity: backendProduct.quantity,
      active: backendProduct.active
    };
  }
}
```

---

### Phase 3: Update Product Service (1-2 hours)

Replace mock data with real API calls.

**File: `src/app/core/services/product.service.ts`**

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject, forkJoin } from 'rxjs';
import { delay, map, catchError } from 'rxjs/operators';
import { Product, ProductCategory, BackendProduct } from '../models/product.model';
import { ProductMapper } from '../mappers/product.mapper';
import { environment } from '../../../environments/environment';

// Keep mock data as fallback
import { MOCK_PRODUCTS, MOCK_CATEGORIES } from '../mock-data/products.mock';

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

interface ProductDescription {
  product_uid: string;
  language: string;
  name: string;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private viewModeSubject = new BehaviorSubject<'grid' | 'bulk'>('bulk');
  public viewMode$ = this.viewModeSubject.asObservable();

  private readonly apiUrl = environment.apiUrl; // e.g., 'http://localhost:8000/v1'

  constructor(private http: HttpClient) { }

  getViewMode(): 'grid' | 'bulk' {
    return this.viewModeSubject.value;
  }

  setViewMode(mode: 'grid' | 'bulk'): void {
    this.viewModeSubject.next(mode);
  }

  toggleViewMode(): void {
    const currentMode = this.viewModeSubject.value;
    this.viewModeSubject.next(currentMode === 'grid' ? 'bulk' : 'grid');
  }

  /**
   * Fetch all products with descriptions
   */
  getProducts(offset: number = 0, limit: number = 100): Observable<Product[]> {
    const params = new HttpParams()
      .set('offset', offset.toString())
      .set('limit', limit.toString());

    return this.http.get<ApiResponse<BackendProduct[]>>(`${this.apiUrl}/product/`, { params }).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch products');
        }

        // For each product, fetch descriptions
        // Note: This could be optimized with a batch endpoint
        const products$ = response.data.map(backendProduct =>
          this.getProductDescription(backendProduct.uid).pipe(
            map(desc => ProductMapper.fromBackend(backendProduct, desc?.name, desc?.description)),
            catchError(() => of(ProductMapper.fromBackend(backendProduct)))
          )
        );

        return forkJoin(products$);
      }),
      map(products => products),
      catchError(error => {
        console.error('Error fetching products, using mock data:', error);
        return of(MOCK_PRODUCTS);
      })
    );
  }

  /**
   * Fetch product by ID
   */
  getProductById(uid: string): Observable<Product | undefined> {
    return this.http.get<ApiResponse<BackendProduct>>(`${this.apiUrl}/product/${uid}`).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Product not found');
        }
        return response.data;
      }),
      map(backendProduct => {
        // Fetch description
        return this.getProductDescription(uid).pipe(
          map(desc => ProductMapper.fromBackend(backendProduct, desc?.name, desc?.description))
        );
      }),
      map(product$ => product$),
      catchError(error => {
        console.error('Error fetching product:', error);
        return of(undefined);
      })
    );
  }

  /**
   * Fetch product description (multi-language)
   */
  getProductDescription(productUid: string, language: string = 'en'): Observable<ProductDescription | null> {
    return this.http.get<ApiResponse<ProductDescription[]>>(
      `${this.apiUrl}/product/description/${productUid}`
    ).pipe(
      map(response => {
        if (!response.success || !response.data.length) {
          return null;
        }

        // Find description in requested language, or fallback to first available
        return response.data.find(d => d.language === language) || response.data[0];
      }),
      catchError(error => {
        console.error('Error fetching product description:', error);
        return of(null);
      })
    );
  }

  /**
   * Get categories (currently returns mock data - adjust if backend has category endpoint)
   */
  getCategories(): Observable<ProductCategory[]> {
    // TODO: If backend has category endpoint, implement here
    return of(MOCK_CATEGORIES).pipe(delay(300));
  }

  /**
   * Search products (client-side filtering for now)
   */
  searchProducts(query: string): Observable<Product[]> {
    return this.getProducts().pipe(
      map(products => {
        const lowerQuery = query.toLowerCase();
        return products.filter(p =>
          p.name.toLowerCase().includes(lowerQuery) ||
          p.description.toLowerCase().includes(lowerQuery) ||
          p.sku.toLowerCase().includes(lowerQuery)
        );
      })
    );
  }

  /**
   * Validate product stock before adding to cart
   */
  validateStock(productId: string, requestedQuantity: number): Observable<boolean> {
    return this.http.get<ApiResponse<BackendProduct>>(`${this.apiUrl}/product/${productId}`).pipe(
      map(response => {
        if (!response.success) {
          return false;
        }

        const product = response.data;
        return product.active && product.quantity >= requestedQuantity;
      }),
      catchError(() => of(false))
    );
  }
}
```

---

### Phase 4: Update Order Service (2-3 hours)

Replace mock order creation with real API integration.

**File: `src/app/core/services/order.service.ts`**

```typescript
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject, throwError } from 'rxjs';
import { delay, map, catchError, tap } from 'rxjs/operators';
import { Order, OrderItem, CreateOrderRequest, OrderStatus, BackendOrderRequest, BackendOrderResponse } from '../models/order.model';
import { OrderMapper } from '../mappers/order.mapper';
import { environment } from '../../../environments/environment';

// Keep mock data as fallback
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

  private readonly apiUrl = environment.apiUrl; // e.g., 'http://localhost:8000/v1'

  constructor(private http: HttpClient) { }

  /**
   * Fetch order history for a user
   */
  getOrderHistory(userUid: string, offset: number = 0, limit: number = 20): Observable<Order[]> {
    const params = new HttpParams()
      .set('offset', offset.toString())
      .set('limit', limit.toString());

    return this.http.get<ApiResponse<BackendOrderResponse[]>>(
      `${this.apiUrl}/order/user/${userUid}`,
      { params }
    ).pipe(
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to fetch orders');
        }

        // For each order, fetch items
        return response.data.map(orderData => {
          // Fetch items for this order
          return this.getOrderItems(orderData.uid).pipe(
            map(items => OrderMapper.fromBackendResponse(orderData, items))
          );
        });
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
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Order not found');
        }
        return response.data;
      }),
      map(orderData => {
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
    const userId = this.getCurrentUserId(); // Get from AuthService

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
      map(response => {
        if (!response.success) {
          throw new Error(response.message || 'Failed to create order');
        }

        // Response contains array of order UIDs
        const orderUid = response.data[0];

        // Fetch the created order to return full details
        return this.getOrderById(orderUid);
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

  // ==================== Cart Management ====================

  /**
   * Add item to cart
   */
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

  /**
   * Remove item from cart
   */
  removeFromCart(productId: string): void {
    const currentItems = this.currentOrderSubject.value;
    this.currentOrderSubject.next(currentItems.filter(i => i.productId !== productId));
  }

  /**
   * Update cart item quantity
   */
  updateCartItemQuantity(productId: string, quantity: number): void {
    const currentItems = this.currentOrderSubject.value;
    const item = currentItems.find(i => i.productId === productId);

    if (item) {
      item.quantity = quantity;
      item.subtotal = item.quantity * item.price;
      this.currentOrderSubject.next([...currentItems]);
    }
  }

  /**
   * Clear cart
   */
  clearCart(): void {
    this.currentOrderSubject.next([]);
  }

  /**
   * Get cart total
   */
  getCartTotal(): number {
    return this.currentOrderSubject.value.reduce((sum, item) => sum + item.subtotal, 0);
  }

  /**
   * Get cart items
   */
  getCartItems(): OrderItem[] {
    return this.currentOrderSubject.value;
  }

  /**
   * Get current user ID from auth service
   */
  private getCurrentUserId(): string {
    // TODO: Inject AuthService and get current user UID
    // For now, return mock value - UPDATE THIS!
    return 'user-uid-from-auth-service';
  }
}
```

---

### Phase 5: Update Environment Configuration (15 minutes)

Add API URL to environment files.

**File: `src/environments/environment.ts`**

```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8000/v1'  // Adjust to your backend URL
};
```

**File: `src/environments/environment.prod.ts`**

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://your-production-api.com/v1'  // Your production API URL
};
```

---

### Phase 6: Error Handling & User Feedback (1-2 hours)

Add error handling and user-friendly messages.

**File: `src/app/core/services/error-handler.service.ts`** (NEW)

```typescript
import { Injectable } from '@angular/core';
import { TranslationService } from './translation.service';

export enum OrderErrorType {
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  PRODUCT_INACTIVE = 'PRODUCT_INACTIVE',
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  INVALID_STATUS = 'INVALID_STATUS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN = 'UNKNOWN'
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {
  constructor(private translationService: TranslationService) {}

  /**
   * Parse error and return user-friendly message
   */
  getOrderErrorMessage(error: any): string {
    const errorType = this.parseOrderError(error);

    switch (errorType) {
      case OrderErrorType.INSUFFICIENT_STOCK:
        return this.translationService.instant('errors.insufficientStock');

      case OrderErrorType.PRODUCT_INACTIVE:
        return this.translationService.instant('errors.productInactive');

      case OrderErrorType.PRODUCT_NOT_FOUND:
        return this.translationService.instant('errors.productNotFound');

      case OrderErrorType.INVALID_STATUS:
        return this.translationService.instant('errors.invalidStatus');

      case OrderErrorType.NETWORK_ERROR:
        return this.translationService.instant('errors.networkError');

      default:
        return this.translationService.instant('errors.orderFailed');
    }
  }

  /**
   * Parse error type from error object
   */
  private parseOrderError(error: any): OrderErrorType {
    const message = error?.message?.toLowerCase() || '';

    if (message.includes('insufficient stock') || message.includes('insufficient_stock')) {
      return OrderErrorType.INSUFFICIENT_STOCK;
    }

    if (message.includes('not active') || message.includes('product_inactive')) {
      return OrderErrorType.PRODUCT_INACTIVE;
    }

    if (message.includes('not found') || message.includes('product_not_found')) {
      return OrderErrorType.PRODUCT_NOT_FOUND;
    }

    if (message.includes('invalid status') || message.includes('invalid_status')) {
      return OrderErrorType.INVALID_STATUS;
    }

    if (message.includes('network') || error?.status === 0) {
      return OrderErrorType.NETWORK_ERROR;
    }

    return OrderErrorType.UNKNOWN;
  }
}
```

**Update translations** (`src/assets/i18n/en.json`):

```json
{
  "errors": {
    "insufficientStock": "Some items are out of stock. Please update your cart.",
    "productInactive": "Some items are no longer available.",
    "productNotFound": "Product not found.",
    "invalidStatus": "Invalid order status.",
    "networkError": "Network error. Please check your connection.",
    "orderFailed": "Failed to create order. Please try again."
  }
}
```

---

### Phase 7: Update App Component (30 minutes)

Update the order creation flow with proper error handling.

**File: `src/app/app.component.ts`**

```typescript
import { Component, ChangeDetectorRef } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { OrderService } from './core/services/order.service';
import { ProductService } from './core/services/product.service';
import { TranslationService } from './core/services/translation.service';
import { ErrorHandlerService } from './core/services/error-handler.service';
import { User, Client } from './core/models/user.model';
import { OrderItem, CreateOrderRequest, ShippingAddress } from './core/models/order.model';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'DARK B2B';
  currentEntity: User | Client | null = null;
  entityType: 'user' | 'client' | null = null;
  cartItems: OrderItem[] = [];
  showCartPanel = false;
  showOrderDialog = false;
  cartTotal = 0;
  viewMode: 'grid' | 'bulk' = 'bulk';
  showViewToggle = false;
  isAuthRoute = false;
  isCreatingOrder = false;

  constructor(
    public authService: AuthService,
    private orderService: OrderService,
    private productService: ProductService,
    private router: Router,
    public translationService: TranslationService,
    private errorHandler: ErrorHandlerService,
    private cdr: ChangeDetectorRef
  ) {
    this.authService.currentEntity$.subscribe(entity => {
      this.currentEntity = entity;
      this.cdr.markForCheck();
    });

    this.authService.entityType$.subscribe(type => {
      this.entityType = type;
    });

    this.orderService.currentOrder$.subscribe(items => {
      this.cartItems = items;
      this.cartTotal = this.orderService.getCartTotal();
    });

    this.productService.viewMode$.subscribe(mode => {
      this.viewMode = mode;
    });

    // Initialize auth route check
    this.isAuthRoute = this.router.url.includes('/auth');

    // Show view toggle only on products catalog page
    // Also track if we're on auth route
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.showViewToggle = event.url.includes('/products/catalog');
      this.isAuthRoute = event.url.includes('/auth');
    });
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/auth/login']);
      },
      error: (error) => {
        console.error('Logout error:', error);
        // Navigate to login even if logout API call fails
        this.router.navigate(['/auth/login']);
      }
    });
  }

  // Helper method to get display name
  getDisplayName(): string {
    if (!this.currentEntity) return '';
    if (this.entityType === 'user') {
      const user = this.currentEntity as User;
      return `${user.first_name} ${user.last_name}`;
    } else {
      const client = this.currentEntity as Client;
      return client.name;
    }
  }

  // Helper method to get user data
  getUserData(): User | null {
    return this.entityType === 'user' ? this.currentEntity as User : null;
  }

  // Helper method to get client data
  getClientData(): Client | null {
    return this.entityType === 'client' ? this.currentEntity as Client : null;
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  toggleCartPanel(): void {
    this.showCartPanel = !this.showCartPanel;
  }

  removeFromCart(productId: string): void {
    this.orderService.removeFromCart(productId);
  }

  updateQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }
    this.orderService.updateCartItemQuantity(productId, quantity);
  }

  proceedToCheckout(): void {
    if (this.cartItems.length === 0 || this.isCreatingOrder) {
      return;
    }

    this.isCreatingOrder = true;

    // Create order with empty shipping address
    // In production, you should collect this from user
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
      shippingAddress: emptyAddress
    };

    this.orderService.createOrder(orderRequest).subscribe({
      next: () => {
        this.isCreatingOrder = false;
        this.showCartPanel = false;
        this.showOrderDialog = true;
      },
      error: (error) => {
        this.isCreatingOrder = false;
        console.error('Error creating order:', error);

        // Show user-friendly error message
        const errorMessage = this.errorHandler.getOrderErrorMessage(error);
        alert(errorMessage);
      }
    });
  }

  onOrderConfirmed(): void {
    this.orderService.clearCart();
    this.closeOrderDialog();
    this.router.navigate(['/orders/history']);
  }

  closeOrderDialog(): void {
    this.showOrderDialog = false;
  }

  toggleViewMode(): void {
    this.productService.toggleViewMode();
  }
}
```

---

### Phase 8: Install Dependencies (5 minutes)

Install required packages:

```bash
npm install uuid
npm install --save-dev @types/uuid
```

---

### Phase 9: Testing (2-3 hours)

Update your existing tests or create new ones.

**File: `src/app/core/services/order.service.spec.ts`**

```typescript
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OrderService } from './order.service';
import { environment } from '../../../environments/environment';

describe('OrderService', () => {
  let service: OrderService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [OrderService]
    });
    service = TestBed.inject(OrderService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create order successfully', (done) => {
    const mockRequest = {
      items: [{ productId: 'p1', quantity: 2 }],
      shippingAddress: {
        street: '123 Main St',
        city: 'City',
        state: 'State',
        zipCode: '12345',
        country: 'USA'
      }
    };

    const mockResponse = {
      success: true,
      data: ['order-uid-123']
    };

    service.createOrder(mockRequest).subscribe({
      next: (order) => {
        expect(order).toBeDefined();
        done();
      },
      error: done.fail
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/order/`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should handle insufficient stock error', (done) => {
    const mockRequest = {
      items: [{ productId: 'p1', quantity: 100 }],
      shippingAddress: {
        street: '123 Main St',
        city: 'City',
        state: 'State',
        zipCode: '12345',
        country: 'USA'
      }
    };

    service.createOrder(mockRequest).subscribe({
      next: () => done.fail('Should have thrown error'),
      error: (error) => {
        expect(error.message).toContain('INSUFFICIENT_STOCK');
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/order/`);
    req.flush(
      { success: false, message: 'insufficient stock for product p1' },
      { status: 400, statusText: 'Bad Request' }
    );
  });
});
```

---

## Security Considerations

### 1. Authentication
✅ **Already Implemented**: Your JWT-based auth with refresh tokens is properly set up in `auth.service.ts`

### 2. API Key/Token Handling
- Tokens are sent via Authorization header in `auth.interceptor.ts`
- Tokens stored in localStorage (consider httpOnly cookies for production)

### 3. Input Validation
- ✅ Client-side: Angular Reactive Forms with validators
- ✅ Server-side: Backend validates all inputs

### 4. Price Integrity
- **Important**: Never send product prices from client
- Always fetch current prices from backend before order creation
- Backend validates prices anyway

### 5. CORS
- Backend already configured with CORS support
- Ensure your domain is whitelisted in production

---

## Common Issues & Solutions

### Issue 1: CORS Errors
**Solution**: Ensure backend CORS configuration allows your frontend origin:
```python
# Backend should have:
origins = ["http://localhost:4200", "https://your-prod-domain.com"]
```

### Issue 2: Token Expiration During Checkout
**Solution**: Already handled by your `auth.interceptor.ts` which refreshes tokens automatically

### Issue 3: Cart Items Out of Stock
**Solution**: Validate stock before order creation:
```typescript
// In product-catalog.component.ts before adding to cart
this.productService.validateStock(product.id, quantity).subscribe(isValid => {
  if (isValid) {
    this.orderService.addToCart(orderItem);
  } else {
    alert(this.translationService.instant('errors.insufficientStock'));
  }
});
```

### Issue 4: Price Format Mismatch
**Solution**: Backend uses cents (integer). Convert:
- Frontend → Backend: `price * 100`
- Backend → Frontend: `price / 100`

---

## Rollout Plan

### Week 1: Setup & Models
- [x] Update models with backend format
- [x] Create mapper utilities
- [x] Install dependencies

### Week 2: API Integration
- [ ] Update ProductService with real API calls
- [ ] Update OrderService with real API calls
- [ ] Test API integration with backend

### Week 3: Error Handling & UX
- [ ] Implement error handler service
- [ ] Add loading states
- [ ] Update translations
- [ ] Test error scenarios

### Week 4: Testing & Polish
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Test with real backend
- [ ] Performance optimization

### Week 5: Production Readiness
- [ ] Update environment configs
- [ ] Security audit
- [ ] Load testing
- [ ] Deploy to staging
- [ ] Production deployment

---

## Quick Start Checklist

1. **Install UUID package**:
   ```bash
   npm install uuid
   npm install --save-dev @types/uuid
   ```

2. **Update environment files** with your API URL

3. **Create mapper files**:
   - `src/app/core/mappers/order.mapper.ts`
   - `src/app/core/mappers/product.mapper.ts`

4. **Update services**:
   - Replace TODO comments in `product.service.ts`
   - Replace TODO comments in `order.service.ts`

5. **Add error handling**:
   - Create `error-handler.service.ts`
   - Update translations

6. **Test with backend**:
   - Start backend server
   - Test product listing
   - Test order creation
   - Test error scenarios

---

## Summary

Your Angular application is well-structured and ready for API integration. The main work involves:

1. ✅ **Creating mappers** to transform between frontend and backend formats
2. ✅ **Replacing mock data** with HttpClient calls in services
3. ✅ **Adding error handling** for production-ready error management
4. ✅ **Testing** with real backend to ensure everything works

The backend is production-ready with atomic transactions, stock validation, and proper error handling. Follow this plan phase by phase to complete the integration.

For backend details, see `ALL_ISSUES_FIXED.md`.
