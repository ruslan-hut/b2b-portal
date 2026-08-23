import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy, DestroyRef, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { PageTitleService } from '../../core/services/page-title.service';
import { ConfirmDialogService } from '../../core/services/confirm-dialog.service';
import { NotificationService } from '../../core/services/notification.service';
import { ApiResponse } from '../../core/models/api.model';
import { ToggleState, ExpandState } from '../../core/utils/ui-state';

export interface AdminClient {
  uid: string;
  name: string;
  email: string;
  phone: string;
  pin_code: string;
  address: string;
  discount: number;
  additional_discount?: number; // Bonus discount in percentage points, added after any product discount limit
  vat_rate?: number; // VAT rate percentage (0-100)
  vat_number?: string; // VAT registration number
  balance?: number; // Current monthly purchase turnover in cents
  fixed_discount?: boolean; // If true, use discount field; if false, use scale lookup
  price_type_uid: string;
  store_uid: string;
  active: boolean;
  last_update: string;
}

@Component({
    selector: 'app-clients',
    templateUrl: './clients.component.html',
    styleUrls: ['./clients.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  clients: AdminClient[] = [];
  filteredClients: AdminClient[] = [];
  loading = false;
  error: string | null = null;

  // Pagination
  currentPage = 1;
  pageSize = 20;
  total = 0;
  totalPages = 1;

  // Filters
  activeFilter: 'all' | 'active' | 'inactive' = 'all';
  searchTerm = '';
  noBusinessNumber = false;
  noVATNumber = false;

  // Mobile UI state
  filters = new ToggleState();
  cards = new ExpandState();

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private pageTitleService: PageTitleService,
    private confirmDialog: ConfirmDialogService,
    private notifications: NotificationService
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle('Clients');
    this.loadClients();
  }



  loadClients(): void {
    this.loading = true;
    this.error = null;

    // Backend handler reads from request body, but for GET requests it defaults to page 1, count 100
    // We'll use GET with query parameters - if backend doesn't support it, we'll need to update the handler
    // For now, let's try GET with query params first
    let url = `${environment.apiUrl}/admin/clients?page=${this.currentPage}&count=${this.pageSize}`;
    
    // Add search parameter if search term is set
    if (this.searchTerm.trim()) {
      url += `&search=${encodeURIComponent(this.searchTerm.trim())}`;
    }
    if (this.noBusinessNumber) {
      url += '&no_business_number=true';
    }
    if (this.noVATNumber) {
      url += '&no_vat_number=true';
    }

    this.http.get<ApiResponse<AdminClient[]>>(url).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (response) => {
          this.clients = response.data || [];
          // Set pagination values from pagination field (backend uses 'pagination', not 'metadata')
          if (response.pagination) {
            this.total = response.pagination.total || 0;
            this.totalPages = response.pagination.total_pages || Math.ceil(this.total / this.pageSize);
          } else {
            // If no pagination, we can't determine total, so assume single page
            console.warn('[Clients] No pagination in response');
            this.total = this.clients.length;
            this.totalPages = 1;
          }

          this.applyFilters();
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Failed to load clients:', err);
          this.error = 'Failed to load clients';
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
  }

  applyFilters(): void {
    let filtered = [...this.clients];

    // Apply active filter (client-side, since backend search doesn't filter by active status)
    if (this.activeFilter === 'active') {
      filtered = filtered.filter(c => c.active);
    } else if (this.activeFilter === 'inactive') {
      filtered = filtered.filter(c => !c.active);
    }

    // Note: Search filtering is now done on the backend
    this.filteredClients = filtered;
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadClients();
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.loadClients();  // Reload from backend with search parameter
  }

  editClient(client: AdminClient): void {
    this.router.navigate(['/admin/clients', client.uid]);
  }

  createClient(): void {
    this.router.navigate(['/admin/clients/new']);
  }

  toggleActive(client: AdminClient): void {
    this.http.post(`${environment.apiUrl}/admin/clients/active`, {
        data: [{
          uid: client.uid,
          active: !client.active
        }]
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.loadClients();
        },
        error: (err) => {
          console.error('Failed to update client status:', err);
          this.notifications.error('Failed to update client status');
        }
      });
  }

  async deleteClient(client: AdminClient): Promise<void> {
    const confirmed = await this.confirmDialog.ask({
      message: `Are you sure you want to delete client "${client.name}"?`,
      danger: true
    });
    if (!confirmed) {
      return;
    }

    this.http.post(`${environment.apiUrl}/admin/clients/delete`, {
        data: [client.uid]
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          this.loadClients();
        },
        error: (err) => {
          console.error('Failed to delete client:', err);
          this.notifications.error('Failed to delete client');
        }
      });
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadClients();
    }
  }

  // Format balance from cents to display
  formatBalance(cents: number | undefined): string {
    if (cents === undefined || cents === null) return '-';
    return (cents / 100).toFixed(2);
  }

}
