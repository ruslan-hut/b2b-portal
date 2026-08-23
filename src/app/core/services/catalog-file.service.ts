import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api.model';
import {
  CatalogExportFile,
  CatalogExportRequest,
  CatalogImportColumns,
  CatalogImportResult,
  DEFAULT_IMPORT_COLUMNS
} from '../models/catalog-file.model';
import { TranslationService } from './translation.service';

/** localStorage key holding this browser's remembered import column numbers. */
const COLUMN_PREFERENCE_KEY = 'catalogImportColumns';

/** Accepted range for a column number; the upper bound is Excel's column limit. */
export const MIN_COLUMN = 1;
export const MAX_COLUMN = 16384;

/** Wire shape of an import row, as the backend sends it. */
interface CatalogImportItemDto {
  row_number: number;
  product_uid: string;
  sku: string;
  barcode?: string;
  product_name: string;
  quantity: number;
  requested_quantity: number;
  available_quantity: number;
  price_with_vat: number;
  price_final: number;
  discount_percent: number;
  clamped: boolean;
}

interface CatalogImportSkippedDto {
  row_number: number;
  sku?: string;
  barcode?: string;
  product_name?: string;
  quantity: number;
  reason: string;
}

interface CatalogImportResultDto {
  items: CatalogImportItemDto[] | null;
  skipped: CatalogImportSkippedDto[] | null;
  rows_with_quantity: number;
}

/**
 * The catalog order form: download the catalog as a spreadsheet, fill in the
 * quantity column, upload it back as an order.
 *
 * The file is built server-side because every number in it — price with VAT,
 * discount percent, discounted price — is a backend calculation, and because the
 * picture variant of the barcode column cannot be produced in the browser.
 */
@Injectable({ providedIn: 'root' })
export class CatalogFileService {
  private readonly baseUrl = `${environment.apiUrl}/frontend/catalog`;

  constructor(
    private http: HttpClient,
    private translationService: TranslationService
  ) {}

  /**
   * Downloads the catalog as an XLSX order form.
   * @param request format and the categories to include (empty = everything)
   */
  export(request: CatalogExportRequest): Observable<CatalogExportFile> {
    const body = {
      format: request.format,
      category_uids: request.categoryUids,
      language: this.translationService.getCurrentLanguage()
    };

    return this.http
      .post(`${this.baseUrl}/export`, body, { observe: 'response', responseType: 'blob' })
      .pipe(map(response => this.toExportFile(response)));
  }

  /**
   * Uploads a filled-in order form and returns the lines the backend could
   * resolve. Nothing is written to the cart — the caller reviews this first.
   *
   * @param columns which columns hold the article code and the quantity;
   *                defaults to the catalog export's own layout
   */
  import(file: File, columns: CatalogImportColumns = { ...DEFAULT_IMPORT_COLUMNS }): Observable<CatalogImportResult> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('sku_column', String(columns.sku));
    form.append('quantity_column', String(columns.quantity));

    return this.http
      .post<ApiResponse<CatalogImportResultDto>>(`${this.baseUrl}/import`, form)
      .pipe(map(response => this.toImportResult(response.data)));
  }

  /**
   * The column numbers this browser last used, or the export defaults.
   *
   * Kept in localStorage rather than on the account: it describes the shape of
   * the file the client works with locally, and it must be available before any
   * upload round-trip.
   */
  loadColumnPreferences(): CatalogImportColumns {
    try {
      const stored = localStorage.getItem(COLUMN_PREFERENCE_KEY);
      if (!stored) {
        return { ...DEFAULT_IMPORT_COLUMNS };
      }
      const parsed = JSON.parse(stored) as Partial<CatalogImportColumns>;
      return {
        sku: this.sanitizeColumn(parsed.sku, DEFAULT_IMPORT_COLUMNS.sku),
        quantity: this.sanitizeColumn(parsed.quantity, DEFAULT_IMPORT_COLUMNS.quantity)
      };
    } catch {
      // Corrupt or unavailable storage (private mode, quota) must not stop an import.
      return { ...DEFAULT_IMPORT_COLUMNS };
    }
  }

  /** Remembers the column numbers for the next import from this browser. */
  saveColumnPreferences(columns: CatalogImportColumns): void {
    try {
      localStorage.setItem(COLUMN_PREFERENCE_KEY, JSON.stringify(columns));
    } catch {
      // Storing a preference is a convenience; never let it break the flow.
    }
  }

  private sanitizeColumn(value: unknown, fallback: number): number {
    const column = Number(value);
    if (!Number.isInteger(column) || column < MIN_COLUMN || column > MAX_COLUMN) {
      return fallback;
    }
    return column;
  }

  /** Hands a downloaded export to the browser as a file download. */
  saveToDisk(file: CatalogExportFile): void {
    const url = window.URL.createObjectURL(file.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.filename;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  private toExportFile(response: HttpResponse<Blob>): CatalogExportFile {
    return {
      blob: response.body ?? new Blob(),
      filename: this.filenameFrom(response),
      truncated: response.headers.get('X-Catalog-Export-Truncated') === 'true'
    };
  }

  /**
   * Reads the filename the server chose. Behind a proxy that strips
   * Content-Disposition the header is unreadable, so fall back to a name built
   * the same way the backend builds it.
   */
  private filenameFrom(response: HttpResponse<Blob>): string {
    const disposition = response.headers.get('Content-Disposition');
    const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
    return `catalog_${new Date().toISOString().slice(0, 10)}.xlsx`;
  }

  private toImportResult(dto: CatalogImportResultDto | undefined): CatalogImportResult {
    if (!dto) {
      return { items: [], skipped: [], rowsWithQuantity: 0 };
    }

    return {
      items: (dto.items || []).map(item => ({
        rowNumber: item.row_number,
        productUid: item.product_uid,
        sku: item.sku,
        barcode: item.barcode,
        productName: item.product_name,
        quantity: item.quantity,
        requestedQuantity: item.requested_quantity,
        availableQuantity: item.available_quantity,
        priceWithVat: item.price_with_vat,
        priceFinal: item.price_final,
        discountPercent: item.discount_percent,
        clamped: item.clamped
      })),
      skipped: (dto.skipped || []).map(row => ({
        rowNumber: row.row_number,
        sku: row.sku,
        barcode: row.barcode,
        productName: row.product_name,
        quantity: row.quantity,
        reason: this.skipReason(row.reason)
      })),
      rowsWithQuantity: dto.rows_with_quantity
    };
  }

  private skipReason(raw: string): CatalogImportResult['skipped'][number]['reason'] {
    return raw === 'duplicate' || raw === 'no_stock' ? raw : 'not_found';
  }
}
