import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { UserLoginRequest, ClientLoginRequest } from '../../core/models/user.model';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  loading = false;
  submitted = false;
  errorMessage = '';
  returnUrl = '';

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private translationService: TranslationService
  ) {}

  ngOnInit(): void {
    // Initialize unified login form
    this.loginForm = this.formBuilder.group({
      identifier: ['', [Validators.required]], // Can be username or phone
      credential: ['', [Validators.required, Validators.minLength(4)]] // Can be password or PIN
    });

    // Get return URL from route parameters or default to '/products/catalog'
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/products/catalog';

    // Redirect if already logged in
    if (this.authService.isAuthenticated()) {
      this.router.navigate([this.returnUrl]);
    }
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

    this.authService.login(credentials).subscribe({
      next: (response) => {

        if (response.success) {
          console.log('Login successful, navigating to:', this.returnUrl);
          this.router.navigate([this.returnUrl]);
        } else {
          console.warn('Login response status not success:', response.status_message);
          this.errorMessage = this.translationService.instant('auth.loginError');
          this.loading = false;
        }
      },
      error: (error) => {
        console.error('Login error:', error);

        // Extract error message from response if available
        let errorMsg = this.translationService.instant('auth.loginError');
        if (error?.error?.message) {
          errorMsg = error.error.message;
        } else if (error?.message) {
          errorMsg = error.message;
        }

        this.errorMessage = errorMsg;
        this.loading = false;
      }
    });
  }
}
