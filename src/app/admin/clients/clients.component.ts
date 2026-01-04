import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export interface AdminClient {
  uid: string;
  name: string;
  email: string;
  phone: string;
  pin_code: string;
  address: string;
  discount: number;
  vat_rate?: number; // VAT rate percentage (0-100)
  vat_number?: string; // VAT registration number
  balance?: number; // Current monthly purchase turnover in cents
  fixed_discount?: boolean; // If true, use discount field; if false, use scale lookup
  price_type_uid: string;
  store_uid: string;
  active: boolean;
  last_update: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    count: number;
    total: number;
    total_pages: number;
  };
}

@Component({
    selector: 'app-clients',
    templateUrl: './clients.component.html',
    styleUrls: ['./clients.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClientsComponent implements OnInit {
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

  // Mobile UI state
  isFiltersExpanded = false;
  expandedCardIds: Set<string> = new Set();

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
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

    this.http.get<ApiResponse<AdminClient[]>>(url).subscribe({
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
    this.applyFilters();
    this.cdr.detectChanges();
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
    }).subscribe({
      next: () => {
        this.loadClients();
      },
      error: (err) => {
        console.error('Failed to update client status:', err);
        alert('Failed to update client status');
      }
    });
  }

  deleteClient(client: AdminClient): void {
    if (!confirm(`Are you sure you want to delete client "${client.name}"?`)) {
      return;
    }

    this.http.post(`${environment.apiUrl}/admin/clients/delete`, {
      data: [client.uid]
    }).subscribe({
      next: () => {
        this.loadClients();
      },
      error: (err) => {
        console.error('Failed to delete client:', err);
        alert('Failed to delete client');
      }
    });
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadClients();
    }
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisible = 5; // Show max 5 page numbers
    
    if (this.totalPages <= maxVisible) {
      // Show all pages if total is less than max visible
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages around current page
      let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
      let end = Math.min(this.totalPages, start + maxVisible - 1);
      
      // Adjust start if we're near the end
      if (end - start < maxVisible - 1) {
        start = Math.max(1, end - maxVisible + 1);
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  }

  goToFirstPage(): void {
    this.goToPage(1);
  }

  goToLastPage(): void {
    this.goToPage(this.totalPages);
  }

  getEndItemNumber(): number {
    return Math.min(this.currentPage * this.pageSize, this.total);
  }

  getStartItemNumber(): number {
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  // Format balance from cents to display
  formatBalance(cents: number | undefined): string {
    if (cents === undefined || cents === null) return '-';
    return (cents / 100).toFixed(2);
  }

  // Mobile UI methods
  toggleFilters(): void {
    this.isFiltersExpanded = !this.isFiltersExpanded;
  }

  toggleCardExpanded(clientUid: string): void {
    if (this.expandedCardIds.has(clientUid)) {
      this.expandedCardIds.delete(clientUid);
    } else {
      this.expandedCardIds.add(clientUid);
    }
  }

  isCardExpanded(clientUid: string): boolean {
    return this.expandedCardIds.has(clientUid);
  }
}
