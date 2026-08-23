/**
 * Centralized money formatting utilities.
 * European format: space thousands, comma decimal — 19 587,50
 *
 * Usage:
 *   import { formatCents } from '../../core/utils/money-format';
 *
 *   formatCents(1958750)  → '19 587,50'
 *   formatCents(30055)    → '300,55'
 *   formatCents(-1046750) → '-10 467,50'
 *   formatAmount(1234.5)  → '1 234,50'
 *
 * One convention for every market, the same way date-format fixes dd.mm.yyyy
 * rather than following the UI language. Ukraine and Poland share this format,
 * and a comma thousands separator would be read as a decimal point in both.
 *
 * The separator is a NO-BREAK SPACE (U+00A0): a total must never wrap between
 * its thousands and its hundreds.
 *
 * Takes **cents**, not display units — the caller does not divide. Order and
 * invoice payloads carry integer cents; anything already converted by the
 * backend must not be passed here.
 */

const THOUSANDS_SEP = ' ';
const DECIMAL_SEP = ',';

export function formatCents(cents: number | null | undefined): string {
  const rounded = Math.round(Number(cents ?? 0));
  if (!Number.isFinite(rounded)) return '0' + DECIMAL_SEP + '00';

  const abs = Math.abs(rounded);
  const whole = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEP);
  const frac = String(abs % 100).padStart(2, '0');

  // Sign comes off the rounded value, so -0.4 cents prints as 0,00 rather than -0,00.
  return (rounded < 0 ? '-' : '') + whole + DECIMAL_SEP + frac;
}

/**
 * Same format, for money the backend already converted to display units —
 * carrier prices and quotes arrive as 25.4, not 2540. Use this rather than
 * multiplying at the call site, so which family a field belongs to stays
 * readable in the template.
 */
export function formatAmount(value: number | null | undefined): string {
  return formatCents(Math.round(Number(value ?? 0) * 100));
}

/**
 * Whole counts — orders, tasks, members — grouped the same way, with no
 * decimals. Lives here rather than in a component so a count in a KPI tile and
 * a total in a table separate their thousands identically, and so nobody
 * reaches for `toLocaleString()`, which with no LOCALE_ID registered emits the
 * en-US comma this format exists to avoid.
 */
export function formatCount(value: number | null | undefined): string {
  const n = Math.round(Number(value ?? 0));
  if (!Number.isFinite(n)) return '0';
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEP);
}

/**
 * Measured quantities — box weights, consignment totals — in the same
 * convention, trimmed to the precision the scale actually has.
 *
 * Here rather than in a component because these are sums of floats: three boxes
 * at 4.1 kg is 12.300000000000001 in IEEE 754, and interpolating that straight
 * into a template puts seventeen digits in front of an operator. Trailing zeros
 * come off, so a whole number reads as `12 kg` rather than `12,00 kg`.
 */
export function formatDecimal(value: number | null | undefined, maxDigits = 2): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';

  const fixed = n.toFixed(maxDigits);
  const [whole, frac = ''] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, THOUSANDS_SEP);

  const trimmed = frac.replace(/0+$/, '');
  return trimmed ? grouped + DECIMAL_SEP + trimmed : grouped;
}
