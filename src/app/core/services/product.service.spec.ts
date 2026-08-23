import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { FrontendCategory, ProductService } from './product.service';
import { TranslationService } from './translation.service';
import { environment } from '../../../environments/environment';

describe('ProductService', () => {
  let service: ProductService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    const translationSpy = jasmine.createSpyObj('TranslationService', ['getCurrentLanguage']);
    translationSpy.getCurrentLanguage.and.returnValue('uk');

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: TranslationService, useValue: translationSpy }]
    });
    service = TestBed.inject(ProductService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getFrontendCategories', () => {
    const url = `${environment.apiUrl}/frontend/categories?language=uk`;

    // Every category list in the client UI — the catalog filter and the export
    // picker — reads this one ordering, so it must not depend on the caller.
    it('sorts categories by name', () => {
      let result: FrontendCategory[] | undefined;
      service.getFrontendCategories().subscribe(categories => (result = categories));

      httpMock.expectOne(url).flush({
        success: true,
        data: [
          { uid: 'c1', name: 'Фрези' },
          { uid: 'c2', name: 'Гель-лаки' },
          { uid: 'c3', name: 'Пензлики' }
        ]
      });

      expect(result!.map(c => c.name)).toEqual(['Гель-лаки', 'Пензлики', 'Фрези']);
    });

    it('returns an empty list when the response carries no data', () => {
      let result: FrontendCategory[] | undefined;
      service.getFrontendCategories().subscribe(categories => (result = categories));

      httpMock.expectOne(url).flush({ success: false });

      expect(result).toEqual([]);
    });
  });
});
