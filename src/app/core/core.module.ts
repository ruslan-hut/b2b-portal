import { NgModule, APP_INITIALIZER } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from './pipes/translate.pipe';
import { LanguageSwitcherComponent } from './components/language-switcher/language-switcher.component';
import { TranslationService } from './services/translation.service';

/**
 * Factory function to initialize translations before app starts
 */
export function initializeTranslations(translationService: TranslationService) {
  return () => translationService.initTranslations();
}

@NgModule({
  declarations: [
    TranslatePipe,
    LanguageSwitcherComponent
  ],
  imports: [
    CommonModule
  ],
  exports: [
    TranslatePipe,
    LanguageSwitcherComponent
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initializeTranslations,
      deps: [TranslationService],
      multi: true
    }
  ]
})
export class CoreModule { }

