import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  DestroyRef,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/services/translation.service';
import { PageTitleService } from '../../core/services/page-title.service';
import { UserService } from '../../core/services/user.service';
import { User } from '../../core/models/user.model';
import { Subscription } from 'rxjs';

const PASSWORD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const PASSWORD_LENGTH = 16;

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent implements OnInit, OnDestroy {
  user: User | null = null;
  passwordLoading = false;
  passwordErrorMessage = '';
  generatedPassword: string | null = null;
  copied = false;

  receiveEmailNotifications = false;
  allOrders = false;
  notificationsSaving = false;
  notificationsErrorMessage = '';
  notificationsSaved = false;

  private subscriptions = new Subscription();
  private destroyRef = inject(DestroyRef);
  private copyResetTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private authService: AuthService,
    private translationService: TranslationService,
    private pageTitleService: PageTitleService,
    private userService: UserService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle('Profile');

    this.subscriptions.add(
      this.authService.currentEntity$.subscribe(entity => {
        if (entity && this.authService.entityTypeValue === 'user') {
          this.user = entity as User;
          this.receiveEmailNotifications = !!this.user.receive_email_notifications;
          this.allOrders = !!this.user.all_orders;
        } else {
          this.user = null;
        }
        this.cdr.markForCheck();
      })
    );
  }

  saveNotificationPreferences(): void {
    if (!this.user) return;
    this.notificationsSaving = true;
    this.notificationsErrorMessage = '';
    this.notificationsSaved = false;

    this.userService.updateMyPreferences({
      receive_email_notifications: this.receiveEmailNotifications,
      all_orders: this.allOrders
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: prefs => {
          if (this.user) {
            this.user.receive_email_notifications = prefs.receive_email_notifications;
            this.user.all_orders = prefs.all_orders;
          }
          this.notificationsSaving = false;
          this.notificationsSaved = true;
          this.cdr.markForCheck();
        },
        error: error => {
          this.notificationsErrorMessage = error?.error?.message || this.translationService.instant('admin.profile.notificationsSaveError');
          this.notificationsSaving = false;
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.copyResetTimer) {
      clearTimeout(this.copyResetTimer);
    }
  }

  getDisplayName(): string {
    if (!this.user) return '';
    return `${this.user.first_name ?? ''} ${this.user.last_name ?? ''}`.trim();
  }

  initials(): string {
    if (!this.user) return '?';
    const first = (this.user.first_name || '').trim();
    const last = (this.user.last_name || '').trim();
    if (first || last) {
      return ((first.charAt(0) || '') + (last.charAt(0) || '')).toUpperCase() || '?';
    }
    const uname = (this.user.username || '').trim();
    return (uname.slice(0, 2) || '?').toUpperCase();
  }

  onGeneratePassword(currentPassword: string): void {
    this.passwordErrorMessage = '';
    this.generatedPassword = null;
    this.copied = false;

    if (!currentPassword) {
      this.passwordErrorMessage = this.translationService.instant('admin.profile.currentPasswordRequired');
      this.cdr.markForCheck();
      return;
    }

    this.passwordLoading = true;

    const newPassword = this.generatePassword();

    this.authService.changePassword(currentPassword, newPassword)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.generatedPassword = newPassword;
          this.passwordLoading = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.passwordErrorMessage = error?.error?.message || this.translationService.instant('admin.profile.passwordChangeError');
          this.passwordLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  copyGeneratedPassword(): void {
    if (!this.generatedPassword) return;
    navigator.clipboard.writeText(this.generatedPassword).then(() => {
      this.copied = true;
      this.cdr.markForCheck();
      if (this.copyResetTimer) {
        clearTimeout(this.copyResetTimer);
      }
      this.copyResetTimer = setTimeout(() => {
        this.copied = false;
        this.cdr.markForCheck();
      }, 1500);
    });
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/auth/login']),
      error: () => this.router.navigate(['/auth/login'])
    });
  }

  private generatePassword(): string {
    const cryptoObj = (typeof window !== 'undefined' && window.crypto) ? window.crypto : null;
    const result = new Array<string>(PASSWORD_LENGTH);
    if (cryptoObj?.getRandomValues) {
      const buf = new Uint32Array(PASSWORD_LENGTH);
      cryptoObj.getRandomValues(buf);
      for (let i = 0; i < PASSWORD_LENGTH; i++) {
        result[i] = PASSWORD_ALPHABET.charAt(buf[i] % PASSWORD_ALPHABET.length);
      }
    } else {
      for (let i = 0; i < PASSWORD_LENGTH; i++) {
        result[i] = PASSWORD_ALPHABET.charAt(Math.floor(Math.random() * PASSWORD_ALPHABET.length));
      }
    }
    return result.join('');
  }
}
