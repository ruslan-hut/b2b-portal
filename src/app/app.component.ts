import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { OrderService } from './core/services/order.service';
import { ProductService } from './core/services/product.service';
import { TranslationService } from './core/services/translation.service';
import { NetworkService } from './core/services/network.service';
import { PageTitleService } from './core/services/page-title.service';
import { BrandingService } from './core/services/branding.service';
import { User, Client, KNOWN_ROLES } from './core/models/user.model';
import { OrderItem } from './core/models/order.model';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)'
  }
})
export class AppComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly orderService = inject(OrderService);
  private readonly productService = inject(ProductService);
  private readonly router = inject(Router);
  readonly translationService = inject(TranslationService);
  private readonly networkService = inject(NetworkService);
  private readonly pageTitleService = inject(PageTitleService);
  private readonly brandingService = inject(BrandingService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  title = this.brandingService.siteName;
  pageTitle = '';
  currentEntity: User | Client | null = null;
  entityType: 'user' | 'client' | null = null;
  cartItems: OrderItem[] = [];
  viewMode: 'grid' | 'bulk' = 'bulk';
  showViewToggle = false;
  isAuthRoute = false;
  isAdminRoute = false;
  isOnline = true;
  isUserMenuOpen = false;

  constructor() {
    this.authService.currentEntity$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(entity => {
        this.currentEntity = entity;
        this.cdr.markForCheck();
      });

    this.authService.entityType$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(type => {
        this.entityType = type;
      });

    this.orderService.currentOrder$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(items => {
        this.cartItems = items;
        this.cdr.markForCheck();
      });

    this.productService.viewMode$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(mode => {
        this.viewMode = mode;
      });

    this.isAuthRoute = this.router.url.includes('/auth');
    this.isAdminRoute = this.router.url.includes('/admin');

    this.router.events
      .pipe(
        filter(event => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(event => {
        const navEvent = event as NavigationEnd;
        this.showViewToggle = navEvent.url.includes('/products/catalog');
        this.isAuthRoute = navEvent.url.includes('/auth');
        this.isAdminRoute = navEvent.url.includes('/admin');
      });
  }

  ngOnInit(): void {
    this.brandingService.siteName$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(name => {
        this.title = name;
        this.cdr.markForCheck();
      });

    this.networkService.isOnline$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(isOnline => {
        this.isOnline = isOnline;
        this.cdr.markForCheck();
      });

    this.pageTitleService.title$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(title => {
        this.pageTitle = title;
        this.cdr.markForCheck();
      });
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/auth/login']);
      },
      error: error => {
        console.error('Logout error:', error);
        this.router.navigate(['/auth/login']);
      }
    });
  }

  getDisplayName(): string {
    if (!this.currentEntity) return '';
    if (this.entityType === 'user') {
      const user = this.currentEntity as User;
      return `${user.first_name} ${user.last_name}`;
    }
    const client = this.currentEntity as Client;
    return client.name;
  }

  getUserData(): User | null {
    return this.entityType === 'user' ? this.currentEntity as User : null;
  }

  getClientData(): Client | null {
    return this.entityType === 'client' ? this.currentEntity as Client : null;
  }

  /**
   * Whether to offer the "Admin Zone" link out of the client area.
   *
   * Every staff role gets it, content editors included: they browse the client
   * catalog and Partner Resources to see what a client sees, and without this
   * link the only way back to the content zone is the URL bar. It mirrors
   * `adminZoneGuard`, which decides who may render the admin chrome — where the
   * link lands is then resolved per role by `adminLandingRedirect`.
   */
  hasAdminAccess(): boolean {
    if (this.entityType !== 'user' || !this.currentEntity) {
      return false;
    }
    return KNOWN_ROLES.includes((this.currentEntity as User).role as typeof KNOWN_ROLES[number]);
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

  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const clickedInside = target.closest('.user-menu-wrapper');
    if (!clickedInside && this.isUserMenuOpen) {
      this.closeUserMenu();
    }
  }
}
