import { NgModule, APP_INITIALIZER, Optional, SkipSelf } from '@angular/core';
import { provideHttpClient, withInterceptorsFromDi, HTTP_INTERCEPTORS } from '@angular/common/http';
import { TranslationService } from './services/translation.service';
import { AuthInterceptor } from './interceptors/auth.interceptor';

/**
 * Factory function to initialize translations before app starts
 */
export function initializeTranslations(translationService: TranslationService) {
  return () => translationService.initTranslations();
}

/**
 * CoreModule contains singleton providers (services, interceptors, initializers).
 * Import this module ONLY in AppModule.
 *
 * For shared components and pipes, use SharedModule instead.
 */
@NgModule({
  providers: [
    provideHttpClient(withInterceptorsFromDi()),
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
export class CoreModule {
  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error('CoreModule is already loaded. Import it in AppModule only.');
    }
  }
}
