import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResetPasswordComponent implements OnInit {
  form!: FormGroup;
  loading = false;
  submitted = false;
  successMessage = '';
  errorMessage = '';
  token = '';
  done = false;

  private destroyRef = inject(DestroyRef);

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';

    this.form = this.fb.group({
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]]
    }, { validators: this.passwordsMatchValidator });

    if (!this.token) {
      this.errorMessage = this.translationService.instant('auth.resetTokenInvalid');
    }
  }

  get f() {
    return this.form.controls;
  }

  private passwordsMatchValidator(group: AbstractControl): ValidationErrors | null {
    const a = group.get('newPassword')?.value;
    const b = group.get('confirmPassword')?.value;
    if (a && b && a !== b) {
      return { passwordsMismatch: true };
    }
    return null;
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.token) {
      this.errorMessage = this.translationService.instant('auth.resetTokenInvalid');
      return;
    }
    if (this.form.invalid) {
      return;
    }

    this.loading = true;
    const newPassword = this.form.value.newPassword;

    this.authService.resetPassword(this.token, newPassword).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.successMessage = this.translationService.instant('auth.resetSuccess');
        this.loading = false;
        this.done = true;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || this.translationService.instant('auth.resetTokenInvalid');
        this.loading = false;
        this.cdr.markForCheck();
      }
    });
  }

  goToLogin(): void {
    this.router.navigate(['/auth/login']);
  }
}
