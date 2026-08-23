import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  effect,
  inject
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Maintenance, MaintenanceStatus } from '../../../core/services/maintenance';
import { TranslationService } from '../../../core/services/translation.service';

@Component({
  selector: 'app-maintenance-settings',
  templateUrl: './maintenance-settings.component.html',
  styleUrl: './maintenance-settings.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MaintenanceSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslationService);
  protected readonly maintenance = inject(Maintenance);

  form!: FormGroup;
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor() {
    // Repopulate form when the global maintenance state changes from elsewhere
    // (e.g. another admin tab). The user's in-flight edits are not clobbered
    // because we only seed when the form is pristine.
    effect(() => {
      const status = this.maintenance.status();
      if (this.form && this.form.pristine) {
        this.applyStatusToForm(status);
      }
    });
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      enabled: [false],
      message: [''],
      endsAtLocal: [''], // datetime-local string ("YYYY-MM-DDTHH:mm")
      denyClientLogin: [false],
      denyApiConnections: [false]
    });

    // Initial seed from cached signal value (set by APP_INITIALIZER).
    this.applyStatusToForm(this.maintenance.status());
    this.form.markAsPristine();

    // Re-fetch to ensure we show the freshest values.
    this.maintenance.refresh().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  onSubmit(): void {
    if (!this.form) return;
    this.errorMessage = '';
    this.successMessage = '';

    const enabled = !!this.form.value.enabled;
    const message = String(this.form.value.message ?? '').trim();
    const endsAt = parseLocalDateTimeToUtcMs(this.form.value.endsAtLocal);
    const denyClientLogin = !!this.form.value.denyClientLogin;
    const denyApiConnections = !!this.form.value.denyApiConnections;

    if (enabled && this.form.value.endsAtLocal && endsAt === 0) {
      this.errorMessage = this.translate.instant('admin.maintenance.invalidEndTime');
      return;
    }

    this.loading = true;
    this.cdr.markForCheck();

    this.maintenance.update({ enabled, message, endsAt, denyClientLogin, denyApiConnections }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = this.translate.instant(
          enabled
            ? 'admin.maintenance.enabledNotice'
            : denyClientLogin || denyApiConnections
              ? 'admin.maintenance.restrictedNotice'
              : 'admin.maintenance.disabledNotice'
        );
        this.form.markAsPristine();
        this.cdr.markForCheck();
      },
      error: err => {
        this.loading = false;
        this.errorMessage =
          err?.error?.error?.message
          || err?.error?.status_message
          || this.translate.instant('admin.maintenance.updateError');
        this.cdr.markForCheck();
      }
    });
  }

  back(): void {
    this.router.navigate(['/admin/settings']);
  }

  private applyStatusToForm(status: MaintenanceStatus): void {
    if (!this.form) return;
    const endsAtMs = status.endsAt ?? 0;
    this.form.patchValue(
      {
        enabled: status.enabled,
        message: status.message ?? '',
        endsAtLocal: endsAtMs > 0 ? formatUtcMsAsLocalInput(endsAtMs) : '',
        denyClientLogin: status.denyClientLogin ?? false,
        denyApiConnections: status.denyApiConnections ?? false
      },
      { emitEvent: false }
    );
  }
}

function parseLocalDateTimeToUtcMs(local: string | null | undefined): number {
  if (!local) return 0;
  const t = new Date(local).getTime();
  return Number.isFinite(t) ? t : 0;
}

function formatUtcMsAsLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
