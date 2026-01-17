import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';

interface TelegramBotSettings {
  id: number;
  api_key_masked: string;
  has_api_key: boolean;
  bot_name: string;
  admin_id?: number;
  enabled: boolean;
  min_log_level: string;
  created_at: string;
  last_update: string;
  bot_connected: boolean;
  bot_username?: string;
  subscriber_count: number;
}

interface TestConnectionResponse {
  success: boolean;
  bot_username?: string;
  bot_name?: string;
  error?: string;
}

@Component({
  selector: 'app-telegram-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private apiUrl = environment.apiUrl;

  settings: TelegramBotSettings | null = null;
  loading = false;
  saving = false;
  testing = false;
  restarting = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Form fields
  apiKey = '';
  botName = '';
  enabled = false;
  minLogLevel = 'info';

  // Show/hide API key input
  showApiKeyInput = false;

  // Log level options
  logLevels = ['debug', 'info', 'warn', 'error'];

  // Test connection result
  testResult: TestConnectionResponse | null = null;

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
      this.http.get<{ data: TelegramBotSettings }>(`${this.apiUrl}/admin/telegram/settings`).subscribe({
        next: (response) => {
          this.settings = response.data;
          this.botName = this.settings.bot_name || '';
          this.enabled = this.settings.enabled;
          this.minLogLevel = this.settings.min_log_level || 'info';
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load telegram bot settings:', err);
          this.error = 'Failed to load telegram bot settings';
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
      bot_name: this.botName,
      enabled: this.enabled,
      min_log_level: this.minLogLevel
    };

    // Only include API key if user entered a new one
    if (this.apiKey.trim()) {
      update['api_key'] = this.apiKey;
    }

    this.subscriptions.add(
      this.http.put<{ data: TelegramBotSettings, message?: string }>(`${this.apiUrl}/admin/telegram/settings`, {
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
    const apiKeyToTest = this.apiKey.trim() || (this.settings?.has_api_key ? 'current' : '');

    if (!apiKeyToTest) {
      this.error = 'Please enter an API key to test';
      this.cdr.detectChanges();
      return;
    }

    this.testing = true;
    this.error = null;
    this.testResult = null;

    // Use current key if testing existing, otherwise use the new key
    const keyToTest = this.apiKey.trim() ? this.apiKey : '';

    if (!keyToTest && !this.settings?.has_api_key) {
      this.error = 'Please enter an API key to test';
      this.testing = false;
      this.cdr.detectChanges();
      return;
    }

    // If no new key entered, we need to get the current one from settings for test
    // But the backend doesn't expose it directly, so we'll just call test with what we have
    const requestBody = keyToTest ? { data: { api_key: keyToTest } } : { data: {} };

    this.subscriptions.add(
      this.http.post<{ data: TestConnectionResponse }>(`${this.apiUrl}/admin/telegram/settings/test`, {
        data: { api_key: keyToTest }
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

  restartBot(): void {
    if (!confirm('Are you sure you want to restart the Telegram bot?')) {
      return;
    }

    this.restarting = true;
    this.error = null;
    this.successMessage = null;

    this.subscriptions.add(
      this.http.post<{ message?: string }>(`${this.apiUrl}/admin/telegram/settings/restart`, {}).subscribe({
        next: (response) => {
          this.successMessage = response.message || 'Bot restarted successfully';
          this.restarting = false;
          // Reload settings to get updated runtime info
          this.loadSettings();
        },
        error: (err) => {
          console.error('Failed to restart bot:', err);
          this.error = err.error?.message || 'Failed to restart bot';
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
