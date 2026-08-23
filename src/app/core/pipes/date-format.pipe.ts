import { Pipe, PipeTransform } from '@angular/core';
import { formatDate, formatDateTime, formatDateShort } from '../utils/date-format';

/**
 * Formats dates in European format (dd.mm.yyyy).
 *
 * Usage:
 *   {{ dateString | dateFormat }}            → 12.03.2026
 *   {{ dateString | dateFormat:'datetime' }} → 12.03.2026 14:30:00
 *   {{ dateString | dateFormat:'short' }}    → 12.03.2026 14:30
 */
@Pipe({
    name: 'dateFormat',
    standalone: false
})
export class DateFormatPipe implements PipeTransform {
  transform(value: Date | string | null | undefined, mode: 'date' | 'datetime' | 'short' = 'date'): string {
    switch (mode) {
      case 'datetime':
        return formatDateTime(value);
      case 'short':
        return formatDateShort(value);
      default:
        return formatDate(value);
    }
  }
}
