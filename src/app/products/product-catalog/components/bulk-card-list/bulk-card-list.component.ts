import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { Product } from '../../../../core/models/product.model';
import { OrderItem } from '../../../../core/models/order.model';
import { Currency } from '../../../../core/models/currency.model';

/**
 * Container component for bulk mobile view - displays product cards in list format
 * Manages card expansion state and coordinates events between child cards and parent
 */
@Component({
  selector: 'app-bulk-card-list',
  standalone: false,
  templateUrl: './bulk-card-list.component.html',
  styleUrl: './bulk-card-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BulkCardListComponent {
  /**
   * Products to display
   */
  @Input({ required: true }) products!: Product[];

  /**
   * Current cart items
   */
  @Input() cartItems: OrderItem[] = [];

  /**
   * Currency for display
   */
  @Input() currency: Currency | null = null;

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
   * Currently expanded card ID (only one card can be expanded at a time)
   */
  private expandedCardId: string | null = null;

  /**
   * Emitted when a product is selected
   */
  @Output() productSelect = new EventEmitter<Product>();

  /**
   * Emitted when quantity should be incremented
   */
  @Output() quantityIncrement = new EventEmitter<{productId: string; product: Product}>();

  /**
   * Emitted when quantity should be decremented
   */
  @Output() quantityDecrement = new EventEmitter<{productId: string; product: Product}>();

  /**
   * Emitted when quantity input changes
   */
  @Output() quantityChange = new EventEmitter<{productId: string; product: Product; quantity: number}>();

  /**
   * Emitted when product image is clicked
   */
  @Output() imageClick = new EventEmitter<{imageUrl: string; altText: string}>();

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
   * Check if product card is expanded
   */
  isExpanded(productId: string): boolean {
    return this.expandedCardId === productId;
  }

  /**
   * Toggle card expansion (only one card can be expanded at a time)
   */
  onCardToggle(productId: string): void {
    if (this.expandedCardId === productId) {
      this.expandedCardId = null;
    } else {
      this.expandedCardId = productId;
    }
  }

  /**
   * Handle product selection
   */
  onProductSelect(product: Product): void {
    this.productSelect.emit(product);
  }

  /**
   * Handle quantity increment
   */
  onQuantityIncrement(product: Product): void {
    this.quantityIncrement.emit({ productId: product.id, product });
  }

  /**
   * Handle quantity decrement
   */
  onQuantityDecrement(product: Product): void {
    this.quantityDecrement.emit({ productId: product.id, product });
  }

  /**
   * Handle quantity input change
   */
  onQuantityChange(product: Product, quantity: number): void {
    this.quantityChange.emit({ productId: product.id, product, quantity });
  }

  /**
   * Handle image click
   */
  onImageClick(product: Product, imageUrl: string): void {
    this.imageClick.emit({ imageUrl, altText: product.name });
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
   * Check if discount is applied
   */
  hasDiscount(): boolean {
    return this.discount > 0;
  }

  /**
   * Calculate item subtotal with VAT
   */
  getItemSubtotalWithVat(product: Product, quantity: number): number {
    return this.getPriceWithVat(product) * quantity;
  }
}
