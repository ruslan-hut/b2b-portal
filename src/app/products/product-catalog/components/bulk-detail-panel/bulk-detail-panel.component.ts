import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { Product } from '../../../../core/models/product.model';
import { ProductImageCacheService } from '../../../../core/services/product-image-cache.service';

/**
 * Presentational component for bulk desktop detail panel (sidebar)
 * Displays selected product details with image, pricing, and stock information
 */
@Component({
  selector: 'app-bulk-detail-panel',
  standalone: false,
  templateUrl: './bulk-detail-panel.component.html',
  styleUrl: './bulk-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BulkDetailPanelComponent {
  /**
   * Selected product to display
   */
  @Input() product: Product | null = null;

  /**
   * Price with VAT (preview or authoritative)
   */
  @Input() priceWithVat: number = 0;

  /**
   * Original price with VAT (before discount)
   */
  @Input() originalPrice: number = 0;

  /**
   * Whether discount is applied
   */
  @Input() hasDiscount: boolean = false;

  /**
   * Currency name for display
   */
  @Input() currencyName: string | undefined;

  /**
   * Emitted when detail card is clicked (to open full product details)
   */
  @Output() cardClick = new EventEmitter<void>();

  constructor(
    public imageCacheService: ProductImageCacheService
  ) {}

  /**
   * Get product image URL (from cache or placeholder)
   */
  getProductImageUrl(): string {
    if (!this.product) {
      return this.imageCacheService.getPlaceholderUrl();
    }

    if (this.imageCacheService.hasImageUrl(this.product.id)) {
      return this.imageCacheService.getImageUrl(this.product.id);
    }
    if (this.product.imageUrl) {
      return this.product.imageUrl;
    }
    return this.imageCacheService.getPlaceholderUrl();
  }

  /**
   * Handle image load errors by setting a placeholder image
   */
  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/images/product-placeholder.svg';
  }

  /**
   * Handle card click
   */
  onCardClick(event: Event): void {
    this.cardClick.emit();
  }
}
