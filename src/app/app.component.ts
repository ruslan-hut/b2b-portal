import { Component, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { OrderService } from './core/services/order.service';
import { ProductService } from './core/services/product.service';
import { TranslationService } from './core/services/translation.service';
import { ErrorHandlerService } from './core/services/error-handler.service';
import { NetworkService } from './core/services/network.service';
import { User, Client } from './core/models/user.model';
import { OrderItem, CreateOrderRequest, ShippingAddress } from './core/models/order.model';
import { filter, map } from 'rxjs/operators';
import { Subscription, forkJoin, of } from 'rxjs';

// Extended OrderItem interface for cart display with stock validation
interface CartItem extends OrderItem {
  insufficientStock?: boolean;
  availableQuantity?: number;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  title = 'DARK B2B';
  currentEntity: User | Client | null = null;
  entityType: 'user' | 'client' | null = null;
  cartItems: CartItem[] = [];
  showCartPanel = false;
  showOrderDialog = false;
  cartTotal = 0;
  viewMode: 'grid' | 'bulk' = 'bulk';
  showViewToggle = false;
  isAuthRoute = false;
  isCreatingOrder = false;
  orderComment = '';
  isOnline = true;
  private subscriptions = new Subscription();

  constructor(
    public authService: AuthService,
    private orderService: OrderService,
    private productService: ProductService,
    private router: Router,
    public translationService: TranslationService,
    private errorHandler: ErrorHandlerService,
    private networkService: NetworkService,
    private cdr: ChangeDetectorRef
  ) {
    this.subscriptions.add(
      this.authService.currentEntity$.subscribe(entity => {
        this.currentEntity = entity;
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.add(
      this.authService.entityType$.subscribe(type => {
        this.entityType = type;
      })
    );

    this.subscriptions.add(
      this.orderService.currentOrder$.subscribe(items => {
        this.cartItems = items;
        this.cartTotal = this.orderService.getCartTotal();
      })
    );

    this.subscriptions.add(
      this.productService.viewMode$.subscribe(mode => {
        this.viewMode = mode;
      })
    );

    // Initialize auth route check
    this.isAuthRoute = this.router.url.includes('/auth');

    // Show view toggle only on products catalog page
    // Also track if we're on auth route
    this.subscriptions.add(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe((event) => {
        const navEvent = event as NavigationEnd;
        this.showViewToggle = navEvent.url.includes('/products/catalog');
        this.isAuthRoute = navEvent.url.includes('/auth');
      })
    );
  }

  ngOnInit(): void {
    // Subscribe to network status
    this.subscriptions.add(
      this.networkService.isOnline$.subscribe(isOnline => {
        this.isOnline = isOnline;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
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

  /**
   * Get display name for current entity
   * @returns Display name string
   */
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

  /**
   * Get user data if entity type is user
   * @returns User object or null
   */
  getUserData(): User | null {
    return this.entityType === 'user' ? this.currentEntity as User : null;
  }

  /**
   * Get client data if entity type is client
   * @returns Client object or null
   */
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

    // Validate stock availability for all cart items
    this.validateCartStock().subscribe({
      next: (hasInsufficientStock) => {
        if (hasInsufficientStock) {
          // Stop order creation and keep the validation results visible
          this.isCreatingOrder = false;
          this.cdr.markForCheck();
          return;
        }

        // All items have sufficient stock, proceed with order creation
        this.createOrder();
      },
      error: (error) => {
        this.isCreatingOrder = false;
        console.error('Error validating stock:', error);
        const errorMessage = this.errorHandler.getOrderErrorMessage(error);
        alert(errorMessage);
      }
    });
  }

  /**
   * Validate stock availability for all items in cart
   * Returns Observable<boolean> - true if any items have insufficient stock
   */
  private validateCartStock() {
    // Create an array of observables to fetch available quantities
    const stockChecks = this.cartItems.map(item =>
      this.productService.getAvailableQuantity(item.productId).pipe(
        map(availableQty => ({
          productId: item.productId,
          requestedQty: item.quantity,
          availableQty: availableQty
        }))
      )
    );

    return forkJoin(stockChecks).pipe(
      map(results => {
        let hasInsufficientStock = false;

        // Update cart items with stock validation results
        this.cartItems = this.cartItems.map(item => {
          const stockInfo = results.find(r => r.productId === item.productId);
          if (stockInfo) {
            const insufficient = stockInfo.requestedQty > stockInfo.availableQty;
            if (insufficient) {
              hasInsufficientStock = true;
            }
            return {
              ...item,
              insufficientStock: insufficient,
              availableQuantity: stockInfo.availableQty
            };
          }
          return item;
        });

        return hasInsufficientStock;
      })
    );
  }

  /**
   * Create order after stock validation passes
   */
  private createOrder(): void {
    // Create order with default/empty shipping address
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

    // Check if there's a current draft - if so, update it instead of creating new order
    const draftUid = this.orderService.getCurrentDraftUid();

    this.orderService.createOrder(orderRequest, 'new', draftUid).subscribe({
      next: () => {
        this.isCreatingOrder = false;
        // Clear the draft UID since it's now confirmed
        this.orderService.clearDraftUid();
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
    this.orderComment = ''; // Clear comment after order is created
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
