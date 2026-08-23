import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { formatDateTime } from '../../../core/utils/date-format';
import { ShipmentStoreContextService } from '../services/shipment-store-context.service';
import { AdminService } from '../../../core/services/admin.service';
import { TranslationService } from '../../../core/services/translation.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';

interface ShipperConfig {
  shipper_name?: string;
  shipper_street?: string;
  shipper_city?: string;
  shipper_postal_code?: string;
  shipper_phone?: string;
  shipper_email?: string;
}

interface ShipmentCarrier {
  uid: string;
  name: string;
  carrier_type: string;
  api_url: string;
  username: string;
  password: string;
  account_number: string;
  config: ShipperConfig;
  event_mappings: Record<string, string | null>;
  default_service_type: string;
  active: boolean;
  store_uid: string | null;
  created_at: string;
  last_update: string;
}

@Component({
  selector: 'app-shipment-carriers',
  templateUrl: './carriers.component.html',
  styleUrls: ['./carriers.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CarriersComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private apiUrl = environment.apiUrl;

  carriers: ShipmentCarrier[] = [];
  loading = false;
  error: string | null = null;

  page = 1;
  count = 20;
  total = 0;
  totalPages = 1;

  // Cached store name lookup so the per-card "Store: ..." line shows a human label
  // instead of a UID. Filled lazily by loadStoreLabels().
  private storeNames: Record<string, string> = {};
  currentStoreLabel = '';

  carrierTypes = [
    { value: 'dhl24', label: 'DHL24 (Poland)' },
    { value: 'dhl_express', label: 'DHL Express (MyDHL API)' },
    { value: 'dpd', label: 'DPD' },
    { value: 'inpost', label: 'InPost' },
    { value: 'novaposhta', label: 'Nova Poshta (Ukraine)' },
    { value: 'manual', label: 'Manual (no API)' }
  ];

  constructor(
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private storeContext: ShipmentStoreContextService,
    private adminService: AdminService,
    private translation: TranslationService,
    private confirmDialog: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    // Sync the shared store context from URL on entry, so deep links work and the
    // selection survives a refresh. The settings page owns the dropdown UI.
    const fromUrl = this.route.snapshot.queryParamMap.get('store') ?? '';
    if (fromUrl) {
      this.storeContext.set(fromUrl);
    }
    this.loadStoreLabels();
    this.subscriptions.add(
      this.storeContext.selectedStore$.subscribe((uid) => {
        this.currentStoreLabel = uid ? (this.storeNames[uid] || uid) : '';
        this.loadCarriers();
      })
    );
  }

  private loadStoreLabels(): void {
    this.subscriptions.add(
      this.adminService.listStores().subscribe({
        next: (stores) => {
          this.storeNames = {};
          for (const s of stores || []) {
            this.storeNames[s.uid] = s.name || s.uid;
          }
          const current = this.storeContext.value;
          this.currentStoreLabel = current ? (this.storeNames[current] || current) : '';
          this.cdr.detectChanges();
        }
      })
    );
  }

  storeLabel(uid: string | null | undefined): string {
    if (!uid) {
      return this.translation.translate('admin.shipment.scopeShared');
    }
    return this.storeNames[uid] || uid;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadCarriers(): void {
    this.loading = true;
    this.error = null;

    const offset = (this.page - 1) * this.count;
    let params = new HttpParams()
      .set('offset', offset.toString())
      .set('limit', this.count.toString());
    const store = this.storeContext.value;
    if (store) {
      params = params.set('store_uid', store);
    }

    this.subscriptions.add(
      this.http.get<{ data: ShipmentCarrier[], pagination?: { total: number; total_pages: number } }>(
        `${this.apiUrl}/admin/shipment/carriers`,
        { params }
      ).subscribe({
        next: (response) => {
          this.carriers = response.data || [];
          this.total = response.pagination?.total || this.carriers.length;
          this.totalPages = response.pagination?.total_pages || 1;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load carriers:', err);
          this.error = 'Failed to load carriers';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  openNewCarrier(): void {
    this.router.navigate(['/admin/shipment/carriers/new'], { queryParamsHandling: 'preserve' });
  }

  openEditCarrier(carrier: ShipmentCarrier): void {
    this.router.navigate(['/admin/shipment/carriers', carrier.uid], { queryParamsHandling: 'preserve' });
  }

  async deleteCarrier(carrier: ShipmentCarrier): Promise<void> {
    if (!await this.confirmDialog.ask({ message: `Are you sure you want to delete carrier "${carrier.name}"?`, danger: true })) {
      return;
    }

    this.subscriptions.add(
      this.http.post<void>(`${this.apiUrl}/admin/shipment/carriers/delete`, {
        uids: [carrier.uid]
      }).subscribe({
        next: () => {
          this.loadCarriers();
        },
        error: (err) => {
          console.error('Failed to delete carrier:', err);
          this.error = 'Failed to delete carrier';
          this.cdr.detectChanges();
        }
      })
    );
  }

  toggleCarrierActive(carrier: ShipmentCarrier): void {
    // Deliberately not the upsert endpoint: that one replaces the whole carrier,
    // and the list holds no credentials or driver config to send back.
    this.subscriptions.add(
      this.http.post<{ data: null }>(`${this.apiUrl}/admin/shipment/carriers/set-active`, {
        data: { uid: carrier.uid, active: !carrier.active }
      }).subscribe({
        next: () => {
          carrier.active = !carrier.active;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to update carrier status:', err);
          this.error = 'Failed to update carrier status';
          this.cdr.detectChanges();
        }
      })
    );
  }

  goToPage(page: number): void {
    this.page = page;
    this.loadCarriers();
  }

  getCarrierTypeName(type: string): string {
    const found = this.carrierTypes.find(ct => ct.value === type);
    return found?.label || type;
  }

  formatDate(dateString: string): string {
    return formatDateTime(dateString);
  }

  refresh(): void {
    this.loadCarriers();
  }
}
