import { Injectable } from '@angular/core';
import { Product } from '../../../core/models/product.model';
import { OrderItem } from '../../../core/models/order.model';

/**
 * Centralized pricing calculation service for product catalog
 * CRITICAL: Backend is single source of truth for all pricing calculations
 * This service handles two pricing modes:
 * 1. PREVIEW prices: Local calculations for instant UI feedback (non-authoritative)
 * 2. AUTHORITATIVE prices: Backend-calculated values from cart items
 */
@Injectable({
  providedIn: 'root',
})
export class PricingHelperService {

  /**
   * Calculate preview price with VAT and discount
   * IMPORTANT: This is PREVIEW ONLY - not authoritative
   * Used for products NOT in cart to provide instant visual feedback
   *
   * @param originalPrice - Base price from product
   * @param discount - Discount percentage (0-100)
   * @param vatRate - VAT rate percentage (0-100)
   * @returns Estimated price with discount and VAT applied
   */
  calculatePreviewPriceWithVat(originalPrice: number, discount: number, vatRate: number): number {
    // Apply discount first (if any)
    let priceAfterDiscount = originalPrice;
    if (discount > 0) {
      priceAfterDiscount = originalPrice * (1 - discount / 100);
    }

    // Apply VAT to discounted price
    return priceAfterDiscount * (1 + vatRate / 100);
  }

  /**
   * Get authoritative (backend-calculated) price with VAT for a product in cart
   * Returns null if product is not in cart or no backend value available
   *
   * @param product - Product to get price for
   * @param cartItems - Current cart items with backend-calculated values
   * @returns Backend-calculated price with VAT, or null if not in cart
   */
  getAuthoritativePriceWithVat(product: Product, cartItems: OrderItem[]): number | null {
    const cartItem = cartItems.find(item => item.productId === product.id);

    if (cartItem && cartItem.subtotal && cartItem.quantity > 0) {
      // Backend-calculated unit price: subtotal / quantity
      return cartItem.subtotal / cartItem.quantity;
    }

    return null; // Not in cart or no backend value
  }

  /**
   * Get display price with VAT (authoritative if in cart, preview otherwise)
   * This is the main method components should use for price display
   *
   * @param product - Product to get price for
   * @param cartItems - Current cart items
   * @param discount - Discount percentage for preview calculation
   * @param vatRate - VAT rate for preview calculation
   * @returns Price to display (backend value if available, preview otherwise)
   */
  getDisplayPriceWithVat(
    product: Product,
    cartItems: OrderItem[],
    discount: number,
    vatRate: number
  ): number {
    // Try to get authoritative price from cart first
    const authoritativePrice = this.getAuthoritativePriceWithVat(product, cartItems);
    if (authoritativePrice !== null) {
      return authoritativePrice;
    }

    // Product not in cart - use preview calculation
    // Try to use priceFinal from backend product data if available
    const productWithPrices = product as Product & { priceFinal?: number; priceWithVat?: number };

    // If no discount, return original price with VAT
    if (discount === 0) {
      if (productWithPrices.priceWithVat !== undefined) {
        return productWithPrices.priceWithVat;
      }
      return product.price;
    }

    // With discount - check if backend provided priceFinal
    if (productWithPrices.priceFinal !== undefined) {
      return productWithPrices.priceFinal;
    }

    // Fallback: calculate preview price
    return this.calculatePreviewPriceWithVat(product.price, discount, vatRate);
  }

  /**
   * Get original price with VAT (no discount applied)
   * Uses backend-calculated priceWithVat if available
   *
   * @param product - Product to get original price for
   * @returns Original price with VAT (from backend if available)
   */
  getOriginalPriceWithVat(product: Product): number {
    const productWithPrices = product as Product & { priceWithVat?: number };

    if (productWithPrices.priceWithVat !== undefined) {
      return productWithPrices.priceWithVat;
    }

    // No backend value available - return base price
    // Note: This should rarely happen as getFrontendProductsPaginated() provides priceWithVat
    console.warn(`[PricingHelperService] No priceWithVat available for product ${product.id}`);
    return product.price;
  }

  /**
   * Get item subtotal with VAT for display
   * IMPORTANT: For items in cart, ONLY uses backend-calculated values
   * For items NOT in cart, calculates PREVIEW total for display only
   *
   * @param product - Product to calculate subtotal for
   * @param quantity - Quantity of product
   * @param cartItems - Current cart items with backend values
   * @param discount - Discount percentage for preview calculation
   * @param vatRate - VAT rate for preview calculation
   * @returns Item subtotal (authoritative if in cart, preview otherwise)
   */
  getItemSubtotalWithVat(
    product: Product,
    quantity: number,
    cartItems: OrderItem[],
    discount: number,
    vatRate: number
  ): number {
    if (quantity <= 0) return 0;

    // Find cart item
    const cartItem = cartItems.find(item => item.productId === product.id);

    if (cartItem && cartItem.subtotal) {
      // Check if the quantity we're displaying matches the cart item quantity
      // If not, we're in the middle of an update - calculate preview
      if (quantity !== cartItem.quantity) {
        // Quantity changed but backend hasn't responded yet - show preview
        const priceWithVat = this.getDisplayPriceWithVat(product, cartItems, discount, vatRate);
        return priceWithVat * quantity;
      }

      // Quantities match - use backend-calculated subtotal (AUTHORITATIVE)
      return cartItem.subtotal;
    }

    // Item not in cart - calculate preview subtotal
    const priceWithVat = this.getDisplayPriceWithVat(product, cartItems, discount, vatRate);
    return priceWithVat * quantity;
  }

  /**
   * Check if product has discount applied
   * @param discount - Discount percentage
   * @returns True if discount is greater than 0
   */
  hasDiscount(discount: number): boolean {
    return discount > 0;
  }
}
