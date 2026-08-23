import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, DestroyRef, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Maintenance } from '../../core/services/maintenance';
import { BrandingService } from '../../core/services/branding.service';
import { TranslationService } from '../../core/services/translation.service';
import { UserLoginRequest, ClientLoginRequest } from '../../core/models/user.model';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss',
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  loading = false;
  submitted = false;
  errorMessage = '';
  // Set instead of errorMessage when access is closed on purpose (maintenance
  // break, client access switched off). Rendered as a calm notice, not an error.
  noticeMessage = '';
  returnUrl = '';
  // Notice shown above the login form when client access is restricted. Staff
  // must still be able to sign in, so the form itself is never hidden.
  accessNotice = '';
  accessNoticeTitle = '';
  mailEnabled = false;

  private destroyRef = inject(DestroyRef);
  private maintenance = inject(Maintenance);
  private readonly brandingService = inject(BrandingService);

  get siteName(): string {
    return this.brandingService.siteName;
  }

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {
    // Mirror the global maintenance signals into a single notice string.
    effect(() => {
      if (this.maintenance.enabled()) {
        this.accessNoticeTitle = this.translationService.instant('auth.maintenanceTitle');
        this.accessNotice =
          this.maintenance.message() || this.translationService.instant('auth.maintenanceMessage');
      } else if (this.maintenance.denyClientLogin()) {
        this.accessNoticeTitle = this.translationService.instant('auth.clientAccessTitle');
        this.accessNotice = this.translationService.instant('auth.clientAccessDenied');
      } else {
        this.accessNoticeTitle = '';
        this.accessNotice = '';
      }
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    // Initialize unified login form
    this.loginForm = this.formBuilder.group({
      identifier: ['', [Validators.required]], // Can be username or phone
      credential: ['', [Validators.required, Validators.minLength(4)]] // Can be password or PIN
    });

    // Get return URL from route parameters or default to '/products/catalog'
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/products/catalog';

    // Redirect if already logged in based on entity type
    if (this.authService.isAuthenticated()) {
      const entityType = this.authService.entityTypeValue;
      // '/admin' rather than '/admin/dashboard': the landing screen differs per
      // staff role, and adminLandingRedirect is what knows which.
      const targetUrl = entityType === 'user' ? '/admin' : '/products/catalog';
      this.router.navigate([targetUrl]);
    }

    // Maintenance status is provided globally by the Maintenance service (polled
    // every 20s + primed at APP_INITIALIZER). Force a refresh so a freshly opened
    // login tab reflects the current state immediately.
    this.maintenance.refresh().subscribe();

    // Load public auth settings (e.g. whether mail is enabled, to surface forgot-password link)
    this.authService.getAuthSettings().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (settings) => {
        this.mailEnabled = !!settings.mail_enabled;
        this.brandingService.setSiteName(settings.site_name);
        this.cdr.markForCheck();
      },
      error: () => {
        this.mailEnabled = false;
        this.cdr.markForCheck();
      }
    });
  }

  get f() {
    return this.loginForm.controls;
  }

  /**
   * Detect if identifier is a phone number
   * Phone numbers typically start with + or contain only digits and dashes
   */
  private isPhoneNumber(identifier: string): boolean {
    // Remove spaces and dashes for checking
    const cleaned = identifier.replace(/[\s\-]/g, '');

    // Check if it starts with + followed by digits, or is all digits
    const phonePattern = /^\+?\d{10,}$/;
    return phonePattern.test(cleaned);
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.noticeMessage = '';

    // Stop if form is invalid
    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;

    const identifier = this.loginForm.value.identifier;
    const credential = this.loginForm.value.credential;

    // Auto-detect login type based on identifier format
    let credentials: UserLoginRequest | ClientLoginRequest;

    if (this.isPhoneNumber(identifier)) {
      // Client login (phone + PIN)
      credentials = {
        phone: identifier,
        pin_code: credential
      } as ClientLoginRequest;
    } else {
      // User login (username + password)
      credentials = {
        username: identifier,
        password: credential
      } as UserLoginRequest;
    }

    this.authService.login(credentials).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {

        if (response.success) {
          // Navigate based on entity type: Users go to admin zone, Clients go to
          // catalog. '/admin' resolves to the right landing screen for the role.
          const entityType = this.authService.entityTypeValue;
          const targetUrl = entityType === 'user' ? '/admin' : '/products/catalog';
          console.log('Login successful, navigating to:', targetUrl);
          this.router.navigate([targetUrl]);
        } else {
          console.warn('Login response status not success:', response.status_message);
          this.errorMessage = this.translationService.instant('auth.loginError');
          this.loading = false;
          this.cdr.markForCheck();
        }
      },
      error: (error) => {
        console.error('Login error:', error);

        // Extract error message from response if available. Maintenance
        // responses carry the admin-supplied message inside error.error.
        let errorMsg = this.translationService.instant('auth.loginError');
        const errorCode = error?.error?.error?.code;
        if (errorCode === 'MAINTENANCE' || errorCode === 'CLIENT_ACCESS_DENIED') {
          // Deliberate, temporary closure — say so plainly instead of showing a
          // red failure. The admin-supplied maintenance message wins when set;
          // otherwise translate locally (the API message is English-only).
          this.noticeMessage =
            (errorCode === 'MAINTENANCE' && error?.error?.error?.message)
            || this.translationService.instant('auth.clientAccessDenied');
          this.loading = false;
          // Refresh so the notice above the form matches without waiting a poll.
          this.maintenance.refresh().subscribe();
          this.cdr.markForCheck();
          return;
        }
        if (error?.status === 403) {
          // The backend only answers 403 here once the credentials checked out,
          // so the account is deactivated rather than the password being wrong.
          // Translated locally: the API message is English-only.
          errorMsg = this.translationService.instant('auth.accountDeactivated');
        } else if (error?.error?.error?.message) {
          errorMsg = error.error.error.message;
        } else if (error?.error?.status_message) {
          errorMsg = error.error.status_message;
        } else if (error?.error?.message) {
          errorMsg = error.error.message;
        } else if (error?.message) {
          errorMsg = error.message;
        }

        this.errorMessage = errorMsg;
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }
}
