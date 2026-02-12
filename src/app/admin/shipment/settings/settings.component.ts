import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';

interface ShipmentServiceSettings {
  id: number;
  enabled: boolean;
  default_carrier_uid: string | null;
  auto_track_updates: boolean;
  tracking_poll_interval_minutes: number;
  service_running: boolean;  // Runtime status from backend
  active_carrier_count: number;
  created_at: string;
  last_update: string;
}

interface ShipmentCarrier {
  uid: string;
  name: string;
  carrier_type: string;
  api_url: string;
  username: string;
  password: string;
  account_number: string;
  config: Record<string, unknown>;
  event_mappings: Record<string, string | null>;
  default_service_type: string;
  active: boolean;
  store_uid: string | null;
  created_at: string;
  last_update: string;
}

@Component({
  selector: 'app-shipment-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private apiUrl = environment.apiUrl;

  settings: ShipmentServiceSettings | null = null;
  carriers: ShipmentCarrier[] = [];
  loading = false;
  saving = false;
  restarting = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Form fields
  enabled = false;
  defaultCarrierUid: string | null = null;
  autoTrackUpdates = true;
  trackingPollIntervalMinutes = 60;

  // Poll interval options
  pollIntervalOptions = [
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 120, label: '2 hours' },
    { value: 240, label: '4 hours' },
    { value: 480, label: '8 hours' }
  ];

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadData(): void {
    this.loading = true;
    this.error = null;

    // Load settings and carriers in parallel
    this.subscriptions.add(
      this.http.get<{ data: ShipmentServiceSettings }>(`${this.apiUrl}/admin/shipment/settings`).subscribe({
        next: (response) => {
          this.settings = response.data;
          this.enabled = this.settings.enabled;
          this.defaultCarrierUid = this.settings.default_carrier_uid;
          this.autoTrackUpdates = this.settings.auto_track_updates;
          this.trackingPollIntervalMinutes = this.settings.tracking_poll_interval_minutes;
          this.loadCarriers();
        },
        error: (err) => {
          console.error('Failed to load shipment settings:', err);
          this.error = 'Failed to load shipment settings';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  loadCarriers(): void {
    this.subscriptions.add(
      this.http.post<{ data: ShipmentCarrier[] }>(`${this.apiUrl}/admin/shipment/carriers/active`, {}).subscribe({
        next: (response) => {
          this.carriers = response.data || [];
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load carriers:', err);
          this.carriers = [];
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
      enabled: this.enabled,
      default_carrier_uid: this.defaultCarrierUid || null,
      auto_track_updates: this.autoTrackUpdates,
      tracking_poll_interval_minutes: this.trackingPollIntervalMinutes
    };

    this.subscriptions.add(
      this.http.put<{ data: ShipmentServiceSettings, message?: string }>(`${this.apiUrl}/admin/shipment/settings`, {
        data: update
      }).subscribe({
        next: (response) => {
          this.settings = response.data;
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

  restartService(): void {
    if (!confirm('Are you sure you want to restart the shipment service?')) {
      return;
    }

    this.restarting = true;
    this.error = null;
    this.successMessage = null;

    this.subscriptions.add(
      this.http.post<{ message?: string }>(`${this.apiUrl}/admin/shipment/restart`, {}).subscribe({
        next: (response) => {
          this.successMessage = response.message || 'Shipment service restarted successfully';
          this.restarting = false;
          // Reload settings to get updated runtime info
          this.loadData();
        },
        error: (err) => {
          console.error('Failed to restart shipment service:', err);
          this.error = err.error?.message || 'Failed to restart shipment service';
          this.restarting = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  refresh(): void {
    this.loadData();
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  getCarrierTypeName(type: string): string {
    const names: Record<string, string> = {
      'dhl24': 'DHL24 (Poland)',
      'dpd': 'DPD',
      'inpost': 'InPost'
    };
    return names[type] || type;
  }
}
