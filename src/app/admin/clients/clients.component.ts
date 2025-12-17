import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
  price_type_uid: string;
  store_uid: string;
  active: boolean;
  last_update: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  metadata?: {
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
    standalone: false
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
  
  // Edit/Create
  editingClient: AdminClient | null = null;
  showEditModal = false;
  editForm: Partial<AdminClient> = {};

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadClients();
  }

  loadClients(): void {
    this.loading = true;
    this.error = null;

    const offset = (this.currentPage - 1) * this.pageSize;
    const url = `${environment.apiUrl}/admin/clients?offset=${offset}&limit=${this.pageSize}`;

    this.http.get<ApiResponse<AdminClient[]>>(url).subscribe({
      next: (response) => {
        this.clients = response.data || [];
        this.total = response.metadata?.total || this.clients.length;
        this.totalPages = response.metadata?.total_pages || Math.ceil(this.total / this.pageSize);
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load clients:', err);
        this.error = 'Failed to load clients';
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.clients];

    // Apply active filter
    if (this.activeFilter === 'active') {
      filtered = filtered.filter(c => c.active);
    } else if (this.activeFilter === 'inactive') {
      filtered = filtered.filter(c => !c.active);
    }

    // Apply search filter
    if (this.searchTerm.trim()) {
      const search = this.searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(search) ||
        c.email.toLowerCase().includes(search) ||
        c.phone.includes(search)
      );
    }

    this.filteredClients = filtered;
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  editClient(client: AdminClient): void {
    this.editingClient = client;
    this.editForm = { ...client };
    this.showEditModal = true;
  }

  createClient(): void {
    this.editingClient = null;
    this.editForm = {
      name: '',
      email: '',
      phone: '',
      address: '',
      discount: 0,
      vat_rate: 0,
      vat_number: '',
      price_type_uid: '',
      store_uid: '',
      active: true
    };
    this.showEditModal = true;
  }

  saveClient(): void {
    if (!this.editForm.name || !this.editForm.phone || !this.editForm.store_uid || !this.editForm.price_type_uid) {
      alert('Please fill in all required fields');
      return;
    }

    const clientData = {
      uid: this.editingClient?.uid || '',
      name: this.editForm.name,
      email: this.editForm.email || '',
      phone: this.editForm.phone,
      pin_code: this.editForm.pin_code || '',
      address: this.editForm.address || '',
      discount: this.editForm.discount || 0,
      vat_rate: this.editForm.vat_rate || 0,
      vat_number: this.editForm.vat_number || '',
      price_type_uid: this.editForm.price_type_uid,
      store_uid: this.editForm.store_uid,
      active: this.editForm.active !== undefined ? this.editForm.active : true
    };

    this.http.post<ApiResponse<string[]>>(`${environment.apiUrl}/admin/clients`, {
      data: [clientData]
    }).subscribe({
      next: () => {
        this.showEditModal = false;
        this.loadClients();
      },
      error: (err) => {
        console.error('Failed to save client:', err);
        alert('Failed to save client');
      }
    });
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

  cancelEdit(): void {
    this.showEditModal = false;
    this.editingClient = null;
    this.editForm = {};
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadClients();
    }
  }
}

