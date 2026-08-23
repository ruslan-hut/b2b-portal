import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { OrderService } from './order.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { CreateOrderRequest, ShippingAddress } from '../models/order.model';

describe('OrderService', () => {
  let service: OrderService;
  let httpMock: HttpTestingController;
  let authService: jasmine.SpyObj<AuthService>;

  const mockShippingAddress: ShippingAddress = {
    street: '123 Main St',
    city: 'City',
    state: 'State',
    zipCode: '12345',
    country: 'USA'
  };

  beforeEach(() => {
    // OrderService subscribes to currentEntity$ in its constructor; the stream
    // must exist (emitting no entity keeps the draft-cart load out of the way).
    const authServiceSpy = jasmine.createSpyObj('AuthService', [], {
      currentEntityValue: { uid: 'test-user-uid' },
      currentEntity$: of(null)
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

    // The confirm endpoint returns the whole order in one response; monetary
    // fields come back in cents and are divided by 100 by the service.
    const mockConfirmResponse = {
      success: true,
      data: {
        uid: 'order-uid-123',
        number: 'ORD-1',
        client_phase: 'placed',
        total: 2000,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
        items: [{
          product_uid: 'p1',
          product_name: 'Product 1',
          quantity: 2,
          base_price: 1000,
          subtotal: 2000
        }]
      }
    };

    service.createOrder(mockRequest).subscribe({
      next: (order) => {
        expect(order.id).toBe('order-uid-123');
        expect(order.userId).toBe('test-user-uid');
        expect(order.totalAmount).toBe(20.00);
        expect(order.items.length).toBe(1);
        expect(order.items[0].price).toBe(10.00);
        done();
      },
      error: done.fail
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/frontend/orders/confirm`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.items).toEqual([{ product_uid: 'p1', quantity: 2 }]);
    req.flush(mockConfirmResponse);
  });

  it('should propagate the server error for insufficient stock', (done) => {
    const mockRequest: CreateOrderRequest = {
      items: [{ productId: 'p1', quantity: 100 }],
      shippingAddress: mockShippingAddress
    };

    service.addToCart({
      productId: 'p1',
      productName: 'Product 1',
      quantity: 100,
      price: 10.00,
      subtotal: 1000.00
    });

    // OrderService rethrows the raw HttpErrorResponse so callers can read the
    // structured server payload; classifying it is ErrorHandlerService's job.
    service.createOrder(mockRequest).subscribe({
      next: () => done.fail('Should have thrown error'),
      error: (error) => {
        expect(error.status).toBe(400);
        expect(error.error.message).toContain('insufficient stock');
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/frontend/orders/confirm`);
    req.flush(
      { success: false, message: 'insufficient stock for product p1' },
      { status: 400, statusText: 'Bad Request' }
    );
  });

  it('should propagate the server error for an inactive product', (done) => {
    const mockRequest: CreateOrderRequest = {
      items: [{ productId: 'p1', quantity: 1 }],
      shippingAddress: mockShippingAddress
    };

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
        expect(error.status).toBe(400);
        expect(error.error.message).toContain('is not active');
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/frontend/orders/confirm`);
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
    // Subtotals are owned by the backend and recalculated on cart save, so
    // merging a duplicate deliberately leaves the existing subtotal alone.
    expect(cartItems[0].subtotal).toBe(20.00);
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

  // Multi-session cart safety: the version returned by the server is the token
  // that lets it refuse a save built on a stale view of the cart.
  describe('cart concurrency version', () => {
    // Minimal /frontend/cart/* payload — only the fields the service reads.
    const cartPayload = (version: number, quantity: number) => ({
      success: true,
      data: {
        order_uid: 'draft-1',
        version,
        items: [{
          product_uid: 'p1',
          product_name: 'Product 1',
          quantity,
          base_price: 1000,
          price_with_vat: 1230,
          price_discount: 1000,
          price_after_discount_with_vat: 1230,
          tax: 230,
          subtotal: 1230,
          discount: 0,
          available_quantity: 5,
          active: true
        }],
        totals: {
          total: 1230, subtotal: 1000, total_vat: 230,
          original_total: 1000, original_total_with_vat: 1230,
          discount_amount: 0, discount_amount_with_vat: 0
        },
        discount_percent: 0,
        vat_rate: 23
      }
    });

    const addOneItem = () => service.addToCart({
      productId: 'p1',
      productName: 'Product 1',
      quantity: 1,
      price: 10.00,
      subtotal: 10.00
    });

    // flush() is synchronous, so the save has fully settled — including the
    // in-progress guard being released — before the next statement runs.
    it('sends no version on the first save, then echoes the one it was given', () => {
      addOneItem();

      service.saveDraftCart().subscribe();
      const first = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/update`);
      expect(first.request.body.version).toBeUndefined();
      first.flush(cartPayload(7, 1));

      service.saveDraftCart().subscribe();
      const second = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/update`);
      expect(second.request.body.version).toBe(7);
      second.flush(cartPayload(8, 1));
    });

    it('adopts the server cart when a save is refused as stale', (done) => {
      addOneItem();

      let sawConflict = false;
      service.cartConflict$.subscribe(flag => { sawConflict = flag; });

      service.saveDraftCart().subscribe(order => {
        // The resolved order is the server's, not the two-item cart we sent.
        expect(order.items[0].quantity).toBe(3);
        expect(sawConflict).toBeTrue();
        done();
      });

      const save = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/update`);
      save.flush(
        { success: false, error: { code: 'CONFLICT', extra: { reason: 'cart_version_conflict', current_version: 9 } } },
        { status: 409, statusText: 'Conflict' }
      );

      // The conflict is resolved by reloading, never by resending our items.
      const validate = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/validate`);
      validate.flush({ success: true, data: { cart: cartPayload(9, 3).data, removed_items: [] } });
    });

    // A lease conflict is not a stale-data conflict: nothing was written, so the
    // local cart must be left alone and no reload issued.
    it('keeps the local cart and reports the holder when the cart is locked', (done) => {
      addOneItem();

      let locked: any = null;
      service.cartLocked$.subscribe(info => { locked = info; });

      service.saveDraftCart().subscribe({
        next: () => done.fail('expected the lock to surface as an error'),
        error: () => {
          expect(locked?.holderUserAgent).toBe('Mozilla/5.0 (iPhone)');
          // Untouched: the user still has what they were editing.
          expect(service.getCartItems().length).toBe(1);
          done();
        }
      });

      const save = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/update`);
      save.flush(
        {
          success: false,
          error: {
            code: 'LOCKED',
            extra: { reason: 'cart_locked', holder_user_agent: 'Mozilla/5.0 (iPhone)' }
          }
        },
        { status: 423, statusText: 'Locked' }
      );
    });

    it('takes the cart over and adopts the server cart', (done) => {
      let locked: any = { holderUserAgent: 'other' };
      service.cartLocked$.subscribe(info => { locked = info; });

      service.takeOverCart().subscribe(order => {
        expect(order?.items[0].quantity).toBe(2);
        expect(locked).toBeNull();
        done();
      });

      const takeover = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/takeover`);
      takeover.flush({ success: true, data: { order_uid: 'draft-1', version: 4, expires_at: '2026-08-04T12:00:00Z' } });

      const validate = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/validate`);
      validate.flush({ success: true, data: { cart: cartPayload(4, 2).data, removed_items: [] } });
    });

    // A line change carries no version: the server merges it into the current
    // cart, so there is no stale snapshot to reject.
    it('posts a line change without a version and adopts the merged cart', (done) => {
      service.changeCartItem('p1', 'increment', 1, 'addr-1').subscribe(order => {
        // The server merged in a product this session never had.
        expect(order?.items.length).toBe(1);
        expect(order?.items[0].quantity).toBe(4);
        done();
      });

      const change = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/item`);
      expect(change.request.body).toEqual({
        product_uid: 'p1', mode: 'increment', quantity: 1, address_uid: 'addr-1'
      });
      expect(change.request.body.version).toBeUndefined();
      change.flush(cartPayload(11, 4));
    });

    it('clears the local cart when a line change empties it', (done) => {
      addOneItem();

      service.changeCartItem('p1', 'remove').subscribe(order => {
        expect(order).toBeNull();
        expect(service.getCartItems().length).toBe(0);
        done();
      });

      const change = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/item`);
      change.flush({ success: true, data: { version: 12, items: [] } });
    });

    // Two line writes in flight at once bump the cart version under one another
    // and the loser is refused as stale, which the user sees as a dropped click.
    // Only one request may be open at a time.
    it('holds a second line change until the first has answered', () => {
      service.changeCartItem('p1', 'increment', 1).subscribe();
      service.changeCartItem('p2', 'increment', 1).subscribe();

      const first = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/item`);
      expect(first.request.body.product_uid).toBe('p1');

      first.flush(cartPayload(11, 1));

      const second = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/item`);
      expect(second.request.body.product_uid).toBe('p2');
      second.flush(cartPayload(12, 1));
    });

    // Clicking + four times while the first request is open must still add four,
    // so the queued increments are summed rather than overwritten.
    it('sums increments queued for the same product', () => {
      service.changeCartItem('p1', 'increment', 1).subscribe();
      const first = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/item`);

      service.changeCartItem('p1', 'increment', 1).subscribe();
      service.changeCartItem('p1', 'increment', 1).subscribe();
      service.changeCartItem('p1', 'increment', 1).subscribe();

      first.flush(cartPayload(11, 1));

      const second = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/item`);
      expect(second.request.body).toEqual({ product_uid: 'p1', mode: 'increment', quantity: 3 });
      second.flush(cartPayload(12, 4));
    });

    // An absolute quantity is the user's final word on that line: the queued
    // change collapses to it instead of sending each intermediate value.
    it('collapses queued quantities for the same product to the last one', () => {
      service.changeCartItem('p1', 'set', 1).subscribe();
      const first = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/item`);

      service.changeCartItem('p1', 'set', 5).subscribe();
      service.changeCartItem('p1', 'set', 12).subscribe();

      first.flush(cartPayload(11, 1));

      const second = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/item`);
      expect(second.request.body.quantity).toBe(12);
      second.flush(cartPayload(12, 12));
    });

    // Everyone who asked for a change on the line is answered by the request that
    // finally carried it, so no caller is left subscribed to nothing.
    it('answers every caller folded into one request', () => {
      const seen: number[] = [];
      service.changeCartItem('p1', 'set', 1).subscribe(o => seen.push(o!.items[0].quantity));
      const first = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/item`);

      service.changeCartItem('p1', 'set', 5).subscribe(o => seen.push(o!.items[0].quantity));
      service.changeCartItem('p1', 'set', 12).subscribe(o => seen.push(o!.items[0].quantity));

      first.flush(cartPayload(11, 1));
      httpMock.expectOne(`${environment.apiUrl}/frontend/cart/item`).flush(cartPayload(12, 12));

      expect(seen).toEqual([1, 12, 12]);
    });

    // A failed request must not leave the queue jammed with nothing in flight to
    // drain it — the next change would then never be sent at all.
    it('keeps draining the queue after a failed line change', () => {
      service.changeCartItem('p1', 'set', 1).subscribe({ error: () => {} });
      const first = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/item`);

      service.changeCartItem('p2', 'set', 1).subscribe();
      first.flush({ success: false }, { status: 500, statusText: 'Server Error' });

      const second = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/item`);
      expect(second.request.body.product_uid).toBe('p2');
      second.flush(cartPayload(12, 1));
    });

    // A typed quantity arrives a digit at a time. Nothing should be sent until
    // the user stops, so "12" is stored once as 12 and never transiently as 1.
    it('waits for a typed quantity to settle before sending it', (done) => {
      service.changeCartItem('p1', 'set', 1, undefined, undefined, true).subscribe();
      httpMock.expectNone(`${environment.apiUrl}/frontend/cart/item`);

      service.changeCartItem('p1', 'set', 12, undefined, undefined, true).subscribe(() => done());

      setTimeout(() => {
        const only = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/item`);
        expect(only.request.body.quantity).toBe(12);
        only.flush(cartPayload(11, 12));
      }, 400);
    });

    // Waiting on a keystroke timer would make a button press feel dropped.
    it('flushes a settling change when a deliberate action follows', () => {
      service.changeCartItem('p1', 'set', 3, undefined, undefined, true).subscribe();
      httpMock.expectNone(`${environment.apiUrl}/frontend/cart/item`);

      service.changeCartItem('p1', 'increment', 1).subscribe();

      const only = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/item`);
      expect(only.request.body).toEqual({ product_uid: 'p1', mode: 'set', quantity: 4 });
      only.flush(cartPayload(11, 4));
    });

    it('treats an unrelated 409 as a real failure', (done) => {
      addOneItem();

      service.saveDraftCart().subscribe({
        next: () => done.fail('expected the error to propagate'),
        error: (err) => {
          expect(err.status).toBe(409);
          done();
        }
      });

      const save = httpMock.expectOne(`${environment.apiUrl}/frontend/cart/update`);
      save.flush({ success: false, error: { code: 'CONFLICT' } }, { status: 409, statusText: 'Conflict' });
    });
  });

  describe('order history mapping', () => {
    /**
     * The order detail page reads the individual address fields, not the
     * pre-joined shipping_address. They were declared on the model but never
     * mapped, so a client saw "no address provided" on an order the admin UI
     * showed an address for.
     */
    it('maps the individual delivery address fields', (done) => {
      service.getOrderHistory().subscribe(orders => {
        expect(orders.length).toBe(1);
        expect(orders[0].addressText).toBe('вул. Підгородська, будинок 12');
        expect(orders[0].city).toBe('село Ключарки');
        expect(orders[0].zipcode).toBe('89626');
        expect(orders[0].countryCode).toBe('UA');
        done();
      });

      const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/frontend/orders/history`);
      req.flush({
        success: true,
        data: [{
          uid: 'o1',
          number: 'UA-56',
          client_phase: 'placed',
          items: [],
          total: 1062750,
          address_text: 'вул. Підгородська, будинок 12',
          city: 'село Ключарки',
          zipcode: '89626',
          country_code: 'UA'
        }]
      });
    });

    /**
     * The branch is the legal entity on the invoice. It is a snapshot taken at
     * confirm time, so the order detail page must read it off the order rather
     * than looking the branch up again.
     */
    it('maps the billed-to branch snapshot', (done) => {
      service.getOrderHistory().subscribe(orders => {
        expect(orders[0].branchUid).toBe('branch-7');
        expect(orders[0].branchName).toBe('ФОП Попова Наталія Юріївна');
        expect(orders[0].branchVatNumber).toBe('UA1234567890');
        expect(orders[0].branchBusinessRegistrationNumber).toBe('3456789012');
        done();
      });

      const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/frontend/orders/history`);
      req.flush({
        success: true,
        data: [{
          uid: 'o3',
          number: 'UA-56',
          client_phase: 'placed',
          items: [],
          total: 0,
          branch_uid: 'branch-7',
          branch_name: 'ФОП Попова Наталія Юріївна',
          branch_vat_number: 'UA1234567890',
          branch_business_registration_number: '3456789012'
        }]
      });
    });

    it('leaves the branch undefined when the order is billed to the account', (done) => {
      service.getOrderHistory().subscribe(orders => {
        expect(orders[0].branchUid).toBeUndefined();
        expect(orders[0].branchName).toBeUndefined();
        done();
      });

      const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/frontend/orders/history`);
      req.flush({
        success: true,
        data: [{ uid: 'o4', number: 'UA-58', client_phase: 'placed', items: [], total: 0, branch_uid: '', branch_name: '' }]
      });
    });

    /**
     * The backend stopped sending the internal stage name; an order in a stage
     * nobody mapped to a client phase must map to an empty phase rather than
     * inheriting some default position on the progress track.
     */
    it('maps the client phase, defaulting to empty', (done) => {
      service.getOrderHistory().subscribe(orders => {
        expect(orders[0].clientPhase).toBe('shipped');
        expect(orders[1].clientPhase).toBe('');
        done();
      });

      const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/frontend/orders/history`);
      req.flush({
        success: true,
        data: [
          { uid: 'o5', number: 'UA-59', client_phase: 'shipped', items: [], total: 0 },
          { uid: 'o6', number: 'UA-60', items: [], total: 0 }
        ]
      });
    });

    it('leaves the address fields undefined when the order has no address', (done) => {
      service.getOrderHistory().subscribe(orders => {
        expect(orders[0].addressText).toBeUndefined();
        expect(orders[0].city).toBeUndefined();
        expect(orders[0].zipcode).toBeUndefined();
        expect(orders[0].countryCode).toBeUndefined();
        done();
      });

      const req = httpMock.expectOne(r => r.url === `${environment.apiUrl}/frontend/orders/history`);
      req.flush({
        success: true,
        data: [{
          uid: 'o2',
          number: 'UA-57',
          client_phase: 'placed',
          items: [],
          total: 0,
          address_text: '',
          city: '',
          zipcode: '',
          country_code: ''
        }]
      });
    });
  });
});
