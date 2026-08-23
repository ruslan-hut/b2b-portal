import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnDestroy, OnInit, SecurityContext, inject, input, output } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Product } from '../../core/models/product.model';
import { Currency } from '../../core/models/currency.model';
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'handleEscapeKey()'
  }
})
export class ProductDetailsOverlayComponent implements OnInit, OnDestroy {
  readonly translationService = inject(TranslationService);
  private readonly currencyService = inject(CurrencyService);
  private readonly authService = inject(AuthService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly priceFormattingService = inject(PriceFormattingService);
  private readonly storeService = inject(StoreService);
  private readonly appSettingsService = inject(AppSettingsService);
  readonly imageCacheService = inject(ProductImageCacheService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly product = input<Product | null>(null);
  readonly closed = output<void>();

  currency: Currency | null = null;
  currencyName: string | undefined = undefined;

  // Client discount and VAT rates
  currentDiscount = 0;
  currentVatRate = 0;

  get sanitizedDescription(): SafeHtml {
    const product = this.product();
    if (!product || !product.description) {
      return this.translationService.instant('products.noDescription');
    }
    // Angular sanitization to prevent XSS — allows safe HTML tags
    // (b, i, p, br, …) while blocking script/handlers/javascript: URLs.
    return this.sanitizer.sanitize(SecurityContext.HTML, product.description) || '';
  }

  /** ISO codes the product is certified for, empty when there are none. */
  get certifiedCountries(): string[] {
    return this.product()?.certifiedCountries ?? [];
  }

  /** True when the product carries a certificate valid for every destination. */
  get certifiedAnyCountry(): boolean {
    return this.product()?.certifiedAnyCountry === true;
  }

  /**
   * Whether to render the certification block at all. Products in installs that
   * do not use certification data have neither flag, and the section stays hidden
   * rather than showing an empty list.
   */
  get hasCertificationInfo(): boolean {
    return this.certifiedAnyCountry || this.certifiedCountries.length > 0;
  }

  ngOnInit(): void {
    document.body.style.overflow = 'hidden';

    this.appSettingsService.settings$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(settings => {
        if (settings) {
          if (settings.currency) {
            this.currency = settings.currency;
            this.currencyName = settings.currency.name;
          }
          if (settings.entity_type === 'client') {
            this.currentDiscount = settings.discount_info?.current_discount || 0;
            this.currentVatRate = settings.effective_vat_rate || 0;
          } else {
            this.currentDiscount = 0;
            this.currentVatRate = 0;
          }
        } else {
          this.currency = null;
          this.currencyName = undefined;
          this.currentDiscount = 0;
          this.currentVatRate = 0;
        }
        this.cdr.markForCheck();
      });
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  handleEscapeKey(): void {
    this.onClose();
  }

  onClose(): void {
    this.closed.emit();
  }

  onOverlayClick(event: Event): void {
    if ((event.target as HTMLElement).classList.contains('overlay-backdrop')) {
      this.onClose();
    }
  }

  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/images/product-placeholder.svg';
  }

  getProductImageUrl(): string {
    const product = this.product();
    if (!product) {
      return this.imageCacheService.getPlaceholderUrl();
    }
    if (this.imageCacheService.hasImageUrl(product.id)) {
      return this.imageCacheService.getImageUrl(product.id);
    }
    if (product.imageUrl) {
      return product.imageUrl;
    }
    return this.imageCacheService.getPlaceholderUrl();
  }

  getDiscountedPrice(originalPrice: number): number {
    if (!this.currentDiscount || this.currentDiscount <= 0) {
      return originalPrice;
    }
    const discountMultiplier = 1 - (this.currentDiscount / 100);
    return Number((originalPrice * discountMultiplier).toFixed(2));
  }

  hasDiscount(): boolean {
    return this.currentDiscount > 0;
  }

  getSavingsAmount(originalPrice: number): number {
    if (!this.currentDiscount || this.currentDiscount <= 0) {
      return 0;
    }
    const discountedPrice = this.getDiscountedPrice(originalPrice);
    return Number((originalPrice - discountedPrice).toFixed(2));
  }

  getOriginalPriceWithVat(): number {
    const product = this.product();
    if (!product) {
      return 0;
    }
    const productWithPrices = product as Product & { priceWithVat?: number };
    if (productWithPrices.priceWithVat !== undefined) {
      return productWithPrices.priceWithVat;
    }
    return product.price;
  }

  getVatRate(): number {
    const product = this.product();
    if (product?.vatRate !== undefined) {
      return product.vatRate;
    }
    return this.currentVatRate;
  }

  getPriceWithVat(originalPrice: number): number {
    const product = this.product();
    if (!product) {
      return originalPrice;
    }

    const productWithPrices = product as Product & { priceFinal?: number; priceWithVat?: number };

    if (!this.hasDiscount()) {
      if (productWithPrices.priceWithVat !== undefined) {
        return productWithPrices.priceWithVat;
      }
      return originalPrice;
    }

    if (productWithPrices.priceFinal !== undefined) {
      return productWithPrices.priceFinal;
    }

    return originalPrice;
  }
}
