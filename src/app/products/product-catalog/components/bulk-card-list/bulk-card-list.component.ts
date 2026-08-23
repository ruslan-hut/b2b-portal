import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Product } from '../../../../core/models/product.model';
import { OrderItem } from '../../../../core/models/order.model';
import { Currency } from '../../../../core/models/currency.model';

/**
 * Container component for bulk mobile view - displays product cards in list format.
 * Manages card expansion state and coordinates events between child cards and parent.
 */
@Component({
  selector: 'app-bulk-card-list',
  standalone: false,
  templateUrl: './bulk-card-list.component.html',
  styleUrl: './bulk-card-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BulkCardListComponent {
  readonly products = input.required<Product[]>();
  readonly cartItems = input<OrderItem[]>([]);
  readonly currency = input<Currency | null>(null);
  readonly discount = input<number>(0);
  readonly vatRate = input<number>(0);
  readonly bulkQuantities = input<Map<string, number>>(new Map());
  /** Read-only catalog preview for staff: hides all cart controls. */
  readonly previewMode = input<boolean>(false);

  /**
   * Currently expanded card ID (only one card can be expanded at a time).
   */
  private expandedCardId: string | null = null;

  readonly productSelect = output<Product>();
  readonly quantityIncrement = output<{productId: string; product: Product}>();
  readonly quantityDecrement = output<{productId: string; product: Product}>();
  readonly quantityChange = output<{productId: string; product: Product; quantity: number}>();
  readonly imageClick = output<{imageUrl: string; altText: string}>();

  getBulkQuantity(productId: string): number {
    return this.bulkQuantities().get(productId) || 0;
  }

  isInCart(productId: string): boolean {
    return this.cartItems().some(item => item.productId === productId);
  }

  isExpanded(productId: string): boolean {
    return this.expandedCardId === productId;
  }

  onCardToggle(productId: string): void {
    this.expandedCardId = this.expandedCardId === productId ? null : productId;
  }

  onProductSelect(product: Product): void {
    this.productSelect.emit(product);
  }

  onQuantityIncrement(product: Product): void {
    this.quantityIncrement.emit({ productId: product.id, product });
  }

  onQuantityDecrement(product: Product): void {
    this.quantityDecrement.emit({ productId: product.id, product });
  }

  onQuantityChange(product: Product, quantity: number): void {
    this.quantityChange.emit({ productId: product.id, product, quantity });
  }

  onImageClick(product: Product, imageUrl: string): void {
    this.imageClick.emit({ imageUrl, altText: product.name });
  }

  /**
   * Calculate price with VAT (uses backend-calculated values from product or cart item).
   */
  getPriceWithVat(product: Product): number {
    const cartItem = this.cartItems().find(item => item.productId === product.id);
    const productWithPrices = product as Product & { priceFinal?: number; priceWithVat?: number };

    if (!this.hasDiscount()) {
      if (cartItem && cartItem.priceWithVat !== undefined) {
        return cartItem.priceWithVat;
      }
      if (productWithPrices.priceWithVat !== undefined) {
        return productWithPrices.priceWithVat;
      }
      return product.price;
    }

    if (cartItem && cartItem.priceAfterDiscountWithVat !== undefined) {
      return cartItem.priceAfterDiscountWithVat;
    }

    if (productWithPrices.priceFinal !== undefined) {
      return productWithPrices.priceFinal;
    }
    return product.price;
  }

  getOriginalPriceWithVat(product: Product): number {
    const cartItem = this.cartItems().find(item => item.productId === product.id);

    if (cartItem && cartItem.priceWithVat !== undefined) {
      return cartItem.priceWithVat;
    }

    const productWithPrices = product as Product & { priceWithVat?: number };
    if (productWithPrices.priceWithVat !== undefined) {
      return productWithPrices.priceWithVat;
    }

    return product.price;
  }

  hasDiscount(): boolean {
    return this.discount() > 0;
  }

  getItemSubtotalWithVat(product: Product, quantity: number): number {
    return this.getPriceWithVat(product) * quantity;
  }
}
