import { Component, ChangeDetectorRef, ChangeDetectionStrategy, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { OrderService } from '../../core/services/order.service';
import { AuthService } from '../../core/services/auth.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { ErrorHandlerService } from '../../core/services/error-handler.service';
import { Order, OrderItem, CreateOrderRequest, ShippingAddress, CartAddress } from '../../core/models/order.model';
import { User, Client } from '../../core/models/user.model';

// Extended OrderItem interface for cart display with stock validation
interface CartItem extends OrderItem {
  insufficientStock?: boolean;
  availableQuantity?: number;
}

@Component({
  selector: 'app-cart-page',
  templateUrl: './cart-page.component.html',
  styleUrls: ['./cart-page.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CartPageComponent implements OnInit, OnDestroy {
  cartItems: CartItem[] = [];
  cartTotal = 0;
  cartOriginalTotal = 0;
  cartDiscountAmount = 0;
  cartSubtotal = 0;
  cartVatAmount = 0;
  currentDiscount = 0;
  currentVatRate = 0;
  hasDiscount = false;
  hasVat = false;
  orderComment = '';
  commentSectionExpanded = false;
  isCreatingOrder = false;
  showOrderDialog = false;
  isOrderSuccess = false;
  currencyName: string | undefined = undefined;

  // Address for cart
  currentAddress: CartAddress | null = null;
  selectedAddressUid: string | undefined;

  // Entity info
  entityType: 'user' | 'client' | null = null;
  currentEntity: User | Client | null = null;

  // Mobile expandable cards state
  expandedItems: Set<string> = new Set();

  // Mobile "show more" state
  showAllMobileItems = false;
  readonly mobileItemsLimit = 5;

  private subscriptions = new Subscription();

  constructor(
    private orderService: OrderService,
    private authService: AuthService,
    private appSettingsService: AppSettingsService,
    private errorHandler: ErrorHandlerService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to entity type
    this.subscriptions.add(
      this.authService.entityType$.subscribe(type => {
        this.entityType = type;
      })
    );

    // Subscribe to current entity
    this.subscriptions.add(
      this.authService.currentEntity$.subscribe(entity => {
        this.currentEntity = entity;
        if (this.authService.entityTypeValue === 'client') {
          const client = entity as Client;
          this.currentDiscount = client?.discount || 0;
          this.hasDiscount = this.currentDiscount > 0;
          this.currentVatRate = this.appSettingsService.getEffectiveVatRate();
          this.hasVat = this.currentVatRate > 0;
        } else {
          this.currentDiscount = 0;
          this.currentVatRate = 0;
          this.hasDiscount = false;
          this.hasVat = false;
        }
        this.cdr.markForCheck();
      })
    );

    // Subscribe to AppSettings for currency
    this.subscriptions.add(
      this.appSettingsService.settings$.subscribe(settings => {
        if (settings?.currency) {
          this.currencyName = settings.currency.name;
        } else {
          this.currencyName = undefined;
        }
        this.cdr.markForCheck();
      })
    );

    // Subscribe to cart items
    this.subscriptions.add(
      this.orderService.currentOrder$.subscribe(items => {
        this.cartItems = this.sortProductsByName(items.map(item => ({
          ...item,
          insufficientStock: item.availableQuantity !== undefined && item.quantity > item.availableQuantity,
          availableQuantity: item.availableQuantity
        })));
        this.updateCartTotals();
      })
    );

    // Subscribe to draft order changes to get address data
    this.subscriptions.add(
      this.orderService.currentDraftOrder$.subscribe((order: Order | null) => {
        if (order) {
          this.currentAddress = order.address || null;
          this.selectedAddressUid = order.address?.uid;
          this.orderComment = order.comment || '';
        } else {
          this.currentAddress = null;
          this.selectedAddressUid = undefined;
        }
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  sortProductsByName(products: CartItem[]): CartItem[] {
    return products.sort((a, b) => {
      const aSortOrder = a.sortOrder ?? 999999;
      const bSortOrder = b.sortOrder ?? 999999;
      if (aSortOrder !== bSortOrder) {
        return aSortOrder - bSortOrder;
      }
      return a.productName.localeCompare(b.productName);
    });
  }

  removeFromCart(productId: string): void {
    this.orderService.removeFromCart(productId);

    // Check if cart is now empty after removing the item
    const remainingItems = this.orderService.getCartItems();

    if (remainingItems.length === 0) {
      // Cart is empty - delete the draft order from backend
      this.orderService.deleteDraftCart().subscribe({
        next: () => {
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error(`Error deleting draft cart after removing last product:`, error);
        }
      });
    } else {
      // Cart still has items - save the updated cart
      this.orderService.saveDraftCart(undefined, this.orderComment).subscribe({
        next: () => {
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error(`Error saving cart after removing product ${productId}:`, error);
        }
      });
    }
  }

  updateQuantity(productId: string, quantity: number): void {
    if (quantity <= 0) {
      this.removeFromCart(productId);
      return;
    }

    this.orderService.updateCartItemQuantity(productId, quantity);
    this.orderService.saveDraftCart(undefined, this.orderComment).subscribe({
      next: () => {
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to save draft cart after quantity change:', err);
      }
    });
  }

  onAddressChange(addressUid: string): void {
    if (!addressUid) return;

    this.selectedAddressUid = addressUid;

    if (this.cartItems.length > 0) {
      this.orderService.saveDraftCart(addressUid).subscribe({
        next: () => {
          this.updateCartTotals();
        },
        error: (err) => {
          console.error('[Cart Address Change] Failed to save cart with new address:', err);
        }
      });
    }
  }

  hasSelectedAddress(): boolean {
    return !!this.currentAddress;
  }

  get hasInsufficientStock(): boolean {
    return this.cartItems.some(item => item.insufficientStock);
  }

  proceedToCheckout(): void {
    if (this.cartItems.length === 0 || this.isCreatingOrder) {
      return;
    }

    this.isCreatingOrder = true;
    this.showOrderDialog = true;

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

    this.orderService.createOrder(orderRequest, 'new').subscribe({
      next: (order) => {
        this.isCreatingOrder = false;
        this.cartTotal = order.totalAmount || this.cartTotal;
        this.isOrderSuccess = true;
        setTimeout(() => {
          this.onOrderConfirmed();
        }, 1500);
      },
      error: (error) => {
        this.isCreatingOrder = false;
        console.error('Error creating order:', error);
        this.closeOrderDialog();
        const errorMessage = this.errorHandler.getOrderErrorMessage(error);
        alert(errorMessage);
      }
    });
  }

  onOrderConfirmed(): void {
    this.orderService.clearCart();
    this.orderComment = '';
    this.closeOrderDialog();
    this.router.navigate(['/orders/history']);
  }

  closeOrderDialog(): void {
    this.showOrderDialog = false;
    this.isOrderSuccess = false;
    this.isCreatingOrder = false;
  }

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

  goBack(): void {
    this.router.navigate(['/products/catalog']);
  }

  getUserData(): User | null {
    return this.entityType === 'user' ? this.currentEntity as User : null;
  }

  getClientData(): Client | null {
    return this.entityType === 'client' ? this.currentEntity as Client : null;
  }

  // Mobile expandable card methods
  toggleItemExpanded(productId: string): void {
    if (this.expandedItems.has(productId)) {
      this.expandedItems.delete(productId);
    } else {
      this.expandedItems.add(productId);
    }
  }

  isItemExpanded(productId: string): boolean {
    return this.expandedItems.has(productId);
  }

  // Mobile "show more" methods
  get visibleMobileItems(): CartItem[] {
    if (this.showAllMobileItems || this.cartItems.length <= this.mobileItemsLimit) {
      return this.cartItems;
    }
    return this.cartItems.slice(0, this.mobileItemsLimit);
  }

  get hasMoreMobileItems(): boolean {
    return this.cartItems.length > this.mobileItemsLimit;
  }

  get remainingMobileItemsCount(): number {
    return this.cartItems.length - this.mobileItemsLimit;
  }

  toggleShowAllMobileItems(): void {
    this.showAllMobileItems = !this.showAllMobileItems;
  }
}
