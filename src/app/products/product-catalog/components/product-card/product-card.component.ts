import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { Product } from '../../../../core/models/product.model';
import { ProductImageCacheService } from '../../../../core/services/product-image-cache.service';

/**
 * Presentational component for individual product cards in grid view
 * Displays product image, info, pricing, and add-to-cart button
 */
@Component({
  selector: 'app-product-card',
  standalone: false,
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCardComponent {
  /**
   * Product to display
   */
  @Input({ required: true }) product!: Product;

  /**
   * Quantity of this product in cart
   */
  @Input() cartQuantity: number = 0;

  /**
   * Final price with VAT (and discount if applicable)
   */
  @Input({ required: true }) priceWithVat!: number;

  /**
   * Original price with VAT (before discount)
   */
  @Input({ required: true }) originalPrice!: number;

  /**
   * Whether discount is applied
   */
  @Input() hasDiscount: boolean = false;

  /**
   * Currency name for display
   */
  @Input() currencyName: string | undefined;

  /**
   * Emitted when add to cart button is clicked
   */
  @Output() addToCart = new EventEmitter<void>();

  /**
   * Emitted when product image is clicked
   */
  @Output() imageClick = new EventEmitter<void>();

  /**
   * Emitted when product card is clicked
   */
  @Output() cardClick = new EventEmitter<void>();

  constructor(
    public imageCacheService: ProductImageCacheService
  ) {}

  /**
   * Handle image load errors by setting a placeholder image
   */
  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/images/product-placeholder.svg';
  }

  /**
   * Get product image URL (from cache or placeholder)
   * Uses cached Base64 images if available, otherwise falls back to imageUrl from product or placeholder
   */
  getProductImageUrl(): string {
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
   * Handle image click - emit event and stop propagation
   */
  onImageClick(event: Event): void {
    event.stopPropagation();
    this.imageClick.emit();
  }

  /**
   * Handle add to cart click - emit event and stop propagation
   */
  onAddToCartClick(event: Event): void {
    event.stopPropagation();
    this.addToCart.emit();
  }

  /**
   * Handle card click - emit event
   */
  onCardClick(event: Event): void {
    this.cardClick.emit();
  }
}
