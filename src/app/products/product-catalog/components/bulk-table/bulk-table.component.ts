import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Product } from '../../../../core/models/product.model';
import { OrderItem } from '../../../../core/models/order.model';

/**
 * Presentational component for bulk desktop table view.
 * Displays products in tabular format with quantity inputs and subtotals.
 */
@Component({
  selector: 'app-bulk-table',
  standalone: false,
  templateUrl: './bulk-table.component.html',
  styleUrl: './bulk-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BulkTableComponent {
  readonly products = input.required<Product[]>();
  readonly cartItems = input<OrderItem[]>([]);
  readonly discount = input<number>(0);
  readonly vatRate = input<number>(0);
  readonly bulkQuantities = input<Map<string, number>>(new Map());
  readonly selectedProduct = input<Product | null>(null);
  readonly showQuantity = input<boolean>(true);
  /** Read-only catalog preview for staff: hides quantity/total columns. */
  readonly previewMode = input<boolean>(false);

  readonly productSelect = output<Product>();
  readonly quantityChange = output<{product: Product; quantity: number}>();

  getBulkQuantity(productId: string): number {
    return this.bulkQuantities().get(productId) || 0;
  }

  isInCart(productId: string): boolean {
    return this.cartItems().some(item => item.productId === productId);
  }

  hasDiscount(): boolean {
    return this.discount() > 0;
  }

  onProductSelect(product: Product): void {
    this.productSelect.emit(product);
  }

  onQuantityChange(product: Product, quantity: number): void {
    this.quantityChange.emit({ product, quantity });
  }

  /**
   * Get unit price with VAT (and discount, if applicable) using backend-provided values.
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

  getItemSubtotalWithVat(product: Product, quantity: number): number {
    return this.getPriceWithVat(product) * quantity;
  }
}
