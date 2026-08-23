import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  BinotelConnectionTest,
  BinotelEmployee,
  BinotelService,
  BinotelSettings,
  BinotelSettingsUpdate
} from '../../core/services/binotel.service';
import { AdminUser, UserService } from '../../core/services/user.service';
import { formatDateTime } from '../../core/utils/date-format';

/** Staff roles that can be bound to a phone extension. */
const CALLABLE_ROLES = ['admin', 'manager'];

@Component({
  selector: 'app-binotel',
  templateUrl: './binotel.component.html',
  styleUrl: './binotel.component.scss',
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class BinotelComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  settings: BinotelSettings | null = null;
  loading = false;
  saving = false;
  testing = false;
  loadingEmployees = false;
  error: string | null = null;
  employeesError: string | null = null;
  successMessage: string | null = null;
  testResult: BinotelConnectionTest | null = null;

  // Connection form
  enabled = false;
  apiKey = '';
  apiSecret = '';
  showSecretInput = false;
  companyId = '';
  defaultPbxNumber = '';
  defaultCountry = 'UA';

  // Feature toggles
  callerIdEnabled = true;
  stickyRoutingEnabled = true;
  callLogEnabled = true;
  clickToCallEnabled = true;
  missedCallAlertsEnabled = true;

  // Webhook allowlist
  webhookIpAllowlist = '';
  showAllowlist = false;

  // Extension mapping
  employees: BinotelEmployee[] = [];
  unmappedUsers = 0;
  staff: AdminUser[] = [];
  /** Pending selection per extension, keyed by internal number. */
  mappingSelection: Record<string, string> = {};
  savingMapping: string | null = null;

  readonly countries = [
    { value: 'UA', label: 'Ukraine (+380)' },
    { value: 'PL', label: 'Poland (+48)' }
  ];

  constructor(
    private binotelService: BinotelService,
    private userService: UserService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  get isConfigured(): boolean {
    return !!this.settings?.has_api_secret && !!this.settings?.api_key;
  }

  /** Employees without a SIP line cannot take or place calls at all. */
  get employeesWithoutExtension(): number {
    return this.employees.filter(e => !e.internal_number).length;
  }

  loadSettings(): void {
    this.loading = true;
    this.error = null;

    this.subscriptions.add(
      this.binotelService.getSettings().subscribe({
        next: settings => {
          this.applySettings(settings);
          this.loading = false;
          this.cdr.detectChanges();

          // The mapping table needs a live API call, so it only loads once
          // credentials exist.
          if (this.isConfigured) {
            this.loadEmployees();
          }
        },
        error: err => {
          this.error = err.error?.message || 'Failed to load Binotel settings';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  private applySettings(settings: BinotelSettings): void {
    this.settings = settings;
    this.enabled = settings.enabled;
    this.apiKey = settings.api_key || '';
    this.companyId = settings.company_id || '';
    this.defaultPbxNumber = settings.default_pbx_number || '';
    this.defaultCountry = settings.default_country || 'UA';
    this.webhookIpAllowlist = settings.webhook_ip_allowlist || '';
    this.callerIdEnabled = settings.caller_id_enabled;
    this.stickyRoutingEnabled = settings.sticky_routing_enabled;
    this.callLogEnabled = settings.call_log_enabled;
    this.clickToCallEnabled = settings.click_to_call_enabled;
    this.missedCallAlertsEnabled = settings.missed_call_alerts_enabled;
  }

  saveSettings(): void {
    this.saving = true;
    this.error = null;
    this.successMessage = null;

    const update: BinotelSettingsUpdate = {
      enabled: this.enabled,
      api_key: this.apiKey.trim(),
      company_id: this.companyId.trim(),
      default_pbx_number: this.defaultPbxNumber.trim(),
      default_country: this.defaultCountry,
      webhook_ip_allowlist: this.webhookIpAllowlist.trim(),
      caller_id_enabled: this.callerIdEnabled,
      sticky_routing_enabled: this.stickyRoutingEnabled,
      call_log_enabled: this.callLogEnabled,
      click_to_call_enabled: this.clickToCallEnabled,
      missed_call_alerts_enabled: this.missedCallAlertsEnabled
    };

    // Only send the secret when the admin typed a new one. The server ignores
    // the masked form too, but not sending it keeps the payload honest.
    if (this.apiSecret.trim()) {
      update.api_secret = this.apiSecret.trim();
    }

    this.subscriptions.add(
      this.binotelService.updateSettings(update).subscribe({
        next: settings => {
          this.applySettings(settings);
          this.apiSecret = '';
          this.showSecretInput = false;
          this.saving = false;
          this.successMessage = 'Settings saved successfully';
          this.cdr.detectChanges();

          setTimeout(() => {
            this.successMessage = null;
            this.cdr.detectChanges();
          }, 3000);
        },
        error: err => {
          this.error = err.error?.message || 'Failed to save Binotel settings';
          this.saving = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  testConnection(): void {
    this.testing = true;
    this.testResult = null;
    this.cdr.detectChanges();

    this.subscriptions.add(
      this.binotelService.testConnection().subscribe({
        next: result => {
          this.testResult = result;
          this.testing = false;
          this.cdr.detectChanges();

          // A successful test means the employee list is now reachable.
          if (result.success) {
            this.loadEmployees();
          }
        },
        error: err => {
          this.testResult = {
            success: false,
            employee_count: 0,
            message: err.error?.message || 'Connection test failed'
          };
          this.testing = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  loadEmployees(): void {
    this.loadingEmployees = true;
    this.employeesError = null;
    this.cdr.detectChanges();

    this.subscriptions.add(
      forkJoin({
        employees: this.binotelService.listEmployees(),
        staff: this.userService.getUsers(CALLABLE_ROLES).pipe(catchError(() => of([] as AdminUser[])))
      }).subscribe({
        next: ({ employees, staff }) => {
          this.employees = employees.employees;
          this.unmappedUsers = employees.unmapped_users;
          this.staff = staff;

          this.mappingSelection = {};
          for (const employee of this.employees) {
            if (employee.internal_number) {
              this.mappingSelection[employee.internal_number] = employee.mapped_user_uid || '';
            }
          }

          this.loadingEmployees = false;
          this.cdr.detectChanges();
        },
        error: err => {
          this.employeesError = err.error?.message || 'Failed to load PBX employees';
          this.loadingEmployees = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  saveMapping(employee: BinotelEmployee): void {
    if (!employee.internal_number) {
      return;
    }

    const selectedUid = this.mappingSelection[employee.internal_number] || '';
    this.savingMapping = employee.internal_number;
    this.employeesError = null;
    this.cdr.detectChanges();

    // Clearing a mapping means unbinding whoever currently holds the extension,
    // so the request targets the previously mapped user, not the new selection.
    const targetUid = selectedUid || employee.mapped_user_uid || '';
    if (!targetUid) {
      this.savingMapping = null;
      this.cdr.detectChanges();
      return;
    }

    const extension = selectedUid ? employee.internal_number : '';

    this.subscriptions.add(
      this.binotelService.setUserMapping(targetUid, extension).subscribe({
        next: () => {
          this.savingMapping = null;
          this.loadEmployees();
        },
        error: err => {
          this.employeesError = err.error?.message || 'Failed to save the mapping';
          this.savingMapping = null;
          // Put the row back to what the server believes.
          this.mappingSelection[employee.internal_number] = employee.mapped_user_uid || '';
          this.cdr.detectChanges();
        }
      })
    );
  }

  toggleSecretInput(): void {
    this.showSecretInput = !this.showSecretInput;
    if (!this.showSecretInput) {
      this.apiSecret = '';
    }
    this.cdr.detectChanges();
  }

  toggleAllowlist(): void {
    this.showAllowlist = !this.showAllowlist;
    this.cdr.detectChanges();
  }

  staffLabel(user: AdminUser): string {
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return name ? `${name} (${user.username})` : user.username;
  }

  statusIcon(status: string): string {
    switch (status) {
      case 'online':
        return 'check_circle';
      case 'inuse':
        return 'phone_in_talk';
      case 'ringing':
        return 'ring_volume';
      default:
        return 'do_not_disturb_on';
    }
  }

  refresh(): void {
    this.loadSettings();
  }

  formatDate(dateString: string): string {
    return formatDateTime(dateString);
  }
}
