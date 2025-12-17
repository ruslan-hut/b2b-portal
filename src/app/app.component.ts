import { Component, ChangeDetectorRef, OnInit, OnDestroy, HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { OrderService } from './core/services/order.service';
import { ProductService } from './core/services/product.service';
import { TranslationService } from './core/services/translation.service';
import { ErrorHandlerService } from './core/services/error-handler.service';
import { NetworkService } from './core/services/network.service';
import { AppSettingsService } from './core/services/app-settings.service';
import { User, Client } from './core/models/user.model';
import { Order, OrderItem, CreateOrderRequest, ShippingAddress, CartAddress } from './core/models/order.model';
import { filter, map } from 'rxjs/operators';
import { Subscription, forkJoin, of } from 'rxjs';
import {Product} from "./core/models/product.model";

// Extended OrderItem interface for cart display with stock validation
interface CartItem extends OrderItem {
  insufficientStock?: boolean;
  availableQuantity?: number;
}

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrl: './app.component.scss',
    standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
  title: string = 'B2B Portal';
  currentEntity: User | Client | null = null;
  entityType: 'user' | 'client' | null = null;
  cartItems: CartItem[] = [];
  showCartPanel = false;
  showOrderDialog = false;
  isOrderSuccess = false; // Track if order was successfully created
  previewOrder: Order | null = null;
  cartTotal = 0;
  cartOriginalTotal = 0;
  cartDiscountAmount = 0;
  cartSubtotal = 0;
  cartVatAmount = 0;
  currentDiscount = 0;
  currentVatRate = 0;
  hasDiscount = false;
  hasVat = false;
  commentSectionExpanded = false;
  viewMode: 'grid' | 'bulk' = 'bulk';
  showViewToggle = false;
  isAuthRoute = false;
  isCreatingOrder = false;
  orderComment = '';
  isOnline = true;
  isUserMenuOpen = false;
  currencyName: string | undefined = undefined;
  // Address for cart
  currentAddress: CartAddress | null = null;
  selectedAddressUid: string | undefined;
  private subscriptions = new Subscription();

  constructor(
    public authService: AuthService,
    private orderService: OrderService,
    private productService: ProductService,
    private router: Router,
    public translationService: TranslationService,
    private errorHandler: ErrorHandlerService,
    private networkService: NetworkService,
    private cdr: ChangeDetectorRef,
    private appSettingsService: AppSettingsService
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

    // Subscribe to AppSettings for currency (loaded from /auth/me endpoint)
    this.subscriptions.add(
      this.appSettingsService.settings$.subscribe(settings => {
        if (settings && settings.currency) {
          this.currencyName = settings.currency.name;
        } else {
          this.currencyName = undefined;
        }
        this.cdr.markForCheck();
      })
    );

    this.subscriptions.add(
      this.orderService.currentOrder$.subscribe(items => {
        this.cartItems = this.sortProductsByName(items);
        this.updateCartTotals();
      })
    );

    // Subscribe to draft order changes to get address data
    this.subscriptions.add(
      this.orderService.currentDraftOrder$.subscribe((order: Order | null) => {
        if (order) {
          this.currentAddress = order.address || null;
          this.selectedAddressUid = order.address?.uid;
        } else {
          this.currentAddress = null;
          this.selectedAddressUid = undefined;
        }
        this.cdr.markForCheck();
      })
    );

    // Subscribe to client changes for discount/VAT
    this.subscriptions.add(
      this.authService.currentEntity$.subscribe(entity => {
        if (this.authService.entityTypeValue === 'client') {
          const client = entity as Client;
          this.currentDiscount = client.discount || 0;
          this.hasDiscount = this.currentDiscount > 0;

          // Use effective_vat_rate from AppSettings (pre-calculated by backend)
          // This already handles the logic: client.vat_rate if VAT number exists,
          // otherwise store.default_vat_rate
          this.currentVatRate = this.appSettingsService.getEffectiveVatRate();
          this.hasVat = this.currentVatRate > 0;

          // Recalculate all cart items with new discount/VAT
          this.orderService.recalculateCartWithCurrentDiscount();
          this.updateCartTotals();
        } else {
          this.currentDiscount = 0;
          this.currentVatRate = 0;
          this.hasDiscount = false;
          this.hasVat = false;
          // Recalculate all cart items (no discount)
          this.orderService.recalculateCartWithCurrentDiscount();
          this.updateCartTotals();
        }
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

    sortProductsByName(products: CartItem[]): CartItem[] {
        return products.sort((a, b) => {

            // Then sort by sortOrder (lower numbers first)
            const aSortOrder = a.sortOrder ?? 999999;
            const bSortOrder = b.sortOrder ?? 999999;
            if (aSortOrder !== bSortOrder) {
                return aSortOrder - bSortOrder;
            }

            // Finally sort by name
            return a.productName.localeCompare(b.productName);
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

  /**
   * Check if current user has admin or manager role
   * @returns true if user has admin or manager role
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

  toggleCartPanel(): void {
    this.showCartPanel = !this.showCartPanel;
  }

  removeFromCart(productId: string): void {
    // Remove from local state
    this.orderService.removeFromCart(productId);

    // Persist to backend - sends complete cart state
    this.orderService.saveDraftCart(undefined, this.orderComment).subscribe({
      next: () => {
        console.log(`Product ${productId} removed from cart.`);
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error(`Error saving cart after removing product ${productId}:`, error);
        // Item is removed locally, but backend sync failed
        // Optionally show a warning to user
      }
    });
  }

  updateQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    // Update local state immediately for responsive UI
    this.orderService.updateCartItemQuantity(productId, quantity);

    // Persist the change by saving the draft cart (creates draft on server if none exists)
    this.orderService.saveDraftCart(undefined, this.orderComment).subscribe({
      next: () => {
        // Saved draft successfully - ensure view updates
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to save draft cart after quantity change:', err);
        // Optionally inform the user
        // alert('Failed to save cart changes. They will be kept locally.');
      }
    });
  }

  /**
   * Handle address change from cart-address component
   */
  onAddressChange(addressUid: string): void {
    if (!addressUid) return;

    this.selectedAddressUid = addressUid;

    // Save the draft with the new address
    if (this.cartItems.length > 0) {
      this.orderService.saveDraftCart(addressUid).subscribe({
        next: (order) => {
          console.log('[Cart Address Change] Cart saved with new address:', order.address);
          // Update totals from response
          this.updateCartTotals();
        },
        error: (err) => {
          console.error('[Cart Address Change] Failed to save cart with new address:', err);
        }
      });
    }
  }

  /**
   * Check if cart has a selected address
   */
  hasSelectedAddress(): boolean {
    return !!this.currentAddress;
  }

  proceedToCheckout(): void {
    if (this.cartItems.length === 0 || this.isCreatingOrder) {
      return;
    }

    this.isCreatingOrder = true;
    // Close cart panel before showing dialog
    this.showCartPanel = false;
    // Show dialog immediately with loading state
    this.showOrderDialog = true;

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

    // Create order directly - backend validates stock and creates order
    this.orderService.createOrder(orderRequest, 'new').subscribe({
      next: (order) => {
        this.isCreatingOrder = false;
        // Update cart total from created order for display in success dialog
        this.cartTotal = order.totalAmount || this.cartTotal;
        // Show success state in dialog
        this.isOrderSuccess = true;
        // Wait a moment to let user see the success message, then complete
        setTimeout(() => {
          this.onOrderConfirmed();
        }, 1500);
      },
      error: (error) => {
        this.isCreatingOrder = false;
        console.error('Error creating order:', error);

        // Close dialog and show error
        this.closeOrderDialog();

        // Show user-friendly error message
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
    // Read store UID from current entity (user or client)
    const currentUser = this.getUserData();
    const currentClient = this.getClientData();
    const storeUid = currentUser?.store_uid || currentClient?.store_uid;

    // Create an array of observables to fetch available quantities for the user's store
    const stockChecks = this.cartItems.map(item =>
      this.productService.getAvailableQuantity(item.productId, storeUid).pipe(
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

  onOrderConfirmed(): void {
    // Called after order is successfully confirmed
    // Clear cart and local cache
    this.orderService.clearCart();
    this.orderComment = ''; // Clear comment after order is created
    this.previewOrder = null;
    // Close cart panel
    this.showCartPanel = false;
    // Close and reset dialog
    this.closeOrderDialog();
    // Navigate to order history
    this.router.navigate(['/orders/history']);
  }

  closeOrderDialog(): void {
    this.showOrderDialog = false;
    this.isOrderSuccess = false;
    this.isCreatingOrder = false;
  }

  toggleViewMode(): void {
    this.productService.toggleViewMode();
  }

  /**
   * Update cart totals with VAT breakdown
   */
  updateCartTotals(): void {
    this.subscriptions.add(
      this.orderService.getCartTotalsBreakdown().subscribe(breakdown => {
        this.cartOriginalTotal = breakdown.originalTotal;
        this.cartDiscountAmount = breakdown.discountAmount;
        this.cartSubtotal = breakdown.subtotal;
        this.cartVatAmount = breakdown.vatAmount;
        this.cartTotal = breakdown.total;
        this.currentDiscount = breakdown.discountPercent;
        this.currentVatRate = breakdown.vatRate;
        this.hasDiscount = breakdown.hasDiscount;
        this.hasVat = breakdown.hasVat;
        this.cdr.markForCheck();
      })
    );
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
