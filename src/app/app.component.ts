import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { OrderService } from './core/services/order.service';
import { ProductService } from './core/services/product.service';
import { TranslationService } from './core/services/translation.service';
import { User, Client } from './core/models/user.model';
import { OrderItem } from './core/models/order.model';
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
  cartTotal = 0;
  viewMode: 'grid' | 'bulk' = 'bulk';
  showViewToggle = false;

  constructor(
    private authService: AuthService,
    private orderService: OrderService,
    private productService: ProductService,
    private router: Router,
    public translationService: TranslationService
  ) {
    this.authService.currentEntity$.subscribe(entity => {
      this.currentEntity = entity;
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

    // Show view toggle only on products catalog page
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.showViewToggle = event.url.includes('/products/catalog');
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
    if (this.cartItems.length === 0) {
      return;
    }
    this.showCartPanel = false;
    this.router.navigate(['/products/confirm-order']);
  }

  toggleViewMode(): void {
    this.productService.toggleViewMode();
  }
}
