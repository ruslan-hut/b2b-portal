import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPasswordComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  submitted = false;
  successMessage = '';
  errorMessage = '';

  private destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      identifier: ['', [Validators.required, this.identifierValidator]]
    });
  }

  get f() {
    return this.form.controls;
  }

  /**
   * Accept either an email address or a phone-number-like string (digits with
   * optional leading + and separators). Mirrors the auto-detection used on the
   * login page.
   */
  private identifierValidator(control: AbstractControl): ValidationErrors | null {
    const value = (control.value || '').toString().trim();
    if (!value) {
      return null;
    }
    if (ForgotPasswordComponent.isPhoneNumber(value)) {
      return null;
    }
    // Basic email shape check.
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return null;
    }
    return { invalidIdentifier: true };
  }

  static isPhoneNumber(value: string): boolean {
    const cleaned = value.replace(/[\s\-()]/g, '');
    return /^\+?\d{8,}$/.test(cleaned);
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.form.invalid) {
      return;
    }

    this.loading = true;
    const raw = this.form.value.identifier.trim();
    const language = this.translationService.getCurrentLanguage();

    const payload: { email?: string; phone?: string } = ForgotPasswordComponent.isPhoneNumber(raw)
      ? { phone: raw }
      : { email: raw };

    this.authService.forgotPassword(payload, language).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.successMessage = this.translationService.instant('auth.recoverySent');
        this.loading = false;
        this.form.reset();
        this.submitted = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || this.translationService.instant('auth.recoveryError');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }
}
