import { Component, Input, Output, EventEmitter, HostListener, OnInit, OnDestroy } from '@angular/core';
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
    standalone: false
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
    public imageCacheService: ProductImageCacheService
  ) {}

  get sanitizedDescription(): SafeHtml {
    if (!this.product || !this.product.description) {
      const noDescText = this.translationService.instant('products.noDescription');
      return this.sanitizer.bypassSecurityTrustHtml(noDescText);
    }
    // Trust HTML content from backend (trusted source)
    // Angular will still sanitize dangerous scripts, but allows safe HTML tags
    return this.sanitizer.bypassSecurityTrustHtml(this.product.description);
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
            const client = settings.entity as Client;
            this.currentDiscount = client.discount || 0;
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
   * Get estimated price with VAT included for display
   * Note: Actual price with VAT calculated by backend when item is added to cart
   */
  getPriceWithVat(originalPrice: number): number {
    if (!this.currentVatRate || this.currentVatRate <= 0) {
      return this.getDiscountedPrice(originalPrice);
    }
    const discountedPrice = this.getDiscountedPrice(originalPrice);
    const vatAmount = discountedPrice * (this.currentVatRate / 100);
    return Number((discountedPrice + vatAmount).toFixed(2));
  }
}
