import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { Product } from '../../../../core/models/product.model';
import { Currency } from '../../../../core/models/currency.model';
import { ProductImageCacheService } from '../../../../core/services/product-image-cache.service';

/**
 * Presentational component for individual product cards in bulk mobile view
 * Displays product info, pricing, and expandable quantity controls
 */
@Component({
  selector: 'app-bulk-product-card',
  standalone: false,
  templateUrl: './bulk-product-card.component.html',
  styleUrl: './bulk-product-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BulkProductCardComponent {
  /**
   * Product to display
   */
  @Input({ required: true }) product!: Product;

  /**
   * Current bulk quantity for this product
   */
  @Input() bulkQuantity: number = 0;

  /**
   * Whether this card is expanded
   */
  @Input() isExpanded: boolean = false;

  /**
   * Whether this product is in cart
   */
  @Input() isInCart: boolean = false;

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
   * Item subtotal with VAT
   */
  @Input() subtotalWithVat: number = 0;

  /**
   * Currency for display
   */
  @Input() currency: Currency | null = null;

  /**
   * Emitted when card header is clicked (to toggle expansion)
   */
  @Output() cardToggle = new EventEmitter<void>();

  /**
   * Emitted when product should be selected
   */
  @Output() productSelect = new EventEmitter<void>();

  /**
   * Emitted when quantity should be incremented
   */
  @Output() quantityIncrement = new EventEmitter<void>();

  /**
   * Emitted when quantity should be decremented
   */
  @Output() quantityDecrement = new EventEmitter<void>();

  /**
   * Emitted when quantity input changes
   */
  @Output() quantityChange = new EventEmitter<number>();

  /**
   * Emitted when product image is clicked
   */
  @Output() imageClick = new EventEmitter<void>();

  constructor(
    public imageCacheService: ProductImageCacheService
  ) {}

  /**
   * Get product image URL (from cache or placeholder)
   */
  getProductImageUrl(): string {
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
   * Handle card click - toggle and select
   */
  onCardClick(): void {
    this.cardToggle.emit();
    this.productSelect.emit();
  }

  /**
   * Handle increment button click
   */
  onIncrement(event: Event): void {
    event.stopPropagation();
    this.quantityIncrement.emit();
  }

  /**
   * Handle decrement button click
   */
  onDecrement(event: Event): void {
    event.stopPropagation();
    this.quantityDecrement.emit();
  }

  /**
   * Handle quantity input change
   */
  onQuantityInput(event: Event): void {
    event.stopPropagation();
    const value = +(event.target as HTMLInputElement).value;
    this.quantityChange.emit(value);
  }

  /**
   * Handle image click
   */
  onImageClick(event: Event): void {
    event.stopPropagation();
    this.imageClick.emit();
  }

  /**
   * Stop propagation on click
   */
  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
