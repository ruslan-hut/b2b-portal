import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, DestroyRef, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { PageTitleService } from '../../core/services/page-title.service';
import { ApiResponse } from '../../core/models/api.model';
import { formatDateTime } from '../../core/utils/date-format';

// ERP-owned company directory entry (uid = ERP GUID). Read-only in the admin
// UI; the ERP sync is the single source of truth.
export interface AdminCompany {
  uid: string;
  name: string;
  business_registration_number: string;
  vat_number: string;
  country_code: string;
  zipcode: string;
  city: string;
  address_text: string;
  contact_first_name: string;
  contact_last_name: string;
  contact_phone: string;
  active: boolean;
  // Derived, read-only: true when a shipment carrier is bound to this company.
  has_shipping_provider: boolean;
  last_update: string;
}

@Component({
    selector: 'app-companies',
    templateUrl: './companies.component.html',
    styleUrls: ['./companies.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompaniesComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  companies: AdminCompany[] = [];
  loading = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 20;
  total = 0;
  totalPages = 1;

  // Read-only details modal
  selectedCompany: AdminCompany | null = null;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private pageTitleService: PageTitleService
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle('Companies');
    this.loadCompanies();
  }

  loadCompanies(): void {
    this.loading = true;
    this.error = null;

    const url = `${environment.apiUrl}/company?page=${this.currentPage}&count=${this.pageSize}`;

    this.http.get<ApiResponse<AdminCompany[]>>(url).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.companies = response.data || [];
        if (response.pagination) {
          this.total = response.pagination.total || 0;
          this.totalPages = response.pagination.total_pages || Math.ceil(this.total / this.pageSize);
        } else {
          this.total = this.companies.length;
          this.totalPages = 1;
        }
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load companies:', err);
        this.error = 'Failed to load companies';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  openDetails(company: AdminCompany): void {
    this.selectedCompany = company;
  }

  closeDetails(): void {
    this.selectedCompany = null;
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadCompanies();
    }
  }

  contactPerson(company: AdminCompany): string {
    const name = `${company.contact_first_name || ''} ${company.contact_last_name || ''}`.trim();
    return name || '-';
  }

  countryCity(company: AdminCompany): string {
    return [company.country_code, company.city].filter(Boolean).join(' / ') || '-';
  }

  fullAddress(company: AdminCompany): string {
    return [company.address_text, company.zipcode, company.city, company.country_code]
      .filter(Boolean).join(', ') || '-';
  }

  formatDateTime(value: string | null | undefined): string {
    return formatDateTime(value);
  }
}
