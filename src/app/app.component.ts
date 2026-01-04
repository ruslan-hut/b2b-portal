import { Component, ChangeDetectorRef, ChangeDetectionStrategy, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { OrderService } from './core/services/order.service';
import { ProductService } from './core/services/product.service';
import { TranslationService } from './core/services/translation.service';
import { NetworkService } from './core/services/network.service';
import { User, Client } from './core/models/user.model';
import { OrderItem } from './core/models/order.model';
import { filter } from 'rxjs/operators';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit, OnDestroy {
  title: string = 'B2B Portal';
  currentEntity: User | Client | null = null;
  entityType: 'user' | 'client' | null = null;
  cartItems: OrderItem[] = [];
  viewMode: 'grid' | 'bulk' = 'bulk';
  showViewToggle = false;
  isAuthRoute = false;
  isAdminRoute = false;
  isOnline = true;
  isUserMenuOpen = false;
  private subscriptions = new Subscription();

  constructor(
    public authService: AuthService,
    private orderService: OrderService,
    private productService: ProductService,
    private router: Router,
    public translationService: TranslationService,
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

    // Subscribe to cart items for count display in header
    this.subscriptions.add(
      this.orderService.currentOrder$.subscribe(items => {
        this.cartItems = items;
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.add(
      this.productService.viewMode$.subscribe(mode => {
        this.viewMode = mode;
      })
    );

    // Initialize route checks
    this.isAuthRoute = this.router.url.includes('/auth');
    this.isAdminRoute = this.router.url.includes('/admin');

    // Show view toggle only on products catalog page
    // Also track if we're on auth or admin routes
    this.subscriptions.add(
      this.router.events.pipe(
        filter(event => event instanceof NavigationEnd)
      ).subscribe((event) => {
        const navEvent = event as NavigationEnd;
        this.showViewToggle = navEvent.url.includes('/products/catalog');
        this.isAuthRoute = navEvent.url.includes('/auth');
        this.isAdminRoute = navEvent.url.includes('/admin');
      })
    );
  }

  ngOnInit(): void {
    // Set application title from document title (configured at build time)
    this.title = document.title || 'B2B Portal';

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
   */
  getUserData(): User | null {
    return this.entityType === 'user' ? this.currentEntity as User : null;
  }

  /**
   * Get client data if entity type is client
   */
  getClientData(): Client | null {
    return this.entityType === 'client' ? this.currentEntity as Client : null;
  }

  /**
   * Check if current user has admin or manager role
   */
  hasAdminAccess(): boolean {
    if (this.entityType !== 'user' || !this.currentEntity) {
      return false;
    }
    const user = this.currentEntity as User;
    return user.role === 'admin' || user.role === 'manager';
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }

  toggleViewMode(): void {
    this.productService.toggleViewMode();
  }

  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
  }

  closeUserMenu(): void {
    this.isUserMenuOpen = false;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const clickedInside = target.closest('.user-menu-wrapper');
    if (!clickedInside && this.isUserMenuOpen) {
      this.closeUserMenu();
    }
  }
}
