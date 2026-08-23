import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { AdminService } from '../../../../core/services/admin.service';
import { ShipmentStoreContextService } from '../../services/shipment-store-context.service';
import { TranslationService } from '../../../../core/services/translation.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { formatDateTime } from '../../../../core/utils/date-format';

interface ShipperConfig {
  shipper_name?: string;
  shipper_street?: string;
  shipper_city?: string;
  shipper_postal_code?: string;
  shipper_phone?: string;
  shipper_email?: string;
  // Person the carrier contacts about the parcel. On DHL24 this is also the
  // declarant named on a customs declaration (firstName / secondaryName), where
  // the company name is a poor fit. Optional.
  shipper_contact_person?: string;
  // InPost-only: ShipX dispatch_point_id used as the pickup address for
  // courier dispatch orders. When 0/unset, the inline shipper address above is
  // used instead.
  inpost_dispatch_point_id?: number;
  // InPost-only: opt out of auto-booking courier pickups (e.g. when the
  // organization has a standing daily-pickup arrangement).
  inpost_pickup_disabled?: boolean;
  // InPost-only: ShipX custom_attributes.sending_method applied to every
  // shipment. "" = legacy default ("dispatch_order" if pickup enabled).
  // Valid: "parcel_locker" | "dispatch_order" | "dispatch_point".
  inpost_sending_method?: string;
  // InPost-only: source Paczkomat code (e.g. "WAW721M") used when
  // sending_method=parcel_locker.
  inpost_dropoff_point?: string;
  // InPost-only: label printout format ("Pdf" | "ZebraDpl" | "EPL2") and paper
  // size ("A6" | "A4"). Default Pdf/A6.
  inpost_label_format?: string;
  inpost_label_type?: string;
  // GLS-only: ADE label format ("one_label_on_a4_pdf", "roll_160x100_zebra", …).
  gls_label_mode?: string;
  // GLS-only: skip the automatic end-of-day pickup receipt (adePickup_Create),
  // for accounts that close their receipts by hand in ADE-Plus.
  gls_auto_pickup_disabled?: boolean;
  // GLS-only: GLS-issued integrator id. Present only for software vendors; it
  // switches login from adeLogin to adeLoginIntegrator.
  gls_integrator_id?: string;
  // GLS-only: cost centre (MPK) id stamped on every consignment.
  gls_pfc?: string;
  // GLS-only: Track&Trace is a separate GLS system with its own Uni-Portal
  // (your-gls.eu) credentials. Without them a GLS parcel gets a label but never
  // reports a status.
  gls_tracking_api_url?: string;
  gls_tracking_username?: string;
  gls_tracking_password?: string;
  // DHL24-only: when false, an order with multiple boxes is sent as separate
  // single-parcel shipments (one AWB per box) instead of one multi-parcel AWB.
  // Defaults to true.
  support_multiparcel?: boolean;
  // DHL24-only: default insurance mode pre-selected in the shipment creation
  // dialog. "" = no insurance (default), "order_total", "manual".
  default_insurance_mode?: string;
  // DHL24-only customs settings (applied to shipments outside the EU customs
  // union). customs_type: "S" simplified | "I" individual. customs_category:
  // categoryOfItem code (e.g. "11" sale of goods). The default tariff/origin
  // fill in for products that lack their own HS code / country of origin.
  customs_type?: string;
  customs_category?: string;
  customs_default_tariff_code?: string;
  customs_default_country_of_origin?: string;
  shipper_eori?: string;
  shipper_nip?: string;
  shipper_vat?: string;
  // DHL Express-only. Credentials come from developer.dhl.com (API Key ->
  // username, API Secret -> password); account_number is the DHL Express
  // shipper account, which is a different value entirely.
  shipper_country_code?: string;
  shipper_company_name?: string;
  // Who pays duty on non-EU shipments: "DAP" (receiver) or "DDP" (us). DDP
  // requires dhl_duties_account_number — the backend rejects the pair without it.
  dhl_incoterm?: string;
  dhl_duties_account_number?: string;
  // Bills transportation to an account other than the shipper's — MyDHL+ shows
  // the pair as "DHL Account" and "Payer Account". Empty means the shipper pays.
  dhl_payer_account_number?: string;
  dhl_receiver_type_code?: string;
  dhl_content_description?: string;
  // Book a courier when the shipment is created. Leave off when the account has
  // a standing daily pickup.
  dhl_request_pickup?: boolean;
  dhl_pickup_close_time?: string;
  dhl_label_template?: string;
  dhl_billing_currency?: string;
  dhl_timezone?: string;
  // Ask DHL to generate the commercial invoice alongside the label for
  // customs-declarable shipments.
  dhl_request_invoice_image?: boolean;
  // Paperless Trade (DHL service WY): customs invoice and export declaration
  // travel electronically instead of in a wallet on the parcel. Only applied to
  // shipments that clear customs.
  dhl_paperless_trade?: boolean;
  // Relaxes PLT's lane check — an unsupported lane falls back to paper instead
  // of being rejected. Off by default so surprises are loud.
  dhl_bypass_plt_error?: boolean;
  customs_export_reason_type?: string;
  customs_shipment_type?: string;
  // Nova Poshta-only: sender identity Refs (resolved once from the NP account)
  // plus per-shipment defaults. The API key lives in the carrier password.
  sender_city_ref?: string;
  sender_ref?: string;
  sender_address_ref?: string;
  sender_contact_ref?: string;
  sender_phone?: string;
  payer_type?: string;
  payment_method?: string;
  cargo_type?: string;
  declared_cost?: number;
}

