/**
 * Centralized date formatting utilities.
 * European format: dd.mm.yyyy
 *
 * Usage:
 *   import { formatDate, formatDateTime, formatDateShort, formatTimeOnly } from '../../core/utils/date-format';
 *
 *   formatDate('2026-03-12T14:30:00Z')      → '12.03.2026'
 *   formatDateTime('2026-03-12T14:30:00Z')   → '12.03.2026 14:30:00'
 *   formatDateShort('2026-03-12T14:30:00Z')  → '12.03.2026 14:30'
 *   formatTimeOnly('2026-03-12T14:30:45Z')   → '14:30:45'
 */

function pad(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

function toDate(input: Date | string): Date {
  return typeof input === 'string' ? new Date(input) : input;
}

/** dd.mm.yyyy */
export function formatDate(input: Date | string | null | undefined): string {
  if (!input) return '-';
  const d = toDate(input);
  if (isNaN(d.getTime())) return '-';
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** dd.mm.yyyy HH:mm:ss */
export function formatDateTime(input: Date | string | null | undefined): string {
  if (!input) return '-';
  const d = toDate(input);
  if (isNaN(d.getTime())) return '-';
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** dd.mm.yyyy HH:mm */
export function formatDateShort(input: Date | string | null | undefined): string {
  if (!input) return '-';
  const d = toDate(input);
  if (isNaN(d.getTime())) return '-';
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** HH:mm:ss */
export function formatTimeOnly(input: Date | string | null | undefined): string {
  if (!input) return '-';
  const d = toDate(input);
  if (isNaN(d.getTime())) return '-';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** HH:mm */
export function formatTimeShort(input: Date | string | null | undefined): string {
  if (!input) return '-';
  const d = toDate(input);
  if (isNaN(d.getTime())) return '-';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
