import { Component, OnInit, OnDestroy, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PageTitleService } from '../../core/services/page-title.service';
import { TranslationService } from '../../core/services/translation.service';
import { StoreService } from '../../core/services/store.service';
import { PriceTypeService } from '../../core/services/price-type.service';
import { Store } from '../../core/models/store.model';
import { PriceType } from '../../core/models/price-type.model';
import { formatDateTime } from '../../core/utils/date-format';
import { ApiResponse } from '../../core/models/api.model';
import { ToggleState, ExpandState } from '../../core/utils/ui-state';
import { KNOWN_ROLES } from '../../core/models/user.model';

export interface AdminUser {
  uid: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  /**
   * Login gate. Absent on rows written before the column existed, which the
   * backend defaults to active — so treat undefined as active everywhere.
   */
  active?: boolean;
  store_uid?: string;
  price_type_uid?: string;
  receive_email_notifications?: boolean;
  all_orders?: boolean;
  last_login?: string;
  last_update: string;
}

@Component({
    selector: 'app-users',
    templateUrl: './users.component.html',
    styleUrls: ['./users.component.scss'],
    standalone: false,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class UsersComponent implements OnInit, OnDestroy {
  private subscriptions = new Subscription();

  users: AdminUser[] = [];
  filteredUsers: AdminUser[] = [];
  loading = false;
  error: string | null = null;

  // Resolved lookups
  storesByUid: Record<string, Store> = {};
  priceTypesByUid: Record<string, PriceType> = {};

  // Pagination
  currentPage = 1;
  pageSize = 20;
  total = 0;
  totalPages = 1;

  // Filters
  roleFilter: string = '';
  statusFilter: '' | 'active' | 'blocked' = '';
  searchTerm = '';

  // Role options (labels resolved via translate pipe in template).
  // Mirrors entity.StaffRoles on the backend. The legacy "user" and "client"
  // values are gone — no authorization gate ever read them — but a row can
  // still hold one, so `legacy` is offered as a catch-all filter.
  roleOptions = [
    { value: '', labelKey: 'admin.users.allRoles' },
    { value: 'admin', labelKey: 'admin.users.roleAdmin' },
    { value: 'manager', labelKey: 'admin.users.roleManager' },
    { value: 'content_editor', labelKey: 'admin.users.roleContentEditor' },
    { value: 'legacy', labelKey: 'admin.users.roleLegacy' }
  ];

  statusOptions = [
    { value: '', labelKey: 'admin.users.allStatuses' },
    { value: 'active', labelKey: 'admin.users.statusActive' },
    { value: 'blocked', labelKey: 'admin.users.statusBlocked' }
  ];

  // Mobile UI state
  filters = new ToggleState();
  cards = new ExpandState();

  constructor(
    private http: HttpClient,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private pageTitleService: PageTitleService,
    private translation: TranslationService,
    private storeService: StoreService,
    private priceTypeService: PriceTypeService
  ) {}

  ngOnInit(): void {
    this.pageTitleService.setTitle(this.translation.instant('admin.users.title'));
    this.subscriptions.add(
      forkJoin({
        stores: this.storeService.getStores(),
        priceTypes: this.priceTypeService.getPriceTypes(),
      }).subscribe(({ stores, priceTypes }) => {
        this.storesByUid = stores;
        this.priceTypesByUid = priceTypes;
        this.cdr.detectChanges();
      })
    );
    this.loadUsers();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  loadUsers(): void {
    this.loading = true;
    this.error = null;

    const offset = (this.currentPage - 1) * this.pageSize;
    const url = `${environment.apiUrl}/admin/user?offset=${offset}&limit=${this.pageSize}`;

    this.subscriptions.add(
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
          this.error = this.translation.instant('admin.users.errLoadUsers');
          this.loading = false;
          this.cdr.detectChanges();
        }
      })
    );
  }

  applyFilters(): void {
    let filtered = [...this.users];

    if (this.roleFilter === 'legacy') {
      filtered = filtered.filter(u => !this.isKnownRole(u.role));
    } else if (this.roleFilter) {
      filtered = filtered.filter(u => u.role === this.roleFilter);
    }

    if (this.statusFilter) {
      const wantActive = this.statusFilter === 'active';
      filtered = filtered.filter(u => this.isActive(u) === wantActive);
    }

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

  onStatusFilterChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  /** A row without the flag predates the column, and the backend defaults it to active. */
  isActive(user: AdminUser): boolean {
    return user.active !== false;
  }

  /**
   * Roles the backend still accepts on write. A row outside this set holds a
   * retired value ("user"/"client") and grants no access at all — flag it so
   * an admin can spot the ones that need re-roling.
   */
  isKnownRole(role: string): boolean {
    return (KNOWN_ROLES as readonly string[]).includes(role);
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  editUser(user: AdminUser): void {
    this.router.navigate(['/admin/users', user.uid], { state: { user } });
  }

  createUser(): void {
    this.router.navigate(['/admin/users', 'new']);
  }

  storeName(uid?: string): string {
    if (!uid) return '';
    return this.storesByUid[uid]?.name || uid;
  }

  priceTypeName(uid?: string): string {
    if (!uid) return '';
    return this.priceTypesByUid[uid]?.name || uid;
  }

  getRoleClass(role: string): string {
    return `role-${role.toLowerCase()}`;
  }

  formatDate(dateString?: string): string {
    return formatDateTime(dateString);
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadUsers();
    }
  }
}
