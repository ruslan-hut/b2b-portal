import { Pipe, PipeTransform, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { TranslationService } from '../services/translation.service';
import { Subscription } from 'rxjs';

@Pipe({
  name: 'translate',
  pure: false // Make it impure so it updates when language changes
})
export class TranslatePipe implements PipeTransform, OnDestroy {
  private lastValue: string = '';
  private lastKey: string = '';
  private lastLanguage: string = '';
  private subscription?: Subscription;

  constructor(
    private translationService: TranslationService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    // Subscribe to language changes
    this.subscription = this.translationService.currentLanguage$.subscribe(() => {
      // Reset cache when language changes
      this.lastValue = '';
      this.lastKey = '';
      this.lastLanguage = '';
      this.changeDetectorRef.markForCheck();
    });
  }

  transform(key: string, params?: { [key: string]: string | number }): string {
    if (!key) {
      return '';
    }

    const currentLanguage = this.translationService.getCurrentLanguage();
    
    // Re-translate if key changed, language changed, or params provided
    if (key !== this.lastKey || currentLanguage !== this.lastLanguage || params) {
      this.lastKey = key;
      this.lastLanguage = currentLanguage;
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

