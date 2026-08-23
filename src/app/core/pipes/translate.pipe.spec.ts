import { TranslatePipe } from './translate.pipe';
import { TranslationService } from '../services/translation.service';
import { ChangeDetectorRef } from '@angular/core';
import { of } from 'rxjs';

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;
  let translationService: jasmine.SpyObj<TranslationService>;
  let changeDetectorRef: jasmine.SpyObj<ChangeDetectorRef>;

  beforeEach(() => {
    // The pipe reads areTranslationsLoaded()/getCurrentLanguage() in its
    // constructor and on every transform, and re-subscribes on translations$.
    const translationServiceSpy = jasmine.createSpyObj(
      'TranslationService',
      ['instant', 'areTranslationsLoaded', 'getCurrentLanguage'],
      { translations$: of({}) }
    );
    translationServiceSpy.areTranslationsLoaded.and.returnValue(true);
    translationServiceSpy.getCurrentLanguage.and.returnValue('en');

    const changeDetectorRefSpy = jasmine.createSpyObj('ChangeDetectorRef', ['markForCheck']);

    translationService = translationServiceSpy;
    changeDetectorRef = changeDetectorRefSpy;

    pipe = new TranslatePipe(translationService, changeDetectorRef);
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  it('should return empty string for empty key', () => {
    expect(pipe.transform('')).toBe('');
  });

  it('should call translationService.instant with correct key', () => {
    translationService.instant.and.returnValue('Translated Text');
    const result = pipe.transform('test.key');
    expect(translationService.instant).toHaveBeenCalledWith('test.key', undefined);
    expect(result).toBe('Translated Text');
  });
});

