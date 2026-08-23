import { NgModule, isDevMode, provideAppInitializer, inject } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CoreModule } from './core/core.module';
import { SharedModule } from './shared/shared.module';
import { ServiceWorkerModule } from '@angular/service-worker';
import { BrandingService } from './core/services/branding.service';
import { ThemeService } from './core/services/theme.service';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,
    CoreModule,
    SharedModule,
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      // Register the ServiceWorker as soon as the application is stable
      // or after 30 seconds (whichever comes first).
      registrationStrategy: 'registerWhenStable:30000'
    })
  ],
  providers: [
    // Load the configurable portal name before the app renders so the browser
    // tab title and header reflect it immediately.
    provideAppInitializer(() => firstValueFrom(inject(BrandingService).load())),

    // Stamp data-theme on <html> before the first paint. ThemeService applies
    // the saved preference from its constructor, so injecting it here is the
    // whole of it — but it has to happen at bootstrap rather than whenever some
    // component that uses it renders.
    //
    // Until this existed the only injector in the app was <app-theme-toggle>,
    // which is absent from the login page and from every public route
    // (/api-guide, /api-docs). Those pages therefore rendered with no
    // data-theme attribute at all, falling back to the bare :root palette: a
    // saved `dark` preference was ignored, and a visitor whose OS is dark got
    // the light theme, because the prefers-color-scheme rule is gated on
    // [data-theme="system"].
    provideAppInitializer(() => { inject(ThemeService); })
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
