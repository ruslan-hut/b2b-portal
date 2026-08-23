import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Product } from '../../../../core/models/product.model';
import { OrderItem } from '../../../../core/models/order.model';
import { Currency } from '../../../../core/models/currency.model';
import { PricingHelperService } from '../../services/pricing-helper.service';

/**
 * Container component for product grid view.
 * Groups products by category and displays them using ProductCardComponent.
 */
@Component({
  selector: 'app-product-grid',
  standalone: false,
  templateUrl: './product-grid.component.html',
  styleUrl: './product-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductGridComponent {
  private readonly pricingHelper = inject(PricingHelperService);

  readonly products = input.required<Product[]>();
  readonly cartItems = input.required<OrderItem[]>();
  readonly currency = input<Currency | null>(null);
  readonly discount = input<number>(0);
  readonly vatRate = input<number>(0);
  /** Read-only catalog preview for staff: hides all cart controls. */
  readonly previewMode = input<boolean>(false);

  readonly addToCart = output<Product>();
  readonly imagePreview = output<{ url: string; alt: string }>();
  readonly productDetails = output<Product>();

  /**
   * Products grouped by category, in insertion order. Recomputed when
   * `products` input changes.
   */
  private readonly grouped = computed(() => {
    const byCategory = new Map<string, Product[]>();
    const categories: string[] = [];
    for (const product of this.products()) {
      const list = byCategory.get(product.category);
      if (list) {
        list.push(product);
      } else {
        byCategory.set(product.category, [product]);
        categories.push(product.category);
      }
    }
    return { byCategory, categories };
  });

  readonly categories = computed(() => this.grouped().categories);
  readonly productsByCategory = computed(() => this.grouped().byCategory);

  getProductsForCategory(category: string): Product[] {
    return this.productsByCategory().get(category) ?? [];
  }

  getCartQuantity(productId: string): number {
    const cartItem = this.cartItems().find(item => item.productId === productId);
    return cartItem ? cartItem.quantity : 0;
  }

  getPriceWithVat(product: Product): number {
    return this.pricingHelper.getDisplayPriceWithVat(
      product,
      this.cartItems(),
      this.discount(),
      this.vatRate()
    );
  }

  getOriginalPriceWithVat(product: Product): number {
    return this.pricingHelper.getOriginalPriceWithVat(product);
  }

  hasDiscount(): boolean {
    return this.pricingHelper.hasDiscount(this.discount());
  }

  onImageClick(product: Product): void {
    const imageUrl = product.imageUrl || 'assets/images/product-placeholder.svg';
    this.imagePreview.emit({
      url: imageUrl,
      alt: product.name
    });
  }

  onAddToCart(product: Product): void {
    this.addToCart.emit(product);
  }

  onCardClick(product: Product): void {
    this.productDetails.emit(product);
  }
}
