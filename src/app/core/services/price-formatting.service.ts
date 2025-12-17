import { Injectable } from '@angular/core';

/**
 * PriceFormattingService - Formats monetary values for display
 * 
 * IMPORTANT: This service does NOT perform calculations.
 * All calculations (discounts, VAT, totals) are performed on the backend.
 * This service only formats values received from the backend API.
 */
@Injectable({
  providedIn: 'root'
})
export class PriceFormattingService {

  /**
   * Format price from cents to currency string
   * @param priceInCents - Price in cents (from backend)
   * @param currencyCode - Currency code (e.g., 'USD', 'PLN', 'EUR')
   * @returns Formatted price string (e.g., "19.99")
   */
  formatPrice(priceInCents: number, currencyCode: string = 'USD'): string {
    if (!priceInCents || priceInCents < 0) return '0.00';
    const price = priceInCents / 100;
    return price.toFixed(2);
  }

  /**
   * Format price with currency symbol
   * @param priceInCents - Price in cents (from backend)
   * @param currencyCode - Currency code
   * @returns Formatted price with symbol (e.g., "$19.99" or "19.99 zł")
   */
  formatPriceWithCurrency(priceInCents: number, currencyCode: string = 'USD'): string {
    const formatted = this.formatPrice(priceInCents, currencyCode);
    const symbol = this.getCurrencySymbol(currencyCode);
    
    // Some currencies put symbol after (PLN, EUR), others before (USD, GBP)
    const symbolAfter = ['PLN', 'EUR', 'UAH'].includes(currencyCode);
    
    return symbolAfter ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
  }

  /**
   * Get currency symbol
   * @param currencyCode - Currency code
   * @returns Currency symbol
   */
  getCurrencySymbol(currencyCode: string): string {
    const symbols: { [key: string]: string } = {
      'USD': '$',
      'EUR': '€',
      'PLN': 'zł',
      'GBP': '£',
      'UAH': '₴'
    };
    return symbols[currencyCode] || currencyCode;
  }

  /**
   * Format percentage for display
   * @param percent - Percentage value (0-100)
   * @returns Formatted percentage string (e.g., "10%")
   */
  formatPercentage(percent: number): string {
    if (!percent || percent <= 0) return '0%';
    return `${percent}%`;
  }

  /**
   * Convert cents to dollars (for display only, no calculation)
   * @param cents - Value in cents (from backend)
   * @returns Value in dollars (for display)
   */
  centsToDollars(cents: number): number {
    if (!cents || cents < 0) return 0;
    return Number((cents / 100).toFixed(2));
  }

  /**
   * Format discount amount saved (for display)
   * @param originalPriceInCents - Original price in cents
   * @param discountedPriceInCents - Discounted price in cents (both from backend)
   * @param currencyCode - Currency code
   * @returns Formatted discount amount string
   */
  formatDiscountAmount(originalPriceInCents: number, discountedPriceInCents: number, currencyCode: string = 'USD'): string {
    const discountAmount = originalPriceInCents - discountedPriceInCents;
    return this.formatPriceWithCurrency(discountAmount, currencyCode);
  }
}

