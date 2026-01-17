import { Component, Input, Output, EventEmitter, HostListener, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Product } from '../../core/models/product.model';
import { Currency } from '../../core/models/currency.model';
import { Client } from '../../core/models/user.model';
import { TranslationService } from '../../core/services/translation.service';
import { CurrencyService } from '../../core/services/currency.service';
import { AuthService } from '../../core/services/auth.service';
import { PriceFormattingService } from '../../core/services/price-formatting.service';
import { StoreService } from '../../core/services/store.service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { ProductImageCacheService } from '../../core/services/product-image-cache.service';

@Component({
    selector: 'app-product-details-overlay',
    templateUrl: './product-details-overlay.component.html',
    styleUrl: './product-details-overlay.component.scss',
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductDetailsOverlayComponent implements OnInit, OnDestroy {
  @Input() product: Product | null = null;
  @Output() closed = new EventEmitter<void>();

  currency: Currency | null = null;
  currencyName: string | undefined = undefined;

  // Client discount and VAT rates
  currentDiscount: number = 0;
  currentVatRate: number = 0;

  private destroy$ = new Subject<void>();

  constructor(
    public translationService: TranslationService,
    private currencyService: CurrencyService,
    private authService: AuthService,
    private sanitizer: DomSanitizer,
    private priceFormattingService: PriceFormattingService,
    private storeService: StoreService,
    private appSettingsService: AppSettingsService,
    public imageCacheService: ProductImageCacheService,
    private cdr: ChangeDetectorRef
  ) {}

  get sanitizedDescription(): SafeHtml {
    if (!this.product || !this.product.description) {
      const noDescText = this.translationService.instant('products.noDescription');
      // Plain text doesn't need sanitization bypass
      return noDescText;
    }
    // Use Angular's built-in sanitization to prevent XSS attacks
    // This allows safe HTML tags (b, i, p, br, etc.) while blocking dangerous content
    // (script tags, event handlers, javascript: URLs, etc.)
    return this.sanitizer.sanitize(SecurityContext.HTML, this.product.description) || '';
  }

  ngOnInit(): void {
    // Prevent body scroll when overlay is open
    document.body.style.overflow = 'hidden';

    // Subscribe to AppSettings for currency, discount, and VAT rates
    this.appSettingsService.settings$
      .pipe(takeUntil(this.destroy$))
      .subscribe(settings => {
        if (settings) {
          // Set currency from AppSettings
          if (settings.currency) {
            this.currency = settings.currency;
            this.currencyName = settings.currency.name;
          }

          // Set discount and VAT rate for clients
          if (settings.entity_type === 'client') {
            // Use calculated discount from discount_info (backend-computed based on discount mode)
            this.currentDiscount = settings.discount_info?.current_discount || 0;
            // Use effective VAT rate from AppSettings (already calculated by backend)
            this.currentVatRate = settings.effective_vat_rate || 0;
          } else {
            this.currentDiscount = 0;
            this.currentVatRate = 0;
          }
        } else {
          // No settings available
          this.currency = null;
          this.currencyName = undefined;
          this.currentDiscount = 0;
          this.currentVatRate = 0;
        }
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    // Restore body scroll when overlay is closed
    document.body.style.overflow = '';
    
    // Complete all subscriptions to prevent memory leaks
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown.escape')
  handleEscapeKey(): void {
    this.onClose();
  }

  onClose(): void {
    this.closed.emit();
  }

  onOverlayClick(event: Event): void {
    // Close overlay when clicking on backdrop
    if ((event.target as HTMLElement).classList.contains('overlay-backdrop')) {
      this.onClose();
    }
  }

  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/images/product-placeholder.svg';
  }

  /**
   * Get product image URL (from cache or placeholder)
   */
  getProductImageUrl(): string {
    if (!this.product) {
      return this.imageCacheService.getPlaceholderUrl();
    }
    // First check if we have a cached image from the database
    if (this.imageCacheService.hasImageUrl(this.product.id)) {
      return this.imageCacheService.getImageUrl(this.product.id);
    }
    // Fall back to imageUrl from product data (URL-based images)
    if (this.product.imageUrl) {
      return this.product.imageUrl;
    }
    // Default placeholder
    return this.imageCacheService.getPlaceholderUrl();
  }

  /**
   * Get discounted price for display
   * Note: Actual discounted price is calculated by backend when item is added to cart.
   * This shows estimated discounted price based on client discount rate.
   */
  getDiscountedPrice(originalPrice: number): number {
    if (!this.currentDiscount || this.currentDiscount <= 0) {
      return originalPrice;
    }
    // Show estimated discounted price (backend will calculate exact value when added to cart)
    const discountMultiplier = 1 - (this.currentDiscount / 100);
    return Number((originalPrice * discountMultiplier).toFixed(2));
  }

  /**
   * Check if current client has discount
   */
  hasDiscount(): boolean {
    return this.currentDiscount > 0;
  }

  /**
   * Get estimated savings amount for display
   * Note: Actual savings calculated by backend when item is added to cart
   */
  getSavingsAmount(originalPrice: number): number {
    if (!this.currentDiscount || this.currentDiscount <= 0) {
      return 0;
    }
    const discountedPrice = this.getDiscountedPrice(originalPrice);
    return Number((originalPrice - discountedPrice).toFixed(2));
  }

  /**
   * Get original price with VAT (no discount applied) for display
   * Uses backend-calculated priceWithVat from the product object
   */
  getOriginalPriceWithVat(): number {
    if (!this.product) {
      return 0;
    }
    const productWithPrices = this.product as Product & { priceWithVat?: number };
    if (productWithPrices.priceWithVat !== undefined) {
      return productWithPrices.priceWithVat;
    }
    return this.product.price;
  }

  /**
   * Get price with VAT for display
   * Uses backend-calculated prices from the product object
   * When no discount, returns original price with VAT
   * When discount exists, returns discounted price with VAT
   */
  getPriceWithVat(originalPrice: number): number {
    if (!this.product) {
      return originalPrice;
    }

    const productWithPrices = this.product as Product & { priceFinal?: number; priceWithVat?: number };

    // If no discount, return original price with VAT
    if (!this.hasDiscount()) {
      if (productWithPrices.priceWithVat !== undefined) {
        return productWithPrices.priceWithVat;
      }
      return originalPrice;
    }

    // With discount, return discounted price with VAT
    if (productWithPrices.priceFinal !== undefined) {
      return productWithPrices.priceFinal;
    }

    // Fallback to original price
    return originalPrice;
  }
}
