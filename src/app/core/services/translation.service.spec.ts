import { TestBed } from '@angular/core/testing';

import { TranslationService } from './translation.service';

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TranslationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have default language as en', () => {
    expect(service.getCurrentLanguage()).toBe('en');
  });

  it('should toggle language', () => {
    service.setLanguage('en');
    service.toggleLanguage();
    expect(service.getCurrentLanguage()).toBe('uk');
    service.toggleLanguage();
    expect(service.getCurrentLanguage()).toBe('en');
  });

  it('should return key if translation not found', () => {
    expect(service.instant('nonexistent.key')).toBe('nonexistent.key');
  });
});

