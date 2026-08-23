import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Store } from '../../core/models/store.model';
import { formatDateTime } from '../../core/utils/date-format';

@Component({
  selector: 'app-stores',
  templateUrl: './stores.component.html',
  styleUrls: ['./stores.component.scss'],
  standalone: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StoresComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();
  private apiUrl = environment.apiUrl;

  stores: Store[] = [];
  loading = false;
  saving = false;
  error: string | null = null;
  successMessage: string | null = null;
  expandedStoreUid: string | null = null;

  // Edit form fields
  editName = '';
  editActive = true;
  editDefaultVatRate = 23;
  editCountryCode = '';
  editShowQuantity = false;
  editRequireBusinessRegistration = true;
  editUseCertificationFilter = false;
  editOrderPrefix = '';

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadStores();
    this.loadCertificationDataCount();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadStores(): void {
    this.loading = true;
    this.error = null;

    this.subscriptions.add(
      this.http.get<{ data: Store[], total?: number }>(`${this.apiUrl}/store/`).subscribe({
        next: (response) => {
          this.stores = response.data || [];
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load stores:', err);
          this.error = 'Failed to load stores';
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  /**
   * How many product country availability rows the ERP has loaded. Null while
   * the count is still unknown (in flight, or the request failed).
   *
   * The certification filter is strict: with no rows loaded, switching it on
   * hides every product in that store's catalog. So the toggle stays locked
   * until there is data to filter on — see certificationFilterLocked.
   */
  certificationDataCount: number | null = null;

  private loadCertificationDataCount(): void {
    this.subscriptions.add(
      this.http.get<{ data: { total: number } }>(`${this.apiUrl}/admin/product_country_availability/count`).subscribe({
        next: (response) => {
          this.certificationDataCount = response.data?.total ?? 0;
          this.cdr.detectChanges();
        },
        error: (err) => {
          // A failed count must not lock an admin out of a setting they can
          // otherwise edit, so leave it unknown and keep the toggle usable.
          console.warn('Failed to load product country availability count:', err);
          this.certificationDataCount = null;
          this.cdr.detectChanges();
        }
      })
    );
  }

  /**
   * True when the certification filter may not be switched ON.
   *
   * Only turning it on is blocked. A store that already has it enabled can
   * always turn it off — otherwise an admin whose availability data was wiped
   * would be stuck with an empty catalog and no way back.
   */
  get certificationFilterLocked(): boolean {
    return this.certificationDataCount === 0 && !this.editUseCertificationFilter;
  }

  toggleExpand(store: Store): void {
    if (this.expandedStoreUid === store.uid) {
      this.expandedStoreUid = null;
    } else {
      this.expandedStoreUid = store.uid;
      this.editName = store.name;
      this.editActive = store.active ?? true;
      this.editDefaultVatRate = store.default_vat_rate ?? 23;
      this.editCountryCode = store.country_code ?? '';
      this.editShowQuantity = store.show_quantity ?? false;
      this.editRequireBusinessRegistration = store.require_business_registration ?? true;
      this.editUseCertificationFilter = store.use_certification_filter ?? false;
      this.editOrderPrefix = store.order_prefix ?? '';
    }
    this.cdr.detectChanges();
  }

  get orderPrefixInvalid(): boolean {
    return !/^[A-Za-z0-9]{0,10}$/.test(this.editOrderPrefix.trim());
  }

  saveStore(store: Store): void {
    this.saving = true;
    this.error = null;
    this.successMessage = null;

    const updated: Store = {
      uid: store.uid,
      name: this.editName,
      active: this.editActive,
      default_vat_rate: this.editDefaultVatRate,
      country_code: this.editCountryCode || undefined,
      show_quantity: this.editShowQuantity,
      require_business_registration: this.editRequireBusinessRegistration,
      use_certification_filter: this.editUseCertificationFilter,
      // Always sent explicitly: an empty string clears the prefix on the backend,
      // while omitting the field would keep the stored value.
      order_prefix: this.editOrderPrefix.trim()
    };

    this.subscriptions.add(
      this.http.post<{ data: string[], status_message?: string }>(`${this.apiUrl}/store/`, {
        data: [updated]
      }).subscribe({
        next: (response) => {
          this.successMessage = response.status_message || 'Store saved successfully';
          this.saving = false;

          // Update local store data
          const idx = this.stores.findIndex(s => s.uid === store.uid);
          if (idx !== -1) {
            this.stores[idx] = { ...this.stores[idx], ...updated };
          }

          this.cdr.detectChanges();

          setTimeout(() => {
            this.successMessage = null;
            this.cdr.detectChanges();
          }, 3000);
        },
        error: (err) => {
          console.error('Failed to save store:', err);
          this.error = err.error?.message || 'Failed to save store';
          this.saving = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  refresh(): void {
    this.expandedStoreUid = null;
    this.loadStores();
  }

  formatDate(dateString: string | undefined): string {
    return dateString ? formatDateTime(dateString) : '-';
  }
}
