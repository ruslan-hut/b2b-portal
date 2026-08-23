import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { Product } from '../../../../core/models/product.model';
import { ProductImageCacheService } from '../../../../core/services/product-image-cache.service';

/**
 * Presentational component for bulk desktop detail panel (sidebar).
 * Displays selected product details with image, pricing, and stock information.
 */
@Component({
  selector: 'app-bulk-detail-panel',
  standalone: false,
  templateUrl: './bulk-detail-panel.component.html',
  styleUrl: './bulk-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BulkDetailPanelComponent {
  readonly imageCacheService = inject(ProductImageCacheService);

  readonly product = input<Product | null>(null);
  readonly priceWithVat = input<number>(0);
  readonly originalPrice = input<number>(0);
  readonly vatRate = input<number>(0);
  readonly hasDiscount = input<boolean>(false);
  readonly currencyName = input<string | undefined>(undefined);

  readonly cardClick = output<void>();

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

  onImageError(event: Event): void {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/images/product-placeholder.svg';
  }

  onCardClick(_event: Event): void {
    this.cardClick.emit();
  }
}
