import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { Product } from '../../../../core/models/product.model';
import { OrderItem } from '../../../../core/models/order.model';
import { Currency } from '../../../../core/models/currency.model';
import { PricingHelperService } from '../../services/pricing-helper.service';

/**
 * Container component for product grid view
 * Groups products by category and displays them using ProductCardComponent
 * Handles pricing calculations and event coordination
 */
@Component({
  selector: 'app-product-grid',
  standalone: false,
  templateUrl: './product-grid.component.html',
  styleUrl: './product-grid.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProductGridComponent implements OnInit, OnChanges {
  /**
   * Products to display in grid
   */
  @Input({ required: true }) products!: Product[];

  /**
   * Current cart items (for pricing calculations and quantity display)
   */
  @Input({ required: true }) cartItems!: OrderItem[];

  /**
   * Currency for display
   */
  @Input() currency: Currency | null = null;

  /**
   * Current discount percentage
   */
  @Input() discount: number = 0;

  /**
   * Current VAT rate percentage
   */
  @Input() vatRate: number = 0;

  /**
   * Emitted when add to cart is clicked for a product
   */
  @Output() addToCart = new EventEmitter<Product>();

  /**
   * Emitted when product image is clicked (for preview modal)
   */
  @Output() imagePreview = new EventEmitter<{ url: string; alt: string }>();

  /**
   * Emitted when product card is clicked (for details overlay)
   */
  @Output() productDetails = new EventEmitter<Product>();

  /**
   * Products grouped by category
   */
  productsByCategory = new Map<string, Product[]>();

  /**
   * Sorted category names
   */
  categories: string[] = [];

  constructor(
    private pricingHelper: PricingHelperService
  ) {}

  ngOnInit(): void {
    this.groupProductsByCategory();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['products']) {
      this.groupProductsByCategory();
    }
  }

  /**
   * Group products by category for display
   */
  groupProductsByCategory(): void {
    this.productsByCategory.clear();
    this.categories = [];

    this.products.forEach(product => {
      if (!this.productsByCategory.has(product.category)) {
        this.productsByCategory.set(product.category, []);
        this.categories.push(product.category);
      }
      this.productsByCategory.get(product.category)!.push(product);
    });
  }

  /**
   * Get cart quantity for a product
   */
  getCartQuantity(productId: string): number {
    const cartItem = this.cartItems.find(item => item.productId === productId);
    return cartItem ? cartItem.quantity : 0;
  }

  /**
   * Get price with VAT (and discount if applicable) for display
   */
  getPriceWithVat(product: Product): number {
    return this.pricingHelper.getDisplayPriceWithVat(
      product,
      this.cartItems,
      this.discount,
      this.vatRate
    );
  }

  /**
   * Get original price with VAT (before discount)
   */
  getOriginalPriceWithVat(product: Product): number {
    return this.pricingHelper.getOriginalPriceWithVat(product);
  }

  /**
   * Check if discount is active
   */
  hasDiscount(): boolean {
    return this.pricingHelper.hasDiscount(this.discount);
  }

  /**
   * Handle image click - emit image preview event
   */
  onImageClick(product: Product): void {
    // Get product image URL (same logic as ProductCardComponent)
    const imageUrl = product.imageUrl || 'assets/images/product-placeholder.svg';
    this.imagePreview.emit({
      url: imageUrl,
      alt: product.name
    });
  }

  /**
   * Handle add to cart - emit product
   */
  onAddToCart(product: Product): void {
    this.addToCart.emit(product);
  }

  /**
   * Handle card click - emit product for details
   */
  onCardClick(product: Product): void {
    this.productDetails.emit(product);
  }
}