interface NpSetupResult {
  counterparties: { ref: string; name: string; edrpou?: string }[];
  contacts: { ref: string; name: string; phone?: string }[];
  warehouse?: { city_ref: string; city_name: string; warehouse_ref: string; warehouse_number: string; warehouse_desc: string };
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
  // Optional link to an ERP company; shipments for orders of other companies
  // will not offer this carrier. null = available for any company.
  company_uid?: string | null;
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

// DHL24 webapi2 tracking status codes — must match backend
// shipment/dhl24/mapping.go (confirmed against live getTrackAndTraceInfo).
const DHL24_EVENTS: { code: string; description: string }[] = [
  { code: 'EDWP', description: 'Shipment data received' },
  { code: 'DWP', description: 'Collected from sender' },
  { code: 'SORT', description: 'At sorting center' },
  { code: 'LP', description: 'Arrived at branch' },
  { code: 'LK', description: 'Out for delivery' },
  { code: 'DOR', description: 'Delivered' },
  { code: 'AWI', description: 'Delivery attempt failed (recipient absent)' },
  { code: 'AN', description: 'Incorrectly addressed' }
];

const INPOST_EVENTS: { code: string; description: string }[] = [
  { code: 'created', description: 'Shipment created' },
  { code: 'confirmed', description: 'Confirmed by InPost' },
  { code: 'dispatched_by_sender', description: 'Dispatched by sender' },
  { code: 'collected_from_sender', description: 'Collected from sender' },
  { code: 'taken_by_courier', description: 'Taken by courier' },
  { code: 'adopted_at_source_branch', description: 'Adopted at source branch' },
  { code: 'sent_from_source_branch', description: 'Sent from source branch' },
  { code: 'adopted_at_sorting_center', description: 'Adopted at sorting center' },
  { code: 'sent_from_sorting_center', description: 'Sent from sorting center' },
  { code: 'adopted_at_target_branch', description: 'Adopted at target branch' },
  { code: 'out_for_delivery', description: 'Out for delivery' },
  { code: 'ready_to_pickup', description: 'Ready for pickup at locker' },
  { code: 'pickup_reminder_sent', description: 'Pickup reminder sent' },
  { code: 'delivered', description: 'Delivered' },
  { code: 'returned_to_sender', description: 'Returned to sender' },
  { code: 'canceled', description: 'Cancelled' },
  { code: 'claimed', description: 'Claimed / complaint opened' },
  { code: 'undelivered', description: 'Undelivered' }
];

@Component({
  selector: 'app-carrier-edit',
  templateUrl: './carrier-edit.component.html',
  styleUrls: ['./carrier-edit.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:beforeunload)': 'unloadNotification($event)'
  }
})
export class CarrierEditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly adminService = inject(AdminService);
  private readonly storeContext = inject(ShipmentStoreContextService);
  private readonly translation = inject(TranslationService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  stores: { uid: string; name: string }[] = [];
  companies: { uid: string; name: string }[] = [];

  private apiUrl = environment.apiUrl;

  isEditMode = false;
  carrierUid: string | null = null;
  editingCarrier: ShipmentCarrier | null = null;

  carrierForm: FormGroup;
  stages: CrmStage[] = [];
  eventMappings: EventMapping[] = [];
  // Event-code catalogs per carrier type, fetched from the backend so the list
  // never drifts from the drivers' actual codes. The hardcoded *_EVENTS consts
  // are only a fallback if the fetch fails.
  private eventCatalogs: Record<string, { code: string; description: string }[]> = {};

  loading = false;
  saving = false;
  error: string | null = null;

  testLoading = false;
  testResult: CarrierTestResponse | null = null;

  private initialFormSnapshot: string | null = null;
  private initialMappingsSnapshot: string | null = null;
  hasUnsavedChanges = false;

  carrierTypes = [
    { value: 'dhl24', label: 'DHL24 (Poland)' },
    { value: 'dhl_express', label: 'DHL Express (MyDHL API)' },
    { value: 'dpd', label: 'DPD' },
    { value: 'gls', label: 'GLS (Poland)' },
    { value: 'inpost', label: 'InPost' },
    { value: 'novaposhta', label: 'Nova Poshta (Ukraine)' },
    { value: 'manual', label: 'Manual (no API)' }
  ];

  // Per-carrier-type defaults applied when the carrier type changes, so the form
  // doesn't keep the previous type's API URL / service type.
  private readonly typeDefaults: Record<string, { api_url: string; default_service_type: string }> = {
    dhl24: { api_url: 'https://dhl24.com.pl/webapi2/provider/service.html?ws=1', default_service_type: 'AH' },
    // Production. The sandbox lives at the same host under /test — switch the
    // URL by hand while testing, since the credentials differ per environment.
    dhl_express: { api_url: 'https://express.api.dhl.com/mydhlapi', default_service_type: 'P' },
    // ADE-Plus WebAPI 2 production. The trailing "?wsdl" is part of the SOAP
    // target namespace, not decoration — the test host is
    // https://ade-test.gls-poland.com/adeplus/pm1/ade_webapi2.php?wsdl and needs
    // its own credentials. GLS has no product codes, so the default service is
    // the plain parcel (empty).
    gls: { api_url: 'https://adeplus.gls-poland.com/adeplus/pm1/ade_webapi2.php?wsdl', default_service_type: '' },
    inpost: { api_url: 'https://api-shipx-pl.easypack24.net', default_service_type: 'inpost_courier_standard' },
    novaposhta: { api_url: 'https://api.novaposhta.ua/v2.0/json/', default_service_type: 'WarehouseWarehouse' }
  };

  constructor() {
    this.carrierForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      carrier_type: ['dhl24', Validators.required],
      api_url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      username: ['', Validators.required],
      password: [''],
      account_number: [''],
      default_service_type: ['AH'],
      active: [true],
      store_uid: [null as string | null],
      company_uid: [null as string | null],
      shipper_name: ['', Validators.required],
      shipper_street: ['', Validators.required],
      shipper_city: ['', Validators.required],
      shipper_postal_code: ['', [Validators.required, Validators.pattern(/^\d{5,10}$/)]],
      shipper_phone: ['', [Validators.required, Validators.pattern(/^\d{9,}$/)]],
      shipper_email: ['', [Validators.required, Validators.email]],
      shipper_contact_person: [''],
      inpost_dispatch_point_id: [null as number | null],
      inpost_pickup_disabled: [false],
      inpost_sending_method: [''],
      inpost_dropoff_point: [''],
      inpost_label_format: ['Pdf'],
      inpost_label_type: ['A6'],
      gls_label_mode: ['one_label_on_a4_pdf'],
      gls_auto_pickup_disabled: [false],
      gls_integrator_id: [''],
      gls_pfc: [''],
      gls_tracking_api_url: ['https://api.gls-group.eu/public/v1'],
      gls_tracking_username: [''],
      gls_tracking_password: [''],
      support_multiparcel: [true],
      default_insurance_mode: [''],
      customs_type: ['S'],
      customs_category: ['11'],
      customs_default_tariff_code: [''],
      customs_default_country_of_origin: [''],
      shipper_eori: [''],
      shipper_nip: [''],
      shipper_vat: [''],
      shipper_country_code: ['PL'],
      shipper_company_name: [''],
      dhl_incoterm: ['DAP'],
      dhl_duties_account_number: [''],
      dhl_payer_account_number: [''],
      dhl_receiver_type_code: ['business'],
      dhl_content_description: ['Commercial goods'],
      dhl_request_pickup: [false],
      dhl_pickup_close_time: [''],
      dhl_label_template: ['ECOM26_84_A4_001'],
      dhl_billing_currency: ['PLN'],
      dhl_timezone: ['Europe/Warsaw'],
      dhl_request_invoice_image: [true],
      dhl_paperless_trade: [true],
      dhl_bypass_plt_error: [false],
      customs_export_reason_type: ['permanent'],
      customs_shipment_type: ['commercial'],
      np_sender_city_ref: [''],
      np_sender_ref: [''],
      np_sender_address_ref: [''],
      np_sender_contact_ref: [''],
      np_sender_phone: [''],
      np_payer_type: ['Sender'],
      np_payment_method: ['Cash'],
      np_cargo_type: ['Parcel'],
      np_declared_cost: [null as number | null],
      np_sender_city: [''],
      np_sender_warehouse_number: ['']
    });
  }

  // Nova Poshta setup-helper state (carrier-type === 'novaposhta').
  npCounterparties: { ref: string; name: string; edrpou?: string }[] = [];
  npContacts: { ref: string; name: string; phone?: string }[] = [];
  npResolvedWarehouse: { desc: string; city: string } | null = null;
  npLoading = false;
  npError: string | null = null;

  isInpost(): boolean {
    return this.carrierForm.get('carrier_type')?.value === 'inpost';
  }

  isDhl24(): boolean {
    return this.carrierForm.get('carrier_type')?.value === 'dhl24';
  }

  isGls(): boolean {
    return this.carrierForm.get('carrier_type')?.value === 'gls';
  }

  isDhlExpress(): boolean {
    return this.carrierForm.get('carrier_type')?.value === 'dhl_express';
  }

  // Both DHL drivers attach a customs declaration outside the EU customs union
  // and share the default tariff/origin fallbacks, so those inputs are shown for
  // either type even though the rest of their customs settings differ.
  isCustomsCapable(): boolean {
    return this.isDhl24() || this.isDhlExpress();
  }

  isNovaPoshta(): boolean {
    return this.carrierForm.get('carrier_type')?.value === 'novaposhta';
  }

  // Manual carriers have no API: no credentials, no shipper address, no API URL.
  isManual(): boolean {
    return this.carrierForm.get('carrier_type')?.value === 'manual';
  }

  // npSaveBlockers lists the required Nova Poshta steps still missing, so a
  // disabled Save isn't a silent dead-end (several required refs are hidden and
  // only filled by the sender/warehouse lookups).
  npSaveBlockers(): string[] {
    if (!this.isNovaPoshta() || this.carrierForm.valid) return [];
    const t = (k: string) => this.translation.translate('admin.shipment.carriers.' + k);
    const empty = (c: string) => !(this.carrierForm.get(c)?.value || '').toString().trim();
    const blockers: string[] = [];
    if (empty('np_sender_ref')) blockers.push(t('npSenderCounterparty'));
    if (empty('np_sender_contact_ref')) blockers.push(t('npSenderContact'));
    if (empty('np_sender_phone')) blockers.push(t('npSenderPhone'));
    if (empty('np_sender_address_ref')) blockers.push(t('npResolveWarehouse'));
    return blockers;
  }

  // setControlValidators replaces a control's validators (null when empty) and
  // recomputes validity without emitting a change event.
  private setControlValidators(name: string, validators: ValidatorFn[]): void {
    const c = this.carrierForm.get(name);
    if (!c) return;
    c.setValidators(validators.length ? validators : null);
    c.updateValueAndValidity({ emitEvent: false });
  }

  // applyTypeValidators toggles which fields are required for the selected
  // carrier type: Nova Poshta uses sender Refs (not a postal shipper address or a
  // username), while DHL/InPost use the shipper address + username.
  private applyTypeValidators(type: string): void {
    const np = type === 'novaposhta';
    const manual = type === 'manual';
    // A manual carrier has no API URL; every other type requires a valid one.
    this.setControlValidators('api_url', manual ? [] : [Validators.required, Validators.pattern(/^https?:\/\/.+/)]);
    this.setControlValidators('username', (np || manual) ? [] : [Validators.required]);
    this.setControlValidators('shipper_name', (np || manual) ? [] : [Validators.required]);
    this.setControlValidators('shipper_street', (np || manual) ? [] : [Validators.required]);
    this.setControlValidators('shipper_city', (np || manual) ? [] : [Validators.required]);
    this.setControlValidators('shipper_postal_code', (np || manual) ? [] : [Validators.required, Validators.pattern(/^\d{5,10}$/)]);
    this.setControlValidators('shipper_phone', (np || manual) ? [] : [Validators.required, Validators.pattern(/^\d{9,}$/)]);
    this.setControlValidators('shipper_email', (np || manual) ? [] : [Validators.required, Validators.email]);

    const npReq = np ? [Validators.required] : [];
    this.setControlValidators('np_sender_city_ref', npReq);
    this.setControlValidators('np_sender_ref', npReq);
    this.setControlValidators('np_sender_address_ref', npReq);
    this.setControlValidators('np_sender_contact_ref', npReq);
    this.setControlValidators('np_sender_phone', npReq);
  }

  // applyTypeDefaults sets the API URL and default service type to the chosen
  // carrier type's defaults, but only when the field is empty or still holds
  // another type's default — so a custom value the operator typed is preserved.
  private applyTypeDefaults(type: string): void {
    const def = this.typeDefaults[type];
    if (!def) return;
    const allApi = Object.values(this.typeDefaults).map(d => d.api_url);
    const allSvc = Object.values(this.typeDefaults).map(d => d.default_service_type);
    const apiCtrl = this.carrierForm.get('api_url');
    const svcCtrl = this.carrierForm.get('default_service_type');
    if (apiCtrl && (!apiCtrl.value || allApi.includes(apiCtrl.value))) apiCtrl.setValue(def.api_url);
    if (svcCtrl && (!svcCtrl.value || allSvc.includes(svcCtrl.value))) svcCtrl.setValue(def.default_service_type);
  }

  unloadNotification($event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges) {
      $event.preventDefault();
      $event.returnValue = '';
    }
  }

  ngOnInit(): void {
    this.carrierForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.checkForChanges());

    this.loadStages();
    this.loadStoreOptions();
    this.loadCompanyOptions();
    // Load the backend-driven event catalogs first, then initialise the form so
    // event→stage rows use the authoritative code list.
    this.loadEventCatalogs(() => this.initFromRoute());
  }

  private initFromRoute(): void {
    const uid = this.route.snapshot.params['uid'];
    if (uid) {
      this.carrierUid = uid;
      this.isEditMode = true;
      this.loadCarrier(uid);
    } else {
      // Pre-select the currently filtered store on the create form so a carrier
      // typed under "Store X" lands in that store's scope by default.
      const ctxStore = this.storeContext.value || null;
      this.carrierForm.patchValue({ store_uid: ctxStore });
      this.applyTypeValidators('dhl24');
      this.initEventMappings('dhl24', {});
      this.storeSnapshot();
    }
  }

  // Fetches the per-carrier-type event-code catalogs from the backend. Falls
  // back to the bundled constants (via getEventsForCarrierType) if it fails, so
  // the editor still works offline. Always invokes done() to continue init.
  private loadEventCatalogs(done: () => void): void {
    this.http.get<{ data: Record<string, { code: string; description: string }[]> }>(
      `${this.apiUrl}/admin/shipment/carriers/event-codes`
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.eventCatalogs = response.data || {};
          done();
        },
        error: err => {
          console.error('Failed to load event catalogs, using bundled fallback:', err);
          done();
        }
      });
  }

  private loadStoreOptions(): void {
    this.adminService.listStores()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stores) => {
          this.stores = (stores || []).map((s: any) => ({ uid: s.uid, name: s.name || s.uid }));
          this.cdr.markForCheck();
        }
      });
  }

  // Loads the ERP company directory for the optional carrier→company binding.
  // A single page is enough: the directory is small (ERP-owned).
  private loadCompanyOptions(): void {
    this.http.get<{ data: { uid: string; name: string }[] }>(`${this.apiUrl}/company?count=500`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.companies = (response.data || []).map(c => ({ uid: c.uid, name: c.name || c.uid }));
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to load companies:', err);
        }
      });
  }

  private loadStages(): void {
    this.http.get<{ data: CrmStage[] }>(`${this.apiUrl}/admin/crm/stages`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.stages = response.data || [];
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to load stages:', err);
        }
      });
  }

  private loadCarrier(uid: string): void {
    this.loading = true;
    this.error = null;

    this.http.post<{ data: ShipmentCarrier[] }>(`${this.apiUrl}/admin/shipment/carriers/batch`, {
      data: [uid]
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          const carrier = (response.data || [])[0];
          if (!carrier) {
            this.error = 'Carrier not found';
            this.loading = false;
            this.cdr.markForCheck();
            return;
          }
          this.editingCarrier = carrier;
          this.carrierForm.patchValue({
            name: carrier.name,
            carrier_type: carrier.carrier_type,
            api_url: carrier.api_url,
            username: carrier.username,
            password: '',
            account_number: carrier.account_number,
            default_service_type: carrier.default_service_type,
            active: carrier.active,
            store_uid: carrier.store_uid ?? null,
            company_uid: carrier.company_uid ?? null,
            shipper_name: carrier.config?.shipper_name || '',
            shipper_street: carrier.config?.shipper_street || '',
            shipper_city: carrier.config?.shipper_city || '',
            shipper_postal_code: carrier.config?.shipper_postal_code || '',
            shipper_phone: carrier.config?.shipper_phone || '',
            shipper_email: carrier.config?.shipper_email || '',
            shipper_contact_person: carrier.config?.shipper_contact_person || '',
            inpost_dispatch_point_id: carrier.config?.inpost_dispatch_point_id ?? null,
            inpost_pickup_disabled: !!carrier.config?.inpost_pickup_disabled,
            inpost_sending_method: carrier.config?.inpost_sending_method || '',
            inpost_dropoff_point: carrier.config?.inpost_dropoff_point || '',
            inpost_label_format: carrier.config?.inpost_label_format || 'Pdf',
            inpost_label_type: carrier.config?.inpost_label_type || 'A6',
            gls_label_mode: carrier.config?.gls_label_mode || 'one_label_on_a4_pdf',
            gls_auto_pickup_disabled: !!carrier.config?.gls_auto_pickup_disabled,
            gls_integrator_id: carrier.config?.gls_integrator_id || '',
            gls_pfc: carrier.config?.gls_pfc || '',
            gls_tracking_api_url: carrier.config?.gls_tracking_api_url || 'https://api.gls-group.eu/public/v1',
            gls_tracking_username: carrier.config?.gls_tracking_username || '',
            gls_tracking_password: carrier.config?.gls_tracking_password || '',
            support_multiparcel: carrier.config?.support_multiparcel !== false,
            default_insurance_mode: carrier.config?.default_insurance_mode || '',
            customs_type: carrier.config?.customs_type || 'S',
            customs_category: carrier.config?.customs_category || '11',
            customs_default_tariff_code: carrier.config?.customs_default_tariff_code || '',
            customs_default_country_of_origin: carrier.config?.customs_default_country_of_origin || '',
            shipper_eori: carrier.config?.shipper_eori || '',
            shipper_nip: carrier.config?.shipper_nip || '',
            shipper_vat: carrier.config?.shipper_vat || '',
            shipper_country_code: carrier.config?.shipper_country_code || 'PL',
            shipper_company_name: carrier.config?.shipper_company_name || '',
            dhl_incoterm: carrier.config?.dhl_incoterm || 'DAP',
            dhl_duties_account_number: carrier.config?.dhl_duties_account_number || '',
            dhl_payer_account_number: carrier.config?.dhl_payer_account_number || '',
            dhl_receiver_type_code: carrier.config?.dhl_receiver_type_code || 'business',
            dhl_content_description: carrier.config?.dhl_content_description || 'Commercial goods',
            dhl_request_pickup: !!carrier.config?.dhl_request_pickup,
            dhl_pickup_close_time: carrier.config?.dhl_pickup_close_time || '',
            dhl_label_template: carrier.config?.dhl_label_template || 'ECOM26_84_A4_001',
            dhl_billing_currency: carrier.config?.dhl_billing_currency || 'PLN',
            dhl_timezone: carrier.config?.dhl_timezone || 'Europe/Warsaw',
            // Defaults to on, so an absent key must not read as false.
            dhl_request_invoice_image: carrier.config?.dhl_request_invoice_image !== false,
            // Also defaults to on — an absent key must not read as false.
            dhl_paperless_trade: carrier.config?.dhl_paperless_trade !== false,
            dhl_bypass_plt_error: !!carrier.config?.dhl_bypass_plt_error,
            customs_export_reason_type: carrier.config?.customs_export_reason_type || 'permanent',
            customs_shipment_type: carrier.config?.customs_shipment_type || 'commercial',
            np_sender_city_ref: carrier.config?.sender_city_ref || '',
            np_sender_ref: carrier.config?.sender_ref || '',
            np_sender_address_ref: carrier.config?.sender_address_ref || '',
            np_sender_contact_ref: carrier.config?.sender_contact_ref || '',
            np_sender_phone: carrier.config?.sender_phone || '',
            np_payer_type: carrier.config?.payer_type || 'Sender',
            np_payment_method: carrier.config?.payment_method || 'Cash',
            np_cargo_type: carrier.config?.cargo_type || 'Parcel',
            np_declared_cost: carrier.config?.declared_cost ?? null
          });
          this.applyTypeValidators(carrier.carrier_type);
          this.initEventMappings(carrier.carrier_type, carrier.event_mappings || {});
          this.storeSnapshot();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to load carrier:', err);
          this.error = 'Failed to load carrier';
          this.loading = false;
          this.cdr.markForCheck();
        }
      });
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
    // Prefer the backend-driven catalog; fall back to bundled constants only if
    // the fetch failed or the type is unknown.
    const fromBackend = this.eventCatalogs[carrierType];
    if (fromBackend?.length) {
      return fromBackend;
    }
    switch (carrierType) {
      case 'inpost':
        return INPOST_EVENTS;
      default:
        return DHL24_EVENTS;
    }
  }

  onCarrierTypeChange(): void {
    const carrierType = this.carrierForm.get('carrier_type')?.value;
    this.applyTypeDefaults(carrierType);
    this.applyTypeValidators(carrierType);
    this.initEventMappings(carrierType, {});
    this.checkForChanges();
    this.cdr.markForCheck();
  }

  onMappingChange(): void {
    this.checkForChanges();
  }

  // npSetup proxies a Nova Poshta setup lookup through the backend using the API
  // key from the password field. The carrier need not be saved yet.
  private npSetup(body: Record<string, unknown>, onOk: (data: NpSetupResult) => void): void {
    const apiKey = (this.carrierForm.get('password')?.value || '').trim();
    const carrierUid = this.editingCarrier?.uid || '';
    // The helper can fall back to the saved carrier's key (carrier_uid); only
    // block when there's neither a typed key nor a saved carrier to fall back to.
    if (!apiKey && !carrierUid) {
      this.npError = this.translation.translate('admin.shipment.carriers.npNeedApiKey');
      this.cdr.markForCheck();
      return;
    }
    this.npLoading = true;
    this.npError = null;
    this.http.post<{ data: NpSetupResult }>(
      `${this.apiUrl}/admin/shipment/carriers/novaposhta/setup`,
      { data: { carrier_uid: carrierUid, api_url: this.carrierForm.get('api_url')?.value, api_key: apiKey, ...body } }
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.npLoading = false;
        onOk(res.data || { counterparties: [], contacts: [] });
        this.cdr.markForCheck();
      },
      error: err => {
        this.npLoading = false;
        this.npError = err?.error?.error?.message || err?.error?.message || err?.message || 'Request failed';
        this.cdr.markForCheck();
      }
    });
  }

  // npLoadSender fetches the sender counterparties (and the sole one's contacts).
  npLoadSender(): void {
    this.npSetup({}, data => {
      this.npCounterparties = data.counterparties || [];
      this.npContacts = data.contacts || [];
      // Auto-select the only counterparty / contact.
      if (this.npCounterparties.length === 1) {
        this.carrierForm.patchValue({ np_sender_ref: this.npCounterparties[0].ref });
      }
      this.autoSelectSoleContact();
    });
  }

  // autoSelectSoleContact picks the contact (and its phone) when exactly one is
  // available, so single-contact senders don't have to touch the dropdown.
  private autoSelectSoleContact(): void {
    if (this.npContacts.length !== 1) return;
    const only = this.npContacts[0];
    this.carrierForm.patchValue({ np_sender_contact_ref: only.ref, np_sender_phone: only.phone || '' });
  }

  // npHasCounterparty / npHasContact report whether a Ref is in the loaded option
  // list. In edit mode the lists start empty, so the template renders the saved
  // Ref as a synthetic "current" option to keep it selected (and the form valid)
  // until the operator reloads.
  npHasCounterparty(ref: string | null | undefined): boolean {
    return !!ref && this.npCounterparties.some(c => c.ref === ref);
  }

  npHasContact(ref: string | null | undefined): boolean {
    return !!ref && this.npContacts.some(c => c.ref === ref);
  }

  // onNpCounterpartyChange reloads the chosen counterparty's contact persons.
  // Only clears the dependent contact when an actual counterparty is selected, so
  // merely opening the dropdown in edit mode can't wipe a saved selection.
  onNpCounterpartyChange(): void {
    const ref = this.carrierForm.get('np_sender_ref')?.value;
    if (!ref) return;
    this.carrierForm.patchValue({ np_sender_contact_ref: '', np_sender_phone: '' });
    this.npContacts = [];
    this.npSetup({ counterparty_ref: ref }, data => {
      this.npContacts = data.contacts || [];
      this.autoSelectSoleContact();
    });
  }

  // onNpContactChange copies the selected contact's phone into the phone field.
  onNpContactChange(): void {
    const ref = this.carrierForm.get('np_sender_contact_ref')?.value;
    const contact = this.npContacts.find(c => c.ref === ref);
    if (contact?.phone) {
      this.carrierForm.patchValue({ np_sender_phone: contact.phone });
    }
  }

  // npResolveWarehouse resolves the sender city + warehouse number to the city
  // and warehouse Refs.
  npResolveWarehouse(): void {
    const city = (this.carrierForm.get('np_sender_city')?.value || '').trim();
    const number = (this.carrierForm.get('np_sender_warehouse_number')?.value || '').trim();
    if (!city || !number) {
      this.npError = this.translation.translate('admin.shipment.carriers.npNeedCityWarehouse');
      this.cdr.markForCheck();
      return;
    }
    this.npResolvedWarehouse = null;
    // No counterparty_ref here — warehouse resolution doesn't need contacts.
    this.npSetup(
      { sender_city: city, sender_warehouse_number: number },
      data => {
        if (data.warehouse) {
          this.carrierForm.patchValue({
            np_sender_city_ref: data.warehouse.city_ref,
            np_sender_address_ref: data.warehouse.warehouse_ref
          });
          this.npResolvedWarehouse = { desc: data.warehouse.warehouse_desc, city: data.warehouse.city_name };
        }
      }
    );
  }

  private storeSnapshot(): void {
    this.initialFormSnapshot = JSON.stringify(this.carrierForm.value);
    this.initialMappingsSnapshot = JSON.stringify(this.eventMappings);
    this.hasUnsavedChanges = false;
  }

  private checkForChanges(): void {
    if (this.initialFormSnapshot === null) {
      this.hasUnsavedChanges = false;
      return;
    }
    const formChanged = JSON.stringify(this.carrierForm.value) !== this.initialFormSnapshot;
    const mappingsChanged = JSON.stringify(this.eventMappings) !== this.initialMappingsSnapshot;
    this.hasUnsavedChanges = formChanged || mappingsChanged;
    this.cdr.markForCheck();
  }

  // Builds the carrier-specific config from the form. Extracted so the
  // connection test can exercise the values on screen: the test used to send
  // credentials only, which made a driver that validates more than the
  // credentials — DHL Express checks the shipper origin with DHL — report the
  // shipper as unconfigured while the form plainly showed it filled in.
  private buildShipperConfig(formValue: any): ShipperConfig {
    const isNp = formValue.carrier_type === 'novaposhta';
    const isManual = formValue.carrier_type === 'manual';
    const shipperConfig: ShipperConfig = (isNp || isManual) ? {} : {
      shipper_name: formValue.shipper_name,
      shipper_street: formValue.shipper_street,
      shipper_city: formValue.shipper_city,
      shipper_postal_code: formValue.shipper_postal_code,
      shipper_phone: formValue.shipper_phone,
      shipper_email: formValue.shipper_email,
      shipper_contact_person: (formValue.shipper_contact_person || '').trim()
    };

    if (isNp) {
      shipperConfig.sender_city_ref = (formValue.np_sender_city_ref || '').trim();
      shipperConfig.sender_ref = (formValue.np_sender_ref || '').trim();
      shipperConfig.sender_address_ref = (formValue.np_sender_address_ref || '').trim();
      shipperConfig.sender_contact_ref = (formValue.np_sender_contact_ref || '').trim();
      shipperConfig.sender_phone = (formValue.np_sender_phone || '').trim();
      shipperConfig.payer_type = formValue.np_payer_type || 'Sender';
      shipperConfig.payment_method = formValue.np_payment_method || 'Cash';
      shipperConfig.cargo_type = formValue.np_cargo_type || 'Parcel';
      const dc = Number(formValue.np_declared_cost);
      if (Number.isFinite(dc) && dc > 0) {
        shipperConfig.declared_cost = dc;
      }
    }

    if (formValue.carrier_type === 'inpost') {
      const dpIdRaw = formValue.inpost_dispatch_point_id;
      const dpId = dpIdRaw === null || dpIdRaw === '' ? null : Number(dpIdRaw);
      if (dpId !== null && Number.isFinite(dpId) && dpId > 0) {
        shipperConfig.inpost_dispatch_point_id = dpId;
      }
      shipperConfig.inpost_pickup_disabled = !!formValue.inpost_pickup_disabled;
      if (formValue.inpost_sending_method) {
        shipperConfig.inpost_sending_method = formValue.inpost_sending_method;
      }
      if (formValue.inpost_dropoff_point) {
        shipperConfig.inpost_dropoff_point = (formValue.inpost_dropoff_point as string).trim().toUpperCase();
      }
      if (formValue.inpost_label_format) {
        shipperConfig.inpost_label_format = formValue.inpost_label_format;
      }
      if (formValue.inpost_label_type) {
        shipperConfig.inpost_label_type = formValue.inpost_label_type;
      }
    }

    if (formValue.carrier_type === 'gls') {
      shipperConfig.gls_label_mode = formValue.gls_label_mode || 'one_label_on_a4_pdf';
      shipperConfig.gls_auto_pickup_disabled = !!formValue.gls_auto_pickup_disabled;
      if (formValue.gls_integrator_id) {
        shipperConfig.gls_integrator_id = (formValue.gls_integrator_id as string).trim();
      }
      if (formValue.gls_pfc) {
        shipperConfig.gls_pfc = (formValue.gls_pfc as string).trim();
      }
      if (formValue.gls_tracking_api_url) {
        shipperConfig.gls_tracking_api_url = (formValue.gls_tracking_api_url as string).trim();
      }
      if (formValue.gls_tracking_username) {
        shipperConfig.gls_tracking_username = (formValue.gls_tracking_username as string).trim();
      }
      if (formValue.gls_tracking_password) {
        shipperConfig.gls_tracking_password = formValue.gls_tracking_password as string;
      }
    }

    if (formValue.carrier_type === 'dhl24') {
      shipperConfig.support_multiparcel = !!formValue.support_multiparcel;
      shipperConfig.default_insurance_mode = formValue.default_insurance_mode || '';
      shipperConfig.customs_type = formValue.customs_type || 'S';
      shipperConfig.customs_category = formValue.customs_category || '11';
      if (formValue.customs_default_tariff_code) {
        shipperConfig.customs_default_tariff_code = (formValue.customs_default_tariff_code as string).trim();
      }
      if (formValue.customs_default_country_of_origin) {
        shipperConfig.customs_default_country_of_origin = (formValue.customs_default_country_of_origin as string).trim().toUpperCase();
      }
      if (formValue.shipper_eori) {
        shipperConfig.shipper_eori = (formValue.shipper_eori as string).trim();
      }
      if (formValue.shipper_nip) {
        shipperConfig.shipper_nip = (formValue.shipper_nip as string).trim();
      }
      if (formValue.shipper_vat) {
        shipperConfig.shipper_vat = (formValue.shipper_vat as string).trim();
      }
    }

    if (formValue.carrier_type === 'dhl_express') {
      shipperConfig.support_multiparcel = !!formValue.support_multiparcel;
      shipperConfig.default_insurance_mode = formValue.default_insurance_mode || '';
      shipperConfig.shipper_country_code = (formValue.shipper_country_code as string || 'PL').trim().toUpperCase();
      shipperConfig.dhl_incoterm = formValue.dhl_incoterm || 'DAP';
      shipperConfig.dhl_receiver_type_code = formValue.dhl_receiver_type_code || 'business';
      shipperConfig.dhl_content_description = formValue.dhl_content_description || 'Commercial goods';
      shipperConfig.dhl_request_pickup = !!formValue.dhl_request_pickup;
      shipperConfig.dhl_label_template = formValue.dhl_label_template || 'ECOM26_84_A4_001';
      shipperConfig.dhl_billing_currency = (formValue.dhl_billing_currency as string || 'PLN').trim().toUpperCase();
      shipperConfig.dhl_timezone = formValue.dhl_timezone || 'Europe/Warsaw';
      shipperConfig.dhl_request_invoice_image = !!formValue.dhl_request_invoice_image;
      shipperConfig.dhl_paperless_trade = !!formValue.dhl_paperless_trade;
      shipperConfig.dhl_bypass_plt_error = !!formValue.dhl_bypass_plt_error;
      shipperConfig.customs_export_reason_type = formValue.customs_export_reason_type || 'permanent';
      shipperConfig.customs_shipment_type = formValue.customs_shipment_type || 'commercial';
      if (formValue.shipper_company_name) {
        shipperConfig.shipper_company_name = (formValue.shipper_company_name as string).trim();
      }
      if (formValue.dhl_duties_account_number) {
        shipperConfig.dhl_duties_account_number = (formValue.dhl_duties_account_number as string).trim();
      }
      if (formValue.dhl_payer_account_number) {
        shipperConfig.dhl_payer_account_number = (formValue.dhl_payer_account_number as string).trim();
      }
      if (formValue.dhl_pickup_close_time) {
        shipperConfig.dhl_pickup_close_time = (formValue.dhl_pickup_close_time as string).trim();
      }
      if (formValue.customs_default_tariff_code) {
        shipperConfig.customs_default_tariff_code = (formValue.customs_default_tariff_code as string).trim();
      }
      if (formValue.customs_default_country_of_origin) {
        shipperConfig.customs_default_country_of_origin = (formValue.customs_default_country_of_origin as string).trim().toUpperCase();
      }
      // EORI and VAT identify the exporter on the customs declaration; DHL needs
      // them for anything but the simplest clearances.
      if (formValue.shipper_eori) {
        shipperConfig.shipper_eori = (formValue.shipper_eori as string).trim();
      }
      if (formValue.shipper_vat) {
        shipperConfig.shipper_vat = (formValue.shipper_vat as string).trim();
      }
    }

    return shipperConfig;
  }

  saveCarrier(): void {
    if (this.carrierForm.invalid) {
      Object.keys(this.carrierForm.controls).forEach(key => {
        this.carrierForm.get(key)?.markAsTouched();
      });
      return;
    }

    const formValue = this.carrierForm.value;

    const eventMappingsObj: Record<string, string | null> = {};
    this.eventMappings.forEach(mapping => {
      eventMappingsObj[mapping.code] = mapping.stageUid;
    });

    const shipperConfig = this.buildShipperConfig(formValue);

    const carrier: Partial<ShipmentCarrier> = {
      uid: this.editingCarrier?.uid,
      name: formValue.name,
      carrier_type: formValue.carrier_type,
      api_url: formValue.api_url,
      username: formValue.username,
      account_number: formValue.account_number || '',
      default_service_type: formValue.default_service_type,
      active: formValue.active,
      store_uid: formValue.store_uid || null,
      company_uid: formValue.company_uid || null,
      config: shipperConfig,
      event_mappings: eventMappingsObj
    };

    if (formValue.password) {
      carrier.password = formValue.password;
    }

    this.saving = true;
    this.error = null;

    this.http.post<{ data: string[] }>(`${this.apiUrl}/admin/shipment/carriers`, {
      data: [carrier]
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.saving = false;
          this.storeSnapshot();

          if (!this.isEditMode && response.data && response.data.length > 0) {
            const newUid = response.data[0];
            this.router.navigate(['/admin/shipment/carriers', newUid], { queryParamsHandling: 'preserve' });
          } else {
            this.router.navigate(['/admin/shipment/carriers'], { queryParamsHandling: 'preserve' });
          }
        },
        error: err => {
          console.error('Failed to save carrier:', err);
          this.error = err.error?.message || 'Failed to save carrier';
          this.saving = false;
          this.cdr.markForCheck();
        }
      });
  }

  testCarrier(): void {
    const formValue = this.carrierForm.value;
    // Nova Poshta authenticates with the API key (password) only; other carriers
    // need a username.
    if (!formValue.api_url || (!formValue.username && !this.isNovaPoshta())) {
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
      carrier_uid: this.editingCarrier?.uid,
      // The values on screen, not the saved ones — otherwise a fix typed into
      // the form cannot be tested until it has been saved.
      config: this.buildShipperConfig(formValue)
    };

    this.http.post<{ data: CarrierTestResponse }>(`${this.apiUrl}/admin/shipment/carriers/test`, {
      data: testRequest
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.testResult = response.data;
          this.testLoading = false;
          this.cdr.markForCheck();
        },
        error: err => {
          console.error('Failed to test carrier:', err);
          this.testResult = {
            success: false,
            error: err.error?.message || 'Connection failed'
          };
          this.testLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  carrierTypeLabel(): string {
    const value = this.carrierForm.get('carrier_type')?.value;
    return this.carrierTypes.find(t => t.value === value)?.label || value || '';
  }

  storeLabel(): string {
    const uid = this.carrierForm.get('store_uid')?.value;
    if (!uid) return this.translation.translate('admin.shipment.scopeShared');
    return this.stores.find(s => s.uid === uid)?.name || uid;
  }

  formatDate(value: string): string {
    return formatDateTime(value);
  }

  async navigateBack(): Promise<void> {
    if (this.hasUnsavedChanges) {
      const leave = await this.confirmDialog.ask({
        message: 'You have unsaved changes. Are you sure you want to leave?',
        confirmLabel: 'Leave',
        danger: true
      });
      if (!leave) {
        return;
      }
    }
    this.router.navigate(['/admin/shipment/carriers'], { queryParamsHandling: 'preserve' });
  }
}
