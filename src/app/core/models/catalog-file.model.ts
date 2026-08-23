/**
 * Models for the catalog order form — the spreadsheet a client exports, fills in
 * and uploads back to create an order.
 */

/** How the barcode column is rendered in the exported sheet. */
export type CatalogExportFormat = 'text' | 'image';

export interface CatalogExportRequest {
  format: CatalogExportFormat;
  /** Empty means the whole catalog. */
  categoryUids: string[];
}

/** A downloaded export, ready to be handed to the browser. */
export interface CatalogExportFile {
  blob: Blob;
  filename: string;
  /**
   * True when the catalog was larger than one export can hold and the tail was
   * left out. The UI must say so rather than pass off a partial file.
   */
  truncated: boolean;
}

/**
 * Which columns of the uploaded file hold the article code and the quantity,
 * as 1-based spreadsheet column numbers.
 *
 * The defaults are where the catalog export puts them. A client whose own sheet
 * has a different shape changes them, and the choice is remembered for next time.
 */
export interface CatalogImportColumns {
  sku: number;
  quantity: number;
}

/** Column positions in the catalog export: Barcode, SKU, Name, Quantity, … */
export const DEFAULT_IMPORT_COLUMNS: Readonly<CatalogImportColumns> = { sku: 2, quantity: 4 };

/** A spreadsheet row that was matched to an orderable product. */
export interface CatalogImportItem {
  rowNumber: number;
  productUid: string;
  sku: string;
  barcode?: string;
  productName: string;
  /** Quantity to order — already reduced to what the store has. */
  quantity: number;
  /** What the file asked for, before clamping. */
  requestedQuantity: number;
  availableQuantity: number;
  /** Cents, VAT included, before discount. */
  priceWithVat: number;
  /** Cents, VAT included, after discount. */
  priceFinal: number;
  discountPercent: number;
  clamped: boolean;
}

export type CatalogImportSkipReason = 'not_found' | 'duplicate' | 'no_stock';

/** A row that carried a quantity but could not become an order line. */
export interface CatalogImportSkipped {
  rowNumber: number;
  sku?: string;
  barcode?: string;
  productName?: string;
  quantity: number;
  reason: CatalogImportSkipReason;
}

export interface CatalogImportResult {
  items: CatalogImportItem[];
  skipped: CatalogImportSkipped[];
  /** How many rows in the file carried a quantity at all. */
  rowsWithQuantity: number;
}
