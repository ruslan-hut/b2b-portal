import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { OrderService } from './order.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { CreateOrderRequest, ShippingAddress } from '../models/order.model';

describe('OrderService', () => {
  let service: OrderService;
  let httpMock: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    const authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      currentEntityValue: { uid: 'test-user-uid' }
    });

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        OrderService,
        { provide: AuthService, useValue: authServiceSpy }
      ]
    });
    service = TestBed.inject(OrderService);
    httpMock = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService) as jasmine.SpyObj<AuthService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should create order successfully', (done) => {
    const mockShippingAddress: ShippingAddress = {
      street: '123 Main St',
      city: 'City',
      state: 'State',
      zipCode: '12345',
      country: 'USA'
    };

    const mockRequest: CreateOrderRequest = {
      items: [{ productId: 'p1', quantity: 2 }],
      shippingAddress: mockShippingAddress
    };

    // Add items to cart first
    service.addToCart({
      productId: 'p1',
      productName: 'Product 1',
      quantity: 2,
      price: 10.00,
      subtotal: 20.00
    });

    const mockOrderResponse = {
      success: true,
      data: ['order-uid-123']
    };

    const mockOrderDetailsResponse = {
      success: true,
      data: {
        uid: 'order-uid-123',
        user_uid: 'test-user-uid',
        status: 'new',
        total: 2000,
        shipping_address: '123 Main St, City, State 12345, USA',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z'
      }
    };

    const mockItemsResponse = {
      success: true,
      data: [{
        product_uid: 'p1',
        product_name: 'Product 1',
        quantity: 2,
        price: 1000,
        total: 2000
      }]
    };

    service.createOrder(mockRequest).subscribe({
      next: (order) => {
        expect(order).toBeDefined();
        expect(order.id).toBe('order-uid-123');
        expect(order.userId).toBe('test-user-uid');
        expect(order.totalAmount).toBe(20.00);
        done();
      },
      error: done.fail
    });

    // Expect POST request to create order
    const createReq = httpMock.expectOne(`${environment.apiUrl}/order/`);
    expect(createReq.request.method).toBe('POST');
    createReq.flush(mockOrderResponse);

    // Expect GET request to fetch order details
    const detailsReq = httpMock.expectOne(`${environment.apiUrl}/order/order-uid-123`);
    expect(detailsReq.request.method).toBe('GET');
    detailsReq.flush(mockOrderDetailsResponse);

    // Expect GET request to fetch order items
    const itemsReq = httpMock.expectOne(`${environment.apiUrl}/order/order-uid-123/items`);
    expect(itemsReq.request.method).toBe('GET');
    itemsReq.flush(mockItemsResponse);
  });

  it('should handle insufficient stock error', (done) => {
    const mockShippingAddress: ShippingAddress = {
      street: '123 Main St',
      city: 'City',
      state: 'State',
      zipCode: '12345',
      country: 'USA'
    };

    const mockRequest: CreateOrderRequest = {
      items: [{ productId: 'p1', quantity: 100 }],
      shippingAddress: mockShippingAddress
    };

    // Add items to cart first
    service.addToCart({
      productId: 'p1',
      productName: 'Product 1',
      quantity: 100,
      price: 10.00,
      subtotal: 1000.00
    });

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

  it('should handle product inactive error', (done) => {
    const mockShippingAddress: ShippingAddress = {
      street: '123 Main St',
      city: 'City',
      state: 'State',
      zipCode: '12345',
      country: 'USA'
    };

    const mockRequest: CreateOrderRequest = {
      items: [{ productId: 'p1', quantity: 1 }],
      shippingAddress: mockShippingAddress
    };

    // Add items to cart first
    service.addToCart({
      productId: 'p1',
      productName: 'Product 1',
      quantity: 1,
      price: 10.00,
      subtotal: 10.00
    });

    service.createOrder(mockRequest).subscribe({
      next: () => done.fail('Should have thrown error'),
      error: (error) => {
        expect(error.message).toContain('PRODUCT_INACTIVE');
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/order/`);
    req.flush(
      { success: false, message: 'Product p1 is not active' },
      { status: 400, statusText: 'Bad Request' }
    );
  });

  it('should add item to cart', () => {
    const item = {
      productId: 'p1',
      productName: 'Product 1',
      quantity: 2,
      price: 10.00,
      subtotal: 20.00
    };

    service.addToCart(item);

    const cartItems = service.getCartItems();
    expect(cartItems.length).toBe(1);
    expect(cartItems[0].productId).toBe('p1');
    expect(cartItems[0].quantity).toBe(2);
  });

  it('should update existing cart item quantity when adding duplicate', () => {
    const item = {
      productId: 'p1',
      productName: 'Product 1',
      quantity: 2,
      price: 10.00,
      subtotal: 20.00
    };

    service.addToCart(item);
    service.addToCart(item);

    const cartItems = service.getCartItems();
    expect(cartItems.length).toBe(1);
    expect(cartItems[0].quantity).toBe(4);
    expect(cartItems[0].subtotal).toBe(40.00);
  });

  it('should remove item from cart', () => {
    const item = {
      productId: 'p1',
      productName: 'Product 1',
      quantity: 2,
      price: 10.00,
      subtotal: 20.00
    };

    service.addToCart(item);
    service.removeFromCart('p1');

    const cartItems = service.getCartItems();
    expect(cartItems.length).toBe(0);
  });

  it('should calculate cart total correctly', () => {
    service.addToCart({
      productId: 'p1',
      productName: 'Product 1',
      quantity: 2,
      price: 10.00,
      subtotal: 20.00
    });

    service.addToCart({
      productId: 'p2',
      productName: 'Product 2',
      quantity: 1,
      price: 15.00,
      subtotal: 15.00
    });

    const total = service.getCartTotal();
    expect(total).toBe(35.00);
  });

  it('should clear cart', () => {
    service.addToCart({
      productId: 'p1',
      productName: 'Product 1',
      quantity: 2,
      price: 10.00,
      subtotal: 20.00
    });

    service.clearCart();

    const cartItems = service.getCartItems();
    expect(cartItems.length).toBe(0);
  });
});
