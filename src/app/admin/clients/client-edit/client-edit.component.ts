import { ChangeDetectionStrategy, ChangeDetectorRef, Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import { AdminService, AdminClientFull } from '../../../core/services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ClientService, Country, AddressUpsertRequest, ClientAddress } from '../../../core/services/client.service';
import { TranslationService } from '../../../core/services/translation.service';
import { UserService } from '../../../core/services/user.service';
import { AddressService, AdminClientAddress, AdminClientAddressUpsert } from '../../../core/services/address.service';
import { ClientBranchService } from '../../../core/services/client-branch.service';
import { ClientCertificationCountryService } from '../../../core/services/client-certification-country.service';
import { ClientApiService, ClientAPIKeyListItem } from '../../../core/services/client-api.service';
import { ClientBranch } from '../../../core/models/app-settings.model';
import { ApiResponse } from '../../../core/models/api.model';

// Note: AdminClientFull, AdminClientAddress interfaces now imported from services

interface SelectOption {
  value: string;
  label: string;
}

/**
 * The branch fields a billing warning can be attached to. 'vat' covers the
 * number and the rate together: the warning is about the pair, and the card
 * only shows the number.
 */
export type BranchWarningField = 'contact_email' | 'business_registration_number' | 'vat';

@Component({
  selector: 'app-client-edit',
  templateUrl: './client-edit.component.html',
  styleUrls: ['./client-edit.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(window:beforeunload)': 'unloadNotification($event)',
    '(document:keydown.escape)': 'onEscape()'
  }
})
export class ClientEditComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly adminService = inject(AdminService);
  private readonly authService = inject(AuthService);
  private readonly clientService = inject(ClientService);
  private readonly userService = inject(UserService);
  private readonly addressService = inject(AddressService);
  private readonly clientBranchService = inject(ClientBranchService);
  private readonly certificationCountryService = inject(ClientCertificationCountryService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly notifications = inject(NotificationService);
  readonly translationService = inject(TranslationService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly clientApiService = inject(ClientApiService);

  // Client API access: the per-client opt-in gate and this client's keys.
  // Only admins may flip the gate; managers see the state.
  apiAccessEnabled = false;
  apiAccessLoaded = false;
  apiAccessSaving = false;
  apiKeys: ClientAPIKeyListItem[] = [];
  readonly isAdminUser = inject(AuthService).isAdmin;
  private readonly destroyRef = inject(DestroyRef);

  // Form
  clientForm: FormGroup;

  // State
  isEditMode = false;
  clientUid: string | null = null;
  loading = false;
  saving = false;
  error: string | null = null;
  successMessage: string | null = null;

  // True when a store-scoped manager is logged in: the store field is locked.
  storeLocked = false;

  // Dropdown data
  stores: SelectOption[] = [];
  priceTypes: SelectOption[] = [];
  countries: Country[] = [];
  managers: SelectOption[] = [];
  availableLanguages: string[] = [];

  // Addresses
  addresses: AdminClientAddress[] = [];
  addressesLoading = false;
  showAddressModal = false;
  editingAddress: AdminClientAddress | null = null;
  addressForm: FormGroup;
  addressSaving = false;

  // Long lists collapse to a preview. A client with a dozen branches or
  // delivery addresses turned this page into a wall of cards and pushed the
  // sections after it off the screen; four is enough to show what the section
  // holds, and the count on the toggle says what is still hidden.
  readonly collapsedListLimit = 4;
  branchesExpanded = false;
  addressesExpanded = false;

  // Branches (ERP-owned, read-only here). An address may be linked to one of
  // them, which is how a branch reaches an order.
  branches: ClientBranch[] = [];
  // Branch whose detail modal is open. The card truncates its values to one
  // line each, so the modal is where they can be read in full.
  selectedBranch: ClientBranch | null = null;

  // Certification countries (ERP-owned, read-only here): the countries this
  // client sells into, which decide what its catalog may contain. Not the
  // delivery address — goods are often delivered to one country and resold into
  // another, and it is the final destination that must be certified.
  certificationCountries: string[] = [];
  // Stores that gate their catalog on certification. Collected from the store
  // list this screen already loads, so the section can explain what an empty
  // list actually costs this client instead of silently showing nothing.
  private certificationFilterStores = new Set<string>();

  // Country autocomplete for address modal
  filteredCountries: Country[] = [];
  countrySearchText = '';
  showCountryDropdown = false;
  selectedCountry: Country | null = null;

  // Currency for balance display
  currencySymbol = '';

  // Unsaved changes tracking
  private initialFormValue: any = null;
  hasUnsavedChanges = false;

  // Navigation origin tracking
  private fromLocation: string | null = null;
  private fromOrderUid: string | null = null;

  constructor() {
    // Initialize main form
    this.clientForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      email: ['', [Validators.email]],
      phone: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(15), Validators.pattern(/^\d+$/)]],
      pin_code: ['', [Validators.maxLength(20)]],
      // Legacy single-line address. No longer editable — delivery addresses live
      // in their own section — but the client upsert writes the whole record, so
      // the control stays to round-trip whatever the ERP holds instead of
      // blanking it on every save.
      address: [''],
      discount: [0, [Validators.min(0), Validators.max(100)]],
      additional_discount: [0, [Validators.min(0), Validators.max(100)]],
      vat_rate: [0, [Validators.min(0), Validators.max(100)]],
      vat_number: ['', [Validators.maxLength(50)]],
      business_registration_number: ['', [Validators.maxLength(50)]],
      manager_uid: [''],
      balance: [0, [Validators.min(0)]],
      fixed_discount: [false],
      cumulative_discount: [true],
      store_uid: ['', Validators.required],
      price_type_uid: ['', Validators.required],
      language: [''],
      active: [false]
    });

    // Initialize address form
    this.addressForm = this.fb.group({
      uid: [''],
      branch_uid: [''],
      country_code: ['', Validators.required],
      city: [''],
      zipcode: [''],
      address_text: [''],
      is_default: [false],
      is_official: [false]
    });
  }

  // Warn user when leaving page with unsaved changes (host: window:beforeunload).
  unloadNotification($event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges) {
      $event.preventDefault();
      $event.returnValue = '';
    }
  }

  ngOnInit(): void {
    this.fromLocation = this.route.snapshot.queryParams['from'] || null;
    this.fromOrderUid = this.route.snapshot.queryParams['orderUid'] || null;

    // Store-scoped managers can only create/edit clients in their own store.
    this.storeLocked = this.authService.isStoreScopedManager();
    if (this.storeLocked) {
      const scoped = this.authService.scopedStoreUid;
      if (scoped) {
        this.clientForm.patchValue({ store_uid: scoped });
      }
    }

    this.clientForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.checkForChanges();
      });

    const uid = this.route.snapshot.params['uid'];
    if (uid) {
      this.clientUid = uid;
      this.isEditMode = true;
      this.loadApiAccess(uid);
      this.loading = true;
      this.addressesLoading = true;
      this.loadEditData();
    } else {
      this.loadDropdownData()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          this.storeInitialFormValue();
          this.cdr.markForCheck();
        });
    }
  }

  private loadDropdownData(): Observable<void> {
    return forkJoin({
      stores: this.adminService.listStores(),
      priceTypes: this.adminService.listPriceTypes(),
      countries: this.clientService.getCountries(),
      managers: this.getManagersObservable(),
      languages: this.clientService.getAvailableLanguages().pipe(catchError(() => of<string[]>([])))
    }).pipe(
      map((result) => {
        this.applyDropdowns(result);
      }),
      catchError((err) => {
        console.error('Failed to load dropdown data:', err);
        return of(void 0);
      })
    );
  }

  private applyDropdowns(result: {
    stores: any[];
    priceTypes: any[];
    countries: Country[];
    managers: SelectOption[];
    languages: string[];
  }): void {
    this.stores = result.stores.map((s: any) => ({
      value: s.uid,
      label: s.name || s.uid
    }));
    this.certificationFilterStores = new Set(
      result.stores.filter((s: any) => s.use_certification_filter).map((s: any) => s.uid)
    );
    this.priceTypes = result.priceTypes.map((pt: any) => ({
      value: pt.uid,
      label: pt.name || pt.uid
    }));
    this.managers = result.managers;
    this.countries = (result.countries || []).sort((a, b) => a.name.localeCompare(b.name));
    this.filteredCountries = [...this.countries];
    this.availableLanguages = result.languages || [];
  }

  private getManagersObservable(): Observable<SelectOption[]> {
    return this.userService.getManagerOptions().pipe(
      map(managers => [...managers].sort((a, b) => a.label.localeCompare(b.label))),
      catchError((err) => {
        console.error('Failed to load managers:', err);
        return of<SelectOption[]>([]);
      })
    );
  }

  private loadEditData(): void {
    if (!this.clientUid) return;

    this.error = null;

    forkJoin({
      stores: this.adminService.listStores(),
      priceTypes: this.adminService.listPriceTypes(),
      countries: this.clientService.getCountries(),
      managers: this.getManagersObservable(),
      languages: this.clientService.getAvailableLanguages().pipe(catchError(() => of<string[]>([]))),
      clients: this.adminService.getClientsBatch([this.clientUid]),
      addressMap: this.addressService.getAddressesByClients([this.clientUid]).pipe(
        catchError((err) => {
          console.error('Failed to load addresses:', err);
          return of<Record<string, AdminClientAddress[]>>({});
        })
      ),
      // Non-fatal: an installation that never syncs branches still edits clients.
      branches: this.clientBranchService.getForClient(this.clientUid).pipe(
        catchError((err) => {
          console.error('Failed to load branches:', err);
          return of<ClientBranch[]>([]);
        })
      ),
      // Non-fatal for the same reason as branches: an installation whose ERP
      // does not push destination countries still edits clients.
      certificationCountries: this.certificationCountryService.getForClient(this.clientUid).pipe(
        catchError((err) => {
          console.error('Failed to load certification countries:', err);
          return of<string[]>([]);
        })
      )
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.applyDropdowns(result);
          this.branches = result.branches;
          this.certificationCountries = result.certificationCountries;

          if (result.clients.length > 0) {
            this.populateForm(result.clients[0]);
            const clientAddresses = result.addressMap[this.clientUid!] || [];
            this.addresses = clientAddresses.sort((a, b) => {
              if (a.is_default && !b.is_default) return -1;
              if (!a.is_default && b.is_default) return 1;
              return 0;
            });
          } else {
            this.error = 'Client not found';
          }

          this.loading = false;
          this.addressesLoading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Failed to load client:', err);
          this.error = 'Failed to load client';
          this.loading = false;
          this.addressesLoading = false;
          this.cdr.markForCheck();
        }
      });
  }

  populateForm(client: AdminClientFull): void {
    this.clientForm.patchValue({
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      pin_code: client.pin_code || '',
      address: client.address || '',
      discount: client.discount || 0,
      additional_discount: client.additional_discount || 0,
      vat_rate: client.vat_rate || 0,
      vat_number: client.vat_number || '',
      business_registration_number: client.business_registration_number || '',
      manager_uid: client.manager_uid || '',
      balance: client.balance || 0,
      fixed_discount: client.fixed_discount || false,
      cumulative_discount: client.cumulative_discount ?? true,
      store_uid: client.store_uid || '',
      price_type_uid: client.price_type_uid || '',
      language: client.language || '',
      active: client.active || false
    });
    // Store initial form value for change detection
    this.storeInitialFormValue();
  }

  private storeInitialFormValue(): void {
    this.initialFormValue = JSON.stringify(this.clientForm.value);
    this.hasUnsavedChanges = false;
  }

  private checkForChanges(): void {
    if (this.initialFormValue === null) {
      this.hasUnsavedChanges = false;
      return;
    }
    const currentValue = JSON.stringify(this.clientForm.value);
    this.hasUnsavedChanges = currentValue !== this.initialFormValue;
  }

  loadAddresses(): void {
    if (!this.clientUid) return;

    this.addressesLoading = true;

    // Load addresses using AddressService
    this.addressService.getAddressesByClients([this.clientUid]).subscribe({
      next: (addressMap) => {
        const clientAddresses = addressMap[this.clientUid!] || [];
        this.addresses = clientAddresses.sort((a, b) => {
          if (a.is_default && !b.is_default) return -1;
          if (!a.is_default && b.is_default) return 1;
          return 0;
        });
        this.addressesLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to load addresses:', err);
        this.addressesLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  saveClient(): void {
    // Server-side errors from the previous attempt would otherwise keep the
    // form invalid and block this one.
    this.clearServerFieldErrors();

    if (this.clientForm.invalid) {
      // Mark all fields as touched to show validation errors
      Object.keys(this.clientForm.controls).forEach(key => {
        this.clientForm.get(key)?.markAsTouched();
      });
      return;
    }

    this.saving = true;
    this.error = null;
    this.successMessage = null;

    const formValue = this.clientForm.value;
    const clientData = {
      uid: this.clientUid || '',
      name: formValue.name,
      email: formValue.email || '',
      phone: formValue.phone,
      // The API never returns the stored PIN, so the control is always empty on
      // load. Sending "" would clear it — and a client without a PIN is forced
      // inactive server-side. Omit the key unless the user actually typed one.
      ...(formValue.pin_code ? { pin_code: formValue.pin_code } : {}),
      address: formValue.address || '',
      discount: formValue.discount || 0,
      additional_discount: formValue.additional_discount || 0,
      vat_rate: formValue.vat_rate || 0,
      vat_number: formValue.vat_number || '',
      business_registration_number: formValue.business_registration_number || '',
      manager_uid: formValue.manager_uid || '',
      balance: formValue.balance || 0,
      fixed_discount: formValue.fixed_discount || false,
      cumulative_discount: formValue.cumulative_discount ?? true,
      store_uid: formValue.store_uid,
      price_type_uid: formValue.price_type_uid,
      language: formValue.language || '',
      active: formValue.active
    };

    this.adminService.upsertClients([clientData]).subscribe({
      next: (uids) => {
        this.saving = false;
        this.successMessage = this.isEditMode ? 'Client updated successfully' : 'Client created successfully';

        // Reset unsaved changes tracking
        this.storeInitialFormValue();

        if (!this.isEditMode && uids && uids.length > 0) {
          // Navigate to edit page for newly created client
          const newUid = uids[0];
          this.router.navigate(['/admin/clients', newUid]);
        }

        setTimeout(() => this.successMessage = null, 3000);
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to save client:', err);
        this.error = this.applyServerFieldErrors(err) ?? 'Failed to save client';
        this.saving = false;
        this.cdr.markForCheck();
      }
    });
  }

  /** Drops the `duplicate` errors set by the API, letting the local validators decide again. */
  private clearServerFieldErrors(): void {
    for (const control of Object.values(this.clientForm.controls)) {
      if (control.errors?.['duplicate']) {
        control.updateValueAndValidity();
      }
    }
  }

  /**
   * Attaches field-level errors returned by the API (e.g. a VAT or business
   * registration number already taken by another client) to their controls.
   * Returns the summary message to show, or null if the response carried none.
   */
  private applyServerFieldErrors(err: any): string | null {
    const detail = err?.error?.error;
    if (!detail?.message) return null;

    for (const field of detail.fields ?? []) {
      // Single-client requests come back with unprefixed field names.
      const control = this.clientForm.get(field.field);
      if (!control) continue;
      control.setErrors({ ...(control.errors ?? {}), duplicate: field.message });
      control.markAsTouched();
    }

    return detail.message;
  }

  // Navigation
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

    if (this.fromLocation === 'order' && this.fromOrderUid) {
      this.router.navigate(['/admin/orders', this.fromOrderUid]);
    } else {
      this.router.navigate(['/admin/clients']);
    }
  }

  // Address management
  openAddAddressModal(): void {
    this.editingAddress = null;
    this.addressForm.reset({
      uid: '',
      branch_uid: '',
      country_code: '',
      city: '',
      zipcode: '',
      address_text: '',
      is_default: false,
      is_official: false
    });
    this.selectedCountry = null;
    this.countrySearchText = '';
    this.filteredCountries = [...this.countries];
    this.showCountryDropdown = false;
    this.showAddressModal = true;
  }

  openEditAddressModal(address: AdminClientAddress): void {
    this.editingAddress = address;
    this.addressForm.patchValue({
      uid: address.uid || '',
      branch_uid: address.branch_uid || '',
      country_code: address.country_code || '',
      city: address.city || '',
      zipcode: address.zipcode || '',
      address_text: address.address_text || '',
      is_default: address.is_default || false,
      is_official: address.is_official || false
    });

    const country = this.countries.find(c => c.country_code === address.country_code);
    if (country) {
      this.selectedCountry = country;
      this.countrySearchText = country.name;
    } else {
      this.selectedCountry = null;
      this.countrySearchText = address.country_code || '';
    }
    this.filteredCountries = [...this.countries];
    this.showCountryDropdown = false;
    this.showAddressModal = true;
  }

  closeAddressModal(): void {
    this.showAddressModal = false;
    this.editingAddress = null;
    this.addressForm.reset();
    this.selectedCountry = null;
    this.countrySearchText = '';
    this.showCountryDropdown = false;
  }

  saveAddress(): void {
    if (this.addressForm.invalid || !this.clientUid) return;

    this.addressSaving = true;
    const formValue = this.addressForm.value;

    const addressData = {
      uid: formValue.uid || undefined,
      client_uid: this.clientUid,
      // Always sent: this form owns the branch link, and "" is the explicit
      // "no branch" that clears it.
      branch_uid: formValue.branch_uid || '',
      country_code: formValue.country_code,
      city: formValue.city || '',
      zipcode: formValue.zipcode || '',
      address_text: formValue.address_text || '',
      is_default: formValue.is_default || false,
      is_official: formValue.is_official || false
    };

    this.addressService.upsertAddresses([addressData as AdminClientAddressUpsert]).subscribe({
      next: () => {
        this.addressSaving = false;
        this.closeAddressModal();
        // Show the whole list: the address just saved is the newest one, and a
        // collapsed list would hide it behind a "show all" button and read as a
        // save that did nothing.
        this.addressesExpanded = true;
        this.loadAddresses();
      },
      error: (err) => {
        console.error('Failed to save address:', err);
        this.addressSaving = false;
        this.cdr.markForCheck();
      }
    });
  }

  async deleteAddress(address: AdminClientAddress): Promise<void> {
    if (!address.uid) return;

    const confirmed = await this.confirmDialog.ask({
      message: 'Are you sure you want to delete this address?',
      confirmLabel: 'Delete',
      danger: true
    });
    if (!confirmed) {
      return;
    }

    this.addressService.deleteAddresses([address.uid]).subscribe({
      next: () => {
        this.loadAddresses();
      },
      error: (err) => {
        console.error('Failed to delete address:', err);
        this.notifications.error('Failed to delete address');
      }
    });
  }

  setDefaultAddress(address: AdminClientAddress): void {
    if (!address.uid || address.is_default || !this.clientUid) return;

    // Update this address to be the default. Preserve is_official so toggling
    // the default flag does not clear the official (invoicing) flag.
    const addressData = {
      uid: address.uid,
      client_uid: this.clientUid,
      country_code: address.country_code,
      city: address.city || '',
      zipcode: address.zipcode || '',
      address_text: address.address_text || '',
      is_default: true,
      is_official: address.is_official || false
    };

    this.addressService.upsertAddresses([addressData as AdminClientAddressUpsert]).subscribe({
      next: () => {
        this.loadAddresses();
      },
      error: (err) => {
        console.error('Failed to set default address:', err);
      }
    });
  }

  setOfficialAddress(address: AdminClientAddress): void {
    if (!address.uid || address.is_official || !this.clientUid) return;

    // Mark this address as the official (invoicing) address. The backend clears
    // the flag on the client's other addresses. Preserve is_default so toggling
    // the official flag does not clear the default (delivery) flag.
    const addressData = {
      uid: address.uid,
      client_uid: this.clientUid,
      country_code: address.country_code,
      city: address.city || '',
      zipcode: address.zipcode || '',
      address_text: address.address_text || '',
      is_default: address.is_default || false,
      is_official: true
    };

    this.addressService.upsertAddresses([addressData as AdminClientAddressUpsert]).subscribe({
      next: () => {
        this.loadAddresses();
      },
      error: (err) => {
        console.error('Failed to set official address:', err);
      }
    });
  }

  // Country autocomplete methods
  onCountrySearchChange(searchText: string): void {
    this.showCountryDropdown = true;
    this.selectedCountry = null;
    this.addressForm.patchValue({ country_code: '' });

    if (!searchText || !searchText.trim()) {
      this.filteredCountries = [...this.countries];
    } else {
      const search = searchText.toLowerCase().trim();
      this.filteredCountries = this.countries.filter(country =>
        country.name.toLowerCase().includes(search) ||
        country.country_code.toLowerCase().includes(search)
      );
    }
    this.cdr.markForCheck();
  }

  selectCountry(country: Country): void {
    this.selectedCountry = country;
    this.countrySearchText = country.name;
    this.addressForm.patchValue({ country_code: country.country_code });
    this.showCountryDropdown = false;
    this.cdr.markForCheck();
  }

  onCountryInputFocus(): void {
    this.showCountryDropdown = true;
    this.filteredCountries = this.countrySearchText && this.countrySearchText.trim()
      ? this.countries.filter(c =>
          c.name.toLowerCase().includes(this.countrySearchText.toLowerCase()) ||
          c.country_code.toLowerCase().includes(this.countrySearchText.toLowerCase())
        )
      : [...this.countries];
    this.cdr.markForCheck();
  }

  onCountryInputBlur(): void {
    setTimeout(() => {
      this.showCountryDropdown = false;
      if (this.countrySearchText && !this.selectedCountry) {
        const found = this.countries.find(c =>
          c.name.toLowerCase() === this.countrySearchText.toLowerCase() ||
          c.country_code.toLowerCase() === this.countrySearchText.toLowerCase()
        );
        if (found) {
          this.selectCountry(found);
        } else {
          this.countrySearchText = '';
          this.addressForm.patchValue({ country_code: '' });
        }
      }
      this.cdr.markForCheck();
    }, 200);
  }

  clearCountrySelection(): void {
    this.selectedCountry = null;
    this.countrySearchText = '';
    this.addressForm.patchValue({ country_code: '' });
    this.filteredCountries = [...this.countries];
    this.cdr.markForCheck();
  }

  getCountryName(code: string): string {
    const country = this.countries.find(c => c.country_code === code);
    return country ? country.name : code;
  }

  /**
   * Whether the client's store gates its catalog on certification. It decides
   * what an empty destination list costs: nothing when the gate is off, and a
   * catalog cut down to any-country products when it is on.
   */
  get storeUsesCertificationFilter(): boolean {
    return this.certificationFilterStores.has(this.clientForm.get('store_uid')?.value || '');
  }

  /**
   * Show the section when there is either something to show or something to
   * warn about — an installation that uses neither the gate nor the ERP feed
   * gets no empty panel.
   */
  get showCertificationCountries(): boolean {
    return this.isEditMode && (this.certificationCountries.length > 0 || this.storeUsesCertificationFilter);
  }

  formatAddress(address: AdminClientAddress): string {
    const parts = [];
    if (address.address_text) parts.push(address.address_text);
    if (address.city) parts.push(address.city);
    if (address.zipcode) parts.push(address.zipcode);
    return parts.join(', ') || '-';
  }

  /**
   * Display name of the branch an address is linked to, or '' when it is linked
   * to none. A UID with no matching branch falls back to the raw UID rather than
   * rendering blank, so a stale link is visible instead of silently invisible.
   */
  branchNameFor(address: AdminClientAddress): string {
    if (!address.branch_uid) return '';
    const branch = this.branches.find(b => b.uid === address.branch_uid);
    return branch ? branch.name : address.branch_uid;
  }

  get visibleBranches(): ClientBranch[] {
    return this.branchesExpanded ? this.branches : this.branches.slice(0, this.collapsedListLimit);
  }

  get hiddenBranchCount(): number {
    return Math.max(0, this.branches.length - this.collapsedListLimit);
  }

  get visibleAddresses(): AdminClientAddress[] {
    return this.addressesExpanded ? this.addresses : this.addresses.slice(0, this.collapsedListLimit);
  }

  get hiddenAddressCount(): number {
    return Math.max(0, this.addresses.length - this.collapsedListLimit);
  }

  toggleBranches(): void {
    this.branchesExpanded = !this.branchesExpanded;
  }

  toggleAddresses(): void {
    this.addressesExpanded = !this.addressesExpanded;
  }

  openBranchModal(branch: ClientBranch): void {
    this.selectedBranch = branch;
  }

  closeBranchModal(): void {
    const branch = this.selectedBranch;
    this.selectedBranch = null;
    // Send focus back to the card that opened the dialog. Without this, closing
    // with Escape drops the caret at the top of the document and the operator
    // has to tab through the whole form to reach the next branch.
    if (branch) {
      document.getElementById(`branch-open-${branch.uid}`)?.focus();
    }
  }

  /**
   * Escape closes the branch detail only. The address modal is a form and
   * deliberately not included: a stray Escape there would discard typed input.
   */
  onEscape(): void {
    if (this.selectedBranch) {
      this.closeBranchModal();
    }
  }

  /**
   * Moves focus into the dialog when it opens, so the next Tab stays inside it
   * instead of walking the form behind the overlay.
   */
  @ViewChild('branchModalClose')
  set branchModalClose(button: ElementRef<HTMLButtonElement> | undefined) {
    button?.nativeElement.focus();
  }

  /**
   * The gap in one branch field that changes how its orders are billed, as a
   * translation key — or null when that field is fine. Keyed by field rather
   * than returned as a list, so the marker can sit next to the value it is
   * about instead of in a block of prose under the card.
   *
   * A branch is ERP-owned and read-only here, so none of this can be fixed on
   * this page — but this is where a person looks at a branch, so it is where the
   * consequences of an empty field belong. Each of these is silent otherwise:
   * a missing e-mail shows up as a merged contractor in wFirma, a missing
   * business number as a refused order confirmation, a zero rate as an invoice
   * charging no VAT.
   */
  branchWarning(branch: ClientBranch, field: BranchWarningField): string | null {
    switch (field) {
      case 'contact_email':
        return branch.contact_email ? null : 'admin.clients.branchWarnNoEmail';
      case 'business_registration_number':
        return branch.business_registration_number
          ? null
          : 'admin.clients.branchWarnNoBusinessNumber';
      // A VAT number with a zero rate is legitimate (intra-EU reverse charge)
      // and also what an unconfigured row looks like. Only the ERP can tell
      // them apart, so this states the effect rather than calling it an error.
      case 'vat':
        return branch.vat_number && !branch.vat_rate
          ? 'admin.clients.branchWarnZeroVatRate'
          : null;
    }
  }

  // Format balance from cents to currency display. toFixed keeps the output
  // deterministic (browser-locale toLocaleString produced different separators
  // for different users) and consistent with the rest of the app.
  formatBalance(cents: number | null | undefined): string {
    const amount = ((cents || 0) / 100).toFixed(2);
    return this.currencySymbol ? `${this.currencySymbol}${amount}` : amount;
  }

  // Generate a random 6-digit PIN code
  generatePinCode(): void {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    this.clientForm.patchValue({ pin_code: pin });
  }

  initials(): string {
    const name = (this.clientForm.get('name')?.value || '').toString().trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  storeLabel(): string {
    const uid = this.clientForm.get('store_uid')?.value;
    return uid ? (this.stores.find(s => s.value === uid)?.label || uid) : '';
  }

  priceTypeLabel(): string {
    const uid = this.clientForm.get('price_type_uid')?.value;
    return uid ? (this.priceTypes.find(p => p.value === uid)?.label || uid) : '';
  }

  managerLabel(): string {
    const uid = this.clientForm.get('manager_uid')?.value;
    return uid ? (this.managers.find(m => m.value === uid)?.label || uid) : '';
  }

  // Helper for form validation display
  isFieldInvalid(fieldName: string): boolean {
    const field = this.clientForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.clientForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['duplicate']) return field.errors['duplicate'];
    if (field.errors['required']) return 'This field is required';
    if (field.errors['email']) return 'Invalid email format';
    if (field.errors['minlength']) return `Minimum ${field.errors['minlength'].requiredLength} characters`;
    if (field.errors['maxlength']) return `Maximum ${field.errors['maxlength'].requiredLength} characters`;
    if (field.errors['min']) return `Minimum value is ${field.errors['min'].min}`;
    if (field.errors['max']) return `Maximum value is ${field.errors['max'].max}`;
    if (field.errors['pattern']) return 'Invalid format (digits only)';

    return 'Invalid value';
  }

  // ---- Client API access ----

  loadApiAccess(clientUid: string): void {
    forkJoin({
      access: this.clientApiService.getClientAccess(clientUid).pipe(catchError(() => of(null))),
      keys: this.clientApiService.listKeys({ client_uid: clientUid }, 0, 50).pipe(catchError(() => of(null)))
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ access, keys }) => {
      this.apiAccessEnabled = !!access?.enabled;
      this.apiKeys = keys?.data || [];
      this.apiAccessLoaded = true;
      this.cdr.markForCheck();
    });
  }

  get activeApiKeyCount(): number {
    const now = Date.now();
    return this.apiKeys.filter(k => k.status === 'active' && new Date(k.expires_at).getTime() > now).length;
  }

  async toggleApiAccess(): Promise<void> {
    if (!this.clientUid || this.apiAccessSaving) return;
    const next = !this.apiAccessEnabled;
    if (!next && this.activeApiKeyCount > 0) {
      const ok = await this.confirmDialog.ask({
        message: this.translationService.instant('admin.clientApi.clientAccessDisableWarn'),
        danger: true
      });
      if (!ok) return;
    }
    this.apiAccessSaving = true;
    this.cdr.markForCheck();
    this.clientApiService.setClientAccess(this.clientUid, next).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.apiAccessSaving = false;
        this.notifications.success(this.translationService.instant('admin.clientApi.clientAccessSaved'));
        this.loadApiAccess(this.clientUid!);
      },
      error: (err) => {
        this.apiAccessSaving = false;
        this.notifications.error(err?.error?.error?.message || this.translationService.instant('common.error'));
        this.cdr.markForCheck();
      }
    });
  }
}
