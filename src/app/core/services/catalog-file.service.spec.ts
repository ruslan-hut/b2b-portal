import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { HttpHeaders } from '@angular/common/http';
import { CatalogFileService } from './catalog-file.service';
import { TranslationService } from './translation.service';
import { environment } from '../../../environments/environment';
import { CatalogExportFile, CatalogImportResult } from '../models/catalog-file.model';

describe('CatalogFileService', () => {
  let service: CatalogFileService;
  let httpMock: HttpTestingController;

  const exportUrl = `${environment.apiUrl}/frontend/catalog/export`;
  const importUrl = `${environment.apiUrl}/frontend/catalog/import`;

  beforeEach(() => {
    const translationSpy = jasmine.createSpyObj('TranslationService', ['getCurrentLanguage']);
    translationSpy.getCurrentLanguage.and.returnValue('uk');

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CatalogFileService,
        { provide: TranslationService, useValue: translationSpy }
      ]
    });

    service = TestBed.inject(CatalogFileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem('catalogImportColumns');
  });

  describe('export', () => {
    it('posts the format, categories and current UI language', () => {
      service.export({ format: 'image', categoryUids: ['cat-1', 'cat-2'] }).subscribe();

      const req = httpMock.expectOne(exportUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        format: 'image',
        category_uids: ['cat-1', 'cat-2'],
        language: 'uk'
      });
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['x']));
    });

    it('reads the filename from Content-Disposition', () => {
      let result: CatalogExportFile | undefined;
      service.export({ format: 'text', categoryUids: [] }).subscribe(file => (result = file));

      httpMock.expectOne(exportUrl).flush(new Blob(['x']), {
        headers: new HttpHeaders({ 'Content-Disposition': 'attachment; filename="catalog_2026-07-29.xlsx"' })
      });

      expect(result?.filename).toBe('catalog_2026-07-29.xlsx');
      expect(result?.truncated).toBeFalse();
    });

    it('falls back to a generated filename when the header is unreadable', () => {
      let result: CatalogExportFile | undefined;
      service.export({ format: 'text', categoryUids: [] }).subscribe(file => (result = file));

      httpMock.expectOne(exportUrl).flush(new Blob(['x']));

      expect(result?.filename).toMatch(/^catalog_\d{4}-\d{2}-\d{2}\.xlsx$/);
    });

    it('surfaces the truncation flag', () => {
      let result: CatalogExportFile | undefined;
      service.export({ format: 'text', categoryUids: [] }).subscribe(file => (result = file));

      httpMock.expectOne(exportUrl).flush(new Blob(['x']), {
        headers: new HttpHeaders({ 'X-Catalog-Export-Truncated': 'true' })
      });

      expect(result?.truncated).toBeTrue();
    });
  });

  describe('import', () => {
    const file = new File(['x'], 'catalog.xlsx');

    it('uploads the file as multipart form data', () => {
      service.import(file).subscribe();

      const req = httpMock.expectOne(importUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body instanceof FormData).toBeTrue();
      expect((req.request.body as FormData).get('file')).toBeTruthy();
      req.flush({ success: true, data: { items: [], skipped: [], rows_with_quantity: 0 } });
    });

    it('sends the export column layout by default', () => {
      service.import(file).subscribe();

      const form = httpMock.expectOne(importUrl).request.body as FormData;
      expect(form.get('sku_column')).toBe('2');
      expect(form.get('quantity_column')).toBe('4');
      httpMock.expectNone(importUrl);
    });

    it('sends the caller-chosen columns', () => {
      service.import(file, { sku: 3, quantity: 1 }).subscribe();

      const form = httpMock.expectOne(importUrl).request.body as FormData;
      expect(form.get('sku_column')).toBe('3');
      expect(form.get('quantity_column')).toBe('1');
    });

    it('maps the wire shape onto the client model', () => {
      let result: CatalogImportResult | undefined;
      service.import(file).subscribe(r => (result = r));

      httpMock.expectOne(importUrl).flush({
        success: true,
        data: {
          items: [
            {
              row_number: 2,
              product_uid: 'p1',
              sku: 'KK05',
              barcode: '4823126210476',
              product_name: 'Пензлик',
              quantity: 2,
              requested_quantity: 5,
              available_quantity: 2,
              price_with_vat: 21500,
              price_final: 15050,
              discount_percent: 30,
              clamped: true
            }
          ],
          skipped: [{ row_number: 7, sku: 'OLD', quantity: 1, reason: 'no_stock' }],
          rows_with_quantity: 2
        }
      });

      expect(result!).toEqual({
        items: [
          {
            rowNumber: 2,
            productUid: 'p1',
            sku: 'KK05',
            barcode: '4823126210476',
            productName: 'Пензлик',
            quantity: 2,
            requestedQuantity: 5,
            availableQuantity: 2,
            priceWithVat: 21500,
            priceFinal: 15050,
            discountPercent: 30,
            clamped: true
          }
        ],
        skipped: [
          {
            rowNumber: 7,
            sku: 'OLD',
            barcode: undefined,
            productName: undefined,
            quantity: 1,
            reason: 'no_stock'
          }
        ],
        rowsWithQuantity: 2
      });
    });

    it('tolerates null collections and unknown skip reasons', () => {
      let result: CatalogImportResult | undefined;
      service.import(file).subscribe(r => (result = r));

      httpMock.expectOne(importUrl).flush({
        success: true,
        data: {
          items: null,
          skipped: [{ row_number: 3, quantity: 1, reason: 'something-new' }],
          rows_with_quantity: 1
        }
      });

      expect(result!.items).toEqual([]);
      expect(result!.skipped[0].reason).toBe('not_found');
    });
  });
});

describe('CatalogFileService column preferences', () => {
  let service: CatalogFileService;

  beforeEach(() => {
    localStorage.removeItem('catalogImportColumns');

    const translationSpy = jasmine.createSpyObj('TranslationService', ['getCurrentLanguage']);
    translationSpy.getCurrentLanguage.and.returnValue('en');

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CatalogFileService,
        { provide: TranslationService, useValue: translationSpy }
      ]
    });
    service = TestBed.inject(CatalogFileService);
  });

  afterEach(() => localStorage.removeItem('catalogImportColumns'));

  it('falls back to the export layout when nothing was stored', () => {
    expect(service.loadColumnPreferences()).toEqual({ sku: 2, quantity: 4 });
  });

  it('round-trips a saved choice', () => {
    service.saveColumnPreferences({ sku: 5, quantity: 9 });
    expect(service.loadColumnPreferences()).toEqual({ sku: 5, quantity: 9 });
  });

  it('ignores stored values that are not usable columns', () => {
    localStorage.setItem('catalogImportColumns', JSON.stringify({ sku: 0, quantity: 'x' }));
    expect(service.loadColumnPreferences()).toEqual({ sku: 2, quantity: 4 });
  });

  it('survives corrupt storage', () => {
    localStorage.setItem('catalogImportColumns', 'not json');
    expect(service.loadColumnPreferences()).toEqual({ sku: 2, quantity: 4 });
  });
});
