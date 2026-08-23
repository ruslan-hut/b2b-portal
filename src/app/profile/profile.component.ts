import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { ClientService, ClientAddress, ClientProfileUpdate, AddressUpsertRequest, Country } from '../core/services/client.service';
import { TranslationService } from '../core/services/translation.service';
import { AppSettingsService } from '../core/services/app-settings.service';
import { ConfirmDialogService } from '../core/services/confirm-dialog.service';
import { Client } from '../core/models/user.model';
import { DiscountInfo, ClientBranch } from '../core/models/app-settings.model';

@Component({
    selector: 'app-profile',
    templateUrl: './profile.component.html',
    styleUrl: './profile.component.scss',
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent implements OnInit, OnDestroy {
  /** Client API self-service section visibility (capabilities.api_access). */
  apiAccess = false;
  // Profile form
  profileForm: FormGroup;
  profileLoading = false;
  profileSaving = false;
  profileSuccess = false;
  profileError = '';

  // Address management
  addresses: ClientAddress[] = [];
  // Branches of the client, read-only. Used only to name the branch an address
  // belongs to — a client can neither create nor edit one.
  branches: ClientBranch[] = [];
  addressesLoading = false;
  addressError = '';

  // Address form modal
  showAddressModal = false;
  addressForm: FormGroup;
  editingAddress: ClientAddress | null = null;
  addressSaving = false;

  // Client data (read-only fields)
  client: Client | null = null;
  storeName = '';
  priceTypeName = '';
  discountInfo: DiscountInfo | null = null;
  currencySymbol = '';

  // Countries for autocomplete
  countries: Country[] = [];
  filteredCountries: Country[] = [];
  countrySearchText = '';
  showCountryDropdown = false;
  selectedCountry: Country | null = null;
  countriesLoading = false;

  @ViewChild('countryInput') countryInput!: ElementRef;

  private subscriptions = new Subscription();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private clientService: ClientService,
    public translationService: TranslationService,
    private appSettingsService: AppSettingsService,
    private confirmDialog: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {
    this.profileForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(255)]],
      email: ['', [Validators.email]],
      phone: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(15), Validators.pattern(/^\d+$/)]],
      vat_number: ['', [Validators.maxLength(50)]]
    });

    this.addressForm = this.fb.group({
      uid: [''],
      country_code: ['', Validators.required],
      city: [''],
      zipcode: [''],
      address_text: [''],
      branch_uid: [''],
      is_default: [false],
      is_official: [false]
    });
  }

  ngOnInit(): void {
    this.loadClientData();
    this.loadAddresses();
    this.loadCountries();
    // App settings are cached in localStorage and refreshed only at login, so
    // a capability switched on mid-session (e.g. Client API access enabled by
    // staff) would stay hidden until re-login. Refresh them when the profile
    // opens; the cached copy already rendered, so a failure changes nothing.
    this.subscriptions.add(
      this.appSettingsService.loadSettings().subscribe({
        next: (settings) => {
          const apiAccess = !!settings?.capabilities?.api_access;
          if (apiAccess !== this.apiAccess) {
            this.apiAccess = apiAccess;
            this.cdr.markForCheck();
          }
        },
        error: () => { /* keep the cached view */ }
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadClientData(): void {
    this.profileLoading = true;
    const settings = this.appSettingsService.getSettingsValue();

    if (settings && settings.entity_type === 'client') {
      this.client = settings.entity as Client;
      this.apiAccess = !!settings.capabilities?.api_access;
      this.populateProfileForm();

      // Get store and price type names
      if (settings.store) {
        this.storeName = settings.store.name || settings.store.uid;
      }
      if (settings.price_type) {
        this.priceTypeName = settings.price_type.name || settings.price_type.uid;
      }

      // Get discount info
      if (settings.discount_info) {
        this.discountInfo = settings.discount_info;
      }

      // Get currency symbol for formatting balance
      if (settings.currency) {
        this.currencySymbol = settings.currency.sign || settings.currency.code || '';
      }
    } else {
      // Redirect non-clients
      this.router.navigate(['/products/catalog']);
    }

    this.profileLoading = false;
    this.cdr.detectChanges();
  }

  populateProfileForm(): void {
    if (this.client) {
      this.profileForm.patchValue({
        name: this.client.name || '',
        email: this.client.email || '',
        phone: this.client.phone || '',
        vat_number: this.client.vat_number || ''
      });
    }
  }

  loadAddresses(): void {
    this.addressesLoading = true;
    this.addressError = '';

    // Subscribe to AppSettings for addresses
    this.subscriptions.add(
      this.appSettingsService.settings$.subscribe({
        next: (settings) => {
          if (settings?.addresses) {
            this.addresses = [...settings.addresses].sort((a, b) => {
              // Default address first
              if (a.is_default && !b.is_default) return -1;
              if (!a.is_default && b.is_default) return 1;
              return 0;
            });
          } else {
            this.addresses = [];
          }
          this.branches = settings?.branches || [];
          this.addressesLoading = false;
          this.cdr.detectChanges();
        },
        error: (error) => {
          console.error('Error loading addresses:', error);
          this.addressError = this.translationService.instant('profile.addressLoadError') || 'Failed to load addresses';
          this.addressesLoading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  loadCountries(): void {
    this.countriesLoading = true;
    this.clientService.getCountries().subscribe({
      next: (countries) => {
        this.countries = countries.sort((a, b) => a.name.localeCompare(b.name));
        this.filteredCountries = [...this.countries];
        this.countriesLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading countries:', error);
        this.countriesLoading = false;
        // Fallback to empty list
        this.countries = [];
        this.filteredCountries = [];
        this.cdr.detectChanges();
      }
    });
  }

  // Country autocomplete methods
  onCountrySearchChange(searchText: string): void {
    this.showCountryDropdown = true;
    // Reset selected country when user types
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
    // Delay to allow click on dropdown item
    setTimeout(() => {
      this.showCountryDropdown = false;
      // Validate selection - if text doesn't match a valid country, clear it
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

  // Profile form methods
  saveProfile(): void {
    if (this.profileForm.invalid) {
      return;
    }

    this.profileSaving = true;
    this.profileSuccess = false;
    this.profileError = '';

    const formValue = this.profileForm.value;
    const update: ClientProfileUpdate = {};

    // Only include changed fields
    if (this.client) {
      if (formValue.name !== this.client.name) {
        update.name = formValue.name;
      }
      if (formValue.email !== this.client.email) {
        update.email = formValue.email;
      }
      if (formValue.phone !== this.client.phone) {
        update.phone = formValue.phone;
      }
      if (formValue.vat_number !== (this.client.vat_number || '')) {
        update.vat_number = formValue.vat_number;
      }
    }

    // Check if there are changes
    if (Object.keys(update).length === 0) {
      this.profileSaving = false;
      this.profileSuccess = true;
      setTimeout(() => this.profileSuccess = false, 3000);
      return;
    }

    this.clientService.updateMyProfile(update).subscribe({
      next: () => {
        this.profileSaving = false;
        this.profileSuccess = true;
        // Refresh auth data to get updated client info
        this.authService.getCurrentEntity().subscribe({
          next: () => {
            this.loadClientData();
          }
        });
        setTimeout(() => this.profileSuccess = false, 3000);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error saving profile:', error);
        this.profileSaving = false;
        this.profileError = this.translationService.instant('profile.saveError') || 'Failed to save profile';
        setTimeout(() => this.profileError = '', 5000);
        this.cdr.detectChanges();
      }
    });
  }

  // Address management methods
  openAddAddressModal(): void {
    this.editingAddress = null;
    this.addressForm.reset({
      uid: '',
      country_code: '',
      city: '',
      zipcode: '',
      address_text: '',
      branch_uid: '',
      is_default: false,
      is_official: false
    });
    // Reset country autocomplete
    this.selectedCountry = null;
    this.countrySearchText = '';
    this.filteredCountries = [...this.countries];
    this.showCountryDropdown = false;
    this.showAddressModal = true;
  }

  openEditAddressModal(address: ClientAddress): void {
    this.editingAddress = address;
    this.addressForm.patchValue({
      uid: address.uid || '',
      country_code: address.country_code || '',
      city: address.city || '',
      zipcode: address.zipcode || '',
      address_text: address.address_text || '',
      branch_uid: address.branch_uid || '',
      is_default: address.is_default || false,
      is_official: address.is_official || false
    });
    // Set country autocomplete
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
    // Reset country autocomplete
    this.selectedCountry = null;
    this.countrySearchText = '';
    this.showCountryDropdown = false;
  }

  saveAddress(): void {
    if (this.addressForm.invalid) {
      return;
    }

    this.addressSaving = true;
    const formValue = this.addressForm.value;

    const request: AddressUpsertRequest = {
      uid: formValue.uid || undefined,
      country_code: formValue.country_code,
      city: formValue.city,
      zipcode: formValue.zipcode,
      address_text: formValue.address_text,
      is_default: formValue.is_default,
      is_official: formValue.is_official,
      branch_uid: formValue.branch_uid || ''
    };

    this.clientService.upsertAddress(request).subscribe({
      next: () => {
        // AppSettings is automatically updated by ClientService, UI will update via subscription
        this.addressSaving = false;
        this.closeAddressModal();
      },
      error: (error) => {
        console.error('Error saving address:', error);
        this.addressSaving = false;
        this.addressError = this.translationService.instant('profile.addressSaveError') || 'Failed to save address';
        setTimeout(() => this.addressError = '', 5000);
        this.cdr.detectChanges();
      }
    });
  }

  async deleteAddress(address: ClientAddress): Promise<void> {
    if (!address.uid) return;

    const confirmMessage = this.translationService.instant('profile.confirmDeleteAddress') || 'Are you sure you want to delete this address?';
    const confirmed = await this.confirmDialog.ask({
      message: confirmMessage,
      confirmLabel: this.translationService.instant('common.delete'),
      danger: true
    });
    if (!confirmed) {
      return;
    }

    this.clientService.deleteAddress(address.uid).subscribe({
      next: () => {
        // AppSettings is automatically updated by ClientService, UI will update via subscription
      },
      error: (error) => {
        console.error('Error deleting address:', error);
        this.addressError = this.translationService.instant('profile.addressDeleteError') || 'Failed to delete address';
        setTimeout(() => this.addressError = '', 5000);
        this.cdr.detectChanges();
      }
    });
  }

  setDefaultAddress(address: ClientAddress): void {
    if (!address.uid || address.is_default) return;

    this.clientService.setDefaultAddress(address.uid).subscribe({
      next: () => {
        // AppSettings is automatically updated by ClientService, UI will update via subscription
      },
      error: (error) => {
        console.error('Error setting default address:', error);
        this.addressError = this.translationService.instant('profile.setDefaultError') || 'Failed to set default address';
        setTimeout(() => this.addressError = '', 5000);
        this.cdr.detectChanges();
      }
    });
  }

  setOfficialAddress(address: ClientAddress): void {
    if (!address.uid || address.is_official) return;

    this.clientService.setOfficialAddress(address.uid).subscribe({
      next: () => {
        // AppSettings is automatically updated by ClientService, UI will update via subscription
      },
      error: (error) => {
        console.error('Error setting official address:', error);
        this.addressError = this.translationService.instant('profile.setOfficialError') || 'Failed to set official address';
        setTimeout(() => this.addressError = '', 5000);
        this.cdr.detectChanges();
      }
    });
  }

  getCountryName(code: string): string {
    const country = this.countries.find(c => c.country_code === code);
    return country ? country.name : code;
  }

  /**
   * Name of the branch an address belongs to, or '' when it belongs to the
   * account directly.
   *
   * Display only. The link is set by staff and by the ERP, never here — a client
   * may pick which address to deliver to, not which legal entity is invoiced.
   */
  getBranchName(address: ClientAddress): string {
    if (!address.branch_uid) return '';
    const branch = this.branches.find(b => b.uid === address.branch_uid);
    return branch ? branch.name : '';
  }

  /**
   * True when the address is linked to a branch the ERP has deactivated. Such an
   * address is still deliverable in principle, but no order can be confirmed to
   * it, so it is marked here rather than leaving the client to discover it at
   * checkout.
   */
  isBranchInactive(address: ClientAddress): boolean {
    if (!address.branch_uid) return false;
    const branch = this.branches.find(b => b.uid === address.branch_uid);
    return !!branch && !branch.active;
  }

  /**
   * Branches offerable in the address form: the active ones, plus the branch
   * already stored on the address being edited even when it has since gone
   * inactive.
   *
   * Without that exception the stored branch would be missing from the list, the
   * select would fall back to "billed to the account", and editing the street of
   * an address would quietly re-bill it to a different legal entity.
   */
  get selectableBranches(): ClientBranch[] {
    const current = this.editingAddress?.branch_uid;
    return this.branches.filter(b => b.active || (!!current && b.uid === current));
  }

  /** True when the branch chosen in the form is one the ERP has deactivated. */
  get selectedFormBranchInactive(): boolean {
    const uid = this.addressForm.get('branch_uid')?.value;
    if (!uid) return false;
    const branch = this.branches.find(b => b.uid === uid);
    return !!branch && !branch.active;
  }

  formatAddress(address: ClientAddress): string {
    const parts = [];
    if (address.address_text) parts.push(address.address_text);
    if (address.city) parts.push(address.city);
    if (address.zipcode) parts.push(address.zipcode);
    return parts.join(', ') || '-';
  }

  // Format balance from cents to currency display
  formatBalance(cents: number): string {
    const amount = (cents / 100).toFixed(2);
    return `${this.currencySymbol} ${amount}`;
  }

  navigateBack(): void {
    this.router.navigate(['/products/catalog']);
  }
}
