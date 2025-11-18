import { NgModule, APP_INITIALIZER } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { TranslatePipe } from './pipes/translate.pipe';
import { LanguageSwitcherComponent } from './components/language-switcher/language-switcher.component';
import { UpdateNotificationComponent } from './components/update-notification/update-notification.component';
import { TranslationService } from './services/translation.service';
import { AuthInterceptor } from './interceptors/auth.interceptor';

/**
 * Factory function to initialize translations before app starts
 */
export function initializeTranslations(translationService: TranslationService) {
  return () => translationService.initTranslations();
}

@NgModule({
  declarations: [
    TranslatePipe,
    LanguageSwitcherComponent,
    UpdateNotificationComponent
  ],
  imports: [
    CommonModule,
    HttpClientModule
  ],
  exports: [
    TranslatePipe,
    LanguageSwitcherComponent,
    UpdateNotificationComponent
  ],
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: initializeTranslations,
      deps: [TranslationService],
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ]
})
export class CoreModule { }

