import { NgModule, APP_INITIALIZER, ErrorHandler, Optional, SkipSelf } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TranslationService } from './services/translation.service';
import { Maintenance } from './services/maintenance';
import { GlobalErrorHandler } from './services/global-error-handler';
import { authInterceptor } from './interceptors/auth.interceptor';

/**
 * Factory function to initialize translations before app starts
 */
export function initializeTranslations(translationService: TranslationService) {
  return () => translationService.initTranslations();
}

/**
 * Start maintenance-status polling once the app boots.
 */
export function initializeMaintenance(maintenance: Maintenance) {
  return () => {
    maintenance.start();
  };
}

/**
 * CoreModule contains singleton providers (services, interceptors, initializers).
 * Import this module ONLY in AppModule.
 *
 * For shared components and pipes, use SharedModule instead.
 */
@NgModule({
  providers: [
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeTranslations,
      deps: [TranslationService],
      multi: true
    },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeMaintenance,
      deps: [Maintenance],
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
