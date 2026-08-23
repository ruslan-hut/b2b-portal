import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { formatDateTime } from '../../../core/utils/date-format';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { AuthService } from '../../../core/services/auth.service';
import { AdminService } from '../../../core/services/admin.service';
import { ShipmentStoreContextService } from '../services/shipment-store-context.service';
import { CrmService } from '../../crm/services/crm.service';
import { CrmStage } from '../../crm/models/crm-stage.model';

interface ShipmentServiceSettings {
  id: number;
  store_uid: string | null;
  enabled: boolean;
  default_carrier_uid: string | null;
  auto_track_updates: boolean;
  tracking_poll_interval_minutes: number;
  pickup_booking_stage_uid: string | null;
  service_running: boolean;
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

interface StoreOption {
  value: string;
  label: string;
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

  // Store filter
  selectedStore = '';
  stores: StoreOption[] = [];
  // True when a store-scoped manager is logged in: store selector is locked.
  storeLocked = false;

  // Form fields
  enabled = false;
  defaultCarrierUid: string | null = null;
  autoTrackUpdates = true;
  trackingPollIntervalMinutes = 60;
  pickupBookingStageUid: string | null = null;

  // CRM stages for the pickup-booking trigger selector
  stages: CrmStage[] = [];

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
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private adminService: AdminService,
    private storeContext: ShipmentStoreContextService,
    private crmService: CrmService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    // Store-scoped managers are locked to their own store; everyone else
    // resolves: URL param > shared context > current user's store_uid > all.
    this.storeLocked = this.authService.isStoreScopedManager();
    let initialStore: string;
    if (this.storeLocked) {
      initialStore = this.authService.scopedStoreUid ?? '';
    } else {
      const fromUrl = this.route.snapshot.queryParamMap.get('store') ?? '';
      const fromContext = this.storeContext.value;
      initialStore = fromUrl || fromContext || this.userStoreUid() || '';
    }
    this.selectedStore = initialStore;
    this.storeContext.set(initialStore);
    this.syncStoreToUrl(initialStore, /*replace*/ true);

    this.loadStores();
    this.loadStages();
    this.loadData();
  }

  private loadStages(): void {
    this.subscriptions.add(
      this.crmService.getStages().subscribe({
        next: (stages) => {
          this.stages = (stages || []).filter(s => s.active);
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load CRM stages:', err);
          this.stages = [];
          this.cdr.detectChanges();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  private userStoreUid(): string {
    const entity = this.authService.currentEntityValue as { store_uid?: string } | null;
    return entity?.store_uid ?? '';
  }

  private syncStoreToUrl(store: string, replace = false): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { store: store || null },
      queryParamsHandling: 'merge',
      replaceUrl: replace,
    });
  }

  loadStores(): void {
    this.subscriptions.add(
      this.adminService.listStores().subscribe({
        next: (stores) => {
          this.stores = [
            { value: '', label: 'admin.shipment.allStores' },
            ...stores.map((s: any) => ({ value: s.uid, label: s.name || s.uid }))
          ];
          this.cdr.detectChanges();
        },
        error: () => {
          this.stores = [{ value: '', label: 'admin.shipment.allStores' }];
          this.cdr.detectChanges();
        }
      })
    );
  }

  onStoreChange(): void {
    this.storeContext.set(this.selectedStore);
    this.syncStoreToUrl(this.selectedStore);
    this.loadData();
  }

  private storeParams(): HttpParams {
    let params = new HttpParams();
    if (this.selectedStore) {
      params = params.set('store_uid', this.selectedStore);
    }
    return params;
  }

  loadData(): void {
    this.loading = true;
    this.error = null;

    this.subscriptions.add(
      this.http.get<{ data: ShipmentServiceSettings }>(`${this.apiUrl}/admin/shipment/settings`, {
        params: this.storeParams(),
      }).subscribe({
        next: (response) => {
          this.settings = response.data;
          this.enabled = this.settings.enabled;
          this.defaultCarrierUid = this.settings.default_carrier_uid;
          this.autoTrackUpdates = this.settings.auto_track_updates;
          this.trackingPollIntervalMinutes = this.settings.tracking_poll_interval_minutes;
          this.pickupBookingStageUid = this.settings.pickup_booking_stage_uid ?? null;
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
      this.http.post<{ data: ShipmentCarrier[] }>(
        `${this.apiUrl}/admin/shipment/carriers/active`,
        {},
        { params: this.storeParams() }
      ).subscribe({
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
      tracking_poll_interval_minutes: this.trackingPollIntervalMinutes,
      // Empty string clears the trigger (NULL) server-side; a uid sets it.
      pickup_booking_stage_uid: this.pickupBookingStageUid || ''
    };

    this.subscriptions.add(
      this.http.put<{ data: ShipmentServiceSettings, message?: string }>(
        `${this.apiUrl}/admin/shipment/settings`,
        { data: update },
        { params: this.storeParams() }
      ).subscribe({
        next: (response) => {
          this.settings = response.data;
          this.successMessage = response.message || 'Settings saved successfully';
          this.saving = false;
          this.cdr.detectChanges();

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

  async restartService(): Promise<void> {
    if (!await this.confirmDialog.ask({ message: 'Are you sure you want to restart the shipment service?' })) {
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
    return formatDateTime(dateString);
  }

  getCarrierTypeName(type: string): string {
    const names: Record<string, string> = {
      'dhl24': 'DHL24 (Poland)',
      'dhl_express': 'DHL Express (MyDHL API)',
      'dpd': 'DPD',
      'inpost': 'InPost',
      'novaposhta': 'Nova Poshta (Ukraine)',
      'manual': 'Manual (no API)'
    };
    return names[type] || type;
  }
}
