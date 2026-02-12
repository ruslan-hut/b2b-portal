import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription, forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AdminService, AdminClientFull } from '../../../core/services/admin.service';
import { ClientService, Country, AddressUpsertRequest, ClientAddress } from '../../../core/services/client.service';
import { TranslationService } from '../../../core/services/translation.service';
import { UserService } from '../../../core/services/user.service';
import { AddressService, AdminClientAddress, AdminClientAddressUpsert } from '../../../core/services/address.service';

// Note: AdminClientFull, AdminClientAddress interfaces now imported from services

interface ApiResponse<T> {
  success: boolean;
  data: T;
  metadata?: any;
}

interface SelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-client-edit',
  templateUrl: './client-edit.component.html',
  styleUrls: ['./client-edit.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientEditComponent implements OnInit, OnDestroy {
  // Form
  clientForm: FormGroup;

  // State
  isEditMode = false;
  clientUid: string | null = null;
  loading = false;
  saving = false;
  error: string | null = null;
  successMessage: string | null = null;

  // Dropdown data
  stores: SelectOption[] = [];
  priceTypes: SelectOption[] = [];
  countries: Country[] = [];
  managers: SelectOption[] = [];

  // Addresses
  addresses: AdminClientAddress[] = [];
  addressesLoading = false;
  showAddressModal = false;
  editingAddress: AdminClientAddress | null = null;
  addressForm: FormGroup;
  addressSaving = false;

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

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private adminService: AdminService,
    private clientService: ClientService,
    private userService: UserService,
    private addressService: AddressService,
    public translationService: TranslationService,
    private cdr: ChangeDetectorRef
  ) {
    // Initialize main form
    this.clientForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(255)]],
      email: ['', [Validators.email]],
      phone: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(15), Validators.pattern(/^\d+$/)]],
      pin_code: ['', [Validators.maxLength(20)]],
      address: [''],
      discount: [0, [Validators.min(0), Validators.max(100)]],
      vat_rate: [0, [Validators.min(0), Validators.max(100)]],
      vat_number: ['', [Validators.maxLength(50)]],
      business_registration_number: ['', [Validators.maxLength(50)]],
      manager_uid: [''],
      balance: [0, [Validators.min(0)]],
      fixed_discount: [false],
      cumulative_discount: [true],
      store_uid: ['', Validators.required],
      price_type_uid: ['', Validators.required],
      active: [false]
    });

    // Initialize address form
    this.addressForm = this.fb.group({
      uid: [''],
      country_code: ['', Validators.required],
      city: [''],
      zipcode: [''],
      address_text: [''],
      is_default: [false]
    });
  }

  // Warn user when leaving page with unsaved changes
  @HostListener('window:beforeunload', ['$event'])
  unloadNotification($event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges) {
      $event.preventDefault();
      $event.returnValue = '';
    }
  }

  ngOnInit(): void {
    // Read navigation origin from query params
    this.fromLocation = this.route.snapshot.queryParams['from'] || null;
    this.fromOrderUid = this.route.snapshot.queryParams['orderUid'] || null;

    // Track form changes
    this.subscriptions.add(
      this.clientForm.valueChanges.subscribe(() => {
        this.checkForChanges();
      })
    );

    // Load dropdown data first, then load client if in edit mode
    this.loadDropdownData().then(() => {
      // Check if editing existing client
      this.subscriptions.add(
        this.route.params.subscribe(params => {
          if (params['uid']) {
            this.clientUid = params['uid'];
            this.isEditMode = true;
            this.loadClient();
          } else {
            // For new client, store initial form value
            this.storeInitialFormValue();
          }
        })
      );
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadDropdownData(): Promise<void> {
    return new Promise((resolve) => {
      forkJoin({
        stores: this.adminService.listStores(),
        priceTypes: this.adminService.listPriceTypes(),
        countries: this.clientService.getCountries(),
        managers: this.loadManagers()
      }).subscribe({
        next: (result) => {
          this.stores = result.stores.map((s: any) => ({
            value: s.uid,
            label: s.name || s.uid
          }));
          this.priceTypes = result.priceTypes.map((pt: any) => ({
            value: pt.uid,
            label: pt.name || pt.uid
          }));
          this.managers = result.managers;
          this.countries = result.countries.sort((a, b) => a.name.localeCompare(b.name));
          this.filteredCountries = [...this.countries];
          this.cdr.detectChanges();
          resolve();
        },
        error: (err) => {
          console.error('Failed to load dropdown data:', err);
          resolve(); // Resolve even on error to allow component to continue
        }
      });
    });
  }

  private loadManagers() {
    // Load managers using UserService
    return new Promise<SelectOption[]>((resolve) => {
      this.userService.getManagerOptions()
        .subscribe({
          next: (managers) => {
            const sorted = managers.sort((a, b) => a.label.localeCompare(b.label));
            resolve(sorted);
          },
          error: (err) => {
            console.error('Failed to load managers:', err);
            resolve([]);
          }
        });
    });
  }

  loadClient(): void {
    if (!this.clientUid) return;

    this.loading = true;
    this.error = null;

    // Load client data using AdminService
    this.adminService.getClientsBatch([this.clientUid]).subscribe({
      next: (clients) => {
        if (clients.length > 0) {
          this.populateForm(clients[0]);
          this.loadAddresses();
        } else {
          this.error = 'Client not found';
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load client:', err);
        this.error = 'Failed to load client';
        this.loading = false;
        this.cdr.detectChanges();
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
      vat_rate: client.vat_rate || 0,
      vat_number: client.vat_number || '',
      business_registration_number: client.business_registration_number || '',
      manager_uid: client.manager_uid || '',
      balance: client.balance || 0,
      fixed_discount: client.fixed_discount || false,
      cumulative_discount: client.cumulative_discount ?? true,
      store_uid: client.store_uid || '',
      price_type_uid: client.price_type_uid || '',
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
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load addresses:', err);
        this.addressesLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  saveClient(): void {
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
      pin_code: formValue.pin_code || '',
      address: formValue.address || '',
      discount: formValue.discount || 0,
      vat_rate: formValue.vat_rate || 0,
      vat_number: formValue.vat_number || '',
      business_registration_number: formValue.business_registration_number || '',
      manager_uid: formValue.manager_uid || '',
      balance: formValue.balance || 0,
      fixed_discount: formValue.fixed_discount || false,
      cumulative_discount: formValue.cumulative_discount ?? true,
      store_uid: formValue.store_uid,
      price_type_uid: formValue.price_type_uid,
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
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to save client:', err);
        this.error = 'Failed to save client';
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Navigation
  navigateBack(): void {
    if (this.hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to leave?')) {
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
      country_code: '',
      city: '',
      zipcode: '',
      address_text: '',
      is_default: false
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
      country_code: address.country_code || '',
      city: address.city || '',
      zipcode: address.zipcode || '',
      address_text: address.address_text || '',
      is_default: address.is_default || false
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
      country_code: formValue.country_code,
      city: formValue.city || '',
      zipcode: formValue.zipcode || '',
      address_text: formValue.address_text || '',
      is_default: formValue.is_default || false
    };

    this.addressService.upsertAddresses([addressData as AdminClientAddressUpsert]).subscribe({
      next: () => {
        this.addressSaving = false;
        this.closeAddressModal();
        this.loadAddresses();
      },
      error: (err) => {
        console.error('Failed to save address:', err);
        this.addressSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  deleteAddress(address: AdminClientAddress): void {
    if (!address.uid) return;

    if (!confirm('Are you sure you want to delete this address?')) {
      return;
    }

    this.addressService.deleteAddresses([address.uid]).subscribe({
      next: () => {
        this.loadAddresses();
      },
      error: (err) => {
        console.error('Failed to delete address:', err);
      }
    });
  }

  setDefaultAddress(address: AdminClientAddress): void {
    if (!address.uid || address.is_default || !this.clientUid) return;

    // Update all addresses to set this one as default
    const addressData = {
      uid: address.uid,
      client_uid: this.clientUid,
      country_code: address.country_code,
      city: address.city || '',
      zipcode: address.zipcode || '',
      address_text: address.address_text || '',
      is_default: true
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
    this.cdr.detectChanges();
  }

  selectCountry(country: Country): void {
    this.selectedCountry = country;
    this.countrySearchText = country.name;
    this.addressForm.patchValue({ country_code: country.country_code });
    this.showCountryDropdown = false;
    this.cdr.detectChanges();
  }

  onCountryInputFocus(): void {
    this.showCountryDropdown = true;
    this.filteredCountries = this.countrySearchText && this.countrySearchText.trim()
      ? this.countries.filter(c =>
          c.name.toLowerCase().includes(this.countrySearchText.toLowerCase()) ||
          c.country_code.toLowerCase().includes(this.countrySearchText.toLowerCase())
        )
      : [...this.countries];
    this.cdr.detectChanges();
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
      this.cdr.detectChanges();
    }, 200);
  }

  clearCountrySelection(): void {
    this.selectedCountry = null;
    this.countrySearchText = '';
    this.addressForm.patchValue({ country_code: '' });
    this.filteredCountries = [...this.countries];
    this.cdr.detectChanges();
  }

  getCountryName(code: string): string {
    const country = this.countries.find(c => c.country_code === code);
    return country ? country.name : code;
  }

  formatAddress(address: AdminClientAddress): string {
    const parts = [];
    if (address.address_text) parts.push(address.address_text);
    if (address.city) parts.push(address.city);
    if (address.zipcode) parts.push(address.zipcode);
    return parts.join(', ') || '-';
  }

  // Format balance from cents to currency display
  formatBalance(cents: number): string {
    const amount = (cents / 100).toFixed(2);
    return `${this.currencySymbol}${amount}`;
  }

  // Generate a random 6-digit PIN code
  generatePinCode(): void {
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    this.clientForm.patchValue({ pin_code: pin });
  }

  // Helper for form validation display
  isFieldInvalid(fieldName: string): boolean {
    const field = this.clientForm.get(fieldName);
    return field ? field.invalid && field.touched : false;
  }

  getFieldError(fieldName: string): string {
    const field = this.clientForm.get(fieldName);
    if (!field || !field.errors) return '';

    if (field.errors['required']) return 'This field is required';
    if (field.errors['email']) return 'Invalid email format';
    if (field.errors['minlength']) return `Minimum ${field.errors['minlength'].requiredLength} characters`;
    if (field.errors['maxlength']) return `Maximum ${field.errors['maxlength'].requiredLength} characters`;
    if (field.errors['min']) return `Minimum value is ${field.errors['min'].min}`;
    if (field.errors['max']) return `Maximum value is ${field.errors['max'].max}`;
    if (field.errors['pattern']) return 'Invalid format (digits only)';

    return 'Invalid value';
  }
}
