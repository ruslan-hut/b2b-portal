import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';

interface MailSettings {
  id: number;
  provider: string;
  api_key_masked: string;
  has_api_key: boolean;
  sender_email: string;
  sender_name: string;
  reply_to_email: string;
  enabled: boolean;
  client_order_confirmation: boolean;
  admin_new_order_notification: boolean;
  client_status_change_notification: boolean;
  service_connected: boolean;
  created_at: string;
  last_update: string;
}

interface MailTestRequest {
  provider: string;
  api_key: string;
  sender_email: string;
  sender_name: string;
  test_email: string;
}

interface MailTestResponse {
  success: boolean;
  error?: string;
}

@Component({
  selector: 'app-mail-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private apiUrl = environment.apiUrl;

  settings: MailSettings | null = null;
  loading = false;
  saving = false;
  testing = false;
  restarting = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Form fields
  provider = 'brevo';
  apiKey = '';
  senderEmail = '';
  senderName = '';
  replyToEmail = '';
  enabled = false;
  clientOrderConfirmation = true;
  adminNewOrderNotification = true;
  clientStatusChangeNotification = true;

  // Show/hide API key input
  showApiKeyInput = false;

  // Provider options
  providers = [
    { value: 'brevo', label: 'Brevo (Sendinblue)' }
  ];

  // Test email
  testEmail = '';
  testResult: MailTestResponse | null = null;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadSettings(): void {
    this.loading = true;
    this.error = null;

    this.subscriptions.add(
      this.http.get<{ data: MailSettings }>(`${this.apiUrl}/admin/mail/settings`).subscribe({
        next: (response) => {
          this.settings = response.data;
          this.provider = this.settings.provider || 'brevo';
          this.senderEmail = this.settings.sender_email || '';
          this.senderName = this.settings.sender_name || '';
          this.replyToEmail = this.settings.reply_to_email || '';
          this.enabled = this.settings.enabled;
          this.clientOrderConfirmation = this.settings.client_order_confirmation;
          this.adminNewOrderNotification = this.settings.admin_new_order_notification;
          this.clientStatusChangeNotification = this.settings.client_status_change_notification;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load mail settings:', err);
          this.error = 'Failed to load mail settings';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  saveSettings(): void {
    this.saving = true;
    this.error = null;
    this.successMessage = null;

    const update: Record<string, unknown> = {
      provider: this.provider,
      sender_email: this.senderEmail,
      sender_name: this.senderName,
      reply_to_email: this.replyToEmail,
      enabled: this.enabled,
      client_order_confirmation: this.clientOrderConfirmation,
      admin_new_order_notification: this.adminNewOrderNotification,
      client_status_change_notification: this.clientStatusChangeNotification
    };

    // Only include API key if user entered a new one
    if (this.apiKey.trim()) {
      update['api_key'] = this.apiKey;
    }

    this.subscriptions.add(
      this.http.put<{ data: MailSettings, message?: string }>(`${this.apiUrl}/admin/mail/settings`, {
        data: update
      }).subscribe({
        next: (response) => {
          this.settings = response.data;
          this.apiKey = ''; // Clear the API key field
          this.showApiKeyInput = false;
          this.successMessage = response.message || 'Settings saved successfully';
          this.saving = false;
          this.cdr.detectChanges();

          // Clear success message after 3 seconds
          setTimeout(() => {
            this.successMessage = null;
            this.cdr.detectChanges();
          }, 3000);
        },
        error: (err) => {
          console.error('Failed to save settings:', err);
          this.error = err.error?.message || 'Failed to save settings';
          this.saving = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  testConnection(): void {
    if (!this.testEmail.trim()) {
      this.error = 'Please enter a test email address';
      this.cdr.detectChanges();
      return;
    }

    const apiKeyToTest = this.apiKey.trim() || '';
    if (!apiKeyToTest && !this.settings?.has_api_key) {
      this.error = 'Please enter an API key to test';
      this.cdr.detectChanges();
      return;
    }

    if (!this.senderEmail.trim()) {
      this.error = 'Please enter a sender email address';
      this.cdr.detectChanges();
      return;
    }

    this.testing = true;
    this.error = null;
    this.testResult = null;

    const testReq: MailTestRequest = {
      provider: this.provider,
      api_key: apiKeyToTest,
      sender_email: this.senderEmail,
      sender_name: this.senderName || 'Comex B2B',
      test_email: this.testEmail
    };

    this.subscriptions.add(
      this.http.post<{ data: MailTestResponse }>(`${this.apiUrl}/admin/mail/test`, {
        data: testReq
      }).subscribe({
        next: (response) => {
          this.testResult = response.data;
          this.testing = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to test connection:', err);
          this.testResult = {
            success: false,
            error: err.error?.message || 'Failed to test connection'
          };
          this.testing = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  restartService(): void {
    if (!confirm('Are you sure you want to restart the mail service?')) {
      return;
    }

    this.restarting = true;
    this.error = null;
    this.successMessage = null;

    this.subscriptions.add(
      this.http.post<{ message?: string }>(`${this.apiUrl}/admin/mail/restart`, {}).subscribe({
        next: (response) => {
          this.successMessage = response.message || 'Mail service restarted successfully';
          this.restarting = false;
          // Reload settings to get updated runtime info
          this.loadSettings();
        },
        error: (err) => {
          console.error('Failed to restart mail service:', err);
          this.error = err.error?.message || 'Failed to restart mail service';
          this.restarting = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  toggleApiKeyInput(): void {
    this.showApiKeyInput = !this.showApiKeyInput;
    if (!this.showApiKeyInput) {
      this.apiKey = '';
      this.testResult = null;
    }
    this.cdr.detectChanges();
  }

  refresh(): void {
    this.testResult = null;
    this.loadSettings();
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }
}
