import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { Product } from '../../../../core/models/product.model';
import { OrderItem } from '../../../../core/models/order.model';

/**
 * Presentational component for bulk desktop table view
 * Displays products in tabular format with quantity inputs and subtotals
 */
@Component({
  selector: 'app-bulk-table',
  standalone: false,
  templateUrl: './bulk-table.component.html',
  styleUrl: './bulk-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BulkTableComponent {
  /**
   * Products to display
   */
  @Input({ required: true }) products!: Product[];

  /**
   * Current cart items
   */
  @Input() cartItems: OrderItem[] = [];

  /**
   * Current client discount percentage
   */
  @Input() discount: number = 0;

  /**
   * Current VAT rate percentage
   */
  @Input() vatRate: number = 0;

  /**
   * Map of product ID to bulk quantity
   */
  @Input() bulkQuantities: Map<string, number> = new Map();

  /**
   * Currently selected product (for sidebar detail)
   */
  @Input() selectedProduct: Product | null = null;

  /**
   * Emitted when a product row is selected
   */
  @Output() productSelect = new EventEmitter<Product>();

  /**
   * Emitted when quantity input changes
   */
  @Output() quantityChange = new EventEmitter<{product: Product; quantity: number}>();

  /**
   * Get bulk quantity for a product
   */
  getBulkQuantity(productId: string): number {
    return this.bulkQuantities.get(productId) || 0;
  }

  /**
   * Check if product is in cart
   */
  isInCart(productId: string): boolean {
    return this.cartItems.some(item => item.productId === productId);
  }

  /**
   * Check if discount is applied
   */
  hasDiscount(): boolean {
    return this.discount > 0;
  }

  /**
   * Handle product row selection
   */
  onProductSelect(product: Product): void {
    this.productSelect.emit(product);
  }

  /**
   * Handle quantity input change
   */
  onQuantityChange(product: Product, quantity: number): void {
    this.quantityChange.emit({ product, quantity });
  }

  /**
   * Calculate price with VAT (uses product or cart item prices directly)
   */
  getPriceWithVat(product: Product): number {
    const cartItem = this.cartItems.find(item => item.productId === product.id);
    const productWithPrices = product as Product & { priceFinal?: number; priceWithVat?: number };

    // If no discount, use original price with VAT
    if (!this.hasDiscount()) {
      // For cart items, use cart's priceWithVat
      if (cartItem && cartItem.priceWithVat !== undefined) {
        return cartItem.priceWithVat;
      }
      // For non-cart items, use product's priceWithVat
      if (productWithPrices.priceWithVat !== undefined) {
        return productWithPrices.priceWithVat;
      }
      return product.price;
    }

    // With discount - use discounted prices
    // For cart items, use cart's discounted price
    if (cartItem && cartItem.priceAfterDiscountWithVat !== undefined) {
      return cartItem.priceAfterDiscountWithVat;
    }

    // For non-cart items, use product's priceFinal
    if (productWithPrices.priceFinal !== undefined) {
      return productWithPrices.priceFinal;
    }
    // Fallback to regular price
    return product.price;
  }

  /**
   * Get original price with VAT (before discount)
   */
  getOriginalPriceWithVat(product: Product): number {
    const cartItem = this.cartItems.find(item => item.productId === product.id);

    // For cart items, use cart's original priceWithVat
    if (cartItem && cartItem.priceWithVat !== undefined) {
      return cartItem.priceWithVat;
    }

    // For non-cart items, use product's priceWithVat if available
    const productWithPrices = product as Product & { priceWithVat?: number };
    if (productWithPrices.priceWithVat !== undefined) {
      return productWithPrices.priceWithVat;
    }

    return product.price;
  }

  /**
   * Calculate item subtotal with VAT
   */
  getItemSubtotalWithVat(product: Product, quantity: number): number {
    return this.getPriceWithVat(product) * quantity;
  }
}
