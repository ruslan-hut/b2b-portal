import { TestBed } from '@angular/core/testing';
import { RouterModule, provideRouter } from '@angular/router';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import { ServiceWorkerModule } from '@angular/service-worker';
import { SharedModule } from './shared/shared.module';
import { environment } from '../environments/environment';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // SharedModule supplies the shell's own children (maintenance banner,
      // update notification, toasts, confirm dialog) and the translate pipe.
      imports: [
        SharedModule,
        RouterModule,
        HttpClientTestingModule,
        // AppUpdateService (inside the update-notification child) injects SwUpdate.
        ServiceWorkerModule.register('', { enabled: false })
      ],
      declarations: [AppComponent],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should fall back to the build-time app title until branding loads', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance.title).toEqual(environment.appTitle || 'B2B Portal');
  });

  it('should not render the header while no entity is signed in', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.app-header')).toBeNull();
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
