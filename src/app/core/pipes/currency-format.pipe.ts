import { Pipe, PipeTransform } from '@angular/core';
import { Currency } from '../models/currency.model';

@Pipe({
    name: 'currencyFormat',
    standalone: false
})
export class CurrencyFormatPipe implements PipeTransform {
  /**
   * Formats a price with currency sign or name
   * @param value - The price amount (in cents)
   * @param currency - Currency object with sign and name
   * @returns Formatted price string: "sign amount" or "amount name"
   */
  transform(value: number | null | undefined, currency?: Currency | null): string {
    if (value === null || value === undefined) {
      return '-';
    }

    // Convert from cents to currency units
    const amount = value / 100;

    // Format the number with 2 decimal places
    const formattedAmount = amount.toFixed(2);

    // If no currency provided, return just the amount
    if (!currency) {
      return formattedAmount;
    }

    // If sign exists: "sign amount" (e.g., "$100.00")
    if (currency.sign && currency.sign.trim() !== '') {
      return `${currency.sign}${formattedAmount}`;
    }

    // If sign is empty: "amount name" (e.g., "100.00 USD")
    return `${formattedAmount} ${currency.name}`;
  }
}
