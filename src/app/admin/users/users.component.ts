import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface AdminUser {
  uid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  store_uid?: string;
  price_type_uid?: string;
  last_login?: string;
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
    selector: 'app-users',
    templateUrl: './users.component.html',
    styleUrls: ['./users.component.scss'],
    standalone: false
})
export class UsersComponent implements OnInit {
  users: AdminUser[] = [];
  filteredUsers: AdminUser[] = [];
  loading = false;
  error: string | null = null;
  
  // Pagination
  currentPage = 1;
  pageSize = 20;
  total = 0;
  totalPages = 1;
  
  // Filters
  roleFilter: string = '';
  searchTerm = '';
  
  // Role options
  roleOptions = [
    { value: '', label: 'All Roles' },
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' },
    { value: 'user', label: 'User' },
    { value: 'client', label: 'Client' }
  ];
  
  // Edit/Create
  editingUser: AdminUser | null = null;
  showEditModal = false;
  editForm: Partial<AdminUser & { password: string; confirmPassword: string }> = {};
  isCreating = false;

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = null;

    const offset = (this.currentPage - 1) * this.pageSize;
    const url = `${environment.apiUrl}/admin/user?offset=${offset}&limit=${this.pageSize}`;

    this.http.get<ApiResponse<AdminUser[]>>(url).subscribe({
      next: (response) => {
        this.users = response.data || [];
        this.total = response.metadata?.total || this.users.length;
        this.totalPages = response.metadata?.total_pages || Math.ceil(this.total / this.pageSize);
        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load users:', err);
        this.error = 'Failed to load users';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters(): void {
    let filtered = [...this.users];

    // Apply role filter
    if (this.roleFilter) {
      filtered = filtered.filter(u => u.role === this.roleFilter);
    }

    // Apply search filter
    if (this.searchTerm.trim()) {
      const search = this.searchTerm.toLowerCase();
      filtered = filtered.filter(u =>
        u.username.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search) ||
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(search)
      );
    }

    this.filteredUsers = filtered;
  }

  onRoleFilterChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  editUser(user: AdminUser): void {
    this.editingUser = user;
    this.isCreating = false;
    this.editForm = {
      ...user,
      password: '',
      confirmPassword: ''
    };
    this.showEditModal = true;
  }

  createUser(): void {
    this.editingUser = null;
    this.isCreating = true;
    this.editForm = {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      first_name: '',
      last_name: '',
      role: 'user',
      store_uid: '',
      price_type_uid: ''
    };
    this.showEditModal = true;
  }

  saveUser(): void {
    // Validation
    if (!this.editForm.username || !this.editForm.role) {
      alert('Username and role are required');
      return;
    }

    if (this.isCreating && !this.editForm.password) {
      alert('Password is required for new users');
      return;
    }

    if (this.editForm.password && this.editForm.password !== this.editForm.confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    // Build user data
    const userData: any = {
      uid: this.editingUser?.uid || '',
      username: this.editForm.username,
      email: this.editForm.email || '',
      first_name: this.editForm.first_name || '',
      last_name: this.editForm.last_name || '',
      role: this.editForm.role, // Fixed: was user_role
    };

    // Only include store_uid and price_type_uid if they have values
    // Empty strings are allowed and will be stored as empty
    if (this.editForm.store_uid !== undefined && this.editForm.store_uid !== null) {
      userData.store_uid = this.editForm.store_uid;
    }
    if (this.editForm.price_type_uid !== undefined && this.editForm.price_type_uid !== null) {
      userData.price_type_uid = this.editForm.price_type_uid;
    }

    // Only include password if it's provided (for new users or password changes)
    // Empty password means don't change it for existing users
    if (this.editForm.password && this.editForm.password.trim() !== '') {
      userData.password = this.editForm.password;
    } else if (this.isCreating) {
      // For new users, password is required (handled by validation above)
      // If we reach here without password, validation should have caught it
      userData.password = '';
    }
    // For updates without password, don't include password field at all

    this.http.post<ApiResponse<string[]>>(`${environment.apiUrl}/admin/user`, {
      data: [userData]
    }).subscribe({
      next: () => {
        this.showEditModal = false;
        this.loadUsers();
      },
      error: (err) => {
        console.error('Failed to save user:', err);
        alert('Failed to save user: ' + (err.error?.message || err.message || 'Unknown error'));
      }
    });
  }

  deleteUser(user: AdminUser): void {
    if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) {
      return;
    }

    this.http.post(`${environment.apiUrl}/admin/user/delete`, {
      data: [user.uid]
    }).subscribe({
      next: () => {
        this.loadUsers();
      },
      error: (err) => {
        console.error('Failed to delete user:', err);
        alert('Failed to delete user');
      }
    });
  }

  cancelEdit(): void {
    this.showEditModal = false;
    this.editingUser = null;
    this.editForm = {};
    this.isCreating = false;
  }

  getRoleClass(role: string): string {
    return `role-${role.toLowerCase()}`;
  }

  formatDate(dateString?: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadUsers();
    }
  }
}

