import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../../environments/environment';

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

interface CarrierTestResponse {
  success: boolean;
  carrier_name?: string;
  api_version?: string;
  message?: string;
  error?: string;
}

interface CrmStage {
  uid: string;
  name: string;
  order: number;
}

interface EventMapping {
  code: string;
  description: string;
  stageUid: string | null;
}

// DHL24 default events
const DHL24_EVENTS: { code: string; description: string }[] = [
  { code: 'AWB', description: 'Shipment created' },
  { code: 'PU', description: 'Picked up' },
  { code: 'DP', description: 'Departed facility' },
  { code: 'AR', description: 'Arrived at facility' },
  { code: 'WC', description: 'With courier for delivery' },
  { code: 'OK', description: 'Delivered' },
  { code: 'DL', description: 'Delivery attempted' },
  { code: 'HD', description: 'Held at depot' },
  { code: 'RT', description: 'In transit' },
  { code: 'RTS', description: 'Return to sender' }
];

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
  stages: CrmStage[] = [];
  loading = false;
  error: string | null = null;

  // Pagination
  page = 1;
  count = 20;
  total = 0;
  totalPages = 1;

  // Edit mode
  showEditForm = false;
  editingCarrier: ShipmentCarrier | null = null;
  carrierForm: FormGroup;

  // Event mappings for form
  eventMappings: EventMapping[] = [];

  // Test mode
  testLoading = false;
  testResult: CarrierTestResponse | null = null;

  // Carrier types
  carrierTypes = [
    { value: 'dhl24', label: 'DHL24 (Poland)' },
    { value: 'dpd', label: 'DPD' },
    { value: 'inpost', label: 'InPost' }
  ];

  constructor(
    private http: HttpClient,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef
  ) {
    this.carrierForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      carrier_type: ['dhl24', Validators.required],
      api_url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      username: ['', Validators.required],
      password: [''],
      account_number: [''],
      default_service_type: ['AH'],
      active: [true],

      // Shipper configuration
      shipper_name: ['', Validators.required],
      shipper_street: ['', Validators.required],
      shipper_city: ['', Validators.required],
      shipper_postal_code: ['', [Validators.required, Validators.pattern(/^\d{5,10}$/)]],
      shipper_phone: ['', [Validators.required, Validators.pattern(/^\d{9,}$/)]],
      shipper_email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {
    this.loadCarriers();
    this.loadStages();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadCarriers(): void {
    this.loading = true;
    this.error = null;

    this.subscriptions.add(
      this.http.get<{ data: ShipmentCarrier[], pagination?: { total: number; total_pages: number } }>(
        `${this.apiUrl}/admin/shipment/carriers`,
        { params: { page: this.page.toString(), count: this.count.toString() } }
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

  loadStages(): void {
    this.subscriptions.add(
      this.http.get<{ data: CrmStage[] }>(`${this.apiUrl}/admin/crm/stages`).subscribe({
        next: (response) => {
          this.stages = response.data || [];
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load stages:', err);
        }
      })
    );
  }

  openNewCarrier(): void {
    this.editingCarrier = null;
    this.carrierForm.reset({
      name: '',
      carrier_type: 'dhl24',
      api_url: '',
      username: '',
      password: '',
      account_number: '',
      default_service_type: 'AH',
      active: true,
      shipper_name: '',
      shipper_street: '',
      shipper_city: '',
      shipper_postal_code: '',
      shipper_phone: '',
      shipper_email: ''
    });
    this.initEventMappings('dhl24', {});
    this.testResult = null;
    this.showEditForm = true;
    this.cdr.detectChanges();
  }

  openEditCarrier(carrier: ShipmentCarrier): void {
    this.editingCarrier = carrier;
    this.carrierForm.patchValue({
      name: carrier.name,
      carrier_type: carrier.carrier_type,
      api_url: carrier.api_url,
      username: carrier.username,
      password: '', // Don't show password
      account_number: carrier.account_number,
      default_service_type: carrier.default_service_type,
      active: carrier.active,

      // Load shipper config
      shipper_name: carrier.config?.shipper_name || '',
      shipper_street: carrier.config?.shipper_street || '',
      shipper_city: carrier.config?.shipper_city || '',
      shipper_postal_code: carrier.config?.shipper_postal_code || '',
      shipper_phone: carrier.config?.shipper_phone || '',
      shipper_email: carrier.config?.shipper_email || ''
    });
    this.initEventMappings(carrier.carrier_type, carrier.event_mappings || {});
    this.testResult = null;
    this.showEditForm = true;
    this.cdr.detectChanges();
  }

  closeEditForm(): void {
    this.showEditForm = false;
    this.editingCarrier = null;
    this.testResult = null;
    this.cdr.detectChanges();
  }

  initEventMappings(carrierType: string, existingMappings: Record<string, string | null>): void {
    const events = this.getEventsForCarrierType(carrierType);
    this.eventMappings = events.map(event => ({
      code: event.code,
      description: event.description,
      stageUid: existingMappings[event.code] ?? null
    }));
  }

  getEventsForCarrierType(carrierType: string): { code: string; description: string }[] {
    switch (carrierType) {
      case 'dhl24':
        return DHL24_EVENTS;
      // Add other carrier events as needed
      default:
        return DHL24_EVENTS; // Default to DHL24 for now
    }
  }

  onCarrierTypeChange(): void {
    const carrierType = this.carrierForm.get('carrier_type')?.value;
    this.initEventMappings(carrierType, {});
    this.cdr.detectChanges();
  }

  saveCarrier(): void {
    if (this.carrierForm.invalid) {
      Object.keys(this.carrierForm.controls).forEach(key => {
        this.carrierForm.get(key)?.markAsTouched();
      });
      return;
    }

    const formValue = this.carrierForm.value;

    // Build event mappings from form
    const eventMappingsObj: Record<string, string | null> = {};
    this.eventMappings.forEach(mapping => {
      eventMappingsObj[mapping.code] = mapping.stageUid;
    });

    // Build shipper config object
    const shipperConfig: ShipperConfig = {
      shipper_name: formValue.shipper_name,
      shipper_street: formValue.shipper_street,
      shipper_city: formValue.shipper_city,
      shipper_postal_code: formValue.shipper_postal_code,
      shipper_phone: formValue.shipper_phone,
      shipper_email: formValue.shipper_email
    };

    const carrier: Partial<ShipmentCarrier> = {
      uid: this.editingCarrier?.uid,
      name: formValue.name,
      carrier_type: formValue.carrier_type,
      api_url: formValue.api_url,
      username: formValue.username,
      account_number: formValue.account_number || '',
      default_service_type: formValue.default_service_type,
      active: formValue.active,
      config: shipperConfig,
      event_mappings: eventMappingsObj
    };

    // Only include password if provided (for updates)
    if (formValue.password) {
      carrier.password = formValue.password;
    }

    this.loading = true;
    this.subscriptions.add(
      this.http.post<{ data: string[] }>(`${this.apiUrl}/admin/shipment/carriers`, {
        data: [carrier]
      }).subscribe({
        next: () => {
          this.loading = false;
          this.closeEditForm();
          this.loadCarriers();
        },
        error: (err) => {
          console.error('Failed to save carrier:', err);
          this.error = err.error?.message || 'Failed to save carrier';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  deleteCarrier(carrier: ShipmentCarrier): void {
    if (!confirm(`Are you sure you want to delete carrier "${carrier.name}"?`)) {
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
    const update: Partial<ShipmentCarrier> = {
      uid: carrier.uid,
      active: !carrier.active
    };

    this.subscriptions.add(
      this.http.post<{ data: string[] }>(`${this.apiUrl}/admin/shipment/carriers`, {
        data: [update]
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

  testCarrier(): void {
    const formValue = this.carrierForm.value;
    if (!formValue.api_url || !formValue.username) {
      return;
    }

    this.testLoading = true;
    this.testResult = null;

    const testRequest = {
      carrier_type: formValue.carrier_type,
      api_url: formValue.api_url,
      username: formValue.username,
      password: formValue.password || undefined,
      account_number: formValue.account_number || undefined,
      // If editing existing carrier, include UID for credential fallback
      carrier_uid: this.editingCarrier?.uid
    };

    this.subscriptions.add(
      this.http.post<{ data: CarrierTestResponse }>(`${this.apiUrl}/admin/shipment/carriers/test`, {
        data: testRequest
      }).subscribe({
        next: (response) => {
          this.testResult = response.data;
          this.testLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to test carrier:', err);
          this.testResult = {
            success: false,
            error: err.error?.message || 'Connection failed'
          };
          this.testLoading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  // Pagination
  goToPage(page: number): void {
    this.page = page;
    this.loadCarriers();
  }

  // Helpers
  getCarrierTypeName(type: string): string {
    const found = this.carrierTypes.find(ct => ct.value === type);
    return found?.label || type;
  }

  getStageName(stageUid: string | null): string {
    if (!stageUid) {
      return 'Record only';
    }
    const stage = this.stages.find(s => s.uid === stageUid);
    return stage?.name || stageUid;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }

  refresh(): void {
    this.loadCarriers();
  }
}
