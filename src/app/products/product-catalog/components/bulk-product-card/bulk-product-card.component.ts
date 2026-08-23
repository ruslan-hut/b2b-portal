import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { Product } from '../../../../core/models/product.model';
import { Currency } from '../../../../core/models/currency.model';
import { ProductImageCacheService } from '../../../../core/services/product-image-cache.service';

/**
 * Presentational component for individual product cards in bulk mobile view.
 * Displays product info, pricing, and expandable quantity controls.
 */
@Component({
  selector: 'app-bulk-product-card',
  standalone: false,
  templateUrl: './bulk-product-card.component.html',
  styleUrl: './bulk-product-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BulkProductCardComponent {
  readonly imageCacheService = inject(ProductImageCacheService);

  readonly product = input.required<Product>();
  readonly bulkQuantity = input<number>(0);
  readonly isExpanded = input<boolean>(false);
  readonly isInCart = input<boolean>(false);
  readonly priceWithVat = input.required<number>();
  readonly originalPrice = input.required<number>();
  readonly hasDiscount = input<boolean>(false);
  readonly subtotalWithVat = input<number>(0);
  readonly currency = input<Currency | null>(null);
  /** Read-only catalog preview for staff: hides all cart controls. */
  readonly previewMode = input<boolean>(false);

  readonly cardToggle = output<void>();
  readonly productSelect = output<void>();
  readonly quantityIncrement = output<void>();
  readonly quantityDecrement = output<void>();
  readonly quantityChange = output<number>();
  readonly imageClick = output<void>();

  getProductImageUrl(): string {
    const product = this.product();
    if (this.imageCacheService.hasImageUrl(product.id)) {
      return this.imageCacheService.getImageUrl(product.id);
    }
    if (product.imageUrl) {
      return product.imageUrl;
    }
    return this.imageCacheService.getPlaceholderUrl();
  }

  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/images/product-placeholder.svg';
  }

  onCardClick(): void {
    this.cardToggle.emit();
    this.productSelect.emit();
  }

  onIncrement(event: Event): void {
    event.stopPropagation();
    this.quantityIncrement.emit();
  }

  onDecrement(event: Event): void {
    event.stopPropagation();
    this.quantityDecrement.emit();
  }

  onQuantityInput(event: Event): void {
    event.stopPropagation();
    const value = +(event.target as HTMLInputElement).value;
    this.quantityChange.emit(value);
  }

  onImageClick(event: Event): void {
    event.stopPropagation();
    this.imageClick.emit();
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
