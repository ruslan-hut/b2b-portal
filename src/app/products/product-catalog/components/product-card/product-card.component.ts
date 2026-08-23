import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { Product } from '../../../../core/models/product.model';
import { ProductImageCacheService } from '../../../../core/services/product-image-cache.service';

/**
 * Presentational component for individual product cards in grid view.
 * Displays product image, info, pricing, and add-to-cart button.
 */
@Component({
  selector: 'app-product-card',
  standalone: false,
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductCardComponent {
  readonly imageCacheService = inject(ProductImageCacheService);

  readonly product = input.required<Product>();
  readonly cartQuantity = input<number>(0);
  readonly priceWithVat = input.required<number>();
  readonly originalPrice = input.required<number>();
  readonly hasDiscount = input<boolean>(false);
  readonly currencyName = input<string | undefined>(undefined);
  /** Read-only catalog preview for staff: hides all cart controls. */
  readonly previewMode = input<boolean>(false);

  readonly addToCart = output<void>();
  readonly imageClick = output<void>();
  readonly cardClick = output<void>();

  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/images/product-placeholder.svg';
  }

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

  onImageClick(event: Event): void {
    event.stopPropagation();
    this.imageClick.emit();
  }

  onAddToCartClick(event: Event): void {
    event.stopPropagation();
    this.addToCart.emit();
  }

  onCardClick(_event: Event): void {
    this.cardClick.emit();
  }
}
