import { Component } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { OrderService } from './core/services/order.service';
import { ProductService } from './core/services/product.service';
import { User } from './core/models/user.model';
import { OrderItem } from './core/models/order.model';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'B2B Portal';
  currentUser: User | null = null;
  cartItems: OrderItem[] = [];
  showCartPanel = false;
  cartTotal = 0;
  viewMode: 'grid' | 'bulk' = 'bulk';
  showViewToggle = false;

  constructor(
    private authService: AuthService,
    private orderService: OrderService,
    private productService: ProductService,
    private router: Router
  ) {
    this.authService.currentUser.subscribe(user => {
      this.currentUser = user;
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
    this.authService.logout();
    this.router.navigate(['/auth/login']);
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
