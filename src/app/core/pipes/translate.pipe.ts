import { Pipe, PipeTransform, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { TranslationService } from '../services/translation.service';
import { Subscription } from 'rxjs';

@Pipe({
    name: 'translate',
    pure: false // Make it impure so it updates when language changes
    ,
    standalone: false
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private lastValue: string = '';
  private lastKey: string = '';
  private lastLanguage: string = '';
  private lastParams?: { [key: string]: string | number };
  private translationsLoaded: boolean = false;
  private subscription?: Subscription;

  constructor(
    private translationService: TranslationService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    // Check if translations are already loaded
    this.translationsLoaded = this.translationService.areTranslationsLoaded();
    
    // Subscribe to translation updates (includes language changes and initial load)
    this.subscription = this.translationService.translations$.subscribe(() => {
      // Mark translations as loaded
      this.translationsLoaded = this.translationService.areTranslationsLoaded();
      // Reset cache when translations update
      this.lastValue = '';
      this.lastKey = '';
      this.lastLanguage = '';
      this.lastParams = undefined;
      this.changeDetectorRef.markForCheck();
    });
  }

  transform(key: string, params?: { [key: string]: string | number }): string {
    if (!key) {
      return '';
    }

    const currentLanguage = this.translationService.getCurrentLanguage();
    const currentTranslationsLoaded = this.translationService.areTranslationsLoaded();
    
    // Re-translate if:
    // - key changed
    // - language changed
    // - translations just loaded (wasn't loaded before, but now is)
    // - params changed (if params are provided)
    const paramsChanged = (params !== undefined || this.lastParams !== undefined) && 
      JSON.stringify(params || {}) !== JSON.stringify(this.lastParams || {});
    const shouldRetranslate = 
      key !== this.lastKey || 
      currentLanguage !== this.lastLanguage || 
      (!this.translationsLoaded && currentTranslationsLoaded) ||
      paramsChanged;
    
    if (shouldRetranslate) {
      this.lastKey = key;
      this.lastLanguage = currentLanguage;
      this.translationsLoaded = currentTranslationsLoaded;
      this.lastParams = params;
      this.lastValue = this.translationService.instant(key, params);
    }

    return this.lastValue;
  }

  ngOnDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
}

