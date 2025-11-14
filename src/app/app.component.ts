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
